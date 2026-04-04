/**
 * World Engine — The Reef
 *
 * Dynamic grid that grows through agent building.
 * Tiles only exist where agents have built or where building has revealed them.
 * Commands are in commands.js, constants in constants.js, loot in loot.js.
 */

import crypto from 'crypto';
import fs from 'fs';
import { RESOURCES, ARCHETYPES, MAX_ENERGY, ENERGY_REGEN, RANDOM_QUEST_TEMPLATES } from './constants.js';
import * as cmd from './commands.js';

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

  addAgent(id, name, archetype, { ownerWallet, delegateWallet } = {}) {
    if (!ARCHETYPES[archetype]) {
      return { error: `Unknown archetype: ${archetype}. Choose: ${Object.keys(ARCHETYPES).join(', ')}` };
    }
    if (!name || name.length < 1 || name.length > 20) {
      return { error: 'Name must be 1-20 characters' };
    }
    if (/\s/.test(name)) {
      return { error: 'Name cannot contain spaces' };
    }
    if ([...this.agents.values()].some(a => a.name.toLowerCase() === name.toLowerCase())) {
      return { error: `Name '${name}' is already taken` };
    }

    const frontier = this._getFrontierTiles();
    const spawnTile = frontier.length > 0
      ? frontier[Math.floor(Math.random() * frontier.length)]
      : this.tiles.get(this._tileKey(0, 0));

    const agent = {
      id, name, archetype,
      x: spawnTile.x, y: spawnTile.y,
      energy: MAX_ENERGY,
      reputation: { transactions: 0, totalRating: 0, count: 0 },
      inventory: {},
      tilesOwned: 0,
      services: [],
      ownerWallet: ownerWallet || null,
      delegateWallet: delegateWallet || null,
    };

    this.agents.set(id, agent);
    this._log(`${name} (${archetype}) spawned at (${agent.x},${agent.y})`);
    return { agent, tile: spawnTile };
  }

  getAgent(id) {
    return this.agents.get(id) || null;
  }

  linkDelegate(agentId, delegateWallet) {
    const agent = this.agents.get(agentId);
    if (!agent) return { error: 'Unknown agent' };
    agent.delegateWallet = delegateWallet;
    this._log(`${agent.name} linked delegate wallet ${delegateWallet.slice(0, 10)}...`);
    return { ok: true, message: `Linked delegate wallet` };
  }

  getAgentByWallet(walletAddress) {
    if (!walletAddress) return null;
    const addr = walletAddress.toLowerCase();
    for (const agent of this.agents.values()) {
      if (agent.ownerWallet?.toLowerCase() === addr || agent.delegateWallet?.toLowerCase() === addr) {
        return agent;
      }
    }
    return null;
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
    const action = parts[0].toUpperCase();
    const args = parts.slice(1);

    const commands = {
      LOOK:             () => cmd.cmdLook(this, agent),
      MOVE:             () => cmd.cmdMove(this, agent, args[0]),
      SAY:              () => cmd.cmdSay(this, agent, parts.slice(1).join(' ')),
      BUILD:            () => cmd.cmdBuild(this, agent, args[0]),
      TRADE:            () => cmd.cmdTrade(this, agent, args),
      SCAVENGE:         () => cmd.cmdScavenge(this, agent),
      REST:             () => cmd.cmdRest(this, agent, args[0]),
      REGISTER_SERVICE: () => cmd.cmdRegisterService(this, agent, args),
      REMOVE_SERVICE:   () => cmd.cmdRemoveService(this, agent, args),
      INVOKE_SERVICE:   () => cmd.cmdInvokeService(this, agent, args),
      POST_BOUNTY:      () => cmd.cmdPostBounty(this, agent, args),
      CLAIM_BOUNTY:     () => cmd.cmdClaimBounty(this, agent, args),
      RATE:             () => cmd.cmdRate(this, agent, args),
    };

    const handler = commands[action];
    if (!handler) return { error: `Unknown command: ${action}` };
    return handler();
  }

  // ── Tick ────────────────────────────────────────────────────────────

  advanceTick() {
    this.tick++;

    // Regen energy for all agents
    for (const agent of this.agents.values()) {
      agent.energy = Math.min(MAX_ENERGY, agent.energy + ENERGY_REGEN);
    }

    // Tile owners passively earn a trickle of their tile's resource
    for (const tile of this.tiles.values()) {
      if (tile.built && tile.owner) {
        const owner = this.agents.get(tile.owner);
        if (owner) {
          owner.inventory[tile.resource] = (owner.inventory[tile.resource] || 0) + 1;
        }
      }
    }

    // Prune completed bounties older than 50 ticks
    this.bounties = this.bounties.filter(b => !b.completed || (this.tick - (b.completedAt || 0)) < 50);

    // Generate random quests periodically
    const activeQuests = this.bounties.filter(b => !b.completed && b.posterId === 'system' && !b.forAgentId);
    if (this.tick % 20 === 0 && activeQuests.length < 10 && this.agents.size > 0) {
      const quest = this._generateRandomQuest();
      if (quest) {
        this.bounties.push(quest);
        this._log(`New quest: "${quest.description}" for ${quest.reward} USDC`);
      }
    }
  }

  _generateRandomQuest() {
    const template = RANDOM_QUEST_TEMPLATES[Math.floor(Math.random() * RANDOM_QUEST_TEMPLATES.length)];
    const resource = RESOURCES[Math.floor(Math.random() * RESOURCES.length)];
    const amount = Math.floor(Math.random() * 5) + 2;

    const desc = template.desc
      .replace('{amount}', amount)
      .replace('{resource}', resource);

    const rewardBase = { trade: 0.04, collect: 0.015, scavenge: 0.01 };
    const reward = Math.round((rewardBase[template.type] || 0.02) * amount * 100) / 100;

    return {
      id: crypto.randomUUID(),
      poster: 'The Reef',
      posterId: 'system',
      reward,
      description: desc,
      questType: template.type,
      target: amount,
      resource,
      claimed: false,
      claimedBy: null,
      completed: false,
      postedAt: this.tick,
    };
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

  // ── Persistence ────────────────────────────────────────────────────

  save(path) {
    const data = JSON.stringify({
      tick: this.tick,
      tiles: Object.fromEntries(this.tiles),
      agents: Object.fromEntries(this.agents),
      bounties: this.bounties,
      messages: this.messages.slice(-20),
    }, null, 2);
    fs.writeFile(path, data, (err) => {
      if (err) console.error('  World: save failed —', err.message);
    });
  }

  load(path) {
    if (!fs.existsSync(path)) return false;

    let data;
    try {
      data = JSON.parse(fs.readFileSync(path, 'utf-8'));
    } catch (err) {
      console.error(`  World: failed to load ${path} — ${err.message}`);
      return false;
    }
    this.tick = data.tick || 0;

    for (const [key, tdata] of Object.entries(data.tiles || {})) {
      this.tiles.set(key, tdata);
    }

    for (const [id, adata] of Object.entries(data.agents || {})) {
      this.agents.set(id, {
        ...adata,
        reputation: {
          transactions: adata.reputation?.transactions || 0,
          totalRating: adata.reputation?.totalRating || 0,
          count: adata.reputation?.count || 0,
        },
      });
    }

    this.bounties = data.bounties || [];
    this.messages = data.messages || [];

    console.log(`  World: loaded from ${path} (tick ${this.tick}, ${this.agents.size} agents, ${this.tiles.size} tiles)`);
    return true;
  }
}
