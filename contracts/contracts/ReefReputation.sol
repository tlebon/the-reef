// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ReefReputation
 * @notice On-chain reputation system for Reef agents.
 *         Tracks service transaction counts and ratings.
 */
contract ReefReputation {
    struct AgentRep {
        uint256 totalTransactions;
        uint256 totalRating;      // sum of all ratings
        uint256 ratingCount;      // number of ratings received
        bool exists;
    }

    mapping(address => AgentRep) public agents;
    address[] public agentList;

    event AgentRegistered(address indexed agent);
    event TransactionRecorded(address indexed agent, uint256 newTotal);
    event RatingSubmitted(address indexed rater, address indexed agent, uint8 score);

    /**
     * @notice Register a new agent. Called once during character creation.
     */
    function registerAgent(address agent) external {
        require(!agents[agent].exists, "ReefReputation: already registered");
        agents[agent] = AgentRep({
            totalTransactions: 0,
            totalRating: 0,
            ratingCount: 0,
            exists: true
        });
        agentList.push(agent);
        emit AgentRegistered(agent);
    }

    /**
     * @notice Record a completed service transaction for an agent.
     */
    function recordTransaction(address agent) external {
        require(agents[agent].exists, "ReefReputation: agent not registered");
        agents[agent].totalTransactions++;
        emit TransactionRecorded(agent, agents[agent].totalTransactions);
    }

    /**
     * @notice Rate an agent after a service interaction.
     * @param agent The agent being rated.
     * @param score Rating from 1 to 5.
     */
    function rate(address agent, uint8 score) external {
        require(agents[agent].exists, "ReefReputation: agent not registered");
        require(score >= 1 && score <= 5, "ReefReputation: score must be 1-5");
        require(msg.sender != agent, "ReefReputation: cannot rate self");

        agents[agent].totalRating += score;
        agents[agent].ratingCount++;

        emit RatingSubmitted(msg.sender, agent, score);
    }

    /**
     * @notice Get an agent's average rating (multiplied by 100 for precision).
     */
    function getAvgRating(address agent) external view returns (uint256) {
        AgentRep memory rep = agents[agent];
        if (rep.ratingCount == 0) return 0;
        return (rep.totalRating * 100) / rep.ratingCount;
    }

    /**
     * @notice Get the build cap for an agent based on reputation.
     *         Base 5 + 1 per 10 transactions.
     */
    function getBuildCap(address agent) external view returns (uint256) {
        AgentRep memory rep = agents[agent];
        return 5 + (rep.totalTransactions / 10);
    }

    /**
     * @notice Get total number of registered agents.
     */
    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }
}
