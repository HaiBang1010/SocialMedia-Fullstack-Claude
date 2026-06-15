import { useEffect, useState } from "react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Loader2 } from "lucide-react";
import { giphyApi, type GiphyType } from "@/api";
import { useThemeStore } from "@/stores/themeStore";
import { cn } from "@/lib/utils";
import type { GiphyItem } from "@/types/api";

type Tab = "emoji" | "stickers" | "gifs";

interface UnifiedMediaPickerProps {
  onEmoji: (native: string) => void;
  onGiphy: (item: GiphyItem, type: "STICKER" | "GIF") => void;
}

// Maps the two Giphy tabs to the Giphy endpoint family + our MediaType.
const GIPHY_TAB: Record<
  "stickers" | "gifs",
  { type: GiphyType; mediaType: "STICKER" | "GIF" }
> = {
  stickers: { type: "stickers", mediaType: "STICKER" },
  gifs: { type: "gif", mediaType: "GIF" },
};

const TABS: { key: Tab; label: string }[] = [
  { key: "emoji", label: "Emoji" },
  { key: "stickers", label: "Stickers" },
  { key: "gifs", label: "GIFs" },
];

// Phase 5.4c — one picker, 3 tabs (Emoji | Stickers | GIFs). Hand-rolled tab toggle (no shadcn
// tabs). Emoji tab embeds emoji-mart (its own search + library); Stickers/GIFs hit the backend
// Giphy proxy. Mounted inside a Popover by MessageInput.
export default function UnifiedMediaPicker({
  onEmoji,
  onGiphy,
}: UnifiedMediaPickerProps) {
  const [tab, setTab] = useState<Tab>("emoji");
  const theme = useThemeStore((s) => s.theme);

  return (
    <div className="w-[340px]">
      <div className="mb-2 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "emoji" ? (
        <div className="emoji-picker-full w-full">
          <Picker
            data={data}
            theme={theme}
            dynamicWidth
            previewPosition="none"
            skinTonePosition="search"
            onEmojiSelect={(e: { native: string }) => onEmoji(e.native)}
          />
        </div>
      ) : (
        <GiphyGrid
          giphyType={GIPHY_TAB[tab].type}
          onSelect={(item) => onGiphy(item, GIPHY_TAB[tab].mediaType)}
        />
      )}
    </div>
  );
}

// Search + masonry grid for one Giphy family. Empty query → trending; otherwise debounced search.
function GiphyGrid({
  giphyType,
  onSelect,
}: {
  giphyType: GiphyType;
  onSelect: (item: GiphyItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GiphyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const q = query.trim();
    setLoading(true);
    setError(false);
    // Debounce typed queries; load trending immediately when the box is empty.
    const timer = setTimeout(
      async () => {
        try {
          const result = q
            ? await giphyApi.search(q, giphyType)
            : await giphyApi.trending(giphyType);
          if (!cancelled) setItems(result);
        } catch {
          if (!cancelled) {
            setItems([]);
            setError(true);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      },
      q ? 400 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, giphyType]);

  return (
    <div className="flex flex-col gap-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${giphyType === "stickers" ? "stickers" : "GIFs"}…`}
        className="rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="scrollbar-hide h-[300px] overflow-y-auto">
        {loading ? (
          <div className="grid h-full place-items-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="grid h-full place-items-center px-4 text-center text-xs text-muted-foreground">
            Couldn&apos;t load from Giphy. Try again.
          </p>
        ) : items.length === 0 ? (
          <p className="grid h-full place-items-center text-xs text-muted-foreground">
            No results
          </p>
        ) : (
          <div className="columns-2 gap-1.5 [&>button]:mb-1.5">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className="block w-full overflow-hidden rounded-md bg-muted transition-opacity hover:opacity-80"
              >
                <img src={item.url} alt="" loading="lazy" className="w-full" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
