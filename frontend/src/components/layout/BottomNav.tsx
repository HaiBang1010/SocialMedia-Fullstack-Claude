import { NavLink } from 'react-router-dom';
import { Heart, Home, Search, SquarePlus, User, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomEntry {
  label: string;
  icon: LucideIcon;
  to?: string;
}

const ITEMS: BottomEntry[] = [
  { label: 'Home', icon: Home, to: '/' },
  { label: 'Search', icon: Search },
  { label: 'Create', icon: SquarePlus },
  { label: 'Notifications', icon: Heart },
  { label: 'Profile', icon: User, to: '/profile' },
];

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t bg-background/80 backdrop-blur md:hidden">
      {ITEMS.map(({ label, icon: Icon, to }) => {
        // Center "Create" gets a filled primary badge.
        const isCreate = label === 'Create';
        const inner = (active = false) =>
          isCreate ? (
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Icon className="size-5" />
            </span>
          ) : (
            <Icon
              className={cn('size-6', active && 'text-primary')}
              strokeWidth={active ? 2.5 : 2}
            />
          );

        return to ? (
          <NavLink
            key={label}
            to={to}
            end={to === '/'}
            aria-label={label}
            className="flex items-center justify-center p-2"
          >
            {({ isActive }) => inner(isActive)}
          </NavLink>
        ) : (
          <button
            key={label}
            type="button"
            disabled
            aria-disabled="true"
            aria-label={label}
            className={cn(
              'flex items-center justify-center p-2',
              !isCreate && 'cursor-not-allowed opacity-60'
            )}
          >
            {inner()}
          </button>
        );
      })}
    </nav>
  );
}
