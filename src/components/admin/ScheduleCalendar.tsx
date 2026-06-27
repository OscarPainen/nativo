import { useMemo, useState } from 'react';
import type { BookingView } from '@/services/bookings.service';
import { IconChevronLeft, IconChevronRight } from '@/components/ui/icons';

interface Props {
  /** Reservas a mostrar (se filtran a confirmadas y pendientes). */
  views: BookingView[];
  onSelectBooking: (v: BookingView) => void;
}

type Mode = 'week' | 'month';
const WEEKDAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function iso(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay()); // domingo
}

export default function ScheduleCalendar({ views, onSelectBooking }: Props) {
  const [mode, setMode] = useState<Mode>('week');
  const [anchor, setAnchor] = useState(() => new Date());

  const byDate = useMemo(() => {
    const map: Record<string, BookingView[]> = {};
    for (const v of views) {
      if (!v.slot) continue;
      if (v.booking.status !== 'confirmed' && v.booking.status !== 'pending_approval') continue;
      (map[v.slot.date] ??= []).push(v);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.slot!.time).localeCompare(b.slot!.time));
    }
    return map;
  }, [views]);

  const days = useMemo(() => {
    if (mode === 'week') {
      const s = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(s, i));
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    const weeks = Math.ceil((first.getDay() + new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
  }, [mode, anchor]);

  const todayIso = iso(new Date());
  const label =
    mode === 'month'
      ? `${MONTHS[anchor.getMonth()]} de ${anchor.getFullYear()}`.replace(/^./, (c) => c.toUpperCase())
      : (() => {
          const s = startOfWeek(anchor);
          const e = addDays(s, 6);
          return `${s.getDate()} ${MONTHS[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${MONTHS[e.getMonth()].slice(0, 3)} ${e.getFullYear()}`;
        })();

  function shift(dir: number) {
    setAnchor((a) =>
      mode === 'week'
        ? addDays(a, dir * 7)
        : new Date(a.getFullYear(), a.getMonth() + dir, 1),
    );
  }

  const navBtn = 'flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground hover:border-secondary';

  return (
    <div className="rounded-lg border border-border bg-surface">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-secondary" onClick={() => setAnchor(new Date())}>
            Hoy
          </button>
          <button className={navBtn} onClick={() => shift(-1)} aria-label="Anterior">
            <IconChevronLeft />
          </button>
          <button className={navBtn} onClick={() => shift(1)} aria-label="Siguiente">
            <IconChevronRight />
          </button>
          <span className="ml-1 text-sm font-medium capitalize">{label}</span>
        </div>
        <div className="flex rounded-md border border-border p-0.5 text-sm">
          {(['week', 'month'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-3 py-1 ${mode === m ? 'bg-primary text-surface' : 'text-muted'}`}
            >
              {m === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      {/* Header días */}
      <div className="grid grid-cols-7 border-b border-border text-center text-xs text-muted">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>

      {/* Grilla */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dIso = iso(day);
          const inMonth = mode === 'week' || day.getMonth() === anchor.getMonth();
          const items = byDate[dIso] ?? [];
          const isToday = dIso === todayIso;
          return (
            <div
              key={i}
              className={`min-h-[96px] border-b border-r border-border p-1.5 ${
                inMonth ? '' : 'bg-background/60'
              }`}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday ? 'bg-accent font-semibold text-surface' : inMonth ? 'text-foreground' : 'text-muted'
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {items.map((v) => (
                  <button
                    key={v.booking.id}
                    onClick={() => onSelectBooking(v)}
                    title={`${v.slot!.time} · ${v.booking.clientName} · ${v.service?.name ?? ''}`}
                    className={`w-full truncate rounded border-l-2 px-1.5 py-1 text-left text-xs ${
                      v.booking.status === 'confirmed'
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-amber-400 bg-amber-50 text-amber-900'
                    }`}
                  >
                    <span className="font-medium">{v.slot!.time}</span> {v.booking.clientName}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 p-3 text-xs text-muted">
        <span><span className="mr-1 inline-block h-3 w-3 rounded-sm border-l-2 border-primary bg-primary/10 align-middle" />Confirmada</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-sm border-l-2 border-amber-400 bg-amber-50 align-middle" />Pendiente</span>
      </div>
    </div>
  );
}
