import {
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { slotDoc, slotsCol } from './paths';
import type { Slot } from '@/types';

export const LOCK_MINUTES = 15;
const LOCK_MS = LOCK_MINUTES * 60 * 1000;

export class SlotNotAvailableError extends Error {
  constructor() {
    super('Esta hora fue tomada por otro cliente. Por favor selecciona otra.');
    this.name = 'SlotNotAvailableError';
  }
}

/** "YYYY-MM-DD" de hoy en hora local. */
export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

/** Anticipación mínima para reservar el mismo día (minutos). */
export const MIN_LEAD_MINUTES = 180;

/** Fecha y minutos-del-día actuales en hora oficial de Chile (America/Santiago). */
export function santiagoNow(): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(hour) * 60 + Number(get('minute')),
  };
}

/**
 * ¿Una hora de inicio respeta la anticipación mínima? Días futuros: sí.
 * Mismo día: solo si faltan al menos MIN_LEAD_MINUTES respecto a la hora de Chile.
 */
export function meetsLeadTime(date: string, time: string): boolean {
  const now = santiagoNow();
  if (date > now.date) return true;
  if (date < now.date) return false;
  return timeToMin(time) >= now.minutes + MIN_LEAD_MINUTES;
}

/** ¿La hora ya pasó respecto a la hora oficial de Chile? (para el historial). */
export function isPastSlot(date: string, time: string): boolean {
  const now = santiagoNow();
  if (date < now.date) return true;
  if (date > now.date) return false;
  return timeToMin(time) < now.minutes;
}

function lockExpired(slot: Slot): boolean {
  const until = slot.lockedUntil?.toMillis?.() ?? 0;
  return until < Date.now();
}

/**
 * Slots disponibles desde hoy: los `free` más los `locked` ya expirados
 * (que se liberan en una batch write antes de mostrarse). Sin Cloud Functions.
 */
export async function fetchAvailableSlots(): Promise<Slot[]> {
  const snap = await getDocs(
    query(slotsCol(), where('status', 'in', ['free', 'locked'])),
  );
  const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Slot, 'id'>) }));

  // Limpieza best-effort de locks expirados (requiere sesión; si falla, igual
  // se muestran como disponibles y lockSlot puede tomarlos atómicamente).
  const expired = all.filter((s) => s.status === 'locked' && lockExpired(s));
  if (expired.length > 0 && auth.currentUser) {
    try {
      const batch = writeBatch(db);
      for (const s of expired) {
        batch.update(slotDoc(s.id), {
          status: 'free',
          lockedBy: null,
          lockedAt: null,
          lockedUntil: null,
        });
      }
      await batch.commit();
    } catch {
      /* la limpieza no debe romper la carga de horarios */
    }
  }

  const today = todayISO();
  return all
    .filter((s) => s.status === 'free' || (s.status === 'locked' && lockExpired(s)))
    .map((s) => ({ ...s, status: 'free' as const }))
    .filter((s) => s.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export function groupByDate(slots: Slot[]): Record<string, Slot[]> {
  return slots.reduce<Record<string, Slot[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});
}

/**
 * Lógica de slots por DURACIÓN: un servicio puede ocupar varios slots
 * consecutivos de la grilla base (ej. 90 min sobre intervalos de 30 = 3 slots).
 */
export class NotEnoughSpaceError extends Error {
  constructor() {
    super('Esta hora no tiene espacio suficiente para este servicio. Elige otro horario.');
    this.name = 'NotEnoughSpaceError';
  }
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minToTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
function buildSlotId(date: string, time: string, barberId: string): string {
  return `${date}_${time.replace(':', '')}_${barberId}`;
}

/** IDs de `count` slots consecutivos desde startTime (mismo día y barbero). */
export function consecutiveSlotIds(
  date: string,
  startTime: string,
  barberId: string,
  count: number,
  intervalMin: number,
): string[] {
  return Array.from({ length: count }, (_, i) =>
    buildSlotId(date, minToTime(timeToMin(startTime) + i * intervalMin), barberId),
  );
}

/**
 * IDs de los slots consecutivos que requiere un servicio desde startSlotId.
 * Devuelve null si falta alguno (cae en almuerzo, cruza el cierre o ya está
 * tomado) o si supera el tope lastBookableStart. Función pura sobre los slots
 * LIBRES del día (un slot tomado simplemente no estará en la lista).
 */
export function getRequiredSlots(
  daySlots: Slot[],
  startSlotId: string,
  durationMin: number,
  intervalMin: number,
  lastBookableStart?: string | null,
): string[] | null {
  const start = daySlots.find((s) => s.id === startSlotId);
  if (!start) return null;
  if (lastBookableStart && timeToMin(start.time) > timeToMin(lastBookableStart)) return null;

  const count = Math.ceil(durationMin / intervalMin);
  const byTime = new Map(daySlots.map((s) => [s.time, s]));
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const slot = byTime.get(minToTime(timeToMin(start.time) + i * intervalMin));
    if (!slot || slot.status !== 'free') return null;
    ids.push(slot.id);
  }
  return ids;
}

/**
 * Lockea atómicamente TODOS los slots que requiere el servicio desde el
 * horario de inicio. Reconstruye los IDs por tiempo y valida cada uno dentro
 * de la transacción. Si falta espacio o alguno no está libre, no toca nada.
 */
