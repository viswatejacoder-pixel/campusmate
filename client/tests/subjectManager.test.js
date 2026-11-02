// T-080 M4 automated checks: subject manager rendering, error messages and its place in the dashboard (static markup, no browser).
// Limits: clicks, typing, focus return, <dialog> behaviour and the real requests are covered by the manual browser checks, not here.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const clientRoot = fileURLToPath(new URL('..', import.meta.url));
let server;
let SubjectManager;
let DashboardContent;
let describeSubjectError;
let validateSubjectName;
let ApiError;

before(async () => {
  server = await createServer({ root: clientRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  SubjectManager = (await server.ssrLoadModule('/src/components/SubjectManager.jsx')).default;
  DashboardContent = (await server.ssrLoadModule('/src/pages/DashboardPage.jsx')).DashboardContent;
  describeSubjectError = (await server.ssrLoadModule('/src/utils/subjectForm.js')).describeSubjectError;
  validateSubjectName = (await server.ssrLoadModule('/src/utils/validation.js')).validateSubjectName;
  ApiError = (await server.ssrLoadModule('/src/api/client.js')).ApiError;
});

after(async () => {
  await server.close();
});

const render = (element) => renderToStaticMarkup(element);
const noop = () => {};
const handlers = { onCreate: noop, onRename: noop, onDelete: noop };
const subjects = [{ id: 1, name: 'Data Structures' }, { id: 2, name: 'DBMS' }];
const task = {
  id: 12, title: 'DS assignment 2', description: null, subjectId: 1, subjectName: 'Data Structures',
  dueDate: '2026-11-02', priority: 'high', isCompleted: false, isOverdue: false, isDueSoon: true,
};
const summary = { pending: 1, completed: 0, overdue: 0, dueSoon: 1 };
const ready = { status: 'ready', error: null, subjects, tasks: [task], summary, onRetry: noop };
const subjectProps = { onCreateSubject: noop, onRenameSubject: noop, onDeleteSubject: noop };

test('M4-U01 subject names use the server rules: trimmed, 1 to 100 characters', () => {
  assert.deepEqual(validateSubjectName({ name: '  Maths  ' }), { fields: {}, value: { name: 'Maths' } });
  assert.ok(validateSubjectName({ name: '   ' }).fields.name);
  assert.deepEqual(validateSubjectName({ name: 'x'.repeat(100) }).fields, {});
  assert.ok(validateSubjectName({ name: 'x'.repeat(101) }).fields.name);
});

test('M4-U02 describeSubjectError shows the API message (field error, SUBJECT_EXISTS, SUBJECT_IN_USE) and hides unexpected text', () => {
  assert.equal(describeSubjectError(new ApiError(409, 'SUBJECT_EXISTS', 'You already have a subject with that name.'), 'x'), 'You already have a subject with that name.');
  assert.equal(describeSubjectError(new ApiError(409, 'SUBJECT_IN_USE', 'This subject still has tasks.'), 'x'), 'This subject still has tasks.');
  assert.equal(describeSubjectError(new ApiError(400, 'VALIDATION_ERROR', 'Invalid input.', { name: 'Name is required.' }), 'x'), 'Name is required.');
  assert.equal(describeSubjectError(new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.'), 'x'), 'Cannot reach the server.');
  assert.equal(describeSubjectError(new TypeError('secret internals'), 'Fallback.'), 'Fallback.');
});

test('M4-R01 SubjectManager shows an add form and each subject with named Rename and Delete buttons', () => {
  const html = render(h(SubjectManager, { subjects, ...handlers }));
  assert.ok(html.includes('aria-label="Add subject"') && html.includes('>New subject name</label>') && html.includes('>Add subject</button>'));
  assert.ok(html.includes('Data Structures') && html.includes('DBMS'));
  assert.ok(html.includes('aria-label="Rename subject: DBMS"') && html.includes('aria-label="Delete subject: DBMS"'));
  assert.ok(!html.includes('disabled') && !html.includes('<dialog'));
});

test('M4-R02 SubjectManager with no subjects shows the empty message and still offers the add form', () => {
  const html = render(h(SubjectManager, { subjects: [], ...handlers }));
  assert.ok(html.includes('You have no subjects yet. Create a subject first'));
  assert.ok(html.includes('>Add subject</button>') && !html.includes('<ul'));
});

test('M4-R03 SubjectManager controls are all disabled while locked, but the subjects stay visible', () => {
  const html = render(h(SubjectManager, { subjects, locked: true, ...handlers }));
  assert.equal(html.split('disabled').length - 1, 1 + 1 + subjects.length * 2); // name input, Add button, Rename and Delete per subject
  assert.ok(html.includes('Data Structures') && html.includes('DBMS'));
});

test('M4-R04 subject names are escaped (no unsafe HTML)', () => {
  const html = render(h(SubjectManager, { subjects: [{ id: 3, name: '<img src=x onerror=alert(1)>' }], ...handlers }));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<img'));
});

test('M4-R05 DashboardContent shows the subject manager when the subject handlers are given', () => {
  const html = render(h(DashboardContent, { ...ready, ...subjectProps }));
  assert.ok(html.includes('aria-label="Add subject"') && html.includes('aria-label="Rename subject: Data Structures"'));
  assert.ok(html.includes('DS assignment 2') && html.includes('<span class="summary-count">1</span>'));
});

test('M4-R06 DashboardContent with no subjects: manager and create form show, no Add task button, summary still shows', () => {
  const html = render(h(DashboardContent, { ...ready, subjects: [], tasks: [], ...subjectProps, onNewTask: noop }));
  assert.ok(html.includes('You have no subjects yet. Create a subject first') && html.includes('aria-label="Add subject"'));
  assert.ok(!html.includes('>Add task</button>') && html.includes('Summary'));
});

test('M4-R07 subject controls are disabled while a task request runs, the task form is open or a task delete dialog is open', () => {
  const locked = /<button type="button" id="rename-subject-1" class="task-toggle" disabled=""/;
  assert.match(render(h(DashboardContent, { ...ready, ...subjectProps, busy: true })), locked);
  assert.match(render(h(DashboardContent, { ...ready, ...subjectProps, form: { task: null }, onSaveTask: noop })), locked);
  assert.match(render(h(DashboardContent, { ...ready, ...subjectProps, deleteTarget: task, onConfirmDelete: noop })), locked);
});

test('M4-R08 an open task form offers the current subject list, so a new or renamed subject appears in it', () => {
  const updated = [{ id: 1, name: 'Algorithms' }, { id: 2, name: 'DBMS' }, { id: 3, name: 'Networks' }];
  const html = render(h(DashboardContent, { ...ready, subjects: updated, ...subjectProps, form: { task: null }, onSaveTask: noop, onCancelForm: noop }));
  assert.ok(html.includes('<option value="1">Algorithms</option>') && html.includes('<option value="3">Networks</option>'));
  assert.ok(!html.includes('<option value="1">Data Structures</option>'));
});

test('M4-R09 without subject handlers the M2 read-only subject list is unchanged', () => {
  const html = render(h(DashboardContent, ready));
  assert.ok(html.includes('<li class="break-anywhere">Data Structures</li>') && !html.includes('Add subject'));
});
