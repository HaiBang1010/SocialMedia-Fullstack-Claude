import { useParams } from 'react-router-dom';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import ConversationList from '@/components/messaging/ConversationList';
import ConversationDetail from '@/components/messaging/ConversationDetail';
import EmptyConversationState from '@/components/messaging/EmptyConversationState';

// Both /messages and /messages/:id render this page. Desktop shows a two-pane layout (list +
// detail); mobile shows one pane at a time (the list, or the detail when an id is present).
// `key={id}` remounts the detail when switching conversations so thread/scroll state resets.
export default function MessagesPage() {
  const { id } = useParams();
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <div className="flex h-full">
        <aside className="w-80 shrink-0 border-r">
          <ConversationList activeId={id} />
        </aside>
        <section className="flex min-w-0 flex-1 flex-col">
          {id ? <ConversationDetail key={id} conversationId={id} /> : <EmptyConversationState />}
        </section>
      </div>
    );
  }

  return (
    <div className="h-full">
      {id ? <ConversationDetail key={id} conversationId={id} /> : <ConversationList activeId={id} />}
    </div>
  );
}
