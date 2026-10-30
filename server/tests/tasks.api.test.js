// Scripted checks for TASK-01 to TASK-09, FIL-01 to FIL-05 and the API-level re-check of SUB-04 (docs/TESTING.md).
// Uses only node:test and fetch (D-018). Run against a running server:
//   $env:BASE_URL='http://localhost:3001'; node --test tests/tasks.api.test.js
// Creates fake accounts t050-<run>-<tag>@example.test in the LOCAL development database, plus the subjects and tasks they own.
// It deletes nothing except through the API under test (tasks the tests delete themselves). Direct SQL is used only to READ rows,
// and for one INSERT that must be refused by the database. At the end it prints the accounts it created and the cleanup SQL.
// "Today" is taken from MySQL CURDATE(), because that is the date the API uses for overdue and due-soon (OQ-10).
// Never prints passwords or cookie values.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const PREFIX = `t050-${Date.now()}-`;
const PASSWORD = 'Test-Pass-1234'; // fake, test-only
const LEAKS = /node_modules|\bat\s+\S+\s+\(|Error:|stack|ER_|SELECT |INSERT |UPDATE |DELETE /i;
const FAR = '2099-12-31'; // far future: never overdue or due soon, independent of today
const TASK_KEYS = ['completedAt', 'createdAt', 'description', 'dueDate', 'id', 'isCompleted', 'isDueSoon', 'isOverdue',
  'priority', 'subjectId', 'subjectName', 'title', 'updatedAt'];
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
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
  const r = await call('POST', '/api/auth/register', { body: { name: `T050 ${tag}`, email, password: PASSWORD } });
  assert.equal(r.status, 201, `register ${tag}`);
  assert.ok(r.cookie, 'register sets a session cookie');
  return { id: r.json.user.id, email, cookie: r.cookie };
}

const mkSubject = async (u, name) => {
  const r = await call('POST', '/api/subjects', { body: { name }, cookie: u.cookie });
  assert.equal(r.status, 201, r.text);
  return r.json.subject;
};
const post = (u, body) => call('POST', '/api/tasks', { body, cookie: u.cookie });
const mk = async (u, subjectId, extra = {}) => {
  const r = await post(u, { title: 'Task', subjectId, dueDate: FAR, ...extra });
  assert.equal(r.status, 201, r.text);
  return r.json.task;
};
const get = (u, id) => call('GET', `/api/tasks/${id}`, { cookie: u.cookie });
const put = (u, id, body) => call('PUT', `/api/tasks/${id}`, { body, cookie: u.cookie });
const done = (u, id, flag) => call('PATCH', `/api/tasks/${id}/complete`, { body: { isCompleted: flag }, cookie: u.cookie });
const delTask = (u, id) => call('DELETE', `/api/tasks/${id}`, { cookie: u.cookie });
const listTasks = (u, qs = '') => call('GET', `/api/tasks${qs}`, { cookie: u.cookie });
const summary = (u) => call('GET', '/api/tasks/summary', { cookie: u.cookie });
const delSubject = (u, id) => call('DELETE', `/api/subjects/${id}`, { cookie: u.cookie });
const titles = (r) => r.json.tasks.map((t) => t.title);
const dbTask = async (id) => (await pool.execute(
  'SELECT id, user_id, subject_id, title, description, due_date, priority, is_completed, completed_at FROM tasks WHERE id = ?', [id],
))[0][0] || null;
const dbCount = async (sql, params) => (await pool.execute(sql, params))[0][0].n;
// A date relative to the database's own CURDATE(), as YYYY-MM-DD (the same clock the API uses).
const day = async (offset = 0) => (await pool.query(
  "SELECT DATE_FORMAT(CURDATE() + INTERVAL ? DAY, '%Y-%m-%d') AS d", [offset],
))[0][0].d;

function assertError(r, status, code) {
  assert.equal(r.status, status, `expected ${status}, got ${r.status}: ${r.text}`);
  assert.equal(r.json?.error?.code, code);
  assert.equal(typeof r.json.error.message, 'string');
  assert.deepEqual(Object.keys(r.json), ['error']);
  assert.doesNotMatch(r.text, LEAKS);
}
const assertFields = (r, expected) => {
  assertError(r, 400, 'VALIDATION_ERROR');
  assert.deepEqual(Object.keys(r.json.error.fields).sort(), [...expected].sort());
};

before(async () => {
  const [[row]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d, @@global.time_zone AS g, @@session.time_zone AS s");
  const local = new Date().toLocaleDateString('en-CA');
  console.log(`MySQL CURDATE()=${row.d} (time_zone global=${row.g}, session=${row.s}); Node local date=${local}`);
  if (row.d !== local) console.log('NOTE: MySQL and Node disagree about today; tests use the MySQL date, which is what the API uses.');
});

after(async () => {
  for (const c of cookies) await call('POST', '/api/auth/logout', { cookie: c });
  const [rows] = await pool.execute('SELECT id, email FROM users WHERE email LIKE ? ORDER BY id', [`${PREFIX}%`]);
  const ids = rows.map((r) => r.id);
  console.log('\n=== T-050 test accounts created in this run ===');
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
    console.log(`DELETE FROM users WHERE id IN (${ids.join(', ')}) AND email LIKE 't050-%@example.test';`);
    console.log('(deleting a user also deletes that user\'s subjects, ON DELETE CASCADE)');
  }
  await pool.end();
});

