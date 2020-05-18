/* eslint-disable no-unused-vars */
/* eslint-disable no-shadow */
const {encodeCallScript} = require('@aragon/test-helpers/evmScript');
const {
    encodeActCall,
    execAppMethod,
    getAclAddress,
} = require('@aragon/toolkit');
const ethers = require('ethers');
const utils = require('ethers/utils');
const {keccak256} = require('web3-utils'); // keccak256 gives an error when trying to encode permissions

const {RLP} = utils;
const provider = ethers.getDefaultProvider('rinkeby');
const BN = utils.bigNumberify;

const env = 'rinkeby'; // this is how you set env

// DAO addresses
// https://rinkeby.aragon.org/#/azsxdc123
const dao = '0x9dd734B6cE698503bb24FB2F27c9E69491E6F6C5';
const acl = '0x3b423a82baaadabdbd2920623daf544afc1c4305';
const sabVoting = '0x0206d6d8225893cdc743c948f1e5ab99d244a270';
const comToken = '0x4Ff930e512426BFb85B6879A6523D32ef2DFA4C2';
const votingAggregatorAppId =
    '0xb7e96a57761ff614ad73fad84d9e7f8237911cfe4c0b4c0c2e95e5cc80fd43f3';
const votingAggregatorBase = '0xa29B22647Dde5Cee19eF578700fEC448Bc10d951';

const newAppInstanceSignature = 'newAppInstance(bytes32,address,bytes,bool)';
const createPermissionSignature =
    'createPermission(address,address,bytes32,address)';
const grantSignature = 'grantPermission(address,address,bytes32)';

// functions for counterfactual addresses
async function buildNonceForAddress(address, index, provider) {
    const txCount = await provider.getTransactionCount(address);
    return `0x${(txCount + index).toString(16)}`;
}

async function calculateNewProxyAddress(daoAddress, nonce) {
    const rlpEncoded = RLP.encode([daoAddress, nonce]);
    const contractAddressLong = keccak256(rlpEncoded);
    const contractAddress = `0x${contractAddressLong.substr(-40)}`;

    return contractAddress;
}

// 1. install voting aggregator
// 2. create ADD_POWER_SOURCE_ROLE grant sabVoting managed by sabVoting
// 3. create MANAGE_POWER_SOURCE_ROLE grant sabVoting managed by sabVoting
// 4. create MANAGE_POWER_SOURCE_ROLE grant sabVoting managed by sabVoting
// 5. call addPowerSource(communityToken, 1, 1)
async function firstTx() {
    // counterfactual addresses
    const nonce = await buildNonceForAddress(dao, 0, provider);
    const newAddress = await calculateNewProxyAddress(dao, nonce);
    const votingAggregator = newAddress;

    // function signatures
    const aggregatorInitSignature = 'initialize(string,string,uint8)';
    const addPowerSourceSignature = 'addPowerSource(address,uint8,uint256)';

    // app initialisation payloads
    const aggregatorInitPayload = await encodeActCall(aggregatorInitSignature, [
        'Inbox',
        'INBOX',
        18,
    ]);

    // package first transaction
    const calldatum = await Promise.all([
        encodeActCall(newAppInstanceSignature, [
            votingAggregatorBase,
            votingAggregator,
            aggregatorInitPayload,
            false,
        ]),
    ]);
    /*
        encodeActCall(createPermissionSignature, [
            sabVoting,
            votingAggregator,
            keccak256('ADD_POWER_SOURCE_ROLE'),
            sabVoting,
        ]),
        encodeActCall(createPermissionSignature, [
            sabVoting,
            votingAggregator,
            keccak256('MANAGE_POWER_SOURCE_ROLE'),
            sabVoting,
        ]),
        encodeActCall(createPermissionSignature, [
            sabVoting,
            votingAggregator,
            keccak256('MANAGE_WEIGHTS_ROLE'),
            sabVoting,
        ]),
        encodeActCall(addPowerSourceSignature, [comToken, 1, 1]),
*/
    // Encode all actions into a single EVM script.
    const actions = [
        {
            to: dao,
            calldata: calldatum[0],
        },
    ];

    /*
,
        {
            to: acl,
            calldata: calldatum[1],
        },
        {
            to: acl,
            calldata: calldatum[2],
        },
        {
            to: acl,
            calldata: calldatum[3],
        },
        {
            to: votingAggregator,
            calldata: calldatum[4],
        },
*/
    const script = encodeCallScript(actions);

    await execAppMethod(
        dao,
        sabVoting,
        'newVote',
        [script, '1. install voting aggregator'],
        env,
    );
    /*
`            2. create ADD_POWER_SOURCE_ROLE grant sabVoting managed by sabVoting
            3. create MANAGE_POWER_SOURCE_ROLE grant sabVoting managed by sabVoting
            4. create MANAGE_POWER_SOURCE_ROLE grant sabVoting managed by sabVoting
            5. call addPowerSource(communityToken, 1, 1)`
*/
}

