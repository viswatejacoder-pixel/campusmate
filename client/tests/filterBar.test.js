// T-080 M5 automated checks: renders FilterBar, TaskItem and DashboardContent to static HTML (same approach as dashboardRender.test.js).
// Static markup cannot type, wait or click, so the live debounce, stale-response behaviour and the Clear button click are covered
// by taskFilters.test.js (logic) and the manual browser checks.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const clientRoot = fileURLToPath(new URL('..', import.meta.url));
let server;
let FilterBar;
let TaskItem;
let DashboardContent;
let EMPTY_FILTERS;

before(async () => {
  server = await createServer({ root: clientRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  FilterBar = (await server.ssrLoadModule('/src/components/FilterBar.jsx')).default;
  TaskItem = (await server.ssrLoadModule('/src/components/TaskItem.jsx')).default;
  DashboardContent = (await server.ssrLoadModule('/src/pages/DashboardPage.jsx')).DashboardContent;
  EMPTY_FILTERS = (await server.ssrLoadModule('/src/utils/taskFilters.js')).EMPTY_FILTERS;
});

after(async () => {
  await server.close();
});

const render = (element) => renderToStaticMarkup(element);
const subjects = [{ id: 1, name: 'Data Structures' }, { id: 2, name: 'DBMS' }];
const task = {
  id: 12, title: 'DS assignment 2', description: '', subjectId: 1, subjectName: 'Data Structures',
  dueDate: '2026-11-02', priority: 'high', isCompleted: false, isOverdue: false, isDueSoon: false,
};
const base = { status: 'ready', error: null, subjects, tasks: [task], onRetry() {}, onFilterChange() {}, onResetFilters() {} };
const someTasks = { pending: 4, completed: 1, overdue: 1, dueSoon: 1 };
const noTasks = { pending: 0, completed: 0, overdue: 0, dueSoon: 0 };
const bar = (filters) => render(h(FilterBar, { filters, subjects, onChange() {}, onReset() {} }));

test('M5-R01 FilterBar has every control and sends only the backend values', () => {
  const html = bar(EMPTY_FILTERS);
  for (const id of ['filter-subject', 'filter-priority', 'filter-status', 'filter-due-from', 'filter-due-to', 'filter-sort', 'filter-order']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  for (const value of ['low', 'medium', 'high', 'pending', 'completed', 'overdue', 'priority', 'createdAt', 'desc']) {
    assert.ok(html.includes(`<option value="${value}"`), value);
  }
  assert.ok(!html.includes('filter-q'), 'the search box moved to the header (TopBar)');
  assert.ok(html.includes('<option value="1">Data Structures</option>') && html.includes('<option value="2">DBMS</option>'));
  assert.ok(!html.includes('value="all"') && !html.includes('value="asc"') && !html.includes('value="dueDate"'), 'server defaults are sent as "not set"');
});

test('M5-R02 Clear filters is disabled when untouched and enabled when anything is set', () => {
  assert.match(bar(EMPTY_FILTERS), /<button[^>]*disabled=""[^>]*>Clear filters/);
  assert.doesNotMatch(bar({ ...EMPTY_FILTERS, order: 'desc' }), /disabled=""[^>]*>Clear filters/);
  assert.doesNotMatch(bar({ ...EMPTY_FILTERS, q: 'dbms' }), /disabled=""[^>]*>Clear filters/);
});

test('M5-R03 an invalid date range shows its error next to the field', () => {
  const html = bar({ ...EMPTY_FILTERS, dueFrom: '2026-11-05', dueTo: '2026-11-04' });
  assert.ok(html.includes('End date must not be before start date.'));
});

test('M5-R04 TaskItem shows Overdue and Due soon indicators as text', () => {
  const overdue = render(h(TaskItem, { task: { ...task, isOverdue: true } }));
  const soon = render(h(TaskItem, { task: { ...task, isDueSoon: true } }));
  const plain = render(h(TaskItem, { task }));
  assert.ok(overdue.includes('task-flag--overdue') && overdue.includes('>Overdue<') && !overdue.includes('Due soon'));
  assert.ok(soon.includes('task-flag--due-soon') && soon.includes('>Due soon<') && !soon.includes('Overdue'));
  assert.ok(!plain.includes('task-flag'));
});

test('M5-R05 tasks exist but none match the filters: "no match" message, bar stays, summary stays', () => {
  const html = render(h(DashboardContent, { ...base, tasks: [], summary: someTasks, filters: { ...EMPTY_FILTERS, status: 'completed' } }));
  assert.ok(html.includes('No tasks match your current filters.'));
  assert.ok(!html.includes('You have no tasks yet.'));
  assert.ok(html.includes('id="filter-subject"'));
  assert.ok(html.includes('<span class="summary-count">4</span><span class="summary-label">Pending</span>'));
});

test('M5-R06 no tasks at all: "no tasks yet" message and no filter bar', () => {
  const html = render(h(DashboardContent, { ...base, tasks: [], summary: noTasks, filters: EMPTY_FILTERS }));
  assert.ok(html.includes('You have no tasks yet.'));
  assert.ok(!html.includes('No tasks match'));
  assert.ok(!html.includes('id="filter-subject"'));
});

test('M5-R07 matching tasks list normally with the filter bar', () => {
  const html = render(h(DashboardContent, { ...base, summary: someTasks, filters: EMPTY_FILTERS }));
  assert.ok(html.includes('DS assignment 2') && html.includes('id="filter-subject"'));
  assert.ok(!html.includes('No tasks match') && !html.includes('You have no tasks yet.'));
});

test('M5-R08 list loading and list error notices keep the old list visible', () => {
  const loading = render(h(DashboardContent, { ...base, summary: someTasks, filters: EMPTY_FILTERS, listLoading: true }));
  assert.ok(loading.includes('Updating tasks...') && loading.includes('DS assignment 2'));
  const failed = render(h(DashboardContent, { ...base, summary: someTasks, filters: EMPTY_FILTERS, listError: new Error('x'), onRetryList() {} }));
  assert.ok(failed.includes('could not be updated and may not match your filters') && failed.includes('DS assignment 2'));
});
