// Loads server/.env and validates it. Fails fast with a clear message (no values are printed).
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const REQUIRED = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'SESSION_SECRET',
  'SESSION_MAX_AGE_HOURS',
];

const missing = REQUIRED.filter((name) => !process.env[name] || !process.env[name].trim());
const problems = [];

if (missing.length > 0) {
  problems.push(`Missing required variable(s): ${missing.join(', ')}`);
} else {
  const e = process.env;
  const isPort = (v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 65535;
  if (!isPort(e.DB_PORT)) problems.push('DB_PORT must be a number from 1 to 65535');
  if (e.PORT && !isPort(e.PORT)) problems.push('PORT must be a number from 1 to 65535');
  if (e.SESSION_SECRET.length < 32) problems.push('SESSION_SECRET must be at least 32 characters');
  if (e.SESSION_SECRET.startsWith('replace_with')) problems.push('SESSION_SECRET is still the template placeholder');
  if (e.DB_PASSWORD.startsWith('change_me')) problems.push('DB_PASSWORD is still the template placeholder');
  if (e.DB_SSL !== undefined && !['true', 'false'].includes(e.DB_SSL.trim().toLowerCase())) problems.push("DB_SSL must be 'true' or 'false'");
  if (!(Number(e.SESSION_MAX_AGE_HOURS) > 0)) problems.push('SESSION_MAX_AGE_HOURS must be a positive number');
  if (e.TRUST_PROXY !== undefined && e.TRUST_PROXY !== '' && !/^[1-9]\d?$/.test(e.TRUST_PROXY.trim())) problems.push('TRUST_PROXY must be a whole number of trusted proxy hops (1 to 99) or unset');
  const transport = e.MAIL_TRANSPORT || 'console';
  if (!['console', 'brevo'].includes(transport)) problems.push("MAIL_TRANSPORT must be 'console' or 'brevo'");
  if (transport === 'console' && e.NODE_ENV === 'production') problems.push('MAIL_TRANSPORT=console is not allowed when NODE_ENV=production');
  if (transport === 'brevo') {
    for (const n of ['BREVO_API_KEY', 'MAIL_FROM_EMAIL', 'APP_BASE_URL']) {
      if (!e[n] || !e[n].trim()) problems.push(`${n} is required when MAIL_TRANSPORT=brevo`);
    }
  }
  const oauthGroups = [
    ['Google', ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI']],
    ['Apple', ['APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY', 'APPLE_REDIRECT_URI']],
  ];
  for (const [label, names] of oauthGroups) {
    const present = names.filter((name) => e[name] && e[name].trim()).length;
    if (present > 0 && present < names.length) problems.push(`${label} OAuth configuration must provide all of: ${names.join(', ')}`);
    const redirect = e[names[names.length - 1]];
    if (present === names.length && e.NODE_ENV === 'production' && !redirect.trim().toLowerCase().startsWith('https://')) {
      problems.push(`${label} OAuth redirect URI must use HTTPS in production`);
    }
  }
  const vapid = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'];
  const vapidPresent = vapid.filter((name) => e[name] && e[name].trim()).length;
  if (vapidPresent > 0 && vapidPresent < vapid.length) problems.push(`Web Push configuration must provide all of: ${vapid.join(', ')}`);
  if (e.APP_BASE_URL && !/^https?:\/\/[^\s/]+$/.test(e.APP_BASE_URL.trim().replace(/\/+$/, ''))) problems.push('APP_BASE_URL must look like http://localhost:5173 (no path)');
  if (e.MAIL_FROM_EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.MAIL_FROM_EMAIL.trim())) problems.push('MAIL_FROM_EMAIL must be an email address');
}

if (problems.length > 0) {
  console.error('Configuration error: server not started.');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('Copy server/.env.example to server/.env and fill in the values.');
  process.exit(1);
}

const e = process.env;

export const env = Object.freeze({
  nodeEnv: e.NODE_ENV || 'development',
  port: Number(e.PORT || 3000),
  db: Object.freeze({
    host: e.DB_HOST,
    port: Number(e.DB_PORT),
    name: e.DB_NAME,
    user: e.DB_USER,
    password: e.DB_PASSWORD,
    ssl: (e.DB_SSL || 'false').trim().toLowerCase() === 'true',
  }),
  sessionSecret: e.SESSION_SECRET,
  sessionMaxAgeMs: Number(e.SESSION_MAX_AGE_HOURS) * 60 * 60 * 1000,
  // Opt-in number of trusted reverse-proxy hops (F-5). 0 = unset = `trust proxy` stays off (the default).
  trustProxyHops: e.TRUST_PROXY && e.TRUST_PROXY.trim() ? Number(e.TRUST_PROXY.trim()) : 0,
  // Email verification (T-075). Defaults to the development-only console transport; secrets are never printed.
  mail: Object.freeze({
    transport: e.MAIL_TRANSPORT || 'console',
    appBaseUrl: (e.APP_BASE_URL || 'http://localhost:5173').trim().replace(/\/+$/, ''),
    fromEmail: (e.MAIL_FROM_EMAIL || '').trim(),
    fromName: (e.MAIL_FROM_NAME || 'CampusMate').trim(),
    brevoApiKey: e.BREVO_API_KEY || '',
  }),
  oauth: Object.freeze({
    google: Object.freeze({
      clientId: (e.GOOGLE_CLIENT_ID || '').trim(),
      clientSecret: (e.GOOGLE_CLIENT_SECRET || '').trim(),
      redirectUri: (e.GOOGLE_REDIRECT_URI || '').trim(),
    }),
    apple: Object.freeze({
      clientId: (e.APPLE_CLIENT_ID || '').trim(),
      teamId: (e.APPLE_TEAM_ID || '').trim(),
      keyId: (e.APPLE_KEY_ID || '').trim(),
      privateKey: e.APPLE_PRIVATE_KEY || '',
      redirectUri: (e.APPLE_REDIRECT_URI || '').trim(),
    }),
  }),
  push: Object.freeze({
    publicKey: (e.VAPID_PUBLIC_KEY || '').trim(),
    privateKey: (e.VAPID_PRIVATE_KEY || '').trim(),
    subject: (e.VAPID_SUBJECT || '').trim(),
  }),
  // Test-server switch for the rate limiter; ignored in production.
  rateLimitDisabled: (e.NODE_ENV || 'development') !== 'production' && e.RATE_LIMIT_DISABLED === 'true',
});
