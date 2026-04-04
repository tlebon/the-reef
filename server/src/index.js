/**
 * The Reef — Server
 *
 * Express + Socket.io server that runs the world engine,
 * processes agent actions, and broadcasts state updates.
 */

import 'dotenv/config';
import crypto from 'crypto';
import { ethers } from 'ethers';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { World } from './world.js';
import { ChainConnector } from './chain.js';
import { seedWorld, tickNPCs, createAgentQuests } from './seed.js';
import { checkQuests } from './quests.js';
import { ENSManager } from './ens.js';
import { PaymentManager } from './payments.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAVE_PATH = join(__dirname, '..', 'world-state.json');
const PORT = process.env.PORT || 3001;
const TICK_INTERVAL = parseInt(process.env.TICK_INTERVAL) || 6_000; // 6s (half block), 12s when synced to blocks

const app = express();
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

const world = new World();
const chain = new ChainConnector();
const ens = new ENSManager();
const payments = new PaymentManager(world);

// ── REST API ─────────────────────────────────────────────────────────

app.get('/api/state', (req, res) => {
  res.json(world.getState());
});

app.get('/api/agents', (req, res) => {
  const agents = [...world.agents.values()].map(a => ({
    id: a.id,
    name: a.name,
    archetype: a.archetype,
    x: a.x,
    y: a.y,
    reputation: a.reputation,
    services: a.services,
  }));
  res.json(agents);
});

