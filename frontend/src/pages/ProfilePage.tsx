import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2 } from 'lucide-react';
import { authApi } from '@/api/auth';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/stores/authStore';
import { applyFieldErrors } from '@/lib/apiError';
import { profileSchema, type ProfileValues } from '@/lib/validations/profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// Placeholder counts — real stats arrive with the posts/follows features (Phase 2+).
const STATS = [
  { label: 'posts', value: 0 },
  { label: 'followers', value: 0 },
  { label: 'following', value: 0 },
];

export default function ProfilePage() {
  const [editing, setEditing] = useState(false);
  const updateUser = useAuthStore((s) => s.updateUser);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
  });

  const user = data?.user;

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  if (isError || !user) {
    return <div className="p-8 text-destructive">Failed to load profile.</div>;
  }

  if (editing) {
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
              onCancel={() => setEditing(false)}
              onSaved={(updated) => {
                updateUser(updated);
                queryClient.invalidateQueries({ queryKey: ['me'] });
                setEditing(false);
              }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <header className="flex items-center gap-6 sm:gap-10">
        <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-medium text-muted-foreground sm:size-28">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="size-full object-cover"
            />
          ) : (
            initials(user.name)
          )}
        </span>

        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-lg">@{user.username}</span>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          </div>

          <div className="flex gap-6 text-sm">
            {STATS.map((s) => (
              <span key={s.label}>
                <span className="font-semibold">{s.value}</span>{' '}
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
          <p className="mt-1 text-sm italic text-muted-foreground">
            No bio yet.
          </p>
        )}
      </div>

      {/* Posts grid placeholder */}
      <div className="mt-8 border-t pt-8">
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Camera className="size-10" strokeWidth={1.5} />
          <p className="text-sm">No posts yet.</p>
        </div>
      </div>
    </div>
  );
}

interface ProfileEditFormProps {
  initialName: string;
  initialBio: string;
  onCancel: () => void;
  onSaved: (user: import('@/types/api').User) => void;
}

function ProfileEditForm({
  initialName,
  initialBio,
  onCancel,
  onSaved,
}: ProfileEditFormProps) {
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: initialName, bio: initialBio },
  });

  const mutation = useMutation({
    mutationFn: (values: ProfileValues) => usersApi.updateMe(values),
    onSuccess: (res) => onSaved(res.user),
    onError: (err) => {
      if (applyFieldErrors(err, form.setError)) return;
      form.setError('root', {
        message: 'Something went wrong. Please try again.',
      });
    },
  });

  const onSubmit = (values: ProfileValues) => {
    form.clearErrors('root');
    mutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Input placeholder="Tell us about yourself" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.formState.errors.root && (
          <p className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}
        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
