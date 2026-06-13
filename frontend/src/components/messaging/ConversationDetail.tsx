import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Avatar from '@/components/common/Avatar';
import GroupAvatar from './GroupAvatar';
import { formatRelativeTime } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { useConversation } from '@/features/messaging/hooks/useConversation';
import { useConversationSocket } from '@/features/messaging/hooks/useConversationSocket';
import { conversationDisplay } from '@/features/messaging/conversationDisplay';
import MessageThread from './MessageThread';
import MessageInput from './MessageInput';

interface ConversationDetailProps {
  conversationId: string;
}

export default function ConversationDetail({ conversationId }: ConversationDetailProps) {
  const navigate = useNavigate();
  const meId = useAuthStore((s) => s.user?.id);
  const { data: conversation } = useConversation(conversationId);

  // Join the conversation room + bind typing / read-receipt events for this thread (5.2).
  useConversationSocket(conversationId);

  const display = conversation ? conversationDisplay(conversation, meId) : null;
  const otherUserId = display?.otherUserId;
  const otherUsername = display?.otherUsername;

  // Presence (DIRECT only) for the header subtitle + avatar dot.
  const isOnline = usePresenceStore((s) => (otherUserId ? !!s.online[otherUserId] : false));
  const lastSeen = usePresenceStore((s) => (otherUserId ? s.lastSeen[otherUserId] : undefined));

  // Header subtitle = presence only (typing now lives in the thread). DIRECT only.
  let subtitle: string | null = null;
  if (isOnline) {
    subtitle = 'Active now';
  } else if (lastSeen) {
    const rel = formatRelativeTime(lastSeen);
    subtitle = rel === 'now' ? 'Active now' : `Active ${rel} ago`;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        {/* Back button — mobile only (desktop keeps the list visible alongside). */}
        <button
          type="button"
          onClick={() => navigate('/messages')}
          aria-label="Back"
          className="-ml-1 rounded-full p-1 hover:bg-muted md:hidden"
        >
          <ArrowLeft className="size-5" />
        </button>
        {!display ? (
          <span className="text-sm text-muted-foreground">Loading…</span>
        ) : conversation?.type === 'DIRECT' && otherUsername ? (
          // DIRECT → tap avatar/name to open the other user's profile (GROUP header is not linked
          // until group settings land in 5.5). The mobile back button stays outside this Link.
          <Link
            to={`/users/${otherUsername}`}
            className="-mx-1 flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/50"
          >
            <Avatar user={display.avatarUser} size="sm" online={isOnline} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium leading-tight">{display.title}</span>
              {subtitle && (
                <span className="truncate text-xs leading-tight text-muted-foreground">
                  {subtitle}
                </span>
              )}
            </div>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {conversation?.type === 'GROUP' ? (
              <GroupAvatar users={conversation.participants.map((p) => p.user)} size="sm" />
            ) : (
              <Avatar user={display.avatarUser} size="sm" online={isOnline} />
            )}
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium leading-tight">{display.title}</span>
              {subtitle && (
                <span className="truncate text-xs leading-tight text-muted-foreground">
                  {subtitle}
                </span>
              )}
            </div>
          </div>
        )}
      </header>

      <MessageThread
        conversationId={conversationId}
        conversationType={conversation?.type}
        participants={conversation?.participants}
      />
      <MessageInput conversationId={conversationId} />
    </div>
  );
}
