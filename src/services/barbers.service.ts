import { getDocs } from 'firebase/firestore';
import { barbersCol } from './paths';
import type { Barber } from '@/types';

export async function fetchBarbers(): Promise<Barber[]> {
  const snap = await getDocs(barbersCol());
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Barber, 'id'>) }));
}
