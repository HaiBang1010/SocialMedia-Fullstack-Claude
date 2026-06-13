/**
 * Phase 5.2 — in-memory presence tracking (process-lifetime, NOT persisted).
 *
 * A user is "online" while ≥1 of their sockets is connected — tracked as a per-user Set of
 * socket ids so multiple tabs count as one online user (D2). On the user's LAST disconnect we
 * wait OFFLINE_GRACE_MS before declaring them offline: a page refresh disconnects then
 * reconnects within that window, so the debounce prevents a presence flicker. A reconnect
 * inside the window cancels the pending offline.
 *
 * lastSeenAt is persisted to the DB by the caller (in the offline callback), not here.
 */
const OFFLINE_GRACE_MS = 5000;

const sockets = new Map<string, Set<string>>(); // userId -> live socket ids
const offlineTimers = new Map<string, NodeJS.Timeout>(); // userId -> pending offline timer

/**
 * Register a socket for a user. Returns true when this is the user's FIRST live socket (they
 * just came online → caller should broadcast presence:online). Cancels any pending offline.
 */
export function markOnline(userId: string, socketId: string): boolean {
  const pending = offlineTimers.get(userId);
  if (pending) {
    clearTimeout(pending);
    offlineTimers.delete(userId);
  }

  let set = sockets.get(userId);
  const wasOffline = !set || set.size === 0;
  if (!set) {
    set = new Set();
    sockets.set(userId, set);
  }
  set.add(socketId);
  return wasOffline;
}

/**
 * Deregister a socket. If it was the user's LAST socket, schedule `onOffline` after the grace
 * window — but only fire it if the user is still fully offline by then (a reconnect cancels it).
 */
export function scheduleOffline(userId: string, socketId: string, onOffline: () => void): void {
  const set = sockets.get(userId);
  if (set) {
    set.delete(socketId);
    if (set.size > 0) return; // other tabs still open → stay online
    sockets.delete(userId);
  }

  const timer = setTimeout(() => {
    offlineTimers.delete(userId);
    if (!isOnline(userId)) onOffline();
  }, OFFLINE_GRACE_MS);
  offlineTimers.set(userId, timer);
}

export function isOnline(userId: string): boolean {
  const set = sockets.get(userId);
  return !!set && set.size > 0;
}

/** Of the given partner ids, the subset currently online. */
export function getOnlinePartners(partnerIds: string[]): string[] {
  return partnerIds.filter(isOnline);
}
