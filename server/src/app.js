// Builds the Express app. Serves client/dist when it exists (D-020).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pool from './config/db.js';

const app = express();
app.disable('x-powered-by');

// --- API routes (mount routers for later phases above the /api 404 below) ---
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

// Unknown /api paths always get a JSON 404, never the client's index.html.
app.use('/api', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found.' } });
});

// --- Production build of the React client (D-020), only when it has been built ---
const distDir = fileURLToPath(new URL('../../client/dist', import.meta.url));
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

export default app;
