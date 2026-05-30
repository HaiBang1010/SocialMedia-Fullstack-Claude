import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';
import { applyFieldErrors, getApiError, getStatus } from '@/lib/apiError';
import { registerSchema, type RegisterValues } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

export default function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', username: '', email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (res) => {
      login(res.user, {
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
      navigate('/', { replace: true });
    },
    onError: (err) => {
      // 400 Zod validation → map each field error from details.
      if (applyFieldErrors(err, form.setError)) return;

      // 409 Conflict → backend message is `<field(s)> already exists`.
      if (getStatus(err) === 409) {
        const message = getApiError(err)?.message ?? 'Already exists';
        const lower = message.toLowerCase();
        if (lower.includes('email')) {
          form.setError('email', { message: 'Email already exists' });
        } else if (lower.includes('username')) {
          form.setError('username', { message: 'Username already exists' });
        } else {
          form.setError('root', { message });
        }
        return;
      }

      form.setError('root', {
        message: 'Something went wrong. Please try again.',
      });
    },
  });

  const onSubmit = (values: RegisterValues) => {
    form.clearErrors('root');
    mutation.mutate(values);
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
          <CardTitle className="text-xl">Create account</CardTitle>
          <CardDescription>Join to get started.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="grid gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input autoComplete="username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
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
            </CardContent>
            <CardFooter className="mt-4 flex-col items-stretch gap-3">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="animate-spin" />}
                Create account
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Form>
    </Card>
  );
}
