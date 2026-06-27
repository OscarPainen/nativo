import { collection, doc } from 'firebase/firestore';
import { db, TENANT_ID } from '@/config/firebase';

/** Punto único para construir referencias bajo el tenant actual. Aísla la data por barbería. */
export const tenantDoc = () => doc(db, 'tenants', TENANT_ID);

export const servicesCol = () => collection(tenantDoc(), 'services');
export const barbersCol = () => collection(tenantDoc(), 'barbers');
export const slotsCol = () => collection(tenantDoc(), 'slots');
export const bookingsCol = () => collection(tenantDoc(), 'bookings');
export const usersCol = () => collection(tenantDoc(), 'users');
export const clientsCol = () => collection(tenantDoc(), 'clients');
export const comprobantesCol = () => collection(tenantDoc(), 'comprobantes');

export const slotDoc = (id: string) => doc(slotsCol(), id);
export const bookingDoc = (id: string) => doc(bookingsCol(), id);
export const serviceDoc = (id: string) => doc(servicesCol(), id);
export const clientDoc = (id: string) => doc(clientsCol(), id);
export const comprobanteDoc = (id: string) => doc(comprobantesCol(), id);
