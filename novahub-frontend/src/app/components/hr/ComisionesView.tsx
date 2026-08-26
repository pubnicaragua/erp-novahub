import { Fragment, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BadgeDollarSign, Download, ChevronDown, ChevronRight, RefreshCw, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { cn } from '../ui/utils';
import { hrService } from '../../services/hr.service';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  EARNED: 'Devengada',
  PAID_IN_PAYROLL: 'Pagada en nómina',
  PAID: 'Pagada',
  PARTIAL: 'Parcial',
  OVERDUE: 'Vencida',
  CREDIT: 'A crédito',
  CANCELLED: 'Anulada',
};
const STATUS_TONES: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-500 border-amber-500/20',
  EARNED: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
  PAID_IN_PAYROLL: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
};

const fmt = (value: number, currency: string) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value || 0);

const formatCommissionDate = (value: string | Date | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    .format(date)
    .replace(', ', ' ');
};

const fmtNumber = (value: unknown) =>
  new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);

const getCommissionLines = (item: any, baseCurrency: string) => {
  if (Array.isArray(item.invoice?.commissionLines) && item.invoice.commissionLines.length) {
    return item.invoice.commissionLines;
  }

  return [{
    seller: item.seller?.name || '',
    date: item.invoice?.date,
    brand: '—',
    code: '—',
    quantity: 1,
    price1: Number(item.invoice?.total || 0),
    totalP1: Number(item.invoice?.total || 0),
    salePrice: Number(item.invoice?.total || 0),
    totalSale: Number(item.invoice?.total || 0),
    difference: 0,
    priceType: 'Precio Normal',
    invoiceNumber: item.invoice?.number || '',
    customer: item.invoice?.customer || 'Cliente General',
    paymentForm: 'Contado',
    paymentDetail: 'Pendiente',
    status: item.invoice?.status || item.status,
    currency: item.invoice?.currency || baseCurrency,
  }];
};

