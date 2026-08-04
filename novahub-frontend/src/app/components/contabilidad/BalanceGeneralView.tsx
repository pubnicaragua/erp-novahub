import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { RefreshCw, Filter, Scale, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { toast } from 'sonner';
import { useAccountingQuery } from '../../hooks/useAccountingQuery';

interface BSAccount {
  accountId: string;
  codigo: string;
  cuenta: string;
  currentAmount: number;
  previousAmount?: number;
}

interface BSData {
  assets: BSAccount[];
  liabilities: BSAccount[];
  equity: BSAccount[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalAssetsPrev: number;
  totalLiabilitiesPrev: number;
  totalEquityPrev: number;
}

export function BalanceGeneralView() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showPreviousYear, setShowPreviousYear] = useState(false);
  const query = useAccountingQuery<BSData | null>(
    ['balance-sheet', date, showPreviousYear],
    async (signal) => {
      if (!date) return null;
      const raw: any = await contabilidadService.getBalanceSheet({ date, previousYear: showPreviousYear }, signal);
      const curr = raw?.current || raw || {};
      const prev = raw?.previous || null;
      const mapAccounts = (accounts: any[]): BSAccount[] => (accounts || []).map((a: any) => ({
        accountId: a.code || a.accountId || '',
        codigo: a.code || '',
        cuenta: a.name || a.cuenta || '',
        currentAmount: (a.balance || 0) + (a.calculatedBalance || 0),
        previousAmount: undefined,
      }));
      const result: BSData = {
        assets: mapAccounts(curr.activos?.accounts),
        liabilities: mapAccounts(curr.pasivos?.accounts),
        equity: mapAccounts(curr.patrimonio?.accounts),
        totalAssets: curr.activos?.total || 0,
        totalLiabilities: curr.pasivos?.total || 0,
        totalEquity: curr.patrimonio?.total || 0,
        totalAssetsPrev: prev?.activos?.total || 0,
        totalLiabilitiesPrev: prev?.pasivos?.total || 0,
        totalEquityPrev: prev?.patrimonio?.total || 0,
      };
      if (prev) {
        const prevAssetMap = new Map((prev.activos?.accounts || []).map((a: any) => [a.code, (a.balance || 0) + (a.calculatedBalance || 0)]));
        const prevLiabMap = new Map((prev.pasivos?.accounts || []).map((a: any) => [a.code, (a.balance || 0) + (a.calculatedBalance || 0)]));
        const prevEqMap = new Map((prev.patrimonio?.accounts || []).map((a: any) => [a.code, (a.balance || 0) + (a.calculatedBalance || 0)]));
        result.assets = result.assets.map(a => ({ ...a, previousAmount: prevAssetMap.get(a.codigo) as number | undefined }));
        result.liabilities = result.liabilities.map(a => ({ ...a, previousAmount: prevLiabMap.get(a.codigo) as number | undefined }));
        result.equity = result.equity.map(a => ({ ...a, previousAmount: prevEqMap.get(a.codigo) as number | undefined }));
      }
      return result;
    },
  );
  const data = query.data;
  const loading = query.isLoading || query.isFetching;
  useEffect(() => {
    if (query.error) toast.error(query.error.message || 'Error al cargar balance general');
  }, [query.error]);

  const totalActivos = data?.totalAssets || 0;
  const totalPasivos = data?.totalLiabilities || 0;
  const totalPatrimonio = data?.totalEquity || 0;
  const totalPasivoPatrimonio = totalPasivos + totalPatrimonio;
  const isBalanced = Math.abs(totalActivos - totalPasivoPatrimonio) < 0.01;
  const difference = totalActivos - totalPasivoPatrimonio;

  const fmt = (n: number) => n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderSection = (title: string, accounts: BSAccount[], total: number, totalPrev: number, headerClass: string) => (
    <div className="mb-6">
      <div className={cn("px-4 py-2 rounded-t-lg font-black text-sm uppercase tracking-widest text-white", headerClass)}>
        {title}
        <span className="ml-2 text-[10px] opacity-70">({accounts.length} cuentas)</span>
      </div>
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Código</TableHead>
            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cuenta</TableHead>
            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Monto Actual</TableHead>
            {showPreviousYear && (
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Año Anterior</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((acc, i) => (
            <TableRow key={acc.accountId || i} className="hover:bg-muted/30 border-border/30">
              <TableCell className="font-mono text-xs">{acc.codigo}</TableCell>
              <TableCell className="font-medium">{acc.cuenta}</TableCell>
              <TableCell className={cn("text-right font-mono text-sm font-bold", acc.currentAmount >= 0 ? "text-emerald-600" : "text-red-600")}>
                {fmt(acc.currentAmount)}
              </TableCell>
              {showPreviousYear && (
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {acc.previousAmount != null ? fmt(acc.previousAmount) : '-'}
                </TableCell>
              )}
            </TableRow>
          ))}
          <TableRow className="bg-muted/50 font-bold border-t-2 border-border">
            <TableCell colSpan={2} className="text-sm uppercase tracking-wider">Total {title}</TableCell>
            <TableCell className={cn("text-right font-mono text-sm", total >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt(total)}</TableCell>
            {showPreviousYear && (
              <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmt(totalPrev)}</TableCell>
            )}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-5 bg-muted/30 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-[0.2em] bg-background/50 px-3 py-1.5 rounded-lg border border-border/30 shrink-0">
          <Filter className="size-3.5" /> Filtros
        </div>
        <div className="flex flex-wrap items-center gap-4 flex-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Fecha</label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 w-[150px]" />
          </div>
          <div className="flex items-center gap-3 mt-5">
            <Switch id="prev-year" checked={showPreviousYear} onCheckedChange={setShowPreviousYear} />
            <label htmlFor="prev-year" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground cursor-pointer select-none">
              Comparar año anterior
            </label>
          </div>
        </div>
        <div className="lg:ml-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-border/20">
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={loading} className="h-9">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Actualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold">Balance General</CardTitle>
              {date && (
                <p className="text-xs text-muted-foreground mt-1">
                  Al {new Date(date).toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>
            <Badge
              variant={isBalanced ? "default" : "destructive"}
              className={cn("text-[10px] font-black uppercase tracking-widest gap-1", isBalanced && "bg-emerald-600")}
            >
              {isBalanced ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
              {isBalanced ? 'Balanceado' : 'Diferencia: ' + fmt(difference)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Cargando...</div>
          ) : !data ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Seleccione una fecha para ver el reporte</div>
          ) : (
            <ScrollArea className="max-h-[70vh]">
              {renderSection('ACTIVOS', data.assets, data.totalAssets, data.totalAssetsPrev, 'bg-blue-600')}
              <Separator className="my-4" />
              {renderSection('PASIVOS', data.liabilities, data.totalLiabilities, data.totalLiabilitiesPrev, 'bg-amber-600')}
              <Separator className="my-4" />
              {renderSection('PATRIMONIO', data.equity, data.totalEquity, data.totalEquityPrev, 'bg-purple-600')}
              <Separator className="my-4" />

              <div className={cn("rounded-xl border-2 p-5", isBalanced ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800" : "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800")}>
                <div className="flex items-center gap-4">
                  <Scale className={cn("size-10", isBalanced ? "text-emerald-500" : "text-red-500")} />
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Verificación Contable</p>
                    <p className={cn("text-lg font-black", isBalanced ? "text-emerald-600" : "text-red-600")}>
                      {isBalanced ? 'Total Activos = Total Pasivos + Total Patrimonio' : `Diferencia: ${fmt(difference)}`}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">Total Activos</p>
                    <p className="text-lg font-black text-blue-600">{fmt(totalActivos)}</p>
                  </div>
                  <div className="bg-amber-500/10 rounded-lg p-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Total Pasivos</p>
                    <p className="text-lg font-black text-amber-600">{fmt(totalPasivos)}</p>
                  </div>
                  <div className="bg-purple-500/10 rounded-lg p-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-purple-600">Total Patrimonio</p>
                    <p className="text-lg font-black text-purple-600">{fmt(totalPatrimonio)}</p>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    Pasivos + Patrimonio = <span className="font-bold">{fmt(totalPasivoPatrimonio)}</span>
                  </p>
                </div>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
