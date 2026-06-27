import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { fetchComprobante } from '@/services/comprobante.service';

interface Props {
  bookingId: string | null;
  onClose: () => void;
}

export default function ComprobanteModal({ bookingId, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bookingId) {
      setUrl(null);
      return;
    }
    setLoading(true);
    fetchComprobante(bookingId)
      .then(setUrl)
      .finally(() => setLoading(false));
  }, [bookingId]);

  return (
    <Modal open={!!bookingId} onClose={onClose} title="Comprobante de pago" maxWidth="max-w-lg">
      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : url ? (
        <img src={url} alt="Comprobante" className="mx-auto max-h-[70vh] rounded" />
      ) : (
        <p className="text-sm text-muted">No hay comprobante disponible.</p>
      )}
    </Modal>
  );
}
