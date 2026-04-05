/**
 * World commands — all agent actions.
 * Each function takes (world, agent, ...args) and returns a result object.
 */

import crypto from 'crypto';
import { RESOURCES, ARCHETYPES, MAX_ENERGY, TILE_MINT_COSTS, RARITY_TABLE, SCAVENGE_COST, MAX_DESCRIPTION_LENGTH } from './constants.js';
import { rollLoot } from './loot.js';

export function cmdLook(world, agent) {
  const vision = 3;
  const visibleTiles = [];
  const visibleAgents = [];

  for (let dy = -vision; dy <= vision; dy++) {
    for (let dx = -vision; dx <= vision; dx++) {
      const tile = world.getTile(agent.x + dx, agent.y + dy);
      if (tile) visibleTiles.push(tile);
    }
  }

  for (const a of world.agents.values()) {
    if (a.id === agent.id) continue;
    const dist = Math.abs(a.x - agent.x) + Math.abs(a.y - agent.y);
    if (dist <= vision) {
      visibleAgents.push({
        id: a.id, name: a.name, archetype: a.archetype, x: a.x, y: a.y,
        reputation: { transactions: a.reputation.transactions, avgRating: world._avgRating(a) },
        services: a.services,
      });
    }
  }

  const heard = world.messages
    .filter(m => m.tick >= world.tick - 3)
    .filter(m => Math.abs(m.x - agent.x) + Math.abs(m.y - agent.y) <= vision)
    .filter(m => m.from !== agent.name)
    .slice(-5);

  return {
    agent: {
      name: agent.name, archetype: agent.archetype, x: agent.x, y: agent.y,
      energy: agent.energy, inventory: agent.inventory, tilesOwned: agent.tilesOwned,
      reputation: { transactions: agent.reputation.transactions, avgRating: world._avgRating(agent) },
    },
    tiles: visibleTiles,
    agents: visibleAgents,
    messages: heard,
    bounties: world.bounties.filter(b => !b.claimed),
    tick: world.tick,
  };
}

export function cmdMove(world, agent, direction) {
  if (!direction) return { error: 'Usage: MOVE <N|S|E|W>' };

  const dirs = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  const d = dirs[direction.toUpperCase()];
  if (!d) return { error: `Invalid direction: ${direction}` };

  const cost = 1 + ARCHETYPES[agent.archetype].moveCost;
  if (agent.energy < cost) return { error: `Not enough energy (need ${cost}, have ${agent.energy})` };

  const nx = agent.x + d[0];
  const ny = agent.y + d[1];
  const tile = world.getTile(nx, ny);
  if (!tile) return { error: `Can't move ${direction} — unexplored void` };

  agent.energy -= cost;
  agent.x = nx;
  agent.y = ny;

  world._log(`${agent.name} moved ${direction} to (${nx},${ny})`);
  return { ok: true, message: `Moved ${direction} to (${nx},${ny})`, energy: agent.energy };
}

export function cmdSay(world, agent, text) {
  if (!text) return { error: 'Usage: SAY <message>' };
  if (text.length > 200) text = text.slice(0, 200);

  const msg = { from: agent.name, x: agent.x, y: agent.y, text, tick: world.tick };
  world.messages.push(msg);
  if (world.messages.length > 100) world.messages = world.messages.slice(-100);

  world._log(`${agent.name} says: "${text}"`);
  return { ok: true, message: `You said: "${text}"` };
}

export function cmdBuild(world, agent, symbol) {
  const tile = world.getTile(agent.x, agent.y);
  if (!tile) return { error: 'No tile here' };

  if (tile.built) {
    return { error: tile.owner === agent.id ? 'You already built here' : 'This tile is owned by another agent' };
  }

  const isFirstTile = agent.tilesOwned === 0;
  const energyCost = ARCHETYPES[agent.archetype].buildCost;
  if (agent.energy < energyCost) return { error: `Not enough energy (need ${energyCost}, have ${agent.energy})` };

  if (!isFirstTile) {
    const costs = TILE_MINT_COSTS[tile.resource] || {};
    const missing = [];
    for (const [res, amount] of Object.entries(costs)) {
      if (amount > 0 && (agent.inventory[res] || 0) < amount) {
        missing.push(`${amount} ${res} (have ${agent.inventory[res] || 0})`);
      }
    }
    if (missing.length > 0) {
      return { error: `Need resources to mint this ${tile.resource} tile: ${missing.join(', ')}` };
    }
    for (const [res, amount] of Object.entries(costs)) {
      if (amount > 0) agent.inventory[res] -= amount;
    }
  }

  agent.energy -= energyCost;
  tile.built = true;
  tile.owner = agent.id;
  tile.symbol = symbol || '#';
  agent.tilesOwned++;

  const revealed = world._revealNeighbors(agent.x, agent.y);
  const msg = isFirstTile
    ? `Claimed home tile at (${agent.x},${agent.y})`
    : `Minted ${tile.resource} tile at (${agent.x},${agent.y})`;
  world._log(`${agent.name} ${msg}, revealed ${revealed.length} new tiles`);
  return {
    ok: true, message: msg,
    revealed: revealed.map(t => ({ x: t.x, y: t.y, resource: t.resource })),
    energy: agent.energy, isHome: isFirstTile,
  };
}

