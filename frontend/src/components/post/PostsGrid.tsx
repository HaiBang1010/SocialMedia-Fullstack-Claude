import { useRef, type ReactNode } from 'react';
import { Link, useLocation, type Location } from 'react-router-dom';
import { Heart, MessageCircle, Copy } from 'lucide-react';
import { useUserPosts } from '@/features/posts/hooks/useUserPosts';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { formatNumber } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import Spinner from '@/components/common/Spinner';
import ErrorState from '@/components/common/ErrorState';
import type { Post } from '@/types/api';

interface PostsGridProps {
  username: string;
  // Rendered when the user has no posts (e.g. a "Create your first post" CTA).
  emptyState?: ReactNode;
}

// 3-column post thumbnails for a profile. Tapping a cell opens the post detail —
// overlay modal on desktop (background-location, same as PostCard) or a full
// page on mobile. Cursor-paginated via useUserPosts + an intersection sentinel.
export default function PostsGrid({ username, emptyState }: PostsGridProps) {
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useUserPosts(username);

  useInfiniteScroll(sentinelRef, {
    onIntersect: fetchNextPage,
    enabled: Boolean(hasNextPage) && !isFetchingNextPage,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-none" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Couldn't load posts." onRetry={() => refetch()} />;
  }

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];
  if (posts.length === 0) {
    return <>{emptyState}</>;
  }

  const background = isDesktop ? location : undefined;

  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {posts.map((post) => (
          <GridItem key={post.id} post={post} background={background} />
        ))}
      </div>
      <div ref={sentinelRef} aria-hidden className="h-px" />
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      )}
    </>
  );
}

function GridItem({
  post,
  background,
}: {
  post: Post;
  background: Location | undefined;
}) {
  const cover = post.media[0];
  return (
    <Link
      to={`/posts/${post.id}`}
      state={background ? { background } : undefined}
      aria-label="Open post"
      className="group relative block aspect-square overflow-hidden bg-muted"
    >
      {cover ? (
        <img
          src={cover.thumbnailUrl ?? cover.url}
          alt={post.caption ?? ''}
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center p-3 text-center text-xs text-muted-foreground">
          <span className="line-clamp-4 whitespace-pre-line">{post.caption}</span>
        </div>
      )}

      {/* Multi-image badge */}
      {post.media.length > 1 && (
        <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-black/55 text-white drop-shadow">
          <Copy className="size-3.5" />
        </span>
      )}

      {/* Hover overlay (desktop only) */}
      <div className="absolute inset-0 hidden items-center justify-center gap-5 bg-black/45 text-sm font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 md:flex">
        <span className="flex items-center gap-1.5">
          <Heart className="size-4 fill-white" />
          <span className="tabular-nums">{formatNumber(post.likesCount)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="size-4 fill-white" />
          <span className="tabular-nums">{formatNumber(post.commentsCount)}</span>
        </span>
      </div>
    </Link>
  );
}
