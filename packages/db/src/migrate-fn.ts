import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Db } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runMigrations(db: Db) {
  const migrationsFolder = join(__dirname, '../drizzle');
  console.log('migrations: folder =', migrationsFolder);
  try {
    migrate(db, { migrationsFolder });
    console.log('migrations: ok');
  } catch (err) {
    console.error('migrations: FAILED', err);
    throw err;
  }
}
