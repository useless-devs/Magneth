pragma solidity 0.5.2;


/// @title Multisignature off-chain wallet - Allows multiple parties to agree on transactions before execution.
/// @dev Based on [Consensys MultiSigWallet](Stefan George - <stefan.george@consensys.net>)
/// @author Joaquin Gonzalez - <jpgonzalezra@gmail.com>
contract Magneth {

    /*
     *  Events
     */
    event Confirmation(address indexed sender, bytes32 indexed transactionId);
    event Submission(bytes32 indexed transactionId);
    event Execution(bytes32 indexed transactionId);
    event ExecutionFailure(bytes32 indexed transactionId);
    event Deposit(address indexed sender, uint256 value);
    event OwnerAddition(address indexed owner);
    event Test(address owner);
    event OwnerRemoval(address indexed owner);
    event RequirementChange(uint256 required);

    /*
     *  Constants
     */
    uint256 constant public MAX_OWNER_COUNT = 50;

    /*
     *  Storage
     */
    mapping (bytes32 => Transaction) public transactions;
    mapping (bytes32 => mapping (address => bool)) private confirmations;
    mapping (address => bool) public isOwner;
    bytes32[] public transactionIds;

    string public name;
    address[] public owners;
    uint256 public required;

    struct Transaction {
        address destination;
        uint256 value;
        bytes data;
        bool executed;
    }

    /*
     *  Modifiers
     */
    modifier onlyWallet() {
        require(msg.sender == address(this), "This operation can only be executed by the wallet");
        _;
    }

    modifier ownerDoesNotExist(address owner) {
        require(!isOwner[owner], "ownerDoesNotExist");
        _;
    }

    modifier ownerExists(address owner) {
        require(isOwner[owner], "ownerExists");
        _;
    }

    modifier transactionExists(bytes32 transactionId) {
        require(transactions[transactionId].destination != address(0), "transactionExists");
        _;
    }

    modifier confirmed(bytes32 transactionId, address owner) {
        require(confirmations[transactionId][owner], "confirmed");
        _;
    }

    modifier notConfirmed(bytes32 transactionId, address owner) {
        require(!confirmations[transactionId][owner], "notConfirmed");
        _;
    }

    modifier notExecuted(bytes32 transactionId) {
        require(!transactions[transactionId].executed, "notExecuted");
        _;
    }

    modifier notNull(address _address) {
        require(_address != address(0), "notNull");
        _;
    }

    modifier validRequirement(uint256 ownerCount, uint256 _required) {
        require(ownerCount <= MAX_OWNER_COUNT
            && _required <= ownerCount
            && _required != 0
            && ownerCount != 0, 
            "validRequirement");
        _;
    }

    /// @dev Fallback function allows to deposit ether.
    function() external payable
    {
        if (msg.value > 0)
            emit Deposit(msg.sender, msg.value);
    }

    /*
     * Public functions
     */
    /// @dev Contract constructor sets initial owners and required number of confirmations.
    /// @param _name string of wallet name.
    /// @param _owners List of initial owners.
    /// @param _required Number of required confirmations.
    constructor(string memory _name, address[] memory _owners, uint256 _required)
        payable public
        validRequirement(_owners.length, _required)
    {
        for (uint256 i=0; i < _owners.length; i++) {
            require(!isOwner[_owners[i]] && _owners[i] != address(0));
            isOwner[_owners[i]] = true;
        }
        name = _name;
        owners = _owners;
        required = _required;
    }

    /// @dev Allows to add a new owner. Transaction has to be sent by wallet.
    /// @param owner Address of new owner.
    function addOwner(address owner)
        public
        onlyWallet
        ownerDoesNotExist(owner)
        notNull(owner)
        validRequirement(owners.length + 1, required)
    {
        isOwner[owner] = true;
        owners.push(owner);
        emit OwnerAddition(owner);
    }

    /// @dev Allows to remove an owner. Transaction has to be sent by wallet.
    /// @param owner Address of owner.
    function removeOwner(address owner)
        public
        onlyWallet
        ownerExists(owner)
    {
        isOwner[owner] = false;
        for (uint256 i=0; i < owners.length - 1; i++)
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                break;
            }
        owners.length -= 1;
        if (required > owners.length)
            changeRequirement(owners.length);
        emit OwnerRemoval(owner);
    }

    /// @dev Allows to replace an owner with a new owner. Transaction has to be sent by wallet.
    /// @param owner Address of owner to be replaced.
    /// @param newOwner Address of new owner.
    function replaceOwner(address owner, address newOwner)
        public
        onlyWallet
        ownerExists(owner)
        ownerDoesNotExist(newOwner)
    {
        for (uint256 i=0; i < owners.length; i++)
            if (owners[i] == owner) {
                owners[i] = newOwner;
                break;
            }
        isOwner[owner] = false;
        isOwner[newOwner] = true;
        emit OwnerRemoval(owner);
        emit OwnerAddition(newOwner);
    }

    /// @dev Allows to change the number of required confirmations. Transaction has to be sent by wallet.
    /// @param _required Number of required confirmations.
    function changeRequirement(uint256 _required)
        public
        onlyWallet
        validRequirement(owners.length, _required)
    {
        required = _required;
        emit RequirementChange(_required);
    }

    /// @dev Returns list of owners.
    /// @return List of owner addresses.
    function getOwners()
        public
        view
        returns (address[] memory)
    {
        return owners;
    }

    /// @dev Allows an owner to submit and confirm a transaction.
    /// @param destination Transaction target address.
    /// @param value Transaction ether value.
    /// @param data Transaction data payload.
    /// @return Returns transaction ID.
    function submitTransaction(address destination, uint256 value, bytes memory data, bytes memory signatures)
        public
        ownerExists(msg.sender)
        returns (bytes32 transactionId)
    {
        require(countSignatures(signatures) >= required, "Missing signatures");

        transactionId = encodeTransactionId(destination, value, data);
        addTransaction(transactionId, destination, value, data);

        address[] memory addresses = recoverAddresses(transactionId, signatures);
        uint256 count = addresses.length;
        for (uint256 i=0; i < count; i++)
            if (confirmTransaction(transactionId, addresses[i]))
                break;
        
    }
    
    /*
    * Private functions
    */
    /// @dev Allows an owner to confirm a transaction.
    /// @param transactionId Transaction ID.
    function confirmTransaction(bytes32 transactionId, address owner)
        private
        ownerExists(owner)
        transactionExists(transactionId)
        notConfirmed(transactionId, owner)
        returns (bool)
    {
        confirmations[transactionId][owner] = true;
        emit Confirmation(owner, transactionId);
        return executeTransaction(transactionId);
    }

    /// @dev Allows anyone to execute a confirmed transaction.
    /// @param transactionId Transaction ID.
    function executeTransaction(bytes32 transactionId)
        public
        notExecuted(transactionId)
        returns (bool result)
    {
        if (isConfirmed(transactionId)) {
            Transaction storage txn = transactions[transactionId];
            txn.executed = true;
            result = true;
            if (externalCall(txn.destination, txn.value, txn.data.length, txn.data)) {
                emit Execution(transactionId);
            } else {
                emit ExecutionFailure(transactionId);
                txn.executed = false;
            }
        }
    }
    
    /// @dev Generate transaction id.
    /// @param destination Transaction target address.
    /// @param value Transaction ether value.
    /// @param data Transaction data payload.
    /// @return Returns transaction ID.
    function encodeTransactionId(
        address destination,
        uint256 value,
        bytes memory data
    ) private view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                this,
                destination,
                value,
                keccak256(data)
            )
        );
    }

    // call has been separated into its own function in order to take advantage
    // of the Solidity's code generator to produce a loop that copies tx.data into memory.
    function externalCall(address destination, uint256 value, uint256 dataLength, bytes memory data) 
        private 
        returns (bool) 
    {
        bool result;
        assembly {
            let x := mload(0x40)   // "Allocate" memory for output (0x40 is where "free memory" pointer is stored by convention)
            let d := add(data, 32) // First 32 bytes are the padded length of data, so exclude that
            result := call(
                sub(gas, 34710),   // 34710 is the value that solidity is currently emitting
                                   // It includes callGas (700) + callVeryLow (3, to pay for SUB) + callValueTransferGas (9000) +
                                   // callNewAccountGas (25000, in case the destination address does not exist and needs creating)
                destination,
                value,
                d,
                dataLength,        // Size of the input (in bytes) - this is what fixes the padding problem
                x,
                0                  // Output is ignored, therefore the output size is zero
            )
        }
        return result;
    }

    /// @dev Returns the confirmation status of a transaction.
    /// @param transactionId Transaction ID.
    /// @return Confirmation status.
    function isConfirmed(bytes32 transactionId)
        private
        view
        returns (bool)
    {
        uint256 count = 0;
        for (uint256 i=0; i < owners.length; i++) {
            if (confirmations[transactionId][owners[i]])
                count += 1;
            if (count == required)
                return true;
        }
    }

    /*
     * Internal functions
     */
    /// @dev Adds a new transaction to the transaction mapping, if transaction does not exist yet.
    /// @param transactionId transaction identifier.
    /// @param destination Transaction target address.
    /// @param value Transaction ether value.
    /// @param data Transaction data payload.
    /// @return Returns transaction ID.
    function addTransaction(bytes32 transactionId, address destination, uint256 value, bytes memory data)
        private
        notNull(destination)
    {
        transactions[transactionId] = Transaction({
            destination: destination,
            value: value,
            data: data,
            executed: false
        });
        transactionIds.push(transactionId);
        emit Submission(transactionId);
    }

    /// @notice Counts the number of signatures in a signatures bytes array. Returns 0 if the length is invalid.
    /// @param _signatures The signatures bytes array
    /// @dev Signatures are 65 bytes long and are densely packed.
    function countSignatures(
        bytes memory _signatures
    )
        pure
        private
        returns (uint256)
    {
        return _signatures.length % 65 == 0 ? _signatures.length / 65 : 0;
    }

    /// @notice Recovers an array of addresses using a message hash and a signatures bytes array.
    /// @param _hash The signed message hash
    /// @param _signatures The signatures bytes array
    function recoverAddresses(
        bytes32 _hash,
        bytes memory _signatures
    )
        pure
        public
        returns (address[] memory addresses)
    {
        uint8 v;
        bytes32 r;
        bytes32 s;
        uint256 count = countSignatures(_signatures);
        addresses = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            (v, r, s) = parseSignature(_signatures, i);
            addresses[i] = ecrecover(_hash, v, r, s);
        }
    }

    /// @notice Extracts the r, s, and v parameters to `ecrecover(...)` from the signature at position `_pos`
    ///         in a densely packed signatures bytes array.
    /// @dev Based on [OpenZeppelin's ECRecovery]
    ///      (https://github.com/OpenZeppelin/openzeppelin-solidity/blob/master/contracts/ECRecovery.sol)
    /// @param _signatures The signatures bytes array
    /// @param _pos The position of the signature in the bytes array (0 indexed)
    function parseSignature(
        bytes memory _signatures,
        uint256 _pos
    )
        pure
        private
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        uint256 offset = _pos * 65;
        // The signature format is a compact form of:
        //   {bytes32 r}{bytes32 s}{uint8 v}
        // Compact means, uint8 is not padded to 32 bytes.
        assembly { // solium-disable-line security/no-inline-assembly
            r := mload(add(_signatures, add(32, offset)))
            s := mload(add(_signatures, add(64, offset)))
            // Here we are loading the last 32 bytes, including 31 bytes
            // of 's'. There is no 'mload8' to do this.
            //
            // 'byte' is not working due to the Solidity parser, so lets
            // use the second best option, 'and'
            v := and(mload(add(_signatures, add(65, offset))), 0xff)
        }

        if (v < 27) v += 27;

        require(v == 27 || v == 28);
    }

}