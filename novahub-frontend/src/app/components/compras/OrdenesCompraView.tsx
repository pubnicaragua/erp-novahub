import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ClipboardList, Plus, Search, Eye, Trash2, CheckCircle2, Clock, TrendingDown, ChevronLeft, FileInput, Download, FileText, X, Upload, AlertTriangle, Check, CircleHelp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Combobox } from '../ui/Combobox';
import { TaxDetail } from '../ui/TaxSelector';
import { isTaxExempt } from '../../utils/taxUtils';
import { purchaseOrdersService, purchaseRequestsService } from '../../services/compras.service';
import { storageService } from '../../services/storage.service';
import type { PurchaseOrder, Supplier } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { HorizontalTableScroller } from '../ui/HorizontalTableScroller';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { generatePurchaseOrderPDF } from '../../utils/pdfGenerator';
import { exportToCsv } from '../../utils/exportUtils';
import { PurchaseAuditButton } from './PurchaseAuditButton';
import { PurchaseOrderPreviewDialog } from './ui/PurchaseOrderPreviewDialog';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';

interface Props {
  data: PurchaseOrder[];
  loading: boolean;
  onRefresh: () => void;
  supplierCatalog?: Supplier[];
  productCatalog?: any[];
  productCategories?: any[];
  isSidebarCollapsed?: boolean;
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  onStatusChange?: (value: string) => void;
  initialStatus?: string;
  prefillDoc?: Partial<PurchaseOrder> | null;
  onPrefillHandled?: () => void;
}

const MAX_EVIDENCE_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024;

type PurchaseImportRow = {
  sku: string;
  productId?: string;
  description: string;
  category: string;
  categoryId?: string;
  quantity: string | number;
  unitPrice: string | number;
  taxType: string;
  taxRate: string | number;
  withholdingType: string;
  withholdingRate: string | number;
  accountId: string;
  currentStock?: number;
  _hasError?: boolean;
  _errorMessage?: string;
  _hasWarning?: boolean;
  _warningMessage?: string;
  _skuStatus?: 'found' | 'missing' | 'duplicate';
  _skuMessage?: string;
};

interface PurchaseImportPreviewProps {
  rows: PurchaseImportRow[];
  fileName: string;
  isSidebarCollapsed?: boolean;
  importing: boolean;
  progress: number;
  onRowUpdate: (index: number, field: keyof PurchaseImportRow, value: any) => void;
  onDownloadErrors: () => void;
  onConfirm: () => void;
  onBack: () => void;
}

function PurchaseImportPreview({ rows, fileName, isSidebarCollapsed = true, importing, progress, onRowUpdate, onDownloadErrors, onConfirm, onBack }: PurchaseImportPreviewProps) {
  const validRows = rows.filter((row) => !row._hasError).length;
  const issueRows = rows.filter((row) => row._hasError || row._hasWarning).length;

  return (
    <div className={`fixed inset-y-0 right-0 left-0 z-40 flex h-dvh min-h-0 flex-col overflow-hidden bg-background p-4 sm:p-6 ${isSidebarCollapsed ? 'lg:left-[72px]' : 'lg:left-[270px]'}`}>
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        <div className="flex flex-col gap-3 border-b border-border/50 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Importación de ítems</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Previsualizar productos</h2>
            <p className="mt-1 text-sm text-muted-foreground">Revisa y corrige los productos antes de agregarlos a esta orden de compra.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{rows.length} artículos</Badge>
            <Badge variant="outline" className="border-primary/40 text-primary">Se agregarán a la orden actual</Badge>
            <Badge variant="outline" className="text-emerald-600">{validRows} válidos</Badge>
            {issueRows > 0 && <Badge variant="outline" className="text-amber-500">{issueRows} con incidencias</Badge>}
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

        <HorizontalTableScroller className="min-h-0 flex-1" label="Desplazamiento horizontal · columna por columna">
          <Table containerClassName="w-max min-w-full max-w-none overflow-visible" className="min-w-[1500px]">
            <TableHeader className="sticky top-0 z-10 bg-muted shadow-sm">
              <TableRow>
                <TableHead className="w-8 text-[10px] uppercase"></TableHead>
                <TableHead className="w-36 text-[10px] uppercase">SKU</TableHead>
                <TableHead className="min-w-[240px] text-[10px] uppercase">Descripción</TableHead>
                <TableHead className="w-40 text-[10px] uppercase">Categoría</TableHead>
                <TableHead className="w-24 text-right text-[10px] uppercase">Stock actual</TableHead>
                <TableHead className="w-28 text-right text-[10px] uppercase">Cantidad</TableHead>
                <TableHead className="w-32 text-right text-[10px] uppercase">Precio unitario</TableHead>
                <TableHead className="w-28 text-[10px] uppercase">Tipo IVA</TableHead>
                <TableHead className="w-24 text-right text-[10px] uppercase">IVA %</TableHead>
                <TableHead className="w-32 text-[10px] uppercase">Retención</TableHead>
                <TableHead className="w-24 text-right text-[10px] uppercase">Ret. %</TableHead>
                <TableHead className="min-w-[270px] text-[10px] uppercase">Validación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={`${row.sku || 'sin-sku'}-${index}`} className={row._hasError ? 'bg-red-500/10' : row._hasWarning ? 'bg-amber-500/5' : ''}>
                  <TableCell>{row._hasError ? <AlertTriangle className="size-4 text-red-500" /> : row._hasWarning ? <AlertTriangle className="size-4 text-amber-500" /> : <Check className="size-4 text-emerald-500" />}</TableCell>
                  <TableCell className="p-1"><Input value={row.sku} onChange={(event) => onRowUpdate(index, 'sku', event.target.value)} className={`h-8 text-xs font-mono ${row._skuStatus === 'duplicate' ? 'border-red-500' : row._skuStatus === 'missing' ? 'border-amber-500' : ''}`} /></TableCell>
                  <TableCell className="min-w-[240px] p-1"><Input value={row.description} onChange={(event) => onRowUpdate(index, 'description', event.target.value)} className={`h-8 w-full text-xs ${!row.description ? 'border-red-500' : ''}`} /></TableCell>
                  <TableCell className="p-1"><Input value={row.category} onChange={(event) => onRowUpdate(index, 'category', event.target.value)} className={`h-8 text-xs ${!row.category ? 'border-red-500' : ''}`} /></TableCell>
                  <TableCell className="p-1 text-right text-xs font-black text-primary">{row.currentStock ?? '—'}</TableCell>
                  <TableCell className="p-1"><Input type="number" min={0} value={row.quantity} onChange={(event) => onRowUpdate(index, 'quantity', event.target.value)} className="h-8 text-right text-xs" /></TableCell>
                  <TableCell className="p-1"><Input type="number" min={0} step="any" value={row.unitPrice} onChange={(event) => onRowUpdate(index, 'unitPrice', event.target.value)} className="h-8 text-right text-xs" /></TableCell>
                  <TableCell className="p-1"><select value={row.taxType} onChange={(event) => onRowUpdate(index, 'taxType', event.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="GRAVADO">Gravado</option><option value="EXENTO">Exento</option><option value="NO_GRAVADO">No gravado</option></select></TableCell>
                  <TableCell className="p-1"><Input type="number" min={0} step="any" value={row.taxRate} onChange={(event) => onRowUpdate(index, 'taxRate', event.target.value)} className="h-8 text-right text-xs" disabled={row.taxType !== 'GRAVADO'} /></TableCell>
                  <TableCell className="p-1"><Input value={row.withholdingType} onChange={(event) => onRowUpdate(index, 'withholdingType', event.target.value)} className="h-8 text-xs" /></TableCell>
                  <TableCell className="p-1"><Input type="number" min={0} step="any" value={row.withholdingRate} onChange={(event) => onRowUpdate(index, 'withholdingRate', event.target.value)} className="h-8 text-right text-xs" disabled={String(row.withholdingType).toUpperCase() === 'NONE'} /></TableCell>
                  <TableCell className="p-1 text-xs"><span className={row._hasError ? 'text-red-500' : row._hasWarning ? 'text-amber-500' : 'text-emerald-500'}>{row._errorMessage || row._warningMessage || row._skuMessage || 'Correcto'}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </HorizontalTableScroller>

        {importing && <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} /></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4">
          <Button variant="outline" onClick={onBack} disabled={importing}><ChevronLeft className="mr-2 size-4" />Volver a la carga</Button>
          <Button onClick={onConfirm} disabled={importing || validRows === 0} className="bg-primary font-bold text-primary-foreground">{importing ? `Agregando... ${progress}%` : `Agregar ${validRows} productos`}</Button>
        </div>
      </div>
    </div>
  );
}

const normalizeImportHeader = (value: unknown) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_/-]+/g, '');

