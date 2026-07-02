import { useEffect, useState } from 'react';

/**
 * Banner global de estado de conexión. Se monta fuera del router.
 * No bloquea la interacción (pointer-events-none).
 */
export default function ConnectionStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    function goOnline() {
      setOnline(true);
      setRestored(true);
      window.setTimeout(() => setRestored(false), 3000);
    }
    function goOffline() {
      setOnline(false);
      setRestored(false);
    }
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online && !restored) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center p-2">
      <div
        className={`rounded-md px-4 py-2 text-sm shadow-md ${
          online
            ? 'bg-green-100 text-green-800'
            : 'bg-amber-100 text-amber-900'
        }`}
        role="status"
      >
        {online ? 'Conexión restablecida' : 'Sin conexión. Reintentando…'}
      </div>
    </div>
  );
}
