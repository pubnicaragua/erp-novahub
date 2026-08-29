import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  ClipboardList, Plus, Search, Eye, Trash2, Ban, CheckCircle2, Clock, ChevronLeft, Pencil, Download, FileText, X, Upload, AlertTriangle, Check, CircleHelp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Combobox } from '../ui/Combobox';
import { TaxDetail } from '../ui/TaxSelector';
import { isTaxExempt } from '../../utils/taxUtils';
import { purchaseOrdersService, purchaseRequestsService } from '../../services/compras.service';
import { inventoryService } from '../../services/inventario.service';
import { contabilidadService } from '../../services/contabilidad.service';
import { storageService } from '../../services/storage.service';
import type { PurchaseOrder, Supplier, Warehouse } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { HorizontalTableScroller } from '../ui/HorizontalTableScroller';
import { useImportPreviewLayout } from '../../hooks/useImportPreviewLayout';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import { ImportReviewSummary } from '../ui/ImportReviewSummary';
import { ImportPreviewField, ImportPreviewMobileCard, importPreviewFieldClass } from '../ui/ImportPreviewMobile';
import { VirtualizedImportList, useVirtualizedImportRows } from '../ui/VirtualizedImportList';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { parseSpreadsheetInWorker } from '../../utils/import-spreadsheet';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { generatePurchaseRecordPDF, generatePurchaseListPDF } from '../../utils/purchaseExports';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';
import { PurchaseVariantPickerModal } from './PurchaseVariantPickerModal';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { CurrencySelector } from '../ui/CurrencySelector';
import { PurchaseAlertsButton, type PurchaseAlertDetail } from './PurchaseAlertsButton';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { getPurchaseOrderStatusOption, normalizePurchaseOrderStatus, PURCHASE_ORDER_ACTIONABLE_STATUSES, PURCHASE_ORDER_STATUS_OPTIONS } from '../../utils/purchaseOrderStatus';
import { PdfDownloadButton } from '../ui/PdfDownloadButton';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { SalesDocumentDetailSheet, type SalesDocumentPanelData } from '../ventas/SalesDocumentDetailSheet';

interface Props {
  data: PurchaseOrder[];
  loading: boolean;
  onRefresh: () => void;
  supplierCatalog?: Supplier[];
  warehouseCatalog?: Warehouse[];
  selectedBranchId?: string;
  productCatalog?: any[];
  productCategories?: any[];
  isSidebarCollapsed?: boolean;
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  onStatusChange?: (value: string) => void;
  purchaseAlert?: PurchaseAlertDetail;
  targetId?: string | null;
  onClearTargetId?: () => void;
  initialStatus?: string;
  prefillDoc?: Partial<PurchaseOrder> | null;
  onPrefillHandled?: () => void;
  onApprovedToReceipt?: (receipt?: any) => void;
}

const MAX_EVIDENCE_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024;

type PurchaseImportRow = {
  sku: string;
  productId?: string;
  skuResolution?: 'LINK_EXISTING' | 'MANUAL';
  description: string;
  commercialNoteSnapshot?: string | null;
  category: string;
  categoryId?: string;
  quantity: string | number;
  unitPrice: string | number;
  taxType: string;
  taxBase?: string | number;
  taxRate: string | number;
  taxAmount?: number;
  withholdingType: string;
  withholdingBase?: string | number;
  withholdingRate: string | number;
  withholdingTotal?: number;
  currentStock?: number;
  _hasError?: boolean;
  _errorMessage?: string;
  _hasWarning?: boolean;
  _warningMessage?: string;
  _skuStatus?: 'found' | 'missing' | 'duplicate';
  _skuMessage?: string;
};

type ImportCatalogOption = {
  id?: string;
  code: string;
  name: string;
  rate: number;
  baseCalculation?: string;
  isActive?: boolean;
};

const getCurrencyLabel = (currency?: string) => {
  const normalized = String(currency || 'NIO').toUpperCase();
  return normalized === 'USD' ? 'USD · Dólares' : 'NIO · Córdobas';
};

const getCurrencySymbol = (currency?: string) => String(currency || 'NIO').toUpperCase() === 'USD' ? '$' : 'C$';

const normalizePurchaseCurrency = (currency?: string): 'NIO' | 'USD' => String(currency || 'NIO').toUpperCase() === 'USD' ? 'USD' : 'NIO';

const convertPurchaseAmount = (amount: unknown, fromCurrency: string, toCurrency: string, rate: number) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || normalizePurchaseCurrency(fromCurrency) === normalizePurchaseCurrency(toCurrency)) return Number.isFinite(value) ? value : 0;
  const safeRate = Number(rate) > 0 ? Number(rate) : 36.5;
  return normalizePurchaseCurrency(fromCurrency) === 'USD' ? value * safeRate : value / safeRate;
};

const FALLBACK_IMPORT_TAX_OPTIONS: ImportCatalogOption[] = [
  { code: 'GRAVADO', name: 'IVA gravado', rate: 15 },
  { code: 'EXENTO', name: 'IVA exento', rate: 0 },
  { code: 'EXONERADO', name: 'IVA exonerado', rate: 0 },
  { code: 'NO_GRAVADO', name: 'IVA no gravado', rate: 0 },
  { code: 'NO_SUJETO', name: 'IVA no sujeto', rate: 0 },
  { code: 'TASA_ESPECIAL', name: 'IVA tasa especial', rate: 7 },
  { code: 'ISC_APLICABLE', name: 'ISC aplicable', rate: 0 },
];

const FALLBACK_IMPORT_WITHHOLDING_OPTIONS: ImportCatalogOption[] = [
  { code: 'IR_BIENES_1', name: 'IR bienes 1%', rate: 1 },
  { code: 'IR_BIENES_2', name: 'IR bienes 2%', rate: 2 },
  { code: 'IR_3', name: 'IR 3%', rate: 3 },
  { code: 'IR_SERVICIOS_2', name: 'IR servicios 2%', rate: 2 },
  { code: 'IR_HONORARIOS_10', name: 'IR honorarios 10%', rate: 10 },
  { code: 'IR_ALQUILERES_15', name: 'IR alquileres 15%', rate: 15 },
  { code: 'IR_OTROS_20', name: 'IR otros 20%', rate: 20 },
  { code: 'IR_5', name: 'IR 5%', rate: 5 },
  { code: 'IR_10', name: 'IR 10%', rate: 10 },
  { code: 'IR_15', name: 'IR 15%', rate: 15 },
  { code: 'IR_20', name: 'IR 20%', rate: 20 },
  { code: 'IR_25', name: 'IR 25%', rate: 25 },
  { code: 'IVA_RET_1', name: 'IVA retención 1%', rate: 1 },
  { code: 'IVA_RET_2', name: 'IVA retención 2%', rate: 2 },
  { code: 'IVA_RET_3', name: 'IVA retención 3%', rate: 3 },
  { code: 'IVA_RET_4', name: 'IVA retención 4%', rate: 4 },
  { code: 'IVA_RET_5', name: 'IVA retención 5%', rate: 5 },
];

interface PurchaseImportPreviewProps {
  rows: PurchaseImportRow[];
  fileName: string;
  isSidebarCollapsed?: boolean;
  importing: boolean;
  progress: number;
  currency: string;
  importCurrency: string;
  conversionRate?: number;
  categoryOptions: any[];
  exchangeRate?: number;
  taxOptions: ImportCatalogOption[];
  withholdingOptions: ImportCatalogOption[];
  onRowUpdate: (index: number, field: keyof PurchaseImportRow, value: any) => void;
  onCategoryChange: (index: number, categoryId: string, categoryName?: string) => void;
  onCreateCategory: (name: string) => Promise<any>;
  onImportCurrencyChange: (currency: string) => void;
  onDownloadErrors: () => void;
  onConfirm: () => void;
  onBack: () => void;
}

