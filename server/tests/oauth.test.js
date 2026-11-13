import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createOAuthService, getAppleProfile } from '../src/services/oauthService.js';

const config = {
  google: { clientId: 'google-client.test', clientSecret: 'not-a-real-secret', redirectUri: 'https://campusmate.test/api/auth/google/callback' },
  apple: { clientId: '', teamId: '', keyId: '', privateKey: '', redirectUri: '' },
};
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
jwk.kid = 'test-key';

function token(claims) {
  const enc = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const head = enc({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' });
  const body = enc(claims);
  const input = `${head}.${body}`;
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
}

function fakeFetch() {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    return { ok: true, status: 200, json: async () => ({ keys: [jwk] }) };
  };
  fetch.calls = calls;
  return fetch;
}

test('OAuth authorization uses provider endpoint, state, nonce and S256 PKCE without exposing secrets', () => {
  const service = createOAuthService(config);
  const { verifier, challenge } = service.pkce();
  const url = new URL(service.createAuthorizationRequest('google', 'state-value', 'nonce-value', challenge));
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.pathname, '/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('state'), 'state-value');
  assert.equal(url.searchParams.get('nonce'), 'nonce-value');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), challenge);
  assert.ok(verifier.length >= 43);
  assert.ok(!url.href.includes(config.google.clientSecret));
});

test('Apple authorization uses form_post and Apple-supported scopes', () => {
  const apple = {
    ...config,
    apple: { clientId: 'apple-client.test', teamId: 'team.test', keyId: 'key.test', privateKey: 'unused', redirectUri: 'https://campusmate.test/api/auth/apple/callback' },
  };
  const service = createOAuthService(apple);
  const url = new URL(service.createAuthorizationRequest('apple', 'state', 'nonce', 'challenge'));
  assert.equal(url.origin, 'https://appleid.apple.com');
  assert.equal(url.searchParams.get('response_mode'), 'form_post');
  assert.equal(url.searchParams.get('scope'), 'openid email name');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
});

test('Google OIDC signature, issuer, audience and nonce are verified', async () => {
  const fetch = fakeFetch();
  const service = createOAuthService(config, fetch);
  const idToken = token({
    iss: 'https://accounts.google.com',
    aud: config.google.clientId,
    sub: 'provider-subject',
    nonce: 'nonce-value',
    email: 'user@example.test',
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 300,
    iat: Math.floor(Date.now() / 1000),
  });
  const claims = await service.verifyIdToken('google', idToken, 'nonce-value');
  assert.equal(claims.sub, 'provider-subject');
  await assert.rejects(service.verifyIdToken('google', idToken, 'wrong-nonce'), { code: 'OAUTH_INVALID_TOKEN' });
  assert.equal(fetch.calls.length, 2);
});

test('provider HTTP failures and malformed tokens are surfaced as safe OAuth codes', async () => {
  const service = createOAuthService(config, async () => ({ ok: false, status: 401, json: async () => ({ secret: 'ignored' }) }));
  await assert.rejects(service.exchangeCode('google', 'code', 'verifier'), { code: 'OAUTH_GOOGLE_HTTP_401' });
  await assert.rejects(service.verifyIdToken('google', 'not-a-jwt', 'nonce'), { code: 'OAUTH_INVALID_TOKEN' });
});

test('Apple account email comes only from verified token claims, never form-post profile data', () => {
  const forged = getAppleProfile(
    { email: undefined },
    JSON.stringify({ email: 'victim@example.test', name: { firstName: 'Apple', lastName: 'User' } }),
  );
  assert.equal(forged.email, '');
  assert.equal(forged.name, 'Apple User');
  assert.equal(getAppleProfile({ email: 'Verified@Example.test' }, JSON.stringify({ email: 'forged@example.test' })).email, 'verified@example.test');
});
