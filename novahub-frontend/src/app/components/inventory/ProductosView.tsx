import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Search, Plus, Ban, X, Check, CheckCircle2, Package, Upload, FileSpreadsheet, AlertTriangle, Download, Pencil, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Square, SquareCheckBig, Image as ImageIcon, ImageOff, CircleHelp, Loader2, Send, PackageSearch, Warehouse as WarehouseIcon, Store, Copy, Barcode } from 'lucide-react';
import * as XLSX from 'xlsx';
import { extractProductImageArchive, PRODUCT_IMAGE_ARCHIVE_EXTENSIONS } from '../../utils/product-image-archive';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { HorizontalTableScroller } from '../ui/HorizontalTableScroller';
import { useImportPreviewLayout } from '../../hooks/useImportPreviewLayout';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import { ImportReviewSummary } from '../ui/ImportReviewSummary';
import { ImportPreviewField, ImportPreviewMobileCard, importPreviewFieldClass } from '../ui/ImportPreviewMobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import { MultiSelectFilter } from './MultiSelectFilter';
import { ProductDetailDrawer } from './ProductDetailDrawer';
import { inventoryService } from '../../services/inventario.service';
import { purchaseRequestsService } from '../../services/compras.service';
import { employeesService } from '../../services/rh.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { ProductImagePicker, ProductThumbnail } from '../ui/ProductImage';
import { storageService } from '../../services/storage.service';
import { AddProductsModal } from './AddProductsModal';
import { EditProductModal } from './EditProductModal';
import { LabelPrintModal } from './LabelPrintModal';
import { VariantManagerModal } from './VariantManagerModal';
import { contabilidadService } from '../../services/contabilidad.service';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
import type { SalesPaginationControls } from '../../types';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { InventoryViewTutorial } from './InventoryViewTutorial';

const WAREHOUSE_TYPES = [
  { value: 'MAIN', label: 'Principal' },
  { value: 'STORE', label: 'Tienda' },
  { value: 'DISTRIBUTION_CENTER', label: 'Centro de distribución' },
  { value: 'VIRTUAL', label: 'Virtual' },
];

const UNIT_OPTIONS = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'kilo', label: 'Kilo' },
  { value: 'libra', label: 'Libra' },
  { value: 'docena', label: 'Docena' },
  { value: 'caja', label: 'Caja' },
  { value: 'litro', label: 'Litro' },
  { value: 'metro', label: 'Metro' },
  { value: 'par', label: 'Par' },
  { value: 'rollo', label: 'Rollo' },
  { value: 'pieza', label: 'Pieza' },
];

const TAX_OPTIONS = [
  { value: '0.15', label: 'Gravado 15%' },
  { value: '0', label: 'Exento 0%' },
];

const PRODUCTS_TOUR_STEPS: GuidedTourStep[] = [
  { target: '[data-tour="inventory-products-title"]', title: 'Vista de Productos', description: 'Aquí administras el catálogo, el costo, el stock y la distribución por almacén. Los precios de venta se gestionan desde Listas de precios.', placement: 'bottom' },
  { target: '[data-tour="inventory-products-kpis"]', title: 'Indicadores y filtros rápidos', description: 'Productos muestra el total, disponibles, stock bajo y sin stock. Servicios muestra categorías, promedio semanal y precio promedio. Las tarjetas de existencias filtran la lista; los valores de referencia solo informan.', placement: 'bottom' },
  { target: '[data-tour="inventory-products-filters"]', title: 'Buscar y filtrar', description: 'Busca por nombre o SKU y filtra por categoría, almacén o nivel de stock para encontrar rápidamente los productos.', placement: 'bottom' },
  { target: '[data-tour="inventory-products-actions"]', title: 'Acciones del catálogo', description: 'Desde aquí puedes cargar imágenes masivamente en cualquier momento, iniciar la importación inicial, consultar solicitudes de reabastecimiento y crear categorías o Bodegas cuando corresponda.', placement: 'bottom' },
  { target: '[data-tour="inventory-products-actions"]', title: 'Imágenes e importación inicial', description: 'La importación inicial solo se habilita cuando la empresa todavía no tiene productos. La carga masiva de imágenes permanece disponible después y en ambos casos usa ZIP o RAR con archivos llamados como el SKU.', tip: 'Los errores se omiten y los precios faltantes se muestran como avisos.', placement: 'bottom' },
  { target: '[data-tour="inventory-products-table"]', title: 'Registros y edición', description: 'Consulta los productos, edita únicamente los campos permitidos y abre el detalle haciendo clic en el registro o en su imagen.', placement: 'top' },
  { target: '[data-tour="inventory-products-pagination"]', title: 'Paginación', description: 'Selecciona 50, 100 o 200 registros, revisa el rango mostrado y utiliza los controles para ir al inicio, anterior, siguiente o final.', placement: 'top' },
];

export type ProductStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const PRODUCT_TABLE_WIDTHS = {
  selector: '40px',
  code: '112px',
  name: '192px',
  category: '144px',
  unit: '112px',
  min: '80px',
  max: '80px',
  warehouse: '112px',
  stock: '96px',
  price: '112px',
  cost: '112px',
  status: '112px',
  actions: '128px',
} as const;

const normalizeImportHeader = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

interface ProductosViewProps {
  products: any[];
  summaryProducts?: any[];
  categories: any[];
  warehouses?: any[];
  branches?: any[];
  series?: any[];
  movements?: any[];
  onRefresh: () => void;
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  onCategoryChange?: (value: string[]) => void;
  onWarehouseChange?: (value: string[]) => void;
  onUnitChange?: (value: string) => void;
  onTaxRateChange?: (value: string) => void;
  onStockStatusChange?: (value: string) => void;
  itemType?: 'PRODUCT' | 'SERVICE';
  isSidebarCollapsed?: boolean;
  targetProductId?: string | null;
  initialStockFilter?: 'all' | 'available' | 'low' | 'out';
  productStatusFilter?: ProductStatusFilter;
  onProductStatusFilterChange?: (value: ProductStatusFilter) => void;
  onClearTargetProduct?: () => void;
  selectedBranchId?: string;
  branchWarehouseIds?: string[];
  unitFilter?: string;
  taxRateFilter?: string;
  stockStatusFilter?: string;
}

interface EditingProduct {
  id: string;
  code: string;
  name: string;
  description?: string;
  categoryId: string;
  salePrice: number | '';
  priceCurrency?: string;
  priceExchangeRate?: number;
  costPrice: number | '';
  unit?: string;
  minStock?: number;
  maxStock?: number;
  trackSerialNumbers?: boolean;
  itemType?: 'PRODUCT' | 'SERVICE';
  isActive?: boolean;
  warehouseId?: string;
  imageUrl?: string;
  imageStorageUri?: string;
  imageFile?: File;
  imagePreviewUrl?: string;
  removeImage?: boolean;
  initialStock?: number;
  initialAllocations?: Array<{
    id: string;
    warehouseId: string;
    quantity: number;
    minStock?: number;
    maxStock?: number;
  }>;
  isNew?: boolean;
}