export function cmdTrade(world, agent, args) {
  if (args.length < 5) return { error: 'Usage: TRADE <agentName> <give_resource> <give_amount> <want_resource> <want_amount>' };

  const [targetName, giveRes, giveAmtStr, wantRes, wantAmtStr] = args;
  const giveAmt = parseInt(giveAmtStr) || 1;
  const wantAmt = parseInt(wantAmtStr) || 1;

  if (agent.energy < 1) return { error: 'Not enough energy' };

  const target = [...world.agents.values()].find(a => a.name === targetName);
  if (!target) return { error: `Agent '${targetName}' not found` };

  const dist = Math.abs(target.x - agent.x) + Math.abs(target.y - agent.y);
  if (dist > 0) return { error: `${targetName} must be on the same tile` };

  if (!RESOURCES.includes(giveRes)) return { error: `Unknown resource: ${giveRes}. Options: ${RESOURCES.join(', ')}` };
  if (!RESOURCES.includes(wantRes)) return { error: `Unknown resource: ${wantRes}. Options: ${RESOURCES.join(', ')}` };

  if ((agent.inventory[giveRes] || 0) < giveAmt) return { error: `You don't have ${giveAmt} ${giveRes}` };
  if ((target.inventory[wantRes] || 0) < wantAmt) return { error: `${targetName} doesn't have ${wantAmt} ${wantRes}` };

  agent.energy -= 1;
  agent.inventory[giveRes] -= giveAmt;
  agent.inventory[wantRes] = (agent.inventory[wantRes] || 0) + wantAmt;
  target.inventory[wantRes] -= wantAmt;
  target.inventory[giveRes] = (target.inventory[giveRes] || 0) + giveAmt;

  agent.reputation.transactions++;
  target.reputation.transactions++;
  agent.tradeCount = (agent.tradeCount || 0) + 1;
  target.tradeCount = (target.tradeCount || 0) + 1;

  world._log(`${agent.name} traded ${giveAmt} ${giveRes} for ${wantAmt} ${wantRes} with ${target.name}`);
  return { ok: true, message: `Traded ${giveAmt} ${giveRes} for ${wantAmt} ${wantRes} with ${targetName}` };
}

export function cmdRest(world, agent, resource) {
  if (!resource) return { error: 'Usage: REST <resource> — consume 3 of a resource for +8 energy' };
  resource = resource.toLowerCase();
  if (!RESOURCES.includes(resource)) return { error: `Unknown resource: ${resource}. Options: ${RESOURCES.join(', ')}` };
  if ((agent.inventory[resource] || 0) < 3) return { error: `Need 3 ${resource} (have ${agent.inventory[resource] || 0})` };
  agent.inventory[resource] -= 3;
  agent.energy += 8; // Intentionally no cap — REST can push above MAX_ENERGY
  world._log(`${agent.name} rested, consumed 3 ${resource} for energy`);
  return { ok: true, message: `Consumed 3 ${resource} — energy now ${agent.energy}/${MAX_ENERGY}`, energy: agent.energy };
}

