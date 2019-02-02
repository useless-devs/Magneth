const ethUtils = require('ethereumjs-util')

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

Object.assign(exports, {
    getParamFromTxEvent,
    increaseTimestamp,
    balanceOf,
    assertThrowsAsynchronously,
    formatSignature,
    concatSignature,
})