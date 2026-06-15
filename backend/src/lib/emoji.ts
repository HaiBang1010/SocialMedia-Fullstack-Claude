// Phase 5.4c — "jumbomoji" detection. A message whose content is ONLY emoji (up to
// EMOJI_ONLY_MAX of them) is rendered large (no bubble), Instagram/WhatsApp-style. The
// contentType is derived server-side as EMOJI; the frontend mirrors this helper byte-for-byte
// (frontend/src/lib/emoji.ts) so an optimistic message picks the same contentType and the
// bubble doesn't flicker normal→giant on swap.
//
// We count GRAPHEME clusters via Intl.Segmenter (so a ZWJ family emoji or a skin-tone modifier
// counts as one), not code units — "≤ N chars" would mis-handle multi-codepoint emoji.

export const EMOJI_ONLY_MAX = 3;

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

/**
 * True when `content` is between 1 and EMOJI_ONLY_MAX emoji graphemes and nothing else
 * (whitespace trimmed). Each grapheme must contain an Extended_Pictographic codepoint, which
 * rejects letters/digits/punctuation (so "😂 lol" or "hi" → false).
 */
export function isEmojiOnly(content: string | null | undefined): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  if (!trimmed) return false;

  const graphemes = [...segmenter.segment(trimmed)].map((s) => s.segment);
  if (graphemes.length === 0 || graphemes.length > EMOJI_ONLY_MAX) return false;

  return graphemes.every((g) => /\p{Extended_Pictographic}/u.test(g));
}
