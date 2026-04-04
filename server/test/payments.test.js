import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { World } from '../src/world.js';
import { PaymentManager } from '../src/payments.js';

describe('PaymentManager', () => {
  let world, payments;

  beforeEach(() => {
    world = new World();
    payments = new PaymentManager(world);
    world.addAgent('a1', 'Alice', 'builder');
    world.addAgent('a2', 'Bob', 'merchant');
  });

  it('credits balance', () => {
    const result = payments.credit('a1', 0.05, 'quest reward');
    assert.ok(result.ok);
    assert.equal(result.balance, 0.05);
    assert.equal(payments.getBalance('a1'), 0.05);
  });

  it('rejects invalid credit amount', () => {
    assert.ok(payments.credit('a1', 0, 'test').error);
    assert.ok(payments.credit('a1', -1, 'test').error);
    assert.ok(payments.credit('a1', NaN, 'test').error);
  });

  it('processes payment between agents', async () => {
    payments.credit('a1', 1.0, 'seed');
    const result = await payments.processPayment('a1', 'a2', 0.25, 'exchange');
    assert.ok(result.ok);
    assert.equal(result.buyer.balance, 0.75);
    assert.equal(result.seller.balance, 0.25);
  });

  it('rejects payment with insufficient balance', async () => {
    payments.credit('a1', 0.01, 'seed');
    const result = await payments.processPayment('a1', 'a2', 1.0, 'exchange');
    assert.ok(result.error);
    assert.match(result.error, /Insufficient/);
  });

  it('rejects payment for unknown agents', async () => {
    assert.ok((await payments.processPayment('nobody', 'a2', 0.1, 'test')).error);
    assert.ok((await payments.processPayment('a1', 'nobody', 0.1, 'test')).error);
  });

  it('returns zero for unknown agent balance', () => {
    assert.equal(payments.getBalance('nobody'), 0);
  });
});
