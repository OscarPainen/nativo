import {
  addDoc,
  deleteDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { bookingsCol, serviceDoc, servicesCol, slotDoc } from './paths';
import { getDoc } from 'firebase/firestore';
import type { Service } from '@/types';

/** Servicios activos (para el cliente). */
export async function fetchServices(): Promise<Service[]> {
  const all = await fetchAllServices();
  return all.filter((s) => s.active !== false);
}

/** Todos los servicios, activos e inactivos (para el admin). */
export async function fetchAllServices(): Promise<Service[]> {
  const snap = await getDocs(query(servicesCol(), orderBy('price')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Service, 'id'>) }));
}

export async function updateService(
  id: string,
  data: Partial<Omit<Service, 'id'>>,
): Promise<void> {
  await updateDoc(serviceDoc(id), data);
}

export async function createService(data: Omit<Service, 'id'>): Promise<string> {
  const ref = await addDoc(servicesCol(), data);
  return ref.id;
}

/** True si el servicio tiene reservas pendientes/confirmadas a futuro. */
export async function hasFutureBookings(serviceId: string): Promise<boolean> {
  // Solo filtro de igualdad (sin índice compuesto); el estado se filtra en cliente.
  const snap = await getDocs(query(bookingsCol(), where('serviceId', '==', serviceId)));
  const active = snap.docs.filter((d) =>
    ['pending_approval', 'confirmed'].includes(d.data().status),
  );
  const today = new Date().toISOString().slice(0, 10);
  for (const b of active) {
    const firstSlotId = (b.data().slotIds as string[] | undefined)?.[0];
    if (!firstSlotId) continue;
    const slotSnap = await getDoc(slotDoc(firstSlotId));
    if (slotSnap.exists() && (slotSnap.data().date as string) >= today) return true;
  }
  return false;
}

export async function deleteService(id: string): Promise<void> {
  if (await hasFutureBookings(id)) {
    throw new Error('No se puede eliminar: tiene reservas pendientes o confirmadas a futuro.');
  }
  await deleteDoc(serviceDoc(id));
}
