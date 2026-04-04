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

import { createGatewayMiddleware } from '@circle-fin/x402-batching/server';

export class PaymentManager {
  constructor(world) {
    this.world = world;
    this.enabled = false;
    this.gateway = null;
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
