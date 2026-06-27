import { useState, type FormEvent } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { ClientProfile } from '@/utils/clientProfile';
import { formatChileanPhone, isValidChileanPhone } from '@/utils/phone';
import { isValidName, sanitizeText } from '@/utils/validation';

interface ClientFormProps {
  initial: ClientProfile | null;
  submitLabel?: string;
  onSubmit: (profile: ClientProfile) => void;
}

/** Datos del cliente anónimo: nombre + teléfono chileno validado. */
export default function ClientForm({
  initial,
  submitLabel = 'Continuar',
  onSubmit,
}: ClientFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValidName(name)) {
      setError('Ingresa tu nombre (solo letras, entre 3 y 80 caracteres).');
      return;
    }
    if (!isValidChileanPhone(phone)) {
      setError('Teléfono inválido. Usa formato +56 9 XXXX XXXX.');
      return;
    }
    onSubmit({ name: sanitizeText(name, 80), phone: formatChileanPhone(phone) });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        placeholder="Nombre completo"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
      />
      <Input
        placeholder="+56 9 1234 5678"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        inputMode="tel"
        autoComplete="tel"
      />
      {error && <p className="text-sm text-foreground">{error}</p>}
      <Button type="submit" className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