interface ImportPreviewPageProps {
  importData: any[];
  importFileName: string;
  importCurrency: string;
  categoryOptions: any[];
  warehouseOptions: any[];
  importing: boolean;
  importProgress: number;
  onRowUpdate: (index: number, field: string, value: any) => void;
  onDownloadErrors: () => void;
  onCreateCategory: (index: number, value: string) => void;
  onCreateWarehouse: (index: number, value: string) => void;
  canCreateCategory: boolean;
  canCreateWarehouse: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

function ImportPreviewPage({
  importData,
  importFileName,
  importCurrency,
  categoryOptions,
  warehouseOptions,
  importing,
  importProgress,
  onRowUpdate,
  onDownloadErrors,
  onCreateCategory,
  onCreateWarehouse,
  canCreateCategory,
  canCreateWarehouse,
  onConfirm,
  onBack,
}: ImportPreviewPageProps) {
  useImportPreviewLayout();
  const { canPerform } = useAuth();
  const canViewInventoryCost = canPerform('INVENTORY_PRODUCTS', 'viewCost');
  const previewPageSize = 50;
  const [previewPage, setPreviewPage] = useState(1);
  const validRows = importData.filter((row) => !row._hasError).length;
  const errorRows = importData.filter((row) => row._hasError).length;
  const warningRows = importData.filter((row) => !row._hasError && row._hasWarning).length;
  const issueRows = importData.filter((row) => row._hasError || row._hasWarning).length;
  const previewPageCount = Math.max(1, Math.ceil(importData.length / previewPageSize));
  const safePreviewPage = Math.min(previewPage, previewPageCount);
  const previewStart = (safePreviewPage - 1) * previewPageSize;
  const previewRows = useMemo(() => importData.slice(previewStart, previewStart + previewPageSize), [importData, previewStart]);

  useEffect(() => {
    if (previewPage > previewPageCount) setPreviewPage(previewPageCount);
  }, [previewPage, previewPageCount]);

  const renderMobileCard = (row: any, index: number) => {
    const categoryExists = categoryOptions.some((category: any) => category.name?.toLowerCase() === String(row.category || '').trim().toLowerCase());
    const warehouseExists = !row.warehouse || warehouseOptions.some((warehouse: any) => warehouse.name?.toLowerCase() === String(row.warehouse || '').trim().toLowerCase());
    return (
      <ImportPreviewMobileCard index={index} title={row.name || row.code} error={row._hasError ? row._errorMessage || 'Fila con errores' : undefined} warning={row._hasWarning ? row._warningMessage || 'Revisar fila' : undefined}>
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <ImportPreviewField label="Código *"><Input value={row.code} onChange={(event) => onRowUpdate(index, 'code', event.target.value)} className={`${importPreviewFieldClass} font-mono ${!row.code ? 'border-red-500' : ''}`} disabled={importing} /></ImportPreviewField>
          <ImportPreviewField label="Unidad"><Input value={row.unit ?? ''} onChange={(event) => onRowUpdate(index, 'unit', event.target.value)} className={importPreviewFieldClass} disabled={importing} /></ImportPreviewField>
          <ImportPreviewField label="Nombre *" className="sm:col-span-2"><Input value={row.name} title={row.name} onChange={(event) => onRowUpdate(index, 'name', event.target.value)} className={`${importPreviewFieldClass} ${!row.name ? 'border-red-500' : ''}`} disabled={importing} /></ImportPreviewField>
          <ImportPreviewField label="Categoría" className="sm:col-span-2">
            {categoryExists ? <Input value={row.category} onChange={(event) => onRowUpdate(index, 'category', event.target.value)} className={importPreviewFieldClass} disabled={importing} /> : <div className="flex min-w-0 items-center gap-1"><Select value="__none__" onValueChange={(value) => { const category = categoryOptions.find((item: any) => item.id === value); if (category) onRowUpdate(index, 'category', category.name); }} disabled={importing}><SelectTrigger className={`${importPreviewFieldClass} min-w-0 flex-1 border-amber-500/60 text-amber-600`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">{row.category ? `No existe: ${row.category}` : 'Seleccionar categoría'}</SelectItem>{categoryOptions.length === 0 && <SelectItem value="__no_categories__" disabled>No hay registros</SelectItem>}{categoryOptions.map((category: any) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select>{canCreateCategory && <Button type="button" variant="outline" size="sm" className="size-9 shrink-0 rounded-lg p-0 text-amber-600" title="Crear esta categoría" aria-label="Crear esta categoría" onClick={() => onCreateCategory(index, row.category || '')} disabled={importing}><Plus className="size-3.5" /></Button>}</div>}
          </ImportPreviewField>
          <ImportPreviewField label="Minorista"><Input type="number" min={0} value={row.prices?.RETAIL ?? ''} onChange={(event) => onRowUpdate(index, 'price.RETAIL', event.target.value)} className={`${importPreviewFieldClass} text-right`} disabled={importing} /></ImportPreviewField>
          <ImportPreviewField label="Mayorista"><Input type="number" min={0} value={row.prices?.WHOLESALE ?? ''} onChange={(event) => onRowUpdate(index, 'price.WHOLESALE', event.target.value)} className={`${importPreviewFieldClass} text-right`} disabled={importing} /></ImportPreviewField>
          <ImportPreviewField label="Distribuidor"><Input type="number" min={0} value={row.prices?.DISTRIBUTOR ?? ''} onChange={(event) => onRowUpdate(index, 'price.DISTRIBUTOR', event.target.value)} className={`${importPreviewFieldClass} text-right`} disabled={importing} /></ImportPreviewField>
          {canViewInventoryCost && <ImportPreviewField label="Costo"><Input type="number" min={0} value={row.costPrice ?? ''} onChange={(event) => onRowUpdate(index, 'costPrice', event.target.value)} className={`${importPreviewFieldClass} text-right`} disabled={importing} /></ImportPreviewField>}
          <ImportPreviewField label="Stock inicial"><Input type="number" min={0} value={row.initialStock ?? ''} onChange={(event) => onRowUpdate(index, 'initialStock', Number(event.target.value) || 0)} className={`${importPreviewFieldClass} text-right`} disabled={importing} /></ImportPreviewField>
          <ImportPreviewField label="Stock mínimo"><Input type="number" min={0} value={row.minStock} onChange={(event) => onRowUpdate(index, 'minStock', Number(event.target.value) || 0)} className={`${importPreviewFieldClass} text-right`} disabled={importing} /></ImportPreviewField>
          <ImportPreviewField label="Bodega" className="sm:col-span-2">
            {warehouseExists ? <Select value={row.warehouse || '__none__'} onValueChange={(value) => onRowUpdate(index, 'warehouse', value === '__none__' ? '' : value)} disabled={importing}><SelectTrigger className={importPreviewFieldClass}><SelectValue placeholder="Seleccionar bodega" /></SelectTrigger><SelectContent><SelectItem value="__none__">Sin bodega</SelectItem>{warehouseOptions.length === 0 && <SelectItem value="__no_warehouses__" disabled>No hay bodegas</SelectItem>}{warehouseOptions.map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.name}>{warehouse.name}</SelectItem>)}</SelectContent></Select> : <div className="flex min-w-0 items-center gap-1"><Select value="__none__" onValueChange={(value) => onRowUpdate(index, 'warehouse', value === '__none__' ? '' : value)} disabled={importing}><SelectTrigger className={`${importPreviewFieldClass} min-w-0 flex-1 border-amber-500/60 text-amber-600`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">{`No existe: ${row.warehouse}`}</SelectItem>{warehouseOptions.map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.name}>{warehouse.name}</SelectItem>)}</SelectContent></Select>{canCreateWarehouse && <Button type="button" variant="outline" size="sm" className="size-9 shrink-0 rounded-lg p-0 text-amber-600" title="Crear esta bodega" aria-label="Crear esta bodega" onClick={() => onCreateWarehouse(index, row.warehouse || '')} disabled={importing}><Plus className="size-3.5" /></Button>}</div>}
          </ImportPreviewField>
          <ImportPreviewField label="Imagen" className="sm:col-span-2"><div className="flex min-h-9 items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 text-xs"><span className="shrink-0">{row._imageStatus === 'matched' ? <ImageIcon className="size-4 text-emerald-500" /> : <ImageOff className="size-4 text-muted-foreground" />}</span><span className="min-w-0 break-words text-muted-foreground">{row._imageStatus === 'matched' ? 'Imagen vinculada' : row._imageStatus === 'missing' ? 'No se encontró imagen para este SKU' : 'Sin archivo de imágenes'}</span></div></ImportPreviewField>
        </div>
      </ImportPreviewMobileCard>
    );
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-hidden sm:gap-5">
      <div className="flex flex-col gap-3 border-b border-border/50 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Importación inicial</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">Previsualizar productos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Revisa y corrige los registros antes de formalizar la carga.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/40 text-primary">Moneda: {importCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)'}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3 text-sm">
        <div className="min-w-0">
          <p className="font-semibold">Archivo: {importFileName}</p>
          <p className="text-xs text-muted-foreground">Los errores se omitirán y las advertencias no impedirán la carga.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onDownloadErrors} disabled={issueRows === 0}>
          <Download className="mr-2 size-3.5" /> Descargar incidencias
        </Button>
      </div>

      <ImportReviewSummary total={importData.length} valid={validRows} skipped={errorRows} warnings={warningRows} entityLabel="productos" />

      <div className="hidden min-h-0 flex-1 sm:flex">
      <HorizontalTableScroller className="min-h-0 flex-1" label="Desplazamiento horizontal · columna por columna">
          <Table containerClassName="w-max min-w-full max-w-none overflow-visible" className="min-w-[1320px]">
            <TableHeader className="sticky top-0 z-10 bg-muted shadow-sm">
              <TableRow>
                <TableHead className="w-8 text-[10px] uppercase"></TableHead>
                <TableHead className="w-32 text-[10px] uppercase">Código</TableHead>
                <TableHead className="min-w-[220px] text-[10px] uppercase">Nombre</TableHead>
                <TableHead className="w-20 text-center text-[10px] uppercase">Imagen</TableHead>
                <TableHead className="w-32 text-[10px] uppercase">Categoría</TableHead>
                <TableHead className="w-28 text-right text-[10px] uppercase">Unidad</TableHead>
                <TableHead className="w-28 text-right text-[10px] uppercase">Minorista</TableHead>
                <TableHead className="w-28 text-right text-[10px] uppercase">Mayorista</TableHead>
                <TableHead className="w-28 text-right text-[10px] uppercase">Distribuidor</TableHead>
                  {canViewInventoryCost && <TableHead className="w-28 text-right text-[10px] uppercase">Costo</TableHead>}
                <TableHead className="w-24 text-right text-[10px] uppercase">Stock</TableHead>
                <TableHead className="w-24 text-right text-[10px] uppercase">Min</TableHead>
                <TableHead className="w-40 text-[10px] uppercase">Bodega</TableHead>
                <TableHead className="w-40 text-[10px] uppercase">Validación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, localIndex) => {
                const index = previewStart + localIndex;
                return (
                <TableRow key={index} className={row._hasError ? 'bg-red-500/10' : row._hasWarning ? 'bg-amber-500/5' : ''}>
                  <TableCell>{row._hasError ? <AlertTriangle className="size-4 text-red-500" /> : row._hasWarning ? <AlertTriangle className="size-4 text-amber-500" /> : <Check className="size-4 text-emerald-500" />}</TableCell>
                  <TableCell className="p-1"><Input value={row.code} onChange={(event) => onRowUpdate(index, 'code', event.target.value)} className={`h-8 text-xs font-mono ${!row.code ? 'border-red-500' : ''}`} /></TableCell>
                  <TableCell className="min-w-[220px] p-1"><Input value={row.name} title={row.name} onChange={(event) => onRowUpdate(index, 'name', event.target.value)} className={`h-8 w-full text-xs ${!row.name ? 'border-red-500' : ''}`} /></TableCell>
                  <TableCell className="p-1 text-center">
                    {row._imageStatus === 'matched' ? <span role="img" aria-label="Imagen vinculada" title="Imagen vinculada"><ImageIcon className="mx-auto size-4 text-emerald-500" /></span> : row._imageStatus === 'missing' ? <span role="img" aria-label="Imagen no vinculada" title="No se encontró una imagen con el mismo SKU"><ImageOff className="mx-auto size-4 text-red-500" /></span> : <span role="img" aria-label="Sin archivo de imágenes" title="No se cargó un ZIP o RAR de imágenes"><ImageOff className="mx-auto size-4 text-muted-foreground/50" /></span>}
                  </TableCell>
                  <TableCell className="p-1">
                    {categoryOptions.some((category: any) => category.name?.toLowerCase() === String(row.category || '').trim().toLowerCase()) ? (
                      <Input value={row.category} onChange={(event) => onRowUpdate(index, 'category', event.target.value)} className="h-8 text-xs" />
                    ) : (
                      <div className="flex items-center gap-1">
                        <Select value="__none__" onValueChange={(value) => {
                          const category = categoryOptions.find((item: any) => item.id === value);
                          if (category) onRowUpdate(index, 'category', category.name);
                        }}>
                          <SelectTrigger className="h-8 min-w-0 flex-1 border-amber-500/60 text-xs text-amber-600"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{row.category ? `No existe: ${row.category}` : 'Seleccionar categoría'}</SelectItem>
                            {categoryOptions.length === 0 && <SelectItem value="__no_categories__" disabled>No hay registros</SelectItem>}
                            {categoryOptions.map((category: any) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {canCreateCategory && <Button type="button" variant="outline" size="sm" className="h-8 w-8 shrink-0 rounded-lg p-0 text-amber-600" title="Crear esta categoría" aria-label="Crear esta categoría" onClick={() => onCreateCategory(index, row.category || '')}><Plus className="size-3.5" /></Button>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="p-1"><Input value={row.unit ?? ''} onChange={(event) => onRowUpdate(index, 'unit', event.target.value)} className="h-8 text-right text-xs" /></TableCell>
                  <TableCell className="p-1"><Input type="number" min={0} value={row.prices?.RETAIL ?? ''} onChange={(event) => onRowUpdate(index, 'price.RETAIL', event.target.value)} className="h-8 text-right text-xs" /></TableCell>
                  <TableCell className="p-1"><Input type="number" min={0} value={row.prices?.WHOLESALE ?? ''} onChange={(event) => onRowUpdate(index, 'price.WHOLESALE', event.target.value)} className="h-8 text-right text-xs" /></TableCell>
                  <TableCell className="p-1"><Input type="number" min={0} value={row.prices?.DISTRIBUTOR ?? ''} onChange={(event) => onRowUpdate(index, 'price.DISTRIBUTOR', event.target.value)} className="h-8 text-right text-xs" /></TableCell>
                  {canViewInventoryCost && <TableCell className="p-1"><Input type="number" min={0} value={row.costPrice ?? ''} onChange={(event) => onRowUpdate(index, 'costPrice', event.target.value)} className="h-8 text-right text-xs" /></TableCell>}
                  <TableCell className="p-1"><Input type="number" min={0} value={row.initialStock ?? ''} onChange={(event) => onRowUpdate(index, 'initialStock', Number(event.target.value) || 0)} aria-label="Stock inicial" title="Edita el stock inicial antes de confirmar la importación" className="h-8 text-right text-xs" /></TableCell>
                  <TableCell className="p-1"><Input type="number" min={0} value={row.minStock} onChange={(event) => onRowUpdate(index, 'minStock', Number(event.target.value) || 0)} className="h-8 text-right text-xs" /></TableCell>
                  <TableCell className="p-1">
                    {!row.warehouse || warehouseOptions.some((warehouse: any) => warehouse.name?.toLowerCase() === String(row.warehouse || '').trim().toLowerCase()) ? (
                      <Select value={row.warehouse || '__none__'} onValueChange={(value) => onRowUpdate(index, 'warehouse', value === '__none__' ? '' : value)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar bodega" /></SelectTrigger>
                        <SelectContent><SelectItem value="__none__">Sin bodega</SelectItem>{warehouseOptions.length === 0 && <SelectItem value="__no_warehouses__" disabled>No hay bodegas</SelectItem>}{warehouseOptions.map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.name}>{warehouse.name}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Select value="__none__" onValueChange={(value) => onRowUpdate(index, 'warehouse', value === '__none__' ? '' : value)}>
                          <SelectTrigger className="h-8 min-w-0 flex-1 border-amber-500/60 text-xs text-amber-600"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="__none__">{`No existe: ${row.warehouse}`}</SelectItem>{warehouseOptions.length === 0 && <SelectItem value="__no_warehouses__" disabled>No hay bodegas</SelectItem>}{warehouseOptions.map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.name}>{warehouse.name}</SelectItem>)}</SelectContent>
                        </Select>
                        {canCreateWarehouse && <Button type="button" variant="outline" size="sm" className="h-8 w-8 shrink-0 rounded-lg p-0 text-amber-600" title="Crear esta bodega" aria-label="Crear esta bodega" onClick={() => onCreateWarehouse(index, row.warehouse || '')}><Plus className="size-3.5" /></Button>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="p-1 text-xs"><span className={row._hasError ? 'text-red-600' : row._hasWarning ? 'text-amber-600' : 'text-emerald-600'}>{row._errorMessage || row._warningMessage || 'Correcto'}</span></TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
      </HorizontalTableScroller>
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card p-3 sm:hidden" aria-label="Registros de productos para revisar">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 pb-3">
          <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Revisión móvil</p><p className="mt-1 text-xs text-muted-foreground">Edita un producto por tarjeta</p></div>
          <Badge variant="secondary" className="shrink-0 text-[10px]">{importData.length} registros</Badge>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pt-3 pr-1">
          {importData.length ? <div className="space-y-3">{previewRows.map((row, localIndex) => { const index = previewStart + localIndex; return <div key={index}>{renderMobileCard(row, index)}</div>; })}</div> : <div className="p-8 text-center text-sm text-muted-foreground">El archivo no contiene filas para importar.</div>}
        </div>
      </section>

      {importData.length > previewPageSize && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Mostrando {previewStart + 1}–{Math.min(previewStart + previewPageSize, importData.length)} de {importData.length} registros</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setPreviewPage((current) => Math.max(1, current - 1))} disabled={safePreviewPage === 1}>Anterior</Button>
            <span className="min-w-20 text-center font-semibold">Página {safePreviewPage} / {previewPageCount}</span>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setPreviewPage((current) => Math.min(previewPageCount, current + 1))} disabled={safePreviewPage === previewPageCount}>Siguiente</Button>
          </div>
        </div>
      )}

      {importing && <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${importProgress}%` }} /></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4">
        <Button variant="outline" onClick={onBack} disabled={importing}><ChevronLeft className="mr-2 size-4" />Volver a la carga</Button>
        <Button onClick={onConfirm} disabled={importing || validRows === 0} className="bg-primary font-bold text-primary-foreground">{importing ? `Importando... ${importProgress}%` : `Importar ${validRows} válidos · omitir ${errorRows}`}</Button>
      </div>
    </div>
  );
}

export function ProductosView({ products, summaryProducts, categories, warehouses = [], branches = [], series = [], movements = [], onRefresh, pagination, onSearchChange, onCategoryChange, onWarehouseChange, onUnitChange, onTaxRateChange, onStockStatusChange, itemType, isSidebarCollapsed = true, targetProductId, initialStockFilter, productStatusFilter: controlledProductStatusFilter, onProductStatusFilterChange, onClearTargetProduct, selectedBranchId = '', branchWarehouseIds = [], unitFilter: controlledUnitFilter, taxRateFilter: controlledTaxRateFilter, stockStatusFilter: controlledStockStatusFilter }: ProductosViewProps) {
  const { formatAmount, baseCurrency, exchangeRate } = useCurrency();
  const { user, canPerform } = useAuth();
  const canViewInventoryCost = canPerform('INVENTORY_PRODUCTS', 'viewCost');
  const branchWarehouseIdSet = useMemo(() => new Set(branchWarehouseIds), [branchWarehouseIds]);
  const [stockByProduct, setStockByProduct] = useState<Record<string, Record<string, number>>>({});
  const refreshStockMap = useCallback(async () => {
    try {
      const res: any = await inventoryService.getAllStock();
      const levels = Array.isArray(res) ? res : (res?.data || []);
      const map: Record<string, Record<string, number>> = {};
      for (const level of levels) {
        const productId = level.productId || level.product?.id;
        const warehouseId = level.warehouseId || level.warehouse?.id;
        if (!productId || !warehouseId) continue;
        if (!map[productId]) map[productId] = {};
        map[productId][warehouseId] = (map[productId][warehouseId] || 0) + Number(level.quantity || 0);
      }
      setStockByProduct(map);
    } catch (e) {
      console.error('Error al cargar stock de productos:', e);
    }
  }, []);
  useEffect(() => {
    void refreshStockMap();
  }, [products, refreshStockMap]);
  const catalogItemType = itemType || 'PRODUCT';
  const isServiceView = catalogItemType === 'SERVICE';
  const entityLabel = isServiceView ? 'servicio' : 'producto';
  const entityLabelCap = isServiceView ? 'Servicio' : 'Producto';
  const [importAddedCategories, setImportAddedCategories] = useState<any[]>([]);
  const [importAddedWarehouses, setImportAddedWarehouses] = useState<any[]>([]);
  const importCategoryOptions = useMemo(() => {
    const unique = new Map<string, any>();
    [...categories, ...importAddedCategories].forEach((category: any) => unique.set(category.id || category.name, category));
    return Array.from(unique.values());
  }, [categories, importAddedCategories]);
  const importWarehouseOptions = useMemo(() => {
    const unique = new Map<string, any>();
    [...warehouses, ...importAddedWarehouses].forEach((warehouse: any) => unique.set(warehouse.id || warehouse.name, warehouse));
    return Array.from(unique.values());
  }, [warehouses, importAddedWarehouses]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [warehouseFilters, setWarehouseFilters] = useState<string[]>([]);
  const [showAllWarehouseProducts, setShowAllWarehouseProducts] = useState(true);
  // Almacenes vinculados a alguna sucursal (todas las sucursales): se usa para
  // ocultar los productos de almacenes sin vínculo cuando el check está inactivo.
  const linkedWarehouseIds = useMemo(() => {
    const ids = new Set<string>();
    for (const branch of branches || []) {
      if (branch.warehouseId) ids.add(branch.warehouseId);
      for (const w of branch.warehouses || []) ids.add(w.id);
    }
    return ids;
  }, [branches]);
  const [stockFilter, setStockFilter] = useState<'all' | 'available' | 'low' | 'out'>(initialStockFilter || 'all');
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [warehouseDetail, setWarehouseDetail] = useState<any | null>(null);
  const [branchDetail, setBranchDetail] = useState<any | null>(null);
  const [localProductStatusFilter, setLocalProductStatusFilter] = useState<ProductStatusFilter>('ALL');
  const effectiveProductStatusFilter = controlledProductStatusFilter ?? localProductStatusFilter;
  const [localUnitFilter, setLocalUnitFilter] = useState('');
  const effectiveUnitFilter = controlledUnitFilter ?? localUnitFilter;
  const [localTaxRateFilter, setLocalTaxRateFilter] = useState('');
  const effectiveTaxRateFilter = controlledTaxRateFilter ?? localTaxRateFilter;
  const [localStockStatusFilter, setLocalStockStatusFilter] = useState('');
  const effectiveStockStatusFilter = controlledStockStatusFilter ?? localStockStatusFilter;
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [initialImportIntroOpen, setInitialImportIntroOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [imageArchiveFileName, setImageArchiveFileName] = useState('');
  const [imageArchiveEntries, setImageArchiveEntries] = useState<Map<string, File>>(new Map());
  const [importProcessing, setImportProcessing] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageArchiveInputRef = useRef<HTMLInputElement>(null);
  const [bulkImageModalOpen, setBulkImageModalOpen] = useState(false);
  const [bulkImageFileName, setBulkImageFileName] = useState('');
  const [bulkImageEntries, setBulkImageEntries] = useState<Map<string, File>>(new Map());
  const [bulkImageProducts, setBulkImageProducts] = useState<any[]>([]);
  const [bulkImageMissingSkus, setBulkImageMissingSkus] = useState<string[]>([]);
  const [bulkImageProcessing, setBulkImageProcessing] = useState(false);
  const [bulkImageUploading, setBulkImageUploading] = useState(false);
  const [bulkImageProgress, setBulkImageProgress] = useState(0);
  const [bulkImageResults, setBulkImageResults] = useState<{ updated: number; failed: string[] } | null>(null);
  const bulkImageInputRef = useRef<HTMLInputElement>(null);
  const [editingRows, setEditingRows] = useState<Map<string, EditingProduct>>(new Map());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [pendingStatusChange, setPendingStatusChange] = useState<any | null>(null);
  const [statusChanging, setStatusChanging] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [productDetail, setProductDetail] = useState<any | null>(null);
  const [expandedProductImage, setExpandedProductImage] = useState<{ src: string; alt: string } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [pendingCategoryRowIndex, setPendingCategoryRowIndex] = useState<number | null>(null);
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [newWarehouseLocation, setNewWarehouseLocation] = useState('');
  const [newWarehouseType, setNewWarehouseType] = useState('STORE');
  const [newWarehouseParentId, setNewWarehouseParentId] = useState('none');
  const [newWarehouseInventoryAccountId, setNewWarehouseInventoryAccountId] = useState('none');
  const [warehouseAccounts, setWarehouseAccounts] = useState<any[]>([]);
  const [warehouseAccountsLoading, setWarehouseAccountsLoading] = useState(false);
  const [creatingWarehouse, setCreatingWarehouse] = useState(false);
  const [pendingWarehouseRowIndex, setPendingWarehouseRowIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; skipped: number; failed: number; errors: string[] } | null>(null);
  const [initialImportCompleted, setInitialImportCompleted] = useState(false);
  const [importCurrency, setImportCurrency] = useState(baseCurrency === 'USD' ? 'USD' : 'NIO');
  const [importExchangeRate, setImportExchangeRate] = useState<number>(Number(exchangeRate || 1));
  const [initialImportConfirmOpen, setInitialImportConfirmOpen] = useState(false);
  const [initialImportConfirmText, setInitialImportConfirmText] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState<any | null>(null);
  const [variantManagerProduct, setVariantManagerProduct] = useState<any | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  
  const [skuErrors, setSkuErrors] = useState<Map<string, string>>(new Map());
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialStockFilter) setStockFilter(initialStockFilter);
  }, [initialStockFilter]);

  useEffect(() => {
    if (!targetProductId) return;
    const target = products.find((product: any) => product.id === targetProductId);
    if (!target) return;
    setHighlightedProductId(targetProductId);
    setProductDetail(target);
    onClearTargetProduct?.();
    const timeout = window.setTimeout(() => setHighlightedProductId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [targetProductId, products, onClearTargetProduct]);

  // ─── Solicitud de compra desde inventario ─────────────────────────────────────
  const [solicitudOpen, setSolicitudOpen] = useState(false);
  const [solicitudProducts, setSolicitudProducts] = useState<Array<{
    productId: string; productName: string; code: string;
    currentStock: number; minStock: number; quantity: number;
  }>>([]);
  const [solicitudWarehouseId, setSolicitudWarehouseId] = useState('');
  const [solicitudJustification, setSolicitudJustification] = useState('');
  const [solicitudRequiredDate, setSolicitudRequiredDate] = useState('');
  const [solicitudPriority, setSolicitudPriority] = useState('NORMAL');
  const [solicitudCreating, setSolicitudCreating] = useState(false);
  const [solicitudEmployees, setSolicitudEmployees] = useState<any[]>([]);
  const [solicitudEmployeeId, setSolicitudEmployeeId] = useState('');
  const [solicitudEmployeesLoading, setSolicitudEmployeesLoading] = useState(false);
  const [solicitudProductSearch, setSolicitudProductSearch] = useState('');
  const [solicitudCatalogProducts, setSolicitudCatalogProducts] = useState<any[]>([]);
  const [solicitudCatalogLoading, setSolicitudCatalogLoading] = useState(false);

  const loadSolicitudEmployees = async () => {
    if (solicitudEmployees.length > 0) return;
    setSolicitudEmployeesLoading(true);
    try {
      const res = await employeesService.getAll({ page: 1, pageSize: 200 });
      const list = Array.isArray(res) ? res : ((res as any)?.data || []);
      setSolicitudEmployees(list);
      const linked = list.find((e: any) => e.userId === user?.id);
      setSolicitudEmployeeId(linked?.id || '');
    } catch {
      setSolicitudEmployees([]);
    } finally {
      setSolicitudEmployeesLoading(false);
    }
  };

  useEffect(() => {
    if (!solicitudOpen) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSolicitudCatalogLoading(true);
      try {
        const response = await inventoryService.getProducts({
          type: 'PRODUCT',
          page: 1,
          pageSize: 200,
          search: solicitudProductSearch.trim() || undefined,
          includeInactive: false,
        }, controller.signal);
        if (controller.signal.aborted) return;
        const list = Array.isArray(response) ? response : ((response as any)?.data || []);
        setSolicitudCatalogProducts(list.filter((product: any) =>
          String(product.itemType || product.type || 'PRODUCT').toUpperCase() === 'PRODUCT',
        ));
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Error loading products for purchase request:', error);
        setSolicitudCatalogProducts(products.filter((product: any) =>
          String(product.itemType || product.type || 'PRODUCT').toUpperCase() === 'PRODUCT',
        ));
      } finally {
        if (!controller.signal.aborted) setSolicitudCatalogLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [products, solicitudOpen, solicitudProductSearch]);

  const buildSolicitudItems = (list: any[]) => list.map((p: any) => {
    const minStock = Number(p.minStock ?? 0);
    const currentStock = Number(p.stock ?? 0);
    const suggested = minStock > 0 ? minStock * 2 : 4;
    return {
      productId: p.id,
      productName: p.name,
      code: p.code ?? '',
      currentStock,
      minStock,
      quantity: Math.max(1, Math.ceil(suggested - currentStock)),
    };
  });

  const openLowStockSolicitud = () => {
    const lowStock = products.filter((p: any) =>
      String(p.itemType || p.type || 'PRODUCT').toUpperCase() === 'PRODUCT' &&
      Number(p.stock ?? 0) <= (Number(p.minStock ?? 0) > 0 ? Number(p.minStock) : 2),
    );
    loadSolicitudEmployees();
    setSolicitudProducts(buildSolicitudItems(lowStock));
    setSolicitudWarehouseId('');
    setSolicitudJustification('');
    setSolicitudRequiredDate('');
    setSolicitudPriority('NORMAL');
    setSolicitudProductSearch('');
    setSolicitudOpen(true);
  };

  const openSelectedSolicitud = () => {
    if (selectedIds.size === 0) { toast.error('Selecciona al menos un producto'); return; }
    loadSolicitudEmployees();
    const selected = products.filter((p: any) => selectedIds.has(p.id));
    setSolicitudProducts(buildSolicitudItems(selected));
    setSolicitudWarehouseId('');
    setSolicitudJustification('');
    setSolicitudRequiredDate('');
    setSolicitudPriority('NORMAL');
    setSolicitudProductSearch('');
    setSolicitudOpen(true);
  };

  const updateSolicitudQuantity = (productId: string, quantity: number) => {
    setSolicitudProducts(prev => prev.map(item => item.productId === productId
      ? { ...item, quantity: Math.max(1, Number.isFinite(quantity) ? quantity : 1) }
      : item));
  };

  const addSolicitudProduct = (product: any) => {
    const item = buildSolicitudItems([product])[0];
    if (!item) return;
    setSolicitudProducts(prev => prev.some(existing => existing.productId === item.productId)
      ? prev
      : [...prev, item]);
  };

  const removeSolicitudProduct = (productId: string) => {
    setSolicitudProducts(prev => prev.filter(item => item.productId !== productId));
  };

  const handleCreateSolicitud = async () => {
    if (solicitudProducts.length === 0) { toast.error('No hay productos en la solicitud'); return; }
    if (!solicitudWarehouseId) { toast.error('Selecciona una bodega'); return; }
    setSolicitudCreating(true);
    try {
      if (!solicitudEmployeeId) { setSolicitudCreating(false); toast.error('Selecciona el empleado solicitante'); return; }
      const items = solicitudProducts.map(item => ({
        productId: item.productId,
        description: item.productName,
        quantity: item.quantity,
        warehouseId: solicitudWarehouseId,
        currentStock: item.currentStock,
        minStock: item.minStock,
      }));
      await purchaseRequestsService.create({
        status: 'PENDING_APPROVAL',
        priority: solicitudPriority,
        justification: solicitudJustification || 'Solicitud generada desde inventario',
        warehouseId: solicitudWarehouseId,
        requiredDate: solicitudRequiredDate || undefined,
        requestedById: solicitudEmployeeId,
        userId: user?.id,
        items,
      } as any);
      toast.success(`Solicitud creada con ${items.length} producto(s). Revisa Compras > Solicitudes.`);
      setSolicitudOpen(false);
      setSelectedIds(new Set());
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'Error al crear solicitud');
    } finally {
      setSolicitudCreating(false);
    }
  };

  const validateSkuDebounced = (productId: string, code: string, isNew: boolean) => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await inventoryService.checkProductCode(code, isNew ? undefined : productId);
        const exists = response?.exists;
        setSkuErrors(prev => {
          const next = new Map(prev);
          if (exists) next.set(productId, 'Código duplicado');
          else next.delete(productId);
          return next;
        });
      } catch (e: any) {
        console.error('Error validating SKU', e);
      }
    }, 1000);
  };

  const newRowRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    if (isServiceView) return;
    const controller = new AbortController();
    inventoryService.getInitialImportStatus(controller.signal).then((status) => {
      setInitialImportCompleted(Boolean(status.completed));
    }).catch(() => undefined);
    return () => controller.abort();
  }, [isServiceView, products.length]);

  useEffect(() => {
    if (!warehouseModalOpen || warehouseAccounts.length > 0 || !canPerform('ACCOUNTING', 'view')) return;
    const controller = new AbortController();
    setWarehouseAccountsLoading(true);
    contabilidadService.getChartOfAccounts(false, controller.signal)
      .then((response: any) => setWarehouseAccounts(response?.data || response || []))
      .catch(() => setWarehouseAccounts([]))
      .finally(() => setWarehouseAccountsLoading(false));
    return () => controller.abort();
  }, [warehouseModalOpen, warehouseAccounts.length, canPerform]);


  // Reset page when filters change; keep selection so users can pick items and search freely
  useEffect(() => {
    setPage(1);
    pagination?.onPageChange(1);
  }, [searchTerm, warehouseFilters, stockFilter, availabilityFilter, effectiveProductStatusFilter, effectiveUnitFilter, effectiveTaxRateFilter, effectiveStockStatusFilter, showAllWarehouseProducts, catalogItemType]);

  // Stock visible según el filtro de sucursal: con sucursal seleccionada solo
  // suma el stock de los almacenes vinculados a esa sucursal; sin filtro (todas
  // las sucursales) muestra el stock total del producto. Prioriza el mapa real
  // de /inventory/stock (fresco tras transferencias) y cae a stockLevels o
  // product.stock si el listado no trae niveles.
  const getProductStock = (product: any) => {
    const perWarehouse = stockByProduct[product?.id];
    if (perWarehouse) {
      if (selectedBranchId) {
        let total = 0;
        for (const warehouseId of branchWarehouseIdSet) total += perWarehouse[warehouseId] || 0;
        return total;
      }
      return Object.values(perWarehouse).reduce((sum, quantity) => sum + quantity, 0);
    }
    const levels = Array.isArray(product.stockLevels) ? product.stockLevels : [];
    if (selectedBranchId) {
      return levels
        .filter((l: any) => branchWarehouseIdSet.has(l.warehouseId || l.warehouse?.id))
        .reduce((sum: number, l: any) => sum + Number(l.quantity || 0), 0);
    }
    if (levels.length > 0) {
      return Number(product.stock ?? levels.reduce((sum: number, l: any) => sum + Number(l.quantity || 0), 0));
    }
    return Number(product.stock || 0);
  };

  const filteredProducts = products.filter((p: any) => {
    const matchesSearch = !searchTerm || 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = true;
    const productWarehouseIds = [
      ...(Array.isArray(p.warehouseCatalogs) ? p.warehouseCatalogs.map((catalog: any) => catalog.warehouseId || catalog.warehouse?.id) : []),
      ...(Array.isArray(p.stockLevels) ? p.stockLevels.map((level: any) => level.warehouseId || level.warehouse?.id) : []),
      ...(Array.isArray(p.allocations) ? p.allocations.map((allocation: any) => allocation.warehouseId || allocation.warehouse?.id) : []),
    ].filter(Boolean);
    const matchesWarehouse = warehouseFilters.length === 0
      || warehouseFilters.some((warehouseId) => productWarehouseIds.includes(warehouseId));
    // Con el filtro de sucursal en "Todas las sucursales", el check controla si
    // también se muestran los productos de almacenes que no están vinculados a
    // ninguna sucursal. Los productos sin almacén asignado siempre se muestran.
    const matchesLinkedScope = selectedBranchId || showAllWarehouseProducts
      || productWarehouseIds.length === 0
      || productWarehouseIds.some((warehouseId) => linkedWarehouseIds.has(warehouseId));
    const pType = String(p.itemType || p.type || 'PRODUCT').toUpperCase();
    const matchesType = pType === catalogItemType;
    const stock = getProductStock(p);
    const pMinStock = Number(p.minStock || 0);
    const stockThreshold = pMinStock > 0 ? pMinStock : 10;
    const matchesStock = stockFilter === 'all'
      || (stockFilter === 'available' && pType === 'PRODUCT' && stock > stockThreshold)
      || (stockFilter === 'available' && pType === 'PRODUCT' && stockThreshold <= 0 && stock > 0)
      || (stockFilter === 'low' && pType === 'PRODUCT' && stock > 0 && stock <= stockThreshold)
      || (stockFilter === 'out' && pType === 'PRODUCT' && stock <= 0);
    const matchesStatus = isServiceView || effectiveProductStatusFilter === 'ALL'
      || (effectiveProductStatusFilter === 'ACTIVE' && p.isActive !== false)
      || (effectiveProductStatusFilter === 'INACTIVE' && p.isActive === false);
    const matchesAvailability = pType !== 'SERVICE' || availabilityFilter === 'all'
      || (availabilityFilter === 'available' && p.isActive !== false)
      || (availabilityFilter === 'unavailable' && p.isActive === false);
    const matchesUnit = !effectiveUnitFilter || (p.unit || p.details?.unit || '') === effectiveUnitFilter;
    const matchesTaxRate = !effectiveTaxRateFilter || String(p.taxRate ?? '') === effectiveTaxRateFilter;
    return matchesSearch && matchesCategory && matchesWarehouse && matchesLinkedScope && matchesType && matchesStock && matchesStatus && matchesAvailability && matchesUnit && matchesTaxRate;
      })
      .sort((a: any, b: any) => String(a.code || '').localeCompare(String(b.code || ''), 'es', { numeric: true, sensitivity: 'base' }));

  const colFilters = useColumnFilters();
  const filterGetters = {
    code: (p: any) => p.code || '',
    name: (p: any) => {
      const sort = colFilters.state.name?.sort;
      return sort === 'desc' ? (p.createdAt || p.createdDate || p.created_on ? new Date(p.createdAt || p.createdDate || p.created_on).getTime() : 0) : p.name || '';
    },
    category: (p: any) => p.category?.name || 'Sin categoría',
    stock: (p: any) => getProductStock(p),
  };
  const filteredData = colFilters.applyTo(filteredProducts, filterGetters);
  const categoryOptions = [...new Map(filteredProducts.map((p: any) => [p.category?.name || 'Sin categoría', p.category?.name || 'Sin categoría'])).entries()]
    .map(([, label]) => ({ value: label, label, count: filteredProducts.filter((p: any) => (p.category?.name || 'Sin categoría') === label).length }));

  const paginatedProducts = useMemo(() => {
    if (pagination) return filteredData;
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize, pagination]);

  const totalPages = pagination?.totalPages || Math.max(1, Math.ceil(filteredProducts.length / pageSize));

  const inventorySummary = useMemo(() => {
    // Los KPIs se calculan sobre el catálogo completo (summaryProducts) y no
    // sobre la página visible, para reflejar los totales reales.
    const source = summaryProducts && summaryProducts.length > 0 ? summaryProducts : products;
    const stockProducts = source.filter((product: any) => String(product.itemType || product.type || 'PRODUCT').toUpperCase() === catalogItemType);
    const isLow = (p: any) => {
      const stock = getProductStock(p);
      if (stock <= 0) return false;
      const minStock = Number(p.minStock || 0);
      return minStock > 0 ? stock <= minStock : stock < 10;
    };
    return {
      total: stockProducts.length,
      available: stockProducts.filter((p: any) => {
        if (catalogItemType === 'SERVICE') return true;
        const stock = getProductStock(p);
        if (stock <= 0) return false;
        const minStock = Number(p.minStock || 0);
        return minStock > 0 ? stock > minStock : stock >= 10;
      }).length,
      low: catalogItemType === 'SERVICE' ? 0 : stockProducts.filter(isLow).length,
      out: catalogItemType === 'SERVICE' ? 0 : stockProducts.filter((p: any) => getProductStock(p) <= 0).length,
    };
  }, [products, summaryProducts, catalogItemType, stockByProduct, selectedBranchId, branchWarehouseIdSet]);

  const serviceSummary = useMemo(() => {
    const source = summaryProducts && summaryProducts.length > 0 ? summaryProducts : products;
    const services = source.filter((product: any) => String(product.itemType || product.type || '').toUpperCase() === 'SERVICE');
    const categories = new Set(services.map((service: any) => service.categoryId || service.category?.id).filter(Boolean));
    const now = Date.now();
    const twelveWeeksAgo = now - (12 * 7 * 24 * 60 * 60 * 1000);
    const prices = services.map((service: any) => Number(service.salePrice ?? service.price ?? 0)).filter((price) => Number.isFinite(price));
    const createdInLastTwelveWeeks = services.filter((service: any) => {
      const createdAt = new Date(service.createdAt || service.createdDate || service.created_on || '').getTime();
      return Number.isFinite(createdAt) && createdAt >= twelveWeeksAgo && createdAt <= now;
    }).length;
    return {
      categories: categories.size,
      weeklyAverage: createdInLastTwelveWeeks / 12,
      averagePrice: prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0,
    };
  }, [products, summaryProducts]);

  // ─── Estadísticas por almacén y sucursal (stock real de /inventory/stock) ──
  const warehouseStockStats = useMemo(() => {
    const stats = new Map<string, { products: number; units: number }>();
    for (const productId of Object.keys(stockByProduct)) {
      const perWarehouse = stockByProduct[productId];
      for (const warehouseId of Object.keys(perWarehouse)) {
        const quantity = Number(perWarehouse[warehouseId] || 0);
        if (quantity <= 0) continue;
        const entry = stats.get(warehouseId) || { products: 0, units: 0 };
        entry.products += 1;
        entry.units += quantity;
        stats.set(warehouseId, entry);
      }
    }
    return stats;
  }, [stockByProduct]);

  const branchStockStats = useMemo(() => {
    const stats = new Map<string, { warehouses: number; products: number; units: number }>();
    for (const branch of branches || []) {
      const linked = ((branch.warehouses || []) as any[]).filter((w: any) => w.isActive !== false);
      const warehouseIds = [
        ...(linked.length === 0 && branch.warehouseId ? [branch.warehouseId] : []),
        ...linked.map((w: any) => w.id),
      ].filter(Boolean) as string[];
      const products = new Set<string>();
      let units = 0;
      for (const productId of Object.keys(stockByProduct)) {
        const perWarehouse = stockByProduct[productId];
        let branchUnits = 0;
        for (const warehouseId of warehouseIds) {
          branchUnits += Number(perWarehouse[warehouseId] || 0);
        }
        if (branchUnits > 0) {
          products.add(productId);
          units += branchUnits;
        }
      }
      stats.set(branch.id, { warehouses: warehouseIds.length, products: products.size, units });
    }
    return stats;
  }, [branches, stockByProduct]);

  const warehouseTypeLabel = (type: string) =>
    WAREHOUSE_TYPES.find((t) => t.value === type)?.label || type || 'Almacén';

  const branchesForWarehouse = (warehouseId: string) =>
    (branches || []).filter((branch: any) =>
      branch.warehouseId === warehouseId || ((branch.warehouses || []) as any[]).some((w: any) => w.id === warehouseId),
    ).map((branch: any) => branch.name);

  const warehouseNamesForBranch = (branch: any) =>
    [...new Set<string>([
      ...((branch.warehouses || []) as any[]).map((w: any) => warehouses.find((wh: any) => wh.id === w.id)?.name),
      ...(branch.warehouseId ? [warehouses.find((wh: any) => wh.id === branch.warehouseId)?.name] : []),
    ].filter(Boolean))];

  // Stock visible según el filtro de sucursal: con sucursal seleccionada solo
  // suma el stock de los almacenes vinculados a esa sucursal; sin filtro (todas
  // las sucursales) muestra el stock total del producto. Prioriza el mapa real
  // de /inventory/stock (fresco tras transferencias) y cae a stockLevels o
  // product.stock si el listado no trae niveles.
  const getStockStatus = (product: any) => {
    const stock = getProductStock(product);
    if (stock <= 0) return { label: 'Sin Stock', color: 'bg-red-500/10 text-red-500', icon: 'critical' };
    const minStock = Number(product.minStock || 0);
    if (minStock > 0 && stock <= minStock) return { label: 'Bajo', color: 'bg-orange-500/10 text-orange-500', icon: 'low' };
    if (stock < 10) return { label: 'Bajo', color: 'bg-orange-500/10 text-orange-500', icon: 'low' };
    return { label: 'OK', color: 'bg-green-500/10 text-green-500', icon: 'ok' };
  };

  const getProductMaxStock = (product: any) => {
    const levels = Array.isArray(product.stockLevels) ? product.stockLevels : [];
    const values = levels
      .map((level: any) => Number(level.maxStock || 0))
      .filter((value: number) => value > 0);
    return values.length > 0 ? Math.max(...values) : Number(product.maxStock || 0);
  };

  const getStockAlertColor = (product: any) => {
    const stock = getProductStock(product);
    if (stock <= 0) return 'text-red-500 font-bold';
    const minStock = Number(product.minStock || 0);
    if (minStock > 0 && stock <= minStock) return 'text-orange-500 font-bold';
    if (stock < 10) return 'text-orange-500';
    const maxStock = getProductMaxStock(product);
    if (maxStock > 0 && stock > maxStock) return 'text-blue-500';
    return 'text-foreground';
  };

  const handleAddRow = () => {
    const tempId = `new-${Date.now()}`;
    const newProduct: EditingProduct = {
      id: tempId,
      code: '',
      name: '',
      description: '',
      categoryId: categories[0]?.id || '',
      salePrice: '',
      priceCurrency: baseCurrency,
      priceExchangeRate: baseCurrency === 'NIO' ? 1 : 1,
      costPrice: '',
      unit: 'unidad',
      minStock: 0,
      maxStock: 0,
      trackSerialNumbers: false,
      itemType: catalogItemType,
      isNew: true,
      initialStock: 0,
      initialAllocations: warehouses.length > 0 ? [{ id: `alloc-${Date.now()}-0`, warehouseId: warehouses[0]?.id || '', quantity: 0, minStock: 0, maxStock: 0 }] : []
    };
    setEditingRows(new Map(editingRows).set(tempId, newProduct));
    setTimeout(() => newRowRef.current?.focus(), 100);
  };

  const handleEditRow = (product: any) => {
    const editProduct: EditingProduct = {
      id: product.id,
      code: product.code,
      name: product.name,
      description: product.description || '',
      categoryId: product.categoryId || '',
      salePrice: Number(product.salePrice) || 0,
      priceCurrency: product.priceCurrency || baseCurrency,
      priceExchangeRate: Number(product.priceExchangeRate || 1),
      costPrice: Number(product.costPrice) || 0,
      unit: product.unit || 'unidad',
      minStock: Number(product.minStock) || 0,
      maxStock: getProductMaxStock(product),
      trackSerialNumbers: Boolean(
        product.trackSerialNumbers ||
        product.serialTracking ||
        product.serialNumberTracking ||
        String(product.trackingType || '').toUpperCase() === 'SERIAL',
      ),
      itemType: String(product.itemType || product.type || 'PRODUCT').toUpperCase() as 'PRODUCT' | 'SERVICE',
      isActive: product.isActive !== false,
      imageUrl: product.imageUrl,
      imageStorageUri: product.imageUrlStorageUri || (String(product.imageUrl || '').startsWith('storage://') ? product.imageUrl : undefined),
      warehouseId: product.warehouseCatalogs?.[0]?.warehouseId || product.warehouseCatalogs?.[0]?.warehouse?.id,
      initialAllocations: String(product.itemType || product.type || 'PRODUCT').toUpperCase() === 'SERVICE'
        ? [{ id: `alloc-service-${Date.now()}`, warehouseId: product.warehouseCatalogs?.[0]?.warehouseId || product.warehouseCatalogs?.[0]?.warehouse?.id || '', quantity: 0, minStock: 0, maxStock: 0 }]
        : (product.stockLevels && product.stockLevels.length > 0)
        ? product.stockLevels.map((sl: any, idx: number) => ({
            id: `alloc-edit-${Date.now()}-${idx}`,
            warehouseId: sl.warehouseId,
            quantity: Number(sl.quantity) || 0,
            minStock: Number(sl.minStock || 0),
            maxStock: Number(sl.maxStock || 0),
          }))
        : [{ id: `alloc-edit-${Date.now()}-0`, warehouseId: '', quantity: 0, minStock: Number(product.minStock || 0), maxStock: getProductMaxStock(product) }]
    };
    setEditingRows(new Map(editingRows.set(product.id, editProduct)));
  };

  const handleCancelEdit = (id: string) => {
    const current = editingRows.get(id);
    if (current?.imagePreviewUrl) URL.revokeObjectURL(current.imagePreviewUrl);
    const newMap = new Map(editingRows);
    newMap.delete(id);
    setEditingRows(newMap);
  };

  const handleImageSelected = (id: string, file: File) => {
    const current = editingRows.get(id);
    if (!current) return;
    if (current.imagePreviewUrl) URL.revokeObjectURL(current.imagePreviewUrl);
    const previewUrl = URL.createObjectURL(file);
    const next = new Map(editingRows);
    next.set(id, { ...current, imageFile: file, imagePreviewUrl: previewUrl, removeImage: false });
    setEditingRows(next);
  };

  const handleImageRemoved = (id: string) => {
    const current = editingRows.get(id);
    if (!current) return;
    if (current.imagePreviewUrl) URL.revokeObjectURL(current.imagePreviewUrl);
    const next = new Map(editingRows);
    next.set(id, {
      ...current,
      imageFile: undefined,
      imagePreviewUrl: undefined,
      imageUrl: undefined,
      removeImage: true,
    });
    setEditingRows(next);
  };

  const handleUpdateField = (id: string, field: keyof EditingProduct, value: any) => {
    const current = editingRows.get(id);
    if (current) {
      let finalValue = value;
      // Keep an empty price as a valid editing draft so users can erase the
      // initial zero before typing a new amount. It is normalized on save.
      if (field === 'salePrice' || field === 'costPrice') {
        if (value === '') {
          finalValue = '';
        } else {
          const parsed = Number(value);
          finalValue = Number.isFinite(parsed) ? Math.max(0, parsed) : current[field];
        }
      } else if (field === 'initialStock' || field === 'minStock' || field === 'maxStock') {
        finalValue = Math.max(0, Number(value) || 0);
      }
      const nextProduct = { ...current, [field]: finalValue };
      if (field === 'minStock' || field === 'maxStock') {
        nextProduct.initialAllocations = (current.initialAllocations || []).map((item) => ({
          ...item,
          [field]: finalValue,
        }));
      }
      setEditingRows(new Map(editingRows.set(id, nextProduct)));
      
      if (field === 'code') {
        validateSkuDebounced(id, finalValue as string, !!current.isNew);
      }
    }
  };

  const updateInitialAllocation = (
    productId: string,
    allocationId: string,
    patch: Partial<{ warehouseId: string; quantity: number; minStock: number; maxStock: number }>,
  ) => {
    const product = editingRows.get(productId);
    if (!product) return;
    const nextAllocations = (product.initialAllocations || []).map((item) =>
      item.id === allocationId ? { ...item, ...patch } : item,
    );
    setEditingRows(new Map(editingRows.set(productId, { ...product, initialAllocations: nextAllocations })));
  };

  const addInitialAllocation = (productId: string) => {
    const product = editingRows.get(productId);
    if (!product) return;
    const next = [
      ...(product.initialAllocations || []),
      {
        id: `alloc-${Date.now()}-${(product.initialAllocations || []).length}`,
        warehouseId: '',
        quantity: 0,
        minStock: Number(product.minStock || 0),
        maxStock: Number(product.maxStock || 0),
      },
    ];
    setEditingRows(new Map(editingRows.set(productId, { ...product, initialAllocations: next })));
  };

  const handleSaveRow = async (id: string) => {
    const product = editingRows.get(id);
    if (!product) return;

    if (skuErrors.get(id)) {
      toast.error('Corrige el error en el código antes de guardar');
      return;
    }

    if (!product.name || !product.code) {
      toast.error('Nombre y código son requeridos');
      return;
    }

    const validAllocations = product.isNew
      ? (product.initialAllocations || []).filter((item) =>
          item.warehouseId
          && (Number(item.quantity || 0) > 0 || Number(item.minStock || 0) > 0 || Number(item.maxStock || 0) > 0),
        )
      : [];
    const serviceWarehouseId = product.initialAllocations?.find((item) => item.warehouseId)?.warehouseId || product.warehouseId;
    if (product.itemType === 'SERVICE' && !serviceWarehouseId) {
      toast.error('Selecciona el almacén vinculado al servicio');
      return;
    }
    const uniqueWarehouses = new Set(validAllocations.map((item) => item.warehouseId));

    if (validAllocations.length > 0 && warehouses.length === 0) {
      toast.error('No hay bodegas registradas para asignar stock inicial');
      return;
    }
    if (validAllocations.length > 0 && uniqueWarehouses.size !== validAllocations.length) {
      toast.error('No repitas la misma bodega en la distribución inicial');
      return;
    }
    const invalidMax = (product.initialAllocations || []).some((item) =>
      Number(item.maxStock || 0) > 0 && Number(item.maxStock || 0) < Number(item.minStock || 0),
    );
    if (invalidMax) {
      toast.error('El máximo de inventario no puede ser menor que el mínimo');
      return;
    }

    setSavingIds((current) => new Set(current).add(id));
    let uploadedImageUri: string | undefined;
    try {
      if (product.imageFile) {
        try {
          const uploaded = await storageService.uploadFile('product-image', product.imageFile, {
            folder: product.isNew ? 'catalog' : product.id,
          });
          uploadedImageUri = uploaded.uri;
        } catch (e) {
          // Si el almacenamiento falla (p. ej. sin permiso DOCUMENTS), el
          // producto se guarda igual sin la imagen y se avisa al usuario.
          console.error('No se pudo subir la imagen del producto:', e);
          toast.warning('El producto se guardará sin imagen: no se pudo subir la imagen (verifica el permiso de Documentos/almacenamiento).');
        }
      }
      const nextImageUrl = uploadedImageUri ?? (product.removeImage ? null : product.imageStorageUri);

      if (product.isNew) {
        const createdResponse = await inventoryService.createProduct({
          code: product.code,
          name: product.name,
          description: product.description || '',
          categoryId: product.categoryId,
          salePrice: Number(product.salePrice || 0) * (product.priceCurrency === baseCurrency ? 1 : product.priceCurrency === 'USD' ? 1 / exchangeRate : exchangeRate),
          salePriceOriginal: Number(product.salePrice || 0),
          priceCurrency: product.priceCurrency || baseCurrency,
          priceExchangeRate: Number(product.priceExchangeRate || 1),
           ...(canViewInventoryCost ? { costPrice: Number(product.costPrice || 0) } : {}),
          unit: product.unit || 'unidad',
          minStock: Number(product.minStock || 0),
          trackSerialNumbers: Boolean(product.trackSerialNumbers),
          type: product.itemType || catalogItemType,
          itemType: product.itemType || 'PRODUCT',
          warehouseId: product.itemType === 'SERVICE' ? serviceWarehouseId : undefined,
          initialStock: 0,
          imageUrl: nextImageUrl || undefined,
        } as any);
        const created = (createdResponse as any)?.data || createdResponse;
        const createdId = created?.id;
        if (validAllocations.length > 0 && createdId) {
          try {
            const productDetailResp = await inventoryService.getProduct(createdId);
            const fullProduct = (productDetailResp as any)?.data || productDetailResp;
            const variantId = fullProduct?.variants?.[0]?.id;

            if (variantId) {
              await Promise.all(
                validAllocations.map(async (item) => {
                  await inventoryService.updateStockLevel({
                    productId: createdId,
                    warehouseId: item.warehouseId,
                    variantId: variantId,
                    quantity: Number(item.quantity || 0),
                    minStock: Number(item.minStock ?? product.minStock ?? 0),
                    maxStock: Number(item.maxStock ?? product.maxStock ?? 0) || undefined,
                  });

                  if (Number(item.quantity || 0) > 0) {
                    await inventoryService.createMovement({
                      productId: createdId,
                      warehouseId: item.warehouseId,
                      variantId: variantId,
                      type: 'IN',
                      quantity: Number(item.quantity || 0),
                      reference: `STOCK-INICIAL-${created.code || createdId}`,
                    });
                  }
                })
              );
            }
          } catch (err: any) {
            console.error('Error allocating initial stock', err);
            toast.error(err?.response?.data?.message || err?.message || `${entityLabelCap} creado, pero hubo un error al asignar el stock`);
          }
        }
        toast.success(`${entityLabelCap} creado`);
      } else {
        await inventoryService.updateProduct(id, {
          code: product.code,
          name: product.name,
          description: product.description || '',
          categoryId: product.categoryId,
          salePrice: Number(product.salePrice || 0) * (product.priceCurrency === baseCurrency ? 1 : product.priceCurrency === 'USD' ? 1 / exchangeRate : exchangeRate),
          salePriceOriginal: Number(product.salePrice || 0),
          priceCurrency: product.priceCurrency || baseCurrency,
          priceExchangeRate: Number(product.priceExchangeRate || 1),
           ...(canViewInventoryCost ? { costPrice: Number(product.costPrice || 0) } : {}),
          unit: product.unit || 'unidad',
          minStock: Number(product.minStock || 0),
          trackSerialNumbers: Boolean(product.trackSerialNumbers),
          type: product.itemType || catalogItemType,
          itemType: product.itemType || 'PRODUCT',
          isActive: product.isActive,
          warehouseId: product.itemType === 'SERVICE' ? serviceWarehouseId : undefined,
          imageUrl: nextImageUrl,
        } as any);

        const originalProduct = products.find(p => p.id === id);
        const variantId = originalProduct?.variants?.[0]?.id;
        if (product.itemType !== 'SERVICE' && variantId && product.initialAllocations) {
          const allocations = product.initialAllocations.filter(item => item.warehouseId);
          await Promise.all(
            allocations.map(async (item) => {
              const originalAlloc = originalProduct?.stockLevels?.find((sl: any) => sl.warehouseId === item.warehouseId);
              const oldQuantity = Number(originalAlloc?.quantity || 0);
              const newQuantity = Number(item.quantity || 0);
              const oldMinStock = Number(originalAlloc?.minStock || 0);
              const oldMaxStock = Number(originalAlloc?.maxStock || 0);
              const newMinStock = Number(item.minStock ?? product.minStock ?? 0);
              const newMaxStock = Number(item.maxStock ?? product.maxStock ?? 0);

              if (oldQuantity !== newQuantity || oldMinStock !== newMinStock || oldMaxStock !== newMaxStock) {
                await inventoryService.updateStockLevel({
                  productId: id,
                  warehouseId: item.warehouseId,
                  variantId: variantId,
                  quantity: newQuantity,
                  minStock: newMinStock,
                  maxStock: newMaxStock || undefined,
                });
                const diff = newQuantity - oldQuantity;
                if (diff !== 0) {
                  await inventoryService.createMovement({
                    productId: id,
                    warehouseId: item.warehouseId,
                    variantId: variantId,
                    type: diff > 0 ? 'IN' : 'OUT',
                    quantity: Math.abs(diff),
                    reference: `AJUSTE-EDICION-${product.code || id}`,
                  });
                }
              }
            })
          );
        }

        toast.success(`${entityLabelCap} actualizado`);
      }
      if (!product.isNew && product.imageStorageUri && product.imageStorageUri !== uploadedImageUri && (uploadedImageUri || product.removeImage)) {
        storageService.deleteFile(product.imageStorageUri).catch((error) => {
          console.warn('No se pudo eliminar la imagen anterior del producto', error);
        });
      }
      handleCancelEdit(id);
      onRefresh();
    } catch (e: any) {
      if (uploadedImageUri) storageService.deleteFile(uploadedImageUri).catch(() => undefined);
      toast.error(e.message || 'Error al guardar');
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const handleToggleProductStatus = (product: any) => {
    setPendingStatusChange(product);
  };

  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const handleDuplicateProduct = async (product: any) => {
    setDuplicatingId(product.id);
    try {
      await inventoryService.duplicateProduct(product.id);
      toast.success(`"${product.name}" duplicado como copia`);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo duplicar el producto');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!pendingStatusChange) return;
    const nextIsActive = pendingStatusChange.isActive === false;
    setStatusChanging(true);
    try {
      await inventoryService.updateProductStatus(pendingStatusChange.id, nextIsActive);
      toast.success(nextIsActive ? `${entityLabelCap} activado` : `${entityLabelCap} inactivado`);
      setPendingStatusChange(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo actualizar el estado');
    } finally {
      setStatusChanging(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return toast.error('El nombre de la categoría es requerido');
    setCreatingCategory(true);
    try {
      const response = await inventoryService.createCategory({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || undefined,
        type: catalogItemType,
      });
      const created = ((response as any)?.data || response || {}) as any;
      const createdCategory = {
        ...created,
        id: created.id || `import-category-${Date.now()}`,
        name: created.name || newCategoryName.trim(),
        type: created.type || catalogItemType,
      };
      setImportAddedCategories((current) => [...current.filter((item) => item.id !== createdCategory.id), createdCategory]);
      if (pendingCategoryRowIndex !== null) {
        setImportData((current) => {
          const next = [...current];
          next[pendingCategoryRowIndex] = { ...next[pendingCategoryRowIndex], category: createdCategory.name, categoryId: createdCategory.id };
          return validateImportRows(next, imageArchiveEntries, imageArchiveFileName, [...importCategoryOptions, createdCategory], importWarehouseOptions);
        });
      }
      toast.success('Categoría creada');
      setCategoryModalOpen(false);
      setNewCategoryName('');
      setNewCategoryDescription('');
      setPendingCategoryRowIndex(null);
      onRefresh();
    } catch (error: any) {
      toast.error(error?.message || 'Error al crear categoría');
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleCreateWarehouse = async () => {
    if (!newWarehouseName.trim()) return toast.error('El nombre del almacén es requerido');
    setCreatingWarehouse(true);
    try {
      const response = await inventoryService.createWarehouse({
        name: newWarehouseName.trim(),
        location: newWarehouseLocation.trim(),
        type: newWarehouseType,
        parentId: newWarehouseParentId === 'none' ? null : newWarehouseParentId,
        inventoryAccountId: newWarehouseInventoryAccountId === 'none' ? null : newWarehouseInventoryAccountId,
      } as any);
      const created = ((response as any)?.data || response || {}) as any;
      const createdWarehouse = {
        ...created,
        id: created.id || `import-warehouse-${Date.now()}`,
        name: created.name || newWarehouseName.trim(),
        location: created.location || newWarehouseLocation.trim(),
        type: created.type || newWarehouseType,
        parentId: created.parentId ?? (newWarehouseParentId === 'none' ? null : newWarehouseParentId),
        inventoryAccountId: created.inventoryAccountId ?? (newWarehouseInventoryAccountId === 'none' ? null : newWarehouseInventoryAccountId),
      };
      setImportAddedWarehouses((current) => [...current.filter((item) => item.id !== createdWarehouse.id), createdWarehouse]);
      if (pendingWarehouseRowIndex !== null) {
        setImportData((current) => {
          const next = [...current];
          next[pendingWarehouseRowIndex] = { ...next[pendingWarehouseRowIndex], warehouse: createdWarehouse.name, warehouseId: createdWarehouse.id };
          return validateImportRows(next, imageArchiveEntries, imageArchiveFileName, importCategoryOptions, [...importWarehouseOptions, createdWarehouse]);
        });
      }
      toast.success('Almacén creado');
      setWarehouseModalOpen(false);
      setNewWarehouseName('');
      setNewWarehouseLocation('');
      setNewWarehouseType('STORE');
      setNewWarehouseParentId('none');
      setNewWarehouseInventoryAccountId('none');
      setPendingWarehouseRowIndex(null);
      onRefresh();
    } catch (error: any) { toast.error(error?.message || 'Error al crear almacén'); }
    finally { setCreatingWarehouse(false); }
  };

  const handlePriceCurrencyChange = (id: string, currency: string) => {
    const current = editingRows.get(id);
    if (!current) return;
    const next = new Map(editingRows);
    next.set(id, { ...current, priceCurrency: currency, priceExchangeRate: currency === baseCurrency ? 1 : Number(exchangeRate || 1) });
    setEditingRows(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRow(id);
    } else if (e.key === 'Escape') {
      handleCancelEdit(id);
    }
  };

  const renderEditableRow = (product: EditingProduct) => {
    const isSaving = savingIds.has(product.id);
    return (
      <TableRow key={product.id} className="bg-blue-500/5">
        <TableCell className="align-top pt-3" style={{ width: PRODUCT_TABLE_WIDTHS.selector, minWidth: PRODUCT_TABLE_WIDTHS.selector }}>
          <button type="button" onClick={(e) => { e.stopPropagation(); toggleSelect(product.id); }} className="flex items-center justify-center size-7 rounded-md hover:bg-muted/60">
            {selectedIds.has(product.id)
              ? <SquareCheckBig className="size-4 text-primary" />
              : <Square className="size-4 text-muted-foreground" />
            }
          </button>
        </TableCell>
        <TableCell className="align-top pt-3" style={{ width: PRODUCT_TABLE_WIDTHS.code, minWidth: PRODUCT_TABLE_WIDTHS.code }}>
          <div className="flex flex-col gap-1 w-full min-w-[90px]">
            <Input
              ref={product.isNew ? newRowRef : undefined}
              value={product.code}
              onChange={(e) => handleUpdateField(product.id, 'code', e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, product.id)}
              className={`h-8 text-xs font-mono w-full ${skuErrors.get(product.id) ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              disabled={isSaving}
            />
            {skuErrors.get(product.id) && (
              <span className="text-[9px] text-red-500 font-bold uppercase tracking-wider leading-tight">{skuErrors.get(product.id)}</span>
            )}
          </div>
        </TableCell>
        <TableCell className="align-top pt-3" style={{ width: PRODUCT_TABLE_WIDTHS.name, minWidth: PRODUCT_TABLE_WIDTHS.name }}>
          <div className="flex min-w-0 w-full items-start gap-2">
            <ProductImagePicker
              size="sm"
              src={product.imagePreviewUrl || product.imageUrl}
              productName={product.name}
              disabled={isSaving}
              onSelect={(file) => handleImageSelected(product.id, file)}
              onRemove={() => handleImageRemoved(product.id)}
            />
            <div className="min-w-0 flex-1 space-y-1.5 mt-0.5">
              <Input
                value={product.name}
                onChange={(e) => handleUpdateField(product.id, 'name', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, product.id)}
                placeholder="Nombre"
                className="h-8 w-full min-w-0 text-xs"
                disabled={isSaving}
              />
              <Input
                value={product.description || ''}
                onChange={(e) => handleUpdateField(product.id, 'description', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, product.id)}
                placeholder="Descripción"
                className="h-8 w-full min-w-0 text-xs"
                disabled={isSaving}
              />
              {!isServiceView && <Button
                type="button"
                variant={product.trackSerialNumbers ? 'default' : 'outline'}
                size="sm"
                className={`h-5 text-[8px] uppercase tracking-wider px-1.5 w-full ${product.trackSerialNumbers ? 'bg-primary text-primary-foreground' : ''}`}
                onClick={() => handleUpdateField(product.id, 'trackSerialNumbers', !product.trackSerialNumbers)}
                disabled={isSaving}
              >
                IMEI {product.trackSerialNumbers ? 'Activo' : 'Inactivo'}
              </Button>}
            </div>
          </div>
        </TableCell>
        <TableCell className="align-top pt-3" style={{ width: PRODUCT_TABLE_WIDTHS.category, minWidth: PRODUCT_TABLE_WIDTHS.category }}>
          <div className="space-y-1.5 min-w-0">
            <Select 
              value={product.categoryId} 
              onValueChange={(v) => handleUpdateField(product.id, 'categoryId', v)}
              disabled={isSaving}
            >
              <SelectTrigger className="h-8 w-full min-w-0 text-xs">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[9px] uppercase tracking-wider text-muted-foreground hover:text-primary px-2"
              onClick={() => { setPendingCategoryRowIndex(null); setCategoryModalOpen(true); }}
                disabled={isSaving}
              >
                <Plus className="size-3 mr-1" />
                Categoría
              </Button>
            </div>
          </div>
        </TableCell>
        {!isServiceView && <TableCell className="align-top pt-3" style={{ width: PRODUCT_TABLE_WIDTHS.unit, minWidth: PRODUCT_TABLE_WIDTHS.unit }}>
          <Select 
            value={product.unit || 'unidad'} 
            onValueChange={(v) => handleUpdateField(product.id, 'unit', v)}
            disabled={isSaving}
          >
            <SelectTrigger className="h-8 w-full min-w-0 text-xs">
              <SelectValue placeholder="Unidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unidad">Unidad</SelectItem>
              <SelectItem value="kilo">Kilo</SelectItem>
              <SelectItem value="libra">Libra</SelectItem>
              <SelectItem value="docena">Docena</SelectItem>
              <SelectItem value="caja">Caja</SelectItem>
              <SelectItem value="litro">Litro</SelectItem>
              <SelectItem value="metro">Metro</SelectItem>
              <SelectItem value="par">Par</SelectItem>
              <SelectItem value="rollo">Rollo</SelectItem>
              <SelectItem value="pieza">Pieza</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>}
        {!isServiceView && <TableCell className="align-top pt-3" style={{ width: PRODUCT_TABLE_WIDTHS.min, minWidth: PRODUCT_TABLE_WIDTHS.min }}>
          <Input
            type="number"
            min={0}
            value={product.minStock ?? 0}
            onChange={(e) => handleUpdateField(product.id, 'minStock', Math.max(0, Number(e.target.value) || 0))}
            onKeyDown={(e) => handleKeyDown(e, product.id)}
            className="h-8 min-w-0 w-full text-right text-xs"
            disabled={isSaving}
          />
        </TableCell>}
        {!isServiceView && <TableCell className="align-top pt-3" style={{ width: PRODUCT_TABLE_WIDTHS.max, minWidth: PRODUCT_TABLE_WIDTHS.max }}>
          <Input
            type="number"
            min={0}
            value={product.maxStock ?? 0}
            onFocus={(e) => e.target.select()}
            onChange={(e) => handleUpdateField(product.id, 'maxStock', Math.max(0, Number(e.target.value) || 0))}
            onKeyDown={(e) => handleKeyDown(e, product.id)}
            className="h-8 min-w-0 w-full text-right text-xs"
            disabled={isSaving}
          />
        </TableCell>}
        {isServiceView && <TableCell className="align-top pt-3" style={{ width: PRODUCT_TABLE_WIDTHS.warehouse, minWidth: PRODUCT_TABLE_WIDTHS.warehouse }}>
          <Select
            value={product.initialAllocations?.[0]?.warehouseId || ''}
            onValueChange={(v) => {
              const alloc = product.initialAllocations?.[0];
              if (alloc) updateInitialAllocation(product.id, alloc.id, { warehouseId: v });
              else handleUpdateField(product.id, 'warehouseId', v);
            }}
            disabled={isSaving}
          >
            <SelectTrigger className="h-8 w-full text-xs"><SelectValue placeholder="Almacén..." /></SelectTrigger>
            <SelectContent>
              {warehouses.map((w: any) => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>}
        {isServiceView && <TableCell className="align-top pt-3" style={{ width: PRODUCT_TABLE_WIDTHS.status, minWidth: PRODUCT_TABLE_WIDTHS.status }}>
          <Select
            value={product.isActive === false ? 'false' : 'true'}
            onValueChange={(v) => handleUpdateField(product.id, 'isActive', v === 'true')}
            disabled={isSaving}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Disponible</SelectItem>
              <SelectItem value="false">No disponible</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>}
        {!isServiceView && <TableCell className="align-top pt-3" style={{ width: PRODUCT_TABLE_WIDTHS.warehouse, minWidth: PRODUCT_TABLE_WIDTHS.warehouse }}>
          {(() => {
            const allocations = product.initialAllocations || [];
            return (
              <div className="space-y-1.5 min-w-0">
                {allocations.map((alloc) => (
                  <div key={alloc.id} className="h-8 flex items-center">
                    <Select
                      value={alloc.warehouseId || ''}
                      onValueChange={(v) => updateInitialAllocation(product.id, alloc.id, { warehouseId: v })}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="h-8 w-full min-w-0 bg-muted/30 text-xs px-2 truncate [&>span]:truncate">
                        <SelectValue placeholder="Bodega..." />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w: any) => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-1 rounded-lg bg-muted/30 px-2 py-1">
                  {allocations
                    .map((alloc) => warehouses.find((warehouse: any) => warehouse.id === alloc.warehouseId)?.name)
                    .filter(Boolean)
                    .map((warehouseName, index) => (
                      <Badge key={`${warehouseName}-${index}`} variant="secondary" className="max-w-full truncate text-[9px] bg-muted/50 font-medium">
                        {warehouseName}
                      </Badge>
                    ))}
                  {!allocations.some((alloc) => warehouses.some((warehouse: any) => warehouse.id === alloc.warehouseId)) && (
                    <span className="text-[10px] text-muted-foreground">-</span>
                  )}
                </div>
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[9px] uppercase tracking-wider text-muted-foreground hover:text-primary px-2"
                    onClick={() => addInitialAllocation(product.id)}
                    disabled={isSaving}
                  >
                    <Plus className="size-3 mr-1" />
                    Bodega
                  </Button>
                </div>
              </div>
            );
          })()}
        </TableCell>}
        {!isServiceView && <TableCell className="align-top pt-3 text-right" style={{ width: PRODUCT_TABLE_WIDTHS.stock, minWidth: PRODUCT_TABLE_WIDTHS.stock }}>
          {(() => {
            const allocations = product.initialAllocations || [];
            const totalAllocated = allocations.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
            return (
              <div className="space-y-1.5 min-w-0">
                {allocations.map((alloc) => (
                  <div key={alloc.id} className="h-8 flex items-center justify-end bg-muted/30 rounded-lg px-2">
                    <Input
                      type="number"
                      min={0}
                      value={alloc.quantity}
                      disabled
                      aria-label="Stock no editable"
                      title="El stock se administra mediante movimientos y ajustes de inventario"
                      className="h-8 text-xs text-right w-full cursor-not-allowed border-none bg-transparent opacity-60 shadow-none"
                      placeholder="0"
                    />
                  </div>
                ))}
                <div className="pt-1 flex justify-end">
                  <Badge className={`text-[10px] tabular-nums h-6 flex items-center ${totalAllocated > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted/20 text-muted-foreground'}`}>
                    Total: {totalAllocated}
                  </Badge>
                </div>
              </div>
            );
          })()}
        </TableCell>}
        {isServiceView && <TableCell className="align-top pt-3" style={{ width: PRODUCT_TABLE_WIDTHS.price, minWidth: PRODUCT_TABLE_WIDTHS.price }}>
          <div className="space-y-1">
            <div className="flex gap-1">
              <Select value={product.priceCurrency || baseCurrency} onValueChange={(value) => handlePriceCurrencyChange(product.id, value)} disabled={isSaving}>
                <SelectTrigger className="h-8 w-20 min-w-0 px-2 text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="NIO">NIO</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                step="any"
                value={product.salePrice}
                onChange={(e) => handleUpdateField(product.id, 'salePrice', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, product.id)}
                className="h-8 min-w-0 flex-1 text-right text-xs"
                disabled={isSaving}
              />
            </div>
            <span className="block text-[9px] text-muted-foreground">Tasa: {product.priceCurrency === baseCurrency ? '1.00' : Number(exchangeRate || 1).toFixed(4)}</span>
          </div>
        </TableCell>}
        {!isServiceView && canViewInventoryCost && <TableCell className="align-top pt-3" style={{ width: PRODUCT_TABLE_WIDTHS.cost, minWidth: PRODUCT_TABLE_WIDTHS.cost }}>
          <Input
            type="number"
            min={0}
            step="any"
            value={product.costPrice}
            onChange={(e) => handleUpdateField(product.id, 'costPrice', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, product.id)}
            className="h-8 min-w-0 w-full text-right text-xs"
            disabled={isSaving}
          />
        </TableCell>}
        <TableCell className="text-right align-top pt-3" style={{ width: PRODUCT_TABLE_WIDTHS.actions, minWidth: PRODUCT_TABLE_WIDTHS.actions }}>
          <div className="flex items-center justify-end gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="size-7 text-green-600 hover:text-green-700 hover:bg-green-500/10"
              onClick={() => handleSaveRow(product.id)}
              disabled={isSaving || !!skuErrors.get(product.id)}
            >
              {isSaving ? <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Check className="size-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="size-7 text-red-600 hover:text-red-700 hover:bg-red-500/10"
              onClick={() => handleCancelEdit(product.id)}
              disabled={isSaving}
            >
              <X className="size-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // ==================== SELECTION ====================
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedProducts.length && paginatedProducts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedProducts.map((p: any) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // ==================== EXCEL IMPORT ====================
  const handleDownloadTemplate = useCallback(() => {
    const headers = ['Código / SKU', 'Nombre', 'Categoría', 'Unidad', 'Precio Minorista', 'Precio Mayorista', 'Precio Distribuidor', 'Stock inicial', 'Stock mínimo', 'Bodega'];
    if (canViewInventoryCost) headers.splice(7, 0, 'Costo');
    const sampleRow: any[] = ['SKU-001', 'Ejemplo producto', categories[0]?.name || 'Categoría', '', 150, 140, 130, 0, 0, warehouses[0]?.name || ''];
    if (canViewInventoryCost) sampleRow.splice(7, 0, 100);
    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      sampleRow,
    ]);
    ws['!cols'] = headers.map((header) => ({ wch: Math.max(12, Math.min(28, header.length + 2)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    const guide = XLSX.utils.aoa_to_sheet([
      ['GUÍA DE LLENADO · IMPORTACIÓN INICIAL DE INVENTARIO'],
      ['La importación inicial se puede ejecutar una sola vez por sucursal. Revisa y corrige la previsualización antes de cargar.'],
      ['Campo', 'Regla'],
      ['Código / SKU', 'Obligatorio y único dentro de la empresa. La carga inicial del catálogo es única por empresa.'],
      ['Nombre', 'Obligatorio. En Productos solo se podrá editar nombre, SKU e imagen posteriormente.'],
      ['Categoría', 'Debe coincidir con una categoría existente de productos; durante la previsualización puedes elegir otra o crearla.'],
      ['Bodega', 'Obligatoria únicamente si Stock inicial es mayor que cero. Debe ser una bodega activa de la sucursal.'],
      ...(canViewInventoryCost ? [['Costo', 'Costo unitario de referencia para valoración de inventario.']] : []),
      ['Precio Minorista / Mayorista / Distribuidor', 'Incluye las tres listas predeterminadas. Puedes dejar una o dos vacías, pero cada producto debe tener al menos un precio de venta. Las celdas vacías se mostrarán como advertencias y no impedirán la carga.'],
    ]);
    guide['!cols'] = [{ wch: 36 }, { wch: 110 }];
    XLSX.utils.book_append_sheet(wb, guide, 'Guía de llenado');
    XLSX.writeFile(wb, 'plantilla_importacion_inicial_inventario.xlsx');
    toast.success('Plantilla descargada');
  }, [categories, warehouses, canViewInventoryCost]);

  const handleDownloadImportErrors = useCallback(() => {
    const errors = importData.filter((row) => row._hasError || row._hasWarning).map((row) => ({
      'Código / SKU': row.code || '', Nombre: row.name || '', Categoría: row.category || '', Bodega: row.warehouse || '',
      ...(canViewInventoryCost ? { Costo: row.costPrice ?? '' } : {}),
      Minorista: row.prices?.RETAIL ?? '', Mayorista: row.prices?.WHOLESALE ?? '', Distribuidor: row.prices?.DISTRIBUTOR ?? '',
      Clasificación: row._hasError ? 'Error' : 'Advertencia', Detalle: row._errorMessage || row._warningMessage || 'Revisar fila',
    }));
    if (!errors.length) return;
    const ws = XLSX.utils.json_to_sheet(errors); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Incidencias'); XLSX.writeFile(wb, 'incidencias_importacion_inicial.xlsx');
    toast.success('Reporte de incidencias descargado');
  }, [importData, canViewInventoryCost]);

  const validateImportRows = useCallback((rows: any[], entries = imageArchiveEntries, archiveName = imageArchiveFileName, categoryOptions = importCategoryOptions, warehouseOptions = importWarehouseOptions) => {
    const codeCounts = new Map<string, number>();
    rows.forEach((row) => {
      const code = String(row.code || '').trim().toLowerCase();
      if (code) codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
    });
    return rows.map((row) => {
      const code = String(row.code || '').trim();
      const categoryOk = categoryOptions.some((c: any) => c.name?.toLowerCase() === String(row.category || '').trim().toLowerCase());
      const cost = row.costPrice === '' || row.costPrice === undefined || row.costPrice === null ? undefined : Number(row.costPrice);
      const prices = row.prices || {};
      const priceEntries = [
        ['Minorista', prices.RETAIL],
        ['Mayorista', prices.WHOLESALE],
        ['Distribuidor', prices.DISTRIBUTOR],
      ] as const;
      const suppliedPrices = priceEntries.filter(([, value]) => value !== undefined && value !== '' && value !== null);
      const invalidPrice = suppliedPrices.find(([, value]) => !Number.isFinite(Number(value)) || Number(value) < 0);
      const hasAtLeastOnePrice = suppliedPrices.some(([, value]) => Number.isFinite(Number(value)) && Number(value) >= 0);
      const missingPrices = priceEntries.filter(([, value]) => value === undefined || value === '' || value === null).map(([label]) => label);
      const stock = Number(row.initialStock || 0);
      const warehouseName = String(row.warehouse || '').trim();
      const warehouseExists = !warehouseName || warehouseOptions.some((warehouse: any) => warehouse.name?.toLowerCase() === warehouseName.toLowerCase());
      const warehouseOk = warehouseExists && (stock <= 0 || Boolean(row.warehouseId || warehouseName));
      const errors = [
        !code ? 'SKU requerido' : codeCounts.get(code.toLowerCase())! > 1 ? 'SKU duplicado en la plantilla' : '',
        !String(row.name || '').trim() ? 'Nombre requerido' : '',
        !categoryOk ? 'Categoría no encontrada' : '',
        canViewInventoryCost && (cost === undefined || !Number.isFinite(cost) || cost < 0) ? 'Costo requerido y debe ser válido' : '',
        invalidPrice ? `Precio ${invalidPrice[0]} inválido` : !hasAtLeastOnePrice ? 'Debe incluir al menos un precio de venta' : '',
        !Number.isFinite(stock) || stock < 0 ? 'Stock inicial inválido' : !warehouseExists ? 'Bodega no encontrada' : !warehouseOk ? 'Selecciona una bodega para el stock inicial' : '',
      ].filter(Boolean);
       const imageStatus = archiveName ? (code && entries.has(code.toLowerCase()) ? 'matched' : 'missing') : 'none';
      const warningParts = missingPrices.length > 0 ? [`Sin precio: ${missingPrices.join(', ')}`] : [];
      return {
        ...row,
        code,
        name: String(row.name || '').trim(),
        ...(canViewInventoryCost ? { costPrice: cost } : {}),
        salePrice: Number(prices.RETAIL ?? prices.WHOLESALE ?? prices.DISTRIBUTOR ?? 0),
        _hasError: errors.length > 0,
        _errorMessage: errors[0],
        _hasWarning: warningParts.length > 0,
        _warningMessage: warningParts.join(' · '),
        _imageStatus: imageStatus,
      };
    });
  }, [importCategoryOptions, importWarehouseOptions, imageArchiveEntries, imageArchiveFileName, canViewInventoryCost]);

  const handleFileSelected = useCallback((file: File) => {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast.error('Selecciona un archivo Excel o CSV válido');
      return;
    }
    setImportProcessing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      window.setTimeout(() => {
        try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        if (raw.length < 2) {
          toast.error('El archivo está vacío o no tiene datos');
          return;
        }
        const headers = raw[0].map((h: any) => normalizeImportHeader(h));
        const colMap: Record<string, number> = {};
        const aliases: Record<string, string[]> = {
          code: ['código / sku', 'código', 'codigo', 'code', 'sku'], name: ['nombre', 'name', 'producto'], description: ['descripción', 'descripcion', 'description'], category: ['categoría', 'categoria', 'category', 'cat'], taxRate: ['tasa iva', 'iva', 'tax rate'], imageUrl: ['imagen url', 'imagen', 'image url'], barcode: ['código de barras', 'barcode'], brand: ['marca', 'brand'], model: ['modelo', 'model'], color: ['color'], weight: ['peso', 'weight'], weightUnit: ['unidad peso', 'weight unit'], dimensions: ['dimensiones', 'dimensions'], width: ['ancho', 'width'], height: ['alto', 'height'], depth: ['profundidad', 'depth'], dimensionUnit: ['unidad dimensión', 'dimension unit'], warranty: ['garantía', 'garantia', 'warranty'], estimatedDuration: ['duración estimada', 'duracion estimada'], unit: ['unidad', 'unit', 'medida'], trackInventory: ['control de inventario', 'track inventory'], minStock: ['stock mínimo', 'stock minimo', 'min stock'], costPrice: ['costo', 'precio costo', 'cost price'], lastPurchasePrice: ['último costo', 'ultimo costo', 'last purchase price'], initialStock: ['stock inicial', 'initial stock', 'cantidad', 'qty'], warehouse: ['bodega', 'almacén', 'almacen', 'warehouse'], trackBatch: ['control de lotes', 'track batch'], trackSeries: ['control de series', 'track series'], attributes: ['atributos json', 'atributos', 'attributes'], retailPrice: ['precio minorista', 'minorista', 'retail price'], wholesalePrice: ['precio mayorista', 'mayorista', 'wholesale price'], distributorPrice: ['precio distribuidor', 'distribuidor', 'distributor price'],
        };
        for (const [key, alts] of Object.entries(aliases)) {
          const normalizedAliases = alts.map((alias) => normalizeImportHeader(alias));
          const idx = headers.findIndex((header: string) => normalizedAliases.some((alias) => header === alias || header.startsWith(`${alias} `)));
          if (idx >= 0) colMap[key] = idx;
        }
        const parsed = raw.slice(1).filter((row: any[]) => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')).map((row: any[]) => {
          const get = (key: string) => colMap[key] !== undefined ? row[colMap[key]] : undefined;
          const toNumber = (key: string) => get(key) === '' || get(key) === undefined ? undefined : Number(get(key));
          const prices = { RETAIL: toNumber('retailPrice'), WHOLESALE: toNumber('wholesalePrice'), DISTRIBUTOR: toNumber('distributorPrice') };
          let attributes: any = undefined;
          if (get('attributes')) { try { attributes = JSON.parse(String(get('attributes'))); } catch { attributes = String(get('attributes')); } }
          return {
            code: String(get('code') || '').trim(),
            name: String(get('name') || '').trim(),
            category: String(get('category') || '').trim(),
            itemType: 'PRODUCT',
            description: String(get('description') || '').trim(), taxRate: toNumber('taxRate') ?? 0.15, imageUrl: String(get('imageUrl') || '').trim() || undefined, barcode: String(get('barcode') || '').trim() || undefined, brand: String(get('brand') || '').trim() || undefined, model: String(get('model') || '').trim() || undefined, color: String(get('color') || '').trim() || undefined, weight: toNumber('weight'), weightUnit: String(get('weightUnit') || '').trim() || undefined, dimensions: String(get('dimensions') || '').trim() || undefined, width: toNumber('width'), height: toNumber('height'), depth: toNumber('depth'), dimensionUnit: String(get('dimensionUnit') || '').trim() || undefined, warranty: String(get('warranty') || '').trim() || undefined, estimatedDuration: toNumber('estimatedDuration'), trackInventory: String(get('trackInventory') || 'SI').toUpperCase() !== 'NO', lastPurchasePrice: toNumber('lastPurchasePrice'), trackBatch: String(get('trackBatch') || '').toUpperCase() === 'SI', trackSeries: String(get('trackSeries') || '').toUpperCase() === 'SI', attributes,
            unit: String(get('unit') ?? '').trim().toLowerCase(),
            salePrice: Number(prices.RETAIL ?? prices.WHOLESALE ?? prices.DISTRIBUTOR ?? 0),
            costPrice: get('costPrice') === '' || get('costPrice') === undefined ? undefined : Number(get('costPrice')),
            initialStock: Number(get('initialStock') || 0),
            minStock: Number(get('minStock') || 0),
            warehouse: String(get('warehouse') || '').trim(), prices,
          };
        });
        setImportData(validateImportRows(parsed));
        setImportFileName(file.name);
        setImportProgress(0);
        toast.success(`${parsed.length} registros encontrados`);
        } catch (err) {
          console.error('Parse error', err);
          toast.error('No se pudo leer el archivo. Asegúrate de que sea un .xlsx o .csv válido.');
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

  const handleImageArchiveSelected = useCallback(async (file: File) => {
    if (!PRODUCT_IMAGE_ARCHIVE_EXTENSIONS.test(file.name)) {
      toast.error('Selecciona un archivo ZIP o RAR válido');
      return;
    }
    setImportProcessing(true);
    try {
      const entries = await extractProductImageArchive(file);
      setImageArchiveEntries(entries);
      setImageArchiveFileName(file.name);
      setImportData((prev) => validateImportRows(prev, entries, file.name));
      toast.success(`${entries.size} imagen(es) válidas encontradas en el ${/\.rar$/i.test(file.name) ? 'RAR' : 'ZIP'}`);
    } catch (error) {
      console.error('Image archive parse error', error);
      toast.error('No se pudo leer el archivo de imágenes. Verifica que no esté protegido con contraseña ni dividido en volúmenes.');
    } finally {
      setImportProcessing(false);
    }
  }, [validateImportRows]);

  const handleOpenImportPreview = useCallback(() => {
    if (previewLoading || importProcessing || importing || importData.length === 0) return;
    setPreviewLoading(true);
    setPreviewProgress(20);
    window.setTimeout(() => {
      setPreviewProgress(65);
      setImportModalOpen(false);
      setImportPreviewOpen(true);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setPreviewProgress(100);
          setPreviewLoading(false);
          setPreviewProgress(0);
        });
      });
    }, 40);
  }, [importData.length, importProcessing, importing, previewLoading]);

  const handleImportRowUpdate = (index: number, field: string, value: any) => {
    setImportData((prev) => {
      const next = [...prev];
      const row = { ...next[index], prices: { ...(next[index].prices || {}) } };
      if (field.startsWith('price.')) {
        const priceCode = field.split('.')[1];
        row.prices[priceCode] = value === '' ? undefined : Number(value);
        row.salePrice = Number(row.prices.RETAIL ?? row.prices.WHOLESALE ?? row.prices.DISTRIBUTOR ?? 0);
      } else {
        row[field] = value;
      }
      if (field === 'category') {
        const category = importCategoryOptions.find((c: any) => c.name?.toLowerCase() === String(value).trim().toLowerCase());
        row.categoryId = category?.id;
      }
      if (field === 'warehouse') {
        const warehouse = importWarehouseOptions.find((w: any) => w.name?.toLowerCase() === String(value).trim().toLowerCase());
        row.warehouseId = warehouse?.id;
      }
      next[index] = row;
      return validateImportRows(next);
    });
  };

  const handleImportConfirm = useCallback(() => {
    const valid = importData.filter((row) => !row._hasError);
    if (valid.length === 0) {
      toast.error('No hay registros válidos para importar');
      return;
    }
    if (valid.length !== importData.length) {
      toast.warning(`Se omitirán ${importData.length - valid.length} fila(s) con errores. Las advertencias no impedirán la carga.`);
    }
    setInitialImportConfirmOpen(true);
  }, [importData]);

  const handleFinalInitialImport = useCallback(async () => {
    const valid = importData.filter((row) => !row._hasError);
    if (initialImportConfirmText !== 'IMPORTAR' || valid.length === 0) return;
    setImporting(true);
    setImportProgress(0);
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    try {
      const items: any[] = [];
      const imageWarnings: string[] = [];
      const chunkSize = 8;
      for (let start = 0; start < valid.length; start += chunkSize) {
        const chunk = valid.slice(start, start + chunkSize);
        const chunkItems = await Promise.all(chunk.map(async (row) => {
          const cat = importCategoryOptions.find((c: any) => c.name?.toLowerCase() === row.category?.toLowerCase());
          const warehouse = importWarehouseOptions.find((w: any) => w.name?.toLowerCase() === row.warehouse?.toLowerCase());
          let imageUrl = row.imageUrl;
          const imageFile = imageArchiveEntries.get(String(row.code || '').trim().toLowerCase());
          if (imageFile) {
            try {
              const uploaded = await storageService.uploadFile('product-image', imageFile, { folder: 'catalogo-inicial' });
              imageUrl = uploaded.uri;
            } catch {
              imageWarnings.push(String(row.code || row.name || 'Producto'));
            }
          }
          return {
            code: row.code,
            name: row.name,
            categoryId: cat?.id,
             description: row.description, taxRate: row.taxRate, imageUrl, barcode: row.barcode, brand: row.brand, model: row.model, color: row.color, weight: row.weight, weightUnit: row.weightUnit, dimensions: row.dimensions, width: row.width, height: row.height, depth: row.depth, dimensionUnit: row.dimensionUnit, warranty: row.warranty, estimatedDuration: row.estimatedDuration, trackInventory: row.trackInventory, trackBatch: row.trackBatch, attributes: row.attributes,
            unit: String(row.unit ?? '').trim(),
             ...(canViewInventoryCost ? { costPrice: row.costPrice } : {}),
             ...(canViewInventoryCost ? { lastPurchasePrice: row.lastPurchasePrice } : {}),
            initialStock: row.initialStock,
            minStock: row.minStock || 0,
            warehouseId: warehouse?.id,
            prices: row.prices,
            price: row.salePrice,
            trackSeries: Boolean(row.trackSeries),
          };
        }));
        items.push(...chunkItems);
        setImportProgress(Math.round((Math.min(start + chunk.length, valid.length) / valid.length) * 55));
      }
      if (imageWarnings.length > 0) toast.warning(`${imageWarnings.length} imagen(es) no pudieron cargarse; esos productos se importarán sin imagen.`);
      setImportProgress(65);
      progressTimer = setInterval(() => setImportProgress((current) => Math.min(current + 1, 92)), 250);
      const results = await inventoryService.importInitialCatalog({ items, currency: importCurrency, exchangeRate: importExchangeRate, priceListCode: 'RETAIL', confirmText: 'IMPORTAR' });
      if (progressTimer) clearInterval(progressTimer);
      setImportProgress(100);
      setImportResults({ success: results.success || 0, skipped: (importData.length - valid.length) + (results.skipped || 0), failed: results.errors?.length || 0, errors: results.errors || [] });
      setImportModalOpen(false);
      setInitialImportConfirmOpen(false);
      setImportPreviewOpen(false);
      setInitialImportConfirmText('');
      setImportData([]);
      setImportFileName('');
      setInitialImportCompleted(true);
      onRefresh();
      window.setTimeout(() => setImportResults(null), 2600);
    } catch (e: any) {
      toast.error('Error durante la importación: ' + (e.message || 'Error'));
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      setImporting(false);
      setImportProgress(0);
    }
  }, [importData, importCategoryOptions, importWarehouseOptions, imageArchiveEntries, importCurrency, importExchangeRate, initialImportConfirmText, onRefresh, canViewInventoryCost]);

  const handleBulkImageArchiveSelected = useCallback(async (file: File) => {
    if (!PRODUCT_IMAGE_ARCHIVE_EXTENSIONS.test(file.name)) {
      toast.error('Selecciona un archivo ZIP o RAR válido');
      return;
    }
    setBulkImageProcessing(true);
    setBulkImageResults(null);
    try {
      const entries = await extractProductImageArchive(file);
      if (entries.size === 0) throw new Error('El archivo no contiene imágenes JPG, JPEG o PNG reconocibles.');
      const response = await inventoryService.getProducts({
        codes: Array.from(entries.keys()).join(','),
        type: 'PRODUCT',
        includeInactive: true,
        report: true,
        pageSize: Math.min(5000, Math.max(1, entries.size)),
      } as any);
      const payload: any = response;
      const productsFromResponse = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.data?.data)
            ? payload.data.data
            : [];
      const productsBySku = new Map<string, any>(productsFromResponse.map((product: any) => [String(product.code || '').trim().toLowerCase(), product]));
      const matchedProducts = Array.from(entries.keys()).map((sku) => productsBySku.get(sku)).filter(Boolean);
      const missingSkus = Array.from(entries.keys()).filter((sku) => !productsBySku.has(sku));
      setBulkImageEntries(entries);
      setBulkImageFileName(file.name);
      setBulkImageProducts(matchedProducts);
      setBulkImageMissingSkus(missingSkus);
      toast.success(`${entries.size} imagen(es) reconocida(s); ${matchedProducts.length} producto(s) encontrado(s)`);
    } catch (error: any) {
      console.error('Bulk product image archive parse error', error);
      setBulkImageEntries(new Map());
      setBulkImageFileName('');
      setBulkImageProducts([]);
      setBulkImageMissingSkus([]);
      toast.error(error?.message || 'No se pudo preparar el archivo de imágenes');
    } finally {
      setBulkImageProcessing(false);
    }
  }, []);

  const handleBulkImageUpload = useCallback(async () => {
    if (bulkImageUploading || bulkImageProducts.length === 0) return;
    setBulkImageUploading(true);
    setBulkImageProgress(0);
    const failed: string[] = [];
    let updated = 0;
    try {
      for (let index = 0; index < bulkImageProducts.length; index += 1) {
        const product = bulkImageProducts[index];
        const sku = String(product.code || '').trim().toLowerCase();
        const imageFile = bulkImageEntries.get(sku);
        try {
          if (!imageFile) throw new Error('Imagen no encontrada');
          const uploaded = await storageService.uploadFile('product-image', imageFile, { folder: product.id });
          await inventoryService.updateProduct(product.id, { imageUrl: uploaded.uri });
          updated += 1;
        } catch (error) {
          console.error(`No se pudo actualizar la imagen del producto ${product.code}`, error);
          failed.push(String(product.code || product.name || 'Producto'));
        }
        setBulkImageProgress(Math.round(((index + 1) / bulkImageProducts.length) * 100));
      }
      setBulkImageResults({ updated, failed });
      if (updated > 0) onRefresh();
      if (failed.length === 0) toast.success(`${updated} imagen(es) actualizada(s) correctamente`);
      else toast.warning(`${updated} imagen(es) actualizada(s) y ${failed.length} con incidencia`);
    } finally {
      setBulkImageUploading(false);
    }
  }, [bulkImageUploading, bulkImageProducts, bulkImageEntries, onRefresh]);

  return (
    <>
      <Card className={importPreviewOpen ? `fixed inset-y-0 right-0 left-0 z-40 flex h-dvh min-h-0 max-w-none flex-col overflow-hidden rounded-none border-0 bg-background p-4 sm:p-6 ${isSidebarCollapsed ? 'lg:left-[72px]' : 'lg:left-[270px]'}` : 'rounded-xl border bg-card p-4'}>
      {importPreviewOpen ? (
        <ImportPreviewPage
          importData={importData}
          importFileName={importFileName}
          importCurrency={importCurrency}
          categoryOptions={importCategoryOptions}
          warehouseOptions={importWarehouseOptions}
          importing={importing}
          importProgress={importProgress}
          onRowUpdate={handleImportRowUpdate}
          onDownloadErrors={handleDownloadImportErrors}
          onCreateCategory={(index, value) => {
            setPendingCategoryRowIndex(index);
            setNewCategoryName(value);
            setNewCategoryDescription('');
            setCategoryModalOpen(true);
          }}
          onCreateWarehouse={(index, value) => {
            setPendingWarehouseRowIndex(index);
            setNewWarehouseName(value);
            setNewWarehouseLocation('');
            setNewWarehouseType('STORE');
            setNewWarehouseParentId('none');
            setNewWarehouseInventoryAccountId('none');
            setWarehouseModalOpen(true);
          }}
          canCreateCategory={canPerform('INVENTORY', 'edit')}
          canCreateWarehouse={canPerform('INVENTORY', 'edit')}
          onConfirm={handleImportConfirm}
          onBack={() => { setImportPreviewOpen(false); setImportModalOpen(true); }}
        />
      ) : (
        <>
      {/* ─── Encabezado + KPIs ─── */}
      <div className="mb-4" data-tour="inventory-products-title">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">{isServiceView ? 'Servicios' : 'Productos y existencias'}</h2>
          </div>
          <p className="text-xs font-medium text-muted-foreground">{warehouses.length} almacenes registrados</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" data-tour="inventory-products-kpis">
          {[
            { id: 'all', label: isServiceView ? 'Servicios' : 'Productos', value: inventorySummary.total, tone: 'text-foreground' },
            ...(isServiceView ? [
              { id: 'service-categories', label: 'Categorías', value: serviceSummary.categories, tone: 'text-blue-600' },
              { id: 'service-weekly-average', label: 'Promedio de servicios por semana', value: serviceSummary.weeklyAverage, tone: 'text-emerald-600', decimals: 1 },
              { id: 'service-average', label: 'Precio promedio', value: serviceSummary.averagePrice, tone: 'text-amber-600', isCurrency: true },
            ] : [
              { id: 'available', label: 'Disponibles', value: inventorySummary.available, tone: 'text-emerald-600' },
              { id: 'low', label: 'Stock bajo', value: inventorySummary.low, tone: 'text-amber-600' },
              { id: 'out', label: 'Sin stock', value: inventorySummary.out, tone: 'text-rose-600' },
            ]),
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={['all', 'available', 'low', 'out'].includes(item.id) && stockFilter === item.id}
              onClick={() => ['all', 'available', 'low', 'out'].includes(item.id) && setStockFilter(item.id as typeof stockFilter)}
              className={`min-w-0 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                stockFilter === item.id ? 'border-primary bg-primary/5' : 'border-border/70 bg-muted/20 hover:bg-muted/50'
              }`}
            >
              <span className="block text-xs font-semibold text-muted-foreground">{item.label}</span>
              <span className={`mt-1 block text-2xl font-black tabular-nums ${item.tone}`}>{'isCurrency' in item && item.isCurrency ? formatAmount(item.value) : 'decimals' in item && item.decimals !== undefined ? item.value.toFixed(item.decimals) : item.value}</span>
            </button>
          ))}
        </div>
        {!isServiceView && selectedBranchId && (() => {
          const selectedBranch = (branches || []).find((b: any) => b.id === selectedBranchId) || null;
          const linkedWarehouses = warehouses.filter((w: any) => branchWarehouseIdSet.has(w.id));
          if (!selectedBranch && linkedWarehouses.length === 0) return null;
          return (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {selectedBranch && (
                <button
                  type="button"
                  onClick={() => setBranchDetail(selectedBranch)}
                  title="Ver detalle de la sucursal"
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary/15"
                >
                  <Store className="size-3 shrink-0" />
                  <span className="max-w-40 truncate">{selectedBranch.name}</span>
                </button>
              )}
              {linkedWarehouses.length > 0 && (
                <>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Almacenes vinculados</span>
                  {linkedWarehouses.map((warehouse: any) => (
                    <button
                      key={warehouse.id}
                      type="button"
                      onClick={() => setWarehouseDetail(warehouse)}
                      title="Ver detalle del almacén"
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/20 px-2.5 py-1 text-[11px] font-bold text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5"
                    >
                      <WarehouseIcon className="size-3 shrink-0 text-sky-600" />
                      <span className="max-w-40 truncate">{warehouse.name}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* ─── Barra de herramientas: patrón de filtros y acciones de Ventas ─── */}
      <div className="erp-composite-toolbar mb-4 flex flex-wrap items-center justify-between gap-3" data-tour="inventory-products-filters">
        <div className="erp-toolbar-filter-group flex min-w-0 flex-1 flex-wrap items-center gap-2" data-toolbar-role="filters">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
            <Input
              placeholder="Buscar producto o SKU..."
              className="h-10 w-full rounded-xl border-border/50 bg-background/50 pl-9 text-xs font-bold tracking-widest sm:w-64"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }}
            />
          </div>

          <MultiSelectFilter
            label="Bodegas"
            placeholder="Buscar bodegas..."
            searchable
            options={warehouses.map((w: any) => ({ value: w.id, label: w.name }))}
            selected={warehouseFilters}
            onChange={(value) => { setWarehouseFilters(value); onWarehouseChange?.(value); }}
            className="h-10 min-w-[8.5rem] rounded-xl border-border/50 bg-background/50 px-3 text-xs font-bold uppercase tracking-widest"
          />

          {!isServiceView && (
            <Select value={effectiveProductStatusFilter} onValueChange={(value) => { const nextValue = value as ProductStatusFilter; setLocalProductStatusFilter(nextValue); onProductStatusFilterChange?.(nextValue); }}>
              <SelectTrigger className="erp-filter-select h-10 min-w-[7.5rem] rounded-xl border border-border/50 bg-background/50 px-3 text-xs font-bold uppercase tracking-widest outline-none focus:border-primary" aria-label="Filtrar productos por estado"><SelectValue /></SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="ALL">Estado</SelectItem>
                <SelectItem value="ACTIVE">Activos</SelectItem>
                <SelectItem value="INACTIVE">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          )}
          {isServiceView && (
            <Select value={availabilityFilter} onValueChange={(value) => setAvailabilityFilter(value as typeof availabilityFilter)}>
              <SelectTrigger className="erp-filter-select h-10 min-w-[9.5rem] rounded-xl border border-border/50 bg-background/50 px-3 text-xs font-bold uppercase tracking-widest outline-none focus:border-primary" aria-label="Filtrar servicios por disponibilidad"><SelectValue /></SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">Disponibilidad</SelectItem>
                <SelectItem value="available">Disponibles</SelectItem>
                <SelectItem value="unavailable">No disponibles</SelectItem>
              </SelectContent>
            </Select>
          )}
          {!isServiceView && (
            <Select value={effectiveUnitFilter || '__all__'} onValueChange={(value) => { const v = value === '__all__' ? '' : value; setLocalUnitFilter(v); onUnitChange?.(v); }}>
              <SelectTrigger className="erp-filter-select h-10 min-w-[7.5rem] rounded-xl border border-border/50 bg-background/50 px-3 text-xs font-bold uppercase tracking-widest outline-none focus:border-primary" aria-label="Filtrar productos por unidad"><SelectValue /></SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="__all__">Unidad</SelectItem>
                {UNIT_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
              </SelectContent>
            </Select>
          )}
          {!isServiceView && (
            <Select value={effectiveTaxRateFilter || '__all__'} onValueChange={(value) => { const v = value === '__all__' ? '' : value; setLocalTaxRateFilter(v); onTaxRateChange?.(v); }}>
              <SelectTrigger className="erp-filter-select h-10 min-w-[7.5rem] rounded-xl border border-border/50 bg-background/50 px-3 text-xs font-bold uppercase tracking-widest outline-none focus:border-primary" aria-label="Filtrar productos por impuesto"><SelectValue /></SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="__all__">Impuesto</SelectItem>
                {TAX_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
              </SelectContent>
            </Select>
          )}
          {!isServiceView && (
            <Select value={effectiveStockStatusFilter || '__all__'} onValueChange={(value) => { const v = value === '__all__' ? '' : value; setLocalStockStatusFilter(v); onStockStatusChange?.(v); }}>
              <SelectTrigger className="erp-filter-select h-10 min-w-[7.5rem] rounded-xl border border-border/50 bg-background/50 px-3 text-xs font-bold uppercase tracking-widest outline-none focus:border-primary" aria-label="Filtrar productos por stock"><SelectValue /></SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="__all__">Stock</SelectItem>
                <SelectItem value="available">Con stock</SelectItem>
                <SelectItem value="low">Bajo</SelectItem>
                <SelectItem value="out">Sin stock</SelectItem>
              </SelectContent>
            </Select>
          )}

          {!selectedBranchId && !isServiceView && (
            <label className="flex h-10 shrink-0 cursor-pointer select-none items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3" title="Mostrar todos los productos incluyendo los de almacenes sin sucursal">
              <Checkbox checked={showAllWarehouseProducts} onCheckedChange={(checked) => setShowAllWarehouseProducts(checked !== false)} className="size-4" />
              <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-muted-foreground">Todos los almacenes</span>
            </label>
          )}

          {(warehouseFilters.length > 0 || searchTerm || stockFilter !== 'all' || availabilityFilter !== 'all' || (!isServiceView && effectiveProductStatusFilter !== 'ALL') || effectiveUnitFilter || effectiveTaxRateFilter || effectiveStockStatusFilter || !showAllWarehouseProducts) && (
            <Button variant="outline" size="sm" className="h-10 shrink-0 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground" onClick={() => {
              setSearchTerm(''); setCategoryFilters([]); setWarehouseFilters([]); onSearchChange?.(''); onCategoryChange?.([]); onWarehouseChange?.([]); setStockFilter('all'); setAvailabilityFilter('all'); setLocalProductStatusFilter('ALL'); onProductStatusFilterChange?.('ALL'); setLocalUnitFilter(''); onUnitChange?.(''); setLocalTaxRateFilter(''); onTaxRateChange?.(''); setLocalStockStatusFilter(''); onStockStatusChange?.(''); setShowAllWarehouseProducts(true);
            }}>
              <X className="mr-2 size-4" /> Limpiar
            </Button>
          )}
        </div>

        <div className="erp-toolbar-primary-group flex w-full max-w-full shrink-0 flex-wrap items-center justify-end gap-2 md:w-auto" data-tour="inventory-products-actions">
          {canPerform('INVENTORY_PRODUCTS', 'create') && (
            <Button type="button" size="sm" data-toolbar-role="primary" className="h-10 shrink-0 rounded-xl border border-primary/20 bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90 md:order-last" onClick={() => setCreateModalOpen(true)}>
              <Plus className="mr-2 size-4" /> Nuevo
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" data-toolbar-role="help" className="h-10 shrink-0 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest" onClick={() => setShowTutorial(true)}>
            <CircleHelp className="mr-2 size-4" /> Cómo
          </Button>
          {!isServiceView && canPerform('INVENTORY', 'edit') && !initialImportCompleted && products.length === 0 && (
            <Button type="button" size="sm" variant="outline" className="h-10 shrink-0 rounded-xl border-primary/40 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10" onClick={() => setInitialImportIntroOpen(true)} title="Importar el catálogo inicial desde una plantilla">
              <Upload className="mr-2 size-4" /> Importar productos
            </Button>
          )}
          {!isServiceView && canPerform('INVENTORY_PRODUCTS', 'edit') && (
            <Button type="button" size="sm" variant="outline" className="h-10 shrink-0 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest" onClick={() => setBulkImageModalOpen(true)} title="Actualizar imágenes masivamente por SKU">
              <ImageIcon className="mr-2 size-4" /> Imágenes
            </Button>
          )}
          {!isServiceView && (
            <Button type="button" size="sm" variant="outline" className="h-10 shrink-0 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest" onClick={selectedIds.size > 0 ? openSelectedSolicitud : openLowStockSolicitud}>
              <PackageSearch className="mr-2 size-4" />{selectedIds.size > 0 ? `Comprar (${selectedIds.size})` : 'Solicitudes'}
            </Button>
          )}
          {!isServiceView && canPerform('INVENTORY_PRODUCTS', 'export') && (
            <Button type="button" size="sm" variant="outline" className="h-10 shrink-0 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest" onClick={() => setLabelModalOpen(true)} title="Imprimir etiquetas con código de barras">
              <Barcode className="mr-2 size-4" /> Etiquetas
            </Button>
          )}
        </div>
      </div>

      {/* Mobile cards: the desktop table stays available at md+ without forcing page overflow. */}
      <div className="space-y-3 xl:hidden" data-tour="inventory-products-table">
        {paginatedProducts.length === 0 ? (
          <Card className="rounded-2xl border-border/40 p-6 text-center">
            <Package className="mx-auto mb-2 size-9 opacity-20" />
            <p className="font-medium">{products.length > 0 ? 'No hay coincidencias' : `No hay ${isServiceView ? 'servicios' : 'productos'} registrados`}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {products.length > 0 ? 'Cambia los filtros o busca otro nombre o código.' : isServiceView ? 'Agrega un servicio para comenzar.' : 'Los productos se administran desde compras, POS u otros módulos.'}
            </p>
          </Card>
        ) : paginatedProducts.map((product) => {
          const status = getStockStatus(product);
          const warehousesForProduct = isServiceView
            ? (product.warehouseCatalogs || []).map((catalog: any) => catalog.warehouse?.name).filter(Boolean)
            : (product.stockLevels || []).map((level: any) => level.warehouse?.name).filter(Boolean);
          const costPrice = Number(product.costPrice || 0);
          const maxStock = getProductMaxStock(product);
          return (
            <Card key={product.id} className={`min-w-0 overflow-hidden rounded-2xl border-border/40 p-4 shadow-sm ${highlightedProductId === product.id ? 'bg-primary/10 ring-2 ring-primary/60' : ''}`} onClick={() => setProductDetail(product)}>
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (product.imageUrl) setExpandedProductImage({ src: product.imageUrl, alt: product.name });
                  }}
                  disabled={!product.imageUrl}
                  aria-label={product.imageUrl ? `Ver imagen de ${product.name}` : `Producto ${product.name} sin imagen`}
                >
                  <ProductThumbnail src={product.imageUrl} alt={product.name} size="md" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold" title={product.name}>{product.name}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{product.code}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[9px] font-black uppercase">{isServiceView ? 'Servicio' : 'Producto'}</Badge>
                  </div>
                  <p className="mt-2 truncate text-xs text-muted-foreground">{product.category?.name || 'Sin categoría'}</p>
                  <div className="mt-3 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3 xl:grid-cols-4">
                    {isServiceView && <div>
                      <span className="text-muted-foreground">{isServiceView ? 'Precio' : 'Precio venta'}</span>
                      <CurrencyValuationAmount amount={Number(product.salePrice || 0)} sourceCurrency={product.priceCurrency || baseCurrency} sourceExchangeRate={product.priceExchangeRate} className="font-bold" />
                    </div>}
                    {!isServiceView && <div>
                      <span className="text-muted-foreground">Existencias</span>
                      <p className={`font-bold tabular-nums ${getStockAlertColor(product)}`}>{getProductStock(product)}</p>
                    </div>}
                    {!isServiceView && <>
                      <div className="min-w-0"><span className="text-muted-foreground">U. medida</span><p className="truncate font-medium">{product.unit || 'unidad'}</p></div>
                      <div><span className="text-muted-foreground">Mínimo</span><p className="font-bold tabular-nums">{product.minStock || 0}</p></div>
                      <div><span className="text-muted-foreground">Máximo</span><p className="font-bold tabular-nums">{maxStock}</p></div>
                       {canViewInventoryCost && <div><span className="text-muted-foreground">Precio costo</span><CurrencyValuationAmount amount={costPrice} sourceCurrency={(product as any).costCurrency || product.priceCurrency || baseCurrency} sourceExchangeRate={(product as any).costExchangeRate || product.priceExchangeRate} className="font-medium" /></div>}
                    </>}
                  </div>
                  {!isServiceView && <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="font-bold uppercase tracking-wider">IMEI</span>
                    <Badge variant="secondary" className="text-[9px]">{product.trackSerialNumbers ? 'Activo' : 'Inactivo'}</Badge>
                  </div>}
                  <div className="mt-3 flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {isServiceView ? 'Estado' : 'Almacenes'}
                    </span>
                    <div className="flex min-w-0 flex-wrap gap-1">
                      {isServiceView ? (
                        <Badge variant="outline" className={product.isActive !== false ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}>
                          {product.isActive !== false ? 'Disponible' : 'No disponible'}
                        </Badge>
                      ) : (
                        warehousesForProduct.length > 0
                          ? Array.from(new Set(warehousesForProduct)).map((name: any) => <Badge key={name} variant="secondary" className="max-w-full truncate text-[9px]">{name}</Badge>)
                          : <span className="text-[10px] text-muted-foreground">-</span>
                      )}
                    </div>
                  </div>
                  {!isServiceView && status.label !== 'OK' && <Badge className={`mt-3 ${status.color} text-[10px]`}>{status.label}</Badge>}
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-1 border-t border-border/40 pt-3">
                {canPerform('INVENTORY_PRODUCTS', 'edit') && <Button variant="ghost" size="icon" className="size-8" title="Editar" onClick={(e) => { e.stopPropagation(); setModalProduct(product); }}><Pencil className="size-3.5" /></Button>}
                {canPerform('INVENTORY_PRODUCTS', 'create') && product.isActive !== false && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-sky-600 hover:bg-sky-700 hover:text-white"
                    title="Duplicar producto"
                    disabled={duplicatingId === product.id}
                    onClick={(e) => { e.stopPropagation(); handleDuplicateProduct(product); }}
                  >
                    {duplicatingId === product.id ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
                  </Button>
                )}
                {product.isVariable && canPerform('INVENTORY_PRODUCTS', 'edit') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-primary hover:bg-primary/10"
                    title="Gestionar variantes"
                    onClick={(e) => { e.stopPropagation(); setVariantManagerProduct(product); }}
                  >
                    <Tag className="size-3.5" />
                  </Button>
                )}
                {canPerform('INVENTORY_PRODUCTS', 'edit') && <Button
                  variant="ghost"
                  size="icon"
                  className={`size-8 ${product.isActive === false ? 'text-emerald-600 hover:bg-emerald-700 hover:text-white' : 'text-amber-600 hover:bg-amber-800 hover:text-white'}`}
                  title={product.isActive === false ? 'Activar producto' : 'Inactivar producto'}
                  aria-label={product.isActive === false ? 'Activar producto' : 'Inactivar producto'}
                  onClick={(e) => { e.stopPropagation(); handleToggleProductStatus(product); }}
                ><Ban className="size-3.5" /></Button>}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden max-w-full overflow-x-auto rounded-lg border xl:block" data-tour="inventory-products-table">
        <Table className="w-full table-fixed" style={{ minWidth: isServiceView ? '920px' : '1176px' }}>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead style={{ width: PRODUCT_TABLE_WIDTHS.selector, minWidth: PRODUCT_TABLE_WIDTHS.selector }}>
                <button type="button" onClick={(e) => { e.stopPropagation(); toggleSelectAll(); }} className="flex items-center justify-center size-7 rounded-md hover:bg-muted/60">
                  {selectedIds.size === paginatedProducts.length && paginatedProducts.length > 0
                    ? <SquareCheckBig className="size-4 text-primary" />
                    : <Square className="size-4 text-muted-foreground" />
                  }
                </button>
              </TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest" style={{ width: PRODUCT_TABLE_WIDTHS.code, minWidth: PRODUCT_TABLE_WIDTHS.code }}><span className="inline-flex items-center gap-1">Código<ColumnFilterMenu label="Código" sort={colFilters.state.code?.sort || null} onSort={(sort) => colFilters.setSort('code', sort)} /></span></TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest" style={{ width: PRODUCT_TABLE_WIDTHS.name, minWidth: PRODUCT_TABLE_WIDTHS.name }}><span className="inline-flex items-center gap-1">{isServiceView ? 'Servicio' : 'Nombre'}<ColumnFilterMenu label={isServiceView ? 'Servicio' : 'Nombre'} sort={colFilters.state.name?.sort || null} onSort={(sort) => colFilters.setSort('name', sort)} sortOptions={[{ value: 'asc', label: 'A → Z (alfabético)' }, { value: 'desc', label: 'Más recientes' }]} /></span></TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest" style={{ width: PRODUCT_TABLE_WIDTHS.category, minWidth: PRODUCT_TABLE_WIDTHS.category }}><span className="inline-flex items-center gap-1">Categoría<ColumnFilterMenu label="Categoría" options={categoryOptions} selected={colFilters.state.category?.values || []} onSelect={(values) => colFilters.setValues('category', values)} sort={colFilters.state.category?.sort || null} onSort={(sort) => colFilters.setSort('category', sort)} /></span></TableHead>
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest" style={{ width: PRODUCT_TABLE_WIDTHS.unit, minWidth: PRODUCT_TABLE_WIDTHS.unit }}>U.Medida</TableHead>}
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right" style={{ width: PRODUCT_TABLE_WIDTHS.min, minWidth: PRODUCT_TABLE_WIDTHS.min }}>Min</TableHead>}
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right" style={{ width: PRODUCT_TABLE_WIDTHS.max, minWidth: PRODUCT_TABLE_WIDTHS.max }}>Max</TableHead>}
              {isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest" style={{ width: PRODUCT_TABLE_WIDTHS.warehouse, minWidth: PRODUCT_TABLE_WIDTHS.warehouse }}>Bodega</TableHead>}
              <TableHead className="font-black text-[10px] uppercase tracking-widest" style={{ width: PRODUCT_TABLE_WIDTHS.warehouse, minWidth: PRODUCT_TABLE_WIDTHS.warehouse }}>{isServiceView ? 'Estado' : 'Bodegas'}</TableHead>
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right" style={{ width: PRODUCT_TABLE_WIDTHS.stock, minWidth: PRODUCT_TABLE_WIDTHS.stock }}><span className="inline-flex items-center gap-1">Stock<ColumnFilterMenu label="Stock" sort={colFilters.state.stock?.sort || null} onSort={(sort) => colFilters.setSort('stock', sort)} /></span></TableHead>}
              {isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right" style={{ width: PRODUCT_TABLE_WIDTHS.price, minWidth: PRODUCT_TABLE_WIDTHS.price }}>Precio</TableHead>}
               {!isServiceView && canViewInventoryCost && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right" style={{ width: PRODUCT_TABLE_WIDTHS.cost, minWidth: PRODUCT_TABLE_WIDTHS.cost }}>Precio Costo</TableHead>}
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right" style={{ width: PRODUCT_TABLE_WIDTHS.actions, minWidth: PRODUCT_TABLE_WIDTHS.actions }}>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* New rows being edited */}
            {Array.from(editingRows.values())
              .filter(p => p.isNew)
              .map(product => renderEditableRow(product))}
            
            {/* Existing products */}
            {filteredData.length === 0 && editingRows.size === 0 ? (
              <TableRow>
                <TableCell colSpan={isServiceView ? 8 : canViewInventoryCost ? 11 : 10} className="text-center py-12 text-muted-foreground">
                  <Package className="size-10 mx-auto mb-2 opacity-20" />
                  <p className="font-medium">{products.length > 0 ? 'No hay coincidencias' : `No hay ${isServiceView ? 'servicios' : 'productos'} registrados`}</p>
                  <p className="text-sm">
                    {products.length > 0 ? 'Cambia los filtros o busca otro nombre o codigo.' : isServiceView ? 'Agrega un servicio para comenzar.' : 'Los productos se administran desde compras, POS u otros módulos.'}
                  </p>
                  {products.length > 0 && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-4"
                                        onClick={() => {
                                          setSearchTerm('');
                                          setCategoryFilters([]);
                                          setWarehouseFilters([]);
                                          setStockFilter('all');
                                        }}
                                      >
                                        Limpiar filtros
                                      </Button>
                                    )}
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((product) => {
                const isEditing = editingRows.has(product.id);
                if (isEditing) {
                  return renderEditableRow(editingRows.get(product.id)!);
                }
                
                const status = getStockStatus(product);
                 return (
                   <TableRow 
                      key={product.id} 
                      className={`group hover:bg-muted/30 cursor-pointer ${highlightedProductId === product.id ? 'bg-primary/10 ring-2 ring-inset ring-primary/60' : ''}`}
                      onClick={() => setProductDetail(product)}
                      onDoubleClick={() => canPerform('INVENTORY_PRODUCTS', 'edit') && handleEditRow(product)}
                     >
                     <TableCell className="w-10">
                       <button type="button" onClick={(e) => { e.stopPropagation(); toggleSelect(product.id); }} className="flex items-center justify-center size-7 rounded-md hover:bg-muted/60">
                         {selectedIds.has(product.id)
                           ? <SquareCheckBig className="size-4 text-primary" />
                           : <Square className="size-4 text-muted-foreground" />
                         }
                       </button>
                     </TableCell>
                     <TableCell className="font-mono text-xs text-muted-foreground">{product.code}</TableCell>
                    <TableCell>
                      <div className="flex min-w-[190px] items-center gap-3">
                        {product.imageUrl ? (
                          <button
                            type="button"
                            className="rounded-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedProductImage({ src: product.imageUrl, alt: product.name });
                            }}
                            aria-label={`Ver imagen de ${product.name}`}
                            title="Ver imagen"
                          >
                            <ProductThumbnail src={product.imageUrl} alt={product.name} size="md" />
                          </button>
                        ) : (
                          <ProductThumbnail src={undefined} alt={product.name} size="md" />
                        )}
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="truncate font-medium text-sm hover:text-primary underline-offset-2 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProductDetail(product);
                            }}
                          >
                            {product.name}
                          </button>
                          {!isServiceView && Boolean(
                            product.trackSerialNumbers ||
                            product.serialTracking ||
                            product.serialNumberTracking ||
                            String(product.trackingType || '').toUpperCase() === 'SERIAL',
                          ) && (
                            <Badge variant="outline" className="text-[9px] font-black">IMEI</Badge>
                          )}
                          {!isServiceView && status.label !== 'OK' && (
                            <Badge className={`${status.color} text-[10px] px-1.5 py-0`}>{status.label}</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{product.category?.name || '-'}</span>
                    </TableCell>
                    {!isServiceView && <TableCell>
                      <span className="text-xs text-muted-foreground capitalize">{product.unit || 'unidad'}</span>
                    </TableCell>}
                    {!isServiceView && <TableCell>
                      <span className="text-xs text-muted-foreground text-right block">{Number(product.minStock || 0)}</span>
                    </TableCell>}
                    {!isServiceView && <TableCell>
                      <span className="text-xs text-muted-foreground text-right block">
                        {getProductMaxStock(product) > 0 ? getProductMaxStock(product) : '-'}
                      </span>
                    </TableCell>}
                    {isServiceView && <TableCell>
                      <span className="text-xs text-muted-foreground">{product.warehouseCatalogs?.[0]?.warehouse?.name || '-'}</span>
                    </TableCell>}
                    <TableCell>
                      {isServiceView ? (
                        <Badge variant="outline" className={product.isActive !== false ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}>
                          {product.isActive !== false ? 'Disponible' : 'No disponible'}
                        </Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const warehouseNames = product.stockLevels && product.stockLevels.length > 0
                              ? Array.from(new Set(
                                  product.stockLevels
                                    .filter((sl: any) => Number(sl.quantity) > 0)
                                    .map((sl: any) => sl.warehouse?.name)
                                    .filter(Boolean)
                                ))
                              : [];
                            if (warehouseNames.length > 0) {
                              return warehouseNames.map((whName: any, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-[9px] bg-muted/50 font-medium">
                                  {whName}
                                </Badge>
                              ));
                            }
                            const catalogNames = Array.from(new Set(
                              (product.warehouseCatalogs || [])
                                .map((wc: any) => wc.warehouse?.name)
                                .filter(Boolean)
                            ));
                            if (catalogNames.length > 0) {
                              return catalogNames.map((whName: any, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-[9px] bg-muted/50 font-medium">
                                  {whName}
                                </Badge>
                              ));
                            }
                            return <span className="text-[10px] text-muted-foreground">-</span>;
                          })()}
                        </div>
                      )}
                    </TableCell>
                    {!isServiceView && <TableCell className={`text-right font-medium tabular-nums ${getStockAlertColor(product)}`}>
                      {getProductStock(product)}
                    </TableCell>}
                    {isServiceView && <TableCell className="text-right"><CurrencyValuationAmount amount={Number(product.salePrice || 0)} sourceCurrency={product.priceCurrency || baseCurrency} sourceExchangeRate={product.priceExchangeRate} className="font-medium" /></TableCell>}
                      {!isServiceView && canViewInventoryCost && <TableCell className="text-right text-muted-foreground"><CurrencyValuationAmount amount={Number(product.costPrice || 0)} sourceCurrency={(product as any).costCurrency || product.priceCurrency || baseCurrency} sourceExchangeRate={(product as any).costExchangeRate || product.priceExchangeRate} className="font-medium" /></TableCell>}
                     <TableCell className="text-right">
                         <div className="flex items-center justify-end gap-1 transition-opacity">
                         {canPerform('INVENTORY_PRODUCTS', 'edit') && (
                             <Button 
                               variant="ghost" 
                               size="icon" 
                              className="size-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalProduct(product);
                              }}
                            >
                             <Pencil className="size-3.5" />
                           </Button>
                       )}
                        {canPerform('INVENTORY_PRODUCTS', 'create') && product.isActive !== false && (
                           <Button 
                             variant="ghost" 
                             size="icon" 
                            className="size-7 text-sky-600 hover:text-sky-700 hover:bg-sky-500/10"
                            title="Duplicar producto"
                            disabled={duplicatingId === product.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateProduct(product);
                            }}
                          >
                            {duplicatingId === product.id ? <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Copy className="size-3.5" />}
                          </Button>
                       )}
                        {product.isVariable && canPerform('INVENTORY_PRODUCTS', 'edit') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-primary hover:bg-primary/10"
                            title="Gestionar variantes"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVariantManagerProduct(product);
                            }}
                          >
                            <Tag className="size-3.5" />
                          </Button>
                        )}
                         {canPerform('INVENTORY_PRODUCTS', 'edit') && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                             className={`size-7 ${product.isActive === false ? 'text-emerald-600 hover:text-white hover:bg-emerald-700' : 'text-amber-600 hover:text-white hover:bg-amber-800'}`}
                             title={product.isActive === false ? 'Activar producto' : 'Inactivar producto'}
                             aria-label={product.isActive === false ? 'Activar producto' : 'Inactivar producto'}
                             onClick={(e) => {
                               e.stopPropagation();
                                handleToggleProductStatus(product);
                             }}
                           >
                              <Ban className="size-3.5" />
                           </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="mt-4 flex flex-col items-stretch justify-between gap-3 border-t border-border/40 pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center" data-tour="inventory-products-pagination">
        <div className="flex items-center gap-2">
          <span>Mostrar</span>
          <select value={pagination?.pageSize || pageSize} onChange={(event) => { const nextSize = Number(event.target.value) as 50 | 100 | 200; if (pagination) pagination.onPageSizeChange(nextSize); else { setPageSize(nextSize); setPage(1); } }} className="h-8 rounded-lg border border-border/50 bg-background px-2 font-bold text-foreground outline-none" aria-label="Registros por página">
            {[50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <span>por página</span>
          <span className="ml-2 rounded-lg border border-border/40 px-2 py-1">
            {filteredProducts.length === 0 ? 0 : `${((pagination?.page || page) - 1) * (pagination?.pageSize || pageSize) + 1}-${Math.min((pagination?.page || page) * (pagination?.pageSize || pageSize), pagination?.total || filteredProducts.length)}`} de {pagination?.total || filteredProducts.length}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1 sm:justify-end">
          <button type="button" className="rounded-lg border border-border/50 p-2 disabled:opacity-30" onClick={() => pagination ? pagination.onPageChange(1) : setPage(1)} disabled={(pagination?.page || page) <= 1} aria-label="Primera página"><ChevronsLeft className="size-4" /></button>
          <button type="button" className="rounded-lg border border-border/50 p-2 disabled:opacity-30" onClick={() => pagination ? pagination.onPageChange(Math.max(1, pagination.page - 1)) : setPage((p) => Math.max(1, p - 1))} disabled={(pagination?.page || page) <= 1} aria-label="Página anterior"><ChevronLeft className="size-4" /></button>
          <span className="min-w-24 text-center font-bold text-foreground">Pág. {pagination?.page || page} / {Math.max(1, totalPages)}</span>
          <button type="button" className="rounded-lg border border-border/50 p-2 disabled:opacity-30" onClick={() => pagination ? pagination.onPageChange(Math.min(totalPages, pagination.page + 1)) : setPage((p) => Math.min(totalPages, p + 1))} disabled={(pagination?.page || page) >= totalPages} aria-label="Página siguiente"><ChevronRight className="size-4" /></button>
          <button type="button" className="rounded-lg border border-border/50 p-2 disabled:opacity-30" onClick={() => pagination ? pagination.onPageChange(totalPages) : setPage(totalPages)} disabled={(pagination?.page || page) >= totalPages} aria-label="Última página"><ChevronsRight className="size-4" /></button>
        </div>
      </div>
        </>
      )}
      <EditProductModal
        product={modalProduct}
        categories={categories}
        warehouses={warehouses}
        itemType={catalogItemType}
        onClose={() => setModalProduct(null)}
        onRefresh={onRefresh}
      />
      <VariantManagerModal
        open={variantManagerProduct !== null}
        onOpenChange={(v) => { if (!v) setVariantManagerProduct(null); }}
        product={variantManagerProduct}
        onRefresh={onRefresh}
      />
      <ConfirmDialog
        open={pendingStatusChange !== null}
        onOpenChange={(open) => { if (!open && !statusChanging) setPendingStatusChange(null); }}
        title={pendingStatusChange?.isActive === false ? `¿Activar ${entityLabel}?` : `¿Inactivar ${entityLabel}?`}
        description={pendingStatusChange?.isActive === false
          ? `${pendingStatusChange?.name || 'El producto'} volverá a estar disponible para nuevas operaciones.`
          : `${pendingStatusChange?.name || 'El producto'} quedará inactivo y no estará disponible para nuevas operaciones. Sus transacciones históricas se conservarán.`}
        confirmLabel={pendingStatusChange?.isActive === false ? `Activar ${entityLabel}` : `Inactivar ${entityLabel}`}
        variant={pendingStatusChange?.isActive === false ? 'default' : 'destructive'}
        loading={statusChanging}
        onConfirm={handleConfirmStatusChange}
      />
      <Dialog open={categoryModalOpen} onOpenChange={(open) => { setCategoryModalOpen(open); if (!open) setPendingCategoryRowIndex(null); }}>
        <DialogContent>
          <DialogHeader data-tour="inventory-category-title">
            <DialogTitle>Nueva categoría</DialogTitle>
            <DialogDescription>Crea una categoría para usarla de inmediato en productos.</DialogDescription>
            <InventoryViewTutorial label="Cómo crear categoría" targetPrefix="inventory-category" copy={{ data: { description: 'Escribe el nombre y una descripción breve para clasificar productos.' }, actions: { description: 'Guarda la categoría para seleccionarla inmediatamente en el catálogo.' } }} />
          </DialogHeader>
          <div className="space-y-3" data-tour="inventory-category-data">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Nombre</p>
              <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Ej. Electrónica" className="h-9 text-xs" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Descripción (opcional)</p>
              <Input value={newCategoryDescription} onChange={(e) => setNewCategoryDescription(e.target.value)} placeholder="Descripción corta" className="h-9 text-xs" />
            </div>
          </div>
          <DialogFooter className="mt-2" data-tour="inventory-category-actions">
            <Button variant="outline" onClick={() => setCategoryModalOpen(false)}>Cancelar</Button>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleCreateCategory} disabled={creatingCategory}>
              {creatingCategory ? 'Guardando...' : 'Guardar categoría'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={warehouseModalOpen} onOpenChange={(open) => { setWarehouseModalOpen(open); if (!open) setPendingWarehouseRowIndex(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader data-tour="inventory-warehouse-title">
            <DialogTitle>Nuevo almacén</DialogTitle>
            <DialogDescription>Completa los mismos datos disponibles en la vista de Almacenes y Sucursales.</DialogDescription>
            <InventoryViewTutorial label="Cómo crear almacén" targetPrefix="inventory-warehouse" copy={{ data: { description: 'Completa nombre, ubicación, tipo, almacén matriz y cuenta contable de inventario.' }, actions: { description: 'Guarda el almacén para usarlo en productos, transferencias y ajustes.' } }} />
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2" data-tour="inventory-warehouse-data">
            <div className="space-y-1 sm:col-span-2">
              <p className="text-xs font-semibold">Nombre <span className="text-red-500">*</span></p>
              <Input value={newWarehouseName} onChange={(event) => setNewWarehouseName(event.target.value)} placeholder="Ej. Bodega principal" disabled={creatingWarehouse} autoFocus />
              <p className="text-[11px] text-muted-foreground">El nombre debe ser único dentro del rubro.</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold">Ubicación</p>
              <Input value={newWarehouseLocation} onChange={(event) => setNewWarehouseLocation(event.target.value)} placeholder="Ej. Managua" disabled={creatingWarehouse} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold">Tipo</p>
              <Select value={newWarehouseType} onValueChange={setNewWarehouseType} disabled={creatingWarehouse}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>{WAREHOUSE_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold">Almacén matriz</p>
              <Select value={newWarehouseParentId} onValueChange={setNewWarehouseParentId} disabled={creatingWarehouse}>
                <SelectTrigger><SelectValue placeholder="Sin almacén matriz" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin almacén matriz</SelectItem>
                  {importWarehouseOptions.length === 0 && <SelectItem value="__no_parent_warehouses__" disabled>No hay registros</SelectItem>}
                  {importWarehouseOptions.map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold">Cuenta contable de inventario</p>
              <Select value={newWarehouseInventoryAccountId} onValueChange={setNewWarehouseInventoryAccountId} disabled={creatingWarehouse || warehouseAccountsLoading}>
                <SelectTrigger><SelectValue placeholder={warehouseAccountsLoading ? 'Cargando cuentas...' : 'Sin cuenta'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cuenta</SelectItem>
                  {!warehouseAccountsLoading && warehouseAccounts.length === 0 && <SelectItem value="__no_accounts__" disabled>No hay registros</SelectItem>}
                  {warehouseAccounts.map((account: any) => <SelectItem key={account.id} value={account.id}>{account.code} - {account.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter data-tour="inventory-warehouse-actions">
            <Button variant="outline" onClick={() => setWarehouseModalOpen(false)} disabled={creatingWarehouse}>Cancelar</Button>
            <Button onClick={handleCreateWarehouse} disabled={creatingWarehouse || !newWarehouseName.trim()}>{creatingWarehouse ? 'Guardando…' : 'Guardar almacén'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(warehouseDetail)} onOpenChange={(open) => !open && setWarehouseDetail(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><WarehouseIcon className="size-5 text-sky-600" /> {warehouseDetail?.name || 'Almacén'}</DialogTitle>
            <DialogDescription>Detalle del almacén con su stock real y productos asignados.</DialogDescription>
          </DialogHeader>
          {warehouseDetail && (() => {
            const stats = warehouseStockStats.get(warehouseDetail.id) || { products: 0, units: 0 };
            const parent = warehouses.find((w: any) => w.id === warehouseDetail.parentId);
            const branchNames = branchesForWarehouse(warehouseDetail.id);
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Tipo</p>
                    <p className="mt-1 text-sm font-black">{warehouseTypeLabel(warehouseDetail.type)}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ubicación</p>
                    <p className="mt-1 truncate text-sm font-black">{warehouseDetail.location || '—'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Productos</p>
                    <p className="mt-1 text-xl font-black tabular-nums">{stats.products}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Unidades</p>
                    <p className="mt-1 text-xl font-black tabular-nums">{stats.units}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {parent && <Badge variant="outline" className="text-[10px]">Matriz: {parent.name}</Badge>}
                  {branchNames.map((name) => <Badge key={name} variant="secondary" className="text-[10px]">Sucursal: {name}</Badge>)}
                  {branchNames.length === 0 && !parent && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">Sin sucursal asignada</Badge>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(branchDetail)} onOpenChange={(open) => !open && setBranchDetail(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Store className="size-5 text-violet-600" /> {branchDetail?.name || 'Sucursal'}</DialogTitle>
            <DialogDescription>Detalle de la sucursal con sus almacenes vinculados y stock agregado.</DialogDescription>
          </DialogHeader>
          {branchDetail && (() => {
            const stats = branchStockStats.get(branchDetail.id) || { warehouses: 0, products: 0, units: 0 };
            const warehouseNames = warehouseNamesForBranch(branchDetail);
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Almacenes</p>
                    <p className="mt-1 text-sm font-black">{stats.warehouses}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Vinculados</p>
                    <p className="mt-1 truncate text-sm font-black">{warehouseNames.length > 0 ? warehouseNames.join(', ') : 'Sin almacenes'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Productos</p>
                    <p className="mt-1 text-xl font-black tabular-nums">{stats.products}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Unidades</p>
                    <p className="mt-1 text-xl font-black tabular-nums">{stats.units}</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
      <ProductDetailDrawer
        productId={productDetail?.id ?? null}
        onOpenChange={(open) => !open && setProductDetail(null)}
        productSnapshot={productDetail}
        warehouses={warehouses}
        movements={movements}
        series={series}
      />
      <AddProductsModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        categories={categories}
        warehouses={warehouses}
        onRefresh={onRefresh}
        itemType={catalogItemType}
      />
      <Dialog open={bulkImageModalOpen} onOpenChange={(open) => {
        if (bulkImageUploading) return;
        setBulkImageModalOpen(open);
        if (!open) {
          setBulkImageFileName('');
          setBulkImageEntries(new Map());
          setBulkImageProducts([]);
          setBulkImageMissingSkus([]);
          setBulkImageResults(null);
          setBulkImageProgress(0);
        }
      }}>
        <DialogContent className="w-[calc(100vw-2rem)] !max-w-2xl">
          <DialogHeader data-tour="inventory-bulk-images-title">
            <DialogTitle className="flex items-center gap-2"><ImageIcon className="size-5 text-primary" /> Carga masiva de imágenes</DialogTitle>
            <DialogDescription>
              Esta opción queda disponible permanentemente en Productos, incluso después de completar la importación inicial. Permite reemplazar o asignar imágenes a productos existentes sin modificar sus datos, precios o existencias.
            </DialogDescription>
            <InventoryViewTutorial label="Cómo cargar imágenes" targetPrefix="inventory-bulk-images" copy={{ data: { description: 'Selecciona un archivo ZIP o RAR y verifica las coincidencias por SKU.' }, actions: { description: 'Actualiza las imágenes reconocidas después de revisar los resultados.' } }} />
          </DialogHeader>
          <div className="space-y-4" data-tour="inventory-bulk-images-data">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
              <p className="font-bold">Cómo funciona</p>
              <ul className="mt-2 space-y-1.5 text-muted-foreground">
                <li>• Sube un archivo ZIP o RAR; también se aceptan imágenes dentro de subcarpetas.</li>
                <li>• Cada imagen debe ser JPG, JPEG o PNG y llamarse exactamente como el SKU del producto, por ejemplo <span className="font-mono text-foreground">ABC-001.png</span>.</li>
                <li>• La coincidencia ignora mayúsculas y espacios al inicio o al final. Solo se actualizarán los SKU existentes; los demás se omitirán.</li>
                <li>• Si el producto ya tiene imagen, la nueva la reemplaza. Las imágenes de productos que no estén en el archivo no cambian.</li>
              </ul>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold">Archivo de imágenes</p>
                <p className="text-xs text-muted-foreground">ZIP o RAR · JPG, JPEG y PNG · asociación por SKU</p>
                {bulkImageFileName && <p className="mt-1 truncate text-xs font-medium text-emerald-600" title={bulkImageFileName}>{bulkImageFileName}</p>}
              </div>
              <Button type="button" variant="outline" className="shrink-0" onClick={() => bulkImageInputRef.current?.click()} disabled={bulkImageProcessing || bulkImageUploading}>
                <Upload className="mr-2 size-4" /> {bulkImageFileName ? 'Cambiar archivo' : 'Seleccionar ZIP/RAR'}
              </Button>
              <input ref={bulkImageInputRef} type="file" className="hidden" accept=".zip,.rar,application/zip,application/vnd.rar,application/x-rar-compressed" disabled={bulkImageProcessing || bulkImageUploading} onChange={(event) => { if (event.target.files?.[0]) handleBulkImageArchiveSelected(event.target.files[0]); event.currentTarget.value = ''; }} />
            </div>
            {bulkImageProcessing && <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">Leyendo el archivo y buscando productos por SKU…</div>}
            {bulkImageFileName && !bulkImageProcessing && <div className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
              <div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-foreground">{bulkImageEntries.size}</p><p className="text-xs text-muted-foreground">Imágenes reconocidas</p></div>
              <div className="rounded-xl border bg-emerald-500/5 p-3"><p className="text-2xl font-black text-emerald-600">{bulkImageProducts.length}</p><p className="text-xs text-muted-foreground">Productos encontrados</p></div>
              <div className="rounded-xl border bg-amber-500/5 p-3"><p className="text-2xl font-black text-amber-600">{bulkImageMissingSkus.length}</p><p className="text-xs text-muted-foreground">SKU omitidos</p></div>
            </div>}
            {bulkImageMissingSkus.length > 0 && <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300"><p className="font-bold">No se encontraron estos SKU:</p><p className="mt-1 break-words font-mono">{bulkImageMissingSkus.slice(0, 20).join(', ')}{bulkImageMissingSkus.length > 20 ? ` y ${bulkImageMissingSkus.length - 20} más` : ''}</p></div>}
            {bulkImageResults && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm"><p className="font-bold text-emerald-700 dark:text-emerald-300">{bulkImageResults.updated} imagen(es) actualizada(s)</p>{bulkImageResults.failed.length > 0 && <p className="mt-1 text-xs text-rose-600">Con incidencia: {bulkImageResults.failed.join(', ')}</p>}</div>}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between" data-tour="inventory-bulk-images-actions">
            <Button variant="outline" onClick={() => setBulkImageModalOpen(false)} disabled={bulkImageUploading}>Cerrar</Button>
            <Button onClick={handleBulkImageUpload} disabled={bulkImageProcessing || bulkImageUploading || bulkImageProducts.length === 0}>
              {bulkImageUploading ? `Actualizando… ${bulkImageProgress}%` : `Actualizar ${bulkImageProducts.length} producto(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={initialImportIntroOpen} onOpenChange={setInitialImportIntroOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader data-tour="inventory-initial-import-title">
            <DialogTitle>Importación inicial de inventario</DialogTitle>
            <DialogDescription>
              Esta carga se realiza una sola vez por sucursal. Primero descarga la plantilla, completa los datos y después revisa la previsualización antes de confirmar. Las imágenes opcionales pueden cargarse en ZIP o RAR.
            </DialogDescription>
            <InventoryViewTutorial label="Cómo importar inventario" targetPrefix="inventory-initial-import" copy={{ data: { description: 'Descarga la plantilla, prepara productos, precios, costos, stock e imágenes y revisa las reglas.' }, actions: { description: 'Descarga la plantilla o continúa con la carga para iniciar la importación.' } }} />
          </DialogHeader>
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4 text-sm" data-tour="inventory-initial-import-data">
            <p><b>La plantilla siempre incluye:</b> {canViewInventoryCost ? 'costo, ' : ''}Minorista, Mayorista, Distribuidor y Bodega.</p>
            <p>Cada producto debe tener SKU único, nombre, categoría, {canViewInventoryCost ? 'costo y ' : ''}al menos uno de los tres precios. Los precios faltantes serán advertencias.</p>
            <p>Opcionalmente puedes cargar un ZIP o RAR con imágenes JPG, JPEG o PNG cuyo nombre sea exactamente el SKU.</p>
          </div>
          <DialogFooter data-tour="inventory-initial-import-actions">
            <Button variant="outline" onClick={handleDownloadTemplate}><Download className="size-4 mr-2" />Descargar plantilla</Button>
            <Button onClick={() => { setInitialImportIntroOpen(false); setImportModalOpen(true); }}>Continuar con la carga</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {showTutorial && <GuidedTour
        steps={PRODUCTS_TOUR_STEPS.filter((step) => !(step.title === 'Importar catálogo inicial' && (isServiceView || initialImportCompleted || products.length > 0)))}
        onClose={() => setShowTutorial(false)}
        title="Productos"
        allowTargetInteraction
      />}
      <Dialog open={importModalOpen} onOpenChange={(open) => {
        if (!importing && !previewLoading) {
          setImportModalOpen(open);
          if (!open) { setImportPreviewOpen(false); setImportData([]); setImportFileName(''); setImageArchiveFileName(''); setImageArchiveEntries(new Map()); setImportProgress(0); }
        }
      }}>
        <DialogContent className="w-[calc(100vw-2rem)] !max-w-[1100px] sm:!max-w-[1100px] max-h-[90vh] flex flex-col">
          <DialogHeader data-tour="inventory-import-title">
            <DialogTitle>Importar Productos</DialogTitle>
            <DialogDescription>
              Sube el catálogo inicial de la sucursal. Esta carga es única por sucursal y se confirma en dos pasos.
            </DialogDescription>
            <InventoryViewTutorial label="Cómo importar productos" targetPrefix="inventory-import" copy={{ data: { description: 'Configura moneda, tasa, archivo, imágenes y bodega de destino; luego revisa la previsualización del catálogo.' }, actions: { description: 'Carga el archivo y abre la previsualización antes de confirmar.' } }} />
          </DialogHeader>
          <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-3" data-tour="inventory-import-data">
            <div><p className="mb-1 text-[10px] font-black uppercase text-muted-foreground">Listas incluidas</p><p className="h-9 flex items-center text-xs font-semibold">Minorista · Mayorista · Distribuidor</p></div>
            <div><p className="mb-1 text-[10px] font-black uppercase text-muted-foreground">Moneda del archivo</p><Select value={importCurrency} onValueChange={setImportCurrency}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NIO">Córdoba (NIO)</SelectItem><SelectItem value="USD">Dólar (USD)</SelectItem></SelectContent></Select></div>
            <div><p className="mb-1 text-[10px] font-black uppercase text-muted-foreground">Tasa USD / moneda base</p><Input className="h-9 text-xs" type="number" min="0.0001" step="any" value={importExchangeRate} onChange={(event) => setImportExchangeRate(Number(event.target.value) || 1)} disabled={importCurrency === 'NIO'} /></div>
          </div>
          {importProcessing && <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">Procesando archivo, espera un momento...</div>}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed p-3">
            <div className="min-w-0">
              <p className="text-xs font-bold">Imágenes de productos (opcional)</p>
              <p className="whitespace-normal text-[11px] text-muted-foreground">ZIP o RAR con archivos JPG, JPEG o PNG nombrados exactamente como el SKU. Se permiten subcarpetas y la asociación no distingue mayúsculas.</p>
              {imageArchiveFileName && <p className="mt-1 text-[11px] text-emerald-600">{imageArchiveFileName} · {imageArchiveEntries.size} imagen(es) reconocida(s)</p>}
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => imageArchiveInputRef.current?.click()} disabled={importing || importProcessing}>
              <Upload className="size-3 mr-2" />{imageArchiveFileName ? 'Cambiar ZIP/RAR' : 'Cargar ZIP/RAR'}
            </Button>
            <input type="file" className="hidden" accept=".zip,.rar,application/zip,application/vnd.rar,application/x-rar-compressed" ref={imageArchiveInputRef} onChange={(e) => { if (e.target.files?.[0]) handleImageArchiveSelected(e.target.files[0]); e.currentTarget.value = ''; }} />
          </div>
          
          <div className="flex-1 overflow-auto min-h-0 space-y-4 py-2">
            {!importFileName ? (
              <div className="space-y-4">
                <div 
                  className={`border-2 border-dashed border-primary/20 rounded-xl p-8 transition-colors text-center flex flex-col items-center gap-3 ${importProcessing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-primary/5'}`}
                  onClick={() => !importProcessing && fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!importProcessing && e.dataTransfer.files?.[0]) handleFileSelected(e.dataTransfer.files[0]);
                  }}
                >
                  <div className="size-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <FileSpreadsheet className="size-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">Haz clic para buscar un archivo</p>
                    <p className="text-xs text-muted-foreground mt-1">O arrástralo y suéltalo aquí</p>
                  </div>
                  <input type="file" className="hidden" accept=".xlsx,.xls,.csv" ref={fileInputRef} disabled={importProcessing || importing} onChange={(e) => {
                    if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
                  }} />
                </div>
              </div>
            ) : !importPreviewOpen ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                <FileSpreadsheet className="size-10 text-primary" />
                <div>
                  <p className="font-semibold">Archivo cargado correctamente</p>
                  <p className="mt-1 text-xs text-muted-foreground">La previsualización permanece oculta hasta que presiones el botón.</p>
                  <p className="mt-2 text-xs font-medium">{importFileName} · {importData.length} registro(s){imageArchiveFileName ? ` · ${imageArchiveFileName}` : ''}</p>
                </div>
                {importProcessing && <p className="text-xs text-primary">Procesando archivo, espera un momento...</p>}
              </div>
            ) : (
              <div className="space-y-4 flex flex-col h-full">
                <div className="flex items-center justify-between">
                  <p className="text-sm">
                    Archivo: <span className="font-semibold">{importFileName}</span> 
                    <span className="text-muted-foreground ml-2">({importData.length} filas válidas)</span>
                  </p>
                  <div className="flex gap-1"><Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleDownloadImportErrors} disabled={!importData.some((row) => row._hasError || row._hasWarning)}>Descargar incidencias</Button><Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setImportFileName(''); setImportData([]); }} disabled={importing}>Cambiar archivo</Button></div>
                </div>

                <div className="border rounded-md flex-1 overflow-auto">
                  <div className="min-w-[900px]">
                    <Table>
                      <TableHeader className="bg-muted sticky top-0 z-10 shadow-sm">
                        <TableRow>
                          <TableHead className="text-[10px] uppercase w-8"></TableHead>
                          <TableHead className="text-[10px] uppercase w-32">Código</TableHead>
                          <TableHead className="text-[10px] uppercase">Nombre</TableHead>
                            <TableHead className="text-[10px] uppercase w-32">Categoría</TableHead>
                          <TableHead className="text-[10px] uppercase w-28 text-right">Unidad</TableHead>
                          <TableHead className="text-[10px] uppercase w-28 text-right">Minorista</TableHead>
                          <TableHead className="text-[10px] uppercase w-28 text-right">Mayorista</TableHead>
                          <TableHead className="text-[10px] uppercase w-28 text-right">Distribuidor</TableHead>
                          {canViewInventoryCost && <TableHead className="text-[10px] uppercase w-28 text-right">Costo</TableHead>}
                          <TableHead className="text-[10px] uppercase w-24 text-right">Stock</TableHead>
                          <TableHead className="text-[10px] uppercase w-24 text-right">Min</TableHead>
                          <TableHead className="text-[10px] uppercase w-32">Bodega</TableHead>
                          <TableHead className="text-[10px] uppercase w-36">Validación</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importData.slice(0, 100).map((row, i) => (
                          <TableRow key={i} className={row._hasError ? 'bg-red-500/10' : row._hasWarning ? 'bg-amber-500/5' : ''}>
                            <TableCell>
                              {row._hasError ? (
                                <AlertTriangle className="size-4 text-red-500" />
                              ) : row._hasWarning ? (
                                <AlertTriangle className="size-4 text-amber-500" />
                              ) : (
                                <Check className="size-4 text-emerald-500" />
                              )}
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                value={row.code}
                                onChange={(e) => handleImportRowUpdate(i, 'code', e.target.value)}
                                className={`h-8 text-xs font-mono ${!row.code ? 'border-red-500' : ''}`}
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                value={row.name}
                                onChange={(e) => handleImportRowUpdate(i, 'name', e.target.value)}
                                className={`h-8 text-xs ${!row.name ? 'border-red-500' : ''}`}
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              {importCategoryOptions.some((category: any) => category.name?.toLowerCase() === String(row.category || '').trim().toLowerCase()) ? (
                                <Input
                                  value={row.category}
                                  onChange={(e) => handleImportRowUpdate(i, 'category', e.target.value)}
                                  className="h-8 text-xs"
                                />
                              ) : (
                                <div className="flex items-center gap-1">
                                  <Select value="__none__" onValueChange={(value) => {
                                    const category = importCategoryOptions.find((item: any) => item.id === value);
                                    if (category) handleImportRowUpdate(i, 'category', category.name);
                                  }}>
                                    <SelectTrigger className="h-8 min-w-0 flex-1 border-amber-500/60 text-xs text-amber-600"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">{row.category ? `No existe: ${row.category}` : 'Seleccionar categoría'}</SelectItem>
                                      {importCategoryOptions.map((category: any) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  {canPerform('INVENTORY', 'edit') && <Button type="button" variant="outline" size="sm" className="h-8 w-8 shrink-0 rounded-lg p-0 text-amber-600" title="Crear esta categoría" aria-label="Crear esta categoría" onClick={() => {
                                    setPendingCategoryRowIndex(i);
                                    setNewCategoryName(row.category || '');
                                    setNewCategoryDescription('');
                                    setCategoryModalOpen(true);
                                  }}><Plus className="size-3.5" /></Button>}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                value={row.unit ?? ''}
                                onChange={(e) => handleImportRowUpdate(i, 'unit', e.target.value)}
                                className="h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                type="number"
                                min={0}
                                value={row.prices?.RETAIL ?? ''}
                                onChange={(e) => handleImportRowUpdate(i, 'price.RETAIL', e.target.value)}
                                className="h-8 text-xs text-right"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input type="number" min={0} value={row.prices?.WHOLESALE ?? ''} onChange={(e) => handleImportRowUpdate(i, 'price.WHOLESALE', e.target.value)} className="h-8 text-xs text-right" />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input type="number" min={0} value={row.prices?.DISTRIBUTOR ?? ''} onChange={(e) => handleImportRowUpdate(i, 'price.DISTRIBUTOR', e.target.value)} className="h-8 text-xs text-right" />
                            </TableCell>
                            {canViewInventoryCost && <TableCell className="p-1">
                              <Input type="number" min={0} value={row.costPrice ?? ''} onChange={(e) => handleImportRowUpdate(i, 'costPrice', e.target.value)} className="h-8 text-xs text-right" />
                            </TableCell>}
                            <TableCell className="p-1">
                              <Input
                                type="number"
                                min={0}
                                value={row.initialStock ?? ''}
                                onChange={(e) => handleImportRowUpdate(i, 'initialStock', Number(e.target.value) || 0)}
                                aria-label="Stock inicial"
                                title="Edita el stock inicial antes de confirmar la importación"
                                className="h-8 text-xs text-right"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input type="number" min={0} value={row.minStock} onChange={(e) => handleImportRowUpdate(i, 'minStock', Number(e.target.value) || 0)} className="h-8 text-xs text-right" />
                            </TableCell>
                            <TableCell className="p-1 text-center">
                              {!row.warehouse || importWarehouseOptions.some((warehouse: any) => warehouse.name?.toLowerCase() === String(row.warehouse || '').trim().toLowerCase()) ? (
                                <Select value={row.warehouse || '__none__'} onValueChange={(value) => handleImportRowUpdate(i, 'warehouse', value === '__none__' ? '' : value)}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar bodega" /></SelectTrigger><SelectContent><SelectItem value="__none__">Sin bodega</SelectItem>{importWarehouseOptions.length === 0 && <SelectItem value="__no_warehouses__" disabled>No hay bodegas</SelectItem>}{importWarehouseOptions.map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.name}>{warehouse.name}</SelectItem>)}</SelectContent></Select>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <Select value="__none__" onValueChange={(value) => handleImportRowUpdate(i, 'warehouse', value === '__none__' ? '' : value)}>
                                    <SelectTrigger className="h-8 min-w-0 flex-1 border-amber-500/60 text-xs text-amber-600"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">{`No existe: ${row.warehouse}`}</SelectItem>
                                      {importWarehouseOptions.map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.name}>{warehouse.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  {canPerform('INVENTORY', 'edit') && <Button type="button" variant="outline" size="sm" className="h-8 w-8 shrink-0 rounded-lg p-0 text-amber-600" title="Crear esta bodega" aria-label="Crear esta bodega" onClick={() => {
                                    setPendingWarehouseRowIndex(i);
                                    setNewWarehouseName(row.warehouse || '');
                                    setNewWarehouseLocation('');
                                    setNewWarehouseType('STORE');
                                    setNewWarehouseParentId('none');
                                    setNewWarehouseInventoryAccountId('none');
                                    setWarehouseModalOpen(true);
                                  }}><Plus className="size-3.5" /></Button>}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="p-1 text-xs"><span className={row._hasError ? 'text-red-600' : row._hasWarning ? 'text-amber-600' : 'text-emerald-600'}>{row._errorMessage || row._warningMessage || 'Correcto'}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {importData.length > 100 && (
                    <p className="text-xs text-center p-2 text-muted-foreground border-t bg-muted/20">
                      Mostrando 100 de {importData.length} filas
                    </p>
                  )}
                </div>
                {importing && (
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="mb-2 text-sm font-semibold">Columnas soportadas:</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <p>• <b>Código</b> (requerido)</p>
                <p>• <b>Nombre</b> (requerido)</p>
                <p>• <b>Categoría</b></p>
                <p>• <b>Precios por lista</b></p>
                {canViewInventoryCost && <p>• <b>Costo</b></p>}
                <p>• <b>Stock Inicial</b></p>
                <p>• <b>IMEI</b> (Si/No)</p>
              </div>
              <Button variant="outline" size="sm" className="mt-4 w-full text-xs font-bold" onClick={handleDownloadTemplate}>
                <Download className="mr-2 size-3" />
                Descargar Plantilla de Ejemplo
              </Button>
            </div>
          </div>
          <DialogFooter className="mt-2 pt-2 border-t" data-tour="inventory-import-actions">
            <Button variant="outline" onClick={() => setImportModalOpen(false)} disabled={importing || previewLoading}>
              Cerrar
            </Button>
            {importFileName && (
              <Button 
                onClick={handleOpenImportPreview}
                disabled={importing || importProcessing || previewLoading || importData.length === 0}
                className="bg-primary text-primary-foreground font-bold"
              >
                {previewLoading ? <><Loader2 className="mr-2 size-3.5 animate-spin" />Cargando previsualización...</> : importProcessing ? 'Procesando archivos...' : 'Previsualizar importación'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
        </Dialog>

      <Dialog open={initialImportConfirmOpen && !importing} onOpenChange={setInitialImportConfirmOpen}>
        <DialogContent>
          <DialogHeader data-tour="inventory-initial-confirm-title">
            <DialogTitle>Formalizar importación inicial</DialogTitle>
            <DialogDescription>Esta acción creará {importData.filter((row) => !row._hasError).length} productos y omitirá {importData.filter((row) => row._hasError).length} fila(s) con errores. No podrá repetirse para esta empresa. Los precios Minorista, Mayorista y Distribuidor se guardarán en {importCurrency}; las listas sin precio quedarán pendientes. Escribe IMPORTAR para confirmar.</DialogDescription>
            <InventoryViewTutorial label="Cómo confirmar importación" targetPrefix="inventory-initial-confirm" copy={{ data: { description: 'Escribe IMPORTAR únicamente después de revisar las filas válidas, errores y advertencias.' }, actions: { description: 'Confirma la importación para crear el catálogo inicial.' } }} />
          </DialogHeader>
          <div data-tour="inventory-initial-confirm-data"><Input value={initialImportConfirmText} onChange={(event) => setInitialImportConfirmText(event.target.value.toUpperCase())} placeholder="IMPORTAR" autoFocus /></div>
          <DialogFooter data-tour="inventory-initial-confirm-actions"><Button variant="outline" onClick={() => setInitialImportConfirmOpen(false)}>Cancelar</Button><Button onClick={handleFinalInitialImport} disabled={initialImportConfirmText !== 'IMPORTAR' || importing}>Confirmar importación</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportProgressOverlay open={importing} progress={importProgress} title="Importando productos" description="Estamos guardando el catálogo y sus precios. No cierres esta ventana." />
      <ImportProgressOverlay open={bulkImageUploading} progress={bulkImageProgress} title="Actualizando imágenes" description="Subiendo y vinculando las imágenes con los productos por SKU. No cierres esta ventana." />


      <Dialog open={importResults !== null} onOpenChange={(open) => { if (!open) setImportResults(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader data-tour="inventory-request-title">
            <div className="flex flex-col items-center gap-3 py-3 text-center">
              <div className="flex size-20 animate-in zoom-in items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 duration-500">
                <CheckCircle2 className="size-12 animate-pulse" />
              </div>
              <DialogTitle className="text-xl">Importación completada</DialogTitle>
              <DialogDescription>El inventario ya está disponible y la vista se actualizó correctamente.</DialogDescription>
            </div>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-emerald-500">{importResults?.success || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Importados</p></div>
            <div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-amber-500">{importResults?.skipped || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Omitidos</p></div>
            <div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-rose-500">{importResults?.failed || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Incidencias</p></div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => setImportResults(null)}>Continuar al inventario</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportProgressOverlay
        open={previewLoading}
        progress={previewProgress}
        title="Preparando previsualización"
        description="Leyendo el archivo, validando columnas y preparando los registros para edición."
      />

      <Dialog open={expandedProductImage !== null} onOpenChange={(open) => { if (!open) setExpandedProductImage(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] !max-w-5xl border-0 bg-transparent p-2 shadow-none">
          <DialogTitle className="sr-only">Imagen del producto</DialogTitle>
          {expandedProductImage && (
            <img
              src={expandedProductImage.src}
              alt={expandedProductImage.alt}
              className="max-h-[85vh] w-full rounded-2xl object-contain shadow-2xl"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={solicitudOpen} onOpenChange={(o) => { if (!o && !solicitudCreating) setSolicitudOpen(false); }}>
        <DialogContent className="sm:max-w-3xl max-h-[82vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageSearch className="size-4" /> Solicitud de Compra ({solicitudProducts.length} productos)
            </DialogTitle>
            <DialogDescription>
              Revisa y ajusta la cantidad a solicitar de cada producto. La solicitud se guardará en Compras &gt; Solicitudes.
            </DialogDescription>
            <InventoryViewTutorial label="Cómo crear solicitud de compra" targetPrefix="inventory-request" copy={{ data: { description: 'Selecciona empleado, bodega, justificación, fecha, prioridad y productos a solicitar.' }, actions: { description: 'Crea la solicitud para enviarla al flujo de Compras.' } }} />
          </DialogHeader>
          <div className="space-y-4" data-tour="inventory-request-data">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Empleado solicitante *</label>
                <Select value={solicitudEmployeeId} onValueChange={setSolicitudEmployeeId} disabled={solicitudCreating || solicitudEmployeesLoading}>
                  <SelectTrigger className="h-9"><SelectValue placeholder={solicitudEmployeesLoading ? 'Cargando...' : 'Seleccionar...'} /></SelectTrigger>
                  <SelectContent>
                    {solicitudEmployees.length === 0 && <SelectItem value="__none__" disabled>No hay empleados registrados</SelectItem>}
                    {solicitudEmployees.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Bodega destino *</label>
                <Select value={solicitudWarehouseId} onValueChange={setSolicitudWarehouseId} disabled={solicitudCreating}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {warehouses.length === 0 && <SelectItem value="__none__" disabled>No hay bodegas registradas</SelectItem>}
                    {warehouses.map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Justificación</label>
                <Input className="h-9" value={solicitudJustification} onChange={(e) => setSolicitudJustification(e.target.value)} placeholder="Motivo de la solicitud..." />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Fecha requerida</label>
                <Input type="date" className="h-9" value={solicitudRequiredDate} onChange={(e) => setSolicitudRequiredDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Prioridad</label>
                <Select value={solicitudPriority} onValueChange={setSolicitudPriority} disabled={solicitudCreating}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                    <SelectItem value="CRITICAL">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.03] p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <label htmlFor="solicitud-product-search" className="text-xs font-black uppercase tracking-wide">Agregar productos</label>
                  <p className="text-[11px] text-muted-foreground">Busca por nombre o código y agrégalos a la solicitud.</p>
                </div>
                <Badge variant="secondary" className="w-fit text-[10px]">{solicitudCatalogProducts.length} resultados</Badge>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="solicitud-product-search"
                  value={solicitudProductSearch}
                  onChange={(event) => setSolicitudProductSearch(event.target.value)}
                  placeholder="Buscar producto por nombre o código..."
                  className="h-10 bg-background pl-9 pr-9"
                  disabled={solicitudCreating}
                  autoComplete="off"
                />
                {solicitudProductSearch && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setSolicitudProductSearch('')}
                    aria-label="Limpiar búsqueda de productos"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-background/70 p-1">
                {solicitudCatalogLoading ? (
                  <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Buscando productos...
                  </div>
                ) : solicitudCatalogProducts.length > 0 ? (
                  <div className="grid gap-1 sm:grid-cols-2">
                    {solicitudCatalogProducts.map((product: any) => {
                      const isAdded = solicitudProducts.some(item => item.productId === product.id);
                      return (
                        <div key={product.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg px-2.5 py-2 hover:bg-muted/50">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">{product.name}</p>
                            <p className="truncate font-mono text-[10px] text-muted-foreground">
                              {product.code || 'Sin código'} · Stock: {Number(product.stock ?? 0)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant={isAdded ? 'secondary' : 'outline'}
                            size="sm"
                            className="h-8 shrink-0 gap-1 px-2 text-[10px] font-bold"
                            onClick={() => addSolicitudProduct(product)}
                            disabled={isAdded || solicitudCreating}
                            aria-label={isAdded ? `${product.name} ya agregado` : `Agregar ${product.name}`}
                          >
                            {isAdded ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                            {isAdded ? 'Agregado' : 'Agregar'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">No se encontraron productos.</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold">Productos</label>
                <Badge variant="secondary" className="text-[10px]">{solicitudProducts.length} items</Badge>
              </div>
              {solicitudProducts.length > 0 ? (
                <div className="overflow-x-auto border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-black text-[10px] uppercase">Producto</TableHead>
                        <TableHead className="font-black text-[10px] uppercase text-right">Stock</TableHead>
                        <TableHead className="font-black text-[10px] uppercase text-right">Min</TableHead>
                        <TableHead className="font-black text-[10px] uppercase text-right w-28">Cantidad a solicitar</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {solicitudProducts.map((item) => (
                        <TableRow key={item.productId}>
                          <TableCell className="font-medium text-xs min-w-0">
                            <span className="truncate block">{item.productName}</span>
                            <span className="text-muted-foreground font-mono text-[10px]">{item.code}</span>
                          </TableCell>
                          <TableCell className={`text-right text-xs tabular-nums ${item.currentStock <= item.minStock ? 'text-orange-500 font-bold' : ''}`}>{item.currentStock}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums">{item.minStock}</TableCell>
                          <TableCell className="text-right">
                            <Input type="number" min={1} className="h-8 w-24 ml-auto text-right text-xs" value={item.quantity}
                              onChange={(e) => updateSolicitudQuantity(item.productId, Number(e.target.value))} disabled={solicitudCreating} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => removeSolicitudProduct(item.productId)}
                              disabled={solicitudCreating}
                              aria-label={`Quitar ${item.productName}`}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No hay productos.</p>
              )}
            </div>
          </div>
          <DialogFooter data-tour="inventory-request-actions">
            <Button variant="outline" onClick={() => setSolicitudOpen(false)} disabled={solicitudCreating}>Cancelar</Button>
            <Button onClick={handleCreateSolicitud} disabled={solicitudCreating || solicitudProducts.length === 0 || !solicitudWarehouseId || !solicitudEmployeeId}>
              {solicitudCreating && <Loader2 className="size-3.5 mr-1 animate-spin" />}
              <Send className="size-3.5 mr-1" /> Crear Solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LabelPrintModal
        open={labelModalOpen}
        onClose={() => setLabelModalOpen(false)}
        products={products.filter((p: any) => String(p.itemType || p.type || 'PRODUCT').toUpperCase() === 'PRODUCT')}
        companyName={user?.tenantName || 'Nova Hub'}
      />

      </Card>
    </>
    );
}
