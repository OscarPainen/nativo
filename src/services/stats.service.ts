import type { Slot } from '@/types';
import type { BookingView } from './bookings.service';

export type Period = 'week' | 'month' | 'lastMonth' | 'last3';

export const PERIOD_LABEL: Record<Period, string> = {
  week: 'Semana actual',
  month: 'Mes actual',
  lastMonth: 'Mes anterior',
  last3: 'Últimos 3 meses',
};

function isoLocal(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

function mondayOf(d: Date): Date {
  const r = new Date(d);
  const diff = (r.getDay() + 6) % 7; // 0=lunes
  r.setDate(r.getDate() - diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

/** Rango [start, end] inclusive en ISO según el período. */
export function periodRange(period: Period): { start: string; end: string } {
  const now = new Date();
  if (period === 'week') {
    const start = mondayOf(now);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: isoLocal(start), end: isoLocal(end) };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: isoLocal(start), end: isoLocal(end) };
  }
  if (period === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: isoLocal(start), end: isoLocal(end) };
  }
  // last3
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: isoLocal(start), end: isoLocal(end) };
}

const inRange = (date: string | undefined, start: string, end: string) =>
  !!date && date >= start && date <= end;

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export interface StatsResult {
  totalConfirmed: number;
  totalIncome: number;
  approvalRate: number;
  occupancy: number;
  topClient: { name: string; count: number } | null;
  topService: { name: string; count: number } | null;
  byDay: { day: string; reservas: number }[];
  byService: { name: string; value: number }[];
  incomeByWeek: { semana: string; ingresos: number }[];
  evolution: { semana: string; reservas: number }[];
  serviceSummary: { name: string; count: number; income: number; pct: number }[];
}

export function computeStats(
  views: BookingView[],
  slots: Slot[],
  range: { start: string; end: string },
): StatsResult {
  const { start, end } = range;
  const confirmed = views.filter(
    (v) => v.booking.status === 'confirmed' && inRange(v.slot?.date, start, end),
  );
  const rejected = views.filter(
    (v) => v.booking.status === 'rejected' && inRange(v.slot?.date, start, end),
  );

  const totalConfirmed = confirmed.length;
  const totalIncome = confirmed.reduce((s, v) => s + (v.service?.price ?? 0), 0);
  const approvalRate =
    confirmed.length + rejected.length > 0
      ? (confirmed.length / (confirmed.length + rejected.length)) * 100
      : 0;

  const periodSlots = slots.filter((s) => inRange(s.date, start, end));
  const notBlocked = periodSlots.filter((s) => s.status !== 'blocked');
  const booked = periodSlots.filter((s) => s.status === 'booked');
  const occupancy = notBlocked.length > 0 ? (booked.length / notBlocked.length) * 100 : 0;

  // Cliente más frecuente
  const clientCount = new Map<string, { name: string; count: number }>();
  for (const v of confirmed) {
    const cur = clientCount.get(v.booking.clientPhone) ?? {
      name: v.booking.clientName,
      count: 0,
    };
    cur.count++;
    clientCount.set(v.booking.clientPhone, cur);
  }
  const topClient =
    [...clientCount.values()].sort((a, b) => b.count - a.count)[0] ?? null;

  // Servicio más solicitado + resumen
  const svcCount = new Map<string, { count: number; income: number }>();
  for (const v of confirmed) {
    const name = v.service?.name ?? 'Servicio';
    const cur = svcCount.get(name) ?? { count: 0, income: 0 };
    cur.count++;
    cur.income += v.service?.price ?? 0;
    svcCount.set(name, cur);
  }
  const serviceSummary = [...svcCount.entries()]
    .map(([name, { count, income }]) => ({
      name,
      count,
      income,
      pct: totalConfirmed > 0 ? (count / totalConfirmed) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
  const topService = serviceSummary[0]
    ? { name: serviceSummary[0].name, count: serviceSummary[0].count }
    : null;

  const byService = serviceSummary.map((s) => ({ name: s.name, value: s.count }));

  // Por día de la semana (lun-sáb)
  const dayBuckets = Array(6).fill(0);
  for (const v of confirmed) {
    if (!v.slot) continue;
    const idx = (new Date(`${v.slot.date}T00:00:00`).getDay() + 6) % 7;
    if (idx < 6) dayBuckets[idx]++;
  }
  const byDay = WEEKDAYS.map((day, i) => ({ day, reservas: dayBuckets[i] }));

  // Ingresos por semana dentro del período
  const weekIncome = new Map<string, number>();
  for (const v of confirmed) {
    if (!v.slot) continue;
    const key = isoLocal(mondayOf(new Date(`${v.slot.date}T00:00:00`)));
    weekIncome.set(key, (weekIncome.get(key) ?? 0) + (v.service?.price ?? 0));
  }
  const incomeByWeek = [...weekIncome.entries()]
    .sort()
    .map(([k, ingresos]) => ({ semana: k.slice(5), ingresos }));

  // Evolución últimas 8 semanas (todas las confirmadas, no solo período)
  const allConfirmed = views.filter((v) => v.booking.status === 'confirmed' && v.slot);
  const weeks: { semana: string; reservas: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const ws = mondayOf(new Date());
    ws.setDate(ws.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(ws.getDate() + 6);
    const sIso = isoLocal(ws);
    const eIso = isoLocal(we);
    const count = allConfirmed.filter((v) => inRange(v.slot?.date, sIso, eIso)).length;
    weeks.push({ semana: sIso.slice(5), reservas: count });
  }

  return {
    totalConfirmed,
    totalIncome,
    approvalRate,
    occupancy,
    topClient,
    topService,
    byDay,
    byService,
    incomeByWeek,
    evolution: weeks,
    serviceSummary,
  };
}
