import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function NotFound() {
  const { profile } = useAuth();
  const { tenant } = useTheme();
  const isAdmin = profile?.role === 'admin';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <Card className="w-full">
        <p className="text-sm font-medium text-muted">{tenant?.name ?? 'Barbería'}</p>
        <h1 className="mt-2 text-2xl font-semibold">Página no encontrada</h1>
        <p className="mt-2 text-muted">Esta página no existe o el enlace está roto.</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link to="/">
            <Button className="w-full">Volver al inicio</Button>
          </Link>
          {isAdmin && (
            <Link to="/admin/reservas">
              <Button variant="ghost" className="w-full">
                Ir al panel de administración
              </Button>
            </Link>
          )}
        </div>
      </Card>
    </main>
  );
}
