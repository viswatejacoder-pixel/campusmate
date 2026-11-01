// T-075 unit tests for the in-memory rate limiter (no server, no database).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, emailKey } from '../src/middleware/rateLimit.js';

function run(limiter, req) {
  const headers = {};
  let out = 'next';
  limiter(req, { set: (k, v) => { headers[k] = v; } }, (err) => { out = err || 'next'; });
  return { out, headers };
}
const blocked = (r) => r.out !== 'next';

test('R-01 allows `max` requests, then blocks with 429 RATE_LIMITED and a Retry-After header', () => {
  let t = 1000;
  const lim = createRateLimiter({ windowMs: 60_000, max: 3, now: () => t });
  for (let i = 0; i < 3; i++) assert.ok(!blocked(run(lim, { ip: '1.1.1.1' })));
  t += 10_000;
  const r = run(lim, { ip: '1.1.1.1' });
  assert.ok(blocked(r));
  assert.equal(r.out.status, 429);
  assert.equal(r.out.code, 'RATE_LIMITED');
  assert.equal(r.headers['Retry-After'], '50'); // window ends 50 s from now
  assert.ok(blocked(run(lim, { ip: '1.1.1.1' })), 'stays blocked inside the window');
});

test('R-02 the window resets, and different IPs are counted separately', () => {
  let t = 0;
  const lim = createRateLimiter({ windowMs: 1000, max: 1, now: () => t });
  assert.ok(!blocked(run(lim, { ip: 'a' })));
  assert.ok(blocked(run(lim, { ip: 'a' })));
  assert.ok(!blocked(run(lim, { ip: 'b' })), 'another IP is not affected');
  t = 1001;
  assert.ok(!blocked(run(lim, { ip: 'a' })), 'allowed again after the window');
});

test('R-03 per-email key: trimmed and case-insensitive; no email means no limit', () => {
  assert.equal(emailKey({ body: { email: '  Foo@Example.TEST ' } }), 'email:foo@example.test');
  for (const body of [undefined, {}, { email: 5 }, { email: '   ' }, []]) assert.equal(emailKey({ body }), null);
  const lim = createRateLimiter({ windowMs: 1000, max: 1, key: emailKey });
  for (let i = 0; i < 5; i++) assert.ok(!blocked(run(lim, { ip: 'x', body: {} })), 'keyless requests are never counted');
  assert.ok(!blocked(run(lim, { body: { email: 'A@x.co' } })));
  assert.ok(blocked(run(lim, { body: { email: ' a@X.co ' } })), 'same email in another spelling is the same key');
  assert.ok(!blocked(run(lim, { body: { email: 'b@x.co' } })));
});

test('R-04 memory cap: expired keys are purged; when full of live keys a new key is refused (fail closed) and not stored', () => {
  let t = 0;
  const lim = createRateLimiter({ windowMs: 1000, max: 5, maxKeys: 2, now: () => t });
  assert.ok(!blocked(run(lim, { ip: 'a' })));
  assert.ok(!blocked(run(lim, { ip: 'b' })));
  assert.ok(blocked(run(lim, { ip: 'c' })), 'cap reached by live keys');
  assert.ok(!blocked(run(lim, { ip: 'a' })), 'existing keys keep working');
  t = 2000;
  assert.ok(!blocked(run(lim, { ip: 'c' })), 'after expiry the old keys are purged and c is admitted');
});
