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
  if (!(Number(e.SESSION_MAX_AGE_HOURS) > 0)) problems.push('SESSION_MAX_AGE_HOURS must be a positive number');
  const transport = e.MAIL_TRANSPORT || 'console';
  if (!['console', 'brevo'].includes(transport)) problems.push("MAIL_TRANSPORT must be 'console' or 'brevo'");
  if (transport === 'console' && e.NODE_ENV === 'production') problems.push('MAIL_TRANSPORT=console is not allowed when NODE_ENV=production');
  if (transport === 'brevo') {
    for (const n of ['BREVO_API_KEY', 'MAIL_FROM_EMAIL', 'APP_BASE_URL']) {
      if (!e[n] || !e[n].trim()) problems.push(`${n} is required when MAIL_TRANSPORT=brevo`);
    }
  }
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
  }),
  sessionSecret: e.SESSION_SECRET,
  sessionMaxAgeMs: Number(e.SESSION_MAX_AGE_HOURS) * 60 * 60 * 1000,
  // Email verification (T-075). Defaults to the development-only console transport; secrets are never printed.
  mail: Object.freeze({
    transport: e.MAIL_TRANSPORT || 'console',
    appBaseUrl: (e.APP_BASE_URL || 'http://localhost:5173').trim().replace(/\/+$/, ''),
    fromEmail: (e.MAIL_FROM_EMAIL || '').trim(),
    fromName: (e.MAIL_FROM_NAME || 'CampusMate').trim(),
    brevoApiKey: e.BREVO_API_KEY || '',
  }),
  // Test-server switch for the rate limiter; ignored in production.
  rateLimitDisabled: (e.NODE_ENV || 'development') !== 'production' && e.RATE_LIMIT_DISABLED === 'true',
});
