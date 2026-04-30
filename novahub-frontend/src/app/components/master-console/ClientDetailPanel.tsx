import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { motion } from 'motion/react';
import {
  ArrowLeft, Building2, CreditCard, Users, FileText, Shield,
  Check, Clock, AlertTriangle, Download, Zap, X, Calendar,
  DollarSign, TrendingUp, Ticket, BarChart3
} from 'lucide-react';
import { useCurrency } from '../../contexts/CurrencyContext';

interface Props { data: any; onBack: () => void; }

export function ClientDetailPanel({ data, onBack }: Props) {
  const { formatAmount } = useCurrency();
  if (!data) return null;

  const getPlanColor = (p: string) => {
    if (p === 'BASIC') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (p === 'PROFESSIONAL') return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    if (p === 'ENTERPRISE') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    return 'bg-muted/30 text-muted-foreground border-border/50';
  };

  const getStatusBadge = (s: string) => {
    if (s === 'ACTIVE') return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-black uppercase text-[10px]">Activo</Badge>;
    if (s === 'SUSPENDED') return <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 font-black uppercase text-[10px]">Suspendido</Badge>;
    return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-black uppercase text-[10px]">{s}</Badge>;
  };

  const StatBox = ({ label, value, icon: Icon, color = 'text-primary' }: any) => (
    <div className="p-4 rounded-xl bg-muted/10 border border-border/50 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <p className={cn("text-xl font-black tracking-tight", color)}>{value}</p>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl"><ArrowLeft className="size-5" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="size-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter">{data.name}</h2>
              <p className="text-xs text-muted-foreground font-medium">{data.slug}.novahub.io • {data.industry}</p>
            </div>
          </div>
        </div>
        <Badge className={cn("px-4 py-1.5 font-black uppercase", getPlanColor(data.plan))}>Plan {data.plan}</Badge>
        {getStatusBadge(data.status)}
      </div>

      {/* ── BLOQUE 1: Resumen General ── */}
      <Card className="bg-card border-border/50 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><BarChart3 className="size-4" /> Resumen General</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox label="Costo Mensual" value={formatAmount(data.costoMensual, 'USD')} icon={DollarSign} color="text-primary" />
            <StatBox label="Plan Base" value={formatAmount(data.basePlanCost, 'USD')} icon={CreditCard} />
            <StatBox label="Inicio" value={new Date(data.createdAt).toLocaleDateString()} icon={Calendar} color="text-foreground" />
            <StatBox label="Próximo Cobro" value={data.nextBillingDate ? new Date(data.nextBillingDate).toLocaleDateString() : 'N/A'} icon={Clock} color="text-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* ── BLOQUE 2: Financiero ── */}
      <Card className="bg-card border-border/50 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><CreditCard className="size-4" /> Estado Financiero</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatBox label="Total Facturado" value={formatAmount(data.totalFacturado, 'USD')} icon={TrendingUp} color="text-foreground" />
            <StatBox label="Total Cobrado" value={formatAmount(data.totalCobrado, 'USD')} icon={Check} color="text-emerald-500" />
            <StatBox label="Saldo Pendiente" value={formatAmount(data.saldoPendiente, 'USD')} icon={AlertTriangle} color={data.saldoPendiente > 0 ? 'text-amber-500' : 'text-emerald-500'} />
            <StatBox label="Facturas Emitidas" value={data.facturasEmitidas} icon={FileText} color="text-foreground" />
            <StatBox label="Facturas Vencidas" value={data.facturasVencidasCount} icon={X} color={data.facturasVencidasCount > 0 ? 'text-rose-500' : 'text-emerald-500'} />
          </div>
          {data.invoices?.length > 0 && (
            <div className="border border-border/50 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/30 border-b border-border/40">
                  <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Número</th>
                  <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha</th>
                  <th className="text-right p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monto</th>
                  <th className="text-center p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</th>
                </tr></thead>
                <tbody>{data.invoices.slice(0, 10).map((inv: any) => (
                  <tr key={inv.id} className="border-b border-border/30 hover:bg-muted/5">
                    <td className="p-3 font-bold">{inv.number}</td>
                    <td className="p-3 text-muted-foreground">{new Date(inv.date).toLocaleDateString()}</td>
                    <td className="p-3 text-right font-bold">{formatAmount(inv.total, 'USD')}</td>
                    <td className="p-3 text-center">
                      <Badge className={inv.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}>
                        {inv.status === 'PAID' ? 'Pagado' : 'Pendiente'}
                      </Badge>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── BLOQUE 3: Usuarios y Módulos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Users className="size-4" /> Usuarios ({data.activeUsersCount}/{data.baseUserQuota})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (data.activeUsersCount / data.baseUserQuota) * 100)}%` }} />
              </div>
              <span className="text-sm font-bold">{data.activeUsersCount}/{data.baseUserQuota}</span>
            </div>
            {data.extraUsers > 0 && <p className="text-xs text-amber-500 font-medium">+{data.extraUsers} extras ({formatAmount(data.extraUserPrice, 'USD')}/u = {formatAmount(data.usersCost, 'USD')})</p>}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {data.users?.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 hover:bg-muted/5">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-sm">{u.name?.charAt(0)}</div>
                    <div>
                      <p className="text-sm font-bold">{u.name}</p>
                      <p className="text-[10px] text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">{u.role}</Badge>
                    <div className={cn("size-2 rounded-full", u.isActive ? "bg-emerald-500" : "bg-rose-500")} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Zap className="size-4" /> Módulos Activos ({data.activeModulesCount})</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
              {data.modules?.map((m: any) => (
                <div key={m.id} className={cn("p-2.5 rounded-lg border text-xs font-medium flex items-center gap-2", m.isActive ? "border-primary/20 bg-primary/5 text-foreground" : "border-border/30 text-muted-foreground")}>
                  {m.isActive ? <Check className="size-3 text-primary" /> : <X className="size-3 text-muted-foreground/40" />}
                  {m.module.replace(/_/g, ' ')}
                  {Number(m.price) > 0 && <span className="ml-auto text-[10px] text-primary font-bold">{formatAmount(Number(m.price), 'USD')}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── BLOQUE 4: Documentos y Soporte ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Shield className="size-4" /> Documentos ({data.documents?.length || 0})</CardTitle></CardHeader>
          <CardContent>
            {data.documents?.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sin documentos registrados</p>}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.documents?.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/40">
                  <div>
                    <p className="text-sm font-bold">{d.title}</p>
                    <p className="text-[10px] text-muted-foreground">{d.type} • {new Date(d.date).toLocaleDateString()}</p>
                  </div>
                  {d.url && <Button variant="ghost" size="sm" onClick={() => window.open(d.url, '_blank')}><Download className="size-3.5" /></Button>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Ticket className="size-4" /> Soporte ({data.openTicketsCount} abiertos)</CardTitle></CardHeader>
          <CardContent>
            {data.supportTickets?.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sin tickets</p>}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.supportTickets?.slice(0, 8).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/40">
                  <div>
                    <p className="text-sm font-bold">{t.subject}</p>
                    <p className="text-[10px] text-muted-foreground">{t.number} • {new Date(t.createdAt).toLocaleDateString()}</p>
                  </div>
                  <Badge className={t.status === 'OPEN' ? 'bg-amber-500/10 text-amber-500' : t.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted/30 text-muted-foreground'}>{t.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── BLOQUE 5: Seguimiento y Cambios de Plan ── */}
      {data.planChangeHistory?.length > 0 && (
        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><TrendingUp className="size-4" /> Historial de Cambios de Plan</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.planChangeHistory.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                  <div>
                    <p className="text-sm font-medium">{r.notes}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</p>
                  </div>
                  <Badge className={r.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' : r.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}>{r.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
