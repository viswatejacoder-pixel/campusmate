// Sidebar active item: the pure scroll/hash helpers and the static markup. Clicking, gliding and scrolling are checked in a real browser.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { indexFromHash, pickActive } from '../src/utils/navActive.js';

const HREFS = ['#main-content', '#tasks-heading', '#deadlines-heading', '#subjects-heading'];
const line = 300;

test('NAV-01 indexFromHash maps each sidebar hash to its item and anything else to -1', () => {
  HREFS.forEach((href, i) => assert.equal(indexFromHash(href, HREFS), i));
  for (const bad of ['', '#', '#nope', '#tasks', undefined, null, 5]) assert.equal(indexFromHash(bad, HREFS), -1);
});

test('NAV-02 pickActive: Dashboard at the top, then the last target that reached the line', () => {
  assert.equal(pickActive([-50, 900, 1400, 2000], { atTop: true, line }), 0);
  assert.equal(pickActive([-50, 900, 1400, 2000], { line }), 0, 'nothing reached the line: Dashboard');
  assert.equal(pickActive([-400, 120, 700, 1300], { line }), 1, 'Tasks reached the line');
  assert.equal(pickActive([-900, -300, 250, 900], { line }), 2, 'Deadlines reached the line');
  assert.equal(pickActive([-1500, -900, -200, 300], { line }), 3, 'Subjects reached the line (300 is on it)');
  assert.equal(pickActive([-1500, -900, -200, 301], { line }), 2, 'one pixel below the line: not yet');
});

test('NAV-03 pickActive: the page bottom selects the last section even if it never reaches the line', () => {
  assert.equal(pickActive([-1500, -900, -300, 600], { atBottom: true, line }), 3);
  assert.equal(pickActive([-1500, -900, -300, null], { atBottom: true, line }), 2, 'a missing last target is skipped');
  assert.equal(pickActive([null, null, null, null], { atBottom: true, line }), 0);
  assert.equal(pickActive([0, 0, 0, 0], { atTop: true, atBottom: true, line }), 0, 'a page that cannot scroll stays on Dashboard');
});

test('NAV-04 pickActive: targets that are not on the page yet are ignored, and every item can be reached', () => {
  assert.equal(pickActive([-100, null, 100, 900], { line }), 2);
  assert.equal(pickActive([-100, null, null, null], { line }), 0);
  const rows = [[-1, 900, 900, 900], [-1, 0, 900, 900], [-1, -600, 0, 900], [-1, -1200, -600, 0]];
  assert.deepEqual(rows.map((tops) => pickActive(tops, { line })), [0, 1, 2, 3]);
});

test('NAV-06 pickActive: panels on the same row (desktop Tasks beside Deadlines) resolve to the one nearest the viewport top', () => {
  assert.equal(pickActive([-1000, 0, 60, 900], { line }), 1);
  assert.equal(pickActive([-1000, -40, 120, 900], { line }), 1);
  assert.equal(pickActive([-1000, 12, 0, 900], { line }), 2, 'Deadlines scrolled to the top beside Tasks');
  assert.equal(pickActive([-1000, -400, 120, 900], { line }), 2, 'Tasks scrolled well past: Deadlines');
});

let server;
let Sidebar;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  Sidebar = (await server.ssrLoadModule('/src/components/Sidebar.jsx')).default;
});
after(async () => { await server.close(); });

test('NAV-05 Sidebar markup: one bubble, four links, exactly one aria-current (Dashboard first), bubble is decorative', () => {
  const html = renderToStaticMarkup(h(Sidebar, { onLogout() {} }));
  assert.equal((html.match(/class="nav-bubble"/g) || []).length, 1);
  assert.ok(/class="nav-bubble"[^>]*aria-hidden="true"/.test(html) || /aria-hidden="true"[^>]*class="nav-bubble"/.test(html));
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  for (const href of HREFS) assert.ok(html.includes(`href="${href}"`), href);
  assert.ok(/<a[^>]*href="#main-content"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="#main-content"/.test(html), 'Dashboard is current on first render');
});