test('Regression: health, JSON 404, auth/me and subjects are unchanged', async () => {
  const h = await call('GET', '/api/health');
  assert.equal(h.status, 200);
  assert.deepEqual(h.json, { status: 'ok' });
  assertError(await call('GET', '/api/nope'), 404, 'NOT_FOUND');
  const u = await makeUser('reg');
  const m = await call('GET', '/api/auth/me', { cookie: u.cookie });
  assert.equal(m.status, 200);
  assert.deepEqual(Object.keys(m.json.user).sort(), ['email', 'id', 'name']);
  const s = await mkSubject(u, 'Reg subject');
  assert.deepEqual((await call('GET', '/api/subjects', { cookie: u.cookie })).json, { subjects: [s] });
});

test('TASK-07: every tasks endpoint without a valid session returns 401 and changes nothing', async () => {
  const u = await makeUser('unauth');
  const s = await mkSubject(u, 'Unauth subject');
  const t = await mk(u, s.id, { title: 'Unauth target' });
  const attempts = [
    ['GET', '/api/tasks'],
    ['GET', '/api/tasks/summary'],
    ['GET', `/api/tasks/${t.id}`],
    ['POST', '/api/tasks', { title: 'Hacked', subjectId: s.id, dueDate: FAR }],
    ['PUT', `/api/tasks/${t.id}`, { title: 'Hacked', subjectId: s.id, dueDate: FAR }],
    ['PATCH', `/api/tasks/${t.id}/complete`, { isCompleted: true }],
    ['DELETE', `/api/tasks/${t.id}`],
    ['GET', '/api/tasks?status=bogus'], // 401 comes before filter validation
    ['PUT', '/api/tasks/abc', { title: '' }], // 401 comes before the id and body checks
    ['PATCH', '/api/tasks/abc/complete', { isCompleted: 'x' }],
    ['DELETE', '/api/tasks/999999999'], // 401 comes before 404
  ];
  for (const cookie of [undefined, 'connect.sid=s%3Agarbage.signature', 'connect.sid=']) {
    for (const [method, path, body] of attempts) {
      assertError(await call(method, path, { body, cookie }), 401, 'UNAUTHENTICATED');
    }
  }
  assert.deepEqual(await dbTask(t.id), {
    id: t.id, user_id: u.id, subject_id: s.id, title: 'Unauth target', description: null, due_date: FAR,
    priority: 'medium', is_completed: 0, completed_at: null,
  });
  assert.equal(await dbCount('SELECT COUNT(*) AS n FROM tasks WHERE title = ?', ['Hacked']), 0);
  assert.equal((await call('POST', '/api/auth/logout', { cookie: u.cookie })).status, 204); // the old cookie must stop working
  assertError(await listTasks(u), 401, 'UNAUTHENTICATED');
  assertError(await summary(u), 401, 'UNAUTHENTICATED');
});

test('TASK-01: create, read, list, edit, complete, un-complete, delete', async () => {
  const u = await makeUser('crud');
  const math = await mkSubject(u, 'Math');
  const phy = await mkSubject(u, 'Physics');
  assert.deepEqual((await listTasks(u)).json, { tasks: [] });

  const c = await post(u, { title: '  DS assignment 2  ', description: ' Linked lists ', subjectId: math.id, dueDate: FAR });
  assert.equal(c.status, 201);
  assert.deepEqual(Object.keys(c.json), ['task']);
  const t = c.json.task;
  assert.deepEqual(Object.keys(t).sort(), TASK_KEYS);
  assert.ok(Number.isInteger(t.id) && t.id > 0);
  assert.equal(t.title, 'DS assignment 2'); // trimmed
  assert.equal(t.description, 'Linked lists');
  assert.equal(t.subjectId, math.id);
  assert.equal(t.subjectName, 'Math');
  assert.equal(t.dueDate, FAR);
  assert.equal(t.priority, 'medium'); // default
  assert.equal(t.isCompleted, false);
  assert.equal(t.completedAt, null);
  assert.equal(t.isOverdue, false);
  assert.equal(t.isDueSoon, false);
  assert.match(t.createdAt, ISO);
  assert.match(t.updatedAt, ISO);
  assert.ok(Math.abs(Date.parse(t.createdAt) - Date.now()) < 120000, `createdAt is the real UTC instant: ${t.createdAt}`);
  const row = await dbTask(t.id);
  assert.equal(row.user_id, u.id);
  assert.equal(row.subject_id, math.id);
  assert.equal(row.title, 'DS assignment 2');

  assert.deepEqual((await get(u, t.id)).json, { task: t });
  assert.deepEqual((await listTasks(u)).json, { tasks: [t] });

  // PUT replaces the five editable fields; an omitted description is cleared and an omitted priority goes back to medium.
  const e = await put(u, t.id, { title: 'Renamed', subjectId: phy.id, dueDate: '2100-01-05', priority: 'high' });
  assert.equal(e.status, 200);
  assert.deepEqual(Object.keys(e.json), ['task']);
  assert.deepEqual(
    { ...e.json.task, updatedAt: null },
    { ...t, title: 'Renamed', description: null, subjectId: phy.id, subjectName: 'Physics', dueDate: '2100-01-05', priority: 'high', updatedAt: null },
  );
  assert.equal(e.json.task.createdAt, t.createdAt);

  const d1 = await done(u, t.id, true);
  assert.equal(d1.status, 200);
  assert.equal(d1.json.task.isCompleted, true);
  assert.match(d1.json.task.completedAt, ISO);
  assert.ok(Math.abs(Date.parse(d1.json.task.completedAt) - Date.now()) < 120000, 'completedAt is the real UTC instant');
  assert.equal((await dbTask(t.id)).is_completed, 1);
  const again = await done(u, t.id, true); // completing twice keeps the first completion time
  assert.equal(again.json.task.completedAt, d1.json.task.completedAt);
  const edited = await put(u, t.id, { title: 'Edited while done', subjectId: phy.id, dueDate: '2100-01-06' });
  assert.equal(edited.json.task.isCompleted, true); // editing never changes completion
  assert.equal(edited.json.task.completedAt, d1.json.task.completedAt);

  const d0 = await done(u, t.id, false);
  assert.equal(d0.status, 200);
  assert.equal(d0.json.task.isCompleted, false);
  assert.equal(d0.json.task.completedAt, null);
  assert.equal((await dbTask(t.id)).completed_at, null);

  const del = await delTask(u, t.id);
  assert.equal(del.status, 204);
  assert.equal(del.text, '');
  assert.equal(await dbTask(t.id), null);
  assertError(await get(u, t.id), 404, 'NOT_FOUND');
  assertError(await delTask(u, t.id), 404, 'NOT_FOUND');
  assertError(await put(u, t.id, { title: 'Back', subjectId: math.id, dueDate: FAR }), 404, 'NOT_FOUND');
  assertError(await done(u, t.id, true), 404, 'NOT_FOUND');
  assert.deepEqual((await listTasks(u)).json, { tasks: [] });
});

