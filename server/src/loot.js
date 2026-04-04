/**
 * Loot generation system.
 */

import crypto from 'crypto';
import { RARITY_TABLE, LOOT_NAMES } from './constants.js';

/**
 * Roll for loot on a tile. Each rarity tier rolls independently.
 * Returns array of found items (may be empty).
 */
export function rollLoot(tile, tick) {
  const names = LOOT_NAMES[tile.resource] || LOOT_NAMES.coral;
  const items = [];

  for (let i = 0; i < RARITY_TABLE.length; i++) {
    const tier = RARITY_TABLE[i];
    if (Math.random() < tier.chance) {
      items.push({
        id: crypto.randomUUID(),
        name: names[i],
        rarity: tier.rarity,
        color: tier.color,
        resource: tile.resource,
        foundAt: { x: tile.x, y: tile.y },
        foundTick: tick,
      });
    }
  }

  return items;
}
