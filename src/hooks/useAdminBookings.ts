import { useCallback, useEffect, useState } from 'react';
import {
  approveBooking,
  cancelBooking,
  fetchAdminBookings,
  rejectBooking,
  type BookingView,
} from '@/services/bookings.service';

/** Reservas para el panel admin, con aprobar/rechazar y recarga. */
export function useAdminBookings() {
  const [bookings, setBookings] = useState<BookingView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchAdminBookings()
      .then(setBookings)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = useCallback(
    async (id: string) => {
      await approveBooking(id);
      await load();
    },
    [load],
  );

  const reject = useCallback(
    async (id: string, reason: string) => {
      await rejectBooking(id, reason);
      await load();
    },
    [load],
  );

  const cancel = useCallback(
    async (id: string) => {
      await cancelBooking(id);
      await load();
    },
    [load],
  );

  return { bookings, loading, error, reload: load, approve, reject, cancel };
}
