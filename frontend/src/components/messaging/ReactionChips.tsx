import { groupReactionsByEmoji } from '@/lib/reactions';
import { cn } from '@/lib/utils';
import type { MessageReaction } from '@/types/api';

interface ReactionChipsProps {
  reactions: MessageReaction[];
  meId?: string;
  // Toggle a reaction emoji (the hook decides remove-if-mine vs replace).
  onToggle: (emoji: string) => void;
}

// Phase 5.3a — compact aggregate chips ("👍 3  ❤️ 1", Q5) floating just under the bubble (Q4).
// Each chip toggles that emoji; the chip the user picked is highlighted. Nothing renders with no
// reactions.
export default function ReactionChips({ reactions, meId, onToggle }: ReactionChipsProps) {
  const groups = groupReactionsByEmoji(reactions, meId);
  if (groups.length === 0) return null;

  return (
    <div className="-mt-1 flex flex-wrap gap-1">
      {groups.map((g) => (
        <button
          key={g.emoji}
          type="button"
          onClick={() => onToggle(g.emoji)}
          className={cn(
            'flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs leading-none shadow-sm transition-colors',
            g.reactedByMe
              ? 'border-primary bg-primary/15 text-foreground'
              : 'border-border bg-background text-muted-foreground hover:bg-muted',
          )}
        >
          <span className="text-sm">{g.emoji}</span>
          <span className="tabular-nums">{g.count}</span>
        </button>
      ))}
    </div>
  );
}
