const Wallet = require('ethereumjs-wallet');
const ethUtils = require('ethereumjs-util')
const { bytecode:magnethBytecode } = require('./../build/contracts/Magneth.json')
const { abi:factoryAbi, bytecode:factoryBytecode } = require('./../build/contracts/MagnethFactory.json')

const {
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
    const fromAddress = wallets[0].getAddressString()

    const name = 'wallet1'
    const owners = [ wallets[1].getAddressString(), wallets[2].getAddressString()]
    const required = 2

    const factoryAddress = await deployMagnethFactory(fromAddress)
    const salt = 1
    
    const encodeParmas = web3.eth.abi.encodeParameters(['string', 'address[]', 'uint256'], [name, owners, required]).slice(2)
    const bytecode = `${magnethBytecode}${encodeParmas}`

    const computedAddr = buildCreate2Address(
        factoryAddress,
        numberToUint256(salt),
        bytecode
    )
  
    console.log(computedAddr)
    console.log(await isContract(computedAddr))
  
    await deployMagneth(fromAddress, factoryAddress, bytecode, salt)
    console.log(await isContract(computedAddr))
  })

  async function deployMagnethFactory(fromAddress) {
    const factory = new web3.eth.Contract(factoryAbi)
    const {_address: factoryAddress} = await factory.deploy({
        data: factoryBytecode
    }).send({
      from: fromAddress,
      gas: 4500000,
    })
    return factoryAddress
  }
  
  async function deployMagneth(fromAddress, factoryAddress, bytecode, salt) {
    const factory = new web3.eth.Contract(factoryAbi, factoryAddress)
  
    const result = await factory.methods.build(bytecode, salt, false).send({
        from: fromAddress,
        gas: 4500000,
    })
  
    const computedAddr = buildCreate2Address(
      factoryAddress,
      numberToUint256(salt),
      bytecode
    )
  
    const addr = result.events.Deployed.returnValues.addr.toLowerCase()
    assert.equal(addr, computedAddr)
  
    return {
      txHash: result.transactionHash,
      address: addr,
      receipt: result
    }
  }

})
