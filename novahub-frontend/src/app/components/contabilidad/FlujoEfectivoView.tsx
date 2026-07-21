import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { RefreshCw, Filter, X, ArrowUpCircle, ArrowDownCircle, DollarSign } from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { toast } from 'sonner';

interface CashFlowItem {
  concept: string;
  amount: number;
}

interface CashFlowSection {
  items: CashFlowItem[];
  subtotal: number;
}

interface CashFlowData {
  operativas: CashFlowSection;
  inversion: CashFlowSection;
  financiamiento: CashFlowSection;
  netCashFlow: number;
  beginningCash: number;
  endingCash: number;
}

const SECTION_CONFIG = [
  {
    key: 'operativas' as const,
    title: 'Actividades Operativas',
    subtitle: 'Flujos de efectivo de actividades de operación',
    headerClass: 'bg-emerald-600',
    icon: ArrowUpCircle,
  },
  {
    key: 'inversion' as const,
    title: 'Actividades de Inversión',
    subtitle: 'Flujos de efectivo de actividades de inversión',
    headerClass: 'bg-amber-600',
    icon: ArrowDownCircle,
  },
  {
    key: 'financiamiento' as const,
    title: 'Actividades de Financiamiento',
    subtitle: 'Flujos de efectivo de actividades de financiamiento',
    headerClass: 'bg-purple-600',
    icon: DollarSign,
  },
];

export function FlujoEfectivoView() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      toast.error('Seleccione el rango de fechas');
      return;
    }
    try {
      setLoading(true);
      const raw: any = await contabilidadService.getCashFlow({ dateFrom, dateTo });
      const result: CashFlowData = {
        operativas: {
          items: raw?.operatingActivities?.items || [{ concept: 'Actividades Operativas', amount: raw?.operatingActivities?.netCash || 0 }],
          subtotal: raw?.operatingActivities?.netCash || 0,
        },
        inversion: {
          items: raw?.investingActivities?.items || [{ concept: 'Actividades de Inversión', amount: raw?.investingActivities?.netCash || 0 }],
          subtotal: raw?.investingActivities?.netCash || 0,
        },
        financiamiento: {
          items: raw?.financingActivities?.items || [{ concept: 'Actividades de Financiamiento', amount: raw?.financingActivities?.netCash || 0 }],
          subtotal: raw?.financingActivities?.netCash || 0,
        },
        netCashFlow: raw?.netCashChange || 0,
        beginningCash: raw?.beginningCashBalance || 0,
        endingCash: raw?.endingCashBalance || 0,
      };
      setData(result);
    } catch {
      toast.error('Error al cargar flujo de efectivo');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (dateFrom && dateTo) fetchData();
  }, [fetchData]);

  const fmt = (n: number) => {
    const abs = Math.abs(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n < 0 ? `(${abs})` : abs;
  };

  const renderSection = (section: typeof SECTION_CONFIG[number], secData: CashFlowSection) => {
    const Icon = section.icon;
    return (
      <div className="mb-6">
        <div className={cn("px-4 py-2 rounded-t-lg font-black text-sm uppercase tracking-widest text-white", section.headerClass)}>
          <div className="flex items-center gap-2">
            <Icon className="size-4" />
            {section.title}
          </div>
          <p className="text-[9px] font-normal opacity-70 tracking-normal normal-case">{section.subtitle}</p>
        </div>
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Concepto</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right w-[200px]">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {secData.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="h-12 text-center text-muted-foreground text-xs">Sin movimientos</TableCell>
              </TableRow>
            ) : secData.items.map((item, i) => (
              <TableRow key={i} className="hover:bg-muted/30 border-border/30">
                <TableCell className="font-medium text-sm">{item.concept}</TableCell>
                <TableCell className={cn("text-right font-mono text-sm font-bold", item.amount >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {fmt(item.amount)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-bold border-t-2 border-border">
              <TableCell className="text-sm uppercase tracking-wider">Subtotal</TableCell>
              <TableCell className={cn("text-right font-mono text-sm", secData.subtotal >= 0 ? "text-emerald-600" : "text-red-600")}>
                {fmt(secData.subtotal)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-5 bg-muted/30 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-[0.2em] bg-background/50 px-3 py-1.5 rounded-lg border border-border/30 shrink-0">
          <Filter className="size-3.5" /> Filtros
        </div>
        <div className="flex flex-wrap items-center gap-4 flex-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Desde</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-[150px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Hasta</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-[150px]" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="h-9 px-4 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-rose-500 hover:bg-rose-500/5 rounded-xl border border-dashed border-border/60 transition-all mt-5">
              <X className="size-3" /> Limpiar
            </button>
          )}
        </div>
        <div className="lg:ml-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-border/20">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="h-9">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Actualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold">Flujo de Efectivo</CardTitle>
          {dateFrom && dateTo && (
            <p className="text-xs text-muted-foreground">
              Período: {new Date(dateFrom).toLocaleDateString('es')} - {new Date(dateTo).toLocaleDateString('es')}
            </p>
          )}
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Cargando...</div>
          ) : !data ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Seleccione un rango de fechas para ver el reporte</div>
          ) : (
            <ScrollArea className="max-h-[70vh]">
              {SECTION_CONFIG.map(section => renderSection(section, data[section.key]))}

              <Separator className="my-4" />

              {/* Cash summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-muted/30 rounded-xl border border-border/50 p-4 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Efectivo Inicial</p>
                  <p className="text-xl font-black text-foreground">{fmt(data.beginningCash)}</p>
                </div>
                <div className={cn("rounded-xl border-2 p-4 text-center", data.netCashFlow >= 0 ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800" : "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800")}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Flujo Neto del Período</p>
                  <p className={cn("text-xl font-black", data.netCashFlow >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {data.netCashFlow >= 0 ? '+' : ''}{fmt(data.netCashFlow)}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-4 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Efectivo Final</p>
                  <p className="text-xl font-black text-foreground">{fmt(data.endingCash)}</p>
                </div>
              </div>

              {/* Detail breakdown */}
              <div className="rounded-xl border border-border/50 bg-muted/20 p-5">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Resumen por Actividad</p>
                <div className="space-y-2">
                  {SECTION_CONFIG.map(section => {
                    const secData = data[section.key];
                    return (
                      <div key={section.key} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                        <div className="flex items-center gap-2">
                          <div className={cn("size-2 rounded-full", section.headerClass.replace('bg-', 'bg-').replace('600', '500'))} />
                          <span className="text-sm font-medium">{section.title}</span>
                        </div>
                        <span className={cn("text-sm font-bold font-mono", secData.subtotal >= 0 ? "text-emerald-600" : "text-red-600")}>
                          {fmt(secData.subtotal)}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between py-2 border-t-2 border-border">
                    <span className="text-sm font-black uppercase tracking-wider">Flujo Neto de Efectivo</span>
                    <span className={cn("text-lg font-black font-mono", data.netCashFlow >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {data.netCashFlow >= 0 ? '+' : ''}{fmt(data.netCashFlow)}
                    </span>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
