import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const clientRoot = fileURLToPath(new URL('..', import.meta.url));
let server;
let SocialAuthButtons;

before(async () => {
  server = await createServer({ root: clientRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  SocialAuthButtons = (await server.ssrLoadModule('/src/components/SocialAuthButtons.jsx')).default;
});

after(async () => {
  await server.close();
});

test('Apple is disabled and marked Coming Soon while Google remains enabled', () => {
  const html = renderToStaticMarkup(h(SocialAuthButtons));
  assert.match(html, /<button[^>]*>[\s\S]*Continue with Google[\s\S]*<\/button>/);
  assert.match(html, /<button[^>]*disabled=""[^>]*aria-disabled="true"[^>]*aria-label="Continue with Apple - Coming Soon"[\s\S]*Continue with Apple[\s\S]*Coming Soon[\s\S]*<\/button>/);
});
