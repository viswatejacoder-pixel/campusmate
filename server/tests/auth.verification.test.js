// T-075 email-verification API checks. Needs a server started from this code with RATE_LIMIT_DISABLED=true and MAIL_TRANSPORT=console
// (BASE_URL, default http://localhost:3000). Accounts use the t075- prefix; nothing is deleted (cleanup SQL is printed at the end).
// The raw token is never stored, so tests plant a token of their own (hash only) and then use the real endpoints.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import pool from '../src/config/db.js';
import { generateToken, hashToken, TOKEN_RE } from '../src/utils/tokens.js';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PREFIX = `t075-${Date.now()}-`;
const PASSWORD = 'Test-Pass-1234'; // fake, test-only
const mk = (tag) => `${PREFIX}${tag}@example.test`;
const LEAKS = /node_modules|\bat\s+\S+\s+\(|Error:|stack|ER_|SELECT |INSERT /i;

async function call(method, path, { body, raw, type, cookie } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  let payload;
  if (raw !== undefined) {
    payload = raw;
    headers['content-type'] = type;
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['content-type'] = 'application/json';
  }
  const res = await fetch(BASE + path, { method, headers, body: payload, redirect: 'manual' });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  const line = res.headers.getSetCookie().find((s) => s.startsWith('connect.sid='));
  const pair = line ? line.split(';')[0] : null;
  return { status: res.status, text, json, cookie: pair && pair !== 'connect.sid=' ? pair : null, headers: res.headers };
}
const post = (path, body) => call('POST', path, { body });
const register = (tag, extra = {}) => post('/api/auth/register', { name: `T075 ${tag}`, email: mk(tag), password: PASSWORD, ...extra });
const login = (tag, password = PASSWORD) => post('/api/auth/login', { email: mk(tag), password });
const verify = (token) => post('/api/auth/verify-email', { token });
const resend = (email) => post('/api/auth/resend-verification', { email });
const row = async (tag) =>
  (await pool.execute('SELECT id, name, password_hash, email_verified_at, verification_token_hash, verification_expires_at, verification_sent_at FROM users WHERE email = ?', [mk(tag)]))[0][0];
const timing = async (tag) =>
  (await pool.execute('SELECT TIMESTAMPDIFF(SECOND, NOW(), verification_expires_at) AS ttl, TIMESTAMPDIFF(SECOND, verification_sent_at, NOW()) AS age FROM users WHERE email = ?', [mk(tag)]))[0][0];
// Plants a token we know (hash only, like the server) that expires in `minutes` (negative = already expired).
async function plant(tag, minutes = 30) {
  const token = generateToken();
  await pool.execute(
    'UPDATE users SET verification_token_hash = ?, verification_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE), verification_sent_at = NOW() WHERE email = ?',
    [hashToken(token), String(minutes), mk(tag)],
  );
  return token;
}
const ageSent = (tag, seconds) =>
  pool.execute('UPDATE users SET verification_sent_at = DATE_SUB(NOW(), INTERVAL ? SECOND) WHERE email = ?', [String(seconds), mk(tag)]);
async function makeVerified(tag) {
  assert.equal((await register(tag)).status, 201);
  assert.equal((await verify(await plant(tag))).status, 200);
}

after(async () => {
  const [rows] = await pool.execute('SELECT id, email FROM users WHERE email LIKE ? ORDER BY id', [`${PREFIX}%`]);
  console.log(`\n=== T-075 test accounts created in this run: ${rows.length} ===`);
  rows.forEach((r) => console.log(`  id=${r.id}  ${r.email}`));
  if (rows.length) {
    console.log('--- cleanup SQL (touches only the accounts listed above) ---');
    console.log(`DELETE FROM users WHERE id IN (${rows.map((r) => r.id).join(', ')}) AND email LIKE '${PREFIX}%';`);
  }
  await pool.end();
});

test('V-00 tokens: 256-bit random, base64url, unique; the hash is 64 hex and differs from the token', () => {
  const seen = new Set();
  for (let i = 0; i < 50; i++) {
    const t = generateToken();
    assert.match(t, TOKEN_RE);
    assert.equal(Buffer.from(t, 'base64url').length, 32);
    assert.ok(!seen.has(t));
    seen.add(t);
  }
  const t = generateToken();
  assert.match(hashToken(t), /^[0-9a-f]{64}$/);
  assert.equal(hashToken(t), hashToken(t));
  assert.notEqual(hashToken(t), t);
});

test('V-01 register creates an UNVERIFIED account, no session, token stored only as a hash with a 30-minute expiry', async () => {
  const r = await register('a');
  assert.equal(r.status, 201);
  assert.deepEqual(Object.keys(r.json), ['message']);
  assert.equal(r.cookie, null);
  assert.ok(!/hash|password|token/i.test(r.text), `response leaks nothing: ${r.text}`);
  const u = await row('a');
  assert.equal(u.email_verified_at, null);
  assert.match(u.verification_token_hash, /^[0-9a-f]{64}$/);
  const t = await timing('a');
  assert.ok(t.ttl > 29 * 60 && t.ttl <= 30 * 60, `expires in about 30 minutes (got ${t.ttl} s)`);
  assert.ok(t.age >= 0 && t.age <= 10);
  assert.equal((await call('GET', '/api/auth/me')).status, 401);
});

test('V-02 login is blocked until verified, and only after a correct password', async () => {
  await register('b');
  const blocked = await login('b');
  assert.equal(blocked.status, 403);
  assert.equal(blocked.json.error.code, 'EMAIL_NOT_VERIFIED');
  assert.equal(blocked.cookie, null);
  const wrong = await login('b', 'Wrong-Pass-999');
  const unknown = await login('nobody');
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.json, unknown.json, 'wrong password and unknown email stay identical (no enumeration)');
});

