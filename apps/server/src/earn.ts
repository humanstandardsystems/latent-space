import { nanoid } from 'nanoid';
import { tokenLedger, type Db } from '@latent-space/db';
import { room } from './room.js';

export function startEarnLoop(db: Db) {
  setInterval(async () => {
    const state = room.getState();
    if (!state.activeSetId) return;
    if (state.connectedAccountIds.size === 0) return;

    const rows = Array.from(state.connectedAccountIds).map((accountId) => ({
      id: nanoid(),
      accountId,
      amount: 1,
      reason: 'attend_set',
    }));

    await db.insert(tokenLedger).values(rows).catch((err) => {
      console.error('earn loop error:', err);
    });
  }, 60_000);
}
