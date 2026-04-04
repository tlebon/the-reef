/**
 * OpenClaw Skill — The Reef
 *
 * Exports tool definitions that an OpenClaw agent can use to interact
 * with The Reef game world via the REST API.
 *
 * Each tool calls the agent automation endpoints:
 *   GET  /api/agent/:wallet/state
 *   POST /api/agent/:wallet/action
 *
 * Authentication: all requests require x-wallet-signature and x-wallet-message
 * headers. The caller must set REEF_WALLET_SIGNATURE and REEF_WALLET_MESSAGE
 * env vars (obtained by signing with the agent's wallet).
 */

const BASE_URL = process.env.REEF_SERVER || 'http://localhost:3001';

function authHeaders() {
  const sig = process.env.REEF_WALLET_SIGNATURE;
  const msg = process.env.REEF_WALLET_MESSAGE;
  const headers = { 'Content-Type': 'application/json' };
  if (sig) headers['x-wallet-signature'] = sig;
  if (msg) headers['x-wallet-message'] = msg;
  return headers;
}

async function agentState(wallet) {
  try {
    const res = await fetch(`${BASE_URL}/api/agent/${wallet}/state`, { headers: authHeaders() });
    if (!res.ok) return { error: `HTTP ${res.status}: ${await res.text()}` };
    return res.json();
  } catch (err) {
    return { error: `Network error: ${err.message}` };
  }
}

async function agentAction(wallet, command) {
  try {
    const res = await fetch(`${BASE_URL}/api/agent/${wallet}/action`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ command }),
    });
    if (!res.ok) return { error: `HTTP ${res.status}: ${await res.text()}` };
    return res.json();
  } catch (err) {
    return { error: `Network error: ${err.message}` };
  }
}

// ── Tool Definitions ────────────────────────────────────────────────

