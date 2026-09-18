import { useState } from 'react';
import * as XLSX from 'xlsx';
import { History, ArrowUpRight, ArrowDownLeft, RefreshCcw, Search, Download, CircleHelp, Package, X, ArrowRightLeft, CalendarDays, UserRound, Warehouse, Loader2 } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { DateField } from '../ui/DateField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import type { SalesPaginationControls } from '../../types';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { useDetailOpeningFeedback } from '../../hooks/useDetailOpeningFeedback';
import { buildDateFilteredDownloadFileName } from '../../utils/exportFileNames';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { useAuth } from '../../contexts/AuthContext';

export type MovementExportOptions = {
  amount: number | 'all';
  sortOrder: 'asc' | 'desc';
};

interface MovimientosViewProps {
  movements: any[];
  warehouses: any[];
  pagination?: SalesPaginationControls;
  onExportData?: (options: MovementExportOptions) => Promise<any[]>;
  onSearchChange?: (value: string) => void;
  onTypeChange?: (value: string) => void;
  onWarehouseChange?: (value: string) => void;
  onDateChange?: (from: string, to: string) => void;
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'IN', label: 'Entrada' },
  { value: 'OUT', label: 'Salida' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'ADJUSTMENT', label: 'Ajuste' },
];

// Referencias compuestas (p. ej. "PURCHASE_RECEIPT:uuid:uuid:uuid") se
// muestran de forma legible: tipo en español + primeros 8 caracteres del id.
const REFERENCE_TYPE_LABELS: Record<string, string> = {
  PURCHASE_RECEIPT: 'Recepción de compra',
  SALE: 'Venta',
  SALE_RETURN: 'Devolución de venta',
  INVENTORY_ADJUSTMENT: 'Ajuste de inventario',
  TRANSFER: 'Transferencia',
  PURCHASE: 'Compra',
  STOCK_INITIAL: 'Stock inicial',
  SALES_ORDER: 'Orden de venta',
  SUPPLIER_INVOICE: 'Factura de compra',
  CATALOG_IMPORT: 'Importación de catálogo',
  MANAGER_IMPORT: 'Importación de inventario',
  STOCK_IMPORT: 'Importación de existencias',
  STOCK_ADJUSTMENT: 'Ajuste de existencias',
  INVENTORY_LOSS: 'Pérdida de inventario',
  INITIAL_STOCK: 'Stock inicial',
  PRODUCT_CREATE: 'Alta de producto',
  PRODUCT_UPDATE: 'Actualización de producto',
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  IN: 'Entrada',
  OUT: 'Salida',
  TRANSFER: 'Transferencia',
  TRANSFER_IN: 'Transferencia de entrada',
  TRANSFER_OUT: 'Transferencia de salida',
  ADJUSTMENT: 'Ajuste',
};

export function formatMovementReference(reference: string | null | undefined): { label: string; full: string } {
  const raw = reference || '';
  const full = raw;
  if (!raw) return { label: '—', full: '' };
  const parts = raw.split(':');
  if (parts.length > 1) {
    const type = parts[0].toUpperCase();
    const label = REFERENCE_TYPE_LABELS[type] || type;
    const shortId = parts[1]?.slice(0, 8);
    return { label: shortId ? `${label} · ${shortId}` : label, full };
  }
  return { label: raw, full };
}

function formatMovementReferenceForExport(reference: string | null | undefined) {
  const raw = String(reference || '').trim();
  if (!raw) return '—';
  const { label } = formatMovementReference(raw);
  // Las referencias automáticas contienen UUID y posiciones internas que no
  // ayudan al usuario final del reporte. Conservamos solo su descripción.
  if (raw.includes(':')) return label.split(' · ')[0] || '—';
  return label.length > 80 ? `${label.slice(0, 77).trim()}…` : label;
}

function formatMovementNumberForExport(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return Number(number.toFixed(4));
}

