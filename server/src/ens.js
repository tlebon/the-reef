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

      if (!this.registry) console.log('  ENS: warning — no registry address, subnode registration will be skipped');
      if (!this.resolver) console.log('  ENS: warning — no resolver address, text records will be skipped');

      console.log(`  ENS: configured for ${ensName} (node: ${this.parentNode.slice(0, 16)}...)`);
      this.enabled = !!(this.registry || this.resolver);
    } catch (err) {
      console.error(`  ENS: failed to initialize — ${err.message}`);
    }
  }

  /**
   * Validate that a name is ENS-safe (lowercase alphanumeric + hyphens only).
   */
  static isValidLabel(name) {
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name) && name.length >= 1 && name.length <= 20;
  }

  /**
   * Register a subname for an agent: {agentName}.reef.eth
   * Fire-and-forget — doesn't block the caller.
   */
  async registerSubname(agentName, ownerAddress, metadata = {}) {
    const safeName = agentName.toLowerCase();

    if (!ENSManager.isValidLabel(safeName)) {
      return { ensName: null, onChain: false, error: 'Invalid ENS label — use lowercase letters, numbers, hyphens only' };
    }

    const ensName = `${safeName}.${this.parentName || 'reef.eth'}`;

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

    return { ensName, pending: true };
  }

  async _registerAsync(safeName, ownerAddress, metadata) {
    const subnameNode = ethers.namehash(`${safeName}.${this.parentName}`);
    const label = ethers.id(safeName);

    if (this.registry) {
      // Register with server as owner first so we can set text records
      const tx = await this.registry.setSubnodeRecord(
        this.parentNode,
        label,
        this.signer.address, // server owns initially
        this.resolver?.target || ethers.ZeroAddress,
        0
      );
      await tx.wait();
      console.log(`  ENS: registered ${safeName}.${this.parentName}`);

      // Set address + text records while we're still the owner (best effort)
      if (this.resolver) {
        try {
          // Set address resolution so the name resolves to the owner's wallet
          if (ownerAddress) {
            const atx = await this.resolver.setAddr(subnameNode, ownerAddress);
            await atx.wait();
            console.log(`  ENS: set addr for ${safeName}.${this.parentName} → ${ownerAddress.slice(0, 10)}...`);
          }

          const records = {
            archetype: metadata.archetype || '',
            description: metadata.description || 'Agent in The Reef',
          };
          for (const [key, value] of Object.entries(records)) {
            if (value) {
              const rtx = await this.resolver.setText(subnameNode, key, value);
              await rtx.wait();
            }
          }
          console.log(`  ENS: set text records for ${safeName}.${this.parentName}`);
        } catch (err) {
          console.error(`  ENS: text records failed (non-blocking) — ${err.message}`);
        }
      }

      // Always transfer ownership to the user, even if text records failed
      if (ownerAddress && ownerAddress !== this.signer.address) {
        try {
          const ttx = await this.registry.setSubnodeRecord(
            this.parentNode,
            label,
            ownerAddress,
            this.resolver?.target || ethers.ZeroAddress,
            0
          );
          await ttx.wait();
          console.log(`  ENS: transferred ${safeName}.${this.parentName} to ${ownerAddress.slice(0, 10)}...`);
        } catch (err) {
          console.error(`  ENS: failed to transfer ownership — ${err.message}`);
        }
      }
    }
  }

  /**
   * Get the ENS name for an agent (works even without chain connection).
   */
  getSubname(agentName) {
    return `${agentName.toLowerCase()}.${this.parentName || 'reef.eth'}`;
  }

  /**
   * Reverse lookup — given a wallet address, find their subname.
   * Queries the resolver's addr records for known subnames.
   */
  async resolveWalletToName(walletAddress) {
    if (!this.enabled || !this.resolver) return null;

    try {
      const name = await this.provider.lookupAddress(walletAddress);
      if (name && name.endsWith(`.${this.parentName}`)) {
        return name;
      }
    } catch {
      // Reverse resolution not set up
    }

    return null;
  }

  /**
   * Resolve agent data from an ENS subname — name + archetype from text records.
   */
  async resolveAgentData(subname) {
    if (!this.enabled || !this.resolver) return null;

    try {
      const node = ethers.namehash(subname);
      const archetype = await this.resolver.text(node, 'archetype');
      const agentName = subname.replace(`.${this.parentName}`, '');
      return { name: agentName, archetype: archetype || 'builder', ensName: subname };
    } catch {
      return null;
    }
  }

  /**
   * Given a wallet, try to find their subname by checking addr records
   * for known subnames. Uses on-chain resolver.
   */
  async resolveWalletToAgent(walletAddress) {
    if (!this.enabled) return null;

    // Try reverse lookup first
    const name = await this.resolveWalletToName(walletAddress);
    if (name) {
      return await this.resolveAgentData(name);
    }

    // Fallback: check if wallet owns any known subnames via registry
    if (this.registry && this._knownSubnames) {
      for (const subname of this._knownSubnames) {
        try {
          const node = ethers.namehash(subname);
          const owner = await this.registry.owner(node);
          if (owner.toLowerCase() === walletAddress.toLowerCase()) {
            return await this.resolveAgentData(subname);
          }
        } catch { continue; }
      }
    }

    return null;
  }

  /**
   * Track a subname so we can check ownership on recovery.
   */
  trackSubname(subname) {
    if (!this._knownSubnames) this._knownSubnames = new Set();
    this._knownSubnames.add(subname);
  }
}
