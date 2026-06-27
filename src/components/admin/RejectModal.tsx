import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { BookingView } from '@/services/bookings.service';

interface Props {
  view: BookingView | null;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export default function RejectModal({ view, busy, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState('');

  return (
    <Modal open={!!view} onClose={onClose} title="Rechazar reserva">
      {view && (
        <>
          <p className="text-sm text-muted">
            {view.booking.clientName} · {view.service?.name}
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo del rechazo (obligatorio)"
            rows={3}
            className="mt-3 w-full rounded border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Volver
            </Button>
            <Button
              variant="secondary"
              disabled={busy || reason.trim().length === 0}
              onClick={() => onConfirm(reason.trim())}
            >
              Rechazar y liberar hora
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
