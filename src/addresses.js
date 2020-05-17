const { keccak256 } = require('web3-utils') // keccak256 gives an error when trying to encode permissions
const ethers = require('ethers') 
const utils = require('ethers/utils')

const provider = ethers.getDefaultProvider('rinkeby');
const { RLP } = utils

// https://rinkeby.aragon.org/#/azsxdc123
const dao = '0xc466e089CfC2935dF3f471AC291402e00d41C9D7'
const sabManager = '0x87a31b9a2ee0b7b7899192e94eec3334135d607e'
const sabVoting = '0x29c58e25df47f1b958e1d707fb7b4a9800554d5c'

async function buildNonceForAddress(address, index, provider) {
    const txCount = await provider.getTransactionCount(address)
    return `0x${(txCount + index).toString(16)}`
}


async function calculateNewProxyAddress(daoAddress, nonce) {
    const rlpEncoded = RLP.encode([daoAddress, nonce])
    const contractAddressLong = keccak256(rlpEncoded)
    const contractAddress = `0x${contractAddressLong.substr(-40)}`

    return contractAddress
}

export default async () => {
    const aggregatorAddress = await buildNonceForAddress(dao, 0, provider).then(nonce => {
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

    return {
        'dao': dao,
        'sabManager': sabManager,
        'sabVoting': sabVoting,
        'aggregator': aggregatorAddress,
        'inbox': inboxAddress
    }
}