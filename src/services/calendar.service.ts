import { getDoc, updateDoc } from 'firebase/firestore';
import { bookingDoc, serviceDoc, slotDoc } from './paths';
import { fetchTenant } from './tenant.service';
import type { Booking, Service, Slot } from '@/types';

export type CalendarAction =
  | 'confirm_booking'
  | 'reschedule_booking'
  | 'reject_booking'
  | 'cancel_booking';

const ENV_URL = import.meta.env.VITE_CALENDAR_WEBHOOK_URL ?? '';
const TOKEN = import.meta.env.VITE_CALENDAR_WEBHOOK_TOKEN ?? '';
const TIMEOUT_MS = 8000;

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function toTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** POST al webhook (text/plain para evitar preflight CORS); devuelve el JSON. */
async function postWebhook(url: string, payload: Record<string, unknown>) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, token: TOKEN }),
      signal: ctrl.signal,
    });
    const data = JSON.parse(await res.text()) as {
      status: string;
      calendarEventId?: string;
      error?: string;
    };
    if (data.status !== 'success') throw new Error(data.error ?? 'Webhook error');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Prueba de conexión (botón "Probar conexión" en Settings). */
export async function pingWebhook(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const data = await postWebhook(url, { action: 'ping' });
    return data.status === 'success';
  } catch {
    return false;
  }
}

interface EventContext {
  booking: Booking;
  service: Service | null;
  slot: Slot | null;
  webhookUrl: string;
  calendarId: string | null;
}

async function loadContext(bookingId: string): Promise<EventContext | null> {
  const bSnap = await getDoc(bookingDoc(bookingId));
  if (!bSnap.exists()) return null;
  const booking = { id: bSnap.id, ...(bSnap.data() as Omit<Booking, 'id'>) };

  const tenant = await fetchTenant();
  const webhookUrl = tenant.calendarWebhookUrl || ENV_URL;
  if (!webhookUrl) return null; // sin calendario conectado: no es un error

  const [svcSnap, slotSnap] = await Promise.all([
    getDoc(serviceDoc(booking.serviceId)),
    booking.slotIds?.[0] ? getDoc(slotDoc(booking.slotIds[0])) : Promise.resolve(null),
  ]);

  return {
    booking,
    service: svcSnap.exists() ? ({ id: svcSnap.id, ...(svcSnap.data() as Omit<Service, 'id'>) }) : null,
    slot: slotSnap && slotSnap.exists() ? ({ id: slotSnap.id, ...(slotSnap.data() as Omit<Slot, 'id'>) }) : null,
    webhookUrl,
    calendarId: tenant.googleCalendarId ?? null,
  };
}

function buildTimes(slot: Slot, durationMin: number) {
  const startDateTime = `${slot.date}T${slot.time}:00`;
  const endDateTime = `${slot.date}T${toTime(toMin(slot.time) + durationMin)}:00`;
  return { startDateTime, endDateTime };
}

/**
 * Sincroniza el evento de Calendar tras una acción de reserva. BEST-EFFORT:
 * nunca lanza; si falla marca booking.calendarSyncFailed. Una falla de Calendar
 * jamás debe revertir la operación de la reserva.
 */
export async function syncCalendarForBooking(
  action: CalendarAction,
  bookingId: string,
): Promise<void> {
  const isDelete = action === 'reject_booking' || action === 'cancel_booking';
  try {
    const ctx = await loadContext(bookingId);
    if (!ctx) return;
    const { booking, service, slot, webhookUrl, calendarId } = ctx;

    // Nada que borrar si no había evento.
    if (isDelete && !booking.calendarEventId) return;
    if (!isDelete && !slot) throw new Error('Sin horario para el evento');

    const times = slot ? buildTimes(slot, service?.durationMin ?? 60) : null;
    const res = await postWebhook(webhookUrl, {
      action,
      calendarId: calendarId || undefined,
      calendarEventId: booking.calendarEventId || undefined,
      clientName: booking.clientName,
      clientPhone: booking.clientPhone,
      serviceName: service?.name ?? 'Servicio',
      startDateTime: times?.startDateTime,
      endDateTime: times?.endDateTime,
    });

    if (isDelete) {
      await updateDoc(bookingDoc(bookingId), { calendarEventId: null, calendarSyncFailed: false });
    } else {
      await updateDoc(bookingDoc(bookingId), {
        calendarEventId: res.calendarEventId ?? null,
        calendarSyncFailed: false,
      });
    }
  } catch {
    // Solo marcamos fallo cuando debía existir/actualizarse un evento.
    if (!isDelete) {
      try {
        await updateDoc(bookingDoc(bookingId), { calendarSyncFailed: true });
      } catch {
        /* noop */
      }
    }
  }
}

/** Borra el evento asociado (para eliminación definitiva). No actualiza el doc. */
export async function deleteCalendarForBooking(bookingId: string): Promise<void> {
  try {
    const ctx = await loadContext(bookingId);
    if (!ctx || !ctx.booking.calendarEventId) return;
    await postWebhook(ctx.webhookUrl, {
      action: 'cancel_booking',
      calendarId: ctx.calendarId || undefined,
      calendarEventId: ctx.booking.calendarEventId,
    });
  } catch {
    /* la eliminación de la reserva es válida aunque falle el calendario */
  }
}

/** Reintento manual desde el dashboard, según el estado actual. */
export async function retryCalendarSync(booking: Booking): Promise<void> {
  const action: CalendarAction =
    booking.status === 'confirmed'
      ? booking.calendarEventId
        ? 'reschedule_booking'
        : 'confirm_booking'
      : 'cancel_booking';
  await syncCalendarForBooking(action, booking.id);
}
