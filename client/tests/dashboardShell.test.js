// T-090 v2 automated checks: the dashboard shell (Sidebar, TopBar), Upcoming deadlines and Progress panels, rendered to static markup
// like the other component tests. Typing, clicking and the live requests are covered by the manual / mocked browser checks.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const clientRoot = fileURLToPath(new URL('..', import.meta.url));
let server;
let Sidebar;
let TopBar;
let UpcomingDeadlines;
let ProgressPanel;
let progressParts;
let DashboardContent;

before(async () => {
  server = await createServer({ root: clientRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  Sidebar = (await server.ssrLoadModule('/src/components/Sidebar.jsx')).default;
  TopBar = (await server.ssrLoadModule('/src/components/TopBar.jsx')).default;
  UpcomingDeadlines = (await server.ssrLoadModule('/src/components/UpcomingDeadlines.jsx')).default;
  const progress = await server.ssrLoadModule('/src/components/ProgressPanel.jsx');
  ProgressPanel = progress.default;
  progressParts = progress.progressParts;
  DashboardContent = (await server.ssrLoadModule('/src/pages/DashboardPage.jsx')).DashboardContent;
});

after(async () => {
  await server.close();
});

const render = (element) => renderToStaticMarkup(element);
const user = { name: 'Asha Rao', email: 'asha@example.com' };
const task = (id, extra = {}) => ({
  id, title: `Task ${id}`, description: '', subjectId: 1, subjectName: 'DBMS', dueDate: '2026-11-05',
  priority: 'medium', isCompleted: false, isOverdue: false, isDueSoon: false, ...extra,
});
const noop = () => {};

test('V2-S01 Sidebar has labelled navigation with the current page marked, and Log out', () => {
  const html = render(h(Sidebar, { onLogout: noop }));
  assert.ok(html.includes('<nav aria-label="Dashboard sections">'));
  assert.ok(html.includes('aria-current="page"') && html.includes('href="#tasks-heading"') && html.includes('href="#subjects-heading"'));
  assert.ok(html.includes('>Log out</button>'));
  assert.ok(render(h(Sidebar, { onLogout: noop, loggingOut: true })).includes('Logging out...'));
});

test('V2-T01 TopBar has the search input (labelled) and the account name and email', () => {
  const html = render(h(TopBar, { user, search: 'dbms', onSearchChange: noop }));
  assert.ok(html.includes('role="search"') && html.includes('for="task-search"') && html.includes('id="task-search"'));
  assert.ok(html.includes('value="dbms"'));
  assert.ok(html.includes('Asha Rao') && html.includes('asha@example.com'));
  assert.ok(!html.includes('aria-invalid') && !html.includes('field-error'));
});

test('V2-T02 TopBar shows a search error as linked text, and can be disabled; a user without email still renders', () => {
  const html = render(h(TopBar, { user: { name: 'Asha' }, search: 'x', onSearchChange: noop, searchDisabled: true, error: 'Search must be at most 100 characters.' }));
  assert.ok(html.includes('aria-invalid="true"') && html.includes('aria-describedby="task-search-error"'));
  assert.ok(html.includes('id="task-search-error"') && html.includes('Search must be at most 100 characters.'));
  assert.ok(/<input[^>]*disabled=""/.test(html));
  assert.ok(!html.includes('account-email'));
});

test('V2-D01 deadlines: loading, error with retry, empty and list states', () => {
  assert.ok(render(h(UpcomingDeadlines, { deadlines: { status: 'loading', tasks: [] } })).includes('Loading deadlines...'));
  const failed = render(h(UpcomingDeadlines, { deadlines: { status: 'error', tasks: [] }, onRetry: noop }));
  assert.ok(failed.includes('role="alert"') && failed.includes('could not be loaded') && failed.includes('>Try again</button>'));
  assert.ok(render(h(UpcomingDeadlines, { deadlines: { status: 'ready', tasks: [] } })).includes('No pending tasks are due'));
  const list = render(h(UpcomingDeadlines, { deadlines: { status: 'ready', tasks: [task(1), task(2, { isDueSoon: true })] } }));
  assert.ok(list.includes('Task 1') && list.includes('Task 2') && list.includes('<time dateTime="2026-11-05">05 Nov 2026</time>'));
  assert.equal(list.split('>Due soon<').length - 1, 1);
});

test('V2-D02 a failed deadlines request leaves the rest of the dashboard working', () => {
  const summary = { pending: 2, completed: 1, overdue: 0, dueSoon: 1 };
  const html = render(h(DashboardContent, {
    status: 'ready', error: null, subjects: [{ id: 1, name: 'DBMS' }], tasks: [task(7)], summary, onRetry: noop,
    deadlines: { status: 'error', tasks: [] }, onRetryDeadlines: noop,
  }));
  assert.ok(html.includes('Task 7') && html.includes('Upcoming deadlines') && html.includes('could not be loaded'));
  assert.ok(html.includes('id="progress-heading"') && html.includes('id="subjects-heading"'));
  assert.ok(!render(h(DashboardContent, { status: 'ready', error: null, subjects: [], tasks: [], summary, onRetry: noop })).includes('Upcoming deadlines'));
});

test('V2-P01 progressParts uses the real counts: pending includes overdue, zero tasks gives 0%', () => {
  assert.deepEqual(progressParts({ pending: 6, completed: 4, overdue: 2, dueSoon: 1 }), { total: 10, completed: 4, overdue: 2, open: 4, percent: 40 });
  assert.deepEqual(progressParts({ pending: 0, completed: 0, overdue: 0, dueSoon: 0 }), { total: 0, completed: 0, overdue: 0, open: 0, percent: 0 });
  assert.equal(progressParts({ pending: 1, completed: 0, overdue: 5 }).open, 0, 'overdue is never more than pending');
  assert.equal(progressParts(null).total, 0);
});

test('V2-P02 ProgressPanel shows the figures as text, and a plain message with no tasks', () => {
  const html = render(h(ProgressPanel, { summary: { pending: 6, completed: 4, overdue: 2, dueSoon: 1 } }));
  assert.ok(html.includes('<strong>40%</strong> completed (4 of 10 tasks)'));
  for (const [label, count] of [['Completed', 4], ['Pending, not overdue', 4], ['Overdue', 2]]) assert.ok(html.includes(`<dt>${label}</dt><dd>${count}</dd>`), label);
  assert.ok(html.includes('aria-hidden="true"') && html.includes('ring-segment ring-overdue'));
  const empty = render(h(ProgressPanel, { summary: { pending: 0, completed: 0, overdue: 0, dueSoon: 0 } }));
  assert.ok(empty.includes('No tasks yet') && !empty.includes('<svg') && !empty.includes('NaN'));
  assert.ok(!render(h(ProgressPanel, { summary: { pending: 0, completed: 3, overdue: 0, dueSoon: 0 } })).includes('ring-segment ring-overdue'), 'an empty segment is not drawn');
});
