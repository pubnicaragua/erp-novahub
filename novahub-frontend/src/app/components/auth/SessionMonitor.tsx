import { useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { api } from '../../services/api';

const GRACE_SECONDS = 20;
// The backend starts the 20-second grace window when the second login is
// committed. Poll frequently enough that another machine sees that state
// almost immediately, while the server remains the source of truth.
const ACTIVE_CHECK_MS = 1_000;
const BACKGROUND_CHECK_MS = 15_000;

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
            const expires = Number(res.expires);
            const remainingSeconds = Number.isFinite(expires)
              ? Math.max(1, Math.ceil(expires))
              : GRACE_SECONDS;
            deadlineRef.current = Date.now() + remainingSeconds * 1000;
            setSeconds(remainingSeconds);
            setWarning(true);
          }
        } else {
          deadlineRef.current = 0;
          kickedRef.current = false;
          setWarning(false);
        }
      } catch {
        // Un 401 SESSION_CLOSED ya es manejado por api.ts (dispara 'session-closed').
      }
    };

    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        await check();
        if (!cancelled) schedule();
      }, document.visibilityState === 'hidden' ? BACKGROUND_CHECK_MS : ACTIVE_CHECK_MS);
    };

    check();
    schedule();
    const handleVisibilityChange = () => {
      schedule();
      if (document.visibilityState === 'visible') void check();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
