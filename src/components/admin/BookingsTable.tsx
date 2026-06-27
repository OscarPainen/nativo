import type { BookingView } from '@/services/bookings.service';
import { BookingBadge, ROW_BG } from './StatusBadge';
import { IconCheck, IconEye, IconX } from '@/components/ui/icons';
import { formatCLP, formatDateLabel } from '@/utils/format';

interface BookingsTableProps {
  views: BookingView[];
  showDate?: boolean;
  busyId?: string | null;
  onApprove?: (id: string) => void;
  onReject?: (v: BookingView) => void;
  onCancel?: (v: BookingView) => void;
  onViewComprobante?: (id: string) => void;
  onClientClick?: (v: BookingView) => void;
}

const th = 'px-3 py-2 text-left font-medium text-muted';
const td = 'px-3 py-2 align-middle';

export default function BookingsTable({
  views,
  showDate = false,
  busyId,
  onApprove,
  onReject,
  onCancel,
  onViewComprobante,
  onClientClick,
}: BookingsTableProps) {
  if (views.length === 0) {
    return <p className="text-sm text-muted">Sin reservas.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-background">
          <tr>
            {showDate && <th className={th}>Fecha</th>}
            <th className={th}>Hora</th>
            <th className={th}>Cliente</th>
            <th className={th}>Teléfono</th>
            <th className={th}>Servicio</th>
            <th className={th}>Precio</th>
            <th className={th}>Estado</th>
            <th className={th}>Comp.</th>
            <th className={th}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {views.map((v) => {
            const { booking, slot, service } = v;
            return (
              <tr
                key={booking.id}
                className={`border-t border-border ${ROW_BG[booking.status]} hover:brightness-95`}
              >
                {showDate && (
                  <td className={td}>{slot ? formatDateLabel(slot.date) : '—'}</td>
                )}
                <td className={td}>{slot?.time ?? '—'}</td>
                <td className={td}>
                  {onClientClick ? (
                    <button
                      className="font-medium underline-offset-2 hover:underline"
                      onClick={() => onClientClick(v)}
                    >
                      {booking.clientName}
                    </button>
                  ) : (
                    <span className="font-medium">{booking.clientName}</span>
                  )}
                </td>
                <td className={td}>{booking.clientPhone}</td>
                <td className={td}>{service?.name ?? '—'}</td>
                <td className={td}>{service ? formatCLP(service.price) : '—'}</td>
                <td className={td}>
                  <BookingBadge status={booking.status} />
                </td>
                <td className={td}>
                  {booking.hasComprobante && onViewComprobante ? (
                    <button
                      title="Ver comprobante"
                      onClick={() => onViewComprobante(booking.id)}
                      className="text-muted hover:text-foreground"
                    >
                      <IconEye />
                    </button>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className={td}>
                  <div className="flex gap-1">
                    {booking.status === 'pending_approval' && onApprove && onReject && (
                      <>
                        <button
                          disabled={busyId === booking.id}
                          onClick={() => onApprove(booking.id)}
                          className="flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                        >
                          <IconCheck size={14} /> Aprobar
                        </button>
                        <button
                          disabled={busyId === booking.id}
                          onClick={() => onReject(v)}
                          className="flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                        >
                          <IconX size={14} /> Rechazar
                        </button>
                      </>
                    )}
                    {booking.status === 'confirmed' && onCancel && (
                      <button
                        disabled={busyId === booking.id}
                        onClick={() => onCancel(v)}
                        className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