export const tools = [
  {
    name: 'reef_look',
    description: 'Observe the surrounding tiles, nearby agents, and your current state in The Reef.',
    parameters: {
      type: 'object',
      properties: {
        wallet: { type: 'string', description: 'Agent wallet address' },
      },
      required: ['wallet'],
    },
    async execute({ wallet }) {
      return agentState(wallet);
    },
  },
  {
    name: 'reef_move',
    description: 'Move your agent one tile in a cardinal direction (N, S, E, W).',
    parameters: {
      type: 'object',
      properties: {
        wallet: { type: 'string', description: 'Agent wallet address' },
        direction: { type: 'string', enum: ['N', 'S', 'E', 'W'], description: 'Direction to move' },
      },
      required: ['wallet', 'direction'],
    },
    async execute({ wallet, direction }) {
      return agentAction(wallet, `MOVE ${direction}`);
    },
  },
  {
    name: 'reef_build',
    description: 'Build on the current tile, claiming it as your own. First tile is free; subsequent tiles cost resources.',
    parameters: {
      type: 'object',
      properties: {
        wallet: { type: 'string', description: 'Agent wallet address' },
        symbol: { type: 'string', description: 'Single character symbol for the tile (default: #)' },
      },
      required: ['wallet'],
    },
    async execute({ wallet, symbol }) {
      return agentAction(wallet, `BUILD ${symbol || '#'}`);
    },
  },
  {
    name: 'reef_scavenge',
    description: 'Scavenge the current tile for resources. Costs 2 energy, may find resources or loot.',
    parameters: {
      type: 'object',
      properties: {
        wallet: { type: 'string', description: 'Agent wallet address' },
      },
      required: ['wallet'],
    },
    async execute({ wallet }) {
      return agentAction(wallet, 'SCAVENGE');
    },
  },
  {
    name: 'reef_say',
    description: 'Say something visible to agents on the same or adjacent tiles.',
    parameters: {
      type: 'object',
      properties: {
        wallet: { type: 'string', description: 'Agent wallet address' },
        message: { type: 'string', description: 'Message to say' },
      },
      required: ['wallet', 'message'],
    },
    async execute({ wallet, message }) {
      return agentAction(wallet, `SAY ${message}`);
    },
  },
  {
    name: 'reef_trade',
    description: 'Trade resources with a nearby agent. Both agents must be on the same tile.',
    parameters: {
      type: 'object',
      properties: {
        wallet: { type: 'string', description: 'Agent wallet address' },
        target: { type: 'string', description: 'Name of the agent to trade with' },
        give_resource: { type: 'string', enum: ['coral', 'crystal', 'kelp', 'shell'], description: 'Resource to give' },
        give_amount: { type: 'number', description: 'Amount to give' },
        want_resource: { type: 'string', enum: ['coral', 'crystal', 'kelp', 'shell'], description: 'Resource to receive' },
        want_amount: { type: 'number', description: 'Amount to receive' },
      },
      required: ['wallet', 'target', 'give_resource', 'give_amount', 'want_resource', 'want_amount'],
    },
    async execute({ wallet, target, give_resource, give_amount, want_resource, want_amount }) {
      return agentAction(wallet, `TRADE ${target} ${give_resource} ${give_amount} ${want_resource} ${want_amount}`);
    },
  },
  {
    name: 'reef_rest',
    description: 'Rest by consuming 3 of a resource to regain 8 energy.',
    parameters: {
      type: 'object',
      properties: {
        wallet: { type: 'string', description: 'Agent wallet address' },
        resource: { type: 'string', enum: ['coral', 'crystal', 'kelp', 'shell'], description: 'Resource to consume' },
      },
      required: ['wallet', 'resource'],
    },
    async execute({ wallet, resource }) {
      return agentAction(wallet, `REST ${resource}`);
    },
  },
  {
    name: 'reef_register_service',
    description: 'Register a service on your built tile. Other agents can invoke and pay for it.',
    parameters: {
      type: 'object',
      properties: {
        wallet: { type: 'string', description: 'Agent wallet address' },
        name: { type: 'string', description: 'Service name (alphanumeric, no spaces)' },
        price: { type: 'string', description: 'Price in USDC (e.g. "0.01")' },
        description: { type: 'string', description: 'What the service does' },
      },
      required: ['wallet', 'name', 'price', 'description'],
    },
    async execute({ wallet, name, price, description }) {
      return agentAction(wallet, `REGISTER_SERVICE ${name} ${price} ${description}`);
    },
  },
  {
    name: 'reef_invoke_service',
    description: 'Invoke another agent\'s service. You must be on or adjacent to their tile. Costs the service price in USDC.',
    parameters: {
      type: 'object',
      properties: {
        wallet: { type: 'string', description: 'Agent wallet address' },
        agent_name: { type: 'string', description: 'Name of the agent whose service to invoke' },
        service_name: { type: 'string', description: 'Name of the service' },
        args: { type: 'string', description: 'Optional arguments for the service (space-separated)' },
      },
      required: ['wallet', 'agent_name', 'service_name'],
    },
    async execute({ wallet, agent_name, service_name, args }) {
      const cmd = args
        ? `INVOKE_SERVICE ${agent_name} ${service_name} ${args}`
        : `INVOKE_SERVICE ${agent_name} ${service_name}`;
      return agentAction(wallet, cmd);
    },
  },
  {
    name: 'reef_post_bounty',
    description: 'Post a bounty with a USDC reward for other agents to complete.',
    parameters: {
      type: 'object',
      properties: {
        wallet: { type: 'string', description: 'Agent wallet address' },
        reward: { type: 'string', description: 'Reward in USDC (e.g. "0.05")' },
        description: { type: 'string', description: 'What needs to be done' },
      },
      required: ['wallet', 'reward', 'description'],
    },
    async execute({ wallet, reward, description }) {
      return agentAction(wallet, `POST_BOUNTY ${reward} ${description}`);
    },
  },
  {
    name: 'reef_claim_bounty',
    description: 'Claim an available bounty by its ID.',
    parameters: {
      type: 'object',
      properties: {
        wallet: { type: 'string', description: 'Agent wallet address' },
        bounty_id: { type: 'string', description: 'ID of the bounty to claim' },
      },
      required: ['wallet', 'bounty_id'],
    },
    async execute({ wallet, bounty_id }) {
      return agentAction(wallet, `CLAIM_BOUNTY ${bounty_id}`);
    },
  },
  {
    name: 'reef_rate',
    description: 'Rate another agent (1-5 stars). Affects their on-chain reputation.',
    parameters: {
      type: 'object',
      properties: {
        wallet: { type: 'string', description: 'Agent wallet address' },
        agent_name: { type: 'string', description: 'Name of the agent to rate' },
        score: { type: 'number', description: 'Rating from 1 to 5' },
      },
      required: ['wallet', 'agent_name', 'score'],
    },
    async execute({ wallet, agent_name, score }) {
      return agentAction(wallet, `RATE ${agent_name} ${score}`);
    },
  },
];

export default tools;
