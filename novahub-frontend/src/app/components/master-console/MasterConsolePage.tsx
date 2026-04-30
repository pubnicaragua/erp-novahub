import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  Zap, Building2, Users, DollarSign, AlertTriangle, TrendingUp,
  Search, Eye, CreditCard, Clock, ShieldAlert, BarChart3,
  BellRing, ChevronRight, Activity
} from 'lucide-react';
import { masterConsoleService } from '../../services/master-console.service';
import { ClientDetailPanel } from './ClientDetailPanel';
import { useCurrency } from '../../contexts/CurrencyContext';

export function MasterConsolePage() {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clientDetail, setClientDetail] = useState<any>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { formatAmount } = useCurrency();

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchOverview = async () => {
    try {
      const data = await masterConsoleService.getOverview();
      setOverview(data);
    } catch (e) {
      console.error('Error loading overview:', e);
    } finally {
      setLoading(false);
    }
  };

  const openClientDetail = async (tenantId: string) => {
    try {
      setLoadingDetail(true);
      setSelectedClientId(tenantId);
      const data = await masterConsoleService.getClientDetail(tenantId);
      setClientDetail(data);
    } catch (e: any) {
      toast.error('Error al cargar detalle del cliente');
    } finally {
      setLoadingDetail(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Clock className="size-8 animate-spin text-primary" />
    </div>
  );

  // ── Vista detalle de cliente ──
  if (selectedClientId && clientDetail) {
    return (
      <div className="p-6 w-full">
        <ClientDetailPanel data={clientDetail} onBack={() => { setSelectedClientId(null); setClientDetail(null); }} />
      </div>
    );
  }

  const o = overview;
  if (!o) return null;

  const KPI = ({ label, value, icon: Icon, color = 'text-primary', sub }: any) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
              <p className={cn("text-3xl font-black tracking-tighter", color)}>{value}</p>
              {sub && <p className="text-[10px] text-muted-foreground mt-1 font-medium">{sub}</p>}
            </div>
            <div className={cn("p-2.5 rounded-xl", color.replace('text-', 'bg-').replace(/500/, '500/10'))}>
              <Icon className={cn("size-5", color)} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const filteredTenants = (o.tenantsSummary || []).filter((t: any) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-8 w-full">
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-foreground flex items-center gap-3 uppercase italic">
            <Activity className="size-10 text-primary fill-primary/20" />
            Master <span className="text-primary">Console</span>
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">Panel de control global del ecosistema SaaS</p>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest">
          {o.totalTenants} Empresas Registradas
        </Badge>
      </motion.div>

      {/* ── KPI Grid: Estados ── */}
      <div>
        <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2"><Building2 className="size-3.5" /> Estados de Clientes</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI label="Activos" value={o.activeTenants} icon={Building2} color="text-emerald-500" />
          <KPI label="En Mora" value={o.tenantsInMora} icon={AlertTriangle} color={o.tenantsInMora > 0 ? "text-amber-500" : "text-emerald-500"} />
          <KPI label="Suspendidos" value={o.suspendedTenants} icon={ShieldAlert} color={o.suspendedTenants > 0 ? "text-rose-500" : "text-emerald-500"} />
          <KPI label="Implementaciones Pendientes" value={o.pendingImplementations} icon={Clock} color="text-blue-500" />
        </div>
      </div>

      {/* ── KPI Grid: Finanzas ── */}
      <div>
        <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2"><DollarSign className="size-3.5" /> Resumen Financiero del Mes</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KPI label="Ingresos Esperados" value={formatAmount(o.ingresosEsperados, 'USD')} icon={TrendingUp} color="text-foreground" />
          <KPI label="Cobrados" value={formatAmount(o.ingresosCobrados, 'USD')} icon={DollarSign} color="text-emerald-500" />
          <KPI label="Por Cobrar" value={formatAmount(o.montoPorCobrar, 'USD')} icon={CreditCard} color={o.montoPorCobrar > 0 ? "text-amber-500" : "text-emerald-500"} />
          <KPI label="Facturas Vencidas" value={o.facturasVencidas} icon={AlertTriangle} color={o.facturasVencidas > 0 ? "text-rose-500" : "text-emerald-500"} />
          <KPI label="Deuda Total" value={formatAmount(o.deudaTotal, 'USD')} icon={ShieldAlert} color={o.deudaTotal > 0 ? "text-rose-500" : "text-emerald-500"} />
        </div>
      </div>

      {/* ── Operativa ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribución por Plan */}
        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><BarChart3 className="size-4" /> Distribución por Plan</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(o.planDistribution || {}).map(([plan, count]: any) => (
              <div key={plan} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={cn("text-[10px] font-black uppercase",
                    plan === 'BASIC' ? 'text-blue-400 border-blue-500/20' :
                    plan === 'PROFESSIONAL' ? 'text-purple-400 border-purple-500/20' :
                    plan === 'ENTERPRISE' ? 'text-emerald-400 border-emerald-500/20' : ''
                  )}>{plan}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${o.totalTenants ? (count / o.totalTenants) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-black w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-border/50 flex justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Usuarios Activos</span>
              <span className="font-black text-primary">{o.totalActiveUsers} / {o.totalUsers}</span>
            </div>
          </CardContent>
        </Card>

        {/* Empresas con Deuda */}
        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><AlertTriangle className="size-4 text-amber-500" /> Empresas con Deuda</CardTitle></CardHeader>
          <CardContent>
            {o.empresasConDeuda?.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sin deudas pendientes 🎉</p>}
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {o.empresasConDeuda?.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 cursor-pointer hover:bg-amber-500/10 transition-colors" onClick={() => openClientDetail(t.id)}>
                  <div>
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">{t.facturasVencidas} factura(s) vencida(s)</p>
                  </div>
                  <span className="text-sm font-black text-amber-500">{formatAmount(t.deuda, 'USD')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alertas Globales */}
        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><BellRing className="size-4 text-primary" /> Alertas Recientes</CardTitle></CardHeader>
          <CardContent>
            {o.recentAlerts?.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sin alertas activas</p>}
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {o.recentAlerts?.slice(0, 8).map((a: any) => (
                <div key={a.id} className="p-2.5 rounded-lg border border-border/40 hover:bg-muted/5">
                  <p className="text-xs font-bold">{a.title}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{a.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Lista de Clientes ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Building2 className="size-4" /> Todas las Empresas</h2>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-10 h-10 rounded-xl bg-muted/10 border-border/50" placeholder="Buscar empresa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTenants.map((t: any) => (
            <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className={cn("bg-card border-border/50 shadow-sm cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group", t.inMora && "border-amber-500/30")} onClick={() => openClientDetail(t.id)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Building2 className="size-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">{t.name}</h3>
                        <p className="text-[10px] text-muted-foreground">{t.slug}.novahub.io</p>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase",
                      t.plan === 'BASIC' ? 'text-blue-400 border-blue-500/20' :
                      t.plan === 'PROFESSIONAL' ? 'text-purple-400 border-purple-500/20' :
                      t.plan === 'ENTERPRISE' ? 'text-emerald-400 border-emerald-500/20' : ''
                    )}>{t.plan}</Badge>
                    <Badge className={cn("text-[9px] font-black uppercase",
                      t.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' :
                      t.status === 'SUSPENDED' ? 'bg-rose-500/10 text-rose-500' :
                      'bg-amber-500/10 text-amber-500'
                    )}>{t.status === 'ACTIVE' ? 'Activo' : t.status === 'SUSPENDED' ? 'Suspendido' : t.status}</Badge>
                    {t.inMora && <Badge className="bg-amber-500/10 text-amber-500 text-[9px]">En Mora</Badge>}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground font-medium">
                    <span className="flex items-center gap-1"><Users className="size-3" /> {t.users}</span>
                    <span className="flex items-center gap-1"><Zap className="size-3" /> {t.modulesActive} módulos</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {loadingDetail && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Clock className="size-10 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
