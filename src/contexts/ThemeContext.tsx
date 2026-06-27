import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Tenant } from '@/types';
import { applyTheme } from '@/config/theme';
import { fetchTenant } from '@/services/tenant.service';

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
