import * as storiesService from "../modules/stories/stories.service";

// Phase 4.4 — periodic sweep (every 5 min) that flips isArchived on stories past their 24h window.
// setInterval (no cron dependency, keeping the project's "0 new deps" stance). The
// active-stories queries already hide expired stories via the time filter, so this job
// is a cleanup/bookkeeping pass (it makes /stories/archive correct), not load-bearing
// for visibility — a missed tick only delays the flag, never leaks an expired story.

const ARCHIVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — sweet spot between user perception and DB cost

/**
 * Start the archive sweep: runs immediately (covers any window the server was down)
 * then every 5 minutes. Failures are logged and swallowed — the job must never crash the app.
 * Returns the interval handle so the caller can clearInterval on shutdown if desired.
 */
export function startArchiveJob(): NodeJS.Timeout {
  const run = async () => {
    try {
      const { count } = await storiesService.archiveExpiredStories();
      if (count > 0) {
        console.log(
          `[cron] Archived ${count} expired ${count === 1 ? "story" : "stories"}`,
        );
      }
    } catch (err) {
      console.error("[cron] archiveExpiredStories failed:", err);
    }
  };

  void run(); // immediately on start
  return setInterval(run, ARCHIVE_INTERVAL_MS); // every 5 minutes
}
