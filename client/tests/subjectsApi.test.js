// T-080 M1 automated checks for api/subjects.js (no browser, no server, no database): fetch is stubbed.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listSubjects, createSubject, renameSubject, deleteSubject } from '../src/api/subjects.js';
import { ApiError, setUnauthorizedHandler } from '../src/api/client.js';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  setUnauthorizedHandler(null);
});

let calls = [];
const reply = (status, body) => async (url, init) => {
  calls.push({ url, init });
  return { status, ok: status >= 200 && status < 300, json: async () => body };
};
const use = (fn) => { calls = []; globalThis.fetch = fn; };
const err = (status, code, message = 'm', fields) => reply(status, { error: { code, message, ...(fields ? { fields } : {}) } });

test('M1-S01 listSubjects GETs /api/subjects and returns the array', async () => {
  const subjects = [{ id: 1, name: 'Data Structures' }, { id: 2, name: 'DBMS' }];
  use(reply(200, { subjects }));
  assert.deepEqual(await listSubjects(), subjects);
  assert.equal(calls[0].url, '/api/subjects');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.body, undefined);
});

test('M1-S02 createSubject POSTs { name } and returns the subject', async () => {
  use(reply(201, { subject: { id: 5, name: 'Maths' } }));
  assert.deepEqual(await createSubject('Maths'), { id: 5, name: 'Maths' });
  assert.equal(calls[0].url, '/api/subjects');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { name: 'Maths' });
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
});

test('M1-S03 renameSubject PUTs { name } to /api/subjects/:id and returns the subject', async () => {
  use(reply(200, { subject: { id: 5, name: 'Mathematics' } }));
  assert.deepEqual(await renameSubject(5, 'Mathematics'), { id: 5, name: 'Mathematics' });
  assert.equal(calls[0].url, '/api/subjects/5');
  assert.equal(calls[0].init.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[0].init.body), { name: 'Mathematics' });
});

test('M1-S04 deleteSubject DELETEs /api/subjects/:id, sends no body and resolves null on 204', async () => {
  use(reply(204, null));
  assert.equal(await deleteSubject(5), null);
  assert.equal(calls[0].url, '/api/subjects/5');
  assert.equal(calls[0].init.method, 'DELETE');
  assert.equal(calls[0].init.body, undefined);
  assert.equal(calls[0].init.headers['Content-Type'], undefined);
});

test('M1-S05 an id is URL-encoded so it cannot change the path', async () => {
  use(reply(200, { subject: { id: 1, name: 'n' } }));
  await renameSubject('1/../auth/logout', 'n');
  assert.equal(calls[0].url, '/api/subjects/1%2F..%2Fauth%2Flogout');
});

for (const [name, status, code, call] of [
  ['M1-S06 duplicate name on create', 409, 'SUBJECT_EXISTS', () => createSubject('DBMS')],
  ['M1-S07 duplicate name on rename', 409, 'SUBJECT_EXISTS', () => renameSubject(2, 'DBMS')],
  ['M1-S08 delete of a subject that tasks use', 409, 'SUBJECT_IN_USE', () => deleteSubject(2)],
  ['M1-S09 rename of a missing or foreign subject', 404, 'NOT_FOUND', () => renameSubject(99, 'x')],
  ['M1-S10 malformed id', 400, 'BAD_ID', () => deleteSubject('abc')],
]) {
  test(`${name} surfaces ApiError with status ${status} and code ${code}`, async () => {
    use(err(status, code, 'Server message.'));
    await assert.rejects(call, (e) => e instanceof ApiError && e.status === status && e.code === code && e.message === 'Server message.');
  });
}

test('M1-S11 validation error exposes per-field messages', async () => {
  use(err(400, 'VALIDATION_ERROR', 'bad', { name: 'Name is required.' }));
  await assert.rejects(() => createSubject(''), (e) => e.code === 'VALIDATION_ERROR' && e.fields.name === 'Name is required.');
});

test('M1-S12 a 401 reaches the global unauthorized handler and the caller', async () => {
  let handled = null;
  setUnauthorizedHandler((e) => { handled = e; });
  use(err(401, 'UNAUTHENTICATED'));
  await assert.rejects(() => listSubjects(), (e) => e instanceof ApiError && e.status === 401);
  assert.equal(handled.code, 'UNAUTHENTICATED');
});

test('M1-S13 network failure becomes NETWORK_ERROR (status 0)', async () => {
  use(async () => { throw new TypeError('fetch failed'); });
  for (const call of [() => listSubjects(), () => createSubject('x'), () => renameSubject(1, 'x'), () => deleteSubject(1)]) {
    await assert.rejects(call, (e) => e instanceof ApiError && e.status === 0 && e.code === 'NETWORK_ERROR');
  }
});

test('M1-S14 the module uses request() from client.js and never calls fetch itself', () => {
  const source = readFileSync(new URL('../src/api/subjects.js', import.meta.url), 'utf8');
  assert.match(source, /from '\.\/client\.js'/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});
