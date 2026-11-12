// Design mode (Minimal / Vibrant): the context rules, the auth shell routing and the guards that keep it presentation-only.
// Like the other component tests this renders to static markup: the Minimal/Vibrant click, the crossfade and the real login are
// checked in the browser. `window`, `document` and localStorage are stubbed per test (the context reads them lazily).
import { test, before, after, afterEach } from 'node:test';
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
let ctx;
let shell;
let AuthContext;

before(async () => {
  server = await createServer({ root: clientRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  ctx = await server.ssrLoadModule('/src/context/DesignModeContext.jsx');
  shell = await server.ssrLoadModule('/src/pages/AuthShell.jsx');
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.jsx')).AuthContext;
});
after(async () => {
  await server.close();
});

const realWindow = globalThis.window;
const realDocument = globalThis.document;
function env({ search = '', stored, storageThrows = false } = {}) {
  const store = new Map(stored === undefined ? [] : [[ctx.DESIGN_MODE_KEY, stored]]);
  globalThis.window = {
    location: { search },
    localStorage: {
      getItem: (k) => {
        if (storageThrows) throw new Error('blocked');
        return store.has(k) ? store.get(k) : null;
      },
      setItem: (k, v) => store.set(k, v),
    },
  };
  globalThis.document = { documentElement: { dataset: {} } };
  return store;
}
afterEach(() => {
  if (realWindow === undefined) delete globalThis.window;
  else globalThis.window = realWindow;
  if (realDocument === undefined) delete globalThis.document;
  else globalThis.document = realDocument;
});

test('default mode is Vibrant (only when nothing valid is saved or in the URL); modes and storage key are fixed', () => {
  env();
  assert.equal(ctx.DEFAULT_DESIGN_MODE, 'vibrant');
  assert.deepEqual(ctx.DESIGN_MODES, ['minimal', 'vibrant']);
  assert.equal(ctx.DESIGN_MODE_KEY, 'cm-design-mode');
  assert.equal(ctx.initialDesignMode(), 'vibrant');
});

test('normalizeDesignMode accepts only the two exact names', () => {
  assert.equal(ctx.normalizeDesignMode('minimal'), 'minimal');
  assert.equal(ctx.normalizeDesignMode('vibrant'), 'vibrant');
  for (const bad of ['', 'Minimal', 'VIBRANT', ' vibrant', 'dark', '__proto__', 'constructor', null, undefined, 1, {}]) {
    assert.equal(ctx.normalizeDesignMode(bad), null, String(bad));
  }
});

test('stored choice persists; invalid stored value falls back to the default', () => {
  env({ stored: 'vibrant' });
  assert.equal(ctx.initialDesignMode(), 'vibrant');
  env({ stored: 'minimal' });
  assert.equal(ctx.initialDesignMode(), 'minimal');
  env({ stored: '<script>' });
  assert.equal(ctx.initialDesignMode(), 'vibrant');
  env({ storageThrows: true });
  assert.equal(ctx.initialDesignMode(), 'vibrant');
});

test('URL ?mode wins over storage; an invalid URL value is ignored', () => {
  env({ search: '?mode=vibrant', stored: 'minimal' });
  assert.equal(ctx.initialDesignMode(), 'vibrant');
  env({ search: '?mode=minimal', stored: 'vibrant' });
  assert.equal(ctx.initialDesignMode(), 'minimal');
  env({ search: '?mode=neon', stored: 'vibrant' });
  assert.equal(ctx.initialDesignMode(), 'vibrant');
  env({ search: '?mode=', stored: undefined });
  assert.equal(ctx.initialDesignMode(), 'vibrant');
  env({ search: '?mode=minimal%00&x=1' });
  assert.equal(ctx.initialDesignMode(), 'vibrant');
  env({ search: '?mode=neon', stored: 'minimal' });
  assert.equal(ctx.initialDesignMode(), 'minimal');
  env({ search: '?mode=vibrant', storageThrows: true });
  assert.equal(ctx.initialDesignMode(), 'vibrant');
});

test('initDesignMode mirrors the mode on <html data-design> and never writes storage', () => {
  const store = env({ stored: 'vibrant' });
  assert.equal(ctx.initDesignMode(), 'vibrant');
  assert.equal(globalThis.document.documentElement.dataset.design, 'vibrant');
  env();
  assert.equal(ctx.initDesignMode(), 'vibrant');
  assert.equal(globalThis.document.documentElement.dataset.design, 'vibrant');
  assert.equal(store.get(ctx.DESIGN_MODE_KEY), 'vibrant');
});

test('authKey and transitionDirection pick the page and the slide direction', () => {
  assert.equal(shell.authKey('/login', 'minimal'), 'login:minimal');
  assert.equal(shell.authKey('/login', 'vibrant'), 'login:vibrant');
  assert.equal(shell.authKey('/register', 'minimal'), 'register:minimal');
  assert.equal(shell.authKey('/register', 'vibrant'), 'register:vibrant');
  assert.equal(shell.transitionDirection('login:minimal', 'register:minimal'), 1);
  assert.equal(shell.transitionDirection('register:vibrant', 'login:vibrant'), -1);
  assert.equal(shell.transitionDirection('login:minimal', 'login:vibrant'), 1);
  assert.equal(shell.transitionDirection('login:vibrant', 'login:minimal'), -1);
});

const renderShell = (url, stored) => {
  env({ stored });
  const value = { user: null, status: 'anonymous', login: async () => {}, register: async () => {}, logout: async () => {} };
  const el = h(AuthContext.Provider, { value }, h(MemoryRouter, { initialEntries: [url] }, h(ctx.DesignModeProvider, null, h(shell.default))));
  return renderToStaticMarkup(el);
};

test('/login and /register render the page of the stored mode, with the switch showing that mode', () => {
  const cases = [
    ['/login', 'minimal', 'ml-root', 'rg-root'],
    ['/register', 'minimal', 'rg-root', 'ml-root'],
    ['/login', 'vibrant', 'as-layer--vibrant', 'ml-root'],
    ['/register', 'vibrant', 'as-layer--vibrant', 'rg-root'],
  ];
  for (const [url, mode, present, absent] of cases) {
    const html = renderShell(url, mode);
    assert.ok(html.includes(present), `${url} ${mode} should contain ${present}`);
    assert.ok(!html.includes(absent), `${url} ${mode} should not contain ${absent}`);
    assert.ok(html.includes(`as-layer--${mode}`), `${url} layer is ${mode}`);
    const pressed = [...html.matchAll(/aria-pressed="true"[^>]*>([^<]+)</g)].map((m) => m[1]);
    assert.deepEqual(pressed, [mode === 'minimal' ? 'Minimal' : 'Vibrant']);
  }
});

test('mode is kept across login and register: no mode in the links, only the stored value', () => {
  for (const url of ['/login', '/register']) {
    for (const mode of ['minimal', 'vibrant']) {
      const html = renderShell(url, mode);
      assert.ok(!/href="[^"]*mode=/.test(html), `${url} ${mode}: links must not carry ?mode`);
    }
  }
  assert.ok(renderShell('/login', 'minimal').includes('href="/register"'));
  assert.ok(renderShell('/register', 'vibrant').includes('href="/login"'));
});

test('after logout the anonymous /login shows the same stored mode (return to auth)', () => {
  assert.ok(renderShell('/login', 'vibrant').includes('as-layer--vibrant'));
  assert.ok(renderShell('/login', 'minimal').includes('ml-root'));
});

test('design mode stays presentation-only: auth, API and dashboard code never touch it', () => {
  for (const file of ['../src/context/AuthContext.jsx', '../src/api/client.js', '../src/api/auth.js', '../src/pages/DashboardPage.jsx', '../src/components/ProtectedRoute.jsx']) {
    const src = read(file);
    assert.ok(!/cm-design-mode|DesignMode|data-design|localStorage/.test(src), `${file} must not read or write the design mode`);
  }
  const provider = read('../src/context/DesignModeContext.jsx');
  assert.ok(!/fetch\(|\/api\//.test(provider), 'the mode never goes to the server');
  assert.ok(!/sessionStorage|document\.cookie/.test(provider));
});

test('main.jsx: mode applied before first paint, provider wraps auth and app, Minimal styles load after liquid.css', () => {
  const main = read('../src/main.jsx');
  assert.ok(main.indexOf('initDesignMode();') !== -1 && main.indexOf('initDesignMode();') < main.indexOf('createRoot('));
  assert.ok(main.indexOf('<DesignModeProvider>') < main.indexOf('<AuthProvider>'));
  assert.ok(main.indexOf("./styles/liquid.css") < main.indexOf("./styles/dashboardMinimal.css"));
});

test('real dashboard Minimal styles are scoped to html[data-design="minimal"] only', () => {
  const css = read('../src/styles/dashboardMinimal.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = css.split('{').slice(0, -1).map((chunk) => chunk.split('}').pop().trim()).filter((s) => s && !s.startsWith('@'));
  assert.ok(selectors.length > 20);
  for (const sel of selectors) {
    for (const part of sel.split(',')) assert.ok(part.trim().startsWith(':root[data-design="minimal"]'), `unscoped selector: ${part.trim().slice(0, 80)}`);
  }
});

test('Minimal register follows the global theme like Minimal login (no fixed light surface)', () => {
  assert.ok(/:root\[data-theme="dark"\] \.rg-root\s*\{/.test(read('../src/styles/registerPreview.css')));
  assert.ok(/:root\[data-theme="dark"\] \.ml-root/.test(read('../src/styles/minimalLogin.css')));
});

test('dashboard switch: both modes shown, pressed follows the context (default Vibrant, saved Minimal kept)', async () => {
  const Toggle = (await server.ssrLoadModule('/src/components/DesignModeToggle.jsx')).default;
  const html = (stored) => { env({ stored }); return renderToStaticMarkup(h(ctx.DesignModeProvider, null, h(Toggle))); };
  const pressed = (s) => [...s.matchAll(/aria-pressed="true"[^>]*><span[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.ok(html().includes('aria-label="Design mode"'));
  assert.deepEqual(pressed(html()), ['Vibrant']);
  assert.deepEqual(pressed(html('minimal')), ['Minimal']);
  assert.deepEqual(pressed(html('vibrant')), ['Vibrant']);
  assert.deepEqual(pressed(html('bogus')), ['Vibrant']);
  assert.equal((html().match(/<button/g) || []).length, 2);
});

test('dashboard switch is presentation-only and reuses the context; the untouched default is never saved', () => {
  const toggle = read('../src/components/DesignModeToggle.jsx');
  assert.ok(/useDesignMode/.test(toggle) && /DESIGN_MODES/.test(toggle));
  assert.ok(!/useAuth|useNavigate|navigate\(|<Link|<a |fetch\(|localStorage|location/.test(toggle), 'no navigation, auth, request or own storage');
  assert.ok(read('../src/components/Sidebar.jsx').includes('<DesignModeToggle />'));
  const provider = read('../src/context/DesignModeContext.jsx');
  assert.equal((provider.match(/setItem\(/g) || []).length, 1, 'one write, inside save()');
  assert.ok(!/useEffect\(\(\) => \{[^}]*save\(mode\)/.test(provider), 'the mode itself is not saved on mount');
});

test('design switch styles: base rule plus the phone layout that keeps it inside the viewport', () => {
  const css = read('../src/styles/liquid.css');
  assert.ok(/\.theme-toggle\.design-toggle \.theme-option\s*\{/.test(css));
  assert.ok(/@media \(max-width: 40rem\) \{ \.sidebar-foot \{ flex: 1 1 100%; min-width: 0; \} \}/.test(css));
  assert.ok(/\.sidebar-foot \{ flex-wrap: wrap; \}/.test(css));
});