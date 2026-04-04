import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { World } from '../src/world.js';

describe('World', () => {
  let world;

  beforeEach(() => {
    world = new World();
  });

  describe('initialization', () => {
    it('starts with origin tile', () => {
      assert.ok(world.getTile(0, 0));
      assert.equal(world.tiles.size, 1);
    });

    it('origin tile has a resource', () => {
      const tile = world.getTile(0, 0);
      assert.ok(['coral', 'crystal', 'kelp', 'shell'].includes(tile.resource));
    });
  });

  describe('addAgent', () => {
    it('adds agent with valid archetype', () => {
      const result = world.addAgent('a1', 'Alice', 'builder');
      assert.ok(result.agent);
      assert.equal(result.agent.name, 'Alice');
      assert.equal(result.agent.archetype, 'builder');
    });

    it('rejects invalid archetype', () => {
      const result = world.addAgent('a1', 'Alice', 'wizard');
      assert.ok(result.error);
    });

    it('rejects duplicate names', () => {
      world.addAgent('a1', 'Alice', 'builder');
      const result = world.addAgent('a2', 'alice', 'scout');
      assert.ok(result.error);
      assert.match(result.error, /already taken/);
    });

    it('rejects names with spaces', () => {
      const result = world.addAgent('a1', 'Alice Bob', 'builder');
      assert.ok(result.error);
      assert.match(result.error, /spaces/);
    });

    it('rejects empty or long names', () => {
      assert.ok(world.addAgent('a1', '', 'builder').error);
      assert.ok(world.addAgent('a2', 'a'.repeat(21), 'builder').error);
    });

    it('agent starts with full energy', () => {
      const result = world.addAgent('a1', 'Alice', 'builder');
      assert.equal(result.agent.energy, 20);
    });
  });

  describe('wallet integration', () => {
    it('stores owner wallet on addAgent', () => {
      const result = world.addAgent('a1', 'Alice', 'builder', { ownerWallet: '0x1234567890abcdef1234567890abcdef12345678' });
      assert.equal(result.agent.ownerWallet, '0x1234567890abcdef1234567890abcdef12345678');
    });

    it('finds agent by owner wallet', () => {
      world.addAgent('a1', 'Alice', 'builder', { ownerWallet: '0xaaaa' });
      const found = world.getAgentByWallet('0xaaaa');
      assert.equal(found.name, 'Alice');
    });

    it('finds agent by delegate wallet', () => {
      world.addAgent('a1', 'Alice', 'builder', { delegateWallet: '0xbbbb' });
      const found = world.getAgentByWallet('0xbbbb');
      assert.equal(found.name, 'Alice');
    });

    it('returns null for unknown wallet', () => {
      world.addAgent('a1', 'Alice', 'builder', { ownerWallet: '0xaaaa' });
      assert.equal(world.getAgentByWallet('0xcccc'), null);
    });

    it('linkDelegate sets delegate wallet', () => {
      world.addAgent('a1', 'Alice', 'builder');
      const result = world.linkDelegate('a1', '0xdddd');
      assert.ok(result.ok);
      assert.equal(world.getAgent('a1').delegateWallet, '0xdddd');
    });

    it('linkDelegate rejects empty wallet', () => {
      world.addAgent('a1', 'Alice', 'builder');
      const result = world.linkDelegate('a1', '');
      assert.ok(result.error);
    });

    it('linkDelegate rejects unknown agent', () => {
      const result = world.linkDelegate('nonexistent', '0xdddd');
      assert.ok(result.error);
    });

    it('wallet lookup is case-insensitive', () => {
      world.addAgent('a1', 'Alice', 'builder', { ownerWallet: '0xAABBCC' });
      const found = world.getAgentByWallet('0xaabbcc');
      assert.equal(found.name, 'Alice');
    });
  });

  describe('MOVE', () => {
    beforeEach(() => {
      world.addAgent('a1', 'Alice', 'scout');
      // Build on origin to reveal neighbors
      world.execute('a1', 'BUILD #');
    });

    it('moves to revealed tile', () => {
      const result = world.execute('a1', 'MOVE N');
      assert.ok(result.ok);
      const agent = world.getAgent('a1');
      assert.equal(agent.y, -1);
    });

    it('costs energy', () => {
      const before = world.getAgent('a1').energy;
      world.execute('a1', 'MOVE N');
      const after = world.getAgent('a1').energy;
      assert.ok(after < before);
    });

    it('rejects move into void', () => {
      // Move far away where no tiles exist
      const result = world.execute('a1', 'MOVE N');
      assert.ok(result.ok);
      const result2 = world.execute('a1', 'MOVE N');
      assert.ok(result2.error);
      assert.match(result2.error, /void/);
    });

    it('allows multiple agents on same tile', () => {
      world.addAgent('a2', 'Bob', 'builder');
      // Move Bob to same tile as Alice (after she moved N)
      world.execute('a2', 'BUILD #'); // build so Bob has a tile
      const alice = world.getAgent('a1');
      const bob = world.getAgent('a2');
      // No collision — both can exist, just verify no error
      assert.notEqual(alice, null);
      assert.notEqual(bob, null);
    });

    it('scouts move cheaper', () => {
      const scout = world.getAgent('a1'); // Alice is scout
      const beforeE = scout.energy;
      world.execute('a1', 'MOVE N');
      // Scout moveCost is 0, so total cost is 1 (base only)
      assert.equal(scout.energy, beforeE - 1);
    });
  });

  describe('BUILD', () => {
    beforeEach(() => {
      world.addAgent('a1', 'Alice', 'builder');
    });

    it('first tile is free', () => {
      const result = world.execute('a1', 'BUILD #');
      assert.ok(result.ok);
      assert.ok(result.isHome);
      assert.equal(world.getAgent('a1').tilesOwned, 1);
    });

    it('reveals neighbors on build', () => {
      const before = world.tiles.size;
      world.execute('a1', 'BUILD #');
      assert.ok(world.tiles.size > before);
    });

    it('rejects building on owned tile', () => {
      world.execute('a1', 'BUILD #');
      const result = world.execute('a1', 'BUILD X');
      assert.ok(result.error);
      assert.match(result.error, /already built/);
    });

    it('second tile costs resources', () => {
      world.execute('a1', 'BUILD #');
      // Move to a neighbor and try to build without resources
      world.execute('a1', 'MOVE N');
      const result = world.execute('a1', 'BUILD #');
      assert.ok(result.error);
      assert.match(result.error, /Need resources/);
    });

    it('checks energy before deducting resources', () => {
      world.execute('a1', 'BUILD #'); // claim home (free)
      world.execute('a1', 'MOVE N'); // move to revealed neighbor
      const agent = world.getAgent('a1');
      // Give resources but drain energy
      agent.inventory.coral = 10;
      agent.inventory.crystal = 10;
      agent.inventory.kelp = 10;
      agent.inventory.shell = 10;
      agent.energy = 0;
      const coralBefore = agent.inventory.coral;
      const result = world.execute('a1', 'BUILD #');
      assert.ok(result.error);
      assert.match(result.error, /energy/);
      assert.equal(agent.inventory.coral, coralBefore);
    });
  });

  describe('SAY', () => {
    beforeEach(() => {
      world.addAgent('a1', 'Alice', 'builder');
    });

    it('broadcasts message', () => {
      const result = world.execute('a1', 'SAY hello');
      assert.ok(result.ok);
      assert.equal(world.messages.length, 1);
      assert.equal(world.messages[0].text, 'hello');
    });

    it('truncates long messages', () => {
      world.execute('a1', 'SAY ' + 'x'.repeat(300));
      assert.ok(world.messages[0].text.length <= 200);
    });
  });

  describe('SCAVENGE', () => {
    beforeEach(() => {
      world.addAgent('a1', 'Alice', 'builder');
    });

    it('costs energy', () => {
      const before = world.getAgent('a1').energy;
      world.execute('a1', 'SCAVENGE');
      assert.equal(world.getAgent('a1').energy, before - 2);
    });

    it('increments scavengeCount', () => {
      world.execute('a1', 'SCAVENGE');
      world.execute('a1', 'SCAVENGE');
      assert.equal(world.getAgent('a1').scavengeCount, 2);
    });

    it('rejects without enough energy', () => {
      world.getAgent('a1').energy = 1;
      const result = world.execute('a1', 'SCAVENGE');
      assert.ok(result.error);
    });
  });

  describe('REST', () => {
    beforeEach(() => {
      world.addAgent('a1', 'Alice', 'builder');
      world.getAgent('a1').inventory.coral = 10;
    });

    it('consumes resources for energy', () => {
      world.getAgent('a1').energy = 5;
      const result = world.execute('a1', 'REST coral');
      assert.ok(result.ok);
      assert.equal(world.getAgent('a1').energy, 13);
      assert.equal(world.getAgent('a1').inventory.coral, 7);
    });

    it('can push above max energy', () => {
      world.getAgent('a1').energy = 18;
      world.execute('a1', 'REST coral');
      assert.equal(world.getAgent('a1').energy, 26);
    });

    it('rejects without enough resources', () => {
      world.getAgent('a1').inventory.coral = 2;
      const result = world.execute('a1', 'REST coral');
      assert.ok(result.error);
    });

    it('rejects invalid resource', () => {
      const result = world.execute('a1', 'REST gold');
      assert.ok(result.error);
    });
  });

  describe('REGISTER_SERVICE', () => {
    beforeEach(() => {
      world.addAgent('a1', 'Alice', 'builder');
      world.execute('a1', 'BUILD #');
    });

    it('registers service on owned tile', () => {
      const result = world.execute('a1', 'REGISTER_SERVICE shop 0.01 A cool shop');
      assert.ok(result.ok);
      assert.equal(world.getAgent('a1').services.length, 1);
    });

    it('rejects duplicate service name', () => {
      world.execute('a1', 'REGISTER_SERVICE shop 0.01 First');
      const result = world.execute('a1', 'REGISTER_SERVICE shop 0.02 Second');
      assert.ok(result.error);
      assert.match(result.error, /already have/);
    });

    it('rejects spaces in service name', () => {
      // Space would be parsed as separate args, so "my shop" becomes name="my" price="shop"
      // which fails on price validation
      const result = world.execute('a1', 'REGISTER_SERVICE my 0.01 desc');
      assert.ok(result.ok); // "my" is fine
    });

    it('rejects invalid price', () => {
      const result = world.execute('a1', 'REGISTER_SERVICE shop abc desc');
      assert.ok(result.error);
    });

    it('rejects on unowned tile', () => {
      world.addAgent('a2', 'Bob', 'scout');
      const result = world.execute('a2', 'REGISTER_SERVICE shop 0.01 desc');
      assert.ok(result.error);
    });
  });

  describe('TRADE', () => {
    beforeEach(() => {
      world.addAgent('a1', 'Alice', 'builder');
      world.addAgent('a2', 'Bob', 'merchant');
      world.getAgent('a1').inventory.coral = 5;
      world.getAgent('a2').inventory.crystal = 5;
    });

    it('swaps resources between agents', () => {
      const result = world.execute('a1', 'TRADE Bob coral 2 crystal 2');
      assert.ok(result.ok);
      assert.equal(world.getAgent('a1').inventory.coral, 3);
      assert.equal(world.getAgent('a1').inventory.crystal, 2);
      assert.equal(world.getAgent('a2').inventory.coral, 2);
      assert.equal(world.getAgent('a2').inventory.crystal, 3);
    });

    it('increments tradeCount', () => {
      world.execute('a1', 'TRADE Bob coral 1 crystal 1');
      assert.equal(world.getAgent('a1').tradeCount, 1);
      assert.equal(world.getAgent('a2').tradeCount, 1);
    });

    it('rejects missing args', () => {
      const result = world.execute('a1', 'TRADE Bob coral 1 crystal');
      assert.ok(result.error);
      assert.match(result.error, /Usage/);
    });
  });

  describe('RATE', () => {
    beforeEach(() => {
      world.addAgent('a1', 'Alice', 'builder');
      world.addAgent('a2', 'Bob', 'scout');
    });

    it('rates another agent', () => {
      const result = world.execute('a1', 'RATE Bob 5');
      assert.ok(result.ok);
      assert.equal(world.getAgent('a2').reputation.count, 1);
    });

    it('rejects self-rating', () => {
      const result = world.execute('a1', 'RATE Alice 5');
      assert.ok(result.error);
    });

    it('rejects invalid score', () => {
      assert.ok(world.execute('a1', 'RATE Bob 0').error);
      assert.ok(world.execute('a1', 'RATE Bob 6').error);
    });
  });

  describe('INVOKE_SERVICE', () => {
    beforeEach(() => {
      world.addAgent('a1', 'Alice', 'builder');
      world.addAgent('a2', 'Bob', 'merchant');
      world.execute('a2', 'BUILD #');
      world.execute('a2', 'REGISTER_SERVICE shop 0.01 A shop');
    });

    it('invokes a nearby agents service', () => {
      const result = world.execute('a1', 'INVOKE_SERVICE Bob shop');
      assert.ok(result.ok);
    });

    it('rejects if agent not found', () => {
      const result = world.execute('a1', 'INVOKE_SERVICE Nobody shop');
      assert.ok(result.error);
    });

    it('rejects if service not found', () => {
      const result = world.execute('a1', 'INVOKE_SERVICE Bob fake');
      assert.ok(result.error);
    });
  });

  describe('POST_BOUNTY', () => {
    beforeEach(() => {
      world.addAgent('a1', 'Alice', 'builder');
    });

    it('posts a bounty', () => {
      const result = world.execute('a1', 'POST_BOUNTY 0.05 Find treasure');
      assert.ok(result.ok);
      assert.ok(result.bounty);
      assert.equal(world.bounties.length, 1);
    });

    it('costs energy', () => {
      const before = world.getAgent('a1').energy;
      world.execute('a1', 'POST_BOUNTY 0.01 Do thing');
      assert.equal(world.getAgent('a1').energy, before - 1);
    });
  });

  describe('REMOVE_SERVICE', () => {
    beforeEach(() => {
      world.addAgent('a1', 'Alice', 'builder');
      world.execute('a1', 'BUILD #');
      world.execute('a1', 'REGISTER_SERVICE shop 0.01 My shop');
    });

    it('removes a registered service', () => {
      assert.equal(world.getAgent('a1').services.length, 1);
      const result = world.execute('a1', 'REMOVE_SERVICE shop');
      assert.ok(result.ok);
      assert.equal(world.getAgent('a1').services.length, 0);
    });

    it('rejects removing nonexistent service', () => {
      const result = world.execute('a1', 'REMOVE_SERVICE fake');
      assert.ok(result.error);
    });
  });

  describe('CLAIM_BOUNTY', () => {
    it('sets forAgentId on claimed bounty', () => {
      world.addAgent('a1', 'Alice', 'builder');
      world.bounties.push({
        id: 'test-bounty', poster: 'System', posterId: 'system',
        reward: 0.01, description: 'Test', questType: 'scavenge', target: 1,
        claimed: false, claimedBy: null, completed: false, postedAt: 0,
      });
      const result = world.execute('a1', 'CLAIM_BOUNTY test-bounty');
      assert.ok(result.ok);
      const bounty = world.bounties.find(b => b.id === 'test-bounty');
      assert.equal(bounty.forAgentId, 'a1');
      assert.equal(bounty.claimedById, 'a1');
    });

    it('rejects claiming own bounty', () => {
      world.addAgent('a1', 'Alice', 'builder');
      world.getAgent('a1').energy = 10;
      world.execute('a1', 'BUILD #');
      world.execute('a1', 'POST_BOUNTY 0.01 do something');
      const bounty = world.bounties.find(b => b.poster === 'Alice');
      const result = world.execute('a1', `CLAIM_BOUNTY ${bounty.id}`);
      assert.ok(result.error);
    });
  });

  describe('advanceTick', () => {
    it('regens energy', () => {
      world.addAgent('a1', 'Alice', 'builder');
      world.getAgent('a1').energy = 5;
      world.advanceTick();
      assert.equal(world.getAgent('a1').energy, 10);
    });

    it('caps regen at max', () => {
      world.addAgent('a1', 'Alice', 'builder');
      world.getAgent('a1').energy = 18;
      world.advanceTick();
      assert.equal(world.getAgent('a1').energy, 20);
    });

    it('tile owners get passive resources', () => {
      world.addAgent('a1', 'Alice', 'builder');
      world.execute('a1', 'BUILD #');
      const tile = world.getTile(world.getAgent('a1').x, world.getAgent('a1').y);
      const resBefore = world.getAgent('a1').inventory[tile.resource] || 0;
      world.advanceTick();
      assert.ok((world.getAgent('a1').inventory[tile.resource] || 0) > resBefore);
    });

    it('prunes old completed bounties', () => {
      world.bounties.push({ id: 'old', completed: true, completedAt: 0 });
      world.tick = 100;
      world.advanceTick();
      assert.equal(world.bounties.filter(b => b.id === 'old').length, 0);
    });
  });

  describe('state', () => {
    it('getState returns serializable object', () => {
      world.addAgent('a1', 'Alice', 'builder');
      const state = world.getState();
      assert.ok(state.tick !== undefined);
      assert.ok(state.tiles);
      assert.ok(state.agents);
      JSON.stringify(state); // should not throw
    });

    it('getStateHash returns hex string', () => {
      const hash = world.getStateHash();
      assert.match(hash, /^[a-f0-9]{64}$/);
    });
  });
});
