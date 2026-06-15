import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import Avatar from '@/components/common/Avatar';
import Spinner from '@/components/common/Spinner';
import { useConversations } from '@/features/messaging/hooks/useConversations';
import { useSharePost } from '@/features/messaging/hooks/useSharePost';
import { conversationDisplay } from '@/features/messaging/conversationDisplay';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useAuthStore } from '@/stores/authStore';
import type { Post } from '@/types/api';

interface SharePostModalProps {
  post: Post;
  open: boolean;
  onClose: () => void;
}

// Phase 5.4c — share a post into a conversation. Single-select (E3): pick one conversation, send,
// close. An optional caption rides along (E2). Mirrors StoryViewersModal's Dialog + scroll list.
export default function SharePostModal({ post, open, onClose }: SharePostModalProps) {
  const meId = useAuthStore((s) => s.user?.id);
  const [caption, setCaption] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const share = useSharePost();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useConversations();
  const sentinelRef = useRef<HTMLDivElement>(null);
  useInfiniteScroll(sentinelRef, {
    onIntersect: fetchNextPage,
    enabled: open && !!hasNextPage && !isFetchingNextPage,
  });

  const conversations = data?.pages.flatMap((p) => p.conversations) ?? [];

  const reset = () => {
    setCaption('');
    setSentTo(null);
  };

  const handleSend = (conversationId: string) => {
    if (share.isPending) return;
    share.mutate(
      { conversationId, postId: post.id, content: caption.trim() || undefined },
      {
        onSuccess: () => {
          setSentTo(conversationId);
          // Brief "Sent ✓" confirmation, then close.
          setTimeout(() => {
            onClose();
            reset();
          }, 700);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          reset();
        }
      }}
    >
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogTitle className="border-b px-4 py-3">Share post</DialogTitle>
        <div className="border-b p-3">
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a message…"
            maxLength={5000}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="max-h-[55vh] overflow-y-auto">
          {isLoading ? (
            <div className="grid place-items-center py-10">
              <Spinner />
            </div>
          ) : conversations.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No conversations yet</p>
          ) : (
            <>
              <ul className="divide-y">
                {conversations.map((c) => {
                  const d = conversationDisplay(c, meId);
                  const justSent = sentTo === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        disabled={share.isPending}
                        onClick={() => handleSend(c.id)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60 disabled:opacity-60"
                      >
                        <Avatar user={d.avatarUser} size="md" />
                        <span className="truncate text-sm font-medium">{d.title}</span>
                        <span className="ml-auto shrink-0 text-xs font-semibold text-primary">
                          {justSent ? 'Sent ✓' : 'Send'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div ref={sentinelRef} />
              {isFetchingNextPage && (
                <div className="grid place-items-center py-4">
                  <Spinner />
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
