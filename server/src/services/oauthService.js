import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, timingSafeEqual, verify } from 'node:crypto';

const GOOGLE = {
  authorization: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  jwks: 'https://www.googleapis.com/oauth2/v3/certs',
  issuer: 'https://accounts.google.com',
};
const APPLE = {
  authorization: 'https://appleid.apple.com/auth/authorize',
  token: 'https://appleid.apple.com/auth/token',
  jwks: 'https://appleid.apple.com/auth/keys',
  issuer: 'https://appleid.apple.com',
};

const b64url = (value) => Buffer.from(value).toString('base64url');
const decode = (value) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
const same = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
};

export function verifiedEmailFromClaims(claims) {
  return typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
}

export function getAppleProfile(claims, formPostUser) {
  let name = typeof claims.name === 'string' ? claims.name.trim() : '';
  if (typeof formPostUser === 'string') {
    try {
      const user = JSON.parse(formPostUser);
      if (!name && user.name) name = `${user.name.firstName || ''} ${user.name.lastName || ''}`.trim();
    } catch { /* the verified token remains authoritative */ }
  }
  return { email: verifiedEmailFromClaims(claims), name };
}

function providerConfig(config, provider) {
  return provider === 'google' ? GOOGLE : APPLE;
}

function clientId(config, provider) {
  return provider === 'google' ? config.google.clientId : config.apple.clientId;
}

function assertConfigured(config, provider) {
  const values = provider === 'google'
    ? [config.google.clientId, config.google.clientSecret, config.google.redirectUri]
    : [config.apple.clientId, config.apple.teamId, config.apple.keyId, config.apple.privateKey, config.apple.redirectUri];
  if (values.some((value) => !value)) throw Object.assign(new Error('OAuth provider is not configured'), { code: `OAUTH_${provider.toUpperCase()}_NOT_CONFIGURED` });
}

function appleClientSecret(config) {
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: config.apple.keyId, typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: config.apple.teamId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 5 * 60,
    aud: 'https://appleid.apple.com',
    sub: config.apple.clientId,
  }));
  const input = `${header}.${payload}`;
  const key = createPrivateKey(config.apple.privateKey.replace(/\\n/g, '\n'));
  return `${input}.${sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

async function jsonResponse(res, provider) {
  if (!res.ok) throw Object.assign(new Error('OAuth provider request failed'), { code: `OAUTH_${provider.toUpperCase()}_HTTP_${res.status}` });
  return res.json();
}

function derSignature(raw) {
  const part = (offset) => {
    let value = Buffer.from(raw.subarray(offset, offset + 32));
    while (value.length > 1 && value[0] === 0) value = value.subarray(1);
    if (value[0] & 0x80) value = Buffer.concat([Buffer.from([0]), value]);
    return Buffer.concat([Buffer.from([0x02, value.length]), value]);
  };
  const body = Buffer.concat([part(0), part(32)]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

export function createOAuthService(config, fetchImpl = fetch) {
  async function exchangeCode(provider, code, verifier) {
    assertConfigured(config, provider);
    const settings = providerConfig(config, provider);
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: provider === 'google' ? config.google.redirectUri : config.apple.redirectUri,
      client_id: clientId(config, provider),
      code_verifier: verifier,
    });
    if (provider === 'google') body.set('client_secret', config.google.clientSecret);
    else body.set('client_secret', appleClientSecret(config));
    const response = await fetchImpl(settings.token, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body });
    return jsonResponse(response, provider);
  }

  async function verifyIdToken(provider, idToken, nonce) {
    assertConfigured(config, provider);
    const parts = typeof idToken === 'string' ? idToken.split('.') : [];
    if (parts.length !== 3) throw Object.assign(new Error('Invalid provider token'), { code: 'OAUTH_INVALID_TOKEN' });
    let header;
    let claims;
    try {
      header = decode(parts[0]);
      claims = decode(parts[1]);
    } catch {
      throw Object.assign(new Error('Invalid provider token'), { code: 'OAUTH_INVALID_TOKEN' });
    }
    const settings = providerConfig(config, provider);
    if ((provider === 'google' && header.alg !== 'RS256') || (provider === 'apple' && header.alg !== 'ES256') || !header.kid) {
      throw Object.assign(new Error('Invalid provider token'), { code: 'OAUTH_INVALID_TOKEN' });
    }
    const jwks = await jsonResponse(await fetchImpl(settings.jwks, { headers: { accept: 'application/json' } }), provider);
    const jwk = jwks.keys.find((key) => key.kid === header.kid);
    if (!jwk) throw Object.assign(new Error('Invalid provider token'), { code: 'OAUTH_INVALID_TOKEN' });
    const key = createPublicKey({ key: jwk, format: 'jwk' });
    const signature = Buffer.from(parts[2], 'base64url');
    const validSignature = verify(
      provider === 'apple' ? 'sha256' : 'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      { key, dsaEncoding: provider === 'apple' ? 'der' : undefined },
      provider === 'apple' ? derSignature(signature) : signature,
    );
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const now = Math.floor(Date.now() / 1000);
    if (!validSignature || claims.iss !== settings.issuer || !audience.includes(clientId(config, provider)) || !same(claims.nonce, nonce) || typeof claims.sub !== 'string' || typeof claims.exp !== 'number' || claims.exp <= now || (claims.iat && claims.iat > now + 60)) {
      throw Object.assign(new Error('Invalid provider token'), { code: 'OAUTH_INVALID_TOKEN' });
    }
    return claims;
  }

  return {
    createAuthorizationRequest(provider, state, nonce, challenge) {
      assertConfigured(config, provider);
      const settings = providerConfig(config, provider);
      const params = new URLSearchParams({
        client_id: clientId(config, provider),
        redirect_uri: provider === 'google' ? config.google.redirectUri : config.apple.redirectUri,
        response_type: 'code',
        scope: provider === 'apple' ? 'openid email name' : 'openid email profile',
        response_mode: provider === 'apple' ? 'form_post' : 'query',
        state,
        nonce,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      });
      if (provider === 'google') params.set('access_type', 'online');
      return `${settings.authorization}?${params}`;
    },
    exchangeCode,
    verifyIdToken,
    pkce() {
      const verifier = randomBytes(32).toString('base64url');
      return { verifier, challenge: b64url(createHash('sha256').update(verifier).digest()) };
    },
  };
}
