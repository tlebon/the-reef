// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ReefReputation
 * @notice On-chain reputation system for Reef agents.
 *         Tracks service transaction counts and ratings.
 *         Access-controlled: only the operator (server) can register agents
 *         and record transactions.
 */
contract ReefReputation {
    address public operator;

    struct AgentRep {
        uint256 totalTransactions;
        uint256 totalRating;      // sum of all ratings
        uint256 ratingCount;      // number of ratings received
        bool exists;
    }

    mapping(address => AgentRep) public agents;
    mapping(address => mapping(address => bool)) public hasRated; // rater => agent => rated

    uint256 public agentCount;

    event AgentRegistered(address indexed agent);
    event TransactionRecorded(address indexed agent, uint256 newTotal);
    event RatingSubmitted(address indexed rater, address indexed agent, uint8 score);
    event OperatorTransferred(address indexed oldOperator, address indexed newOperator);

    modifier onlyOperator() {
        require(msg.sender == operator, "ReefReputation: not operator");
        _;
    }

    constructor() {
        operator = msg.sender;
    }

    /**
     * @notice Register a new agent. Called once during character creation.
     *         Only callable by the operator (server).
     */
    function registerAgent(address agent) external onlyOperator {
        require(!agents[agent].exists, "ReefReputation: already registered");
        agents[agent] = AgentRep({
            totalTransactions: 0,
            totalRating: 0,
            ratingCount: 0,
            exists: true
        });
        agentCount++;
        emit AgentRegistered(agent);
    }

    /**
     * @notice Record a completed service transaction for an agent.
     *         Only callable by the operator (server).
     */
    function recordTransaction(address agent) external onlyOperator {
        AgentRep storage rep = agents[agent];
        require(rep.exists, "ReefReputation: agent not registered");
        rep.totalTransactions++;
        emit TransactionRecorded(agent, rep.totalTransactions);
    }

    /**
     * @notice Rate an agent after a service interaction.
     *         Each rater can only rate a given agent once.
     * @param agent The agent being rated.
     * @param score Rating from 1 to 5.
     */
    function rate(address agent, uint8 score) external {
        AgentRep storage rep = agents[agent];
        require(rep.exists, "ReefReputation: agent not registered");
        require(score >= 1 && score <= 5, "ReefReputation: score must be 1-5");
        require(msg.sender != agent, "ReefReputation: cannot rate self");
        require(!hasRated[msg.sender][agent], "ReefReputation: already rated this agent");

        hasRated[msg.sender][agent] = true;
        rep.totalRating += score;
        rep.ratingCount++;

        emit RatingSubmitted(msg.sender, agent, score);
    }

    /**
     * @notice Get an agent's average rating (multiplied by 100 for precision).
     */
    function getAvgRating(address agent) external view returns (uint256) {
        AgentRep memory rep = agents[agent];
        require(rep.exists, "ReefReputation: agent not registered");
        if (rep.ratingCount == 0) return 0;
        return (rep.totalRating * 100) / rep.ratingCount;
    }

    /**
     * @notice Get the build cap for an agent based on reputation.
     *         Base 5 + 1 per 10 transactions.
     */
    function getBuildCap(address agent) external view returns (uint256) {
        AgentRep memory rep = agents[agent];
        require(rep.exists, "ReefReputation: agent not registered");
        return 5 + (rep.totalTransactions / 10);
    }

    /**
     * @notice Transfer operator role.
     */
    function transferOperator(address newOperator) external onlyOperator {
        require(newOperator != address(0), "ReefReputation: zero address");
        address old = operator;
        operator = newOperator;
        emit OperatorTransferred(old, newOperator);
    }
}
