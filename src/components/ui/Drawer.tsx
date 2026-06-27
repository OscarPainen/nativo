import type { ReactNode } from 'react';
import { IconX } from '@/components/ui/icons';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function Drawer({ open, onClose, title, children }: DrawerProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-foreground/40" onClick={onClose}>
      <div
        className="absolute right-0 top-0 h-full w-full max-w-md overflow-auto border-l border-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <IconX />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
