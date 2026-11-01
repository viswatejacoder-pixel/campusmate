// Scripted checks for SUB-01 to SUB-05 (docs/TESTING.md) plus unauthorized, validation, id, injection and race cases.
// Uses only node:test and fetch (D-018). Run against a running server:
//   $env:BASE_URL='http://localhost:3001'; node --test tests/subjects.api.test.js
// Creates fake accounts t040-<run>-<tag>@example.test in the LOCAL development database, and the subjects they own.
// It inserts one task row directly (the tasks API does not exist yet) and deletes only that row, by id and user_id.
// Nothing else is deleted: at the end it prints the accounts it created and the SQL to remove only those accounts.
// Never prints passwords or cookie values.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const PREFIX = `t040-${Date.now()}-`;
const PASSWORD = 'Test-Pass-1234'; // fake, test-only
const LEAKS = /node_modules|\bat\s+\S+\s+\(|Error:|stack|ER_|SELECT |INSERT |UPDATE |DELETE /i;
const cookies = new Set(); // every session cookie this run received; all are logged out at the end

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
  const cookieOut = pair && pair !== 'connect.sid=' ? pair : null;
  if (cookieOut) cookies.add(cookieOut);
  return { status: res.status, text, json, cookie: cookieOut };
}

async function makeUser(tag) {
  const email = `${PREFIX}${tag}@example.test`;
  const r = await call('POST', '/api/auth/register', { body: { name: `T040 ${tag}`, email, password: PASSWORD } });
  assert.equal(r.status, 201, `register ${tag}`);
  assert.equal(r.cookie, null, 'register no longer logs the user in (T-075)');
  await pool.execute(
    'UPDATE users SET email_verified_at = NOW(), verification_token_hash = NULL, verification_expires_at = NULL WHERE email = ?',
    [email],
  ); // stands in for clicking the emailed link; the raw token is not readable from the DB
  const l = await call('POST', '/api/auth/login', { body: { email, password: PASSWORD } });
  assert.equal(l.status, 200, `login ${tag}`);
  return { id: l.json.user.id, email, cookie: l.cookie };
}

const list = (u) => call('GET', '/api/subjects', { cookie: u.cookie });
const create = (u, name) => call('POST', '/api/subjects', { body: { name }, cookie: u.cookie });
const rename = (u, id, name) => call('PUT', `/api/subjects/${id}`, { body: { name }, cookie: u.cookie });
const del = (u, id) => call('DELETE', `/api/subjects/${id}`, { cookie: u.cookie });
const names = (r) => r.json.subjects.map((s) => s.name);
const dbRow = async (id) => (await pool.execute('SELECT id, user_id, name FROM subjects WHERE id = ?', [id]))[0][0] || null;
const dbCount = async (sql, params) => (await pool.execute(sql, params))[0][0].n;

function assertError(r, status, code) {
  assert.equal(r.status, status, `expected ${status}, got ${r.status}: ${r.text}`);
  assert.equal(r.json?.error?.code, code);
  assert.equal(typeof r.json.error.message, 'string');
  assert.deepEqual(Object.keys(r.json), ['error']);
  assert.doesNotMatch(r.text, LEAKS);
}

after(async () => {
  for (const c of cookies) await call('POST', '/api/auth/logout', { cookie: c });
  const [rows] = await pool.execute('SELECT id, email FROM users WHERE email LIKE ? ORDER BY id', [`${PREFIX}%`]);
  const ids = rows.map((r) => r.id);
  console.log('\n=== T-040 test accounts created in this run ===');
  rows.forEach((r) => console.log(`  id=${r.id}  ${r.email}`));
  if (ids.length) {
    const marks = ids.map(() => '?').join(',');
    const subjects = await dbCount(`SELECT COUNT(*) AS n FROM subjects WHERE user_id IN (${marks})`, ids);
    const tasks = await dbCount(`SELECT COUNT(*) AS n FROM tasks WHERE user_id IN (${marks})`, ids);
    const sessions = await dbCount(
      `SELECT COUNT(*) AS n FROM sessions WHERE JSON_EXTRACT(data, '$.userId') IN (${marks})`, ids);
    console.log(`  leftover rows for these accounts: subjects=${subjects}, tasks=${tasks}, sessions=${sessions}`);
    console.log('--- cleanup SQL (touches only the accounts listed above; run in this order) ---');
    console.log(`DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') IN (${ids.join(', ')});`);
    console.log(`DELETE FROM tasks WHERE user_id IN (${ids.join(', ')});`);
    console.log(`DELETE FROM users WHERE id IN (${ids.join(', ')}) AND email LIKE 't040-%@example.test';`);
    console.log('(deleting a user also deletes that user\'s subjects, ON DELETE CASCADE)');
  }
  await pool.end();
});

