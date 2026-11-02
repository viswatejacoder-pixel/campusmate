// T-080 M1 automated checks for api/tasks.js (no browser, no server, no database): fetch is stubbed.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  listTasks, getTask, createTask, updateTask, setTaskCompleted, deleteTask, getTaskSummary, TASK_QUERY_KEYS, TASK_BODY_KEYS,
} from '../src/api/tasks.js';
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
const task = { id: 12, title: 'DS assignment 2', subjectId: 3, dueDate: '2026-11-02', priority: 'high', isCompleted: false };
const input = { title: 'DS assignment 2', description: 'Linked lists', subjectId: 3, dueDate: '2026-11-02', priority: 'high' };

test('M1-T01 listTasks with no filters GETs /api/tasks (no query string) and returns the array', async () => {
  use(reply(200, { tasks: [task] }));
  assert.deepEqual(await listTasks(), [task]);
  assert.equal(calls[0].url, '/api/tasks');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.body, undefined);
});

test('M1-T02 listTasks sends every supported parameter, in a fixed order', async () => {
  use(reply(200, { tasks: [] }));
  await listTasks({
    order: 'desc', sort: 'priority', dueTo: '2026-11-30', dueFrom: '2026-11-01', status: 'overdue', priority: 'high', subjectId: 3, q: 'lab report',
  });
  assert.equal(
    calls[0].url,
    '/api/tasks?q=lab+report&subjectId=3&priority=high&status=overdue&dueFrom=2026-11-01&dueTo=2026-11-30&sort=priority&order=desc',
  );
  assert.deepEqual(TASK_QUERY_KEYS, ['q', 'subjectId', 'priority', 'status', 'dueFrom', 'dueTo', 'sort', 'order']);
});

test('M1-T03 empty, null and undefined filters are left out; unknown keys are never sent', async () => {
  use(reply(200, { tasks: [] }));
  await listTasks({ q: '', subjectId: '', priority: null, status: 'all', dueFrom: undefined, userId: 99, foo: 'bar' });
  assert.equal(calls[0].url, '/api/tasks?status=all');
  await listTasks({ q: '', subjectId: '' });
  assert.equal(calls[1].url, '/api/tasks');
});

test('M1-T04 special characters in q are encoded and survive a round trip', async () => {
  use(reply(200, { tasks: [] }));
  const q = "100% & <b>x</b> = '; DROP TABLE tasks; --";
  await listTasks({ q });
  assert.equal(new URL(calls[0].url, 'http://x').searchParams.get('q'), q);
  assert.ok(!calls[0].url.includes('&<'));
});

test('M1-T05 getTask GETs /api/tasks/:id and returns the task', async () => {
  use(reply(200, { task }));
  assert.deepEqual(await getTask(12), task);
  assert.equal(calls[0].url, '/api/tasks/12');
  assert.equal(calls[0].init.method, 'GET');
});

test('M1-T06 createTask POSTs only the five editable fields (subjectId stays a number)', async () => {
  use(reply(201, { task }));
  assert.deepEqual(await createTask({ ...input, userId: 7, id: 1, isCompleted: true, completedAt: 'x' }), task);
  assert.equal(calls[0].url, '/api/tasks');
  assert.equal(calls[0].init.method, 'POST');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body, input);
  assert.equal(typeof body.subjectId, 'number');
  assert.deepEqual(TASK_BODY_KEYS, ['title', 'description', 'subjectId', 'dueDate', 'priority']);
});

test('M1-T07 updateTask PUTs the same five fields to /api/tasks/:id', async () => {
  use(reply(200, { task }));
  assert.deepEqual(await updateTask(12, { ...input, userId: 7, isCompleted: true }), task);
  assert.equal(calls[0].url, '/api/tasks/12');
  assert.equal(calls[0].init.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[0].init.body), input);
});

test('M1-T08 a null description is sent (it clears the field); an undefined one is left out', async () => {
  use(reply(200, { task }));
  await updateTask(12, { ...input, description: null });
  assert.equal(JSON.parse(calls[0].init.body).description, null);
  await updateTask(12, { ...input, description: undefined });
  assert.ok(!('description' in JSON.parse(calls[1].init.body)));
});

