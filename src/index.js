/* eslint-disable no-use-before-define */
/* eslint-disable no-unused-vars */
const { encodeCallScript } = require('@aragon/test-helpers/evmScript')
const { encodeActCall } = require('@aragon/toolkit')
const ethers = require('ethers')
const utils = require('ethers/utils')

const { keccak256, RLP } = utils
const provider = ethers.getDefaultProvider('rinkeby');

// https://rinkeby.aragon.org/#/azsxdc123
const dao = '0xc466e089CfC2935dF3f471AC291402e00d41C9D7'
const sabManager = '0x87a31b9a2ee0b7b7899192e94eec3334135d607e'
const sabVoting = '0x29c58e25df47f1b958e1d707fb7b4a9800554d5c'

// function signatures
const newAppInstanceSignature = 'newAppInstance(bytes32,address,bytes,bool)'
const createSignature = 'createPermission(address,address,bytes32,address)'
const grantSignature = 'grantPermission(address,address,bytes32)'
const revokeSignature = 'revokePermission(address,address,bytes32)'
const aggregatorInitSignature = 'initialize(string,string,uint8)'

// app initialisation payloads

async function main() {
    const aggregatorInitPayload = await encodeActCall(aggregatorInitSignature,['Inbox', 'INBOX', 18])

    const aggregatorAddress = buildNonceForAddress(dao, 0, provider).then(nonce => {
        console.log('nonce:', nonce)
        calculateNewProxyAddress(dao, nonce).then(addr => {
            console.log('aggregator address:', addr)
        })
    })

    const inboxAddress = buildNonceForAddress(dao, 1, provider).then(nonce => {
        console.log('nonce:', nonce)
        calculateNewProxyAddress(dao, nonce).then(addr => {
            console.log('inbox address:', addr)
        })
    })


    const calldatum = await Promise.all([
        encodeActCall(newAppInstanceSignature, [
            'voting-aggregator',
            '0xa29B22647Dde5Cee19eF578700fEC448Bc10d951',
            aggregatorInitPayload,
            false
        ]),
        encodeActCall(createSignature, [
            aggregatorAddress,
            'ADD_POWER_SOURCE_ROLE',
            sabVoting,
            sabVoting
        ]),
        encodeActCall(createSignature, [
            aggregatorAddress,
            'MANAGE_POWER_SOURCE_ROLE',
            sabVoting,
            sabVoting
        ]),
        encodeActCall(createSignature, [
            aggregatorAddress,
            'MANAGE_WEIGHTS_ROLE',
            sabVoting,
            sabVoting
        ]),
    ])

}

async function buildNonceForAddress(address, index, provider) {
    const txCount = await provider.getTransactionCount(address)
    return `0x${(txCount + index).toString(16)}`
}

/**
 * Calculates the next created address by the kernel
 * @dev see https://ethereum.stackexchange.com/questions/760/how-is-the-address-of-an-ethereum-contract-computed/761#761
 * @param {*} daoAddress address of the kernel
 * @param {*} nonce address nonce
 * @returns {string} conterfactual address
 */
async function calculateNewProxyAddress(daoAddress, nonce) {
    const rlpEncoded = RLP.encode([daoAddress, nonce])
    const contractAddressLong = keccak256(rlpEncoded)
    const contractAddress = `0x${contractAddressLong.substr(-40)}`

    return contractAddress
}

main()