const normalizeImportDate = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === '') return '';
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const raw = String(value).trim();
  const slashDate = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashDate) return `${slashDate[3]}-${slashDate[2].padStart(2, '0')}-${slashDate[1].padStart(2, '0')}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
};

const statusOpts = [
  { label: 'Borrador',   value: 'DRAFT',      color: 'bg-muted/20 text-muted-foreground' },
  { label: 'Pendiente',  value: 'PENDING',    color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Aprobada',   value: 'APPROVED',   color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Recibida',   value: 'RECEIVED',   color: 'bg-purple-500/10 text-purple-500' },
  { label: 'Cancelada',  value: 'CANCELLED',  color: 'bg-rose-500/10 text-rose-500' },
];

function calcItemTax(item: any): { taxBase: number; taxRate: number; taxAmount: number } {
  const tt = (item.taxType || 'GRAVADO').toUpperCase();
  if (isTaxExempt(tt)) return { taxBase: 0, taxRate: 0, taxAmount: 0 };
  const lineTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
  const taxRate = Number(item.taxRate) || 15;
  const taxBase = Number(item.taxBase) || lineTotal;
  return { taxRate, taxBase, taxAmount: (taxBase * taxRate) / 100 };
}

export function OrdenesCompraView({ data, loading, onRefresh, supplierCatalog = [], productCatalog = [], productCategories = [], isSidebarCollapsed = true, pagination, onSearchChange, onStatusChange, initialStatus, prefillDoc, onPrefillHandled }: Props) {
  const { canPerform, user } = useAuth();
  const { exchangeRate: globalRate, displayCurrency, valuationMode, valuationModeSuffix, formatConvertedAmount, formatCurrentAmount, convertAmount, convertCurrentAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<Partial<PurchaseOrder> | null>(null);
  const [approveConfirmId, setApproveConfirmId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const prefillRef = useRef<Partial<PurchaseOrder> | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<PurchaseOrder> | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [importIntroOpen, setImportIntroOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importData, setImportData] = useState<PurchaseImportRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importProcessing, setImportProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [importConfirmText, setImportConfirmText] = useState('');
  const [importResults, setImportResults] = useState<{ success: number; skipped: number; failed: number; errors: string[] } | null>(null);

  useEffect(() => {
    setSuppliers(supplierCatalog);
    setProducts(productCatalog);
    setCategories(productCategories);
  }, [supplierCatalog, productCatalog, productCategories]);

  useEffect(() => {
    if (initialStatus) setStatusFilter(initialStatus);
  }, [initialStatus]);

  const findImportProduct = (sku: unknown) => {
    const normalized = String(sku || '').trim().toLowerCase();
    if (!normalized) return undefined;
    return products.find((product: any) => String(product.code || product.sku || '').trim().toLowerCase() === normalized);
  };

  const validateImportRows = useCallback((rows: PurchaseImportRow[]) => {
    const skuCounts = new Map<string, number>();
    const existingOrderSkus = new Set(((localDoc?.items || []) as any[]).map((item) => String(item.code || item.sku || '').trim().toLowerCase()).filter(Boolean));
    rows.forEach((row) => {
      const sku = String(row.sku || '').trim().toLowerCase();
      if (sku) skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
    });

    return rows.map((sourceRow) => {
      const row = { ...sourceRow };
      const sku = String(row.sku || '').trim();
      const product = findImportProduct(sku);
      const quantity = Number(row.quantity);
      const unitPrice = Number(row.unitPrice);
      const taxRate = Number(row.taxRate || 0);
      const withholdingRate = Number(row.withholdingRate || 0);
      const errors = [
        !sku ? 'SKU requerido' : existingOrderSkus.has(sku.toLowerCase()) ? 'SKU ya está en esta orden' : skuCounts.get(sku.toLowerCase())! > 1 ? 'SKU duplicado en el archivo' : '',
        !String(row.description || '').trim() && !product ? 'Descripción requerida para SKU no encontrado' : '',
        !String(row.category || product?.category?.name || product?.category || '').trim() ? 'Categoría requerida' : '',
        !Number.isFinite(quantity) || quantity <= 0 ? 'Cantidad debe ser mayor que cero' : '',
        !Number.isFinite(unitPrice) || unitPrice < 0 ? 'Precio unitario inválido' : '',
        !['GRAVADO', 'EXENTO', 'NO_GRAVADO'].includes(String(row.taxType || '').toUpperCase()) ? 'Tipo de IVA inválido' : '',
        !Number.isFinite(taxRate) || taxRate < 0 ? 'Tasa de IVA inválida' : '',
        !Number.isFinite(withholdingRate) || withholdingRate < 0 ? 'Tasa de retención inválida' : '',
      ].filter(Boolean);
      const warningParts = [
        sku && product ? `SKU en uso: ${product.name || product.code || sku}` : sku && !product ? 'SKU no encontrado en inventario; se importará como artículo manual' : '',
      ].filter(Boolean);

      return {
        ...row,
        sku,
        productId: product?.id,
        currentStock: product?.stock != null ? Number(product.stock) : product?.inventoryLevels?.reduce((sum: number, level: any) => sum + Number(level.quantity || 0), 0),
        description: String(row.description || product?.name || '').trim(),
        category: String(row.category || product?.category?.name || product?.category || '').trim(),
        categoryId: product?.categoryId || (product?.category?.id ? product.category.id : ''),
        taxType: String(row.taxType || 'GRAVADO').toUpperCase(),
        withholdingType: String(row.withholdingType || 'NONE').toUpperCase(),
        _hasError: errors.length > 0,
        _errorMessage: errors[0],
        _hasWarning: warningParts.length > 0,
        _warningMessage: warningParts.join(' · '),
        _skuStatus: skuCounts.get(sku.toLowerCase())! > 1 ? 'duplicate' : product ? 'found' : sku ? 'missing' : undefined,
        _skuMessage: product ? `SKU en uso: ${product.name || product.code || sku}` : sku ? 'SKU no encontrado en inventario' : '',
      };
    });
  }, [localDoc?.items, products]);

  const handleDownloadPurchaseTemplate = useCallback(() => {
    const headers = ['SKU', 'Descripción', 'Categoría', 'Cantidad', 'Precio unitario', 'Tipo IVA', 'Tasa IVA', 'Retención', 'Tasa retención', 'Cuenta contable'];
    const exampleProduct = products[0];
    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      [exampleProduct?.code || 'SKU-001', exampleProduct?.name || 'Producto de ejemplo', exampleProduct?.category?.name || exampleProduct?.category || 'Categoría', 1, Number(exampleProduct?.costPrice || exampleProduct?.cost || 0), 'GRAVADO', 15, 'NONE', 0, ''],
    ]);
    ws['!cols'] = headers.map((header) => ({ wch: Math.max(13, Math.min(30, header.length + 3)) }));
    const guide = XLSX.utils.aoa_to_sheet([
      ['GUÍA DE LLENADO · IMPORTACIÓN DE ÍTEMS EN ORDEN DE COMPRA'],
      ['Cada fila representa un artículo que se agregará a la orden de compra actualmente abierta. Esta carga no crea órdenes nuevas.'],
      ['Campo', 'Regla'],
      ['SKU', 'Obligatorio. Si existe en el inventario, se vinculará automáticamente; si se repite en el archivo se marcará como error.'],
      ['Descripción / Categoría', 'Si el SKU existe, se completan desde inventario cuando estén vacíos. Para un SKU no encontrado, ambos campos son obligatorios y se importará como artículo manual.'],
      ['Cantidad / Precio unitario', 'La cantidad debe ser mayor que cero y el precio no puede ser negativo.'],
      ['Tipo IVA / Tasa IVA', 'Usa GRAVADO, EXENTO o NO_GRAVADO. La tasa solo aplica a GRAVADO.'],
      ['Retención / Tasa retención', 'Usa NONE si no aplica; de lo contrario indica el código de retención y su porcentaje.'],
      ['Cuenta contable', 'Opcional. Puedes completarla con el identificador de la cuenta si la orden requiere esa asociación.'],
      ['Previsualización', 'La carga no modifica la orden inmediatamente. Corrige los errores y confirma para agregar los ítems.'],
    ]);
    guide['!cols'] = [{ wch: 34 }, { wch: 115 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, 'Órdenes de compra');
    XLSX.utils.book_append_sheet(workbook, guide, 'Guía de llenado');
    XLSX.writeFile(workbook, 'plantilla_importacion_ordenes_compra.xlsx');
    toast.success('Plantilla de órdenes descargada');
  }, [products]);

  const handlePurchaseImportFile = useCallback((file: File) => {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast.error('Selecciona un archivo Excel o CSV válido');
      return;
    }
    setImportProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      window.setTimeout(() => {
        try {
          const workbook = XLSX.read(new Uint8Array(event.target?.result as ArrayBuffer), { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          if (raw.length < 2) throw new Error('El archivo está vacío o no tiene datos');
          const headers = raw[0].map(normalizeImportHeader);
          const fieldAliases: Record<string, string[]> = {
            sku: ['sku', 'codigo / sku', 'codigo', 'código', 'code'],
            description: ['descripcion', 'descripción', 'description', 'nombre', 'producto'],
            category: ['categoria', 'categoría', 'category'],
            quantity: ['cantidad', 'quantity', 'qty'],
            unitPrice: ['precio unitario', 'precio', 'unit price', 'cost price'],
            taxType: ['tipo iva', 'iva', 'tax type'],
            taxRate: ['tasa iva', 'tasa de iva', 'tax rate'],
            withholdingType: ['retencion', 'retención', 'tipo retencion', 'withholding'],
            withholdingRate: ['tasa retencion', 'tasa de retencion', 'withholding rate'],
            accountId: ['cuenta contable', 'cuenta', 'account id'],
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
              category: text(row, 'category'),
              quantity: number(row, 'quantity', 0),
              unitPrice: number(row, 'unitPrice', 0),
              taxType: text(row, 'taxType', 'GRAVADO').toUpperCase(),
              taxRate: number(row, 'taxRate', 15),
              withholdingType: text(row, 'withholdingType', 'NONE').toUpperCase(),
              withholdingRate: number(row, 'withholdingRate', 0),
              accountId: text(row, 'accountId'),
              currentStock: undefined,
            } as PurchaseImportRow));
          if (!parsed.length) throw new Error('No se encontraron filas con datos');
          setImportData(validateImportRows(parsed));
          setImportFileName(file.name);
          setImportProgress(0);
          toast.success(`${parsed.length} artículo(s) encontrados`);
        } catch (error: any) {
          toast.error(error?.message || 'No se pudo leer el archivo. Verifica que sea un Excel o CSV válido.');
        } finally {
          setImportProcessing(false);
        }
      }, 50);
    };
    reader.onerror = () => {
      setImportProcessing(false);
      toast.error('No se pudo leer el archivo seleccionado');
    };
    reader.readAsArrayBuffer(file);
  }, [validateImportRows]);

  const handlePurchaseImportRowUpdate = (index: number, field: keyof PurchaseImportRow, value: any) => {
    setImportData((current) => validateImportRows(current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row)));
  };

  const handleDownloadPurchaseImportErrors = useCallback(() => {
    const errors = importData.filter((row) => row._hasError || row._hasWarning).map((row) => ({
      SKU: row.sku,
      Descripción: row.description,
      Categoría: row.category,
      Cantidad: row.quantity,
      'Precio unitario': row.unitPrice,
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
    const importedItems = validRows.map((row) => ({
      id: `import-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      productId: row.productId || '',
      code: row.sku,
      name: row.description || row.sku,
      description: row.description || row.sku,
      category: row.category,
      categoryId: row.categoryId
        || categories.find((c: any) => String(c.name || '').trim().toLowerCase() === String(row.category || '').trim().toLowerCase())?.id
        || '',
      stockApplies: String(localDoc.purchaseType || 'INVENTORY').toUpperCase() !== 'SERVICE',
      currentStock: row.currentStock,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unitPrice),
      taxType: String(row.taxType || 'GRAVADO').toUpperCase(),
      taxRate: String(row.taxType || '').toUpperCase() === 'GRAVADO' ? Number(row.taxRate || 0) : 0,
      taxBase: String(row.taxType || '').toUpperCase() === 'GRAVADO' ? Number(row.quantity) * Number(row.unitPrice) : 0,
      taxAmount: String(row.taxType || '').toUpperCase() === 'GRAVADO' ? (Number(row.quantity) * Number(row.unitPrice) * Number(row.taxRate || 0)) / 100 : 0,
      withholdingType: String(row.withholdingType || 'NONE').toUpperCase(),
      withholdingRate: String(row.withholdingType || 'NONE').toUpperCase() === 'NONE' ? 0 : Number(row.withholdingRate || 0),
      withholdingBase: String(row.withholdingType || 'NONE').toUpperCase() === 'NONE' ? 0 : Number(row.quantity) * Number(row.unitPrice),
      accountId: row.accountId || '',
      total: Number(row.quantity) * Number(row.unitPrice),
    }));
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
            exchangeRate: globalRate,
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
            exchangeRate: globalRate,
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
         setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
      }
      setEvidenceFiles([]);
    } else {
      setLocalDoc(null);
      setEvidenceFiles([]);
    }
  }, [editingId, data, globalRate]);

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
    return { ...doc, items };
  };


  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filtered = data.filter(o => {
    if (statusFilter === 'TO_APPROVE') {
      if (!['PENDING', 'DRAFT'].includes((o.status || '').toUpperCase())) return false;
    } else if (statusFilter !== 'ALL' && (o.status || '').toUpperCase() !== statusFilter) {
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

  const columns: ColumnDef<PurchaseOrder>[] = [
    { key: 'number',   header: 'Número',   width: '120px',
      render: (val) => <span className="font-black font-mono text-primary text-xs">{val}</span> },
    { key: 'purchaseRequestNumber', header: 'Solicitud', width: '110px',
      render: (_val, row) => <span className="text-xs text-muted-foreground">{row.purchaseRequestNumber || '-'}</span> },
    { key: 'supplier', header: 'Proveedor',
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',     header: 'Fecha',     width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'total',    header: 'Total',     width: '130px',
      render: (val, row) => (
        <CurrencyValuationAmount amount={Number(val || 0)} sourceCurrency={row.currency} sourceExchangeRate={row.exchangeRate} className="font-black text-foreground" />
      ) },
    { key: 'status',   header: 'Estado',    width: '120px', editable: canPerform('PURCHASES_ORDERS', 'edit'), type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<PurchaseOrder>) => {
    try { await purchaseOrdersService.update(id as string, updates); toast.success('Orden actualizada'); onRefresh(); }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar'); throw new Error('Update failed'); }
  };

  const handleCancelConfirm = async () => {
    if (!pendingCancelId || !cancelReason.trim()) return;
    setCancelLoading(true);
    try {
      await purchaseOrdersService.cancel(pendingCancelId, cancelReason.trim());
      toast.success('Orden de compra anulada');
      setPendingCancelId(null);
      setCancelReason('');
      setPreviewOrder(null);
      if (editingId === pendingCancelId) setEditingId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al anular');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleApproveConfirm = async () => {
    if (!approveConfirmId) return;
    setApproving(true);
    try {
      await purchaseOrdersService.approve(approveConfirmId);
      toast.success('Orden de compra aprobada');
      setApproveConfirmId(null);
      setPreviewOrder(null);
      if (editingId === approveConfirmId) setEditingId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al aprobar');
    } finally {
      setApproving(false);
    }
  };

  const handleSaveDoc = async () => {
    if (!localDoc?.supplierId) return toast.error('Debe seleccionar un proveedor');
    if (!String(localDoc.address || '').trim()) return toast.error('Debe ingresar la dirección');
    if ((localDoc.items || []).length === 0) return toast.error('Debe agregar al menos un ítem');
    if ((localDoc.items || []).some((it: any) => !String(it.code || '').trim() || !String(it.name || '').trim())) {
      return toast.error('Cada ítem requiere código y nombre');
    }

    const cleanedDoc: any = {
      ...localDoc,
      isService: localDoc.purchaseType === 'SERVICE',
      purchaseRequestId: localDoc.purchaseRequestId || null,
      purchaseRequestNumber: localDoc.purchaseRequestNumber || null,
      taxRate: 0,
      withholdingRate: 0,
      subtotal: Number(localDoc.subtotal || 0),
      taxAmount: Number(localDoc.taxAmount || 0),
      withholdingTotal: Number(localDoc.withholdingTotal || 0),
      withholdingBase: Number(localDoc.withholdingBase || 0),
      total: Number(localDoc.total || 0),
      items: (localDoc.items || []).map((it: any) => ({
        ...it,
        description: it.description || it.name || '',
        quantity: Number(it.quantity || 0),
        unitPrice: Number(it.unitPrice || 0),
        taxType: it.taxType || 'GRAVADO',
        taxRate: isTaxExempt(it.taxType) ? 0 : Number(it.taxRate || 15),
        taxBase: isTaxExempt(it.taxType) ? 0 : Number(it.taxBase || 0),
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

    if (evidenceFiles.length > 0) {
      const uploaded: { url: string; name: string; type: string; size: number }[] = [];
      for (const file of evidenceFiles) {
        const isImage = file.type.startsWith('image/');
        if (isImage && file.size > MAX_EVIDENCE_IMAGE_BYTES) {
          return toast.error(`La imagen "${file.name}" es muy pesada. Máximo 2MB`);
        }
        if (!isImage && file.size > MAX_EVIDENCE_FILE_BYTES) {
          return toast.error(`El archivo "${file.name}" es muy pesado. Máximo 10MB`);
        }
        try {
          const evidence = await storageService.uploadFile('purchase-evidence', file, { folder: 'ordenes' });
          uploaded.push({ url: evidence.uri, name: file.name, type: file.type, size: file.size });
        } catch {
          return toast.error(`No se pudo procesar el archivo "${file.name}"`);
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
            await purchaseRequestsService.changeStatus(created.purchaseRequestId, 'APPROVED');
          } catch { /* la solicitud se podrá aprobar manualmente */ }
        }
        toast.success('Orden creada');
      } else {
        await purchaseOrdersService.update(editingId!, cleanedDoc);
        toast.success('Orden guardada');
      }
      setEditingId(null);
      setEvidenceFiles([]);
      onRefresh();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '';
      if (msg.toLowerCase().includes('no existe') || e?.response?.status === 404) {
        toast.error('Uno de los productos seleccionados ya no está disponible o fue eliminado. Verifica los ítems e intenta de nuevo.');
      } else {
        toast.error(msg || 'Error al guardar la orden de compra');
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
    const taxAmount = items.reduce((acc, it) => {
      return acc + calcItemTax(it).taxAmount;
    }, 0);
    const withholdingTotal = items.reduce((acc, it) => {
      const wt = (it.withholdingType || 'NONE').toUpperCase();
      if (wt === 'NONE') return acc + 0;
      const lineTotal = Number(it.quantity||0) * Number(it.unitPrice||0);
      const base = Number(it.withholdingBase) || lineTotal;
      const rate = Number(it.withholdingRate) || 0;
      return acc + (base * rate / 100);
    }, 0);
    const withholdingBase = items.reduce((acc, it) => {
      const wt = (it.withholdingType || 'NONE').toUpperCase();
      if (wt === 'NONE') return acc + 0;
      const lineTotal = Number(it.quantity||0) * Number(it.unitPrice||0);
      return acc + (Number(it.withholdingBase) || lineTotal);
    }, 0);
    const total = subtotal + taxAmount - withholdingTotal;
    return { subtotal, taxAmount, withholdingTotal, withholdingBase, total };
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    if (!localDoc) return;
    setLocalDoc((prev) => {
      if (!prev) return prev;
      const newItems = [...(prev.items || [])];
      newItems[idx] = { ...newItems[idx], [field]: value };

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
          newItems[idx].taxRate = tax.taxRate;
          newItems[idx].taxBase = tax.taxBase;
          newItems[idx].taxAmount = tax.taxAmount;
        }
        const wt = (newItems[idx].withholdingType || 'NONE').toUpperCase();
        if (wt === 'NONE') {
          newItems[idx].withholdingRate = 0;
          newItems[idx].withholdingBase = 0;
        }
        newItems[idx].total = sub;
      }
      const totals = calculateTotals(newItems);
      return { ...prev, items: newItems, ...totals };
    });
  };

  const handleSelectExistingProduct = (idx: number, productId: string) => {
    if (!localDoc) return;
    const selected = products.find((p: any) => String(p.id) === String(productId));
    if (!selected) return;

    const newItems = [...(localDoc.items || [])];
    const currentItem = newItems[idx] || {};
    const purchasePrice = Number(selected.costPrice ?? selected.cost ?? selected.price ?? 0);
    const currentStock = selected.stock != null ? selected.stock :
      (selected.inventoryLevels?.[0]?.quantity ?? selected.quantity ?? 0);
    newItems[idx] = {
      ...currentItem,
      productId: selected.id,
      code: selected.code || selected.sku || currentItem.code || '',
      name: selected.name || currentItem.name || '',
      description: selected.description || currentItem.description || selected.name || '',
      category: selected.category?.name || selected.category || selected.categoryId || currentItem.category || '',
      categoryId: selected.categoryId || (selected.category?.id ? selected.category.id : currentItem.categoryId || ''),
      stockApplies: localDoc.purchaseType === 'SERVICE' ? false : true,
      currentStock: Number(currentStock),
      unitPrice: purchasePrice,
      taxType: currentItem.taxType || 'GRAVADO',
      taxRate: currentItem.taxRate || 15,
      withholdingType: currentItem.withholdingType || 'NONE',
      quantity: Number(currentItem.quantity || 1),
      total: Number(currentItem.quantity || 1) * purchasePrice,
    };
    recalculateTotals(newItems);
  };

  const handleServiceToggle = (checked: boolean) => {
    if (!localDoc) return;
    const updatedItems = (localDoc.items || []).map((item: any) => ({
      ...item,
      stockApplies: checked ? false : !!item.stockApplies,
      stock: checked ? undefined : item.stock,
    }));
    setLocalDoc((prev: any) => prev ? { ...prev, purchaseType: checked ? 'SERVICE' : 'INVENTORY', items: updatedItems } : prev);
  };

  const recalculateTotals = (items: any[]) => {
    const totals = calculateTotals(items);
    setLocalDoc(prev => ({ ...prev!, items, ...totals }));
  };

  const handlePurchaseOrderExportCSV = (doc: Partial<PurchaseOrder>) => {
    const rows = (doc.items || []).map((item: any) => [
      item.code || '',
      item.name || '',
      item.category || '',
      item.stock ?? '',
      item.quantity || 0,
      item.unitPrice || 0,
      item.taxType || 'GRAVADO',
      item.withholdingType || 'NONE',
      item.total || 0,
    ]);
    exportToCsv(`OC_${doc.number || doc.id || 'borrador'}`, [
      ['Numero', doc.number || '-'],
      ['Solicitud', doc.purchaseRequestNumber || '-'],
      ['Proveedor', doc.supplier?.name || '-'],
      ['Direccion', doc.address || '-'],
      ['Fecha', doc.date ? new Date(doc.date).toLocaleDateString() : '-'],
      ['Entrega Esperada', doc.expectedDelivery ? new Date(doc.expectedDelivery).toLocaleDateString() : '-'],
      ['Moneda', doc.currency || 'NIO'],
      ['Tipo OC', doc.purchaseType || 'INVENTORY'],
      ['Subtotal', Number(doc.subtotal || 0)],
      ['IVA', Number(doc.taxAmount || 0)],
      ['Retencion', Number(doc.withholdingTotal || 0)],
      ['Total', Number(doc.total || 0)],
      [],
      ['Codigo', 'Nombre', 'Categoria', 'Stock', 'Cantidad', 'Precio U.', 'TipoIVA', 'Retencion', 'Total'],
      ...rows,
    ]);
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
          onRowUpdate={handlePurchaseImportRowUpdate}
          onDownloadErrors={handleDownloadPurchaseImportErrors}
          onConfirm={handlePurchaseImportConfirm}
          onBack={() => { setImportPreviewOpen(false); setImportModalOpen(true); }}
        />
        <Dialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
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
      </>
    );
  }

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const currentStatus = statusOpts.find(s => s.value === (localDoc.status||'').toUpperCase());
    
    return (
      <div className="min-w-0 max-w-full space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Nueva Orden de Compra' : `Orden ${localDoc.number}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Detalle del registro</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
                   onClick={() => generatePurchaseOrderPDF({
                     order: localDoc,
                     tenantName: user?.tenantName || 'Nova Hub',
                     formatAmount: (amount: number, currency?: string, rate?: number) =>
                       formatConvertedAmount(Number(amount || 0), currency || (localDoc.currency as any), rate || localDoc.exchangeRate),
                   })}
                 >
                   <Download className="size-3 mr-2" /> Exportar PDF
                 </Button>
                 <Button
                   variant="outline"
                   className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4"
                   onClick={() => handlePurchaseOrderExportCSV(localDoc)}
                 >
                   <FileText className="size-3 mr-2" /> Exportar Excel
                 </Button>
               </>
             )}
              {!isNew && canPerform('PURCHASES_ORDERS', 'delete') && (
                 <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                   onClick={() => { setPendingCancelId(editingId); setCancelReason(''); }}>
                   <Trash2 className="size-3 mr-2" /> Anular
                 </Button>
              )}
            {((isNew && canPerform('PURCHASES_ORDERS', 'create')) || (!isNew && canPerform('PURCHASES_ORDERS', 'edit'))) && (
              <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                Guardar
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                {!isNew && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Número</p>
                    <Input value={localDoc.number || ''} disabled className="h-8 text-xs font-black uppercase bg-muted/20" />
                  </div>
                )}
                {( !isNew || !!localDoc?.purchaseRequestNumber ) && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Solicitud de Compra</p>
                    <Input value={localDoc?.purchaseRequestNumber || ''} disabled className="h-8 text-xs font-bold uppercase bg-muted/20" />
                  </div>
                )}
                <div className={(isNew && !localDoc?.purchaseRequestNumber) ? 'col-span-2' : ''}>
                  <p className="text-[10px] text-muted-foreground mb-1">Proveedor</p>
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
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Emisión</p>
                  <Input 
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                    type="date" 
                    value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Entrega Esperada</p>
                  <Input 
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                    type="date" 
                    value={localDoc.expectedDelivery ? new Date(localDoc.expectedDelivery).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, expectedDelivery: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <select 
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                    value={localDoc.status || 'DRAFT'} 
                    onChange={(e) => setLocalDoc({ ...localDoc, status: e.target.value as any })}
                    className={cn("h-8 w-full rounded-md border border-input px-2 text-xs font-bold uppercase", currentStatus?.color || 'bg-background')}
                  >
                    {statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Moneda</p>
                  <select 
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                    value={localDoc.currency || 'NIO'} 
                    onChange={(e) => setLocalDoc({ ...localDoc, currency: e.target.value as any })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase"
                  >
                    <option value="NIO">NIO (Cordobas)</option>
                    <option value="USD">USD (Dolares)</option>
                  </select>
                </div>
                <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Tipo de Compra</p>
                    <select
                      disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                      value={localDoc.purchaseType || 'INVENTORY'}
                      onChange={(e) => {
                        const pt = e.target.value;
                        setLocalDoc({ ...localDoc, purchaseType: pt });
                        if (pt === 'SERVICE') {
                          const updatedItems = (localDoc.items || []).map((item: any) => ({
                            ...item, stockApplies: false, stock: undefined,
                          }));
                          setLocalDoc((prev: any) => prev ? { ...prev, purchaseType: pt, items: updatedItems } : prev);
                        }
                      }}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase"
                    >
                      <option value="INVENTORY">Inventario</option>
                      <option value="ASSET">Activo Fijo</option>
                      <option value="SERVICE">Servicio</option>
                      <option value="ADMIN">Gasto Administrativo</option>
                    </select>
                  </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Dirección</p>
                  <Input
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                    value={localDoc.address || ''}
                    onChange={(e) => setLocalDoc({ ...localDoc, address: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="Dirección de entrega o facturación"
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Adjuntar evidencia (PDF, imagen, XLSX)</p>
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
                  <p className="mt-1 text-[10px] text-muted-foreground">Imágenes max 2MB. Otros archivos max 10MB.</p>
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

          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 flex flex-col justify-center h-full space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen Financiero</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-bold tabular-nums">{localDoc.currency === 'USD' ? '$' : 'C$'} {Number(localDoc.subtotal||0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">IVA</span>
                  <span className="font-bold tabular-nums text-rose-500">{localDoc.currency === 'USD' ? '$' : 'C$'} {Number(localDoc.taxAmount||0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Retenciones</span>
                  <span className="font-bold tabular-nums text-amber-500">-{localDoc.currency === 'USD' ? '$' : 'C$'} {Number(localDoc.withholdingTotal||0).toLocaleString()}</span>
                </div>
                <div className="border-t pt-3 border-border/50">
                  <p className="text-[10px] text-muted-foreground mb-2 font-bold uppercase tracking-widest">Impuestos por línea</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>IVA calculado por producto según tipo fiscal (Gravado/Exento/No Gravado)</p>
                    <p>Retenciones calculadas por producto según tipo de retención</p>
                  </div>
                </div>
                <div className="flex justify-between items-center text-base border-t pt-3 border-border/50">
                  <span className="font-black uppercase text-xs tracking-widest">Total</span>
                  <span className="font-black text-xl text-primary tabular-nums text-right">
                     {localDoc.currency === 'USD' ? '$' : 'C$'} {Number(localDoc.total||0).toLocaleString()}
                     {localDoc.currency === 'NIO' && <span className="block text-[9px] text-muted-foreground mt-1">≈ $ {(Number(localDoc.total||0) / (localDoc.exchangeRate || globalRate)).toLocaleString(undefined, {maximumFractionDigits:2})}</span>}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Ítems de Orden</p>
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
                <div key={item.id || idx} className="group relative rounded-2xl border border-border/40 bg-background/60 backdrop-blur-sm p-4 space-y-3 hover:border-primary/30 hover:shadow-md transition-all duration-200">
                  {/* Header row: product selector + delete */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1.5">
                        Vincular producto del inventario
                        {item.productId && (
                          <span className="ml-2 inline-flex items-center gap-1 text-primary font-black">
                            <span className="size-1.5 rounded-full bg-primary inline-block" />
                            Vinculado
                          </span>
                        )}
                      </p>
                      <Combobox
                        disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                        options={[
                          { label: 'Sin vincular (ítem manual)', value: '__none__', description: 'Ingresar datos manualmente' },
                          ...products.filter(Boolean).map((p: any) => ({
                            label: p.name || 'Producto',
                            value: String(p.id),
                            description: `${p.code || p.sku || 'SIN-COD'} · ${p.category?.name || p.category || 'Sin categoría'}`,
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
                        placeholder="Buscar producto por nombre, código o categoría..."
                      />
                    </div>
                    {((isNew && canPerform('PURCHASES_ORDERS', 'create')) || (!isNew && canPerform('PURCHASES_ORDERS', 'edit'))) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground/40 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                        onClick={() => handleDeleteItem(idx)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Fields grid */}
                  <div className="purchase-item-fields grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Código</p>
                      <Input
                        disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                        value={item.code || ''}
                        onChange={(e) => handleItemChange(idx, 'code', e.target.value)}
                        className="h-8 text-xs font-mono"
                        placeholder="Código"
                      />
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Nombre</p>
                      <Input
                        disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                        value={item.name || ''}
                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                        className="h-8 text-xs"
                        placeholder={localDoc.purchaseType === 'SERVICE' ? 'Servicio' : 'Producto'}
                      />
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Categoría</p>
                      <select
                        disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                        value={item.categoryId || ''}
                        onChange={(e) => {
                          const cat = categories.find((c: any) => String(c.id) === String(e.target.value));
                          handleItemChange(idx, 'categoryId', e.target.value);
                          handleItemChange(idx, 'category', cat?.name || '');
                        }}
                        className={cn("h-8 w-full rounded-md border border-input bg-background px-2 text-xs", item.categoryId ? "" : "text-muted-foreground/50")}
                      >
                        <option value="">Sin categoría</option>
                        {categories.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Stock actual</p>
                      <div className="h-8 flex items-center">
                        {item.currentStock !== undefined ? (
                          <span className="text-xs font-black text-primary tabular-nums">{Number(item.currentStock).toLocaleString()}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Cant.</p>
                      <Input
                        disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                        type="number"
                        min="0"
                        value={item.quantity === 0 ? '' : item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="h-8 text-xs text-right"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Precio</p>
                      <Input
                        disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                        type="number"
                        min="0"
                        value={item.unitPrice === 0 ? '' : item.unitPrice}
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                        className="h-8 text-xs text-right"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Impuestos y Retenciones</p>
                      <TaxDetail
                        item={item}
                        onItemChange={(field, value) => handleItemChange(idx, field, value)}
                        lineTotal={Number(item.quantity || 0) * Number(item.unitPrice || 0)}
                      />
                    </div>
                  </div>

                  {/* Subtotal + tax info footer */}
                  <div className="flex items-center justify-end gap-4 pt-1 border-t border-border/30">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Subtotal</span>
                    <span className="text-sm font-black tabular-nums">
                      {localDoc.currency === 'USD' ? '$' : 'C$'} {Number(item.quantity * item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {item.taxType && !isTaxExempt(item.taxType) && item.taxType !== '' && (
                      <>
                        <span className="text-[9px] font-black uppercase tracking-widest text-rose-500/60">IVA</span>
                        <span className="text-xs font-black tabular-nums text-rose-500">
                          {localDoc.currency === 'USD' ? '$' : 'C$'} {Number(item.taxAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </>
                    )}
                    {item.withholdingType !== 'NONE' && (
                      <>
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-500/60">Ret.</span>
                        <span className="text-xs font-black tabular-nums text-amber-500">
                          -{localDoc.currency === 'USD' ? '$' : 'C$'} {Number((Number(item.quantity||0) * Number(item.unitPrice||0)) * (Number(item.withholdingRate||0) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </>
                    )}
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
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CircleHelp className="size-5 text-primary" /> Importar productos a la orden</DialogTitle>
              <DialogDescription>Carga varios ítems desde Excel sin crear una nueva orden de compra.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
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
            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={handleDownloadPurchaseTemplate}><Download className="mr-2 size-4" /> Descargar plantilla</Button>
              <Button onClick={() => { setImportIntroOpen(false); setImportModalOpen(true); }}><Upload className="mr-2 size-4" /> Continuar con la carga</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importModalOpen} onOpenChange={(open) => {
          if (importing || importProcessing) return;
          setImportModalOpen(open);
          if (!open) { setImportData([]); setImportFileName(''); setImportProgress(0); }
        }}>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><FileText className="size-5" /> Cargar productos</DialogTitle>
              <DialogDescription>Selecciona un Excel o CSV. Los productos se agregarán a la orden solo después de revisar la previsualización.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground">
                <p className="font-black uppercase tracking-widest text-foreground">Validación de SKU</p>
                <p className="mt-2">Un SKU encontrado en Inventario se vinculará al producto y mostrará su existencia. Un SKU desconocido quedará como artículo manual y se marcará como advertencia.</p>
                <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={handleDownloadPurchaseTemplate}><Download className="size-4" /> Descargar plantilla y guía</Button>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Archivo Excel de productos</label>
                <Input type="file" accept=".xlsx,.xls,.csv" disabled={importProcessing} onChange={(event) => { const file = event.target.files?.[0]; if (file) handlePurchaseImportFile(file); }} />
                {importFileName && <p className="break-words text-xs text-muted-foreground">Archivo cargado: <b>{importFileName}</b> · {importData.length} producto(s) detectados</p>}
              </div>
            </div>
            <DialogFooter className="flex-wrap">
              <Button variant="outline" onClick={() => setImportModalOpen(false)} disabled={importProcessing}>Cerrar</Button>
              {importFileName && <Button onClick={() => { setImportModalOpen(false); setImportPreviewOpen(true); }} disabled={importProcessing || importData.length === 0}><Check className="mr-2 size-4" /> Previsualizar productos</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
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
          open={!!pendingCancelId}
          onOpenChange={(open) => { if (!open) { setPendingCancelId(null); setCancelReason(''); } }}
          title="Anular Orden de Compra"
          description="La orden quedará cancelada. No se podrá recibir ni facturar. Esta acción no se puede deshacer."
          confirmLabel="Anular Orden"
          variant="destructive"
          loading={cancelLoading}
          disabled={!cancelReason.trim()}
          onConfirm={handleCancelConfirm}
        >
          <div className="mt-4">
            <label className="text-sm font-medium text-foreground mb-1 block">Motivo de anulación *</label>
            <textarea
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              rows={3}
              placeholder="Ej: Cancelada por el proveedor, error en productos..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
        </ConfirmDialog>

        <PurchaseOrderPreviewDialog
          open={!!previewOrder}
          order={previewOrder}
          suppliers={supplierCatalog}
          canApprove={canPerform('PURCHASES_ORDERS', 'edit')}
          canCancel={canPerform('PURCHASES_ORDERS', 'delete')}
          approving={approving}
          onClose={() => setPreviewOrder(null)}
          onApprove={(id) => setApproveConfirmId(id)}
          onCancel={(id) => { setPreviewOrder(null); setPendingCancelId(id); setCancelReason(''); }}
        />
        <ConfirmDialog
          open={!!approveConfirmId}
          onOpenChange={(open) => { if (!open) setApproveConfirmId(null); }}
          title="Aprobar Orden de Compra"
          description="La orden quedará aprobada y podrá ser recibida. ¿Desea continuar?"
          confirmLabel="Aprobar Orden"
          variant="default"
          loading={approving}
          onConfirm={handleApproveConfirm}
        />
      </div>
    );
  }

  const toDisplayAmount = (amount: number, currency?: string, rate?: number) => valuationMode === 'CURRENT'
    ? convertCurrentAmount(amount, currency)
    : convertAmount(amount, currency, rate || globalRate);
  const totalAmountInDisplayCurrency = data.reduce(
    (acc, order) => acc + toDisplayAmount(Number((order as any).total ?? (order as any).baseTotal ?? 0), order.currency, order.exchangeRate),
    0,
  );
  const kpis = [
    { title: 'Total Ordenes',   value: data.length,                                                                     icon: ClipboardList, color: 'text-blue-500',    bg: 'bg-blue-500/10',    filter: 'ALL' },
    { title: 'Por Aprobar',     value: data.filter(o => ['PENDING','DRAFT'].includes((o.status||'').toUpperCase())).length, icon: Clock, color: 'text-amber-500',  bg: 'bg-amber-500/10',    filter: 'TO_APPROVE' },
    { title: 'Aprobadas',       value: data.filter(o => (o.status||'').toUpperCase() === 'APPROVED').length,             icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10',  filter: 'APPROVED' },
    {
      title: `Monto Total (${displayCurrency}${valuationModeSuffix})`,
      value: formatCurrentAmount(totalAmountInDisplayCurrency, displayCurrency),
      icon: TrendingDown,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="purchases-list-kpis">
        {kpis.map((k, i) => (
          <PurchaseKpiCard key={i} title={k.title} value={k.value} icon={k.icon} color={k.color} bg={k.bg} kind={k.filter ? 'filter' : 'indicator'} active={k.filter ? statusFilter === k.filter : false} onClick={k.filter ? () => { const next = statusFilter === k.filter ? 'ALL' : k.filter; setStatusFilter(next); onStatusChange?.(next === 'TO_APPROVE' ? 'ALL' : next); } : undefined} />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Órdenes de Compra</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Pedidos a proveedores</p></div>
          <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto" data-tour="purchases-list-actions">
            <PurchaseViewTutorial view="orders" />
            <div className="relative flex-1 min-w-0"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-full sm:w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
            {canPerform('PURCHASES_ORDERS', 'create') && (
              <Button onClick={() => setEditingId('NEW')} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nueva Orden</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} pagination={pagination}
          onBulkDelete={canPerform('PURCHASES_ORDERS', 'delete') ? async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await purchaseOrdersService.cancel(id as string, 'Anulación masiva');
              }
              toast.success('Órdenes anuladas');
              onRefresh();
            } catch (e: any) {
              toast.error(e?.response?.data?.message || e?.message || 'Error al anular');
            }
          } : undefined}
          actions={(row) => (
            <div className="flex gap-1">
              <Button
                title="Vista previa"
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500"
                onClick={() => setPreviewOrder(row)}
              >
                <FileInput className="size-4" />
              </Button>
              <Button title={canPerform('PURCHASES_ORDERS', 'edit') ? "Editar" : "Ver"} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
              <PurchaseAuditButton entity="PURCHASE_ORDER" entityId={row.id} title="Auditoria de la Orden" />
              {canPerform('PURCHASES_ORDERS', 'delete') && (
                <Button title="Anular" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => { setPendingCancelId(row.id); setCancelReason(''); }}><Trash2 className="size-4" /></Button>
              )}
            </div>
          )}
        />
        <ConfirmDialog
          open={!!pendingCancelId}
          onOpenChange={(open) => { if (!open) { setPendingCancelId(null); setCancelReason(''); } }}
          title="Anular Orden de Compra"
          description="La orden quedará cancelada. No se podrá recibir ni facturar. Esta acción no se puede deshacer."
          confirmLabel="Anular Orden"
          variant="destructive"
          loading={cancelLoading}
          disabled={!cancelReason.trim()}
          onConfirm={handleCancelConfirm}
        >
          <div className="mt-4">
            <label className="text-sm font-medium text-foreground mb-1 block">Motivo de anulación *</label>
            <textarea
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              rows={3}
              placeholder="Ej: Cancelada por el proveedor, error en productos..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
        </ConfirmDialog>

        <PurchaseOrderPreviewDialog
          open={!!previewOrder}
          order={previewOrder}
          suppliers={supplierCatalog}
          canApprove={canPerform('PURCHASES_ORDERS', 'edit')}
          canCancel={canPerform('PURCHASES_ORDERS', 'delete')}
          approving={approving}
          onClose={() => setPreviewOrder(null)}
          onApprove={(id) => setApproveConfirmId(id)}
          onCancel={(id) => { setPreviewOrder(null); setPendingCancelId(id); setCancelReason(''); }}
        />
        <ConfirmDialog
          open={!!approveConfirmId}
          onOpenChange={(open) => { if (!open) setApproveConfirmId(null); }}
          title="Aprobar Orden de Compra"
          description="La orden quedará aprobada y podrá ser recibida. ¿Desea continuar?"
          confirmLabel="Aprobar Orden"
          variant="default"
          loading={approving}
          onConfirm={handleApproveConfirm}
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
                  <li>Los SKU encontrados se vinculan al inventario; los no encontrados se muestran como advertencia y quedan manuales.</li>
                </ol>
              </div>
              <p className="text-xs text-muted-foreground">La importación crea órdenes en estado Borrador. Las filas con errores no se crearán.</p>
            </div>
            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={handleDownloadPurchaseTemplate}><Download className="mr-2 size-4" /> Descargar plantilla</Button>
              <Button onClick={() => { setImportIntroOpen(false); setImportModalOpen(true); }}><Upload className="mr-2 size-4" /> Continuar con la carga</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={false} onOpenChange={(open) => {
          if (importing || importProcessing) return;
          setImportModalOpen(open);
          if (!open) { setImportData([]); setImportFileName(''); setImportProgress(0); }
        }}>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto">
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
              {importFileName && <Button onClick={() => { setImportModalOpen(false); setImportPreviewOpen(true); }} disabled={importProcessing || importData.length === 0}><Check className="mr-2 size-4" /> Previsualizar importación</Button>}
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
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-emerald-500">{importResults?.success || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Órdenes creadas</p></div>
              <div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-amber-500">{importResults?.skipped || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Filas omitidas</p></div>
              <div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-rose-500">{importResults?.failed || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Órdenes con error</p></div>
            </div>
            {!!importResults?.errors.length && <div className="max-h-40 overflow-y-auto rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-500">{importResults.errors.map((error, index) => <p key={`${error}-${index}`}>{error}</p>)}</div>}
            <DialogFooter><Button className="w-full" onClick={() => setImportResults(null)}>Continuar a órdenes de compra</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
