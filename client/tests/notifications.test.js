import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const clientRoot = fileURLToPath(new URL('..', import.meta.url));
let server;
let NotificationBell;

before(async () => {
  server = await createServer({ root: clientRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  NotificationBell = (await server.ssrLoadModule('/src/components/NotificationBell.jsx')).default;
});

after(async () => {
  await server.close();
});

test('notification bell is accessible and panel stays closed until user action', () => {
  const html = renderToStaticMarkup(h(NotificationBell));
  assert.match(html, /aria-label="Notifications"/);
  assert.doesNotMatch(html, /Reminder preferences/);
});
