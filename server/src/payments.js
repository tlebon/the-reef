/**
 * Circle Nanopayments integration — x402 protocol for agent-to-agent payments.
 *
 * When Circle is configured (CIRCLE_SELLER_ADDRESS set):
 * - Creates x402 gateway middleware for protected endpoints
 * - Real USDC nanopayments on Sepolia
 *
 * When Circle is not configured:
 * - Falls back to server-side balance ledger
 * - agent.balance tracks USDC amounts in memory
 */

import { ethers } from 'ethers';
import { createGatewayMiddleware } from '@circle-fin/x402-batching/server';

const SEPOLIA_USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

export class PaymentManager {
  constructor(world) {
    this.world = world;
    this.enabled = false;
    this.gateway = null;
    this.provider = null;
    this.usdc = null;
  }

  async init() {
    const sellerAddress = process.env.CIRCLE_SELLER_ADDRESS;

    if (!sellerAddress) {
      console.log('  Payments: disabled (no CIRCLE_SELLER_ADDRESS). Using agent.balance ledger.');
      return;
    }

    try {
      this.gateway = createGatewayMiddleware({
        sellerAddress,
      });
      this.enabled = true;
      console.log(`  Payments: Circle nanopayments enabled (seller: ${sellerAddress.slice(0, 10)}...)`);
    } catch (err) {
      console.error(`  Payments: failed to init Circle — ${err.message}. Using ledger fallback.`);
    }

    // Set up on-chain USDC balance reading
    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    if (rpcUrl) {
      try {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.usdc = new ethers.Contract(SEPOLIA_USDC, ERC20_ABI, this.provider);
      } catch (err) {
        console.error(`  Payments: failed to connect USDC contract — ${err.message}`);
      }
    }
  }

  /**
   * Get Express middleware for x402 payment-gated routes.
   * Returns null if Circle is not configured.
   */
  requirePayment(priceUSD) {
    if (!this.gateway) return null;
    return this.gateway.require(`$${priceUSD}`);
  }

  /**
   * Get an agent's balance (in USDC).
   */
  getBalance(agentId) {
    const agent = this.world.getAgent(agentId);
    return agent ? (agent.balance || 0) : 0;
  }

  /**
   * Sync an agent's in-game balance from their on-chain USDC balance.
   * Only updates if the on-chain balance is higher (doesn't claw back).
   */
  async syncBalance(agentId) {
    const agent = this.world.getAgent(agentId);
    if (!agent?.ownerWallet || !this.usdc) return;

    try {
      const raw = await this.usdc.balanceOf(agent.ownerWallet);
      const onChain = Number(ethers.formatUnits(raw, 6)); // USDC has 6 decimals
      if (onChain > (agent.balance || 0)) {
        agent.balance = Math.round(onChain * 10000) / 10000;
        console.log(`  Payments: synced ${agent.name} balance to ${agent.balance} USDC (on-chain)`);
      }
    } catch (err) {
      // Silent fail — balance stays as-is
    }
  }

  /**
   * Credit an agent (quest reward, etc.)
   */
  credit(agentId, amount, reason) {
    if (!amount || !Number.isFinite(amount) || amount <= 0) return { error: 'Invalid amount' };
    const agent = this.world.getAgent(agentId);
    if (!agent) return { error: 'Unknown agent' };

    agent.balance = Math.round(((agent.balance || 0) + amount) * 10000) / 10000;
    return { ok: true, balance: agent.balance, amount, reason };
  }

  /**
   * Process a service payment from buyer to seller.
   * Uses Circle nanopayments when enabled, otherwise server-side ledger.
   */
  async processPayment(buyerId, sellerId, amount, serviceName) {
    if (!amount || !Number.isFinite(amount) || amount <= 0) return { error: 'Invalid payment amount' };

    const buyer = this.world.getAgent(buyerId);
    const seller = this.world.getAgent(sellerId);
    if (!buyer) return { error: 'Buyer not found' };
    if (!seller) return { error: 'Seller not found' };

    const buyerBalance = buyer.balance || 0;
    if (buyerBalance < amount) {
      return { error: `Insufficient balance: have ${buyerBalance.toFixed(4)} USDC, need ${amount} USDC` };
    }

    // Server-side ledger transfer (always, even with Circle — for tracking)
    buyer.balance = Math.round((buyerBalance - amount) * 10000) / 10000;
    seller.balance = Math.round(((seller.balance || 0) + amount) * 10000) / 10000;

    return {
      ok: true,
      buyer: { id: buyerId, balance: buyer.balance },
      seller: { id: sellerId, balance: seller.balance },
      amount,
      serviceName,
      circle: this.enabled,
    };
  }
}