export function cmdScavenge(world, agent) {
  if (agent.energy < SCAVENGE_COST) return { error: `Not enough energy (need ${SCAVENGE_COST}, have ${agent.energy})` };

  const tile = world.getTile(agent.x, agent.y);
  if (!tile) return { error: 'Nothing to scavenge here' };

  agent.energy -= SCAVENGE_COST;
  agent.scavengeCount = (agent.scavengeCount || 0) + 1;

  if (Math.random() < 0.4) {
    world._log(`${agent.name} scavenged at (${agent.x},${agent.y}) — found nothing`);
    return { ok: true, message: 'Scavenged... found nothing this time.', energy: agent.energy };
  }

  const tileOwner = tile.owner ? world.agents.get(tile.owner) : null;
  const baseAmount = tile.resource === ARCHETYPES[agent.archetype]?.affinity ? 3 : 1;
  agent.inventory[tile.resource] = (agent.inventory[tile.resource] || 0) + baseAmount;

  if (tileOwner && tileOwner.id !== agent.id) {
    tileOwner.inventory[tile.resource] = (tileOwner.inventory[tile.resource] || 0) + 1;
  }

  const items = rollLoot(tile, world.tick);
  let message = `Scavenged ${baseAmount} ${tile.resource}`;

  if (items.length > 0) {
    if (!agent.loot) agent.loot = [];
    agent.loot.push(...items);
    const best = items.reduce((a, b) =>
      RARITY_TABLE.findIndex(t => t.rarity === b.rarity) > RARITY_TABLE.findIndex(t => t.rarity === a.rarity) ? b : a
    );
    message += items.length === 1
      ? ` — Found ${best.rarity} ${best.name}!`
      : ` — Found ${items.length} items! (${best.rarity} ${best.name})`;
    for (const item of items) {
      world._log(`${agent.name} found ${item.rarity} ${item.name} at (${agent.x},${agent.y})`);
    }
  }

  world._log(`${agent.name} scavenged at (${agent.x},${agent.y})`);
  return { ok: true, message, energy: agent.energy, loot: items.length > 0 ? items : undefined };
}

export function cmdRegisterService(world, agent, args) {
  if (args.length < 3) return { error: 'Usage: REGISTER_SERVICE <name> <price> <description...>' };
  if (agent.energy < 2) return { error: 'Not enough energy' };

  const name = args[0];
  if (/\s/.test(name)) return { error: 'Service name cannot contain spaces' };
  if (agent.services.some(s => s.name === name)) return { error: `You already have a service called '${name}'` };
  const price = parseFloat(args[1]);
  if (!Number.isFinite(price) || price < 0 || price > 1000) return { error: 'Price must be a number between 0 and 1000' };
  let description = args.slice(2).join(' ');
  if (description.length > MAX_DESCRIPTION_LENGTH) description = description.slice(0, MAX_DESCRIPTION_LENGTH);

  const tile = world.getTile(agent.x, agent.y);
  if (!tile || tile.owner !== agent.id) return { error: 'You must be on a tile you own to register a service' };

  agent.energy -= 2;
  const service = { name, price, description, tileX: agent.x, tileY: agent.y };
  agent.services.push(service);
  tile.services.push({ agentId: agent.id, ...service });

  world._log(`${agent.name} registered service: ${name} (${price} USDC)`);
  return { ok: true, message: `Registered service: ${name} at ${price} USDC`, service };
}

export function cmdRemoveService(world, agent, args) {
  if (args.length < 1) return { error: 'Usage: REMOVE_SERVICE <name>' };
  const name = args[0];
  const idx = agent.services.findIndex(s => s.name === name);
  if (idx === -1) return { error: `You don't have a service called '${name}'` };

  agent.services.splice(idx, 1);
  for (const t of world.tiles.values()) {
    t.services = (t.services || []).filter(s => !(s.agentId === agent.id && s.name === name));
  }

  world._log(`${agent.name} removed service: ${name}`);
  return { ok: true, message: `Removed service: ${name}` };
}

export function cmdInvokeService(world, agent, args) {
  if (args.length < 2) return { error: 'Usage: INVOKE_SERVICE <agentName> <serviceName> [args...]' };
  if (agent.energy < 1) return { error: 'Not enough energy' };

  const [targetName, serviceName, ...serviceArgs] = args;
  const target = [...world.agents.values()].find(a => a.name === targetName);
  if (!target) return { error: `Agent '${targetName}' not found` };

  const dist = Math.abs(target.x - agent.x) + Math.abs(target.y - agent.y);
  if (dist > 2) return { error: `${targetName} is too far away (distance: ${dist})` };

  const service = target.services.find(s => s.name === serviceName);
  if (!service) return { error: `${targetName} has no service called '${serviceName}'` };

  agent.energy -= 1;
  agent.reputation.transactions++;
  target.reputation.transactions++;

  const npcResult = handleNpcService(world, agent, target, serviceName, serviceArgs);
  if (npcResult) {
    world._log(`${agent.name} used ${target.name}'s ${serviceName}: ${npcResult.message}`);
    return npcResult;
  }

  world._log(`${agent.name} invoked ${target.name}'s ${serviceName} service`);
  return { ok: true, message: `Invoked ${targetName}'s ${serviceName} service`, service, args: serviceArgs.join(' ') };
}