test('Regression: health, JSON 404 and auth/me are unchanged', async () => {
  const h = await call('GET', '/api/health');
  assert.equal(h.status, 200);
  assert.deepEqual(h.json, { status: 'ok' });
  const n = await call('GET', '/api/nope');
  assertError(n, 404, 'NOT_FOUND');
  const u = await makeUser('reg');
  const m = await call('GET', '/api/auth/me', { cookie: u.cookie });
  assert.equal(m.status, 200);
  assert.deepEqual(Object.keys(m.json.user).sort(), ['email', 'id', 'name']);
});

test('Unauthorized: every subjects endpoint returns 401 and changes nothing', async () => {
  const u = await makeUser('unauth');
  const s = (await create(u, 'Unauth target')).json.subject;
  const attempts = [
    ['GET', '/api/subjects'],
    ['POST', '/api/subjects', { name: 'Hacked' }],
    ['PUT', `/api/subjects/${s.id}`, { name: 'Hacked' }],
    ['DELETE', `/api/subjects/${s.id}`],
    ['PUT', '/api/subjects/abc', { name: 'Hacked' }], // 401 comes before the id check
    ['DELETE', '/api/subjects/999999999'], // 401 comes before 404
  ];
  for (const cookie of [undefined, 'connect.sid=s%3Agarbage.signature', 'connect.sid=']) {
    for (const [method, path, body] of attempts) {
      assertError(await call(method, path, { body, cookie }), 401, 'UNAUTHENTICATED');
    }
  }
  assert.deepEqual(await dbRow(s.id), { id: s.id, user_id: u.id, name: 'Unauth target' });
  assert.equal(await dbCount('SELECT COUNT(*) AS n FROM subjects WHERE name = ?', ['Hacked']), 0);
  const logout = await call('POST', '/api/auth/logout', { cookie: u.cookie }); // the old cookie must stop working
  assert.equal(logout.status, 204);
  assertError(await list(u), 401, 'UNAUTHENTICATED');
});

test('SUB-01: create, list (sorted), rename, delete', async () => {
  const u = await makeUser('crud');
  const empty = await list(u);
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.json, { subjects: [] });

  const c = await create(u, '  Data Structures  '); // trimmed
  assert.equal(c.status, 201);
  assert.deepEqual(Object.keys(c.json), ['subject']);
  assert.deepEqual(Object.keys(c.json.subject).sort(), ['id', 'name']);
  assert.equal(c.json.subject.name, 'Data Structures');
  assert.ok(Number.isInteger(c.json.subject.id) && c.json.subject.id > 0);
  assert.deepEqual(await dbRow(c.json.subject.id), { id: c.json.subject.id, user_id: u.id, name: 'Data Structures' });
  const ds = c.json.subject;
  const alg = (await create(u, 'Algorithms')).json.subject;
  const bio = (await create(u, 'Biology')).json.subject;

  const l = await list(u);
  assert.equal(l.status, 200);
  assert.deepEqual(l.json.subjects, [alg, bio, ds]); // sorted by name; each object is exactly { id, name }

  const r = await rename(u, ds.id, 'Operating Systems');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { subject: { id: ds.id, name: 'Operating Systems' } });
  assert.deepEqual(names(await list(u)), ['Algorithms', 'Biology', 'Operating Systems']);

  const d = await del(u, bio.id);
  assert.equal(d.status, 204);
  assert.equal(d.text, '');
  assert.deepEqual(names(await list(u)), ['Algorithms', 'Operating Systems']);
  assert.equal(await dbRow(bio.id), null);
  assertError(await del(u, bio.id), 404, 'NOT_FOUND'); // already gone
  assertError(await rename(u, bio.id, 'Back again'), 404, 'NOT_FOUND');
});

