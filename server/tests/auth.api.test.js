// Scripted checks for AUTH-01 to AUTH-10 (docs/TESTING.md). Uses only node:test and fetch (D-018).
// Run against a running server:  BASE_URL=http://localhost:3000 node --test tests/auth.api.test.js
// Creates fake accounts t030-<run>-<tag>@example.test in the LOCAL development database. It deletes nothing;
// at the end it prints the exact accounts it created and the SQL to remove only those accounts.
// Never prints passwords, cookie values, or full password hashes.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import pool from '../src/config/db.js';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const RUN = `${Date.now()}`;
const PREFIX = `t030-${RUN}-`;
const PASSWORD = 'Test-Pass-1234'; // fake, test-only
const LONG_PASSWORD = 'Aa1!'.repeat(18); // exactly 72 ASCII characters / 72 bytes

const registered = new Set(); // every well-formed email this run sent to register (lower-cased)
const cookies = new Set(); // every session cookie this run received; all are logged out at the end
const mk = (tag) => `${PREFIX}${tag}@example.test`;

function cookieFrom(setCookies) {
  const line = setCookies.find((s) => s.startsWith('connect.sid='));
  if (!line) return null;
  const pair = line.split(';')[0];
  return pair === 'connect.sid=' ? null : pair; // an empty value is the "clear cookie" response
}
const sidOf = (cookie) => decodeURIComponent(cookie.split('=')[1]).slice(2).split('.')[0];

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
    if (body && typeof body.email === 'string') registered.add(body.email.trim().toLowerCase());
  }
  const res = await fetch(BASE + path, { method, headers, body: payload, redirect: 'manual' });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  const setCookies = res.headers.getSetCookie();
  const out = { status: res.status, text, json, setCookies, cookie: cookieFrom(setCookies) };
  if (out.cookie) cookies.add(out.cookie);
  return out;
}

const register = (body, cookie) => call('POST', '/api/auth/register', { body, cookie });
const login = (body, cookie) => call('POST', '/api/auth/login', { body, cookie });
const me = (cookie) => call('GET', '/api/auth/me', { cookie });
const verifyInDb = (email) =>
  pool.execute('UPDATE users SET email_verified_at = NOW(), verification_token_hash = NULL, verification_expires_at = NULL WHERE email = ?', [email]);
