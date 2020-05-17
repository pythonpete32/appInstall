/* eslint-disable no-use-before-define */
/* eslint-disable no-unused-vars */
const { encodeCallScript } = require('@aragon/test-helpers/evmScript')
const { encodeActCall } = require('@aragon/toolkit')
const ethers = require('ethers')
const utils = require('ethers/utils')

const { keccak256, RLP } = utils

const provider = ethers.getDefaultProvider('rinkeby');
const newAppInstanceSignature = 'newAppInstance(bytes32,address,bytes,bool)'
console.log(encodeActCall)

const run = async () => {
    const aggregatorInitSignature = 'initialize(string,string,uint8)'
    const aggregatorInitPayload = await encodeActCall(aggregatorInitSignature,['Inbox', 'INBOX', 18])

    return console.log(encodeActCall(newAppInstanceSignature, [
        utils.namehash('voting-aggregator.open.aragonpm.eth'),
        '0xa29B22647Dde5Cee19eF578700fEC448Bc10d951',
        aggregatorInitPayload,
        false
    ]))
}

run()


