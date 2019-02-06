module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
      gas: 4000000,
      gasPrice: 10000000000, // 10 gwei
    }
  },
  // Configure your compilers
  compilers: {
    solc: {
        version: '0.5.2',    // Fetch exact version from solc-bin (default: truffle's version)
        docker: false,       // Use "0.5.1" you've installed locally with docker (default: false)
        settings: {          // See the solidity docs for advice about optimization and evmVersion
            optimizer: {
                enabled: false,
                runs: 200,
            },
            evmVersion: 'constantinople',
        },
    },
  }
};
