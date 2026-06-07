import { Link, useNavigate } from "react-router-dom";
import { usePost } from "@/features/posts/hooks/usePost";
import { getStatus } from "@/lib/apiError";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import Avatar from "@/components/common/Avatar";
import Spinner from "@/components/common/Spinner";
import ErrorState from "@/components/common/ErrorState";
import CommentList from "@/components/comment/CommentList";
import CommentForm, { COMMENT_INPUT_ID } from "@/components/comment/CommentForm";
import PostCarousel from "./PostCarousel";
import PostVideo from "./PostVideo";
import PostActions from "./PostActions";
import PostActionMenu from "./PostActionMenu";

interface PostDetailViewProps {
  postId: string;
}

// Layout-agnostic post detail content, reused by the desktop modal and the
// mobile/standalone page. Responsive: stacked under `md`, two columns (media |
// comments) at `md+` with the comments column scrolling internally.
export default function PostDetailView({ postId }: PostDetailViewProps) {
  const navigate = useNavigate();
  const { data: post, isLoading, isError, error, refetch } = usePost(postId);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !post) {
    const notFound = getStatus(error) === 404;
    return (
      <ErrorState
        title={notFound ? "Post not found" : "Something went wrong"}
        message={
          notFound
            ? "This post may have been removed or is private."
            : "Failed to load this post."
        }
        onRetry={notFound ? undefined : () => refetch()}
        className="min-h-[40vh] justify-center"
      />
    );
  }

  const { author } = post;
  const authorTo = `/users/${author.username}`;
  const hasMedia = post.media.length > 0;
  const focusComment = () => document.getElementById(COMMENT_INPUT_ID)?.focus();

  return (
    <div
      className={cn(
        "md:grid md:max-h-[85vh] md:overflow-hidden",
        hasMedia && "md:grid-cols-[minmax(0,1fr)_360px]",
      )}
    >
      {hasMedia && (
        <div className="flex items-center justify-center bg-black">
          {post.media[0].type === "VIDEO" ? (
            <PostVideo
              media={post.media}
              alt={post.caption ?? `Post by ${author.name}`}
              className="max-h-[85vh]"
            />
          ) : (
            <PostCarousel
              media={post.media}
              alt={post.caption ?? `Post by ${author.name}`}
              className="max-h-[85vh] bg-black"
            />
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-col md:max-h-[85vh]">
        <header className="flex items-center border-b px-4 py-3">
          <Link to={authorTo} className="flex min-w-0 items-center gap-3">
            <Avatar user={author} size="sm" />
            <span className="truncate text-sm font-semibold hover:underline">
              @{author.username}
            </span>
          </Link>
          <div className="ml-auto pl-2 md:mr-8">
            <PostActionMenu post={post} onDeleted={() => navigate(-1)} />
          </div>
        </header>

        {/* Scrollable: caption (as the first entry) + comments */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 md:min-h-0">
          {post.caption && (
            <div className="flex gap-3 text-sm">
              <Link to={authorTo}>
                <Avatar user={author} size="sm" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={authorTo} className="font-semibold hover:underline">
                  @{author.username}
                </Link>{" "}
                <span className="break-words whitespace-pre-line">{post.caption}</span>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {formatRelativeTime(post.createdAt)}
                </div>
              </div>
            </div>
          )}
          <CommentList postId={post.id} />
        </div>

        {/* Footer: actions + like count + composer */}
        <div className="border-t">
          <div className="px-4 pt-3">
            <PostActions
              postId={post.id}
              isLiked={post.isLikedByMe}
              likesCount={post.likesCount}
              commentsCount={post.commentsCount}
              onComment={focusComment}
            />
          </div>
          <div className="px-4 py-2 text-xs tracking-wide text-muted-foreground uppercase">
            {formatRelativeTime(post.createdAt)}
          </div>
          <div className="border-t px-4 py-2">
            <CommentForm postId={post.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
