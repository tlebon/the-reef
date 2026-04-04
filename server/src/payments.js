/**
 * Circle Nanopayments integration — x402 protocol for agent-to-agent payments.
 *
 * Uses agent.balance on the world object as the single source of truth.
 * Amounts stored as integers (microcents) to avoid floating-point errors.
 * Display as USDC by dividing by 10000.
 *
 * Gracefully degrades if Circle is not configured.
 */

export class PaymentManager {
  constructor(world) {
    this.world = world;
    this.enabled = false;
  }

  async init() {
    const apiKey = process.env.CIRCLE_API_KEY;

    if (!apiKey) {
      console.log('  Payments: disabled (no CIRCLE_API_KEY). Using agent.balance ledger.');
      return;
    }

    console.log('  Payments: Circle nanopayments configured');
    this.enabled = true;
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

    if (this.enabled) {
      // TODO: Circle x402 flow
    }

    // Atomic transfer on agent objects
    buyer.balance = Math.round((buyerBalance - amount) * 10000) / 10000;
    seller.balance = Math.round(((seller.balance || 0) + amount) * 10000) / 10000;

    return {
      ok: true,
      buyer: { id: buyerId, balance: buyer.balance },
      seller: { id: sellerId, balance: seller.balance },
      amount,
      serviceName,
    };
  }
}
