import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import ProtectedRoute from '@/routes/ProtectedRoute';
import Layout from '@/components/layout/Layout';
import AdminLayout from '@/components/layout/AdminLayout';
import ConnectionStatus from '@/components/layout/ConnectionStatus';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Booking from '@/pages/Booking';
import Dashboard from '@/pages/admin/Dashboard';
import Reservas from '@/pages/admin/Reservas';
import Historial from '@/pages/admin/Historial';
import Agenda from '@/pages/admin/Agenda';
import Servicios from '@/pages/admin/Servicios';
import Estadisticas from '@/pages/admin/Estadisticas';
import Settings from '@/pages/admin/Settings';
import NotFound from '@/pages/NotFound';

function ThemedShell({ children }: { children: React.ReactNode }) {
  const { loading } = useTheme();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        Cargando tema…
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <ConnectionStatus />
          <ThemedShell>
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/booking" element={<Booking />} />
                </Route>

                <Route element={<ProtectedRoute role="admin" />}>
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<Navigate to="/admin/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="reservas" element={<Reservas />} />
                    <Route path="historial" element={<Historial />} />
                    <Route path="agenda" element={<Agenda />} />
                    <Route path="servicios" element={<Servicios />} />
                    <Route path="estadisticas" element={<Estadisticas />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </ThemedShell>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