test('TASK-02: invalid input gives 400 VALIDATION_ERROR with field errors, on create and edit, and changes nothing', async () => {
  const u = await makeUser('valid');
  const s = await mkSubject(u, 'Valid subject');
  const target = await mk(u, s.id, { title: 'Valid target' });
  const ok = { title: 'ok', subjectId: s.id, dueDate: FAR };
  const bad = (label, patch, expected) => [label, { ...ok, ...patch }, expected];
  const cases = [
    ['no body', undefined, ['title', 'subjectId', 'dueDate']],
    ['empty object', {}, ['title', 'subjectId', 'dueDate']],
    ['array body', ['x'], ['title', 'subjectId', 'dueDate']],
    bad('empty title', { title: '' }, ['title']),
    bad('spaces-only title', { title: '   ' }, ['title']),
    bad('151-char title', { title: 'a'.repeat(151) }, ['title']),
    bad('151 emoji title', { title: '\u{1F600}'.repeat(151) }, ['title']),
    bad('number title', { title: 123 }, ['title']),
    bad('null title', { title: null }, ['title']),
    bad('array title', { title: ['a'] }, ['title']),
    bad('1001-char description', { description: 'd'.repeat(1001) }, ['description']),
    bad('number description', { description: 123 }, ['description']),
    bad('object description', { description: {} }, ['description']),
    bad('missing dueDate', { dueDate: undefined }, ['dueDate']),
    bad('empty dueDate', { dueDate: '' }, ['dueDate']),
    bad('null dueDate', { dueDate: null }, ['dueDate']),
    bad('Feb 30', { dueDate: '2026-02-30' }, ['dueDate']),
    bad('Feb 29 in a non-leap year', { dueDate: '2026-02-29' }, ['dueDate']),
    bad('month 13', { dueDate: '2026-13-01' }, ['dueDate']),
    bad('month 00', { dueDate: '2026-00-10' }, ['dueDate']),
    bad('April 31', { dueDate: '2026-04-31' }, ['dueDate']),
    bad('unpadded date', { dueDate: '2026-2-3' }, ['dueDate']),
    bad('two-digit year', { dueDate: '26-02-03' }, ['dueDate']),
    bad('date-time', { dueDate: '2026-02-03T10:00:00Z' }, ['dueDate']),
    bad('no dashes', { dueDate: '20260203' }, ['dueDate']),
    bad('leading space', { dueDate: ' 2026-02-03' }, ['dueDate']),
    bad('number date', { dueDate: 20260203 }, ['dueDate']),
    bad('year 0999', { dueDate: '0999-12-31' }, ['dueDate']),
    bad('priority urgent', { priority: 'urgent' }, ['priority']),
    bad('priority HIGH', { priority: 'HIGH' }, ['priority']),
    bad('empty priority', { priority: '' }, ['priority']),
    bad('number priority', { priority: 1 }, ['priority']),
    bad('null priority', { priority: null }, ['priority']),
    bad('array priority', { priority: ['high'] }, ['priority']),
    bad('missing subjectId', { subjectId: undefined }, ['subjectId']),
    bad('null subjectId', { subjectId: null }, ['subjectId']),
    bad('subjectId 0', { subjectId: 0 }, ['subjectId']),
    bad('subjectId -1', { subjectId: -1 }, ['subjectId']),
    bad('subjectId 1.5', { subjectId: 1.5 }, ['subjectId']),
    bad('subjectId as text', { subjectId: String(s.id) }, ['subjectId']),
    bad('subjectId true', { subjectId: true }, ['subjectId']),
    bad('subjectId array', { subjectId: [s.id] }, ['subjectId']),
    bad('subjectId above INT UNSIGNED', { subjectId: 4294967296 }, ['subjectId']),
    bad('subjectId does not exist', { subjectId: 4294967295 }, ['subjectId']),
    bad('several at once', { title: '', dueDate: 'x', priority: 'x', subjectId: 0 }, ['title', 'dueDate', 'priority', 'subjectId']),
  ];
  for (const [label, body, expected] of cases) {
    const c = await call('POST', '/api/tasks', { body, cookie: u.cookie });
    assertFields(c, expected);
    assert.ok(Object.values(c.json.error.fields).every((m) => typeof m === 'string' && m), `create: ${label}`);
    assertFields(await call('PUT', `/api/tasks/${target.id}`, { body, cookie: u.cookie }), expected);
  }
  assert.deepEqual(titles(await listTasks(u)), ['Valid target']); // nothing created
  assert.deepEqual((await get(u, target.id)).json.task, target); // nothing edited

  // Accepted boundaries.
  const accepted = [
    { title: 'a'.repeat(150) }, { title: '\u{1F600}'.repeat(150) }, { description: 'd'.repeat(1000) },
    { dueDate: '2028-02-29' }, { dueDate: '1000-01-01' }, { dueDate: '9999-12-31' }, { dueDate: await day(-1) },
    { priority: 'low' }, { priority: 'medium' }, { priority: 'high' },
  ];
  for (const patch of accepted) {
    const r = await post(u, { ...ok, ...patch });
    assert.equal(r.status, 201, JSON.stringify(patch).slice(0, 60) + r.text.slice(0, 120));
    if (patch.priority) assert.equal(r.json.task.priority, patch.priority);
  }
  for (const description of ['', '   ', null]) {
    assert.equal((await post(u, { ...ok, description })).json.task.description, null); // "no description" in three spellings
  }
  assert.equal((await post(u, { ...ok, description: undefined })).json.task.description, null);

  assertError(await call('POST', '/api/tasks', { raw: JSON.stringify(ok), type: 'text/plain', cookie: u.cookie }), 415, 'UNSUPPORTED_MEDIA_TYPE');
  const broken = await call('POST', '/api/tasks', { raw: '{"title": "secret-title', type: 'application/json', cookie: u.cookie });
  assertError(broken, 400, 'VALIDATION_ERROR');
  assert.doesNotMatch(broken.text, /secret-title/);
  assertFields(await call('PATCH', `/api/tasks/${target.id}/complete`, { body: { isCompleted: 'yes' }, cookie: u.cookie }), ['isCompleted']);
  for (const body of [undefined, {}, { isCompleted: 1 }, { isCompleted: null }, { isCompleted: 'true' }, [true]]) {
    assertFields(await call('PATCH', `/api/tasks/${target.id}/complete`, { body, cookie: u.cookie }), ['isCompleted']);
  }
  assert.equal((await get(u, target.id)).json.task.isCompleted, false); // still untouched
});

