import { IconChevronLeft, IconChevronRight } from '@/components/ui/icons';

export const PAGE_SIZE = 20;

interface Props {
  page: number;
  pageCount: number;
  total: number;
  onPage: (n: number) => void;
  label?: string;
}

/** Controles de paginación estilo bandeja de correo. */
export default function Pagination({ page, pageCount, total, onPage, label = 'registros' }: Props) {
  if (total === 0) return null;
  const btn =
    'flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground disabled:opacity-30 hover:enabled:border-secondary';
  return (
    <div className="flex items-center justify-between text-sm text-muted">
      <span>
        {total} {label}
      </span>
      <div className="flex items-center gap-2">
        <button className={btn} disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Anterior">
          <IconChevronLeft />
        </button>
        <span>
          Página {page + 1} de {pageCount}
        </span>
        <button
          className={btn}
          disabled={page >= pageCount - 1}
          onClick={() => onPage(page + 1)}
          aria-label="Siguiente"
        >
          <IconChevronRight />
        </button>
      </div>
    </div>
  );
}
