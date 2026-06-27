import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useServices } from '@/hooks/useServices';
import { fetchSlotsByDate } from '@/services/slots.service';
import { createManualBooking } from '@/services/bookings.service';
import { formatCLP } from '@/utils/format';
import type { Slot } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const field = 'w-full rounded border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent';

export default function ManualBookingModal({ open, onClose, onCreated }: Props) {
  const { services } = useServices(true);
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [freeSlots, setFreeSlots] = useState<Slot[]>([]);
  const [slotId, setSlotId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) {
      setFreeSlots([]);
      setSlotId('');
      return;
    }
    fetchSlotsByDate(date).then((s) => setFreeSlots(s.filter((x) => x.status === 'free')));
  }, [date]);

  async function submit() {
    setError(null);
    if (!serviceId || !slotId || name.trim().length < 3 || phone.trim().length < 6) {
      setError('Completa servicio, fecha, hora, nombre y teléfono.');
      return;
    }
    setBusy(true);
    try {
      await createManualBooking({
        slotId,
        serviceId,
        clientName: name.trim(),
        clientPhone: phone.trim(),
      });
      onCreated();
      onClose();
      setServiceId('');
      setDate('');
      setSlotId('');
      setName('');
      setPhone('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la reserva.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva reserva manual">
      <div className="flex flex-col gap-3">
        <label className="text-sm text-muted">
          Servicio
          <select className={`mt-1 ${field}`} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">Selecciona…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {formatCLP(s.price)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-muted">
          Fecha
          <input type="date" className={`mt-1 ${field}`} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        <label className="text-sm text-muted">
          Hora (cupos libres)
          <select
            className={`mt-1 ${field}`}
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
            disabled={!date}
          >
            <option value="">{date ? 'Selecciona…' : 'Elige una fecha primero'}</option>
            {freeSlots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.time}
              </option>
            ))}
          </select>
          {date && freeSlots.length === 0 && (
            <span className="mt-1 block text-xs text-muted">No hay cupos libres ese día.</span>
          )}
        </label>

        <Input placeholder="Nombre del cliente" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Creando…' : 'Crear reserva'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
