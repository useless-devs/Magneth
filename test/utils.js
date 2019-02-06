const ethUtils = require('ethereumjs-util')
const { abi:factoryAbi, bytecode:factoryBytecode } = require('./../build/contracts/MagnethFactory.json')
const { bytecode:magnethBytecode } = require('./../build/contracts/Magneth.json')


function getParamFromTxEvent(transaction, paramName, contractFactory, eventName) {
    assert.isObject(transaction)
    let logs = transaction.logs
    if(eventName != null) {
        logs = logs.filter((l) => l.event === eventName)
    }
    assert.equal(logs.length, 1, 'too many logs found!')
    let param = logs[0].args[paramName]
    if(contractFactory != null) {
        let contract = contractFactory.at(param)
        assert.isObject(contract, `getting ${paramName} failed for ${param}`)
        return contract
    } else {
        return param
    }
}

function mineBlock(web3, reject, resolve) {
    web3.currentProvider.sendAsync({
        method: "evm_mine",
        jsonrpc: "2.0",
        id: new Date().getTime()
      }, (e) => (e ? reject(e) : resolve()))
}

function increaseTimestamp(web3, increase) {
    return new Promise((resolve, reject) => {
        web3.currentProvider.sendAsync({
            method: "evm_increaseTime",
            params: [increase],
            jsonrpc: "2.0",
            id: new Date().getTime()
          }, (e) => (e ? reject(e) : mineBlock(web3, reject, resolve)))
    })    
}

function balanceOf(web3, account) {
    return new Promise((resolve, reject) => web3.eth.getBalance(account, (e, balance) => (e ? reject(e) : resolve(balance))))
}

function formatSignature(signature) {
    return ethUtils.bufferToHex(Buffer.concat([ethUtils.toBuffer(signature.r), ethUtils.toBuffer(signature.s), ethUtils.toBuffer(signature.v)]))
}

function concatSignature(signatures) {
    let result = ''
    if (signatures.length > 0) {
        result = signatures[0]
    }
    for (let index = 1; index < signatures.length; index++) {
        result += signatures[index].slice(2); 
    }
    return result
}

async function assertThrowsAsynchronously(test, error) {
    try {
        await test();
    } catch(e) {
        if (!error || e instanceof error)
            return "everything is fine";
    }
    throw new Error("Missing rejection" + (error ? " with "+error.name : ""));
}

async function deployFactory(fromAddress) {
  const factory = new web3.eth.Contract(factoryAbi)

  console.log(factoryBytecode)
  const {_address: factoryAddress} = await factory.deploy({
      data: factoryBytecode
  }).send({
    from: fromAddress
  })

  console.log(factoryAddress)
  return factoryAddress
}

async function deployMagneth(fromAddress, factoryAddress, salt) {
  const factory = new web3.eth.Contract(factoryAbi, factoryAddress)
  const nonce = await web3.eth.getTransactionCount(fromAddress)
  const bytecode = `${magnethBytecode}${encodeParam('address', fromAddress).slice(2)}`
  const result = await factory.methods.deploy(bytecode, salt).send({
    from: fromAddress,
    gas: 4500000,
    gasPrice: 10000000000,
    nonce
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

function buildCreate2Address(creatorAddress, saltHex, byteCode) {
  return `0x${web3.utils.sha3(`0x${[
    'ff',
    creatorAddress,
    saltHex,
    web3.utils.sha3(byteCode)
  ].map(x => x.replace(/0x/, ''))
  .join('')}`).slice(-40)}`.toLowerCase()
}

function numberToUint256(value) {
  const hex = value.toString(16)
  return `0x${'0'.repeat(64-hex.length)}${hex}`
}

function encodeParam(dataType, data) {
  return web3.eth.abi.encodeParameter(dataType, data)
}

async function isContract(address) {
  const code = await web3.eth.getCode(address)
  return code.slice(2).length > 0
}

Object.assign(exports, {
    getParamFromTxEvent,
    increaseTimestamp,
    balanceOf,
    assertThrowsAsynchronously,
    formatSignature,
    concatSignature,
    deployFactory,
    deployMagneth,
    buildCreate2Address,
    numberToUint256,
    encodeParam,
    isContract
})