#!/usr/bin/env node
/**
 * Agent Bot — autonomous agent for The Reef
 *
 * Connects via WebSocket, registers (or reconnects) an agent,
 * and runs a simple decision loop each tick.
 *
 * Usage:
 *   node server/src/agent-bot.js [name] [archetype]
 *
 * Environment:
 *   REEF_SERVER   — server URL (default: http://localhost:3001)
 *   BOT_NAME      — agent name (default: BotAgent)
 *   BOT_ARCHETYPE — agent archetype (default: scout)
 *   BOT_KEY       — hex private key (generates random if not set)
 */

import { io } from 'socket.io-client';
import { ethers } from 'ethers';

const SERVER = process.env.REEF_SERVER || 'http://localhost:3001';
const BOT_NAME = process.argv[2] || process.env.BOT_NAME || 'BotAgent';
const BOT_ARCHETYPE = process.argv[3] || process.env.BOT_ARCHETYPE || 'scout';

// Use a real wallet so the bot can reconnect and use the REST API
const wallet = process.env.BOT_KEY
  ? new ethers.Wallet(process.env.BOT_KEY)
  : ethers.Wallet.createRandom();

const WALLET = wallet.address;

console.log(`[bot] Connecting to ${SERVER} as ${BOT_NAME} (${BOT_ARCHETYPE})`);
console.log(`[bot] Wallet: ${WALLET}`);

const socket = io(SERVER, { transports: ['websocket'] });

let agentId = null;
let pendingDecision = false;

// ── Connection ──────────────────────────────────────────────────────

socket.on('connect', async () => {
  console.log(`[bot] Connected (socket ${socket.id})`);

  // Sign an auth message like the real client does
  const message = `Sign in to The Reef\nWallet: ${WALLET}\nTimestamp: ${Date.now()}`;
  const signature = await wallet.signMessage(message);

  socket.emit('agent:register', {
    name: BOT_NAME,
    archetype: BOT_ARCHETYPE,
    walletAddress: WALLET,
    signature,
    message,
  });
});

socket.on('agent:registered', ({ agent }) => {
  agentId = agent.id;
  console.log(`[bot] Registered as ${agent.name} (${agent.archetype}) at (${agent.x},${agent.y})`);
  socket.emit('agent:look', { agentId });
});

socket.on('agent:error', async ({ error }) => {
  console.error(`[bot] Registration error: ${error}`);
  if (error.includes('already taken')) {
    const newName = BOT_NAME + Math.floor(Math.random() * 999);
    console.log(`[bot] Retrying with name: ${newName}`);
    const msg = `Sign in to The Reef\nWallet: ${WALLET}\nTimestamp: ${Date.now()}`;
    const sig = await wallet.signMessage(msg);
    socket.emit('agent:register', { name: newName, archetype: BOT_ARCHETYPE, walletAddress: WALLET, signature: sig, message: msg });
  } else {
    console.error(`[bot] Fatal registration error: ${error}`);
    process.exit(1);
  }
});

// ── State Updates ───────────────────────────────────────────────────

socket.on('agent:look_result', (state) => {
  // If we requested a look for decision-making, act now
  if (pendingDecision) {
    pendingDecision = false;
    const command = decide(state);
    if (command) {
      socket.emit('agent:command', { agentId, command });
    }
  }
});

socket.on('agent:result', ({ command, result }) => {
  if (result.error) {
    console.log(`[bot] ${command} failed: ${result.error}`);
  } else {
    console.log(`[bot] ${command} => ${result.message || 'ok'}`);
  }
});

// ── Decision Engine ─────────────────────────────────────────────────

function decide(state) {
  if (!state || !state.agent) return null;

  const { agent, tiles } = state;

  // Priority 1: If energy is low and we have resources, REST
  if (agent.energy < 5) {
    const resources = ['coral', 'crystal', 'kelp', 'shell'];
    const best = resources
      .filter(r => (agent.inventory[r] || 0) >= 3)
      .sort((a, b) => (agent.inventory[b] || 0) - (agent.inventory[a] || 0))[0];
    if (best) return `REST ${best}`;
    return null;
  }

  // Priority 2: If we have no tiles and are on an unbuilt tile, BUILD
  if (agent.tilesOwned === 0) {
    const here = tiles.find(t => t.x === agent.x && t.y === agent.y);
    if (here && !here.built) return 'BUILD #';
  }

  // Priority 3: If energy > 15, SCAVENGE
  if (agent.energy > 15) return 'SCAVENGE';

  // Priority 4: MOVE to a random adjacent revealed tile
  const adjacent = tiles.filter(t => {
    const dx = Math.abs(t.x - agent.x);
    const dy = Math.abs(t.y - agent.y);
    return (dx + dy === 1);
  });

  if (adjacent.length > 0) {
    const target = adjacent[Math.floor(Math.random() * adjacent.length)];
    const dx = target.x - agent.x;
    const dy = target.y - agent.y;
    if (dx === 1) return 'MOVE E';
    if (dx === -1) return 'MOVE W';
    if (dy === 1) return 'MOVE S';
    if (dy === -1) return 'MOVE N';
  }

  return null;
}

// ── Tick Loop ───────────────────────────────────────────────────────

socket.on('world:tick', () => {
  if (!agentId) return;
  // Request fresh state — decision happens in look_result handler
  pendingDecision = true;
  socket.emit('agent:look', { agentId });
});

// ── Graceful Shutdown ───────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\n[bot] Shutting down...');
  socket.disconnect();
  process.exit(0);
});

socket.on('disconnect', () => {
  console.log('[bot] Disconnected from server');
  agentId = null;
  pendingDecision = false;
});

socket.on('connect_error', (err) => {
  console.error(`[bot] Connection error: ${err.message}`);
});
