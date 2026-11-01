// T-075 rate-limit checks against a server that has the limiter ENABLED (do not set RATE_LIMIT_DISABLED), BASE_URL default
// http://localhost:3002. Start it fresh for each run: counters live in the server process. Writes no database rows
// (every request is invalid or for an unknown email); it also never sends mail.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://localhost:3002';
const RUN = Date.now();

async function post(path, body) {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, text, retryAfter: res.headers.get('retry-after') };
}
function assertLimited(r) {
  assert.equal(r.status, 429, r.text);
  assert.equal(r.json.error.code, 'RATE_LIMITED');
  assert.ok(Number(r.retryAfter) >= 1, `Retry-After header present (${r.retryAfter})`);
  assert.ok(!/ip|127\.0\.0\.1|::1|stack|node_modules/i.test(r.text), 'the error reveals nothing');
}

test('RL-01 register: 10 requests per hour per IP, the 11th is 429 (invalid bodies, so no accounts are created)', async () => {
  for (let i = 1; i <= 10; i++) assert.equal((await post('/api/auth/register', {})).status, 400, `request ${i}`);
  assertLimited(await post('/api/auth/register', {}));
});

test('RL-02 login: 10 per 15 minutes per IP, the 11th is 429', async () => {
  for (let i = 1; i <= 10; i++) assert.equal((await post('/api/auth/login', {})).status, 400, `request ${i}`);
  assertLimited(await post('/api/auth/login', {}));
});

test('RL-03 verify-email: 10 per 15 minutes per IP, the 11th is 429', async () => {
  for (let i = 1; i <= 10; i++) assert.equal((await post('/api/auth/verify-email', { token: 'x' })).status, 400, `request ${i}`);
  assertLimited(await post('/api/auth/verify-email', { token: 'x' }));
});

test('RL-04 resend: 3 per 15 minutes per email (4th is 429), and 5 per IP overall (6th is 429)', async () => {
  const email = `t075rl-${RUN}@example.test`; // unknown account: 202 with no database change
  for (let i = 1; i <= 3; i++) assert.equal((await post('/api/auth/resend-verification', { email })).status, 202, `email request ${i}`);
  assertLimited(await post('/api/auth/resend-verification', { email })); // 4th for this email (4th for this IP)
  const other = `t075rl-other-${RUN}@example.test`;
  assert.equal((await post('/api/auth/resend-verification', { email: other })).status, 202, 'a different email is still allowed (5th for this IP)');
  assertLimited(await post('/api/auth/resend-verification', { email: `t075rl-third-${RUN}@example.test` })); // 6th for this IP
});

test('RL-05 limits apply per route, and other endpoints are not limited', async () => {
  for (let i = 0; i < 12; i++) assert.equal((await fetch(`${BASE}/api/health`)).status, 200);
  assert.equal((await fetch(`${BASE}/api/auth/me`)).status, 401, '/me is not rate limited');
});
