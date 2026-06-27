import type { BookingStatus, SlotStatus } from '@/types';

const BOOKING: Record<BookingStatus, { label: string; cls: string }> = {
  pending_approval: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmada', cls: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rechazada', cls: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Cancelada', cls: 'bg-gray-200 text-gray-600' },
};

const SLOT: Record<SlotStatus, { label: string; cls: string }> = {
  free: { label: 'Libre', cls: 'bg-green-100 text-green-800' },
  locked: { label: 'En proceso', cls: 'bg-amber-100 text-amber-800' },
  pending: { label: 'Por aprobar', cls: 'bg-amber-100 text-amber-800' },
  booked: { label: 'Reservado', cls: 'bg-blue-100 text-blue-800' },
  blocked: { label: 'Bloqueado', cls: 'bg-gray-200 text-gray-600' },
};

export function BookingBadge({ status }: { status: BookingStatus }) {
  const { label, cls } = BOOKING[status];
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export function SlotBadge({ status }: { status: SlotStatus }) {
  const { label, cls } = SLOT[status];
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

/** Clase de fondo de fila según estado de reserva. */
export const ROW_BG: Record<BookingStatus, string> = {
  pending_approval: 'bg-amber-50',
  confirmed: 'bg-green-50',
  rejected: 'bg-red-50',
  cancelled: 'bg-gray-50',
};