test('Validation: bad names give 400 VALIDATION_ERROR and change nothing', async () => {
  const u = await makeUser('valid');
  const target = (await create(u, 'Valid target')).json.subject;
  const bad = [
    ['no body', undefined], ['empty object', {}], ['empty string', { name: '' }], ['spaces only', { name: '   ' }],
    ['number', { name: 123 }], ['null', { name: null }], ['array value', { name: ['a'] }], ['object value', { name: {} }],
    ['array body', ['x']], ['101 characters', { name: 'a'.repeat(101) }], ['101 emoji', { name: '😀'.repeat(101) }],
  ];
  for (const [label, body] of bad) {
    const c = await call('POST', '/api/subjects', { body, cookie: u.cookie });
    assertError(c, 400, 'VALIDATION_ERROR');
    assert.deepEqual(Object.keys(c.json.error.fields), ['name'], `create: ${label}`);
    const p = await call('PUT', `/api/subjects/${target.id}`, { body, cookie: u.cookie });
    assertError(p, 400, 'VALIDATION_ERROR');
    assert.deepEqual(Object.keys(p.json.error.fields), ['name'], `rename: ${label}`);
  }
  assert.deepEqual(names(await list(u)), ['Valid target']); // nothing created, nothing renamed

  // Boundaries: exactly 100 characters is accepted, counted in characters (not bytes).
  assert.equal((await create(u, 'a'.repeat(100))).status, 201);
  assert.equal((await create(u, '😀'.repeat(100))).status, 201);
  assert.equal((await rename(u, target.id, 'b'.repeat(100))).status, 200);

  const text = await call('POST', '/api/subjects', { raw: '{"name":"x"}', type: 'text/plain', cookie: u.cookie });
  assertError(text, 415, 'UNSUPPORTED_MEDIA_TYPE');
  const broken = await call('POST', '/api/subjects', { raw: '{"name": "secret-name', type: 'application/json', cookie: u.cookie });
  assertError(broken, 400, 'VALIDATION_ERROR');
  assert.doesNotMatch(broken.text, /secret-name/);
});

test('Validation: bad ids give 400 BAD_ID, a valid missing id gives 404', async () => {
  const u = await makeUser('ids');
  const s = (await create(u, 'Id target')).json.subject;
  for (const id of ['abc', '0', '-1', '1.5', '1e2', '01', '0x1', '4294967296', '99999999999999999999', 'null']) {
    assertError(await call('PUT', `/api/subjects/${id}`, { body: { name: 'X' }, cookie: u.cookie }), 400, 'BAD_ID');
    assertError(await call('DELETE', `/api/subjects/${id}`, { cookie: u.cookie }), 400, 'BAD_ID');
  }
  assertError(await call('PUT', '/api/subjects/4294967295', { body: { name: 'X' }, cookie: u.cookie }), 404, 'NOT_FOUND');
  assertError(await call('DELETE', '/api/subjects/4294967295', { cookie: u.cookie }), 404, 'NOT_FOUND');
  assert.deepEqual(names(await list(u)), ['Id target']);
  assert.equal((await dbRow(s.id)).name, 'Id target');
});

test('Names are stored as plain text; extra body fields (userId) are ignored', async () => {
  const [a, b] = [await makeUser('inj-a'), await makeUser('inj-b')];
  const odd = ["'; DROP TABLE subjects; --", '<script>alert(1)</script>', '100% _wild_ \\ "quoted"', 'Ünïcødé 日本語'];
  for (const name of odd) {
    const c = await create(a, name);
    assert.equal(c.status, 201, name);
    assert.equal(c.json.subject.name, name); // stored and returned exactly, never interpreted
  }
  assert.deepEqual(names(await list(a)).sort(), [...odd].sort());
  assert.ok(await dbCount('SELECT COUNT(*) AS n FROM subjects WHERE user_id = ?', [a.id]) >= odd.length); // table intact

  const forged = await call('POST', '/api/subjects', {
    body: { name: 'Forged owner', userId: b.id, user_id: b.id, id: 1 }, cookie: a.cookie,
  });
  assert.equal(forged.status, 201);
  const row = await dbRow(forged.json.subject.id);
  assert.equal(row.user_id, a.id); // the owner is always the logged-in user
  assert.notEqual(forged.json.subject.id, 1);
  assert.deepEqual(await names(await list(b)), []);
});

test('SUB-02: duplicate names for the same user give 409 SUBJECT_EXISTS', async () => {
  const u = await makeUser('dup');
  const math = (await create(u, 'Math')).json.subject;
  for (const name of ['Math', '  Math  ', 'MATH']) {
    assertError(await create(u, name), 409, 'SUBJECT_EXISTS'); // exact, trimmed, and different letter case
  }
  assert.equal(await dbCount('SELECT COUNT(*) AS n FROM subjects WHERE user_id = ?', [u.id]), 1);

  const phys = (await create(u, 'Physics')).json.subject;
  assertError(await rename(u, phys.id, 'Math'), 409, 'SUBJECT_EXISTS');
  assertError(await rename(u, phys.id, ' math '), 409, 'SUBJECT_EXISTS');
  assert.equal((await dbRow(phys.id)).name, 'Physics'); // unchanged after the failed renames
  assert.equal((await rename(u, phys.id, 'Physics')).status, 200); // renaming to its own name is allowed
  assert.equal((await rename(u, math.id, 'MATH')).json.subject.name, 'MATH'); // changing only the case of its own name
  assert.equal((await rename(u, phys.id, ' Chemistry ')).json.subject.name, 'Chemistry');
  assert.deepEqual(names(await list(u)), ['Chemistry', 'MATH']);
});

