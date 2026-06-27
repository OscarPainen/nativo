import {
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  bookingDoc,
  bookingsCol,
  comprobanteDoc,
  serviceDoc,
  slotDoc,
} from './paths';
import { SlotNotAvailableError } from './slots.service';
import type { Booking, Service, Slot } from '@/types';

export { SlotNotAvailableError };

export class LockExpiredError extends Error {
  constructor() {
    super('Se acabó el tiempo para confirmar (15 min). Vuelve a elegir tu hora.');
    this.name = 'LockExpiredError';
  }
}

export interface BookingView {
  booking: Booking;
  slot: Slot | null;
  service: Service | null;
}

function lockExpired(until?: Timestamp | null): boolean {
  return (until?.toMillis?.() ?? 0) < Date.now();
}

/**
 * Confirma la reserva de forma atómica: valida que el slot siga locked por
 * este cliente y no haya expirado, crea el booking en `pending_approval`,
 * pasa el slot a `pending` y guarda el comprobante (data-URI) en el mismo
 * doc transaccional. Todo o nada.
 */
export async function confirmBooking(params: {
  sessionId: string;
  slotId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  acceptedPolicies: boolean;
  comprobanteDataUrl: string;
  lockedUntil: Timestamp | null;
}): Promise<string> {
  const {
    sessionId,
    slotId,
    serviceId,
    clientName,
    clientPhone,
    acceptedPolicies,
    comprobanteDataUrl,
    lockedUntil,
  } = params;

  if (!acceptedPolicies) throw new Error('Debes aceptar las condiciones.');
  const bRef = doc(bookingsCol());

  await runTransaction(db, async (tx) => {
    const sSnap = await tx.get(slotDoc(slotId));
    if (!sSnap.exists()) throw new SlotNotAvailableError();
    const slot = sSnap.data() as Omit<Slot, 'id'>;

    if (slot.status !== 'locked' || slot.lockedBy !== sessionId) {
      throw new SlotNotAvailableError();
    }
    if (lockExpired(slot.lockedUntil)) throw new LockExpiredError();

    tx.update(slotDoc(slotId), { status: 'pending' });
    tx.set(bRef, {
      clientName,
      clientPhone,
      sessionId,
      slotId,
      serviceId,
      status: 'pending_approval',
      hasComprobante: true,
      acceptedPolicies,
      createdAt: serverTimestamp(),
      lockedUntil: lockedUntil ?? slot.lockedUntil ?? null,
    });
    tx.set(comprobanteDoc(bRef.id), {
      sessionId,
      dataUrl: comprobanteDataUrl,
      createdAt: serverTimestamp(),
    });
  });

  return bRef.id;
}

/** Todas las reservas, enriquecidas con slot y servicio (solo admin por reglas). */
export async function fetchAdminBookings(): Promise<BookingView[]> {
  const snap = await getDocs(bookingsCol());
  const bookings = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) }))
    .sort(
      (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
    );

  return Promise.all(
    bookings.map(async (booking) => {
      const [slotSnap, serviceSnap] = await Promise.all([
        getDoc(slotDoc(booking.slotId)),
        getDoc(serviceDoc(booking.serviceId)),
      ]);
      return {
        booking,
        slot: slotSnap.exists()
          ? ({ id: slotSnap.id, ...(slotSnap.data() as Omit<Slot, 'id'>) })
          : null,
        service: serviceSnap.exists()
          ? ({ id: serviceSnap.id, ...(serviceSnap.data() as Omit<Service, 'id'>) })
          : null,
      };
    }),
  );
}

/** Aprobar: booking → confirmed, slot → booked. */
export async function approveBooking(bookingId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const bSnap = await tx.get(bookingDoc(bookingId));
    if (!bSnap.exists()) throw new Error('La reserva no existe.');
    const booking = bSnap.data() as Omit<Booking, 'id'>;

    tx.update(bookingDoc(bookingId), { status: 'confirmed' });
    tx.update(slotDoc(booking.slotId), {
      status: 'booked',
      lockedBy: null,
      lockedAt: null,
      lockedUntil: null,
    });
  });
}

/** Rechazar: booking → rejected (con motivo), slot → free. */
export async function rejectBooking(
  bookingId: string,
  rejectionReason: string,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const bSnap = await tx.get(bookingDoc(bookingId));
    if (!bSnap.exists()) throw new Error('La reserva no existe.');
    const booking = bSnap.data() as Omit<Booking, 'id'>;

    tx.update(bookingDoc(bookingId), { status: 'rejected', rejectionReason });
    tx.update(slotDoc(booking.slotId), {
      status: 'free',
      lockedBy: null,
      lockedAt: null,
      lockedUntil: null,
    });
  });
}

/** Cancelar una reserva confirmada: booking → cancelled, slot → free. */
export async function cancelBooking(bookingId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const bSnap = await tx.get(bookingDoc(bookingId));
    if (!bSnap.exists()) throw new Error('La reserva no existe.');
    const booking = bSnap.data() as Omit<Booking, 'id'>;

    tx.update(bookingDoc(bookingId), { status: 'cancelled' });
    tx.update(slotDoc(booking.slotId), {
      status: 'free',
      lockedBy: null,
      lockedAt: null,
      lockedUntil: null,
    });
  });
}

/** Reserva manual del admin (presencial/telefónica): confirmada sin flujo de pago. */
export async function createManualBooking(params: {
  slotId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
}): Promise<string> {
  const { slotId, serviceId, clientName, clientPhone } = params;
  const bRef = doc(bookingsCol());

  await runTransaction(db, async (tx) => {
    const sSnap = await tx.get(slotDoc(slotId));
    if (!sSnap.exists()) throw new SlotNotAvailableError();
    const slot = sSnap.data() as Omit<Slot, 'id'>;
    if (slot.status === 'booked' || slot.status === 'pending') {
      throw new SlotNotAvailableError();
    }

    tx.update(slotDoc(slotId), {
      status: 'booked',
      lockedBy: null,
      lockedAt: null,
      lockedUntil: null,
    });
    tx.set(bRef, {
      clientName,
      clientPhone,
      sessionId: 'manual',
      slotId,
      serviceId,
      status: 'confirmed',
      hasComprobante: false,
      acceptedPolicies: true,
      createdAt: serverTimestamp(),
      lockedUntil: null,
    });
  });

  return bRef.id;
}

/** Genera y descarga un CSV con las reservas dadas (ya filtradas). */
export function exportBookingsCSV(views: BookingView[], filename = 'reservas.csv'): void {
  const STATUS: Record<string, string> = {
    pending_approval: 'Pendiente',
    confirmed: 'Confirmada',
    rejected: 'Rechazada',
    cancelled: 'Cancelada',
  };
  const headers = [
    'Fecha',
    'Hora',
    'Nombre',
    'Teléfono',
    'Servicio',
    'Precio',
    'Estado',
    'Motivo rechazo',
  ];
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = views.map(({ booking, slot, service }) =>
    [
      slot?.date ?? '',
      slot?.time ?? '',
      booking.clientName,
      booking.clientPhone,
      service?.name ?? '',
      service?.price ?? '',
      STATUS[booking.status] ?? booking.status,
      booking.rejectionReason ?? '',
    ]
      .map(escape)
      .join(','),
  );
  const csv = [headers.map(escape).join(','), ...rows].join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
