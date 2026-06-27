const KEY = 'clientProfile';
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 días

export interface ClientProfile {
  name: string;
  phone: string;
}

interface Stored extends ClientProfile {
  savedAt: number;
}

/** Lee el perfil del cliente si no ha expirado (90 días). */
export function loadClientProfile(): ClientProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Stored;
    if (Date.now() - data.savedAt > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return { name: data.name, phone: data.phone };
  } catch {
    return null;
  }
}

/** Persiste el perfil con sello de tiempo (cookie-like a 90 días). */
export function saveClientProfile(profile: ClientProfile): void {
  const data: Stored = { ...profile, savedAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(data));
}
