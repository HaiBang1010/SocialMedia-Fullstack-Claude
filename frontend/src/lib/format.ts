// Display formatters — no external date/number lib (hand-rolled on top of Intl).

// Min/max aspect ratio a feed image is allowed to occupy (IG-style):
// 0.8 = 4:5 portrait floor, 1.91 = landscape ceiling.
const MIN_RATIO = 0.8;
const MAX_RATIO = 1.91;

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const dateFmtWithYear = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const compactFmt = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

// Compact, IG-style relative time: "now" / "5m" / "2h" / "3d".
// Older than 7 days falls back to an absolute date ("Jun 3", or "Jun 3, 2024"
// once it crosses into another year).
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return 'now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d`;

  const date = new Date(then);
  const fmt = date.getFullYear() === new Date().getFullYear() ? dateFmt : dateFmtWithYear;
  return fmt.format(date);
}

// Compact counts: 999 → "999", 1243 → "1.2K", 2_300_000 → "2.3M".
export function formatNumber(n: number): string {
  return compactFmt.format(n);
}

// Video duration as "m:ss" (e.g. 15s → "0:15", 65s → "1:05"). Guards NaN/≤0.
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Derive a safe aspect ratio for a media item. Returns a clamped width/height
// ratio, or null when dimensions are missing (caller falls back to square).
export function clampAspectRatio(
  width: number | null,
  height: number | null,
): number | null {
  if (!width || !height) return null;
  const ratio = width / height;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
}

// Same calendar day in the viewer's local timezone.
export function isSameDay(a: string | Date, b: string | Date): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

// Centered message-thread separator label (Phase 5.2). Local 24h time, IG-style date prefix.
// English labels (deterministic, matches the app's English UI):
//   today → "14:07", yesterday → "Yesterday 14:07", within the last 6 days → "Mon 14:07",
//   same year → "Jun 3 14:07", else → "Jun 3, 2024 14:07".
export function formatDateSeparator(iso: string): string {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return '';
  const now = new Date();
  const time = target.toTimeString().slice(0, 5); // "HH:MM", local 24h

  if (isSameDay(target, now)) return time;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(target, yesterday)) return `Yesterday ${time}`;

  const sixDaysAgo = new Date(now);
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
  if (target > sixDaysAgo) {
    return `${target.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;
  }

  const opts: Intl.DateTimeFormatOptions =
    target.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' };
  return `${target.toLocaleDateString('en-US', opts)} ${time}`;
}
