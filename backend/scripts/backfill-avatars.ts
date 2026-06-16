/**
 * Phase 7 — backfill / refresh default avatars.
 *
 * Sets a DiceBear default URL for every user whose avatar is either NULL (never set) or already a
 * DiceBear default (so a style change, e.g. lorelei → toon-head, re-points existing defaults).
 * Users with a CUSTOM uploaded avatar (a non-DiceBear URL) are preserved untouched.
 *
 * Idempotent — a row already holding the exact target URL is skipped, so re-running is a no-op.
 *
 * Run:  npx tsx scripts/backfill-avatars.ts
 */
import { prisma } from '../src/lib/prisma';
import { generateAvatarUrl, DICEBEAR_HOST } from '../src/lib/avatar';

async function main() {
  const users = await prisma.user.findMany({
    where: { OR: [{ avatarUrl: null }, { avatarUrl: { contains: DICEBEAR_HOST } }] },
    select: { id: true, username: true, avatarUrl: true },
  });

  let updated = 0;
  for (const u of users) {
    const target = generateAvatarUrl(u.username);
    if (u.avatarUrl === target) continue; // already correct → skip (idempotent)
    await prisma.user.update({ where: { id: u.id }, data: { avatarUrl: target } });
    updated += 1;
  }

  console.log(`Backfilled ${updated} avatar(s) (${users.length - updated} already current).`);
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
