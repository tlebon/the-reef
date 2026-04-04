/**
 * SQLite database for persistent game state.
 * Replaces world-state.json with proper persistence.
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'reef.db');

let db;

export function initDB() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      archetype TEXT NOT NULL,
      x INTEGER DEFAULT 0,
      y INTEGER DEFAULT 0,
      energy INTEGER DEFAULT 20,
      tilesOwned INTEGER DEFAULT 0,
      balance REAL DEFAULT 0,
      ownerWallet TEXT,
      delegateWallet TEXT,
      ensName TEXT,
      inventory TEXT DEFAULT '{}',
      loot TEXT DEFAULT '[]',
      services TEXT DEFAULT '[]',
      reputation TEXT DEFAULT '{"transactions":0,"totalRating":0,"count":0}',
      scavengeCount INTEGER DEFAULT 0,
      tradeCount INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tiles (
      key TEXT PRIMARY KEY,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      resource TEXT NOT NULL,
      owner TEXT,
      built INTEGER DEFAULT 0,
      symbol TEXT DEFAULT '.',
      services TEXT DEFAULT '[]',
      revealedAt INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bounties (
      id TEXT PRIMARY KEY,
      poster TEXT,
      posterId TEXT,
      forAgentId TEXT,
      reward REAL DEFAULT 0,
      description TEXT,
      questType TEXT,
      target INTEGER,
      resource TEXT,
      claimed INTEGER DEFAULT 0,
      claimedBy TEXT,
      claimedById TEXT,
      completed INTEGER DEFAULT 0,
      completedBy TEXT,
      completedById TEXT,
      completedAt INTEGER,
      postedAt INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS world (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_agents_wallet ON agents(ownerWallet);
    CREATE INDEX IF NOT EXISTS idx_agents_delegate ON agents(delegateWallet);
    CREATE INDEX IF NOT EXISTS idx_tiles_owner ON tiles(owner);
  `);

  console.log(`  DB: initialized at ${DB_PATH}`);
  return db;
}

// ── Agent operations ────────────────────────────────────────────────

export function saveAgent(agent) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO agents (id, name, archetype, x, y, energy, tilesOwned, balance,
      ownerWallet, delegateWallet, ensName, inventory, loot, services, reputation, scavengeCount, tradeCount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    agent.id, agent.name, agent.archetype, agent.x, agent.y, agent.energy,
    agent.tilesOwned || 0, agent.balance || 0,
    agent.ownerWallet, agent.delegateWallet, agent.ensName,
    JSON.stringify(agent.inventory || {}),
    JSON.stringify(agent.loot || []),
    JSON.stringify(agent.services || []),
    JSON.stringify(agent.reputation || {}),
    agent.scavengeCount || 0, agent.tradeCount || 0
  );
}

export function loadAgents() {
  const rows = db.prepare('SELECT * FROM agents').all();
  return rows.map(row => ({
    ...row,
    built: undefined,
    inventory: JSON.parse(row.inventory),
    loot: JSON.parse(row.loot),
    services: JSON.parse(row.services),
    reputation: JSON.parse(row.reputation),
  }));
}

export function getAgentByWallet(wallet) {
  if (!wallet) return null;
  const row = db.prepare('SELECT * FROM agents WHERE LOWER(ownerWallet) = LOWER(?) OR LOWER(delegateWallet) = LOWER(?)').get(wallet, wallet);
  if (!row) return null;
  return {
    ...row,
    inventory: JSON.parse(row.inventory),
    loot: JSON.parse(row.loot),
    services: JSON.parse(row.services),
    reputation: JSON.parse(row.reputation),
  };
}

export function deleteAgent(id) {
  db.prepare('DELETE FROM agents WHERE id = ?').run(id);
}

// ── Tile operations ─────────────────────────────────────────────────

export function saveTile(key, tile) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO tiles (key, x, y, resource, owner, built, symbol, services, revealedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(key, tile.x, tile.y, tile.resource, tile.owner, tile.built ? 1 : 0,
    tile.symbol, JSON.stringify(tile.services || []), tile.revealedAt || 0);
}

export function loadTiles() {
  const rows = db.prepare('SELECT * FROM tiles').all();
  return rows.map(row => ({
    ...row,
    built: !!row.built,
    services: JSON.parse(row.services),
  }));
}

// ── Bounty operations ───────────────────────────────────────────────

export function saveBounty(bounty) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO bounties (id, poster, posterId, forAgentId, reward, description,
      questType, target, resource, claimed, claimedBy, claimedById, completed, completedBy,
      completedById, completedAt, postedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(bounty.id, bounty.poster, bounty.posterId, bounty.forAgentId,
    bounty.reward, bounty.description, bounty.questType, bounty.target, bounty.resource,
    bounty.claimed ? 1 : 0, bounty.claimedBy, bounty.claimedById,
    bounty.completed ? 1 : 0, bounty.completedBy, bounty.completedById,
    bounty.completedAt, bounty.postedAt);
}

export function loadBounties() {
  const rows = db.prepare('SELECT * FROM bounties').all();
  return rows.map(row => ({
    ...row,
    claimed: !!row.claimed,
    completed: !!row.completed,
  }));
}

// ── World metadata ──────────────────────────────────────────────────

export function setWorldMeta(key, value) {
  db.prepare('INSERT OR REPLACE INTO world (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
}

export function getWorldMeta(key) {
  const row = db.prepare('SELECT value FROM world WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : null;
}

// ── Bulk save (called on each tick) ─────────────────────────────────

export function saveWorldState(world) {
  const saveAll = db.transaction(() => {
    setWorldMeta('tick', world.tick);

    for (const agent of world.agents.values()) {
      saveAgent(agent);
    }

    for (const [key, tile] of world.tiles.entries()) {
      saveTile(key, tile);
    }

    for (const bounty of world.bounties) {
      saveBounty(bounty);
    }
  });

  saveAll();
}
