import { useEffect, useMemo, useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '@/components/ui/icons';

interface CalendarProps {
  /** Fechas "YYYY-MM-DD" con al menos un cupo disponible. */
  dates: string[];
  selected: string | null;
  onSelect: (date: string) => void;
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function isoLocal(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}
function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function mondayIndex(weekday: number): number {
  return (weekday + 6) % 7;
}

/**
 * Calendario mensual. La ventana de reserva va desde la primera fecha con cupo
 * hasta el mismo día del mes siguiente. Se pueden navegar meses futuros para
 * mirar, pero al tocar una fecha fuera de la ventana muestra un aviso.
 */
export default function Calendar({ dates, selected, onSelect }: CalendarProps) {
  const available = useMemo(() => new Set(dates), [dates]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayISO = isoLocal(today);

  /** Primera fecha con cupo; base de la ventana de un mes. */
  const earliest = useMemo(() => (dates.length ? [...dates].sort()[0] : null), [dates]);

  /** Tope: mismo día del mes siguiente a la primera fecha disponible. */
  const maxBookable = useMemo(() => {
    if (!earliest) return todayISO;
    const d = new Date(`${earliest}T00:00:00`);
    return isoLocal(new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  }, [earliest, todayISO]);

  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [notice, setNotice] = useState<string | null>(null);
  const userNavigated = useRef(false);

  /** Al cargar la disponibilidad, abrir en el mes de la primera fecha con cupo. */
  useEffect(() => {
    if (userNavigated.current || !earliest) return;
    const d = new Date(`${earliest}T00:00:00`);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  }, [earliest]);

  const maxDate = new Date(`${maxBookable}T00:00:00`);
  const minIndex = today.getFullYear() * 12 + today.getMonth();
  // Permite mirar un mes más allá del último reservable.
  const maxIndex = Math.max(minIndex, maxDate.getFullYear() * 12 + maxDate.getMonth() + 1);
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
    userNavigated.current = true;
    setNotice(null);
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
          const past = iso < todayISO;
          const tooFar = iso > maxBookable;
          const selectable = !past && !tooFar && available.has(iso);
          const isSelected = selected === iso;

          function handleClick() {
            if (tooFar) {
              setNotice('Solo puedes reservar hasta con un mes de anticipación.');
              return;
            }
            if (selectable) {
              setNotice(null);
              onSelect(iso);
            }
          }

          return (
            <button
              key={i}
              type="button"
              disabled={past || (!selectable && !tooFar)}
              onClick={handleClick}
              aria-pressed={isSelected}
              className={`flex h-9 w-9 items-center justify-center rounded-md text-sm transition ${
                isSelected
                  ? 'bg-accent text-surface'
                  : selectable
                    ? 'text-foreground hover:bg-accent/10'
                    : tooFar
                      ? 'cursor-pointer text-muted/50'
                      : 'cursor-not-allowed text-muted/40'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {notice && <p className="mt-2 text-xs text-accent">{notice}</p>}
    </div>
  );
}
