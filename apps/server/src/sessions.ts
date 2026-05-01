import { nanoid } from 'nanoid';
import { sessions as sessionsTable, accounts } from '@latent-space/db';
import { eq, gt, and } from 'drizzle-orm';
import type { Db } from '@latent-space/db';

// In-memory session store: sessionToken → accountId
const memory = new Map<string, string>();
let _db: Db | null = null;

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function initSessionStore(db: Db) {
  _db = db;
}

export async function loadSessions(db: Db) {
  const now = new Date();
  const rows = await db
    .select()
    .from(sessionsTable)
    .where(gt(sessionsTable.expiresAt, now));
  for (const row of rows) {
    memory.set(row.id, row.accountId);
  }
  console.log(`sessions: loaded ${rows.length} from db`);
}

export const sessionStore = {
  create(token: string, accountId: string) {
    memory.set(token, accountId);
    if (_db) {
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      _db.insert(sessionsTable).values({ id: token, accountId, expiresAt }).catch(console.error);
    }
  },
  get(token: string) {
    return memory.get(token);
  },
  delete(token: string) {
    memory.delete(token);
    if (_db) {
      _db.delete(sessionsTable).where(eq(sessionsTable.id, token)).catch(console.error);
    }
  },
};

// One-time WS tickets: ticket → { accountId, expiresAt }
const tickets = new Map<string, { accountId: string; expiresAt: number }>();

export function createWsTicket(accountId: string): string {
  const ticket = nanoid(32);
  tickets.set(ticket, { accountId, expiresAt: Date.now() + 30_000 });
  return ticket;
}

export function redeemWsTicket(ticket: string): string | null {
  const entry = tickets.get(ticket);
  tickets.delete(ticket); // always delete — one-time use
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.accountId;
}

export async function getAccountFromToken(token: string, db: Db) {
  const accountId = sessionStore.get(token);
  if (!accountId) return null;
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  return account ?? null;
}
