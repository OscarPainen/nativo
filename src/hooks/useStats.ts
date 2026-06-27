import { useEffect, useState } from 'react';
import { fetchAdminBookings } from '@/services/bookings.service';
import { fetchAllSlots } from '@/services/slots.service';
import {
  computeStats,
  periodRange,
  type Period,
  type StatsResult,
} from '@/services/stats.service';

export function useStats(period: Period) {
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchAdminBookings(), fetchAllSlots()])
      .then(([views, slots]) => {
        if (alive) setStats(computeStats(views, slots, periodRange(period)));
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [period]);

  return { stats, loading, error };
}
