import {
  deleteDoc,
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
import {
  consecutiveSlotIds,
  NotEnoughSpaceError,
  SlotNotAvailableError,
} from './slots.service';
import { deleteCalendarForBooking, syncCalendarForBooking } from './calendar.service';
import type { Booking, Service, Slot } from '@/types';

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export { SlotNotAvailableError };

export class LockExpiredError extends Error {
  constructor() {
    super('Se acabó el tiempo para confirmar (15 min). Vuelve a elegir tu hora.');
    this.name = 'LockExpiredError';
  }
}

export interface BookingView {
  booking: Booking;
  /** Primer slot del grupo (define fecha/hora de inicio de la cita). */
  slot: Slot | null;
  service: Service | null;
}

const FREE_LOCK = { lockedBy: null, lockedAt: null, lockedUntil: null };

function lockExpired(until?: Timestamp | null): boolean {
  return (until?.toMillis?.() ?? 0) < Date.now();
}

/**
 * Confirma la reserva de forma atómica: valida que TODOS los slots del grupo
 * sigan locked por este cliente y no hayan expirado, crea el booking en
 * `pending_approval`, pasa los slots a `pending` y guarda el comprobante.
 */
export async function confirmBooking(params: {
  sessionId: string;
  slotIds: string[];
  serviceId: string;
  clientName: string;
  clientPhone: string;
  acceptedPolicies: boolean;
  comprobanteDataUrl: string;
  lockedUntil: Timestamp | null;
}): Promise<string> {
  const {
    sessionId,
    slotIds,
    serviceId,
    clientName,
    clientPhone,
    acceptedPolicies,
    comprobanteDataUrl,
    lockedUntil,
  } = params;

  if (!acceptedPolicies) throw new Error('Debes aceptar las condiciones.');
  if (slotIds.length === 0) throw new SlotNotAvailableError();
  if (lockExpired(lockedUntil)) throw new LockExpiredError();
  const bRef = doc(bookingsCol());

  await runTransaction(db, async (tx) => {
    const snaps = await Promise.all(slotIds.map((id) => tx.get(slotDoc(id))));
    snaps.forEach((sSnap) => {
      if (!sSnap.exists()) throw new SlotNotAvailableError();
      const slot = sSnap.data() as Omit<Slot, 'id'>;
      if (slot.status !== 'locked' || slot.lockedBy !== sessionId) {
        throw new SlotNotAvailableError();
      }
      if (lockExpired(slot.lockedUntil)) throw new LockExpiredError();
    });

    for (const id of slotIds) tx.update(slotDoc(id), { status: 'pending' });
    tx.set(bRef, {
      clientName,
      clientPhone,
      sessionId,
      slotIds,
      serviceId,
      status: 'pending_approval',
      hasComprobante: true,
      acceptedPolicies,
      createdAt: serverTimestamp(),
      lockedUntil,
    });
    tx.set(comprobanteDoc(bRef.id), {
      sessionId,
      dataUrl: comprobanteDataUrl,
      createdAt: serverTimestamp(),
    });
  });

  return bRef.id;
}

/** Todas las reservas, enriquecidas con el primer slot y el servicio. */
export async function fetchAdminBookings(): Promise<BookingView[]> {
  const snap = await getDocs(bookingsCol());
  const bookings = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) }))
    .sort(
      (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
    );

  return Promise.all(
    bookings.map(async (booking) => {
      const firstSlotId = booking.slotIds?.[0];
      const [slotSnap, serviceSnap] = await Promise.all([
        firstSlotId ? getDoc(slotDoc(firstSlotId)) : Promise.resolve(null),
        getDoc(serviceDoc(booking.serviceId)),
      ]);
      return {
        booking,
        slot:
          slotSnap && slotSnap.exists()
            ? ({ id: slotSnap.id, ...(slotSnap.data() as Omit<Slot, 'id'>) })
            : null,
        service: serviceSnap.exists()
          ? ({ id: serviceSnap.id, ...(serviceSnap.data() as Omit<Service, 'id'>) })
          : null,
      };
    }),
  );
}

/** Transición de estado del booking + todos sus slots (atómica). */
async function transitionBooking(
  bookingId: string,
  bookingPatch: Partial<Booking>,
  slotPatch: Record<string, unknown>,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const bSnap = await tx.get(bookingDoc(bookingId));
    if (!bSnap.exists()) throw new Error('La reserva no existe.');
    const booking = bSnap.data() as Omit<Booking, 'id'>;

    tx.update(bookingDoc(bookingId), bookingPatch);
    for (const id of booking.slotIds ?? []) tx.update(slotDoc(id), slotPatch);
  });
}

/** Aprobar: booking → confirmed, slots → booked. Sincroniza Calendar (best-effort). */
export async function approveBooking(bookingId: string): Promise<void> {
  await transitionBooking(bookingId, { status: 'confirmed' }, { status: 'booked', ...FREE_LOCK });
  await syncCalendarForBooking('confirm_booking', bookingId);
}

/** Rechazar: booking → rejected (con motivo), slots → free. Borra evento si existía. */
export async function rejectBooking(bookingId: string, rejectionReason: string): Promise<void> {
  await transitionBooking(
    bookingId,
    { status: 'rejected', rejectionReason },
    { status: 'free', ...FREE_LOCK },
  );
  await syncCalendarForBooking('reject_booking', bookingId);
}

/** Cancelar una reserva confirmada: booking → cancelled, slots → free. Borra evento. */
export async function cancelBooking(bookingId: string): Promise<void> {
  await transitionBooking(bookingId, { status: 'cancelled' }, { status: 'free', ...FREE_LOCK });
  await syncCalendarForBooking('cancel_booking', bookingId);
}

