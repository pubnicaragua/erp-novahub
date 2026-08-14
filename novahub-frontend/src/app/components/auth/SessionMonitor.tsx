import { useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { api } from '../../services/api';

const GRACE_SECONDS = 20;

export function SessionMonitor() {
  const [warning, setWarning] = useState(false);
  const [seconds, setSeconds] = useState(GRACE_SECONDS);
  const deadlineRef = useRef(0);
  const kickedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = (await api.get('/auth/session-status')) as any;
        if (cancelled) return;
        if (res && res.valid === false && res.warning) {
          if (!deadlineRef.current) {
            deadlineRef.current = Date.now() + GRACE_SECONDS * 1000;
            setWarning(true);
          }
        } else {
          deadlineRef.current = 0;
          setWarning(false);
        }
      } catch {
        // Un 401 SESSION_CLOSED ya es manejado por api.ts (dispara 'session-closed').
      }
    };

    check();
    const poll = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (!warning) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining <= 0 && !kickedRef.current) {
        kickedRef.current = true;
        localStorage.removeItem('nh-auth-token');
        window.dispatchEvent(new CustomEvent('session-closed', { detail: { code: 'SESSION_CLOSED' } }));
      }
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [warning]);

  if (!warning) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[120] bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-center gap-3 text-sm font-semibold">
        <ShieldAlert className="size-5 shrink-0 animate-pulse" />
        <span className="text-center">
          Alguien más inició sesión en tu cuenta. Tu sesión se cerrará en {seconds}s.
        </span>
      </div>
    </div>
  );
}
