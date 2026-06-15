import { AlertCircle, Loader2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/audio';
import type { MessageMedia } from '@/types/api';

interface MediaCellProps {
  media: MessageMedia;
  onOpen: () => void;
  className?: string;
}

// One tile in a message's media grid (Phase 5.4a). Shows the thumbnail (image thumb / video
// poster / local preview while uploading), a play badge + duration for videos, and an upload
// progress / failed overlay for optimistic items. Only persisted media opens the lightbox.
export default function MediaCell({ media, onOpen, className }: MediaCellProps) {
  const src = media.localUrl ?? media.thumbnailUrl ?? media.url;
  const isVideo = media.type === 'VIDEO';
  const uploading = media.uploadStatus === 'uploading';
  const failed = media.uploadStatus === 'failed';
  // Optimistic items (any uploadStatus) carry only local/preview URLs — don't open the lightbox
  // until the message is the server's real one (uploadStatus cleared on swap).
  const canOpen = !media.uploadStatus;

  return (
    <button
      type="button"
      onClick={canOpen ? onOpen : undefined}
      aria-label={isVideo ? 'Play video' : 'View image'}
      className={cn(
        'group/cell relative block size-full overflow-hidden bg-muted',
        canOpen ? 'cursor-pointer' : 'cursor-default',
        className,
      )}
    >
      {src && (
        <img
          src={src}
          alt=""
          draggable={false}
          className={cn('size-full object-cover', uploading && 'opacity-70')}
        />
      )}

      {isVideo && !uploading && !failed && (
        <>
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-black/55 text-white">
              <Play className="size-5 translate-x-px fill-current" />
            </span>
          </span>
          {media.duration != null && (
            <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[0.65rem] font-medium text-white">
              {formatDuration(media.duration)}
            </span>
          )}
        </>
      )}

      {uploading && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 text-white">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-xs font-medium">{media.uploadProgress ?? 0}%</span>
        </span>
      )}

      {failed && (
        <span className="absolute inset-0 flex items-center justify-center bg-destructive/55 text-white">
          <AlertCircle className="size-6" />
        </span>
      )}
    </button>
  );
}
