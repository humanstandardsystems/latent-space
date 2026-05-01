import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import {
  accounts, blobs, sets, tracks, dropEvents, tokenLedger,
  type Db,
} from '@latent-space/db';
import { eq, desc, isNull, and } from 'drizzle-orm';
import { room } from '../room.js';
import { broadcast } from '../ws.js';
import { createWsTicket } from '../sessions.js';

function requireAuth(req: { account: { id: string; email: string; isDj: boolean; createdAt: Date } | null }) {
  if (!req.account) throw { statusCode: 401, message: 'not authenticated' };
  return req.account;
}

function requireDj(req: { account: { id: string; email: string; isDj: boolean; createdAt: Date } | null }) {
  const account = requireAuth(req);
  if (!account.isDj) throw { statusCode: 403, message: 'dj access required' };
  return account;
}

export async function apiRoutes(app: FastifyInstance, db: Db) {
  // GET /api/room
  app.get('/api/room', async () => {
    const state = room.getState();
    return {
      activeSetId: state.activeSetId,
      connectedCount: state.connectedAccountIds.size,
      audioState: state.audioState,
      blobs: Array.from(state.connectedAccountIds).map((id) => ({
        accountId: id,
        position: room.getPosition(id),
      })),
    };
  });

  // GET /api/now-playing
  app.get('/api/now-playing', async () => {
    const state = room.getState();
    if (!state.activeSetId) return { track: null, set: null };
    const [activeSet] = await db.select().from(sets).where(eq(sets.id, state.activeSetId));
    if (!activeSet) return { track: null, set: null };
    const [latest] = await db
      .select()
      .from(tracks)
      .where(eq(tracks.setId, state.activeSetId))
      .orderBy(desc(tracks.playedAt))
      .limit(1);
    return { set: activeSet, track: latest ?? null };
  });

  // GET /api/me
  app.get('/api/me', async (req) => {
    const account = requireAuth(req);
    const [blob] = await db.select().from(blobs).where(eq(blobs.accountId, account.id));
    return { account, blob: blob ?? null };
  });

  // GET /api/ws-ticket — one-time token for WS auth (bypasses cookie stripping by proxies)
  app.get('/api/ws-ticket', async (req) => {
    const account = requireAuth(req);
    return { ticket: createWsTicket(account.id) };
  });

  // POST /api/blobs — create blob (one per account)
  app.post('/api/blobs', async (req, reply) => {
    const account = requireAuth(req);
    const [existing] = await db.select().from(blobs).where(eq(blobs.accountId, account.id));
    if (existing) return reply.code(409).send({ error: 'blob already exists' });
    const id = nanoid();
    await db.insert(blobs).values({ id, accountId: account.id });
    const [blob] = await db.select().from(blobs).where(eq(blobs.id, id));
    return reply.code(201).send(blob);
  });

  // PATCH /api/blobs/me — update color
  app.patch<{ Body: { color: string } }>('/api/blobs/me', {
    schema: { body: { type: 'object', required: ['color'], properties: { color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' } } } },
  }, async (req, reply) => {
    const account = requireAuth(req);
    await db.update(blobs).set({ color: req.body.color }).where(eq(blobs.accountId, account.id));
    const [blob] = await db.select().from(blobs).where(eq(blobs.accountId, account.id));
    return blob ?? reply.code(404).send({ error: 'blob not found' });
  });

  // ── DJ routes ──────────────────────────────────────────────────────────────

  // POST /api/sets/start
  app.post<{ Body: { genre?: string; twitchChannel?: string } }>('/api/sets/start', async (req) => {
    const account = requireDj(req);
    const id = nanoid();
    await db.insert(sets).values({
      id,
      djAccountId: account.id,
      startedAt: new Date(),
      genre: req.body.genre ?? null,
      twitchChannel: req.body.twitchChannel ?? null,
    });
    room.setActiveSet(id);
    return { setId: id };
  });

  // POST /api/sets/end
  app.post('/api/sets/end', async (req) => {
    requireDj(req);
    const state = room.getState();
    if (state.activeSetId) {
      await db.update(sets).set({ endedAt: new Date() }).where(eq(sets.id, state.activeSetId));
      room.setActiveSet(null);
    }
    return { ok: true };
  });

  // PATCH /api/sets/now-playing
  app.patch<{ Body: { artist?: string; title?: string; genre?: string } }>('/api/sets/now-playing', async (req) => {
    requireDj(req);
    const state = room.getState();
    if (!state.activeSetId) return { error: 'no active set' };
    const id = nanoid();
    await db.insert(tracks).values({
      id,
      setId: state.activeSetId,
      artist: req.body.artist ?? null,
      title: req.body.title ?? null,
      genre: req.body.genre ?? null,
      playedAt: new Date(),
    });
    if (req.body.genre) {
      await db.update(sets).set({ genre: req.body.genre }).where(eq(sets.id, state.activeSetId));
    }
    broadcast('now_playing', { artist: req.body.artist, title: req.body.title, genre: req.body.genre });
    return { trackId: id };
  });

  // POST /api/sets/drop — manual drop trigger
  app.post('/api/sets/drop', async (req) => {
    requireDj(req);
    const state = room.getState();
    if (!state.activeSetId) return { error: 'no active set' };
    const id = nanoid();
    await db.insert(dropEvents).values({
      id,
      setId: state.activeSetId,
      triggeredBy: 'manual',
      droppedAt: new Date(),
    });
    room.updateAudio({ dropActive: true });
    broadcast('drop_start', { dropId: id });
    setTimeout(() => {
      room.updateAudio({ dropActive: false });
      broadcast('drop_end', { dropId: id });
    }, 8000);
    return { dropId: id };
  });

  // PATCH /api/sets/audio-state — from DJ dashboard Web Audio
  app.patch<{ Body: { bpm?: number; subBassEnergy?: number; dropActive?: boolean } }>('/api/sets/audio-state', async (req) => {
    requireDj(req);
    room.updateAudio(req.body);
    broadcast('audio_state', room.getState().audioState);
    // handle drop via audio analysis
    if (req.body.dropActive === true && !room.getState().audioState.dropActive) {
      broadcast('drop_start', { triggeredBy: 'audio' });
    }
    return { ok: true };
  });

  // GET /api/accounts/:email — lookup account by email (internal/dj use)
  app.get<{ Params: { email: string } }>('/api/accounts/by-email/:email', async (req, reply) => {
    requireDj(req);
    const [account] = await db.select().from(accounts).where(eq(accounts.email, req.params.email));
    if (!account) return reply.code(404).send({ error: 'not found' });
    return account;
  });

  // POST /api/gift — gift tokens to another account
  app.post<{ Body: { toAccountId: string; amount: number; reason?: string } }>('/api/gift', {
    schema: { body: { type: 'object', required: ['toAccountId', 'amount'], properties: { toAccountId: { type: 'string' }, amount: { type: 'number', minimum: 1 }, reason: { type: 'string' } } } },
  }, async (req) => {
    const sender = requireAuth(req);
    const { toAccountId, amount, reason } = req.body;

    // debit sender
    await db.insert(tokenLedger).values({ id: nanoid(), accountId: sender.id, amount: -amount, reason: 'gift_sent' });
    // credit receiver
    await db.insert(tokenLedger).values({ id: nanoid(), accountId: toAccountId, amount, reason: reason ?? 'gift_received' });
    return { ok: true };
  });
}
