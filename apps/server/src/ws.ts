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
  app.get('/ws', { websocket: true }, (socket, req) => {
    const ticket = (req.query as Record<string, string>)['ticket'] ?? '';
    const accountId = redeemWsTicket(ticket);

    if (!accountId) {
      socket.send(JSON.stringify({ type: 'error', data: { message: 'not authenticated' } }));
      socket.close(4001, 'not authenticated');
      return;
    }

    clients.set(accountId, socket);
    room.addClient(accountId);

    // send initial room snapshot
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

    // notify others
    broadcast('blob_join', { accountId }, accountId);

    socket.on('message', async (raw) => {
      let msg: { type: string; data: Record<string, unknown> };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

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
      clients.delete(accountId);
      room.removeClient(accountId);
      broadcast('blob_leave', { accountId });
    });
  });
}
