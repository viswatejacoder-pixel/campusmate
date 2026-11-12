// Register preview (design experiment, preview only): static-markup checks like the other component tests, plus isolation guards.
// Typing, clicking and the real registration are checked in the browser.
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
let RegisterPreviewPage;
let validateRegister;

before(async () => {
  server = await createServer({ root: clientRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.jsx')).AuthContext;
  const mod = await server.ssrLoadModule('/src/pages/RegisterPreviewPage.jsx');
  RegisterPreviewPage = mod.default;
  validateRegister = mod.validateRegister;
});

after(async () => {
  await server.close();
});

const render = (el, { status = 'anonymous', url = '/register-preview' } = {}) =>
  renderToStaticMarkup(h(AuthContext.Provider, { value: { user: null, status, register: async () => {} } }, h(MemoryRouter, { initialEntries: [url] }, el)));

test('validateRegister keeps the existing Register rules', () => {
  assert.deepEqual(Object.keys(validateRegister({ name: '', email: '', password: '' })).sort(), ['email', 'name', 'password']);
  assert.deepEqual(validateRegister({ name: 'Ada', email: 'ada@uni.edu', password: 'longenough' }), {});
  assert.equal(validateRegister({ name: 'a'.repeat(101), email: 'a@b.c', password: 'longenough' }).name, 'Name must be at most 100 characters.');
  assert.equal(validateRegister({ name: 'A', email: 'nope', password: 'longenough' }).email, 'Enter a valid email address.');
  assert.equal(validateRegister({ name: 'A', email: 'a@b.c', password: 'short' }).password, 'Password must be 8 to 72 characters.');
  assert.equal(validateRegister({ name: 'A', email: 'a@b.c', password: 'x'.repeat(73) }).password, 'Password must be 8 to 72 characters.');
  assert.equal(validateRegister({ name: 'A', email: 'a@b.c', password: '\u00e9'.repeat(40) }).password, 'Password must be 8 to 72 characters.'); // 80 UTF-8 bytes
});

test('renders the real form with the same labels, links and autofill hints', () => {
  const html = render(h(RegisterPreviewPage));
  assert.match(html, /<h1[^>]*>Register<\/h1>/);
  for (const label of ['Name', 'Email', 'Password \\(8 to 72 characters\\)']) assert.match(html, new RegExp(`>${label}</label>`));
  assert.match(html, /autoComplete="name"|autocomplete="name"/i);
  assert.match(html, /autocomplete="email"/i);
  assert.match(html, /autocomplete="new-password"/i);
  assert.match(html, /type="password"/);
  assert.match(html, /aria-label="Show password"/);
  assert.match(html, /Already registered\?/);
  assert.match(html, /href="\/login"/);
  assert.match(html, /type="submit"[^>]*>Register<\/button>|>Register<\/button>/);
  assert.equal((html.match(/<main/g) || []).length, 1);
});

test('artwork is decorative inline SVG: no raster image, browser frame or sign-in text', () => {
  const html = render(h(RegisterPreviewPage));
  assert.match(html, /<svg[^>]*class="rg-art-svg"[^>]*aria-hidden="true"/);
  assert.doesNotMatch(html, /<img|<image/i);
  assert.doesNotMatch(html, /sign in|welcome back/i);
});

test('an authenticated session redirects instead of rendering the form', () => {
  assert.equal(render(h(RegisterPreviewPage), { status: 'authenticated' }), '');
});

test('routing: /register and /login are unchanged and /register-preview is a separate route', () => {
  const app = read('../src/App.jsx');
  assert.match(app, /<Route path="\/register" element=\{null\} \/>/);
  assert.match(app, /<Route path="\/login" element=\{null\} \/>/);
  assert.match(app, /<Route path="\/register-preview" element=\{<RegisterPreviewPage \/>\} \/>/);
});

test('isolation: the preview never touches the theme, storage or the existing Register page', () => {
  const src = read('../src/pages/RegisterPreviewPage.jsx');
  assert.doesNotMatch(src, /utils\/theme|applyTheme|localStorage|sessionStorage|dataset\.theme/);
  assert.doesNotMatch(src, /from '\.\/RegisterPage\.jsx'/);
  assert.match(src, /useAuth\(\)/);
  assert.match(src, /await register\(/);
  assert.doesNotMatch(src, /fetch\(|axios/); // registration goes through the existing auth context only
});

test('registerPreview.css is self-contained, scoped to .rg-root, and strictly monochrome', () => {
  const css = read('../src/styles/registerPreview.css');
  assert.doesNotMatch(css, /url\(|@import/i);
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{[^{}]*\}/g, '{}').replace(/\{\}/g, ',');
  for (const sel of flat.split(',').map((s) => s.replace(/[{}]/g, '').trim()).filter((s) => s && !s.startsWith('@') && !/^(from|to)\b/.test(s))) {
    assert.match(sel, /\.rg-root/, `unscoped selector: ${sel}`);
  }
  const jsx = read('../src/pages/RegisterPreviewPage.jsx');
  for (const [, hex] of (css + jsx).matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    const [r, g, b] = hex.length === 3 ? hex.split('').map((c) => c + c) : hex.match(/../g);
    assert.ok(r === g && g === b, `non-grey colour #${hex}`);
  }
  for (const [, r, g, b] of css.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) assert.ok(r === g && g === b, `non-grey rgb(${r},${g},${b})`);
});
