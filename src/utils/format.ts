export function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Horas (decimal) desde ahora hasta una fecha/hora de slot. Negativo si ya pasó. */
export function hoursUntil(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const target = new Date(y, m - 1, d, hh, mm).getTime();
  return (target - Date.now()) / 3_600_000;
}

/** "2026-06-28" → "sáb 28 jun". */
export function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date
    .toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace('.', '');
}
