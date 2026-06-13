import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { prisma } from '../lib/prisma';
import {
  isParticipant,
  markConversationRead,
  getConversationPartners,
} from '../modules/messages/messages.service';
import { socketAuth } from './auth';
import * as presence from './presence';
import { joinUserRoom, joinConversation, leaveConversation } from './rooms';
import { setIo, convoRoom, emitPresenceOnline, emitPresenceOffline } from './io';

/**
 * Phase 5.2 — wire the Socket.io server onto the existing HTTP server. Send stays REST (D1);
 * the socket is receive-only for messages (message:new is broadcast from messages.service) and
 * owns typing, presence, and read receipts. See ARCHITECTURE §5 for the event contract.
 */
export function initSocket(httpServer: HttpServer, corsOrigin: string): Server {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
  });
  setIo(io);

  // Authenticate every handshake (JWT in auth.token) → socket.data.{userId,username}.
  io.use(socketAuth);

  io.on('connection', (socket) => {
    const userId: string = socket.data.userId;
    const username: string = socket.data.username;

    joinUserRoom(socket, userId);

    // Register ALL event listeners SYNCHRONOUSLY first — before any await below. The client
    // emits conversation:join / message:read immediately on connect; if we awaited a DB query
    // before attaching these handlers, those early emits would be dropped (no listener yet) and
    // the user would never enter the conversation room → typing + read receipts silently break.

    // ── Conversation rooms (typing + read receipts are scoped to people viewing the thread) ──
    socket.on('conversation:join', async (conversationId: string) => {
      if (typeof conversationId === 'string') {
        await joinConversation(socket, conversationId, userId);
      }
    });
    socket.on('conversation:leave', (conversationId: string) => {
      if (typeof conversationId === 'string') leaveConversation(socket, conversationId);
    });

    // ── Typing — server enriches with the authenticated username, broadcasts to OTHERS only ──
    const relayTyping = async (conversationId: string, typing: boolean) => {
      if (typeof conversationId !== 'string') return;
      if (!(await isParticipant(conversationId, userId))) return;
      socket
        .to(convoRoom(conversationId))
        .emit('typing:user', { conversationId, userId, username, typing });
    };
    socket.on('typing:start', (conversationId: string) => relayTyping(conversationId, true));
    socket.on('typing:stop', (conversationId: string) => relayTyping(conversationId, false));

    // ── Read receipts (mark-on-open): persist lastReadMessageId + tell the other participant ──
    socket.on('message:read', async (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (typeof conversationId !== 'string') return;
      if (!(await isParticipant(conversationId, userId))) return;
      const result = await markConversationRead(conversationId, userId);
      if (!result) return; // no messages, or already read → nothing to broadcast
      socket.to(convoRoom(conversationId)).emit('read-receipt:update', {
        conversationId,
        userId,
        lastReadMessageId: result.messageId,
      });
    });

    // ── Disconnect: debounced offline (5s) + persist lastSeenAt on the user's last tab ──
    socket.on('disconnect', async () => {
      try {
        const partnerIds = await getConversationPartners(userId);
        presence.scheduleOffline(userId, socket.id, async () => {
          const lastSeenAt = new Date();
          try {
            await prisma.user.update({ where: { id: userId }, data: { lastSeenAt } });
          } catch (err) {
            console.error('[socket] lastSeenAt update failed', err);
          }
          emitPresenceOffline(userId, lastSeenAt.toISOString(), partnerIds);
        });
      } catch (err) {
        console.error('[socket] disconnect handling failed', err);
      }
    });

    // ── Presence (async, AFTER listeners): announce online to partners (once, on first tab) +
    // send me a snapshot of which partners are online and when each offline partner was last seen.
    void (async () => {
      try {
        const partnerIds = await getConversationPartners(userId);
        const firstConnection = presence.markOnline(userId, socket.id);
        if (firstConnection) emitPresenceOnline(userId, partnerIds);

        // last-seen for ALL partners (Issue 1 / T1) so offline partners show "Active <time>".
        const rows = partnerIds.length
          ? await prisma.user.findMany({
              where: { id: { in: partnerIds } },
              select: { id: true, lastSeenAt: true },
            })
          : [];
        const lastSeen: Record<string, string> = {};
        for (const r of rows) {
          if (r.lastSeenAt) lastSeen[r.id] = r.lastSeenAt.toISOString();
        }

        socket.emit('presence:snapshot', {
          online: presence.getOnlinePartners(partnerIds),
          lastSeen,
        });
      } catch (err) {
        console.error('[socket] presence on connect failed', err);
      }
    })();
  });

  console.log('🔌 Socket.io listening');
  return io;
}
