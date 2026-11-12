// T-100 F-3 unit tests for the security headers middleware (no server, no database).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import securityHeaders from '../src/middleware/securityHeaders.js';

function run(path, extra = {}) {
  const headers = {};
  let called = false;
  securityHeaders({ path, ...extra }, { set: (k, v) => { headers[k] = v; } }, () => { called = true; });
  return { headers, called };
}

test('H-01 sets nosniff, no-referrer and frame denial on every response and calls next', () => {
  const { headers, called } = run('/dashboard');
  assert.ok(called);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Referrer-Policy'], 'no-referrer');
  assert.equal(headers['X-Frame-Options'], 'DENY');
});

test('H-02 API paths are no-store; static client paths are not', () => {
  assert.equal(run('/api/auth/me').headers['Cache-Control'], 'no-store');
  assert.equal(run('/api/tasks').headers['Cache-Control'], 'no-store');
  assert.equal(run('/assets/index.js').headers['Cache-Control'], undefined);
});

test('H-03 CSP: scripts and connections are self-only; no framing, plugins or foreign base/form targets', () => {
  const csp = run('/').headers['Content-Security-Policy'];
  for (const d of ["default-src 'self'", "script-src 'self'", "connect-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"]) {
    assert.ok(csp.split('; ').includes(d), `missing ${d}`);
  }
  assert.ok(!/script-src[^;]*unsafe/.test(csp), 'scripts must not allow unsafe-inline or unsafe-eval');
  assert.ok(!/https?:|\*/.test(csp), 'no external hosts or wildcards');
});

test('H-04 HSTS only on a request that is really HTTPS (req.secure); never on plain HTTP', () => {
  assert.equal(run('/', { secure: false }).headers['Strict-Transport-Security'], undefined);
  assert.equal(run('/').headers['Strict-Transport-Security'], undefined);
  assert.match(run('/', { secure: true }).headers['Strict-Transport-Security'], /^max-age=\d+$/);
});