export async function lockSlotsForBooking(params: {
  startSlotId: string;
  durationMin: number;
  intervalMin: number;
  lastBookableStart?: string | null;
  sessionId: string;
}): Promise<{ slotIds: string[]; lockedUntil: Timestamp }> {
  const { startSlotId, durationMin, intervalMin, lastBookableStart, sessionId } = params;
  const lockedUntil = Timestamp.fromMillis(Date.now() + LOCK_MS);
  const count = Math.ceil(durationMin / intervalMin);

  const slotIds = await runTransaction(db, async (tx) => {
    const startSnap = await tx.get(slotDoc(startSlotId));
    if (!startSnap.exists()) throw new NotEnoughSpaceError();
    const start = startSnap.data() as Omit<Slot, 'id'>;
    if (lastBookableStart && timeToMin(start.time) > timeToMin(lastBookableStart)) {
      throw new NotEnoughSpaceError();
    }

    const ids = Array.from({ length: count }, (_, i) =>
      buildSlotId(start.date, minToTime(timeToMin(start.time) + i * intervalMin), start.barberId),
    );

    // Todas las lecturas antes de cualquier escritura (requisito de transacción).
    const snaps = await Promise.all(ids.map((id) => tx.get(slotDoc(id))));
    snaps.forEach((snap, i) => {
      if (!snap.exists()) throw new NotEnoughSpaceError();
      const s = { id: ids[i], ...(snap.data() as Omit<Slot, 'id'>) };
      const available = s.status === 'free' || (s.status === 'locked' && lockExpired(s));
      if (!available) throw new SlotNotAvailableError();
    });

    for (const id of ids) {
      tx.update(slotDoc(id), {
        status: 'locked',
        lockedBy: sessionId,
        lockedAt: serverTimestamp(),
        lockedUntil,
      });
    }
    return ids;
  });

  return { slotIds, lockedUntil };
}

// ───────────────── Admin: agenda ─────────────────

export async function fetchAllSlots(): Promise<Slot[]> {
  const snap = await getDocs(slotsCol());
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Slot, 'id'>) }))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export async function fetchSlotsByDate(date: string): Promise<Slot[]> {
  const snap = await getDocs(query(slotsCol(), where('date', '==', date)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Slot, 'id'>) }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

export async function blockSlot(slotId: string): Promise<void> {
  await updateDoc(slotDoc(slotId), { status: 'blocked' });
}

export async function unblockSlot(slotId: string): Promise<void> {
  await updateDoc(slotDoc(slotId), { status: 'free' });
}

/** Libera un lock atascado (expiró y no se limpió). */
export async function forceUnlock(slotId: string): Promise<void> {
  await updateDoc(slotDoc(slotId), {
    status: 'free',
    lockedBy: null,
    lockedAt: null,
    lockedUntil: null,
  });
}

async function batchStatusByDate(
  date: string,
  fromStatus: Slot['status'],
  toStatus: Slot['status'],
): Promise<number> {
  const snap = await getDocs(
    query(slotsCol(), where('date', '==', date), where('status', '==', fromStatus)),
  );
  if (snap.empty) return 0;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { status: toStatus }));
  await batch.commit();
  return snap.size;
}

export const blockDay = (date: string) => batchStatusByDate(date, 'free', 'blocked');
export const unblockDay = (date: string) => batchStatusByDate(date, 'blocked', 'free');

/** Crea slots `free` en un rango horario; omite los que ya existen. */
export async function generateSlots(params: {
  date: string;
  startTime: string;
  endTime: string;
  intervalMin: number;
  barberId: string;
}): Promise<number> {
  const { date, startTime, endTime, intervalMin, barberId } = params;
  const [h0, m0] = startTime.split(':').map(Number);
  const [h1, m1] = endTime.split(':').map(Number);
  const end = h1 * 60 + m1;

  const times: string[] = [];
  for (let t = h0 * 60 + m0; t < end; t += intervalMin) {
    times.push(
      `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`,
    );
  }

  const batch = writeBatch(db);
  let created = 0;
  for (const time of times) {
    const id = `${date}_${time.replace(':', '')}_${barberId}`;
    const ref = doc(slotsCol(), id);
    if ((await getDoc(ref)).exists()) continue;
    batch.set(ref, {
      date,
      time,
      status: 'free',
      barberId,
      lockedBy: null,
      lockedAt: null,
      lockedUntil: null,
    });
    created++;
  }
  if (created > 0) await batch.commit();
  return created;
}

/** Libera el propio lock (countdown expirado o cancelación del cliente). */
export async function releaseLock(slotId: string, sessionId: string): Promise<void> {
  const ref = slotDoc(slotId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const slot = snap.data() as Omit<Slot, 'id'>;
    if (slot.status === 'locked' && slot.lockedBy === sessionId) {
      tx.update(ref, {
        status: 'free',
        lockedBy: null,
        lockedAt: null,
        lockedUntil: null,
      });
    }
  });
}

/** Libera varios locks propios (un grupo de reserva). */
export async function releaseLocks(slotIds: string[], sessionId: string): Promise<void> {
  await Promise.all(slotIds.map((id) => releaseLock(id, sessionId)));
}
