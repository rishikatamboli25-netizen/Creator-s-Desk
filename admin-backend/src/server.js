import mongoose from 'mongoose';
import app from './app.js';
import { config } from './config/index.js';

const start = async () => {
  await mongoose.connect(config.mongoUri);

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`🛡️ CD_ADMIN Backend running on port ${config.port}`);
  });
};

const shutdown = async (signal) => {
  console.log(`[CD_ADMIN] ${signal} received. Shutting down.`);
  await mongoose.disconnect().catch(() => {});
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((error) => {
  console.error('[CD_ADMIN] Failed to start:', error.message);
  process.exit(1);
});
