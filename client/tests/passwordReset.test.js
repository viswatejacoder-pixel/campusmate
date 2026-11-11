// Password-reset client checks: form helpers, the Forgot/Reset views rendered to static markup (like the other component tests) and
// the two API helpers with a stubbed fetch. No server, no database, no network. Show/hide toggling and typing are manual checks.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const clientRoot = fileURLToPath(new URL('..', import.meta.url));
const TOKEN = 'A'.repeat(43);
let server;
let util;
let ForgotView;
let ResetView;
let api;

before(async () => {
  server = await createServer({ root: clientRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  util = await server.ssrLoadModule('/src/utils/passwordReset.js');
  ForgotView = (await server.ssrLoadModule('/src/pages/ForgotPasswordPage.jsx')).ForgotPasswordView;
  ResetView = (await server.ssrLoadModule('/src/pages/ResetPasswordPage.jsx')).ResetPasswordView;
  api = await server.ssrLoadModule('/src/api/auth.js');
});
after(async () => { await server.close(); });

const render = (el) => renderToStaticMarkup(h(MemoryRouter, null, el));
const noop = () => {};
const forgot = (props) => render(h(ForgotView, { phase: 'idle', email: '', onEmailChange: noop, onSubmit: noop, ...props }));
const reset = (props) => render(h(ResetView, { phase: 'form', password: '', confirmPassword: '', onPasswordChange: noop, onConfirmChange: noop, onSubmit: noop, ...props }));

test('PR-C01 readResetToken: accepts only a well-formed 43-character token', () => {
  assert.equal(util.readResetToken(`?token=${TOKEN}`), TOKEN);
  for (const s of ['', '?', '?token=', '?token=abc', `?token=${TOKEN}x`, `?token=${'!'.repeat(43)}`, '?other=1', undefined]) assert.equal(util.readResetToken(s), '', String(s));
});

test('PR-C02 validateForgotForm: trims and lower-cases, requires a valid email', () => {
  assert.deepEqual(util.validateForgotForm({ email: '  A@B.Test ' }), { fields: {}, value: { email: 'a@b.test' } });
  assert.equal(util.validateForgotForm({ email: '' }).fields.email, 'Email is required.');
  assert.equal(util.validateForgotForm({ email: 'nope' }).fields.email, 'Enter a valid email address.');
});

test('PR-C03 validateResetForm: 8-72 characters, bcrypt byte limit, confirmation must match', () => {
  assert.deepEqual(util.validateResetForm({ password: 'New-Pass-1234', confirmPassword: 'New-Pass-1234' }).fields, {});
  assert.equal(util.validateResetForm({ password: 'short', confirmPassword: 'short' }).fields.password, 'Password must be 8 to 72 characters.');
  assert.equal(util.validateResetForm({ password: 'x'.repeat(73), confirmPassword: 'x'.repeat(73) }).fields.password, 'Password must be 8 to 72 characters.');
  assert.ok(util.validateResetForm({ password: 'Ac'.repeat(40), confirmPassword: 'Ac'.repeat(40) }).fields.password, '80 bytes is refused');
  assert.equal(util.validateResetForm({ password: 'New-Pass-1234', confirmPassword: 'Other-Pass-1' }).fields.confirmPassword, 'Passwords do not match.');
  assert.equal(util.validateResetForm({ password: '', confirmPassword: '' }).fields.password, 'Password is required.');
  assert.equal(util.validateResetForm({ password: 'New-Pass-1234', confirmPassword: '' }).fields.confirmPassword, 'Confirm your new password.');
});

test('PR-C04 Forgot view: email form with a way back to login; submitting disables the button', () => {
  const html = forgot({});
  assert.ok(html.includes('type="email"') && html.includes('Send reset link') && html.includes('href="/login"'));
  assert.ok(forgot({ phase: 'submitting' }).includes('disabled'));
  assert.ok(forgot({ fieldErrors: { email: 'Enter a valid email address.' } }).includes('Error: Enter a valid email address.'));
});

test('PR-C05 Forgot view: the "sent" state is neutral (never says whether the account exists) and links back to login', () => {
  const html = forgot({ phase: 'sent', email: 'a@b.test' });
  assert.ok(html.includes('role="status"') && html.includes('If a verified account exists') && html.includes('href="/login"'));
  assert.ok(!html.includes('<form'));
  assert.ok(forgot({ phase: 'error', message: 'Too many requests.' }).includes('role="alert"'));
});

test('PR-C06 Reset view: two masked password fields with Show buttons, linked errors, link back to login', () => {
  const html = reset({ fieldErrors: { password: 'Password must be 8 to 72 characters.', confirmPassword: 'Passwords do not match.' } });
  assert.equal((html.match(/type="password"/g) || []).length, 2);
  assert.equal((html.match(/aria-pressed="false"/g) || []).length, 2);
  assert.ok(html.includes('autoComplete="new-password"') || html.includes('autocomplete="new-password"'));
  assert.ok(html.includes('aria-describedby="password-error"') && html.includes('Error: Passwords do not match.'));
  assert.ok(html.includes('href="/login"'));
});

test('PR-C07 Reset view: invalid/expired link offers a new request; success removes the form and returns to login', () => {
  const bad = reset({ phase: 'invalid' });
  assert.ok(bad.includes('invalid, expired, or already used') && bad.includes('href="/forgot-password"') && bad.includes('href="/login"') && !bad.includes('<form'));
  const ok = reset({ phase: 'success' });
  assert.ok(ok.includes('role="status"') && ok.includes('Password updated') && ok.includes('href="/login"') && !ok.includes('<form'));
  assert.ok(reset({ phase: 'submitting' }).includes('disabled'));
  assert.ok(reset({ formError: 'Too many attempts.' }).includes('role="alert"'));
});

test('PR-C08 API helpers POST JSON to the reset endpoints', async () => {
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return new Response(JSON.stringify({ message: 'ok' }), { status: 202, headers: { 'content-type': 'application/json' } }); };
  try {
    await api.forgotPasswordRequest('a@b.test');
    await api.resetPasswordRequest(TOKEN, 'New-Pass-1234', 'New-Pass-1234');
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.ok(calls[0].url.endsWith('/api/auth/forgot-password') && calls[0].init.method === 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { email: 'a@b.test' });
  assert.ok(calls[1].url.endsWith('/api/auth/reset-password') && calls[1].init.method === 'POST');
  assert.deepEqual(JSON.parse(calls[1].init.body), { token: TOKEN, password: 'New-Pass-1234', confirmPassword: 'New-Pass-1234' });
});
