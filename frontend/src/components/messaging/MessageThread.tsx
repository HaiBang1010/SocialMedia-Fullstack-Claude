import { Fragment, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '@/components/common/Avatar';
import { cn } from '@/lib/utils';
import { isSameDay } from '@/lib/format';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useAuthStore } from '@/stores/authStore';
import { useTypingStore } from '@/stores/typingStore';
import { useMessages } from '@/features/messaging/hooks/useMessages';
import { useSendMessage } from '@/features/messaging/hooks/useSendMessage';
import { groupMessagesByBurst, type MessageBurst } from '@/lib/messageBurst';
import type { Message } from '@/types/api';
import MessageBubble from './MessageBubble';
import DateSeparator from './DateSeparator';
import TypingIndicator from './TypingIndicator';

interface MessageThreadProps {
  conversationId: string;
  // The other participant's last-read message id (DIRECT only) — drives the "Seen" indicator.
  otherReadMessageId?: string | null;
}

const GAP_MS = 60 * 60 * 1000; // insert a separator on a >1h gap between same-day bursts

// A date separator precedes a burst when it's the first one, the day changed, or there's a >1h gap.
function shouldShowSeparator(prev: MessageBurst | undefined, current: MessageBurst): boolean {
  if (!prev) return true;
  if (!isSameDay(prev.lastAt, current.firstAt)) return true;
  return new Date(current.firstAt).getTime() - new Date(prev.lastAt).getTime() > GAP_MS;
}

export default function MessageThread({ conversationId, otherReadMessageId }: MessageThreadProps) {
  const meId = useAuthStore((s) => s.user?.id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessages(conversationId);
  const { mutate: send } = useSendMessage(conversationId);

  // Who is typing in this conversation, excluding myself (typing now lives in the thread, 5.2 polish).
  const typingMap = useTypingStore((s) => s.byConversation[conversationId]);
  const typingNames = typingMap
    ? Object.entries(typingMap)
        .filter(([uid]) => uid !== meId)
        .map(([, name]) => name)
    : [];
  const typingActive = typingNames.length > 0;

  // Retry a failed send (T7): reuse the failed message's temp id so it swaps in place.
  const onRetry = useCallback(
    (m: Message) => {
      if (m.content) send({ content: m.content, retryTempId: m.id });
    },
    [send],
  );

  // The cache is newest-first; reverse to oldest-first for display (oldest top, newest bottom).
  const messages = useMemo(() => {
    const flat = data?.pages.flatMap((p) => p.messages) ?? [];
    return [...flat].reverse();
  }, [data]);

  const bursts = useMemo(() => groupMessagesByBurst(messages), [messages]);

  // "Seen" goes under the NEWEST own message at-or-before the other person's read cursor. We
  // compute it positionally (not by comparing ids) because message ids are cuids — not ordered.
  // T5: once the recipient has replied AFTER reading, hide "Seen" (their reply implies it).
  const seenMessageId = useMemo(() => {
    if (!otherReadMessageId || !meId) return null;
    const readIndex = messages.findIndex((m) => m.id === otherReadMessageId);
    if (readIndex === -1) return null;
    // In a DIRECT chat the only other sender is the recipient, so senderId !== meId = "they replied".
    const recipientRepliedAfter = messages.slice(readIndex + 1).some((m) => m.senderId !== meId);
    if (recipientRepliedAfter) return null;
    for (let i = readIndex; i >= 0; i--) {
      if (messages[i]!.senderId === meId) return messages[i]!.id;
    }
    return null;
  }, [messages, otherReadMessageId, meId]);

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

  // Keep the typing indicator in view: when it appears and the user is already near the bottom,
  // scroll down so it isn't hidden just below the fold (don't yank a user reading history).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !typingActive) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) el.scrollTop = el.scrollHeight;
  }, [typingActive]);

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
          {bursts.map((burst, idx) => (
            <Fragment key={burst.messages[0]!.id}>
              {shouldShowSeparator(bursts[idx - 1], burst) && (
                <DateSeparator iso={burst.firstAt} />
              )}
              <BurstGroup
                burst={burst}
                isOwn={burst.senderId === meId}
                seenMessageId={seenMessageId}
                onRetry={onRetry}
              />
            </Fragment>
          ))}
        </div>
      )}

      {typingActive && <TypingIndicator usernames={typingNames} />}
    </div>
  );
}

// One burst: a stack of same-sender bubbles with a single avatar (others only). Timestamps live
// in the date separators now (5.2 polish), so the burst no longer renders a per-burst time.
function BurstGroup({
  burst,
  isOwn,
  seenMessageId,
  onRetry,
}: {
  burst: MessageBurst;
  isOwn: boolean;
  seenMessageId: string | null;
  onRetry: (message: Message) => void;
}) {
  return (
    <div className={cn('flex gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {!isOwn && (
        // Tap the other person's avatar → their profile (own messages have no avatar).
        <Link
          to={`/users/${burst.sender.username}`}
          className="mt-auto shrink-0 transition-opacity hover:opacity-80"
        >
          <Avatar user={burst.sender} size="sm" />
        </Link>
      )}
      <div className={cn('flex max-w-[80%] flex-col gap-1', isOwn ? 'items-end' : 'items-start')}>
        {burst.messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isOwn={isOwn}
            showSeen={isOwn && m.id === seenMessageId}
            onRetry={onRetry}
          />
        ))}
      </div>
    </div>
  );
}
