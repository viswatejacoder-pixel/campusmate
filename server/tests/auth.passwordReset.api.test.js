// Password-reset API checks. REQUIRES migrations/002_password_reset.sql to be applied, and a server started from this code with
// RATE_LIMIT_DISABLED=true and MAIL_TRANSPORT=console (BASE_URL, default http://localhost:3000). Only 3 accounts are created (prefix pr-);
// nothing is deleted (cleanup SQL is printed at the end). The raw token is never stored, so tests plant a token of their own (hash only).
// The rate-limit case runs only with EXPECT_RATE_LIMIT=1 against a server that has the limiter ENABLED (BASE_URL, e.g. http://localhost:3002).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import { generateToken, hashToken } from '../src/utils/tokens.js';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PREFIX = `pr-${Date.now()}-`;
const OLD = 'Old-Pass-1234'; // fake, test-only
const NEW = 'New-Pass-5678'; // fake, test-only
const mk = (tag) => `${PREFIX}${tag}@example.test`;

async function call(method, path, { body, cookie } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  const line = res.headers.getSetCookie().find((s) => s.startsWith('connect.sid='));
  const pair = line ? line.split(';')[0] : null;
  return { status: res.status, text, json, cookie: pair && pair !== 'connect.sid=' ? pair : null };
}
const post = (path, body) => call('POST', path, { body });
const login = (tag, password) => post('/api/auth/login', { email: mk(tag), password });
const forgot = (email) => post('/api/auth/forgot-password', { email });
const reset = (token, password = NEW, confirmPassword = password) => post('/api/auth/reset-password', { token, password, confirmPassword });
const row = async (tag) => (await pool.execute('SELECT id, reset_token_hash, reset_expires_at, TIMESTAMPDIFF(SECOND, NOW(), reset_expires_at) AS ttl FROM users WHERE email = ?', [mk(tag)]))[0][0];
const sessionCount = async (id) =>
  (await pool.execute("SELECT COUNT(*) AS n FROM sessions WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.userId')) AS UNSIGNED) = ?", [id]))[0][0].n;
async function plant(tag, minutes = 30) {
  const token = generateToken();
  await pool.execute('UPDATE users SET reset_token_hash = ?, reset_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE), reset_sent_at = NOW() WHERE email = ?', [hashToken(token), String(minutes), mk(tag)]);
  return token;
}
// Verified account: register, then plant a verification token and use the real endpoint (the raw verification token is never stored).
async function makeVerified(tag) {
  assert.equal((await post('/api/auth/register', { name: `PR ${tag}`, email: mk(tag), password: OLD })).status, 201);
  const t = generateToken();
  await pool.execute('UPDATE users SET verification_token_hash = ?, verification_expires_at = DATE_ADD(NOW(), INTERVAL 30 MINUTE), verification_sent_at = NOW() WHERE email = ?', [hashToken(t), mk(tag)]);
  assert.equal((await post('/api/auth/verify-email', { token: t })).status, 200);
}
const isGeneric400 = (r) => { assert.equal(r.status, 400); assert.equal(r.json.error.code, 'TOKEN_INVALID_OR_EXPIRED'); };

after(async () => {
  const [rows] = await pool.execute('SELECT id, email FROM users WHERE email LIKE ? ORDER BY id', [`${PREFIX}%`]);
  console.log(`\n=== password-reset test accounts created in this run: ${rows.length} ===`);
  rows.forEach((r) => console.log(`  id=${r.id}  ${r.email}`));
  if (rows.length) console.log(`--- cleanup SQL ---\nDELETE FROM users WHERE id IN (${rows.map((r) => r.id).join(', ')}) AND email LIKE '${PREFIX}%';`);
  await pool.end();
});

