import type { Timestamp } from 'firebase/firestore';

export type Role = 'client' | 'admin';

export type SlotStatus = 'free' | 'locked' | 'pending' | 'booked' | 'blocked';

export type BookingStatus =
  | 'pending_approval'
  | 'confirmed'
  | 'rejected'
  | 'cancelled';

/** Tema visual del tenant. Colores en HEX (#rrggbb); se convierten a canales RGB al aplicar. */
export interface TenantTheme {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
  font: string;
  /** Radio base, p.ej. "0.5rem". */
  radius: string;
}

export interface PaymentInfo {
  /** Nombre visible de la cuenta MercadoPago (ej: "Nativo Barbería"). */
  mercadoPagoUser: string;
  /** Link de pago MP genérico (fallback si un servicio no tiene el suyo). */
  paymentLink: string;
}

/** Bloque horario continuo (el almuerzo es el hueco entre dos bloques). */
export interface ScheduleBlock {
  id: string;
  /** "HH:mm" inicio del bloque. */
  start: string;
  /** "HH:mm" fin del bloque (exclusivo). */
  end: string;
}

export interface Schedule {
  blocks: ScheduleBlock[];
  /** Tamaño de cada slot en minutos (la grilla base). */
  slotIntervalMin: number;
  /** Días abiertos: 0=domingo … 6=sábado. */
  daysOpen: number[];
}

export interface Tenant {
  id: string;
  name: string;
  logoUrl: string;
  theme: TenantTheme;
  /** Políticas/condiciones que el cliente debe aceptar antes de reservar. */
  policies: string[];
  paymentInfo: PaymentInfo;
  /** Texto libre de info de pago visible al cliente (ej: "Transferir a..."). */
  paymentNote?: string;
  /** Horario de atención informativo (no afecta slots). */
  scheduleNote?: string;
  /** Configuración de horarios para generar slots (bloques + almuerzo + días). */
  schedule?: Schedule;
  /** URL del webhook de Apps Script de esta barbería (Google Calendar). */
  calendarWebhookUrl?: string;
  /** ID de calendario específico a usar (opcional; si no, el principal). */
  googleCalendarId?: string | null;
}

export interface Service {
  id: string;
  name: string;
  durationMin: number;
  price: number;
  description?: string;
  /** Link de pago MP específico de este servicio. */
  paymentLink?: string;
  /** Inactivo = no aparece en el flujo de reserva del cliente. */
  active?: boolean;
  /** Tope adicional de hora de inicio para este servicio (ej "18:00"). */
  lastBookableStart?: string | null;
}

export interface Barber {
  id: string;
  name: string;
  active: boolean;
}

export interface Slot {
  id: string;
  /** ISO date "YYYY-MM-DD". */
  date: string;
  /** "HH:mm" 24h. */
  time: string;
  status: SlotStatus;
  barberId: string;
  /** sessionId (uid anónimo) que mantiene el lock; null si libre/bloqueado. */
  lockedBy?: string | null;
  /** Inicio del lock. */
  lockedAt?: Timestamp | null;
  /** Expiración del lock de 15 min (cola de reservas). */
  lockedUntil?: Timestamp | null;
}

export interface Booking {
  id: string;
  clientName: string;
  clientPhone: string;
  /** uid anónimo del cliente (Firebase Anonymous Auth). */
  sessionId: string;
  /** Slots ocupados por la reserva (1+ según la duración del servicio). */
  slotIds: string[];
  serviceId: string;
  status: BookingStatus;
  /** Si el comprobante quedó guardado en comprobantes/{bookingId}. */
  hasComprobante: boolean;
  acceptedPolicies: boolean;
  createdAt: Timestamp;
  /** createdAt + 15 min (referencia del lock al confirmar). */
  lockedUntil: Timestamp | null;
  /** Motivo de rechazo (si el admin rechaza). */
  rejectionReason?: string;
  /** ID del evento en Google Calendar (si se sincronizó). */
  calendarEventId?: string | null;
  /** True si la última sincronización con Calendar falló. */
  calendarSyncFailed?: boolean;
}

/** Cliente anónimo recurrente (para que el admin vea historial por teléfono). */
export interface Client {
  id: string;
  sessionId: string;
  name: string;
  phone: string;
  lastSeen: Timestamp;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string;
}