test('TASK-04: bad ids give 400 BAD_ID, a valid missing id gives 404, unknown routes give 404', async () => {
  const u = await makeUser('ids');
  const s = await mkSubject(u, 'Id subject');
  const t = await mk(u, s.id, { title: 'Id target' });
  const body = { title: 'X', subjectId: s.id, dueDate: FAR };
  for (const id of ['abc', '0', '-1', '1.5', '1e2', '01', '0x1', '4294967296', '99999999999999999999', 'null']) {
    assertError(await call('GET', `/api/tasks/${id}`, { cookie: u.cookie }), 400, 'BAD_ID');
    assertError(await call('PUT', `/api/tasks/${id}`, { body, cookie: u.cookie }), 400, 'BAD_ID');
    assertError(await call('PATCH', `/api/tasks/${id}/complete`, { body: { isCompleted: true }, cookie: u.cookie }), 400, 'BAD_ID');
    assertError(await call('DELETE', `/api/tasks/${id}`, { cookie: u.cookie }), 400, 'BAD_ID');
  }
  assertError(await call('PUT', '/api/tasks/abc', { body: { title: '' }, cookie: u.cookie }), 400, 'BAD_ID'); // id is checked before the body
  assertError(await call('GET', '/api/tasks/4294967295', { cookie: u.cookie }), 404, 'NOT_FOUND');
  assertError(await put(u, 4294967295, body), 404, 'NOT_FOUND');
  assertError(await done(u, 4294967295, true), 404, 'NOT_FOUND');
  assertError(await delTask(u, 4294967295), 404, 'NOT_FOUND');
  // Missing id and routes that do not exist.
  for (const [method, path] of [['PUT', '/api/tasks'], ['DELETE', '/api/tasks'], ['PATCH', '/api/tasks'],
    ['PATCH', `/api/tasks/${t.id}`], ['POST', `/api/tasks/${t.id}`], ['POST', '/api/tasks/summary'], ['GET', `/api/tasks/${t.id}/complete`]]) {
    assertError(await call(method, path, { body: method === 'GET' ? undefined : {}, cookie: u.cookie }), 404, 'NOT_FOUND');
  }
  assert.deepEqual((await get(u, t.id)).json.task, t); // nothing changed
});