const dbCount = async (sql, params) => (await pool.execute(sql, params))[0][0].n;
const LEAKS = /node_modules|\bat\s+\S+\s+\(|Error:|stack|ER_|SELECT |INSERT /i;

let A; // account A: { email, id, cookie }
let B; // account with a 72-character password

after(async () => {
  for (const c of cookies) await call('POST', '/api/auth/logout', { cookie: c }); // idempotent, removes our session rows
  const [rows] = await pool.execute('SELECT id, email FROM users WHERE email LIKE ? ORDER BY id', [`${PREFIX}%`]);
  const ids = rows.map((r) => r.id);
  const emails = rows.map((r) => `'${r.email}'`);
  const attempted = [...registered].filter((e) => e.startsWith(PREFIX));
  console.log('\n=== T-030 test accounts created in this run ===');
  rows.forEach((r) => console.log(`  id=${r.id}  ${r.email}`));
  console.log(`  distinct t030 emails sent to register: ${attempted.length}; accounts that exist: ${rows.length}`);
  if (ids.length) {
    const left = await dbCount(
      `SELECT COUNT(*) AS n FROM sessions WHERE JSON_EXTRACT(data, '$.userId') IN (${ids.map(() => '?').join(',')})`,
      ids,
    );
    console.log(`  leftover session rows for these accounts: ${left}`);
    console.log('--- cleanup SQL (touches only the accounts listed above; run the first statement before the second) ---');
    console.log(`DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') IN (${ids.join(', ')});`);
    console.log(`DELETE FROM users WHERE id IN (${ids.join(', ')}) AND email IN (${emails.join(', ')});`);
  }
  await pool.end();
});

test('Regression: health response and JSON 404 are unchanged', async () => {
  const h = await call('GET', '/api/health');
  assert.equal(h.status, 200);
  assert.deepEqual(h.json, { status: 'ok' });
  const n = await call('GET', '/api/nope');
  assert.equal(n.status, 404);
  assert.deepEqual(n.json, { error: { code: 'NOT_FOUND', message: 'Resource not found.' } });
  const w = await call('GET', '/api/auth/login'); // wrong method on a real path also gets the JSON 404
  assert.equal(w.status, 404);
  assert.equal(w.json.error.code, 'NOT_FOUND');
});

test('AUTH-01 register a valid user (messy email is normalised)', async () => {
  const email = mk('a');
  const r = await register({ name: '  T030 Tester A ', email: `  ${email.toUpperCase()} `, password: PASSWORD });
  assert.equal(r.status, 201);
  assert.deepEqual(Object.keys(r.json), ['message']); // T-075: no user object, no session
  assert.ok(!/password|hash/i.test(r.text), 'response must not mention a password or hash');
  assert.equal(r.cookie, null, 'register no longer logs the user in (T-075)');
  const [rows] = await pool.execute('SELECT id, name, email FROM users WHERE email = ?', [email]);
  assert.equal(rows.length, 1); // stored trimmed and lower-cased
  assert.equal(rows[0].name, 'T030 Tester A');
  await verifyInDb(email); // stands in for clicking the emailed link
  const l = await login({ email, password: PASSWORD });
  assert.equal(l.status, 200);
  A = { email, id: rows[0].id, cookie: l.cookie };
  const m = await me(A.cookie);
  assert.equal(m.status, 200);
  assert.equal(m.json.user.id, A.id);
});

test('AUTH-02 stored password_hash is a bcrypt hash at cost 12 (checked via the app DB pool)', async () => {
  const [rows] = await pool.execute('SELECT name, email, password_hash FROM users WHERE email = ?', [A.email]);
  assert.equal(rows.length, 1);
  const h = rows[0].password_hash;
  assert.ok(h.startsWith('$2'), 'hash starts with $2');
  assert.match(h, /^\$2[aby]\$12\$/, 'bcrypt cost 12');
  assert.equal(h.length, 60);
  assert.ok(!h.includes(PASSWORD));
  assert.equal(await bcrypt.compare(PASSWORD, h), true);
  assert.equal(rows[0].email, A.email);
  assert.equal(rows[0].name, 'T030 Tester A');
  console.log(`  AUTH-02: hash prefix ${h.slice(0, 7)}, length ${h.length}`);
});

test('AUTH-03 duplicate email gives 409, also with different letter case', async () => {
  for (const email of [A.email, `  ${A.email.toUpperCase()}`, A.email.replace('t030', 'T030')]) {
    const r = await register({ name: 'Dup', email, password: PASSWORD });
    assert.equal(r.status, 409);
    assert.equal(r.json.error.code, 'EMAIL_TAKEN');
    assert.equal(r.cookie, null, 'no session on a failed registration');
  }
  assert.equal(await dbCount('SELECT COUNT(*) AS n FROM users WHERE email = ?', [A.email]), 1);
});

test('AUTH-04 invalid registration input gives 400 with per-field messages', async () => {
  const ok = { name: 'Valid Name', email: mk('bad'), password: PASSWORD };
  const cases = [
    ['empty object', {}, ['email', 'name', 'password']],
    ['bad email', { ...ok, email: 'not-an-email' }, ['email']],
    ['email without TLD', { ...ok, email: 'a@b' }, ['email']],
    ['SQL-looking email', { ...ok, email: "' OR 1=1 --" }, ['email']],
    ['7-character password', { ...ok, password: 'Abcde12' }, ['password']],
    ['73-character password', { ...ok, password: 'a'.repeat(73) }, ['password']],
    ['over 72 bytes (40 emoji)', { ...ok, password: '\u{1F600}'.repeat(40) }, ['password']],
    ['101-character name', { ...ok, name: 'n'.repeat(101) }, ['name']],
    ['blank name', { ...ok, name: '   ' }, ['name']],
    ['non-string values', { name: 123, email: {}, password: 12345678 }, ['email', 'name', 'password']],
  ];
  for (const [label, body, expected] of cases) {
    const r = await register(body);
    assert.equal(r.status, 400, label);
    assert.equal(r.json.error.code, 'VALIDATION_ERROR', label);
    assert.deepEqual(Object.keys(r.json.error.fields).sort(), expected, label);
    assert.equal(r.cookie, null, label);
  }
  for (const [label, r] of [
    ['no body', await call('POST', '/api/auth/register')],
    ['array body', await register([])],
  ]) {
    assert.equal(r.status, 400, label);
    assert.deepEqual(Object.keys(r.json.error.fields).sort(), ['email', 'name', 'password'], label);
  }
  assert.equal(await dbCount('SELECT COUNT(*) AS n FROM users WHERE email LIKE ?', [`${PREFIX}%`]), 1, 'only account A exists');
});

test('AUTH-05 login works, regenerates the session, and the old session id stops working', async () => {
  const oldCookie = A.cookie;
  const r = await login({ email: A.email, password: PASSWORD }, oldCookie);
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { user: { id: A.id, name: 'T030 Tester A', email: A.email } });
  assert.ok(r.cookie && r.cookie !== oldCookie, 'new session id after login');
  assert.equal((await me(oldCookie)).status, 401, 'old session id is dead');
  assert.equal((await me(r.cookie)).status, 200);
  A.cookie = r.cookie;
  const upper = await login({ email: `  ${A.email.toUpperCase()} `, password: PASSWORD }); // case-insensitive email
  assert.equal(upper.status, 200);
  assert.equal(upper.json.user.id, A.id);
});

