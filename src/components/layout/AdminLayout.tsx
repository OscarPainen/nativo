import { useState, type ComponentType, type SVGProps } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  IconAgenda,
  IconBookings,
  IconChart,
  IconChevronLeft,
  IconChevronRight,
  IconDashboard,
  IconHistory,
  IconLogout,
  IconMenu,
  IconScissors,
  IconSettings,
  IconX,
} from '@/components/ui/icons';

type IconC = ComponentType<SVGProps<SVGSVGElement>>;
const NAV: { to: string; label: string; Icon: IconC }[] = [
  { to: '/admin/dashboard', label: 'Dashboard', Icon: IconDashboard },
  { to: '/admin/reservas', label: 'Reservas', Icon: IconBookings },
  { to: '/admin/historial', label: 'Historial', Icon: IconHistory },
  { to: '/admin/agenda', label: 'Agenda', Icon: IconAgenda },
  { to: '/admin/servicios', label: 'Servicios', Icon: IconScissors },
  { to: '/admin/estadisticas', label: 'Estadísticas', Icon: IconChart },
  { to: '/admin/settings', label: 'Configuración', Icon: IconSettings },
];

function NavList({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 p-2">
      {NAV.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          title={label}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
              isActive ? 'bg-primary text-surface' : 'text-foreground hover:bg-border/40'
            } ${collapsed ? 'justify-center' : ''}`
          }
        >
          <Icon />
          {!collapsed && <span>{label}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AdminLayout() {
  const { tenant } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  const today = new Date().toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="flex min-h-full">
      {/* Sidebar escritorio */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-border bg-surface transition-all md:flex ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-3">
          {!collapsed && (
            <span className="truncate font-semibold">{tenant?.name ?? 'Admin'}</span>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded p-1 text-muted hover:bg-border/40"
            aria-label="Colapsar menú"
          >
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>
        <NavList collapsed={collapsed} />
      </aside>

      {/* Sidebar móvil (off-canvas) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute left-0 top-0 flex h-full w-64 flex-col bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="font-semibold">{tenant?.name ?? 'Admin'}</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" className="text-muted">
                <IconX />
              </button>
            </div>
            <NavList onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-2 border-b border-border bg-surface px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded p-1 text-foreground hover:bg-border/40 md:hidden"
            aria-label="Abrir menú"
          >
            <IconMenu />
          </button>
          <span className="hidden truncate text-sm capitalize text-muted sm:block">{today}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="ml-auto flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm text-surface hover:opacity-90"
          >
            <IconLogout size={16} />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </header>
        <main className="flex-1 overflow-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
