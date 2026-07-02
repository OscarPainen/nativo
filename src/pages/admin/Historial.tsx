import { useEffect, useMemo, useState } from 'react';
import { useAdminBookings } from '@/hooks/useAdminBookings';
import { exportBookingsCSV, type BookingView } from '@/services/bookings.service';
import { isPastSlot } from '@/services/slots.service';
import Drawer from '@/components/ui/Drawer';
import Button from '@/components/ui/Button';
import Pagination, { PAGE_SIZE } from '@/components/admin/Pagination';
import { formatCLP, formatDateLabel } from '@/utils/format';

const field = 'rounded border border-border bg-surface px-2 py-1.5 text-sm';
const th = 'px-3 py-2 text-left font-medium text-muted';
const td = 'px-3 py-2';

export default function Historial() {
  const { bookings, loading } = useAdminBookings();

  const [month, setMonth] = useState('');
  const [serviceName, setServiceName] = useState('all');
  const [search, setSearch] = useState('');
  const [client, setClient] = useState<{ name: string; phone: string } | null>(null);
  const [page, setPage] = useState(0);

  // Solo cortes YA realizados (fecha/hora pasada según hora oficial de Chile).
  const confirmed = useMemo(
    () =>
      bookings.filter(
        (v) => v.booking.status === 'confirmed' && v.slot && isPastSlot(v.slot.date, v.slot.time),
      ),
    [bookings],
  );

  const serviceNames = useMemo(
    () => [...new Set(confirmed.map((b) => b.service?.name).filter(Boolean) as string[])],
    [confirmed],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return confirmed
      .filter((v) => {
        if (month && !v.slot!.date.startsWith(month)) return false;
        if (serviceName !== 'all' && v.service?.name !== serviceName) return false;
        if (term) {
          const hay = `${v.booking.clientName} ${v.booking.clientPhone}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) =>
        (b.slot!.date + b.slot!.time).localeCompare(a.slot!.date + a.slot!.time),
      );
  }, [confirmed, month, serviceName, search]);

  useEffect(() => setPage(0), [month, serviceName, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const clientHistory = useMemo(() => {
    if (!client) return [];
    return confirmed
      .filter((v) => v.booking.clientPhone === client.phone)
      .sort((a, b) => (b.slot!.date + b.slot!.time).localeCompare(a.slot!.date + a.slot!.time));
  }, [client, confirmed]);

  const clientTotal = clientHistory.reduce((s, v) => s + (v.service?.price ?? 0), 0);
  const isFrequent = clientHistory.length >= 5;

  function openClient(v: BookingView) {
    setClient({ name: v.booking.clientName, phone: v.booking.clientPhone });
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Historial de cortes</h1>
        <Button variant="secondary" onClick={() => exportBookingsCSV(filtered, 'historial.csv')}>
          Exportar CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input type="month" className={field} value={month} onChange={(e) => setMonth(e.target.value)} />
        <select className={field} value={serviceName} onChange={(e) => setServiceName(e.target.value)}>
          <option value="all">Todos los servicios</option>
          {serviceNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <input
          className={field}
          placeholder="Buscar nombre o teléfono"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {month && (
          <Button variant="ghost" onClick={() => setMonth('')}>
            Limpiar mes
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted">Sin cortes realizados.</p>
      ) : (
        <>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-background">
              <tr>
                <th className={th}>Fecha</th>
                <th className={th}>Hora</th>
                <th className={th}>Cliente</th>
                <th className={th}>Teléfono</th>
                <th className={th}>Servicio</th>
                <th className={th}>Precio</th>
                <th className={th}>Notas</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((v) => (
                <tr key={v.booking.id} className="border-t border-border hover:bg-background">
                  <td className={td}>{formatDateLabel(v.slot!.date)}</td>
                  <td className={td}>{v.slot!.time}</td>
                  <td className={td}>
                    <button className="font-medium underline-offset-2 hover:underline" onClick={() => openClient(v)}>
                      {v.booking.clientName}
                    </button>
                  </td>
                  <td className={td}>{v.booking.clientPhone}</td>
                  <td className={td}>{v.service?.name ?? '—'}</td>
                  <td className={td}>{v.service ? formatCLP(v.service.price) : '—'}</td>
                  <td className={td}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <Pagination
            page={current}
            pageCount={pageCount}
            total={filtered.length}
            onPage={setPage}
            label="cortes"
          />
        </div>
        </>
      )}

      <Drawer open={!!client} onClose={() => setClient(null)} title="Detalle de cliente">
        {client && (
          <div className="flex flex-col gap-3 text-sm">
            <div>
              <p className="text-lg font-semibold">{client.name}</p>
              <p className="text-muted">{client.phone}</p>
              {isFrequent && (
                <span className="mt-1 inline-block rounded bg-accent/15 px-2 py-0.5 text-xs font-medium text-foreground">
                  Cliente frecuente
                </span>
              )}
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-muted">Cortes</p>
                <p className="text-xl font-semibold">{clientHistory.length}</p>
              </div>
              <div>
                <p className="text-muted">Total gastado</p>
                <p className="text-xl font-semibold">{formatCLP(clientTotal)}</p>
              </div>
            </div>
            <div>
              <p className="mb-1 font-medium">Cortes anteriores</p>
              <ul className="flex flex-col gap-1">
                {clientHistory.map((v) => (
                  <li key={v.booking.id} className="flex justify-between border-b border-border py-1">
                    <span>
                      {formatDateLabel(v.slot!.date)} · {v.slot!.time}
                    </span>
                    <span className="text-muted">{v.service?.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
