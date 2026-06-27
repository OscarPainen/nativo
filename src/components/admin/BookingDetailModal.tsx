import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { BookingBadge } from './StatusBadge';
import type { BookingView } from '@/services/bookings.service';
import { formatCLP, formatDateLabel } from '@/utils/format';

interface Props {
  view: BookingView | null;
  busy?: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (v: BookingView) => void;
  onCancel: (v: BookingView) => void;
  onViewComprobante: (id: string) => void;
}

export default function BookingDetailModal({
  view,
  busy,
  onClose,
  onApprove,
  onReject,
  onCancel,
  onViewComprobante,
}: Props) {
  return (
    <Modal open={!!view} onClose={onClose} title="Detalle de la reserva">
      {view && (
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">{view.booking.clientName}</span>
            <BookingBadge status={view.booking.status} />
          </div>
          <p className="text-muted">{view.booking.clientPhone}</p>
          <p>
            {view.service?.name ?? 'Servicio'} ·{' '}
            {view.slot ? `${formatDateLabel(view.slot.date)} · ${view.slot.time}` : '—'}
          </p>
          {view.service && <p className="font-medium">{formatCLP(view.service.price)}</p>}
          {view.booking.rejectionReason && (
            <p className="text-muted">Motivo: {view.booking.rejectionReason}</p>
          )}

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {view.booking.hasComprobante && (
              <Button variant="ghost" onClick={() => onViewComprobante(view.booking.id)}>
                Ver comprobante
              </Button>
            )}
            {view.booking.status === 'pending_approval' && (
              <>
                <Button disabled={busy} onClick={() => onApprove(view.booking.id)}>
                  Aprobar
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => onReject(view)}>
                  Rechazar
                </Button>
              </>
            )}
            {view.booking.status === 'confirmed' && (
              <Button variant="secondary" disabled={busy} onClick={() => onCancel(view)}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
