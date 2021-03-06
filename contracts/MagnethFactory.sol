pragma solidity 0.5.2;

import './Factory.sol';

contract MagnethFactory is Factory {

    event Deployed(address addr, uint256 salt);

    /*
     * Public functions
     */
    /// @dev Allows creation of magneth wallet with opcode create2.
    /// @param code byte code for contract
    /// @param salt Number of salt
    /// @param registry Bool registry creation is optinal 
    /// @return Returns wallet address.
    function build(bytes memory code, uint256 salt, bool registry) public {
        address payable addr;
        assembly {
          addr := create2(0, add(code, 0x20), mload(code), salt)
          if iszero(extcodesize(addr)) {
            revert(0, 0)
          }
        }
        
        emit Deployed(addr, salt);
        if (registry) {
          register(addr);
        } 
    }
}