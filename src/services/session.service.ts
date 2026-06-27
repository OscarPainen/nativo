import { signInAnonymously } from 'firebase/auth';
import { auth } from '@/config/firebase';

/**
 * Garantiza una sesión (anónima si no hay ninguna) y devuelve el uid,
 * que usamos como sessionId del cliente. Si ya hay un admin logueado,
 * reutiliza su sesión.
 */
export async function ensureSession(): Promise<string> {
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}
