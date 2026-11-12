// Dashboard preview (design experiment, preview only): static-markup checks, pure-helper checks for the local interactions,
// plus route and CSS isolation guards. Real clicking is checked in the browser.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const clientRoot = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
let server;
let Page;
let d;

before(async () => {
  server = await createServer({ root: clientRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  Page = (await server.ssrLoadModule('/src/pages/DashboardPreviewPage.jsx')).default;
  d = await server.ssrLoadModule('/src/pages/dashboardPreviewData.js');
});

after(async () => {
  await server.close();
});

test('renders the dashboard sections with sidebar, counts, tasks, deadlines and subjects', () => {
  const html = renderToStaticMarkup(h(Page));
  assert.match(html, /<h1[^>]*>Good (morning|afternoon|evening), Alex<\/h1>/);
  for (const label of ['Dashboard', 'Tasks', 'Deadlines', 'Subjects']) assert.match(html, new RegExp(`dp-nav-label">${label}<`));
  for (const label of ['Pending', 'Overdue', 'Due soon', 'Completed']) assert.match(html, new RegExp(`dp-stat-label">${label}<`));
  assert.match(html, /aria-current="page"[^>]*>(<svg[\s\S]*?<\/svg>)<span class="dp-nav-label">Dashboard/);
  assert.match(html, /aria-label="Filter tasks"/);
  assert.match(html, /aria-pressed="true">All<\/button>/);
  assert.match(html, /Upcoming deadlines/);
  assert.equal((html.match(/class="dp-card dp-subject"/g) || []).length, d.SUBJECTS.length);
  assert.equal((html.match(/<main/g) || []).length, 1);
  assert.equal((html.match(/role="checkbox"/g) || []).length, d.INITIAL_TASKS.length);
  assert.equal((html.match(/aria-checked="true"/g) || []).length, d.INITIAL_TASKS.filter((t) => t.done).length);
});

test('summary counts follow the task states', () => {
  const s = d.summarize(d.INITIAL_TASKS);
  assert.deepEqual([s.total, s.done, s.pending, s.overdue, s.dueSoon, s.percent], [14, 6, 8, 2, 3, 43]);
});

test('filters: pending, overdue and completed select the right tasks; open work sorts first', () => {
  const ids = (f) => d.filterTasks(d.INITIAL_TASKS, f).map((t) => t.id);
  assert.equal(ids('all').length, 14);
  assert.deepEqual(ids('overdue'), ['t1', 't2']);
  assert.equal(ids('pending').length, 8);
  assert.ok(ids('done').every((id) => d.INITIAL_TASKS.find((t) => t.id === id).done));
  const all = d.filterTasks(d.INITIAL_TASKS, 'all');
  assert.equal(all.findIndex((t) => t.done), 8); // the 8 open tasks come first
  assert.deepEqual(d.filterTasks(d.INITIAL_TASKS, 'nonsense').length, 14); // unknown filter falls back to all
});

test('completing a task updates counts, deadlines and subject progress, and does not mutate the source', () => {
  const before = JSON.stringify(d.INITIAL_TASKS);
  const next = d.toggleTask(d.INITIAL_TASKS, 't1');
  assert.equal(JSON.stringify(d.INITIAL_TASKS), before);
  assert.equal(d.summarize(next).overdue, 1);
  assert.equal(d.summarize(next).done, 7);
  assert.ok(!d.upcoming(next).some((t) => t.id === 't1'));
  assert.equal(d.subjectStats(next).find((s) => s.id === 'ds').done, 2);
  assert.equal(d.summarize(d.toggleTask(next, 't1')).done, 6); // toggling back restores it
});

test('New task adds a local sample task; labels and statuses', () => {
  const next = d.addSampleTask(d.INITIAL_TASKS);
  assert.equal(next.length, 15);
  assert.equal(d.addSampleTask(next).length, 16);
  assert.equal(d.taskStatus({ done: false, due: -1 }), 'overdue');
  assert.equal(d.taskStatus({ done: false, due: 2 }), 'soon');
  assert.equal(d.taskStatus({ done: false, due: 3 }), 'later');
  assert.equal(d.taskStatus({ done: true, due: -9 }), 'done');
  assert.deepEqual([-2, 0, 1, 4].map(d.dueLabel), ['Overdue 2d', 'Today', 'Tomorrow', 'In 4 days']);
});

test('routing: /dashboard stays protected and unchanged; every other route is intact; the preview route is separate', () => {
  const app = read('../src/App.jsx');
  assert.match(app, /<Route element=\{<ProtectedRoute \/>\}>\s*<Route path="\/dashboard" element=\{<DashboardPage \/>\} \/>/);
  for (const r of ['/login" element={null}', '/register" element={null}', '/login-preview" element={<LoginPreviewPage />}', '/register-preview" element={<RegisterPreviewPage />}', '/dashboard-preview" element={<DashboardPreviewPage />}']) {
    assert.ok(app.includes(`<Route path="${r} />`), r);
  }
});

test('isolation: the preview imports nothing from the real dashboard, API, auth, theme or storage', () => {
  for (const file of ['../src/pages/DashboardPreviewPage.jsx', '../src/pages/dashboardPreviewData.js']) {
    const src = read(file);
    assert.doesNotMatch(src, /Sidebar|TopBar|SummaryCards|TaskList|SubjectManager|DashboardPage|dashboard\.css|design\.css|liquid\.css/, file);
    assert.doesNotMatch(src, /\/api\/|AuthContext|useAuth|utils\/theme|applyTheme|dataset\.theme|localStorage|sessionStorage|indexedDB|fetch\(|axios/, file);
  }
});

test('dashboardPreview.css is self-contained, scoped to .dp-root, and monochrome apart from status colours', () => {
  const css = read('../src/styles/dashboardPreview.css');
  assert.doesNotMatch(css, /url\(|@import|gradient|backdrop-filter/i);
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{[^{}]*\}/g, '{}').replace(/\{\}/g, ',');
  for (const sel of flat.split(',').map((s) => s.replace(/[{}]/g, '').trim()).filter((s) => s && !s.startsWith('@') && !/^(from|to)\b/.test(s))) {
    assert.match(sel, /\.dp-root/, `unscoped selector: ${sel}`);
  }
  const STATUS = new Set(['b42318', 'fef3f2', 'b54708', 'fffaeb']);
  for (const [, hex] of (css + read('../src/pages/DashboardPreviewPage.jsx')).matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    if (STATUS.has(hex.toLowerCase())) continue;
    const [r, g, b] = hex.length === 3 ? hex.split('').map((c) => c + c) : hex.match(/../g);
    assert.ok(r === g && g === b, `non-grey, non-status colour #${hex}`);
  }
});
