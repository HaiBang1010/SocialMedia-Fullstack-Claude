import { useLayoutEffect, useMemo, useRef } from 'react';
import Avatar from '@/components/common/Avatar';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useAuthStore } from '@/stores/authStore';
import { useMessages } from '@/features/messaging/hooks/useMessages';
import { groupMessagesByBurst, type MessageBurst } from '@/lib/messageBurst';
import MessageBubble from './MessageBubble';

interface MessageThreadProps {
  conversationId: string;
}

export default function MessageThread({ conversationId }: MessageThreadProps) {
  const meId = useAuthStore((s) => s.user?.id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessages(conversationId);

  // The cache is newest-first; reverse to oldest-first for display (oldest top, newest bottom).
  const messages = useMemo(() => {
    const flat = data?.pages.flatMap((p) => p.messages) ?? [];
    return [...flat].reverse();
  }, [data]);

  const bursts = useMemo(() => groupMessagesByBurst(messages), [messages]);

  const newestId = messages.length ? messages[messages.length - 1]!.id : null;
  const prevNewestId = useRef<string | null>(null);
  const prevScrollHeight = useRef(0);
  const loadingOlder = useRef(false);

  // Load older messages when the top sentinel appears. Capture scrollHeight first so the
  // layout effect can restore the viewport (prepending at the top would otherwise jump).
  useInfiniteScroll(topRef, {
    onIntersect: () => {
      if (scrollRef.current) prevScrollHeight.current = scrollRef.current.scrollHeight;
      loadingOlder.current = true;
      fetchNextPage();
    },
    enabled: Boolean(hasNextPage) && !isFetchingNextPage,
  });

  // After the message list changes: keep the viewport stable when older messages prepend,
  // otherwise stick to the bottom (new message arrived, or initial load).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (loadingOlder.current) {
      el.scrollTop = el.scrollHeight - prevScrollHeight.current;
      loadingOlder.current = false;
    } else if (newestId !== prevNewestId.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevNewestId.current = newestId;
  }, [messages, newestId]);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div ref={topRef} aria-hidden className="h-px" />
      {isFetchingNextPage && (
        <p className="py-2 text-center text-xs text-muted-foreground">Loading…</p>
      )}

      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading messages…</p>
      ) : isError ? (
        <p className="py-6 text-center text-sm text-destructive">Couldn't load messages.</p>
      ) : messages.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No messages yet. Say hi 👋</p>
      ) : (
        <div className="flex flex-col gap-3">
          {bursts.map((burst) => (
            <BurstGroup key={burst.messages[0]!.id} burst={burst} isOwn={burst.senderId === meId} />
          ))}
        </div>
      )}
    </div>
  );
}

// One burst: a stack of same-sender bubbles with a single avatar (others only) + timestamp.
function BurstGroup({ burst, isOwn }: { burst: MessageBurst; isOwn: boolean }) {
  return (
    <div className={cn('flex gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {!isOwn && <Avatar user={burst.sender} size="sm" className="mt-auto" />}
      <div className={cn('flex max-w-[80%] flex-col gap-1', isOwn ? 'items-end' : 'items-start')}>
        {burst.messages.map((m) => (
          <MessageBubble key={m.id} message={m} isOwn={isOwn} />
        ))}
        <span className="px-1 text-[0.65rem] text-muted-foreground">
          {formatRelativeTime(burst.lastAt)}
        </span>
      </div>
    </div>
  );
}
