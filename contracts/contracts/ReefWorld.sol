// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ReefWorld
 * @notice Anchors world state hashes on-chain for verifiability.
 *         Each tick, the server commits a hash of the full world state.
 */
contract ReefWorld {
    address public operator;
    address public pendingOperator;

    struct TickCommit {
        bytes32 stateHash;
        uint256 blockNumber;
        uint256 timestamp;
    }

    uint256 public latestTick;
    mapping(uint256 => TickCommit) public ticks;

    event TickCommitted(uint256 indexed tickNumber, bytes32 stateHash, uint256 blockNumber);
    event OperatorTransferProposed(address indexed currentOperator, address indexed pendingOperator);
    event OperatorTransferred(address indexed oldOperator, address indexed newOperator);

    modifier onlyOperator() {
        require(msg.sender == operator, "ReefWorld: not operator");
        _;
    }

    constructor() {
        operator = msg.sender;
    }

    /**
     * @notice Commit a world state hash for a given tick.
     * @param tickNumber The tick number (must be sequential).
     * @param stateHash SHA-256 hash of the serialized world state.
     */
    function commitTick(uint256 tickNumber, bytes32 stateHash) external onlyOperator {
        require(tickNumber == latestTick + 1, "ReefWorld: tick must be sequential");

        ticks[tickNumber] = TickCommit({
            stateHash: stateHash,
            blockNumber: block.number,
            timestamp: block.timestamp
        });

        latestTick = tickNumber;

        emit TickCommitted(tickNumber, stateHash, block.number);
    }

    /**
     * @notice Check whether a tick has been committed.
     */
    function tickExists(uint256 tickNumber) external view returns (bool) {
        return tickNumber >= 1 && tickNumber <= latestTick;
    }

    /**
     * @notice Verify a state hash for a given tick.
     *         Returns false for non-existent ticks (no revert).
     */
    function verifyTick(uint256 tickNumber, bytes32 stateHash) external view returns (bool) {
        if (tickNumber < 1 || tickNumber > latestTick) return false;
        return ticks[tickNumber].stateHash == stateHash;
    }

    /**
     * @notice Propose a new operator (two-step transfer).
     */
    function proposeOperator(address newOperator) external onlyOperator {
        require(newOperator != address(0), "ReefWorld: zero address");
        pendingOperator = newOperator;
        emit OperatorTransferProposed(operator, newOperator);
    }

    /**
     * @notice Accept the operator role (must be called by pending operator).
     */
    function acceptOperator() external {
        require(msg.sender == pendingOperator, "ReefWorld: not pending operator");
        address old = operator;
        operator = pendingOperator;
        pendingOperator = address(0);
        emit OperatorTransferred(old, operator);
    }
}
