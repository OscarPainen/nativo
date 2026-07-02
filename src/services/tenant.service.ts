import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, TENANT_ID } from '@/config/firebase';
import type { PaymentInfo, Schedule, Tenant, TenantTheme } from '@/types';
import classicPreset from '@/themes/presets/classic.json';

interface PresetShape {
  name: string;
  logoUrl: string;
  theme: TenantTheme;
  policies: string[];
}

const DEFAULT_PAYMENT: PaymentInfo = {
  mercadoPagoUser: '',
  paymentLink: '',
};

/** Horario por defecto: mañana 11:00–13:30 y tarde 14:30–20:00 (almuerzo 13:30–14:30), lun-sáb. */
export const DEFAULT_SCHEDULE: Schedule = {
  blocks: [
    { id: 'morning', start: '11:00', end: '13:30' },
    { id: 'afternoon', start: '14:30', end: '20:00' },
  ],
  slotIntervalMin: 30,
  daysOpen: [1, 2, 3, 4, 5, 6],
};

/** Tenant de respaldo: la app arranca con tema aunque Firestore esté vacío o sin red. */
export const FALLBACK_TENANT: Tenant = {
  id: TENANT_ID,
  ...(classicPreset as PresetShape),
  paymentInfo: DEFAULT_PAYMENT,
  schedule: DEFAULT_SCHEDULE,
};

/** Carga la config del tenant desde Firestore; cae al preset local ante error/ausencia. */
export async function fetchTenant(): Promise<Tenant> {
  try {
    const snap = await getDoc(doc(db, 'tenants', TENANT_ID));
    if (!snap.exists()) return FALLBACK_TENANT;
    const data = snap.data() as Omit<Tenant, 'id'>;
    return {
      id: snap.id,
      ...data,
      policies: data.policies ?? FALLBACK_TENANT.policies,
      paymentInfo: data.paymentInfo ?? DEFAULT_PAYMENT,
      schedule: data.schedule ?? DEFAULT_SCHEDULE,
    };
  } catch {
    // Fallback silencioso a preset local. Sin logs en producción para no
    // filtrar detalles internos; en desarrollo se avisa de forma genérica.
    if (import.meta.env.DEV) console.warn('[tenant] usando preset local (fallback)');
    return FALLBACK_TENANT;
  }
}

/** Actualiza los datos de pago (MercadoPago) del tenant. Solo admin por reglas. */
export async function updatePaymentInfo(paymentInfo: PaymentInfo): Promise<void> {
  await setDoc(doc(db, 'tenants', TENANT_ID), { paymentInfo }, { merge: true });
}

/** Actualiza cualquier campo del tenant (Settings). Solo admin por reglas. */
export async function updateTenant(data: Partial<Omit<Tenant, 'id'>>): Promise<void> {
  await setDoc(doc(db, 'tenants', TENANT_ID), data, { merge: true });
}
