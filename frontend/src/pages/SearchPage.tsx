import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { useSearch } from '@/features/search/hooks/useSearch';
import Avatar from '@/components/common/Avatar';
import EmptyState from '@/components/common/EmptyState';
import type { Post, PublicUser } from '@/types/api';

// Full-page search (route /search). Debounced (300ms, mirrors GroupCreateModal) full-text query
// over users + posts. Sections render only when they have results.
export default function SearchPage() {
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const { data, isLoading, isFetching } = useSearch(debounced, 'all');
  const users = data?.users ?? [];
  const posts = data?.posts ?? [];
  const hasResults = users.length > 0 || posts.length > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <header className="sticky top-0 z-10 border-b bg-background/80 px-4 py-4 backdrop-blur">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search people and posts"
            className="w-full rounded-full border bg-muted/40 py-2 pl-9 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
      </header>

      {debounced.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title="Search Beng"
          description="Find people by name or username, and posts by caption."
        />
      ) : isLoading || (isFetching && !data) ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : !hasResults ? (
        <EmptyState icon={SearchIcon} title="No results" description={`Nothing matched "${debounced}".`} />
      ) : (
        <div className="space-y-6 py-4">
          {users.length > 0 && (
            <section>
              <h2 className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                People
              </h2>
              <ul>
                {users.map((u) => (
                  <li key={u.id}>
                    <UserResultRow user={u} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {posts.length > 0 && (
            <section>
              <h2 className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Posts
              </h2>
              <div className="grid grid-cols-3 gap-1 px-1">
                {posts.map((p) => (
                  <PostThumb key={p.id} post={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function UserResultRow({ user }: { user: PublicUser }) {
  return (
    <Link to={`/users/${user.username}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted">
      <Avatar user={user} size="md" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{user.username}</p>
        <p className="truncate text-sm text-muted-foreground">{user.name}</p>
      </div>
    </Link>
  );
}

function PostThumb({ post }: { post: Post }) {
  const first = post.media[0];
  const src = first?.thumbnailUrl ?? first?.url ?? null;
  return (
    <Link to={`/posts/${post.id}`} className="relative aspect-square overflow-hidden bg-muted">
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
          {post.caption ?? 'Post'}
        </span>
      )}
    </Link>
  );
}
