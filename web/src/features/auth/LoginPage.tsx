import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, Navigate } from 'react-router';
import { useAuth } from './auth-context';
import { loginSchema, type LoginValues } from './validation';

export function LoginPage() {
  const { status, signIn } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  if (status === 'signed-in') {
    return <Navigate to="/tickets" replace />;
  }

  // The API's message is the one worth showing: it already says "wrong username
  // or password" without revealing which of the two was wrong.
  const onSubmit = handleSubmit(async ({ username, password }) => {
    try {
      await signIn(username, password);
    } catch (error) {
      setError('root.server', {
        message:
          error instanceof ApiError
            ? error.message
            : 'Algo salió mal. Intentá de nuevo.',
      });
    }
  });

  return (
    <main className="grid min-h-dvh place-items-center bg-ground px-6">
      <div className="w-full max-w-sm rounded-panel bg-surface p-8">
        <Link
          to="/"
          className="text-xs tracking-widest text-ink-dim uppercase hover:text-ink-muted"
        >
          Ticket App
        </Link>
        <h1 className="mt-3 text-2xl font-medium tracking-tight">Ingresar</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Usá uno de los usuarios de demo del README.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="username">Usuario</Label>
            <Input
              id="username"
              autoComplete="username"
              autoFocus
              aria-invalid={Boolean(errors.username)}
              {...register('username')}
            />
            {errors.username && (
              <p className="text-sm text-destructive">
                {errors.username.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {errors.root?.server && (
            <p
              role="alert"
              className="rounded-tile bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errors.root.server.message}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>
      </div>
    </main>
  );
}
