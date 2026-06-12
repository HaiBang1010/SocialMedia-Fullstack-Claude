import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useComposerStore } from '@/stores/composerStore';
import { useStoryViewerStore } from '@/stores/storyViewerStore';
import { useUserProfile } from '@/features/users/hooks/useUserProfile';
import { useStartDirectConversation } from '@/features/messaging/hooks/useStartDirectConversation';
import { queryKeys } from '@/lib/queryKeys';
import { formatNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/common/EmptyState';
import PostsGrid from '@/components/post/PostsGrid';
import FollowButton from '@/components/profile/FollowButton';
import { ProfileEditForm } from '@/components/profile/ProfileEditForm';

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// Public profile for any user. `/users/:username` resolves here; `/profile`
// redirects to the current user's own URL. One component handles both cases —
// self gets "Edit profile", everyone else gets a Follow button.
export default function UserProfilePage() {
  const { username = '' } = useParams();
  const me = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const queryClient = useQueryClient();
  const openComposer = useComposerStore((s) => s.open);
  const openViewer = useStoryViewerStore((s) => s.open);
  const navigate = useNavigate();
  const startConversation = useStartDirectConversation();
  const [editing, setEditing] = useState(false);

  const isSelf = me?.username === username;

  const { data: user, isLoading, isError } = useUserProfile(username);

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  if (isError || !user) {
    return <div className="p-8 text-destructive">User not found.</div>;
  }

  if (editing && isSelf) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Edit profile</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileEditForm
              initialName={user.name}
              initialBio={user.bio ?? ''}
              initialIsPrivate={user.isPrivate}
              onCancel={() => setEditing(false)}
              onSaved={(updated) => {
                updateUser(updated);
                // Refetch the profile so the header reflects the new name/bio.
                queryClient.invalidateQueries({
                  queryKey: queryKeys.user(username),
                });
                setEditing(false);
              }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = [
    { label: 'posts', value: formatNumber(user.postsCount) },
    { label: 'followers', value: formatNumber(user.followersCount) },
    { label: 'following', value: formatNumber(user.followingCount) },
  ];

  const avatarImg = (
    <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-medium text-muted-foreground sm:size-28">
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt={user.name} className="size-full object-cover" />
      ) : (
        initials(user.name)
      )}
    </span>
  );

  // Story ring (Phase 4.4): wrap the avatar in a coral gradient + make it a viewer
  // entry point when the user has active stories. Opens in single-user mode (a profile
  // tap shows just this user's stories — no cross-user advance).
  const avatarNode = user.hasActiveStory ? (
    <button
      type="button"
      aria-label={`View @${user.username}'s story`}
      onClick={() => openViewer({ mode: 'single-user', startUsername: user.username })}
      className="shrink-0 rounded-full bg-gradient-to-tr from-primary to-[oklch(0.7_0.17_80)] p-[3px] transition-transform hover:scale-[1.02]"
    >
      <span className="block rounded-full bg-background p-[3px]">{avatarImg}</span>
    </button>
  ) : (
    avatarImg
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <header className="flex items-center gap-6 sm:gap-10">
        {avatarNode}

        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-lg">@{user.username}</span>
            {isSelf ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Edit profile
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/me/stories/archive')}
                >
                  Archive
                </Button>
              </>
            ) : (
              <>
                {user.isFollowing !== null && (
                  <FollowButton
                    username={user.username}
                    isFollowing={user.isFollowing}
                  />
                )}
                {/* Open chat — no follow required (Phase 5.1). Disabled while the
                    create request is in flight (the directKey upsert also dedupes). */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startConversation.mutate({ targetUserId: user.id })}
                  disabled={startConversation.isPending}
                >
                  Message
                </Button>
              </>
            )}
          </div>

          <div className="flex gap-6 text-sm">
            {stats.map((s) => (
              <span key={s.label}>
                <span className="font-semibold tabular-nums">{s.value}</span>{' '}
                <span className="text-muted-foreground">{s.label}</span>
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* Name + bio */}
      <div className="mt-6">
        <div className="font-semibold">{user.name}</div>
        {user.bio ? (
          <p className="mt-1 whitespace-pre-line text-sm">{user.bio}</p>
        ) : (
          <p className="mt-1 text-sm italic text-muted-foreground">No bio yet.</p>
        )}
      </div>

      {/* Posts grid */}
      <div className="mt-8 border-t pt-8">
        <PostsGrid
          username={user.username}
          emptyState={
            <EmptyState
              icon={ImagePlus}
              title="No posts yet"
              description={
                isSelf
                  ? 'Share your first photo to get started.'
                  : `@${user.username} hasn't posted anything yet.`
              }
              action={
                isSelf ? (
                  <Button onClick={openComposer}>Create your first post</Button>
                ) : undefined
              }
            />
          }
        />
      </div>
    </div>
  );
}
