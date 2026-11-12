// Rich dashboard preview (design experiment, preview only) at /dashboard-rich-preview: static-markup checks (incl. the initial light/dark theme),
// pure-helper checks for the local interactions, plus route, isolation and CSS guards. Real clicking and layout are checked in the browser.
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

// The page reads ?theme= from window.location once on first render; stub it only for the duration of one render.
const render = (search = '') => {
  globalThis.window = { location: { search } };
  try {
    return renderToStaticMarkup(h(Page));
  } finally {
    delete globalThis.window;
  }
};

before(async () => {
  server = await createServer({ root: clientRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  Page = (await server.ssrLoadModule('/src/pages/DashboardRichPreviewPage.jsx')).default;
  d = await server.ssrLoadModule('/src/pages/dashboardRichPreviewData.js');
});

after(async () => {
  await server.close();
});

test('renders header, sidebar, stat cards, rings, bars, deadlines, tasks and subjects', () => {
  const html = render();
  assert.match(html, /<h1[^>]*>Good (morning|afternoon|evening), Alex<\/h1>/);
  for (const label of ['Dashboard', 'Tasks', 'Deadlines', 'Subjects']) assert.match(html, new RegExp(`rp-nav-label">${label}<`));
  for (const label of ['Pending', 'Overdue', 'Due soon', 'Completed']) assert.match(html, new RegExp(`rp-stat-label">${label}<`));
  assert.match(html, /aria-current="page"[^>]*>(<svg[\s\S]*?<\/svg>)<span class="rp-nav-label">Dashboard/);
  assert.match(html, /Productivity/);
  assert.match(html, /Upcoming deadlines/);
  assert.match(html, /aria-label="Filter tasks"/);
  assert.match(html, /rp-filter" aria-pressed="true">Today<\/button>/);
  assert.match(html, /aria-label="40% of tasks complete"/);
  assert.equal((html.match(/class="rp-dl"/g) || []).length, 5);
  assert.equal((html.match(/class="rp-card rp-subject"/g) || []).length, d.SUBJECTS.length);
  assert.equal((html.match(/role="progressbar"/g) || []).length, 2 + d.SUBJECTS.length);
  assert.equal((html.match(/<main/g) || []).length, 1);
  assert.equal((html.match(/role="checkbox"/g) || []).length, 4); // default "Today" filter: due today and overdue
  assert.match(html, /aria-label="Add a task"/);
});

test('theme: light by default, dark via ?theme=dark; the toggle reflects the active theme', () => {
  const light = render();
  assert.match(light, /class="rp-root" data-theme="light"/);
  assert.match(light, /rp-seg-btn" aria-pressed="true">(?:(?!<\/button>)[\s\S])*<span>Light<\/span>/);
  assert.match(light, /rp-seg-btn" aria-pressed="false">(?:(?!<\/button>)[\s\S])*<span>Dark<\/span>/);
  const dark = render('?theme=dark');
  assert.match(dark, /class="rp-root" data-theme="dark"/);
  assert.match(dark, /rp-seg-btn" aria-pressed="true">(?:(?!<\/button>)[\s\S])*<span>Dark<\/span>/);
  assert.deepEqual(['?theme=dark', '?theme=light', '?theme=neon', '', '?x=1'].map(d.parseTheme), ['dark', 'light', 'light', 'light', 'light']);
});

test('summary counts, filters and ordering follow the task states', () => {
  const s = d.summarize(d.INITIAL_TASKS);
  assert.deepEqual([s.total, s.done, s.pending, s.overdue, s.dueSoon, s.percent], [15, 6, 9, 2, 4, 40]);
  const ids = (f) => d.filterTasks(d.INITIAL_TASKS, f).map((t) => t.id);
  assert.deepEqual(ids('today'), ['t1', 't2', 't3', 't15']);
  assert.deepEqual(ids('overdue'), ['t1', 't2']);
  assert.equal(ids('pending').length, 9);
  assert.equal(ids('done').length, 6);
  assert.equal(d.filterTasks(d.INITIAL_TASKS, 'all').findIndex((t) => t.done), 9); // open tasks first
  assert.equal(d.filterTasks(d.INITIAL_TASKS, 'nonsense').length, 15); // unknown filter falls back to all
});

test('completing a task updates counts, deadlines, up next, subject progress and weekly activity without mutating the source', () => {
  const before = JSON.stringify(d.INITIAL_TASKS);
  const next = d.toggleTask(d.INITIAL_TASKS, 't1');
  assert.equal(JSON.stringify(d.INITIAL_TASKS), before);
  assert.deepEqual([d.summarize(next).overdue, d.summarize(next).done], [1, 7]);
  assert.equal(d.nextTask(d.INITIAL_TASKS).id, 't1');
  assert.equal(d.nextTask(next).id, 't2');
  assert.ok(!d.upcoming(next).some((t) => t.id === 't1'));
  assert.equal(d.upcoming(d.INITIAL_TASKS).length, 5);
  assert.equal(d.subjectStats(next).find((s) => s.id === 'ds').done, 2);
  assert.equal(d.summarize(d.toggleTask(next, 't1')).done, 6); // toggling back restores it
  assert.equal(d.nextTask(d.INITIAL_TASKS.map((t) => ({ ...t, done: true }))), null);
  const base = d.activity(d.INITIAL_TASKS, 2);
  assert.deepEqual(base.values, [2, 4, 3, null, null, null, null]);
  assert.equal(d.activity(next, 2).values[2], base.values[2] + 1); // completions count towards today
  assert.equal(d.activity(d.INITIAL_TASKS, 2).onPace, true);
  assert.equal(d.activity(d.INITIAL_TASKS, 6).onPace, false);
});

test('add task: trims, validates, caps length, derives priority; empty title is ignored', () => {
  assert.equal(d.addTask(d.INITIAL_TASKS, { title: '   ', subject: 'ds', due: 1 }), d.INITIAL_TASKS);
  const added = d.addTask(d.INITIAL_TASKS, { title: '  Revise   notes ', subject: 'zz', due: 1 });
  assert.equal(added.length, 16);
  const t = added[added.length - 1];
  assert.deepEqual([t.title, t.subject, t.priority, t.due, t.done], ['Revise notes', d.SUBJECTS[0].id, 'high', 1, false]);
  assert.equal(d.addTask(d.INITIAL_TASKS, { title: 'x'.repeat(200), subject: 'os', due: 7 }).at(-1).title.length, 80);
  assert.equal(d.addTask(d.INITIAL_TASKS, { title: 'Later', subject: 'os', due: 7 }).at(-1).priority, 'medium');
  assert.equal(d.INITIAL_TASKS.length, 15);
});

test('labels and statuses', () => {
  assert.equal(d.taskStatus({ done: false, due: -1 }), 'overdue');
  assert.equal(d.taskStatus({ done: false, due: 2 }), 'soon');
  assert.equal(d.taskStatus({ done: false, due: 3 }), 'later');
  assert.equal(d.taskStatus({ done: true, due: -9 }), 'done');
  assert.deepEqual([-2, 0, 1, 4].map(d.dueLabel), ['Overdue 2d', 'Today', 'Tomorrow', 'In 4 days']);
});

test('routing: the rich preview route is added; /dashboard stays protected; every other route is intact', () => {
  const app = read('../src/App.jsx');
  assert.match(app, /<Route element=\{<ProtectedRoute \/>\}>\s*<Route path="\/dashboard" element=\{<DashboardPage \/>\} \/>/);
  for (const r of ['/login" element={null}', '/register" element={null}', '/login-preview" element={<LoginPreviewPage />}', '/register-preview" element={<RegisterPreviewPage />}', '/dashboard-preview" element={<DashboardPreviewPage />}', '/dashboard-rich-preview" element={<DashboardRichPreviewPage />}']) {
    assert.ok(app.includes(`<Route path="${r} />`), r);
  }
  assert.match(app, /import DashboardRichPreviewPage from '\.\/pages\/DashboardRichPreviewPage\.jsx';/);
});

test('isolation: the preview imports nothing from the real dashboard, API, auth, global theme or storage', () => {
  for (const file of ['../src/pages/DashboardRichPreviewPage.jsx', '../src/pages/dashboardRichPreviewData.js']) {
    const src = read(file);
    assert.doesNotMatch(src, /Sidebar|TopBar|SummaryCards|TaskList|SubjectManager|DashboardPage|dashboard\.css|design\.css|liquid\.css|dashboardPreview/, file);
    assert.doesNotMatch(src, /\/api\/|AuthContext|useAuth|utils\/theme|applyTheme|documentElement|dataset\.theme|localStorage|sessionStorage|indexedDB|fetch\(|axios/, file);
  }
});

test('dashboardRichPreview.css: every selector is scoped to .rp-root; light and dark define the same palette; breakpoints exist', () => {
  const css = read('../src/styles/dashboardRichPreview.css').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, list] of css.matchAll(/([^{};]+)\{/g)) {
    const text = list.trim().replace(/\([^()]*\)/g, '()'); // commas inside :is(...) are not selector separators
    if (text.startsWith('@')) continue;
    for (const sel of text.split(',').map((s) => s.trim())) assert.match(sel, /\.rp-root/, `unscoped selector: ${sel}`);
  }
  const vars = (block) => new Set([...block.matchAll(/(--rp-[\w-]+)\s*:/g)].map((m) => m[1]));
  const light = vars(css.slice(css.indexOf('.rp-root {'), css.indexOf('.rp-root[data-theme="dark"]')));
  const dark = vars(css.slice(css.indexOf('.rp-root[data-theme="dark"]'), css.indexOf('.rp-root *,')));
  for (const v of light) if (v !== '--rp-font') assert.ok(dark.has(v), `dark theme is missing ${v}`);
  for (const v of dark) assert.ok(light.has(v), `light theme is missing ${v}`);
  for (const w of [1100, 860, 560]) assert.match(css, new RegExp(`@media \\(max-width: ${w}px\\)`));
  assert.match(css, /prefers-reduced-motion/);
});
