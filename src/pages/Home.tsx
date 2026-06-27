import { Link } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function Home() {
  const { tenant } = useTheme();

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center gap-8 px-6 py-16">
      <header className="flex flex-col items-center gap-3 text-center">
        {tenant?.logoUrl ? (
          <img src={tenant.logoUrl} alt={tenant.name} className="h-16 w-16 rounded object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded bg-primary text-2xl font-bold text-surface">
            {tenant?.name?.charAt(0) ?? 'B'}
          </div>
        )}
        <h1 className="text-3xl font-semibold tracking-tight">
          {tenant?.name ?? 'Barbería'}
        </h1>
        <p className="max-w-md text-muted">
          Reserva tu hora en segundos. Elige servicio, día y horario disponible.
        </p>
      </header>

      <Card className="w-full max-w-md">
        <div className="flex flex-col gap-3">
          <Link to="/booking">
            <Button className="w-full">Reservar hora</Button>
          </Link>
          <Link to="/login" className="text-center text-sm text-muted underline-offset-4 hover:underline">
            Acceso administradores
          </Link>
        </div>
      </Card>
    </main>
  );
}
