import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { Role } from '@/types';

interface ProtectedRouteProps {
  /** Si se indica, exige este rol; si no, basta con estar autenticado. */
  role?: Role;
  redirectTo?: string;
}

export default function ProtectedRoute({
  role,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { firebaseUser, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        Cargando…
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  if (role && profile?.role !== role) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
