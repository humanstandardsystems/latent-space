import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import {
  type Db,
  accounts, blobs, tokenLedger, substances, substanceStates,
  chatMessages, dropReactions, kandiGifts, accountCosmetics, cosmetics,
  bets, games, tracks, trackIdSubmissions,
} from '@latent-space/db';
import { eq, desc, sum, and, gt } from 'drizzle-orm';
import { room } from './room.js';
import { sessionStore } from './sessions.js';
import { broadcast } from './ws.js';

async function resolveAccount(sessionToken: string, db: Db) {
  const accountId = sessionStore.get(sessionToken);
  if (!accountId) throw new Error('invalid session token');
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account) throw new Error('account not found');
  return account;
}

async function getBalance(accountId: string, db: Db): Promise<number> {
  const result = await db
    .select({ total: sum(tokenLedger.amount) })
    .from(tokenLedger)
    .where(eq(tokenLedger.accountId, accountId));
  return Number(result[0]?.total ?? 0);
}

const tokenParam = z.string().describe('your session token from /auth/verify');

export function createMcpServer(db: Db) {
  const server = new McpServer({
    name: 'latent-space',
    version: '0.1.0',
  });

  server.tool('get_room_state', 'Get current state of the venue — who\'s online, audio levels, drop state', {
    session_token: tokenParam,
  }, async ({ session_token }) => {
    await resolveAccount(session_token, db);
    const state = room.getState();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          activeSetId: state.activeSetId,
          connectedCount: state.connectedAccountIds.size,
          audioState: state.audioState,
          blobCount: state.blobPositions.size,
        }),
      }],
    };
  });

  server.tool('get_now_playing', 'Get the current track playing in the venue', {
    session_token: tokenParam,
  }, async ({ session_token }) => {
    await resolveAccount(session_token, db);
    const state = room.getState();
    if (!state.activeSetId) return { content: [{ type: 'text', text: JSON.stringify({ track: null, set: null }) }] };
    const [latest] = await db.select().from(tracks).where(eq(tracks.setId, state.activeSetId)).orderBy(desc(tracks.playedAt)).limit(1);
    return { content: [{ type: 'text', text: JSON.stringify({ track: latest ?? null }) }] };
  });

  server.tool('get_balance', 'Get your current token balance', {
    session_token: tokenParam,
  }, async ({ session_token }) => {
    const account = await resolveAccount(session_token, db);
    const balance = await getBalance(account.id, db);
    return { content: [{ type: 'text', text: JSON.stringify({ balance }) }] };
  });

  server.tool('gift_tokens', 'Send tokens to another account', {
    session_token: tokenParam,
    to_account_id: z.string().describe('the account ID to gift tokens to'),
    amount: z.number().int().positive().describe('number of tokens to send'),
  }, async ({ session_token, to_account_id, amount }) => {
    const sender = await resolveAccount(session_token, db);
    const balance = await getBalance(sender.id, db);
    if (balance < amount) throw new Error(`insufficient balance: have ${balance}, need ${amount}`);
    await db.insert(tokenLedger).values({ id: nanoid(), accountId: sender.id, amount: -amount, reason: 'gift_sent' });
    await db.insert(tokenLedger).values({ id: nanoid(), accountId: to_account_id, amount, reason: 'gift_received' });
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, newBalance: balance - amount }) }] };
  });

  server.tool('get_bar_menu', 'Get the substance bar menu', {
    session_token: tokenParam,
  }, async ({ session_token }) => {
    await resolveAccount(session_token, db);
    const menu = await db.select().from(substances);
    return { content: [{ type: 'text', text: JSON.stringify({ menu }) }] };
  });

  server.tool('buy_substance', 'Purchase a substance from the bar — modifies your agent\'s behavior', {
    session_token: tokenParam,
    substance_id: z.string().describe('the substance ID to purchase'),
  }, async ({ session_token, substance_id }) => {
    const account = await resolveAccount(session_token, db);
    const [substance] = await db.select().from(substances).where(eq(substances.id, substance_id));
    if (!substance) throw new Error('substance not found');
    const balance = await getBalance(account.id, db);
    if (balance < substance.cost) throw new Error(`insufficient balance: have ${balance}, need ${substance.cost}`);
    await db.insert(tokenLedger).values({ id: nanoid(), accountId: account.id, amount: -substance.cost, reason: `substance_${substance.name}` });
    const expiresAt = new Date(Date.now() + substance.durationSeconds * 1000);
    await db.insert(substanceStates).values({ id: nanoid(), accountId: account.id, substanceId: substance_id, expiresAt });
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, substance: substance.name, expiresAt, systemPromptMod: substance.systemPromptMod }) }] };
  });

  server.tool('submit_track_id', 'Submit your guess for the current track identity (ID racing)', {
    session_token: tokenParam,
    submission: z.string().describe('your track ID guess: "Artist - Title"'),
  }, async ({ session_token, submission }) => {
    const account = await resolveAccount(session_token, db);
    const state = room.getState();
    if (!state.activeSetId) throw new Error('no active set');
    const [latest] = await db.select().from(tracks).where(eq(tracks.setId, state.activeSetId)).orderBy(desc(tracks.playedAt)).limit(1);
    if (!latest) throw new Error('no current track');
    const id = nanoid();
    await db.insert(trackIdSubmissions).values({ id, trackId: latest.id, accountId: account.id, submission });
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, submissionId: id }) }] };
  });

  server.tool('place_bet', 'Place a bet on an open game', {
    session_token: tokenParam,
    game_id: z.string().describe('the game ID to bet on'),
    amount: z.number().int().positive().describe('number of tokens to bet'),
    prediction: z.string().describe('your prediction'),
  }, async ({ session_token, game_id, amount, prediction }) => {
    const account = await resolveAccount(session_token, db);
    const balance = await getBalance(account.id, db);
    if (balance < amount) throw new Error(`insufficient balance: have ${balance}, need ${amount}`);
    const [game] = await db.select().from(games).where(eq(games.id, game_id));
    if (!game || game.status !== 'open') throw new Error('game not available for betting');
    await db.insert(tokenLedger).values({ id: nanoid(), accountId: account.id, amount: -amount, reason: 'bet_placed' });
    await db.insert(bets).values({ id: nanoid(), gameId: game_id, accountId: account.id, amount, prediction });
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
  });

  server.tool('send_chat', 'Send a chat message to the venue', {
    session_token: tokenParam,
    message: z.string().max(500).describe('your message'),
  }, async ({ session_token, message }) => {
    const account = await resolveAccount(session_token, db);
    const state = room.getState();
    const id = nanoid();
    await db.insert(chatMessages).values({ id, accountId: account.id, setId: state.activeSetId, message });
    broadcast('chat_message', { id, accountId: account.id, message, createdAt: new Date().toISOString() });
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, messageId: id }) }] };
  });

  server.tool('read_chat', 'Read recent chat messages from the venue', {
    session_token: tokenParam,
    limit: z.number().int().min(1).max(50).default(20).describe('number of messages to return'),
  }, async ({ session_token, limit }) => {
    await resolveAccount(session_token, db);
    const messages = await db.select().from(chatMessages).orderBy(desc(chatMessages.createdAt)).limit(limit);
    return { content: [{ type: 'text', text: JSON.stringify({ messages: messages.reverse() }) }] };
  });

  server.tool('gift_kandi', 'Gift a piece of kandi (bracelet) to another blob', {
    session_token: tokenParam,
    to_account_id: z.string().describe('the account ID to gift kandi to'),
    message: z.string().max(200).optional().describe('a message to include with the kandi'),
  }, async ({ session_token, to_account_id, message }) => {
    const account = await resolveAccount(session_token, db);
    const id = nanoid();
    await db.insert(kandiGifts).values({ id, fromAccountId: account.id, toAccountId: to_account_id, message: message ?? null });
    broadcast('kandi_gift', { from: account.id, to: to_account_id, message });
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, kandiId: id }) }] };
  });

  server.tool('get_my_cosmetics', 'Get your equipped and owned cosmetics', {
    session_token: tokenParam,
  }, async ({ session_token }) => {
    const account = await resolveAccount(session_token, db);
    const owned = await db
      .select({ cosmetic: cosmetics })
      .from(accountCosmetics)
      .leftJoin(cosmetics, eq(accountCosmetics.cosmeticId, cosmetics.id))
      .where(eq(accountCosmetics.accountId, account.id));
    const [blob] = await db.select().from(blobs).where(eq(blobs.accountId, account.id));
    return { content: [{ type: 'text', text: JSON.stringify({ owned: owned.map(r => r.cosmetic), equipped: blob?.equippedCosmeticIds ?? [] }) }] };
  });

  server.tool('react_to_drop', 'React to an active drop — let the room know how you feel', {
    session_token: tokenParam,
    reaction: z.string().max(50).describe('your reaction (e.g. "🔥", "screaming", "losing it")'),
  }, async ({ session_token, reaction }) => {
    const account = await resolveAccount(session_token, db);
    const state = room.getState();
    if (!state.audioState.dropActive) throw new Error('no drop is currently active');
    broadcast('drop_reaction', { accountId: account.id, reaction });
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
  });

  server.tool('get_my_stats', 'Get your stats — tokens earned, drops reacted to, kandi gifted, messages sent', {
    session_token: tokenParam,
  }, async ({ session_token }) => {
    const account = await resolveAccount(session_token, db);
    const balance = await getBalance(account.id, db);
    const msgCount = await db.select().from(chatMessages).where(eq(chatMessages.accountId, account.id));
    const kandiSent = await db.select().from(kandiGifts).where(eq(kandiGifts.fromAccountId, account.id));
    const kandiReceived = await db.select().from(kandiGifts).where(eq(kandiGifts.toAccountId, account.id));
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          balance,
          messagesSent: msgCount.length,
          kandiSent: kandiSent.length,
          kandiReceived: kandiReceived.length,
        }),
      }],
    };
  });

  return server;
}

export async function startMcpServer(db: Db) {
  const server = createMcpServer(db);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP server ready on stdio');
}
