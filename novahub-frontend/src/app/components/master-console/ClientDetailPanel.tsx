import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  ArrowLeft, Building2, CreditCard, Users, FileText, Shield,
  Check, Clock, AlertTriangle, Download, Zap, X, Calendar,
  DollarSign, TrendingUp, Ticket, BarChart3, Inbox, Banknote, Plus, Send, Loader2
} from 'lucide-react';
import { useCurrency } from '../../contexts/CurrencyContext';
import { masterConsoleService } from '../../services/master-console.service';
import { tenantsService } from '../../services/tenants.service';

interface Props { data: any; onBack: () => void; onRefresh?: () => void; }

export function ClientDetailPanel({ data, onBack, onRefresh }: Props) {
  const { formatAmount } = useCurrency();
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState([{ description: '', quantity: 1, unitPrice: 0 }]);
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  if (!data) return null;

  const handleGenerateAuto = async () => {
    if (!confirm('¿Generar factura automática basada en el plan actual?')) return;
    setActionLoading('auto');
    try {
      await masterConsoleService.generateAutoInvoice(data.id);
      toast.success('Factura generada exitosamente');
      onRefresh?.();
    } catch (e: any) { toast.error(e.message || 'Error al generar factura'); }
    finally { setActionLoading(null); }
  };

  const handleCreateManual = async () => {
    const validItems = invoiceItems.filter(i => i.description.trim() && i.unitPrice > 0);
    if (!validItems.length) return toast.error('Agrega al menos un ítem válido');
    setActionLoading('manual');
    try {
      await masterConsoleService.createManualInvoice(data.id, {
        items: validItems,
        dueDate: invoiceDueDate || undefined,
      });
      toast.success('Factura creada exitosamente');
      setShowInvoiceModal(false);
      setInvoiceItems([{ description: '', quantity: 1, unitPrice: 0 }]);
      setInvoiceDueDate('');
      onRefresh?.();
    } catch (e: any) { toast.error(e.message || 'Error al crear factura'); }
    finally { setActionLoading(null); }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    if (!confirm('¿Marcar esta factura como pagada?')) return;
    setActionLoading(invoiceId);
    try {
      await masterConsoleService.markInvoiceAsPaid(invoiceId);
      toast.success('Factura marcada como pagada');
      onRefresh?.();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setActionLoading(null); }
  };

  const handleRoleChange = async (userId: string, newRole: string, newCustomRoleId?: string | null) => {
    setActionLoading(`role-${userId}`);
    try {
      await tenantsService.updateUser(data.id, userId, { 
        role: newRole,
        customRoleId: newRole === 'ADMIN' ? null : newCustomRoleId
      });
      toast.success('Rol actualizado');
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.message || 'Error al actualizar rol');
    } finally {
      setActionLoading(null);
    }
  };

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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatBox label="Costo Mensual" value={formatAmount(data.costoMensual, 'USD')} icon={DollarSign} color="text-primary" />
            <StatBox label="Plan Base" value={formatAmount(data.basePlanCost, 'USD')} icon={CreditCard} />
            <StatBox label="Inicio" value={new Date(data.createdAt).toLocaleDateString()} icon={Calendar} color="text-foreground" />
            <StatBox label="Próximo Cobro" value={data.nextBillingDate ? new Date(data.nextBillingDate).toLocaleDateString() : 'N/A'} icon={Clock} color="text-foreground" />
            <StatBox label="Activación" value={data.activatedAt ? new Date(data.activatedAt).toLocaleDateString() : 'Pendiente'} icon={Check} color={data.activatedAt ? 'text-emerald-500' : 'text-amber-500'} />
            <StatBox label="Implementación" value={data.implementationPaid ? `Pagada${data.implementationCost ? ' — ' + formatAmount(data.implementationCost, 'USD') : ''}` : 'Pendiente'} icon={Shield} color={data.implementationPaid ? 'text-emerald-500' : 'text-amber-500'} />
          </div>
        </CardContent>
      </Card>

      {/* ── BLOQUE 2: Financiero ── */}
      <Card className="bg-card border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><CreditCard className="size-4" /> Estado Financiero</CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={handleGenerateAuto} disabled={!!actionLoading}>
                {actionLoading === 'auto' ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                Factura Automática
              </Button>
              <Button size="sm" className="text-xs gap-1.5 bg-primary" onClick={() => setShowInvoiceModal(true)}>
                <Plus className="size-3" /> Factura Manual
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <StatBox label="Total Facturado" value={formatAmount(data.totalFacturado, 'USD')} icon={TrendingUp} color="text-foreground" />
            <StatBox label="Total Cobrado" value={formatAmount(data.totalCobrado, 'USD')} icon={Check} color="text-emerald-500" />
            <StatBox label="Pagos Recibidos" value={formatAmount(data.totalPagosRecibidos || 0, 'USD')} icon={Banknote} color="text-emerald-500" />
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
                  <th className="text-center p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Acciones</th>
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
                    <td className="p-3 text-center">
                      {inv.status !== 'PAID' && (
                        <Button size="sm" variant="ghost" className="text-xs text-emerald-500 hover:text-emerald-400 gap-1" onClick={() => handleMarkPaid(inv.id)} disabled={actionLoading === inv.id}>
                          {actionLoading === inv.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                          Pagar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── BLOQUE 2.5: Pagos Recibidos ── */}
      {data.payments?.length > 0 && (
        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Banknote className="size-4 text-emerald-500" /> Historial de Pagos ({data.payments.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="border border-border/50 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/30 border-b border-border/40">
                  <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha</th>
                  <th className="text-right p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monto</th>
                  <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Método</th>
                  <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Referencia</th>
                  <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notas</th>
                </tr></thead>
                <tbody>{data.payments.slice(0, 15).map((p: any) => (
                  <tr key={p.id} className="border-b border-border/30 hover:bg-muted/5">
                    <td className="p-3 text-muted-foreground">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="p-3 text-right font-bold text-emerald-500">{formatAmount(p.amount, 'USD')}</td>
                    <td className="p-3"><Badge variant="outline" className="text-[9px]">{p.method}</Badge></td>
                    <td className="p-3 text-muted-foreground text-xs">{p.reference || '—'}</td>
                    <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">{p.notes || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                      <Select
                        disabled={!!actionLoading}
                        value={u.role}
                        onValueChange={(val) => handleRoleChange(u.id, val, u.customRoleId)}
                      >
                        <SelectTrigger className="h-6 text-[9px] w-28 bg-transparent border-border/40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="EMPLOYEE">Colaborador</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className={cn("size-2 rounded-full", u.isActive ? "bg-emerald-500" : "bg-rose-500")} />
                    </div>
                    {u.role === 'EMPLOYEE' && (
                      <Select
                        disabled={!!actionLoading}
                        value={u.customRoleId || 'none'}
                        onValueChange={(val) => handleRoleChange(u.id, 'EMPLOYEE', val === 'none' ? null : val)}
                      >
                        <SelectTrigger className="h-5 text-[8px] w-28 bg-muted/30 border-border/40 mt-1">
                          <SelectValue placeholder="Sin rol" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin rol</SelectItem>
                          {data.roles?.map((r: any) => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
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

      {/* ── BLOQUE 4.5: Solicitudes de Módulos ── */}
      {data.subscriptionRequests?.length > 0 && (
        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Inbox className="size-4" /> Solicitudes de Módulos ({data.subscriptionRequests.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="border border-border/50 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/30 border-b border-border/40">
                  <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Módulo</th>
                  <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notas</th>
                  <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha</th>
                  <th className="text-center p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</th>
                </tr></thead>
                <tbody>{data.subscriptionRequests.slice(0, 15).map((r: any) => (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-muted/5">
                    <td className="p-3 font-bold">{(r.requestedModule || '').replace(/_/g, ' ')}</td>
                    <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">{r.notes || '—'}</td>
                    <td className="p-3 text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 text-center">
                      <Badge className={r.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' : r.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}>
                        {r.status === 'APPROVED' ? 'Aprobado' : r.status === 'REJECTED' ? 'Rechazado' : 'Pendiente'}
                      </Badge>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* ── MODAL FACTURA MANUAL ── */}
      <AnimatePresence>
        {showInvoiceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border/50 shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border/50 flex justify-between items-center bg-muted/10">
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <CreditCard className="size-5 text-primary" /> Crear Factura Manual
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setShowInvoiceModal(false)}>
                  <X className="size-4" />
                </Button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-muted-foreground block mb-2">Vencimiento (Opcional)</label>
                  <Input type="date" value={invoiceDueDate} onChange={(e) => setInvoiceDueDate(e.target.value)} className="w-full sm:w-1/2" />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-muted-foreground block mb-3 flex justify-between items-center">
                    <span>Ítems de Factura</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => setInvoiceItems([...invoiceItems, { description: '', quantity: 1, unitPrice: 0 }])} className="text-[10px] h-7 px-2">
                      <Plus className="size-3 mr-1" /> Añadir Ítem
                    </Button>
                  </label>
                  <div className="space-y-3">
                    {invoiceItems.map((item, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-muted/10 border border-border/40 rounded-xl relative group">
                        <div className="flex-1 space-y-3">
                          <Input
                            placeholder="Descripción del ítem"
                            value={item.description}
                            onChange={(e) => {
                              const newItems = [...invoiceItems];
                              newItems[index].description = e.target.value;
                              setInvoiceItems(newItems);
                            }}
                          />
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Cantidad</label>
                              <Input
                                type="number" min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newItems = [...invoiceItems];
                                  newItems[index].quantity = Number(e.target.value);
                                  setInvoiceItems(newItems);
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Precio Unitario ($)</label>
                              <Input
                                type="number" min="0" step="0.01"
                                value={item.unitPrice}
                                onChange={(e) => {
                                  const newItems = [...invoiceItems];
                                  newItems[index].unitPrice = Number(e.target.value);
                                  setInvoiceItems(newItems);
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Subtotal</label>
                              <div className="h-10 flex items-center px-3 bg-muted/20 border border-border/40 rounded-md font-bold">
                                {formatAmount(item.quantity * item.unitPrice, 'USD')}
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost" size="icon"
                          className="text-rose-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity absolute -right-2 -top-2 bg-background border border-border shadow-sm rounded-full size-6"
                          onClick={() => {
                            if (invoiceItems.length === 1) return;
                            setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
                          }}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-4 bg-muted/20 rounded-xl border border-border/40 flex justify-between items-center">
                    <span className="font-bold text-muted-foreground">Total Factura:</span>
                    <span className="text-xl font-black text-primary">
                      {formatAmount(invoiceItems.reduce((s, i) => s + (i.quantity * i.unitPrice), 0), 'USD')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border/50 bg-muted/5 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowInvoiceModal(false)}>Cancelar</Button>
                <Button onClick={handleCreateManual} disabled={actionLoading === 'manual'} className="gap-2">
                  {actionLoading === 'manual' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Crear Factura
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
