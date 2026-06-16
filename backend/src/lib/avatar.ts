// DiceBear style + version for default avatars. "toon-head" (half-body cartoon characters) only
// exists from DiceBear 9.x — it 404s on 7.x. A URL containing this marker is treated as a default
// avatar by the backfill (replaceable when the style changes); a non-DiceBear URL = a custom upload.
export const DICEBEAR_HOST = 'api.dicebear.com';

/**
 * Phase 7 — deterministic default avatar (DiceBear "toon-head" style), keyed by username.
 * Pure URL builder: no dependency, no network call. The URL is stored in User.avatarUrl at
 * register (and backfilled for existing users); the frontend Avatar just renders it like any
 * other avatar, falling back to initials only if the image fails to load.
 */
export function generateAvatarUrl(username: string): string {
  const seed = encodeURIComponent(username);
  return `https://api.dicebear.com/9.x/toon-head/svg?seed=${seed}`;
}
