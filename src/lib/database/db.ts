// @ts-nocheck
import { initDatabase } from '@apps/api/db.mjs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Global singleton for Next.js hot-reloading
const globalForDb = globalThis as unknown as {
  veilDb: ReturnType<typeof initDatabase> | undefined;
};

export const getDb = () => {
  if (!globalForDb.veilDb) {
    const isVercel = Boolean(process.env.VERCEL);
    const dbPath = process.env.DATABASE_PATH || (isVercel ? join(tmpdir(), 'veil.sqlite') : join(process.cwd(), 'apps', 'api', 'data', 'veil.sqlite'));
    globalForDb.veilDb = initDatabase(dbPath);
  }
  return globalForDb.veilDb;
};

export default getDb;
