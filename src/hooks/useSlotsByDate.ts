import { useCallback, useEffect, useState } from 'react';
import { fetchSlotsByDate } from '@/services/slots.service';
import type { Slot } from '@/types';

export function useSlotsByDate(date: string | null) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!date) {
      setSlots([]);
      return Promise.resolve();
    }
    setLoading(true);
    return fetchSlotsByDate(date)
      .then(setSlots)
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  return { slots, loading, reload: load };
}
