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
 * Lock atómico del slot por 15 min. Garantiza que dos clientes nunca
 * tomen el mismo horario: la transacción re-lee el estado y solo procede
 * si está libre (o con un lock ya expirado).
 */
export async function lockSlot(slotId: string, sessionId: string): Promise<Timestamp> {
  const ref = slotDoc(slotId);
  const lockedUntil = Timestamp.fromMillis(Date.now() + LOCK_MS);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new SlotNotAvailableError();
    const slot = { id: snap.id, ...(snap.data() as Omit<Slot, 'id'>) };
    const available =
      slot.status === 'free' || (slot.status === 'locked' && lockExpired(slot));
    if (!available) throw new SlotNotAvailableError();

    tx.update(ref, {
      status: 'locked',
      lockedBy: sessionId,
      lockedAt: serverTimestamp(),
      lockedUntil,
    });
  });

  return lockedUntil;
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
