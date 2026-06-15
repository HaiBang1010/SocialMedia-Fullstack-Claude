import { useState } from 'react';
import { Loader2, SmilePlus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useLongPress } from '@/hooks/useLongPress';
import { useReactToMessage } from '@/features/messaging/hooks/useReactToMessage';
import { myReaction } from '@/lib/reactions';
import { useMediaLightboxStore } from '@/stores/mediaLightboxStore';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import ReactionPicker from './ReactionPicker';
import ReactionChips from './ReactionChips';
import MessageMediaGrid from './MessageMediaGrid';
import VoicePlayer from './VoicePlayer';
import SharedPostCard from './SharedPostCard';
import RecallMenu from './RecallMenu';
import type { Message } from '@/types/api';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  // Phase 5.2/5.3b — read-receipt label under this (own) message ("Seen" for DIRECT, "Seen by N" /
  // "Seen by all" for GROUP). MessageThread computes the text + which one message carries it.
  showSeenLabel?: string;
  // Phase 5.2 (T7) — retry a failed send. Called with this message (reuses its temp id).
  onRetry?: (message: Message) => void;
}

export default function MessageBubble({ message, isOwn, showSeenLabel, onRetry }: MessageBubbleProps) {
  const meId = useAuthStore((s) => s.user?.id);
  const { toggle } = useReactToMessage(message.conversationId);
  const openLightbox = useMediaLightboxStore((s) => s.open);
  const [pickerOpen, setPickerOpen] = useState(false);

  const mediaItems = message.media ?? [];
  const hasMedia = mediaItems.length > 0;
  const isVoice = mediaItems.length === 1 && mediaItems[0]!.type === 'VOICE';
  // Phase 5.4c — standalone content kinds rendered without the usual bubble chrome.
  const isPostShare = message.contentType === 'POST_SHARE';
  const isJumbomoji = message.contentType === 'EMOJI';
  const isStickerOrGif =
    mediaItems.length === 1 && (mediaItems[0]!.type === 'STICKER' || mediaItems[0]!.type === 'GIF');
  const isFailed = message.failed === true;
  // Optimistic messages carry a temp- id until the server responds (a failed one is no longer
  // "pending" — it shows the retry affordance instead of a spinner).
  const isPending = message.id.startsWith('temp-') && !isFailed;
  // Can't react to a message that isn't persisted yet (no real id) — covers pending + failed.
  const canReact = !message.id.startsWith('temp-');
  const myEmoji = myReaction(message.reactions, meId);

  // Mobile: long-press the bubble to open the picker (desktop uses the hover button).
  const longPress = useLongPress(() => setPickerOpen(true));

  const handleSelect = (emoji: string) => {
    toggle(message.id, myEmoji, emoji);
    setPickerOpen(false);
  };

  // Phase 5.5 — a recalled message is a tombstone: it keeps its slot (Q7) but shows only a
  // "Message deleted" placeholder, no content/media/reactions/seen label/recall menu.
  if (message.deletedAt) {
    return (
      <div className={cn('flex flex-col gap-0.5', isOwn ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-2xl border border-dashed px-3 py-2 text-sm italic text-muted-foreground',
            isOwn ? 'rounded-br-sm' : 'rounded-bl-sm',
          )}
        >
          <Trash2 className="size-3.5 shrink-0" />
          <span>Message deleted</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('group flex flex-col gap-0.5', isOwn ? 'items-end' : 'items-start')}>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <div className={cn('flex items-center gap-1', isOwn ? 'flex-row-reverse' : 'flex-row')}>
          <PopoverAnchor asChild>
            {/* Anchor wraps media + caption so long-press / picker target the whole message. */}
            <div
              {...(canReact ? longPress : {})}
              className={cn('flex flex-col gap-1', isOwn ? 'items-end' : 'items-start')}
            >
              {isPostShare ? (
                <div className={cn(isFailed && 'rounded-xl ring-1 ring-destructive')}>
                  <SharedPostCard sharedPost={message.sharedPost ?? null} />
                </div>
              ) : isStickerOrGif ? (
                <img
                  src={mediaItems[0]!.url}
                  alt={mediaItems[0]!.type === 'GIF' ? 'GIF' : 'Sticker'}
                  className={cn(
                    'max-h-60 w-auto rounded-lg',
                    isPending && 'opacity-60',
                    isFailed && 'ring-1 ring-destructive',
                  )}
                />
              ) : isVoice ? (
                <div className={cn(isFailed && 'rounded-2xl ring-1 ring-destructive')}>
                  <VoicePlayer media={mediaItems[0]!} isOwn={isOwn} />
                </div>
              ) : hasMedia ? (
                <div className={cn('overflow-hidden rounded-2xl', isFailed && 'ring-1 ring-destructive')}>
                  <MessageMediaGrid media={mediaItems} onOpen={(i) => openLightbox(mediaItems, i)} />
                </div>
              ) : null}
              {/* Jumbomoji (Phase 5.4c): an emoji-only message renders large, no bubble background. */}
              {isJumbomoji && message.content && (
                <div className={cn('px-1 text-6xl leading-none', isPending && 'opacity-60')}>
                  {message.content}
                </div>
              )}
              {message.content && !isJumbomoji && (
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
                  {isPending && !hasMedia && (
                    <Loader2
                      className="ml-1 inline size-3 animate-spin align-[-0.1em]"
                      aria-label="Sending"
                    />
                  )}
                </div>
              )}
            </div>
          </PopoverAnchor>

          {canReact && (
            // Desktop affordance: a react button revealed on hover/focus (or while the picker is
            // open). Hidden by default; mobile uses long-press instead. This is a PLAIN button (NOT
            // a PopoverTrigger) — having a Trigger AND a custom PopoverAnchor coexist races Radix's
            // internal anchor registration and drops the positioning reference (picker jumps to the
            // viewport top-left). The bubble's PopoverAnchor is the sole anchor; open is controlled.
            <button
              type="button"
              aria-label="React to message"
              onClick={() => setPickerOpen((o) => !o)}
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100',
                pickerOpen && 'opacity-100',
              )}
            >
              <SmilePlus className="size-4" />
            </button>
          )}

          {/* Phase 5.5 — recall: own, persisted messages get a "…" menu (separate from the react
              trigger so the two don't collide). Sender-only (Q5); window enforced inside the menu. */}
          {canReact && isOwn && <RecallMenu message={message} />}
        </div>

        <PopoverContent side="top" align={isOwn ? 'end' : 'start'} className="w-auto p-1">
          <ReactionPicker currentEmoji={myEmoji} onSelect={handleSelect} />
        </PopoverContent>
      </Popover>

      {canReact && (
        <ReactionChips
          reactions={message.reactions}
          meId={meId}
          onToggle={(emoji) => toggle(message.id, myEmoji, emoji)}
        />
      )}

      {isFailed ? (
        <button
          type="button"
          onClick={() => onRetry?.(message)}
          className="px-1 text-[0.6rem] text-destructive hover:underline"
        >
          Failed — tap to retry
        </button>
      ) : (
        showSeenLabel && (
          <span className="px-1 text-[0.6rem] text-muted-foreground">{showSeenLabel}</span>
        )
      )}
    </div>
  );
}
