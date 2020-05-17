/* eslint-disable no-unused-vars */
/* eslint-disable no-shadow */
const {
    encodeCallScript
} = require('@aragon/test-helpers/evmScript');
const {
    encodeActCall,
    execAppMethod
} = require('@aragon/toolkit');
const ethers = require('ethers');
const utils = require('ethers/utils');
const {
    keccak256
} = require('web3-utils'); // keccak256 gives an error when trying to encode permissions

const {
    RLP
} = utils;
const provider = ethers.getDefaultProvider('rinkeby');
const BN = utils.toBN;

// DAO addresses
// https://rinkeby.aragon.org/#/azsxdc123
const dao = '0x026458457372841C80e44A5B016fc015f45d2355';
const acl = '0x9c1365074c0919e590bb23fe2df70f20fc8cbd3e';
const sabVoting = '0xb4b771fd43d5d3d885ff8334e03617143d6b9641';
const comToken = '0x7Af1a0450531912d11B6F1761CB23260523B100a';
const env = 'rinkeby'; // this is how you set env
let votingAggregator;
let inbox;

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
    votingAggregator = newAddress;

    // function signatures
    const newAppInstanceSignature =
        'newAppInstance(bytes32,address,bytes,bool)';
    const createSignature = 'createPermission(address,address,bytes32,address)';
    const grantSignature = 'grantPermission(address,address,bytes32)';
    const aggregatorInitSignature = 'initialize(string,string,uint8)';
    const addPowerSourceSignature =
        'addPowerSource(address _sourceAddr, uint8 _sourceType, uint256 _weight)';

    // app initialisation payloads
    const aggregatorInitPayload = await encodeActCall(aggregatorInitSignature, [
        'Inbox',
        'INBOX',
        18,
    ]);

    // package first transaction
    // issues
    //  1. Promises 😩 aggregator address is not being resolved before calling second `encodeActCall`. HardCoded to move on
    //  2. `addPowerSourceSignature` requires an enum, not sure how to handle this other than changing it to `uint8`
    //  3. `_executionScript` requires meta data, can i use anything i like?
    //  4. the aggregator is failing to execute `you may not have permission` error when trying to vote
    const calldatum = await Promise.all([
        encodeActCall(newAppInstanceSignature, [
            utils.namehash('voting-aggregator.open.aragonpm.eth'),
            votingAggregator,
            aggregatorInitPayload,
            false,
        ]),
        encodeActCall(createSignature, [
            sabVoting,
            votingAggregator,
            keccak256('ADD_POWER_SOURCE_ROLE'),
            sabVoting,
        ]),
        encodeActCall(createSignature, [
            sabVoting,
            votingAggregator,
            keccak256('MANAGE_POWER_SOURCE_ROLE'),
            sabVoting,
        ]),
        encodeActCall(createSignature, [
            sabVoting,
            votingAggregator,
            keccak256('MANAGE_WEIGHTS_ROLE'),
            sabVoting,
        ]),
        encodeActCall(addPowerSourceSignature, [comToken, 1, 1]),
    ]);

    // Encode all actions into a single EVM script.
    const actions = calldatum.map((calldata) => ({
        to: acl,
        calldata,
    }));

    const script = encodeCallScript(actions);

    await execAppMethod(dao, sabVoting, 'newVote', [script, 'title'], env);
}

/*
// 1. install voting (Inbox)
// 2. create CREATE_VOTES_ROLE grant comManager managed by sabVoting
// 3. create MODIFY_SUPPORT_ROLE grant sabVoting managed by sabVoting
// 4. create MODIFY_QUORUM_ROLE grant sabVoting managed by sabVoting
// 5. CREATE_VOTES_ROLE on comVoting grant inbox
async function secondTx() {
  buildNonceForAddress(dao, 1, provider).then((nonce) => {
    console.log('nonce:', nonce);
    calculateNewProxyAddress(dao, nonce).then((addr) => {
      // console.log('inbox address:', addr)
      inbox = addr;
    });
  });

  // function signatures
  const newAppInstanceSignature = 'newAppInstance(bytes32,address,bytes,bool)';
  const createSignature = 'createPermission(address,address,bytes32,address)';
  const grantSignature = 'grantPermission(address,address,bytes32)';
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
      '0xb4fa71b3352D48AA93D34d085f87bb4aF0cE6Ab5',
      inboxInitPayload,
      true,
    ]),
    encodeActCall(createSignature, [
      sabVoting,
      '0x734489815f53c43ba903012b775bece72e14a30a',
      keccak256('CREATE_VOTES_ROLE'),
      sabVoting,
    ]),
    encodeActCall(createSignature, [
      sabVoting,
      '0x734489815f53c43ba903012b775bece72e14a30a',
      keccak256('MODIFY_SUPPORT_ROLE'),
      sabVoting,
    ]),
    encodeActCall(createSignature, [
      sabVoting,
      '0x734489815f53c43ba903012b775bece72e14a30a',
      keccak256('MODIFY_QUORUM_ROLE'),
      sabVoting,
    ]),
  ]);

  // Encode all actions into a single EVM script.
  const actions = calldatum.map((calldata) => ({
    to: acl,
    calldata,
  }));

  const script = encodeCallScript(actions);

  console.log(
    `npx dao exec ${dao} ${sabVoting} newVote ${script} someMetaData --environment aragon:rinkeby --use-frame`,
  );
}
*/
firstTx();
