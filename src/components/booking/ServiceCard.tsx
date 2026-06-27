import type { Service } from '@/types';
import { formatCLP } from '@/utils/format';

interface ServiceCardProps {
  service: Service;
  selected: boolean;
  onSelect: (service: Service) => void;
}

export default function ServiceCard({ service, selected, onSelect }: ServiceCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(service)}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition ${
        selected
          ? 'border-accent ring-1 ring-accent'
          : 'border-border hover:border-secondary'
      }`}
    >
      <div className="pr-3">
        <p className="font-medium text-foreground">{service.name}</p>
        {service.description && (
          <p className="text-sm text-muted">{service.description}</p>
        )}
        <p className="text-sm text-muted">{service.durationMin} min</p>
      </div>
      <span className="shrink-0 font-semibold text-foreground">{formatCLP(service.price)}</span>
    </button>
  );
}
