interface TypingIndicatorProps {
  usernames: string[];
}

// Phase 5.2 — compact typing line shown at the bottom of MessageThread (no avatar).
function label(usernames: string[]): string {
  if (usernames.length === 1) return `${usernames[0]} is typing`;
  if (usernames.length === 2) return `${usernames[0]} and ${usernames[1]} are typing`;
  return `${usernames[0]} and ${usernames.length - 1} others are typing`;
}

export default function TypingIndicator({ usernames }: TypingIndicatorProps) {
  if (usernames.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-1 pt-2 text-xs text-muted-foreground">
      <span className="truncate">{label(usernames)}</span>
      {/* Three staggered bouncing dots (keyframe `typing-dot` in index.css). */}
      <span className="flex items-center gap-0.5">
        <span className="typing-dot size-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: '0ms' }} />
        <span className="typing-dot size-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: '200ms' }} />
        <span className="typing-dot size-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: '400ms' }} />
      </span>
    </div>
  );
}
