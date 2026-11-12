// T-100 F-5: TRUST_PROXY is opt-in. Child processes load the real app with a process-level TRUST_PROXY (wins over .env;
// .env is never read here). No request is made and nothing is written to the database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const code = "import('./src/app.js').then(m => { console.log('TP=' + m.default.get('trust proxy')); process.exit(0); })";

function load(value) {
  const env = { ...process.env, NODE_ENV: 'development' };
  if (value === undefined) delete env.TRUST_PROXY; else env.TRUST_PROXY = value;
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd, env, encoding: 'utf8', timeout: 20000 });
}

test('TP-01 unset or empty leaves trust proxy off', () => {
  for (const v of [undefined, '']) assert.match(load(v).stdout, /TP=false/);
});

test('TP-02 a hop count of 1 sets trust proxy to exactly 1', () => {
  assert.match(load('1').stdout, /TP=1\b/);
});

test('TP-03 blanket or invalid values stop startup', () => {
  for (const v of ['true', '0', '-1', '1.5', 'loopback', '100']) {
    const r = load(v);
    assert.equal(r.status, 1, `TRUST_PROXY=${v}`);
    assert.match(r.stderr, /TRUST_PROXY must be a whole number/);
  }
});
