import { REACTION_EMOJIS } from '@/lib/reactions';
import { cn } from '@/lib/utils';

interface ReactionPickerProps {
  // Called with the tapped emoji. The parent's toggle decides set-vs-replace-vs-remove.
  onSelect: (emoji: string) => void;
  // The user's current reaction on this message (highlighted so re-tapping it reads as "remove").
  currentEmoji?: string;
}

// Phase 5.3a — the 7-emoji quick row, rendered inside a Radix PopoverContent (the bubble owns the
// Popover open state + anchor; outside-click / ESC / scroll-dismiss come free from Radix).
export default function ReactionPicker({ onSelect, currentEmoji }: ReactionPickerProps) {
  return (
    <div className="flex items-center gap-0.5">
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          aria-label={`React with ${emoji}`}
          className={cn(
            'flex size-9 items-center justify-center rounded-full text-2xl leading-none transition-transform hover:scale-125',
            currentEmoji === emoji && 'bg-primary/15 ring-1 ring-primary',
          )}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
