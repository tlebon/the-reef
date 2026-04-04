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

const REEF_AGENT_ABI = [
  'function mintAgent(address to, string agentName, string archetype, string ensName) external returns (uint256)',
  'function setAvatar(uint256 tokenId, string avatarURI) external',
  'function setDelegate(uint256 tokenId, address delegate) external',
  'function getAgent(uint256 tokenId) view returns (string agentName, string archetype, string avatarURI, string ensName, address delegateWallet, uint256 mintedAt)',
  'function agentOfOwner(address owner) view returns (uint256)',
  'event AgentMinted(address indexed owner, uint256 indexed tokenId, string name, string archetype)',
];

const REEF_RESOURCE_ABI = [
  'function mintResource(address to, uint256 resourceId, uint256 amount) external',
  'function mintLoot(address to, string lootName, string rarity, uint256 resourceType) external returns (uint256)',
  'function burnResource(address from, uint256 resourceId, uint256 amount) external',
  'function burnLoot(address from, uint256 lootId) external',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'event ResourceMinted(address indexed to, uint256 indexed tokenId, uint256 amount)',
];

const REEF_TILE_ABI = [
  'function mintTile(address to, int256 x, int256 y, uint8 resourceType, string symbol) external returns (uint256)',
  'function tileAtPosition(int256 x, int256 y) view returns (uint256)',
  'function getTile(uint256 tokenId) view returns (int256 x, int256 y, uint8 resourceType, string symbol, uint256 mintedAt)',
  'event TileMinted(address indexed owner, uint256 indexed tokenId, int256 x, int256 y, uint8 resourceType, string symbol)',
];

export class ChainConnector {
  constructor() {
    this.enabled = false;
    this.provider = null;
    this.signer = null;
    this.reefWorld = null;
    this.reefReputation = null;
    this.reefAgent = null;
    this.reefResource = null;
    this.reefTile = null;
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

      // New contracts (optional — graceful if not configured)
      const agentAddr = process.env.REEF_AGENT_ADDRESS;
      const resourceAddr = process.env.REEF_RESOURCE_ADDRESS;
      const tileAddr = process.env.REEF_TILE_ADDRESS;
      if (agentAddr) this.reefAgent = new ethers.Contract(agentAddr, REEF_AGENT_ABI, this.signer);
      if (resourceAddr) this.reefResource = new ethers.Contract(resourceAddr, REEF_RESOURCE_ABI, this.signer);
      if (tileAddr) this.reefTile = new ethers.Contract(tileAddr, REEF_TILE_ABI, this.signer);

      const network = await this.provider.getNetwork();
      const latestTick = await this.reefWorld.latestTick();
      const agentCount = await this.reefReputation.getAgentCount();

      console.log(`  Chain: connected to ${network.name} (chainId: ${network.chainId})`);
      console.log(`  ReefWorld: ${worldAddr} (latestTick: ${latestTick})`);
      console.log(`  ReefReputation: ${repAddr} (agents: ${agentCount})`);
      console.log(`  Contracts: Agent=${!!this.reefAgent} Resource=${!!this.reefResource} Tile=${!!this.reefTile}`);

      this.enabled = true;
    } catch (err) {
      console.error(`  Chain: failed to connect — ${err.message}`);
      console.log('  Running in local-only mode.');
    }
  }

  /**
   * Query all registered agents from on-chain events.
   * Returns array of wallet addresses that have been registered.
   */
  async getRegisteredAgents() {
    if (!this.enabled) return [];

    try {
      // Query recent blocks only (public RPCs limit range to ~50000)
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 40000);
      const events = await this.reefReputation.queryFilter('AgentRegistered', fromBlock);
      return events.map(e => e.args[0]); // agent address
    } catch (err) {
      console.error(`  Chain: failed to query agents — ${err.message}`);
      return [];
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

  /**
   * Mint an agent NFT on-chain.
   */
  async mintAgentNFT(ownerAddress, name, archetype, ensName) {
    if (!this.reefAgent) return null;

    try {
      const tx = await this.reefAgent.mintAgent(ownerAddress, name, archetype, ensName || '');
      const receipt = await tx.wait();
      const event = receipt.logs.find(l => l.fragment?.name === 'AgentMinted');
      const tokenId = event?.args?.[1];
      console.log(`  Chain: minted agent NFT #${tokenId} for ${ownerAddress.slice(0, 10)}...`);
      return { tokenId: tokenId?.toString(), txHash: receipt.hash };
    } catch (err) {
      console.error(`  Chain: failed to mint agent NFT — ${err.message}`);
      return null;
    }
  }

  /**
   * Mint a tile NFT on-chain.
   */
  async mintTileNFT(ownerAddress, x, y, resourceType, symbol) {
    if (!this.reefTile) return null;

    const resourceMap = { coral: 0, crystal: 1, kelp: 2, shell: 3 };
    const resId = typeof resourceType === 'string' ? (resourceMap[resourceType] ?? 0) : resourceType;

    try {
      const tx = await this.reefTile.mintTile(ownerAddress, x, y, resId, symbol || '#');
      const receipt = await tx.wait();
      console.log(`  Chain: minted tile NFT at (${x},${y}) for ${ownerAddress.slice(0, 10)}...`);
      return { txHash: receipt.hash };
    } catch (err) {
      console.error(`  Chain: failed to mint tile NFT — ${err.message}`);
      return null;
    }
  }

  /**
   * Sign a resource claim for a user (they submit it on-chain themselves).
   */
  async signResourceClaim(toAddress, ids, amounts, nonce, deadline) {
    if (!this.signer || !this.reefResource) return null;

    try {
      const contractAddr = await this.reefResource.getAddress();
      const network = await this.provider.getNetwork();
      const hash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'uint256[]', 'uint256[]', 'uint256', 'uint256', 'uint256', 'address'],
          [toAddress, ids, amounts, nonce, deadline, network.chainId, contractAddr]
        )
      );
      const signature = await this.signer.signMessage(ethers.getBytes(hash));
      return { signature, nonce, deadline };
    } catch (err) {
      console.error(`  Chain: failed to sign resource claim — ${err.message}`);
      return null;
    }
  }
}
