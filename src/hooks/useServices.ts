import { useCallback, useEffect, useState } from 'react';
import { fetchAllServices } from '@/services/services.service';
import type { Service } from '@/types';

/** Servicios del tenant. activeOnly=true (cliente) filtra inactivos. */
export function useServices(activeOnly = true) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    return fetchAllServices()
      .then((all) => setServices(activeOnly ? all.filter((s) => s.active !== false) : all))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  return { services, loading, error, reload: load };
}
