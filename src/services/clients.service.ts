import { getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { clientDoc, clientsCol } from './paths';
import type { Client } from '@/types';

/** Crea/actualiza el registro del cliente anónimo (para historial del admin). */
export async function upsertClient(params: {
  sessionId: string;
  name: string;
  phone: string;
}): Promise<void> {
  const { sessionId, name, phone } = params;
  await setDoc(
    clientDoc(sessionId),
    { sessionId, name, phone, lastSeen: serverTimestamp() },
    { merge: true },
  );
}

/** Todos los clientes (solo admin por reglas). */
export async function fetchClients(): Promise<Client[]> {
  const snap = await getDocs(clientsCol());
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Client, 'id'>) }));
}
