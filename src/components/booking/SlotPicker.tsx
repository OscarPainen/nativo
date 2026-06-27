import type { Slot } from '@/types';

interface SlotPickerProps {
  slots: Slot[];
  selectedId: string | null;
  onSelect: (slot: Slot) => void;
}

/** Lista de horas libres del día elegido. */
export default function SlotPicker({ slots, selectedId, onSelect }: SlotPickerProps) {
  if (slots.length === 0) {
    return <p className="text-sm text-muted">Selecciona un día para ver horarios.</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots
        .slice()
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((slot) => (
          <button
            key={slot.id}
            type="button"
            onClick={() => onSelect(slot)}
            aria-pressed={selectedId === slot.id}
            className={`rounded-md border px-3 py-2 text-sm transition ${
              selectedId === slot.id
                ? 'border-accent bg-accent/10 text-foreground'
                : 'border-border text-foreground hover:border-secondary'
            }`}
          >
            {slot.time}
          </button>
        ))}
    </div>
  );
}
