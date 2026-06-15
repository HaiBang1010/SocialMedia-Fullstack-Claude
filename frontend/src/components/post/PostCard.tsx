import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Post } from '@/types/api';
import { formatRelativeTime } from '@/lib/format';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import Avatar from '@/components/common/Avatar';
import PostCarousel from './PostCarousel';
import PostVideo from './PostVideo';
import PostActions from './PostActions';
import SharePostModal from './SharePostModal';

interface PostCardProps {
  post: Post;
}

// Feed card. Tapping the image / "view comments" / the comment icon opens the
// post detail — as an overlay modal on desktop (background-location) or a full
// page on mobile.
export default function PostCard({ post }: PostCardProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [showShare, setShowShare] = useState(false);

  const { author } = post;
  const authorTo = `/users/${author.username}`;
  const detailTo = `/posts/${post.id}`;
  const detailState = isDesktop ? { background: location } : undefined;
  const openDetail = () => navigate(detailTo, { state: detailState });

  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <header className="flex items-center px-4 py-3">
        <Link to={authorTo} className="flex min-w-0 items-center gap-3">
          <Avatar user={author} size="sm" />
          <span className="truncate text-sm font-semibold hover:underline">
            @{author.username}
          </span>
        </Link>
      </header>

      {post.media.length > 0 &&
        // A video toggles mute on tap, and a carousel takes swipe/arrow gestures
        // — neither is wrapped in a Link (it would swallow the gesture); open
        // detail via the comment icon instead. A single image stays tap-to-open.
        (post.media[0].type === 'VIDEO' ? (
          <PostVideo
            media={post.media}
            alt={post.caption ?? `Post by ${author.name}`}
          />
        ) : post.media.length === 1 ? (
          <Link
            to={detailTo}
            state={detailState}
            className="block"
            aria-label="Open post"
          >
            <PostCarousel
              media={post.media}
              alt={post.caption ?? `Post by ${author.name}`}
            />
          </Link>
        ) : (
          <PostCarousel
            media={post.media}
            alt={post.caption ?? `Post by ${author.name}`}
          />
        ))}

      <div className="px-4 py-3">
        <PostActions
          postId={post.id}
          isLiked={post.isLikedByMe}
          likesCount={post.likesCount}
          commentsCount={post.commentsCount}
          onComment={openDetail}
          onShare={() => setShowShare(true)}
        />
      </div>

      <div className="space-y-1 px-4 pb-4 text-sm">
        {post.caption && (
          <div>
            <Link to={authorTo} className="font-semibold hover:underline">
              @{author.username}
            </Link>{' '}
            <span className="whitespace-pre-line">{post.caption}</span>
          </div>
        )}

        <div className="text-xs tracking-wide text-muted-foreground uppercase">
          {formatRelativeTime(post.createdAt)}
        </div>
      </div>

      <SharePostModal post={post} open={showShare} onClose={() => setShowShare(false)} />
    </article>
  );
}
