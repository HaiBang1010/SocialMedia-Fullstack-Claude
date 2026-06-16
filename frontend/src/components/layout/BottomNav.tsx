import { NavLink } from 'react-router-dom';
import { Home, Search, Send, SquarePlus, User, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useComposerStore } from '@/stores/composerStore';
import { useUnreadTotal } from '@/features/messaging/hooks/useUnreadTotal';

interface BottomEntry {
  label: string;
  icon: LucideIcon;
  to?: string;
  badge?: 'messages';
}

const ITEMS: BottomEntry[] = [
  { label: 'Home', icon: Home, to: '/' },
  { label: 'Search', icon: Search, to: '/search' },
  { label: 'Create', icon: SquarePlus },
  { label: 'Messages', icon: Send, to: '/messages', badge: 'messages' },
  { label: 'Profile', icon: User, to: '/profile' },
];

export default function BottomNav() {
  const openComposer = useComposerStore((s) => s.open);
  const unreadMessages = useUnreadTotal().data ?? 0;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t bg-background/80 backdrop-blur md:hidden">
      {ITEMS.map(({ label, icon: Icon, to, badge }) => {
        // Center "Create" gets a filled primary badge.
        const isCreate = label === 'Create';
        const inner = (active = false) =>
          isCreate ? (
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Icon className="size-5" />
            </span>
          ) : (
            <span className="relative">
              <Icon
                className={cn('size-6', active && 'text-primary')}
                strokeWidth={active ? 2.5 : 2}
              />
              {badge === 'messages' && unreadMessages > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </span>
          );

        if (to) {
          return (
            <NavLink
              key={label}
              to={to}
              end={to === '/'}
              aria-label={label}
              className="flex items-center justify-center p-2"
            >
              {({ isActive }) => inner(isActive)}
            </NavLink>
          );
        }

        // "Create" opens the composer; the other placeholders stay disabled.
        if (isCreate) {
          return (
            <button
              key={label}
              type="button"
              aria-label={label}
              onClick={openComposer}
              className="flex items-center justify-center p-2"
            >
              {inner()}
            </button>
          );
        }

        return (
          <button
            key={label}
            type="button"
            disabled
            aria-disabled="true"
            aria-label={label}
            className="flex cursor-not-allowed items-center justify-center p-2 opacity-60"
          >
            {inner()}
          </button>
        );
      })}
    </nav>
  );
}
