// T-075 unit tests (no server, no database, no network): the mail transports. Brevo is tested against a fake fetch, so no real email is sent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMailer } from '../src/services/mailer.js';

const TOKEN = 'T'.repeat(43);
const KEY = 'test-api-key-not-real';
const brevo = { transport: 'brevo', appBaseUrl: 'http://localhost:5173', fromEmail: 'sender@example.test', fromName: 'CampusMate', brevoApiKey: KEY, nodeEnv: 'test' };

function fakeFetch(status = 201) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status };
  };
  fn.calls = calls;
  return fn;
}

test('M-01 brevo: correct endpoint, auth header, payload; the name is HTML-escaped; link uses APP_BASE_URL', async () => {
  const f = fakeFetch();
  await createMailer(brevo, f).sendVerificationEmail({ to: 'user@example.test', name: '<b>Eve</b> & "Q"', token: TOKEN });
  assert.equal(f.calls.length, 1);
  const { url, init } = f.calls[0];
  assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['api-key'], KEY);
  assert.equal(init.headers['content-type'], 'application/json');
  assert.ok(init.signal instanceof AbortSignal, 'has a timeout signal');
  const body = JSON.parse(init.body);
  assert.deepEqual(body.sender, { name: 'CampusMate', email: 'sender@example.test' });
  assert.deepEqual(body.to, [{ email: 'user@example.test' }]);
  const link = `http://localhost:5173/verify-email?token=${TOKEN}`;
  assert.ok(body.htmlContent.includes(link) && body.textContent.includes(link));
  assert.ok(!body.htmlContent.includes('<b>Eve</b>'), 'name is escaped in HTML');
  assert.ok(body.htmlContent.includes('&lt;b&gt;Eve&lt;/b&gt; &amp; &quot;Q&quot;'));
  assert.match(body.htmlContent, /30 minutes/);
  assert.ok(!init.body.includes(KEY), 'the API key is never put in the message body');
});

test('M-02 brevo: a non-2xx answer rejects with a short code that does not contain the key or the response', async () => {
  for (const status of [400, 401, 429, 500]) {
    await assert.rejects(
      createMailer(brevo, fakeFetch(status)).sendVerificationEmail({ to: 'u@example.test', name: 'U', token: TOKEN }),
      (err) => {
        assert.equal(err.code, `BREVO_HTTP_${status}`);
        assert.ok(!err.message.includes(KEY));
        return true;
      },
    );
  }
});

test('M-03 brevo: network failures and timeouts propagate for the controller to handle safely', async () => {
  const down = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(createMailer(brevo, down).sendVerificationEmail({ to: 'u@example.test', name: 'U', token: TOKEN }), TypeError);
});

test('M-04 console transport prints the link in development and is refused in production', async () => {
  const lines = [];
  const original = console.log;
  console.log = (...a) => lines.push(a.join(' '));
  try {
    await createMailer({ ...brevo, transport: 'console', nodeEnv: 'development' }, fakeFetch()).sendVerificationEmail({ to: 'u@example.test', name: 'U', token: TOKEN });
  } finally {
    console.log = original;
  }
  assert.ok(lines.join('\n').includes(`/verify-email?token=${TOKEN}`));
  const f = fakeFetch();
  await assert.rejects(
    createMailer({ ...brevo, transport: 'console', nodeEnv: 'production' }, f).sendVerificationEmail({ to: 'u@example.test', name: 'U', token: TOKEN }),
    (err) => err.code === 'MAIL_CONSOLE_IN_PRODUCTION',
  );
  assert.equal(f.calls.length, 0, 'console transport never calls the network');
});