test('PR-A01 request: identical 202 for verified, unverified, unknown and repeated (cooldown) addresses; only a verified account gets a hashed token', async () => {
  await makeVerified('a');
  assert.equal((await post('/api/auth/register', { name: 'PR b', email: mk('b'), password: OLD })).status, 201); // stays unverified
  const verifiedRes = await forgot(mk('a'));
  const results = [verifiedRes, await forgot(mk('b')), await forgot(mk('nobody')), await forgot(mk('a'))];
  for (const r of results) { assert.equal(r.status, 202); assert.deepEqual(r.json, verifiedRes.json); assert.ok(!/token|link/i.test(r.text.replace(/reset link/i, ''))); }
  const a = await row('a');
  assert.match(a.reset_token_hash, /^[0-9a-f]{64}$/);
  assert.ok(a.ttl > 1700 && a.ttl <= 1800, `expires in ~30 minutes (got ${a.ttl}s)`);
  assert.equal((await row('b')).reset_token_hash, null);
});

test('PR-A02 valid token: password changes, token is consumed, reuse and the old password fail', async () => {
  const token = await plant('a');
  const r = await reset(token);
  assert.equal(r.status, 200);
  assert.equal((await row('a')).reset_token_hash, null);
  assert.equal((await login('a', NEW)).status, 200);
  assert.equal((await login('a', OLD)).status, 401);
  isGeneric400(await reset(token, 'Third-Pass-9012')); // single use
  assert.equal((await login('a', NEW)).status, 200, 'a replayed token did not change the password');
});

test('PR-A03 expired, unknown, malformed and missing tokens all get the same generic 400; the password is unchanged', async () => {
  const expired = await plant('a', -1);
  const bodies = [];
  for (const t of [expired, generateToken(), 'abc', '', undefined, 42]) { const r = await reset(t); isGeneric400(r); bodies.push(r.text); }
  assert.equal(new Set(bodies).size, 1, 'one identical body for every kind of bad token');
  assert.equal((await login('a', NEW)).status, 200);
});

test('PR-A04 validation failure (mismatch, too short) is a 400 VALIDATION_ERROR and does NOT spend the token', async () => {
  const token = await plant('a');
  const mismatch = await reset(token, 'Fresh-Pass-1111', 'Fresh-Pass-2222');
  assert.equal(mismatch.json.error.code, 'VALIDATION_ERROR');
  assert.equal((await reset(token, 'short')).json.error.code, 'VALIDATION_ERROR');
  assert.notEqual((await row('a')).reset_token_hash, null);
  assert.equal((await reset(token, 'Fresh-Pass-1111')).status, 200, 'token still works after validation failures');
  assert.equal((await login('a', 'Fresh-Pass-1111')).status, 200);
});

test('PR-A05 an unverified account cannot reset even with a planted token', async () => {
  const token = await plant('b');
  isGeneric400(await reset(token));
  assert.equal((await login('b', OLD)).json.error.code, 'EMAIL_NOT_VERIFIED', 'still unverified, original password untouched');
});

test('PR-A06 sessions: every session of the user is ended by a reset; another user\'s session is untouched', async () => {
  await makeVerified('c');
  const a1 = await login('a', 'Fresh-Pass-1111');
  const a2 = await login('a', 'Fresh-Pass-1111');
  const c1 = await login('c', OLD);
  assert.ok(a1.cookie && a2.cookie && c1.cookie);
  assert.equal((await call('GET', '/api/auth/me', { cookie: a1.cookie })).status, 200);
  const userId = (await row('a')).id;
  assert.ok((await sessionCount(userId)) >= 2);
  const r = await reset(await plant('a'), NEW);
  assert.equal(r.status, 200);
  assert.equal((await call('GET', '/api/auth/me', { cookie: a1.cookie })).status, 401);
  assert.equal((await call('GET', '/api/auth/me', { cookie: a2.cookie })).status, 401);
  assert.equal(await sessionCount(userId), 0);
  assert.equal((await call('GET', '/api/auth/me', { cookie: c1.cookie })).status, 200, 'bystander session survives');
  assert.equal((await login('a', NEW)).status, 200, 'logging in again with the new password works');
});

test('PR-A07 rate limit (only with EXPECT_RATE_LIMIT=1 and the limiter enabled): 4th request for one email is 429', { skip: process.env.EXPECT_RATE_LIMIT !== '1' }, async () => {
  const email = mk('rl');
  const codes = [];
  for (let i = 0; i < 4; i++) codes.push((await forgot(email)).status);
  assert.deepEqual(codes, [202, 202, 202, 429]);
});
