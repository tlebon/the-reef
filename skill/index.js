/**
 * OpenClaw Skill — The Reef
 *
 * Exports tool definitions that an OpenClaw agent can use to interact
 * with The Reef game world via the REST API.
 *
 * Each tool calls the agent automation endpoints:
 *   GET  /api/agent/:wallet/state
 *   POST /api/agent/:wallet/action
 */

const BASE_URL = process.env.REEF_SERVER || 'http://localhost:3001';

async function agentState(wallet) {
  const res = await fetch(`${BASE_URL}/api/agent/${wallet}/state`);
  return res.json();
}

async function agentAction(wallet, command) {
  const res = await fetch(`${BASE_URL}/api/agent/${wallet}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  });
  return res.json();
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
        symbol: { type: 'string', description: 'Symbol to display on the tile (default: #)', default: '#' },
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
    name: 'reef_trade',
    description: 'Trade resources with a nearby agent.',
    parameters: {
      type: 'object',
      properties: {
        wallet: { type: 'string', description: 'Agent wallet address' },
        target: { type: 'string', description: 'Name of the agent to trade with' },
        give_resource: { type: 'string', description: 'Resource to give' },
        give_amount: { type: 'number', description: 'Amount to give' },
        want_resource: { type: 'string', description: 'Resource to receive' },
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
];

export default tools;