test('TASK-03: a task can only use the caller\'s own subject; the database enforces it too', async () => {
  const [a, b] = [await makeUser('own-a'), await makeUser('own-b')];
  const aSub = await mkSubject(a, 'A subject');
  const bSub = await mkSubject(b, 'B subject');
  const bSub2 = await mkSubject(b, 'B subject 2');
  const aTask = await mk(a, aSub.id, { title: 'A task' });
  const bTask = await mk(b, bSub.id, { title: 'B task' });

  // Another user's subject and a subject that does not exist give the very same response (nothing reveals the id exists).
  const missing = await post(b, { title: 'Nope', subjectId: 4294967295, dueDate: FAR });
  assertFields(missing, ['subjectId']);
  const stolen = await post(b, { title: 'Stolen', subjectId: aSub.id, dueDate: FAR });
  assert.deepEqual(stolen.json, missing.json);
  assert.equal(await dbCount('SELECT COUNT(*) AS n FROM tasks WHERE user_id = ?', [b.id]), 1); // only bTask exists
  assert.equal(await dbCount('SELECT COUNT(*) AS n FROM tasks WHERE subject_id = ?', [aSub.id]), 1); // only aTask uses A's subject

  // Moving own task into another user's subject is refused and the task is unchanged.
  const move = await put(b, bTask.id, { title: 'Moved', subjectId: aSub.id, dueDate: FAR });
  assert.deepEqual(move.json, missing.json);
  assert.deepEqual((await get(b, bTask.id)).json.task, bTask);
  assert.equal((await dbTask(bTask.id)).subject_id, bSub.id);
  // Moving it into another subject of its own works, and the subject name follows.
  const own = await put(b, bTask.id, { title: 'B task', subjectId: bSub2.id, dueDate: FAR });
  assert.equal(own.status, 200);
  assert.equal(own.json.task.subjectName, 'B subject 2');
  // Renaming a subject shows up on its tasks.
  const ren = await call('PUT', `/api/subjects/${bSub2.id}`, { body: { name: 'B renamed' }, cookie: b.cookie });
  assert.equal(ren.status, 200);
  assert.equal((await get(b, bTask.id)).json.task.subjectName, 'B renamed');

  // The task check comes first: B editing A's task is a 404 whichever subject is named.
  const gone = (await get(b, 4294967295)).json;
  assert.deepEqual((await put(b, aTask.id, { title: 'X', subjectId: bSub.id, dueDate: FAR })).json, gone);
  assert.deepEqual((await put(b, aTask.id, { title: 'X', subjectId: aSub.id, dueDate: FAR })).json, gone);
  assert.deepEqual((await get(a, aTask.id)).json.task, aTask);

  // Extra body fields are ignored: the owner is always the session user, and completion cannot be forged on create.
  const forged = await post(b, {
    title: 'Forged', subjectId: bSub.id, dueDate: FAR, userId: a.id, user_id: a.id, id: 1, isCompleted: true, completedAt: '2020-01-01T00:00:00Z',
  });
  assert.equal(forged.status, 201);
  const row = await dbTask(forged.json.task.id);
  assert.equal(row.user_id, b.id);
  assert.equal(row.is_completed, 0);
  assert.equal(row.completed_at, null);
  assert.notEqual(forged.json.task.id, 1);

  // Defence in depth: even a direct INSERT cannot attach B's task to A's subject (composite foreign key).
  await assert.rejects(
    pool.execute('INSERT INTO tasks (user_id, subject_id, title, due_date) VALUES (?, ?, ?, ?)', [b.id, aSub.id, 'db-level', FAR]),
    (e) => e.code === 'ER_NO_REFERENCED_ROW_2',
  );
  assert.equal(await dbCount('SELECT COUNT(*) AS n FROM tasks WHERE title = ?', ['db-level']), 0);
});

test('TASK-05 and TASK-06: two users are isolated for read, edit, complete, delete, list and summary', async () => {
  const [a, b] = [await makeUser('iso-a'), await makeUser('iso-b')];
  const aSub = await mkSubject(a, 'Shared Name');
  const bSub = await mkSubject(b, 'Shared Name'); // the same subject name is fine for two users
  const aOne = await mk(a, aSub.id, { title: 'A one', priority: 'high' });
  const aTwo = await mk(a, aSub.id, { title: 'A two' });
  const bOne = await mk(b, bSub.id, { title: 'B one' });
  await done(a, aTwo.id, true);

  // TASK-05: B acts on A's task. Every attempt is the same 404 as a task id that does not exist.
  const missing = await get(b, 4294967295);
  assertError(missing, 404, 'NOT_FOUND');
  for (const id of [aOne.id, aTwo.id]) {
    for (const r of [
      await get(b, id),
      await put(b, id, { title: 'Stolen', subjectId: bSub.id, dueDate: FAR }),
      await call('PUT', `/api/tasks/${id}`, { body: { title: 'Stolen', subjectId: bSub.id, dueDate: FAR, userId: b.id }, cookie: b.cookie }),
      await done(b, id, true),
      await done(b, id, false),
      await delTask(b, id),
    ]) {
      assertError(r, 404, 'NOT_FOUND');
      assert.deepEqual(r.json, missing.json);
    }
  }
  // A's data is exactly as it was.
  assert.deepEqual((await get(a, aOne.id)).json.task, aOne);
  const aTwoNow = (await get(a, aTwo.id)).json.task;
  assert.equal(aTwoNow.isCompleted, true); // B's "un-complete" did nothing
  assert.equal((await dbTask(aOne.id)).title, 'A one');
  assert.equal(await dbCount('SELECT COUNT(*) AS n FROM tasks WHERE title = ?', ['Stolen']), 0);

  // TASK-06: lists and summaries contain only the caller's own tasks.
  assert.deepEqual(titles(await listTasks(a)).sort(), ['A one', 'A two']);
  assert.deepEqual((await listTasks(b)).json.tasks, [bOne]);
  assert.deepEqual((await summary(a)).json, { pending: 1, completed: 1, overdue: 0, dueSoon: 0 });
  assert.deepEqual((await summary(b)).json, { pending: 1, completed: 0, overdue: 0, dueSoon: 0 });
  // Filtering by someone else's subject id gives the same empty list as a subject that does not exist: nothing is revealed.
  const other = await listTasks(b, `?subjectId=${aSub.id}`);
  assert.deepEqual(other.json, { tasks: [] });
  assert.deepEqual((await listTasks(b, '?subjectId=4294967295')).json, other.json);
  assert.deepEqual(titles(await listTasks(b, `?q=${encodeURIComponent('A one')}`)), []); // text search cannot reach A's tasks
});

