const Wallet = require('ethereumjs-wallet');
const ethUtils = require('ethereumjs-util')
const { bytecode:magnethBytecode } = require('./../build/contracts/Magneth.json')

const {
  deployFactory,
  deployMagneth,
  buildCreate2Address,
  numberToUint256,
  encodeParam,
  isContract
} = require('./utils')

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

contract('MagnethFactory', () => {
    
  it('Should create magneth wallet', async () => {
    const fromAddress = wallets[0].getAddress()
    console.log(fromAddress)
    const factoryAddress = await deployFactory(fromAddress)
    console.log(factoryAddress)
    const salt = 1
  
    console.log(factoryAddress)
  
    const bytecode = `${magnethBytecode}${encodeParam('address', fromAddress).slice(2)}`
  
    const computedAddr = buildCreate2Address(
        factoryAddress,
        numberToUint256(salt),
        bytecode
    )
  
    console.log(computedAddr)
    console.log(await isContract(computedAddr))
  
    const result = await deployMagneth(fromAddress, factoryAddress, salt)
  
    console.log(result.txHash)
    console.log(result.address)
  
    console.log(await isContract(computedAddr))
  })

})
