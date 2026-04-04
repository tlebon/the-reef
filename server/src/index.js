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
import { initDB, saveWorldState, loadAgents, loadTiles, loadBounties, getWorldMeta } from './db.js';
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

// ── x402 Paid Service Endpoints ──────────────────────────────────────

// List available paid services
app.get('/api/services', (req, res) => {
  const services = [];
  for (const agent of world.agents.values()) {
    for (const s of agent.services) {
      services.push({
        agent: agent.name,
        agentId: agent.id,
        ensName: agent.ensName,
        ...s,
      });
    }
  }
  res.json(services);
});

// Invoke a paid service via x402
app.post('/api/services/:agentName/:serviceName',
  // x402 middleware — returns 402 if unpaid
  (req, res, next) => {
    const agent = [...world.agents.values()].find(a => a.name === req.params.agentName);
    const service = agent?.services.find(s => s.name === req.params.serviceName);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const middleware = payments.requirePayment(service.price);
    if (middleware) {
      return middleware(req, res, next);
    }
    // No Circle config — REST endpoint requires x402, return payment info
    return res.status(402).json({
      error: 'Payment required — configure CIRCLE_SELLER_ADDRESS for x402 nanopayments',
      service: service.name,
      price: service.price,
    });
  },
  (req, res) => {
    const agent = [...world.agents.values()].find(a => a.name === req.params.agentName);
    const service = agent?.services.find(s => s.name === req.params.serviceName);
    if (!agent || !service) return res.status(404).json({ error: 'Service not found' });

    // Execute NPC service logic — sanitize query params (no spaces/special chars)
    const args = Object.values(req.query).map(v => String(v).replace(/[^a-zA-Z0-9_-]/g, ''));
    const result = world.execute(agent.id, `INVOKE_SERVICE ${agent.name} ${service.name} ${args.join(' ')}`);

    res.json({
      service: service.name,
      agent: agent.name,
      price: service.price,
      paid: !!payments.enabled,
      payment: req.payment || null,
      result,
    });
  }
);

app.get('/api/archetypes', (req, res) => {
  res.json({
    builder:  { affinity: 'coral',   description: 'Efficient construction, structural bonuses' },
    merchant: { affinity: 'shell',   description: 'Better trade rates, price negotiation' },
    scout:    { affinity: 'kelp',    description: 'Faster movement, exploration, bounty specialist' },
    crafter:  { affinity: 'crystal', description: 'Combines resources into advanced materials' },
  });
});

// ── Agent Automation REST API ───────────────────────────────────────

// Middleware: verify wallet signature for REST API calls.
// Expects header: x-wallet-signature: <sig>  and  x-wallet-message: <msg>
// The message must contain the wallet address and a recent timestamp.
function verifyWalletAuth(req, res, next) {
  const walletAddress = req.params.walletAddress;
  const signature = req.headers['x-wallet-signature'];
  const message = req.headers['x-wallet-message'];

  if (!signature || !message) {
    return res.status(401).json({ error: 'Missing x-wallet-signature and x-wallet-message headers' });
  }

  // Verify the signature recovers to the claimed wallet
  try {
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(403).json({ error: 'Signature does not match wallet address' });
    }
  } catch (err) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  // Require and verify timestamp freshness (15 minute window)
  const tsMatch = message.match(/Timestamp: (\d+)/);
  if (!tsMatch) {
    return res.status(403).json({ error: 'Invalid signature message — missing timestamp' });
  }
  const sigAge = Date.now() - parseInt(tsMatch[1]);
  if (sigAge > 15 * 60 * 1000) {
    return res.status(403).json({ error: 'Signature expired' });
  }

  next();
}

// Middleware: resolve agent by walletAddress param
function resolveAgentByWallet(req, res, next) {
  const agent = world.getAgentByWallet(req.params.walletAddress);
  if (!agent) return res.status(404).json({ error: 'No agent found for this wallet address' });
  req.agent = agent;
  next();
}

// GET /api/agent/:walletAddress/state — full agent state including surroundings
app.get('/api/agent/:walletAddress/state', verifyWalletAuth, resolveAgentByWallet, (req, res) => {
  const lookResult = world.execute(req.agent.id, 'LOOK');
  res.json(lookResult);
});

// POST /api/agent/:walletAddress/action — submit a command
const ALLOWED_REST_COMMANDS = new Set([
  'LOOK', 'MOVE', 'BUILD', 'SCAVENGE', 'REST', 'TRADE', 'SAY',
  'REGISTER_SERVICE', 'REMOVE_SERVICE', 'INVOKE_SERVICE',
  'POST_BOUNTY', 'CLAIM_BOUNTY', 'RATE',
]);

