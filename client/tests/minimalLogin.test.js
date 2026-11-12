// Minimal login design experiment (preview only): static-markup checks like the other component tests, plus isolation guards.
// Typing, clicking and the real login are checked in the browser.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const clientRoot = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
let server;
let AuthContext;
let MinimalLoginPage;
let validateLogin;
let LoginPreviewPage;

before(async () => {
  server = await createServer({ root: clientRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.jsx')).AuthContext;
  const minimal = await server.ssrLoadModule('/src/pages/MinimalLoginPage.jsx');
  MinimalLoginPage = minimal.default;
  validateLogin = minimal.validateLogin;
  LoginPreviewPage = (await server.ssrLoadModule('/src/pages/LoginPreviewPage.jsx')).default;
});

after(async () => {
  await server.close();
});

const render = (el, { status = 'anonymous', url = '/login-preview' } = {}) =>
  renderToStaticMarkup(h(AuthContext.Provider, { value: { user: null, status, login: async () => {} } }, h(MemoryRouter, { initialEntries: [url] }, el)));

test('validateLogin keeps the existing rule: both values must be present', () => {
  assert.deepEqual(Object.keys(validateLogin('', '')).sort(), ['email', 'password']);
  assert.deepEqual(validateLogin('  ', 'x'), { email: 'Email is required.' });
  assert.deepEqual(validateLogin('a@b.c', ''), { password: 'Password is required.' });
  assert.deepEqual(validateLogin('a@b.c', 'x'), {});
});

test('Minimal login renders the real form with the same links and autofill hints', () => {
  const html = render(h(MinimalLoginPage));
  assert.match(html, /<h1[^>]*>Welcome back<\/h1>/);
  assert.match(html, /Continue with Google/);
  assert.match(html, /Continue with Apple/);
  assert.doesNotMatch(html, /href="[^"]*(oauth|google|apple)/i); // no invented provider endpoints
  assert.match(html, /id="ml-email"[^>]*autoComplete="username"|autoComplete="username"[^>]*id="ml-email"|autocomplete="username"/i);
  assert.match(html, /autocomplete="current-password"/i);
  assert.match(html, /type="password"/);
  assert.match(html, /aria-pressed="false"[^>]*aria-label="Show password"|aria-label="Show password"[^>]*aria-pressed="false"/);
  assert.match(html, /href="\/forgot-password"/);
  assert.match(html, /href="\/register"/);
  assert.match(html, /type="submit"/);
  assert.equal((html.match(/<main/g) || []).length, 1);
});

test('an authenticated session redirects instead of rendering the form', () => {
  assert.equal(render(h(MinimalLoginPage), { status: 'authenticated' }), '');
});

test('preview defaults to Minimal and offers a two-option mode selector', () => {
  const html = render(h(LoginPreviewPage));
  assert.match(html, /class="ml-root"/);
  assert.doesNotMatch(html, /auth-card/);
  assert.match(html, /role="group"[^>]*aria-label="Design mode"|aria-label="Design mode"[^>]*role="group"/);
  assert.match(html, /aria-pressed="true"[^>]*>Minimal<\/button>/);
  assert.match(html, /aria-pressed="false"[^>]*>Vibrant<\/button>/);
});

test('Vibrant mode renders the existing LoginPage untouched', () => {
  const html = render(h(LoginPreviewPage), { url: '/login-preview?mode=vibrant' });
  assert.match(html, /class="auth-card"/);
  assert.doesNotMatch(html, /class="ml-root"/);
  assert.match(html, /aria-pressed="true"[^>]*>Vibrant<\/button>/);
});

test('routing: /login still renders LoginPage and /login-preview is a separate route', () => {
  const app = read('../src/App.jsx');
  assert.match(app, /<Route element=\{<AuthShell \/>\}>[\s\S]*<Route path="\/login" element=\{null\} \/>/);
  assert.match(app, /<Route path="\/login-preview" element=\{<LoginPreviewPage \/>\} \/>/);
});

test('isolation: the experiment never touches the theme, storage or the existing login', () => {
  for (const file of ['../src/pages/MinimalLoginPage.jsx', '../src/pages/LoginPreviewPage.jsx']) {
    const src = read(file);
    assert.doesNotMatch(src, /utils\/theme|applyTheme|localStorage|sessionStorage|dataset\.theme/, file);
  }
  assert.doesNotMatch(read('../src/pages/MinimalLoginPage.jsx'), /LoginPage\.jsx/);
});

test('minimalLogin.css is self-contained: no remote assets, scoped selectors, dark theme supported', () => {
  const css = read('../src/styles/minimalLogin.css');
  assert.doesNotMatch(css, /url\(|@import/i);
  assert.match(css, /:root\[data-theme="dark"\] \.ml-root/);
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{[^{}]*\}/g, '{}').replace(/\{\}/g, ',');
  for (const sel of flat.split(',').map((s) => s.replace(/[{}]/g, '').trim()).filter((s) => s && !s.startsWith('@') && !/^(from|to)\b/.test(s))) {
    assert.match(sel, /\.ml-(root|mode)/, `unscoped selector: ${sel}`);
  }
});