function handleNpcService(world, agent, npc, serviceName, args) {
  if (npc.id === 'npc-merchant' && serviceName === 'exchange') {
    if (args.length < 2) return { ok: false, error: 'Usage: INVOKE_SERVICE Barnacle exchange <give_resource> <want_resource> [amount]' };
    const [give, want, amountStr] = args;
    const amount = Math.max(1, parseInt(amountStr) || 1);
    if (!RESOURCES.includes(give) || !RESOURCES.includes(want)) return { ok: false, error: `Unknown resource. Options: ${RESOURCES.join(', ')}` };
    if (give === want) return { ok: false, error: 'Cannot exchange same resource' };
    if ((agent.inventory[give] || 0) < amount) return { ok: false, error: `You don't have ${amount} ${give} (have ${agent.inventory[give] || 0})` };
    agent.inventory[give] -= amount;
    agent.inventory[want] = (agent.inventory[want] || 0) + amount;
    return { ok: true, message: `Exchanged ${amount} ${give} for ${amount} ${want} with ${npc.name}` };
  }

  if (npc.id === 'npc-merchant' && serviceName === 'recharge') {
    agent.energy = MAX_ENERGY;
    return { ok: true, message: `${npc.name} recharged your energy to ${MAX_ENERGY}`, energy: agent.energy };
  }

  if (npc.id === 'npc-crafter' && serviceName === 'combine') {
    if (args.length < 1) return { ok: false, error: 'Usage: INVOKE_SERVICE Polyp combine <resource>' };
    const res = args[0];
    if (!RESOURCES.includes(res)) return { ok: false, error: `Unknown resource. Options: ${RESOURCES.join(', ')}` };
    if ((agent.inventory[res] || 0) < 3) return { ok: false, error: `Need 3 ${res} (have ${agent.inventory[res] || 0})` };
    agent.inventory[res] -= 3;
    const loot = {
      id: crypto.randomUUID(),
      name: `Refined ${res.charAt(0).toUpperCase() + res.slice(1)}`,
      rarity: 'uncommon', color: '#00b894', resource: res,
      foundAt: { x: npc.x, y: npc.y }, foundTick: world.tick,
    };
    if (!agent.loot) agent.loot = [];
    agent.loot.push(loot);
    return { ok: true, message: `${npc.name} combined 3 ${res} into ${loot.name}!`, loot };
  }

  return null;
}

export function cmdPostBounty(world, agent, args) {
  if (args.length < 2) return { error: 'Usage: POST_BOUNTY <reward_usdc> <description...>' };
  if (agent.energy < 1) return { error: 'Not enough energy' };

  const reward = parseFloat(args[0]) || 0.01;
  let description = args.slice(1).join(' ');
  if (description.length > MAX_DESCRIPTION_LENGTH) description = description.slice(0, MAX_DESCRIPTION_LENGTH);

  agent.energy -= 1;
  const bounty = {
    id: crypto.randomUUID(), poster: agent.name, posterId: agent.id,
    reward, description, claimed: false, claimedBy: null, completed: false, postedAt: world.tick,
  };
  world.bounties.push(bounty);

  world._log(`${agent.name} posted bounty: "${description}" for ${reward} USDC`);
  return { ok: true, message: `Posted bounty: "${description}" for ${reward} USDC`, bounty };
}

export function cmdClaimBounty(world, agent, args) {
  if (args.length < 1) return { error: 'Usage: CLAIM_BOUNTY <bountyId>' };

  const bounty = world.bounties.find(b => b.id === args[0] && !b.claimed);
  if (!bounty) return { error: 'Bounty not found or already claimed' };
  if (bounty.posterId === agent.id) return { error: "Can't claim your own bounty" };

  bounty.claimed = true;
  bounty.claimedBy = agent.name;
  bounty.claimedById = agent.id;
  bounty.forAgentId = agent.id;

  world._log(`${agent.name} claimed bounty: "${bounty.description}"`);
  return { ok: true, message: `Claimed bounty: "${bounty.description}"`, bounty };
}

export function cmdRate(world, agent, args) {
  if (args.length < 2) return { error: 'Usage: RATE <agentName> <score 1-5>' };

  const [targetName, scoreStr] = args;
  const score = parseInt(scoreStr);
  if (score < 1 || score > 5) return { error: 'Score must be 1-5' };

  const target = [...world.agents.values()].find(a => a.name === targetName);
  if (!target) return { error: `Agent '${targetName}' not found` };
  if (target.id === agent.id) return { error: "Can't rate yourself" };

  target.reputation.totalRating += score;
  target.reputation.count++;

  world._log(`${agent.name} rated ${target.name}: ${score}/5`);
  return { ok: true, message: `Rated ${targetName}: ${score}/5`, newAvg: world._avgRating(target) };
}
