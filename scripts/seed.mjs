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
// Horario por bloques (el almuerzo es el hueco entre bloques).
// Mañana 11:00–13:30 y tarde 14:30–20:00 → quedan deshabilitadas las 13:30 y 14:00.
// Cierre 20:00: un corte de 60 min puede iniciarse a las 19:00 (último inicio).
const SCHEDULE = {
  blocks: [
    { id: 'morning', start: '11:00', end: '13:30' },
    { id: 'afternoon', start: '14:30', end: '20:00' },
  ],
  slotIntervalMin: 30,
  daysOpen: [1, 2, 3, 4, 5, 6], // 0=domingo … 6=sábado
};

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
  schedule: SCHEDULE,
};

const services = [
  {
    id: 'corte',
    name: 'Corte',
    durationMin: 60,
    price: 19000,
    description: 'Corte de cabello a tijera y máquina.',
    paymentLink: '',
    lastBookableStart: null,
  },
  {
    id: 'corte-barba',
    name: 'Corte y Barba',
    durationMin: 60,
    price: 24000,
    description: 'Corte completo más perfilado de barba.',
    paymentLink: '',
    lastBookableStart: '18:00',
  },
  {
    id: 'corte-barba-vapor',
    name: 'Corte y Barba Vapor',
    durationMin: 90,
    price: 28000,
    description: 'Corte, barba y tratamiento con toalla de vapor.',
    paymentLink: '',
    lastBookableStart: '18:00',
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

function toMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function toTime(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** Primer día abierto desde `start` (según SCHEDULE.daysOpen). */
function firstOpenFrom(start) {
  const d = new Date(start);
  for (let k = 0; k < 14; k++) {
    if (SCHEDULE.daysOpen.includes(d.getDay())) return d;
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Slots dinámicos: desde el primer día abierto (mañana en adelante) hasta el
 * mismo día del mes siguiente, iterando SCHEDULE.blocks. Ventana de un mes
 * calendario anclada en la primera fecha disponible.
 */
function generateSlots() {
  const activeBarbers = barbers.filter((b) => b.active);
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() + 1); // desde mañana
  const firstOpen = firstOpenFrom(start);
  const end = new Date(firstOpen.getFullYear(), firstOpen.getMonth() + 1, firstOpen.getDate());
  const slots = [];

  for (const day = new Date(firstOpen); day <= end; day.setDate(day.getDate() + 1)) {
    const wd = day.getDay(); // 0=domingo … 6=sábado
    if (!SCHEDULE.daysOpen.includes(wd)) continue;

    const date = isoDate(day);
    for (const block of SCHEDULE.blocks) {
      for (let t = toMin(block.start); t < toMin(block.end); t += SCHEDULE.slotIntervalMin) {
        const time = toTime(t);
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
  await step(`insertar ${slots.length} slots (ventana de un mes desde la primera fecha)`, () =>
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
