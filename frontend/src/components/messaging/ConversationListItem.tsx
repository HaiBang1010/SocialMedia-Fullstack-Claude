import { NavLink } from 'react-router-dom';
import Avatar from '@/components/common/Avatar';
import GroupAvatar from './GroupAvatar';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { conversationDisplay } from '@/features/messaging/conversationDisplay';
import type { Conversation } from '@/types/api';

interface ConversationListItemProps {
  conversation: Conversation;
  isActive: boolean;
}

// Single-line preview of the last message (CSS-truncated). No messages yet → placeholder.
function previewText(conversation: Conversation): string {
  const last = conversation.lastMessage;
  if (!last) return 'No messages yet';
  return last.content ?? 'Message';
}

export default function ConversationListItem({ conversation, isActive }: ConversationListItemProps) {
  const meId = useAuthStore((s) => s.user?.id);
  const { title, avatarUser, otherUserId } = conversationDisplay(conversation, meId);
  // DIRECT only — green dot when the other participant is online (GROUP has no single "other").
  const isOnline = usePresenceStore((s) => (otherUserId ? !!s.online[otherUserId] : false));

  return (
    <NavLink
      to={`/messages/${conversation.id}`}
      className={cn(
        'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted',
        isActive && 'bg-muted',
      )}
    >
      {conversation.type === 'GROUP' ? (
        <GroupAvatar users={conversation.participants.map((p) => p.user)} size="md" />
      ) : (
        <Avatar user={avatarUser} size="md" online={isOnline} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{title}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatRelativeTime(conversation.lastMessageAt)}
          </span>
        </div>
        <p className="truncate text-sm text-muted-foreground">{previewText(conversation)}</p>
      </div>
    </NavLink>
  );
}