test('TASK-08 and TASK-09: overdue and due-soon boundaries, completed tasks, and summary counts', async () => {
  const u = await makeUser('dates');
  const s = await mkSubject(u, 'Dates');
  const d = { m30: await day(-30), m1: await day(-1), t0: await day(0), p1: await day(1), p3: await day(3), p4: await day(4), p30: await day(30) };
  const mkAt = (title, dueDate) => mk(u, s.id, { title, dueDate });
  const yest = await mkAt('yesterday', d.m1);
  const today = await mkAt('today', d.t0);
  const plus1 = await mkAt('plus1', d.p1);
  const plus3 = await mkAt('plus3', d.p3);
  const plus4 = await mkAt('plus4', d.p4);
  const far = await mkAt('far', d.p30);
  const oldDone = await mkAt('old done', d.m30);
  const todayDone = await mkAt('today done', d.t0);
  await done(u, oldDone.id, true);
  await done(u, todayDone.id, true);

  const flags = async () => Object.fromEntries((await listTasks(u)).json.tasks.map((t) => [t.title, [t.isOverdue, t.isDueSoon]]));
  // TASK-09: yesterday is overdue; today and the next three days are due soon (and not overdue); day 4 and later are neither.
  assert.deepEqual(await flags(), {
    yesterday: [true, false], today: [false, true], plus1: [false, true], plus3: [false, true], plus4: [false, false],
    far: [false, false], 'old done': [false, false], 'today done': [false, false], // TASK-08: a completed task is never overdue
  });
  assert.deepEqual((await get(u, yest.id)).json.task.isOverdue, true);

  // TASK-08: the summary matches the data. pending counts every task that is not completed (overdue and due soon included).
  assert.deepEqual((await summary(u)).json, { pending: 6, completed: 2, overdue: 1, dueSoon: 3 });
  assert.deepEqual(Object.keys((await summary(u)).json), ['pending', 'completed', 'overdue', 'dueSoon']);
  const all = (await listTasks(u)).json.tasks;
  const s1 = (await summary(u)).json;
  assert.equal(all.filter((t) => t.isOverdue).length, s1.overdue);
  assert.equal(all.filter((t) => t.isDueSoon).length, s1.dueSoon);
  assert.equal(all.filter((t) => !t.isCompleted).length, s1.pending);
  assert.equal(all.filter((t) => t.isCompleted).length, s1.completed);
  assert.deepEqual(titles(await listTasks(u, '?status=overdue')), ['yesterday']);

  // Completing the overdue task removes it from overdue; un-completing brings it back.
  assert.equal((await done(u, yest.id, true)).json.task.isOverdue, false);
  assert.deepEqual((await summary(u)).json, { pending: 5, completed: 3, overdue: 0, dueSoon: 3 });
  assert.deepEqual(titles(await listTasks(u, '?status=overdue')), []);
  assert.equal((await done(u, yest.id, false)).json.task.isOverdue, true);
  assert.deepEqual((await summary(u)).json, { pending: 6, completed: 2, overdue: 1, dueSoon: 3 });

  // Changing the due date moves a task across the boundaries (today+4 -> today -> yesterday -> today+4).
  const edit = (id, dueDate) => put(u, id, { title: 'plus4', subjectId: s.id, dueDate });
  assert.deepEqual([(await edit(plus4.id, d.t0)).json.task.isOverdue, (await get(u, plus4.id)).json.task.isDueSoon], [false, true]);
  assert.deepEqual([(await edit(plus4.id, d.m1)).json.task.isOverdue, (await get(u, plus4.id)).json.task.isDueSoon], [true, false]);
  assert.deepEqual([(await edit(plus4.id, d.p4)).json.task.isOverdue, (await get(u, plus4.id)).json.task.isDueSoon], [false, false]);
  assert.deepEqual((await summary(u)).json, { pending: 6, completed: 2, overdue: 1, dueSoon: 3 });
  assert.ok([today, plus1, plus3, far].every((t) => t.id > 0));

  // A user with no tasks gets zeros, not an error.
  assert.deepEqual((await summary(await makeUser('empty'))).json, { pending: 0, completed: 0, overdue: 0, dueSoon: 0 });
});

