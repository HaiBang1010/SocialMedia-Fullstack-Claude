import type { Conversation, PublicUser } from '@/types/api';

interface ConversationDisplay {
  title: string;
  avatarUser: Pick<PublicUser, 'name' | 'avatarUrl'>;
}

/**
 * What to show for a conversation in the list / detail header:
 * - DIRECT → the OTHER participant (their name + avatar)
 * - GROUP  → the group's name + (optional) group avatar
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
    };
  }
  return {
    title: convo.name ?? 'Group',
    avatarUser: { name: convo.name ?? 'Group', avatarUrl: convo.avatarUrl ?? null },
  };
}