app.get('/api/agents/:id', (req, res) => {
  const agent = world.getAgent(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json({ ...agent, ensName: ens.enabled ? ens.getSubname(agent.name) : null });
});

app.get('/api/agents/:id/balance', (req, res) => {
  res.json({ balance: payments.getBalance(req.params.id) });
});

app.get('/api/bounties', (req, res) => {
  res.json(world.bounties.filter(b => !b.completed));
});

app.get('/api/archetypes', (req, res) => {
  res.json({
    builder:  { affinity: 'coral',   description: 'Efficient construction, structural bonuses' },
    merchant: { affinity: 'shell',   description: 'Better trade rates, price negotiation' },
    scout:    { affinity: 'kelp',    description: 'Faster movement, exploration, bounty specialist' },
    crafter:  { affinity: 'crystal', description: 'Combines resources into advanced materials' },
  });
});

// ── WebSocket ────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send current world state on connect
  socket.emit('world:state', world.getState());

  // Agent registration
  socket.on('agent:register', async ({ name, archetype, walletAddress, signature, message, delegateWallet }) => {
    // Validate wallet address format first
    if (walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      socket.emit('agent:error', { error: 'Invalid wallet address' });
      return;
    }

    // Verify wallet ownership via signature — required when wallet is provided
    if (walletAddress) {
      if (!signature || !message) {
        socket.emit('agent:error', { error: 'Wallet signature required — please reconnect your wallet' });
        return;
      }

      // Validate timestamp — require it and reject if older than 5 minutes
      const tsMatch = message.match(/Timestamp: (\d+)/);
      if (!tsMatch) {
        socket.emit('agent:error', { error: 'Invalid signature message — missing timestamp' });
        return;
      }
      const sigAge = Date.now() - parseInt(tsMatch[1]);
      if (sigAge > 15 * 60 * 1000) { // 15 minutes
        socket.emit('agent:error', { error: 'Signature expired — please sign again' });
        return;
      }

      try {
        const recovered = ethers.verifyMessage(message, signature);
        if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
          socket.emit('agent:error', { error: 'Wallet signature verification failed' });
          return;
        }
      } catch {
        socket.emit('agent:error', { error: 'Invalid signature' });
        return;
      }
    }
    if (delegateWallet && !/^0x[a-fA-F0-9]{40}$/.test(delegateWallet)) {
      socket.emit('agent:error', { error: 'Invalid delegate wallet address' });
      return;
    }

    // Check if wallet already has an agent
    if (walletAddress) {
      const existing = world.getAgentByWallet(walletAddress);
      if (existing) {
        // Reconnect to existing agent — don't broadcast, they're already in the world
        socket.agentId = existing.id;
        socket.emit('agent:registered', { agent: existing, tile: world.getTile(existing.x, existing.y) });
        return;
      }
    }

    const id = `agent-${crypto.randomUUID()}`;
    const result = world.addAgent(id, name, archetype, {
      ownerWallet: walletAddress || null,
      delegateWallet: delegateWallet || null,
      ensName: ens.enabled ? ens.getSubname(name) : null,
    });
    if (result.error) {
      socket.emit('agent:error', result);
    } else {
      socket.agentId = result.agent.id;

      socket.emit('agent:registered', result);
      io.emit('world:agent_joined', { agent: result.agent, tile: result.tile });

      // Create per-agent starter quests
      createAgentQuests(world, result.agent);

      // Check quests on join (triggers "arrive" quest)
      const completed = checkQuests(world, result.agent);
      if (completed.length > 0) {
        socket.emit('quest:completed', completed);
      }

      // Register on-chain sequentially (same wallet, can't send in parallel)
      (async () => {
        try {
          await ens.registerSubname(name, walletAddress, { archetype });
          if (walletAddress) await chain.registerAgent(walletAddress);
        } catch (err) {
          console.error(`  On-chain registration error: ${err.message}`);
        }
      })();
    }
  });

  // Link delegate wallet to existing agent — only the socket that registered this agent can link
  socket.on('agent:link_delegate', ({ agentId, delegateWallet }) => {
    if (socket.agentId !== agentId) {
      socket.emit('agent:link_result', { error: 'Not authorized — you can only link delegates to your own agent' });
      return;
    }
    if (delegateWallet && !/^0x[a-fA-F0-9]{40}$/.test(delegateWallet)) {
      socket.emit('agent:link_result', { error: 'Invalid delegate wallet address' });
      return;
    }
    const result = world.linkDelegate(agentId, delegateWallet);
    socket.emit('agent:link_result', result);
  });

  // Agent command
  socket.on('agent:command', async ({ agentId, command }) => {
    // Intercept INVOKE_SERVICE to process payment first
    const parts = command.trim().split(/\s+/);
    if (parts[0]?.toUpperCase() === 'INVOKE_SERVICE' && parts.length >= 3) {
      const targetName = parts[1];
      const serviceName = parts[2];
      const target = [...world.agents.values()].find(a => a.name === targetName);
      if (target) {
        const service = target.services.find(s => s.name === serviceName);
        if (service && service.price > 0) {
          const payResult = await payments.processPayment(agentId, target.id, service.price, serviceName);
          if (payResult.error) {
            socket.emit('agent:result', { command, result: { error: payResult.error } });
            return;
          }
        }
      }
    }

    const result = world.execute(agentId, command);
    socket.emit('agent:result', { command, result });

    // Check quest completion after every action
    if (result.ok) {
      const agent = world.getAgent(agentId);
      if (agent) {
        const completed = checkQuests(world, agent);
        if (completed.length > 0) {
          // Credit quest rewards via payment ledger
          for (const q of completed) {
            if (q.reward > 0) {
              payments.credit(agentId, q.reward, `Quest: ${q.description}`);
            }
          }
          socket.emit('quest:completed', completed);
        }
      }
      io.emit('world:update', world.getState());
    }
  });

  // Request look (read-only, no broadcast needed)
  socket.on('agent:look', ({ agentId }) => {
    const result = world.execute(agentId, 'LOOK');
    socket.emit('agent:look_result', result);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// ── Tick Loop ────────────────────────────────────────────────────────

function processTick(blockNumber) {
  world.advanceTick();
  tickNPCs(world);
  const state = world.getState();
  const hash = world.getStateHash();

  io.emit('world:tick', { tick: world.tick, block: blockNumber || null, hash, state });

  // Commit state hash on-chain (fire and forget)
  chain.commitTick(world.tick, hash).catch(() => {});

  // Persist world state
  world.save(SAVE_PATH);

  const src = blockNumber ? `block #${blockNumber}` : 'interval';
  console.log(`Tick ${world.tick} (${src}) | ${world.agents.size} agents | ${world.tiles.size} tiles | hash: ${hash.slice(0, 16)}...`);
}

// ── Start ────────────────────────────────────────────────────────────

async function start() {
  await chain.init();
  await ens.init();
  await payments.init();

  // Load saved state or seed fresh
  const loaded = world.load(SAVE_PATH);
  if (!loaded) {
    seedWorld(world);
  }

  // Sync ticks to blocks via WebSocket — 2 ticks per block (6s each, 12s blocks)
  let lastBlockTick = Date.now();
  const blockSync = chain.onNewBlock((blockNumber) => {
    lastBlockTick = Date.now();
    processTick(blockNumber);
    // Second tick halfway through the block
    setTimeout(() => {
      lastBlockTick = Date.now();
      processTick(blockNumber);
    }, TICK_INTERVAL);
  });

  // Interval fallback — only fires if no block received recently
  setInterval(() => {
    if (!blockSync || Date.now() - lastBlockTick > TICK_INTERVAL * 3) {
      processTick(null);
    }
  }, TICK_INTERVAL);

  httpServer.listen(PORT, () => {
    console.log(`
  ┌─────────────────────────────────────┐
  │  The Reef — Server                  │
  │                                     │
  │  REST API:    http://localhost:${PORT} │
  │  WebSocket:   ws://localhost:${PORT}   │
  │  Ticks: ${blockSync ? 'synced to blocks' : `${TICK_INTERVAL / 1000}s interval`}          │
  │  Chain: ${chain.enabled ? 'connected' : 'local-only'}             │
  │  ENS: ${ens.enabled ? ens.parentName : 'disabled'}                │
  └─────────────────────────────────────┘
    `);
  });
}

start();
