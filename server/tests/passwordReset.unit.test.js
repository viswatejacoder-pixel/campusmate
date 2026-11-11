// Password-reset checks that need NO server, NO database and NO network: validators, token helpers and the mailer (fetch is stubbed).
// Run: node --test tests/passwordReset.unit.test.js   (from server/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateForgot, validateReset } from '../src/validators/authValidator.js';
import { generateToken, hashToken, TOKEN_RE, RESET_TTL_MINUTES, RESET_COOLDOWN_SECONDS } from '../src/utils/tokens.js';
import { createMailer } from '../src/services/mailer.js';

const PASSWORD = 'New-Pass-1234'; // fake, test-only
const TOKEN = generateToken();
const brevo = { transport: 'brevo', brevoApiKey: 'test-key', fromEmail: 'noreply@example.test', fromName: 'CampusMate', appBaseUrl: 'http://localhost:5173', nodeEnv: 'development' };
const fakeFetch = (status = 201) => {
  const calls = [];
  const f = async (url, init) => { calls.push({ url, init }); return { ok: status >= 200 && status < 300, status }; };
  f.calls = calls;
  return f;
};

test('PR-U01 reset tokens: 256-bit base64url, unique, hashed with SHA-256; reset lifetime is 30 minutes', () => {
  const a = generateToken();
  assert.match(a, TOKEN_RE);
  assert.notEqual(a, generateToken());
  assert.match(hashToken(a), /^[0-9a-f]{64}$/);
  assert.notEqual(hashToken(a), a);
  assert.equal(RESET_TTL_MINUTES, 30);
  assert.ok(RESET_COOLDOWN_SECONDS >= 30);
});

test('PR-U02 validateForgot: email required and well formed, trimmed and lower-cased', () => {
  assert.deepEqual(validateForgot({}).fields, { email: 'Email is required.' });
  assert.equal(validateForgot({ email: 'not-an-email' }).fields.email, 'Enter a valid email address.');
  assert.deepEqual(validateForgot({ email: '  A@B.Test ' }), { fields: {}, value: { email: 'a@b.test' } });
  assert.ok(validateForgot(undefined).fields.email);
  assert.ok(validateForgot({ email: ['a@b.test'] }).fields.email);
});

test('PR-U03 validateReset: accepts a matching 8-72 character password and a well-formed token', () => {
  const r = validateReset({ token: TOKEN, password: PASSWORD, confirmPassword: PASSWORD });
  assert.deepEqual(r.fields, {});
  assert.equal(r.token, TOKEN);
  assert.equal(r.value.password, PASSWORD);
});

test('PR-U04 validateReset: password policy and confirmation', () => {
  assert.equal(validateReset({ token: TOKEN, password: 'short', confirmPassword: 'short' }).fields.password, 'Password must be 8 to 72 characters.');
  assert.equal(validateReset({ token: TOKEN, password: 'x'.repeat(73), confirmPassword: 'x'.repeat(73) }).fields.password, 'Password must be 8 to 72 characters.');
  assert.ok(validateReset({ token: TOKEN, password: 'é'.repeat(40), confirmPassword: 'é'.repeat(40) }).fields.password, '40 characters but 80 bytes: refused (bcrypt limit)');
  assert.equal(validateReset({ token: TOKEN, password: PASSWORD, confirmPassword: 'Other-Pass-5678' }).fields.confirmPassword, 'Passwords do not match.');
  assert.equal(validateReset({ token: TOKEN, password: PASSWORD }).fields.confirmPassword, 'Confirm your new password.');
  assert.equal(validateReset({ token: TOKEN }).fields.password, 'Password is required.');
  assert.ok(!('password' in validateReset({ token: TOKEN, password: 5, confirmPassword: 5 }).fields) === false, 'non-string password is rejected');
});

test('PR-U05 validateReset: malformed, missing or non-string tokens become null (the controller answers them like a wrong token)', () => {
  for (const token of [undefined, null, '', 'abc', TOKEN + 'x', TOKEN.slice(1), `${TOKEN.slice(0, 42)}!`, 42, [TOKEN], { a: 1 }]) {
    assert.equal(validateReset({ token, password: PASSWORD, confirmPassword: PASSWORD }).token, null, String(token));
  }
  assert.equal(validateReset(undefined).token, null);
});

test('PR-U06 mailer: the reset email links to /reset-password?token=, expires in 30 minutes, never contains a password', async () => {
  const f = fakeFetch();
  await createMailer(brevo, f).sendPasswordResetEmail({ to: 'user@example.test', name: '<b>Eve</b> & "Q"', token: TOKEN });
  assert.equal(f.calls.length, 1);
  const body = JSON.parse(f.calls[0].init.body);
  assert.equal(body.subject, 'Reset your CampusMate password');
  assert.deepEqual(body.to, [{ email: 'user@example.test' }]);
  assert.ok(body.textContent.includes(`http://localhost:5173/reset-password?token=${TOKEN}`));
  assert.ok(body.htmlContent.includes(`reset-password?token=${TOKEN}`));
  assert.ok(body.textContent.includes('30 minutes'));
  assert.ok(!body.htmlContent.includes('<b>Eve</b>'), 'the name is HTML-escaped');
  assert.ok(!/password\s*[:=]/i.test(body.textContent));
});

test('PR-U07 mailer: provider failure throws a short code and a network failure rejects (the controller logs the code only)', async () => {
  await assert.rejects(createMailer(brevo, fakeFetch(500)).sendPasswordResetEmail({ to: 'u@example.test', name: 'U', token: TOKEN }), { code: 'BREVO_HTTP_500' });
  const down = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(createMailer(brevo, down).sendPasswordResetEmail({ to: 'u@example.test', name: 'U', token: TOKEN }), TypeError);
});

test('PR-U08 console transport never prints the reset token or link; production refuses the console transport', async () => {
  const printed = [];
  const orig = console.log;
  console.log = (...a) => printed.push(a.join(' '));
  try {
    await createMailer({ ...brevo, transport: 'console' }, fakeFetch()).sendPasswordResetEmail({ to: 'u@example.test', name: 'U', token: TOKEN });
  } finally {
    console.log = orig;
  }
  const out = printed.join('\n');
  assert.ok(!out.includes(TOKEN) && !out.includes('reset-password') && !out.includes('http'), 'no token or URL is logged');
  const f = fakeFetch();
  await assert.rejects(createMailer({ ...brevo, transport: 'console', nodeEnv: 'production' }, f).sendPasswordResetEmail({ to: 'u@example.test', name: 'U', token: TOKEN }), { code: 'MAIL_CONSOLE_IN_PRODUCTION' });
  assert.equal(f.calls.length, 0);
});
