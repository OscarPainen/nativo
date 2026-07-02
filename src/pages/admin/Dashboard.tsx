import { useEffect, useMemo, useState } from 'react';
import { useAdminBookings } from '@/hooks/useAdminBookings';
import { fetchAllSlots, todayISO } from '@/services/slots.service';
import { periodRange } from '@/services/stats.service';
import { retryCalendarSync } from '@/services/calendar.service';
import type { BookingView } from '@/services/bookings.service';
import type { Slot } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import MetricCard from '@/components/admin/MetricCard';
import BookingsTable from '@/components/admin/BookingsTable';
import Pagination, { PAGE_SIZE } from '@/components/admin/Pagination';
import ComprobanteModal from '@/components/admin/ComprobanteModal';
import RejectModal from '@/components/admin/RejectModal';
import RescheduleModal from '@/components/admin/RescheduleModal';
import ManualBookingModal from '@/components/admin/ManualBookingModal';
import Button from '@/components/ui/Button';
import { formatCLP } from '@/utils/format';
import { writeErrorMessage } from '@/utils/errors';

export default function Dashboard() {
  const { bookings, loading, approve, reject, cancel, remove, reload } = useAdminBookings();
  const { show } = useToast();
  const [slots, setSlots] = useState<Slot[]>([]);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [comprobanteId, setComprobanteId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<BookingView | null>(null);
  const [rescheduling, setRescheduling] = useState<BookingView | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchAllSlots().then(setSlots);
  }, []);

  const today = todayISO();
  const week = periodRange('week');
  const month = periodRange('month');

  const metrics = useMemo(() => {
    const confirmedToday = bookings.filter(
      (v) => v.booking.status === 'confirmed' && v.slot?.date === today,
    ).length;
    const pending = bookings.filter((v) => v.booking.status === 'pending_approval').length;

    const weekSlots = slots.filter((s) => s.date >= week.start && s.date <= week.end);
    const notBlocked = weekSlots.filter((s) => s.status !== 'blocked').length;
    const booked = weekSlots.filter((s) => s.status === 'booked').length;
    const occupancy = notBlocked > 0 ? Math.round((booked / notBlocked) * 100) : 0;

    const income = bookings
      .filter(
        (v) =>
          v.booking.status === 'confirmed' &&
          v.slot &&
          v.slot.date >= month.start &&
          v.slot.date <= month.end,
      )
      .reduce((s, v) => s + (v.service?.price ?? 0), 0);

    return { confirmedToday, pending, occupancy, income };
  }, [bookings, slots, today, week.start, week.end, month.start, month.end]);

  const next7 = useMemo(() => {
    const end = new Date();
    end.setDate(end.getDate() + 7);
    const endIso = end.toISOString().slice(0, 10);
    return bookings
      .filter((v) => v.slot && v.slot.date >= today && v.slot.date <= endIso)
      .sort((a, b) =>
        (a.slot!.date + a.slot!.time).localeCompare(b.slot!.date + b.slot!.time),
      );
  }, [bookings, today]);

  const pageCount = Math.max(1, Math.ceil(next7.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageRows = next7.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  async function onApprove(id: string) {
    setBusyId(id);
    try {
      await approve(id);
      show('Reserva aprobada.');
      fetchAllSlots().then(setSlots);
    } catch (e) {
      show(writeErrorMessage(e), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(reason: string) {
    if (!rejecting) return;
    const id = rejecting.booking.id;
    setBusyId(id);
    try {
      await reject(id, reason);
      show('Reserva rechazada.');
      fetchAllSlots().then(setSlots);
    } catch (e) {
      show(writeErrorMessage(e), 'error');
    } finally {
      setBusyId(null);
      setRejecting(null);
    }
  }

  async function onRemove(v: BookingView) {
    if (!window.confirm('¿Eliminar definitivamente esta reserva? No se podrá recuperar.')) return;
    setBusyId(v.booking.id);
    try {
      await remove(v.booking.id);
      show('Reserva eliminada definitivamente.');
      fetchAllSlots().then(setSlots);
    } catch (e) {
      show(writeErrorMessage(e), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function onRetrySync(v: BookingView) {
    setBusyId(v.booking.id);
    try {
      await retryCalendarSync(v.booking);
      show('Sincronización reintentada.');
    } finally {
      setBusyId(null);
      reload();
    }
  }

  async function onCancel(v: BookingView) {
    if (!window.confirm('Esta acción liberará el horario y notificará la cancelación. ¿Confirmar?'))
      return;
    setBusyId(v.booking.id);
    try {
      await cancel(v.booking.id);
      show('Reserva eliminada.');
      fetchAllSlots().then(setSlots);
    } catch (e) {
      show(writeErrorMessage(e), 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Button onClick={() => setManualOpen(true)}>+ Nueva reserva manual</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Reservas confirmadas hoy" value={String(metrics.confirmedToday)} />
        <MetricCard label="Pendientes de aprobación" value={String(metrics.pending)} />
        <MetricCard label="Ocupación esta semana" value={`${metrics.occupancy}%`} />
        <MetricCard label="Ingresos del mes" value={formatCLP(metrics.income)} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium">Próximos 7 días</h2>
        {loading ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : (
          <div className="flex flex-col gap-3">
            <BookingsTable
              views={pageRows}
              showDate
              busyId={busyId}
              onApprove={onApprove}
              onReject={setRejecting}
              onReschedule={setRescheduling}
              onCancel={onCancel}
              onRemove={onRemove}
              onRetrySync={onRetrySync}
              onViewComprobante={setComprobanteId}
            />
            <Pagination
              page={current}
              pageCount={pageCount}
              total={next7.length}
              onPage={setPage}
              label="reservas"
            />
          </div>
        )}
      </section>

      <ComprobanteModal bookingId={comprobanteId} onClose={() => setComprobanteId(null)} />
      <RejectModal
        view={rejecting}
        busy={!!busyId}
        onConfirm={onReject}
        onClose={() => setRejecting(null)}
      />
      <ManualBookingModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={() => {
          show('Reserva manual creada.');
          reload();
          fetchAllSlots().then(setSlots);
        }}
      />
      <RescheduleModal
        view={rescheduling}
        onClose={() => setRescheduling(null)}
        onDone={() => {
          show('Reserva reprogramada.');
          reload();
          fetchAllSlots().then(setSlots);
        }}
      />
    </div>
  );
}
