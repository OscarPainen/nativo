import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { fetchUserProfile, login, logout, register } from '@/services/auth.service';
import type { AppUser } from '@/types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: AppUser | null;
  loading: boolean;
  /** True si una sesión de admin se invalidó/expiró. */
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  login: typeof login;
  register: typeof register;
  logout: typeof logout;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const wasAdminRef = useRef(false);

  useEffect(() => {
    // onIdTokenChanged cubre login/logout y además la invalidación/refresco
    // del token (sesión expirada), no solo el cambio de estado de auth.
    const unsub = onIdTokenChanged(auth, async (user) => {
      if (user) {
        const p = await fetchUserProfile(user.uid);
        setFirebaseUser(user);
        setProfile(p);
        if (p?.role === 'admin') {
          wasAdminRef.current = true;
          setSessionExpired(false);
        }
      } else {
        setFirebaseUser(null);
        setProfile(null);
        if (wasAdminRef.current) setSessionExpired(true);
        wasAdminRef.current = false;
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        loading,
        sessionExpired,
        clearSessionExpired: () => setSessionExpired(false),
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
