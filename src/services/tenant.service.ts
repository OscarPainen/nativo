import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, TENANT_ID } from '@/config/firebase';
import type { PaymentInfo, Tenant, TenantTheme } from '@/types';
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

/** Tenant de respaldo: la app arranca con tema aunque Firestore esté vacío o sin red. */
export const FALLBACK_TENANT: Tenant = {
  id: TENANT_ID,
  ...(classicPreset as PresetShape),
  paymentInfo: DEFAULT_PAYMENT,
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