test('M1-T09 setTaskCompleted PATCHes { isCompleted } to /api/tasks/:id/complete, for true and false', async () => {
  use(reply(200, { task: { ...task, isCompleted: true } }));
  assert.equal((await setTaskCompleted(12, true)).isCompleted, true);
  assert.equal(calls[0].url, '/api/tasks/12/complete');
  assert.equal(calls[0].init.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0].init.body), { isCompleted: true });
  await setTaskCompleted(12, false);
  assert.deepEqual(JSON.parse(calls[1].init.body), { isCompleted: false });
});

test('M1-T10 deleteTask DELETEs /api/tasks/:id, sends no body and resolves null on 204', async () => {
  use(reply(204, null));
  assert.equal(await deleteTask(12), null);
  assert.equal(calls[0].url, '/api/tasks/12');
  assert.equal(calls[0].init.method, 'DELETE');
  assert.equal(calls[0].init.body, undefined);
});

test('M1-T11 an id is URL-encoded so it cannot change the path', async () => {
  use(reply(200, { task }));
  await getTask('1/../subjects');
  await setTaskCompleted('1?x=y', true);
  assert.equal(calls[0].url, '/api/tasks/1%2F..%2Fsubjects');
  assert.equal(calls[1].url, '/api/tasks/1%3Fx%3Dy/complete');
});

for (const [name, status, code, call] of [
  ['M1-T12 task that is missing or owned by someone else', 404, 'NOT_FOUND', () => getTask(99)],
  ['M1-T13 malformed task id', 400, 'BAD_ID', () => deleteTask('abc')],
  ['M1-T14 invalid list filter', 400, 'VALIDATION_ERROR', () => listTasks({ status: 'done' })],
]) {
  test(`${name} surfaces ApiError with status ${status} and code ${code}`, async () => {
    use(err(status, code, 'Server message.'));
    await assert.rejects(call, (e) => e instanceof ApiError && e.status === status && e.code === code && e.message === 'Server message.');
  });
}

test('M1-T15 validation errors expose per-field messages, including "Subject not found."', async () => {
  use(err(400, 'VALIDATION_ERROR', 'bad', { title: 'Title is required.', subjectId: 'Subject not found.' }));
  await assert.rejects(() => createTask({}), (e) => e.fields.title === 'Title is required.' && e.fields.subjectId === 'Subject not found.');
});

test('M1-T16 a 401 reaches the global unauthorized handler and the caller', async () => {
  let handled = null;
  setUnauthorizedHandler((e) => { handled = e; });
  use(err(401, 'UNAUTHENTICATED'));
  await assert.rejects(() => listTasks(), (e) => e instanceof ApiError && e.status === 401);
  assert.equal(handled.code, 'UNAUTHENTICATED');
});

test('M1-T17 network failure becomes NETWORK_ERROR (status 0) for every wrapper', async () => {
  use(async () => { throw new TypeError('fetch failed'); });
  const all = [() => listTasks(), () => getTask(1), () => createTask(input), () => updateTask(1, input), () => setTaskCompleted(1, true), () => deleteTask(1)];
  for (const call of all) {
    await assert.rejects(call, (e) => e instanceof ApiError && e.status === 0 && e.code === 'NETWORK_ERROR');
  }
});

test('M1-T18 the module uses request() from client.js and never calls fetch itself', () => {
  const source = readFileSync(new URL('../src/api/tasks.js', import.meta.url), 'utf8');
  assert.match(source, /from '\.\/client\.js'/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});

test('M2-T01 getTaskSummary GETs /api/tasks/summary and returns the four counts as sent', async () => {
  const counts = { pending: 5, completed: 2, overdue: 1, dueSoon: 3 };
  use(reply(200, counts));
  assert.deepEqual(await getTaskSummary(), counts);
  assert.equal(calls[0].url, '/api/tasks/summary');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.body, undefined);
});

test('M2-T02 getTaskSummary surfaces a 401 to the global handler and the caller', async () => {
  let handled = null;
  setUnauthorizedHandler((e) => { handled = e; });
  use(err(401, 'UNAUTHENTICATED'));
  await assert.rejects(() => getTaskSummary(), (e) => e instanceof ApiError && e.status === 401);
  assert.equal(handled.code, 'UNAUTHENTICATED');
});
