import { useEffect, useMemo, useState } from 'react';
import { Check, Search, Users, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import Avatar from '@/components/common/Avatar';
import Spinner from '@/components/common/Spinner';
import { useGroupable } from '@/features/messaging/hooks/useGroupable';
import { useCreateGroup } from '@/features/messaging/hooks/useCreateGroup';
import type { GroupableUser } from '@/types/api';

interface GroupCreateModalProps {
  open: boolean;
  onClose: () => void;
}

// A group caps at 10 members incl. the creator → at most 9 others (Phase 5.3c min is 2 others).
const MAX_OTHERS = 9;

// Phase 5.5 — create a group conversation. Search (recent partners + mutual followers) → multi-select
// (2–9 others) → optional name → Create. Name blank ⇒ the server auto-derives "Group with X, Y, Z".
// Mirrors SharePostModal's Dialog shell.
export default function GroupCreateModal({ open, onClose }: GroupCreateModalProps) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<GroupableUser[]>([]);
  const [name, setName] = useState('');
  const create = useCreateGroup();

  // Debounce the search term (300ms) before it drives the query.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useGroupable(debounced, open);
  const users = useMemo(() => data ?? [], [data]);
  const recent = users.filter((u) => u.source === 'recent');
  const mutual = users.filter((u) => u.source === 'mutual');

  const selectedIds = new Set(selected.map((u) => u.id));
  const atMax = selected.length >= MAX_OTHERS;
  const canCreate = selected.length >= 2 && !create.isPending;

  const reset = () => {
    setSearch('');
    setDebounced('');
    setSelected([]);
    setName('');
  };

  const toggle = (user: GroupableUser) => {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : prev.length >= MAX_OTHERS
          ? prev // at cap — ignore
          : [...prev, user],
    );
  };

  const handleCreate = () => {
    if (!canCreate) return;
    create.mutate(
      { participantIds: selected.map((u) => u.id), name: name.trim() || undefined },
      {
        onSuccess: () => {
          onClose();
          reset();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          reset();
        }
      }}
    >
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogTitle className="border-b px-4 py-3">New group</DialogTitle>

        {/* Optional group name — blank ⇒ server auto-derives "Group with …". */}
        <div className="border-b p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name (optional)"
            maxLength={100}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Selected pills (removable). */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b p-3">
            {selected.map((u) => (
              <span
                key={u.id}
                className="flex items-center gap-1 rounded-full bg-muted py-1 pl-1 pr-2 text-xs"
              >
                <Avatar user={u} size="xs" />
                <span className="max-w-[8rem] truncate font-medium">{u.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${u.name}`}
                  onClick={() => toggle(u)}
                  className="grid size-4 place-items-center rounded-full hover:bg-background"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search. */}
        <div className="border-b p-3">
          <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people"
              className="w-full bg-transparent text-sm focus:outline-none"
            />
          </div>
        </div>

        {/* Suggestion list. */}
        <div className="max-h-[40vh] min-h-[8rem] overflow-y-auto">
          {isLoading ? (
            <div className="grid place-items-center py-10">
              <Spinner />
            </div>
          ) : users.length === 0 ? (
            <EmptyState searching={debounced.length > 0} />
          ) : (
            <>
              <Section title="Recent" users={recent} selectedIds={selectedIds} atMax={atMax} onToggle={toggle} />
              <Section title="Mutual followers" users={mutual} selectedIds={selectedIds} atMax={atMax} onToggle={toggle} />
            </>
          )}
        </div>

        {/* Footer. */}
        <div className="border-t p-3">
          <button
            type="button"
            disabled={!canCreate}
            onClick={handleCreate}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {create.isPending
              ? 'Creating…'
              : selected.length < 2
                ? 'Select at least 2 people'
                : `Create group (${selected.length})`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ searching }: { searching: boolean }) {
  return (
    <div className="grid place-items-center gap-2 py-10 text-center">
      <Users className="size-7 text-muted-foreground" />
      <p className="px-6 text-sm text-muted-foreground">
        {searching
          ? 'No matches among your recent chats or mutual follows.'
          : 'No one to add yet. Follow people or start a conversation first.'}
      </p>
    </div>
  );
}

interface SectionProps {
  title: string;
  users: GroupableUser[];
  selectedIds: Set<string>;
  atMax: boolean;
  onToggle: (user: GroupableUser) => void;
}

function Section({ title, users, selectedIds, atMax, onToggle }: SectionProps) {
  if (users.length === 0) return null;
  return (
    <div>
      <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul>
        {users.map((u) => {
          const checked = selectedIds.has(u.id);
          // At the cap, unselected rows can't be added (but you can still deselect).
          const disabled = atMax && !checked;
          return (
            <li key={u.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggle(u)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/60 disabled:opacity-40"
              >
                <Avatar user={u} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">@{u.username}</span>
                </span>
                <span
                  className={
                    checked
                      ? 'grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground'
                      : 'size-5 shrink-0 rounded-full border'
                  }
                >
                  {checked && <Check className="size-3.5" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
