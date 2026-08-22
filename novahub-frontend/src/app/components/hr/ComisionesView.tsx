import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeDollarSign, Download, ChevronDown, ChevronRight, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { cn } from '../ui/utils';
import { hrService } from '../../services/hr.service';
import { formatDateEs } from '../../utils/dateFormat';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  EARNED: 'Devengada',
  PAID_IN_PAYROLL: 'Pagada en nómina',
};
const STATUS_TONES: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-500 border-amber-500/20',
  EARNED: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
  PAID_IN_PAYROLL: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
};

const fmt = (value: number, currency: string) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value || 0);

export function ComisionesView() {
  const { canPerform } = useAuth();
  const canViewHr = canPerform('HR', 'view');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('ALL');
  const [sellerId, setSellerId] = useState('ALL');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const commissionFilters = {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(status !== 'ALL' ? { status } : {}),
    ...(sellerId !== 'ALL' ? { sellerId } : {}),
  };

  const query = useQuery({
    queryKey: ['hr', 'comisiones', { from, to, status, sellerId }],
    queryFn: ({ signal }) =>
      hrService.getCommissionReport(
        { ...commissionFilters, page: 1, pageSize: 500 },
        signal,
      ),
    enabled: canViewHr,
  });

  const report = query.data as any;
  const baseCurrency: string = report?.baseCurrency || 'NIO';
  const sellers: any[] = report?.sellers || [];
  const summary = report?.summary || {};

  const sellerOptions = sellers.map((s) => s.seller);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const downloadCsv = async () => {
    if (!report || query.isLoading || query.isError || exporting) return;
    setExporting(true);
    try {
      const pageSize = 500;
      const total = Number(report.total || report.items?.length || 0);
      const pageCount = Math.max(1, Math.ceil(total / pageSize));
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
          hrService.getCommissionReport({ ...commissionFilters, page: index + 2, pageSize }),
        ),
      );
      const items = [
        ...(report.items || []),
        ...remainingPages.flatMap((page: any) => page?.items || []),
      ];
      if (!items.length) {
        toast.info('No hay comisiones para exportar con los filtros seleccionados');
        return;
      }

      const rows: string[][] = [
        ['Vendedor', 'Código', 'Departamento', 'Factura', 'Fecha', 'Cliente', 'Total venta (base)', 'Tipo', 'Tasa/Monto', 'Comisión (base)', 'Estado', 'Nómina'],
      ];
      for (const item of items) {
        rows.push([
          item.seller?.name || '',
          item.seller?.employeeNumber || '',
          item.seller?.department || '',
          item.invoice?.number || '',
          item.invoice?.date ? formatDateEs(item.invoice.date) : '',
          item.invoice?.customer || '',
          String(item.invoice?.totalBase ?? ''),
          item.commissionType,
          String(item.commissionType === 'PERCENTAGE' ? item.rate + '%' : item.amount),
          String(item.amountBase),
          item.status,
          item.payroll?.periodStart ? `${formatDateEs(item.payroll.periodStart)} - ${formatDateEs(item.payroll.periodEnd)}` : '',
        ]);
      }
      const summaryRows: string[][] = [
        ['Vendedor', 'Código', 'Departamento', 'Facturas', 'Ventas (base)', 'Comisiones (base)', 'Pendiente (base)', 'Devengada (base)', 'Pagada (base)'],
        ...(report.sellers || []).map((seller: any) => [
          seller.seller?.name || '',
          seller.seller?.employeeNumber || '',
          seller.seller?.department || '',
          String(seller.invoiceCount ?? 0),
          String(seller.salesBase ?? 0),
          String(seller.commissionBase ?? 0),
          String(seller.pendingBase ?? 0),
          String(seller.earnedBase ?? 0),
          String(seller.paidBase ?? 0),
        ]),
      ];
      const workbook = XLSX.utils.book_new();
      const detailSheet = XLSX.utils.aoa_to_sheet(rows);
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      detailSheet['!cols'] = [
        { wch: 24 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 13 }, { wch: 28 },
        { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 24 },
      ];
      summarySheet['!cols'] = [
        { wch: 24 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 18 },
        { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detalle');
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
      XLSX.writeFile(workbook, `reporte-comisiones-${from || 'inicio'}-${to || 'hoy'}.xlsx`);
      toast.success(`Reporte Excel de comisiones descargado (${items.length} registro(s))`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo preparar el reporte de comisiones');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Desde</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[160px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hasta</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[160px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="PENDING">Pendiente</SelectItem>
                <SelectItem value="EARNED">Devengada</SelectItem>
                <SelectItem value="PAID_IN_PAYROLL">Pagada en nómina</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vendedor</Label>
            <Select value={sellerId} onValueChange={setSellerId}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los vendedores</SelectItem>
                {sellerOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={downloadCsv} disabled={exporting || query.isLoading || query.isError} className="gap-2 h-9">
          <Download className="size-4" /> {exporting ? 'Preparando…' : 'Exportar Excel'}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Vendedores', value: String(summary.sellerCount || 0), tone: 'text-foreground' },
          { label: 'Ventas (base)', value: fmt(Number(summary.salesBase || 0), baseCurrency), tone: 'text-foreground' },
          { label: 'Comisiones', value: fmt(Number(summary.commissionBase || 0), baseCurrency), tone: 'text-primary' },
          { label: 'Pendiente', value: fmt(Number(summary.pendingBase || 0), baseCurrency), tone: 'text-amber-500' },
          { label: 'Pagada', value: fmt(Number(summary.paidBase || 0), baseCurrency), tone: 'text-emerald-500' },
        ].map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{card.label}</p>
              <p className={cn('text-lg font-black tracking-tight', card.tone)}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {query.isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="size-10 border-4 border-muted border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : sellers.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No hay comisiones de vendedores para los filtros seleccionados.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BadgeDollarSign className="size-5 text-primary" />
              Comisiones por vendedor
              <Badge className="ml-auto bg-primary/10 text-primary border-primary/20 text-[10px] font-black">{report?.total ?? 0} registros</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-8" />
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead className="text-right">Facturas</TableHead>
                  <TableHead className="text-right">Ventas (base)</TableHead>
                  <TableHead className="text-right">Comisiones (base)</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead className="text-right">Pagada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellers.map((s) => {
                  const isOpen = expanded.has(s.seller.id);
                  return (
                    <>
                      <TableRow key={s.seller.id} className="cursor-pointer" onClick={() => toggleExpand(s.seller.id)}>
                        <TableCell>{isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Users className="size-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-bold leading-tight">{s.seller.name}</p>
                              <p className="text-[10px] text-muted-foreground">{s.seller.employeeNumber || '—'}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.seller.department || '—'}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">{s.invoiceCount}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(s.salesBase, baseCurrency)}</TableCell>
                        <TableCell className="text-right text-sm font-bold text-primary">{fmt(s.commissionBase, baseCurrency)}</TableCell>
                        <TableCell className="text-right text-sm text-amber-500">{fmt(s.pendingBase, baseCurrency)}</TableCell>
                        <TableCell className="text-right text-sm text-emerald-500">{fmt(s.paidBase, baseCurrency)}</TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <TableCell colSpan={8} className="p-0 border-0">
                            <div className="bg-muted/20 px-6 py-4">
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="text-[10px] uppercase tracking-widest">Factura</TableHead>
                                    <TableHead className="text-[10px] uppercase tracking-widest">Fecha</TableHead>
                                    <TableHead className="text-[10px] uppercase tracking-widest">Cliente</TableHead>
                                    <TableHead className="text-right text-[10px] uppercase tracking-widest">Total venta</TableHead>
                                    <TableHead className="text-right text-[10px] uppercase tracking-widest">Comisión</TableHead>
                                    <TableHead className="text-center text-[10px] uppercase tracking-widest">Estado</TableHead>
                                    <TableHead className="text-[10px] uppercase tracking-widest">Nómina</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(report?.items || [])
                                    .filter((i: any) => i.seller?.id === s.seller.id)
                                    .map((item: any) => (
                                      <TableRow key={item.id}>
                                        <TableCell className="text-sm font-semibold">{item.invoice?.number || '—'}</TableCell>
                                        <TableCell className="text-sm">{item.invoice?.date ? formatDateEs(item.invoice.date) : '—'}</TableCell>
                                        <TableCell className="text-sm">{item.invoice?.customer || '—'}</TableCell>
                                        <TableCell className="text-right text-sm">{fmt(item.invoice?.totalBase ?? 0, baseCurrency)}</TableCell>
                                        <TableCell className="text-right text-sm font-semibold">
                                          {item.commissionType === 'PERCENTAGE' ? `${item.rate}%` : fmt(item.amount, baseCurrency)} → {fmt(item.amountBase, baseCurrency)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <Badge className={cn('text-[9px] font-black uppercase tracking-widest border', STATUS_TONES[item.status])}>
                                            {STATUS_LABELS[item.status] || item.status}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">{item.payroll?.periodStart ? `${formatDateEs(item.payroll.periodStart)} - ${formatDateEs(item.payroll.periodEnd)}` : '—'}</TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