test('FIL-01 to FIL-05: filters, text search, sorting, combined filters and rejected values', async () => {
  const u = await makeUser('filters');
  const math = await mkSubject(u, 'Math');
  const phy = await mkSubject(u, 'Physics');
  const art = await mkSubject(u, 'Art');
  const yest = await day(-1);
  // Created in this order (so createdAt order is t1..t5); due dates and priorities are chosen to make every sort distinguishable.
  const t1 = await mk(u, math.id, { title: 'Algebra homework', description: 'Chapter 4', priority: 'high', dueDate: '2099-03-10' });
  const t2 = await mk(u, math.id, { title: 'Algebra quiz', priority: 'low', dueDate: '2099-03-15' });
  const t3 = await mk(u, phy.id, { title: 'Lab report', description: 'Use 100% accurate_data', priority: 'medium', dueDate: '2099-03-12' });
  const t4 = await mk(u, art.id, { title: 'Poster', priority: 'high', dueDate: '2099-04-01' });
  const t5 = await mk(u, math.id, { title: 'Old essay', priority: 'medium', dueDate: yest });
  await done(u, t4.id, true);
  const by = async (qs) => { const r = await listTasks(u, qs); assert.equal(r.status, 200, `${qs}: ${r.text}`); return titles(r); };
  const T = { 1: 'Algebra homework', 2: 'Algebra quiz', 3: 'Lab report', 4: 'Poster', 5: 'Old essay' };
  const names = (...n) => n.map((i) => T[i]);

  // Default: all tasks, sorted by due date ascending.
  assert.deepEqual(await by(''), names(5, 1, 3, 2, 4));
  assert.deepEqual(await by('?status=all'), names(5, 1, 3, 2, 4));
  // FIL-01: each filter alone.
  assert.deepEqual(await by(`?subjectId=${math.id}`), names(5, 1, 2));
  assert.deepEqual(await by(`?subjectId=${art.id}`), names(4));
  assert.deepEqual(await by('?priority=high'), names(1, 4));
  assert.deepEqual(await by('?priority=low'), names(2));
  assert.deepEqual(await by('?priority=medium'), names(5, 3));
  assert.deepEqual(await by('?status=pending'), names(5, 1, 3, 2));
  assert.deepEqual(await by('?status=completed'), names(4));
  assert.deepEqual(await by('?status=overdue'), names(5));
  // FIL-02: combined with AND, and an inclusive date range.
  assert.deepEqual(await by(`?subjectId=${math.id}&priority=high`), names(1));
  assert.deepEqual(await by('?status=pending&priority=high'), names(1));
  assert.deepEqual(await by('?status=completed&priority=low'), []);
  assert.deepEqual(await by(`?subjectId=${math.id}&status=pending&priority=medium&dueTo=${yest}`), names(5));
  assert.deepEqual(await by('?dueFrom=2099-03-12&dueTo=2099-03-15'), names(3, 2)); // both ends included
  assert.deepEqual(await by('?dueFrom=2099-03-12&dueTo=2099-03-12'), names(3));
  assert.deepEqual(await by('?dueFrom=2099-03-13'), names(2, 4));
  assert.deepEqual(await by('?dueTo=2099-03-09'), names(5));
  assert.deepEqual(await by('?dueFrom=2099-05-01'), []);
  assert.deepEqual(await by(`?q=algebra&priority=low&subjectId=${math.id}&sort=priority&order=desc`), names(2));
  // FIL-03: text search matches title or description, ignores case and surrounding spaces; % and _ are literal.
  assert.deepEqual(await by('?q=algebra'), names(1, 2));
  assert.deepEqual(await by('?q=ALGEBRA'), names(1, 2));
  assert.deepEqual(await by(`?q=${encodeURIComponent('  algebra  ')}`), names(1, 2));
  assert.deepEqual(await by('?q=chapter'), names(1));
  assert.deepEqual(await by('?q=lab%20rep'), names(3));
  assert.deepEqual(await by(`?q=${encodeURIComponent('100%')}`), names(3));
  assert.deepEqual(await by(`?q=${encodeURIComponent('%')}`), names(3)); // only t3 contains a literal %
  assert.deepEqual(await by(`?q=${encodeURIComponent('_')}`), names(3)); // only t3 contains a literal _
  assert.deepEqual(await by(`?q=${encodeURIComponent('a_c')}`), []); // _ is not a wildcard
  assert.deepEqual(await by('?q=nomatch'), []);
  assert.deepEqual(await by(`?q=${encodeURIComponent('   ')}`), names(5, 1, 3, 2, 4)); // blank means no text filter
  assert.deepEqual(await by(`?q=${'a'.repeat(100)}`), []);
  // FIL-04: sorting. Ties fall back to a fixed order; priority sorts low < medium < high.
  assert.deepEqual(await by('?sort=dueDate&order=asc'), names(5, 1, 3, 2, 4));
  assert.deepEqual(await by('?sort=dueDate&order=desc'), names(4, 2, 3, 1, 5));
  assert.deepEqual(await by('?sort=priority&order=asc'), names(2, 5, 3, 1, 4));
  assert.deepEqual(await by('?sort=priority&order=desc'), names(1, 4, 5, 3, 2));
  assert.deepEqual(await by('?sort=priority'), names(2, 5, 3, 1, 4));
  assert.deepEqual(await by('?sort=createdAt'), names(1, 2, 3, 4, 5));
  assert.deepEqual(await by('?sort=createdAt&order=desc'), names(5, 4, 3, 2, 1));
  assert.deepEqual(await by('?order=desc'), names(4, 2, 3, 1, 5));
  assert.deepEqual(await by('?foo=bar&sort=dueDate'), names(5, 1, 3, 2, 4)); // unknown parameters are ignored
  assert.ok([t1, t2, t3, t5].every((t) => t.id > 0));

  // FIL-04 / FIL-05: bad values are rejected with 400 and nothing is executed; the table is intact afterwards.
  const rejected = [
    [`?sort=${encodeURIComponent('title; DROP TABLE tasks')}`, ['sort']],
    [`?sort=${encodeURIComponent('dueDate; DROP TABLE tasks--')}`, ['sort']],
    ['?sort=title', ['sort']], ['?sort=', ['sort']], ['?sort=DUEDATE', ['sort']], ['?sort=due_date', ['sort']],
    ['?order=up', ['order']], ['?order=ASC', ['order']], ['?order=asc;', ['order']],
    ['?status=done', ['status']], ['?status=dueSoon', ['status']], ['?status=', ['status']],
    ['?priority=urgent', ['priority']], ['?priority=HIGH', ['priority']], ['?priority=', ['priority']],
    ['?subjectId=abc', ['subjectId']], ['?subjectId=0', ['subjectId']], ['?subjectId=-1', ['subjectId']],
    ['?subjectId=1.5', ['subjectId']], ['?subjectId=', ['subjectId']], ['?subjectId=1%20OR%201=1', ['subjectId']],
    ['?subjectId=4294967296', ['subjectId']],
    ['?dueFrom=2026-02-30', ['dueFrom']], ['?dueFrom=bad', ['dueFrom']], ['?dueTo=2026-13-01', ['dueTo']], ['?dueTo=', ['dueTo']],
    ['?dueFrom=2099-03-15&dueTo=2099-03-10', ['dueTo']], // inverted range
    [`?q=${'a'.repeat(101)}`, ['q']],
    ['?status=pending&status=completed', ['status']], ['?sort=dueDate&sort=priority', ['sort']], ['?q=a&q=b', ['q']], // repeated parameter
    ['?sort=bad&order=bad&status=bad&priority=bad&subjectId=bad&dueFrom=bad&dueTo=bad', ['sort', 'order', 'status', 'priority', 'subjectId', 'dueFrom', 'dueTo']],
  ];
  for (const [qs, expected] of rejected) assertFields(await listTasks(u, qs), expected);
  // FIL-05: classic injection strings are treated as plain text: no extra rows, no error, table intact.
  for (const q of ["' OR 1=1 --", "x' OR '1'='1", '"; DROP TABLE tasks; --', "1' UNION SELECT * FROM users --"]) {
    const r = await listTasks(u, `?q=${encodeURIComponent(q)}`);
    assert.equal(r.status, 200, q);
    assert.deepEqual(r.json, { tasks: [] }, q);
  }
  assert.equal(await dbCount('SELECT COUNT(*) AS n FROM tasks WHERE user_id = ?', [u.id]), 5);
  assert.deepEqual(await by(''), names(5, 1, 3, 2, 4));
});