/**
 * Eliminar (archivar) una reserva: libera todos sus slots y la marca cancelled,
 * sin borrar el documento (queda como registro histórico). Mismo efecto que
 * cancelar; punto único donde luego se dispara el borrado del evento de Calendar.
 */
export async function deleteBooking(bookingId: string): Promise<void> {
  await transitionBooking(bookingId, { status: 'cancelled' }, { status: 'free', ...FREE_LOCK });
  await syncCalendarForBooking('cancel_booking', bookingId);
}

/**
 * Elimina DEFINITIVAMENTE una reserva (y su comprobante). Pensado para
 * reservas ya canceladas/rechazadas: borra el documento por completo.
 * Libera por seguridad cualquier slot que aún estuviera ocupado por ella.
 */
export async function removeBooking(bookingId: string): Promise<void> {
  const snap = await getDoc(bookingDoc(bookingId));
  if (snap.exists()) {
    const booking = snap.data() as Omit<Booking, 'id'>;
    await Promise.all(
      (booking.slotIds ?? []).map(async (id) => {
        const sSnap = await getDoc(slotDoc(id));
        if (sSnap.exists() && (sSnap.data() as Omit<Slot, 'id'>).status !== 'free') {
          await runTransaction(db, async (tx) => {
            tx.update(slotDoc(id), { status: 'free', ...FREE_LOCK });
          });
        }
      }),
    );
  }
  await deleteCalendarForBooking(bookingId);
  await deleteDoc(comprobanteDoc(bookingId));
  await deleteDoc(bookingDoc(bookingId));
}

/**
 * Reprograma una reserva a un nuevo horario de inicio. Valida que haya espacio
 * consecutivo (permitiendo reutilizar los slots propios si hay solape), libera
 * los antiguos y ocupa los nuevos, todo en una transacción atómica.
 */
export async function rescheduleBooking(params: {
  bookingId: string;
  newStartSlotId: string;
  intervalMin: number;
}): Promise<void> {
  const { bookingId, newStartSlotId, intervalMin } = params;

  await runTransaction(db, async (tx) => {
    const bSnap = await tx.get(bookingDoc(bookingId));
    if (!bSnap.exists()) throw new Error('La reserva no existe.');
    const booking = bSnap.data() as Omit<Booking, 'id'>;

    const svcSnap = await tx.get(serviceDoc(booking.serviceId));
    if (!svcSnap.exists()) throw new Error('El servicio no existe.');
    const service = svcSnap.data() as Omit<Service, 'id'>;

    const startSnap = await tx.get(slotDoc(newStartSlotId));
    if (!startSnap.exists()) throw new NotEnoughSpaceError();
    const start = startSnap.data() as Omit<Slot, 'id'>;
    if (service.lastBookableStart && timeToMin(start.time) > timeToMin(service.lastBookableStart)) {
      throw new NotEnoughSpaceError();
    }

    const count = Math.ceil(service.durationMin / intervalMin);
    const newIds = consecutiveSlotIds(start.date, start.time, start.barberId, count, intervalMin);
    const oldSet = new Set(booking.slotIds ?? []);

    const newSnaps = await Promise.all(newIds.map((id) => tx.get(slotDoc(id))));
    newSnaps.forEach((snap, i) => {
      if (!snap.exists()) throw new NotEnoughSpaceError();
      const s = snap.data() as Omit<Slot, 'id'>;
      const usableOwn = oldSet.has(newIds[i]);
      if (s.status !== 'free' && !usableOwn) throw new SlotNotAvailableError();
    });

    const occupied = booking.status === 'pending_approval' ? 'pending' : 'booked';
    const newSet = new Set(newIds);

    for (const id of booking.slotIds ?? []) {
      if (!newSet.has(id)) tx.update(slotDoc(id), { status: 'free', ...FREE_LOCK });
    }
    for (const id of newIds) tx.update(slotDoc(id), { status: occupied, ...FREE_LOCK });
    tx.update(bookingDoc(bookingId), { slotIds: newIds });
  });

  await syncCalendarForBooking('reschedule_booking', bookingId);
}

/** Reserva manual del admin: confirmada sin flujo de pago, ocupa N slots. */
export async function createManualBooking(params: {
  startSlotId: string;
  serviceId: string;
  durationMin: number;
  intervalMin: number;
  clientName: string;
  clientPhone: string;
}): Promise<string> {
  const { startSlotId, serviceId, durationMin, intervalMin, clientName, clientPhone } = params;
  const count = Math.ceil(durationMin / intervalMin);
  const bRef = doc(bookingsCol());

  await runTransaction(db, async (tx) => {
    const startSnap = await tx.get(slotDoc(startSlotId));
    if (!startSnap.exists()) throw new SlotNotAvailableError();
    const start = startSnap.data() as Omit<Slot, 'id'>;
    const ids = consecutiveSlotIds(start.date, start.time, start.barberId, count, intervalMin);

    const snaps = await Promise.all(ids.map((id) => tx.get(slotDoc(id))));
    snaps.forEach((s) => {
      if (!s.exists() || (s.data() as Omit<Slot, 'id'>).status !== 'free') {
        throw new SlotNotAvailableError();
      }
    });

    for (const id of ids) tx.update(slotDoc(id), { status: 'booked', ...FREE_LOCK });
    tx.set(bRef, {
      clientName,
      clientPhone,
      sessionId: 'manual',
      slotIds: ids,
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
