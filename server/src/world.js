/**
 * World Engine — The Reef
 *
 * Dynamic grid that grows through agent building.
 * Tiles only exist where agents have built or where building has revealed them.
 */

import crypto from 'crypto';

const RESOURCES = ['coral', 'crystal', 'kelp', 'shell'];

const ARCHETYPES = {
  builder:  { affinity: 'coral',   buildCost: 2, moveCost: 1, description: 'Efficient construction, structural bonuses' },
  merchant: { affinity: 'shell',   buildCost: 3, moveCost: 1, description: 'Better trade rates, price negotiation' },
  scout:    { affinity: 'kelp',    buildCost: 3, moveCost: 0, description: 'Faster movement, exploration, bounty specialist' },
  crafter:  { affinity: 'crystal', buildCost: 3, moveCost: 1, description: 'Combines resources into advanced materials' },
};

const MAX_ENERGY = 20;
const ENERGY_REGEN = 5;
const BASE_BUILD_CAP = 5;

function randomResource() {
  return RESOURCES[Math.floor(Math.random() * RESOURCES.length)];
}

export class World {
  constructor() {
    this.tick = 0;
    this.tiles = new Map();       // "x,y" -> Tile
    this.agents = new Map();      // agentId -> Agent
    this.messages = [];           // recent broadcasts
    this.bounties = [];           // active bounties
    this.actionQueue = [];        // queued actions for current tick
    this.log = [];                // event log

    // Create the origin tile
    this._createTile(0, 0);
  }

  // ── Tiles ──────────────────────────────────────────────────────────

  _tileKey(x, y) {
    return `${x},${y}`;
  }

  _createTile(x, y) {
    const key = this._tileKey(x, y);
    if (this.tiles.has(key)) return this.tiles.get(key);

    const tile = {
      x, y,
      resource: randomResource(),
      owner: null,
      built: false,
      symbol: '.',
      services: [],
      revealedAt: this.tick,
    };
    this.tiles.set(key, tile);
    return tile;
  }

  _revealNeighbors(x, y) {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const revealed = [];
    for (const [dx, dy] of dirs) {
      const key = this._tileKey(x + dx, y + dy);
      if (!this.tiles.has(key)) {
        revealed.push(this._createTile(x + dx, y + dy));
      }
    }
    return revealed;
  }

  getTile(x, y) {
    return this.tiles.get(this._tileKey(x, y)) || null;
  }

  _getFrontierTiles() {
    const frontier = [];
    for (const tile of this.tiles.values()) {
      if (!tile.built && !tile.owner) {
        frontier.push(tile);
      }
    }
    return frontier;
  }

  // ── Agents ─────────────────────────────────────────────────────────

  addAgent(id, name, archetype) {
    if (!ARCHETYPES[archetype]) {
      return { error: `Unknown archetype: ${archetype}. Choose: ${Object.keys(ARCHETYPES).join(', ')}` };
    }

    // Spawn at random frontier tile, or origin if no frontier
    const frontier = this._getFrontierTiles();
    const spawnTile = frontier.length > 0
      ? frontier[Math.floor(Math.random() * frontier.length)]
      : this.tiles.get(this._tileKey(0, 0));

    const agent = {
      id,
      name,
      archetype,
      x: spawnTile.x,
      y: spawnTile.y,
      energy: MAX_ENERGY,
      reputation: { transactions: 0, totalRating: 0, count: 0 },
      inventory: {},    // resource -> count
      tilesOwned: 0,
      services: [],
    };

    this.agents.set(id, agent);
    this._log(`${name} (${archetype}) spawned at (${agent.x},${agent.y})`);
    return { agent, tile: spawnTile };
  }

  getAgent(id) {
    return this.agents.get(id) || null;
  }

  _buildCap(agent) {
    const repLevel = Math.floor(agent.reputation.transactions / 10);
    return BASE_BUILD_CAP + repLevel;
  }

  _avgRating(agent) {
    if (agent.reputation.count === 0) return 0;
    return agent.reputation.totalRating / agent.reputation.count;
  }

  // ── Commands ───────────────────────────────────────────────────────

