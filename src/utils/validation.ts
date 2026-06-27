/** Validaciones y saneamiento de inputs (defensa contra datos basura/XSS). */

/** Nombre: solo letras (incl. acentos/ñ), espacios y . ' - ; 3 a 80 caracteres. */
const NAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ .'-]{1,78}[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.]$/;

export function isValidName(name: string): boolean {
  const v = name.trim();
  return v.length >= 3 && v.length <= 80 && NAME_RE.test(v);
}

/** Colapsa espacios y recorta. React ya escapa al renderizar (sin sink XSS). */
export function sanitizeText(value: string, maxLen = 500): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

/** Link de pago MercadoPago válido (dominios oficiales, https). */
export function isValidMpLink(url: string): boolean {
  const v = url.trim();
  if (!v) return false;
  try {
    const u = new URL(v);
    return (
      u.protocol === 'https:' &&
      (u.hostname === 'mpago.la' ||
        u.hostname === 'www.mercadopago.cl' ||
        u.hostname === 'mercadopago.cl' ||
        u.hostname.endsWith('.mercadopago.com'))
    );
  } catch {
    return false;
  }
}
