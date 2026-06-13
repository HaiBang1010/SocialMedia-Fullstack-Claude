// Phase 5.3a — message reactions: the 7-emoji quick set + aggregation helper.
import type { MessageReaction } from '@/types/api';

/**
 * The quick-react set (Q1, IG/Messenger pattern). SOURCE OF TRUTH — the backend Zod whitelist
 * (backend/src/modules/messages/messages.schema.ts REACTION_EMOJIS_BACKEND) is copied
 * byte-for-byte from here. ⚠️ `❤️` is U+2764 + U+FE0F; if you edit these, re-copy to the backend.
 */
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface ReactionGroup {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

/**
 * Aggregate RAW reaction rows into compact groups ("👍 3  ❤️ 1"), preserving first-seen order
 * (rows arrive createdAt asc from the backend, so the earliest-reacted emoji shows first).
 * reactedByMe marks the group the current user has picked (one reaction per user, so at most one).
 */
export function groupReactionsByEmoji(reactions: MessageReaction[], meId?: string): ReactionGroup[] {
  const order: string[] = [];
  const map = new Map<string, ReactionGroup>();
  for (const r of reactions) {
    let group = map.get(r.emoji);
    if (!group) {
      group = { emoji: r.emoji, count: 0, reactedByMe: false };
      map.set(r.emoji, group);
      order.push(r.emoji);
    }
    group.count += 1;
    if (meId && r.userId === meId) group.reactedByMe = true;
  }
  return order.map((e) => map.get(e)!);
}

/** The current user's reaction emoji on a message, or undefined. Drives toggle (tap same = remove). */
export function myReaction(reactions: MessageReaction[], meId?: string): string | undefined {
  if (!meId) return undefined;
  return reactions.find((r) => r.userId === meId)?.emoji;
}
