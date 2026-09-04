import { ShieldAlert, LogIn } from 'lucide-react';
import { Button } from '../ui/button';

interface SessionClosedPageProps {
  onLogout?: () => void;
  mode?: 'closed' | 'expired' | 'invalid';
}

export function SessionClosedPage({ onLogout, mode = 'closed' }: SessionClosedPageProps) {
  const isTakeover = mode === 'closed';
  const title = isTakeover ? 'Tu sesión se cerró' : 'Tu sesión ya no es válida';
  const subtitle = isTakeover
    ? 'Se inició sesión desde otro dispositivo.'
    : mode === 'expired'
      ? 'La sesión expiró por seguridad.'
      : 'Debes iniciar sesión nuevamente para continuar.';
  const description = isTakeover
    ? 'Tu sesión se cerró porque se inició sesión con tu cuenta desde otro dispositivo. Por seguridad, solo puede haber una sesión activa por usuario.'
    : 'El servidor rechazó la sesión actual. Esto no significa que hayas perdido tu rol de administrador; solo necesitas autenticarte de nuevo.';
  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-rose-600 via-orange-600 to-amber-600 p-8 text-white relative">
          <div className="flex items-start gap-4">
            <div className="size-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shrink-0">
              <ShieldAlert className="size-7" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-white/80 mb-1">Seguridad de la cuenta</p>
              <h2 className="text-3xl font-black tracking-tighter">{title}</h2>
              <p className="text-white/90 mt-2 text-sm">{subtitle}</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>

          <div className="mt-6">
            <Button
              size="lg"
              className="w-full h-12 rounded-xl font-bold uppercase tracking-widest gap-2"
              onClick={onLogout}
            >
              <LogIn className="size-4" /> Volver a iniciar sesión
            </Button>
          </div>

          <p className="text-[10px] text-center text-muted-foreground pt-4">
            {isTakeover ? 'Si fuiste tú, simplemente inicia sesión de nuevo en este dispositivo.' : 'Vuelve a iniciar sesión para continuar trabajando.'}
          </p>
        </div>
      </div>
    </div>
  );
}
