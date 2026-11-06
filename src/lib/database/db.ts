// @ts-nocheck
import { initDatabase } from '@apps/api/db.mjs';
import { join } from 'node:path';

// Global singleton for Next.js hot-reloading
const globalForDb = globalThis as unknown as {
  veilDb: ReturnType<typeof initDatabase> | undefined;
};

export const getDb = () => {
  if (!globalForDb.veilDb) {
    const dbPath = process.env.DATABASE_PATH || join(process.cwd(), 'apps', 'api', 'data', 'veil.sqlite');
    globalForDb.veilDb = initDatabase(dbPath);
  }
  return globalForDb.veilDb;
};

export default getDb;
