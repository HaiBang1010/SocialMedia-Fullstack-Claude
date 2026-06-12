// Group consecutive messages from the same sender within a short time window into a single
// "burst" — IG-style stacking (one avatar + one timestamp per burst). Pure function over an
// OLDEST-FIRST array (MessageThread reverses the newest-first cache before calling this).
// Optimistic temp messages group naturally — they carry senderId + createdAt.

import type { Message } from '@/types/api';

export const BURST_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export interface MessageBurst {
  senderId: string;
  sender: Message['sender'];
  messages: Message[];
  firstAt: string; // ISO — first message's createdAt
  lastAt: string; // ISO — last message's createdAt
}

// `messages` MUST be oldest-first. A message joins the current burst when it has the same
// sender AND falls within `thresholdMs` of the burst's previous message.
export function groupMessagesByBurst(
  messages: Message[],
  thresholdMs: number = BURST_THRESHOLD_MS,
): MessageBurst[] {
  const bursts: MessageBurst[] = [];

  for (const message of messages) {
    const current = bursts[bursts.length - 1];
    const within =
      !!current &&
      current.senderId === message.senderId &&
      new Date(message.createdAt).getTime() - new Date(current.lastAt).getTime() <= thresholdMs;

    if (within) {
      current.messages.push(message);
      current.lastAt = message.createdAt;
    } else {
      bursts.push({
        senderId: message.senderId,
        sender: message.sender,
        messages: [message],
        firstAt: message.createdAt,
        lastAt: message.createdAt,
      });
    }
  }

  return bursts;
}
