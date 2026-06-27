import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, TENANT_ID } from '@/config/firebase';
import type { AppUser, Role } from '@/types';

function userRef(uid: string) {
  return doc(db, 'tenants', TENANT_ID, 'users', uid);
}

/** Lee el perfil (incluido el rol) del usuario dentro del tenant actual. */
export async function fetchUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<AppUser, 'id'>) };
}

export async function login(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function register(params: {
  email: string;
  password: string;
  name: string;
  phone: string;
  role?: Role;
}): Promise<User> {
  const { email, password, name, phone, role = 'client' } = params;
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const profile: Omit<AppUser, 'id'> = { name, email, phone, role };
  await setDoc(userRef(cred.user.uid), profile);
  return cred.user;
}

export function logout(): Promise<void> {
  return fbSignOut(auth);
}
