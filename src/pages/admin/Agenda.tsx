import { useEffect, useMemo, useState } from 'react';
import {
  blockDay,
  blockSlot,
  fetchAllSlots,
  forceUnlock,
  generateSlots,
  unblockDay,
  unblockSlot,
} from '@/services/slots.service';
import { fetchBarbers } from '@/services/barbers.service';
import { fetchAdminBookings, type BookingView } from '@/services/bookings.service';
import type { Slot } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import Drawer from '@/components/ui/Drawer';
import Button from '@/components/ui/Button';
import { SlotBadge } from '@/components/admin/StatusBadge';
import { formatDateLabel } from '@/utils/format';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const field = 'rounded border border-border bg-surface px-2 py-1.5 text-sm';

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function Agenda() {
  const { show } = useToast();
  const [allSlots, setAllSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<BookingView[]>([]);
  const [barberId, setBarberId] = useState('barber-1');

  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState<string | null>(null);

  // Generador
  const [genStart, setGenStart] = useState('10:00');
  const [genEnd, setGenEnd] = useState('14:00');
  const [genInterval, setGenInterval] = useState(60);
  const [busy, setBusy] = useState(false);

  async function reloadAll() {
    const [slots, views] = await Promise.all([fetchAllSlots(), fetchAdminBookings()]);
    setAllSlots(slots);
    setBookings(views);
  }

  useEffect(() => {
    reloadAll();
    fetchBarbers().then((bs) => {
      const active = bs.find((b) => b.active) ?? bs[0];
      if (active) setBarberId(active.id);
    });
  }, []);

  const byDate = useMemo(() => {
    const map: Record<string, Slot[]> = {};
    for (const s of allSlots) (map[s.date] ??= []).push(s);
    return map;
  }, [allSlots]);

  const clientBySlot = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of bookings) {
      if (v.booking.status === 'confirmed' || v.booking.status === 'pending_approval') {
        for (const id of v.booking.slotIds ?? []) map[id] = v.booking.clientName;
      }
    }
    return map;
  }, [bookings]);

  const daySlots = selected ? (byDate[selected] ?? []).slice().sort((a, b) => a.time.localeCompare(b.time)) : [];

  function dayColor(isoDate: string): string {
    const slots = byDate[isoDate];
    if (!slots || slots.length === 0) return 'text-foreground hover:bg-border/40';
    const booked = slots.filter((s) => s.status === 'booked').length;
    const blocked = slots.filter((s) => s.status === 'blocked').length;
    if (blocked === slots.length) return 'bg-gray-300 text-gray-600';
    if (booked === slots.length) return 'bg-primary text-surface';
    if (booked > 0) return 'bg-primary/40 text-foreground';
    return 'text-foreground hover:bg-border/40';
  }

  const monthStart = new Date(view.year, view.month, 1);
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const leading = (monthStart.getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthLabel = monthStart
    .toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase());

  function shift(delta: number) {
    setView((v) => {
      const idx = v.year * 12 + v.month + delta;
      return { year: Math.floor(idx / 12), month: idx % 12 };
    });
  }

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      await reloadAll();
      show(ok);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Agenda</h1>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <button className={field} onClick={() => shift(-1)}>‹</button>
          <span className="font-medium capitalize">{monthLabel}</span>
          <button className={field} onClick={() => shift(1)}>›</button>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-muted">
          {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <span key={i} />;
            const isoDate = iso(view.year, view.month, day);
            return (
              <button
                key={i}
                onClick={() => setSelected(isoDate)}
                className={`flex h-11 items-center justify-center rounded-md text-sm transition ${dayColor(isoDate)}`}
              >
                {day}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
          <span><span className="mr-1 inline-block h-3 w-3 rounded bg-primary align-middle" />Lleno</span>
          <span><span className="mr-1 inline-block h-3 w-3 rounded bg-primary/40 align-middle" />Parcial</span>
          <span><span className="mr-1 inline-block h-3 w-3 rounded bg-gray-300 align-middle" />Bloqueado</span>
        </div>
      </div>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? formatDateLabel(selected) : ''}
      >
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('¿Bloquear todos los cupos libres del día?'))
                    run(() => blockDay(selected), 'Día bloqueado.');
                }}
              >
                Bloquear día
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('¿Liberar todos los cupos bloqueados del día?'))
                    run(() => unblockDay(selected), 'Día liberado.');
                }}
              >
                Liberar día
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {daySlots.length === 0 && (
                <p className="text-sm text-muted">No hay cupos este día.</p>
              )}
              {daySlots.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.time}</span>
                    <SlotBadge status={s.status} />
                    {s.status === 'booked' && clientBySlot[s.id] && (
                      <span className="text-muted">{clientBySlot[s.id]}</span>
                    )}
                  </div>
                  {s.status === 'free' && (
                    <Button variant="ghost" disabled={busy} onClick={() => run(() => blockSlot(s.id), 'Cupo bloqueado.')}>
                      Bloquear
                    </Button>
                  )}
                  {s.status === 'blocked' && (
                    <Button variant="ghost" disabled={busy} onClick={() => run(() => unblockSlot(s.id), 'Cupo liberado.')}>
                      Liberar
                    </Button>
                  )}
                  {s.status === 'locked' && (
                    <Button variant="ghost" disabled={busy} onClick={() => run(() => forceUnlock(s.id), 'Lock liberado.')}>
                      Forzar liberación
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-md border border-border p-3">
              <p className="mb-2 text-sm font-medium">Generar cupos</p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-muted">
                  Inicio
                  <input type="time" className={`mt-1 block ${field}`} value={genStart} onChange={(e) => setGenStart(e.target.value)} />
                </label>
                <label className="text-xs text-muted">
                  Fin
                  <input type="time" className={`mt-1 block ${field}`} value={genEnd} onChange={(e) => setGenEnd(e.target.value)} />
                </label>
                <label className="text-xs text-muted">
                  Intervalo (min)
                  <input type="number" min={15} step={15} className={`mt-1 block w-20 ${field}`} value={genInterval} onChange={(e) => setGenInterval(Number(e.target.value))} />
                </label>
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(
                      async () => {
                        const n = await generateSlots({
                          date: selected,
                          startTime: genStart,
                          endTime: genEnd,
                          intervalMin: genInterval,
                          barberId,
                        });
                        show(`${n} cupos creados.`);
                      },
                      'Listo.',
                    )
                  }
                >
                  Generar
                </Button>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