export function ComisionesView() {
  const { canPerform } = useAuth();
  // The backend protects this endpoint with the HR read permission.
  // Keep the query aligned with that guard so a visible tab cannot silently render zeros.
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

  const rawReport = query.data as any;
  const report = rawReport?.data ?? rawReport;
  const baseCurrency: string = report?.baseCurrency || 'NIO';
  const sellers: any[] = report?.sellers || [];
  const summary = report?.summary || {};

  const sellerOptions = sellers.map((s) => s.seller);

  useEffect(() => {
    if (sellerId === 'ALL') return;
    setExpanded(new Set([sellerId]));
  }, [sellerId]);

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

      const headers = ['Vendedor', 'Fecha', 'Marca', 'Codigo', 'Cantidad', 'Precio1', 'Total P1', 'Precio Venta', 'Total Venta', 'Diferencia', 'Tipo Precio', 'Factura', 'Cliente', 'Forma de Pago', 'Forma de Pago Detallada', 'Estado'];
      const rows: unknown[][] = [headers];
      let lastSeller = '';
      for (const item of items) {
        const lines = Array.isArray(item.invoice?.commissionLines) && item.invoice.commissionLines.length
          ? item.invoice.commissionLines
          : [{ seller: item.seller?.name || '', date: item.invoice?.date, brand: '—', code: '—', quantity: 1, price1: Number(item.invoice?.total || 0), totalP1: Number(item.invoice?.total || 0), salePrice: Number(item.invoice?.total || 0), totalSale: Number(item.invoice?.total || 0), difference: 0, priceType: 'Precio Normal', invoiceNumber: item.invoice?.number || '', customer: item.invoice?.customer || 'Cliente General', paymentForm: 'Contado', paymentDetail: 'Pendiente', status: item.invoice?.status || item.status, currency: item.invoice?.currency || baseCurrency }];
        for (const line of lines) {
          const seller = line.seller || item.seller?.name || '';
          if (seller !== lastSeller) {
            rows.push([seller, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
            lastSeller = seller;
          }
          rows.push([
            seller,
            formatCommissionDate(line.date),
            line.brand || '—',
            line.code || '—',
            Number(line.quantity || 0),
            Number(line.price1 || 0),
            Number(line.totalP1 || 0),
            Number(line.salePrice || 0),
            Number(line.totalSale || 0),
            Number(line.difference || 0),
            line.priceType || 'Precio Normal',
            line.invoiceNumber || item.invoice?.number || '',
            line.customer || item.invoice?.customer || 'Cliente General',
            line.paymentForm || 'Contado',
            line.paymentDetail || 'Pendiente',
            STATUS_LABELS[line.status] || line.status || '',
          ]);
        }
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
        { wch: 24 }, { wch: 19 }, { wch: 18 }, { wch: 22 }, { wch: 11 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
        { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 26 }, { wch: 18 },
      ];
      for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const isGroupRow = rows[rowIndex].slice(1).every((value) => value === '');
        if (isGroupRow) continue;
        for (const columnIndex of [4, 5, 6, 7, 8, 9]) {
          const cell = detailSheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
          if (cell && typeof cell.v === 'number') cell.z = '#,##0.00';
        }
      }
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

      {query.isError ? (
        <Alert variant="destructive" className="border-red-500/30 bg-red-500/5">
          <AlertTriangle className="size-4" />
          <AlertTitle>No se pudo cargar el reporte de comisiones</AlertTitle>
          <AlertDescription className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span>{query.error instanceof Error ? query.error.message : 'El servidor no devolvió el detalle de comisiones.'}</span>
            <Button variant="outline" size="sm" onClick={() => query.refetch()} className="gap-2">
              <RefreshCw className="size-3.5" /> Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : query.isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="size-10 border-4 border-muted border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : sellers.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 p-10 text-center">
            <p className="text-sm font-semibold text-foreground">No hay comisiones de vendedores para los filtros seleccionados.</p>
            <p className="text-xs text-muted-foreground">Verifica que el empleado esté marcado como vendedor y que existan facturas con comisión generada.</p>
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
                    <Fragment key={s.seller.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => toggleExpand(s.seller.id)}
                        aria-expanded={isOpen}
                      >
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
                            <div className="space-y-3 bg-muted/20 px-4 py-4 sm:px-6">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                                Detalle de ventas y comisiones de {s.seller.name}
                              </p>
                              <div className="overflow-x-auto rounded-xl border border-border/50 bg-background/70">
                              <Table className="min-w-[1560px]">
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    {['Vendedor', 'Fecha', 'Marca', 'Código', 'Cantidad', 'Precio1', 'Total P1', 'Precio Venta', 'Total Venta', 'Diferencia', 'Tipo Precio', 'Factura', 'Cliente', 'Forma de Pago', 'Forma de Pago Detallada', 'Estado'].map((heading) => (
                                      <TableHead key={heading} className="whitespace-nowrap text-[10px] uppercase tracking-widest">{heading}</TableHead>
                                    ))}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(report?.items || [])
                                    .filter((item: any) => item.seller?.id === s.seller.id)
                                    .flatMap((item: any) => getCommissionLines(item, baseCurrency).map((line: any, index: number) => ({ item, line, index })))
                                    .map(({ item, line, index }: any) => (
                                      <TableRow key={`${item.id}-${index}`}>
                                        <TableCell className="whitespace-nowrap text-sm font-semibold">{line.seller || item.seller?.name || '—'}</TableCell>
                                        <TableCell className="whitespace-nowrap text-sm">{formatCommissionDate(line.date) || '—'}</TableCell>
                                        <TableCell className="text-sm">{line.brand || '—'}</TableCell>
                                        <TableCell className="whitespace-nowrap text-sm">{line.code || '—'}</TableCell>
                                        <TableCell className="text-right text-sm">{fmtNumber(line.quantity)}</TableCell>
                                        <TableCell className="text-right text-sm">{fmtNumber(line.price1)}</TableCell>
                                        <TableCell className="text-right text-sm">{fmtNumber(line.totalP1)}</TableCell>
                                        <TableCell className="text-right text-sm">{fmtNumber(line.salePrice)}</TableCell>
                                        <TableCell className="text-right text-sm font-semibold">{fmtNumber(line.totalSale)}</TableCell>
                                        <TableCell className="text-right text-sm font-semibold text-primary">{fmtNumber(line.difference)}</TableCell>
                                        <TableCell className="whitespace-nowrap text-sm">{line.priceType || 'Precio Normal'}</TableCell>
                                        <TableCell className="whitespace-nowrap text-sm font-semibold">{line.invoiceNumber || item.invoice?.number || '—'}</TableCell>
                                        <TableCell className="min-w-[220px] text-sm">{line.customer || item.invoice?.customer || 'Cliente General'}</TableCell>
                                        <TableCell className="whitespace-nowrap text-sm">{line.paymentForm || 'Contado'}</TableCell>
                                        <TableCell className="min-w-[190px] text-sm">{line.paymentDetail || 'Pendiente'}</TableCell>
                                        <TableCell>
                                          <Badge className={cn('whitespace-nowrap text-[9px] font-black uppercase tracking-widest border', STATUS_TONES[line.status] || 'bg-muted text-muted-foreground border-border')}>
                                            {STATUS_LABELS[line.status] || line.status || 'Pendiente'}
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
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
