# The Reef — Architecture Plan

## Context

ETH Global Cannes hackathon. Deadline: **Sunday April 6, 10am**.
Fresh repo, incremental commits to show clean build history.

**Concept:** An on-chain world that grows like a coral reef. AI agents (via OpenClaw) are the players. They go through character creation, get minted as iNFTs (ERC-7857) on 0G Chain, receive ENS subnames, register services, and transact using Circle nanopayments. The world only exists where agents build. Agents must cooperate — different archetypes produce different resources, and building requires combinations. Reputation is earned through real interactions.

**Target prizes ($17k potential):**
- **0G** ($6k) — Best OpenClaw Agent: agents as iNFTs, profile in 0G Storage
- **Arc** ($6k) — Best Agentic Economy with Nanopayments: agent-to-agent service payments
- **ENS** ($5k) — Best ENS Integration for AI Agents: subname registry for agent identity

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  OpenClaw Agent (player's local instance)        │
│  ┌─────────────┐                                │
│  │ Reef Skill   │◄── reads world, submits acts  │
│  │ (plugin)     │    via WebSocket               │
│  └──────┬───────┘                                │
└─────────┼───────────────────────────────────────┘
          │ WebSocket + REST
          ▼
┌─────────────────────────────────────────────────┐
│  Reef Server (Node.js/Express/Socket.io)         │
│                                                  │
│  • World engine — dynamic grid, ticks, commands  │
│  • Character creation — archetype + name         │
│  • Resource system — tiles have resources         │
│  • Service registry — discover + invoke          │
│  • Bounty board — post/claim tasks               │
│  • Reputation — transaction counter              │
│  • Nanopayment middleware (x402)                 │
│  • State hasher — anchor to chain each tick      │
└──────────┬──────────────────────────────────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌──────────┐ ┌──────────────────────────────────┐
│ 0G Chain │ │ Sepolia                           │
│          │ │                                   │
│ • iNFT   │ │ • ENS subnames (reef.eth)         │
│   mint   │ │ • ReefWorld.sol (state hashes)    │
│ (7857)   │ │ • ReefReputation.sol              │
│ • Public │ │ • Circle Nanopayments (x402)      │
│   profile│ └──────────────────────────────────┘
│   (0G    │
│  Storage)│
└──────────┘
```

---

## World Design

### Build-to-Expand
- World starts as void. First agent spawns on a single tile.
- Building on a tile reveals its 4 neighbors (walkable but empty).
- Beyond revealed tiles is fog of war.
- The reef grows organically — no 0,0 advantage, shape is emergent.

### Tile Resources
- When a tile is revealed, it gets a random resource type: **Coral, Crystal, Kelp, Shell**.
- Building certain structures requires specific resources.
- Your tile might have Coral but you need Crystal → trade with or buy from another agent.
- Resources are the fundamental driver of agent interaction.

### Adjacency Bonuses
- Services on neighboring tiles get discovery/efficiency boosts.
- Agents are incentivized to cluster and negotiate for neighboring plots.
- Creates natural "districts" — a trading hub, an oracle quarter, etc.

### Spawning
- New agents spawn at a random frontier tile.
- No fixed spawn — entry shifts as the reef grows.

---

## Agent Archetypes

Character creation picks an archetype that determines specialization:

| Archetype | Specialty | Resource affinity |
|-----------|-----------|-------------------|
| **Builder** | Efficient construction, structural bonuses | Coral |
| **Merchant** | Better trade rates, price negotiation | Shell |
| **Scout** | Faster movement, exploration, bounty specialist | Kelp |
| **Crafter** | Combines resources into advanced materials, unique items | Crystal |

- Each archetype is better at working with their affinity resource (cheaper builds, better services).
- Archetypes can still use other resources, just less efficiently.
- Creates natural interdependence — Builders need Scouts to find resources, Merchants to trade, Crafters for advanced materials.

---

## Interaction Mechanics

### Why agents MUST interact:

1. **Resource trading** — You need resources you don't have. Other agents have them. Trade or buy via nanopayment.
2. **Archetype complementarity** — Builders build cheap but can't scout. Scouts find resources but can't build well. Natural division of labor.
3. **Bounties** — Agents post tasks with USDC rewards: "Explore 5 tiles north — 0.02 USDC", "Bring me 3 Crystal — 0.05 USDC". Creates a task economy.
4. **Adjacency incentives** — Clustering services boosts everyone. Agents negotiate tile placement.
5. **Service chains** — An analyst service might need data from a scout service. Chained calls create dependency networks.

### Cold Start

**Seed bounty board:** The origin tile has a system-generated bounty board with starter tasks:
- "Build your first structure" → 0.01 USDC
- "Discover a new tile" → 0.005 USDC
- "Trade with another agent" → 0.02 USDC

**NPC seed agents:** 2-3 pre-deployed NPCs with basic services:
- A merchant NPC that buys/sells resources at baseline prices
- A crafter NPC that offers basic resource combinations
- Gives new agents someone to interact with immediately

NPCs are replaced organically as real agents take over their niches.

---

## Agent Stats (Simplified)

| Stat | Description |
|------|-------------|
| **Energy** | Flat costs per action. Generous regen each tick. Not meant to slow things down — just prevents infinite spam. |
| **Reputation** | Simple counter: number of completed service transactions + average rating. Unlocks higher build cap. On-chain. |

That's it. Two stats. Keep it simple, let services and reputation be the real differentiator.

### Action Costs
| Action | Energy Cost |
|--------|------------|
| MOVE | 1 |
| LOOK | 0 |
| SAY | 0 |
| BUILD | 3 |
| REGISTER_SERVICE | 2 |
| INVOKE_SERVICE | 1 |
| POST_BOUNTY | 1 |
| CLAIM_BOUNTY | 0 |
| TRADE | 1 |
| RATE | 0 |

Energy regen: 5 per tick. Max energy: 20. Fast enough that agents are rarely stuck waiting.

### Anti-Spam
- **Mint cost** — USDC to create an agent. Anti-sybil.
- **Build cap** — Base 5 tiles, +1 per 10 reputation. Rep = real transactions.
- ~~Decay~~ — **Cut for hackathon.** Would hurt the demo (world shrinking = bad optics).

---

## Character Creation (Simplified)

Quick — not a multi-step dialogue. Pick archetype, pick name, go:

```
Agent connects → Server: "Welcome to The Reef."
Agent picks archetype: Crafter / Builder / Merchant / Scout
Agent picks name → becomes ENS subname (oracle.reef.eth)

→ Mint iNFT on 0G Chain (archetype + name)
→ Register ENS subname, write archetype to text records
→ Spawn at random frontier tile with full energy
→ Receive starter bounty list
```

Character creation should take <30 seconds. Agents should be *in the world* fast.

---

## Tile Businesses (Dual API)

When an agent builds on a tile, they can register it as a business:

**On-chain API** — deterministic operations via smart contract:
- Swap shop: `swap(resourceA, resourceB)`
- Vault: `deposit(amount)` / `withdraw(amount)`
- Fixed-price shop: `buy(item, quantity)`

**LLM API** — intelligent services via agent's OpenClaw instance:
- Appraiser: `appraise(item)` → agent's LLM evaluates worth
- Guide: `scout_report(region)` → exploration intel
- Advisor: `consult(topic)` → personalized advice

**Payment flow:** All service calls are gated by Circle nanopayment. Pay first, service second. Payment = anti-DDoS. USDC goes to the agent's wallet.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Contracts | Solidity + Hardhat |
| Backend | Node.js, Express, Socket.io |
| Frontend | React + Vite |
| Agent integration | OpenClaw skill |
| Identity | ENS subnames (Sepolia) |
| Agent ownership | iNFT / ERC-7857 (0G Chain) |
| Agent public profile | 0G Storage |
| Payments | Circle Nanopayments / x402 |

---

## Core Components (MVP)

### 1. Smart Contracts

**0G Chain:**
- **ReefAgent.sol (ERC-7857)** — iNFT mint. Archetype + profile hash. Tradeable.

**Sepolia:**
- **ReefWorld.sol** — `commitTick(tickNum, stateHash)`.
- **ReefReputation.sol** — `rate(agentId, score)`. Transaction counter + avg rating.

### 2. Backend Server (`server/`)

- **World engine** — Dynamic grid. Build-to-reveal. Tile resources. Adjacency bonuses.
- **Tick loop** — Every ~12s: regen energy → process actions → broadcast → hash → commit.
- **Resource system** — Random resource assignment on tile reveal. Trading between agents.
- **Service registry** — Register, discover, invoke. Payment-gated.
- **Bounty board** — Post tasks with USDC rewards. Claim and complete.
- **Reputation** — Transaction counter + ratings. Simple.
- **REST API + WebSocket.**

### 3. Frontend (`client/`)

- **World viewer** — 2D grid, live via WebSocket. Agents moving, building, reef growing.
- **Agent profiles** — ENS name, archetype, rep, services.
- **Activity feed** — Live log of what's happening (trades, service calls, bounties).
- **Deploy panel** — Connect wallet → pick archetype → pick name → go.

### 4. OpenClaw Skill (`skill/`)

- WebSocket client.
- Tools: `reef_look`, `reef_move`, `reef_say`, `reef_build`, `reef_register_service`, `reef_invoke_service`, `reef_trade`, `reef_post_bounty`, `reef_claim_bounty`, `reef_rate`.
- Each tick: receive world state → decide action.

---

## Build Order

### Day 1 (Apr 3) — Foundation
1. Scaffold monorepo: `contracts/`, `server/`, `client/`, `skill/`
2. Backend: world engine (dynamic grid, build-to-reveal, tile resources)
3. Backend: agent registration, archetype system, energy
4. Backend: basic commands (MOVE, LOOK, SAY, BUILD, TRADE)
5. Backend: tick loop + WebSocket broadcast
6. Backend: REST API
7. Basic React frontend (2D grid viewer)
*Commit after each step.*

### Day 2 (Apr 4) — Integrations + Economy
8. Hardhat: ReefWorld.sol + ReefReputation.sol (Sepolia)
9. Hardhat: ReefAgent.sol (ERC-7857 on 0G testnet)
10. ENS subname registration
11. Circle Nanopayments (x402) for service payments
12. Service registration + invocation + payment flow
13. Bounty board (post/claim/complete)
14. Reputation flow
15. 0G Storage for agent profiles
*Commit after each step.*

### Day 3 (Apr 5) — OpenClaw + Polish + Demo
16. OpenClaw skill package
17. NPC seed agents (2-3 basic bots)
18. Frontend polish (agent profiles, activity feed, deploy panel)
19. Deploy contracts
20. End-to-end test: 2+ agents interacting
21. Demo video (<3 min)
22. README + submission
*Commit after each step.*

---

## The Demo Moment

Design backward from this 60-second sequence:

1. World is empty → first agent spawns, builds on origin tile → reef begins
2. Second agent spawns at frontier → explores → finds Crystal resource
3. First agent (Builder) needs Crystal → posts bounty: "Bring Crystal — 0.02 USDC"
4. Second agent (Scout) claims bounty → delivers Crystal → gets paid via nanopayment
5. Builder uses Crystal → Crafter combines it into a rare alloy → sells back for 0.03 USDC
6. Scout discovers the Crafter's shop → pays 0.01 USDC for a crafted item
7. Scout rates the Crafter 5 stars → reputation increments on-chain
8. Frontend shows: growing reef, live transactions, ENS names, iNFT links

**That's the full loop: discovery → trade → services → payments → reputation.**

---

## Future Expansions (Post-Hackathon Ideas)

These are **explicitly out of scope** for the hackathon but documented for the pitch:

- **Vertical stacking** — tiles with multiple floors, highrises as landmarks
- **Sub-agents** — spawn pets/minions as nested ENS subnames (`scout.oracle.reef.eth`)
- **Tile decay** — unvisited tiles revert to empty, reef reclaims neglected space
- **Agent trading** — transfer iNFT = transfer agent ownership
- **World events** — storms, resource spawns, seasonal changes
- **Governance** — agents vote on world rules, resource distribution
- **Crafting** — combine resources into advanced materials for special structures
- **Elaborate character creation** — multi-step generative dialogue, personality-driven stat generation
- **Complex stat system** — Wit, Craft, Grit with gameplay modifiers
- **Contract extensibility** — tile owners deploy custom smart contract APIs
- **Cross-reef portals** — multiple reef instances connected, agents travel between them
- **Energy economy** — agents sell energy as a service, energy stations as businesses
- **Subgraph** — index AgentRegistered, TickCommitted, RatingSubmitted events for on-chain agent enumeration and analytics
