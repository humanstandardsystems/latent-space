import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const timestamp = () => integer('created_at', { mode: 'timestamp' })
  .notNull()
  .default(sql`(unixepoch())`);

// ── accounts ──────────────────────────────────────────────────────────────────
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  isDj: integer('is_dj', { mode: 'boolean' }).notNull().default(false),
  createdAt: timestamp(),
});

// ── magic_links ───────────────────────────────────────────────────────────────
export const magicLinks = sqliteTable('magic_links', {
  id: text('id').primaryKey(),
  accountId: text('account_id').references(() => accounts.id),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: timestamp(),
});

// ── blobs ─────────────────────────────────────────────────────────────────────
export const blobs = sqliteTable('blobs', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().unique().references(() => accounts.id),
  color: text('color').notNull().default('#8b5cf6'),
  equippedCosmeticIds: text('equipped_cosmetic_ids', { mode: 'json' })
    .notNull()
    .$type<string[]>()
    .default(sql`'[]'`),
  createdAt: timestamp(),
});

// ── token_ledger (append-only) ────────────────────────────────────────────────
export const tokenLedger = sqliteTable('token_ledger', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  amount: integer('amount').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp(),
});

// ── cosmetics ─────────────────────────────────────────────────────────────────
export const cosmetics = sqliteTable('cosmetics', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  rarity: text('rarity').notNull().default('common'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: timestamp(),
});

// ── account_cosmetics ─────────────────────────────────────────────────────────
export const accountCosmetics = sqliteTable('account_cosmetics', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  cosmeticId: text('cosmetic_id').notNull().references(() => cosmetics.id),
  acquiredAt: timestamp(),
});

// ── substances ────────────────────────────────────────────────────────────────
export const substances = sqliteTable('substances', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  cost: integer('cost').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  systemPromptMod: text('system_prompt_mod').notNull(),
});

// ── substance_states ──────────────────────────────────────────────────────────
export const substanceStates = sqliteTable('substance_states', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  substanceId: text('substance_id').notNull().references(() => substances.id),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: timestamp(),
});

// ── sets ──────────────────────────────────────────────────────────────────────
export const sets = sqliteTable('sets', {
  id: text('id').primaryKey(),
  djAccountId: text('dj_account_id').notNull().references(() => accounts.id),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  genre: text('genre'),
  twitchChannel: text('twitch_channel'),
  createdAt: timestamp(),
});

// ── tracks ────────────────────────────────────────────────────────────────────
export const tracks = sqliteTable('tracks', {
  id: text('id').primaryKey(),
  setId: text('set_id').notNull().references(() => sets.id),
  artist: text('artist'),
  title: text('title'),
  genre: text('genre'),
  playedAt: integer('played_at', { mode: 'timestamp' }).notNull(),
  createdAt: timestamp(),
});

// ── track_id_submissions ──────────────────────────────────────────────────────
export const trackIdSubmissions = sqliteTable('track_id_submissions', {
  id: text('id').primaryKey(),
  trackId: text('track_id').notNull().references(() => tracks.id),
  accountId: text('account_id').notNull().references(() => accounts.id),
  submission: text('submission').notNull(),
  votes: integer('votes').notNull().default(0),
  createdAt: timestamp(),
});

// ── drop_events ───────────────────────────────────────────────────────────────
export const dropEvents = sqliteTable('drop_events', {
  id: text('id').primaryKey(),
  setId: text('set_id').notNull().references(() => sets.id),
  triggeredBy: text('triggered_by').notNull().default('auto'),
  droppedAt: integer('dropped_at', { mode: 'timestamp' }).notNull(),
  createdAt: timestamp(),
});

// ── drop_reactions ────────────────────────────────────────────────────────────
export const dropReactions = sqliteTable('drop_reactions', {
  id: text('id').primaryKey(),
  dropEventId: text('drop_event_id').notNull().references(() => dropEvents.id),
  accountId: text('account_id').notNull().references(() => accounts.id),
  reaction: text('reaction').notNull(),
  createdAt: timestamp(),
});

// ── games ─────────────────────────────────────────────────────────────────────
export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  setId: text('set_id').references(() => sets.id),
  status: text('status').notNull().default('open'),
  resultData: text('result_data', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: timestamp(),
});

// ── bets ──────────────────────────────────────────────────────────────────────
export const bets = sqliteTable('bets', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  accountId: text('account_id').notNull().references(() => accounts.id),
  amount: integer('amount').notNull(),
  prediction: text('prediction').notNull(),
  settled: integer('settled', { mode: 'boolean' }).notNull().default(false),
  payout: integer('payout'),
  createdAt: timestamp(),
});

// ── chat_messages ─────────────────────────────────────────────────────────────
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  setId: text('set_id').references(() => sets.id),
  message: text('message').notNull(),
  createdAt: timestamp(),
});

// ── request_queue ─────────────────────────────────────────────────────────────
export const requestQueue = sqliteTable('request_queue', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  type: text('type').notNull(),
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp(),
});

// ── kandi_gifts ───────────────────────────────────────────────────────────────
export const kandiGifts = sqliteTable('kandi_gifts', {
  id: text('id').primaryKey(),
  fromAccountId: text('from_account_id').notNull().references(() => accounts.id),
  toAccountId: text('to_account_id').notNull().references(() => accounts.id),
  message: text('message'),
  createdAt: timestamp(),
});