const MOVEMENTS_TOUR_STEPS: GuidedTourStep[] = [
  { target: '[data-tour="movements-title"]', title: 'Movimientos de inventario', description: 'Consulta las entradas, salidas, transferencias y ajustes que modifican las existencias.', placement: 'bottom' },
  { target: '[data-tour="movements-filters"]', title: 'Buscar y filtrar', description: 'Busca por producto o referencia y combina el tipo de movimiento con el almacén. Al cambiar un criterio se reinicia la página.', placement: 'bottom' },
  { target: '[data-tour="movements-table"]', title: 'Detalle del movimiento', description: 'Haz clic en una fila para abrir el detalle del movimiento y consultar su origen y destino cuando corresponda.', placement: 'top' },
  { target: '[data-tour="movements-pagination"]', title: 'Paginación', description: 'Selecciona la cantidad de registros por página y utiliza los controles para revisar todo el historial.', placement: 'top' },
];

function MovementDetailsPanel({ movement, onClose, canViewInventoryCost }: { movement: any; onClose: () => void; canViewInventoryCost: boolean }) {
  const transferDetails = movement.transferDetails;
  const quantity = Number(movement.quantity || 0);
  const unitCost = Number(movement.baseCost ?? movement.unitCost ?? 0);
  const currency = String(movement.currency || 'NIO').toUpperCase();
  const typeLabel = TYPE_OPTIONS.find((option) => option.value === movement.type)?.label || movement.type || 'Movimiento';
  const isEntry = movement.type === 'IN';

  return (
    <Card className="h-fit min-w-0 overflow-hidden rounded-2xl border-border/60 bg-background/90 shadow-sm lg:sticky lg:top-4">
      <div className="flex items-start justify-between gap-3 border-b border-border/50 px-4 py-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Movimiento seleccionado</p>
          <h3 className="mt-1 truncate text-base font-black uppercase italic tracking-tight">Detalle del movimiento</h3>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            {isEntry ? <ArrowDownLeft className="size-3.5 text-success" /> : <ArrowUpRight className="size-3.5 text-destructive" />}
            <Badge variant="outline" className="text-[10px]">{typeLabel}</Badge>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} aria-label="Cerrar detalle del movimiento" title="Cerrar">
          <X className="size-4" />
        </Button>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
          <p className="truncate text-sm font-black" title={movement.product?.name || undefined}>{movement.product?.name || 'Producto sin nombre'}</p>
          <p className="mt-1 text-xs text-muted-foreground">Código: <span className="font-semibold text-foreground">{movement.product?.code || '—'}</span></p>
          {movement.variant && <p className="mt-1 truncate text-xs text-muted-foreground" title={movement.variant.name || movement.variant.sku || undefined}>Variante: <span className="font-semibold text-foreground">{movement.variant.name || movement.variant.sku || '—'}</span></p>}
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-3 text-xs">
          <div className="min-w-0"><p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground"><CalendarDays className="size-3" /> Fecha</p><p className="mt-1 font-semibold">{formatDateEs(movement.date, true)}</p></div>
          <div className="min-w-0"><p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground"><Warehouse className="size-3" /> Bodega afectada</p><p className="mt-1 truncate font-semibold" title={movement.warehouse?.name || undefined}>{movement.warehouse?.name || '—'}</p></div>
          <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Cantidad</p><p className={`mt-1 font-mono font-bold ${isEntry ? 'text-success' : movement.type === 'OUT' ? 'text-destructive' : 'text-primary'}`}>{movement.type === 'OUT' ? '-' : '+'}{quantity}</p></div>
          <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Stock</p><p className="mt-1 font-mono font-semibold">{movement.previousQty != null ? Number(movement.previousQty) : '—'} → {movement.resultingQty != null ? Number(movement.resultingQty) : '—'}</p></div>
          {canViewInventoryCost && <>
            <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Costo unitario</p><p className="mt-1 font-mono font-semibold">{unitCost > 0 ? <CurrencyValuationAmount amount={unitCost} sourceCurrency={currency} sourceExchangeRate={movement.exchangeRate} showRate /> : '—'}</p></div>
            <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Costo total</p><p className="mt-1 font-mono font-semibold">{unitCost > 0 ? <CurrencyValuationAmount amount={unitCost * quantity} sourceCurrency={currency} sourceExchangeRate={movement.exchangeRate} showRate /> : '—'}</p></div>
          </>}
        </div>

        <div className="space-y-2 rounded-xl border border-border/50 px-3 py-3 text-xs">
          <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground"><UserRound className="size-3" /> Usuario</p>
          <p className="font-semibold">{movement.user?.name || movement.userName || 'Movimiento automático'}</p>
          <p className="break-words text-muted-foreground">Referencia: <span className="font-semibold text-foreground">{movement.reference || '—'}</span></p>
        </div>

        {transferDetails && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-primary">
              <ArrowRightLeft className="size-3.5" />
              Origen y destino de la transferencia
            </div>
            <div className="mt-3 space-y-3 text-xs">
              <div className="rounded-lg border border-border/50 bg-background/70 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Origen</p>
                <p className="mt-1 font-bold">{transferDetails.origin.warehouseName}</p>
                <p className="mt-1 text-muted-foreground">Sucursal: <span className="font-semibold text-foreground">{transferDetails.origin.branchName || 'Almacén corporativo'}</span></p>
              </div>
              <div className="flex justify-center text-primary"><ArrowRightLeft className="size-4" /></div>
              <div className="rounded-lg border border-border/50 bg-background/70 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Destino</p>
                <p className="mt-1 font-bold">{transferDetails.destination.warehouseName}</p>
                <p className="mt-1 text-muted-foreground">Sucursal: <span className="font-semibold text-foreground">{transferDetails.destination.branchName || 'Almacén corporativo'}</span></p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export function MovimientosView({ movements, warehouses, pagination, onExportData, onSearchChange, onTypeChange, onWarehouseChange, onDateChange }: MovimientosViewProps) {
  const { canPerform } = useAuth();
  const canExportMovements = canPerform('INVENTORY_MOVEMENTS', 'export');
  const canViewInventoryCost = canPerform('INVENTORY_MOVEMENTS', 'viewCost');
  const { openingId, startOpening } = useDetailOpeningFeedback();
  const [showTutorial, setShowTutorial] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMovement, setSelectedMovement] = useState<any | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'page' | 'custom' | 'all'>('page');
  const [exportAmount, setExportAmount] = useState(String(pagination?.pageSize || 50));
  const [exportSortOrder, setExportSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isExporting, setIsExporting] = useState(false);
  const openMovement = (movement: any) => startOpening(movement.id, () => setSelectedMovement(movement));

  const filteredMovements = movements.filter(m => {
    const matchesSearch = !searchTerm || 
      m.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.reference?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || m.type === typeFilter;
    const matchesWarehouse = warehouseFilter === 'all' || m.warehouseId === warehouseFilter;
    return matchesSearch && matchesType && matchesWarehouse;
  });

  const colFilters = useColumnFilters();
  const filterGetters = {
    date: (m: any) => (m.date ? new Date(m.date).getTime() : null),
    type: (m: any) => String(m.type || ''),
    product: (m: any) => m.product?.name || 'Producto sin nombre',
    warehouse: (m: any) => m.warehouse?.name || '—',
  };
  const filteredData = colFilters.applyTo(filteredMovements, filterGetters);
  const typeOptionsForFilter = TYPE_OPTIONS.filter((t) => t.value !== 'all').map((t) => ({ value: t.value, label: t.label, count: filteredMovements.filter((m) => m.type === t.value).length }));
  const productOptions = [...new Map(filteredMovements.map((m) => [m.product?.name || 'Producto sin nombre', m.product?.name || 'Producto sin nombre'])).entries()]
    .map(([, label]) => ({ value: label, label, count: filteredMovements.filter((m) => (m.product?.name || 'Producto sin nombre') === label).length }));
  const warehouseOptions = [...new Map(filteredMovements.map((m) => [m.warehouse?.name || '—', m.warehouse?.name || '—'])).entries()]
    .map(([, label]) => ({ value: label, label, count: filteredMovements.filter((m) => (m.warehouse?.name || '—') === label).length }));

  const movementSummary = (() => {
    let entradas = 0;
    let salidas = 0;
    let stockTotal = 0;
    const lastByProductWarehouse = new Map<string, any>();
    for (const m of filteredMovements) {
      if (m.type === 'IN') entradas += Number(m.quantity || 0);
      if (m.type === 'OUT') salidas += Number(m.quantity || 0);
      const key = `${m.productId || m.product?.id}-${m.warehouseId || m.warehouse?.id}`;
      const existing = lastByProductWarehouse.get(key);
      const mDate = new Date(m.createdAt || m.date || 0).getTime();
      const eDate = existing ? new Date(existing.createdAt || existing.date || 0).getTime() : 0;
      if (!existing || mDate > eDate) lastByProductWarehouse.set(key, m);
    }
    for (const m of lastByProductWarehouse.values()) {
      stockTotal += Number(m.resultingQty ?? 0);
    }
    return { entradas, salidas, stockTotal };
  })();

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'IN': return <ArrowDownLeft className="size-4 text-success" />;
      case 'OUT': return <ArrowUpRight className="size-4 text-destructive" />;
      case 'TRANSFER': return <RefreshCcw className="size-4 text-info" />;
      default: return <History className="size-4 text-muted-foreground" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const normalizedType = String(type || '').toUpperCase();
    return MOVEMENT_TYPE_LABELS[normalizedType] || TYPE_OPTIONS.find(t => t.value === normalizedType)?.label || type || 'Movimiento';
  };

  const totalMovements = pagination?.total ?? filteredMovements.length;
  const sortMovements = (rows: any[], sortOrder: 'asc' | 'desc') => [...rows].sort((left, right) => {
    const leftDate = new Date(left.createdAt || left.date || 0).getTime();
    const rightDate = new Date(right.createdAt || right.date || 0).getTime();
    const difference = leftDate - rightDate;
    return sortOrder === 'asc' ? difference : -difference;
  });

  const downloadXlsx = (rows: any[], sortOrder: 'asc' | 'desc') => {
    const orderedRows = sortMovements(rows, sortOrder);
    const excelRows = orderedRows.map(m => ({
      Fecha: formatDateEs(m.date),
      'Tipo de movimiento': getTypeLabel(m.type),
      Código: m.product?.code || '—',
      Producto: m.product?.name || 'Producto sin nombre',
      Almacén: m.warehouse?.name || '—',
      Cantidad: formatMovementNumberForExport(m.quantity),
      'Stock anterior': formatMovementNumberForExport(m.previousQty),
      'Stock resultante': formatMovementNumberForExport(m.resultingQty),
      Usuario: m.user?.name || m.userName || 'Movimiento automático',
      Referencia: formatMovementReferenceForExport(m.reference),
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelRows, {
      header: ['Fecha', 'Tipo de movimiento', 'Código', 'Producto', 'Almacén', 'Cantidad', 'Stock anterior', 'Stock resultante', 'Usuario', 'Referencia'],
    });
    worksheet['!cols'] = [
      { wch: 13 }, { wch: 26 }, { wch: 16 }, { wch: 34 }, { wch: 26 },
      { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 30 },
    ];
    if (worksheet['!ref']) worksheet['!autofilter'] = { ref: worksheet['!ref'] };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Movimientos');
    XLSX.writeFile(workbook, buildDateFilteredDownloadFileName(['reporte_movimientos_inventario'], 'xlsx', dateFrom, dateTo));
    return orderedRows.length;
  };

  const openExportDialog = () => {
    const pageAmount = Math.max(1, Math.min(pagination?.pageSize || filteredData.length || 50, totalMovements || pagination?.pageSize || filteredData.length || 50));
    setExportScope('page');
    setExportAmount(String(pageAmount));
    setExportSortOrder('desc');
    setExportDialogOpen(true);
  };

  const handleExportAmountChange = (value: string) => {
    if (!/^\d*$/.test(value)) return;
    if (!value) {
      setExportAmount('');
      return;
    }
    const nextAmount = Number(value);
    if (!Number.isSafeInteger(nextAmount)) return;
    setExportAmount(String(Math.min(nextAmount, totalMovements)));
  };

  const handleExport = async () => {
    if (!canExportMovements) {
      toast.error('No tienes permiso para exportar movimientos');
      return;
    }
    const requestedAmount = Number(exportAmount);
    if (exportScope === 'custom' && (!/^[1-9]\d*$/.test(exportAmount) || !Number.isSafeInteger(requestedAmount) || requestedAmount > totalMovements)) {
      toast.error(`Digite una cantidad entera entre 1 y ${totalMovements.toLocaleString('es-NI')} movimiento(s)`);
      return;
    }

    setIsExporting(true);
    try {
      let exportRows = filteredData;
      if (exportScope !== 'page' && onExportData) {
        const data = await onExportData({ amount: exportScope === 'all' ? 'all' : requestedAmount, sortOrder: exportSortOrder });
        exportRows = colFilters.applyTo(Array.isArray(data) ? data : [], filterGetters);
      } else if (exportScope === 'custom') {
        exportRows = filteredData.slice(0, requestedAmount);
      }
      const exportedCount = downloadXlsx(exportRows, exportSortOrder);
      setExportDialogOpen(false);
      toast.success(`${exportedCount} movimiento(s) exportado(s)`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al exportar');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="p-4 border bg-card rounded-xl">
      <div className="flex min-w-0 flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between" data-tour="movements-title">
        <div className="erp-list-toolbar flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap" data-tour="movements-filters">
          <div className="relative min-w-0 flex-1 sm:min-w-[200px] sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar producto o referencia..." 
              className="pl-9 h-9"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }}
            />
          </div>
          <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); onTypeChange?.(value); }}>
            <SelectTrigger className="h-9 w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={warehouseFilter} onValueChange={(value) => { setWarehouseFilter(value); onWarehouseChange?.(value); }}>
            <SelectTrigger className="h-9 w-full sm:w-36">
              <SelectValue placeholder="Almacén" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(warehouses || []).map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex min-w-0 items-center gap-1.5">
            <DateField
              id="movement-date-from"
              value={dateFrom}
              onChange={(value) => { setDateFrom(value); onDateChange?.(value, dateTo); }}
              maxDate={dateTo || undefined}
              title="Fecha desde"
              placeholder="Desde"
              className="inventory-date-filter h-10 w-full rounded-xl px-3 text-xs font-medium sm:w-36"
            />
            <span className="text-muted-foreground text-xs">–</span>
            <DateField
              id="movement-date-to"
              value={dateTo}
              onChange={(value) => { setDateTo(value); onDateChange?.(dateFrom, value); }}
              minDate={dateFrom || undefined}
              title="Fecha hasta"
              placeholder="Hasta"
              className="inventory-date-filter h-10 w-full rounded-xl px-3 text-xs font-medium sm:w-36"
            />
          </div>
        </div>
        <div className="erp-toolbar-primary-group flex w-full gap-2 sm:w-auto"><Button type="button" variant="ghost" size="icon" data-toolbar-role="help" data-tutorial-trigger="true" className="size-8 shrink-0 rounded-lg text-muted-foreground" onClick={() => setShowTutorial(true)} aria-label="Cómo consultar movimientos" title="Cómo consultar movimientos"><CircleHelp className="size-4" /></Button>{canExportMovements && <Button variant="outline" size="sm" data-toolbar-role="print" className="flex-1 gap-2 rounded-xl font-bold sm:flex-none" onClick={openExportDialog}><Download className="size-4" /> Exportar</Button>}</div>
      </div>

      <div className={`grid min-w-0 gap-4 ${selectedMovement ? 'lg:grid-cols-[minmax(0,1fr)_360px]' : 'grid-cols-1'}`}>
        <div className="min-w-0">
      <div className="space-y-3 lg:hidden" data-tour="movements-table">
        {filteredData.length === 0 ? <Card className="rounded-2xl border-dashed p-8 text-center text-muted-foreground"><History className="mx-auto mb-2 size-9 opacity-20" /><p>No hay movimientos</p></Card> : filteredData.map((move: any) => (
          <Card key={move.id} role="button" tabIndex={0} aria-busy={String(openingId) === String(move.id) || undefined} data-detail-opening={String(openingId) === String(move.id) ? 'true' : undefined} onClick={() => openMovement(move)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMovement(move); } }} className={`min-w-0 cursor-pointer rounded-2xl border-border/50 bg-card/70 p-4 shadow-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selectedMovement?.id === move.id ? 'border-primary/50 bg-primary/5' : ''}`}>
            <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2">{getMovementIcon(move.type)}<div className="min-w-0"><p className="truncate font-bold">{move.product?.name || 'Producto sin nombre'}</p><p className="truncate text-xs text-muted-foreground" title={formatMovementReference(move.reference).full}>{formatMovementReference(move.reference).label}</p></div></div><div className="flex shrink-0 items-center gap-2">{String(openingId) === String(move.id) && <span role="status" className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-primary"><Loader2 className="size-3 animate-spin" /> Abriendo…</span>}<Badge variant="outline" className="text-[10px]">{getTypeLabel(move.type)}</Badge></div></div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-xs sm:grid-cols-4"><div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Fecha</p><p>{formatDateEs(move.date)}</p></div><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Almacén</p><p className="truncate">{move.warehouse?.name || '—'}</p></div><div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Cantidad</p><p className={`font-bold tabular-nums ${move.type === 'IN' ? 'text-success' : move.type === 'OUT' ? 'text-destructive' : 'text-primary'}`}>{move.type === 'OUT' ? '-' : '+'}{move.quantity}</p></div><div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Stock Ant. → Res.</p><p className="tabular-nums text-muted-foreground">{move.previousQty != null ? Number(move.previousQty) : '—'} → <span className="font-medium text-foreground">{move.resultingQty != null ? Number(move.resultingQty) : '—'}</span></p></div></div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/40 bg-muted/20 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5"><ArrowDownLeft className="size-3.5 text-success" /> Entradas: <b className="text-success">{movementSummary.entradas}</b></span>
        <span className="flex items-center gap-1.5"><ArrowUpRight className="size-3.5 text-destructive" /> Salidas: <b className="text-destructive">{movementSummary.salidas}</b></span>
        <span className="flex items-center gap-1.5"><Package className="size-3.5 text-primary" /> Stock actual total: <b className="text-foreground">{movementSummary.stockTotal}</b></span>
      </div>

      <div className="hidden overflow-x-auto rounded-lg border lg:block" data-tour="movements-table">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-40"><span className="inline-flex items-center gap-1">Fecha<ColumnFilterMenu label="Fecha" sort={colFilters.state.date?.sort || null} onSort={(sort) => colFilters.setSort('date', sort)} sortOptions={[{ value: 'desc', label: 'Más recientes' }, { value: 'asc', label: 'Más antiguas' }]} /></span></TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-28"><span className="inline-flex items-center gap-1">Tipo<ColumnFilterMenu label="Tipo" options={typeOptionsForFilter} selected={colFilters.state.type?.values || []} onSelect={(values) => colFilters.setValues('type', values)} sort={colFilters.state.type?.sort || null} onSort={(sort) => colFilters.setSort('type', sort)} /></span></TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest"><span className="inline-flex items-center gap-1">Producto<ColumnFilterMenu label="Producto" options={productOptions} selected={colFilters.state.product?.values || []} onSelect={(values) => colFilters.setValues('product', values)} sort={colFilters.state.product?.sort || null} onSort={(sort) => colFilters.setSort('product', sort)} /></span></TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest"><span className="inline-flex items-center gap-1">Almacén<ColumnFilterMenu label="Almacén" options={warehouseOptions} selected={colFilters.state.warehouse?.values || []} onSelect={(values) => colFilters.setValues('warehouse', values)} sort={colFilters.state.warehouse?.sort || null} onSort={(sort) => colFilters.setSort('warehouse', sort)} /></span></TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-20">Cantidad</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-20">Stock Ant.</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-20">Stock Res.</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Usuario</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Referencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  <History className="size-10 mx-auto mb-2 opacity-20" />
                  <p className="font-medium">No hay movimientos</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((move: any) => (
                <TableRow key={move.id} aria-busy={String(openingId) === String(move.id) || undefined} data-detail-opening={String(openingId) === String(move.id) ? 'true' : undefined} className={`cursor-pointer hover:bg-muted/30 ${selectedMovement?.id === move.id ? 'bg-primary/5' : ''}`} onClick={() => openMovement(move)}>
                  <TableCell className="text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-2">{formatDateEs(move.date, true)}{String(openingId) === String(move.id) && <Loader2 className="size-3 animate-spin text-primary" aria-label="Abriendo detalle" />}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getMovementIcon(move.type)}
                      <Badge variant="outline" className="text-[10px]">{getTypeLabel(move.type)}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{move.product?.name || '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{move.warehouse?.name || '-'}</TableCell>
                  <TableCell className="text-right">
                    <span className={`font-medium ${move.type === 'IN' ? 'text-success' : move.type === 'OUT' ? 'text-destructive' : 'text-info'}`}>
                      {move.type === 'OUT' ? '-' : '+'}{move.quantity}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {move.previousQty != null ? Number(move.previousQty) : '—'}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums font-medium">
                    {move.resultingQty != null ? Number(move.resultingQty) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {move.user?.name || move.userName || '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]" title={formatMovementReference(move.reference).full}>{formatMovementReference(move.reference).label}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 flex flex-col gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:flex-row sm:items-center sm:justify-between" data-tour="movements-pagination">
        {pagination?.total ?? filteredData.length} movimientos
        {pagination && <span className="inline-flex flex-wrap items-center gap-2 normal-case tracking-normal sm:ml-4">
          <select value={pagination.pageSize} onChange={(event) => pagination.onPageSizeChange(Number(event.target.value) as 50 | 100 | 200)} className="h-7 rounded border bg-background px-1 font-bold text-foreground">
            {[50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1}>‹</button>
          <span>Pág. {pagination.page}/{pagination.totalPages}</span>
          <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" onClick={() => pagination.onPageChange(Math.min(pagination.totalPages, pagination.page + 1))} disabled={pagination.page >= pagination.totalPages}>›</button>
        </span>}
      </div>
        </div>
        {selectedMovement && <MovementDetailsPanel movement={selectedMovement} canViewInventoryCost={canViewInventoryCost} onClose={() => setSelectedMovement(null)} />}
      </div>
      <Dialog open={exportDialogOpen} onOpenChange={(open) => { if (!isExporting) setExportDialogOpen(open); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Download className="size-5 text-primary" /> Exportar movimientos</DialogTitle>
            <DialogDescription>Hay {totalMovements.toLocaleString('es-NI')} movimiento(s) disponibles con los filtros actuales.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Cantidad a exportar</label>
              <Select value={exportScope} onValueChange={(value) => setExportScope(value as 'page' | 'custom' | 'all')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="page">Página actual ({filteredData.length} movimiento(s))</SelectItem>
                  <SelectItem value="custom" disabled={totalMovements < 1}>Cantidad personalizada</SelectItem>
                  <SelectItem value="all">Todos ({totalMovements.toLocaleString('es-NI')})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {exportScope === 'custom' && <div className="space-y-1.5">
              <label htmlFor="movement-export-amount" className="text-xs font-black uppercase tracking-wider text-muted-foreground">Número de movimientos</label>
              <Input id="movement-export-amount" type="number" min={1} max={totalMovements} step={1} inputMode="numeric" value={exportAmount} onKeyDown={(event) => { if (['-', '+', '.', ',', 'e', 'E'].includes(event.key)) event.preventDefault(); }} onChange={(event) => handleExportAmountChange(event.target.value)} placeholder="Ej. 100" />
              <p className="text-[11px] text-muted-foreground">Puedes indicar hasta {totalMovements.toLocaleString('es-NI')} movimiento(s).</p>
            </div>}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Orden del reporte</label>
              <Select value={exportSortOrder} onValueChange={(value) => setExportSortOrder(value as 'asc' | 'desc')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descendente: más recientes primero</SelectItem>
                  <SelectItem value="asc">Ascendente: más antiguos primero</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExportDialogOpen(false)} disabled={isExporting}>Cancelar</Button>
            <Button type="button" onClick={handleExport} disabled={isExporting || (exportScope !== 'page' && !onExportData)}>
              {isExporting ? <><Loader2 className="size-4 animate-spin" /> Preparando…</> : <><Download className="size-4" /> Exportar reporte</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {showTutorial && <GuidedTour steps={MOVEMENTS_TOUR_STEPS} onClose={() => setShowTutorial(false)} title="Movimientos de inventario" allowTargetInteraction />}
    </Card>
  );
}
