// Builds the Express app. Serves client/dist when it exists (D-020).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pool from './config/db.js';
import { env } from './config/env.js';
import { sessionMiddleware } from './config/session.js';
import requireJson from './middleware/requireJson.js';
import securityHeaders from './middleware/securityHeaders.js';
import authRoutes from './routes/authRoutes.js';
import subjectRoutes from './routes/subjectRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();
app.disable('x-powered-by');
// Opt-in only (F-5): set TRUST_PROXY to the exact number of reverse-proxy hops in front of the app. Left unset, `trust proxy`
// stays off, so a spoofed X-Forwarded-* header is never believed. It is required behind a TLS-terminating host, otherwise
// express-session will not send the Secure session cookie (req.secure is false) and req.ip is the proxy for every client.
if (env.trustProxyHops > 0) app.set('trust proxy', env.trustProxyHops);
app.use(securityHeaders);

// --- API body rules: a request with a body must be JSON (415); max 10 KB (413); malformed JSON gives 400 ---
app.use('/api', requireJson, express.json({ limit: '10kb' }));

// Health does not use sessions, so it keeps working when the session store is unavailable.
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    // Log only the error code server-side; never send details to the client.
    console.error(`Health check failed: database unavailable (${err.code || 'UNKNOWN'})`);
    res.status(503).json({
      error: { code: 'DB_UNAVAILABLE', message: 'Service temporarily unavailable.' },
    });
  }
});

// --- Sessions (MySQL store, D-007) for every API route registered below this line ---
app.use('/api', sessionMiddleware);

// --- API routers; later phases mount theirs here, above the /api 404 ---
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/tasks', taskRoutes);

// Unknown /api paths always get a JSON 404, never the client's index.html.
app.use('/api', notFound);

// --- Production build of the React client (D-020), only when it has been built ---
const distDir = fileURLToPath(new URL('../../client/dist', import.meta.url));
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Must be last: turns thrown errors (including body-parser errors) into the JSON error format.
app.use(errorHandler);

export default app;
