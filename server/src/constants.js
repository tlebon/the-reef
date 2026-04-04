/**
 * Shared constants for The Reef world engine.
 */

export const RESOURCES = ['coral', 'crystal', 'kelp', 'shell'];

export const ARCHETYPES = {
  builder:  { affinity: 'coral',   buildCost: 2, moveCost: 1, description: 'Efficient construction, structural bonuses' },
  merchant: { affinity: 'shell',   buildCost: 3, moveCost: 1, description: 'Better trade rates, price negotiation' },
  scout:    { affinity: 'kelp',    buildCost: 3, moveCost: 0, description: 'Faster movement, exploration, bounty specialist' },
  crafter:  { affinity: 'crystal', buildCost: 3, moveCost: 1, description: 'Combines resources into advanced materials' },
};

export const MAX_ENERGY = 20;
export const ENERGY_REGEN = 5;
export const BASE_BUILD_CAP = 5;

export const TILE_MINT_COSTS = {
  coral:   { coral: 3, crystal: 2, kelp: 0, shell: 1 },
  crystal: { coral: 1, crystal: 3, kelp: 2, shell: 0 },
  kelp:    { coral: 0, crystal: 1, kelp: 3, shell: 2 },
  shell:   { coral: 2, crystal: 0, kelp: 1, shell: 3 },
};

export const RARITY_TABLE = [
  { rarity: 'common',    chance: 0.50, color: '#8892a4' },
  { rarity: 'uncommon',  chance: 0.08, color: '#00b894' },
  { rarity: 'rare',      chance: 0.005, color: '#a29bfe' },
  { rarity: 'legendary', chance: 0.001, color: '#fdcb6e' },
];

export const LOOT_NAMES = {
  coral:   ['Coral Shard', 'Reef Fragment', 'Polyp Bloom', 'Abyssal Coral'],
  crystal: ['Crystal Splinter', 'Prism Dust', 'Geode Heart', 'Void Crystal'],
  kelp:    ['Kelp Strand', 'Sea Vine', 'Drift Seed', 'Leviathan Kelp'],
  shell:   ['Shell Chip', 'Nautilus Ring', 'Conch Echo', 'Ancient Shell'],
};

export const RANDOM_QUEST_TEMPLATES = [
  { desc: 'Trade with {amount} different agents', type: 'trade' },
  { desc: 'Collect {amount} {resource}', type: 'collect' },
  { desc: 'Scavenge {amount} times', type: 'scavenge' },
];
