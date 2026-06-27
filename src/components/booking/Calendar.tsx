import { useMemo, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '@/components/ui/icons';

interface CalendarProps {
  /** Fechas "YYYY-MM-DD" con al menos un cupo disponible. */
  dates: string[];
  selected: string | null;
  onSelect: (date: string) => void;
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Índice de columna lunes-primero (0=lunes … 6=domingo). */
function mondayIndex(weekday: number): number {
  return (weekday + 6) % 7;
}

/** Selector de día estilo calendario mensual; solo días con cupo son elegibles. */
export default function Calendar({ dates, selected, onSelect }: CalendarProps) {
  const available = useMemo(() => new Set(dates), [dates]);
  const sorted = useMemo(() => [...dates].sort(), [dates]);

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const initial = useMemo(() => {
    const base = first ? new Date(`${first}T00:00:00`) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  }, [first]);

  const [view, setView] = useState(initial);

  if (dates.length === 0) {
    return <p className="text-sm text-muted">No hay días con horarios disponibles.</p>;
  }

  const minIndex = first
    ? (() => {
        const d = new Date(`${first}T00:00:00`);
        return d.getFullYear() * 12 + d.getMonth();
      })()
    : 0;
  const maxIndex = last
    ? (() => {
        const d = new Date(`${last}T00:00:00`);
        return d.getFullYear() * 12 + d.getMonth();
      })()
    : 0;
  const viewIndex = view.year * 12 + view.month;

  const monthStart = new Date(view.year, view.month, 1);
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const leading = mondayIndex(monthStart.getDay());

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

  const navBtn =
    'flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground transition disabled:opacity-30 hover:enabled:border-secondary';

  return (
    <div className="w-full max-w-xs">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className={navBtn}
          onClick={() => shift(-1)}
          disabled={viewIndex <= minIndex}
          aria-label="Mes anterior"
        >
          <IconChevronLeft />
        </button>
        <span className="text-sm font-medium capitalize">{monthLabel}</span>
        <button
          type="button"
          className={navBtn}
          onClick={() => shift(1)}
          disabled={viewIndex >= maxIndex}
          aria-label="Mes siguiente"
        >
          <IconChevronRight />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <span key={i} />;
          const iso = toISO(view.year, view.month, day);
          const enabled = available.has(iso);
          const isSelected = selected === iso;
          return (
            <button
              key={i}
              type="button"
              disabled={!enabled}
              onClick={() => onSelect(iso)}
              aria-pressed={isSelected}
              className={`flex h-9 w-9 items-center justify-center rounded-md text-sm transition ${
                isSelected
                  ? 'bg-accent text-surface'
                  : enabled
                    ? 'text-foreground hover:bg-accent/10'
                    : 'cursor-not-allowed text-muted/40'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
