const Magneth = artifacts.require('Magneth')
const web3 = Magneth.web3
const SimpleToken = artifacts.require('SimpleToken')
const ethUtils = require('ethereumjs-util')
const Wallet = require('ethereumjs-wallet');
const utils = require('./utils')

const deployMultisig = (owners, confirmations) => {
    return Magneth.new(owners, confirmations)
}
const deployToken = (multisigInstance) => {
	return SimpleToken.new(multisigInstance)
}

const privateKeys = [
    ethUtils.toBuffer('0xced26e4f0ad256777efa4b205ac3003eca7e1befb9f657be58600b7115a6cdf1'),
    ethUtils.toBuffer('0x3132ce18b38230af1f8d751f5658c97e59d33a9e884676fddfc9cc4434cd36fb'),
    ethUtils.toBuffer('0x087df46b73931fd31751e80a203bb6be011f3ab2cf1930b2a92db901f0fdffc6'),
    ethUtils.toBuffer('0xeb558208fc7e52bc018d11414e6e624d0ab44a7cb63dfad9d75f913b45268746'),
    ethUtils.toBuffer('0xde43de7119a20ee767b39b926058096f95812058ed1c078f35269b5c788a33cf'),
];

const wallets = [
    Wallet.fromPrivateKey(privateKeys[0]),
    Wallet.fromPrivateKey(privateKeys[1]),
    Wallet.fromPrivateKey(privateKeys[2]),
    Wallet.fromPrivateKey(privateKeys[3]),
    Wallet.fromPrivateKey(privateKeys[4])
]

contract('Magneth', () => {
    let multisigInstance
    let tokenInstance
    const requiredConfirmations = 2
    const emptyHash = '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'


    function encodeTransactionId(destination, value, data) {

        let dataHash = emptyHash
        if (data !== "0x") {
            dataHash = web3.utils.soliditySha3({ t: 'bytes', v: data });
        }

        return web3.utils.soliditySha3(
            { t: 'address', v: multisigInstance.address },
            { t: 'address', v: destination },
            { t: 'uint256', v: value },
            { t: 'bytes', v: dataHash }
        );
    }

    
    before(async () => {
        multisigInstance = await deployMultisig([wallets[0].getAddressString(), wallets[1].getAddressString()], requiredConfirmations)
        tokenInstance = await deployToken(multisigInstance.address)
        assert.ok(tokenInstance)

        const deposit = 10000000

        // Send money to wallet contract
        await new Promise((resolve, reject) => web3.eth.sendTransaction({to: multisigInstance.address, value: deposit, from: wallets[0].getAddressString()}, e => (e ? reject(e) : resolve())))
        const balance = await utils.balanceOf(web3, multisigInstance.address)
        assert.equal(balance.valueOf(), deposit)
    })
    
    it('Should transfer tokens', async () => {

        const value = 1000000
        // Encode transfer call for the multisig
        const transferEncoded = tokenInstance.contract.methods.transfer(wallets[1].getAddressString(), value).encodeABI()

        const transactionId = encodeTransactionId(tokenInstance.address, 0, transferEncoded)
        const sig1 = utils.formatSignature(ethUtils.ecsign(ethUtils.toBuffer(transactionId), wallets[0].getPrivateKey()))
        const sig2 = utils.formatSignature(ethUtils.ecsign(ethUtils.toBuffer(transactionId), wallets[1].getPrivateKey()))
        const signatures = utils.concatSignature([sig1, sig2])

        const executedTransactionId = utils.getParamFromTxEvent(
            await multisigInstance.submitTransaction(tokenInstance.address, 0, transferEncoded, signatures, {from: wallets[0].getAddressString()}),
            'transactionId', null, 'Execution')

        assert.equal(transactionId, executedTransactionId)
        // Check that the transfer has actually occured
        assert.equal(
            1000000,
            await tokenInstance.balanceOf(wallets[1].getAddressString())
        )
    })
/*
    it('Should fail tokens transfer', async () => {
        // Issue tokens to the multisig address
        const value = 1000000
        const issueResult = await tokenInstance.issueTokens(multisigInstance.address, value, {from: wallets[0].getAddressString()})
        assert.ok(issueResult)

        // Encode transfer call for the multisig
        const transferEncoded = tokenInstance.contract.methods.transfer(wallets[1].getAddressString(), value).encodeABI()

        const transactionId = encodeTransactionId(tokenInstance.address, 0, transferEncoded)
        const sig1 = utils.formatSignature(ethUtils.ecsign(ethUtils.toBuffer(transactionId), wallets[0].getPrivateKey()))
        const sig2 = utils.formatSignature(ethUtils.ecsign(ethUtils.toBuffer(transactionId), wallets[2].getPrivateKey()))
        const signatures = utils.concatSignature([sig1, sig2])

        utils.assertThrowsAsynchronously(
            multisigInstance.submitTransaction(tokenInstance.address, 0, transferEncoded, signatures, {from: wallets[0].getAddressString()}),
            'the owner does not exist')

    })

    it('Should fail transfer signatures are missing', async () => {

        const transactionId = encodeTransactionId(wallets[1].getAddressString(), 1, '0x')
        const sig1 = utils.formatSignature(ethUtils.ecsign(ethUtils.toBuffer(transactionId), wallets[0].getPrivateKey()))
        utils.assertThrowsAsynchronously(
            multisigInstance.submitTransaction(wallets[1].getAddressString(), 1, '0x', sig1, {from: wallets[0].getAddressString()}),
            "signatures is not defined"
        )
    })

    it('Should fail transfer signatures are missing', async () => {
        const transferEncoded = tokenInstance.contract.methods.transfer("0x9d7713f5048c270d7c1dBe65F44644F4eA47f774", 15).encodeABI()
        console.log(transferEncoded)
        const transactionId = encodeTransactionId("0x2f45b6fb2f28a73f110400386da31044b2e953d4", 0, transferEncoded)
        console.log('transactionId ', transactionId)
        const sig1 = utils.formatSignature(ethUtils.ecsign(ethUtils.toBuffer(transactionId), ethUtils.toBuffer("0x338E6DFE9780F16D70A0CED0C21667C0D03AB464DF72EFE6A2306449BA44EB1D")))
        console.log(sig1)
    })*/

})