function PurchaseImportPreview({ rows, fileName, isSidebarCollapsed = true, importing, progress, currency, importCurrency, conversionRate, categoryOptions, exchangeRate, taxOptions, withholdingOptions, onRowUpdate, onCategoryChange, onCreateCategory, onImportCurrencyChange, onDownloadErrors, onConfirm, onBack }: PurchaseImportPreviewProps) {
  useImportPreviewLayout();
  const validRows = rows.filter((row) => !row._hasError).length;
  const errorRows = rows.filter((row) => row._hasError).length;
  const warningRows = rows.filter((row) => !row._hasError && row._hasWarning).length;
  const issueRows = rows.filter((row) => row._hasError || row._hasWarning).length;
  const currencyCode = String(currency || 'NIO').toUpperCase();
  const importCurrencyCode = String(importCurrency || currencyCode).toUpperCase();
  const currencySymbol = getCurrencySymbol(currencyCode);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryRowIndex, setCategoryRowIndex] = useState<number | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const gridTemplate = '32px 144px 300px 250px 180px 160px 96px 112px 128px 160px 112px 96px 112px 160px 112px 96px 128px';
  const tableVirtualizer = useVirtualizedImportRows(rows.length, tableScrollRef, 72, { overscan: 2 });

  const openCategoryDialog = (index: number, initialName: string) => {
    setCategoryRowIndex(index);
    setNewCategoryName(initialName.trim());
    setCategoryDialogOpen(true);
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error('El nombre de la categoría es requerido');
      return;
    }
    if (categoryOptions.some((category: any) => String(category.name || '').trim().toLowerCase() === name.toLowerCase())) {
      toast.error('Esa categoría ya existe; selecciónala en la fila');
      return;
    }
    setCreatingCategory(true);
    try {
      const created = await onCreateCategory(name);
      if (categoryRowIndex !== null && created?.id) onCategoryChange(categoryRowIndex, String(created.id), String(created.name || name));
      toast.success(`Categoría "${created?.name || name}" creada y asignada`);
      setCategoryDialogOpen(false);
      setNewCategoryName('');
      setCategoryRowIndex(null);
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo crear la categoría');
    } finally {
      setCreatingCategory(false);
    }
  };

  const renderMobileCard = (row: PurchaseImportRow, index: number) => {
    const tax = calcItemTax(row);
    const withholding = calcItemWithholding(row);
    const taxValue = String(row.taxType || 'GRAVADO').toUpperCase();
    const withholdingValue = String(row.withholdingType || 'NONE').toUpperCase();
    const matchingCategory = categoryOptions.find((category: any) => String(category.id) === String(row.categoryId)) || categoryOptions.find((category: any) => String(category.name || '').trim().toLowerCase() === String(row.category || '').trim().toLowerCase());
    const categoryValue = row.categoryId || matchingCategory?.id || '__none__';
    const skuLinked = row._skuStatus === 'found' && row.skuResolution !== 'MANUAL';
    return (
      <ImportPreviewMobileCard index={index} title={row.description || row.sku} error={row._hasError ? row._errorMessage || row._skuMessage || 'Fila con errores' : undefined} warning={row._hasWarning ? row._warningMessage || 'Revisar fila' : undefined}>
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <ImportPreviewField label="SKU"><Input value={row.sku} onChange={(event) => onRowUpdate(index, 'sku', event.target.value)} className={`${importPreviewFieldClass} font-mono ${row._skuStatus === 'duplicate' ? 'border-red-500' : row._skuStatus === 'missing' ? 'border-amber-500' : ''}`} disabled={importing} /></ImportPreviewField>
          <ImportPreviewField label="Stock actual"><div className="flex h-9 items-center rounded-lg border border-border/60 bg-muted/20 px-3 text-xs font-black text-primary">{row.currentStock ?? '—'}</div></ImportPreviewField>
          <ImportPreviewField label="Aviso / vínculo" className="sm:col-span-2"><div className="space-y-2"><p className={`break-words text-xs ${row._hasError ? 'text-red-500' : row._hasWarning ? 'text-amber-500' : 'text-emerald-500'}`}>{row._errorMessage || row._warningMessage || row._skuMessage || 'Correcto'}</p>{row._skuStatus === 'found' && <select aria-label={`Resolución de SKU ${row.sku}`} value={skuLinked ? 'LINK_EXISTING' : 'MANUAL'} onChange={(event) => onRowUpdate(index, 'skuResolution', event.target.value)} className={importPreviewFieldClass} disabled={importing}><option value="LINK_EXISTING">Vincular producto existente</option><option value="MANUAL">Crear producto nuevo</option></select>}</div></ImportPreviewField>
          <ImportPreviewField label="Descripción *" className="sm:col-span-2"><Input value={row.description} onChange={(event) => onRowUpdate(index, 'description', event.target.value)} className={`${importPreviewFieldClass} ${!row.description ? 'border-red-500' : ''}`} disabled={importing} /></ImportPreviewField>
          <ImportPreviewField label="Nota comercial"><div><Input value={row.commercialNoteSnapshot || ''} maxLength={100} onChange={(event) => onRowUpdate(index, 'commercialNoteSnapshot', event.target.value)} className={importPreviewFieldClass} disabled={importing} /><p className="mt-1 text-[10px] text-muted-foreground">{Array.from(row.commercialNoteSnapshot || '').length}/100</p></div></ImportPreviewField>
          <ImportPreviewField label="Categoría" className="sm:col-span-2"><div className="flex min-w-0 items-center gap-1"><select aria-label={`Categoría de ${row.sku || `fila ${index + 1}`}`} value={categoryValue} onChange={(event) => onCategoryChange(index, event.target.value === '__none__' ? '' : event.target.value)} className={`${importPreviewFieldClass} min-w-0 flex-1 ${row._hasError ? 'border-red-500' : matchingCategory ? '' : 'border-amber-500/70 text-amber-700'}`} disabled={importing}><option value="__none__">{row.category ? `No existe: ${row.category}` : 'Seleccionar categoría *'}</option>{categoryOptions.filter((category: any) => category.isActive !== false).map((category: any) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><Button type="button" variant="outline" size="sm" className="size-9 shrink-0 rounded-lg border-amber-500/50 p-0 text-amber-600" title="Crear esta categoría" aria-label="Crear esta categoría" onClick={() => openCategoryDialog(index, row.category || '')} disabled={importing}><Plus className="size-3.5" /></Button></div></ImportPreviewField>
          <ImportPreviewField label="Cantidad"><Input type="number" min={0} value={row.quantity} onChange={(event) => onRowUpdate(index, 'quantity', event.target.value)} className={`${importPreviewFieldClass} text-right`} disabled={importing} /></ImportPreviewField>
          <ImportPreviewField label={`Precio unitario (${currencySymbol})`}><Input type="number" min={0} step="any" value={row.unitPrice} onChange={(event) => onRowUpdate(index, 'unitPrice', event.target.value)} className={`${importPreviewFieldClass} text-right`} disabled={importing} /></ImportPreviewField>
          <ImportPreviewField label="Tipo IVA"><select value={taxValue} onChange={(event) => onRowUpdate(index, 'taxType', event.target.value)} className={importPreviewFieldClass} disabled={importing}><option value="">Seleccionar IVA</option>{taxOptions.filter((option) => option.isActive !== false).map((option) => <option key={option.code} value={option.code}>{option.name} ({option.rate}%)</option>)}</select></ImportPreviewField>
          <ImportPreviewField label={`Base IVA (${currencySymbol})`}><Input type="number" value={isTaxExempt(taxValue) ? 0 : tax.taxBase} readOnly className={`${importPreviewFieldClass} bg-muted/35 text-right text-muted-foreground`} /></ImportPreviewField>
          <ImportPreviewField label="IVA %"><Input type="number" value={tax.taxRate} readOnly className={`${importPreviewFieldClass} bg-muted/35 text-right text-muted-foreground`} /></ImportPreviewField>
          <ImportPreviewField label={`Monto IVA (${currencySymbol})`}><div className="flex h-9 items-center justify-end rounded-lg border border-border/60 bg-muted/20 px-3 text-xs font-bold text-rose-500">{currencySymbol} {tax.taxAmount.toFixed(2)}</div></ImportPreviewField>
          <ImportPreviewField label="Retención" className="sm:col-span-2"><select value={withholdingValue} onChange={(event) => onRowUpdate(index, 'withholdingType', event.target.value)} className={importPreviewFieldClass} disabled={importing}><option value="NONE">Sin retención</option>{withholdingOptions.filter((option) => option.isActive !== false && option.code !== 'NONE').map((option) => <option key={option.code} value={option.code}>{option.name} ({option.rate}%)</option>)}</select></ImportPreviewField>
          <ImportPreviewField label={`Base ret. (${currencySymbol})`}><Input type="number" value={withholdingValue === 'NONE' ? 0 : withholding.withholdingBase} readOnly className={`${importPreviewFieldClass} bg-muted/35 text-right text-muted-foreground`} /></ImportPreviewField>
          <ImportPreviewField label="Ret. %"><Input type="number" value={withholding.withholdingRate} readOnly className={`${importPreviewFieldClass} bg-muted/35 text-right text-muted-foreground`} /></ImportPreviewField>
          <ImportPreviewField label={`Monto ret. (${currencySymbol})`}><div className="flex h-9 items-center justify-end rounded-lg border border-border/60 bg-muted/20 px-3 text-xs font-bold text-amber-600">{currencySymbol} {withholding.withholdingTotal.toFixed(2)}</div></ImportPreviewField>
        </div>
      </ImportPreviewMobileCard>
    );
  };

  return (
    <div className={`fixed inset-y-0 right-0 left-0 z-40 flex h-dvh min-h-0 flex-col overflow-hidden bg-background p-3 sm:p-6 ${isSidebarCollapsed ? 'lg:left-[72px]' : 'lg:left-[270px]'}`}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:gap-5">
        <div className="flex flex-col gap-3 border-b border-border/50 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Importación de ítems</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Previsualizar productos</h2>
            <p className="mt-1 text-sm text-muted-foreground">Revisa y corrige los productos antes de agregarlos a esta orden de compra.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-primary/20 bg-primary/5 px-3 py-2 text-xs shadow-sm">
            <span className="font-black uppercase tracking-wider text-primary">Moneda de la orden</span>
            <Badge variant="outline" className="border-primary/30 bg-background font-black text-primary">{getCurrencyLabel(currencyCode)}</Badge>
            <span className="text-muted-foreground">Tasa: <b className="text-foreground">{currencyCode === 'NIO' ? '1.00' : Number(exchangeRate || 1).toFixed(2)} NIO/USD</b></span>
            <span className="h-4 w-px bg-primary/20" />
            <label className="font-black uppercase tracking-wider text-primary" htmlFor="purchase-import-currency">Moneda del archivo</label>
            <select
              id="purchase-import-currency"
              value={importCurrencyCode}
              onChange={(event) => onImportCurrencyChange(event.target.value)}
              disabled={importing}
              className="h-8 rounded-lg border-2 border-primary/25 bg-background px-2 text-xs font-bold uppercase shadow-sm outline-none focus:border-primary"
            >
              <option value="NIO">NIO · Córdobas</option>
              <option value="USD">USD · Dólares</option>
            </select>
            {importCurrencyCode !== currencyCode && <span className="text-muted-foreground">Se convirtió a {currencyCode} · tasa {Number(conversionRate || exchangeRate || 1).toFixed(2)} NIO/USD</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3 text-sm">
          <div className="min-w-0">
            <p className="font-semibold break-words">Archivo: {fileName}</p>
            <p className="text-xs text-muted-foreground">Los errores se omitirán. Las advertencias se mostrarán antes de confirmar.</p>
          </div>
          <Button variant="outline" size="sm" onClick={onDownloadErrors} disabled={issueRows === 0}>
            <Download className="mr-2 size-3.5" /> Descargar incidencias
          </Button>
        </div>

        <ImportReviewSummary total={rows.length} valid={validRows} skipped={errorRows} warnings={warningRows} entityLabel="productos" />

        <div className="hidden min-h-0 min-w-0 flex-1 sm:flex">
        <HorizontalTableScroller scrollRef={tableScrollRef} scrollBehavior="auto" className="h-[clamp(500px,65vh,760px)] min-h-[500px] min-w-0 flex-1" tableClassName="overflow-x-auto overflow-y-auto scrollbar-overlay" label="Desplazamiento horizontal · usa la barra inferior o las flechas">
          <Table containerClassName="!max-w-none !overflow-visible" containerStyle={{ width: '2500px', minWidth: '2500px', maxWidth: 'none' }} className="block w-[2500px] min-w-[2500px]">
            <TableHeader className="sticky top-0 z-10 block bg-muted shadow-sm">
              <TableRow style={{ display: 'grid', gridTemplateColumns: gridTemplate }}>
                <TableHead className="w-8 text-[10px] uppercase"></TableHead>
                <TableHead className="w-36 text-[10px] uppercase">SKU</TableHead>
                <TableHead className="min-w-[300px] text-[10px] uppercase">Aviso / vínculo</TableHead>
                <TableHead className="min-w-[240px] text-[10px] uppercase">Descripción</TableHead>
                <TableHead className="w-44 text-[10px] uppercase">Nota comercial</TableHead>
                <TableHead className="w-40 text-[10px] uppercase">Categoría</TableHead>
                <TableHead className="w-24 text-right text-[10px] uppercase">Stock actual</TableHead>
                <TableHead className="w-28 text-right text-[10px] uppercase">Cantidad</TableHead>
                <TableHead className="w-32 text-right text-[10px] uppercase">Precio unitario ({currencySymbol})</TableHead>
                <TableHead className="w-40 text-[10px] uppercase">Tipo IVA</TableHead>
                <TableHead className="w-28 text-right text-[10px] uppercase">Base IVA ({currencySymbol})</TableHead>
                <TableHead className="w-24 text-right text-[10px] uppercase">IVA %</TableHead>
                <TableHead className="w-28 text-right text-[10px] uppercase">Monto IVA ({currencySymbol})</TableHead>
                <TableHead className="w-40 text-[10px] uppercase">Retención</TableHead>
                <TableHead className="w-28 text-right text-[10px] uppercase">Base ret. ({currencySymbol})</TableHead>
                <TableHead className="w-24 text-right text-[10px] uppercase">Ret. %</TableHead>
                <TableHead className="w-32 text-right text-[10px] uppercase">Monto ret. ({currencySymbol})</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody style={{ display: 'block', position: 'relative', height: tableVirtualizer.getTotalSize() }}>
              {tableVirtualizer.getVirtualItems().map((virtualRow) => {
                const index = virtualRow.index;
                const row = rows[index];
                const tax = calcItemTax(row);
                const withholding = calcItemWithholding(row);
                const taxValue = String(row.taxType || 'GRAVADO').toUpperCase();
                const withholdingValue = String(row.withholdingType || 'NONE').toUpperCase();
                const taxOptionExists = taxOptions.some((option) => option.code === taxValue);
                const withholdingOptionExists = withholdingOptions.some((option) => option.code === withholdingValue);
                const skuLinked = row._skuStatus === 'found' && row.skuResolution !== 'MANUAL';

                const matchingCategory = categoryOptions.find((category: any) => String(category.id) === String(row.categoryId))
                  || categoryOptions.find((category: any) => String(category.name || '').trim().toLowerCase() === String(row.category || '').trim().toLowerCase());
                const categoryValue = row.categoryId || matchingCategory?.id || '__none__';

                return (
                <TableRow key={virtualRow.key} ref={tableVirtualizer.measureElement} data-index={index} style={{ display: 'grid', gridTemplateColumns: gridTemplate, position: 'absolute', left: 0, top: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }} className={cn('border-b-2 border-border/70 transition-colors hover:bg-muted/20', row._hasError ? 'bg-red-500/10' : row._hasWarning ? 'bg-amber-500/5' : 'bg-background')}>
                  <TableCell>{row._hasError ? <AlertTriangle className="size-4 text-red-500" /> : row._hasWarning ? <AlertTriangle className="size-4 text-amber-500" /> : <Check className="size-4 text-emerald-500" />}</TableCell>
                  <TableCell className="p-1"><Input value={row.sku} onChange={(event) => onRowUpdate(index, 'sku', event.target.value)} className={`h-8 text-xs font-mono ${row._skuStatus === 'duplicate' ? 'border-red-500' : row._skuStatus === 'missing' ? 'border-amber-500' : ''}`} /></TableCell>
                  <TableCell className="p-1 align-top text-xs"><div className="flex min-w-[280px] flex-col gap-1"><span className={row._hasError ? 'text-red-500' : row._hasWarning ? 'text-amber-500' : 'text-emerald-500'}>{row._errorMessage || row._warningMessage || row._skuMessage || 'Correcto'}</span>{row._skuStatus === 'found' && <select aria-label={`Resolución de SKU ${row.sku}`} value={skuLinked ? 'LINK_EXISTING' : 'MANUAL'} onChange={(event) => onRowUpdate(index, 'skuResolution', event.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs"><option value="LINK_EXISTING">Vincular producto existente</option><option value="MANUAL">Crear producto nuevo (requiere SKU libre)</option></select>}</div></TableCell>
                  <TableCell className="min-w-[240px] p-1"><Input value={row.description} onChange={(event) => onRowUpdate(index, 'description', event.target.value)} className={`h-8 w-full text-xs ${!row.description ? 'border-red-500' : ''}`} /></TableCell>
                  <TableCell className="p-1"><Input value={row.commercialNoteSnapshot || ''} maxLength={100} onChange={(event) => onRowUpdate(index, 'commercialNoteSnapshot', event.target.value)} className="h-8 w-full text-xs" title={row.commercialNoteSnapshot || undefined} /></TableCell>
                  <TableCell className="p-1 align-top">
                    <div className="flex min-w-[250px] items-center gap-1">
                      <select
                        aria-label={`Categoría de ${row.sku || `fila ${index + 1}`}`}
                        value={categoryValue}
                        onChange={(event) => onCategoryChange(index, event.target.value === '__none__' ? '' : event.target.value)}
                        className={cn('h-8 min-w-0 flex-1 rounded-md border-2 bg-background px-2 text-xs shadow-sm outline-none focus:border-primary', row._hasError ? 'border-red-500' : matchingCategory ? 'border-border' : 'border-amber-500/70 text-amber-700')}
                      >
                        <option value="__none__">{row.category ? `No existe: ${row.category}` : 'Seleccionar categoría *'}</option>
                        {categoryOptions.filter((category: any) => category.isActive !== false).map((category: any) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                      <Button type="button" variant="outline" size="sm" className="h-8 w-8 shrink-0 rounded-lg border-2 border-amber-500/50 p-0 text-amber-600 shadow-sm" title="Crear esta categoría" aria-label={`Crear categoría para ${row.sku || `fila ${index + 1}`}`} onClick={() => openCategoryDialog(index, row.category || '')} disabled={importing}><Plus className="size-3.5" /></Button>
                    </div>
                    {row._errorMessage?.includes('Categoría') && <p className="mt-1 text-[10px] font-semibold text-red-500">Selecciona una categoría o créala con +</p>}
                  </TableCell>
                  <TableCell className="p-1 text-right text-xs font-black text-primary">{row.currentStock ?? '—'}</TableCell>
                  <TableCell className="p-1"><Input type="number" min={0} value={row.quantity} onChange={(event) => onRowUpdate(index, 'quantity', event.target.value)} className="h-8 border-2 border-border bg-background text-right text-xs shadow-sm" /></TableCell>
                  <TableCell className="p-1"><Input type="number" min={0} step="any" value={row.unitPrice} onChange={(event) => onRowUpdate(index, 'unitPrice', event.target.value)} className="h-8 border-2 border-primary/30 bg-background text-right text-xs shadow-sm" /></TableCell>
                  <TableCell className="p-1"><select value={taxValue} onChange={(event) => onRowUpdate(index, 'taxType', event.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="">Seleccionar IVA</option>{taxValue && !taxOptionExists && <option value={taxValue}>{taxValue}</option>}{taxOptions.filter((option) => option.isActive !== false).map((option) => <option key={option.code} value={option.code}>{option.name} ({option.rate}%)</option>)}</select></TableCell>
                  <TableCell className="p-1"><Input type="number" value={isTaxExempt(taxValue) ? 0 : tax.taxBase} readOnly aria-readonly="true" tabIndex={-1} className="h-8 border-2 border-border/70 bg-muted/35 text-right text-xs text-muted-foreground shadow-sm" /></TableCell>
                  <TableCell className="p-1"><Input type="number" value={tax.taxRate} readOnly aria-readonly="true" tabIndex={-1} className="h-8 border-2 border-border/70 bg-muted/35 text-right text-xs text-muted-foreground shadow-sm" /></TableCell>
                  <TableCell className="p-1 text-right text-xs font-bold text-rose-500">{currencySymbol} {tax.taxAmount.toFixed(2)}</TableCell>
                  <TableCell className="p-1"><select value={withholdingValue} onChange={(event) => onRowUpdate(index, 'withholdingType', event.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="NONE">Sin retención</option>{withholdingValue !== 'NONE' && !withholdingOptionExists && <option value={withholdingValue}>{withholdingValue}</option>}{withholdingOptions.filter((option) => option.isActive !== false && option.code !== 'NONE').map((option) => <option key={option.code} value={option.code}>{option.name} ({option.rate}%)</option>)}</select></TableCell>
                  <TableCell className="p-1"><Input type="number" value={withholdingValue === 'NONE' ? 0 : withholding.withholdingBase} readOnly aria-readonly="true" tabIndex={-1} className="h-8 border-2 border-border/70 bg-muted/35 text-right text-xs text-muted-foreground shadow-sm" /></TableCell>
                  <TableCell className="p-1"><Input type="number" value={withholding.withholdingRate} readOnly aria-readonly="true" tabIndex={-1} className="h-8 border-2 border-border/70 bg-muted/35 text-right text-xs text-muted-foreground shadow-sm" /></TableCell>
                  <TableCell className="p-1 text-right text-xs font-bold text-amber-600">{currencySymbol} {withholding.withholdingTotal.toFixed(2)}</TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </HorizontalTableScroller>
        </div>

        <section className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden rounded-2xl border bg-card p-3 sm:hidden" aria-label="Productos de la orden para revisar">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 pb-3">
            <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Revisión móvil</p><p className="mt-1 text-xs text-muted-foreground">Edita un producto por tarjeta</p></div>
            <Badge variant="secondary" className="shrink-0 text-[10px]">{rows.length} registros</Badge>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {rows.length ? <VirtualizedImportList count={rows.length} scrollRef={mobileScrollRef} estimateSize={520} overscan={2} className="min-w-0 max-w-full space-y-3 pt-3 pr-1" renderItem={(index) => <div className="pb-3">{renderMobileCard(rows[index], index)}</div>} /> : <div className="p-8 text-center text-sm text-muted-foreground">El archivo no contiene filas para importar.</div>}
          </div>
        </section>

        {importing && <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} /></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4">
          <Button variant="outline" onClick={onBack} disabled={importing}><ChevronLeft className="mr-2 size-4" />Volver a la carga</Button>
          <Button onClick={onConfirm} disabled={importing || validRows === 0} className="bg-primary font-bold text-primary-foreground">{importing ? `Agregando... ${progress}%` : `Agregar ${validRows} válidos · omitir ${errorRows}`}</Button>
        </div>
      </div>
      <Dialog open={categoryDialogOpen} onOpenChange={(open) => { if (!creatingCategory) setCategoryDialogOpen(open); }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader data-tour="purchases-order-category-title">
            <DialogTitle>Crear categoría</DialogTitle>
            <DialogDescription>La nueva categoría se asignará al producto seleccionado y estará disponible para las demás filas.</DialogDescription>
            <PurchaseViewTutorial view="orders" context="form" labelOverride="Cómo crear categoría" stepKeys={['title', 'data', 'actions']} targetPrefix="purchases-order-category" />
          </DialogHeader>
          <div className="space-y-2" data-tour="purchases-order-category-data">
            <label htmlFor="new-purchase-import-category" className="text-xs font-black uppercase tracking-wider text-foreground">Nombre de categoría</label>
            <Input id="new-purchase-import-category" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Ej. Tecnología" autoFocus disabled={creatingCategory} />
          </div>
          <DialogFooter data-tour="purchases-order-category-actions">
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)} disabled={creatingCategory}>Cancelar</Button>
            <Button onClick={() => void handleCreateCategory()} disabled={creatingCategory || !newCategoryName.trim()}>{creatingCategory ? 'Creando...' : 'Crear y asignar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImportProgressOverlay open={importing} progress={progress} title="Agregando productos" description="Validando y agregando los ítems válidos a la orden de compra. No cierres esta ventana." />
    </div>
  );
}

const normalizeImportHeader = (value: unknown) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

const mergeImportCatalogOptions = (configured: ImportCatalogOption[], fallback: ImportCatalogOption[]) => {
  const byCode = new Map<string, ImportCatalogOption>(fallback.map((option) => [option.code, option]));
  configured.forEach((option) => byCode.set(option.code, option));
  return Array.from(byCode.values());
};

const normalizeImportCatalogValue = (
  value: unknown,
  options: ImportCatalogOption[],
  fallbackCode: string,
  noneAliases: string[] = [],
) => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallbackCode;
  const normalized = normalizeImportHeader(raw);
  if (noneAliases.some((alias) => normalizeImportHeader(alias) === normalized)) return fallbackCode;

  const option = options.find((candidate) => [
    candidate.code,
    candidate.name,
    `${candidate.name} (${candidate.rate}%)`,
    `${candidate.name} ${candidate.rate}%`,
  ].some((alias) => normalizeImportHeader(alias) === normalized));
  return option?.code || raw.toUpperCase();
};

function calcItemTax(item: any): { taxBase: number; taxRate: number; taxAmount: number } {
  const tt = (item.taxType || 'GRAVADO').toUpperCase();
  if (isTaxExempt(tt)) return { taxBase: 0, taxRate: 0, taxAmount: 0 };
  const quantity = Number(item.quantity);
  const unitPrice = Number(item.unitPrice);
  const lineTotal = Number.isFinite(quantity) && Number.isFinite(unitPrice) ? Math.max(0, quantity) * Math.max(0, unitPrice) : 0;
  const hasTaxRate = item.taxRate !== '' && item.taxRate !== null && item.taxRate !== undefined && Number.isFinite(Number(item.taxRate));
  const taxRate = hasTaxRate ? Math.max(0, Number(item.taxRate)) : (['GRAVADO', 'GRAVADO_15', 'IVA_GRAVADO_15'].includes(tt) ? 15 : 0);
  const configuredBase = Number(item.taxBase);
  const taxBase = Number.isFinite(configuredBase) && configuredBase > 0 ? configuredBase : lineTotal;
  return { taxRate, taxBase, taxAmount: (taxBase * taxRate) / 100 };
}

const DEFAULT_ORDER_WITHHOLDING_RATES: Record<string, number> = {
  IR_1: 1, IR_2: 2, IR_5: 5, IR_10: 10, IR_15: 15, IR_20: 20, IR_25: 25,
  IVA_1: 1, IVA_2: 2, IVA_3: 3, IVA_4: 4, IVA_5: 5,
  IR_BIENES_1: 1, IR_BIENES_2: 2, IR_SERVICIOS_2: 2,
  IR_HONORARIOS_10: 10, IR_ALQUILERES_15: 15, IR_OTROS_20: 20,
};

function calcItemWithholding(item: any): { withholdingBase: number; withholdingRate: number; withholdingTotal: number } {
  const type = String(item.withholdingType || 'NONE').toUpperCase();
  if (type === 'NONE') return { withholdingBase: 0, withholdingRate: 0, withholdingTotal: 0 };
  const quantity = Number(item.quantity);
  const unitPrice = Number(item.unitPrice);
  const lineTotal = Number.isFinite(quantity) && Number.isFinite(unitPrice) ? Math.max(0, quantity) * Math.max(0, unitPrice) : 0;
  const configuredBase = Number(item.withholdingBase);
  const withholdingBase = Number.isFinite(configuredBase) && configuredBase > 0 ? configuredBase : lineTotal;
  const hasWithholdingRate = item.withholdingRate !== '' && item.withholdingRate !== null && item.withholdingRate !== undefined && Number.isFinite(Number(item.withholdingRate));
  const withholdingRate = hasWithholdingRate ? Math.max(0, Number(item.withholdingRate)) : (DEFAULT_ORDER_WITHHOLDING_RATES[type] || 0);
  return { withholdingBase, withholdingRate, withholdingTotal: withholdingBase * withholdingRate / 100 };
}

const LINKED_PRODUCT_LOCKED_FIELDS = new Set([
  'code', 'name', 'description', 'category', 'categoryId', 'stock', 'currentStock', 'stockApplies',
]);

const formatInputNumber = (value: unknown) => {
  if (value === '' || value === null || value === undefined) return '';
  // No formatear durante la edición: toFixed(2) convertía "3" en "3.00"
  // después de cada pulsación y hacía imposible escribir precios enteros.
  return String(value);
};

const formatInputInteger = (value: unknown) => {
  if (value === '' || value === null || value === undefined) return '';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(Math.trunc(numeric)) : '';
};

const getProductListFromResponse = (response: any): any[] => (
  Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : []
);

const normalizeProductCode = (product: any) => String(product?.code || product?.sku || '').trim().toLowerCase();

export function OrdenesCompraView({ data, loading, onRefresh, supplierCatalog = [], warehouseCatalog = [], selectedBranchId = '', productCatalog = [], productCategories = [], isSidebarCollapsed = true, pagination, onSearchChange, onStatusChange, purchaseAlert, targetId, onClearTargetId, initialStatus, prefillDoc, onPrefillHandled, onApprovedToReceipt }: Props) {
  const { canPerform, user } = useAuth();
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, formatConvertedAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('purchases-orders-layout', 'table', 24 * 365);
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightedAlertId) return;
    const timeout = window.setTimeout(() => setHighlightedAlertId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [highlightedAlertId]);

  useEffect(() => {
    if (!targetId || !data.some((order) => order.id === targetId)) return;
    setHighlightedAlertId(targetId);
    setEditingId(targetId);
    onClearTargetId?.();
  }, [targetId, data, onClearTargetId]);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [pendingBulkCancelIds, setPendingBulkCancelIds] = useState<string[]>([]);
  const [previewOrder, setPreviewOrder] = useState<Partial<PurchaseOrder> | null>(null);
  const [pendingApproveOrder, setPendingApproveOrder] = useState<Partial<PurchaseOrder> | null>(null);
  const [approving, setApproving] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [taxOptions, setTaxOptions] = useState<ImportCatalogOption[]>(FALLBACK_IMPORT_TAX_OPTIONS);
  const [withholdingOptions, setWithholdingOptions] = useState<ImportCatalogOption[]>(FALLBACK_IMPORT_WITHHOLDING_OPTIONS);
  
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const prefillRef = useRef<Partial<PurchaseOrder> | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<PurchaseOrder> | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const [variantPickerProduct, setVariantPickerProduct] = useState<any | null>(null);
  const [variantPickerIdx, setVariantPickerIdx] = useState<number>(0);
  const [importIntroOpen, setImportIntroOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importData, setImportData] = useState<PurchaseImportRow[]>([]);
  const [importCurrency, setImportCurrency] = useState<'NIO' | 'USD'>(normalizePurchaseCurrency(displayCurrency));
  const [importDataCurrency, setImportDataCurrency] = useState<'NIO' | 'USD'>(normalizePurchaseCurrency(displayCurrency));
  const [importFileName, setImportFileName] = useState('');
  const [importProcessing, setImportProcessing] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [importConfirmText, setImportConfirmText] = useState('');
  const [importResults, setImportResults] = useState<{ success: number; skipped: number; failed: number; errors: string[] } | null>(null);
  const availableWarehouseCatalog = useMemo(() => {
    const currentWarehouse = localDoc?.warehouse;
    const entries = currentWarehouse?.id
      ? [...warehouseCatalog, currentWarehouse]
      : warehouseCatalog;
    const unique = new Map<string, any>();
    entries.forEach((warehouse: any) => {
      const id = String(warehouse?.id || '').trim();
      if (id) unique.set(id, warehouse);
    });
    return [...unique.values()];
  }, [localDoc?.warehouse, warehouseCatalog]);

  useEffect(() => {
    setSuppliers(supplierCatalog);
    setProducts(productCatalog);
    setCategories(productCategories);
  }, [supplierCatalog, productCatalog, productCategories]);

  useEffect(() => {
    if (!importIntroOpen && !importModalOpen && !importPreviewOpen) return;
    let active = true;
    const readCatalog = (response: any, fallback: ImportCatalogOption[]) => {
      const entries = (Array.isArray(response) ? response : response?.data || [])
        .filter((entry: any) => entry?.code)
        .map((entry: any) => ({
          id: entry.id,
          code: String(entry.code).trim().toUpperCase(),
          name: String(entry.name || entry.code).trim(),
          rate: Number(entry.rate || 0),
          baseCalculation: entry.baseCalculation,
          isActive: entry.isActive !== false,
        }));
      return entries.length > 0 ? entries : fallback;
    };

    Promise.all([
      contabilidadService.getTaxCatalog('TAX'),
      contabilidadService.getTaxCatalog('WITHHOLDING'),
    ]).then(([taxResponse, withholdingResponse]) => {
      if (!active) return;
      setTaxOptions(readCatalog(taxResponse, FALLBACK_IMPORT_TAX_OPTIONS));
      setWithholdingOptions(readCatalog(withholdingResponse, FALLBACK_IMPORT_WITHHOLDING_OPTIONS));
    }).catch(() => {
      // Los valores de respaldo mantienen la previsualización operativa si el catálogo no responde.
    });

    return () => { active = false; };
  }, [importIntroOpen, importModalOpen, importPreviewOpen]);

  useEffect(() => {
    if (initialStatus) setStatusFilter(initialStatus);
  }, [initialStatus]);

  const findImportProduct = (sku: unknown, catalog = products) => {
    const normalized = String(sku || '').trim().toLowerCase();
    if (!normalized) return undefined;
    return catalog.find((product: any) => normalizeProductCode(product) === normalized);
  };

  const validateImportRows = useCallback((rows: PurchaseImportRow[], catalog = products) => {
    const skuCounts = new Map<string, number>();
    const existingOrderSkus = new Set(((localDoc?.items || []) as any[]).map((item) => String(item.code || item.sku || '').trim().toLowerCase()).filter(Boolean));
    const importTaxOptions = mergeImportCatalogOptions(taxOptions, FALLBACK_IMPORT_TAX_OPTIONS);
    const importWithholdingOptions = mergeImportCatalogOptions(withholdingOptions, FALLBACK_IMPORT_WITHHOLDING_OPTIONS);
    const validTaxCodes = new Set(importTaxOptions.map((option) => option.code));
    const validWithholdingCodes = new Set(['NONE', ...importWithholdingOptions.map((option) => option.code)]);
    rows.forEach((row) => {
      const sku = String(row.sku || '').trim().toLowerCase();
      if (sku) skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
    });

    return rows.map((sourceRow): PurchaseImportRow => {
      const row = { ...sourceRow };
      const sku = String(row.sku || '').trim();
      const product = findImportProduct(sku, catalog);
      const forceManualSku = row.skuResolution === 'MANUAL';
      const linkedProduct = forceManualSku ? undefined : product;
      const quantity = Number(row.quantity);
      const importedUnitPrice = Number(row.unitPrice);
      const productCost = Number(linkedProduct?.costPrice ?? linkedProduct?.cost ?? linkedProduct?.lastPurchasePrice ?? 0);
      const unitPrice = linkedProduct && (!Number.isFinite(importedUnitPrice) || importedUnitPrice === 0) ? productCost : importedUnitPrice;
      const taxType = normalizeImportCatalogValue(row.taxType, importTaxOptions, 'GRAVADO');
      const withholdingType = normalizeImportCatalogValue(row.withholdingType, importWithholdingOptions, 'NONE', ['NONE', 'SIN RETENCION', 'NO APLICA', 'NINGUNA']);
      const taxOption = importTaxOptions.find((option) => option.code === taxType);
      const withholdingOption = importWithholdingOptions.find((option) => option.code === withholdingType);
      const categoryName = String(row.category || linkedProduct?.category?.name || linkedProduct?.category || '').trim();
      const categoryByName = categories.find((category: any) => String(category.name || '').trim().toLowerCase() === categoryName.toLowerCase());
      const resolvedCategoryId = String(row.categoryId || linkedProduct?.categoryId || linkedProduct?.category?.id || categoryByName?.id || '').trim();
      // La tasa no se toma del archivo: siempre la gobierna la opción fiscal
      // seleccionada en el catálogo para evitar que una fila altere la regla.
      const taxRate = isTaxExempt(taxType) ? 0 : (taxOption?.rate ?? (['GRAVADO', 'GRAVADO_15', 'IVA_GRAVADO_15'].includes(taxType) ? 15 : 0));
      const withholdingRate = withholdingType === 'NONE' ? 0 : (withholdingOption?.rate ?? DEFAULT_ORDER_WITHHOLDING_RATES[withholdingType] ?? 0);
      const lineTotal = Number.isFinite(quantity) && Number.isFinite(unitPrice) ? Math.max(0, quantity) * Math.max(0, unitPrice) : 0;
      const taxBase = isTaxExempt(taxType) ? 0 : lineTotal;
      const withholdingBase = withholdingType === 'NONE' ? 0 : lineTotal;
      const errors = [
        !sku ? 'SKU requerido' : existingOrderSkus.has(sku.toLowerCase()) ? 'SKU ya está en esta orden' : skuCounts.get(sku.toLowerCase())! > 1 ? 'SKU duplicado en el archivo' : '',
        product && forceManualSku && normalizeProductCode(product) === sku.toLowerCase() ? 'Este SKU ya está usado; escribe otro SKU para crear un producto nuevo' : '',
        !String(row.description || '').trim() && !linkedProduct ? 'Descripción requerida para SKU no encontrado' : '',
        !categoryName ? 'Categoría requerida' : !resolvedCategoryId ? 'Categoría no encontrada; selecciona una existente o créala' : '',
        !Number.isFinite(quantity) || quantity <= 0 ? 'Cantidad debe ser mayor que cero' : '',
        !Number.isFinite(unitPrice) || unitPrice < 0 ? 'Precio unitario inválido' : '',
        !validTaxCodes.has(taxType) ? 'Tipo de IVA inválido; selecciona una opción del catálogo' : '',
        !validWithholdingCodes.has(withholdingType) ? 'Retención inválida; selecciona una opción del catálogo' : '',
      ].filter(Boolean);
      const warningParts = [
        sku && !product && !forceManualSku ? 'SKU no encontrado en inventario; se agregará como producto nuevo al recepcionar' : '',
        sku && !product && forceManualSku ? 'SKU libre; se agregará como producto nuevo al recepcionar' : '',
        sku && product && forceManualSku ? 'SKU coincide con inventario; escribe otro SKU para crear un producto nuevo' : '',
      ].filter(Boolean);

      const commercialNoteSnapshot = String(linkedProduct?.commercialNote || row.commercialNoteSnapshot || '').trim();
      const noteLength = Array.from(commercialNoteSnapshot).length;
      const noteError = noteLength > 100 ? 'La nota comercial no puede superar los 100 caracteres' : '';

      return {
        ...row,
        sku: linkedProduct?.code || sku,
        productId: linkedProduct?.id,
        currentStock: linkedProduct?.stock != null ? Number(linkedProduct.stock) : linkedProduct?.inventoryLevels?.reduce((sum: number, level: any) => sum + Number(level.quantity || 0), 0),
        description: String(row.description || linkedProduct?.name || '').trim(),
        commercialNoteSnapshot,
        category: categoryName,
        categoryId: resolvedCategoryId,
        unitPrice,
        taxType,
        taxBase,
        taxRate,
        taxAmount: taxBase * taxRate / 100,
        withholdingType,
        withholdingBase,
        withholdingRate,
        withholdingTotal: withholdingBase * withholdingRate / 100,
        _hasError: errors.length > 0 || Boolean(noteError),
        _errorMessage: errors[0] || noteError,
        _hasWarning: warningParts.length > 0,
        _warningMessage: warningParts.join(' · '),
        _skuStatus: (skuCounts.get(sku.toLowerCase())! > 1 ? 'duplicate' : product ? 'found' : sku ? 'missing' : undefined) as PurchaseImportRow['_skuStatus'],
        _skuMessage: product ? (forceManualSku ? `SKU existente · escribe otro SKU para crear un producto nuevo: ${product.name || product.code || sku}` : `SKU existente · vinculado a: ${product.name || product.code || sku}`) : sku ? 'SKU no encontrado en inventario · se agregará como producto nuevo al recepcionar' : '',
      };
    });
  }, [categories, localDoc?.items, products, taxOptions, withholdingOptions]);

  // La carga de catálogos puede terminar después de leer el archivo. En ese
  // caso una fila puede mostrar una categoría válida pero conservar el error
  // calculado cuando todavía no existían las opciones. Revalidamos sin esperar
  // otra edición del usuario y solo actualizamos el estado si cambió algo.
  useEffect(() => {
    if ((!importModalOpen && !importPreviewOpen) || importData.length === 0) return;
    setImportData((current) => {
      const refreshed = validateImportRows(current);
      const changed = refreshed.some((row, index) => {
        const previous = current[index];
        return row._hasError !== previous?._hasError
          || row._errorMessage !== previous?._errorMessage
          || row._hasWarning !== previous?._hasWarning
          || row._warningMessage !== previous?._warningMessage
          || row._skuStatus !== previous?._skuStatus
          || row.categoryId !== previous?.categoryId
          || row.taxRate !== previous?.taxRate
          || row.withholdingRate !== previous?.withholdingRate;
      });
      return changed ? refreshed : current;
    });
  }, [categories, importData.length, importModalOpen, importPreviewOpen, taxOptions, validateImportRows, withholdingOptions]);

  const resolveImportProducts = useCallback(async (rows: PurchaseImportRow[]) => {
    const catalog = [...products];
    const unresolvedSkus = Array.from(new Set(
      rows
        .map((row) => String(row.sku || '').trim())
        .filter((sku) => sku && !findImportProduct(sku, catalog)),
    ));
    const remoteProducts: any[] = [];

    // El endpoint permite resolver varios SKU exactos en una sola consulta. Se
    // fragmenta para no exceder límites de URL de proxies o servidores.
    for (let start = 0; start < unresolvedSkus.length; start += 100) {
      const batch = unresolvedSkus.slice(start, start + 100);
      try {
        const response = await inventoryService.getProducts({
          type: 'PRODUCT',
          codes: batch.join(','),
          page: 1,
          pageSize: 5000,
          report: true,
          includeInactive: true,
        });
        remoteProducts.push(...getProductListFromResponse(response).filter((product) => batch.some((sku) => normalizeProductCode(product) === sku.toLowerCase())));
      } catch {
        // Si la resolución masiva falla, las filas quedan como manuales y la
        // persona puede corregirlas en la previsualización sin perder la carga.
      }
    }

    if (remoteProducts.length > 0) {
      setProducts((current) => {
        const merged = new Map(current.map((product: any) => [String(product.id), product]));
        remoteProducts.forEach((product) => merged.set(String(product.id), product));
        return Array.from(merged.values());
      });
    }

    return [...catalog, ...remoteProducts];
  }, [products]);

  const handleDownloadPurchaseTemplate = useCallback(() => {
    const headers = ['SKU', 'Descripción', 'Nota comercial', 'Categoría', 'Cantidad', 'Precio unitario', 'Tipo IVA', 'Base IVA', 'Tasa IVA', 'Retención', 'Base retención', 'Tasa retención'];
    const exampleProduct = products[0];
    // taxOptions/withholdingOptions ya contienen el catálogo del tenant; solo
    // contienen los respaldos cuando el catálogo aún no responde.
    const activeTaxOptions = taxOptions.filter((option) => option.isActive !== false);
    const activeWithholdingOptions = withholdingOptions.filter((option) => option.isActive !== false && option.code !== 'NONE');
    const exampleTax = activeTaxOptions[0] || taxOptions[0] || FALLBACK_IMPORT_TAX_OPTIONS[0] || { code: 'GRAVADO', name: 'IVA gravado', rate: 15 };
    const formatGuideOptions = (options: ImportCatalogOption[]) => options.length > 0
      ? options.map((option) => `${option.name} (${option.rate}%)`).join(' · ')
      : 'No hay opciones activas configuradas';
    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      [exampleProduct?.code || 'SKU-001', exampleProduct?.name || 'Producto de ejemplo', exampleProduct?.commercialNote || 'Nota comercial de ejemplo', exampleProduct?.category?.name || exampleProduct?.category || 'Categoría', 1, Number(exampleProduct?.costPrice || exampleProduct?.cost || 0), exampleTax.name, '', exampleTax.rate, 'Sin retención', '', 0],
    ]);
    ws['!cols'] = headers.map((header) => ({ wch: Math.max(13, Math.min(30, header.length + 3)) }));
    const guide = XLSX.utils.aoa_to_sheet([
      ['GUÍA DE LLENADO · IMPORTACIÓN DE ÍTEMS EN ORDEN DE COMPRA'],
      ['Cada fila representa un artículo que se agregará a la orden de compra actualmente abierta. Esta carga no crea órdenes nuevas.'],
      ['Campo', 'Regla'],
      ['SKU', 'Obligatorio. Si existe en el inventario, se vinculará automáticamente; si se repite en el archivo se marcará como error.'],
      ['Descripción / Categoría', 'Si el SKU existe, se completan desde inventario cuando estén vacíos. Para un SKU no encontrado, ambos campos son obligatorios y se agregará como producto nuevo al recepcionar.'],
      ['Nota comercial', 'Opcional. Máximo 100 caracteres; se conservará como nota de la línea y se mostrará en ventas, compras y factura.'],
      ['Cantidad / Precio unitario', 'La cantidad debe ser mayor que cero y el precio no puede ser negativo.'],
      ['Tipo IVA / Base IVA / Tasa IVA', 'Escribe el nombre en español de una opción configurada. La base y la tasa se calculan automáticamente según la cantidad, el precio y la opción seleccionada; no son editables.'],
      ['Opciones de IVA configuradas', formatGuideOptions(activeTaxOptions)],
      ['Retención / Base retención / Tasa retención', 'Escribe "Sin retención" cuando no aplique; de lo contrario escribe el nombre en español de una retención configurada. La base y la tasa se calculan automáticamente y no son editables.'],
      ['Opciones de retención configuradas', ['Sin retención', ...activeWithholdingOptions.map((option) => `${option.name} (${option.rate}%)`)].join(' · ')],
      ['Compatibilidad', 'El sistema también reconoce los códigos internos de IVA y retención si el archivo los conserva de una exportación anterior.'],
      ['Cuentas contables', 'No se solicitan por producto. El asiento utiliza las cuentas configuradas en Contabilidad > Configuración para el evento de compra pagada.'],
      ['Previsualización', 'La carga no modifica la orden inmediatamente. Corrige los errores y confirma para agregar los ítems.'],
    ]);
    guide['!cols'] = [{ wch: 34 }, { wch: 115 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, 'Órdenes de compra');
    XLSX.utils.book_append_sheet(workbook, guide, 'Guía de llenado');
    XLSX.writeFile(workbook, 'plantilla_importacion_ordenes_compra.xlsx');
    toast.success('Plantilla de órdenes descargada');
  }, [products, taxOptions, withholdingOptions]);

  const handlePurchaseImportFile = useCallback(async (file: File) => {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast.error('Selecciona un archivo Excel o CSV válido');
      return;
    }
    setImportProcessing(true);
    setPreviewLoading(true);
    setPreviewProgress(3);
    try {
          const { rows: raw } = await parseSpreadsheetInWorker(file, undefined, false, (progress) => {
            setPreviewProgress(Math.min(84, Math.max(3, progress)));
          });
          setPreviewProgress(88);
          if (raw.length < 2) throw new Error('El archivo está vacío o no tiene datos');
          const headers = raw[0].map(normalizeImportHeader);
          const fieldAliases: Record<string, string[]> = {
            sku: ['sku', 'codigo / sku', 'codigo', 'código', 'code', 'product code'],
            description: ['descripcion', 'descripción', 'description', 'nombre', 'producto'],
            commercialNote: ['nota comercial', 'nota', 'commercial note', 'commercialnote'],
            category: ['categoria', 'categoría', 'category'],
            quantity: ['cantidad', 'quantity', 'qty'],
            unitPrice: ['precio unitario', 'precio', 'unit price', 'cost price'],
            taxType: ['tipo iva', 'tipo de iva', 'iva', 'tax type'],
            taxBase: ['base iva', 'base de iva', 'tax base'],
            taxRate: ['tasa iva', 'tasa de iva', 'tax rate'],
            withholdingType: ['retencion', 'retención', 'tipo retencion', 'tipo de retencion', 'withholding'],
            withholdingBase: ['base retencion', 'base de retencion', 'withholding base'],
            withholdingRate: ['tasa retencion', 'tasa de retencion', 'withholding rate'],
          };
          const columnMap: Record<string, number> = {};
          Object.entries(fieldAliases).forEach(([key, candidates]) => {
            const index = headers.findIndex((header: string) => candidates.some((candidate) => normalizeImportHeader(candidate) === header));
            if (index >= 0) columnMap[key] = index;
          });
          const get = (row: any[], key: string) => columnMap[key] === undefined ? '' : row[columnMap[key]];
          const text = (row: any[], key: string, fallback = '') => String(get(row, key) ?? fallback).trim();
          const number = (row: any[], key: string, fallback: string | number = '') => {
            const value = get(row, key);
            return value === '' || value === undefined || value === null ? fallback : Number(value);
          };
          const parsed = raw.slice(1)
            .filter((row) => row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ''))
            .map((row) => ({
              sku: text(row, 'sku'),
            description: text(row, 'description'),
              commercialNoteSnapshot: text(row, 'commercialNote'),
              category: text(row, 'category'),
              quantity: number(row, 'quantity', 0),
              unitPrice: number(row, 'unitPrice', 0),
              taxType: normalizeImportCatalogValue(text(row, 'taxType', 'GRAVADO'), mergeImportCatalogOptions(taxOptions, FALLBACK_IMPORT_TAX_OPTIONS), 'GRAVADO'),
              taxBase: number(row, 'taxBase', ''),
              taxRate: number(row, 'taxRate', ''),
              withholdingType: normalizeImportCatalogValue(text(row, 'withholdingType', 'NONE'), mergeImportCatalogOptions(withholdingOptions, FALLBACK_IMPORT_WITHHOLDING_OPTIONS), 'NONE', ['NONE', 'SIN RETENCION', 'NO APLICA', 'NINGUNA']),
              withholdingBase: number(row, 'withholdingBase', ''),
              withholdingRate: number(row, 'withholdingRate', ''),
              currentStock: undefined,
          } as PurchaseImportRow));
          if (!parsed.length) throw new Error('No se encontraron filas con datos');
          setPreviewProgress(90);
          const importCatalog = await resolveImportProducts(parsed);
          setPreviewProgress(96);
          setImportData(validateImportRows(parsed, importCatalog));
          setImportDataCurrency(importCurrency);
          setImportFileName(file.name);
          setImportProgress(0);
          setPreviewProgress(100);
          toast.success(`${parsed.length} artículo(s) encontrados`);
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo leer el archivo. Verifica que sea un Excel o CSV válido.');
    } finally {
      setImportProcessing(false);
      setPreviewLoading(false);
      setPreviewProgress(0);
    }
  }, [importCurrency, resolveImportProducts, taxOptions, validateImportRows, withholdingOptions]);

  const handleOpenPurchaseImportPreview = useCallback(() => {
    if (previewLoading || importProcessing || importing || importData.length === 0) return;
    const orderCurrency = normalizePurchaseCurrency(localDoc?.currency || displayCurrency);
    if (importDataCurrency !== orderCurrency) {
      setImportData((current) => validateImportRows(current.map((row) => ({
        ...row,
        unitPrice: Number(convertPurchaseAmount(row.unitPrice, importDataCurrency, orderCurrency, globalRate).toFixed(6)),
        taxBase: '',
        withholdingBase: '',
      }))));
      setImportDataCurrency(orderCurrency);
    }
    setImportModalOpen(false);
    setImportPreviewOpen(true);
  }, [displayCurrency, globalRate, importData.length, importDataCurrency, importProcessing, importing, localDoc?.currency, previewLoading, validateImportRows]);

  const handlePurchaseImportRowUpdate = (index: number, field: keyof PurchaseImportRow, value: any) => {
    setImportData((current) => validateImportRows(current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const nextRow = { ...row, [field]: value } as PurchaseImportRow;
      const lineTotal = Number(nextRow.quantity || 0) * Number(nextRow.unitPrice || 0);
      if (field === 'taxType') {
        const selected = taxOptions.find((option) => option.code === String(value || '').toUpperCase());
        nextRow.taxRate = selected?.rate ?? (isTaxExempt(String(value || '').toUpperCase()) ? 0 : 15);
        nextRow.taxBase = isTaxExempt(String(value || '').toUpperCase()) ? 0 : lineTotal;
      }
      if (field === 'withholdingType') {
        const normalized = String(value || 'NONE').toUpperCase();
        const selected = withholdingOptions.find((option) => option.code === normalized);
        nextRow.withholdingRate = normalized === 'NONE' ? 0 : (selected?.rate ?? DEFAULT_ORDER_WITHHOLDING_RATES[normalized] ?? 0);
        nextRow.withholdingBase = normalized === 'NONE' ? 0 : lineTotal;
      }
      if (field === 'quantity' || field === 'unitPrice') {
        nextRow.taxBase = isTaxExempt(String(nextRow.taxType || 'GRAVADO').toUpperCase()) ? 0 : lineTotal;
        nextRow.withholdingBase = String(nextRow.withholdingType || 'NONE').toUpperCase() === 'NONE' ? 0 : lineTotal;
      }
      return nextRow;
    })));
  };

  const handlePurchaseImportCategoryChange = useCallback((index: number, categoryId: string, categoryName?: string) => {
    setImportData((current) => validateImportRows(current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const selected = categories.find((category: any) => String(category.id) === String(categoryId));
      return {
        ...row,
        categoryId: selected?.id || '',
        category: selected?.name || categoryName || '',
      };
    })));
  }, [categories, validateImportRows]);

  const handleCreatePurchaseImportCategory = useCallback(async (name: string) => {
    const response = await inventoryService.createCategory({
      name: name.trim(),
      type: localDoc?.purchaseType === 'SERVICE' ? 'SERVICE' : 'PRODUCT',
    });
    const created = ((response as any)?.data || response || {}) as any;
    const createdCategory = {
      ...created,
      id: created.id || `purchase-import-category-${Date.now()}`,
      name: created.name || name.trim(),
      type: created.type || (localDoc?.purchaseType === 'SERVICE' ? 'SERVICE' : 'PRODUCT'),
    };
    setCategories((current) => [...current.filter((category: any) => String(category.id) !== String(createdCategory.id)), createdCategory]);
    return createdCategory;
  }, [localDoc?.purchaseType]);

  const handlePurchaseImportCurrencyChange = useCallback((nextCurrency: string) => {
    const next = normalizePurchaseCurrency(nextCurrency);
    const orderCurrency = normalizePurchaseCurrency(localDoc?.currency || displayCurrency);
    setImportCurrency(next);

    // En la previsualización las filas ya están expresadas en la moneda de la
    // orden. Cambiar el selector allí solo cambia la moneda de origen mostrada;
    // al volver a la carga se hará la conversión de ida y vuelta sin alterar
    // los precios editados.
    if (importPreviewOpen) return;

    if (importData.length > 0 && importDataCurrency !== next) {
      setImportData((current) => validateImportRows(current.map((row) => ({
        ...row,
        unitPrice: Number(convertPurchaseAmount(row.unitPrice, importDataCurrency, next, globalRate).toFixed(6)),
        taxBase: '',
        withholdingBase: '',
      }))));
      setImportDataCurrency(next);
    } else if (importData.length === 0) {
      setImportDataCurrency(next);
    }

    if (next !== orderCurrency) {
      toast.info(`La importación se convertirá a ${getCurrencyLabel(orderCurrency)} al previsualizar`);
    }
  }, [displayCurrency, globalRate, importData.length, importDataCurrency, importPreviewOpen, localDoc?.currency, validateImportRows]);

  const handleDownloadPurchaseImportErrors = useCallback(() => {
    const errors = importData.filter((row) => row._hasError || row._hasWarning).map((row) => ({
      SKU: row.sku,
      Descripción: row.description,
      'Nota comercial': row.commercialNoteSnapshot || '',
      Categoría: row.category,
      Cantidad: row.quantity,
      'Precio unitario': row.unitPrice,
      'Tipo IVA': row.taxType,
      'Base IVA': row.taxBase,
      'Tasa IVA': row.taxRate,
      Retención: row.withholdingType,
      'Base retención': row.withholdingBase,
      'Tasa retención': row.withholdingRate,
      Clasificación: row._hasError ? 'Error' : 'Advertencia',
      Detalle: row._errorMessage || row._warningMessage || row._skuMessage || 'Revisar fila',
    }));
    if (!errors.length) return;
    const sheet = XLSX.utils.json_to_sheet(errors);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Incidencias');
    XLSX.writeFile(workbook, 'incidencias_importacion_ordenes_compra.xlsx');
    toast.success('Reporte de incidencias descargado');
  }, [importData]);

  const handlePurchaseImportConfirm = () => {
    const validRows = importData.filter((row) => !row._hasError);
    if (!validRows.length) return toast.error('No hay filas válidas para importar');
    if (validRows.length !== importData.length) toast.warning(`Se omitirán ${importData.length - validRows.length} fila(s) con errores`);
    setImportConfirmText('');
    setImportConfirmOpen(true);
  };

  const handleFinalPurchaseImport = async () => {
    if (importConfirmText !== 'IMPORTAR' || !localDoc) return;
    const validRows = importData.filter((row) => !row._hasError);
    const skipped = importData.length - validRows.length;
    setImporting(true);
    setImportProgress(15);
    const importedItems = validRows.map((row) => {
      const tax = calcItemTax(row);
      const withholding = calcItemWithholding(row);
      const quantity = Number(row.quantity);
      const unitPrice = Number(row.unitPrice);
      return {
        id: `import-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        productId: row.productId || '',
        code: row.sku,
        name: row.description || row.sku,
        description: row.description || row.sku,
        commercialNoteSnapshot: row.commercialNoteSnapshot || null,
        category: row.category,
        categoryId: row.categoryId
          || categories.find((c: any) => String(c.name || '').trim().toLowerCase() === String(row.category || '').trim().toLowerCase())?.id
          || '',
        stockApplies: String(localDoc.purchaseType || 'INVENTORY').toUpperCase() !== 'SERVICE',
        currentStock: row.currentStock,
        quantity,
        unitPrice,
        taxType: String(row.taxType || 'GRAVADO').toUpperCase(),
        taxRate: Number(tax.taxRate.toFixed(2)),
        taxBase: Number(tax.taxBase.toFixed(2)),
        taxAmount: Number(tax.taxAmount.toFixed(2)),
        withholdingType: String(row.withholdingType || 'NONE').toUpperCase(),
        withholdingRate: Number(withholding.withholdingRate.toFixed(2)),
        withholdingBase: Number(withholding.withholdingBase.toFixed(2)),
        withholdingTotal: Number(withholding.withholdingTotal.toFixed(2)),
        total: Number((quantity * unitPrice).toFixed(2)),
      };
    });
    const currentItems = (localDoc.items || []) as any[];
    const combinedItems = [...currentItems, ...importedItems];
    const totals = calculateTotals(combinedItems);
    setLocalDoc((current) => current ? { ...current, items: combinedItems, ...totals } : current);
    setImportProgress(100);
    setImportResults({ success: importedItems.length, skipped, failed: 0, errors: [] });
    setImportPreviewOpen(false);
    setImportModalOpen(false);
    setImportConfirmOpen(false);
    setImportConfirmText('');
    setImporting(false);
    setImportData([]);
    setImportFileName('');
    setImportProgress(0);
  };

  useEffect(() => {
    if (editingId) {
      if (editingId === 'NEW') {
        const pre = prefillRef.current;
        if (pre) {
          prefillRef.current = null;
          const defaults = {
            supplierId: '',
            date: new Date().toISOString(),
            expectedDelivery: new Date(Date.now() + 7 * 86400000).toISOString(),
            currency: displayCurrency,
            exchangeRate: displayCurrency === 'NIO' ? 1 : globalRate,
            status: 'DRAFT',
            purchaseType: 'INVENTORY',
            requestedBy: 'Admin',
            address: '',
            items: [],
            subtotal: 0,
            taxAmount: 0,
            withholdingTotal: 0,
            withholdingBase: 0,
            total: 0
          };
          setLocalDoc({ ...defaults, ...pre } as Partial<PurchaseOrder>);
        } else if (!localDoc) {
          const defaults = {
            supplierId: '',
            date: new Date().toISOString(),
            expectedDelivery: new Date(Date.now() + 7 * 86400000).toISOString(),
            currency: displayCurrency,
            exchangeRate: displayCurrency === 'NIO' ? 1 : globalRate,
            status: 'DRAFT',
            purchaseType: 'INVENTORY',
            requestedBy: 'Admin',
            address: '',
            items: [],
            subtotal: 0,
            taxAmount: 0,
            withholdingTotal: 0,
            withholdingBase: 0,
            total: 0
          };
          setLocalDoc(defaults as Partial<PurchaseOrder>);
        }
      } else {
         const found = data.find(x => x.id === editingId);
         if (found) {
           const cloned = JSON.parse(JSON.stringify(found));
           const orderCurrency = normalizePurchaseCurrency(cloned.currency || displayCurrency);
           cloned.currency = orderCurrency;
           cloned.exchangeRate = orderCurrency === 'NIO' ? 1 : (Number(cloned.exchangeRate) > 1 ? Number(cloned.exchangeRate) : globalRate);
           setLocalDoc(cloned);
         } else {
           setLocalDoc(null);
         }
      }
      setEvidenceFiles([]);
    } else {
      setLocalDoc(null);
      setEvidenceFiles([]);
    }
  }, [editingId, data, displayCurrency, globalRate]);

  useEffect(() => {
    if (prefillDoc) {
      prefillRef.current = enrichPrefillItems(prefillDoc);
      setEditingId('NEW');
      onPrefillHandled?.();
    }
  }, [prefillDoc]);

  useEffect(() => {
    if (editingId === 'NEW' && localDoc && Array.isArray(localDoc.items) && productCatalog.length > 0) {
      const hasUnenriched = localDoc.items.some((it: any) => it.productId && (!it.code || !it.category));
      if (hasUnenriched) {
        const enriched = enrichPrefillItems(localDoc);
        setLocalDoc(enriched);
      }
    }
  }, [productCatalog, editingId, localDoc]);

  const enrichPrefillItems = (doc: any): any => {
    if (!doc || !Array.isArray(doc.items)) return doc;
    const items = doc.items.map((it: any) => {
      const prod = productCatalog.find((p: any) => String(p.id) === String(it.productId));
      const stockVal = it.stock ?? it.currentStock ?? (prod ? (prod.stock != null ? prod.stock : (prod.quantity ?? 0)) : undefined);
      if (prod) {
        const costPrice = Number(prod.costPrice ?? prod.cost ?? prod.price ?? it.unitPrice ?? 0);
        return {
          ...it,
          code: it.code || prod.code || prod.sku || '',
          name: it.name || prod.name || it.description || '',
          description: it.description || prod.name || it.name || '',
          category: prod.category?.name || prod.category || prod.categoryId || it.category || '',
          categoryId: it.categoryId || prod.categoryId || (prod.category?.id || ''),
          stock: stockVal,
          currentStock: stockVal,
          unitPrice: (it.unitPrice != null && Number(it.unitPrice) > 0) ? Number(it.unitPrice) : costPrice,
        };
      }
      return { ...it, stock: stockVal, currentStock: stockVal };
    });
    return { ...doc, items, ...calculateTotals(items) };
  };


  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filtered = data.filter(o => {
    const orderStatus = normalizePurchaseOrderStatus(o.status);
    if (statusFilter === 'TO_APPROVE') {
      if (!PURCHASE_ORDER_ACTIONABLE_STATUSES.includes(orderStatus)) return false;
    } else if (statusFilter !== 'ALL' && normalizePurchaseOrderStatus(statusFilter) !== orderStatus) {
      return false;
    }
    if (!normalizedSearchTerm) return true;
    const haystack = [
      o.number,
      o.supplier?.name,
      o.address,
      o.requestedBy,
      o.notes,
      ...(o.items || []).flatMap((it: any) => [
        it.code,
        it.name,
        it.category,
        it.description,
      ]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedSearchTerm);
  });

  const colFilters = useColumnFilters();
  const filterGetters = {
    number: (row: PurchaseOrder) => row.number || '',
    supplier: (row: PurchaseOrder) => row.supplier?.name || '-',
    date: (row: PurchaseOrder) => (row.date ? new Date(row.date).getTime() : null),
    total: (row: PurchaseOrder) => Number(row.total || 0),
    itemCount: (row: PurchaseOrder) => row.items?.length || 0,
    status: (row: PurchaseOrder) => normalizePurchaseOrderStatus(row.status),
  };
  const filteredData = colFilters.applyTo(filtered, filterGetters);

  const statusOptionsForFilter = PURCHASE_ORDER_STATUS_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    count: filtered.filter((order) => normalizePurchaseOrderStatus(order.status) === option.value).length,
  }));
  const itemCountOptions = [...new Set(filtered.map((order) => order.items?.length || 0))]
    .sort((a, b) => a - b)
    .map((value) => ({
      value: String(value),
      label: `${value} ${value === 1 ? 'ítem' : 'ítems'}`,
      count: filtered.filter((order) => (order.items?.length || 0) === value).length,
    }));

  const handleExportListPdf = async (format: PdfDownloadFormat) => {
    const exportToastId = toast.loading('Generando reporte de órdenes de compra...');
    try {
      await generatePurchaseListPDF({
        title: 'Órdenes de compra',
        rows: filteredData,
        tenantName: user?.tenantName || 'Empresa',
        format,
        targetKey: 'compras.purchase-order',
        columns: [
          { label: 'N° Orden', value: (row) => row.number },
          { label: 'Proveedor', value: (row) => row.supplier?.name || 'Sin proveedor' },
          { label: 'Fecha', value: (row) => row.date ? formatDateEs(row.date) : '—' },
          { label: 'Ítems', align: 'center', value: (row) => String(row.items?.length || 0) },
          { label: 'Total', align: 'right', value: (row) => formatConvertedAmount(Number(row.total || 0), row.currency, row.exchangeRate) },
          { label: 'Estado', align: 'center', value: (row) => getPurchaseOrderStatusOption(row.status).label },
        ],
      });
      toast.success('Reporte PDF descargado', { id: exportToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo generar el reporte', { id: exportToastId });
    }
  };

  const distinctSuppliers = [...new Map(filtered.map((o) => [o.supplier?.name || '-', o.supplier?.name || '-'])).entries()]
    .map(([, label]) => ({ value: label, label, count: filtered.filter((o) => (o.supplier?.name || '-') === label).length }));

  const columns: ColumnDef<PurchaseOrder>[] = [
    { key: 'number',   header: 'N° Orden',   width: '140px',
      headerExtra: <ColumnFilterMenu label="N° Orden" sort={colFilters.state.number?.sort || null} onSort={(sort) => colFilters.setSort('number', sort)} />,
      render: (val, row) => (
        <div className="flex flex-col items-start gap-1">
          <span className="font-black font-mono text-primary text-xs">{val}</span>
          {(row.purchaseRequestId || row.purchaseRequestNumber) && (
            <Badge className="border-none bg-orange-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase text-orange-500">
              Desde solicitud
            </Badge>
          )}
        </div>
      ) },
    { key: 'supplier', header: 'Proveedor',
      headerExtra: <ColumnFilterMenu label="Proveedor" options={distinctSuppliers} selected={colFilters.state.supplier?.values || []} onSelect={(values) => colFilters.setValues('supplier', values)} sort={colFilters.state.supplier?.sort || null} onSort={(sort) => colFilters.setSort('supplier', sort)} />,
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',     header: 'Fecha',     width: '110px',
      headerExtra: <ColumnFilterMenu label="Fecha" sort={colFilters.state.date?.sort || null} onSort={(sort) => colFilters.setSort('date', sort)} sortOptions={[{ value: 'desc', label: 'Más recientes' }, { value: 'asc', label: 'Más antiguas' }]} />,
      render: (val) => <span className="text-xs text-muted-foreground">{val ? formatDateEs(val) : '-'}</span> },
    { key: 'itemCount', header: 'Ítems', width: '90px',
      headerExtra: <ColumnFilterMenu label="Ítems" options={itemCountOptions} selected={colFilters.state.itemCount?.values || []} onSelect={(values) => colFilters.setValues('itemCount', values)} sort={colFilters.state.itemCount?.sort || null} onSort={(sort) => colFilters.setSort('itemCount', sort)} sortType="number" />,
      render: (_val, row) => <span className="font-bold tabular-nums text-sm">{row.items?.length || 0}</span> },
    { key: 'total',    header: 'Total',     width: '130px',
      headerExtra: <ColumnFilterMenu label="Total" sort={colFilters.state.total?.sort || null} onSort={(sort) => colFilters.setSort('total', sort)} />,
      render: (val, row) => (
        <CurrencyValuationAmount amount={Number(val || 0)} sourceCurrency={row.currency} sourceExchangeRate={row.exchangeRate} className="font-black text-foreground" />
      ) },
    { key: 'status',   header: 'Estado',    width: '120px',
      headerExtra: <ColumnFilterMenu label="Estado" options={statusOptionsForFilter} selected={colFilters.state.status?.values || []} onSelect={(values) => colFilters.setValues('status', values)} sort={colFilters.state.status?.sort || null} onSort={(sort) => colFilters.setSort('status', sort)} />,
      render: (val) => { const option = getPurchaseOrderStatusOption(val); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', option.color)}>{option.label}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<PurchaseOrder>) => {
    const updateToastId = toast.loading('Guardando cambios en la orden de compra...');
    try { await purchaseOrdersService.update(id as string, updates); toast.success('Orden actualizada', { id: updateToastId }); onRefresh(); }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar', { id: updateToastId }); throw new Error('Update failed'); }
  };

  const handleCancelConfirm = async () => {
    const requestedCancelIds = [...(pendingCancelId ? [pendingCancelId] : []), ...pendingBulkCancelIds];
    const cancelIds = requestedCancelIds.filter((id) => {
      const status = String(data.find((order) => order.id === id)?.status || '').toUpperCase();
      return PURCHASE_ORDER_ACTIONABLE_STATUSES.includes(normalizePurchaseOrderStatus(status));
    });
    if (cancelIds.length === 0 || !cancelReason.trim()) return;
    setCancelLoading(true);
    const cancelToastId = toast.loading(cancelIds.length === 1 ? 'Rechazando orden de compra...' : `Rechazando ${cancelIds.length} órdenes de compra...`);
    try {
      for (const id of cancelIds) {
        await purchaseOrdersService.reject(id, cancelReason.trim());
      }
      toast.success(cancelIds.length === 1 ? 'Orden de compra rechazada' : `${cancelIds.length} órdenes de compra rechazadas`, { id: cancelToastId });
      setPendingCancelId(null);
      setPendingBulkCancelIds([]);
      setCancelReason('');
      setPreviewOrder(null);
      if (editingId && cancelIds.includes(editingId)) setEditingId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al anular', { id: cancelToastId });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleApproveOrder = async (orderId: string) => {
    setApproving(true);
    const approveToastId = toast.loading('Aprobando orden de compra y preparando recepción...');
    try {
      const result = await purchaseOrdersService.approve(orderId) as any;
      toast.success(result?.receipt?.number
        ? `Orden aprobada. Recepción ${result.receipt.number} preparada.`
        : 'Orden de compra aprobada', { id: approveToastId });
      setPendingApproveOrder(null);
      setPreviewOrder(null);
      if (editingId === orderId) setEditingId(null);
      onApprovedToReceipt?.(result?.receipt);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al aprobar', { id: approveToastId });
    } finally {
      setApproving(false);
    }
  };

  const handleDownloadOrderPdf = async (order: Partial<PurchaseOrder>, format: PdfDownloadFormat = 'configured') => {
    const pdfToastId = toast.loading('Generando PDF de la orden de compra...');
    try {
      await generatePurchaseRecordPDF({
        format,
        targetKey: 'compras.purchase-order',
        document: {
          title: 'Orden de compra',
          number: String(order.number || 'Sin número'),
          date: order.date ? formatDateEs(order.date) : undefined,
          status: getPurchaseOrderStatusOption(order.status).label,
          supplier: order.supplier?.name || 'Sin proveedor',
          fields: [
            { label: 'Solicitud de compra', value: order.purchaseRequestNumber || 'No vinculada' },
            { label: 'Dirección', value: order.address || '—' },
            { label: 'Bodega', value: order.warehouse?.name || '—' },
          ],
          lines: (order.items || []).map((item: any) => ({
            description: item.description || item.name || item.code || 'Artículo sin descripción',
            quantity: Number(item.quantity || 0),
            unitPrice: formatConvertedAmount(Number(item.unitPrice || 0), order.currency, order.exchangeRate || globalRate),
            total: formatConvertedAmount(Number(item.total || (Number(item.quantity || 0) * Number(item.unitPrice || 0))), order.currency, order.exchangeRate || globalRate),
            secondary: [item.code ? `Código: ${item.code}${item.category ? ` · ${item.category}` : ''}` : item.category, item.commercialNoteSnapshot ? `Nota: ${item.commercialNoteSnapshot}` : ''].filter(Boolean).join(' · '),
          })),
          total: formatConvertedAmount(Number(order.total || 0), order.currency, order.exchangeRate || globalRate),
          totalLabel: 'Total',
          notes: order.notes,
        },
        tenantName: user?.tenantName || 'Nova Hub',
      });
      toast.success('PDF descargado', { id: pdfToastId });
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo generar el PDF', { id: pdfToastId });
    }
  };

  const buildOrderPanel = (order: Partial<PurchaseOrder>): SalesDocumentPanelData => ({
    id: String(order.id || ''),
    number: String(order.number || 'Sin número'),
    title: 'Orden de compra',
    customerName: order.supplier?.name || 'Sin proveedor',
    hideCustomer: true,
    status: normalizePurchaseOrderStatus(order.status),
    sourceLabel: order.purchaseRequestId || order.purchaseRequestNumber ? 'Desde solicitud de compra' : undefined,
    totalLabel: formatConvertedAmount(Number(order.total || 0), order.currency, order.exchangeRate || globalRate),
    summaryDetails: [
      { label: 'Líneas', value: String(order.items?.length || 0) },
      { label: 'Bodega', value: order.warehouse?.name || 'No indicada' },
      { label: 'Moneda', value: String(order.currency || displayCurrency).toUpperCase() },
    ],
    metadata: [
      { label: 'Proveedor', value: order.supplier?.name || 'No disponible' },
      { label: 'Fecha', value: order.date ? formatDateEs(order.date) : 'No disponible' },
      { label: 'Dirección', value: order.address || 'No disponible' },
    ],
    lines: (order.items || []).map((item: any, index) => ({
      id: String(item.id || item.productId || index),
      description: item.description || item.name || item.code || 'Artículo sin descripción',
      quantity: Number(item.quantity || 0),
      unitPriceLabel: formatConvertedAmount(Number(item.unitPrice || 0), order.currency, order.exchangeRate || globalRate),
      totalLabel: formatConvertedAmount(Number(item.total || (Number(item.quantity || 0) * Number(item.unitPrice || 0))), order.currency, order.exchangeRate || globalRate),
      secondaryLabel: [item.code ? `Código: ${item.code}${item.category ? ` · ${item.category}` : ''}` : item.category, item.commercialNoteSnapshot ? `Nota: ${item.commercialNoteSnapshot}` : ''].filter(Boolean).join(' · '),
    })),
    notes: order.notes,
  });

  const renderOrderDetailPanel = () => (
    <SalesDocumentDetailSheet
      key={previewOrder?.id || 'purchase-order-detail'}
      document={previewOrder ? buildOrderPanel(previewOrder) : null}
      entity="PURCHASE_ORDER"
      open={Boolean(previewOrder)}
      onClose={() => setPreviewOrder(null)}
      onOpenDocument={() => {
        if (!previewOrder) return;
        setPreviewOrder(null);
        setEditingId(String(previewOrder.id));
      }}
      onDownloadPdf={(format) => previewOrder ? void handleDownloadOrderPdf(previewOrder, format) : undefined}
    />
  );

  const handleSaveDoc = async (newStatus: 'DRAFT' | 'IN_PROCESS' = 'DRAFT') => {
    if (!localDoc?.supplierId) return toast.error('Debe seleccionar un proveedor');
    if (!String(localDoc.address || '').trim()) return toast.error('Debe ingresar la dirección');
    if ((localDoc.items || []).length === 0) return toast.error('Debe agregar al menos un ítem');
    if ((localDoc.items || []).some((it: any) => !String(it.code || '').trim() || !String(it.name || '').trim())) {
      return toast.error('Cada ítem requiere código y nombre');
    }
    if ((localDoc.items || []).some((it: any) => !String(it.category || '').trim())) {
      return toast.error('Cada producto debe tener una categoría. Selecciónala o créala antes de guardar.');
    }
    const requiresWarehouse = String(localDoc.purchaseType || 'INVENTORY').toUpperCase() === 'INVENTORY'
      || (localDoc.items || []).some((it: any) => it.stockApplies === true);
    if (requiresWarehouse && !String(localDoc.warehouseId || '').trim()) {
      return toast.error('Selecciona una bodega destino de la sucursal activa.');
    }

    const normalizedItems = (localDoc.items || []).map((it: any) => {
      const quantity = Math.max(0, Math.trunc(Number(it.quantity || 0)));
      const unitPrice = Math.max(0, Number(it.unitPrice || 0));
      const taxType = it.taxType || 'GRAVADO';
      const tax = calcItemTax({ ...it, quantity, unitPrice, taxType });
      const withholding = calcItemWithholding({ ...it, quantity, unitPrice });
      return {
        ...it,
        quantity,
        unitPrice,
        taxType,
        taxRate: Number(tax.taxRate.toFixed(2)),
        taxBase: Number(tax.taxBase.toFixed(2)),
        taxAmount: Number(tax.taxAmount.toFixed(2)),
        withholdingType: it.withholdingType || 'NONE',
        withholdingRate: Number(withholding.withholdingRate.toFixed(2)),
        withholdingBase: Number(withholding.withholdingBase.toFixed(2)),
        total: Number((quantity * unitPrice).toFixed(2)),
      };
    });
    const calculatedTotals = calculateTotals(normalizedItems as any[]);
    const currentOrderStatus = normalizePurchaseOrderStatus(localDoc.status);
    const statusToSave = editingId === 'NEW'
      ? newStatus
      : (PURCHASE_ORDER_ACTIONABLE_STATUSES.includes(newStatus) && PURCHASE_ORDER_ACTIONABLE_STATUSES.includes(currentOrderStatus)
        ? (currentOrderStatus === 'IN_PROCESS' && newStatus === 'DRAFT' ? currentOrderStatus : newStatus)
        : currentOrderStatus);
    const orderCurrency = normalizePurchaseCurrency(localDoc.currency || displayCurrency);
    const orderExchangeRate = orderCurrency === 'NIO' ? 1 : (Number(localDoc.exchangeRate) > 0 ? Number(localDoc.exchangeRate) : globalRate);
    const cleanedDoc: any = {
      ...localDoc,
      currency: orderCurrency,
      exchangeRate: orderExchangeRate,
      status: statusToSave,
      isService: localDoc.purchaseType === 'SERVICE',
      purchaseRequestId: localDoc.purchaseRequestId || null,
      purchaseRequestNumber: localDoc.purchaseRequestNumber || null,
      taxRate: 0,
      withholdingRate: 0,
      subtotal: Number(calculatedTotals.subtotal || 0),
      taxAmount: Number(calculatedTotals.taxAmount || 0),
      withholdingTotal: Number(calculatedTotals.withholdingTotal || 0),
      withholdingBase: Number(calculatedTotals.withholdingBase || 0),
      total: Number(calculatedTotals.total || 0),
      items: normalizedItems.map((it: any) => ({
        ...it,
        description: it.description || it.name || '',
        quantity: Math.trunc(Number(it.quantity || 0)),
        unitPrice: Number(it.unitPrice || 0),
        taxType: it.taxType || 'GRAVADO',
        taxRate: Number(it.taxRate || 0),
        taxBase: Number(it.taxBase || 0),
        taxAmount: Number(it.taxAmount || 0),
        withholdingType: it.withholdingType || 'NONE',
        withholdingRate: Number(it.withholdingRate || 0),
        withholdingBase: it.withholdingType === 'NONE' ? 0 : Number(it.withholdingBase || 0),
        accountId: it.accountId || null,
        costCenterId: it.costCenterId || null,
        stock: it.stock === '' || it.stock === undefined || it.stock === null ? undefined : Number(it.stock),
        total: Number(it.total || 0),
      })),
    };

    const saveToastId = toast.loading(editingId === 'NEW'
      ? (statusToSave === 'DRAFT' ? 'Guardando orden de compra como borrador...' : 'Registrando orden de compra...')
      : 'Guardando orden de compra...');
    if (evidenceFiles.length > 0) {
      const uploaded: { url: string; name: string; type: string; size: number }[] = [];
      for (const file of evidenceFiles) {
        const isImage = file.type.startsWith('image/');
        if (isImage && file.size > MAX_EVIDENCE_IMAGE_BYTES) {
          toast.error(`La imagen original "${file.name}" es muy pesada. Máximo 10 MB`, { id: saveToastId });
          return;
        }
        if (!isImage && file.size > MAX_EVIDENCE_FILE_BYTES) {
          toast.error(`El archivo "${file.name}" es muy pesado. Máximo 10MB`, { id: saveToastId });
          return;
        }
        try {
          const evidence = await storageService.uploadFile('purchase-evidence', file, { folder: 'ordenes' });
          uploaded.push({ url: evidence.uri, name: file.name, type: file.type, size: file.size });
        } catch {
          toast.error(`No se pudo procesar el archivo "${file.name}"`, { id: saveToastId });
          return;
        }
      }
      cleanedDoc.evidenceFiles = uploaded;
      cleanedDoc.evidenceFileUrl = uploaded[0]?.url;
      cleanedDoc.evidenceFileName = uploaded[0]?.name;
      cleanedDoc.evidenceFileType = uploaded[0]?.type;
      cleanedDoc.evidenceFileSize = uploaded[0]?.size;
    }
    
    try {
      if (editingId === 'NEW') {
        const created = await purchaseOrdersService.create(cleanedDoc);
        if (created?.purchaseRequestId) {
          try {
            await purchaseRequestsService.changeStatus(created.purchaseRequestId, 'APPROVED', undefined, created.supplierId);
          } catch { /* la solicitud se podrá aprobar manualmente */ }
        }
        toast.success(statusToSave === 'DRAFT' ? 'Orden guardada como borrador' : 'Orden guardada en proceso', { id: saveToastId });
      } else {
        await purchaseOrdersService.update(editingId!, cleanedDoc);
        toast.success('Orden guardada', { id: saveToastId });
      }
      setEditingId(null);
      setEvidenceFiles([]);
      onRefresh();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '';
      if (msg.toLowerCase().includes('no existe') || e?.response?.status === 404) {
        toast.error('Uno de los productos seleccionados ya no está disponible o fue eliminado. Verifica los ítems e intenta de nuevo.', { id: saveToastId });
      } else {
        toast.error(msg || 'Error al guardar la orden de compra', { id: saveToastId });
      }
    }
  };

  const handleDeleteItem = (idx: number) => {
    if (!localDoc) return;
    const newItems = [...(localDoc.items || [])];
    newItems.splice(idx, 1);
    recalculateTotals(newItems);
  };

  const calculateTotals = (items: any[]) => {
    const subtotal = items.reduce((acc, it) => acc + (Number(it.quantity||0) * Number(it.unitPrice||0)), 0);
    const taxAmount = items.reduce((acc, it) => acc + calcItemTax(it).taxAmount, 0);
    const withholdingTotal = items.reduce((acc, it) => acc + calcItemWithholding(it).withholdingTotal, 0);
    const withholdingBase = items.reduce((acc, it) => acc + calcItemWithholding(it).withholdingBase, 0);
    const total = subtotal + taxAmount - withholdingTotal;
    return { subtotal, taxAmount, withholdingTotal, withholdingBase, total };
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    if (!localDoc) return;
    const currentItem = (localDoc.items || [])[idx] as any;
    if (currentItem?.productId && LINKED_PRODUCT_LOCKED_FIELDS.has(field)) return;
    setLocalDoc((prev) => {
      if (!prev) return prev;
      const newItems = [...(prev.items || [])];
      const nextValue = field === 'quantity' && value !== ''
        ? Math.max(0, Math.trunc(Number(value) || 0))
        : value;
      newItems[idx] = { ...newItems[idx], [field]: nextValue };

      if (field === 'stockApplies' && !value) {
        newItems[idx].stock = undefined;
      }

      if (['quantity', 'unitPrice', 'taxType', 'taxRate', 'taxBase', 'taxAmount', 'withholdingType', 'withholdingRate'].includes(field)) {
        const q = Number(newItems[idx].quantity || 0);
        const p = Number(newItems[idx].unitPrice || 0);
        const sub = q * p;
        const tt = (newItems[idx].taxType || 'GRAVADO').toUpperCase();
        if (isTaxExempt(tt)) {
          newItems[idx].taxRate = 0;
          newItems[idx].taxBase = 0;
          newItems[idx].taxAmount = 0;
        } else {
          const tax = calcItemTax(newItems[idx]);
          newItems[idx].taxRate = Number(tax.taxRate.toFixed(2));
          newItems[idx].taxBase = Number(tax.taxBase.toFixed(2));
          newItems[idx].taxAmount = Number(tax.taxAmount.toFixed(2));
        }
        const wt = (newItems[idx].withholdingType || 'NONE').toUpperCase();
        if (wt === 'NONE') {
          newItems[idx].withholdingRate = 0;
          newItems[idx].withholdingBase = 0;
        } else {
          const withholding = calcItemWithholding(newItems[idx]);
          newItems[idx].withholdingRate = Number(withholding.withholdingRate.toFixed(2));
          newItems[idx].withholdingBase = Number(withholding.withholdingBase.toFixed(2));
        }
        newItems[idx].total = Number(sub.toFixed(2));
      }
      const totals = calculateTotals(newItems);
      return { ...prev, items: newItems, ...totals };
    });
  };

  const handleSelectExistingProduct = (idx: number, productId: string) => {
    if (!localDoc) return;
    const selected = products.find((p: any) => String(p.id) === String(productId));
    if (!selected) return;

    if (selected.isVariable && selected.variants && selected.variants.length > 1) {
      setVariantPickerProduct(selected);
      setVariantPickerIdx(idx);
      setVariantPickerOpen(true);
      return;
    }

    applyProductToItem(idx, selected);
  };

  const applyProductToItem = (idx: number, selected: any) => {
    if (!localDoc) return;

    const newItems = [...(localDoc.items || [])];
    const currentItem = newItems[idx] || {};
    const purchasePrice = Number(selected.costPrice ?? selected.cost ?? selected.price ?? 0);
    const currentStock = selected.stock != null ? selected.stock :
      (selected.inventoryLevels?.[0]?.quantity ?? selected.quantity ?? 0);
    const rawTaxRate = Number(selected.taxRate);
    const taxRate = rawTaxRate > 0 && rawTaxRate <= 1 ? rawTaxRate * 100 : Number.isFinite(rawTaxRate) && rawTaxRate >= 0 ? rawTaxRate : 15;
    const quantity = Math.max(0, Math.trunc(Number(currentItem.quantity || 1)));
    const lineTotal = Number((quantity * purchasePrice).toFixed(2));
    const taxType = selected.taxType || (taxRate > 0 ? 'GRAVADO' : 'EXENTO');
    const taxBase = isTaxExempt(taxType) ? 0 : lineTotal;
    const categoryId = selected.categoryId || selected.category?.id || categories.find((category: any) =>
      String(category.name || '').trim().toLowerCase() === String(selected.category?.name || selected.category || '').trim().toLowerCase()
    )?.id || '';
    newItems[idx] = {
      ...currentItem,
      productId: selected.id,
      code: selected.code || selected.sku || '',
      name: selected.name || '',
      description: selected.description || selected.name || '',
      commercialNoteSnapshot: selected.commercialNote || null,
      category: selected.category?.name || selected.category || categoryId || '',
      categoryId,
      stockApplies: localDoc.purchaseType === 'SERVICE' ? false : true,
      stock: Number(currentStock),
      currentStock: Number(currentStock),
      unitPrice: purchasePrice,
      taxType,
      taxRate: isTaxExempt(taxType) ? 0 : taxRate,
      taxBase,
      taxAmount: isTaxExempt(taxType) ? 0 : Number((taxBase * taxRate / 100).toFixed(2)),
      withholdingType: 'NONE',
      withholdingRate: 0,
      withholdingBase: 0,
      quantity,
      total: lineTotal,
    };
    recalculateTotals(newItems);
  };

  const handlePurchaseVariantSelected = (variant: any) => {
    if (!variantPickerProduct) return;
    const selected = {
      ...variantPickerProduct,
      id: variantPickerProduct.id,
      code: variant.sku || variantPickerProduct.code,
      name: `${variantPickerProduct.name} - ${(variant.attributes || []).map((a: any) => a.value).join(' / ')}`,
      costPrice: Number(variantPickerProduct.costPrice || 0) + Number(variant.costModifier || 0),
      variantId: variant.id,
    };
    applyProductToItem(variantPickerIdx, selected);
  };

  const recalculateTotals = (items: any[]) => {
    const totals = calculateTotals(items);
    setLocalDoc(prev => ({ ...prev!, items, ...totals }));
  };

  if (importPreviewOpen) {
    return (
      <>
        <PurchaseImportPreview
          rows={importData}
          fileName={importFileName}
          isSidebarCollapsed={isSidebarCollapsed}
          importing={importing}
          progress={importProgress}
          currency={normalizePurchaseCurrency(localDoc?.currency || displayCurrency)}
          importCurrency={importCurrency}
          conversionRate={globalRate}
          categoryOptions={categories}
          exchangeRate={Number(localDoc?.exchangeRate || globalRate || 1)}
          taxOptions={taxOptions}
          withholdingOptions={withholdingOptions}
          onRowUpdate={handlePurchaseImportRowUpdate}
          onCategoryChange={handlePurchaseImportCategoryChange}
          onCreateCategory={handleCreatePurchaseImportCategory}
          onImportCurrencyChange={handlePurchaseImportCurrencyChange}
          onDownloadErrors={handleDownloadPurchaseImportErrors}
          onConfirm={handlePurchaseImportConfirm}
          onBack={() => { setImportPreviewOpen(false); setImportModalOpen(true); }}
        />
        <Dialog open={importConfirmOpen && !importing} onOpenChange={setImportConfirmOpen}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Agregar productos a la orden</DialogTitle>
              <DialogDescription>Los productos válidos se agregarán a la orden actual. Después pulsa Guardar para persistir la orden. Escribe IMPORTAR para confirmar.</DialogDescription>
            </DialogHeader>
            <Input value={importConfirmText} onChange={(event) => setImportConfirmText(event.target.value.toUpperCase())} placeholder="IMPORTAR" autoFocus />
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportConfirmOpen(false)} disabled={importing}>Cancelar</Button>
              <Button onClick={handleFinalPurchaseImport} disabled={importConfirmText !== 'IMPORTAR' || importing}>Agregar productos</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={importResults !== null} onOpenChange={(open) => { if (!open) setImportResults(null); }}>
          <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle>Productos agregados</DialogTitle>
              <DialogDescription>Los ítems ya están dentro de esta orden de compra, pero todavía debes guardarla.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-emerald-500">{importResults?.success || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Ítems agregados</p></div>
              <div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-amber-500">{importResults?.skipped || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Filas omitidas</p></div>
            </div>
            <DialogFooter><Button className="w-full" onClick={() => setImportResults(null)}>Volver a la orden</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <ImportProgressOverlay
          open={previewLoading}
          progress={previewProgress}
          title="Preparando previsualización"
          description="Validando los productos y resolviendo sus vínculos con inventario."
        />
      </>
    );
  }

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const currentStatus = normalizePurchaseOrderStatus(localDoc.status);
    const orderCurrency = normalizePurchaseCurrency(localDoc.currency || displayCurrency);
    const orderCurrencySymbol = getCurrencySymbol(orderCurrency);
    const equivalentCurrency = orderCurrency === 'USD' ? 'NIO' : 'USD';
    const equivalentCurrencySymbol = getCurrencySymbol(equivalentCurrency);
    const conversionRate = Number(globalRate) > 0 ? Number(globalRate) : 36.5;
    const convertToEquivalent = (amount: number) => orderCurrency === 'USD'
      ? Number(amount || 0) * conversionRate
      : Number(amount || 0) / conversionRate;
    const formatFinancialAmount = (amount: number) => `${orderCurrencySymbol} ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const renderEquivalent = (amount: number, negative = false) => (
      <span className="block text-[9px] font-medium tabular-nums text-muted-foreground">
        ≈ {negative ? '-' : ''}{equivalentCurrencySymbol} {Math.abs(convertToEquivalent(amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {equivalentCurrency}
      </span>
    );
    const canEditOrderItems = isNew
      ? canPerform('PURCHASES_ORDERS', 'create')
      : canPerform('PURCHASES_ORDERS', 'edit') && PURCHASE_ORDER_ACTIONABLE_STATUSES.includes(currentStatus);
    const isItemMasterFieldDisabled = (item: any) => Boolean(item.productId) || !canEditOrderItems;
    const financialTotals = calculateTotals((localDoc.items || []) as any[]);
    
    return (
      <div className="min-w-0 max-w-full space-y-6 animate-in slide-in-from-right duration-300" data-tour="purchases-form-title">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Nueva Orden de Compra' : `Orden ${localDoc.number}`}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Detalle del registro</p>
                {localDoc.purchaseRequestNumber && (
                  <Badge className="border-none bg-orange-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase text-orange-500">
                    Desde solicitud
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3" data-tour="purchases-form-actions">
            <PurchaseViewTutorial view="orders" context="form" />
             {!isNew && (
                <Button variant="outline" className="rounded-xl border-primary/50 text-primary hover:bg-primary/10 font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => setPreviewOrder(localDoc)}>
                  <Eye className="size-3 mr-2" /> Vista previa
                </Button>
             )}
             {!isNew && (
               <>
                 <Button
                   variant="outline"
                   className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4"
                   onClick={() => void handleDownloadOrderPdf(localDoc)}
                 >
                   <Download className="size-3 mr-2" /> Descargar PDF
                 </Button>
               </>
             )}
            {isNew && canPerform('PURCHASES_ORDERS', 'create') && (
              <>
                <Button variant="outline" onClick={() => handleSaveDoc('DRAFT')} className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4">
                  Guardar borrador
                </Button>
                <Button onClick={() => handleSaveDoc('IN_PROCESS')} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                  Guardar
                </Button>
              </>
            )}
            {!isNew && PURCHASE_ORDER_ACTIONABLE_STATUSES.includes(currentStatus) && canPerform('PURCHASES_ORDERS', 'edit') && (
              <>
                {currentStatus === 'DRAFT' && (
                  <Button variant="outline" onClick={() => handleSaveDoc('DRAFT')} className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4">
                    Guardar borrador
                  </Button>
                )}
                <Button onClick={() => handleSaveDoc('IN_PROCESS')} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                  Guardar
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50" data-tour="purchases-form-data">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-foreground">Información General</p>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                {!isNew && (
                  <div>
                    <p className="text-[10px] text-foreground mb-1">Número</p>
                    <Input value={localDoc.number || ''} disabled className="h-8 text-xs font-black uppercase bg-muted/20" />
                  </div>
                )}
                {( !isNew || !!localDoc?.purchaseRequestNumber ) && (
                  <div>
                    <p className="text-[10px] text-foreground mb-1">Solicitud de Compra</p>
                    <Input value={localDoc?.purchaseRequestNumber || ''} disabled className="h-8 text-xs font-bold uppercase bg-muted/20" />
                  </div>
                )}
                <div className={(isNew && !localDoc?.purchaseRequestNumber) ? 'col-span-2' : ''}>
                  <p className="text-[10px] text-foreground mb-1">Proveedor</p>
                  <Combobox 
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                    options={suppliers
                      .filter(s => (s.status || '').toUpperCase() === 'ACTIVE' || s.id === localDoc.supplierId)
                      .map(s => ({ label: s.name, value: s.id, description: (s.code ? `[${s.code}] ` : '') + (s.phone || 'Sin teléfono') }))}
                    value={localDoc.supplierId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val })}
                    placeholder="Seleccionar Proveedor"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-foreground mb-1">Bodega destino *</p>
                  <Combobox
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                    options={availableWarehouseCatalog
                      .filter((warehouse: any) => warehouse?.isActive !== false && (!selectedBranchId || warehouse.clientTenantId === selectedBranchId))
                      .map((warehouse: any) => ({
                        label: warehouse.name,
                        value: warehouse.id,
                        description: warehouse.location || 'Bodega operativa',
                      }))}
                    value={localDoc.warehouseId || ''}
                    onChange={(value) => setLocalDoc({ ...localDoc, warehouseId: value })}
                    placeholder="Seleccionar bodega destino"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">Solo bodegas activas de la sucursal seleccionada.</p>
                </div>
                <div>
                  <p className="text-[10px] text-foreground mb-1">Fecha Emisión</p>
                  <Input 
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                    type="date" 
                    value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-foreground mb-1">Entrega Esperada</p>
                  <Input 
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                    type="date" 
                    value={localDoc.expectedDelivery ? new Date(localDoc.expectedDelivery).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, expectedDelivery: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <CurrencySelector
                  value={localDoc.currency || displayCurrency}
                  baseCurrency={baseCurrency}
                  exchangeRate={globalRate}
                  label="Moneda de la orden"
                  rateDecimals={2}
                  disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                  onChange={(nextCurrency) => setLocalDoc({
                    ...localDoc,
                    currency: nextCurrency,
                    exchangeRate: nextCurrency === baseCurrency ? 1 : globalRate,
                  })}
                />
                <div>
                    <p className="text-[10px] text-foreground mb-1">Tipo de Compra</p>
                    <Select
                      disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                      value={localDoc.purchaseType || 'INVENTORY'}
                      onValueChange={(pt) => {
                        setLocalDoc({ ...localDoc, purchaseType: pt });
                        if (pt === 'SERVICE') {
                          const updatedItems = (localDoc.items || []).map((item: any) => ({
                            ...item, stockApplies: false, stock: undefined,
                          }));
                          setLocalDoc((prev: any) => prev ? { ...prev, purchaseType: pt, items: updatedItems } : prev);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar tipo de compra" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INVENTORY">Inventario</SelectItem>
                        <SelectItem value="ASSET">Activo Fijo</SelectItem>
                        <SelectItem value="SERVICE">Servicio</SelectItem>
                        <SelectItem value="ADMIN">Gasto Administrativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                <div className="order-2 col-span-2">
                  <p className="text-[10px] text-foreground mb-1">Dirección</p>
                  <Input
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                    value={localDoc.address || ''}
                    onChange={(e) => setLocalDoc({ ...localDoc, address: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="Dirección de entrega o facturación"
                  />
                </div>
                <div className="order-1 col-span-1 sm:col-span-1">
                  <p className="text-[10px] text-foreground mb-1">Adjuntar evidencia (PDF, imagen, XLSX)</p>
                  <Input
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                    type="file"
                    multiple
                    accept=".pdf,.xlsx,.xls,image/*"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setEvidenceFiles(prev => [...prev, ...files]);
                    }}
                    className="h-8 text-xs"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">Imágenes originales max 10 MB; se optimizan. Otros archivos max 10 MB.</p>
                  {evidenceFiles.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {evidenceFiles.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                          {file.type.startsWith('image/') ? (
                            <img src={URL.createObjectURL(file)} alt={file.name} className="size-8 rounded object-cover border border-border/50" />
                          ) : (
                            <FileText className="size-4 text-primary shrink-0" />
                          )}
                          <span className="text-[10px] font-bold text-foreground truncate flex-1">{file.name}</span>
                          <span className="text-[9px] text-muted-foreground shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                          <Button variant="ghost" size="icon" className="size-6 shrink-0 text-rose-500 hover:bg-rose-500/10" onClick={() => setEvidenceFiles(prev => prev.filter((_, j) => j !== i))}>
                            <X className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {evidenceFiles.length === 0 && localDoc.evidenceFileName && (
                    <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                      <FileText className="size-4 text-primary shrink-0" />
                      <span className="text-[10px] font-bold text-foreground truncate flex-1">{localDoc.evidenceFileName}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50" data-tour="purchases-form-summary">
            <CardContent className="p-6 flex flex-col justify-center h-full space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-foreground">Resumen Financiero</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal costo</span>
                   <span className="text-right font-bold tabular-nums">
                     {formatFinancialAmount(financialTotals.subtotal)}
                     {renderEquivalent(financialTotals.subtotal)}
                   </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">IVA</span>
                   <span className="text-right font-bold tabular-nums text-rose-500">
                     {formatFinancialAmount(financialTotals.taxAmount)}
                     {renderEquivalent(financialTotals.taxAmount)}
                   </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Retenciones</span>
                   <span className="text-right font-bold tabular-nums text-amber-500">
                     -{formatFinancialAmount(financialTotals.withholdingTotal)}
                     {renderEquivalent(financialTotals.withholdingTotal, true)}
                   </span>
                </div>
                <div className="border-t pt-3 border-border/50">
                  <p className="text-[10px] text-foreground mb-2 font-bold uppercase tracking-widest">Impuestos por línea</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>IVA calculado por producto según tipo fiscal (Gravado/Exento/No Gravado)</p>
                    <p>Retenciones calculadas por producto según tipo de retención</p>
                  </div>
                </div>
                <div className="flex justify-between items-center text-base border-t pt-3 border-border/50">
                  <span className="font-black uppercase text-xs tracking-widest">Total</span>
                  <span className="font-black text-xl text-primary tabular-nums text-right">
                      {formatFinancialAmount(financialTotals.total)}
                      <span className="mt-1 block text-[10px] font-bold text-muted-foreground">{renderEquivalent(financialTotals.total)}</span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50" data-tour="purchases-form-items">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-foreground">Ítems de Orden</p>
              {((isNew && canPerform('PURCHASES_ORDERS', 'create')) || (!isNew && canPerform('PURCHASES_ORDERS', 'edit'))) && <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setImportIntroOpen(true)} className="h-8 rounded-xl text-[10px] font-black uppercase tracking-widest">
                  <Upload className="mr-2 size-3" /> Importar productos
                </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                  const isServiceOrder = localDoc.purchaseType === 'SERVICE';
                  const newItems = [...(localDoc.items || []), { id: `new-${Date.now()}`, productId: '', code: '', name: '', category: '', categoryId: '', stockApplies: isServiceOrder ? false : false, stock: undefined, currentStock: 0, quantity: 1, unitPrice: 0, taxType: 'GRAVADO', taxRate: 15, taxBase: 0, taxAmount: 0, withholdingType: 'NONE', withholdingRate: 0, withholdingBase: 0, accountId: '', total: 0 }];
                  setLocalDoc({ ...localDoc, items: newItems as any });
                }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                  <Plus className="size-3 mr-2" /> Agregar Item
                </Button>
              </div>}
            </div>
            
            <div className="space-y-3">
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} className="group relative min-w-0 rounded-2xl border-2 border-border/80 bg-card p-4 shadow-sm ring-1 ring-border/20 backdrop-blur-sm transition-all duration-200 hover:border-primary/50 hover:shadow-md">
                  {/* Selector acotado: queda en la cabecera y no consume una fila completa. */}
                  <div className="flex min-w-0 flex-col gap-3 border-b border-border/30 pb-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground">
                        Producto de inventario
                        {item.productId && (
                          <span className="ml-2 inline-flex items-center gap-1 text-primary font-black">
                            <span className="size-1.5 rounded-full bg-primary inline-block" />
                            Vinculado · campos bloqueados
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-foreground/70">
                        {item.productId ? 'Desvincula el producto para editar este ítem manualmente.' : 'Sin vincular · se creará como producto nuevo al recepcionar.'}
                      </p>
                    </div>
                    <div className="flex min-w-0 w-full items-end gap-2 sm:w-auto sm:max-w-[34rem] sm:flex-1">
                      <div className="min-w-0 flex-1 sm:w-[28rem] sm:flex-none">
                        <Combobox
                          disabled={!canEditOrderItems}
                          options={[
                            { label: 'Producto nuevo al recepcionar', value: '__none__', description: 'Se creará desde los datos de esta línea' },
                            ...products.filter(Boolean).map((p: any) => ({
                              label: p.name || 'Producto',
                              value: String(p.id),
                              description: [
                                `${p.code || p.sku || 'SIN-COD'} · ${p.category?.name || p.category || 'Sin categoría'}`,
                                p.commercialNote ? `Nota: ${p.commercialNote}` : null,
                              ].filter(Boolean).join(' · '),
                            }))
                          ]}
                          value={item.productId ? String(item.productId) : '__none__'}
                          onChange={(val) => {
                            if (val === '__none__' || !val) {
                              handleItemChange(idx, 'productId', '');
                            } else {
                              handleSelectExistingProduct(idx, val);
                            }
                          }}
                          placeholder="Buscar producto..."
                          searchPlaceholder="Buscar por nombre, código o SKU..."
                          className="h-9 text-xs"
                        />
                      </div>
                      {canEditOrderItems && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Eliminar ítem"
                          className="size-9 shrink-0 rounded-xl text-muted-foreground/60 transition-colors hover:bg-rose-500/10 hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
                          onClick={() => handleDeleteItem(idx)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Fields grid */}
                  <div className="purchase-item-fields grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-12">
                    <div className="col-span-1 min-w-0 xl:col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground mb-1">Código</p>
                      <Input
                       disabled={!canEditOrderItems}
                        value={item.code || ''}
                        onChange={(e) => handleItemChange(idx, 'code', e.target.value)}
                        className="h-8 text-xs font-mono"
                        placeholder="Código"
                      />
                    </div>
                    <div className="col-span-1 min-w-0 xl:col-span-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground mb-1">Nombre</p>
                      <Input
                        disabled={isItemMasterFieldDisabled(item)}
                        value={item.name || ''}
                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                        className="h-8 text-xs"
                        placeholder={localDoc.purchaseType === 'SERVICE' ? 'Servicio' : 'Producto'}
                      />
                    </div>
                    <div className="col-span-1 min-w-0 xl:col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground mb-1">Categoría</p>
                      <Select
                        disabled={isItemMasterFieldDisabled(item)}
                        value={item.categoryId || '__none__'}
                        onValueChange={(categoryId) => {
                          const normalizedCategoryId = categoryId === '__none__' ? '' : categoryId;
                          const cat = categories.find((c: any) => String(c.id) === String(normalizedCategoryId));
                          handleItemChange(idx, 'categoryId', normalizedCategoryId);
                          handleItemChange(idx, 'category', cat?.name || '');
                        }}
                      >
                        <SelectTrigger className={cn("h-8 w-full text-xs", item.categoryId ? "" : "text-muted-foreground/50")}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin categoría</SelectItem>
                          {categories.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 min-w-0 xl:col-span-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground mb-1">Stock actual</p>
                      <div className="h-8 flex items-center">
                        {item.currentStock !== undefined ? (
                          <span className="text-xs font-black text-primary tabular-nums">{Number(item.currentStock).toLocaleString()}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-1 min-w-0 xl:col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground mb-1">Cant.</p>
                      <Input
                        disabled={!canEditOrderItems}
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={formatInputInteger(item.quantity)}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="h-8 text-xs text-right"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-1 min-w-0 xl:col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground mb-1">Precio</p>
                      <Input
                        disabled={!canEditOrderItems}
                        type="number"
                        min="0"
                        step="0.01"
                        value={formatInputNumber(item.unitPrice)}
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                        className="h-8 text-xs text-right"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="purchase-item-tax grid min-w-0 gap-3 border-t border-border/30 pt-3 lg:grid-cols-[10rem_minmax(0,1fr)] lg:items-start">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground">Impuestos y Retenciones</p>
                      <p className="mt-1 text-[10px] font-medium text-foreground/70">IVA y retención aplicables a esta línea.</p>
                    </div>
                    <TaxDetail
                      item={item}
                      onItemChange={(field, value) => handleItemChange(idx, field, value)}
                      lineTotal={Number(item.quantity || 0) * Number(item.unitPrice || 0)}
                      disabled={!canEditOrderItems}
                      calculatedFieldsReadOnly
                    />
                  </div>

                  {/* Costo de la línea + impuestos + retención + total final */}
                  <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-border/50 pt-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-foreground">Subtotal costo</span>
                    <span className="text-sm font-black tabular-nums">
                      {localDoc.currency === 'USD' ? '$' : 'C$'} {Number(item.quantity * item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-rose-500/70">IVA</span>
                    <span className="text-xs font-black tabular-nums text-rose-500">
                      {localDoc.currency === 'USD' ? '$' : 'C$'} {Number(calcItemTax(item).taxAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-500/70">Retención</span>
                    <span className="text-xs font-black tabular-nums text-amber-500">
                      -{localDoc.currency === 'USD' ? '$' : 'C$'} {Number(calcItemWithholding(item).withholdingTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="border-l border-border/70 pl-4 text-[9px] font-black uppercase tracking-widest text-primary">Total</span>
                    <span className="text-sm font-black tabular-nums text-primary">
                      {localDoc.currency === 'USD' ? '$' : 'C$'} {Number((Number(item.quantity || 0) * Number(item.unitPrice || 0) + calcItemTax(item).taxAmount - calcItemWithholding(item).withholdingTotal) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && (
                <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">
                  No hay ítems registrados.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={importIntroOpen} onOpenChange={setImportIntroOpen}>
          <DialogContent className="max-w-2xl rounded-2xl">
            <DialogHeader data-tour="purchases-order-import-intro-title">
              <DialogTitle className="flex items-center gap-2"><CircleHelp className="size-5 text-primary" /> Importar productos a la orden</DialogTitle>
              <DialogDescription>Carga varios ítems desde Excel sin crear una nueva orden de compra.</DialogDescription>
              <PurchaseViewTutorial view="orders" context="form" labelOverride="Cómo importar productos" stepKeys={['title', 'data', 'actions']} targetPrefix="purchases-order-import-intro" />
            </DialogHeader>
            <div className="space-y-4 text-sm" data-tour="purchases-order-import-intro-data">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="font-black uppercase tracking-widest text-primary">Guía rápida</p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
                  <li>Descarga la plantilla con sus hojas de ítems y guía de llenado.</li>
                  <li>Completa un producto por fila con SKU, cantidad y precio.</li>
                  <li>Revisa la previsualización: los SKU existentes se vinculan automáticamente.</li>
                  <li>Confirma para agregar los ítems a esta orden; todavía deberás guardar la orden.</li>
                </ol>
              </div>
            </div>
            <DialogFooter className="flex-wrap gap-2" data-tour="purchases-order-import-intro-actions">
              <Button variant="outline" onClick={handleDownloadPurchaseTemplate}><Download className="mr-2 size-4" /> Descargar plantilla</Button>
              <Button onClick={() => { const orderCurrency = normalizePurchaseCurrency(localDoc?.currency || displayCurrency); setImportCurrency(orderCurrency); setImportDataCurrency(orderCurrency); setImportIntroOpen(false); setImportModalOpen(true); }}><Upload className="mr-2 size-4" /> Continuar con la carga</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importModalOpen} onOpenChange={(open) => {
          if (importing || importProcessing) return;
          setImportModalOpen(open);
          if (!open) { const orderCurrency = normalizePurchaseCurrency(localDoc?.currency || displayCurrency); setImportData([]); setImportFileName(''); setImportProgress(0); setImportCurrency(orderCurrency); setImportDataCurrency(orderCurrency); }
        }}>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] !max-w-3xl overflow-y-auto">
            <DialogHeader data-tour="purchases-order-import-title">
              <DialogTitle className="flex items-center gap-2"><FileText className="size-5" /> Cargar productos</DialogTitle>
              <DialogDescription>Selecciona un Excel o CSV. Los productos se agregarán a la orden solo después de revisar la previsualización.</DialogDescription>
              <PurchaseViewTutorial view="orders" context="form" labelOverride="Cómo importar productos" stepKeys={['title', 'data', 'actions']} targetPrefix="purchases-order-import" />
            </DialogHeader>
            <div className="space-y-4" data-tour="purchases-order-import-data">
              <div className="grid gap-3 rounded-xl border-2 border-primary/20 bg-primary/5 p-3 text-xs sm:grid-cols-2">
                <div>
                  <p className="font-black uppercase tracking-widest text-primary">Moneda de la orden</p>
                  <p className="mt-1 text-muted-foreground">Es la moneda final que se agregará a los productos.</p>
                  <Badge variant="outline" className="mt-2 border-primary/30 bg-background px-3 py-1 font-black text-primary">
                    {getCurrencyLabel(String(localDoc?.currency || displayCurrency))}
                  </Badge>
                </div>
                <div className="rounded-lg border-2 border-primary/25 bg-background/80 p-2 shadow-sm">
                  <label htmlFor="purchase-import-file-currency" className="font-black uppercase tracking-widest text-primary">Moneda del archivo</label>
                  <select
                    id="purchase-import-file-currency"
                    value={importCurrency}
                    onChange={(event) => handlePurchaseImportCurrencyChange(event.target.value)}
                    disabled={importProcessing}
                    className="mt-2 h-9 w-full rounded-md border-2 border-border bg-background px-2 text-xs font-bold uppercase shadow-sm outline-none focus:border-primary"
                  >
                    <option value="NIO">NIO · Córdobas</option>
                    <option value="USD">USD · Dólares</option>
                  </select>
                  <p className="mt-1 text-[10px] text-muted-foreground">Si es diferente, se convertirá automáticamente usando {Number(globalRate || 36.5).toFixed(2)} NIO/USD.</p>
                </div>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground">
                <p className="font-black uppercase tracking-widest text-foreground">Validación de SKU</p>
                <p className="mt-2">Un SKU encontrado en Inventario se vinculará al producto y mostrará su existencia. Un SKU desconocido se agregará como producto nuevo al recepcionar y se marcará como advertencia.</p>
                <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={handleDownloadPurchaseTemplate}><Download className="size-4" /> Descargar plantilla y guía</Button>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Archivo Excel de productos</label>
                <Input type="file" accept=".xlsx,.xls,.csv" disabled={importProcessing} onChange={(event) => { const file = event.target.files?.[0]; if (file) handlePurchaseImportFile(file); }} />
                {importFileName && <p className="break-words text-xs text-muted-foreground">Archivo cargado: <b>{importFileName}</b> · {importData.length} producto(s) detectados</p>}
              </div>
            </div>
            <DialogFooter className="flex-wrap" data-tour="purchases-order-import-actions">
              <Button variant="outline" onClick={() => setImportModalOpen(false)} disabled={importProcessing}>Cerrar</Button>
              {importFileName && <Button onClick={handleOpenPurchaseImportPreview} disabled={importProcessing || importData.length === 0 || previewLoading}><Check className="mr-2 size-4" /> Previsualizar productos</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importConfirmOpen && !importing} onOpenChange={setImportConfirmOpen}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Agregar productos a la orden</DialogTitle>
              <DialogDescription>Los productos válidos se agregarán a la orden actual. Después pulsa Guardar para persistir la orden. Escribe IMPORTAR para confirmar.</DialogDescription>
            </DialogHeader>
            <Input value={importConfirmText} onChange={(event) => setImportConfirmText(event.target.value.toUpperCase())} placeholder="IMPORTAR" autoFocus />
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportConfirmOpen(false)} disabled={importing}>Cancelar</Button>
              <Button onClick={handleFinalPurchaseImport} disabled={importConfirmText !== 'IMPORTAR' || importing}>Agregar productos</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importResults !== null} onOpenChange={(open) => { if (!open) setImportResults(null); }}>
          <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle>Productos agregados</DialogTitle>
              <DialogDescription>Los ítems ya están dentro de esta orden de compra, pero todavía debes guardarla.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-emerald-500">{importResults?.success || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Ítems agregados</p></div>
              <div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-amber-500">{importResults?.skipped || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Filas omitidas</p></div>
            </div>
            <DialogFooter><Button className="w-full" onClick={() => setImportResults(null)}>Volver a la orden</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={Boolean(pendingCancelId || pendingBulkCancelIds.length > 0)}
          onOpenChange={(open) => { if (!open) { setPendingCancelId(null); setPendingBulkCancelIds([]); setCancelReason(''); } }}
          title={pendingBulkCancelIds.length > 0 ? 'Rechazar órdenes de compra' : 'Rechazar orden de compra'}
          description={pendingBulkCancelIds.length > 0 ? `${pendingBulkCancelIds.length} órdenes quedarán rechazadas. No se podrán recibir ni facturar.` : 'La orden quedará rechazada y no se podrá recibir ni facturar.'}
          confirmLabel={pendingBulkCancelIds.length > 0 ? 'Rechazar órdenes' : 'Rechazar orden'}
          variant="destructive"
          loading={cancelLoading}
          disabled={!cancelReason.trim()}
          onConfirm={handleCancelConfirm}
        >
          <div className="mt-4">
            <label className="text-sm font-medium text-foreground mb-1 block">Motivo de rechazo *</label>
            <textarea
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              rows={3}
              placeholder="Ej: proveedor no autorizado, error en productos..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
        </ConfirmDialog>

        <ConfirmDialog
          open={Boolean(pendingApproveOrder)}
          onOpenChange={(open) => { if (!open && !approving) setPendingApproveOrder(null); }}
          title="¿Aprobar orden de compra?"
          description="Al aprobarla, la orden pasará a estado Aprobada y se generará una recepción pendiente vinculada para registrar las cantidades entregadas."
          confirmLabel="Sí, aprobar orden"
          variant="default"
          loading={approving}
          closeOnConfirm={false}
          onConfirm={() => pendingApproveOrder?.id ? handleApproveOrder(pendingApproveOrder.id) : Promise.resolve()}
        >
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-left text-xs text-muted-foreground">
            <p className="font-black uppercase tracking-wider text-primary">{pendingApproveOrder?.number || 'Orden de compra'}</p>
            <p className="mt-1">Después podrás abrir la recepción pendiente, indicar lo recibido y procesar el inventario.</p>
          </div>
        </ConfirmDialog>

        {renderOrderDetailPanel()}
      </div>
    );
  }

  const countOrdersByStatus = (status: 'DRAFT' | 'IN_PROCESS' | 'APPROVED' | 'REJECTED') => data.filter((order) => normalizePurchaseOrderStatus(order.status) === status).length;
  const kpis = [
    { title: 'Total órdenes', value: data.length, icon: ClipboardList, color: 'text-primary', bg: 'bg-primary/10', filter: 'ALL' },
    { title: 'Borradores', value: countOrdersByStatus('DRAFT'), icon: FileText, color: 'text-amber-500', bg: 'bg-amber-500/10', filter: 'DRAFT' },
    { title: 'En proceso', value: countOrdersByStatus('IN_PROCESS'), icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10', filter: 'IN_PROCESS' },
    { title: 'Aprobadas', value: countOrdersByStatus('APPROVED'), icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', filter: 'APPROVED' },
    { title: 'Rechazadas', value: countOrdersByStatus('REJECTED'), icon: Ban, color: 'text-rose-500', bg: 'bg-rose-500/10', filter: 'REJECTED' },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5" data-tour="purchases-list-kpis">
        {kpis.map((k, i) => (
          <PurchaseKpiCard key={i} title={k.title} value={k.value} icon={k.icon} color={k.color} bg={k.bg} kind="filter" active={statusFilter === k.filter} onClick={() => { const next = statusFilter === k.filter ? 'ALL' : k.filter; setStatusFilter(next); onStatusChange?.(next); }} />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Órdenes de Compra</h2></div>
          <div className="erp-list-toolbar flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto" data-tour="purchases-list-actions">
            <PdfDownloadButton label="Exportar" includeRoll={false} onDownload={(format) => void handleExportListPdf(format)} />
            <PurchaseViewTutorial view="orders" />
            <ViewLayoutSelect value={layoutMode} onChange={(value) => setLayoutMode(value === 'kanban' ? 'table' : value)} ariaLabel="Elegir distribución de órdenes de compra" />
            <div className="relative flex-1 min-w-0"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-full sm:w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
            {purchaseAlert && <PurchaseAlertsButton alert={purchaseAlert} onItemSelect={setHighlightedAlertId} />}
            {canPerform('PURCHASES_ORDERS', 'create') && (
              <Button onClick={() => setEditingId('NEW')} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nueva Orden</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filteredData} columns={columns} onRowUpdate={handleUpdate} onRowClick={(row) => setPreviewOrder(row)} isLoading={loading} pagination={pagination} layoutMode={layoutMode === 'cards' ? 'cards' : 'responsive'} highlightedRowId={highlightedAlertId} bulkAction="cancel" showHorizontalControls actionsWidth="w-56" fitContent
          onBulkDelete={canPerform('PURCHASES_ORDERS', 'delete') ? async (ids) => {
            const validIds = ids.map(String).filter((id) => {
              if (id.startsWith('new-')) return false;
              return PURCHASE_ORDER_ACTIONABLE_STATUSES.includes(normalizePurchaseOrderStatus(data.find((order) => order.id === id)?.status));
            });
            if (validIds.length === 0) return;
            setPendingCancelId(null);
            setPendingBulkCancelIds(validIds);
            setCancelReason('');
          } : undefined}
          actions={(row) => (
            <div className="flex min-w-max items-center justify-end gap-1" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
              <Button title="Ver detalle" aria-label="Ver detalle de la orden" variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setPreviewOrder(row)}>
                <Eye className="size-4" />
              </Button>
              {canPerform('PURCHASES_ORDERS', 'approve') && PURCHASE_ORDER_ACTIONABLE_STATUSES.includes(normalizePurchaseOrderStatus(row.status)) && <Button type="button" title="Aprobar orden de compra" aria-label="Aprobar orden de compra" variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700" onClick={() => { setPreviewOrder(null); setPendingApproveOrder(row); }}><CheckCircle2 className="size-4" /></Button>}
              {canPerform('PURCHASES_ORDERS', 'edit') && PURCHASE_ORDER_ACTIONABLE_STATUSES.includes(normalizePurchaseOrderStatus(row.status)) && <Button title="Editar orden de compra" aria-label="Editar orden de compra" variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setEditingId(String(row.id))}><Pencil className="size-4" /></Button>}
              {canPerform('PURCHASES_ORDERS', 'delete') && PURCHASE_ORDER_ACTIONABLE_STATUSES.includes(normalizePurchaseOrderStatus(row.status)) && <Button type="button" title="Rechazar orden de compra" aria-label="Rechazar orden de compra" variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-rose-500 hover:bg-rose-500/10 hover:text-rose-600" onClick={() => { setPreviewOrder(null); setPendingCancelId(String(row.id)); setCancelReason(''); }}><Ban className="size-4" /></Button>}
            </div>
          )}
        />

        {renderOrderDetailPanel()}

        <ConfirmDialog
          open={Boolean(pendingCancelId || pendingBulkCancelIds.length > 0)}
          onOpenChange={(open) => { if (!open) { setPendingCancelId(null); setPendingBulkCancelIds([]); setCancelReason(''); } }}
          title={pendingBulkCancelIds.length > 0 ? 'Rechazar órdenes de compra' : 'Rechazar orden de compra'}
          description={pendingBulkCancelIds.length > 0 ? `${pendingBulkCancelIds.length} órdenes quedarán rechazadas. No se podrán recibir ni facturar.` : 'La orden quedará rechazada y no se podrá recibir ni facturar.'}
          confirmLabel={pendingBulkCancelIds.length > 0 ? 'Rechazar órdenes' : 'Rechazar orden'}
          variant="destructive"
          loading={cancelLoading}
          disabled={!cancelReason.trim()}
          onConfirm={handleCancelConfirm}
        >
          <div className="mt-4">
            <label className="text-sm font-medium text-foreground mb-1 block">Motivo de rechazo *</label>
            <textarea
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              rows={3}
              placeholder="Ej: proveedor no autorizado, error en productos..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
        </ConfirmDialog>

        <ConfirmDialog
          open={Boolean(pendingApproveOrder)}
          onOpenChange={(open) => { if (!open && !approving) setPendingApproveOrder(null); }}
          title="¿Aprobar orden de compra?"
          description="Al aprobarla, la orden pasará a estado Aprobada y se generará una recepción pendiente vinculada para registrar las cantidades entregadas."
          confirmLabel="Sí, aprobar orden"
          variant="default"
          loading={approving}
          closeOnConfirm={false}
          onConfirm={() => pendingApproveOrder?.id ? handleApproveOrder(pendingApproveOrder.id) : Promise.resolve()}
        >
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-left text-xs text-muted-foreground">
            <p className="font-black uppercase tracking-wider text-primary">{pendingApproveOrder?.number || 'Orden de compra'}</p>
            <p className="mt-1">Después podrás abrir la recepción pendiente, indicar lo recibido y procesar el inventario.</p>
          </div>
        </ConfirmDialog>

        <PurchaseVariantPickerModal
          open={variantPickerOpen}
          onOpenChange={setVariantPickerOpen}
          product={variantPickerProduct}
          onSelect={handlePurchaseVariantSelected}
        />

        <Dialog open={false} onOpenChange={setImportIntroOpen}>
          <DialogContent className="max-w-2xl rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CircleHelp className="size-5 text-primary" /> Importar órdenes de compra</DialogTitle>
              <DialogDescription>Prepara varias órdenes desde Excel y revísalas antes de guardarlas.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="font-black uppercase tracking-widest text-primary">Guía rápida</p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
                  <li>Descarga la plantilla con sus dos hojas: órdenes y guía de llenado.</li>
                  <li>Usa una fila por artículo; repite el número de orden para agrupar varios artículos.</li>
                  <li>Carga el archivo y corrige los errores en la previsualización.</li>
                  <li>Los SKU encontrados se vinculan al inventario; los no encontrados se muestran como advertencia y se crearán como productos nuevos al recepcionar.</li>
                </ol>
              </div>
              <p className="text-xs text-muted-foreground">La importación crea órdenes en estado Borrador. Las filas con errores no se crearán.</p>
            </div>
            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={handleDownloadPurchaseTemplate}><Download className="mr-2 size-4" /> Descargar plantilla</Button>
              <Button onClick={() => { const orderCurrency = normalizePurchaseCurrency(localDoc?.currency || displayCurrency); setImportCurrency(orderCurrency); setImportDataCurrency(orderCurrency); setImportIntroOpen(false); setImportModalOpen(true); }}><Upload className="mr-2 size-4" /> Continuar con la carga</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={false} onOpenChange={(open) => {
          if (importing || importProcessing) return;
          setImportModalOpen(open);
          if (!open) { const orderCurrency = normalizePurchaseCurrency(localDoc?.currency || displayCurrency); setImportData([]); setImportFileName(''); setImportProgress(0); setImportCurrency(orderCurrency); setImportDataCurrency(orderCurrency); }
        }}>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] !max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><FileText className="size-5" /> Cargar órdenes de compra</DialogTitle>
              <DialogDescription>Selecciona un archivo Excel o CSV. Todavía no se crearán órdenes hasta confirmar la previsualización.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground">
                <p className="font-black uppercase tracking-widest text-foreground">Antes de cargar</p>
                <p className="mt-2">El proveedor debe existir. El SKU se buscará en Inventario y se informará si ya está en uso, si está duplicado en la plantilla o si no fue encontrado.</p>
                <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={handleDownloadPurchaseTemplate}><Download className="size-4" /> Descargar plantilla y guía</Button>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Archivo Excel de órdenes</label>
                <Input type="file" accept=".xlsx,.xls,.csv" disabled={importProcessing} onChange={(event) => { const file = event.target.files?.[0]; if (file) handlePurchaseImportFile(file); }} />
                {importFileName && <p className="break-words text-xs text-muted-foreground">Archivo cargado: <b>{importFileName}</b> · {importData.length} artículo(s) detectados</p>}
              </div>
            </div>
            <DialogFooter className="flex-wrap">
              <Button variant="outline" onClick={() => setImportModalOpen(false)} disabled={importProcessing}>Cerrar</Button>
              {importFileName && <Button onClick={handleOpenPurchaseImportPreview} disabled={importProcessing || importData.length === 0 || previewLoading}><Check className="mr-2 size-4" /> Previsualizar importación</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={false} onOpenChange={setImportConfirmOpen}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Formalizar importación</DialogTitle>
              <DialogDescription>Se crearán las órdenes válidas en estado Borrador. Las filas con errores se omitirán. Escribe IMPORTAR para confirmar.</DialogDescription>
            </DialogHeader>
            <Input value={importConfirmText} onChange={(event) => setImportConfirmText(event.target.value.toUpperCase())} placeholder="IMPORTAR" autoFocus />
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportConfirmOpen(false)} disabled={importing}>Cancelar</Button>
              <Button onClick={handleFinalPurchaseImport} disabled={importConfirmText !== 'IMPORTAR' || importing}>Confirmar importación</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={false} onOpenChange={(open) => { if (!open) setImportResults(null); }}>
          <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle>Importación completada</DialogTitle>
              <DialogDescription>Resumen de la carga de órdenes de compra.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
              <div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-emerald-500">{importResults?.success || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Órdenes creadas</p></div>
              <div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-amber-500">{importResults?.skipped || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Filas omitidas</p></div>
              <div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-rose-500">{importResults?.failed || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Órdenes con error</p></div>
            </div>
            {!!importResults?.errors.length && <div className="max-h-40 overflow-y-auto rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-500">{importResults.errors.map((error, index) => <p key={`${error}-${index}`}>{error}</p>)}</div>}
            <DialogFooter><Button className="w-full" onClick={() => setImportResults(null)}>Continuar a órdenes de compra</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <ImportProgressOverlay
          open={previewLoading}
          progress={previewProgress}
          title="Preparando previsualización"
          description="Leyendo el archivo, validando los productos y resolviendo sus vínculos con inventario."
        />
      </div>
    </div>
  );
}
