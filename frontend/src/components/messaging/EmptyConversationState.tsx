import { MessagesSquare } from 'lucide-react';

// Desktop-only placeholder shown in the detail pane when no conversation is selected.
export default function EmptyConversationState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
      <MessagesSquare className="size-12" strokeWidth={1.5} />
      <p className="text-sm font-medium text-foreground">Your messages</p>
      <p className="max-w-xs text-sm">Select a conversation to start chatting.</p>
    </div>
  );
}
