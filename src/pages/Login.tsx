import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FirebaseError } from 'firebase/app';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';

function authErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Correo o contraseña incorrectos.';
      case 'auth/invalid-email':
        return 'Correo inválido.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Inténtalo más tarde.';
      default:
        return 'No se pudo iniciar sesión.';
    }
  }
  return 'Ocurrió un error inesperado.';
}

export default function Login() {
  const { login, clearSessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const expired = Boolean((location.state as { expired?: boolean } | null)?.expired);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (expired) clearSessionExpired();
  }, [expired, clearSessionExpired]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate('/admin/reservas', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <Card>
        <h1 className="text-2xl font-semibold">Acceso administradores</h1>
        <p className="mt-1 text-sm text-muted">Ingresa con tu cuenta de administrador.</p>

        {expired && (
          <p className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Tu sesión ha caducado. Por favor, inicia sesión nuevamente.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <Input
            type="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && (
            <p className="rounded border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-foreground">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="mt-1 w-full">
            {busy ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