test('AUTH-05b register creates no session and leaves an existing session untouched (T-075)', async () => {
  const before = (await login({ email: A.email, password: PASSWORD })).cookie;
  const r = await register({ name: 'T030 Tester C', email: mk('c'), password: PASSWORD }, before);
  assert.equal(r.status, 201);
  assert.equal(r.cookie, null, 'no session cookie from register');
  assert.equal((await me(before)).status, 200, 'the existing session is untouched');
});

test('AUTH-06 login errors are generic and identical; edge inputs', async () => {
  const wrong = await login({ email: A.email, password: 'Wrong-Pass-999' });
  const unknown = await login({ email: mk('nobody'), password: PASSWORD });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(wrong.json, unknown.json);
  assert.equal(wrong.json.error.message, 'Invalid email or password.');
  assert.equal(wrong.cookie, null);
  assert.equal(unknown.cookie, null);
  const sqli = await login({ email: "' OR '1'='1", password: "' OR '1'='1" });
  assert.equal(sqli.status, 401);
  const missing = await login({});
  assert.equal(missing.status, 400);
  assert.deepEqual(Object.keys(missing.json.error.fields).sort(), ['email', 'password']);
  assert.equal((await login({ email: 5, password: [] })).status, 400);
  // bcrypt ignores bytes past 72, so a 72-character password must not match when more characters are appended
  const reg = await register({ name: 'T030 Tester B', email: mk('b'), password: LONG_PASSWORD });
  assert.equal(reg.status, 201);
  B = { email: mk('b') };
  await verifyInDb(B.email);
  assert.equal((await login({ email: B.email, password: LONG_PASSWORD })).status, 200);
  const extended = await login({ email: B.email, password: `${LONG_PASSWORD}zzz` });
  assert.equal(extended.status, 401);
  assert.deepEqual(extended.json, wrong.json);
});

