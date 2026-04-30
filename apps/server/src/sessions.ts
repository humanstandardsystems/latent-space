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

export async function getAccountFromToken(token: string, db: Db) {
  const accountId = sessionStore.get(token);
  if (!accountId) return null;
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  return account ?? null;
}
