import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Timestamp } from 'firebase/firestore';
import { useTheme } from '@/contexts/ThemeContext';
import { useServices } from '@/hooks/useServices';
import { useSlots } from '@/hooks/useSlots';
import { useCountdown } from '@/hooks/useCountdown';
import { ensureSession } from '@/services/session.service';
import { upsertClient } from '@/services/clients.service';
import {
  getRequiredSlots,
  lockSlotsForBooking,
  meetsLeadTime,
  releaseLocks,
  NotEnoughSpaceError,
  SlotNotAvailableError,
} from '@/services/slots.service';
import { confirmBooking, LockExpiredError } from '@/services/bookings.service';
import {
  loadClientProfile,
  saveClientProfile,
  type ClientProfile,
} from '@/utils/clientProfile';
import { compressImageToDataUrl } from '@/utils/image';
import { writeErrorMessage } from '@/utils/errors';
import { formatCLP, formatDateLabel } from '@/utils/format';
import Calendar from '@/components/booking/Calendar';
import ServiceCard from '@/components/booking/ServiceCard';
import SlotPicker from '@/components/booking/SlotPicker';
import PoliciesNotice from '@/components/booking/PoliciesNotice';
import ClientForm from '@/components/booking/ClientForm';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Checkbox from '@/components/ui/Checkbox';
import { IconClock } from '@/components/ui/icons';
import type { Service, Slot } from '@/types';

type Step = 'profile' | 'select' | 'payment' | 'done';

function ErrorMsg({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-foreground">
      {children}
    </p>
  );
}

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-lg font-medium">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-surface">
        {n}
      </span>
      {children}
    </h2>
  );
}

