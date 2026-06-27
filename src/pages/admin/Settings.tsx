import { useEffect, useState, type ChangeEvent } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { updateTenant } from '@/services/tenant.service';
import { applyTheme } from '@/config/theme';
import { compressImageToDataUrl } from '@/utils/image';
import { isValidMpLink } from '@/utils/validation';
import { useToast } from '@/contexts/ToastContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { TenantTheme } from '@/types';

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

      <div>
        <Button onClick={save} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}
