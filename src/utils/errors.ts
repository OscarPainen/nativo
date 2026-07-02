import { FirebaseError } from 'firebase/app';

/**
 * Mensaje amigable para fallos de escritura. Nunca expone el error crudo de
 * Firebase. Distingue pérdida de conexión para guiar al usuario.
 */
export function writeErrorMessage(e: unknown): string {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  const networkCode =
    e instanceof FirebaseError &&
    (e.code === 'unavailable' || e.code === 'auth/network-request-failed');
  if (offline || networkCode) {
    return 'No se pudo completar la acción. Verifica tu conexión.';
  }
  return 'No se pudo completar la acción. Inténtalo de nuevo.';
}
