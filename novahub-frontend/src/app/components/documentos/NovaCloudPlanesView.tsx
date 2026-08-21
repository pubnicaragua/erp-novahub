import { Card, CardContent, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Cloud, Check, HardDrive, Zap, Shield, Share2 } from 'lucide-react';
import { motion } from 'motion/react';

const plans = [
  {
    name: 'Básico',
    price: 1.99,
    storage: '5 GB',
    period: '/mes',
    features: [
      '5 GB de almacenamiento',
      'Subida de archivos hasta 10 MB',
      'Compartir enlaces',
      'Cifrado básico',
    ],
    popular: false,
    gradient: 'from-slate-500 to-slate-600',
    icon: Cloud,
  },
  {
    name: 'Profesional',
    price: 7.99,
    storage: '18 GB',
    period: '/mes',
    features: [
      '18 GB de almacenamiento',
      'Subida de archivos hasta 100 MB',
      'Compartir enlaces con contraseña',
      'Cifrado avanzado',
      'Historial de versiones 30 días',
      'Soporte prioritario',
    ],
    popular: true,
    gradient: 'from-cyan-500 to-blue-600',
    icon: HardDrive,
  },
  {
    name: 'Empresarial',
    price: 15.00,
    storage: '40 GB',
    period: '/mes',
    features: [
      '40 GB de almacenamiento',
      'Subida de archivos hasta 500 MB',
      'Compartir enlaces con control de acceso',
      'Cifrado de extremo a extremo',
      'Historial de versiones ilimitado',
      'Soporte 24/7 dedicado',
      'API de integración',
      'Auditoría de acceso',
    ],
    popular: false,
    gradient: 'from-purple-500 to-violet-600',
    icon: Zap,
  },
];

const benefits = [
  { icon: Shield, label: 'Cifrado AES-256', desc: 'Tus archivos seguros en reposo y tránsito' },
  { icon: Share2, label: 'Enlaces compartibles', desc: 'Compartí archivos con tu equipo al instante' },
  { icon: Zap, label: 'Sincronización automática', desc: 'Tus cambios se guardan en tiempo real' },
];

export const NovaCloudPlanesView = () => {
  const currentPlan = 'Básico';

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="text-center space-y-4 py-6">
          <div className="inline-flex p-4 bg-cyan-500/10 rounded-3xl">
            <Cloud className="size-12 text-cyan-500" />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tight">
            Almacenamiento en la Nube
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan, i) => {
            const PlanIcon = plan.icon;
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className={`relative overflow-hidden rounded-3xl border-border/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${plan.popular ? 'ring-2 ring-cyan-500 shadow-lg shadow-cyan-500/10' : 'bg-card shadow-sm'}`}>
                  {plan.popular && (
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] text-center py-1.5">
                      Más Popular
                    </div>
                  )}
                  <CardContent className={`p-6 ${plan.popular ? 'pt-10' : ''}`}>
                    <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${plan.gradient} text-white mb-4`}>
                      <PlanIcon className="size-6" />
                    </div>
                    <CardTitle className="text-xl font-black mb-1">{plan.name}</CardTitle>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-4xl font-black">${plan.price.toFixed(2)}</span>
                      <span className="text-sm text-muted-foreground font-bold">{plan.period}</span>
                    </div>
                    <p className="text-sm font-bold text-cyan-500 mb-6">
                      <HardDrive className="size-3.5 inline mr-1" />
                      {plan.storage}
                    </p>
                    <ul className="space-y-2.5 mb-6">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs font-medium text-muted-foreground/80">
                          <Check className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`w-full rounded-xl font-black uppercase text-xs tracking-widest ${
                        plan.popular
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white'
                          : ''
                      }`}
                      variant={plan.popular ? 'default' : 'outline'}
                      disabled={plan.name === currentPlan}
                    >
                      {plan.name === currentPlan ? 'Plan Actual' : 'Seleccionar Plan'}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {benefits.map((b) => {
            const BIcon = b.icon;
            return (
              <Card key={b.label} className="rounded-2xl border-border/40 bg-muted/20">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="p-2.5 bg-primary/10 rounded-xl">
                    <BIcon className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest">{b.label}</p>
                    <p className="text-[10px] text-muted-foreground/60 font-medium">{b.desc}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};
