// T-080 M2 automated checks: renders the dashboard components to static HTML on the server (no browser, no jsdom, no new packages).
// Vite loads the .jsx files exactly as the build does; react-dom/server turns them into markup we can inspect.
// Limits: this checks what is rendered for a given state. It cannot click buttons or run effects, so expanding a description,
// the real fetching and the retry button are covered by the manual browser checks (TESTING.md), not here.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const clientRoot = fileURLToPath(new URL('..', import.meta.url));
let server;
let SummaryCards;
let TaskList;
let TaskItem;
let DashboardContent;
let ApiError;

before(async () => {
  server = await createServer({ root: clientRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  SummaryCards = (await server.ssrLoadModule('/src/components/SummaryCards.jsx')).default;
  TaskList = (await server.ssrLoadModule('/src/components/TaskList.jsx')).default;
  TaskItem = (await server.ssrLoadModule('/src/components/TaskItem.jsx')).default;
  DashboardContent = (await server.ssrLoadModule('/src/pages/DashboardPage.jsx')).DashboardContent;
  ApiError = (await server.ssrLoadModule('/src/api/client.js')).ApiError; // same module instance the page checks against
});

after(async () => {
  await server.close();
});

const render = (element) => renderToStaticMarkup(element);
const summary = { pending: 5, completed: 2, overdue: 1, dueSoon: 3 };
const subjects = [{ id: 1, name: 'Data Structures' }, { id: 2, name: 'DBMS' }];
const task = {
  id: 12, title: 'DS assignment 2', description: 'Chapters 3 and 4', subjectId: 1, subjectName: 'Data Structures',
  dueDate: '2026-11-02', priority: 'high', isCompleted: false, isOverdue: false, isDueSoon: true,
};
const ready = { status: 'ready', error: null, subjects, tasks: [task], summary, onRetry() {} };

test('M2-R01 SummaryCards shows pending, completed, overdue and due soon with their counts', () => {
  const html = render(h(SummaryCards, { summary }));
  for (const [count, label] of [[5, 'Pending'], [2, 'Completed'], [1, 'Overdue'], [3, 'Due soon']]) {
    assert.ok(html.includes(`<span class="summary-count">${count}</span><span class="summary-label">${label}</span>`), label);
  }
});

test('M2-R02 SummaryCards shows zero counts as 0 (not blank)', () => {
  const html = render(h(SummaryCards, { summary: { pending: 0, completed: 0, overdue: 0, dueSoon: 0 } }));
  assert.equal(html.split('<span class="summary-count">0</span>').length - 1, 4);
});

test('M2-R03 TaskList with no tasks shows the empty message and no list', () => {
  const html = render(h(TaskList, { tasks: [] }));
  assert.ok(html.includes('You have no tasks yet.'));
  assert.ok(!html.includes('<ul'));
});

test('M2-R04 TaskItem shows title, subject, DD Mon YYYY due date, priority and pending status', () => {
  const html = render(h(TaskItem, { task }));
  assert.ok(html.includes('DS assignment 2'));
  assert.ok(html.includes('<dt>Subject</dt><dd>Data Structures</dd>'));
  assert.ok(html.includes('<time dateTime="2026-11-02">02 Nov 2026</time>')); // React writes the attribute as dateTime; HTML is case-insensitive
  assert.ok(html.includes('<dt>Priority</dt><dd>High</dd>'));
  assert.ok(html.includes('<dt>Status</dt><dd>Pending</dd>'));
});

test('M2-R05 a completed task shows Completed and the completed style', () => {
  const html = render(h(TaskItem, { task: { ...task, isCompleted: true, priority: 'low' } }));
  assert.ok(html.includes('<dt>Status</dt><dd>Completed</dd>'));
  assert.ok(html.includes('task-item--completed'));
  assert.ok(html.includes('<dt>Priority</dt><dd>Low</dd>'));
});

test('M2-R06 the description is collapsed at first, behind a button that reports aria-expanded="false"', () => {
  const html = render(h(TaskItem, { task }));
  assert.ok(!html.includes('Chapters 3 and 4'));
  assert.ok(!html.includes('task-details'));
  assert.ok(html.includes('aria-expanded="false"'));
  assert.ok(html.includes('Show details'));
  assert.ok(!html.includes('aria-controls'), 'no aria-controls while the details element does not exist');
});

test('M2-R07 task text is escaped: a script tag in the title or subject is shown as text, never as HTML', () => {
  const evil = { ...task, title: '<script>alert(1)</script>', subjectName: '<img src=x onerror=alert(2)>' };
  const html = render(h(TaskList, { tasks: [evil] }));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(2)&gt;'));
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<img'));
});

test('M2-R08 a long title with no spaces gets the wrap class so it cannot break the layout', () => {
  const html = render(h(TaskItem, { task: { ...task, title: 'x'.repeat(150) } }));
  assert.ok(html.includes('class="task-title break-anywhere"'));
});

test('M2-R09 TaskList renders one item per task, in the order given', () => {
  const second = { ...task, id: 13, title: 'Second task' };
  const html = render(h(TaskList, { tasks: [task, second] }));
  assert.equal(html.split('<li class="task-item').length - 1, 2);
  assert.ok(html.indexOf('DS assignment 2') < html.indexOf('Second task'));
});

test('M2-R10 DashboardContent loading shows a status message and no data', () => {
  const html = render(h(DashboardContent, { ...ready, status: 'loading', summary: null, subjects: [], tasks: [] }));
  assert.ok(html.includes('role="status"'));
  assert.ok(html.includes('Loading your dashboard...'));
  assert.ok(!html.includes('Summary'));
});

test('M2-R11 DashboardContent shows an API error message with a Try again button, and no data', () => {
  const error = new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
  const html = render(h(DashboardContent, { ...ready, status: 'error', error, summary: null, subjects: [], tasks: [] }));
  assert.ok(html.includes('role="alert"'));
  assert.ok(html.includes('Cannot reach the server. Check your connection and try again.'));
  assert.ok(html.includes('Try again'));
  assert.ok(!html.includes('Summary'));
});

test('M2-R12 an unexpected (non-API) error shows a generic message and does not leak its text', () => {
  const html = render(h(DashboardContent, { ...ready, status: 'error', error: new TypeError("Cannot read properties of undefined (reading 'x')") }));
  assert.ok(html.includes('Something went wrong while loading your dashboard.'));
  assert.ok(!html.includes('Cannot read properties'));
});

test('M2-R13 no subjects: a clear prompt to create one, the summary still shows, no tasks section', () => {
  const html = render(h(DashboardContent, { ...ready, subjects: [], tasks: [] }));
  assert.ok(html.includes('You have no subjects yet. Create a subject first'));
  assert.ok(html.includes('Summary'));
  assert.ok(!html.includes('subject-list'));
  assert.ok(!html.includes('Tasks</h2>'));
  assert.ok(!html.includes('You have no tasks yet.'));
});

test('M2-R14 subjects but no tasks: subject names are listed and the empty-tasks message shows', () => {
  // M5: "no tasks yet" is decided by the summary (nothing at all), so the fixture must say the user has no tasks.
  const html = render(h(DashboardContent, { ...ready, tasks: [], summary: { pending: 0, completed: 0, overdue: 0, dueSoon: 0 } }));
  assert.ok(html.includes('<li class="break-anywhere">Data Structures</li>'));
  assert.ok(html.includes('<li class="break-anywhere">DBMS</li>'));
  assert.ok(!html.includes('You have no subjects yet.'));
  assert.ok(html.includes('Tasks</h2>'));
  assert.ok(html.includes('You have no tasks yet.'));
});

test('M2-R15 a loaded dashboard shows the counts, the subjects and the tasks together', () => {
  const html = render(h(DashboardContent, ready));
  assert.ok(html.includes('<span class="summary-count">5</span><span class="summary-label">Pending</span>'));
  assert.ok(html.includes('Data Structures'));
  assert.ok(html.includes('DS assignment 2'));
  assert.ok(!html.includes('You have no'));
});

test('M2-R16 no unsafe HTML rendering anywhere in client/src (SEC-02)', () => {
  const files = readdirSync(new URL('../src', import.meta.url), { recursive: true }).filter((f) => /\.(jsx?|html)$/.test(f));
  assert.ok(files.length > 10);
  for (const file of files) {
    const text = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /dangerouslySetInnerHTML|\.innerHTML|insertAdjacentHTML|document\.write/, file);
  }
});
