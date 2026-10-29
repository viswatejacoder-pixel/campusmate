// MySQL-backed sessions (D-007). Reuses the shared pool from db.js, so the store connects as campusmate_app.
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import pool from './db.js';
import { env } from './env.js';

const MySQLStore = MySQLStoreFactory(session);

export const sessionStore = new MySQLStore(
  {
    expiration: env.sessionMaxAgeMs, // server-side lifetime matches the cookie
    createDatabaseTable: true, // creates `sessions` if missing (needs the CREATE grant, database.md section 4)
    schema: { tableName: 'sessions' },
    endConnectionOnClose: false, // the pool is shared; the store must not end it
  },
  pool,
);

// Table creation runs in the background. If it fails (DB down, missing CREATE grant) the error would
// otherwise be lost, so log a short code. The server stays up so /api/health can still report 503.
sessionStore.onReady().catch((err) => {
  console.error(`Session store setup failed (${err.code || err.name || 'UNKNOWN'}). Sessions will not work until this is fixed and the server is restarted.`);
});

// Cookie name stays the default `connect.sid` (api-spec.md section 1). The shared options let logout clear
// the cookie with exactly the attributes it was set with.
export const SESSION_COOKIE_NAME = 'connect.sid';
export const sessionCookieOptions = Object.freeze({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.nodeEnv === 'production', // HTTPS hosting only (security.md S-4)
  path: '/',
});

export const sessionMiddleware = session({
  name: SESSION_COOKIE_NAME,
  secret: env.sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false, // no session row or cookie until something is stored (login/register)
  cookie: {
    ...sessionCookieOptions,
    maxAge: env.sessionMaxAgeMs,
  },
});
