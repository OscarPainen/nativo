import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Tenant } from '@/types';
import { applyTheme } from '@/config/theme';
import { fetchTenant } from '@/services/tenant.service';

/**
 * Sincroniza título y favicon de la pestaña con la marca del tenant.
 * Nota: los navegadores cachean el favicon de forma agresiva; un cambio de
 * logo puede no verse hasta un refresco forzado o reapertura de la pestaña.
 * Es comportamiento estándar del navegador, no un error del sistema.
 */
function applyBranding(tenant: Tenant) {
  document.title = `${tenant.name} — Reservas`;
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = tenant.logoUrl || '/favicon-default.svg';
}

interface ThemeContextValue {
  tenant: Tenant | null;
  loading: boolean;
  /** Aplica un tema en caliente (preview de presets en Settings) sin persistir. */
  previewTheme: (tenant: Tenant) => void;
  reload: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const t = await fetchTenant();
    applyTheme(t.theme);
    applyBranding(t);
    setTenant(t);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function previewTheme(t: Tenant) {
    applyTheme(t.theme);
    setTenant(t);
  }

  return (
    <ThemeContext.Provider value={{ tenant, loading, previewTheme, reload: load }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return ctx;
}
