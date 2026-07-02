import { useMemo, useState } from 'react';
import { useAdminBookings } from '@/hooks/useAdminBookings';
import { exportBookingsCSV, type BookingView } from '@/services/bookings.service';
import { periodRange } from '@/services/stats.service';
import { todayISO } from '@/services/slots.service';
import { retryCalendarSync } from '@/services/calendar.service';
import { writeErrorMessage } from '@/utils/errors';
import type { BookingStatus } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import BookingsTable from '@/components/admin/BookingsTable';
import ScheduleCalendar from '@/components/admin/ScheduleCalendar';
import ComprobanteModal from '@/components/admin/ComprobanteModal';
import RejectModal from '@/components/admin/RejectModal';
import BookingDetailModal from '@/components/admin/BookingDetailModal';
import RescheduleModal from '@/components/admin/RescheduleModal';
import ManualBookingModal from '@/components/admin/ManualBookingModal';
import Button from '@/components/ui/Button';

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'range';
const PAGE_SIZE = 20;
const field = 'rounded border border-border bg-surface px-2 py-1.5 text-sm';

export default function Reservas() {
  const { bookings, loading, approve, reject, cancel, remove, reload } = useAdminBookings();
  const { show } = useToast();
  const [manualOpen, setManualOpen] = useState(false);

  const [status, setStatus] = useState<'all' | BookingStatus>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [serviceName, setServiceName] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [comprobanteId, setComprobanteId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<BookingView | null>(null);
  const [rescheduling, setRescheduling] = useState<BookingView | null>(null);
  const [detail, setDetail] = useState<BookingView | null>(null);

  const serviceNames = useMemo(
    () => [...new Set(bookings.map((b) => b.service?.name).filter(Boolean) as string[])],
    [bookings],
  );

  const filtered = useMemo(() => {
    const today = todayISO();
    const week = periodRange('week');
    const month = periodRange('month');
    const term = search.trim().toLowerCase();

    return bookings
      .filter((v) => {
        const d = v.slot?.date ?? '';
        // Gestión = solo presente y futuro; el pasado vive en /admin/historial.
        if (d < today) return false;
        if (status !== 'all' && v.booking.status !== status) return false;
        if (serviceName !== 'all' && v.service?.name !== serviceName) return false;
        if (dateFilter === 'today' && d !== today) return false;
        if (dateFilter === 'week' && !(d >= week.start && d <= week.end)) return false;
        if (dateFilter === 'month' && !(d >= month.start && d <= month.end)) return false;
        if (dateFilter === 'range') {
          if (from && d < from) return false;
          if (to && d > to) return false;
        }
        if (term) {
          const hay = `${v.booking.clientName} ${v.booking.clientPhone}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) =>
        (a.slot?.date ?? '').concat(a.slot?.time ?? '').localeCompare(
          (b.slot?.date ?? '').concat(b.slot?.time ?? ''),
        ),
      );
  }, [bookings, status, serviceName, dateFilter, from, to, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  async function act(fn: () => Promise<void>, ok: string) {
    try {
      await fn();
      show(ok);
    } catch (e) {
      show(writeErrorMessage(e), 'error');
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reservas</h1>
        <div className="flex gap-2">
          <Button onClick={() => setManualOpen(true)}>+ Reserva manual</Button>
          <Button
            variant="secondary"
            onClick={() => exportBookingsCSV(filtered, 'reservas.csv')}
          >
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className={field} value={status} onChange={(e) => { setStatus(e.target.value as 'all' | BookingStatus); setPage(0); }}>
          <option value="all">Todas</option>
          <option value="pending_approval">Pendientes</option>
          <option value="confirmed">Confirmadas</option>
          <option value="rejected">Rechazadas</option>
          <option value="cancelled">Canceladas</option>
        </select>
        <select className={field} value={dateFilter} onChange={(e) => { setDateFilter(e.target.value as DateFilter); setPage(0); }}>
          <option value="all">Cualquier fecha</option>
          <option value="today">Hoy</option>
          <option value="week">Esta semana</option>
          <option value="month">Este mes</option>
          <option value="range">Rango…</option>
        </select>
        {dateFilter === 'range' && (
          <>
            <input type="date" className={field} value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" className={field} value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        )}
        <select className={field} value={serviceName} onChange={(e) => { setServiceName(e.target.value); setPage(0); }}>
          <option value="all">Todos los servicios</option>
          {serviceNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <input
          className={field}
          placeholder="Buscar nombre o teléfono"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
      </div>

      <div className="flex rounded-md border border-border p-0.5 text-sm self-start">
        {(['list', 'calendar'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            className={`rounded px-3 py-1 ${viewMode === m ? 'bg-primary text-surface' : 'text-muted'}`}
          >
            {m === 'list' ? 'Lista' : 'Calendario'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : viewMode === 'calendar' ? (
        <ScheduleCalendar views={filtered} onSelectBooking={setDetail} />
      ) : (
        <>
          <BookingsTable
            views={pageRows}
            showDate
            busyId={busyId}
            onViewComprobante={setComprobanteId}
            onApprove={async (id) => {
              setBusyId(id);
              await act(() => approve(id), 'Reserva aprobada.');
              setBusyId(null);
            }}
            onReject={setRejecting}
            onReschedule={setRescheduling}
            onCancel={async (v) => {
              if (!window.confirm('Esta acción liberará el horario y notificará la cancelación. ¿Confirmar?'))
                return;
              setBusyId(v.booking.id);
              await act(() => cancel(v.booking.id), 'Reserva eliminada.');
              setBusyId(null);
            }}
            onRemove={async (v) => {
              if (!window.confirm('¿Eliminar definitivamente esta reserva? No se podrá recuperar.'))
                return;
              setBusyId(v.booking.id);
              await act(() => remove(v.booking.id), 'Reserva eliminada definitivamente.');
              setBusyId(null);
            }}
            onRetrySync={async (v) => {
              setBusyId(v.booking.id);
              await act(() => retryCalendarSync(v.booking), 'Sincronización reintentada.');
              setBusyId(null);
              reload();
            }}
          />

          <div className="flex items-center justify-between text-sm text-muted">
            <span>{filtered.length} reservas</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" disabled={current === 0} onClick={() => setPage(current - 1)}>
                ‹
              </Button>
              <span>
                Página {current + 1} de {pageCount}
              </span>
              <Button
                variant="ghost"
                disabled={current >= pageCount - 1}
                onClick={() => setPage(current + 1)}
              >
                ›
              </Button>
            </div>
          </div>
        </>
      )}

      <ComprobanteModal bookingId={comprobanteId} onClose={() => setComprobanteId(null)} />
      <RejectModal
        view={rejecting}
        busy={!!busyId}
        onConfirm={async (reason) => {
          if (!rejecting) return;
          setBusyId(rejecting.booking.id);
          await act(() => reject(rejecting.booking.id, reason), 'Reserva rechazada.');
          setBusyId(null);
          setRejecting(null);
        }}
        onClose={() => setRejecting(null)}
      />
      <ManualBookingModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={() => {
          show('Reserva manual creada.');
          reload();
        }}
      />
      <BookingDetailModal
        view={detail}
        busy={!!busyId}
        onClose={() => setDetail(null)}
        onViewComprobante={setComprobanteId}
        onApprove={async (id) => {
          setBusyId(id);
          await act(() => approve(id), 'Reserva aprobada.');
          setBusyId(null);
          setDetail(null);
        }}
        onReject={(v) => {
          setDetail(null);
          setRejecting(v);
        }}
        onReschedule={(v) => {
          setDetail(null);
          setRescheduling(v);
        }}
        onCancel={async (v) => {
          if (!window.confirm('Esta acción liberará el horario y notificará la cancelación. ¿Confirmar?'))
            return;
          setBusyId(v.booking.id);
          await act(() => cancel(v.booking.id), 'Reserva eliminada.');
          setBusyId(null);
          setDetail(null);
        }}
      />
      <RescheduleModal
        view={rescheduling}
        onClose={() => setRescheduling(null)}
        onDone={() => {
          show('Reserva reprogramada.');
          reload();
        }}
      />
    </div>
  );
}
