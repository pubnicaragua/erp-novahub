import { Clock, Sparkles, CheckCircle2, X, ArrowUpRight } from 'lucide-react';
import { Button } from '../ui/button';

interface TrialExpiredPageProps {
  onClose?: () => void;
  onLogout?: () => void;
}

export function TrialExpiredPage({ onClose, onLogout }: TrialExpiredPageProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
        {/* Header con gradiente */}
        <div className="bg-gradient-to-br from-rose-600 via-orange-600 to-amber-600 p-8 text-white relative">
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="absolute top-4 right-4 text-white hover:bg-white/20 hover:text-white size-8"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </Button>
          )}
          <div className="flex items-start gap-4">
            <div className="size-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shrink-0">
              <Clock className="size-7" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-white/80 mb-1">Período de prueba finalizado</p>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tighter">
                Tu prueba de 3 días terminó
              </h2>
              <p className="text-white/90 mt-2 text-sm sm:text-base">
                Tus datos están intactos. Elegí un plan para seguir usando NovaHub.
              </p>
            </div>
          </div>
        </div>

        {/* Body con beneficios */}
        <div className="p-8 space-y-6">
          <div>
            <p className="text-xs uppercase font-black tracking-widest text-muted-foreground mb-3">
              Qué incluye el plan Professional
            </p>
            <ul className="space-y-2.5">
              {[
                'Todos los módulos: Ventas, Compras, Inventario, Finanzas, RR.HH.',
                'Usuarios ilimitados',
                'Reportes avanzados y exportación',
                'Soporte prioritario por email y chat',
                'Personalización con tu marca (white-label)',
                'Backups automáticos diarios',
              ].map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-muted/30 border border-border/50 rounded-2xl p-4 flex items-start gap-3">
            <Sparkles className="size-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold">¿Tenés un código promocional?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Contactanos por WhatsApp y te activamos un descuento especial para tu empresa.
              </p>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              size="lg"
              className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest gap-2 shadow-lg shadow-emerald-900/30"
              onClick={() => window.open('https://wa.me/0000?text=Hola%20termin%C3%A9%20mi%20trial%20de%20NovaHub%20y%20quiero%20contratar', '_blank')}
            >
              Contratar plan
              <ArrowUpRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1 h-12 rounded-xl font-bold uppercase tracking-widest"
              onClick={onLogout}
            >
              Cerrar sesión
            </Button>
          </div>

          <p className="text-[10px] text-center text-muted-foreground pt-2">
            ¿Querés extender tu prueba? Escribinos a <a href="mailto:soporte@novahub.com" className="text-primary hover:underline">soporte@novahub.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default TrialExpiredPage;