// 1. install voting (Inbox)
// 2. create CREATE_VOTES_ROLE grant comManager managed by sabVoting
// 3. create MODIFY_SUPPORT_ROLE grant sabVoting managed by sabVoting
// 4. create MODIFY_QUORUM_ROLE grant sabVoting managed by sabVoting
// 5. CREATE_VOTES_ROLE on comVoting grant inbox
async function secondTx() {
    // counterfactual addresses
    const nonce = await buildNonceForAddress(dao, 0, provider);
    const newAddress = await calculateNewProxyAddress(dao, nonce);
    const inbox = newAddress;

    // function signatures
    const inboxInitSignature = 'initialize(address,uint64,uint64,uint64)';

    // app initialisation payloads
    const inboxInitPayload = await encodeActCall(inboxInitSignature, [
        comToken,
        BN('250000000000000000'),
        BN('10000000000000000'),
        604800,
    ]);

    // package first transaction
    // issues
    //  1. the first encodeActCall, the last argument is true because it is a standard app?
    const calldatum = await Promise.all([
        encodeActCall(newAppInstanceSignature, [
            utils.namehash('voting.aragonpm.eth'),
            inbox,
            inboxInitPayload,
            true,
        ]),
        encodeActCall(createPermissionSignature, [
            sabVoting,
            inbox,
            keccak256('CREATE_VOTES_ROLE'),
            sabVoting,
        ]),
        encodeActCall(createPermissionSignature, [
            sabVoting,
            inbox,
            keccak256('MODIFY_SUPPORT_ROLE'),
            sabVoting,
        ]),
        encodeActCall(createPermissionSignature, [
            sabVoting,
            inbox,
            keccak256('MODIFY_QUORUM_ROLE'),
            sabVoting,
        ]),
    ]);

    // Encode all actions into a single EVM script.
    const actions = [
        {
            to: dao,
            calldata: calldatum[0],
        },
        {
            to: acl,
            calldata: calldatum[1],
        },
        {
            to: acl,
            calldata: calldatum[2],
        },
        {
            to: acl,
            calldata: calldatum[3],
        },
    ];
    const script = encodeCallScript(actions);

    await execAppMethod(
        dao,
        sabVoting,
        'newVote',
        [
            script,
            `1. install voting (Inbox)
            2. create CREATE_VOTES_ROLE grant comManager managed by sabVoting
            3. create MODIFY_SUPPORT_ROLE grant sabVoting managed by sabVoting
            4. create MODIFY_QUORUM_ROLE grant sabVoting managed by sabVoting
            5. CREATE_VOTES_ROLE on comVoting grant inbox`,
        ],
        env,
    );
}

const main = async () => {
    await firstTx();
    //    await secondTx();
};

main()
    .then(() => {
        console.log('Script finished.');
        process.exit();
    })
    .catch((e) => console.error(e));
