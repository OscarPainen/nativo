import { useEffect, useState } from 'react';
import type { Timestamp } from 'firebase/firestore';

/** Segundos restantes hasta `until`; dispara `onExpire` una vez al llegar a 0. */
export function useCountdown(until: Timestamp | null, onExpire?: () => void) {
  const target = until?.toMillis?.() ?? 0;
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.round((target - Date.now()) / 1000)),
  );

  useEffect(() => {
    if (!target) return;
    let fired = false;
    const tick = () => {
      const secs = Math.max(0, Math.round((target - Date.now()) / 1000));
      setRemaining(secs);
      if (secs === 0 && !fired) {
        fired = true;
        onExpire?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // onExpire intencionalmente fuera de deps para no reiniciar el timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  return { remaining, label: `${mm}:${ss}` };
}
