/**
 * Chain integration — connects server to on-chain contracts.
 *
 * Commits world state hashes each tick and records reputation on-chain.
 * Gracefully degrades if no chain config is provided (local dev mode).
 */

import { ethers } from 'ethers';

const REEF_WORLD_ABI = [
  'function commitTick(uint256 tickNumber, bytes32 stateHash) external',
  'function latestTick() view returns (uint256)',
  'function verifyTick(uint256 tickNumber, bytes32 stateHash) view returns (bool)',
  'event TickCommitted(uint256 indexed tickNumber, bytes32 stateHash, uint256 blockNumber)',
];

const REEF_REPUTATION_ABI = [
  'function registerAgent(address agent) external',
  'function recordTransaction(address agent) external',
  'function rate(address agent, uint8 score) external',
  'function getAvgRating(address agent) view returns (uint256)',
  'function getBuildCap(address agent) view returns (uint256)',
  'function getAgentCount() view returns (uint256)',
  'event AgentRegistered(address indexed agent)',
  'event RatingSubmitted(address indexed rater, address indexed agent, uint8 score)',
];

export class ChainConnector {
  constructor() {
    this.enabled = false;
    this.provider = null;
    this.signer = null;
    this.reefWorld = null;
    this.reefReputation = null;
  }

  /**
   * Subscribe to new blocks. Calls onBlock(blockNumber) for each new block.
   * Falls back to polling if WebSocket subscription isn't available.
   */
  onNewBlock(callback) {
    if (!this.enabled) {
      console.log('  Chain: block sync disabled (no provider). Using interval ticks.');
      return false;
    }

    const wsUrl = process.env.SEPOLIA_WS_URL;
    if (!wsUrl) {
      console.log('  Chain: no SEPOLIA_WS_URL configured. Using interval ticks.');
      return false;
    }

    try {
      this.wsProvider = new ethers.WebSocketProvider(wsUrl);
      this.wsProvider.on('block', (blockNumber) => {
        callback(blockNumber);
      });
      console.log('  Chain: subscribed to blocks via WebSocket');
      return true;
    } catch (err) {
      console.error(`  Chain: WebSocket subscription failed — ${err.message}`);
      return false;
    }
  }

  async init() {
    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const worldAddr = process.env.REEF_WORLD_ADDRESS;
    const repAddr = process.env.REEF_REPUTATION_ADDRESS;

    if (!rpcUrl || !privateKey || !worldAddr || !repAddr) {
      console.log('  Chain: disabled (missing env vars). Running in local-only mode.');
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.signer = new ethers.Wallet(privateKey, this.provider);
      this.reefWorld = new ethers.Contract(worldAddr, REEF_WORLD_ABI, this.signer);
      this.reefReputation = new ethers.Contract(repAddr, REEF_REPUTATION_ABI, this.signer);

      const network = await this.provider.getNetwork();
      const latestTick = await this.reefWorld.latestTick();
      const agentCount = await this.reefReputation.getAgentCount();

      console.log(`  Chain: connected to ${network.name} (chainId: ${network.chainId})`);
      console.log(`  ReefWorld: ${worldAddr} (latestTick: ${latestTick})`);
      console.log(`  ReefReputation: ${repAddr} (agents: ${agentCount})`);

      this.enabled = true;
    } catch (err) {
      console.error(`  Chain: failed to connect — ${err.message}`);
      console.log('  Running in local-only mode.');
    }
  }

  /**
   * Commit a world state hash on-chain for the given tick.
   */
  async commitTick(tickNumber, stateHash) {
    if (!this.enabled) return null;

    try {
      // Convert hex string hash to bytes32
      const hashBytes = '0x' + stateHash;
      const tx = await this.reefWorld.commitTick(tickNumber, hashBytes);
      const receipt = await tx.wait();
      console.log(`  Chain: tick ${tickNumber} committed (tx: ${receipt.hash})`);
      return receipt;
    } catch (err) {
      console.error(`  Chain: failed to commit tick ${tickNumber} — ${err.message}`);
      return null;
    }
  }

  /**
   * Register an agent on-chain for reputation tracking.
   */
  async registerAgent(agentAddress) {
    if (!this.enabled) return null;

    try {
      const tx = await this.reefReputation.registerAgent(agentAddress);
      const receipt = await tx.wait();
      console.log(`  Chain: agent ${agentAddress} registered (tx: ${receipt.hash})`);
      return receipt;
    } catch (err) {
      console.error(`  Chain: failed to register agent — ${err.message}`);
      return null;
    }
  }

  /**
   * Record a service transaction on-chain.
   */
  async recordTransaction(agentAddress) {
    if (!this.enabled) return null;

    try {
      const tx = await this.reefReputation.recordTransaction(agentAddress);
      await tx.wait();
      return true;
    } catch (err) {
      console.error(`  Chain: failed to record transaction — ${err.message}`);
      return null;
    }
  }
}
