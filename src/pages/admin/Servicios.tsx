import { useState } from 'react';
import { useServices } from '@/hooks/useServices';
import {
  createService,
  deleteService,
  updateService,
} from '@/services/services.service';
import { useToast } from '@/contexts/ToastContext';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatCLP } from '@/utils/format';
import { isValidMpLink } from '@/utils/validation';
import type { Service } from '@/types';

const field = 'mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent';

interface Form {
  name: string;
  durationMin: number;
  price: number;
  paymentLink: string;
  description: string;
}

const EMPTY: Form = { name: '', durationMin: 60, price: 0, paymentLink: '', description: '' };

function validate(f: Form): string | null {
  if (f.name.trim().length < 2) return 'El nombre es obligatorio.';
  if (!(f.price > 0)) return 'El precio debe ser mayor a 0.';
  if (f.durationMin < 15 || f.durationMin > 180) return 'La duración debe estar entre 15 y 180 minutos.';
  if (f.paymentLink && !isValidMpLink(f.paymentLink)) {
    return 'El link de pago debe ser un enlace https de MercadoPago.';
  }
  return null;
}

export default function Servicios() {
  const { services, loading, reload } = useServices(false);
  const { show } = useToast();

  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openCreate() {
    setForm(EMPTY);
    setError(null);
    setCreating(true);
  }

  function openEdit(s: Service) {
    setForm({
      name: s.name,
      durationMin: s.durationMin,
      price: s.price,
      paymentLink: s.paymentLink ?? '',
      description: s.description ?? '',
    });
    setError(null);
    setEditing(s);
  }

  function close() {
    setEditing(null);
    setCreating(false);
  }

  async function save() {
    const err = validate(form);
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    try {
      const data = {
        name: form.name.trim(),
        durationMin: form.durationMin,
        price: form.price,
        paymentLink: form.paymentLink.trim(),
        description: form.description.trim(),
      };
      if (editing) {
        await updateService(editing.id, data);
        show('Servicio actualizado.');
      } else {
        await createService({ ...data, active: true });
        show('Servicio creado.');
      }
      await reload();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(s: Service) {
    await updateService(s.id, { active: s.active === false });
    show(s.active === false ? 'Servicio activado.' : 'Servicio desactivado.');
    reload();
  }

  async function remove(s: Service) {
    if (!window.confirm(`¿Eliminar "${s.name}"?`)) return;
    try {
      await deleteService(s.id);
      show('Servicio eliminado.');
      reload();
    } catch (e) {
      show(e instanceof Error ? e.message : 'No se pudo eliminar.', 'error');
    }
  }

  const open = creating || !!editing;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Servicios y precios</h1>
        <Button onClick={openCreate}>+ Agregar servicio</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted">
                    {s.durationMin} min · {formatCLP(s.price)}
                  </p>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    s.active === false ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-800'
                  }`}
                >
                  {s.active === false ? 'Inactivo' : 'Activo'}
                </span>
              </div>
              {s.description && <p className="mt-2 text-sm text-muted">{s.description}</p>}
              {s.paymentLink && (
                <p className="mt-1 truncate text-xs text-muted">{s.paymentLink}</p>
              )}
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" onClick={() => openEdit(s)}>Editar</Button>
                <Button variant="ghost" onClick={() => toggleActive(s)}>
                  {s.active === false ? 'Activar' : 'Desactivar'}
                </Button>
                <Button variant="ghost" onClick={() => remove(s)}>Eliminar</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={close} title={editing ? 'Editar servicio' : 'Nuevo servicio'}>
        <div className="flex flex-col gap-3">
          <label className="text-sm text-muted">
            Nombre
            <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <div className="flex gap-3">
            <label className="flex-1 text-sm text-muted">
              Duración (min)
              <input type="number" className={field} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} />
            </label>
            <label className="flex-1 text-sm text-muted">
              Precio (CLP)
              <input type="number" className={field} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            </label>
          </div>
          <label className="text-sm text-muted">
            Link de pago MP
            <Input className="mt-1" value={form.paymentLink} onChange={(e) => setForm({ ...form, paymentLink: e.target.value })} placeholder="https://mpago.la/..." />
          </label>
          <label className="text-sm text-muted">
            Descripción
            <textarea className={field} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>Cancelar</Button>
            <Button onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
