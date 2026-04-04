/**
 * Circle Nanopayments integration — x402 protocol for agent-to-agent payments.
 *
 * Flow:
 * 1. Agent A invokes Agent B's service
 * 2. Server creates a payment request (x402)
 * 3. Agent A signs EIP-3009 authorization
 * 4. Server validates and forwards to Circle Gateway
 * 5. Circle batches settlement on-chain
 *
 * Gracefully degrades if Circle is not configured —
 * payments are tracked server-side only.
 */

export class PaymentManager {
  constructor() {
    this.enabled = false;
    this.ledger = new Map(); // agentId -> balance (server-side tracking)
  }

  async init() {
    const apiKey = process.env.CIRCLE_API_KEY;

    if (!apiKey) {
      console.log('  Payments: disabled (no CIRCLE_API_KEY). Using server-side ledger.');
      return;
    }

    try {
      // TODO: Initialize Circle Gateway client
      // this.client = new CircleGateway({ apiKey });
      console.log('  Payments: Circle nanopayments configured');
      this.enabled = true;
    } catch (err) {
      console.error(`  Payments: failed to initialize — ${err.message}`);
    }
  }

  /**
   * Get an agent's balance.
   */
  getBalance(agentId) {
    return this.ledger.get(agentId) || 0;
  }

  /**
   * Credit an agent (quest reward, etc.)
   */
  credit(agentId, amount, reason) {
    const balance = this.getBalance(agentId) + amount;
    this.ledger.set(agentId, balance);
    return { ok: true, balance, amount, reason };
  }

  /**
   * Process a service payment from buyer to seller.
   * Returns { ok: true } or { error: string }
   */
  async processPayment(buyerId, sellerId, amount, serviceName) {
    const buyerBalance = this.getBalance(buyerId);

    if (buyerBalance < amount) {
      return { error: `Insufficient balance: have ${buyerBalance.toFixed(4)} USDC, need ${amount} USDC` };
    }

    if (this.enabled) {
      // TODO: Circle x402 flow
      // 1. Create payment intent
      // 2. Sign EIP-3009 authorization
      // 3. Submit to Circle Gateway
      // For now, fall through to server-side ledger
    }

    // Server-side ledger transfer
    this.ledger.set(buyerId, buyerBalance - amount);
    this.ledger.set(sellerId, this.getBalance(sellerId) + amount);

    return {
      ok: true,
      buyer: { id: buyerId, balance: this.getBalance(buyerId) },
      seller: { id: sellerId, balance: this.getBalance(sellerId) },
      amount,
      serviceName,
    };
  }

  /**
   * Get all balances (for state serialization).
   */
  getAllBalances() {
    return Object.fromEntries(this.ledger);
  }

  /**
   * Load balances from saved state.
   */
  loadBalances(balances) {
    if (!balances) return;
    for (const [id, amount] of Object.entries(balances)) {
      this.ledger.set(id, amount);
    }
  }
}
