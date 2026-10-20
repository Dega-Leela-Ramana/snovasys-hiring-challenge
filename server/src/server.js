// Starts the web server. `dotenv/config` MUST be the first import so server/.env is loaded.
import 'dotenv/config';
import { loadConfig, ConfigError } from './config.js';
import { createDb } from './db.js';
import { createApp } from './app.js';

let config;
try {
  config = loadConfig();
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

const db = createDb(config.databaseUrl);
const app = createApp({ config, db });

const server = app.listen(config.port, () => {
  console.log(`TrustVault listening on port ${config.port} (${config.env}, trust proxy = ${config.trustProxy})`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref(); // do not hang forever
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
