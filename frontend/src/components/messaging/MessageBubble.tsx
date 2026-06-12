import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/types/api';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export default function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  // Optimistic messages carry a temp- id until the server responds.
  const isPending = message.id.startsWith('temp-');

  return (
    <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
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
    </div>
  );
}
