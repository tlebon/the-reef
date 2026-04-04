/**
 * ENS integration — manages agent subnames under reef.eth
 *
 * On agent creation: registers {name}.reef.eth as a subname
 * Sets text records: archetype, reputation, services
 *
 * Requires ENS contracts on Sepolia and a registered reef.eth name.
 * Gracefully degrades if ENS is not configured.
 */

import { ethers } from 'ethers';

// ENS Registry and Resolver ABIs (minimal)
const ENS_REGISTRY_ABI = [
  'function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl) external',
  'function owner(bytes32 node) view returns (address)',
];

const PUBLIC_RESOLVER_ABI = [
  'function setText(bytes32 node, string key, string value) external',
  'function text(bytes32 node, string key) view returns (string)',
  'function setAddr(bytes32 node, address addr) external',
  'function addr(bytes32 node) view returns (address)',
];

export class ENSManager {
  constructor() {
    this.enabled = false;
    this.provider = null;
    this.signer = null;
    this.registry = null;
    this.resolver = null;
    this.parentNode = null;
    this.parentName = null;
  }

  async init() {
    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const ensName = process.env.ENS_PARENT_NAME; // e.g. "reef.eth"
    const registryAddr = process.env.ENS_REGISTRY_ADDRESS;
    const resolverAddr = process.env.ENS_RESOLVER_ADDRESS;

    if (!rpcUrl || !privateKey || !ensName) {
      console.log('  ENS: disabled (missing env vars). Subnames will not be registered.');
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.signer = new ethers.Wallet(privateKey, this.provider);
      this.parentName = ensName;
      this.parentNode = ethers.namehash(ensName);

      if (registryAddr) {
        this.registry = new ethers.Contract(registryAddr, ENS_REGISTRY_ABI, this.signer);
      }
      if (resolverAddr) {
        this.resolver = new ethers.Contract(resolverAddr, PUBLIC_RESOLVER_ABI, this.signer);
      }

      console.log(`  ENS: configured for ${ensName} (node: ${this.parentNode.slice(0, 16)}...)`);
      this.enabled = true;
    } catch (err) {
      console.error(`  ENS: failed to initialize — ${err.message}`);
    }
  }

  /**
   * Register a subname for an agent: {agentName}.reef.eth
   */
  /**
   * Validate that a name is ENS-safe (lowercase alphanumeric + hyphens only).
   */
  static isValidLabel(name) {
    return /^[a-z0-9-]+$/.test(name) && name.length >= 1 && name.length <= 20;
  }

  /**
   * Register a subname for an agent: {agentName}.reef.eth
   * Fire-and-forget — doesn't block the caller.
   */
  async registerSubname(agentName, ownerAddress, metadata = {}) {
    const safeName = agentName.toLowerCase();
    const ensName = `${safeName}.${this.parentName || 'reef.eth'}`;

    if (!ENSManager.isValidLabel(safeName)) {
      return { ensName, onChain: false, error: 'Invalid ENS label — use lowercase letters, numbers, hyphens only' };
    }

    if (!this.enabled) {
      return { ensName, onChain: false };
    }

    // Validate owner address if provided
    if (ownerAddress && !ethers.isAddress(ownerAddress)) {
      return { ensName, onChain: false, error: 'Invalid owner address' };
    }

    // Fire and forget — register in background, don't block the socket
    this._registerAsync(safeName, ownerAddress, metadata).catch(err => {
      console.error(`  ENS: background registration failed for ${safeName} — ${err.message}`);
    });

    return { ensName, onChain: true };
  }

  async _registerAsync(safeName, ownerAddress, metadata) {
    const subnameNode = ethers.namehash(`${safeName}.${this.parentName}`);
    const label = ethers.id(safeName);

    if (this.registry) {
      const tx = await this.registry.setSubnodeRecord(
        this.parentNode,
        label,
        ownerAddress || this.signer.address,
        this.resolver?.target || ethers.ZeroAddress,
        0
      );
      await tx.wait();
      console.log(`  ENS: registered ${safeName}.${this.parentName}`);
    }

    if (this.resolver) {
      const records = {
        archetype: metadata.archetype || '',
        description: metadata.description || 'Agent in The Reef',
      };
      for (const [key, value] of Object.entries(records)) {
        if (value) {
          const tx = await this.resolver.setText(subnameNode, key, value);
          await tx.wait();
        }
      }
      console.log(`  ENS: set text records for ${safeName}.${this.parentName}`);
    }
  }

  /**
   * Update text records for an existing subname.
   */
  async updateTextRecords(agentName, records) {
    if (!this.enabled || !this.resolver) return null;

    try {
      const subnameNode = ethers.namehash(`${agentName.toLowerCase()}.${this.parentName}`);

      for (const [key, value] of Object.entries(records)) {
        const tx = await this.resolver.setText(subnameNode, key, String(value));
        await tx.wait();
      }

      return { ok: true };
    } catch (err) {
      console.error(`  ENS: failed to update records for ${agentName} — ${err.message}`);
      return null;
    }
  }

  /**
   * Get the ENS name for an agent (works even without chain connection).
   */
  getSubname(agentName) {
    return `${agentName.toLowerCase()}.${this.parentName || 'reef.eth'}`;
  }
}
