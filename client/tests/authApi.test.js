// T-075 M3 automated checks for the client API helpers (no browser, no server, no database): fetch is stubbed.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerRequest, verifyEmailRequest, resendVerificationRequest, loginRequest } from '../src/api/auth.js';
import { ApiError } from '../src/api/client.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

let calls = [];
const reply = (status, body) => async (url, init) => {
  calls.push({ url, init });
  return { status, ok: status >= 200 && status < 300, json: async () => body };
};
const use = (fn) => { calls = []; globalThis.fetch = fn; };
const err = (status, code, message = 'm', fields) => reply(status, { error: { code, message, ...(fields ? { fields } : {}) } });
const TOKEN = 'A'.repeat(43);

test('M3-01 register returns { message } and sends name, email, password as JSON', async () => {
  use(reply(201, { message: 'Account created.' }));
  const r = await registerRequest('A', 'a@x.io', 'password1');
  assert.deepEqual(r, { message: 'Account created.' });
  assert.equal(calls[0].url, '/api/auth/register');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { name: 'A', email: 'a@x.io', password: 'password1' });
});

test('M3-02 verify-email POSTs { token } (never GET, never in the URL)', async () => {
  use(reply(200, { message: 'ok' }));
  await verifyEmailRequest(TOKEN);
  assert.equal(calls[0].url, '/api/auth/verify-email');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { token: TOKEN });
  assert.ok(!calls[0].url.includes(TOKEN));
});

test('M3-03 resend-verification POSTs { email } and resolves on 202', async () => {
  use(reply(202, { message: 'sent' }));
  assert.deepEqual(await resendVerificationRequest('a@x.io'), { message: 'sent' });
  assert.equal(calls[0].url, '/api/auth/resend-verification');
  assert.deepEqual(JSON.parse(calls[0].init.body), { email: 'a@x.io' });
});

for (const [name, status, code, call] of [
  ['M3-04 invalid, expired or used token', 400, 'TOKEN_INVALID_OR_EXPIRED', () => verifyEmailRequest(TOKEN)],
  ['M3-05 verify rate limited', 429, 'RATE_LIMITED', () => verifyEmailRequest(TOKEN)],
  ['M3-06 resend rate limited', 429, 'RATE_LIMITED', () => resendVerificationRequest('a@x.io')],
  ['M3-07 unverified login', 403, 'EMAIL_NOT_VERIFIED', () => loginRequest('a@x.io', 'password1')],
  ['M3-08 login rate limited', 429, 'RATE_LIMITED', () => loginRequest('a@x.io', 'password1')],
]) {
  test(`${name} surfaces ApiError with status ${status} and code ${code}`, async () => {
    use(err(status, code));
    await assert.rejects(call, (e) => e instanceof ApiError && e.status === status && e.code === code);
  });
}

test('M3-09 resend validation error exposes per-field messages', async () => {
  use(err(400, 'VALIDATION_ERROR', 'bad', { email: 'Enter a valid email address.' }));
  await assert.rejects(() => resendVerificationRequest('x'), (e) => e.code === 'VALIDATION_ERROR' && e.fields.email === 'Enter a valid email address.');
});

test('M3-10 network failure becomes NETWORK_ERROR (status 0) for every new helper', async () => {
  use(async () => { throw new TypeError('fetch failed'); });
  for (const call of [() => registerRequest('A', 'a@x.io', 'password1'), () => verifyEmailRequest(TOKEN), () => resendVerificationRequest('a@x.io')]) {
    await assert.rejects(call, (e) => e instanceof ApiError && e.status === 0 && e.code === 'NETWORK_ERROR');
  }
});

test('M3-11 a non-JSON error reply (proxy up, server down) becomes SERVER_UNAVAILABLE', async () => {
  use(async () => ({ status: 502, ok: false, json: async () => { throw new Error('not json'); } }));
  await assert.rejects(() => verifyEmailRequest(TOKEN), (e) => e.code === 'SERVER_UNAVAILABLE');
});
