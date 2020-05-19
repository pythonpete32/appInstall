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
const dao = '0x1dcD3B94027ec9125C475E9c2e09C7B6fAFaD631';
const acl = '0x5e8d89e1d7365267908f7d69165669eb41111596';
const sabVoting = '0xbc1863a593aaebb40b4f43665de30174c9d3fe29';
const comAggregator = '0xe65835cd7c9311866ae5d260a1eb7b963899ca14'; 
const comVoting = '0x5616500b003475136ee6b0844896a2e1ccc68140';
const finance = '0x7cd2df9217173528110e2c44eb18bd4cf0bbc601';

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
            votingAggregator,
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
            5. CREATE_VOTES_ROLE on votingAggregator grant inbox
            6. CREATE_PAYMENTS_ROLE on finance grant comVoting
            7. EXECUTE_PAYMENTS_ROLE on finance grant comVoting
            8. EXECUTE_PAYMENTS_ROLE on finance revoke sabVoting`,
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