test('V-03 verify: success, single use, no auto-login, other accounts untouched, login works afterwards', async () => {
  await register('c');
  await register('d');
  const token = await plant('c');
  const ok = await verify(token);
  assert.equal(ok.status, 200);
  assert.deepEqual(Object.keys(ok.json), ['message']);
  assert.equal(ok.cookie, null, 'verifying does not log in');
  const u = await row('c');
  assert.ok(u.email_verified_at);
  assert.equal(u.verification_token_hash, null);
  assert.equal(u.verification_expires_at, null);
  const l = await login('c');
  assert.equal(l.status, 200);
  assert.ok(l.cookie);
  const replay = await verify(token);
  assert.equal(replay.status, 400);
  assert.equal(replay.json.error.code, 'TOKEN_INVALID_OR_EXPIRED');
  assert.equal((await login('d')).status, 403, 'another unverified account is unaffected');
});

test('V-04 an expired token is refused and is not consumed', async () => {
  await register('e');
  const token = await plant('e', -1);
  const r = await verify(token);
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, 'TOKEN_INVALID_OR_EXPIRED');
  const u = await row('e');
  assert.equal(u.email_verified_at, null);
  assert.equal(u.verification_token_hash, hashToken(token));
});

test('V-05 malformed or missing tokens get the same generic 400, with no internals', async () => {
  const good = generateToken();
  const reference = (await verify(good)).json; // well-formed but unknown token
  const bodies = [{}, { token: 123 }, { token: ['x'] }, { token: 'short' }, { token: 'A'.repeat(100) }, { token: ` ${good}` }, { token: null }];
  for (const b of bodies) {
    const r = await post('/api/auth/verify-email', b);
    assert.equal(r.status, 400, JSON.stringify(b));
    assert.deepEqual(r.json, reference, JSON.stringify(b));
    assert.ok(!LEAKS.test(r.text));
  }
  for (const r of [await call('POST', '/api/auth/verify-email'), await post('/api/auth/verify-email', [])]) {
    assert.equal(r.status, 400);
    assert.deepEqual(r.json, reference);
  }
  assert.equal((await call('POST', '/api/auth/verify-email', { raw: 'token=x', type: 'text/plain' })).status, 415);
  assert.equal((await call('GET', '/api/auth/verify-email')).status, 404, 'GET cannot consume a token');
});

