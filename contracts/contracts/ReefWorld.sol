// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ReefWorld
 * @notice Anchors world state hashes on-chain for verifiability.
 *         Each tick, the server commits a hash of the full world state.
 */
contract ReefWorld {
    address public operator;

    struct TickCommit {
        bytes32 stateHash;
        uint256 blockNumber;
        uint256 timestamp;
    }

    uint256 public latestTick;
    mapping(uint256 => TickCommit) public ticks;

    event TickCommitted(uint256 indexed tickNumber, bytes32 stateHash, uint256 blockNumber);
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
     * @notice Verify a state hash for a given tick.
     */
    function verifyTick(uint256 tickNumber, bytes32 stateHash) external view returns (bool) {
        require(tickNumber >= 1 && tickNumber <= latestTick, "ReefWorld: tick does not exist");
        return ticks[tickNumber].stateHash == stateHash;
    }

    /**
     * @notice Transfer operator role.
     */
    function transferOperator(address newOperator) external onlyOperator {
        require(newOperator != address(0), "ReefWorld: zero address");
        address old = operator;
        operator = newOperator;
        emit OperatorTransferred(old, newOperator);
    }
}
