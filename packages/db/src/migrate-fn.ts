import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Db } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runMigrations(db: Db) {
  migrate(db, { migrationsFolder: join(__dirname, '../drizzle') });
}
