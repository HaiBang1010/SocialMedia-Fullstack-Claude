import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Avatar from '@/components/common/Avatar';
import { useAuthStore } from '@/stores/authStore';
import { useConversation } from '@/features/messaging/hooks/useConversation';
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

  const display = conversation ? conversationDisplay(conversation, meId) : null;

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
        {display ? (
          <>
            <Avatar user={display.avatarUser} size="sm" />
            <span className="truncate font-medium">{display.title}</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Loading…</span>
        )}
      </header>

      <MessageThread conversationId={conversationId} />
      <MessageInput conversationId={conversationId} />
    </div>
  );
}
