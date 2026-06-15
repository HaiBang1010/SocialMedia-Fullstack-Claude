import { useNavigate } from 'react-router-dom';
import Avatar from '@/components/common/Avatar';
import type { SharedPostPreview } from '@/types/api';

interface SharedPostCardProps {
  sharedPost: SharedPostPreview | null;
}

// Phase 5.4c — the preview card rendered inside a POST_SHARE message bubble. Click → open the full
// post (which re-checks visibility, so a recipient who can't view it lands on a 404). null when the
// post was deleted (FK SetNull) → "Post unavailable".
export default function SharedPostCard({ sharedPost }: SharedPostCardProps) {
  const navigate = useNavigate();

  if (!sharedPost) {
    return (
      <div className="w-60 rounded-xl border bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
        Post unavailable
      </div>
    );
  }

  const { author, caption, firstMedia } = sharedPost;

  return (
    <button
      type="button"
      onClick={() => navigate(`/posts/${sharedPost.id}`)}
      className="block w-60 overflow-hidden rounded-xl border bg-card text-left transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Avatar user={author} size="xs" />
        <span className="truncate text-xs font-semibold">@{author.username}</span>
      </div>
      {firstMedia && (
        <img
          src={firstMedia.thumbnailUrl ?? firstMedia.url}
          alt=""
          className="aspect-square w-full object-cover"
        />
      )}
      {caption && (
        <p className="line-clamp-2 px-3 py-2 text-xs text-foreground/90">{caption}</p>
      )}
    </button>
  );
}