test('AUTH-07 /me returns the user when logged in and 401 otherwise', async () => {
  const ok = await me(A.cookie);
  assert.equal(ok.status, 200);
  assert.deepEqual(Object.keys(ok.json.user).sort(), ['email', 'id', 'name']);
  assert.equal(ok.json.user.id, A.id);
  assert.ok(!/hash|password/i.test(ok.text));
  for (const c of [undefined, 'connect.sid=s%3Agarbage.invalid', 'connect.sid=']) {
    const r = await me(c);
    assert.equal(r.status, 401);
    assert.equal(r.json.error.code, 'UNAUTHENTICATED');
  }
});

test('AUTH-08 logout destroys the session; the old cookie is rejected; logout is idempotent', async () => {
  const c = (await login({ email: A.email, password: PASSWORD })).cookie;
  const sid = sidOf(c);
  assert.equal(await dbCount('SELECT COUNT(*) AS n FROM sessions WHERE session_id = ?', [sid]), 1);
  const out = await call('POST', '/api/auth/logout', { cookie: c });
  assert.equal(out.status, 204);
  assert.equal(out.text, '');
  const clear = out.setCookies.find((s) => s.startsWith('connect.sid='));
  assert.ok(clear && /connect\.sid=;/.test(clear) && /Expires=Thu, 01 Jan 1970|Max-Age=0/i.test(clear), 'cookie cleared');
  assert.equal(await dbCount('SELECT COUNT(*) AS n FROM sessions WHERE session_id = ?', [sid]), 0, 'session row deleted');
  assert.equal((await me(c)).status, 401, 'old cookie is rejected');
  assert.equal((await call('POST', '/api/auth/logout', { cookie: c })).status, 204, 'second logout');
  assert.equal((await call('POST', '/api/auth/logout')).status, 204, 'logout with no cookie');
});

test('AUTH-09 cookie attributes in the Set-Cookie header (DevTools view is a manual check)', async () => {
  const r = await login({ email: A.email, password: PASSWORD });
  const line = r.setCookies.find((s) => s.startsWith('connect.sid='));
  assert.match(line, /;\s*HttpOnly/i);
  assert.match(line, /;\s*SameSite=Lax/i);
  assert.match(line, /;\s*Path=\//i);
  assert.doesNotMatch(line, /;\s*Secure/i, 'not Secure outside production (local HTTP)');
  const expires = Date.parse(/Expires=([^;]+)/i.exec(line)[1]);
  const hours = (expires - Date.now()) / 3600000;
  assert.ok(hours > 0 && hours < 24 * 30, 'has a bounded lifetime');
  console.log(`  AUTH-09: attributes HttpOnly; SameSite=Lax; Path=/; no Secure; lifetime about ${hours.toFixed(1)} h`);
});

test('AUTH-10 malformed JSON, wrong content type, and oversize bodies fail safely', async () => {
  const bad = await call('POST', '/api/auth/register', { raw: '{"name":"x","password":"supersecret99"', type: 'application/json' });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error.code, 'VALIDATION_ERROR');
  assert.ok(!bad.text.includes('supersecret99'), 'body content is never echoed');
  const plain = await call('POST', '/api/auth/login', { raw: '{"email":"a@b.co"}', type: 'text/plain' });
  assert.equal(plain.status, 415);
  const form = await call('POST', '/api/auth/login', { raw: 'email=a%40b.co&password=x', type: 'application/x-www-form-urlencoded' });
  assert.equal(form.status, 415);
  const big = await call('POST', '/api/auth/register', { raw: JSON.stringify({ name: 'x'.repeat(11000) }), type: 'application/json' });
  assert.equal(big.status, 413);
  for (const r of [bad, plain, form, big]) {
    assert.ok(!LEAKS.test(r.text), `no stack trace or internals in: ${r.text}`);
    assert.equal(typeof r.json.error.code, 'string');
  }
});
