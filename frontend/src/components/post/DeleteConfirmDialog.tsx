import { Loader2 } from 'lucide-react';
import { useDeletePost } from '@/features/posts/hooks/useDeletePost';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DeleteConfirmDialogProps {
  postId: string;
  authorUsername: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

// Confirmation before a (permanent) post delete. Owns the delete mutation: the
// dialog stays open + disabled while pending, closes and calls onDeleted on
// success, and shows an inline error on failure (the optimistic removal is rolled
// back by the hook).
export default function DeleteConfirmDialog({
  postId,
  authorUsername,
  open,
  onOpenChange,
  onDeleted,
}: DeleteConfirmDialogProps) {
  const { remove, isPending, error, reset } = useDeletePost();

  const handleOpenChange = (next: boolean) => {
    if (isPending) return; // don't allow dismiss mid-delete
    if (!next) reset();
    onOpenChange(next);
  };

  const handleDelete = () => {
    remove(
      { postId, authorUsername },
      {
        onSuccess: () => {
          onOpenChange(false);
          onDeleted?.();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showClose={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete post?</DialogTitle>
          <DialogDescription>
            This will permanently delete the post and all its media. This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive">
            Couldn't delete the post. Please try again.
          </p>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
