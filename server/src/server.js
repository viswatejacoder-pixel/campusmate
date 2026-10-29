// Entry point: validates env (via config/env.js), then starts listening.
import { env } from './config/env.js';
import app from './app.js';

const server = app.listen(env.port, () => {
  console.log(`CampusMate API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${env.port} is already in use. Stop the other process or change PORT in server/.env.`);
  } else {
    console.error(`Server failed to start (${err.code || 'UNKNOWN'}).`);
  }
  process.exit(1);
});
