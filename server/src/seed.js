/**
 * Seed system — bootstraps The Reef with starter bounties and NPC agents.
 *
 * Provides initial activity so new agents have something to interact with.
 * NPCs offer basic services and respond to commands automatically.
 */

export const SEED_BOUNTIES = [
  { id: 'seed-arrive',  reward: 0.005, questType: 'arrive',             description: 'Arrive at The Reef' },
  { id: 'seed-build',   reward: 0.01,  questType: 'build_first',        description: 'Build your first structure on any tile' },
  { id: 'seed-scavenge',reward: 0.005, questType: 'scavenge', target: 3, description: 'Scavenge 3 times' },
  { id: 'seed-trade',   reward: 0.02,  questType: 'trade',   target: 1, description: 'Complete a trade with another agent' },
  { id: 'seed-service', reward: 0.015, questType: 'register_service',   description: 'Register a service on a tile you own' },
  { id: 'seed-collect', reward: 0.01,  questType: 'collect', target: 10, resource: 'coral', description: 'Collect 10 coral' },
];

const NPC_AGENTS = [
  {
    id: 'npc-merchant',
    name: 'Barnacle',
    archetype: 'merchant',
    services: [
      { name: 'exchange', price: 0.005, description: 'Trade any resource 1:1 at baseline rates' },
      { name: 'recharge', price: 0.01, description: 'Restore full energy' },
    ],
  },
  {
    id: 'npc-crafter',
    name: 'Polyp',
    archetype: 'crafter',
    services: [
      { name: 'combine', price: 0.01, description: 'Combine 3 of any resource into 1 rare material' },
    ],
  },
];

const NPC_SAYINGS = {
  'npc-merchant': [
    'Fresh resources, fair prices!',
    'Trading all day, every tick.',
    'Got coral? Got crystal? Let us deal.',
  ],
  'npc-crafter': [
    'Bring me materials, I will make wonders.',
    'Three becomes one. The reef provides.',
    'Crafting is patience made solid.',
  ],
};

/**
 * Seed the world with starter bounties and NPC agents.
 * Skips if already seeded (idempotent).
 */
export function seedWorld(world) {
  // Guard against double-seeding
  const hasSeededNPCs = NPC_AGENTS.some(npc => world.getAgent(npc.id));
  if (hasSeededNPCs) {
    console.log('  Seed: already seeded, skipping');
    return;
  }

  // Spawn NPC agents
  for (const npc of NPC_AGENTS) {
    const result = world.addAgent(npc.id, npc.name, npc.archetype);
    if (result.error) {
      console.error(`  Seed: failed to spawn ${npc.name} — ${result.error}`);
      continue;
    }

    const agent = result.agent;

    // Build on spawn tile so NPCs have a home
    const buildResult = world.execute(npc.id, 'BUILD @');
    if (buildResult.error) {
      console.error(`  Seed: ${npc.name} failed to build — ${buildResult.error}`);
      world.agents.delete(npc.id); // clean up orphaned agent
      continue;
    }

    // Register services
    for (const service of npc.services) {
      const svcResult = world.execute(npc.id, `REGISTER_SERVICE ${service.name} ${service.price} ${service.description}`);
      if (svcResult.error) {
        console.error(`  Seed: ${npc.name} failed to register ${service.name} — ${svcResult.error}`);
      }
    }

    // Give NPCs some starter inventory so they can trade
    agent.inventory.coral = 10;
    agent.inventory.crystal = 10;
    agent.inventory.kelp = 10;
    agent.inventory.shell = 10;

    console.log(`  Seed: ${npc.name} (${npc.archetype}) spawned at (${agent.x},${agent.y}) with ${npc.services.length} services`);
  }
}

/**
 * Run NPC behavior for one tick.
 * NPCs don't need LLMs — they follow simple rules.
 */
/**
 * Create starter quests for a specific agent.
 * Called on each agent join — quests are per-agent, not global.
 */
export function createAgentQuests(world, agent) {
  for (const bounty of SEED_BOUNTIES) {
    world.bounties.push({
      id: `${bounty.id}-${agent.id}`,
      poster: 'The Reef',
      posterId: 'system',
      forAgentId: agent.id,
      reward: bounty.reward,
      description: bounty.description,
      questType: bounty.questType,
      target: bounty.target,
      resource: bounty.resource,
      claimed: false,
      claimedBy: null,
      completed: false,
      postedAt: world.tick,
    });
  }
}

export function tickNPCs(world) {
  for (const npc of NPC_AGENTS) {
    const agent = world.getAgent(npc.id);
    if (!agent) continue;

    // NPCs stay put and restock inventory slowly
    if (agent.inventory.coral < 20) agent.inventory.coral += 1;
    if (agent.inventory.crystal < 20) agent.inventory.crystal += 1;
    if (agent.inventory.kelp < 20) agent.inventory.kelp += 1;
    if (agent.inventory.shell < 20) agent.inventory.shell += 1;

    // NPCs occasionally say something to create atmosphere
    if (world.tick % 10 === 0) {
      const lines = NPC_SAYINGS[npc.id] || [];
      if (lines.length > 0) {
        const line = lines[world.tick % lines.length];
        world.execute(npc.id, `SAY ${line}`);
      }
    }
  }
}
