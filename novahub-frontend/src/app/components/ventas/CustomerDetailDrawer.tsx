'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  History,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Info,
  ChevronRight,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Tag,
  Hash,
  Activity,
} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Progress } from '../ui/progress';
import { ScrollArea } from '../ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { customersService, invoicesService } from '../../services/ventas.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import type { Customer, Invoice } from '../../types';

interface CustomerDetailDrawerProps {
  customerId: string | null;
  onOpenChange: (open: boolean) => void;
  customerSnapshot?: Customer | null;
}

type TabKey = 'general' | 'credito' | 'facturas' | 'historial';

const getStatusBadge = (status?: string) => {
  const s = String(status || '').toUpperCase();
  switch (s) {
    case 'ACTIVE':
    case 'ACTIVO':
      return { label: 'Activo', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
    case 'INACTIVE':
    case 'INACTIVO':
      return { label: 'Inactivo', className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' };
    default:
      return { label: status || '—', className: 'bg-muted text-muted-foreground border-border' };
  }
};

const getTypeBadge = (type?: string) => {
  const t = String(type || '').toUpperCase();
  switch (t) {
    case 'COMPANY':
    case 'EMPRESA':
      return { label: 'Empresa', className: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: Building2 };
    default:
      return { label: 'Particular', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: User };
  }
};

export function CustomerDetailDrawer({
  customerId,
  onOpenChange,
  customerSnapshot,
}: CustomerDetailDrawerProps) {
  const { formatConvertedAmount } = useCurrency();
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [detail, setDetail] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) {
      setDetail(null);
      setInvoices([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const resp: any = await customersService.getById(customerId);
        const cust = resp?.data?.data || resp?.data || resp;
        if (cancelled) return;
        if (cust && typeof cust === 'object' && cust.id) {
          setDetail(cust);
        }
      } catch (e: any) {
        if (!cancelled && !customerSnapshot) {
          setError(e?.message || 'No se pudo cargar la información del cliente');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Fetch facturas asociadas
    setLoadingInvoices(true);
    (async () => {
      try {
        const resp: any = await invoicesService.getAll({ customerId, limit: 50 } as any);
        const list = resp?.data?.data || resp?.data || resp;
        if (!cancelled) {
          setInvoices(Array.isArray(list) ? list : []);
        }
      } catch {
        if (!cancelled) setInvoices([]);
      } finally {
        if (!cancelled) setLoadingInvoices(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  useEffect(() => {
    setActiveTab('general');
  }, [customerId]);

  const customer = detail ?? customerSnapshot ?? null;
  const isOpen = Boolean(customerId);

  const statusInfo = getStatusBadge(customer?.status);
  const typeInfo = getTypeBadge(customer?.type);
  const TypeIcon = typeInfo.icon;

  const balance = Number(customer?.balance ?? 0);
  const creditLimit = Number(customer?.creditLimit ?? 0);
  const availableCredit = Math.max(0, creditLimit - balance);
  const creditUsedPercent = creditLimit > 0 ? Math.min(100, (balance / creditLimit) * 100) : 0;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl p-0 flex flex-col gap-0 border-l border-border/50 bg-background"
      >
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabKey)}
          className="flex flex-col flex-1 min-h-0 gap-0"
        >
          {/* Header Sticky */}
          <SheetHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border/50 px-6 py-4 space-y-3">
            <div className="flex items-start gap-4 pr-8">
              <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-primary text-base border border-primary/20 shrink-0 shadow-inner">
                {String(customer?.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <SheetTitle className="text-lg font-black uppercase tracking-tight truncate text-foreground">
                    {customer?.name || 'Cargando…'}
                  </SheetTitle>
                  {customer?.status && (
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-black uppercase tracking-wider border ${statusInfo.className}`}
                    >
                      {statusInfo.label}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-black uppercase tracking-wider border ${typeInfo.className}`}
                  >
                    <TypeIcon className="size-3 mr-1" />
                    {typeInfo.label}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-wrap">
                  <span className="font-bold">{customer?.code || customer?.id?.slice(0, 8) || '—'}</span>
                  {customer?.createdAt && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-sans text-[11px]">
                        <Calendar className="size-3" />
                        Registrado {format(new Date(customer.createdAt), 'dd MMM yyyy', { locale: es })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <TabsList className="w-full justify-start h-9 bg-muted/40 p-1 rounded-xl border border-border/40 font-bold text-xs">
              <TabsTrigger value="general" className="rounded-lg text-xs font-bold gap-1.5 px-3 py-1">
                <User className="size-3.5" /> General
              </TabsTrigger>
              <TabsTrigger value="credito" className="rounded-lg text-xs font-bold gap-1.5 px-3 py-1">
                <CreditCard className="size-3.5" /> Estado de Cuenta
              </TabsTrigger>
              <TabsTrigger value="facturas" className="rounded-lg text-xs font-bold gap-1.5 px-3 py-1">
                <FileText className="size-3.5" /> Facturas ({invoices.length})
              </TabsTrigger>
              <TabsTrigger value="historial" className="rounded-lg text-xs font-bold gap-1.5 px-3 py-1">
                <History className="size-3.5" /> Historial
              </TabsTrigger>
            </TabsList>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {error && (
                <Card className="p-4 bg-rose-500/10 border-rose-500/20 text-rose-500 flex items-center gap-3">
                  <AlertCircle className="size-5 shrink-0" />
                  <p className="text-xs font-bold">{error}</p>
                </Card>
              )}

              {/* Tab General */}
              <TabsContent value="general" className="mt-0 space-y-6 outline-none">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MetricCard label="Saldo Deudor" value={formatConvertedAmount(balance, 'NIO')} icon={DollarSign} accent={balance > 0 ? 'text-rose-500' : 'text-emerald-500'} loading={loading} />
                  <MetricCard label="Límite Crédito" value={formatConvertedAmount(creditLimit, 'NIO')} icon={CreditCard} accent="text-blue-500" loading={loading} />
                  <MetricCard label="Tipo Cliente" value={typeInfo.label} icon={TypeIcon} accent="text-purple-500" loading={loading} />
                  <MetricCard label="Estado" value={statusInfo.label} icon={CheckCircle2} accent={customer?.status === 'ACTIVE' ? 'text-emerald-500' : 'text-muted-foreground'} loading={loading} />
                </div>

                <Card className="p-5 bg-card border-border/60 rounded-2xl space-y-4 shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                    <User className="size-4 text-primary" /> Información de Contacto
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <InfoField label="Contacto Principal" value={customer?.contactName || 'Sin contacto asignado'} icon={User} muted={!customer?.contactName} />
                    <InfoField label="Correo Electrónico" value={customer?.email || customer?.contactEmail || 'Sin correo'} icon={Mail} muted={!customer?.email && !customer?.contactEmail} />
                    <InfoField label="Teléfono" value={customer?.phone || customer?.contactPhone || 'Sin teléfono'} icon={Phone} mono muted={!customer?.phone && !customer?.contactPhone} />
                    <InfoField label="Ubicación / Dirección" value={[customer?.address, customer?.city, customer?.country].filter(Boolean).join(', ') || 'Sin dirección'} icon={MapPin} muted={!customer?.address && !customer?.city && !customer?.country} />
                  </div>
                </Card>

                <Card className="p-5 bg-card border-border/60 rounded-2xl space-y-4 shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                    <Building2 className="size-4 text-purple-500" /> Datos Fiscales y Financieros
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <InfoField label="RUC" value={customer?.ruc || '—'} icon={Hash} mono muted={!customer?.ruc} />
                    <InfoField label="DV" value={customer?.dv || '—'} icon={Hash} mono muted={!customer?.dv} />
                    <InfoField label="Razón Social" value={customer?.razonSocial || '—'} icon={Building2} muted={!customer?.razonSocial} />
                    <InfoField label="Identificación Fiscal" value={customer?.taxId || 'No registrado'} icon={Hash} mono muted={!customer?.taxId} />
                    <InfoField label="Límite de Crédito Concedido" value={formatConvertedAmount(creditLimit, 'NIO')} icon={DollarSign} mono />
                    <InfoField label="Saldo Deudor Actual" value={formatConvertedAmount(balance, 'NIO')} icon={TrendingUp} mono />
                    <InfoField label="Código Interno" value={customer?.code || '—'} icon={Tag} mono />
                  </div>

                  {customer?.notes && (
                    <div className="pt-2 border-t border-border/40 space-y-1">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 font-bold">
                        <Info className="size-3" /> Observaciones / Notas
                      </Label>
                      <p className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-xl border border-border/30">
                        {customer.notes}
                      </p>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Tab Estado de Cuenta */}
              <TabsContent value="credito" className="mt-0 space-y-6 outline-none">
                <Card className="p-5 bg-card border-border/60 rounded-2xl space-y-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Utilización de Línea de Crédito</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Relación entre el saldo deudor actual y el límite total autorizado.</p>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs font-black border-primary/20 bg-primary/10 text-primary">
                      {creditUsedPercent.toFixed(1)}% Usado
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <Progress value={creditUsedPercent} className="h-3 rounded-full" />
                    <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
                      <span>Usado: {formatConvertedAmount(balance, 'NIO')}</span>
                      <span>Límite: {formatConvertedAmount(creditLimit, 'NIO')}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-xl bg-muted/20 border border-border/40 space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Crédito Disponible</p>
                      <p className="text-xl font-black text-emerald-500 tabular-nums">{formatConvertedAmount(availableCredit, 'NIO')}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/20 border border-border/40 space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado de Riesgo</p>
                      <p className="text-sm font-bold flex items-center gap-1.5 text-foreground mt-1">
                        {creditUsedPercent >= 90 ? (
                          <span className="text-rose-500 flex items-center gap-1 font-black"><ShieldAlert className="size-4" /> Al Límite / Riesgo Alto</span>
                        ) : creditUsedPercent > 0 ? (
                          <span className="text-amber-500 flex items-center gap-1 font-bold"><Info className="size-4" /> Crédito Activo</span>
                        ) : (
                          <span className="text-emerald-500 flex items-center gap-1 font-bold"><CheckCircle2 className="size-4" /> Sin Deuda Activa</span>
                        )}
                      </p>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Tab Facturas */}
              <TabsContent value="facturas" className="mt-0 space-y-4 outline-none">
                {loadingInvoices ? (
                  <div className="space-y-3 p-4">
                    <Skeleton className="h-10 w-full rounded-xl" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                ) : invoices.length === 0 ? (
                  <EmptyState icon={FileText} title="Sin facturas registradas" description="Este cliente aún no registra facturas de venta en el sistema." />
                ) : (
                  <Card className="rounded-2xl border border-border/60 overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest">Nº Factura</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((inv) => (
                          <TableRow key={inv.id} className="hover:bg-muted/30">
                            <TableCell className="font-mono text-xs font-bold text-foreground">{inv.number}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{inv.date ? format(new Date(inv.date), 'dd/MM/yyyy') : '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider border-none bg-emerald-500/10 text-emerald-500">
                                {inv.status || 'Emitida'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-black text-right tabular-nums text-foreground">{formatConvertedAmount(inv.total, 'NIO')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </TabsContent>

              {/* Tab Historial */}
              <TabsContent value="historial" className="mt-0 space-y-4 outline-none">
                <Card className="p-5 bg-card border-border/60 rounded-2xl space-y-4 shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                    <Activity className="size-4 text-primary" /> Línea de Tiempo de Registro
                  </h3>
                  <div className="space-y-4 pl-2 border-l-2 border-border/40 ml-2 pt-1">
                    {customer?.createdAt && (
                      <div className="relative pl-4 space-y-1">
                        <div className="absolute -left-[21px] top-1 size-3 rounded-full bg-primary border-2 border-background" />
                        <p className="text-xs font-bold text-foreground">Cliente Registrado</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                          <Clock className="size-3" />
                          {format(new Date(customer.createdAt), 'PPP p', { locale: es })}
                        </p>
                      </div>
                    )}
                    {customer?.updatedAt && (
                      <div className="relative pl-4 space-y-1">
                        <div className="absolute -left-[21px] top-1 size-3 rounded-full bg-blue-500 border-2 border-background" />
                        <p className="text-xs font-bold text-foreground">Última Actualización</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                          <Clock className="size-3" />
                          {format(new Date(customer.updatedAt), 'PPP p', { locale: es })}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              </TabsContent>
            </div>
          </ScrollArea>

          {/* Footer Sticky */}
          <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-md border-t border-border/50 px-6 py-3 flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Detalle del Cliente</p>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="gap-1.5 font-bold rounded-xl text-xs">
              Cerrar <ChevronRight className="size-3" />
            </Button>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// Auxiliares
interface MetricCardProps { label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent?: string; loading?: boolean; }
function MetricCard({ label, value, icon: Icon, accent = 'text-foreground', loading }: MetricCardProps) {
  return (
    <Card className="p-3.5 border-border/60 hover:border-primary/30 transition-all rounded-xl shadow-xs">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-black">{label}</p>
        <Icon className={`size-3.5 ${accent}`} />
      </div>
      {loading ? <Skeleton className="h-5 w-3/4 mt-2" /> : <p className={`text-sm font-black tabular-nums ${accent} truncate mt-1`} title={value}>{value}</p>}
    </Card>
  );
}

interface InfoFieldProps { label: string; value: string; icon: React.ComponentType<{ className?: string }>; mono?: boolean; muted?: boolean; }
function InfoField({ label, value, icon: Icon, mono, muted }: InfoFieldProps) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 font-bold"><Icon className="size-3" />{label}</Label>
      <p className={`text-xs ${mono ? 'font-mono' : 'font-bold'} ${muted ? 'text-muted-foreground/60 italic' : 'text-foreground'} break-words`}>{value}</p>
    </div>
  );
}

interface EmptyStateProps { icon: React.ComponentType<{ className?: string }>; title: string; description: string; }
function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <Card className="p-8 gap-2 flex flex-col items-center text-center border-dashed border-border/60 bg-muted/10 rounded-2xl">
      <div className="size-10 rounded-full bg-muted/40 flex items-center justify-center"><Icon className="size-5 text-muted-foreground" /></div>
      <p className="text-xs font-bold text-foreground mt-1">{title}</p>
      <p className="text-[11px] text-muted-foreground max-w-xs">{description}</p>
    </Card>
  );
}

export default CustomerDetailDrawer;
