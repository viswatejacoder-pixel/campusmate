// T-080 M2 automated checks for utils/latestRequest.js (pure function, no browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLatestRequestGuard } from '../src/utils/latestRequest.js';

test('M2-G01 a single request stays current until something newer starts', () => {
  const guard = createLatestRequestGuard();
  const first = guard.start();
  assert.equal(guard.isCurrent(first), true);
  const second = guard.start();
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
});

test('M2-G02 invalidate() (unmount) makes every ticket stale, including the latest', () => {
  const guard = createLatestRequestGuard();
  const a = guard.start();
  const b = guard.start();
  guard.invalidate();
  assert.equal(guard.isCurrent(a), false);
  assert.equal(guard.isCurrent(b), false);
});

test('M2-G03 a ticket taken after invalidate() is current (StrictMode remount: the second load wins)', () => {
  const guard = createLatestRequestGuard();
  const first = guard.start();
  guard.invalidate();
  const second = guard.start();
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
});

test('M2-G04 guards are independent, and unknown tickets are never current', () => {
  const one = createLatestRequestGuard();
  const two = createLatestRequestGuard();
  const t = one.start();
  two.start();
  two.invalidate();
  assert.equal(one.isCurrent(t), true);
  assert.equal(one.isCurrent(undefined), false);
  assert.equal(one.isCurrent(0), false);
  assert.equal(one.isCurrent(t + 1), false);
});

test('M2-G05 overlapping requests that finish out of order: only the newest answer is applied', async () => {
  const guard = createLatestRequestGuard();
  let applied = null;
  const run = async (label, delayMs) => {
    const ticket = guard.start();
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (guard.isCurrent(ticket)) applied = label;
  };
  await Promise.all([run('old (slow)', 30), run('new (fast)', 5)]);
  assert.equal(applied, 'new (fast)');
});

test('M2-G06 a request that finishes after invalidate() applies nothing', async () => {
  const guard = createLatestRequestGuard();
  let applied = false;
  const ticket = guard.start();
  const pending = new Promise((resolve) => setTimeout(resolve, 5)).then(() => {
    if (guard.isCurrent(ticket)) applied = true;
  });
  guard.invalidate();
  await pending;
  assert.equal(applied, false);
});
