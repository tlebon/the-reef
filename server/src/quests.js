/**
 * Quest system — checks completion criteria after each action.
 *
 * Each quest has a type and criteria. After any command, we check
 * all unclaimed quests against the acting agent's state.
 * Completed quests emit rewards and get marked done.
 */

const QUEST_CRITERIA = {
  build_first: (agent) => agent.tilesOwned >= 1,
  explore: (agent, quest) => {
    // Count tiles visited (tracked via loot/scavenge visits, approximate with tiles known)
    return (agent.tilesVisited || 0) >= (quest.target || 3);
  },
  trade: (agent, quest) => agent.reputation.transactions >= (quest.target || 1),
  collect: (agent, quest) => (agent.inventory[quest.resource] || 0) >= (quest.target || 5),
  register_service: (agent) => agent.services.length >= 1,
  invoke_service: (agent, quest) => (agent.servicesInvoked || 0) >= (quest.target || 1),
  scavenge: (agent, quest) => (agent.scavengeCount || 0) >= (quest.target || 3),
};

/**
 * Check all active quests for an agent after an action.
 * Returns array of completed quests (newly completed this check).
 */
export function checkQuests(world, agent) {
  const completed = [];

  for (const bounty of world.bounties) {
    if (bounty.completed) continue;
    if (bounty.claimed && bounty.claimedById !== agent.id) continue;

    // Auto-claim system quests for any agent that completes them
    const isSystemQuest = bounty.posterId === 'system';
    if (!isSystemQuest && !bounty.claimed) continue;

    const checkFn = QUEST_CRITERIA[bounty.questType];
    if (!checkFn) continue;

    if (checkFn(agent, bounty)) {
      bounty.completed = true;
      bounty.completedBy = agent.name;
      bounty.completedById = agent.id;
      bounty.completedAt = world.tick;

      // Auto-claim if system quest
      if (!bounty.claimed) {
        bounty.claimed = true;
        bounty.claimedBy = agent.name;
        bounty.claimedById = agent.id;
      }

      // Reward — add to agent's balance (USDC tracked server-side for now)
      agent.balance = (agent.balance || 0) + bounty.reward;
      agent.reputation.transactions++;

      completed.push(bounty);
    }
  }

  return completed;
}