test('SUB-02b: simultaneous requests cannot create or rename into a duplicate', async () => {
  const u = await makeUser('race');
  const results = await Promise.all(Array.from({ length: 6 }, () => create(u, 'Race')));
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 409, 409, 409, 409, 409]);
  results.filter((r) => r.status === 409).forEach((r) => assertError(r, 409, 'SUBJECT_EXISTS'));
  assert.equal(await dbCount('SELECT COUNT(*) AS n FROM subjects WHERE user_id = ? AND name = ?', [u.id, 'Race']), 1);

  const ids = [];
  for (const n of ['R1', 'R2', 'R3', 'R4']) ids.push((await create(u, n)).json.subject.id);
  const renames = await Promise.all(ids.map((id) => rename(u, id, 'Same target')));
  assert.deepEqual(renames.map((r) => r.status).sort(), [200, 409, 409, 409]);
  assert.equal(await dbCount('SELECT COUNT(*) AS n FROM subjects WHERE user_id = ? AND name = ?', [u.id, 'Same target']), 1);
});

test('SUB-03 and SUB-05: two users are isolated; the same name is allowed for each', async () => {
  const [a, b] = [await makeUser('iso-a'), await makeUser('iso-b')];
  const aShared = (await create(a, 'Shared Name')).json.subject;
  const aOnly = (await create(a, 'A Only')).json.subject;
  const bShared = await create(b, 'Shared Name'); // SUB-03
  assert.equal(bShared.status, 201);
  assert.notEqual(bShared.json.subject.id, aShared.id);
  assert.deepEqual(names(await list(a)), ['A Only', 'Shared Name']);
  assert.deepEqual((await list(b)).json.subjects, [bShared.json.subject]); // B sees only their own

  // SUB-05: B acts on A's subjects. Every attempt is the same 404 as a subject that does not exist.
  const missing = await del(b, 4294967295);
  assertError(missing, 404, 'NOT_FOUND');
  for (const id of [aOnly.id, aShared.id]) {
    const d = await del(b, id);
    assertError(d, 404, 'NOT_FOUND');
    assert.deepEqual(d.json, missing.json); // nothing reveals that the id exists
    assert.deepEqual((await rename(b, id, 'Stolen')).json, missing.json);
    // B renaming A's id to a name B already owns must be 404, not a 409 that would reveal the id exists.
    assert.deepEqual((await rename(b, id, 'Shared Name')).json, missing.json);
    const forged = await call('PUT', `/api/subjects/${id}`, { body: { name: 'Stolen', userId: b.id }, cookie: b.cookie });
    assert.deepEqual(forged.json, missing.json);
  }
  assert.deepEqual((await list(a)).json.subjects, [aOnly, aShared]); // A's data is untouched
  assert.deepEqual((await list(b)).json.subjects, [bShared.json.subject]);
  assert.equal(await dbCount('SELECT COUNT(*) AS n FROM subjects WHERE name = ? AND user_id = ?', ['Stolen', b.id]), 0);
});

test('SUB-04: deleting a subject that has tasks gives 409 SUBJECT_IN_USE', async () => {
  const [a, b] = [await makeUser('use-a'), await makeUser('use-b')];
  const s = (await create(a, 'In Use')).json.subject;
  const [ins] = await pool.execute(
    'INSERT INTO tasks (user_id, subject_id, title, due_date) VALUES (?, ?, ?, ?)',
    [a.id, s.id, 'T-040 test task', '2026-11-30'],
  );
  const taskId = ins.insertId;
  try {
    const d = await del(a, s.id);
    assertError(d, 409, 'SUBJECT_IN_USE');
    assert.match(d.json.error.message, /task/i); // clear message
    assert.deepEqual((await list(a)).json.subjects, [s]); // still there
    assert.equal(await dbCount('SELECT COUNT(*) AS n FROM tasks WHERE id = ?', [taskId]), 1); // task untouched

    assert.equal((await rename(a, s.id, 'In Use (renamed)')).status, 200); // renaming is fine while in use
    assertError(await del(b, s.id), 404, 'NOT_FOUND'); // another user gets 404, never 409 (no leak)
  } finally {
    await pool.execute('DELETE FROM tasks WHERE id = ? AND user_id = ?', [taskId, a.id]); // only the row inserted above
  }
  const ok = await del(a, s.id); // allowed once the task is gone
  assert.equal(ok.status, 204);
  assert.deepEqual((await list(a)).json.subjects, []);
});
