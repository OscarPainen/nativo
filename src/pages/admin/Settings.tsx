import { useEffect, useState, type ChangeEvent } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { updateTenant } from '@/services/tenant.service';
import { pingWebhook } from '@/services/calendar.service';
import { applyTheme } from '@/config/theme';
import { compressImageToDataUrl } from '@/utils/image';
import { isValidMpLink } from '@/utils/validation';
import { useToast } from '@/contexts/ToastContext';
import { DEFAULT_SCHEDULE } from '@/services/tenant.service';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { Schedule, TenantTheme } from '@/types';

const DAYS = [
  { n: 1, label: 'Lun' },
  { n: 2, label: 'Mar' },
  { n: 3, label: 'Mié' },
  { n: 4, label: 'Jue' },
  { n: 5, label: 'Vie' },
  { n: 6, label: 'Sáb' },
  { n: 0, label: 'Dom' },
];

const fieldCls = 'mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent';

export default function Settings() {
  const { tenant, reload } = useTheme();
  const { show } = useToast();

  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primary, setPrimary] = useState('#111827');
  const [accent, setAccent] = useState('#ca8a04');
  const [mpUser, setMpUser] = useState('');
  const [mpLink, setMpLink] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [scheduleNote, setScheduleNote] = useState('');
  const [policies, setPolicies] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT_SCHEDULE);
  const [calendarUrl, setCalendarUrl] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [pingMsg, setPingMsg] = useState<string | null>(null);
  const [pinging, setPinging] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setName(tenant.name);
    setLogoUrl(tenant.logoUrl ?? '');
    setPrimary(tenant.theme.primary);
    setAccent(tenant.theme.accent);
    setMpUser(tenant.paymentInfo?.mercadoPagoUser ?? '');
    setMpLink(tenant.paymentInfo?.paymentLink ?? '');
    setPaymentNote(tenant.paymentNote ?? '');
    setScheduleNote(tenant.scheduleNote ?? '');
    setPolicies(tenant.policies ?? []);
    setSchedule(tenant.schedule ?? DEFAULT_SCHEDULE);
    setCalendarUrl(tenant.calendarWebhookUrl ?? '');
    setCalendarId(tenant.googleCalendarId ?? '');
  }, [tenant]);

  /** Preview en vivo de colores. */
  function previewColors(p: string, a: string) {
    if (!tenant) return;
    applyTheme({ ...tenant.theme, primary: p, accent: a });
  }

  async function onLogoFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLogoUrl(await compressImageToDataUrl(file));
    } catch (err) {
      show(err instanceof Error ? err.message : 'No se pudo procesar el logo.', 'error');
    }
  }

  async function save() {
    if (!tenant) return;
    if (mpLink.trim() && !isValidMpLink(mpLink)) {
      show('El link de pago debe ser un enlace https de MercadoPago.', 'error');
      return;
    }
    setBusy(true);
    try {
      const theme: TenantTheme = { ...tenant.theme, primary, accent };
      await updateTenant({
        name: name.trim(),
        logoUrl: logoUrl.trim(),
        theme,
        paymentInfo: { mercadoPagoUser: mpUser.trim(), paymentLink: mpLink.trim() },
        paymentNote: paymentNote.trim(),
        scheduleNote: scheduleNote.trim(),
        policies: policies.map((p) => p.trim()).filter(Boolean),
        schedule,
        calendarWebhookUrl: calendarUrl.trim(),
        googleCalendarId: calendarId.trim() || null,
      });
      await reload();
      show('Cambios guardados.');
    } catch {
      show('No se pudo guardar.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Configuración</h1>

      <Card>
        <h2 className="mb-3 text-lg font-medium">Negocio</h2>
        <label className="text-sm text-muted">
          Nombre
          <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="mt-3 flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="h-14 w-14 rounded border border-border object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded bg-primary text-xl font-bold text-surface">
              {name.charAt(0) || 'B'}
            </div>
          )}
          <label className="text-sm text-muted">
            Logo (imagen o URL)
            <input type="file" accept="image/*" onChange={onLogoFile} className="mt-1 block text-sm" />
          </label>
        </div>
        <Input
          className="mt-2"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://… o se llena al subir imagen"
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-medium">Colores (vista previa en vivo)</h2>
        <div className="flex gap-6">
          <label className="text-sm text-muted">
            Primario
            <input
              type="color"
              className="mt-1 block h-10 w-16"
              value={primary}
              onChange={(e) => { setPrimary(e.target.value); previewColors(e.target.value, accent); }}
            />
          </label>
          <label className="text-sm text-muted">
            Acento
            <input
              type="color"
              className="mt-1 block h-10 w-16"
              value={accent}
              onChange={(e) => { setAccent(e.target.value); previewColors(primary, e.target.value); }}
            />
          </label>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-medium">Pagos</h2>
        <label className="text-sm text-muted">
          Cuenta MercadoPago (visible)
          <Input className="mt-1" value={mpUser} onChange={(e) => setMpUser(e.target.value)} />
        </label>
        <label className="mt-3 block text-sm text-muted">
          Link de pago genérico (fallback)
          <Input className="mt-1" value={mpLink} onChange={(e) => setMpLink(e.target.value)} placeholder="https://mpago.la/..." />
        </label>
        <label className="mt-3 block text-sm text-muted">
          Info de pago para el cliente
          <textarea className={fieldCls} rows={2} value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Ej: Transferir a..." />
        </label>
        <label className="mt-3 block text-sm text-muted">
          Horario de atención (informativo)
          <Input className="mt-1" value={scheduleNote} onChange={(e) => setScheduleNote(e.target.value)} placeholder="Lun-Vie 10–20, Sáb 9–13" />
        </label>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Horarios</h2>
          <Button
            variant="ghost"
            onClick={() =>
              setSchedule((s) => ({
                ...s,
                blocks: [...s.blocks, { id: `b${Date.now()}`, start: '10:00', end: '14:00' }],
              }))
            }
          >
            + Bloque
          </Button>
        </div>
        <p className="mb-3 text-sm text-muted">
          El almuerzo es el hueco entre el fin de un bloque y el inicio del siguiente.
        </p>
        <div className="flex flex-col gap-2">
          {schedule.blocks.map((b, i) => (
            <div key={b.id} className="flex items-center gap-2">
              <input
                type="time"
                className={fieldCls}
                value={b.start}
                onChange={(e) =>
                  setSchedule((s) => ({
                    ...s,
                    blocks: s.blocks.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)),
                  }))
                }
              />
              <span className="text-muted">a</span>
              <input
                type="time"
                className={fieldCls}
                value={b.end}
                onChange={(e) =>
                  setSchedule((s) => ({
                    ...s,
                    blocks: s.blocks.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)),
                  }))
                }
              />
              <Button
                variant="ghost"
                onClick={() =>
                  setSchedule((s) => ({ ...s, blocks: s.blocks.filter((_, j) => j !== i) }))
                }
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
        <label className="mt-3 block text-sm text-muted">
          Intervalo de la grilla (min)
          <input
            type="number"
            min={15}
            step={15}
            className={`${fieldCls} w-28`}
            value={schedule.slotIntervalMin}
            onChange={(e) =>
              setSchedule((s) => ({ ...s, slotIntervalMin: Number(e.target.value) }))
            }
          />
        </label>
        <div className="mt-3">
          <p className="text-sm text-muted">Días abiertos</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {DAYS.map((d) => {
              const on = schedule.daysOpen.includes(d.n);
              return (
                <button
                  key={d.n}
                  type="button"
                  onClick={() =>
                    setSchedule((s) => ({
                      ...s,
                      daysOpen: on
                        ? s.daysOpen.filter((x) => x !== d.n)
                        : [...s.daysOpen, d.n],
                    }))
                  }
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    on ? 'border-accent bg-accent/10 text-foreground' : 'border-border text-muted'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Nota: los cambios de horario aplican a los slots que generes luego (seed o Agenda);
          no reescriben los slots ya creados.
        </p>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Políticas</h2>
          <Button variant="ghost" onClick={() => setPolicies([...policies, ''])}>
            + Agregar
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {policies.map((p, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={p}
                onChange={(e) => setPolicies(policies.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <Button variant="ghost" onClick={() => setPolicies(policies.filter((_, j) => j !== i))}>
                ✕
              </Button>
            </div>
          ))}
          {policies.length === 0 && <p className="text-sm text-muted">Sin políticas.</p>}
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-medium">Integración Google Calendar</h2>
        <p className="mb-3 text-sm text-muted">
          Al confirmar/cancelar/reprogramar una reserva se crea o borra el evento en tu
          Google Calendar mediante un webhook de Apps Script. Ver instrucciones en
          <span className="font-mono"> apps-script/apps_script_calendar.js</span>.
        </p>
        <label className="block text-sm text-muted">
          URL del webhook (Apps Script)
          <Input
            className="mt-1"
            value={calendarUrl}
            onChange={(e) => setCalendarUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
          />
        </label>
        <label className="mt-3 block text-sm text-muted">
          ID de calendario específico (opcional)
          <Input
            className="mt-1"
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
            placeholder="...@group.calendar.google.com"
          />
        </label>
        <div className="mt-3 flex items-center gap-3">
          <Button
            variant="secondary"
            disabled={pinging || !calendarUrl.trim()}
            onClick={async () => {
              setPinging(true);
              setPingMsg(null);
              const ok = await pingWebhook(calendarUrl.trim());
              setPingMsg(ok ? 'Conectado correctamente.' : 'No se pudo conectar.');
              setPinging(false);
            }}
          >
            {pinging ? 'Probando…' : 'Probar conexión'}
          </Button>
          {pingMsg && <span className="text-sm text-muted">{pingMsg}</span>}
        </div>
      </Card>

      <div>
        <Button onClick={save} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}