app.post('/api/agent/:walletAddress/action', verifyWalletAuth, resolveAgentByWallet, (req, res) => {
  const { command } = req.body;
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'Missing "command" in request body' });
  }

  const verb = command.split(' ')[0].toUpperCase();
  if (!ALLOWED_REST_COMMANDS.has(verb)) {
    return res.status(400).json({ error: `Unknown command: ${verb}` });
  }

  const result = world.execute(req.agent.id, command);
  if (result.ok) {
    io.emit('world:update', world.getState());
  }
  res.json(result);
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
        // Reconnect to existing agent
        socket.agentId = existing.id;
        socket.emit('agent:registered', { agent: existing, tile: world.getTile(existing.x, existing.y) });

        // Mint NFT for existing agents that don't have one yet
        if (chain.reefAgent) {
          (async () => {
            try {
              const tokenId = await chain.reefAgent.agentOfOwner(walletAddress);
              if (tokenId == 0) {
                await chain.mintAgentNFT(walletAddress, existing.name, existing.archetype, existing.ensName || '');
              }
            } catch (e) { console.error("  Silent error:", e.message?.slice(0, 100)); }
          })();
        }
        return;
      }
    }

    // No local agent — try to recover from ENS
    if (!name || !archetype) {
      if (walletAddress && ens.enabled) {
        const ensData = await ens.resolveWalletToAgent(walletAddress);
        if (ensData) {
          const id = `agent-${crypto.randomUUID()}`;
          const result = world.addAgent(id, ensData.name, ensData.archetype, {
            ownerWallet: walletAddress,
            ensName: ensData.ensName,
          });
          if (!result.error) {
            socket.agentId = result.agent.id;
            socket.emit('agent:registered', result);
            console.log(`  Recovered agent from ENS: ${ensData.name} (${walletAddress.slice(0, 10)}...)`);
            return;
          }
        }
      }
      socket.emit('agent:error', { error: 'No agent found for this wallet. Please create a new character.' });
      return;
    }

    const id = `agent-${crypto.randomUUID()}`;
    const result = world.addAgent(id, name, archetype, {
      ownerWallet: walletAddress || null,
      delegateWallet: delegateWallet || null,
      ensName: (ens.enabled && name) ? ens.getSubname(name) : null,
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

      // Track and register on-chain sequentially
      if (ens.enabled && name) ens.trackSubname(ens.getSubname(name));
      (async () => {
        try {
          await ens.registerSubname(name, walletAddress, { archetype });
          if (walletAddress) {
            await chain.registerAgent(walletAddress);
            await chain.mintAgentNFT(walletAddress, name, archetype, result.agent.ensName || '');
          }
        } catch (err) {
          console.error(`  On-chain registration error: ${err.message}`);
        }
      })();
    }
  });

  // Claim agent for this socket (reconnection via world:state wallet lookup)
  socket.on('agent:claim', ({ agentId, walletAddress }) => {
    console.log(`  Claim: agentId=${agentId} wallet=${walletAddress?.slice(0,10)}`);
    const agent = world.getAgent(agentId);
    if (agent && agent.ownerWallet?.toLowerCase() === walletAddress?.toLowerCase()) {
      socket.agentId = agentId;
      console.log(`  Claim: success — socket.agentId set to ${agentId}`);

      // Mint NFT if missing
      if (chain.reefAgent && walletAddress) {
        (async () => {
          try {
            const tokenId = await chain.reefAgent.agentOfOwner(walletAddress);
            if (tokenId == 0) {
              await chain.mintAgentNFT(walletAddress, agent.name, agent.archetype, agent.ensName || '');
            }
          } catch (e) { console.error("  Silent error:", e.message?.slice(0, 100)); }
        })();
      }
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
    // Enforce agent ownership — only control your own agent
    if (socket.agentId !== agentId) {
      socket.emit('agent:result', { command, result: { error: 'Not authorized — you can only control your own agent' } });
      return;
    }

    // For paid service invocations: check balance → execute → deduct
    const parts = command.trim().split(/\s+/);
    if (parts[0]?.toUpperCase() === 'INVOKE_SERVICE' && parts.length >= 3) {
      const targetName = parts[1];
      const serviceName = parts[2];
      const target = [...world.agents.values()].find(a => a.name === targetName);
      const service = target?.services.find(s => s.name === serviceName);

      if (service && service.price > 0) {
        // Step 1: Deduct payment first (atomic with balance check)
        let payResult;
        try {
          payResult = await payments.processPayment(agentId, target.id, service.price, serviceName);
          // Persist balance change immediately (don't wait for tick)
          saveWorldState(world);
          if (payResult.error) {
            socket.emit('agent:result', { command, result: { error: payResult.error } });
            return;
          }
        } catch (err) {
          socket.emit('agent:result', { command, result: { error: `Payment failed: ${err.message}` } });
          return;
        }

        // Step 2: Execute command (payment already taken)
        const result = world.execute(agentId, command);
        if (!result.ok) {
          // Refund — command failed after payment
          payments.credit(agentId, service.price, `Refund: ${serviceName} failed`);
          socket.emit('agent:result', { command, result });
          return;
        }
        result.payment = payResult;

        // Check quest completion for paid services too
        const agent = world.getAgent(agentId);
        if (agent) {
          const completed = checkQuests(world, agent);
          if (completed.length > 0) {
            for (const q of completed) {
              if (q.reward > 0) payments.credit(agentId, q.reward, `Quest: ${q.description}`);
            }
            socket.emit('quest:completed', completed);
          }
        }

        socket.emit('agent:result', { command, result });
        io.emit('world:update', world.getState());
        return;
      }
    }

    // All other commands — no payment
    const result = world.execute(agentId, command);
    socket.emit('agent:result', { command, result });

    // Mint tile NFT on successful build
    if (result.ok && result.isHome !== undefined) {
      const agent = world.getAgent(agentId);
      if (agent?.ownerWallet) {
        const tile = world.getTile(agent.x, agent.y);
        if (tile) {
          const resourceMap = { coral: 0, crystal: 1, kelp: 2, shell: 3 };
          chain.mintTileNFT(agent.ownerWallet, tile.x, tile.y, resourceMap[tile.resource] ?? 0, tile.symbol).catch(() => {});
        }
      }
    }

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

  // Persist world state to SQLite
  saveWorldState(world);

  const src = blockNumber ? `block #${blockNumber}` : 'interval';
  console.log(`Tick ${world.tick} (${src}) | ${world.agents.size} agents | ${world.tiles.size} tiles | hash: ${hash.slice(0, 16)}...`);
}

// ── Start ────────────────────────────────────────────────────────────

async function start() {
  await chain.init();
  await ens.init();
  await payments.init();
  initDB();

  // Load from SQLite or seed fresh
  const savedTick = getWorldMeta('tick');
  if (savedTick !== null) {
    world.tick = savedTick;
    for (const agent of loadAgents()) {
      world.agents.set(agent.id, agent);
      if (agent.ensName) ens.trackSubname?.(agent.ensName);
    }
    for (const tile of loadTiles()) {
      world.tiles.set(`${tile.x},${tile.y}`, tile);
    }
    world.bounties = loadBounties();

    // Sync tick with on-chain state if behind
    if (chain.enabled && chain.reefWorld) {
      try {
        const onChainTick = Number(await chain.reefWorld.latestTick());
        if (onChainTick > world.tick) {
          console.log(`  Tick sync: server=${world.tick}, chain=${onChainTick} — advancing to chain`);
          world.tick = onChainTick;
        }
      } catch (e) { console.error("  Silent error:", e.message?.slice(0, 100)); }
    }

    console.log(`  DB: loaded ${world.agents.size} agents, ${world.tiles.size} tiles, tick ${world.tick}`);
  }
  if (world.agents.size === 0) {
    seedWorld(world);
  }

  // Recover agents from on-chain data if they're missing from local state
  const onChainAgents = await chain.getRegisteredAgents();
  for (const walletAddr of onChainAgents) {
    if (!world.getAgentByWallet(walletAddr)) {
      // Agent exists on-chain but not in local state — resolve from ENS
      const ensData = ens.enabled ? await ens.resolveWalletToAgent(walletAddr) : null;
      if (ensData) {
        const id = `agent-recovered-${walletAddr.slice(2, 10)}`;
        world.addAgent(id, ensData.name, ensData.archetype, { ownerWallet: walletAddr, ensName: ensData.ensName });
        if (ensData.ensName) ens.trackSubname?.(ensData.ensName);
        console.log(`  Recovered agent: ${ensData.name} (${ensData.archetype}) from ENS`);
      }
    }
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
