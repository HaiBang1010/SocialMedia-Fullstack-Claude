import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/types/api';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  // Phase 5.2 — render a "Seen" line under this (own) message. MessageThread decides which one
  // message in the thread gets it (the newest own message the other participant has read).
  showSeen?: boolean;
  // Phase 5.2 (T7) — retry a failed send. Called with this message (reuses its temp id).
  onRetry?: (message: Message) => void;
}

export default function MessageBubble({ message, isOwn, showSeen, onRetry }: MessageBubbleProps) {
  const isFailed = message.failed === true;
  // Optimistic messages carry a temp- id until the server responds (a failed one is no longer
  // "pending" — it shows the retry affordance instead of a spinner).
  const isPending = message.id.startsWith('temp-') && !isFailed;

  return (
    <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          // Width is capped by the parent burst column (max-w-[80%]); the bubble itself
          // must NOT use a fractional max-width — `max-w-[75%]` of the shrink-to-fit wrapper
          // collapses circularly and forces mid-word breaks ("He/llo"). overflow-wrap:anywhere
          // breaks long no-space tokens (URLs / "zzzz…") to fit instead of overflowing.
          'max-w-full whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl px-3 py-2 text-sm',
          isOwn
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm bg-muted text-foreground',
          isPending && 'opacity-60',
          isFailed && 'opacity-70 ring-1 ring-destructive',
        )}
      >
        {message.content}
        {isPending && (
          <Loader2
            className="ml-1 inline size-3 animate-spin align-[-0.1em]"
            aria-label="Sending"
          />
        )}
      </div>
      {isFailed ? (
        <button
          type="button"
          onClick={() => onRetry?.(message)}
          className="mt-0.5 px-1 text-[0.6rem] text-destructive hover:underline"
        >
          Failed — tap to retry
        </button>
      ) : (
        showSeen && <span className="mt-0.5 px-1 text-[0.6rem] text-muted-foreground">Seen</span>
      )}
    </div>
  );
}
