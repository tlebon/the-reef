/**
 * The Reef — Server
 *
 * Express + Socket.io server that runs the world engine,
 * processes agent actions, and broadcasts state updates.
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { World } from './world.js';
import { ChainConnector } from './chain.js';

const PORT = process.env.PORT || 3001;
const TICK_INTERVAL = parseInt(process.env.TICK_INTERVAL) || 12_000;

const app = express();
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

const world = new World();
const chain = new ChainConnector();

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
  res.json(agent);
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
  socket.on('agent:register', async ({ id, name, archetype, walletAddress }) => {
    const result = world.addAgent(id, name, archetype);
    if (result.error) {
      socket.emit('agent:error', result);
    } else {
      socket.emit('agent:registered', result);
      io.emit('world:agent_joined', { agent: result.agent, tile: result.tile });

      // Register on-chain if wallet address provided
      if (walletAddress) {
        await chain.registerAgent(walletAddress);
      }
    }
  });

  // Agent command
  socket.on('agent:command', ({ agentId, command }) => {
    const result = world.execute(agentId, command);
    socket.emit('agent:result', { command, result });

    // Broadcast state update if the command changed something
    if (result.ok) {
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

setInterval(async () => {
  world.advanceTick();
  const state = world.getState();
  const hash = world.getStateHash();

  io.emit('world:tick', { tick: world.tick, hash, state });

  // Commit state hash on-chain
  await chain.commitTick(world.tick, hash);

  console.log(`Tick ${world.tick} | ${world.agents.size} agents | ${world.tiles.size} tiles | hash: ${hash.slice(0, 16)}...`);
}, TICK_INTERVAL);

// ── Start ────────────────────────────────────────────────────────────

async function start() {
  await chain.init();

  httpServer.listen(PORT, () => {
    console.log(`
  ┌─────────────────────────────────────┐
  │  The Reef — Server                  │
  │                                     │
  │  REST API:    http://localhost:${PORT} │
  │  WebSocket:   ws://localhost:${PORT}   │
  │  Tick interval: ${TICK_INTERVAL / 1000}s               │
  │  Chain: ${chain.enabled ? 'connected' : 'local-only'}             │
  └─────────────────────────────────────┘
    `);
  });
}

start();
