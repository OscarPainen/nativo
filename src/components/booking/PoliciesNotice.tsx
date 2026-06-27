import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface PoliciesNoticeProps {
  /** Si true, arranca expandido (p.ej. en el perfil). */
  defaultOpen?: boolean;
}

/** Sección colapsable con las condiciones del tenant. */
export default function PoliciesNotice({ defaultOpen = false }: PoliciesNoticeProps) {
  const { tenant } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const policies = tenant?.policies ?? [];

  if (policies.length === 0) return null;

  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
      >
        Condiciones de la reserva
        <span className="text-muted">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <ul className="list-disc space-y-1 border-t border-border px-8 py-3 text-sm text-muted">
          {policies.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
