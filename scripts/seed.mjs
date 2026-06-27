/**
 * Semilla idempotente del tenant en Firestore.
 *
 * Requisitos:
 *  1. Consola Firebase → Configuración del proyecto → Cuentas de servicio →
 *     "Generar nueva clave privada". Guarda el JSON como ./serviceAccount.json (gitignored).
 *  2. npm run seed
 *
 * Seguro de correr N veces: limpia barbers/services/slots antes de insertar
 * (NUNCA toca `users`). Genera slots dinámicamente para los próximos N días.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN (editar a futuro)
// ─────────────────────────────────────────────────────────────
const TENANT_ID = process.env.VITE_TENANT_ID || 'barberia-demo';
const DIAS_ADELANTE = 30;
// Sesiones de 60 min. Semana 10–19 (última hora a tomar: 19; pausa 13–14).
// Sábado 9–13 (última hora a tomar: 12). Domingo cerrado.
const HORARIO = {
  semana: ['10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
  sabado: ['09:00', '10:00', '11:00', '12:00'],
};
const DIAS_DESCANSO = [0]; // 0=domingo

// ─────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const serviceAccount = JSON.parse(
  readFileSync(resolve(root, 'serviceAccount.json'), 'utf8'),
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const tenant = {
  name: 'Barbería Demo',
  logoUrl: '',
  theme: {
    primary: '#111827',
    secondary: '#4b5563',
    accent: '#ca8a04',
    surface: '#ffffff',
    background: '#f9fafb',
    foreground: '#111827',
    muted: '#6b7280',
    border: '#e5e7eb',
    font: "'Inter', ui-sans-serif, system-ui, sans-serif",
    radius: '0.5rem',
  },
  policies: [
    'El abono es del 100% del servicio al momento de agendar.',
    'Cancelaciones con menos de 12 horas de anticipación no tienen devolución.',
    'Tiempo máximo de espera: 15 minutos. Pasado ese tiempo, la hora se cancela sin devolución.',
    'Edad mínima para reservar: 17 años.',
  ],
  // Configura el nombre y los links de pago reales desde el panel admin
  // (/admin/settings) tras el primer arranque. No pongas datos reales aquí
  // si el repositorio es público.
  paymentInfo: {
    mercadoPagoUser: 'Barbería Demo',
    paymentLink: '',
  },
};

const services = [
  {
    id: 'corte',
    name: 'Corte',
    durationMin: 60,
    price: 19000,
    description: 'Corte de cabello a tijera y máquina.',
    paymentLink: '',
  },
  {
    id: 'corte-barba',
    name: 'Corte y Barba',
    durationMin: 60,
    price: 24000,
    description: 'Corte completo más perfilado de barba.',
    paymentLink: '',
  },
  {
    id: 'corte-barba-vapor',
    name: 'Corte y Barba Vapor',
    durationMin: 60,
    price: 28000,
    description: 'Corte, barba y tratamiento con toalla de vapor.',
    paymentLink: '',
  },
];

const barbers = [{ id: 'barber-1', name: 'Barbero 1', active: true }];

// ─────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────

/** Borra todos los docs de una colección en batches de 500 (soporta colecciones grandes). */
async function clearCollection(collectionPath) {
  const ref = db.collection(collectionPath);
  const snapshot = await ref.get();
  if (snapshot.empty) {
    console.log(`  → vacía, nada que limpiar: ${collectionPath}`);
    return;
  }
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = db.batch();
    docs.slice(i, i + 500).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  console.log(`✓ Limpiada (${docs.length} docs): ${collectionPath}`);
}

/** ISO "YYYY-MM-DD" en hora local. */
function isoDate(d) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

/** Reservas dinámicas: próximos DIAS_ADELANTE días, lun-sáb, según HORARIO. */
function generateSlots() {
  const activeBarbers = barbers.filter((b) => b.active);
  const today = new Date();
  const slots = [];

  for (let i = 1; i <= DIAS_ADELANTE; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() + i);
    const wd = day.getDay(); // 0=domingo .. 6=sábado
    if (DIAS_DESCANSO.includes(wd)) continue;

    const horas = wd === 6 ? HORARIO.sabado : HORARIO.semana;
    const date = isoDate(day);

    for (const time of horas) {
      for (const barber of activeBarbers) {
        slots.push({
          id: `${date}_${time.replace(':', '')}_${barber.id}`,
          date,
          time,
          status: 'free',
          barberId: barber.id,
          lockedBy: null,
          lockedAt: null,
          lockedUntil: null,
        });
      }
    }
  }
  return slots;
}

/** Escribe docs en batches de 500. */
async function batchSet(collectionRef, items) {
  for (let i = 0; i < items.length; i += 500) {
    const batch = db.batch();
    for (const { id, ...data } of items.slice(i, i + 500)) {
      batch.set(collectionRef.doc(id), data);
    }
    await batch.commit();
  }
}

/** Ejecuta un paso con logging ✓/✗; si falla, propaga para detener todo. */
async function step(label, fn) {
  try {
    await fn();
    console.log(`✓ ${label}`);
  } catch (e) {
    console.error(`✗ ${label}`);
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function run() {
  const tenantRef = db.collection('tenants').doc(TENANT_ID);
  const base = `tenants/${TENANT_ID}`;

  await step(`tenant ${TENANT_ID}`, () => tenantRef.set(tenant, { merge: true }));

  // 1-3: limpiar (en orden), nunca `users`.
  await step('limpiar barbers', () => clearCollection(`${base}/barbers`));
  await step('limpiar services', () => clearCollection(`${base}/services`));
  await step('limpiar slots', () => clearCollection(`${base}/slots`));

  // 4-6: insertar.
  await step(`insertar ${barbers.length} barberos`, () =>
    batchSet(tenantRef.collection('barbers'), barbers),
  );
  await step(`insertar ${services.length} servicios`, () =>
    batchSet(tenantRef.collection('services'), services),
  );

  const slots = generateSlots();
  await step(`insertar ${slots.length} slots (próximos ${DIAS_ADELANTE} días)`, () =>
    batchSet(tenantRef.collection('slots'), slots),
  );

  console.log('\n✓ Seed completado.');
  console.log('Recuerda crear el usuario admin desde Auth y, en');
  console.log(`${base}/users/{uid}, fijar { role: "admin" }.`);
  process.exit(0);
}

run().catch((e) => {
  console.error('\n✗ Seed detenido. Error exacto:');
  console.error(e);
  process.exit(1);
});
