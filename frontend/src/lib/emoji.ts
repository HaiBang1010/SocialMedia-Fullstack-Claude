// Phase 5.4c — "jumbomoji" detection. MIRRORS backend/src/lib/emoji.ts byte-for-byte (keep in
// sync): a message whose content is ONLY emoji (≤ EMOJI_ONLY_MAX) renders large/no-bubble. The
// client uses this so an optimistic message picks contentType EMOJI and the bubble doesn't flicker
// normal→giant when the server's message swaps in.
//
// Counts GRAPHEME clusters via Intl.Segmenter (a ZWJ family or skin-tone counts as one), not code
// units — "≤ N chars" would mis-handle multi-codepoint emoji.

export const EMOJI_ONLY_MAX = 3;

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

export function isEmojiOnly(content: string | null | undefined): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  if (!trimmed) return false;

  const graphemes = [...segmenter.segment(trimmed)].map((s) => s.segment);
  if (graphemes.length === 0 || graphemes.length > EMOJI_ONLY_MAX) return false;

  return graphemes.every((g) => /\p{Extended_Pictographic}/u.test(g));
}
