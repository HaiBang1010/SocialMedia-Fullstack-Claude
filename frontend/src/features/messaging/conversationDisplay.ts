import type { Conversation, PublicUser } from '@/types/api';

interface ConversationDisplay {
  title: string;
  avatarUser: Pick<PublicUser, 'name' | 'avatarUrl'>;
  otherUserId?: string; // DIRECT only — the other participant's id, for presence lookup (5.2)
  otherUsername?: string; // DIRECT only — for navigating to their profile (/users/:username)
}

/**
 * What to show for a conversation in the list / detail header:
 * - DIRECT → the OTHER participant (their name + avatar + id)
 * - GROUP  → the group's name + (optional) group avatar (no single "other", so no presence)
 */
export function conversationDisplay(
  convo: Conversation,
  meId: string | undefined,
): ConversationDisplay {
  if (convo.type === 'DIRECT') {
    const other =
      convo.participants.find((p) => p.user.id !== meId)?.user ?? convo.participants[0]?.user;
    return {
      title: other?.name ?? 'Unknown',
      avatarUser: { name: other?.name ?? '?', avatarUrl: other?.avatarUrl ?? null },
      otherUserId: other?.id,
      otherUsername: other?.username,
    };
  }
  return {
    title: convo.name ?? 'Group',
    avatarUser: { name: convo.name ?? 'Group', avatarUrl: convo.avatarUrl ?? null },
  };
}
