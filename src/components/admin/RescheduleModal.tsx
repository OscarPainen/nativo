import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import SlotPicker from '@/components/booking/SlotPicker';
import { useTheme } from '@/contexts/ThemeContext';
import { fetchSlotsByDate, getRequiredSlots } from '@/services/slots.service';
import { rescheduleBooking, type BookingView } from '@/services/bookings.service';
import { writeErrorMessage } from '@/utils/errors';
import { formatDateLabel } from '@/utils/format';
import type { Slot } from '@/types';

interface Props {
  view: BookingView | null;
  onClose: () => void;
  onDone: () => void;
}

const field = 'mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent';

export default function RescheduleModal({ view, onClose, onDone }: Props) {
  const { tenant } = useTheme();
  const intervalMin = tenant?.schedule?.slotIntervalMin ?? 30;
  const service = view?.service ?? null;

  const [date, setDate] = useState('');
  const [freeSlots, setFreeSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDate('');
    setFreeSlots([]);
    setSlot(null);
    setError(null);
  }, [view]);

  useEffect(() => {
    if (!date) {
      setFreeSlots([]);
      setSlot(null);
      return;
    }
    fetchSlotsByDate(date).then((s) => setFreeSlots(s.filter((x) => x.status === 'free')));
  }, [date]);

  const validStarts = useMemo(() => {
    if (!service) return [];
    return freeSlots.filter(
      (s) =>
        getRequiredSlots(freeSlots, s.id, service.durationMin, intervalMin, service.lastBookableStart) !==
        null,
    );
  }, [freeSlots, service, intervalMin]);

  async function submit() {
    if (!view || !slot) return;
    setBusy(true);
    setError(null);
    try {
      await rescheduleBooking({
        bookingId: view.booking.id,
        newStartSlotId: slot.id,
        intervalMin,
      });
      onDone();
      onClose();
    } catch (e) {
      setError(writeErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!view} onClose={onClose} title="Reprogramar reserva">
      {view && (
        <div className="flex flex-col gap-3 text-sm">
          <div className="rounded-md border border-border p-3">
            <p className="font-medium">{view.booking.clientName}</p>
            <p className="text-muted">{service?.name ?? 'Servicio'}</p>
            <p className="text-muted">
              Actual:{' '}
              {view.slot ? `${formatDateLabel(view.slot.date)} · ${view.slot.time}` : '—'}
            </p>
          </div>

          <label className="text-muted">
            Nueva fecha
            <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <div>
            <p className="mb-1 text-muted">Nueva hora</p>
            {!date ? (
              <p className="text-sm text-muted">Elige una fecha.</p>
            ) : validStarts.length === 0 ? (
              <p className="text-sm text-muted">No hay cupos suficientes ese día.</p>
            ) : (
              <SlotPicker slots={validStarts} selectedId={slot?.id ?? null} onSelect={setSlot} />
            )}
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={!slot || busy}>
              {busy ? 'Reprogramando…' : 'Reprogramar'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
