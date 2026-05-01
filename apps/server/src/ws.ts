import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { chatMessages, type Db } from '@latent-space/db';
import { room } from './room.js';
import { redeemWsTicket } from './sessions.js';

// accountId → WebSocket
const clients = new Map<string, WebSocket>();

export function broadcast(type: string, data: unknown, exclude?: string) {
  const msg = JSON.stringify({ type, data });
  for (const [accountId, ws] of clients) {
    if (exclude && accountId === exclude) continue;
    if (ws.readyState === 1) ws.send(msg);
  }
}

export function broadcastToOne(accountId: string, type: string, data: unknown) {
  const ws = clients.get(accountId);
  if (ws?.readyState === 1) ws.send(JSON.stringify({ type, data }));
}

export function getConnectedClients() {
  return clients;
}

export async function wsRoutes(app: FastifyInstance, db: Db) {
  app.get('/ws', { websocket: true }, (socket) => {
    let accountId: string | null = null;

    // Give the client 5s to send an auth message before closing
    const authTimeout = setTimeout(() => {
      if (!accountId) {
        socket.send(JSON.stringify({ type: 'error', data: { message: 'auth timeout' } }));
        socket.close(4001, 'auth timeout');
      }
    }, 5000);

    function onAuthenticated(id: string) {
      accountId = id;
      clearTimeout(authTimeout);

      clients.set(accountId, socket);
      room.addClient(accountId);

      const state = room.getState();
      socket.send(JSON.stringify({
        type: 'room_snapshot',
        data: {
          activeSetId: state.activeSetId,
          audioState: state.audioState,
          connectedCount: state.connectedAccountIds.size,
          blobPositions: Object.fromEntries(state.blobPositions),
        },
      }));

      broadcast('blob_join', { accountId }, accountId);
    }

    socket.on('message', async (raw) => {
      let msg: { type: string; data: Record<string, unknown> };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      // Auth handshake — must come first
      if (msg.type === 'auth') {
        if (accountId) return; // already authed
        const ticket = String(msg.data.ticket ?? '');
        const id = redeemWsTicket(ticket);
        if (!id) {
          socket.send(JSON.stringify({ type: 'error', data: { message: 'invalid ticket' } }));
          socket.close(4001, 'invalid ticket');
          return;
        }
        onAuthenticated(id);
        return;
      }

      // All other messages require auth
      if (!accountId) return;

      if (msg.type === 'move') {
        const { x, y } = msg.data as { x: number; y: number };
        room.updatePosition(accountId, { x, y });
        broadcast('blob_update', { accountId, position: { x, y } }, accountId);
        return;
      }

      if (msg.type === 'chat') {
        const message = String(msg.data.message ?? '').slice(0, 500);
        if (!message) return;
        const id = nanoid();
        const state = room.getState();
        await db.insert(chatMessages).values({
          id,
          accountId,
          setId: state.activeSetId,
          message,
        });
        broadcast('chat_message', { id, accountId, message, createdAt: new Date().toISOString() });
        return;
      }
    });

    socket.on('close', () => {
      clearTimeout(authTimeout);
      if (accountId) {
        clients.delete(accountId);
        room.removeClient(accountId);
        broadcast('blob_leave', { accountId });
      }
    });
  });
}
