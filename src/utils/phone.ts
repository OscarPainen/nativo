/**
 * Teléfono chileno. Acepta entradas con o sin +56 y espacios,
 * normaliza a "+56 9 XXXX XXXX". Valida móvil de 9 dígitos que parte en 9.
 */

/** Deja solo los 9 dígitos nacionales (sin 56), o null si no es válido. */
function nationalDigits(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const local = digits.startsWith('56') ? digits.slice(2) : digits;
  if (local.length === 9 && local.startsWith('9')) return local;
  return null;
}

export function isValidChileanPhone(input: string): boolean {
  return nationalDigits(input) !== null;
}

/** "+56 9 1234 5678" o el original si aún no es válido. */
export function formatChileanPhone(input: string): string {
  const local = nationalDigits(input);
  if (!local) return input;
  return `+56 ${local[0]} ${local.slice(1, 5)} ${local.slice(5)}`;
}

/** Sólo dígitos con prefijo país, para enlaces wa.me/tel. */
export function phoneToE164(input: string): string | null {
  const local = nationalDigits(input);
  return local ? `56${local}` : null;
}
