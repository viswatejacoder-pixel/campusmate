// T-080 M3 automated checks: form helpers, runMutation, and the rendered form, dialog and task actions (static markup, no browser).
// Limits: clicks, focus return, <dialog> behaviour and the real requests are covered by the manual browser checks, not here.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const clientRoot = fileURLToPath(new URL('..', import.meta.url));
let server;
let H; // utils/taskForm.js
let runMutation;
let TaskForm;
let ConfirmDialog;
let TaskItem;
let DashboardContent;
let ApiError;

before(async () => {
  server = await createServer({ root: clientRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  H = await server.ssrLoadModule('/src/utils/taskForm.js');
  runMutation = (await server.ssrLoadModule('/src/utils/runMutation.js')).runMutation;
  TaskForm = (await server.ssrLoadModule('/src/components/TaskForm.jsx')).default;
  ConfirmDialog = (await server.ssrLoadModule('/src/components/ConfirmDialog.jsx')).default;
  TaskItem = (await server.ssrLoadModule('/src/components/TaskItem.jsx')).default;
  DashboardContent = (await server.ssrLoadModule('/src/pages/DashboardPage.jsx')).DashboardContent;
  ApiError = (await server.ssrLoadModule('/src/api/client.js')).ApiError;
});

after(async () => {
  await server.close();
});

const render = (element) => renderToStaticMarkup(element);
const subjects = [{ id: 1, name: 'Data Structures' }, { id: 2, name: 'DBMS' }];
const task = {
  id: 12, title: 'DS assignment 2', description: null, subjectId: 2, subjectName: 'DBMS',
  dueDate: '2026-11-02', priority: 'high', isCompleted: false, isOverdue: false, isDueSoon: true,
};
const summary = { pending: 1, completed: 0, overdue: 0, dueSoon: 1 };
const ready = { status: 'ready', error: null, subjects, tasks: [task], summary, onRetry() {} };
const good = { title: ' Essay ', description: '', subjectId: '2', dueDate: '2026-12-01', priority: 'low' };

test('M3-U01 toSubjectId converts digit text with Number() and leaves other input to fail validation', () => {
  assert.equal(H.toSubjectId('3'), 3);
  assert.equal(typeof H.toSubjectId('3'), 'number');
  assert.equal(H.toSubjectId(''), undefined);
  assert.equal(H.toSubjectId('abc'), 'abc');
  assert.equal(H.toSubjectId('0'), '0');
});

test('M3-U02 prepareTaskSubmission sends a numeric subjectId, trims the title and turns an empty description into null', () => {
  const { fields, value } = H.prepareTaskSubmission(good);
  assert.deepEqual(fields, {});
  assert.deepEqual(value, { title: 'Essay', description: null, subjectId: 2, dueDate: '2026-12-01', priority: 'low' });
});

test('M3-U03 prepareTaskSubmission mirrors the server rules for every field', () => {
  const { fields } = H.prepareTaskSubmission({ title: '  ', description: 'x'.repeat(1001), subjectId: '', dueDate: '2026-02-30', priority: 'urgent' });
  assert.deepEqual(Object.keys(fields).sort(), ['description', 'dueDate', 'priority', 'subjectId', 'title']);
  assert.ok(H.prepareTaskSubmission({ ...good, title: 'x'.repeat(151) }).fields.title);
  assert.ok(H.prepareTaskSubmission({ ...good, subjectId: 'abc' }).fields.subjectId);
});

test('M3-U04 initialTaskFormValues: empty defaults for a new task, text values (null description -> "") for an edit', () => {
  assert.deepEqual(H.initialTaskFormValues(), { title: '', description: '', subjectId: '', dueDate: '', priority: 'medium' });
  assert.deepEqual(H.initialTaskFormValues(task), { title: 'DS assignment 2', description: '', subjectId: '2', dueDate: '2026-11-02', priority: 'high' });
});

test('M3-U05 describeSaveError shows API field errors and the API message, and hides unexpected error text', () => {
  const api = new ApiError(400, 'VALIDATION_ERROR', 'Invalid input.', { title: 'Title is required.', unknown: 'Other problem.' });
  const out = H.describeSaveError(api);
  assert.deepEqual(out.fields, { title: 'Title is required.' });
  assert.ok(out.message.includes('Please fix the errors below.') && out.message.includes('Other problem.'));
  assert.equal(H.describeSaveError(new ApiError(404, 'TASK_NOT_FOUND', 'Task not found.')).message, 'Task not found.');
  const unexpected = H.describeSaveError(new TypeError('secret internals'));
  assert.ok(!unexpected.message.includes('secret'));
});

test('M3-U06 runMutation refreshes after success and does not refresh after a failure', async () => {
  const calls = [];
  await runMutation(async () => calls.push('action'), async () => calls.push('refresh'));
  assert.deepEqual(calls, ['action', 'refresh']);

  const failed = [];
  const error = new ApiError(500, 'SERVER_ERROR', 'Boom.');
  await assert.rejects(runMutation(async () => { throw error; }, async () => failed.push('refresh')), error);
  assert.deepEqual(failed, []);
});

test('M3-U07 runMutation refreshes first when the task is gone (404) and still rethrows', async () => {
  const calls = [];
  const error = new ApiError(404, 'TASK_NOT_FOUND', 'Task not found.');
  await assert.rejects(runMutation(async () => { throw error; }, async () => calls.push('refresh')), error);
  assert.deepEqual(calls, ['refresh']);
});

test('M3-R01 TaskForm (new) has labelled title, description, subject, due date and priority controls', () => {
  const html = render(h(TaskForm, { subjects, onSubmit() {}, onCancel() {} }));
  for (const label of ['Title', 'Description (optional)', 'Subject', 'Due date', 'Priority']) assert.ok(html.includes(`>${label}</label>`), label);
  assert.ok(html.includes('New task') && html.includes('Add task'));
  assert.ok(html.includes('<option value="1">Data Structures</option>') && html.includes('type="date"'));
  assert.ok(!html.includes('disabled'));
});

test('M3-R02 TaskForm (edit) is filled from the task and offers Save changes', () => {
  const html = render(h(TaskForm, { task, subjects, onSubmit() {}, onCancel() {} }));
  assert.ok(html.includes('Edit task') && html.includes('Save changes'));
  assert.ok(html.includes('value="DS assignment 2"') && html.includes('value="2026-11-02"'));
  assert.match(html, /<option value="2" selected="">DBMS<\/option>/);
  assert.match(html, /<option value="high" selected="">High<\/option>/);
});

test('M3-R03 TaskForm text is escaped (no unsafe HTML)', () => {
  const html = render(h(TaskForm, { task: { ...task, title: '"><script>alert(1)</script>' }, subjects, onSubmit() {}, onCancel() {} }));
  assert.ok(!html.includes('<script'));
});

test('M3-R04 ConfirmDialog is a named, described dialog with Cancel and confirm buttons', () => {
  const html = render(h(ConfirmDialog, { title: 'Delete this task?', message: 'Gone.', confirmLabel: 'Delete task', busyLabel: 'Deleting...', onConfirm() {}, onCancel() {} }));
  assert.ok(html.includes('<dialog') && html.includes('aria-labelledby="confirm-dialog-title"') && html.includes('aria-describedby="confirm-dialog-message"'));
  assert.ok(html.includes('>Cancel</button>') && html.includes('>Delete task</button>'));
  assert.ok(!html.includes('role="alert"') && !html.includes('disabled'));
});

test('M3-R05 ConfirmDialog while busy disables both buttons and shows the busy label; an error is an alert', () => {
  const html = render(h(ConfirmDialog, { title: 't', message: 'm', confirmLabel: 'Delete task', busyLabel: 'Deleting...', busy: true, error: 'Task not found.', onConfirm() {}, onCancel() {} }));
  assert.equal(html.split('disabled').length - 1, 2);
  assert.ok(html.includes('Deleting...') && html.includes('role="alert"') && html.includes('Task not found.'));
});

test('M3-R06 TaskItem shows named complete, edit and delete buttons only when handlers are given', () => {
  assert.ok(!render(h(TaskItem, { task })).includes('task-actions'));
  const html = render(h(TaskItem, { task, onToggle() {}, onEdit() {}, onDelete() {} }));
  assert.ok(html.includes('aria-label="Mark complete: DS assignment 2"'));
  assert.ok(html.includes('aria-label="Edit task: DS assignment 2"') && html.includes('aria-label="Delete task: DS assignment 2"'));
  assert.ok(render(h(TaskItem, { task: { ...task, isCompleted: true }, onToggle() {} })).includes('aria-label="Mark incomplete: DS assignment 2"'));
});

test('M3-R07 TaskItem action buttons are disabled when locked, and the pending task shows Saving...', () => {
  const locked = render(h(TaskItem, { task, locked: true, onToggle() {}, onEdit() {}, onDelete() {} }));
  assert.equal(locked.split('disabled').length - 1, 3);
  assert.ok(render(h(TaskItem, { task, locked: true, pending: true, onToggle() {} })).includes('Saving...'));
});

test('M3-R08 DashboardContent: Add task button, closed form and no dialog by default', () => {
  const html = render(h(DashboardContent, { ...ready, onNewTask() {}, onSaveTask() {}, onToggleTask() {}, onEditTask() {}, onDeleteTask() {} }));
  assert.ok(html.includes('>Add task</button>'));
  assert.ok(!html.includes('task-form') && !html.includes('<dialog'));
});

test('M3-R09 DashboardContent: while the form is open or a request is busy, Add task and task actions are disabled but tasks stay visible', () => {
  const props = { ...ready, onNewTask() {}, onSaveTask() {}, onToggleTask() {}, onEditTask() {}, onDeleteTask() {}, onCancelForm() {} };
  const open = render(h(DashboardContent, { ...props, form: { task: null } }));
  assert.ok(open.includes('task-form') && open.includes('DS assignment 2'));
  assert.match(open, /<button type="button" disabled="">Add task<\/button>/);
  const busy = render(h(DashboardContent, { ...props, busy: true, pendingTaskId: 12 }));
  assert.ok(busy.includes('Saving...') && busy.includes('DS assignment 2') && busy.includes('<span class="summary-count">1</span>'));
  assert.match(busy, /<button type="button" disabled="">Add task<\/button>/);
});

test('M3-R10 DashboardContent: an action error and a refresh error are alerts, and existing data stays on screen', () => {
  const html = render(h(DashboardContent, { ...ready, actionError: 'Could not update the task.', refreshError: new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.'), onRefresh() {} }));
  assert.ok(html.includes('Could not update the task.') && html.includes('may be out of date') && html.includes('Cannot reach the server.'));
  assert.ok(html.includes('>Refresh</button>') && html.includes('DS assignment 2') && html.includes('<span class="summary-count">1</span>'));
});

test('M3-R11 DashboardContent: delete confirmation names the task, shows its error and the busy state', () => {
  const html = render(h(DashboardContent, { ...ready, deleteTarget: task, deleteError: 'Task not found.', busy: true, onConfirmDelete() {}, onCancelDelete() {} }));
  assert.ok(html.includes('<dialog') && html.includes('&quot;DS assignment 2&quot; will be deleted permanently.'));
  assert.ok(html.includes('Task not found.') && html.includes('Deleting...'));
});

test('M3-R12 DashboardContent: no subjects hides Add task, and M2 read-only rendering still works without M3 props', () => {
  assert.ok(!render(h(DashboardContent, { ...ready, subjects: [], tasks: [], onNewTask() {} })).includes('Add task'));
  const html = render(h(DashboardContent, ready));
  assert.ok(!html.includes('Add task') && !html.includes('task-actions') && html.includes('DS assignment 2'));
});
