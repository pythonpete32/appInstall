const {encodeCallScript} = require('@aragon/test-helpers/evmScript');
const {
    encodeActCall,
    execAppMethod,
} = require('@aragon/toolkit');
const ethers = require('ethers');
const utils = require('ethers/utils');
const {keccak256} = require('web3-utils');

const {RLP} = utils;
const provider = ethers.getDefaultProvider('rinkeby');
const BN = utils.bigNumberify;

const env = 'rinkeby'; // this is how you set env

// DAO addresses
const dao = '0xb92Fb39E30c874faFe068313DbF2D2A60e699643';
const acl = '0xbb084dc9a575132946d93d1501bc1fd764dc57cc';
const sabVoting = '0x87c303ba10cbbf64e7fe340b7fba7427f28b70d6';
const comAggregator = '0x753761C27aF3CB7fD4fa667245C433EC7c17d08f'; 
const comVoting = '0x7c504Bb27dd2a5A1a4e3496Eb084fD31E43b34d2';
const finance = '0x6a641ff46049b61f1e6c2cd20a620ecd4e2f1c8d';

// new apps
const votingAggregatorAppId =
    '0xb7e96a57761ff614ad73fad84d9e7f8237911cfe4c0b4c0c2e95e5cc80fd43f3';
const votingAggregatorBase = '0xa29B22647Dde5Cee19eF578700fEC448Bc10d951';
const votingAppId =
    '0x9fa3927f639745e587912d4b0fea7ef9013bf93fb907d29faeab57417ba6e1d4';
const votingBase = '0xb4fa71b3352D48AA93D34d085f87bb4aF0cE6Ab5';
let votingAggregator;
let inbox;

// signatures
const newAppInstanceSignature = 'newAppInstance(bytes32,address,bytes,bool)';
const createPermissionSignature =
    'createPermission(address,address,bytes32,address)';
const grantPermissionSignature = 'grantPermission(address,address,bytes32)';
const revokePermissionSignature = 'revokePermission(address,address,bytes32)';
const aggregatorInitSignature = 'initialize(string,string,uint8)';
const addPowerSourceSignature = 'addPowerSource(address,uint8,uint256)';

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


async function firstTx() {
    // counterfactual addresses
    const nonce = await buildNonceForAddress(dao, 0, provider);
    const newAddress = await calculateNewProxyAddress(dao, nonce);
    votingAggregator = newAddress;

    // app initialisation payloads
    const aggregatorInitPayload = await encodeActCall(aggregatorInitSignature, [
        'Inbox',
        'INBOX',
        18,
    ]);

    // package first transaction
    const calldatum = await Promise.all([
        encodeActCall(newAppInstanceSignature, [
            votingAggregatorAppId,
            votingAggregatorBase,
            aggregatorInitPayload,
            false,
        ]),
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
        encodeActCall(addPowerSourceSignature, [comAggregator, 1, 1]),
    ]);

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
        {
            to: votingAggregator,
            calldata: calldatum[4],
        },
    ];
    const script = encodeCallScript(actions);

    await execAppMethod(
        dao,
        sabVoting,
        'newVote',
        [
            script,
            `1. install voting aggregator
            2. create ADD_POWER_SOURCE_ROLE grant sabVoting managed by sabVoting
            3. create MANAGE_POWER_SOURCE_ROLE grant sabVoting managed by sabVoting
            4. create MANAGE_POWER_SOURCE_ROLE grant sabVoting managed by sabVoting
            5. call addPowerSource(communityToken, 1, 1)`,
        ],
        env,
    );
}

async function secondTx() {
    const nonce = await buildNonceForAddress(dao, 1, provider);
    const newAddress = await calculateNewProxyAddress(dao, nonce);
    inbox = newAddress;

    // function signatures
    const inboxInitSignature = 'initialize(address,uint64,uint64,uint64)';

    // app initialisation payloads
    const inboxInitPayload = await encodeActCall(inboxInitSignature, [
        votingAggregator,
        BN('250000000000000000'),
        BN('10000000000000000'),
        604800,
    ]);

    const calldatum = await Promise.all([
        encodeActCall(newAppInstanceSignature, [
            votingAppId,
            votingBase,
            inboxInitPayload,
            true,
        ]),
        encodeActCall(createPermissionSignature, [
            comVoting,
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
        encodeActCall(grantPermissionSignature, [
            inbox,
            comVoting,
            keccak256('CREATE_VOTES_ROLE'),
        ]),
        encodeActCall(grantPermissionSignature, [
            comVoting,
            finance,
            keccak256('CREATE_PAYMENTS_ROLE'),
        ]),
        encodeActCall(grantPermissionSignature, [
            comVoting,
            finance,
            keccak256('EXECUTE_PAYMENTS_ROLE'),
        ]),
        encodeActCall(revokePermissionSignature, [
            sabVoting,
            finance,
            keccak256('EXECUTE_PAYMENTS_ROLE'),
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
        {
            to: acl,
            calldata: calldatum[4],
        },
        {
            to: acl,
            calldata: calldatum[5],
        },
        {
            to: acl,
            calldata: calldatum[6],
        },
        {
            to: acl,
            calldata: calldatum[7],
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
            2. create CREATE_VOTES_ROLE grant comAggregator managed by sabVoting
            3. create MODIFY_SUPPORT_ROLE grant sabVoting managed by sabVoting
            4. create MODIFY_QUORUM_ROLE grant sabVoting managed by sabVoting
            5. CREATE_VOTES_ROLE on comVoting grant inbox`,
        ],
        env,
    );
}

const main = async () => {
    await firstTx();
    await secondTx();
};

main()
    .then(() => {
        console.log('Script finished.');
        process.exit();
    })
    .catch((e) => console.error(e));
