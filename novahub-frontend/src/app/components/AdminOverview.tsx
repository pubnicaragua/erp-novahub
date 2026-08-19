import { motion } from 'motion/react';
import { 
  Building2, 
  Users, 
  Zap, 
  ShieldCheck, 
  TrendingUp, 
  Clock, 
  Activity, 
  ArrowUpRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { masterConsoleService } from '../services/master-console.service';
import { useTenantQuery } from '../hooks/useTenantQuery';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import { EnterpriseGroupsAdminView } from './admin/EnterpriseGroupsAdminView';

export function AdminOverview() {
  const { data: overview, isLoading: loading } = useTenantQuery(
    ['master-console-overview'],
    (signal) => masterConsoleService.getOverview(signal),
    { onError: (error) => console.error('Error fetching admin stats:', error) },
  );
  const tenants = overview?.tenantsSummary || [];
  const requests = overview?.pendingRequestDetails || [];

  const stats = [
    { label: 'Empresas Totales', value: overview?.totalTenants || 0, icon: Building2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Usuarios en Red', value: overview?.totalUsers || 0, icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Módulos Activos', value: tenants.reduce((acc, t) => acc + t.modulesActive, 0), icon: Zap, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Solicitudes Pendientes', value: overview?.pendingRequests || 0, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">Console Master <span className="text-primary italic">Admin</span></h1>
          <p className="text-muted-foreground/60 font-medium">Panel de control global del ecosistema NovaHub.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1 gap-1.5 font-bold uppercase tracking-widest text-[10px]">
            <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Sistema en Línea
          </Badge>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="bg-card/50 border-border/50 hover:border-primary/20 transition-all group relative overflow-hidden backdrop-blur-md rounded-3xl shadow-sm border">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-3xl rounded-full -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors" />
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} shadow-inner`}>
                    <stat.icon className="size-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{stat.label}</p>
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

      <EnterpriseGroupsAdminView />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Growth Chart */}
        <Card className="lg:col-span-2 rounded-3xl border-border/50 bg-card/30 backdrop-blur-md overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2 uppercase tracking-tight">
              <TrendingUp className="size-5 text-primary" /> Crecimiento de la Red
            </CardTitle>
            <CardDescription>Incorporación de nuevos Tenants y Usuarios por mes.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[
                { name: 'Ene', tenants: 4, users: 12 },
                { name: 'Feb', tenants: 7, users: 25 },
                { name: 'Mar', tenants: overview?.totalTenants || 0, users: overview?.totalUsers || 0 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="name" fontSize={12} stroke="currentColor" opacity={0.5} />
                <YAxis fontSize={12} stroke="currentColor" opacity={0.5} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                />
                <Line type="monotone" dataKey="tenants" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 6 }} activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="users" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="rounded-3xl border-border/50 bg-card/30 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2 uppercase tracking-tight">
               <Activity className="size-5 text-emerald-500" /> Estado de Servicios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              {[
                { label: 'API Gateway', status: 'Healthy', latency: '24ms', color: 'bg-emerald-500' },
                { label: 'Database Service', status: 'Healthy', latency: '8ms', color: 'bg-emerald-500' },
                { label: 'Storage S3', status: 'Healthy', latency: '42ms', color: 'bg-emerald-500' },
                { label: 'Notification Socket', status: 'Slow', latency: '180ms', color: 'bg-amber-500' },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={`size-2 rounded-full ${s.color} animate-pulse`} />
                    <span className="text-sm font-bold text-foreground/80">{s.label}</span>
                  </div>
                  <div className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                    {s.status} / {s.latency}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Requests Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black uppercase tracking-tight ml-1">Solicitudes Pendientes de Módulos</h3>
          <Button variant="ghost" className="text-primary font-bold text-xs uppercase tracking-widest">Ver Todas <ArrowUpRight className="size-4 ml-1" /></Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {requests.slice(0, 3).map((req) => (
            <Card key={req.id} className="rounded-2xl border-border/50 bg-card/50 hover:bg-card transition-colors group">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Zap className="size-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{req.clientTenant?.name}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">{req.requestedModule}</p>
                </div>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px] font-black uppercase px-2 py-0.5">Pendiente</Badge>
              </CardContent>
            </Card>
          ))}
          {requests.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-border/50 rounded-3xl">
              <ShieldCheck className="size-12 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm font-bold text-muted-foreground/40 uppercase tracking-widest leading-none">Todo en orden. No hay solicitudes pendientes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
