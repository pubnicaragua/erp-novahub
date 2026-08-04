import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Search, Printer, RefreshCw, Filter, X } from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { toast } from 'sonner';
import { useAccountingQuery } from '../../hooks/useAccountingQuery';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ASSET: 'ACTIVOS',
  LIABILITY: 'PASIVOS',
  EQUITY: 'PATRIMONIO',
  INCOME: 'INGRESOS',
  EXPENSE: 'GASTOS',
};

const ACCOUNT_TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

interface TrialBalanceRow {
  accountId: string;
  codigo: string;
  cuenta: string;
  tipo: string;
  debitos: number;
  creditos: number;
  saldo: number;
}

export function BalanceComprobacionView() {
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(`${today.getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(today.toISOString().slice(0, 10));
  const [searchTerm, setSearchTerm] = useState('');
  const query = useAccountingQuery<TrialBalanceRow[]>(
    ['trial-balance', dateFrom, dateTo],
    async (signal) => {
      const params: { dateFrom?: string; dateTo?: string } = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const raw: any = await contabilidadService.getTrialBalance(params, signal);
      return (raw?.rows || raw || []).map((r: any) => ({
        accountId: r.accountId || r.accountCode || '',
        codigo: r.accountCode || r.codigo || '',
        cuenta: r.accountName || r.cuenta || '',
        tipo: r.accountType || r.tipo || '',
        debitos: r.totalDebit || r.debitos || 0,
        creditos: r.totalCredit || r.creditos || 0,
        saldo: r.balance || r.saldo || 0,
      }));
    },
    { enabled: Boolean(dateFrom || dateTo) },
  );
  const data = query.data || [];
  const loading = query.isLoading || query.isFetching;
  useEffect(() => {
    if (query.error) toast.error(query.error.message || 'Error al cargar balance de comprobación');
  }, [query.error]);

  const grouped = useMemo(() => ACCOUNT_TYPE_ORDER.map(type => ({
    type,
    label: ACCOUNT_TYPE_LABELS[type],
    rows: data
      .filter(r => r.tipo === type)
      .filter(r => !searchTerm || r.cuenta.toLowerCase().includes(searchTerm.toLowerCase()) || r.codigo.toLowerCase().includes(searchTerm.toLowerCase())),
  })).filter(g => g.rows.length > 0), [data, searchTerm]);

  const totalDebitos = data.reduce((s, r) => s + r.debitos, 0);
  const totalCreditos = data.reduce((s, r) => s + r.creditos, 0);
  const totalSaldos = data.reduce((s, r) => s + Math.abs(r.saldo), 0);
  const isBalanced = Math.abs(totalDebitos - totalCreditos) < 0.01;

  const fmt = (n: number) => n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error('Permita ventanas emergentes para imprimir'); return; }
    const style = `
      <style>
        @page { margin: 15mm; size: landscape; }
        body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
        h1 { font-size: 16px; margin-bottom: 2px; text-align: center; }
        h2 { font-size: 12px; color: #666; text-align: center; margin-top: 0; font-weight: normal; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #1e3a5f; color: white; padding: 6px 8px; text-align: left; font-size: 9px; text-transform: uppercase; }
        td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
        .group-header { background: #f0f4f8; font-weight: bold; font-size: 10px; text-transform: uppercase; color: #1e3a5f; }
        .total-row { background: #e8f0fe; font-weight: bold; border-top: 2px solid #1e3a5f; }
        .balanced { color: #059669; }
        .not-balanced { color: #dc2626; }
        .positive { color: #059669; }
        .negative { color: #dc2626; }
        .text-right { text-align: right; }
      </style>`;
    const title = 'Balance de Comprobación';
    const period = dateFrom || dateTo ? `Período: ${dateFrom || 'Inicio'} - ${dateTo || 'Actual'}` : '';
    const buildRows = () => {
      let html = '';
      grouped.forEach(g => {
        html += `<tr class="group-header"><td colspan="6">${g.label}</td></tr>`;
        g.rows.forEach(r => {
          const saldoClass = r.saldo >= 0 ? 'positive' : 'negative';
          html += `<tr>
            <td>${r.codigo}</td>
            <td>${r.cuenta}</td>
            <td>${r.tipo}</td>
            <td class="text-right">${fmt(r.debitos)}</td>
            <td class="text-right">${fmt(r.creditos)}</td>
            <td class="text-right ${saldoClass}">${fmt(r.saldo)}</td>
          </tr>`;
        });
      });
      return html;
    };
    printWindow.document.write(`<!DOCTYPE html><html><head>${style}</head><body>
      <h1>${title}</h1>
      ${period ? `<h2>${period}</h2>` : ''}
      <table>
        <thead><tr>
          <th>Código</th><th>Cuenta</th><th>Tipo</th>
          <th class="text-right">Débitos</th><th class="text-right">Créditos</th><th class="text-right">Saldo</th>
        </tr></thead>
        <tbody>${buildRows()}</tbody>
        <tfoot>
          <tr class="total-row"><td colspan="3">TOTALES</td>
            <td class="text-right">${fmt(totalDebitos)}</td>
            <td class="text-right">${fmt(totalCreditos)}</td>
            <td class="text-right">${fmt(totalSaldos)}</td>
          </tr>
          <tr class="total-row"><td colspan="6" class="${isBalanced ? 'balanced' : 'not-balanced'}">
            ${isBalanced ? '✓ BALANCEADO — Débitos = Créditos' : '✗ NO BALANCEADO — Débitos ≠ Créditos'}
          </td></tr>
        </tfoot>
      </table>
      <p style="text-align:center;color:#999;font-size:8px;margin-top:16px;">
        Generado el ${new Date().toLocaleDateString('es-NI')} a las ${new Date().toLocaleTimeString('es-NI')}
      </p>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
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
        <div className="flex items-center gap-3 lg:ml-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-border/20">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar cuenta..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 w-[200px]" />
          </div>
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={loading} className="h-9">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="h-9">
            <Printer className="size-4" /> Imprimir
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center justify-between">
            <span>Balance de Comprobación</span>
            <Badge variant={isBalanced ? "default" : "destructive"} className="text-[10px] font-black uppercase tracking-widest">
              {isBalanced ? '✓ Balanceado' : '✗ No Balanceado'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[70vh]">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Código</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cuenta</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tipo</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Débitos</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Créditos</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : grouped.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No hay datos</TableCell></TableRow>
                ) : grouped.flatMap((group, gi) => [
                  <TableRow key={`group-${gi}`} className="bg-primary/5 hover:bg-primary/10 border-b-2 border-primary/20">
                    <TableCell colSpan={6} className="py-2">
                      <span className="text-xs font-black uppercase tracking-widest text-primary">{group.label}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground">({group.rows.length} cuentas)</span>
                    </TableCell>
                  </TableRow>,
                  ...group.rows.map((row, ri) => (
                    <TableRow key={`row-${gi}-${ri}`} className="hover:bg-muted/30 border-border/30">
                      <TableCell className="font-mono text-xs">{row.codigo}</TableCell>
                      <TableCell className="font-medium">{row.cuenta}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider">{row.tipo}</Badge>
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-sm", row.debitos > 0 && "text-emerald-600")}>{fmt(row.debitos)}</TableCell>
                      <TableCell className={cn("text-right font-mono text-sm", row.creditos > 0 && "text-emerald-600")}>{fmt(row.creditos)}</TableCell>
                      <TableCell className={cn("text-right font-mono text-sm font-bold", row.saldo >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {fmt(row.saldo)}
                      </TableCell>
                    </TableRow>
                  )),
                ])}
              </TableBody>
            </Table>
          </ScrollArea>
          <Separator />
          <div className={cn("px-6 py-4 flex items-center justify-between font-bold", isBalanced ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20")}>
            <span className="text-sm uppercase tracking-wider">Totales</span>
            <div className="flex items-center gap-8 text-sm">
              <span className={cn(totalDebitos > 0 && "text-emerald-600")}>{fmt(totalDebitos)}</span>
              <span className={cn(totalCreditos > 0 && "text-emerald-600")}>{fmt(totalCreditos)}</span>
              <span className={cn("font-black", isBalanced ? "text-emerald-600" : "text-red-600")}>
                {isBalanced ? '✓ BALANCEADO' : '✗ NO BALANCEADO'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
