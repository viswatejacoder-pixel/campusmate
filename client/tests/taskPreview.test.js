// T-090 v3 automated checks: task preview ranking, the five-task limit, expansion and the search/filter bypass (static markup, like the other component tests).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const clientRoot = fileURLToPath(new URL('..', import.meta.url));
let server;
let DashboardContent;
let previewTasks;
let rankPreviewTasks;
let EMPTY_FILTERS;

before(async () => {
  server = await createServer({ root: clientRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  DashboardContent = (await server.ssrLoadModule('/src/pages/DashboardPage.jsx')).DashboardContent;
  ({ previewTasks, rankPreviewTasks } = await server.ssrLoadModule('/src/utils/taskPreview.js'));
  ({ EMPTY_FILTERS } = await server.ssrLoadModule('/src/utils/taskFilters.js'));
});
after(async () => {
  await server.close();
});

const TODAY = '2026-11-03';
const task = (id, dueDate, extra = {}) => ({
  id, title: `Task-${id}`, description: '', subjectId: 1, subjectName: 'DBMS', dueDate, priority: 'medium',
  isCompleted: false, isOverdue: dueDate < TODAY, isDueSoon: false, ...extra,
});
const ids = (list) => list.map((t) => t.id);
const noop = () => {};

test('V3-R01 ranking: overdue first (longest overdue first), then nearest deadline; completed tasks never appear', () => {
  const tasks = [task(1, '2026-12-01'), task(2, '2026-11-10'), task(3, '2026-10-30'), task(4, '2026-11-01'), task(5, '2026-10-01', { isCompleted: true }), task(6, '2026-11-03')];
  assert.deepEqual(ids(previewTasks(tasks, TODAY)), [3, 4, 6, 2, 1]);
});

test('V3-R02 ranking: at most five, ties by priority then id, a missing date goes last, input is not changed', () => {
  const tasks = [
    task(1, '2026-11-20', { priority: 'low' }), task(2, '2026-11-20', { priority: 'high' }), task(3, '2026-11-20', { priority: 'high' }),
    task(4, '', { isOverdue: false }), task(5, '2026-11-21'), task(6, '2026-11-22'), task(7, '2026-11-23'),
  ];
  const copy = JSON.stringify(tasks);
  const result = previewTasks(tasks, TODAY);
  assert.equal(result.length, 5);
  assert.deepEqual(ids(result), [2, 3, 1, 5, 6]);
  assert.equal(JSON.stringify(tasks), copy);
  assert.equal(rankPreviewTasks([task(9, '2026-11-09'), task(8, '2026-11-08', { isCompleted: true })], TODAY).length, 1);
});

const many = [
  task(1, '2999-01-05'), task(2, '2999-01-02'), task(3, '2000-01-02'), task(4, '2999-01-03'), task(5, '2000-01-01'),
  task(6, '2999-01-04'), task(7, '2999-01-06'), task(8, '2999-01-07'),
  task(9, '2000-02-01', { isCompleted: true }), task(10, '2000-02-02', { isCompleted: true }),
];
const summary = { pending: 8, completed: 2, overdue: 2, dueSoon: 0 };
const render = (props) => renderToStaticMarkup(h(DashboardContent, {
  status: 'ready', error: null, subjects: [{ id: 1, name: 'DBMS' }], tasks: many, summary, onRetry: noop,
  filters: EMPTY_FILTERS, onFilterChange: noop, onResetFilters: noop, onToggleExpanded: noop, ...props,
}));
const titles = (html) => [...html.matchAll(/Task-\d+/g)].map((m) => m[0]).filter((t, i, all) => all.indexOf(t) === i);

test('V3-P01 default preview: five pending tasks in rank order, no completed task, no filter bar, "View all tasks" collapsed', () => {
  const html = render({});
  assert.deepEqual(titles(html), ['Task-5', 'Task-3', 'Task-2', 'Task-4', 'Task-6']);
  assert.ok(!html.includes('class="filter-bar"') && !html.includes('Task-9'));
  assert.ok(html.includes('aria-expanded="false"') && html.includes('View all tasks (10)'));
});

test('V3-P02 expansion shows the complete list (completed too) and the filter bar, with a way back', () => {
  const html = render({ expanded: true });
  assert.equal(titles(html).length, 10);
  assert.ok(html.includes('class="filter-bar"') && html.includes('aria-expanded="true"') && html.includes('Show fewer tasks'));
});

test('V3-P03 an active search or filter bypasses the preview: full filtered list, filter bar, no toggle', () => {
  for (const filters of [{ ...EMPTY_FILTERS, q: 'task' }, { ...EMPTY_FILTERS, priority: 'high' }, { ...EMPTY_FILTERS, status: 'completed' }]) {
    const html = render({ filters });
    assert.equal(titles(html).length, 10);
    assert.ok(html.includes('class="filter-bar"') && !html.includes('View all tasks') && !html.includes('Show fewer'));
  }
  assert.ok(render({ filters: { ...EMPTY_FILTERS, q: 'zzz' }, tasks: [] }).includes('No tasks match your current filters'));
});

test('V3-P04 no toggle when everything is already visible; all-completed shows a message and View all', () => {
  const few = [task(1, '2999-01-01'), task(2, '2999-01-02')];
  const html = render({ tasks: few, summary: { pending: 2, completed: 0, overdue: 0, dueSoon: 0 } });
  assert.equal(titles(html).length, 2);
  assert.ok(!html.includes('View all tasks'));
  const done = render({ tasks: [task(9, '2000-01-01', { isCompleted: true })], summary: { pending: 0, completed: 1, overdue: 0, dueSoon: 0 } });
  assert.ok(done.includes('No pending tasks') && done.includes('View all tasks (1)') && !done.includes('Task-9'));
});

test('V3-P05 without the toggle prop the full list shows as before (existing behaviour kept)', () => {
  const html = render({ onToggleExpanded: undefined });
  assert.equal(titles(html).length, 10);
  assert.ok(html.includes('class="filter-bar"') && !html.includes('View all tasks'));
});
