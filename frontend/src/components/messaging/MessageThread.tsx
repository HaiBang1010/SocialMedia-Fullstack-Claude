import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import Avatar from '@/components/common/Avatar';
import { cn } from '@/lib/utils';
import { isSameDay } from '@/lib/format';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useAuthStore } from '@/stores/authStore';
import { useTypingStore } from '@/stores/typingStore';
import { useMessages } from '@/features/messaging/hooks/useMessages';
import { useSendMessage } from '@/features/messaging/hooks/useSendMessage';
import { groupMessagesByBurst, type MessageBurst } from '@/lib/messageBurst';
import type { ConversationType, Message, Participant } from '@/types/api';
import MessageBubble from './MessageBubble';
import DateSeparator from './DateSeparator';
import TypingIndicator from './TypingIndicator';

interface MessageThreadProps {
  conversationId: string;
  // Phase 5.2/5.3b — drives the read-receipt indicator. The full participants array (each with
  // their lastReadMessageId) + the conversation type let the thread compute "Seen" (DIRECT) or
  // "Seen by N" / "Seen by all" (GROUP) positionally. Undefined while the conversation loads.
  participants?: Participant[];
  conversationType?: ConversationType;
}

const GAP_MS = 60 * 60 * 1000; // insert a separator on a >1h gap between same-day bursts

// A date separator precedes a burst when it's the first one, the day changed, or there's a >1h gap.
function shouldShowSeparator(prev: MessageBurst | undefined, current: MessageBurst): boolean {
  if (!prev) return true;
  if (!isSameDay(prev.lastAt, current.firstAt)) return true;
  return new Date(current.firstAt).getTime() - new Date(prev.lastAt).getTime() > GAP_MS;
}

export default function MessageThread({
  conversationId,
  participants,
  conversationType,
}: MessageThreadProps) {
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

  // Retry a failed send (T7): reuse the failed message's temp id so it swaps in place. Works for
  // text and media (media resumes from the stashed attachments — only unfinished items re-upload).
  const onRetry = useCallback(
    (m: Message) => {
      send({ tempId: m.id, content: m.content ?? undefined, isRetry: true });
    },
    [send],
  );

  // The cache is newest-first; reverse to oldest-first for display (oldest top, newest bottom).
  const messages = useMemo(() => {
    const flat = data?.pages.flatMap((p) => p.messages) ?? [];
    return [...flat].reverse();
  }, [data]);

  const bursts = useMemo(() => groupMessagesByBurst(messages), [messages]);

  // Read-receipt indicator, computed POSITIONALLY (message ids are cuids — not time-ordered — so
  // we compare positions in the already-sorted `messages` array, never id strings). Returns the
  // one own message that should carry the label, plus the label text. null = render nothing.
  // - DIRECT: "Seen" under the newest own message at-or-before the recipient's read cursor; hidden
  //   once the recipient has replied AFTER reading (T5 — their reply implies they saw it).
  // - GROUP: "Seen by N" / "Seen by all" under the newest own message read by ≥1 other member. No
  //   hide-on-reply (the "recipient" is multiple people).
  const seenInfo = useMemo<{ messageId: string; label: string } | null>(() => {
    if (!meId || !participants || participants.length === 0) return null;
    const others = participants.filter((p) => p.user.id !== meId);
    if (others.length === 0) return null;

    if (conversationType === 'DIRECT') {
      const otherReadId = others[0]?.lastReadMessageId;
      if (!otherReadId) return null;
      const readIndex = messages.findIndex((m) => m.id === otherReadId);
      if (readIndex === -1) return null;
      const recipientRepliedAfter = messages.slice(readIndex + 1).some((m) => m.senderId !== meId);
      if (recipientRepliedAfter) return null;
      for (let i = readIndex; i >= 0; i--) {
        if (messages[i]!.senderId === meId) return { messageId: messages[i]!.id, label: 'Seen' };
      }
      return null;
    }

    // GROUP — each other member's read position (−1 when unread / message not loaded / deleted).
    const readIdxByUser = others.map((p) =>
      p.lastReadMessageId ? messages.findIndex((m) => m.id === p.lastReadMessageId) : -1,
    );
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.senderId !== meId) continue;
      const seenCount = readIdxByUser.filter((idx) => idx >= i).length;
      if (seenCount > 0) {
        const label = seenCount === others.length ? 'Seen by all' : `Seen by ${seenCount}`;
        return { messageId: messages[i]!.id, label };
      }
    }
    return null;
  }, [messages, participants, conversationType, meId]);

  const newestId = messages.length ? messages[messages.length - 1]!.id : null;
  const prevNewestId = useRef<string | null>(null);
  const prevScrollHeight = useRef(0);
  const loadingOlder = useRef(false);
  // Whether the viewport is pinned to (near) the bottom — captured on scroll so the layout effect
  // can decide to re-stick after content GROWS in place (e.g. a reaction chip — Bug 1). Also drives
  // the floating "scroll to latest" button (Bug 2).
  const atBottomRef = useRef(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = distance < 120; // "near bottom" — keep sticking through content growth
    setShowScrollBtn(distance > 200); // React bails out when the boolean is unchanged
  }, []);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

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
      el.scrollTop = el.scrollHeight; // new message / initial load
    } else if (atBottomRef.current) {
      // Same newest message but the list re-rendered taller in place (e.g. a reaction chip added
      // height to the bottom bubble). If the user was pinned to the bottom, stay there (Bug 1).
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
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto px-4 py-4">
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
                  seenInfo={seenInfo}
                  onRetry={onRetry}
                />
              </Fragment>
            ))}
          </div>
        )}

        {typingActive && <TypingIndicator usernames={typingNames} />}
      </div>

      {/* Bug 2 — floating jump-to-latest, shown only when scrolled up past ~200px. */}
      {showScrollBtn && (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="Scroll to latest messages"
          className="absolute bottom-4 right-4 z-10 flex size-9 items-center justify-center rounded-full border bg-background text-foreground shadow-md transition-colors hover:bg-muted"
        >
          <ChevronDown className="size-5" />
        </button>
      )}
    </div>
  );
}

// One burst: a stack of same-sender bubbles with a single avatar (others only). Timestamps live
// in the date separators now (5.2 polish), so the burst no longer renders a per-burst time.
function BurstGroup({
  burst,
  isOwn,
  seenInfo,
  onRetry,
}: {
  burst: MessageBurst;
  isOwn: boolean;
  seenInfo: { messageId: string; label: string } | null;
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
            showSeenLabel={isOwn && m.id === seenInfo?.messageId ? seenInfo.label : undefined}
            onRetry={onRetry}
          />
        ))}
      </div>
    </div>
  );
}
