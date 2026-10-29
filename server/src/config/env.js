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
});
