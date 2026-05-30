// Static placeholders — real suggestions arrive in Phase 2.
const SUGGESTIONS = [
  { name: "Maya Chen", username: "mayac", reason: "Follows you" },
  { name: "Leo Park", username: "leop", reason: "New to Beng" },
  { name: "Ava Rossi", username: "avar", reason: "Suggested for you" },
  { name: "Noah Kim", username: "noahk", reason: "Popular" },
  { name: "Sara Diaz", username: "sarad", reason: "Suggested for you" },
];

const FOOTER_LINKS = ["About", "Help", "Privacy", "Terms", "Language"];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function RightRail() {
  return (
    <aside className="hidden w-72 shrink-0 border-l px-6 py-8 lg:block">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-muted-foreground">
          Suggested for you
        </span>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="cursor-not-allowed text-xs font-medium opacity-60"
        >
          See all
        </button>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {SUGGESTIONS.map((u) => (
          <li key={u.username} className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {initials(u.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">@{u.username}</div>
              <div className="truncate text-xs text-muted-foreground">{u.reason}</div>
            </div>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="cursor-not-allowed text-xs font-semibold text-primary opacity-60"
            >
              Follow
            </button>
          </li>
        ))}
      </ul>

      <footer className="mt-8 flex flex-col gap-3 text-xs text-muted-foreground">
        <nav className="flex flex-wrap gap-x-2 gap-y-1">
          {FOOTER_LINKS.map((link) => (
            <span key={link} className="opacity-70">
              {link}
            </span>
          ))}
        </nav>
        <span>© 2026 Beng</span>
      </footer>
    </aside>
  );
}
