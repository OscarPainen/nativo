import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAvailableSlots, groupByDate } from '@/services/slots.service';
import type { Slot } from '@/types';

/** Slots libres agrupados por fecha, con recarga manual tras reservar. */
export function useSlots() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    return fetchAvailableSlots()
      .then(setSlots)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byDate = useMemo(() => groupByDate(slots), [slots]);
  const dates = useMemo(() => Object.keys(byDate).sort(), [byDate]);

  return { slots, byDate, dates, loading, error, reload: load };
}
