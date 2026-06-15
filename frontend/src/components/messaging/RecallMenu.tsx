import { useState } from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRecallMessage } from '@/features/messaging/hooks/useRecallMessage';
import RecallConfirmDialog from './RecallConfirmDialog';
import type { Message } from '@/types/api';

// Mirror the backend RECALL_WINDOW_MS — the client hides/disables the action as a UX guard; the
// server is the authority (returns 410 past the window). A small clock drift just means a doomed
// request that rolls back optimistically.
const RECALL_WINDOW_MS = 15 * 60 * 1000;

interface RecallMenuProps {
  message: Message;
}

// Phase 5.5 — a "…" menu on your own messages with a single Recall action. Separate trigger from
// the reaction long-press/hover (Decision 6) so the two never collide. Recall → confirm dialog.
export default function RecallMenu({ message }: RecallMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const recall = useRecallMessage(message.conversationId);

  const withinWindow = Date.now() - new Date(message.createdAt).getTime() <= RECALL_WINDOW_MS;

  const handleConfirm = () => {
    recall.mutate(message.id, {
      onSuccess: () => setConfirmOpen(false),
      onError: () => setConfirmOpen(false), // optimistic patch already rolled back
    });
  };

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Message options"
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100',
              menuOpen && 'opacity-100',
            )}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-44 p-1">
          <button
            type="button"
            disabled={!withinWindow}
            title={withinWindow ? undefined : 'Cannot delete after 15 minutes'}
            onClick={() => {
              setMenuOpen(false);
              setConfirmOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent"
          >
            <Trash2 className="size-4" />
            Delete
          </button>
        </PopoverContent>
      </Popover>

      <RecallConfirmDialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!recall.isPending) setConfirmOpen(o);
        }}
        onConfirm={handleConfirm}
        isPending={recall.isPending}
      />
    </>
  );
}
