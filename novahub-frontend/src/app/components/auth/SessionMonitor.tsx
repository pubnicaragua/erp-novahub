import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { api } from '../../services/api';

interface SessionWarning {
  ip: string | null;
  expiresIn: number;
}

export function SessionMonitor() {
  const [warning, setWarning] = useState<SessionWarning | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = (await api.get('/auth/session-status')) as any;
        if (cancelled) return;
        if (res && res.valid === false && res.warning) {
          setWarning({ ip: res.ip ?? null, expiresIn: res.expiresIn ?? 20 });
        } else {
          setWarning(null);
        }
      } catch {
        // 401 SESSION_CLOSED es manejado por api.ts (dispara 'session-closed').
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!warning) {
      setSeconds(0);
      return;
    }
    setSeconds(warning.expiresIn);
    const interval = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(interval);
  }, [warning]);

  if (!warning) return null;

  const ipText = warning.ip || 'una IP desconocida';

  return (
    <div className="fixed top-0 left-0 right-0 z-[120] bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-center gap-3 text-sm font-semibold">
        <ShieldAlert className="size-5 shrink-0 animate-pulse" />
        <span className="text-center">
          Alguien más inició sesión en tu cuenta desde la IP <span className="font-black tracking-wide">{ipText}</span>. Tu sesión se cerrará en {seconds}s.
        </span>
      </div>
    </div>
  );
}
