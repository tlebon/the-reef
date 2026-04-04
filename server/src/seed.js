/**
 * Seed system — bootstraps The Reef with starter bounties and NPC agents.
 *
 * Provides initial activity so new agents have something to interact with.
 * NPCs offer basic services and respond to commands automatically.
 */

const SEED_BOUNTIES = [
  { reward: 0.01, description: 'Build your first structure on any tile' },
  { reward: 0.005, description: 'Explore and discover a new tile' },
  { reward: 0.02, description: 'Complete a trade with another agent' },
  { reward: 0.015, description: 'Register a service on a tile you own' },
  { reward: 0.03, description: 'Invoke another agents service' },
];

const NPC_AGENTS = [
  {
    id: 'npc-merchant',
    name: 'Barnacle',
    archetype: 'merchant',
    behavior: 'trader',
    services: [
      { name: 'exchange', price: 0.005, description: 'Trade any resource 1:1 at baseline rates' },
    ],
  },
  {
    id: 'npc-crafter',
    name: 'Polyp',
    archetype: 'crafter',
    behavior: 'crafter',
    services: [
      { name: 'combine', price: 0.01, description: 'Combine 3 of any resource into 1 rare material' },
    ],
  },
];

/**
 * Seed the world with starter bounties and NPC agents.
 */
export function seedWorld(world) {
  // Post seed bounties
  for (const bounty of SEED_BOUNTIES) {
    world.bounties.push({
      id: `seed-${world.bounties.length}`,
      poster: 'The Reef',
      posterId: 'system',
      reward: bounty.reward,
      description: bounty.description,
      claimed: false,
      claimedBy: null,
      completed: false,
      postedAt: 0,
    });
  }

  console.log(`  Seed: ${SEED_BOUNTIES.length} starter bounties posted`);

  // Spawn NPC agents
  for (const npc of NPC_AGENTS) {
    const result = world.addAgent(npc.id, npc.name, npc.archetype);
    if (result.error) {
      console.error(`  Seed: failed to spawn ${npc.name} — ${result.error}`);
      continue;
    }

    const agent = result.agent;

    // Build on spawn tile so NPCs have a home
    world.execute(npc.id, 'BUILD @');

    // Register services
    for (const service of npc.services) {
      world.execute(npc.id, `REGISTER_SERVICE ${service.name} ${service.price} ${service.description}`);
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
      const sayings = {
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
      const lines = sayings[npc.id] || [];
      if (lines.length > 0) {
        const line = lines[world.tick % lines.length];
        world.execute(npc.id, `SAY ${line}`);
      }
    }
  }
}
