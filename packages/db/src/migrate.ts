import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createDb } from './db.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbUrl = process.env['DATABASE_URL'] ?? './latent-space.db';

const db = createDb(dbUrl);
migrate(db, { migrationsFolder: join(__dirname, '../drizzle') });
console.log('migrations applied');
