pragma solidity 0.5.2;

import './Magneth.sol';


contract Factory {
    /*
     *  Storage
     */
    mapping(address => address[]) public instantiations;

  
    /// @dev Registers contract in factory registry.
    /// @param addr Address of contract instantiation.
    function register(address payable addr)
        internal
    {
        Magneth magneth = Magneth(addr);
        address[] memory owners = magneth.getOwners();
        uint256 count = owners.length;
        for(uint256 i=0;i < count; i++) 
            instantiations[owners[i]].push(addr);
    }
}