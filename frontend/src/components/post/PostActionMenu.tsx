import { useState } from 'react';
import { DropdownMenu } from 'radix-ui';
import { Check, Globe, Lock, MoreHorizontal, Trash2, Users } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUpdatePost } from '@/features/posts/hooks/useUpdatePost';
import type { Post, PostVisibility } from '@/types/api';
import DeleteConfirmDialog from './DeleteConfirmDialog';

interface PostActionMenuProps {
  post: Post;
  onDeleted?: () => void;
}

const VISIBILITY_OPTIONS: {
  value: PostVisibility;
  label: string;
  icon: typeof Globe;
}[] = [
  { value: 'PUBLIC', label: 'Public', icon: Globe },
  { value: 'FOLLOWERS', label: 'Followers only', icon: Users },
  { value: 'PRIVATE', label: 'Only me', icon: Lock },
];

// Owner-only "⋯" menu on a post (rendered in the detail view, IG-style — not on
// feed cards). Change visibility (radio group) + Delete. Returns null for
// non-owners so the trigger never shows.
export default function PostActionMenu({ post, onDeleted }: PostActionMenuProps) {
  const me = useAuthStore((s) => s.user);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { update, isPending } = useUpdatePost();

  if (!me || me.id !== post.authorId) return null;

  const handleVisibilityChange = (value: string) => {
    if (value === post.visibility) return;
    update({ postId: post.id, input: { visibility: value as PostVisibility } });
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Post options"
            className="grid size-8 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none aria-expanded:bg-muted"
          >
            <MoreHorizontal className="size-5" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={8}
            collisionPadding={12}
            className="z-50 min-w-52 overflow-hidden rounded-xl bg-card p-1 shadow-lg ring-1 ring-foreground/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <DropdownMenu.Label className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
              Who can see this
            </DropdownMenu.Label>

            <DropdownMenu.RadioGroup
              value={post.visibility}
              onValueChange={handleVisibilityChange}
            >
              {VISIBILITY_OPTIONS.map(({ value, label, icon: Icon }) => (
                <DropdownMenu.RadioItem
                  key={value}
                  value={value}
                  disabled={isPending}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span>{label}</span>
                  <DropdownMenu.ItemIndicator className="ml-auto">
                    <Check className="size-4 text-primary" />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>

            <DropdownMenu.Separator className="my-1 h-px bg-border" />

            <DropdownMenu.Item
              onSelect={() => setConfirmOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-destructive outline-none data-[highlighted]:bg-destructive/10"
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <DeleteConfirmDialog
        postId={post.id}
        authorUsername={post.author.username}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDeleted={onDeleted}
      />
    </>
  );
}
