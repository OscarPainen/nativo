import { getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { comprobanteDoc } from './paths';

/** Guarda el comprobante (data-URI comprimido) en comprobantes/{bookingId}. */
export async function saveComprobante(params: {
  bookingId: string;
  sessionId: string;
  dataUrl: string;
}): Promise<void> {
  const { bookingId, sessionId, dataUrl } = params;
  await setDoc(comprobanteDoc(bookingId), {
    sessionId,
    dataUrl,
    createdAt: serverTimestamp(),
  });
}

/** Lee el comprobante para mostrarlo en el dashboard (solo admin por reglas). */
export async function fetchComprobante(bookingId: string): Promise<string | null> {
  const snap = await getDoc(comprobanteDoc(bookingId));
  return snap.exists() ? (snap.data().dataUrl as string) : null;
}
