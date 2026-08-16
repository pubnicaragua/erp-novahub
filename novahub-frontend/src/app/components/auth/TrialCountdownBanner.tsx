import { useEffect, useState } from 'react';
import { Clock, X, Sparkles, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { safeSetItem } from '../../services/safe-storage';

const DISMISS_KEY = 'trial-banner-dismissed';

function getTimeRemaining(expiresAt: string | Date | null | undefined): {
  days: number;
  hours: number;
  minutes: number;
  totalMs: number;
} {
  if (!expiresAt) return { days: 0, hours: 0, minutes: 0, totalMs: 0 };
  const exp = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt.getTime();
  const now = Date.now();
  const diff = Math.max(0, exp - now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes, totalMs: diff };
}

export function TrialCountdownBanner() {
  const { user } = useAuth();
  const [, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // Re-renderiza el componente cada 60s para que getTimeRemaining recalcule
    // días/horas contra Date.now(). El estado `now` no se lee porque
    // getTimeRemaining() ya toma Date.now() internamente.
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const expiresAt = (user as any)?.clientTenant?.expiresAt;
  if (!expiresAt) return null;

  const { days, hours, totalMs } = getTimeRemaining(expiresAt);
  // Si ya expiró, el guard del backend se encarga — no mostramos banner
  if (totalMs <= 0) return null;
  // Si quedan más de 15 días, no mostrar (probablemente no es trial)
  if (days > 15) return null;
  // Si fue descartado
  if (dismissed) return null;

  const isUrgent = days <= 3;
  const isWarning = days <= 7 && days > 3;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      safeSetItem(DISMISS_KEY, 'true');
    } catch { /* intentionally empty */ }
  };

  return (
    <div
      className={cn(
        'w-full px-4 py-2 flex items-center justify-between gap-3 rounded-2xl shadow-sm',
        'bg-gradient-to-r text-white',
        isUrgent
          ? 'from-amber-600 via-orange-600 to-rose-600'
          : isWarning
          ? 'from-amber-500 via-yellow-500 to-orange-500'
          : 'from-emerald-600 via-teal-500 to-cyan-500',
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="size-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
          {isUrgent ? <Clock className="size-4" /> : <Sparkles className="size-4" />}
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-bold truncate">
            {days > 0
              ? `Te quedan ${days} ${days === 1 ? 'día' : 'días'}${hours > 0 ? ` y ${hours} ${hours === 1 ? 'hora' : 'horas'}` : ''} de Demo gratis`
              : `Te quedan ${hours} ${hours === 1 ? 'hora' : 'horas'} de Demo gratis`}
          </p>
          <p className="text-[10px] text-white/80 truncate hidden sm:block">
            {isUrgent
              ? '⚠️ Tu Demo vence pronto. Actualizá tu plan para no perder tus datos.'
              : isWarning
              ? `🗓️ Te quedan ${days} días. Recordá actualizar antes de que venza tu plan.`
              : `✅ Estás en período de Demo por ${days} días más. Disfrutá de todas las funciones.`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/20 hover:text-white gap-1"
          onClick={() => window.open('https://wa.me/50588241003?text=Hola%20quiero%20contratar%20NovaHub', '_blank')}
        >
          Actualizar plan
          <ArrowUpRight className="size-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7 text-white hover:bg-white/20 hover:text-white"
          onClick={handleDismiss}
          aria-label="Descartar banner"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default TrialCountdownBanner;