import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const clientRoot = fileURLToPath(new URL('..', import.meta.url));
let server;
let theme;

before(async () => {
  server = await createServer({ root: clientRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  theme = await server.ssrLoadModule('/src/utils/theme.js');
});

after(async () => {
  await server.close();
});

afterEach(() => {
  delete globalThis.window;
  delete globalThis.document;
});

test('first visit defaults to light without consulting the system theme', () => {
  const store = new Map();
  globalThis.window = {
    localStorage: { getItem: (key) => store.get(key) || null, setItem: (key, value) => store.set(key, value) },
    matchMedia: () => ({ matches: true }),
  };
  globalThis.document = { documentElement: { dataset: {}, style: {} } };

  assert.equal(theme.DEFAULT_THEME, 'light');
  theme.initTheme();
  assert.equal(globalThis.document.documentElement.dataset.theme, 'light');
  assert.equal(store.size, 0);
});

test('saved theme is applied and manual changes persist for refreshes', () => {
  const store = new Map([['campusmate-theme', 'dark']]);
  globalThis.window = {
    localStorage: { getItem: (key) => store.get(key) || null, setItem: (key, value) => store.set(key, value) },
  };
  globalThis.document = { documentElement: { dataset: {}, style: {} } };

  theme.initTheme();
  assert.equal(globalThis.document.documentElement.dataset.theme, 'dark');
  theme.applyTheme('light');
  assert.equal(store.get('campusmate-theme'), 'light');
  assert.equal(theme.getStoredTheme(), 'light');
});