test('V-06 resend answers identically for unknown, verified, unverified and cooldown; only an eligible account gets a new token', async () => {
  await register('f');
  await makeVerified('g');
  const oldToken = await plant('f');
  await ageSent('f', 120); // outside the 60 s cooldown
  const before = (await row('f')).verification_token_hash;
  const sent = await resend(mk('f'));
  const after1 = await row('f');
  assert.equal(sent.status, 202);
  assert.notEqual(after1.verification_token_hash, before, 'a new token replaced the old one');
  assert.match(after1.verification_token_hash, /^[0-9a-f]{64}$/);
  assert.equal((await verify(oldToken)).status, 400, 'the previous link no longer works');
  const cooled = await resend(mk('f')); // immediately again: inside the cooldown
  assert.equal(cooled.status, 202);
  assert.equal((await row('f')).verification_token_hash, after1.verification_token_hash, 'cooldown: token unchanged');
  const verified = await resend(mk('g'));
  const unknown = await resend(mk('nobody'));
  assert.equal(verified.status, 202);
  assert.equal(unknown.status, 202);
  for (const r of [cooled, verified, unknown]) assert.deepEqual(r.json, sent.json, 'identical response body');
  assert.equal((await row('g')).verification_token_hash, null, 'a verified account never gets a token');
  const upper = await resend(` ${mk('f').toUpperCase()} `); // normalised like registration
  assert.equal(upper.status, 202);
});

test('V-07 resend validates its input and an expired link recovers through resend', async () => {
  for (const b of [{}, { email: 'nope' }, { email: 5 }, { email: `${'a'.repeat(260)}@x.co` }]) {
    const r = await post('/api/auth/resend-verification', b);
    assert.equal(r.status, 400, JSON.stringify(b));
    assert.equal(r.json.error.code, 'VALIDATION_ERROR');
    assert.ok(r.json.error.fields.email);
  }
  await register('i');
  await plant('i', -5);
  await ageSent('i', 120);
  assert.equal((await resend(mk('i'))).status, 202);
  const t = await timing('i');
  assert.ok(t.ttl > 29 * 60 && t.ttl <= 30 * 60, 'fresh 30-minute expiry after resend');
});

test('V-08 re-registering an unverified email replaces its pending details; a verified email is still 409', async () => {
  await register('h');
  const first = await row('h');
  const quick = await register('h', { name: 'T075 quick', password: 'Other-Pass-5678' }); // inside the cooldown
  assert.equal(quick.status, 201);
  const unchanged = await row('h');
  assert.equal(unchanged.name, 'T075 h');
  assert.equal(unchanged.verification_token_hash, first.verification_token_hash, 'cooldown: nothing changed');
  assert.equal(await bcrypt.compare(PASSWORD, unchanged.password_hash), true);
  await ageSent('h', 120);
  const again = await register('h', { name: 'T075 h2', password: 'Other-Pass-5678' });
  assert.equal(again.status, 201);
  assert.deepEqual(again.json, quick.json, 'same response as a fresh sign-up');
  const replaced = await row('h');
  assert.equal(replaced.name, 'T075 h2');
  assert.notEqual(replaced.verification_token_hash, first.verification_token_hash);
  assert.equal(await bcrypt.compare('Other-Pass-5678', replaced.password_hash), true);
  assert.equal((await login('h', 'Other-Pass-5678')).status, 403, 'new password, still unverified');
  assert.equal((await login('h')).status, 401, 'old password no longer works');
  assert.equal((await verify(await plant('h'))).status, 200);
  const dup = await register('h', { name: 'T075 hijack', password: 'Hijack-Pass-9999' });
  assert.equal(dup.status, 409);
  assert.equal(dup.json.error.code, 'EMAIL_TAKEN');
  const final = await row('h');
  assert.equal(final.name, 'T075 h2');
  assert.equal(await bcrypt.compare('Other-Pass-5678', final.password_hash), true);
});

test('V-09 existing verified users are unaffected and the session flow is intact', async () => {
  const l = await login('g');
  assert.equal(l.status, 200);
  assert.ok(l.cookie);
  assert.equal((await call('GET', '/api/auth/me', { cookie: l.cookie })).status, 200);
  assert.equal((await call('POST', '/api/auth/logout', { cookie: l.cookie })).status, 204);
});
