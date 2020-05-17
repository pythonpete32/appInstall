const ethers = require('ethers')
const utils = require('ethers/utils')
const { keccak256, RLP } = utils

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

const provider = ethers.getDefaultProvider('rinkeby');
const dao = '0x57d9481D50c6c519fa5E20BDa46b2d817504D354' // permissionsworkshop.aragonid.eth

buildNonceForAddress(dao, 1, provider).then(nonce => {
  console.log('nonce:', nonce)
  calculateNewProxyAddress(dao, nonce).then(addr => {
    console.log('app address:', addr)
  })
})