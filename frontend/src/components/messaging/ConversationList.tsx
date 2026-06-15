import { useRef, useState } from "react";
import { MessagesSquare, SquarePen } from "lucide-react";
import EmptyState from "@/components/common/EmptyState";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useConversations } from "@/features/messaging/hooks/useConversations";
import ConversationListItem from "./ConversationListItem";
import GroupCreateModal from "./GroupCreateModal";

interface ConversationListProps {
  activeId?: string;
}

export default function ConversationList({ activeId }: ConversationListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useConversations();

  useInfiniteScroll(sentinelRef, {
    onIntersect: fetchNextPage,
    enabled: Boolean(hasNextPage) && !isFetchingNextPage,
  });

  const conversations = data?.pages.flatMap((p) => p.conversations) ?? [];

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-[17.5px]">
        <h1 className="font-heading text-xl font-semibold">Messages</h1>
        <button
          type="button"
          aria-label="New group"
          title="New group"
          onClick={() => setGroupModalOpen(true)}
          className="grid size-8 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <SquarePen className="size-5" />
        </button>
      </header>

      <GroupCreateModal open={groupModalOpen} onClose={() => setGroupModalOpen(false)} />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ListSkeleton />
        ) : isError ? (
          <p className="p-6 text-sm text-destructive">Couldn't load conversations.</p>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No conversations yet"
            description="Start a chat from someone's profile."
          />
        ) : (
          <>
            {conversations.map((c) => (
              <ConversationListItem
                key={c.id}
                conversation={c}
                isActive={c.id === activeId}
              />
            ))}
            <div ref={sentinelRef} aria-hidden className="h-px" />
            {isFetchingNextPage && (
              <p className="py-3 text-center text-xs text-muted-foreground">Loading…</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
