import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { useSendMessage } from "@/features/messaging/hooks/useSendMessage";
import { useTypingEmit } from "@/features/messaging/hooks/useTypingEmit";

interface MessageInputProps {
  conversationId: string;
}

const MAX_HEIGHT = 128; // px — textarea grows up to ~5 rows then scrolls

export default function MessageInput({ conversationId }: MessageInputProps) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { mutate, isPending } = useSendMessage(conversationId);
  const { start: startTyping, stop: stopTyping } = useTypingEmit(conversationId);

  const resize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };

  const send = () => {
    const content = value.trim();
    if (!content || isPending) return;
    stopTyping(); // stop the typing indicator immediately on send
    mutate({ content });
    setValue("");
    // Reset the textarea height after clearing.
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = "auto";
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send();
  };

  return (
    <form onSubmit={onSubmit} className="flex shrink-0 items-end gap-2 border-t p-3">
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          resize();
          startTyping();
        }}
        onKeyDown={onKeyDown}
        onBlur={stopTyping}
        rows={1}
        placeholder="Message…"
        aria-label="Message"
        className="scrollbar-hide max-h-32 flex-1 resize-none rounded-2xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring "
      />
      <button
        type="submit"
        disabled={!value.trim() || isPending}
        aria-label="Send"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-50"
      >
        <Send className="size-4" />
      </button>
    </form>
  );
}
