import { nanoid } from 'nanoid';
import type { Db } from '@latent-space/db';
import { accounts } from '@latent-space/db';
import { eq } from 'drizzle-orm';

// In-memory session store: sessionToken → accountId
const sessions = new Map<string, string>();

export const sessionStore = {
  create(token: string, accountId: string) {
    sessions.set(token, accountId);
  },
  get(token: string) {
    return sessions.get(token);
  },
  delete(token: string) {
    sessions.delete(token);
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