export default function Booking() {
  const navigate = useNavigate();
  const { tenant } = useTheme();
  const { services, loading: loadingServices } = useServices();
  const { byDate, loading: loadingSlots, reload } = useSlots();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const stored = loadClientProfile();
  const [profile, setProfile] = useState<ClientProfile | null>(stored);
  const [step, setStep] = useState<Step>(stored ? 'select' : 'profile');

  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [slotIds, setSlotIds] = useState<string[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<Timestamp | null>(null);

  const [comprobante, setComprobante] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [processingImg, setProcessingImg] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureSession()
      .then(setSessionId)
      .catch((e) => {
        const code = (e as { code?: string })?.code;
        if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
          setError(
            'Reservas no disponibles: falta habilitar el acceso anónimo en el servidor. Avisa a la barbería.',
          );
        } else {
          setError('No se pudo iniciar la sesión. Recarga la página.');
        }
      });
  }, []);

  const intervalMin = tenant?.schedule?.slotIntervalMin ?? 30;
  const daySlots = useMemo(() => (date ? byDate[date] ?? [] : []), [date, byDate]);

  /** Días con al menos una hora vigente (respeta la anticipación de 3 h para hoy). */
  const bookableDates = useMemo(
    () =>
      Object.keys(byDate)
        .filter((d) => (byDate[d] ?? []).some((s) => meetsLeadTime(d, s.time)))
        .sort(),
    [byDate],
  );

  /**
   * Solo horas de inicio con espacio suficiente para el servicio elegido y que
   * respeten la anticipación mínima (3 h el mismo día, hora oficial de Chile).
   */
  const validStarts = useMemo(() => {
    if (!service) return [];
    return daySlots.filter(
      (s) =>
        meetsLeadTime(s.date, s.time) &&
        getRequiredSlots(
          daySlots,
          s.id,
          service.durationMin,
          intervalMin,
          service.lastBookableStart,
        ) !== null,
    );
  }, [daySlots, service, intervalMin]);

  const paymentLink = service?.paymentLink || tenant?.paymentInfo?.paymentLink || '';
  const canContinue = Boolean(service && slot && accepted && !busy);

  function resetSelection() {
    setSlot(null);
    setSlotIds([]);
    setLockedUntil(null);
    setComprobante(null);
  }

  async function backToSelect(message?: string) {
    if (sessionId && slotIds.length) {
      try {
        await releaseLocks(slotIds, sessionId);
      } catch {
        /* noop */
      }
    }
    resetSelection();
    await reload();
    if (message) setError(message);
    setStep('select');
  }

  const { label: countdownLabel } = useCountdown(
    step === 'payment' ? lockedUntil : null,
    () => void backToSelect('Se acabó el tiempo (15 min). Elige tu hora nuevamente.'),
  );

  async function handleProfile(p: ClientProfile) {
    saveClientProfile(p);
    setProfile(p);
    if (sessionId) {
      try {
        await upsertClient({ sessionId, name: p.name, phone: p.phone });
      } catch {
        /* el registro del cliente no debe bloquear la reserva */
      }
    }
    setStep('select');
  }

  function selectDate(d: string) {
    setDate(d);
    setSlot(null);
  }

  async function continueToPayment() {
    if (!sessionId || !service || !slot) return;
    setBusy(true);
    setError(null);
    try {
      const { slotIds: ids, lockedUntil: until } = await lockSlotsForBooking({
        startSlotId: slot.id,
        durationMin: service.durationMin,
        intervalMin,
        lastBookableStart: service.lastBookableStart,
        sessionId,
      });
      setSlotIds(ids);
      setLockedUntil(until);
      setComprobante(null);
      setStep('payment');
    } catch (e) {
      if (e instanceof NotEnoughSpaceError || e instanceof SlotNotAvailableError) {
        setError(e.message);
        setSlot(null);
        await reload();
      } else {
        setError(writeErrorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessingImg(true);
    setError(null);
    try {
      setComprobante(await compressImageToDataUrl(file));
    } catch (err) {
      setComprobante(null);
      setError(err instanceof Error ? err.message : 'No se pudo procesar la imagen.');
    } finally {
      setProcessingImg(false);
    }
  }

  async function confirm() {
    if (!sessionId || !service || !slot || !profile || !comprobante || !slotIds.length) return;
    setBusy(true);
    setError(null);
    try {
      await confirmBooking({
        sessionId,
        slotIds,
        serviceId: service.id,
        clientName: profile.name,
        clientPhone: profile.phone,
        acceptedPolicies: accepted,
        comprobanteDataUrl: comprobante,
        lockedUntil,
      });
      setStep('done');
    } catch (e) {
      if (e instanceof LockExpiredError || e instanceof SlotNotAvailableError) {
        await backToSelect(e.message);
      } else {
        setError(writeErrorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  }

  // ---- Render ----

  if (step === 'done') {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
        <Card className="text-center">
          <h1 className="text-2xl font-semibold">Reserva en revisión</h1>
          <p className="mt-2 text-muted">
            {service?.name} · {date && formatDateLabel(date)} · {slot?.time}
          </p>
          <p className="mt-4 text-sm text-muted">
            Tu reserva está en revisión. Te contactaremos al{' '}
            <span className="font-medium text-foreground">{profile?.phone}</span> para
            confirmar.
          </p>
          <Button className="mt-6 w-full" onClick={() => navigate('/')}>
            Volver al inicio
          </Button>
        </Card>
      </main>
    );
  }

  if (step === 'profile') {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-6 py-10">
        <h1 className="text-2xl font-semibold">Reservar hora</h1>
        <Card>
          <h2 className="mb-1 text-lg font-medium">Tus datos</h2>
          <p className="mb-4 text-sm text-muted">
            Los guardamos en este dispositivo para tus próximas reservas.
          </p>
          <ClientForm initial={profile} onSubmit={handleProfile} />
        </Card>
      </main>
    );
  }

  if (step === 'select') {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Reservar hora</h1>
          <button
            type="button"
            onClick={() => setStep('profile')}
            className="text-sm text-muted underline-offset-4 hover:underline"
          >
            {profile?.name} · editar
          </button>
        </div>

        <Card>
          <SectionTitle n={1}>Elige tu servicio</SectionTitle>
          {loadingServices ? (
            <p className="text-sm text-muted">Cargando servicios…</p>
          ) : (
            <div className="flex flex-col gap-2">
              {services.map((s) => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  selected={service?.id === s.id}
                  onSelect={setService}
                />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle n={2}>Elige el día</SectionTitle>
          {loadingSlots ? (
            <p className="text-sm text-muted">Cargando disponibilidad…</p>
          ) : (
            <div className="flex justify-center">
              <Calendar dates={bookableDates} selected={date} onSelect={selectDate} />
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle n={3}>Elige la hora</SectionTitle>
          {!service ? (
            <p className="text-sm text-muted">Primero elige un servicio.</p>
          ) : (
            <SlotPicker slots={validStarts} selectedId={slot?.id ?? null} onSelect={setSlot} />
          )}
        </Card>

        <Card>
          <SectionTitle n={4}>Condiciones</SectionTitle>
          <PoliciesNotice defaultOpen />
          <div className="mt-3">
            <Checkbox
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              label="He leído y acepto las condiciones."
            />
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-3">
            <div className="text-sm text-muted">
              {service && slot ? (
                <span>
                  {service.name} · {date && formatDateLabel(date)} · {slot.time} ·{' '}
                  <span className="font-medium text-foreground">
                    {formatCLP(service.price)}
                  </span>
                </span>
              ) : (
                'Elige servicio, día y hora.'
              )}
            </div>
            <ErrorMsg>{error}</ErrorMsg>
            <div className="flex justify-end">
              <Button onClick={continueToPayment} disabled={!canContinue}>
                {busy ? 'Tomando la hora…' : 'Continuar al pago'}
              </Button>
            </div>
          </div>
        </Card>
      </main>
    );
  }

  // step === 'payment'
  if (!service || !slot) return null;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">Reservar hora</h1>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Pago y comprobante</h2>
          <span className="flex items-center gap-1 rounded bg-accent/15 px-2 py-1 text-sm font-medium text-foreground">
            <IconClock size={15} /> {countdownLabel}
          </span>
        </div>

        <div className="rounded-md border border-border p-3 text-sm">
          <p className="font-medium">{profile?.name}</p>
          <p className="text-muted">{profile?.phone}</p>
          <p className="mt-1">
            {service.name} · {date && formatDateLabel(date)} · {slot.time}
          </p>
          <p className="font-semibold">{formatCLP(service.price)}</p>
          {tenant?.paymentInfo?.mercadoPagoUser && (
            <p className="mt-1 text-muted">Paga a: {tenant.paymentInfo.mercadoPagoUser}</p>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {paymentLink ? (
            <a href={paymentLink} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" className="w-full">
                Ir a pagar en MercadoPago
              </Button>
            </a>
          ) : (
            <p className="text-sm text-foreground">
              No hay link de pago configurado. Contacta a la barbería.
            </p>
          )}
          <p className="text-sm text-muted">
            Una vez pagado, vuelve aquí y sube tu comprobante.
          </p>

          {!comprobante && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Comprobante (imagen)</span>
              <input
                key={fileKey}
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-2 file:text-surface"
              />
            </label>
          )}
          {processingImg && <p className="text-sm text-muted">Procesando imagen…</p>}
          {comprobante && (
            <div className="flex flex-col items-start gap-2">
              <img
                src={comprobante}
                alt="Comprobante"
                className="max-h-48 w-auto rounded border border-border object-contain"
              />
              <Button
                variant="ghost"
                onClick={() => {
                  setComprobante(null);
                  setFileKey((k) => k + 1);
                }}
              >
                Quitar imagen
              </Button>
            </div>
          )}

          <ErrorMsg>{error}</ErrorMsg>

          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => void backToSelect()} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={confirm} disabled={!comprobante || busy || processingImg}>
              {busy ? 'Confirmando…' : 'Confirmar reserva'}
            </Button>
          </div>
        </div>
      </Card>
    </main>
  );
}
