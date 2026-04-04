import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ENSManager } from '../src/ens.js';

describe('ENSManager', () => {
  describe('isValidLabel', () => {
    it('accepts lowercase alphanumeric', () => {
      assert.ok(ENSManager.isValidLabel('alice'));
      assert.ok(ENSManager.isValidLabel('agent42'));
      assert.ok(ENSManager.isValidLabel('a'));
    });

    it('accepts hyphens in the middle', () => {
      assert.ok(ENSManager.isValidLabel('my-agent'));
      assert.ok(ENSManager.isValidLabel('a-b-c'));
    });

    it('rejects leading hyphens', () => {
      assert.equal(ENSManager.isValidLabel('-alice'), false);
    });

    it('rejects trailing hyphens', () => {
      assert.equal(ENSManager.isValidLabel('alice-'), false);
    });

    it('rejects uppercase', () => {
      assert.equal(ENSManager.isValidLabel('Alice'), false);
      assert.equal(ENSManager.isValidLabel('AGENT'), false);
    });

    it('rejects spaces', () => {
      assert.equal(ENSManager.isValidLabel('my agent'), false);
    });

    it('rejects special characters', () => {
      assert.equal(ENSManager.isValidLabel('agent!'), false);
      assert.equal(ENSManager.isValidLabel('agent.name'), false);
      assert.equal(ENSManager.isValidLabel('agent_name'), false);
    });

    it('rejects empty string', () => {
      assert.equal(ENSManager.isValidLabel(''), false);
    });

    it('rejects names over 20 chars', () => {
      assert.equal(ENSManager.isValidLabel('a'.repeat(21)), false);
    });

    it('accepts 20 char name', () => {
      assert.ok(ENSManager.isValidLabel('a'.repeat(20)));
    });
  });

  describe('init (disabled)', () => {
    it('initializes as disabled without env vars', async () => {
      const ens = new ENSManager();
      await ens.init();
      assert.equal(ens.enabled, false);
    });
  });

  describe('getSubname', () => {
    it('returns formatted subname', () => {
      const ens = new ENSManager();
      assert.equal(ens.getSubname('alice'), 'alice.reef.eth');
    });

    it('lowercases the name', () => {
      const ens = new ENSManager();
      assert.equal(ens.getSubname('Alice'), 'alice.reef.eth');
    });
  });

  describe('registerSubname (disabled)', () => {
    it('returns ensName with onChain false when disabled', async () => {
      const ens = new ENSManager();
      const result = await ens.registerSubname('alice', null, {});
      assert.equal(result.ensName, 'alice.reef.eth');
      assert.equal(result.onChain, false);
    });

    it('rejects invalid labels', async () => {
      const ens = new ENSManager();
      const result = await ens.registerSubname('-bad', null, {});
      assert.ok(result.error);
      assert.match(result.error, /Invalid ENS label/);
    });
  });
});