  execute(agentId, command) {
    const agent = this.agents.get(agentId);
    if (!agent) return { error: 'Unknown agent' };

    const parts = command.trim().split(/\s+/);
    const cmd = parts[0].toUpperCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'LOOK':      return this._cmdLook(agent);
      case 'MOVE':      return this._cmdMove(agent, args[0]);
      case 'SAY':       return this._cmdSay(agent, parts.slice(1).join(' '));
      case 'BUILD':     return this._cmdBuild(agent, args[0]);
      case 'TRADE':     return this._cmdTrade(agent, args);
      case 'REGISTER_SERVICE': return this._cmdRegisterService(agent, args);
      case 'INVOKE_SERVICE':   return this._cmdInvokeService(agent, args);
      case 'POST_BOUNTY':      return this._cmdPostBounty(agent, args);
      case 'CLAIM_BOUNTY':     return this._cmdClaimBounty(agent, args);
      case 'RATE':             return this._cmdRate(agent, args);
      default:
        return { error: `Unknown command: ${cmd}` };
    }
  }

  _cmdLook(agent) {
    const vision = 3;
    const visibleTiles = [];
    const visibleAgents = [];

    for (let dy = -vision; dy <= vision; dy++) {
      for (let dx = -vision; dx <= vision; dx++) {
        const tile = this.getTile(agent.x + dx, agent.y + dy);
        if (tile) {
          visibleTiles.push(tile);
        }
      }
    }

    for (const a of this.agents.values()) {
      if (a.id === agent.id) continue;
      const dist = Math.abs(a.x - agent.x) + Math.abs(a.y - agent.y);
      if (dist <= vision) {
        visibleAgents.push({
          id: a.id,
          name: a.name,
          archetype: a.archetype,
          x: a.x,
          y: a.y,
          reputation: { transactions: a.reputation.transactions, avgRating: this._avgRating(a) },
          services: a.services,
        });
      }
    }

    // Recent messages in earshot
    const heard = this.messages
      .filter(m => m.tick >= this.tick - 3)
      .filter(m => Math.abs(m.x - agent.x) + Math.abs(m.y - agent.y) <= vision)
      .filter(m => m.from !== agent.name)
      .slice(-5);

    // Nearby bounties
    const nearbyBounties = this.bounties.filter(b => !b.claimed);

    return {
      agent: {
        name: agent.name,
        archetype: agent.archetype,
        x: agent.x,
        y: agent.y,
        energy: agent.energy,
        inventory: agent.inventory,
        tilesOwned: agent.tilesOwned,
        buildCap: this._buildCap(agent),
        reputation: { transactions: agent.reputation.transactions, avgRating: this._avgRating(agent) },
      },
      tiles: visibleTiles,
      agents: visibleAgents,
      messages: heard,
      bounties: nearbyBounties,
      tick: this.tick,
    };
  }

  _cmdMove(agent, direction) {
    if (!direction) return { error: 'Usage: MOVE <N|S|E|W>' };

    const dirs = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
    const d = dirs[direction.toUpperCase()];
    if (!d) return { error: `Invalid direction: ${direction}` };

    const archeCost = ARCHETYPES[agent.archetype].moveCost;
    const cost = 1 + archeCost; // base 1 + archetype modifier (scouts get 0)
    if (agent.energy < cost) return { error: `Not enough energy (need ${cost}, have ${agent.energy})` };

    const nx = agent.x + d[0];
    const ny = agent.y + d[1];

    const tile = this.getTile(nx, ny);
    if (!tile) return { error: `Can't move ${direction} — unexplored void` };

    // Check for collision
    for (const a of this.agents.values()) {
      if (a.id !== agent.id && a.x === nx && a.y === ny) {
        return { error: `Can't move ${direction} — ${a.name} is there` };
      }
    }

    agent.energy -= cost;
    agent.x = nx;
    agent.y = ny;
    this._log(`${agent.name} moved ${direction} to (${nx},${ny})`);
    return { ok: true, message: `Moved ${direction} to (${nx},${ny})`, energy: agent.energy };
  }

  _cmdSay(agent, text) {
    if (!text) return { error: 'Usage: SAY <message>' };

    const msg = { from: agent.name, x: agent.x, y: agent.y, text, tick: this.tick };
    this.messages.push(msg);
    if (this.messages.length > 100) this.messages = this.messages.slice(-100);

    this._log(`${agent.name} says: "${text}"`);
    return { ok: true, message: `You said: "${text}"` };
  }

  _cmdBuild(agent, symbol) {
    const tile = this.getTile(agent.x, agent.y);
    if (!tile) return { error: 'No tile here' };

    if (tile.built && tile.owner !== agent.id) {
      return { error: `This tile is owned by another agent` };
    }

    if (!tile.built && agent.tilesOwned >= this._buildCap(agent)) {
      return { error: `Build cap reached (${this._buildCap(agent)}). Earn more reputation to build more.` };
    }

    const cost = ARCHETYPES[agent.archetype].buildCost;
    if (agent.energy < cost) return { error: `Not enough energy (need ${cost}, have ${agent.energy})` };

    agent.energy -= cost;

    const wasNewBuild = !tile.built;
    tile.built = true;
    tile.owner = agent.id;
    tile.symbol = symbol || '#';

    if (wasNewBuild) {
      agent.tilesOwned++;
      // Reveal neighbors
      const revealed = this._revealNeighbors(agent.x, agent.y);
      this._log(`${agent.name} built '${tile.symbol}' at (${agent.x},${agent.y}), revealed ${revealed.length} new tiles`);
      return {
        ok: true,
        message: `Built '${tile.symbol}' at (${agent.x},${agent.y})`,
        revealed: revealed.map(t => ({ x: t.x, y: t.y, resource: t.resource })),
        energy: agent.energy,
      };
    }

    this._log(`${agent.name} rebuilt '${tile.symbol}' at (${agent.x},${agent.y})`);
    return { ok: true, message: `Rebuilt '${tile.symbol}' at (${agent.x},${agent.y})`, energy: agent.energy };
  }

  _cmdTrade(agent, args) {
    // TRADE <agentName> <give_resource> <give_amount> <want_resource> <want_amount>
    if (args.length < 4) return { error: 'Usage: TRADE <agentName> <give_resource> <give_amount> <want_resource> <want_amount>' };

    const [targetName, giveRes, giveAmtStr, wantRes, wantAmtStr] = args;
    const giveAmt = parseInt(giveAmtStr) || 1;
    const wantAmt = parseInt(wantAmtStr) || 1;

    if (agent.energy < 1) return { error: 'Not enough energy' };

    const target = [...this.agents.values()].find(a => a.name === targetName);
    if (!target) return { error: `Agent '${targetName}' not found` };

    const dist = Math.abs(target.x - agent.x) + Math.abs(target.y - agent.y);
    if (dist > 2) return { error: `${targetName} is too far away (distance: ${dist})` };

    if ((agent.inventory[giveRes] || 0) < giveAmt) {
      return { error: `You don't have ${giveAmt} ${giveRes}` };
    }
    if ((target.inventory[wantRes] || 0) < wantAmt) {
      return { error: `${targetName} doesn't have ${wantAmt} ${wantRes}` };
    }

    agent.energy -= 1;
    agent.inventory[giveRes] -= giveAmt;
    agent.inventory[wantRes] = (agent.inventory[wantRes] || 0) + wantAmt;
    target.inventory[wantRes] -= wantAmt;
    target.inventory[giveRes] = (target.inventory[giveRes] || 0) + giveAmt;

    // Both get reputation for trading
    agent.reputation.transactions++;
    target.reputation.transactions++;

    this._log(`${agent.name} traded ${giveAmt} ${giveRes} for ${wantAmt} ${wantRes} with ${target.name}`);
    return { ok: true, message: `Traded ${giveAmt} ${giveRes} for ${wantAmt} ${wantRes} with ${targetName}` };
  }

  _cmdRegisterService(agent, args) {
    // REGISTER_SERVICE <name> <price> <description...>
    if (args.length < 3) return { error: 'Usage: REGISTER_SERVICE <name> <price> <description...>' };

    if (agent.energy < 2) return { error: 'Not enough energy' };

    const name = args[0];
    const price = parseFloat(args[1]) || 0.01;
    const description = args.slice(2).join(' ');

    const tile = this.getTile(agent.x, agent.y);
    if (!tile || tile.owner !== agent.id) {
      return { error: 'You must be on a tile you own to register a service' };
    }

    agent.energy -= 2;
    const service = { name, price, description, tileX: agent.x, tileY: agent.y };
    agent.services.push(service);
    tile.services.push({ agentId: agent.id, ...service });

    this._log(`${agent.name} registered service: ${name} (${price} USDC)`);
    return { ok: true, message: `Registered service: ${name} at ${price} USDC`, service };
  }

  _cmdInvokeService(agent, args) {
    // INVOKE_SERVICE <agentName> <serviceName> <args...>
    if (args.length < 2) return { error: 'Usage: INVOKE_SERVICE <agentName> <serviceName> [args...]' };

    if (agent.energy < 1) return { error: 'Not enough energy' };

    const [targetName, serviceName, ...serviceArgs] = args;
    const target = [...this.agents.values()].find(a => a.name === targetName);
    if (!target) return { error: `Agent '${targetName}' not found` };

    const service = target.services.find(s => s.name === serviceName);
    if (!service) return { error: `${targetName} has no service called '${serviceName}'` };

    agent.energy -= 1;

    // Payment would happen via Circle nanopayments in production
    // For now, track the transaction
    agent.reputation.transactions++;
    target.reputation.transactions++;

    this._log(`${agent.name} invoked ${target.name}'s ${serviceName} service`);
    return {
      ok: true,
      message: `Invoked ${targetName}'s ${serviceName} service`,
      service,
      args: serviceArgs.join(' '),
      // In production: payment receipt, service response
    };
  }

  _cmdPostBounty(agent, args) {
    // POST_BOUNTY <reward> <description...>
    if (args.length < 2) return { error: 'Usage: POST_BOUNTY <reward_usdc> <description...>' };

    if (agent.energy < 1) return { error: 'Not enough energy' };

    const reward = parseFloat(args[0]) || 0.01;
    const description = args.slice(1).join(' ');

    agent.energy -= 1;
    const bounty = {
      id: crypto.randomUUID(),
      poster: agent.name,
      posterId: agent.id,
      reward,
      description,
      claimed: false,
      claimedBy: null,
      completed: false,
      postedAt: this.tick,
    };
    this.bounties.push(bounty);

    this._log(`${agent.name} posted bounty: "${description}" for ${reward} USDC`);
    return { ok: true, message: `Posted bounty: "${description}" for ${reward} USDC`, bounty };
  }

  _cmdClaimBounty(agent, args) {
    // CLAIM_BOUNTY <bountyId>
    if (args.length < 1) return { error: 'Usage: CLAIM_BOUNTY <bountyId>' };

    const bounty = this.bounties.find(b => b.id === args[0] && !b.claimed);
    if (!bounty) return { error: 'Bounty not found or already claimed' };
    if (bounty.posterId === agent.id) return { error: "Can't claim your own bounty" };

    bounty.claimed = true;
    bounty.claimedBy = agent.name;
    bounty.claimedById = agent.id;

    this._log(`${agent.name} claimed bounty: "${bounty.description}"`);
    return { ok: true, message: `Claimed bounty: "${bounty.description}"`, bounty };
  }

  _cmdRate(agent, args) {
    // RATE <agentName> <score 1-5>
    if (args.length < 2) return { error: 'Usage: RATE <agentName> <score 1-5>' };

    const [targetName, scoreStr] = args;
    const score = parseInt(scoreStr);
    if (score < 1 || score > 5) return { error: 'Score must be 1-5' };

    const target = [...this.agents.values()].find(a => a.name === targetName);
    if (!target) return { error: `Agent '${targetName}' not found` };
    if (target.id === agent.id) return { error: "Can't rate yourself" };

    target.reputation.totalRating += score;
    target.reputation.count++;

    this._log(`${agent.name} rated ${target.name}: ${score}/5`);
    return { ok: true, message: `Rated ${targetName}: ${score}/5`, newAvg: this._avgRating(target) };
  }

  // ── Tick ────────────────────────────────────────────────────────────

  advanceTick() {
    this.tick++;

    // Regen energy for all agents
    for (const agent of this.agents.values()) {
      agent.energy = Math.min(MAX_ENERGY, agent.energy + ENERGY_REGEN);
    }

    // Harvest resources — agents on tiles with resources collect them
    for (const agent of this.agents.values()) {
      const tile = this.getTile(agent.x, agent.y);
      if (tile && tile.resource) {
        const amount = tile.resource === ARCHETYPES[agent.archetype].affinity ? 2 : 1;
        agent.inventory[tile.resource] = (agent.inventory[tile.resource] || 0) + amount;
      }
    }
  }

  // ── State ──────────────────────────────────────────────────────────

  getState() {
    return {
      tick: this.tick,
      tiles: Object.fromEntries(this.tiles),
      agents: Object.fromEntries(
        [...this.agents.entries()].map(([id, a]) => [id, {
          ...a,
          reputation: { ...a.reputation, avgRating: this._avgRating(a) },
        }])
      ),
      bounties: this.bounties.filter(b => !b.completed),
      messages: this.messages.slice(-20),
    };
  }

  getStateHash() {
    const state = JSON.stringify(this.getState());
    return crypto.createHash('sha256').update(state).digest('hex');
  }

  _log(event) {
    const entry = `[tick:${String(this.tick).padStart(4, '0')}] ${event}`;
    this.log.push(entry);
    if (this.log.length > 500) this.log = this.log.slice(-500);
  }
}
