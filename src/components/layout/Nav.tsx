import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/ui/Button';

export default function Nav() {
  const { tenant } = useTheme();
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'admin';

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <nav className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt="" className="h-7 w-7 rounded object-cover" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-sm font-bold text-surface">
              {tenant?.name?.charAt(0) ?? 'B'}
            </span>
          )}
          <span>{tenant?.name ?? 'Barbería'}</span>
        </Link>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <>
              <Link to="/admin">
                <Button variant="ghost">Reservas</Button>
              </Link>
              <Link to="/admin/settings">
                <Button variant="ghost">Config</Button>
              </Link>
              <Button variant="secondary" onClick={handleLogout}>
                Salir
              </Button>
            </>
          ) : (
            <Link to="/booking">
              <Button>Reservar</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
