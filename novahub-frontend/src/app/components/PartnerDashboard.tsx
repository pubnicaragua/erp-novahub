import { motion } from 'motion/react';
import { 
  Users, Zap, TrendingUp, Building2, Clock,
  Globe, MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { tenantsService } from '../services/tenants.service';
import { subscriptionsService } from '../services/subscriptions.service';
import { type Module } from '../contexts/AuthContext';
import { cn } from './ui/utils';
import { useTenantQuery, asList } from '../hooks/useTenantQuery';

interface PartnerDashboardProps {
  onNavigate?: (module: Module) => void;
}

export function PartnerDashboard({ onNavigate }: PartnerDashboardProps) {
  const { data: partnerData, isLoading: loading } = useTenantQuery(
    ['partner-dashboard'],
    async (signal) => {
      const [tList, rList] = await Promise.all([
        tenantsService.getAll(undefined, signal),
        subscriptionsService.getAllRequests(undefined, signal),
      ]);
      return { tenants: asList(tList), requests: asList(rList) };
    },
    { onError: (error) => console.error('Error loading partner data:', error) },
  );
  const tenants = partnerData?.tenants || [];
  const requests = partnerData?.requests || [];

  const stats = [
    { title: 'Clientes Activos', value: tenants.length, icon: Building2, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { title: 'Módulos Habilitados', value: tenants.reduce((acc, t) => acc + (t.enabledModules?.length || 0), 0), icon: Zap, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    { title: 'Solicitudes Pendientes', value: requests.filter(r => r.status === 'PENDING').length, icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
    { title: 'Ingresos Proyectados', value: `$${tenants.length * 125}`, icon: TrendingUp, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">Centro de <span className="text-primary italic">Partners</span></h1>
          <p className="text-muted-foreground/60 font-medium">Gestiona la expansión y escalabilidad de tus clientes.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-xl border-border/50 gap-2 font-bold uppercase text-[10px] tracking-widest shadow-sm" onClick={() => onNavigate?.('suscripciones')}>
             <Users className="size-4" /> Registrar Cliente
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="bg-card/50 border-border/50 hover:border-primary/20 transition-all group relative overflow-hidden backdrop-blur-md rounded-3xl shadow-sm border">
               <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${stat.bgColor} ${stat.color} shadow-inner`}>
                    <stat.icon className="size-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{stat.title}</p>
                    <p className="text-3xl font-black text-foreground tabular-nums tracking-tighter">
                      {loading ? '...' : stat.value}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Tenants */}
        <Card className="lg:col-span-2 rounded-3xl border-border/50 bg-card/30 backdrop-blur-md overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2 uppercase tracking-tight">
                <Globe className="size-5 text-primary" /> Cartera de Clientes
              </CardTitle>
              <CardDescription>Resumen de actividad reciente por empresa.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-primary font-bold text-[10px] uppercase tracking-widest" onClick={() => onNavigate?.('suscripciones')}>Ver todos</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tenants.slice(0, 4).map(tenant => (
                <div key={tenant.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/50 hover:bg-muted/30 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-primary border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                      {tenant.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{tenant.name}</p>
                      <p className="text-xs text-muted-foreground/60 font-medium uppercase tracking-tighter flex items-center gap-2">
                         <span className="text-primary/50">✦ {tenant.industry || 'General'}</span>
                         <span className="opacity-20">|</span>
                         <span>{tenant.enabledModules?.length || 0} Módulos</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant="outline" className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none",
                      tenant.isActive ? "bg-emerald-500/10 text-emerald-500" : "bg-muted/20 text-muted-foreground"
                    )}>
                      {tenant.isActive ? 'Operativo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
              ))}
              {tenants.length === 0 && !loading && (
                <div className="py-20 text-center border-2 border-dashed border-border/50 rounded-3xl">
                  <Building2 className="size-12 text-muted-foreground/10 mx-auto mb-2" />
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/30 italic">No hay clientes registrados bajo tu cuenta.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Requests */}
        <Card className="rounded-3xl border-border/50 bg-card/30 backdrop-blur-md">
          <CardHeader>
             <CardTitle className="text-lg font-bold flex items-center gap-2 uppercase tracking-tight">
               <MessageSquare className="size-5 text-amber-500" /> Solicitudes
            </CardTitle>
            <CardDescription>Módulos pendientes de aprobación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {requests.slice(0, 5).map(req => (
              <div key={req.id} className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/30 transition-all group">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                      <Zap className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground truncate max-w-[120px]">{req.requestedModule || req.moduleName}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{req.clientTenant?.name || 'Cliente'}</p>
                    </div>
                  </div>
                  <Badge className={cn(
                    "text-[8px] font-black uppercase px-2 py-0.5 border-none shadow-none",
                    req.status === 'PENDING' ? 'bg-amber-700 text-white' : 'bg-emerald-700 text-white'
                  )}>
                    {req.status === 'PENDING' ? 'Espera' : 'Listo'}
                  </Badge>
                </div>
              </div>
            ))}
            {requests.length === 0 && !loading && (
              <div className="py-20 text-center border-2 border-dashed border-border/50 rounded-3xl opacity-50">
                <Clock className="size-10 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 italic">Sin actividad reciente.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