test('Text is stored as plain text and returned exactly; nothing is interpreted', async () => {
  const u = await makeUser('plain');
  const s = await mkSubject(u, 'Plain');
  const odd = ["'; DROP TABLE tasks; --", '<script>alert(1)</script>', '100% _wild_ \\ "quoted"', 'Caf\u00e9 \u4e2d\u6587 \u{1F600}'];
  for (const text of odd) {
    const r = await post(u, { title: text, description: text, subjectId: s.id, dueDate: FAR });
    assert.equal(r.status, 201, text);
    assert.equal(r.json.task.title, text); // stored and returned exactly (S-5: React shows it as text later)
    assert.equal(r.json.task.description, text);
  }
  assert.deepEqual(titles(await listTasks(u)).sort(), [...odd].sort());
  assert.equal((await listTasks(u, `?q=${encodeURIComponent('<script>')}`)).json.tasks.length, 1);
  assert.equal(await dbCount('SELECT COUNT(*) AS n FROM tasks WHERE user_id = ?', [u.id]), odd.length); // table intact
});

test('SUB-04 (API-level): a subject with tasks cannot be deleted; moving or removing the tasks frees it', async () => {
  const [a, b] = [await makeUser('use-a'), await makeUser('use-b')];
  const s = await mkSubject(a, 'In Use');
  const t = await mk(a, s.id, { title: 'Task created through the API' }); // POST /api/tasks, no direct insert

  const d = await delSubject(a, s.id);
  assertError(d, 409, 'SUBJECT_IN_USE');
  assert.match(d.json.error.message, /task/i); // clear message
  assert.deepEqual((await call('GET', '/api/subjects', { cookie: a.cookie })).json.subjects, [s]); // subject still there
  assert.deepEqual((await get(a, t.id)).json.task, t); // task untouched
  assert.equal((await call('PUT', `/api/subjects/${s.id}`, { body: { name: 'In Use (renamed)' }, cookie: a.cookie })).status, 200);
  assertError(await delSubject(b, s.id), 404, 'NOT_FOUND'); // another user gets 404, never 409 (no leak)

  await done(a, t.id, true); // a completed task still references its subject
  assertError(await delSubject(a, s.id), 409, 'SUBJECT_IN_USE');
  assert.equal((await delTask(a, t.id)).status, 204);
  assert.equal((await delSubject(a, s.id)).status, 204); // allowed once its last task is gone
  assert.deepEqual((await call('GET', '/api/subjects', { cookie: a.cookie })).json.subjects, []);

  // Reassigning the task to another subject frees the first one.
  const s1 = await mkSubject(a, 'First');
  const s2 = await mkSubject(a, 'Second');
  const mover = await mk(a, s1.id, { title: 'Mover' });
  assertError(await delSubject(a, s1.id), 409, 'SUBJECT_IN_USE');
  assert.equal((await put(a, mover.id, { title: 'Mover', subjectId: s2.id, dueDate: FAR })).status, 200);
  assert.equal((await delSubject(a, s1.id)).status, 204);
  assertError(await delSubject(a, s2.id), 409, 'SUBJECT_IN_USE');
});

test('SUB-04b: deleting a subject while a task is being created never leaves an orphan or a 500', async () => {
  const u = await makeUser('race');
  for (let i = 0; i < 8; i += 1) {
    const s = await mkSubject(u, `Race ${i}`);
    const [created, deleted] = await Promise.all([
      post(u, { title: `Race task ${i}`, subjectId: s.id, dueDate: FAR }),
      delSubject(u, s.id),
    ]);
    if (created.status === 201) {
      assertError(deleted, 409, 'SUBJECT_IN_USE'); // the task won: the subject is kept
      assert.equal(await dbCount('SELECT COUNT(*) AS n FROM subjects WHERE id = ?', [s.id]), 1);
    } else {
      assertFields(created, ['subjectId']); // the delete won: the task is refused, never a 500
      assert.equal(deleted.status, 204);
      assert.equal(await dbCount('SELECT COUNT(*) AS n FROM tasks WHERE user_id = ? AND title = ?', [u.id, `Race task ${i}`]), 0);
    }
  }
  const orphans = await dbCount(
    'SELECT COUNT(*) AS n FROM tasks t LEFT JOIN subjects s ON s.id = t.subject_id AND s.user_id = t.user_id WHERE t.user_id = ? AND s.id IS NULL',
    [u.id],
  );
  assert.equal(orphans, 0);
});
