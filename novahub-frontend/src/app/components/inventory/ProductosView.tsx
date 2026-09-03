import { memo, startTransition, useEffect, useMemo, useState, useRef, useCallback, type ComponentProps } from 'react';
import { Search, Plus, Ban, X, Check, CheckCircle2, Package, Upload, FileSpreadsheet, AlertTriangle, Download, Pencil, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Square, SquareCheckBig, Minus, Image as ImageIcon, ImageOff, CircleHelp, Loader2, Send, PackageSearch, Warehouse as WarehouseIcon, Store, Copy, Barcode, SlidersHorizontal, Tag } from 'lucide-react';
import * as XLSX from 'xlsx';
import { extractProductImageArchive, productImageKey, PRODUCT_IMAGE_ARCHIVE_EXTENSIONS } from '../../utils/product-image-archive';
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
import { SalesKpiCard } from '../ventas/SalesKpiCard';
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
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
import type { SalesPaginationControls } from '../../types';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { InventoryViewTutorial } from './InventoryViewTutorial';
import { VirtualizedImportList, useVirtualizedImportRows } from '../ui/VirtualizedImportList';
import { parseSpreadsheetInWorker } from '../../utils/import-spreadsheet';
import { buildVariantImportPreviewRows, parseVariantImportWorkbook, type VariantImportCatalog } from '../../utils/variant-import';
import { downloadCanonicalVariantImportTemplate } from '../../utils/variant-import-template';
import { normalizePurchasePriority, PURCHASE_PRIORITY_OPTIONS } from '../../utils/purchasePriority';
import { useDetailOpeningFeedback } from '../../hooks/useDetailOpeningFeedback';
import { formatExchangeRate } from '../../utils/currency';
import { priceListsService, type PriceList } from '../../services/price-lists.service';

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

const DEFAULT_IMPORT_PRICE_LISTS: Array<Pick<PriceList, 'code' | 'name'>> = [
  { code: 'RETAIL', name: 'Minorista' },
  { code: 'WHOLESALE', name: 'Mayorista' },
  { code: 'DISTRIBUTOR', name: 'Distribuidor' },
];

const normalizePriceListImportKey = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const getImportCurrencySymbol = (currency: string) => String(currency || '').toUpperCase() === 'USD' ? '$' : 'C$';

const formatImportAmount = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
};

type ImportMoneyInputProps = ComponentProps<typeof Input> & { currencySymbol: string };

const ImportMoneyInput = ({ currencySymbol, className = '', ...props }: ImportMoneyInputProps) => (
  <div className="relative min-w-0">
    <span className="pointer-events-none absolute inset-y-0 left-2 z-10 flex items-center text-[10px] font-semibold text-muted-foreground">{currencySymbol}</span>
    <Input {...props} className={`${className} pl-7`} />
  </div>
);

const PRODUCTS_TOUR_STEPS: GuidedTourStep[] = [
  { target: '[data-tour="inventory-products-title"]', title: 'Vista de Productos', description: 'Aquí administras el catálogo, el costo, el stock y la distribución por bodega. Los precios de venta se gestionan desde Listas de precios.', placement: 'bottom' },
  { target: '[data-tour="inventory-products-kpis"]', title: 'Indicadores y filtros rápidos', description: 'Cada tarjeta identifica si es un Filtro o un Indicador. En Productos, las tarjetas de existencias filtran la lista; en Servicios, los valores de referencia solo informan.', placement: 'bottom' },
  { target: '[data-tour="inventory-products-filter-toggle"]', title: 'Filtros del catálogo', description: 'Los filtros permanecen ocultos para dejar la vista despejada. Pulsa este botón para desplegar la búsqueda, bodegas, estado, unidad, impuesto y stock; si hay filtros activos, verás el contador aquí.', placement: 'bottom' },
  { target: '[data-tour="inventory-products-actions"]', title: 'Acciones del catálogo', description: 'Estas acciones permanecen disponibles en todo momento: crear productos, importar el catálogo, actualizar imágenes, solicitar una compra, imprimir etiquetas y abrir la ayuda de Inventario.', placement: 'bottom' },
  { target: '[data-tour="inventory-products-actions"]', title: 'Imágenes e importación', description: 'El botón para importar productos permanece disponible en esta vista y puede utilizarse varias veces. La carga masiva de imágenes también puede utilizarse en cualquier momento y en ambos casos usa ZIP o RAR con archivos llamados como el SKU.', tip: 'Los errores se omiten y los precios faltantes se muestran como avisos.', placement: 'bottom' },
  { target: '[data-tour="inventory-products-table"]', title: 'Registros y edición', description: 'Consulta los productos, edita únicamente los campos permitidos y abre el detalle haciendo clic en el registro o en su imagen.', placement: 'top' },
  { target: '[data-tour="inventory-products-pagination"]', title: 'Paginación', description: 'Selecciona 50, 100 o 200 registros, revisa el rango mostrado y utiliza los controles para ir al inicio, anterior, siguiente o final.', placement: 'top' },
];

export type ProductStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const PRODUCT_TABLE_WIDTHS = {
  selector: '40px',
  code: '112px',
  name: '224px',
  note: '180px',
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

const SOLICITUD_PAGE_SIZE = 50;

const normalizeImportHeader = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const hasProductVariants = (product: any) => {
  if (product?.isVariable === true) return true;
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (variants.length > 1) return true;
  return variants.some((variant: any) =>
    (Array.isArray(variant?.attributes) && variant.attributes.length > 0)
    || String(variant?.sku || '').trim().toLowerCase() !== String(product?.code || '').trim().toLowerCase()
    || String(variant?.name || '').trim().toLowerCase() !== 'estándar',
  );
};

interface ProductosViewProps {
  products: any[];
  summaryProducts?: any[];
  categories: any[];
  warehouses?: any[];
  productWarehouseOptions?: any[];
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
  stockWarehouseIds?: string[];
  unitFilter?: string;
  taxRateFilter?: string;
  stockStatusFilter?: string;
}

interface EditingProduct {
  id: string;
  code: string;
  name: string;
  description?: string;
  commercialNote?: string | null;
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
  advancedCatalog?: VariantImportCatalog | null;
  importFileName: string;
  importCurrency: string;
  categoryOptions: any[];
  warehouseOptions: any[];
  importing: boolean;
  importProgress: number;
  onRowUpdate: (index: number, field: string, value: any) => void;
  onStockWarehouseUpdate: (catalogIndex: number, warehouseName: string) => void;
  onDownloadErrors: () => void;
  onCreateCategory: (index: number, value: string) => void;
  canCreateCategory: boolean;
  onConfirm: () => void;
  onBack: () => void;
  onReady?: () => void;
  isService?: boolean;
  priceLists?: Array<Pick<PriceList, 'code' | 'name'>>;
}

interface ProductImportPreviewRowProps {
  row: any;
  index: number;
  start: number;
  gridTemplate: string;
  categoryNames: Set<string>;
  warehouseNames: Set<string>;
  categoryOptions: any[];
  warehouseOptions: any[];
  importing: boolean;
  canViewInventoryCost: boolean;
  canCreateCategory: boolean;
  onRowUpdate: (index: number, field: string, value: any) => void;
  onCreateCategory: (index: number, value: string) => void;
  isService?: boolean;
  priceLists: Array<Pick<PriceList, 'code' | 'name'>>;
  currencySymbol: string;
}

const ProductImportPreviewRow = memo(function ProductImportPreviewRow({
  row,
  index,
  start,
  gridTemplate,
  categoryNames,
  warehouseNames,
  categoryOptions,
  warehouseOptions,
  importing,
  canViewInventoryCost,
  canCreateCategory,
  onRowUpdate,
  onCreateCategory,
  isService = false,
  priceLists,
  currencySymbol,
}: ProductImportPreviewRowProps) {
  const categoryExists = categoryNames.has(String(row.category || '').trim().toLowerCase());
  const warehouseExists = !row.warehouse || warehouseNames.has(String(row.warehouse || '').trim().toLowerCase());
  const isAdvanced = Boolean(row._advanced);
  const hasVariants = isAdvanced && (row._hasVariants === true || Number(row._variantCount || 0) > 0);

  return (
    <TableRow
      data-index={index}
      aria-busy={importing}
      style={{ display: 'grid', gridTemplateColumns: gridTemplate, position: 'absolute', left: 0, top: 0, width: '100%', height: isService ? '84px' : '58px', transform: `translateY(${start}px)` }}
      className={row._hasError ? 'bg-red-500/10' : row._hasWarning ? 'bg-amber-500/5' : ''}
    >
      <TableCell>{row._hasError ? <AlertTriangle className="size-4 text-red-500" /> : row._hasWarning ? <AlertTriangle className="size-4 text-amber-500" /> : <Check className="size-4 text-emerald-500" />}</TableCell>
      <TableCell className="p-1"><Input value={row.code} onChange={(event) => onRowUpdate(index, 'code', event.target.value)} className={`h-8 text-xs font-mono ${!row.code ? 'border-red-500' : ''}`} /></TableCell>
      <TableCell className="min-w-[220px] p-1"><div className={isService ? 'space-y-1' : undefined}><Input value={row.name} title={row.name} onChange={(event) => onRowUpdate(index, 'name', event.target.value)} className={`h-8 w-full text-xs ${!row.name ? 'border-red-500' : ''}`} />{isService && <Input value={row.description || ''} title={row.description || ''} onChange={(event) => onRowUpdate(index, 'description', event.target.value)} className="h-8 w-full text-xs" placeholder="Descripción" />}</div></TableCell>
      <TableCell className="min-w-[180px] p-1"><Input value={row.commercialNote || ''} maxLength={100} title={row.commercialNote || ''} onChange={(event) => onRowUpdate(index, 'commercialNote', event.target.value)} className="h-8 w-full text-xs" /></TableCell>
      <TableCell className="p-1 text-center">
        {row._imageStatus === 'matched' ? <span role="img" aria-label="Imagen vinculada" title="Imagen vinculada"><ImageIcon className="mx-auto size-4 text-emerald-500" /></span> : row._imageStatus === 'missing' ? <span role="img" aria-label="Imagen no vinculada" title="No se encontró una imagen con el mismo SKU"><ImageOff className="mx-auto size-4 text-red-500" /></span> : <span role="img" aria-label="Sin archivo de imágenes" title="No se cargó un ZIP o RAR de imágenes"><ImageOff className="mx-auto size-4 text-muted-foreground/50" /></span>}
      </TableCell>
      <TableCell className="p-1">
        {categoryExists ? (
          <Input value={row.category} onChange={(event) => onRowUpdate(index, 'category', event.target.value)} className="h-8 text-xs" />
        ) : (
          <div className="flex items-center gap-1">
            <Select value="__none__" onValueChange={(value) => { const category = categoryOptions.find((item: any) => item.id === value); if (category) onRowUpdate(index, 'category', category.name); }}>
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
      {isService && <TableCell className="p-1"><Input type="number" min={0} step="1" value={row.estimatedDuration ?? ''} onChange={(event) => onRowUpdate(index, 'estimatedDuration', event.target.value === '' ? undefined : Number(event.target.value))} aria-label="Duración estimada en minutos" className="h-8 text-right text-xs" /></TableCell>}
      {isService ? <TableCell className="p-1"><ImportMoneyInput type="number" min={0} value={row.salePrice ?? ''} onChange={(event) => onRowUpdate(index, 'servicePrice', event.target.value)} aria-label="Precio del servicio" className="h-8 text-right text-xs" currencySymbol={currencySymbol} /></TableCell> : priceLists.map((list) => <TableCell key={list.code} className="p-1"><ImportMoneyInput type="number" min={0} value={row.prices?.[list.code] ?? ''} onChange={(event) => onRowUpdate(index, `price.${list.code}`, event.target.value)} aria-label={`Precio ${list.name}`} className="h-8 text-right text-xs" currencySymbol={currencySymbol} /></TableCell>)}
      {canViewInventoryCost && <TableCell className="p-1"><ImportMoneyInput type="number" min={0} value={row.costPrice ?? ''} onChange={(event) => onRowUpdate(index, 'costPrice', event.target.value)} aria-label={isService ? 'Costo del servicio' : 'Costo'} className="h-8 text-right text-xs" currencySymbol={currencySymbol} /></TableCell>}
      {isService ? <>
        <TableCell className="p-1"><Select value={row.isActive === false ? 'false' : 'true'} onValueChange={(value) => onRowUpdate(index, 'isActive', value === 'true')}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="true">Disponible</SelectItem><SelectItem value="false">No disponible</SelectItem></SelectContent></Select></TableCell>
      </> : hasVariants ? <>
        <TableCell className="p-1 text-center"><span className="text-[10px] font-semibold text-muted-foreground">Por variante</span></TableCell>
        <TableCell className="p-1 text-center"><span className="text-[10px] text-muted-foreground">—</span></TableCell>
        <TableCell className="p-1 text-center"><span className={`text-[10px] font-semibold ${row._hasError ? 'text-red-600' : 'text-muted-foreground'}`}>{row._hasError ? 'Revisar abajo' : 'Por variante'}</span></TableCell>
      </> : <>
        <TableCell className="p-1"><Input type="number" min={0} value={row.initialStock ?? ''} onChange={(event) => onRowUpdate(index, 'initialStock', Number(event.target.value) || 0)} aria-label="Stock inicial" title="Edita el stock inicial antes de confirmar la importación" className="h-8 text-right text-xs" /></TableCell>
        <TableCell className="p-1"><Input type="number" min={0} value={row.minStock} onChange={(event) => onRowUpdate(index, 'minStock', Number(event.target.value) || 0)} className="h-8 text-right text-xs" /></TableCell>
        <TableCell className="p-1">
          {warehouseExists ? (
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
            </div>
          )}
        </TableCell>
      </>}
      <TableCell className="p-1 text-xs"><span className={row._hasError ? 'text-red-600' : row._hasWarning ? 'text-amber-600' : 'text-emerald-600'}>{row._errorMessage || row._warningMessage || 'Correcto'}</span></TableCell>
    </TableRow>
  );
});

function ImportPreviewPage({
  importData,
  advancedCatalog,
  importFileName,
  importCurrency,
  categoryOptions,
  warehouseOptions,
  importing,
  importProgress,
  onRowUpdate,
  onStockWarehouseUpdate,
  onDownloadErrors,
  onCreateCategory,
  canCreateCategory,
  onConfirm,
  onBack,
  onReady,
  isService = false,
  priceLists = DEFAULT_IMPORT_PRICE_LISTS,
}: ImportPreviewPageProps) {
  useImportPreviewLayout();
  const { canPerform } = useAuth();
  const canViewInventoryCost = canPerform('INVENTORY_PRODUCTS', 'viewCost');
  const visiblePriceLists = isService ? [] : priceLists;
  const currencySymbol = getImportCurrencySymbol(importCurrency);
  const summaryPriceLists = useMemo(() => {
    const configuredCodes = new Set(visiblePriceLists.map((list) => String(list.code).toUpperCase()));
    const extraCodes = (advancedCatalog?.prices || [])
      .map((price) => String(price.priceListCode || '').trim().toUpperCase())
      .filter((code) => code && !configuredCodes.has(code));
    return [
      ...visiblePriceLists,
      ...[...new Set(extraCodes)].map((code) => ({ code, name: code })),
    ];
  }, [advancedCatalog?.prices, visiblePriceLists]);
  const advancedPrices = useMemo(() => {
    const productPrices = new Map<string, Record<string, number>>();
    const variantPrices = new Map<string, Record<string, number>>();
    for (const price of advancedCatalog?.prices || []) {
      const isVariantPrice = String(price.scope).toUpperCase() === 'VARIANT';
      const key = (isVariantPrice ? price.variantSku : price.productCode)?.trim().toUpperCase();
      if (!key) continue;
      const target = isVariantPrice ? variantPrices : productPrices;
      const listCode = String(price.priceListCode || '').trim().toUpperCase();
      target.set(key, { ...(target.get(key) || {}), [listCode]: Number(price.price) });
    }
    return { productPrices, variantPrices };
  }, [advancedCatalog?.prices]);
  const summaryGridTemplate = useMemo(() => [
    '150px', '160px', 'minmax(220px,1fr)', ...summaryPriceLists.map(() => '140px'), '130px', '100px',
  ].join(' '), [summaryPriceLists]);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const [rowsReady, setRowsReady] = useState(false);
  const gridTemplate = [
    '32px', '128px', 'minmax(220px, 1fr)', '180px', '80px', '128px', '112px',
    ...(isService ? ['112px'] : visiblePriceLists.map(() => '112px')),
    ...(canViewInventoryCost ? ['112px'] : []),
    ...(isService ? ['130px'] : ['96px', '96px', '160px']),
    '160px',
  ].join(' ');
  const tableVirtualizer = useVirtualizedImportRows(rowsReady ? importData.length : 0, tableScrollRef, isService ? 84 : 58, { overscan: 2 });
  const categoryNames = useMemo(() => new Set(categoryOptions.map((category: any) => String(category.name || '').trim().toLowerCase()).filter(Boolean)), [categoryOptions]);
  const warehouseNames = useMemo(() => new Set(warehouseOptions.map((warehouse: any) => String(warehouse.name || '').trim().toLowerCase()).filter(Boolean)), [warehouseOptions]);
  const { validRows, errorRows, warningRows, issueRows } = useMemo(() => {
    let valid = 0;
    let errors = 0;
    let warnings = 0;
    let issues = 0;
    for (const row of importData) {
      if (row._hasError) {
        errors += 1;
        issues += 1;
      } else {
        valid += 1;
        if (row._hasWarning) {
          warnings += 1;
          issues += 1;
        }
      }
    }
    return { validRows: valid, errorRows: errors, warningRows: warnings, issueRows: issues };
  }, [importData]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setRowsReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (rowsReady) onReady?.();
  }, [onReady, rowsReady]);

  const renderMobileCard = (row: any, index: number) => {
    const categoryExists = categoryNames.has(String(row.category || '').trim().toLowerCase());
    const warehouseExists = !row.warehouse || warehouseNames.has(String(row.warehouse || '').trim().toLowerCase());
    const isAdvanced = Boolean(row._advanced);
    const hasVariants = isAdvanced && (row._hasVariants === true || Number(row._variantCount || 0) > 0);
    return (
      <ImportPreviewMobileCard index={index} title={row.name || row.code} error={row._hasError ? row._errorMessage || 'Fila con errores' : undefined} warning={row._hasWarning ? row._warningMessage || 'Revisar fila' : undefined}>
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <ImportPreviewField label="Código *"><Input value={row.code} onChange={(event) => onRowUpdate(index, 'code', event.target.value)} className={`${importPreviewFieldClass} font-mono ${!row.code ? 'border-red-500' : ''}`} disabled={importing} /></ImportPreviewField>
          <ImportPreviewField label="Unidad"><Input value={row.unit ?? ''} onChange={(event) => onRowUpdate(index, 'unit', event.target.value)} className={importPreviewFieldClass} disabled={importing} /></ImportPreviewField>
          {isService && <ImportPreviewField label="Duración (min)"><Input type="number" min={0} step="1" value={row.estimatedDuration ?? ''} onChange={(event) => onRowUpdate(index, 'estimatedDuration', event.target.value === '' ? undefined : Number(event.target.value))} className={`${importPreviewFieldClass} text-right`} disabled={importing} /></ImportPreviewField>}
          <ImportPreviewField label="Nombre *" className="sm:col-span-2"><Input value={row.name} title={row.name} onChange={(event) => onRowUpdate(index, 'name', event.target.value)} className={`${importPreviewFieldClass} ${!row.name ? 'border-red-500' : ''}`} disabled={importing} /></ImportPreviewField>
          {isService && <ImportPreviewField label="Descripción" className="sm:col-span-2"><Input value={row.description || ''} onChange={(event) => onRowUpdate(index, 'description', event.target.value)} className={importPreviewFieldClass} disabled={importing} /></ImportPreviewField>}
          <ImportPreviewField label="Nota comercial" className="sm:col-span-2"><Input value={row.commercialNote || ''} maxLength={100} title={row.commercialNote || ''} onChange={(event) => onRowUpdate(index, 'commercialNote', event.target.value)} className={importPreviewFieldClass} disabled={importing} /><span className="text-[10px] text-muted-foreground">{Array.from(String(row.commercialNote || '')).length}/100</span></ImportPreviewField>
          <ImportPreviewField label="Categoría" className="sm:col-span-2">
            {categoryExists ? <Input value={row.category} onChange={(event) => onRowUpdate(index, 'category', event.target.value)} className={importPreviewFieldClass} disabled={importing} /> : <div className="flex min-w-0 items-center gap-1"><Select value="__none__" onValueChange={(value) => { const category = categoryOptions.find((item: any) => item.id === value); if (category) onRowUpdate(index, 'category', category.name); }} disabled={importing}><SelectTrigger className={`${importPreviewFieldClass} min-w-0 flex-1 border-amber-500/60 text-amber-600`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">{row.category ? `No existe: ${row.category}` : 'Seleccionar categoría'}</SelectItem>{categoryOptions.length === 0 && <SelectItem value="__no_categories__" disabled>No hay registros</SelectItem>}{categoryOptions.map((category: any) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select>{canCreateCategory && <Button type="button" variant="outline" size="sm" className="size-9 shrink-0 rounded-lg p-0 text-amber-600" title="Crear esta categoría" aria-label="Crear esta categoría" onClick={() => onCreateCategory(index, row.category || '')} disabled={importing}><Plus className="size-3.5" /></Button>}</div>}
          </ImportPreviewField>
          {isService ? <ImportPreviewField label="Precio"><ImportMoneyInput type="number" min={0} value={row.salePrice ?? ''} onChange={(event) => onRowUpdate(index, 'servicePrice', event.target.value)} className={`${importPreviewFieldClass} text-right`} disabled={importing} currencySymbol={currencySymbol} /></ImportPreviewField> : visiblePriceLists.map((list) => <ImportPreviewField key={list.code} label={list.name}><ImportMoneyInput type="number" min={0} value={row.prices?.[list.code] ?? ''} onChange={(event) => onRowUpdate(index, `price.${list.code}`, event.target.value)} className={`${importPreviewFieldClass} text-right`} disabled={importing} currencySymbol={currencySymbol} /></ImportPreviewField>)}
          {canViewInventoryCost && <ImportPreviewField label={isService ? 'Costo del servicio' : 'Costo'}><ImportMoneyInput type="number" min={0} value={row.costPrice ?? ''} onChange={(event) => onRowUpdate(index, 'costPrice', event.target.value)} className={`${importPreviewFieldClass} text-right`} disabled={importing} currencySymbol={currencySymbol} /></ImportPreviewField>}
          {isService ? <>
            <ImportPreviewField label="Disponibilidad"><Select value={row.isActive === false ? 'false' : 'true'} onValueChange={(value) => onRowUpdate(index, 'isActive', value === 'true')} disabled={importing}><SelectTrigger className={importPreviewFieldClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="true">Disponible</SelectItem><SelectItem value="false">No disponible</SelectItem></SelectContent></Select></ImportPreviewField>
          </> : hasVariants ? <>
            <ImportPreviewField label="Stock total del padre"><div className={`${importPreviewFieldClass} flex items-center text-muted-foreground`}>Se calcula por variante</div></ImportPreviewField>
            <ImportPreviewField label="Stock mínimo"><div className={`${importPreviewFieldClass} flex items-center text-muted-foreground`}>Por SKU variante</div></ImportPreviewField>
            <ImportPreviewField label="Bodega" className="sm:col-span-2"><div className={`${importPreviewFieldClass} flex items-center text-muted-foreground`}>Se revisa por variante abajo</div></ImportPreviewField>
          </> : <>
            <ImportPreviewField label="Stock inicial"><Input type="number" min={0} value={row.initialStock ?? ''} onChange={(event) => onRowUpdate(index, 'initialStock', Number(event.target.value) || 0)} className={`${importPreviewFieldClass} text-right`} disabled={importing} /></ImportPreviewField>
            <ImportPreviewField label="Stock mínimo"><Input type="number" min={0} value={row.minStock} onChange={(event) => onRowUpdate(index, 'minStock', Number(event.target.value) || 0)} className={`${importPreviewFieldClass} text-right`} disabled={importing} /></ImportPreviewField>
            <ImportPreviewField label="Bodega" className="sm:col-span-2">
              <Select value={warehouseExists ? (row.warehouse || '__none__') : '__invalid__'} onValueChange={(value) => onRowUpdate(index, 'warehouse', value === '__none__' || value === '__invalid__' ? '' : value)} disabled={importing}>
                <SelectTrigger className={`${importPreviewFieldClass} ${warehouseExists ? '' : 'border-amber-500/60 text-amber-600'}`}><SelectValue placeholder="Seleccionar bodega" /></SelectTrigger>
                <SelectContent>
                  {!warehouseExists && <SelectItem value="__invalid__" disabled>{row.warehouse ? `No existe: ${row.warehouse}` : 'Bodega requerida'}</SelectItem>}
                  {warehouseExists && <SelectItem value="__none__">Sin bodega</SelectItem>}
                  {warehouseOptions.length === 0 && <SelectItem value="__no_warehouses__" disabled>No hay bodegas activas</SelectItem>}
                  {warehouseOptions.map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.name}>{warehouse.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </ImportPreviewField>
          </>}
          <ImportPreviewField label="Imagen" className="sm:col-span-2"><div className="flex min-h-9 items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 text-xs"><span className="shrink-0">{row._imageStatus === 'matched' ? <ImageIcon className="size-4 text-emerald-500" /> : <ImageOff className="size-4 text-muted-foreground" />}</span><span className="min-w-0 break-words text-muted-foreground">{row._imageStatus === 'matched' ? 'Imagen vinculada' : row._imageStatus === 'missing' ? 'No se encontró imagen para este SKU' : 'Sin archivo de imágenes'}</span></div></ImportPreviewField>
        </div>
      </ImportPreviewMobileCard>
    );
  };

  return (
    <div className="flex min-h-full min-w-0 flex-col gap-4 overflow-x-hidden overflow-y-auto overscroll-contain pr-1 scrollbar-overlay sm:gap-5">
      <div className="flex flex-col gap-3 border-b border-border/50 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">{isService ? 'Importación de servicios' : 'Importación inicial'}</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">Previsualizar {isService ? 'servicios' : 'productos'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Revisa y corrige los registros antes de formalizar la carga.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/40 text-primary">Moneda: {currencySymbol} · {importCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)'}</Badge>
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

      <ImportReviewSummary total={importData.length} valid={validRows} skipped={errorRows} warnings={warningRows} entityLabel={isService ? 'servicios' : 'productos'} />

      {advancedCatalog && !isService && (
        <section className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4" aria-label="Resumen de importación con variantes">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Plantilla avanzada detectada</p>
              <p className="mt-1 text-sm font-semibold">Los precios base se cargarán por producto padre y las existencias únicamente por SKU de variante.</p>
              <p className="mt-1 text-xs text-muted-foreground">El precio PRODUCTO queda como base heredable. Un precio VARIANTE solo reemplaza esa lista para la variante indicada.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              {[
                ['Variantes', advancedCatalog.variants.length],
                ['Atributos', advancedCatalog.attributes.length],
                ['Precios', advancedCatalog.prices.length],
                ['Existencias', advancedCatalog.stock.length],
              ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-primary/15 bg-background/70 px-3 py-2"><p className="text-lg font-black tabular-nums">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>)}
            </div>
          </div>
          <div className="max-h-44 overflow-auto rounded-xl border border-border/50 bg-background/70">
            <div className="grid min-w-[620px] gap-2 border-b border-border/50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground" style={{ gridTemplateColumns: summaryGridTemplate }}>
              <span>Producto padre</span><span>SKU variante</span><span>Atributos</span>{summaryPriceLists.map((list) => <span key={list.code}>{list.name}</span>)}<span>Costo propio</span><span>Stock filas</span>
            </div>
            {advancedCatalog.variants.slice(0, 80).map((variant) => {
              const stockCount = advancedCatalog.stock.filter((stock) => String(stock.variantSku).toLowerCase() === String(variant.sku).toLowerCase()).length;
              const parentPrices = advancedPrices.productPrices.get(String(variant.productCode).trim().toUpperCase()) || {};
              const ownPrices = advancedPrices.variantPrices.get(String(variant.sku).trim().toUpperCase()) || {};
              return <div key={`${variant.productCode}-${variant.sku}`} className="grid min-w-[620px] gap-2 border-b border-border/30 px-3 py-2 text-xs last:border-b-0" style={{ gridTemplateColumns: summaryGridTemplate }}><span className="font-mono">{variant.productCode}</span><span className="font-mono font-semibold">{variant.sku}</span><span className="flex flex-wrap gap-1">{variant.attributes.length ? variant.attributes.map((attribute) => <Badge key={`${attribute.attributeName}-${attribute.value}`} variant="secondary" className="text-[9px]">{attribute.attributeName}: {attribute.value}</Badge>) : <span className="text-muted-foreground">Sin atributos</span>}</span>{summaryPriceLists.map((list) => { const ownPrice = ownPrices[String(list.code).toUpperCase()]; const effectivePrice = ownPrice ?? parentPrices[String(list.code).toUpperCase()]; return <span key={list.code} className="tabular-nums">{effectivePrice === undefined ? '—' : <>{currencySymbol} {formatImportAmount(effectivePrice)}{ownPrice !== undefined && <span className="ml-1 text-[9px] text-primary" title="Precio específico de esta variante">*</span>}</>}</span>; })}<span>{variant.costPrice === undefined ? 'Hereda base' : `${currencySymbol} ${formatImportAmount(variant.costPrice)}`}</span><span className="tabular-nums">{stockCount}</span></div>;
            })}
          </div>
          {advancedCatalog.variants.length > 80 && <p className="text-[11px] text-muted-foreground">Se muestran 80 variantes en el resumen; la carga conserva todas las filas del archivo.</p>}
          {advancedCatalog.stock.length > 0 && <div className="space-y-2 rounded-xl border border-border/50 bg-background/70 p-3" aria-label="Distribución de existencias por variante">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Distribución por variante y bodega</p>
              <p className="text-[11px] text-muted-foreground">Las bodegas inválidas bloquean su fila hasta seleccionar una bodega activa.</p>
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border border-border/40">
              <div className="grid min-w-[720px] grid-cols-[minmax(130px,1fr)_minmax(170px,1.2fr)_80px_minmax(220px,1fr)_100px] items-center gap-2 border-b border-border/40 bg-muted/30 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                <span>Producto padre</span><span>SKU variante</span><span>Stock</span><span>Bodega</span><span>Validación</span>
              </div>
              {advancedCatalog.stock.map((stockRow, stockIndex) => {
                const warehouse = String(stockRow.warehouse || '').trim();
                const warehouseExists = warehouseNames.has(warehouse.toLowerCase());
                const selectValue = warehouseExists ? warehouse : '__invalid__';
                return <div key={`${stockRow.productCode || ''}-${stockRow.variantSku}-${stockIndex}`} className="grid min-w-[720px] grid-cols-[minmax(130px,1fr)_minmax(170px,1.2fr)_80px_minmax(220px,1fr)_100px] items-center gap-2 border-b border-border/30 px-3 py-2 last:border-b-0">
                  <span className="truncate font-mono text-xs">{stockRow.productCode || '—'}</span>
                  <span className="truncate font-mono text-xs font-semibold">{stockRow.variantSku || '—'}</span>
                  <span className="text-right text-xs tabular-nums">{Number(stockRow.quantity || 0)}</span>
                  <Select value={selectValue} onValueChange={(value) => onStockWarehouseUpdate(stockIndex, value)} disabled={importing}>
                    <SelectTrigger className={`h-8 min-w-0 text-xs ${warehouseExists ? '' : 'border-amber-500/60 text-amber-600'}`}><SelectValue placeholder="Seleccionar bodega" /></SelectTrigger>
                    <SelectContent>
                      {!warehouseExists && <SelectItem value="__invalid__" disabled>{warehouse ? `No existe: ${warehouse}` : 'Bodega requerida'}</SelectItem>}
                      {warehouseOptions.length === 0 && <SelectItem value="__no_warehouses__" disabled>No hay bodegas activas</SelectItem>}
                      {warehouseOptions.map((option: any) => <SelectItem key={option.id} value={option.name}>{option.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <span className={`text-[10px] font-semibold ${warehouseExists ? 'text-emerald-600' : 'text-red-600'}`}>{warehouseExists ? 'Correcta' : 'Rechazada'}</span>
                </div>;
              })}
            </div>
          </div>}
          <p className="text-xs text-muted-foreground">Los precios muestran el importe efectivo para cada lista en {currencySymbol}. Un asterisco (*) indica un precio específico de la variante; sin asterisco hereda el precio base del producto. Los atributos y valores inexistentes se crearán o reutilizarán después de confirmar la importación. Los productos sin fila en Variantes recibirán automáticamente la variante Estándar.</p>
        </section>
      )}

      {!rowsReady ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border bg-card p-8 text-center">
          <div className="space-y-3">
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <p className="text-sm font-semibold">Preparando filas para revisión…</p>
            <p className="text-xs text-muted-foreground">La tabla se montará de forma virtualizada para no bloquear la página.</p>
          </div>
        </div>
      ) : <>
      <div className="hidden min-h-[clamp(26rem,44dvh,38rem)] min-w-0 max-w-full flex-[1_1_auto] sm:flex">
      <HorizontalTableScroller scrollRef={tableScrollRef} scrollBehavior="auto" className="min-h-0 min-w-0 flex-1" tableClassName="overflow-x-auto overflow-y-auto scrollbar-overlay" label="Desplazamiento horizontal · columna por columna">
          <Table containerClassName="w-max min-w-full max-w-none overflow-visible" className={`block ${isService ? 'min-w-[1420px]' : 'min-w-[1500px]'}`}>
            <TableHeader className="sticky top-0 z-10 block bg-muted shadow-sm">
              <TableRow style={{ display: 'grid', gridTemplateColumns: gridTemplate }}>
                <TableHead className="w-8 text-[10px] uppercase"></TableHead>
                <TableHead className="w-32 text-[10px] uppercase">Código</TableHead>
                <TableHead className="min-w-[220px] text-[10px] uppercase">{isService ? 'Nombre / descripción' : 'Nombre'}</TableHead>
                <TableHead className="w-44 text-[10px] uppercase">Nota comercial</TableHead>
                <TableHead className="w-20 text-center text-[10px] uppercase">Imagen</TableHead>
                <TableHead className="w-32 text-[10px] uppercase">Categoría</TableHead>
                <TableHead className="w-28 text-right text-[10px] uppercase">Unidad</TableHead>
                {isService && <TableHead className="w-28 text-right text-[10px] uppercase">Duración (min)</TableHead>}
                {isService ? <TableHead className="w-28 text-right text-[10px] uppercase">Precio</TableHead> : visiblePriceLists.map((list) => <TableHead key={list.code} className="w-28 text-right text-[10px] uppercase">{list.name}</TableHead>)}
                  {canViewInventoryCost && <TableHead className="w-28 text-right text-[10px] uppercase">Costo</TableHead>}
                {isService ? <TableHead className="w-32 text-[10px] uppercase">Disponibilidad</TableHead> : <><TableHead className="w-24 text-right text-[10px] uppercase">Stock</TableHead><TableHead className="w-24 text-right text-[10px] uppercase">Min</TableHead><TableHead className="w-40 text-[10px] uppercase">Bodega</TableHead></>}
                <TableHead className="w-40 text-[10px] uppercase">Validación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody style={{ display: 'block', position: 'relative', height: tableVirtualizer.getTotalSize() }}>
              {tableVirtualizer.getVirtualItems().map((virtualRow) => (
                <ProductImportPreviewRow
                  key={virtualRow.key}
                  row={importData[virtualRow.index]}
                  index={virtualRow.index}
                  start={virtualRow.start}
                  gridTemplate={gridTemplate}
                  categoryNames={categoryNames}
                  warehouseNames={warehouseNames}
                  categoryOptions={categoryOptions}
                  warehouseOptions={warehouseOptions}
                  importing={importing}
                  canViewInventoryCost={canViewInventoryCost}
                  canCreateCategory={canCreateCategory}
                  onRowUpdate={onRowUpdate}
                  onCreateCategory={onCreateCategory}
                  priceLists={visiblePriceLists}
                  currencySymbol={currencySymbol}
                  isService={isService}
                />
              ))}
            </TableBody>
          </Table>
      </HorizontalTableScroller>
      </div>

      <section data-import-preview-mobile-section="true" className="flex min-h-[clamp(18rem,52dvh,32rem)] min-w-0 flex-[1_1_auto] flex-col overflow-hidden rounded-2xl border bg-card p-3 sm:hidden" aria-label="Registros de productos para revisar">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 pb-3">
          <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Revisión móvil</p><p className="mt-1 text-xs text-muted-foreground">Edita un {isService ? 'servicio' : 'producto'} por tarjeta</p></div>
          <Badge variant="secondary" className="shrink-0 text-[10px]">{importData.length} registros</Badge>
        </div>
        <div className="min-h-0 flex-1">
          {importData.length ? <VirtualizedImportList count={importData.length} scrollRef={mobileScrollRef} estimateSize={360} overscan={2} className="pt-3 pr-1" renderItem={(index) => <div className="pb-3">{renderMobileCard(importData[index], index)}</div>} /> : <div className="p-8 text-center text-sm text-muted-foreground">El archivo no contiene filas para importar.</div>}
        </div>
      </section>
      </>}

      {importing && <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${importProgress}%` }} /></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4">
        <Button variant="outline" onClick={onBack} disabled={importing}><ChevronLeft className="mr-2 size-4" />Volver a la carga</Button>
        <Button onClick={onConfirm} disabled={importing || validRows === 0} className="bg-primary font-bold text-primary-foreground">{importing ? `Importando... ${importProgress}%` : `Importar ${validRows} válidos · omitir ${errorRows}`}</Button>
      </div>
    </div>
  );
}

export function ProductosView({ products, summaryProducts, categories, warehouses = [], productWarehouseOptions = [], branches = [], series = [], movements = [], onRefresh, pagination, onSearchChange, onCategoryChange, onWarehouseChange, onUnitChange, onTaxRateChange, onStockStatusChange, itemType, isSidebarCollapsed = true, targetProductId, initialStockFilter, productStatusFilter: controlledProductStatusFilter, onProductStatusFilterChange, onClearTargetProduct, selectedBranchId = '', branchWarehouseIds = [], stockWarehouseIds = [], unitFilter: controlledUnitFilter, taxRateFilter: controlledTaxRateFilter, stockStatusFilter: controlledStockStatusFilter }: ProductosViewProps) {
  const { openingId, startOpening } = useDetailOpeningFeedback();
  const { formatAmount, baseCurrency, exchangeRate } = useCurrency();
  const { user, canPerform } = useAuth();
  const canViewInventoryCost = canPerform('INVENTORY_PRODUCTS', 'viewCost');
  const canCreatePurchaseRequest = canPerform('PURCHASES', 'create');
  const catalogItemType = itemType || 'PRODUCT';
  const isServiceView = catalogItemType === 'SERVICE';
  const [configuredPriceLists, setConfiguredPriceLists] = useState<PriceList[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    priceListsService.getAll(controller.signal)
      .then((lists) => setConfiguredPriceLists(Array.isArray(lists) ? lists : []))
      .catch((error) => {
        if (error?.name !== 'AbortError') console.error('No se pudieron cargar las listas de precios para la plantilla:', error);
      });
    return () => controller.abort();
  }, []);
  const importPriceLists = useMemo(() => {
    const unique = new Map<string, Pick<PriceList, 'code' | 'name'>>();
    const source = configuredPriceLists.filter((list) => list.isActive !== false);
    for (const list of source) {
      const code = String(list.code || '').trim().toUpperCase();
      const name = String(list.name || '').trim();
      const key = normalizePriceListImportKey(name || code);
      if (key && code && name && !unique.has(key)) unique.set(key, { code, name });
    }
    return unique.size > 0 ? Array.from(unique.values()) : DEFAULT_IMPORT_PRICE_LISTS;
  }, [configuredPriceLists]);
  const importPriceListsForView = isServiceView ? [] : importPriceLists;
  const getPrimaryImportPrice = useCallback((prices: Record<string, any> = {}) => {
    const first = importPriceListsForView.find((list) => prices[list.code] !== undefined && prices[list.code] !== null && prices[list.code] !== '');
    return Number(first ? prices[first.code] : 0);
  }, [importPriceListsForView]);
  const branchWarehouseIdSet = useMemo(() => new Set(branchWarehouseIds), [branchWarehouseIds]);
  const stockWarehouseIdSet = useMemo(
    () => new Set(stockWarehouseIds.length > 0 ? stockWarehouseIds : warehouses.map((warehouse: any) => warehouse.id).filter(Boolean)),
    [stockWarehouseIds, warehouses],
  );
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
  const entityLabel = isServiceView ? 'servicio' : 'producto';
  const entityLabelCap = isServiceView ? 'Servicio' : 'Producto';
  const getServicePricePresentation = (product: any) => {
    const sourceCurrency = String(product?.priceCurrency || baseCurrency).toUpperCase();
    const originalAmount = Number(product?.salePriceOriginal);
    const hasOriginalAmount = Number.isFinite(originalAmount) && originalAmount > 0;
    return sourceCurrency !== baseCurrency && hasOriginalAmount
      ? { amount: originalAmount, sourceCurrency, sourceExchangeRate: Number(product?.priceExchangeRate || exchangeRate || 1) }
      : { amount: Number(product?.salePrice || 0), sourceCurrency: baseCurrency, sourceExchangeRate: 1 };
  };
  const [importAddedCategories, setImportAddedCategories] = useState<any[]>([]);
  const importCategoryOptions = useMemo(() => {
    const unique = new Map<string, any>();
    [...categories, ...importAddedCategories].forEach((category: any) => unique.set(category.id || category.name, category));
    return Array.from(unique.values());
  }, [categories, importAddedCategories]);
  const importWarehouseOptions = useMemo(() => {
    const unique = new Map<string, any>();
    // La carga de inventario solo acepta bodegas de sucursal activas. En
    // algunos momentos el listado general todavía puede estar vacío mientras
    // llega la consulta; usamos las opciones ya resueltas para productos como
    // respaldo, pero no inventamos nombres que el backend no pueda resolver.
    const source = warehouses.length > 0 ? warehouses : productWarehouseOptions;
    source
      .filter((warehouse: any) => warehouse?.isActive !== false && (!warehouse?.scopeType || warehouse.scopeType === 'BRANCH'))
      .forEach((warehouse: any) => unique.set(warehouse.id || warehouse.name, warehouse));
    return Array.from(unique.values());
  }, [warehouses, productWarehouseOptions]);
  const displayWarehouseOptions = productWarehouseOptions.length > 0 ? productWarehouseOptions : warehouses;
  const warehouseNamesForProduct = useCallback((product: any) => {
    const names = new Set<string>();
    const productWarehouses = [
      ...(Array.isArray(product?.stockLevels) ? product.stockLevels : []),
      ...(Array.isArray(product?.warehouseCatalogs) ? product.warehouseCatalogs : []),
    ];
    for (const item of productWarehouses) {
      const warehouseId = item?.warehouseId || item?.warehouse?.id;
      if (!warehouseId || (selectedBranchId && !branchWarehouseIdSet.has(warehouseId))) continue;
      const warehouseName = item?.warehouse?.name || displayWarehouseOptions.find((warehouse: any) => warehouse.id === warehouseId)?.name;
      if (warehouseName) names.add(warehouseName);
    }
    return Array.from(names);
  }, [branchWarehouseIdSet, displayWarehouseOptions, selectedBranchId]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [warehouseFilters, setWarehouseFilters] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const [advancedImportCatalog, setAdvancedImportCatalog] = useState<VariantImportCatalog | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [imageArchiveFileName, setImageArchiveFileName] = useState('');
  const [imageArchiveEntries, setImageArchiveEntries] = useState<Map<string, File>>(new Map());
  const [importProcessing, setImportProcessing] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewMounting, setPreviewMounting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importValidationTimerRef = useRef<number | null>(null);
  const previewMountTimerRef = useRef<number | null>(null);
  const previewFinishTimerRef = useRef<number | null>(null);
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
  const openProductDetail = (product: any) => startOpening(product.id, () => setProductDetail(product));
  const [expandedProductImage, setExpandedProductImage] = useState<{ src: string; alt: string } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [pendingCategoryRowIndex, setPendingCategoryRowIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedProductMap, setSelectedProductMap] = useState<Map<string, any>>(new Map());
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; skipped: number; failed: number; errors: string[]; warnings?: string[] } | null>(null);
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

  useEffect(() => () => {
    if (importValidationTimerRef.current !== null) window.clearTimeout(importValidationTimerRef.current);
    if (previewMountTimerRef.current !== null) window.clearTimeout(previewMountTimerRef.current);
    if (previewFinishTimerRef.current !== null) window.clearTimeout(previewFinishTimerRef.current);
    if (solicitudPreparationTimerRef.current !== null) window.clearTimeout(solicitudPreparationTimerRef.current);
  }, []);
  
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
    isVariable?: boolean;
    variants?: Array<{ id: string; name?: string; sku?: string; attributes?: Array<{ value: string }> }>;
    variantQuantities?: Record<string, number>;
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
  const [solicitudCategoryFilter, setSolicitudCategoryFilter] = useState('ALL');
  const [solicitudStockFilter, setSolicitudStockFilter] = useState<'ALL' | 'AVAILABLE' | 'LOW' | 'OUT'>('ALL');
  const [solicitudWarehouseFilter, setSolicitudWarehouseFilter] = useState('ALL');
  const [solicitudCatalogProducts, setSolicitudCatalogProducts] = useState<any[]>([]);
  const [solicitudCatalogLoading, setSolicitudCatalogLoading] = useState(false);
  const [solicitudOnlySelected, setSolicitudOnlySelected] = useState(false);
  const [solicitudPage, setSolicitudPage] = useState(1);
  const solicitudPreparationTimerRef = useRef<number | null>(null);

  const clearSolicitudPreparation = () => {
    if (solicitudPreparationTimerRef.current !== null) {
      window.clearTimeout(solicitudPreparationTimerRef.current);
      solicitudPreparationTimerRef.current = null;
    }
  };

  const closeSolicitud = () => {
    if (solicitudCreating) return;
    clearSolicitudPreparation();
    setSolicitudOpen(false);
  };

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
    setSolicitudCatalogLoading(true);
    const timer = window.setTimeout(async () => {
      if (controller.signal.aborted) return;

      // El resumen de inventario ya trae el catálogo completo con sus niveles
      // por bodega. Prepararlo después del primer paint deja que el modal abra
      // de inmediato y muestre feedback mientras se procesa la lista.
      const summaryCatalog = (summaryProducts || []).filter((product: any) =>
        String(product.itemType || product.type || 'PRODUCT').toUpperCase() === 'PRODUCT',
      );
      if (summaryCatalog.length > 0) {
        startTransition(() => {
          setSolicitudCatalogProducts(summaryCatalog);
          setSolicitudCatalogLoading(false);
        });
        return;
      }

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
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [products, summaryProducts, solicitudOpen]);

  const getSolicitudProductSnapshot = (product: any, warehouseIdOverride?: string) => {
    // El stock de una solicitud siempre es el de una bodega concreta. El
    // filtro de bodega tiene prioridad y, si no se usa, se toma la bodega
    // destino de la solicitud. Nunca se cae al stock global del producto.
    const selectedWarehouseId = warehouseIdOverride || (solicitudWarehouseFilter !== 'ALL'
      ? solicitudWarehouseFilter
      : solicitudWarehouseId);
    const stockLevels = Array.isArray(product?.stockLevels) ? product.stockLevels : [];
    const levels = stockLevels.length > 0
      ? stockLevels
      : (Array.isArray(product?.allocations) ? product.allocations : []);
    const matchingLevels = selectedWarehouseId
      ? levels.filter((level: any) => String(level?.warehouseId || level?.warehouse?.id || '') === selectedWarehouseId)
      : levels;
    const perWarehouse = stockByProduct[product?.id] || {};
    if (!selectedWarehouseId) return { currentStock: null, minStock: null };
    const currentStock = selectedWarehouseId
      ? (matchingLevels.length > 0
        ? matchingLevels.reduce((sum: number, level: any) => sum + Number(level?.quantity || 0), 0)
        : Number(perWarehouse[selectedWarehouseId] || 0))
      : 0;
    const minStock = matchingLevels.length > 0
      ? Math.max(...matchingLevels.map((level: any) => Number(level?.minStock ?? product?.minStock ?? 0)))
      : 0;
    return { currentStock, minStock };
  };

  const getSolicitudVariantSnapshot = (product: any, variant: any, warehouseIdOverride?: string) => {
    const selectedWarehouseId = warehouseIdOverride || (solicitudWarehouseFilter !== 'ALL'
      ? solicitudWarehouseFilter
      : solicitudWarehouseId);
    const levels = (Array.isArray(product?.stockLevels) ? product.stockLevels : [])
      .filter((level: any) => String(level?.variantId || '') === String(variant?.id || ''));
    const matchingLevels = selectedWarehouseId
      ? levels.filter((level: any) => String(level?.warehouseId || level?.warehouse?.id || '') === selectedWarehouseId)
      : levels;
    if (!selectedWarehouseId) return { currentStock: null, minStock: null };
    return {
      currentStock: matchingLevels.reduce((sum: number, level: any) => sum + Number(level?.quantity || 0), 0),
      minStock: matchingLevels.length > 0
        ? Math.max(...matchingLevels.map((level: any) => Number(level?.minStock || 0)))
        : 0,
    };
  };

  const filteredSolicitudProducts = useMemo(() => {
    const search = normalizeImportHeader(solicitudProductSearch);
    const selectedProductIds = new Set(solicitudProducts.map((item) => String(item.productId)));
    return solicitudCatalogProducts.filter((product: any) => {
      const isSelected = selectedProductIds.has(String(product?.id));
      // Cuando la solicitud nació desde una selección de la tabla, el modal
      // muestra esos registros al abrirse; una búsqueda explícita habilita
      // resultados adicionales para agregarlos. Sin selección de tabla se
      // conserva el catálogo visible como antes.
      if (solicitudOnlySelected && !search && !isSelected) return false;
      const categoryId = String(product?.categoryId || product?.category?.id || '');
      const categoryName = String(product?.category?.name || product?.categoryName || '');
      const productWarehouseIds = [
        ...(Array.isArray(product?.warehouseCatalogs) ? product.warehouseCatalogs.map((entry: any) => entry.warehouseId || entry.warehouse?.id) : []),
        ...(Array.isArray(product?.stockLevels) ? product.stockLevels.map((entry: any) => entry.warehouseId || entry.warehouse?.id) : []),
        ...(Array.isArray(product?.allocations) ? product.allocations.map((entry: any) => entry.warehouseId || entry.warehouse?.id) : []),
      ].filter(Boolean).map(String);
      const snapshot = getSolicitudProductSnapshot(product);
      const threshold = snapshot.minStock > 0 ? snapshot.minStock : 2;
      const matchesSearch = !search
        || normalizeImportHeader(product?.name).includes(search)
        || normalizeImportHeader(product?.code).includes(search)
        || normalizeImportHeader(categoryName).includes(search)
        || (Array.isArray(product?.variants) && product.variants.some((variant: any) => normalizeImportHeader(variant?.sku).includes(search)));
      const matchesCategory = solicitudCategoryFilter === 'ALL' || categoryId === solicitudCategoryFilter;
      const matchesWarehouse = solicitudWarehouseFilter === 'ALL'
        || productWarehouseIds.length === 0
        || productWarehouseIds.includes(solicitudWarehouseFilter);
      const matchesStock = solicitudStockFilter === 'ALL'
        || (snapshot.currentStock !== null && (
          (solicitudStockFilter === 'OUT' && snapshot.currentStock <= 0)
          || (solicitudStockFilter === 'LOW' && snapshot.currentStock > 0 && snapshot.currentStock <= threshold)
          || (solicitudStockFilter === 'AVAILABLE' && snapshot.currentStock > 0 && snapshot.currentStock > threshold)
        ));
      return matchesSearch && matchesCategory && matchesWarehouse && matchesStock;
    });
  }, [solicitudCatalogProducts, solicitudProductSearch, solicitudCategoryFilter, solicitudStockFilter, solicitudWarehouseFilter, solicitudProducts, solicitudOnlySelected, stockByProduct, stockWarehouseIdSet]);

  const solicitudPageCount = Math.max(1, Math.ceil(filteredSolicitudProducts.length / SOLICITUD_PAGE_SIZE));
  const safeSolicitudPage = Math.min(solicitudPage, solicitudPageCount);
  const visibleSolicitudProducts = useMemo(() => {
    const start = (safeSolicitudPage - 1) * SOLICITUD_PAGE_SIZE;
    return filteredSolicitudProducts.slice(start, start + SOLICITUD_PAGE_SIZE);
  }, [filteredSolicitudProducts, safeSolicitudPage]);

  useEffect(() => {
    if (solicitudPage !== safeSolicitudPage) setSolicitudPage(safeSolicitudPage);
  }, [safeSolicitudPage, solicitudPage]);

  useEffect(() => {
    setSolicitudPage(1);
  }, [solicitudProductSearch, solicitudCategoryFilter, solicitudStockFilter, solicitudWarehouseFilter, solicitudOnlySelected]);

  const solicitudCategories = useMemo(() => {
    const categoriesById = new Map<string, string>();
    solicitudCatalogProducts.forEach((product: any) => {
      const id = String(product?.categoryId || product?.category?.id || '');
      const name = String(product?.category?.name || product?.categoryName || '').trim();
      if (id && name) categoriesById.set(id, name);
    });
    return [...categoriesById.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [solicitudCatalogProducts]);

  const buildSolicitudItems = (list: any[]) => list.map((p: any) => {
    const { currentStock, minStock } = getSolicitudProductSnapshot(p);
    const variants = Array.isArray(p.variants) ? p.variants : [];
    const isVariable = Boolean(p.isVariable || variants.length > 1) && variants.length > 0;
    return {
      productId: p.id,
      productName: p.name,
      code: p.code ?? '',
      currentStock: Number(currentStock ?? 0),
      minStock: Number(minStock ?? 0),
      quantity: isVariable ? 0 : 1,
      isVariable,
      variants,
      variantQuantities: isVariable
        ? Object.fromEntries(variants.map((variant: any) => [variant.id, 0]))
        : undefined,
    };
  });

  const openLowStockSolicitud = () => {
    clearSolicitudPreparation();
    loadSolicitudEmployees();
    setSolicitudWarehouseId('');
    setSolicitudOnlySelected(false);
    setSolicitudWarehouseFilter('ALL');
    setSolicitudPage(1);
    setSolicitudCatalogLoading(true);
    // La bodega destino todavía no está seleccionada; las cantidades y el
    // stock se recalculan al elegirla y antes de enviar la solicitud.
    setSolicitudProducts([]);
    setSolicitudJustification('');
    setSolicitudRequiredDate('');
    setSolicitudPriority('NORMAL');
    setSolicitudProductSearch('');
    setSolicitudCategoryFilter('ALL');
    setSolicitudStockFilter('ALL');
    setSolicitudOpen(true);
    solicitudPreparationTimerRef.current = window.setTimeout(() => {
      solicitudPreparationTimerRef.current = null;
      const catalog = summaryProducts && summaryProducts.length > 0 ? summaryProducts : products;
      const lowStock = catalog.filter((p: any) => {
        if (String(p.itemType || p.type || 'PRODUCT').toUpperCase() !== 'PRODUCT') return false;
        const stockLevels = Array.isArray(p?.stockLevels) ? p.stockLevels : [];
        const levels = stockLevels.length > 0 ? stockLevels : (Array.isArray(p?.allocations) ? p.allocations : []);
        return levels.some((level: any) => {
          const quantity = Number(level?.quantity || 0);
          const minimum = Number(level?.minStock || 0);
          return quantity <= (minimum > 0 ? minimum : 2);
        });
      });
      startTransition(() => setSolicitudProducts(buildSolicitudItems(lowStock)));
    }, 0);
  };

  const openSelectedSolicitud = () => {
    if (selectedIds.size === 0) { toast.error('Selecciona al menos un producto'); return; }
    loadSolicitudEmployees();
    // La selección puede contener productos de distintas páginas. El listado
    // `products` solo representa la página actual, por lo que reconstruimos
    // la selección desde el catálogo completo y priorizamos el registro que
    // conserve sus variantes.
    const catalogById = new Map<string, any>();
    selectedProductMap.forEach((product, productId) => catalogById.set(String(productId), product));
    [...products, ...(summaryProducts || []), ...solicitudCatalogProducts].forEach((product: any) => {
      const productId = String(product?.id || '').trim();
      if (!productId) return;
      const current = catalogById.get(productId);
      catalogById.set(productId, {
        ...current,
        ...product,
        variants: Array.isArray(product?.variants) && product.variants.length > 0
          ? product.variants
          : current?.variants,
      });
    });
    const selected = Array.from(selectedIds)
      .map((productId) => catalogById.get(String(productId)))
      .filter(Boolean);
    if (selected.length !== selectedIds.size) {
      toast.error('No se pudieron cargar todos los productos seleccionados. Actualiza el inventario e inténtalo nuevamente.');
      return;
    }
    setSolicitudWarehouseId('');
    setSolicitudOnlySelected(true);
    setSolicitudWarehouseFilter('ALL');
    setSolicitudPage(1);
    setSolicitudCatalogLoading(true);
    setSolicitudProducts(buildSolicitudItems(selected));
    setSolicitudJustification('');
    setSolicitudRequiredDate('');
    setSolicitudPriority('NORMAL');
    setSolicitudProductSearch('');
    setSolicitudCategoryFilter('ALL');
    setSolicitudStockFilter('ALL');
    setSolicitudOpen(true);
  };

  const updateSolicitudQuantity = (productId: string, quantity: number) => {
    setSolicitudProducts(prev => prev.map(item => item.productId === productId
      ? item.isVariable
        ? item
        : { ...item, quantity: Math.max(1, Number.isFinite(quantity) ? quantity : 1) }
      : item));
  };

  const updateSolicitudVariantQuantity = (productId: string, variantId: string, quantity: number) => {
    setSolicitudProducts((prev) => prev.map((item) => {
      if (item.productId !== productId) return item;
      const nextQuantity = quantity === 0 ? 0 : Math.max(0, Number.isFinite(quantity) ? quantity : 0);
      const nextAllocated = (item.variants || []).reduce(
        (sum, variant) => sum + (variant.id === variantId ? nextQuantity : Number(item.variantQuantities?.[variant.id] || 0)),
        0,
      );
      return {
        ...item,
        // En productos variables la cantidad del padre es solo el total
        // derivado de las cantidades capturadas por SKU variante.
        quantity: nextAllocated,
        variantQuantities: { ...(item.variantQuantities || {}), [variantId]: nextQuantity },
      };
    }));
  };

  const variantLabel = (variant: { name?: string; sku?: string; attributes?: Array<{ value: string }> }) =>
    variant.name || variant.attributes?.map((attribute) => attribute.value).join(' / ') || variant.sku || 'Variante';

  const getSolicitudVariantAllocation = (item: typeof solicitudProducts[number]) => {
    const allocated = item.variants?.reduce(
      (sum, variant) => sum + Number(item.variantQuantities?.[variant.id] || 0),
      0,
    ) || 0;
    return {
      allocated,
      exceeds: false,
      complete: !item.isVariable || allocated > 0,
    };
  };

  const toggleSolicitudProduct = (product: any) => {
    const item = buildSolicitudItems([product])[0];
    if (!item) return;
    setSolicitudProducts(prev => prev.some(existing => existing.productId === item.productId)
      ? prev.filter(existing => existing.productId !== item.productId)
      : [...prev, item]);
  };

  const removeSolicitudProduct = (productId: string) => {
    setSolicitudProducts((previous) => previous.filter((item) => item.productId !== productId));
  };

  const handleCreateSolicitud = async () => {
    if (solicitudProducts.length === 0) { toast.error('No hay productos en la solicitud'); return; }
    if (!solicitudWarehouseId) { toast.error('Selecciona una bodega'); return; }
    setSolicitudCreating(true);
    try {
      if (!solicitudEmployeeId) { setSolicitudCreating(false); toast.error('Selecciona el empleado solicitante'); return; }
      const invalidAllocation = solicitudProducts.find((item) => !getSolicitudVariantAllocation(item).complete);
      if (invalidAllocation) {
        const allocation = getSolicitudVariantAllocation(invalidAllocation);
        toast.error(`${invalidAllocation.productName}: solicita al menos una unidad indicando el SKU de la variante.`);
        setSolicitudCreating(false);
        return;
      }
      const catalog = summaryProducts && summaryProducts.length > 0 ? summaryProducts : solicitudCatalogProducts;
      const items = solicitudProducts.flatMap(item => {
        const product = catalog.find((candidate: any) => String(candidate.id) === String(item.productId));
        const snapshot = product
          ? getSolicitudProductSnapshot(product, solicitudWarehouseId)
          : { currentStock: item.currentStock, minStock: item.minStock };
        if (item.isVariable && item.variants?.length) {
          const allocated = item.variants.map((variant) => ({
            variant,
            quantity: Number(item.variantQuantities?.[variant.id] || 0),
          }));
          return allocated
            .filter((entry) => entry.quantity > 0)
            .map(({ variant, quantity }) => {
              const variantSnapshot = product
                ? getSolicitudVariantSnapshot(product, variant, solicitudWarehouseId)
                : { currentStock: 0, minStock: 0 };
              return {
              productId: item.productId,
              variantId: variant.id,
              code: variant.sku || item.code || undefined,
              description: `${item.productName} · ${variantLabel(variant)}${variant.sku ? ` · ${variant.sku}` : ''}`,
              quantity,
              warehouseId: solicitudWarehouseId,
              currentStock: Number(variantSnapshot.currentStock ?? 0),
              minStock: Number(variantSnapshot.minStock ?? 0),
              };
            });
        }
        return [{
          productId: item.productId,
          code: item.code || undefined,
          description: item.productName,
          quantity: item.quantity,
          warehouseId: solicitudWarehouseId,
          currentStock: Number(snapshot.currentStock ?? 0),
          minStock: Number(snapshot.minStock ?? 0),
        }];
      });
      await purchaseRequestsService.create({
        status: 'PENDING_APPROVAL',
        priority: normalizePurchasePriority(solicitudPriority),
        justification: solicitudJustification || 'Solicitud generada desde inventario',
        warehouseId: solicitudWarehouseId,
        requiredDate: solicitudRequiredDate || undefined,
        requestedById: solicitudEmployeeId,
        userId: user?.id,
        items,
      } as any);
      toast.success(`Solicitud creada con ${items.length} producto(s). Revisa Compras > Solicitudes.`);
      setSolicitudOpen(false);
      clearSelectedProducts();
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

  // Reset page when filters change; keep selection so users can pick items and search freely
  useEffect(() => {
    setPage(1);
    pagination?.onPageChange(1);
  }, [searchTerm, warehouseFilters, stockFilter, availabilityFilter, effectiveProductStatusFilter, effectiveUnitFilter, effectiveTaxRateFilter, effectiveStockStatusFilter, showAllWarehouseProducts, catalogItemType]);

  // La celda Stock muestra únicamente las existencias locales de la sucursal;
  // los almacenes corporativos pueden aparecer en la distribución, pero no se
  // mezclan en este total operativo.
  const getProductStock = (product: any) => {
    const levels = Array.isArray(product.stockLevels) ? product.stockLevels : [];
    if (levels.length > 0 && stockWarehouseIdSet.size > 0) {
      return levels
        .filter((l: any) => stockWarehouseIdSet.has(l.warehouseId || l.warehouse?.id))
        .reduce((sum: number, l: any) => sum + Number(l.quantity || 0), 0);
    }
    const perWarehouse = stockByProduct[product?.id];
    if (perWarehouse) {
      if (stockWarehouseIdSet.size > 0) {
        let total = 0;
        for (const warehouseId of stockWarehouseIdSet) total += perWarehouse[warehouseId] || 0;
        return total;
      }
      return Object.values(perWarehouse).reduce((sum, quantity) => sum + quantity, 0);
    }
    if (levels.length > 0) {
      return Number(product.stock ?? levels.reduce((sum: number, l: any) => sum + Number(l.quantity || 0), 0));
    }
    return Number(product.stock || 0);
  };

  const filteredProducts = products.filter((p: any) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesVariantSku = Array.isArray(p.variants) && p.variants.some((variant: any) =>
      String(variant?.sku || '').toLowerCase().includes(normalizedSearch),
    );
    const matchesSearch = !normalizedSearch ||
      p.name?.toLowerCase().includes(normalizedSearch) ||
      p.code?.toLowerCase().includes(normalizedSearch) ||
      p.category?.name?.toLowerCase().includes(normalizedSearch) ||
      matchesVariantSku;
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
    const matchesKpiStock = stockFilter === 'all'
      || (stockFilter === 'available' && pType === 'PRODUCT' && stock > stockThreshold)
      || (stockFilter === 'available' && pType === 'PRODUCT' && stockThreshold <= 0 && stock > 0)
      || (stockFilter === 'low' && pType === 'PRODUCT' && stock > 0 && stock <= stockThreshold)
      || (stockFilter === 'out' && pType === 'PRODUCT' && stock <= 0);
    const matchesStockStatus = !effectiveStockStatusFilter
      || (effectiveStockStatusFilter === 'available' && pType === 'PRODUCT' && stock > 0)
      || (effectiveStockStatusFilter === 'low' && pType === 'PRODUCT' && stock > 0 && stock <= stockThreshold)
      || (effectiveStockStatusFilter === 'out' && pType === 'PRODUCT' && stock <= 0);
    const matchesStock = matchesKpiStock && matchesStockStatus;
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

  const selectedVisibleCount = useMemo(
    () => paginatedProducts.reduce((count, product: any) => count + (selectedIds.has(String(product?.id)) ? 1 : 0), 0),
    [paginatedProducts, selectedIds],
  );
  const allVisibleProductsSelected = paginatedProducts.length > 0 && selectedVisibleCount === paginatedProducts.length;
  const someVisibleProductsSelected = selectedVisibleCount > 0 && !allVisibleProductsSelected;
  const selectedCatalogProducts = useMemo(
    () => Array.from(selectedIds)
      .map((id) => selectedProductMap.get(String(id)))
      .filter(Boolean),
    [selectedIds, selectedProductMap],
  );

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
  }, [products, summaryProducts, catalogItemType, stockByProduct, selectedBranchId, branchWarehouseIdSet, stockWarehouseIdSet]);

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

  const inventoryKpis = isServiceView
    ? [
        { title: 'Servicios', value: inventorySummary.total, icon: Package, color: 'text-primary', bg: 'bg-primary/10', kind: 'indicator' as const },
        { title: 'Categorías', value: serviceSummary.categories, icon: PackageSearch, color: 'text-blue-600', bg: 'bg-blue-500/10', kind: 'indicator' as const },
        { title: 'Promedio semanal', value: serviceSummary.weeklyAverage.toFixed(1), icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10', kind: 'indicator' as const },
        { title: 'Precio promedio', value: formatAmount(serviceSummary.averagePrice), icon: Barcode, color: 'text-amber-600', bg: 'bg-amber-500/10', kind: 'indicator' as const },
      ]
    : [
        { title: 'Productos', value: inventorySummary.total, icon: Package, color: 'text-foreground', bg: 'bg-muted/50', kind: 'filter' as const, filter: 'all' as const },
        { title: 'Disponibles', value: inventorySummary.available, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10', kind: 'filter' as const, filter: 'available' as const },
        { title: 'Stock bajo', value: inventorySummary.low, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-500/10', kind: 'filter' as const, filter: 'low' as const },
        { title: 'Sin stock', value: inventorySummary.out, icon: Ban, color: 'text-rose-600', bg: 'bg-rose-500/10', kind: 'filter' as const, filter: 'out' as const },
      ];
  const activeProductFilterCount = [
    Boolean(searchTerm.trim()),
    warehouseFilters.length > 0,
    stockFilter !== 'all',
    availabilityFilter !== 'all',
    !isServiceView && effectiveProductStatusFilter !== 'ALL',
    Boolean(effectiveUnitFilter),
    Boolean(effectiveTaxRateFilter),
    Boolean(effectiveStockStatusFilter),
    !showAllWarehouseProducts,
  ].filter(Boolean).length;

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
    WAREHOUSE_TYPES.find((t) => t.value === type)?.label || type || 'Bodega';

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
      commercialNote: '',
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
       initialAllocations: catalogItemType === 'SERVICE' ? [] : warehouses.length > 0 ? [{ id: `alloc-${Date.now()}-0`, warehouseId: warehouses[0]?.id || '', quantity: 0, minStock: 0, maxStock: 0 }] : []
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
      commercialNote: product.commercialNote || '',
      categoryId: product.categoryId || '',
      salePrice: (() => {
        const sourceCurrency = String(product.priceCurrency || baseCurrency).toUpperCase();
        const originalAmount = Number(product.salePriceOriginal);
        return sourceCurrency !== baseCurrency && originalAmount > 0 ? originalAmount : Number(product.salePrice) || 0;
      })(),
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
         ? []
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
      } else if (field === 'commercialNote') {
        finalValue = Array.from(String(value ?? '')).slice(0, 100).join('');
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
          commercialNote: product.commercialNote || '',
          categoryId: product.categoryId,
          salePrice: Number(product.salePrice || 0) * (product.priceCurrency === baseCurrency ? 1 : product.priceCurrency === 'USD' ? exchangeRate : 1 / exchangeRate),
          salePriceOriginal: Number(product.salePrice || 0),
          priceCurrency: product.priceCurrency || baseCurrency,
          priceExchangeRate: Number(product.priceExchangeRate || 1),
           ...(canViewInventoryCost ? { costPrice: Number(product.costPrice || 0) } : {}),
          unit: product.unit || 'unidad',
          minStock: Number(product.minStock || 0),
          trackSerialNumbers: Boolean(product.trackSerialNumbers),
          type: product.itemType || catalogItemType,
          itemType: product.itemType || 'PRODUCT',
           ...(product.itemType === 'SERVICE' ? {} : { warehouseId: undefined }),
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
          commercialNote: product.commercialNote || '',
          categoryId: product.categoryId,
          salePrice: Number(product.salePrice || 0) * (product.priceCurrency === baseCurrency ? 1 : product.priceCurrency === 'USD' ? exchangeRate : 1 / exchangeRate),
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
           ...(product.itemType === 'SERVICE' ? {} : { warehouseId: undefined }),
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
          <button type="button" onClick={(e) => { e.stopPropagation(); toggleSelect(product.id, product); }} className="flex items-center justify-center size-7 rounded-md hover:bg-muted/60" aria-pressed={selectedIds.has(String(product.id))} aria-label={selectedIds.has(String(product.id)) ? `Quitar ${product.name} de la selección` : `Seleccionar ${product.name}`} title={selectedIds.has(String(product.id)) ? 'Quitar de la selección' : 'Agregar a la selección'}>
            {selectedIds.has(String(product.id))
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
        <TableCell className="align-top pt-3" style={{ width: PRODUCT_TABLE_WIDTHS.note, minWidth: PRODUCT_TABLE_WIDTHS.note }}>
          <Input
            value={product.commercialNote || ''}
            onChange={(e) => handleUpdateField(product.id, 'commercialNote', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, product.id)}
            placeholder="Nota comercial"
            maxLength={100}
            className="h-8 w-full min-w-0 text-xs"
            disabled={isSaving}
          />
          <span className="mt-1 block text-right text-[9px] text-muted-foreground">{Array.from(String(product.commercialNote || '')).length}/100</span>
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
            <span className="block text-[9px] text-muted-foreground">Tasa: {formatExchangeRate(product.priceCurrency === baseCurrency ? 1 : exchangeRate)}</span>
          </div>
        </TableCell>}
        {isServiceView && canViewInventoryCost && <TableCell className="align-top pt-3" style={{ width: PRODUCT_TABLE_WIDTHS.cost, minWidth: PRODUCT_TABLE_WIDTHS.cost }}>
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
    const visibleProducts = paginatedProducts.filter((product: any) => product?.id);
    const visibleIds = visibleProducts.map((product: any) => String(product.id));
    if (visibleIds.length === 0) return;
    const removeVisible = visibleIds.every((id) => selectedIds.has(id));

    setSelectedIds((previous) => {
      const next = new Set(previous);
      visibleIds.forEach((id) => (removeVisible ? next.delete(id) : next.add(id)));
      return next;
    });
    setSelectedProductMap((previous) => {
      const next = new Map(previous);
      visibleProducts.forEach((product: any) => {
        const id = String(product.id);
        if (removeVisible) next.delete(id);
        else next.set(id, product);
      });
      return next;
    });
  };

  const toggleSelect = (id: string, product?: any) => {
    const normalizedId = String(id);
    const isSelected = selectedIds.has(normalizedId);
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (isSelected) next.delete(normalizedId);
      else next.add(normalizedId);
      return next;
    });
    setSelectedProductMap((previous) => {
      const next = new Map(previous);
      if (isSelected) next.delete(normalizedId);
      else if (product) next.set(normalizedId, product);
      return next;
    });
  };

  const removeSelectedProduct = (id: string) => {
    const normalizedId = String(id);
    setSelectedIds((previous) => {
      const next = new Set(previous);
      next.delete(normalizedId);
      return next;
    });
    setSelectedProductMap((previous) => {
      const next = new Map(previous);
      next.delete(normalizedId);
      return next;
    });
  };

  const clearSelectedProducts = () => {
    setSelectedIds(new Set());
    setSelectedProductMap(new Map());
  };

  // ==================== EXCEL IMPORT ====================
  const handleDownloadSelectedTemplate = useCallback(() => {
    if (selectedIds.size === 0) {
      toast.error('Selecciona al menos un producto');
      return;
    }
    try {
      // Este botón mantiene su ubicación dentro de la tarjeta de selección,
      // pero la descarga siempre es una plantilla vacía. No se deben exportar
      // productos actuales del catálogo a un archivo destinado a una nueva carga.
      const catalogProducts: any[] = [];

      const priceListsByKey = new Map(importPriceLists.map((list) => [normalizePriceListImportKey(list.code), list]));
      importPriceLists.forEach((list) => priceListsByKey.set(normalizePriceListImportKey(list.name), list));
      const convertBaseAmount = (value: unknown) => {
        const amount = Number(value || 0);
        if (!Number.isFinite(amount)) return 0;
        const targetCurrency = String(importCurrency || baseCurrency).toUpperCase();
        const sourceCurrency = String(baseCurrency || 'NIO').toUpperCase();
        if (targetCurrency === sourceCurrency) return amount;
        const rate = Number(importExchangeRate || exchangeRate || 1);
        return sourceCurrency === 'NIO' && targetCurrency === 'USD' ? amount / rate : amount * rate;
      };
      const getProductPrice = (product: any, list: Pick<PriceList, 'code' | 'name'>, variantId?: string) => {
        const item = (product.priceListItems || []).find((candidate: any) => {
          const candidateList = candidate.priceList || {};
          const listMatches = normalizePriceListImportKey(candidateList.code) === normalizePriceListImportKey(list.code)
            || normalizePriceListImportKey(candidateList.name) === normalizePriceListImportKey(list.name);
          return listMatches && (variantId ? String(candidate.variantId || '') === String(variantId) : !candidate.variantId);
        });
        if (!item) return '';
        return convertBaseAmount(item.basePrice ?? item.price);
      };
      const getVariantCost = (product: any, variant: any) => {
        const cost = variant?.costPrice !== null && variant?.costPrice !== undefined
          ? variant.costPrice
          : product.costPrice;
        return canViewInventoryCost && cost !== undefined && cost !== null ? convertBaseAmount(cost) : '';
      };
      const isCustomVariant = (product: any, variant: any) => {
        const productCode = String(product.code || '').trim().toLowerCase();
        return product.variants?.length > 1 || String(variant?.sku || '').trim().toLowerCase() !== productCode || String(variant?.name || '').trim().toLowerCase() !== 'estándar';
      };
      const customVariants = catalogProducts.flatMap((product) => (product.variants || []).filter((variant: any) => isCustomVariant(product, variant)).map((variant: any) => ({ product, variant })));
      const productHeaders = ['Código / SKU', 'Nombre', 'Nota comercial', 'Categoría', 'Unidad', ...importPriceLists.map((list) => `Precio ${list.name}`), ...(canViewInventoryCost ? ['Costo'] : [])];
      const productRows = catalogProducts.map((product) => [
        product.code || '',
        product.name || '',
        product.commercialNote || '',
        product.category?.name || product.category || '',
        product.unit || 'unidad',
        ...importPriceLists.map((list) => getProductPrice(product, list)),
        ...(canViewInventoryCost ? [convertBaseAmount(product.costPrice)] : []),
      ]);
      const variantHeaders = ['Código producto', 'SKU variante', 'Nombre variante', 'Código de barras', ...(canViewInventoryCost ? ['Costo variante'] : [])];
      const variantRows = customVariants.map(({ product, variant }) => [
        product.code || '',
        variant.sku || '',
        variant.name || '',
        variant.barcode || '',
        ...(canViewInventoryCost ? [getVariantCost(product, variant)] : []),
      ]);
      const attributeRows = customVariants.flatMap(({ variant }) => (Array.isArray(variant.attributes) ? variant.attributes : []).map((attribute: any) => [
        variant.sku || '',
        attribute.attributeName || attribute.name || '',
        attribute.value || '',
      ]));
      const priceRows = catalogProducts.flatMap((product) => (product.priceListItems || []).flatMap((item: any) => {
        const list = priceListsByKey.get(normalizePriceListImportKey(item.priceList?.code || item.priceList?.name));
        if (!list) return [];
        const variant = (product.variants || []).find((candidate: any) => String(candidate.id) === String(item.variantId || ''));
        const variantIsCustom = variant && isCustomVariant(product, variant);
        return [[variantIsCustom ? 'VARIANTE' : 'PRODUCTO', product.code || '', variantIsCustom ? variant.sku || '' : '', list.name, convertBaseAmount(item.basePrice ?? item.price)]];
      }));
      const stockRows = catalogProducts.flatMap((product) => (product.stockLevels || []).map((level: any) => {
        const variant = (product.variants || []).find((candidate: any) => String(candidate.id) === String(level.variantId || ''));
        const variantIsCustom = variant && isCustomVariant(product, variant);
        const warehouse = level.warehouse?.name || importWarehouseOptions.find((candidate: any) => String(candidate.id) === String(level.warehouseId))?.name || '';
        return [product.code || '', variantIsCustom ? variant.sku : product.code || '', warehouse, Number(level.quantity || 0), Number(level.minStock || 0), level.maxStock ?? '', getVariantCost(product, variant), importCurrency, importCurrency === 'USD' ? Number(importExchangeRate || exchangeRate || 1) : 1];
      }));
      const appendSheet = (workbook: XLSX.WorkBook, name: string, rows: any[][]) => {
        const sheet = XLSX.utils.aoa_to_sheet(rows);
        sheet['!cols'] = rows[0].map((header) => ({ wch: Math.max(12, Math.min(30, String(header).length + 2)) }));
        XLSX.utils.book_append_sheet(workbook, sheet, name);
      };
      const workbook = XLSX.utils.book_new();
      appendSheet(workbook, 'Productos', [productHeaders, ...productRows]);
      appendSheet(workbook, 'Variantes', [variantHeaders, ...variantRows]);
      appendSheet(workbook, 'Atributos', [['SKU variante', 'Atributo', 'Valor'], ...attributeRows]);
      appendSheet(workbook, 'Precios', [['Alcance', 'Código producto', 'SKU variante', 'Lista', 'Precio'], ...priceRows]);
      appendSheet(workbook, 'Inventario', [['Código producto', 'SKU variante', 'Bodega', 'Stock inicial', 'Stock mínimo', 'Stock máximo', 'Costo entrada', 'Moneda costo', 'Tasa costo'], ...stockRows]);
      const guide = XLSX.utils.aoa_to_sheet([
        ['GUÍA · PLANTILLA VACÍA DE PRODUCTOS Y VARIANTES'],
        ['Plantilla vacía', 'No incluye productos actuales ni datos del catálogo. Completa las hojas Productos, Variantes, Atributos, Precios e Inventario antes de importarla.'],
        ['Listas de precios', importPriceLists.map((list) => list.name).join(' · ') || 'Sin listas configuradas'],
        ['Variantes', 'Registra una fila por SKU en Variantes y sus atributos en Atributos. Los productos simples usan su SKU padre.'],
        ['Stock', 'Registra una fila por SKU y bodega en Inventario. En productos con variantes, el padre no lleva stock propio.'],
        ['Costo', canViewInventoryCost ? `Registra los costos en ${importCurrency}.` : 'El costo no se captura porque tu rol no tiene permiso para verlo.'],
        ['Moneda', `Los valores numéricos deben registrarse en ${importCurrency}; no llevan símbolo dentro de la celda.`],
      ]);
      guide['!cols'] = [{ wch: 28 }, { wch: 120 }];
      XLSX.utils.book_append_sheet(workbook, guide, 'Guía de llenado');
      XLSX.writeFile(workbook, 'plantilla_importacion_productos_seleccionados.xlsx');
      toast.success('Plantilla vacía descargada');
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo generar la plantilla seleccionada');
    }
  }, [baseCurrency, canViewInventoryCost, exchangeRate, importCurrency, importExchangeRate, importPriceLists, importWarehouseOptions, selectedIds]);

  const handleDownloadTemplate = useCallback(() => {
    const wb = XLSX.utils.book_new();
    if (isServiceView) {
      const headers = ['Código / SKU', 'Nombre', 'Descripción', 'Nota comercial', 'Categoría', 'Unidad', 'Duración estimada (min)', 'Precio', ...(canViewInventoryCost ? ['Costo del servicio'] : []), 'Disponible', 'Imagen URL'];
      const sampleRow: any[] = ['SRV-001', 'Ejemplo de servicio', 'Descripción que aparecerá en ventas y documentos', 'Detalle comercial opcional', categories[0]?.name || 'Categoría de servicios', 'servicio', 60, 150, ...(canViewInventoryCost ? [80] : []), 'SI', ''];
      const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
      ws['!cols'] = headers.map((header) => ({ wch: Math.max(12, Math.min(28, header.length + 2)) }));
      XLSX.utils.book_append_sheet(wb, ws, 'Servicios');
      const guide = XLSX.utils.aoa_to_sheet([
        ['GUÍA DE LLENADO · IMPORTACIÓN DE SERVICIOS'],
        ['Puedes importar servicios en cualquier momento. Revisa, normaliza y corrige la previsualización antes de confirmar.'],
        ['Campo', 'Regla'],
        ['Código / SKU', 'Obligatorio y único dentro de la empresa.'],
        ['Nombre', 'Obligatorio.'],
        ['Descripción', 'Opcional. Texto descriptivo del servicio.'],
        ['Nota comercial', 'Opcional; máximo 100 caracteres. Se muestra en ventas y documentos.'],
        ['Categoría', 'Debe existir y ser de tipo servicio.'],
        ['Precio', 'Obligatorio. Es el único precio de venta del servicio; no usa listas de precios ni precios alternos.'],
        ['Importante', 'Los servicios no llevan IVA, no se vinculan a bodegas, no manejan stock y no tienen variantes.'],
        ['Imágenes', 'Imagen URL es opcional. También puedes cargar un ZIP/RAR y el sistema vinculará cada archivo por coincidencia exacta del SKU.'],
        ['Contabilidad', 'La importación de servicios no crea asiento de apertura porque no crea existencias físicas. El costo se conserva en el servicio y se contabiliza cuando corresponda en una venta.'],
      ]);
      guide['!cols'] = [{ wch: 36 }, { wch: 110 }];
      XLSX.utils.book_append_sheet(wb, guide, 'Guía de llenado');
      XLSX.writeFile(wb, 'plantilla_importacion_servicios.xlsx');
      toast.success('Plantilla descargada');
      return;
    }

    downloadCanonicalVariantImportTemplate({
      categoryName: categories[0]?.name || 'Categoría',
      warehouseName: importWarehouseOptions[0]?.name || '',
      priceLists: importPriceLists,
      currency: importCurrency,
      exchangeRate: importExchangeRate,
      canViewInventoryCost,
      locations: importWarehouseOptions.map((warehouse: any) => ({
        label: String(warehouse.name || '').trim(),
        type: 'BODEGA' as const,
      })).filter((location) => location.label),
      fileName: 'plantilla_importacion_productos_con_variantes.xlsx',
    });
    toast.success('Plantilla vacía de productos y variantes descargada');
  }, [categories, importWarehouseOptions, canViewInventoryCost, isServiceView, importCurrency, importExchangeRate, importPriceLists]);

  const handleDownloadImportErrors = useCallback(() => {
    const errors = importData.filter((row) => row._hasError || row._hasWarning).map((row) => ({
      'Código / SKU': row.code || '', Nombre: row.name || '', ...(isServiceView ? {
        Descripción: row.description || '',
        'Nota comercial': row.commercialNote || '',
        Categoría: row.category || '',
        Unidad: row.unit || '',
        'Duración estimada (min)': row.estimatedDuration ?? '',
        Precio: row.salePrice ?? '',
        ...(canViewInventoryCost ? { 'Costo del servicio': row.costPrice ?? '' } : {}),
        Disponible: row.isActive === false ? 'NO' : 'SI',
        'Imagen URL': row.imageUrl || '',
      } : {
        'Nota comercial': row.commercialNote || '',
        Categoría: row.category || '',
        Bodega: row.warehouse || '',
        ...(canViewInventoryCost ? { Costo: row.costPrice ?? '' } : {}),
      }),
      ...(!isServiceView ? Object.fromEntries(importPriceListsForView.map((list) => [`Precio ${list.name}`, row.prices?.[list.code] ?? ''])) : {}),
      Clasificación: row._hasError ? 'Error' : 'Advertencia', Detalle: row._errorMessage || row._warningMessage || 'Revisar fila',
    }));
    if (!errors.length) return;
    const ws = XLSX.utils.json_to_sheet(errors); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Incidencias'); XLSX.writeFile(wb, 'incidencias_importacion_inicial.xlsx');
    toast.success('Reporte de incidencias descargado');
  }, [importData, canViewInventoryCost, isServiceView, importPriceListsForView]);

  const validateImportRows = useCallback((rows: any[], entries = imageArchiveEntries, archiveName = imageArchiveFileName, categoryOptions = importCategoryOptions, warehouseOptions = importWarehouseOptions) => {
    const codeCounts = new Map<string, number>();
    const categoryNames = new Set(categoryOptions.map((category: any) => String(category.name || '').trim().toLowerCase()));
    const warehouseNames = new Set(warehouseOptions.map((warehouse: any) => String(warehouse.name || '').trim().toLowerCase()));
    rows.forEach((row) => {
      const code = String(row.code || '').trim().toLowerCase();
      if (code) codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
    });
    return rows.map((row) => {
      const code = String(row.code || '').trim();
      const commercialNote = String(row.commercialNote || '').trim();
      const categoryOk = categoryNames.has(String(row.category || '').trim().toLowerCase());
      const categoryWillBeCreated = !isServiceView && Boolean(row._advanced) && Boolean(String(row.category || '').trim());
      const cost = row.costPrice === '' || row.costPrice === undefined || row.costPrice === null ? undefined : Number(row.costPrice);
      const rawTaxRate = isServiceView ? 0 : (row.taxRate === '' || row.taxRate === undefined || row.taxRate === null ? 0.15 : Number(row.taxRate));
      const taxRate = rawTaxRate > 1 ? rawTaxRate / 100 : rawTaxRate;
      const prices = row.prices || {};
      const servicePrice = row.salePrice === '' || row.salePrice === undefined || row.salePrice === null ? undefined : Number(row.salePrice);
      const priceEntries = isServiceView ? [['Precio', servicePrice] as const] : importPriceListsForView.map((list) => [`Precio ${list.name}`, prices[list.code]] as const);
      const suppliedPrices = priceEntries.filter(([, value]) => value !== undefined && value !== '' && value !== null);
      const invalidPrice = suppliedPrices.find(([, value]) => !Number.isFinite(Number(value)) || Number(value) < 0);
      const hasAtLeastOnePrice = suppliedPrices.some(([, value]) => Number.isFinite(Number(value)) && Number(value) >= 0);
      const missingPrices = priceEntries.filter(([, value]) => value === undefined || value === '' || value === null).map(([label]) => label);
      const advancedStockRows = !isServiceView && row._advanced && Array.isArray(row._stockRows) ? row._stockRows : [];
      const advancedStockIssue = advancedStockRows.find((stockRow: any) => {
        const stockSku = String(stockRow?.variantSku || stockRow?.productCode || '').trim();
        const stockQuantity = Number(stockRow?.quantity ?? 0);
        const stockWarehouse = String(stockRow?.warehouse || '').trim();
        return !stockSku
          || !Number.isFinite(stockQuantity)
          || stockQuantity < 0
          || !stockWarehouse
          || !warehouseNames.has(stockWarehouse.toLowerCase());
      });
      const advancedStockError = advancedStockIssue
        ? `Inventario ${String(advancedStockIssue.variantSku || advancedStockIssue.productCode || '').trim() || 'sin SKU'}: ${!String(advancedStockIssue.warehouse || '').trim() ? 'bodega requerida' : !warehouseNames.has(String(advancedStockIssue.warehouse || '').trim().toLowerCase()) ? 'bodega no encontrada' : !Number.isFinite(Number(advancedStockIssue.quantity ?? 0)) || Number(advancedStockIssue.quantity ?? 0) < 0 ? 'stock inicial inválido' : 'fila inválida'}`
        : '';
       const stock = Number(row.initialStock || 0);
       const warehouseName = String(row.warehouse || '').trim();
       const warehouseExists = !warehouseName || warehouseNames.has(warehouseName.toLowerCase());
       const warehouseOk = warehouseExists && (stock <= 0 || Boolean(row.warehouseId || warehouseName));
       const errors = [
        !code ? 'SKU requerido' : codeCounts.get(code.toLowerCase())! > 1 ? 'SKU duplicado en la plantilla' : '',
        !String(row.name || '').trim() ? 'Nombre requerido' : '',
        Array.from(commercialNote).length > 100 ? 'Nota comercial supera 100 caracteres' : '',
         !categoryOk && !categoryWillBeCreated ? 'Categoría no encontrada' : '',
         !isServiceView && canViewInventoryCost && (cost === undefined || !Number.isFinite(cost) || cost < 0) ? 'Costo requerido y debe ser válido' : '',
         isServiceView && cost !== undefined && (!Number.isFinite(cost) || cost < 0) ? 'Costo del servicio inválido' : '',
         isServiceView && row.estimatedDuration !== undefined && row.estimatedDuration !== '' && (!Number.isInteger(Number(row.estimatedDuration)) || Number(row.estimatedDuration) < 0) ? 'Duración estimada inválida' : '',
         isServiceView && (!Number.isFinite(servicePrice) || servicePrice < 0) ? 'Precio del servicio inválido' : '',
         invalidPrice ? `Precio ${invalidPrice[0]} inválido` : !hasAtLeastOnePrice ? 'Debe incluir al menos un precio de venta' : '',
         !isServiceView && (!Number.isFinite(stock) || stock < 0 ? 'Stock inicial inválido' : !warehouseExists ? 'Bodega no encontrada' : !warehouseOk ? 'Selecciona una bodega para el stock inicial' : ''),
         advancedStockError,
       ].filter(Boolean);
       const imageStatus = archiveName ? (code && entries.has(productImageKey(code)) ? 'matched' : 'missing') : 'none';
      const warningParts = [
        ...(!isServiceView && missingPrices.length > 0 ? [`Sin precio: ${missingPrices.join(', ')}`] : []),
        ...(categoryWillBeCreated && !categoryOk ? [`La categoría "${String(row.category || '').trim()}" se creará al confirmar`] : []),
      ];
      return {
        ...row,
        code,
         name: String(row.name || '').trim(),
         description: String(row.description || '').trim(),
        commercialNote,
        taxRate: isServiceView ? 0 : taxRate,
        ...(isServiceView ? { estimatedDuration: row.estimatedDuration === undefined || row.estimatedDuration === '' ? undefined : Number(row.estimatedDuration) } : {}),
         ...(isServiceView ? { initialStock: 0, minStock: 0, warehouse: '', warehouseId: undefined } : {}),
         ...(canViewInventoryCost ? { costPrice: cost } : {}),
        salePrice: isServiceView ? servicePrice : getPrimaryImportPrice(prices),
        _hasError: errors.length > 0,
        _errorMessage: errors[0],
        _hasWarning: warningParts.length > 0,
        _warningMessage: warningParts.join(' · '),
        _imageStatus: imageStatus,
      };
    });
  }, [importCategoryOptions, importWarehouseOptions, imageArchiveEntries, imageArchiveFileName, canViewInventoryCost, isServiceView, importPriceListsForView, getPrimaryImportPrice]);

  const handleFileSelected = useCallback(async (file: File) => {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast.error('Selecciona un archivo Excel o CSV válido');
      return;
    }
    setImportProcessing(true);
    setPreviewLoading(true);
    setPreviewProgress(3);
    try {
        const { rows: raw, sheets } = await parseSpreadsheetInWorker(file, undefined, true, (progress) => {
          setPreviewProgress(Math.min(84, Math.max(3, progress)));
        });
        setPreviewProgress(88);
        const normalizedSheetNames = Object.keys(sheets || {}).map((name) => normalizeImportHeader(name).replace(/ /g, ''));
        const hasAdvancedSheets = !isServiceView
          && normalizedSheetNames.includes('productos')
          && normalizedSheetNames.some((name) => ['variantes', 'atributos', 'precios', 'inventario'].includes(name));
        if (hasAdvancedSheets && sheets) {
          const catalog = parseVariantImportWorkbook(sheets, importPriceLists);
          const previewRows = buildVariantImportPreviewRows(catalog);
          const validated = validateImportRows(previewRows);
          setAdvancedImportCatalog(catalog);
          setImportData(validated);
          setImportFileName(file.name);
          setImportProgress(0);
          setPreviewProgress(100);
          toast.success(`${catalog.products.length} producto(s), ${catalog.variants.length} variante(s) y ${catalog.attributes.length} atributo(s) encontrados`);
          return;
        }
        setAdvancedImportCatalog(null);
        if (raw.length < 2) {
          toast.error('El archivo está vacío o no tiene datos');
          return;
        }
        const headers = raw[0].map((h: any) => normalizeImportHeader(h));
        const colMap: Record<string, number> = {};
        const aliases: Record<string, string[]> = {
          code: ['código / sku', 'código', 'codigo', 'code', 'sku'], name: ['nombre', 'name', 'producto'], description: ['descripción', 'descripcion', 'description'], category: ['categoría', 'categoria', 'category', 'cat'], taxRate: ['tasa iva', 'iva', 'tax rate'], imageUrl: ['imagen url', 'imagen', 'image url'], barcode: ['código de barras', 'barcode'], brand: ['marca', 'brand'], model: ['modelo', 'model'], color: ['color'], weight: ['peso', 'weight'], weightUnit: ['unidad peso', 'weight unit'], dimensions: ['dimensiones', 'dimensions'], width: ['ancho', 'width'], height: ['alto', 'height'], depth: ['profundidad', 'depth'], dimensionUnit: ['unidad dimensión', 'dimension unit'], warranty: ['garantía', 'garantia', 'warranty'], estimatedDuration: ['duración estimada', 'duracion estimada'], servicePrice: ['precio', 'precio servicio', 'service price'], unit: ['unidad', 'unit', 'medida'], trackInventory: ['control de inventario', 'track inventory'], minStock: ['stock mínimo', 'stock minimo', 'min stock'], costPrice: ['costo', 'precio costo', 'cost price'], lastPurchasePrice: ['último costo', 'ultimo costo', 'last purchase price'], initialStock: ['stock inicial', 'initial stock', 'cantidad', 'qty'], warehouse: ['bodega', 'almacén', 'almacen', 'warehouse'], trackBatch: ['control de lotes', 'track batch'], trackSeries: ['control de series', 'track series'], attributes: ['atributos json', 'atributos', 'attributes'], retailPrice: ['precio minorista', 'minorista', 'retail price'], wholesalePrice: ['precio mayorista', 'mayorista', 'wholesale price'], distributorPrice: ['precio distribuidor', 'distribuidor', 'distributor price'],
        };
          aliases.commercialNote = ['nota comercial', 'nota', 'commercial note', 'commercialnote'];
          aliases.isActive = ['disponible', 'estado', 'activo', 'active', 'is active'];
        for (const [key, alts] of Object.entries(aliases)) {
          const normalizedAliases = alts.map((alias) => normalizeImportHeader(alias));
          const idx = headers.findIndex((header: string) => normalizedAliases.some((alias) => header === alias || header.startsWith(`${alias} `)));
          if (idx >= 0) colMap[key] = idx;
        }
        const dynamicPriceColumns = new Map<number, string>();
        for (let index = 0; index < headers.length; index += 1) {
          const header = headers[index];
          const list = !isServiceView && importPriceListsForView.find((candidate) => [
            normalizeImportHeader(`Precio ${candidate.name}`),
            normalizeImportHeader(candidate.name),
            normalizeImportHeader(candidate.code),
          ].includes(header));
          if (list) dynamicPriceColumns.set(index, list.code);
        }
        const parsed = raw.slice(1).filter((row: any[]) => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')).map((row: any[]) => {
          const get = (key: string) => colMap[key] !== undefined ? row[colMap[key]] : undefined;
          const toNumber = (key: string) => get(key) === '' || get(key) === undefined ? undefined : Number(get(key));
          const prices: Record<string, number | undefined> = {};
          dynamicPriceColumns.forEach((priceCode, index) => {
            const value = row[index];
            prices[priceCode] = value === '' || value === undefined || value === null ? undefined : Number(value);
          });
          if (!isServiceView && dynamicPriceColumns.size === 0) {
            prices.RETAIL = toNumber('retailPrice');
            prices.WHOLESALE = toNumber('wholesalePrice');
            prices.DISTRIBUTOR = toNumber('distributorPrice');
          }
          let attributes: any = undefined;
          if (get('attributes')) { try { attributes = JSON.parse(String(get('attributes'))); } catch { attributes = String(get('attributes')); } }
          const servicePrice = get('servicePrice') === '' || get('servicePrice') === undefined || get('servicePrice') === null
            ? undefined
            : Number(get('servicePrice'));
          return {
            code: String(get('code') || '').trim(),
            name: String(get('name') || '').trim(),
            category: String(get('category') || '').trim(),
            itemType: catalogItemType,
            commercialNote: String(get('commercialNote') || '').trim(),
            description: String(get('description') || '').trim(), taxRate: catalogItemType === 'SERVICE' ? 0 : (toNumber('taxRate') ?? 0.15), isActive: !['NO', 'N', '0', 'FALSE', 'INACTIVO', 'NO DISPONIBLE'].includes(String(get('isActive') ?? 'SI').trim().toUpperCase()), imageUrl: String(get('imageUrl') || '').trim() || undefined, barcode: String(get('barcode') || '').trim() || undefined, brand: String(get('brand') || '').trim() || undefined, model: String(get('model') || '').trim() || undefined, color: String(get('color') || '').trim() || undefined, weight: toNumber('weight'), weightUnit: String(get('weightUnit') || '').trim() || undefined, dimensions: String(get('dimensions') || '').trim() || undefined, width: toNumber('width'), height: toNumber('height'), depth: toNumber('depth'), dimensionUnit: String(get('dimensionUnit') || '').trim() || undefined, warranty: String(get('warranty') || '').trim() || undefined, estimatedDuration: toNumber('estimatedDuration'), trackInventory: String(get('trackInventory') || 'SI').toUpperCase() !== 'NO', lastPurchasePrice: toNumber('lastPurchasePrice'), trackBatch: String(get('trackBatch') || '').toUpperCase() === 'SI', trackSeries: String(get('trackSeries') || '').toUpperCase() === 'SI', attributes,
            unit: String(get('unit') ?? '').trim().toLowerCase(),
            salePrice: catalogItemType === 'SERVICE'
              ? servicePrice
              : Number(prices.RETAIL ?? prices.WHOLESALE ?? prices.DISTRIBUTOR ?? 0),
            costPrice: get('costPrice') === '' || get('costPrice') === undefined ? undefined : Number(get('costPrice')),
             initialStock: catalogItemType === 'SERVICE' ? 0 : Number(get('initialStock') || 0),
             minStock: catalogItemType === 'SERVICE' ? 0 : Number(get('minStock') || 0),
             warehouse: catalogItemType === 'SERVICE' ? '' : String(get('warehouse') || '').trim(), prices: catalogItemType === 'SERVICE' ? {} : prices,
          };
        });
        setPreviewProgress(94);
        setImportData(validateImportRows(parsed));
        setImportFileName(file.name);
        setImportProgress(0);
        setPreviewProgress(100);
        toast.success(`${parsed.length} registros encontrados`);
    } catch (err) {
          console.error('Parse error', err);
          toast.error('No se pudo leer el archivo. Asegúrate de que sea un .xlsx o .csv válido.');
    } finally {
      setImportProcessing(false);
      setPreviewLoading(false);
      setPreviewProgress(0);
    }
  }, [validateImportRows, catalogItemType, isServiceView, importPriceLists, importPriceListsForView]);

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
    if (previewLoading || previewMounting || importProcessing || importing || importData.length === 0) return;
    setPreviewMounting(true);
    setPreviewProgress(8);
    setImportModalOpen(false);
    previewMountTimerRef.current = window.setTimeout(() => {
      previewMountTimerRef.current = null;
      setPreviewProgress(45);
      startTransition(() => setImportPreviewOpen(true));
    }, 80);
  }, [importData.length, importProcessing, importing, previewLoading, previewMounting]);

  const handleImportPreviewReady = useCallback(() => {
    setPreviewProgress(100);
    if (previewFinishTimerRef.current !== null) window.clearTimeout(previewFinishTimerRef.current);
    previewFinishTimerRef.current = window.setTimeout(() => {
      previewFinishTimerRef.current = null;
      setPreviewMounting(false);
      setPreviewProgress(0);
    }, 180);
  }, []);

  const handleImportRowUpdate = (index: number, field: string, value: any) => {
    const currentRow = importData[index];
    const isAdvancedProduct = Boolean(advancedImportCatalog && !isServiceView && currentRow?._advanced);
    const isSimpleAdvancedProduct = Boolean(
      isAdvancedProduct
      && !(currentRow._hasVariants === true || Number(currentRow._variantCount || 0) > 0),
    );
    if (isAdvancedProduct && field === 'warehouse') {
      const sourceCode = String(currentRow._sourceCode || currentRow.code || '').trim().toLowerCase();
      setAdvancedImportCatalog((previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          stock: previous.stock.map((stockRow) => String(stockRow.productCode || '').trim().toLowerCase() === sourceCode
            ? { ...stockRow, warehouse: String(value || '').trim() }
            : stockRow),
        };
      });
    }
    if (isSimpleAdvancedProduct && ['initialStock', 'minStock', 'warehouse'].includes(field)) {
      const sourceCode = String(currentRow._sourceCode || currentRow.code || '').trim().toLowerCase();
      setAdvancedImportCatalog((previous) => {
        if (!previous) return previous;
        const stock = previous.stock.map((stockRow) => {
          const productCode = String(stockRow.productCode || '').trim().toLowerCase();
          const variantSku = String(stockRow.variantSku || '').trim().toLowerCase();
          if (productCode !== sourceCode || variantSku !== sourceCode) return stockRow;
          return {
            ...stockRow,
            ...(field === 'initialStock' ? { quantity: value === '' ? 0 : Number(value) || 0 } : {}),
            ...(field === 'minStock' ? { minStock: value === '' ? 0 : Number(value) || 0 } : {}),
            ...(field === 'warehouse' ? { warehouse: String(value || '').trim() } : {}),
          };
        });
        return { ...previous, stock };
      });
    }
    setImportData((prev) => {
      const next = [...prev];
      const row = { ...next[index], prices: { ...(next[index].prices || {}) } };
      if (field === 'servicePrice') {
        row.salePrice = value === '' ? undefined : Number(value);
        row.taxRate = 0;
      } else if (field.startsWith('price.')) {
        const priceCode = field.split('.')[1];
        row.prices[priceCode] = value === '' ? undefined : Number(value);
        row.salePrice = getPrimaryImportPrice(row.prices);
      } else {
        row[field] = value;
      }
      if (isAdvancedProduct && field === 'warehouse') {
        row._stockRows = (row._stockRows || []).map((stockRow: any) => ({ ...stockRow, warehouse: String(value || '').trim() }));
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
      return next;
    });
    if (importValidationTimerRef.current !== null) window.clearTimeout(importValidationTimerRef.current);
    importValidationTimerRef.current = window.setTimeout(() => {
      setImportData((current) => validateImportRows(current));
      importValidationTimerRef.current = null;
    }, 260);
  };

  const handleImportStockWarehouseUpdate = useCallback((catalogIndex: number, warehouseName: string) => {
    const normalizedWarehouse = String(warehouseName || '').trim();
    setAdvancedImportCatalog((previous) => {
      if (!previous || !previous.stock[catalogIndex]) return previous;
      return {
        ...previous,
        stock: previous.stock.map((stockRow, index) => index === catalogIndex
          ? { ...stockRow, warehouse: normalizedWarehouse }
          : stockRow),
      };
    });
    setImportData((current) => validateImportRows(current.map((row) => ({
      ...row,
      _stockRows: Array.isArray(row._stockRows)
        ? row._stockRows.map((stockRow: any) => Number(stockRow.__catalogIndex) === catalogIndex
          ? { ...stockRow, warehouse: normalizedWarehouse }
          : stockRow)
        : row._stockRows,
    }))));
  }, [validateImportRows]);

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

  const uploadInitialImportImages = useCallback(async (rows: any[]) => {
    const imageRows = rows.filter((row) => imageArchiveEntries.has(productImageKey(row.code)));
    if (imageRows.length === 0) return;
    const updates: Array<{ code: string; imageUrl: string }> = [];
    const failed: string[] = [];
    let cursor = 0;
    const uploadWorker = async () => {
      while (cursor < imageRows.length) {
        const row = imageRows[cursor++];
        const imageFile = imageArchiveEntries.get(productImageKey(row.code));
        if (!imageFile) continue;
        try {
          const uploaded = await storageService.uploadFile('product-image', imageFile, { folder: 'catalogo-inicial' });
          updates.push({ code: row.code, imageUrl: uploaded.uri });
        } catch {
          failed.push(String(row.code || row.name || 'Producto'));
        }
      }
    };
    toast.info(`Los ${isServiceView ? 'servicios' : 'productos'} ya fueron creados. Vinculando ${imageRows.length} imagen(es) en segundo plano...`);
    try {
      // Cuatro tareas mantienen buen rendimiento en equipos modestos: la
      // compresión usa canvas y más concurrencia puede competir con el hilo
      // de renderizado sin acelerar proporcionalmente la red.
      await Promise.all(Array.from({ length: Math.min(4, imageRows.length) }, () => uploadWorker()));
      if (updates.length > 0) {
        await inventoryService.updateProductImages(updates);
        onRefresh();
      }
       if (failed.length > 0) toast.warning(`${failed.length} imagen(es) no pudieron vincularse; los ${isServiceView ? 'servicios' : 'productos'} permanecen creados.`);
      else toast.success(`${updates.length} imagen(es) vinculada(s) correctamente.`);
    } catch (error) {
      console.error('No se pudieron vincular las imágenes de la importación inicial', error);
       toast.warning(`Los ${isServiceView ? 'servicios' : 'productos'} fueron creados, pero no se pudieron vincular todas las imágenes. Puedes reintentarlo desde carga masiva de imágenes.`);
    }
  }, [imageArchiveEntries, onRefresh, isServiceView]);

  const handleFinalInitialImport = useCallback(async () => {
    const valid = importData.filter((row) => !row._hasError);
    if (initialImportConfirmText !== 'IMPORTAR' || valid.length === 0) return;
    setImporting(true);
    setImportProgress(10);
    try {
      const categoryByName = new Map(importCategoryOptions.map((category: any) => [String(category.name || '').trim().toLowerCase(), category]));
       const warehouseByName = new Map(importWarehouseOptions.map((warehouse: any) => [String(warehouse.name || '').trim().toLowerCase(), warehouse]));
      const finalCodeBySource = new Map(valid.map((row) => [String(row._sourceCode || row.code).trim().toLowerCase(), String(row.code || '').trim()]));
      const items = valid.map((row) => {
        const cat = categoryByName.get(String(row.category || '').trim().toLowerCase());
        const warehouse = warehouseByName.get(String(row.warehouse || '').trim().toLowerCase());
        return {
          code: row.code,
          name: row.name,
          categoryId: cat?.id,
          commercialNote: row.commercialNote,
          description: row.description, taxRate: isServiceView ? 0 : row.taxRate, imageUrl: row.imageUrl, barcode: row.barcode, brand: row.brand, model: row.model, color: row.color, weight: row.weight, weightUnit: row.weightUnit, dimensions: row.dimensions, width: row.width, height: row.height, depth: row.depth, dimensionUnit: row.dimensionUnit, warranty: row.warranty, estimatedDuration: row.estimatedDuration, trackInventory: row.trackInventory, trackBatch: row.trackBatch, attributes: row.attributes,
          unit: String(row.unit ?? '').trim(),
          ...(canViewInventoryCost ? { costPrice: row.costPrice } : {}),
          ...(canViewInventoryCost ? { lastPurchasePrice: row.lastPurchasePrice } : {}),
           ...(isServiceView ? {} : { initialStock: row.initialStock, minStock: row.minStock || 0, warehouseId: warehouse?.id }),
           prices: isServiceView ? undefined : row.prices,
           price: row.salePrice,
           trackSeries: Boolean(row.trackSeries),
           isActive: row.isActive !== false,
         };
       });
       const advancedCatalogPayload = advancedImportCatalog && !isServiceView
         ? {
             ...advancedImportCatalog,
             products: valid.map((row) => {
               const category = categoryByName.get(String(row.category || '').trim().toLowerCase());
               return {
                 ...row,
                 code: row.code,
                 name: row.name,
                 categoryId: category?.id,
                 itemType: 'PRODUCT',
                 costPrice: canViewInventoryCost ? row.costPrice : undefined,
               };
             }),
             variants: advancedImportCatalog.variants
               .filter((variant) => finalCodeBySource.has(String(variant.productCode || '').trim().toLowerCase()))
               .map((variant) => ({
                 ...variant,
                 productCode: finalCodeBySource.get(String(variant.productCode || '').trim().toLowerCase()) || variant.productCode,
               })),
             prices: [
               ...advancedImportCatalog.prices
                 .filter((price) => String(price.scope).toUpperCase() === 'VARIANT' && finalCodeBySource.has(String(price.productCode || '').trim().toLowerCase()))
                 .map((price) => ({
                   ...price,
                   productCode: finalCodeBySource.get(String(price.productCode || '').trim().toLowerCase()) || price.productCode,
                 })),
               ...valid.flatMap((row) => Object.entries(row.prices || {})
                 .filter(([, value]) => value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0)
                 .map(([priceListCode, value]) => ({ scope: 'PRODUCT' as const, productCode: row.code, priceListCode, price: Number(value) }))),
             ],
             stock: advancedImportCatalog.stock
               .filter((stock) => !stock.productCode || finalCodeBySource.has(String(stock.productCode).trim().toLowerCase()))
               .map((stock) => {
                 const warehouse = warehouseByName.get(String(stock.warehouse || '').trim().toLowerCase());
                 return {
                   ...stock,
                   productCode: stock.productCode ? finalCodeBySource.get(String(stock.productCode).trim().toLowerCase()) || stock.productCode : undefined,
                   warehouseId: warehouse?.id,
                 };
               }),
           }
           : null;
        if (!isServiceView) {
          const stockWarehouseIds = [...new Set((advancedCatalogPayload
            ? advancedCatalogPayload.stock
              .filter((stock: any) => Number(stock.quantity ?? 0) > 0)
              .map((stock: any) => String(stock.warehouseId || '').trim())
            : items
              .filter((item: any) => Number(item.initialStock ?? 0) > 0)
              .map((item: any) => String(item.warehouseId || '').trim()))
            .filter(Boolean))];
          if (stockWarehouseIds.length > 0) {
            const accountingResponse = await inventoryService.previewProductStockAccounting(stockWarehouseIds);
            const accountingPreview = (accountingResponse as any)?.data || accountingResponse;
            if (!accountingPreview?.ready) {
              const message = Array.isArray(accountingPreview?.errors) && accountingPreview.errors.length > 0
                ? accountingPreview.errors.join(' ')
                : 'Completa la configuración contable de Inventario y de las bodegas antes de importar stock.';
              throw new Error(message);
            }
          }
        }
        setImportProgress(25);
       const results = isServiceView
         ? await inventoryService.importServices({ items, currency: importCurrency, exchangeRate: importExchangeRate, reimportMode: 'MERGE', confirmText: 'IMPORTAR' })
         : advancedCatalogPayload
           ? await inventoryService.importInitialCatalog({ catalog: advancedCatalogPayload, currency: importCurrency, exchangeRate: importExchangeRate, priceListCode: 'RETAIL', createMissingAttributes: true, reimportMode: 'MERGE', confirmText: 'IMPORTAR' })
           : await inventoryService.importInitialCatalog({ items, currency: importCurrency, exchangeRate: importExchangeRate, priceListCode: 'RETAIL', reimportMode: 'MERGE', confirmText: 'IMPORTAR' });
      setImportProgress(90);
      setImportResults({ success: (results.success || 0) + (results.updatedProductCount || 0) + (results.updatedServiceCount || 0), skipped: (importData.length - valid.length) + (results.skipped || 0), failed: results.errors?.length || 0, errors: results.errors || [], warnings: results.warnings || [] });
      setImportModalOpen(false);
      setInitialImportConfirmOpen(false);
      setImportPreviewOpen(false);
      setInitialImportConfirmText('');
      setImportData([]);
      setAdvancedImportCatalog(null);
      setImportFileName('');
      setInitialImportCompleted(true);
      onRefresh();
      void uploadInitialImportImages(valid);
      setImportProgress(100);
      window.setTimeout(() => setImportResults(null), 2600);
    } catch (e: any) {
      toast.error('Error durante la importación: ' + (e.message || 'Error'));
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  }, [importData, advancedImportCatalog, importCategoryOptions, importWarehouseOptions, importCurrency, importExchangeRate, initialImportConfirmText, onRefresh, canViewInventoryCost, uploadInitialImportImages, isServiceView]);

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
        pageSize: Math.max(1, entries.size),
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
    const updates: Array<{ code: string; imageUrl: string }> = [];
    let cursor = 0;
    let completed = 0;
    const uploadWorker = async () => {
      while (cursor < bulkImageProducts.length) {
        const product = bulkImageProducts[cursor++];
        const sku = String(product.code || '').trim().toLowerCase();
        const imageFile = bulkImageEntries.get(sku);
        try {
          if (!imageFile) throw new Error('Imagen no encontrada');
          const uploaded = await storageService.uploadFile('product-image', imageFile, { folder: product.id });
          updates.push({ code: product.code, imageUrl: uploaded.uri });
        } catch (error) {
          console.error(`No se pudo actualizar la imagen del producto ${product.code}`, error);
          failed.push(String(product.code || product.name || 'Producto'));
        } finally {
          completed += 1;
          setBulkImageProgress(Math.round((completed / bulkImageProducts.length) * 90));
        }
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(4, bulkImageProducts.length) }, () => uploadWorker()));
      if (updates.length > 0) {
        await inventoryService.updateProductImages(updates);
        setBulkImageProgress(100);
        onRefresh();
      }
      setBulkImageResults({ updated: updates.length, failed });
      if (failed.length === 0) toast.success(`${updates.length} imagen(es) actualizada(s) correctamente`);
      else toast.warning(`${updates.length} imagen(es) actualizada(s) y ${failed.length} con incidencia`);
    } finally {
      setBulkImageUploading(false);
    }
  }, [bulkImageUploading, bulkImageProducts, bulkImageEntries, onRefresh]);

  return (
    <>
      <Card data-import-preview-shell={importPreviewOpen ? 'true' : undefined} className={importPreviewOpen ? `fixed inset-y-0 right-0 left-0 z-40 flex h-dvh min-h-0 w-auto max-w-none flex-col overflow-hidden rounded-none border-0 bg-background p-3 shadow-none sm:p-6 ${isSidebarCollapsed ? 'lg:left-[72px]' : 'lg:left-[270px]'}` : 'rounded-xl border bg-card p-4'}>
      {importPreviewOpen ? (
        <ImportPreviewPage
          importData={importData}
          advancedCatalog={advancedImportCatalog}
          importFileName={importFileName}
          importCurrency={importCurrency}
          categoryOptions={importCategoryOptions}
          warehouseOptions={importWarehouseOptions}
          importing={importing}
          importProgress={importProgress}
          onRowUpdate={handleImportRowUpdate}
          onStockWarehouseUpdate={handleImportStockWarehouseUpdate}
          onDownloadErrors={handleDownloadImportErrors}
          onCreateCategory={(index, value) => {
            setPendingCategoryRowIndex(index);
            setNewCategoryName(value);
            setNewCategoryDescription('');
            setCategoryModalOpen(true);
          }}
          canCreateCategory={canPerform('INVENTORY', 'edit')}
          onConfirm={handleImportConfirm}
          onBack={() => {
            if (previewMountTimerRef.current !== null) window.clearTimeout(previewMountTimerRef.current);
            if (previewFinishTimerRef.current !== null) window.clearTimeout(previewFinishTimerRef.current);
            setPreviewMounting(false);
            setPreviewProgress(0);
            setImportPreviewOpen(false);
            setImportModalOpen(true);
          }}
          onReady={handleImportPreviewReady}
          isService={isServiceView}
          priceLists={importPriceListsForView}
        />
      ) : (
        <>
      {/* ─── Encabezado + KPIs ─── */}
      <div className="mb-4" data-tour="inventory-products-title">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">{isServiceView ? 'Servicios' : 'Productos y existencias'}</h2>
          </div>
          <p className="text-xs font-medium text-muted-foreground">{displayWarehouseOptions.length} bodegas visibles</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" data-tour="inventory-products-kpis">
          {inventoryKpis.map((item) => (
            <SalesKpiCard
              key={item.title}
              title={item.title}
              value={item.value}
              icon={item.icon}
              color={item.color}
              bg={item.bg}
              kind={item.kind}
              active={'filter' in item ? stockFilter === item.filter : false}
              onClick={'filter' in item ? () => setStockFilter(item.filter) : undefined}
            />
          ))}
        </div>
        {!isServiceView && selectedBranchId && (() => {
          const selectedBranch = (branches || []).find((b: any) => b.id === selectedBranchId) || null;
          const linkedWarehouses = displayWarehouseOptions.filter((w: any) => branchWarehouseIdSet.has(w.id));
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
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bodegas vinculadas</span>
                  {linkedWarehouses.map((warehouse: any) => (
                    <button
                      key={warehouse.id}
                      type="button"
                      onClick={() => setWarehouseDetail(warehouse)}
                      title="Ver detalle de la bodega"
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

      {/* ─── Acciones fijas + filtros desplegables ─── */}
      <div className="mb-4 flex min-w-0 flex-col gap-3">
      <div className={`inventory-products-composite-toolbar erp-composite-toolbar flex min-w-0 flex-col gap-3 min-[1800px]:flex-row min-[1800px]:items-start min-[1800px]:justify-between ${filtersOpen ? 'inventory-products-toolbar-open' : ''}`}>
          <div className="inventory-products-filter-section min-w-0 flex-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-tour="inventory-products-filter-toggle"
              aria-expanded={filtersOpen}
              aria-controls="inventory-products-filter-panel"
              className="h-10 shrink-0 rounded-xl border-primary/40 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10"
              onClick={() => setFiltersOpen((open) => !open)}
              title={filtersOpen ? 'Ocultar filtros del catálogo' : 'Mostrar filtros del catálogo'}
            >
              <SlidersHorizontal className="mr-2 size-4" /> {filtersOpen ? 'Ocultar filtros' : 'Filtros'}
              {activeProductFilterCount > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{activeProductFilterCount}</Badge>}
            </Button>
            {filtersOpen && (
              <div id="inventory-products-filter-panel" className="mt-3 max-w-full rounded-2xl border border-border/50 bg-muted/10 p-3" data-tour="inventory-products-filters">
                <div className="erp-toolbar-filter-group flex min-w-0 flex-wrap items-center gap-2" data-toolbar-role="filters">
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
            options={displayWarehouseOptions.map((w: any) => ({ value: w.id, label: w.name }))}
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
                    <label className="flex h-10 shrink-0 cursor-pointer select-none items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3" title="Mostrar todos los productos incluyendo los de bodegas sin sucursal">
              <Checkbox checked={showAllWarehouseProducts} onCheckedChange={(checked) => setShowAllWarehouseProducts(checked !== false)} className="size-4" />
              <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-muted-foreground">Todas las bodegas</span>
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
              </div>
            )}
          </div>

          <div className="erp-toolbar-primary-group flex w-full max-w-full shrink-0 flex-wrap items-center justify-start gap-2 min-[1800px]:w-auto min-[1800px]:justify-end" data-tour="inventory-products-actions">
          {canPerform('INVENTORY_PRODUCTS', 'create') && (
            <Button type="button" size="sm" data-toolbar-role="primary" className="h-10 shrink-0 rounded-xl border border-primary/20 bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90 md:order-last" onClick={() => setCreateModalOpen(true)}>
              <Plus className="mr-2 size-4" /> Nuevo
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" data-toolbar-role="help" aria-label={`Cómo usar la vista de ${isServiceView ? 'servicios' : 'productos'}`} title={`Cómo usar la vista de ${isServiceView ? 'servicios' : 'productos'}`} className="h-10 shrink-0 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest" onClick={() => setShowTutorial(true)}>
            <CircleHelp className="mr-2 size-4" /> Cómo usar la vista de {isServiceView ? 'servicios' : 'productos'}
          </Button>
          {canPerform('INVENTORY', 'edit') && (
            <Button type="button" size="sm" variant="outline" className="h-10 shrink-0 rounded-xl border-primary/40 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10" onClick={() => setInitialImportIntroOpen(true)} title={`Importar ${isServiceView ? 'servicios' : 'el catálogo inicial'} desde una plantilla`}>
              <Upload className="mr-2 size-4" /> Importar {isServiceView ? 'servicios' : 'productos'}
            </Button>
          )}
          {!isServiceView && canPerform('INVENTORY_PRODUCTS', 'edit') && (
            <Button type="button" size="sm" variant="outline" className="h-10 shrink-0 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest" onClick={() => setBulkImageModalOpen(true)} title="Actualizar imágenes masivamente por SKU">
              <ImageIcon className="mr-2 size-4" /> Imágenes
            </Button>
          )}
          {!isServiceView && selectedIds.size === 0 && canCreatePurchaseRequest && (
            <Button type="button" size="sm" variant="outline" aria-label="Solicitar compra" title="Crear una solicitud de compra desde inventario" className="h-10 shrink-0 rounded-xl border-primary/40 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10" onClick={openLowStockSolicitud}>
              <PackageSearch className="mr-2 size-4" />Solicitar compra
            </Button>
          )}
          {!isServiceView && canPerform('INVENTORY_PRODUCTS', 'export') && (
            <Button type="button" size="sm" variant="outline" className="h-10 shrink-0 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest" onClick={() => setLabelModalOpen(true)} title="Imprimir etiquetas con código de barras">
              <Barcode className="mr-2 size-4" /> Etiquetas
            </Button>
          )}
        </div>
          </div>
        </div>

      {!isServiceView && selectedCatalogProducts.length > 0 && (
        <section className="mb-4 min-w-0 rounded-2xl border border-primary/25 bg-primary/[0.04] p-3" aria-labelledby="inventory-selected-products-title">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div id="inventory-selected-products-title" className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-primary">
                <Check className="size-4 shrink-0" /> Productos seleccionados
                <Badge variant="secondary" className="text-[10px]">{selectedIds.size}</Badge>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">La selección permanece aunque cambies la búsqueda, los filtros o la página. Puedes quitar productos aquí o continuar con la solicitud.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {canCreatePurchaseRequest && <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg border-primary/40 px-2.5 text-[10px] font-black uppercase tracking-wider text-primary hover:bg-primary/10" onClick={openSelectedSolicitud}>
                <PackageSearch className="mr-1.5 size-3.5" /> Solicitar compra
              </Button>}
              {canPerform('INVENTORY_PRODUCTS', 'export') && <Button type="button" size="sm" variant="outline" aria-label="Descargar plantilla vacía de productos" title="Descargar una plantilla vacía para productos y variantes" className="h-8 rounded-lg border-primary/40 px-2.5 text-[10px] font-black uppercase tracking-wider text-primary hover:bg-primary/10" onClick={() => void handleDownloadSelectedTemplate()}>
                <Download className="mr-1.5 size-3.5" /> Plantilla
              </Button>}
              <Button type="button" size="sm" variant="ghost" className="h-8 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-destructive" onClick={clearSelectedProducts}>
                <X className="mr-1.5 size-3.5" /> Quitar todos
              </Button>
            </div>
          </div>
          <div className="mt-3 flex max-h-28 min-w-0 flex-wrap gap-2 overflow-y-auto pr-1" role="list" aria-label="Productos seleccionados">
            {selectedCatalogProducts.map((product: any) => (
              <div key={String(product.id)} role="listitem" className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-primary/20 bg-background/80 px-2.5 py-1.5">
                <div className="min-w-0">
                  <span className="block max-w-[15rem] truncate text-[11px] font-bold" title={product.name}>{product.name || 'Producto sin nombre'}</span>
                  <span className="block max-w-[15rem] truncate font-mono text-[9px] text-muted-foreground" title={product.code || undefined}>{product.code || 'Sin código'}</span>
                </div>
                <button type="button" className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => removeSelectedProduct(product.id)} aria-label={`Quitar ${product.name || 'producto'} de la selección`} title="Quitar de la selección">
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

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
          const warehousesForProduct = warehouseNamesForProduct(product);
          const costPrice = Number(product.costPrice || 0);
          const maxStock = getProductMaxStock(product);
          return (
            <Card key={product.id} aria-busy={String(openingId) === String(product.id) || undefined} data-detail-opening={String(openingId) === String(product.id) ? 'true' : undefined} className={`min-w-0 overflow-hidden rounded-2xl border-border/40 p-4 shadow-sm ${selectedIds.has(String(product.id)) ? 'border-primary/50 bg-primary/[0.05]' : ''} ${highlightedProductId === product.id ? 'bg-primary/10 ring-2 ring-primary/60' : ''}`} onClick={() => openProductDetail(product)}>
              <div className="flex min-w-0 items-start gap-3">
                {!isServiceView && <button
                  type="button"
                  className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={(event) => { event.stopPropagation(); toggleSelect(product.id, product); }}
                  aria-pressed={selectedIds.has(String(product.id))}
                  aria-label={selectedIds.has(String(product.id)) ? `Quitar ${product.name} de la selección` : `Seleccionar ${product.name}`}
                  title={selectedIds.has(String(product.id)) ? 'Quitar de la selección' : 'Agregar a la selección'}
                >
                  {selectedIds.has(String(product.id)) ? <SquareCheckBig className="size-4 text-primary" /> : <Square className="size-4 text-muted-foreground" />}
                </button>}
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
                      <p className="line-clamp-2 break-words font-semibold leading-tight" title={product.name}>{product.name}{String(openingId) === String(product.id) && <span role="status" className="ml-2 inline-flex shrink-0 items-center gap-1 text-[9px] font-black uppercase tracking-wider text-primary"><Loader2 className="size-3 animate-spin" /> Abriendo…</span>}</p>
                      {!isServiceView && hasProductVariants(product) && (
                        <span className="mt-0.5 block text-[9px] font-black uppercase tracking-wider text-primary/80">Variante</span>
                      )}
                      <p className="truncate font-mono text-xs text-muted-foreground">{product.code}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[9px] font-black uppercase">{isServiceView ? 'Servicio' : 'Producto'}</Badge>
                  </div>
                  <p className="mt-2 truncate text-xs text-muted-foreground">{product.category?.name || 'Sin categoría'}</p>
                  <p className="mt-1 max-w-full truncate text-xs text-muted-foreground" title={product.commercialNote || undefined}><span className="font-semibold">Nota:</span> {product.commercialNote || '—'}</p>
                  <div className="mt-3 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3 xl:grid-cols-4">
                     {isServiceView && <div>
                       <span className="text-muted-foreground">{isServiceView ? 'Precio' : 'Precio venta'}</span>
                       <CurrencyValuationAmount {...getServicePricePresentation(product)} className="font-bold" />
                     </div>}
                     {isServiceView && canViewInventoryCost && <div><span className="text-muted-foreground">Costo servicio</span><CurrencyValuationAmount amount={costPrice} sourceCurrency={baseCurrency} sourceExchangeRate={1} className="font-medium" /></div>}
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
                      {isServiceView ? 'Estado' : 'Bodegas'}
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
        <Table className="w-full table-fixed" style={{ minWidth: isServiceView ? '1100px' : '1356px' }}>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead style={{ width: PRODUCT_TABLE_WIDTHS.selector, minWidth: PRODUCT_TABLE_WIDTHS.selector }}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleSelectAll(); }}
                  className="flex size-7 items-center justify-center rounded-md hover:bg-muted/60"
                  aria-pressed={allVisibleProductsSelected}
                  aria-label={allVisibleProductsSelected ? 'Quitar selección de los productos visibles' : 'Seleccionar todos los productos visibles'}
                  title={allVisibleProductsSelected ? 'Quitar selección de los productos visibles' : 'Seleccionar todos los productos visibles'}
                >
                  {allVisibleProductsSelected
                    ? <SquareCheckBig className="size-4 text-primary" />
                    : someVisibleProductsSelected
                      ? <span className="flex size-4 items-center justify-center rounded-[3px] border-2 border-primary text-primary"><Minus className="size-3" /></span>
                      : <Square className="size-4 text-muted-foreground" />
                  }
                </button>
              </TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest" style={{ width: PRODUCT_TABLE_WIDTHS.code, minWidth: PRODUCT_TABLE_WIDTHS.code }}><span className="inline-flex items-center gap-1">Código<ColumnFilterMenu label="Código" sort={colFilters.state.code?.sort || null} onSort={(sort) => colFilters.setSort('code', sort)} /></span></TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest" style={{ width: PRODUCT_TABLE_WIDTHS.name, minWidth: PRODUCT_TABLE_WIDTHS.name }}><span className="inline-flex items-center gap-1">{isServiceView ? 'Servicio' : 'Nombre'}<ColumnFilterMenu label={isServiceView ? 'Servicio' : 'Nombre'} sort={colFilters.state.name?.sort || null} onSort={(sort) => colFilters.setSort('name', sort)} sortOptions={[{ value: 'asc', label: 'A → Z (alfabético)' }, { value: 'desc', label: 'Más recientes' }]} /></span></TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest" style={{ width: PRODUCT_TABLE_WIDTHS.note, minWidth: PRODUCT_TABLE_WIDTHS.note }}>Nota comercial</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest" style={{ width: PRODUCT_TABLE_WIDTHS.category, minWidth: PRODUCT_TABLE_WIDTHS.category }}><span className="inline-flex items-center gap-1">Categoría<ColumnFilterMenu label="Categoría" options={categoryOptions} selected={colFilters.state.category?.values || []} onSelect={(values) => colFilters.setValues('category', values)} sort={colFilters.state.category?.sort || null} onSort={(sort) => colFilters.setSort('category', sort)} /></span></TableHead>
               {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest" style={{ width: PRODUCT_TABLE_WIDTHS.unit, minWidth: PRODUCT_TABLE_WIDTHS.unit }}>U.Medida</TableHead>}
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right" style={{ width: PRODUCT_TABLE_WIDTHS.min, minWidth: PRODUCT_TABLE_WIDTHS.min }}>Min</TableHead>}
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right" style={{ width: PRODUCT_TABLE_WIDTHS.max, minWidth: PRODUCT_TABLE_WIDTHS.max }}>Max</TableHead>}
               <TableHead className="font-black text-[10px] uppercase tracking-widest" style={{ width: PRODUCT_TABLE_WIDTHS.warehouse, minWidth: PRODUCT_TABLE_WIDTHS.warehouse }}>{isServiceView ? 'Estado' : 'Bodegas'}</TableHead>
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right" style={{ width: PRODUCT_TABLE_WIDTHS.stock, minWidth: PRODUCT_TABLE_WIDTHS.stock }}><span className="inline-flex items-center gap-1">Stock<ColumnFilterMenu label="Stock" sort={colFilters.state.stock?.sort || null} onSort={(sort) => colFilters.setSort('stock', sort)} /></span></TableHead>}
               {isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right" style={{ width: PRODUCT_TABLE_WIDTHS.price, minWidth: PRODUCT_TABLE_WIDTHS.price }}>Precio</TableHead>}
               {isServiceView && canViewInventoryCost && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right" style={{ width: PRODUCT_TABLE_WIDTHS.cost, minWidth: PRODUCT_TABLE_WIDTHS.cost }}>Costo servicio</TableHead>}
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
                 <TableCell colSpan={isServiceView ? (canViewInventoryCost ? 9 : 8) : canViewInventoryCost ? 12 : 11} className="text-center py-12 text-muted-foreground">
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
                const warehouseNames = warehouseNamesForProduct(product);
                 return (
                   <TableRow 
                      key={product.id} 
                      className={`group cursor-pointer hover:bg-muted/30 ${selectedIds.has(String(product.id)) ? 'bg-primary/[0.05]' : ''} ${highlightedProductId === product.id ? 'bg-primary/10 ring-2 ring-inset ring-primary/60' : ''}`}
                      aria-busy={String(openingId) === String(product.id) || undefined}
                      data-detail-opening={String(openingId) === String(product.id) ? 'true' : undefined}
                      onClick={() => openProductDetail(product)}
                      onDoubleClick={() => canPerform('INVENTORY_PRODUCTS', 'edit') && handleEditRow(product)}
                     >
                     <TableCell className="w-10">
                       <button type="button" onClick={(e) => { e.stopPropagation(); toggleSelect(product.id, product); }} className="flex items-center justify-center size-7 rounded-md hover:bg-muted/60" aria-pressed={selectedIds.has(String(product.id))} aria-label={selectedIds.has(String(product.id)) ? `Quitar ${product.name} de la selección` : `Seleccionar ${product.name}`} title={selectedIds.has(String(product.id)) ? 'Quitar de la selección' : 'Agregar a la selección'}>
                         {selectedIds.has(String(product.id))
                           ? <SquareCheckBig className="size-4 text-primary" />
                           : <Square className="size-4 text-muted-foreground" />
                         }
                       </button>
                     </TableCell>
                     <TableCell className="font-mono text-xs text-muted-foreground">{product.code}</TableCell>
                    <TableCell>
                      <div className="flex w-full min-w-0 items-center gap-2.5 overflow-hidden">
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
                            <ProductThumbnail src={product.imageUrl} alt={product.name} size="sm" />
                          </button>
                        ) : (
                          <ProductThumbnail src={undefined} alt={product.name} size="sm" />
                        )}
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <button
                            type="button"
                            className="block w-full min-w-0 whitespace-normal break-words text-left text-sm font-medium leading-snug line-clamp-2 hover:text-primary underline-offset-2 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              openProductDetail(product);
                            }}
                          >
                            {product.name}
                          </button>
                          {!isServiceView && hasProductVariants(product) && (
                            <span className="mt-0.5 block text-[9px] font-black uppercase tracking-wider text-primary/80">Variante</span>
                          )}
                          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
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
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <span className="block max-w-[180px] truncate text-xs text-muted-foreground" title={product.commercialNote || undefined}>
                        {product.commercialNote || '—'}
                      </span>
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
                     <TableCell>
                      {isServiceView ? (
                        <Badge variant="outline" className={product.isActive !== false ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}>
                          {product.isActive !== false ? 'Disponible' : 'No disponible'}
                        </Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {warehouseNames.length > 0
                            ? warehouseNames.map((whName: string) => (
                              <Badge key={whName} variant="secondary" className="text-[9px] bg-muted/50 font-medium">
                                {whName}
                              </Badge>
                            ))
                            : <span className="text-[10px] text-muted-foreground">-</span>}
                        </div>
                      )}
                    </TableCell>
                    {!isServiceView && <TableCell className={`text-right font-medium tabular-nums ${getStockAlertColor(product)}`}>
                      {getProductStock(product)}
                    </TableCell>}
                     {isServiceView && <TableCell className="text-right"><CurrencyValuationAmount {...getServicePricePresentation(product)} className="font-medium" /></TableCell>}
                     {isServiceView && canViewInventoryCost && <TableCell className="text-right text-muted-foreground"><CurrencyValuationAmount amount={Number(product.costPrice || 0)} sourceCurrency={baseCurrency} sourceExchangeRate={1} className="font-medium" /></TableCell>}
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
        <DialogContent className="w-[calc(100vw-2rem)] !max-w-[min(92vw,520px)]">
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
      <Dialog open={Boolean(warehouseDetail)} onOpenChange={(open) => !open && setWarehouseDetail(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><WarehouseIcon className="size-5 text-sky-600" /> {warehouseDetail?.name || 'Bodega'}</DialogTitle>
            <DialogDescription>Detalle de la bodega con su stock real y productos asignados.</DialogDescription>
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
            <DialogDescription>Detalle de la sucursal con sus bodegas vinculadas y stock agregado.</DialogDescription>
          </DialogHeader>
          {branchDetail && (() => {
            const stats = branchStockStats.get(branchDetail.id) || { warehouses: 0, products: 0, units: 0 };
            const warehouseNames = warehouseNamesForBranch(branchDetail);
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Bodegas</p>
                    <p className="mt-1 text-sm font-black">{stats.warehouses}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Vinculados</p>
                    <p className="mt-1 truncate text-sm font-black">{warehouseNames.length > 0 ? warehouseNames.join(', ') : 'Sin bodegas'}</p>
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
             <DialogTitle>{isServiceView ? 'Importación de servicios' : 'Importación inicial de inventario'}</DialogTitle>
             <DialogDescription>
               {isServiceView ? 'Puedes importar servicios en cualquier momento. Descarga la plantilla, completa los datos y revisa la previsualización antes de confirmar. Las imágenes opcionales pueden cargarse en ZIP o RAR.' : 'Puedes importar productos varias veces por sucursal. La plantilla avanzada usa Productos, Variantes, Atributos, Precios e Inventario; permite crear o reutilizar atributos y valores faltantes después de confirmarla. Los SKU existentes se actualizan sin duplicar IDs, existencias ni historial; las variantes nuevas se agregan.'}
             </DialogDescription>
             <InventoryViewTutorial label={isServiceView ? 'Cómo importar servicios' : 'Cómo importar inventario'} targetPrefix="inventory-initial-import" copy={{ data: { description: isServiceView ? 'Descarga la plantilla, prepara servicios, su único precio, costos e imágenes y revisa las reglas. Los servicios no llevan IVA ni manejan stock o bodegas.' : 'Descarga la plantilla, prepara productos, precios, costos, stock e imágenes y revisa las reglas.' }, actions: { description: 'Descarga la plantilla o continúa con la carga para iniciar la importación.' } }} />
          </DialogHeader>
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4 text-sm" data-tour="inventory-initial-import-data">
             <p><b>La plantilla siempre incluye:</b> {canViewInventoryCost ? (isServiceView ? 'costo del servicio, ' : 'costo base y costo por variante, ') : ''}{isServiceView ? 'un único precio, disponibilidad e imagen opcional.' : 'una fila por producto, una fila por variante, atributos dinámicos, precios por alcance y stock por SKU/bodega; el stock del padre siempre se calcula, nunca se captura.'}</p>
             <p>Cada {isServiceView ? 'servicio' : 'producto'} debe tener SKU único, nombre, categoría y {canViewInventoryCost ? 'costo base y ' : ''}al menos un precio base. {isServiceView ? 'El servicio no lleva IVA ni precios alternos.' : 'Los precios de variante son opcionales y solo sobrescriben el precio padre para ese SKU.'}</p>
             {!isServiceView && <p>Si un atributo o valor no existe, se detectará en la revisión y se creará/reutilizará dentro de la misma transacción. Un producto sin filas en Variantes recibirá la variante Estándar.</p>}
             {isServiceView && <p>Los servicios no se vinculan a bodegas, no manejan stock inicial y no tienen variantes.</p>}
            <p>Opcionalmente puedes cargar un ZIP o RAR con imágenes JPG, JPEG o PNG cuyo nombre sea exactamente el SKU.</p>
          </div>
          <DialogFooter data-tour="inventory-initial-import-actions">
            <Button variant="outline" onClick={handleDownloadTemplate}><Download className="size-4 mr-2" />Descargar plantilla</Button>
             <Button onClick={() => { setInitialImportIntroOpen(false); setImportModalOpen(true); }}>Continuar con la carga</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {showTutorial && <GuidedTour
        steps={isServiceView ? PRODUCTS_TOUR_STEPS.map((step) => ({ ...step, title: step.title.replace('Productos', 'Servicios').replace('producto', 'servicio').replace('productos', 'servicios'), description: step.description.replaceAll('producto', 'servicio').replaceAll('Producto', 'Servicio').replaceAll('productos', 'servicios').replaceAll('Productos', 'Servicios') })) : PRODUCTS_TOUR_STEPS.filter((step) => !(step.title === 'Importar catálogo inicial' && (initialImportCompleted || products.length > 0)))}
        onClose={() => setShowTutorial(false)}
        title={isServiceView ? 'Servicios' : 'Productos'}
        allowTargetInteraction
      />}
      <Dialog open={importModalOpen} onOpenChange={(open) => {
        if (!importing && !previewLoading && !previewMounting) {
          setImportModalOpen(open);
          if (!open) { setImportPreviewOpen(false); setImportData([]); setAdvancedImportCatalog(null); setImportFileName(''); setImageArchiveFileName(''); setImageArchiveEntries(new Map()); setImportProgress(0); }
        }
      }}>
        <DialogContent className="w-[calc(100vw-2rem)] !max-w-[min(94vw,1000px)] max-h-[min(88vh,calc(100dvh-3rem))] flex flex-col">
          <DialogHeader data-tour="inventory-import-title">
             <DialogTitle>Importar {isServiceView ? 'Servicios' : 'Productos'}</DialogTitle>
             <DialogDescription>
               {isServiceView ? 'Sube servicios con descripción, categoría, un único precio, costo y disponibilidad. La carga se confirma en dos pasos.' : 'Sube productos nuevos o existentes de la sucursal. Puedes repetir la carga: los SKU existentes actualizan sus datos y precios, conservan IDs, existencias e historial, y las variantes nuevas se agregan. La carga se confirma en dos pasos.'}
             </DialogDescription>
             <InventoryViewTutorial label={`Cómo importar ${isServiceView ? 'servicios' : 'productos'}`} targetPrefix="inventory-import" copy={{ data: { description: isServiceView ? 'Configura moneda, tasa, archivo e imágenes; luego normaliza y revisa la previsualización. Los servicios no usan bodegas ni stock.' : 'Configura moneda, tasa, archivo, imágenes y bodega de destino; luego revisa la previsualización del catálogo.' }, actions: { description: 'Carga el archivo y abre la previsualización antes de confirmar.' } }} />
          </DialogHeader>
          <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-3" data-tour="inventory-import-data">
            <div><p className="mb-1 text-[10px] font-black uppercase text-muted-foreground">{isServiceView ? 'Precio incluido' : 'Listas incluidas'}</p><p className="h-9 flex items-center text-xs font-semibold">{isServiceView ? 'Precio único del servicio' : importPriceLists.map((list) => list.name).join(' · ')}</p></div>
            <div><p className="mb-1 text-[10px] font-black uppercase text-muted-foreground">Moneda del archivo</p><Select value={importCurrency} onValueChange={setImportCurrency}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NIO">Córdoba (NIO)</SelectItem><SelectItem value="USD">Dólar (USD)</SelectItem></SelectContent></Select></div>
            <div><p className="mb-1 text-[10px] font-black uppercase text-muted-foreground">Tasa USD / moneda base</p><Input className="h-9 text-xs" type="number" min="0.0001" step="any" value={importExchangeRate} onChange={(event) => setImportExchangeRate(Number(event.target.value) || 1)} disabled={importCurrency === 'NIO'} /></div>
          </div>
          {importProcessing && <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">Procesando archivo, espera un momento...</div>}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed p-3">
            <div className="min-w-0">
               <p className="text-xs font-bold">Imágenes de {isServiceView ? 'servicios' : 'productos'} (opcional)</p>
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
                  <div className="flex gap-1"><Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleDownloadImportErrors} disabled={!importData.some((row) => row._hasError || row._hasWarning)}>Descargar incidencias</Button><Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setImportFileName(''); setImportData([]); setAdvancedImportCatalog(null); }} disabled={importing}>Cambiar archivo</Button></div>
                </div>

                <div className="border rounded-md flex-1 overflow-auto">
                  <div className="min-w-[900px]">
                    <Table>
                      <TableHeader className="bg-muted sticky top-0 z-10 shadow-sm">
                        <TableRow>
                          <TableHead className="text-[10px] uppercase w-8"></TableHead>
                          <TableHead className="text-[10px] uppercase w-32">Código</TableHead>
                          <TableHead className="text-[10px] uppercase">Nombre</TableHead>
                          {isServiceView && <TableHead className="text-[10px] uppercase w-52">Descripción</TableHead>}
                          <TableHead className="text-[10px] uppercase w-44">Nota comercial</TableHead>
                            <TableHead className="text-[10px] uppercase w-32">Categoría</TableHead>
                          <TableHead className="text-[10px] uppercase w-28 text-right">Unidad</TableHead>
                          {isServiceView ? <><TableHead className="text-[10px] uppercase w-28 text-right">Duración (min)</TableHead><TableHead className="text-[10px] uppercase w-28 text-right">Precio</TableHead></> : <><TableHead className="text-[10px] uppercase w-28 text-right">Minorista</TableHead><TableHead className="text-[10px] uppercase w-28 text-right">Mayorista</TableHead><TableHead className="text-[10px] uppercase w-28 text-right">Distribuidor</TableHead></>}
                          {canViewInventoryCost && <TableHead className="text-[10px] uppercase w-28 text-right">Costo</TableHead>}
                          {!isServiceView && <><TableHead className="text-[10px] uppercase w-24 text-right">Stock</TableHead><TableHead className="text-[10px] uppercase w-24 text-right">Min</TableHead><TableHead className="text-[10px] uppercase w-32">Bodega</TableHead></>}
                          <TableHead className="text-[10px] uppercase w-36">Validación</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importData.map((row, i) => (
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
                            {isServiceView && <TableCell className="p-1"><Input value={row.description || ''} title={row.description || ''} onChange={(e) => handleImportRowUpdate(i, 'description', e.target.value)} className="h-8 text-xs" /></TableCell>}
                            <TableCell className="p-1"><Input value={row.commercialNote || ''} maxLength={100} title={row.commercialNote || ''} onChange={(e) => handleImportRowUpdate(i, 'commercialNote', e.target.value)} className="h-8 text-xs" /><span className="text-[10px] text-muted-foreground">{Array.from(String(row.commercialNote || '')).length}/100</span></TableCell>
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
                            {isServiceView ? <><TableCell className="p-1"><Input type="number" min={0} value={row.estimatedDuration ?? ''} onChange={(e) => handleImportRowUpdate(i, 'estimatedDuration', e.target.value === '' ? undefined : Number(e.target.value))} className="h-8 text-xs text-right" /></TableCell><TableCell className="p-1"><Input type="number" min={0} value={row.salePrice ?? ''} onChange={(e) => handleImportRowUpdate(i, 'servicePrice', e.target.value)} className="h-8 text-xs text-right" /></TableCell></> : <><TableCell className="p-1"><Input type="number" min={0} value={row.prices?.RETAIL ?? ''} onChange={(e) => handleImportRowUpdate(i, 'price.RETAIL', e.target.value)} className="h-8 text-xs text-right" /></TableCell><TableCell className="p-1"><Input type="number" min={0} value={row.prices?.WHOLESALE ?? ''} onChange={(e) => handleImportRowUpdate(i, 'price.WHOLESALE', e.target.value)} className="h-8 text-xs text-right" /></TableCell><TableCell className="p-1"><Input type="number" min={0} value={row.prices?.DISTRIBUTOR ?? ''} onChange={(e) => handleImportRowUpdate(i, 'price.DISTRIBUTOR', e.target.value)} className="h-8 text-xs text-right" /></TableCell></>}
                            {canViewInventoryCost && <TableCell className="p-1">
                              <Input type="number" min={0} value={row.costPrice ?? ''} onChange={(e) => handleImportRowUpdate(i, 'costPrice', e.target.value)} className="h-8 text-xs text-right" />
                            </TableCell>}
                            {isServiceView ? <TableCell className="p-1"><Select value={row.isActive === false ? 'false' : 'true'} onValueChange={(value) => handleImportRowUpdate(i, 'isActive', value === 'true')}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="true">Disponible</SelectItem><SelectItem value="false">No disponible</SelectItem></SelectContent></Select></TableCell> : row._advanced && (row._hasVariants === true || Number(row._variantCount || 0) > 0) ? <>
                              <TableCell className="p-1 text-center"><span className="text-[10px] font-semibold text-muted-foreground">Por variante</span></TableCell>
                              <TableCell className="p-1 text-center"><span className="text-[10px] text-muted-foreground">—</span></TableCell>
                              <TableCell className="p-1 text-center">
                                {Array.isArray(row._stockRows) && row._stockRows.length > 0 && row.warehouse !== 'Varias bodegas' ? (() => {
                                  const warehouseExists = importWarehouseOptions.some((warehouse: any) => warehouse.name?.toLowerCase() === String(row.warehouse || '').trim().toLowerCase());
                                  const selectValue = warehouseExists ? row.warehouse : '__invalid__';
                                  return <Select value={selectValue || '__none__'} onValueChange={(value) => handleImportRowUpdate(i, 'warehouse', value === '__none__' || value === '__invalid__' ? '' : value)}>
                                    <SelectTrigger className={`h-8 text-xs ${!warehouseExists ? 'border-amber-500/60 text-amber-600' : ''}`} title="Aplica la bodega seleccionada a las filas de inventario de este producto"><SelectValue placeholder="Seleccionar bodega" /></SelectTrigger>
                                    <SelectContent>
                                      {!warehouseExists && row.warehouse && <SelectItem value="__invalid__">{`No existe: ${row.warehouse}`}</SelectItem>}
                                      <SelectItem value="__none__">Sin bodega</SelectItem>
                                      {importWarehouseOptions.map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.name}>{warehouse.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>;
                                })() : <span className="text-[10px] font-semibold text-muted-foreground">{row._stockRows?.length ? 'Varias bodegas' : 'Hoja Inventario'}</span>}
                              </TableCell>
                            </> : <>
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
                                  </div>
                                )}
                              </TableCell>
                            </>}
                            <TableCell className="p-1 text-xs"><span className={row._hasError ? 'text-red-600' : row._hasWarning ? 'text-amber-600' : 'text-emerald-600'}>{row._errorMessage || row._warningMessage || 'Correcto'}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
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
              <p className="mb-2 text-sm font-semibold">{isServiceView ? 'Columnas soportadas:' : 'Formato soportado:'}</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <p>• <b>Código</b> (requerido)</p>
                <p>• <b>Nombre</b> (requerido)</p>
                {isServiceView && <p>• <b>Descripción</b></p>}
                <p>• <b>Nota comercial</b> (máximo 100 caracteres)</p>
                <p>• <b>Categoría</b></p>
                <p>• <b>{isServiceView ? 'Precio único' : 'Precios por lista'}</b></p>
                {canViewInventoryCost && <p>• <b>{isServiceView ? 'Costo del servicio' : 'Costo'}</b></p>}
                {isServiceView ? <><p>• <b>Disponible</b> (SI/NO)</p><p>• Sin IVA, bodega, stock ni variantes</p></> : <><p>• <b>Productos</b> y <b>Variantes</b></p><p>• <b>Atributos</b> dinámicos por fila</p><p>• <b>Precios</b>: PRODUCTO / VARIANTE</p><p>• <b>Inventario</b> por SKU y bodega</p><p>• Sin stock automático para variantes</p></>}
              </div>
              <Button variant="outline" size="sm" className="mt-4 w-full text-xs font-bold" onClick={handleDownloadTemplate}>
                <Download className="mr-2 size-3" />
                Descargar Plantilla de Ejemplo
              </Button>
            </div>
          </div>
          <DialogFooter className="mt-2 pt-2 border-t" data-tour="inventory-import-actions">
            <Button variant="outline" onClick={() => setImportModalOpen(false)} disabled={importing || previewLoading || previewMounting}>
              Cerrar
            </Button>
            {importFileName && (
              <Button 
                onClick={handleOpenImportPreview}
                disabled={importing || importProcessing || previewLoading || previewMounting || importData.length === 0}
                className="bg-primary text-primary-foreground font-bold"
              >
                {previewLoading || previewMounting ? <><Loader2 className="mr-2 size-3.5 animate-spin" />Preparando previsualización...</> : importProcessing ? 'Procesando archivos...' : 'Previsualizar importación'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
        </Dialog>

      <Dialog open={initialImportConfirmOpen && !importing} onOpenChange={setInitialImportConfirmOpen}>
        <DialogContent>
          <DialogHeader data-tour="inventory-initial-confirm-title">
             <DialogTitle>Formalizar importación</DialogTitle>
          <DialogDescription>Esta acción creará o actualizará {importData.filter((row) => !row._hasError).length} {isServiceView ? 'servicios' : 'registros de catálogo'} y omitirá {importData.filter((row) => row._hasError).length} fila(s) con errores. {isServiceView ? 'Los servicios se actualizarán sin IVA, bodega, stock ni variantes.' : 'La reimportación conserva IDs, existencias e historial; actualiza datos maestros y precios, agrega variantes nuevas y rechaza conflictos de tipo o SKU.'} {isServiceView ? `El precio se guardará en ${importCurrency}.` : `Los precios configurados se guardarán en ${importCurrency}; las listas sin precio quedarán pendientes.`} Escribe IMPORTAR para confirmar.</DialogDescription>
          <InventoryViewTutorial label="Cómo confirmar importación" targetPrefix="inventory-initial-confirm" copy={{ data: { description: 'Escribe IMPORTAR únicamente después de revisar las filas válidas, errores y advertencias.' }, actions: { description: `Confirma la importación para crear ${isServiceView ? 'los servicios' : 'los productos nuevos'}.` } }} />
          </DialogHeader>
          <div data-tour="inventory-initial-confirm-data"><Input value={initialImportConfirmText} onChange={(event) => setInitialImportConfirmText(event.target.value.toUpperCase())} placeholder="IMPORTAR" autoFocus /></div>
          <DialogFooter data-tour="inventory-initial-confirm-actions"><Button variant="outline" onClick={() => setInitialImportConfirmOpen(false)}>Cancelar</Button><Button onClick={handleFinalInitialImport} disabled={initialImportConfirmText !== 'IMPORTAR' || importing}>Confirmar importación</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportProgressOverlay open={importing} progress={importProgress} title={`Importando ${isServiceView ? 'servicios' : 'productos'}`} description="Estamos guardando el catálogo y sus precios. No cierres esta ventana." />
      <ImportProgressOverlay open={bulkImageUploading} progress={bulkImageProgress} title="Actualizando imágenes" description="Subiendo y vinculando las imágenes con los productos por SKU. No cierres esta ventana." />


      <Dialog open={importResults !== null} onOpenChange={(open) => { if (!open) setImportResults(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader data-tour="inventory-request-title">
            <div className="flex flex-col items-center gap-3 py-3 text-center">
              <div className="flex size-20 animate-in zoom-in items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 duration-500">
                <CheckCircle2 className="size-12 animate-pulse" />
              </div>
              <DialogTitle className="text-xl">Importación completada</DialogTitle>
               <DialogDescription>{isServiceView ? 'Los servicios ya están disponibles y la vista se actualizó correctamente.' : 'El inventario ya está disponible y la vista se actualizó correctamente.'}</DialogDescription>
            </div>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-emerald-500">{importResults?.success || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Importados</p></div>
            <div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-amber-500">{importResults?.skipped || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Omitidos</p></div>
            <div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-rose-500">{importResults?.failed || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Incidencias</p></div>
          </div>
          {Boolean(importResults?.warnings?.length) && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">{importResults?.warnings?.join(' ')}</p>}
          <DialogFooter>
            <Button className="w-full" onClick={() => setImportResults(null)}>Continuar al inventario</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportProgressOverlay
        open={previewLoading || previewMounting}
        progress={previewProgress}
        title={previewLoading ? 'Preparando previsualización' : 'Montando la previsualización'}
        description={previewLoading ? 'Leyendo el archivo, validando columnas y preparando los registros para edición.' : 'Preparando las filas visibles de forma virtualizada para que la página siga respondiendo.'}
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

      <Dialog open={solicitudOpen} onOpenChange={(o) => { if (!o) closeSolicitud(); }}>
        <DialogContent className="!flex !w-[calc(100vw-1rem)] !max-w-[1100px] max-h-[min(90vh,calc(100dvh-1rem))] flex-col overflow-hidden rounded-3xl p-4 sm:p-6">
          <DialogHeader className="shrink-0 border-b border-border/40 pb-4">
            <DialogTitle className="flex min-w-0 flex-wrap items-center gap-2 pr-8">
              <PackageSearch className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 break-words">Solicitud de compra</span>
              <Badge variant="outline" className="text-[10px]">{solicitudOnlySelected ? 'Selección de tabla' : 'Búsqueda de productos'}</Badge>
              <Badge variant="secondary" className="text-[10px]">{solicitudProducts.length} productos</Badge>
              {solicitudCatalogLoading && <Badge variant="outline" className="gap-1 text-[10px] text-primary"><Loader2 className="size-3 animate-spin" /> Cargando productos</Badge>}
            </DialogTitle>
            <DialogDescription className="break-words pr-8">
              {solicitudOnlySelected
                ? 'Se muestran inicialmente los productos que seleccionaste en la tabla. Usa el buscador para localizar y agregar otro producto.'
                : 'El catálogo se muestra como antes. Para localizar un producto, búscalo por nombre, código o categoría.'} La solicitud se guardará en Compras &gt; Solicitudes.
            </DialogDescription>
            <InventoryViewTutorial label="Cómo crear una solicitud de compra" targetPrefix="inventory-request" copy={{ data: { description: solicitudOnlySelected ? 'Completa los datos de la solicitud, revisa la selección de la tabla y usa el buscador para agregar productos por nombre, código o categoría.' : 'Selecciona empleado, bodega, justificación, fecha, prioridad y productos a solicitar. Para agregar un producto adicional, búscalo por nombre, código o categoría.' }, actions: { description: 'Crea la solicitud para enviarla al flujo de Compras.' } }} />
          </DialogHeader>
          {solicitudProducts.length > 0 && (
            <section className="shrink-0 rounded-2xl border border-primary/25 bg-primary/[0.04] p-3" aria-labelledby="solicitud-selected-products-title">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div id="solicitud-selected-products-title" className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-primary">
                    <Check className="size-4 shrink-0" /> Productos incluidos
                    <Badge variant="secondary" className="text-[10px]">{solicitudProducts.length}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Estos productos permanecen visibles aunque busques otro. Puedes ajustar cantidades o quitarlos desde aquí.</p>
                </div>
                <Button type="button" size="sm" variant="outline" className="h-8 w-fit shrink-0 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-wider" onClick={() => setSolicitudOnlySelected((value) => !value)} disabled={solicitudCreating}>
                  {solicitudOnlySelected ? 'Ver catálogo completo' : 'Mostrar solo incluidos'}
                </Button>
              </div>
              <div className="mt-3 grid max-h-32 min-w-0 gap-2 overflow-y-auto pr-1 sm:grid-cols-2" role="list" aria-label="Productos incluidos en la solicitud">
                {solicitudProducts.map((item) => (
                  <div key={item.productId} role="listitem" className="flex min-w-0 items-center gap-2 rounded-xl border border-primary/20 bg-background/80 px-2.5 py-2">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-bold" title={item.productName}>{item.productName}</span>
                      <span className="block truncate font-mono text-[9px] text-muted-foreground" title={item.code || undefined}>{item.code || 'Sin código'}</span>
                    </div>
                    {item.isVariable ? (
                      <Badge variant="outline" className="shrink-0 text-[9px]">{item.quantity} uds. · variantes</Badge>
                    ) : (
                      <Input type="number" min={1} className="h-8 w-16 shrink-0 text-right text-xs tabular-nums" value={item.quantity} onChange={(event) => updateSolicitudQuantity(item.productId, Number(event.target.value))} disabled={solicitudCreating} aria-label={`Cantidad de ${item.productName}`} />
                    )}
                    <button type="button" className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => removeSolicitudProduct(item.productId)} disabled={solicitudCreating} aria-label={`Quitar ${item.productName} de la solicitud`} title="Quitar de la solicitud">
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1" data-tour="inventory-request-data">
          <div className="space-y-4 pt-4">
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
                <Select value={normalizePurchasePriority(solicitudPriority)} onValueChange={(value) => setSolicitudPriority(normalizePurchasePriority(value))} disabled={solicitudCreating}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PURCHASE_PRIORITY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.03] p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide">{solicitudOnlySelected ? 'Productos seleccionados' : 'Productos para solicitar'}</div>
                  <p className="text-[11px] text-muted-foreground">{solicitudOnlySelected ? 'La solicitud parte de tu selección. Busca por nombre, código o categoría para agregar otro producto.' : 'El catálogo se muestra como antes. Puedes filtrar por nombre, código, categoría, stock o bodega.'}</p>
                </div>
                <Badge variant="secondary" className="w-fit text-[10px]">{solicitudOnlySelected ? (solicitudProductSearch.trim() ? `${filteredSolicitudProducts.length} resultados` : `${filteredSolicitudProducts.length} seleccionados`) : `${filteredSolicitudProducts.length} visibles · ${solicitudProducts.length} incluidos`}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <div className={`relative ${solicitudOnlySelected ? 'md:col-span-3' : 'md:col-span-1'}`}>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="solicitud-product-search"
                    value={solicitudProductSearch}
                    onChange={(event) => setSolicitudProductSearch(event.target.value)}
                    placeholder={solicitudOnlySelected ? 'Buscar para agregar por nombre, código o categoría...' : 'Buscar por nombre, código o categoría...'}
                    className="h-9 bg-background pl-9 pr-9"
                    disabled={solicitudCreating}
                    autoComplete="off"
                    aria-label="Buscar productos por nombre, código o categoría"
                  />
                  {solicitudProductSearch && (
                    <button type="button" className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setSolicitudProductSearch('')} aria-label="Limpiar búsqueda de productos">
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                {!solicitudOnlySelected && <Select value={solicitudCategoryFilter} onValueChange={setSolicitudCategoryFilter} disabled={solicitudCreating}>
                  <SelectTrigger className="h-9 bg-background"><SelectValue placeholder="Todas las categorías" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas las categorías</SelectItem>
                    {solicitudCategories.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>}
                {!solicitudOnlySelected && <Select value={solicitudStockFilter} onValueChange={(value) => setSolicitudStockFilter(value as typeof solicitudStockFilter)} disabled={solicitudCreating}>
                  <SelectTrigger className="h-9 bg-background"><SelectValue placeholder="Todos los niveles de stock" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los niveles de stock</SelectItem>
                    <SelectItem value="AVAILABLE">Sobre el mínimo</SelectItem>
                    <SelectItem value="LOW">Bajo el mínimo</SelectItem>
                    <SelectItem value="OUT">Sin existencia</SelectItem>
                  </SelectContent>
                </Select>}
              </div>
              {!solicitudOnlySelected && <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Filtrar stock por bodega</label>
                <Select value={solicitudWarehouseFilter} onValueChange={setSolicitudWarehouseFilter} disabled={solicitudCreating}>
                  <SelectTrigger className="h-8 w-full bg-background text-xs sm:w-72"><SelectValue placeholder="Todas las bodegas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas las bodegas</SelectItem>
                    {warehouses.map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>}
              <div className="max-h-[min(42vh,28rem)] max-w-full overflow-x-hidden overflow-y-auto rounded-xl border border-border/60 bg-background/70">
                {solicitudCatalogLoading ? (
                  <div className="flex items-center justify-center gap-2 px-3 py-8 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando productos...</div>
                ) : filteredSolicitudProducts.length > 0 ? (
                  <>
                    <div className="hidden max-w-full overflow-hidden md:block">
                      <Table className="w-full table-fixed" containerClassName="overflow-x-hidden">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[8%] text-center font-black text-[10px] uppercase">Sel.</TableHead>
                            <TableHead className="w-[37%] font-black text-[10px] uppercase">Producto</TableHead>
                            <TableHead className="w-[20%] font-black text-[10px] uppercase">Categoría</TableHead>
                            <TableHead className="w-[10%] text-right font-black text-[10px] uppercase">Stock</TableHead>
                            <TableHead className="w-[10%] text-right font-black text-[10px] uppercase">Min</TableHead>
                            <TableHead className="w-[15%] text-right font-black text-[10px] uppercase">Cantidad</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleSolicitudProducts.map((product: any) => {
                            const selectedItem = solicitudProducts.find((item) => item.productId === product.id);
                            const snapshot = getSolicitudProductSnapshot(product);
                            const isSelected = Boolean(selectedItem);
                            return (
                              <TableRow key={product.id} className={isSelected ? 'bg-primary/[0.06]' : undefined}>
                                <TableCell className="text-center align-middle">
                                  <Checkbox checked={isSelected} onCheckedChange={() => toggleSolicitudProduct(product)} disabled={solicitudCreating} aria-label={`Seleccionar ${product.name}`} />
                                </TableCell>
                                <TableCell className="max-w-0 whitespace-normal align-middle text-xs font-medium">
                                  <div className="min-w-0">
                                    <span className="block break-words">{product.name}</span>
                                    <span className="block break-all font-mono text-[10px] text-muted-foreground">{product.code || 'Sin código'}</span>
                                    {isSelected && selectedItem?.isVariable && selectedItem.variants?.length ? (
                                      <div className="mt-2 space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-2 text-left">
                                        <div className="flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-wide text-primary">
                                          <span>Distribución por variante</span>
                                          <span className="tabular-nums">Total: {getSolicitudVariantAllocation(selectedItem).allocated} uds.</span>
                                        </div>
                                        {selectedItem.variants.map((variant) => (
                                          <div key={variant.id} className="flex items-center justify-between gap-2">
                                            <span className="min-w-0 truncate text-[10px] font-medium">{variantLabel(variant)}{variant.sku ? <span className="ml-1 font-mono text-[9px] text-muted-foreground">· {variant.sku}</span> : null}</span>
                                            <Input
                                              type="number"
                                              min={0}
                                              className="h-7 w-16 shrink-0 text-right text-[10px] tabular-nums"
                                              value={selectedItem.variantQuantities?.[variant.id] || ''}
                                              onChange={(event) => updateSolicitudVariantQuantity(product.id, variant.id, Number(event.target.value))}
                                              disabled={solicitudCreating}
                                              aria-label={`Cantidad de ${variantLabel(variant)}`}
                                            />
                                          </div>
                                        ))}
                                        {!getSolicitudVariantAllocation(selectedItem).complete && <p className="text-[9px] font-semibold text-destructive">Captura al menos una unidad en una variante.</p>}
                                      </div>
                                    ) : null}
                                  </div>
                                </TableCell>
                                <TableCell className="max-w-0 whitespace-normal align-middle text-xs text-muted-foreground"><span className="block break-words">{product.category?.name || product.categoryName || 'Sin categoría'}</span></TableCell>
                                <TableCell className={`align-middle text-right text-xs tabular-nums ${snapshot.currentStock !== null && snapshot.currentStock <= Number(snapshot.minStock || 0) ? 'font-bold text-orange-500' : ''}`}>{snapshot.currentStock === null ? '—' : snapshot.currentStock}</TableCell>
                                <TableCell className="align-middle text-right text-xs tabular-nums">{snapshot.minStock === null ? '—' : snapshot.minStock}</TableCell>
                                <TableCell className="align-middle text-right">
                                  {isSelected && selectedItem.isVariable ? (
                                    <span className="ml-auto block w-full max-w-[6rem] rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5 text-right text-xs font-black tabular-nums text-primary" aria-label={`Total por variantes de ${product.name}`}>
                                      {selectedItem.quantity} uds.
                                    </span>
                                  ) : (
                                    <Input type="number" min={1} className="ml-auto h-8 w-full max-w-[6rem] text-right text-xs" value={isSelected ? selectedItem.quantity : ''} onChange={(event) => updateSolicitudQuantity(product.id, Number(event.target.value))} disabled={!isSelected || solicitudCreating} placeholder="—" aria-label={`Cantidad total a solicitar de ${product.name}`} />
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="grid gap-2 p-2 md:hidden">
                      {visibleSolicitudProducts.map((product: any) => {
                        const selectedItem = solicitudProducts.find((item) => item.productId === product.id);
                        const snapshot = getSolicitudProductSnapshot(product);
                        const isSelected = Boolean(selectedItem);
                        return (
                          <article key={product.id} className={`min-w-0 rounded-xl border p-3 transition-colors ${isSelected ? 'border-primary/50 bg-primary/[0.06]' : 'border-border/60 bg-background/70'}`}>
                            <div className="flex min-w-0 items-start gap-3">
                              <Checkbox className="mt-0.5 shrink-0" checked={isSelected} onCheckedChange={() => toggleSolicitudProduct(product)} disabled={solicitudCreating} aria-label={`Seleccionar ${product.name}`} />
                              <div className="min-w-0 flex-1">
                                <p className="break-words text-sm font-bold leading-tight">{product.name}</p>
                                <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{product.code || 'Sin código'}</p>
                                <Badge variant="outline" className="mt-2 max-w-full whitespace-normal break-words text-[10px] font-medium">{product.category?.name || product.categoryName || 'Sin categoría'}</Badge>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2">
                                <span className="block text-[10px] font-black uppercase tracking-wide text-muted-foreground">Stock actual</span>
                                <span className={`mt-1 block font-bold tabular-nums ${snapshot.currentStock !== null && snapshot.currentStock <= Number(snapshot.minStock || 0) ? 'text-orange-500' : ''}`}>{snapshot.currentStock === null ? '—' : snapshot.currentStock}</span>
                              </div>
                              <div className="rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2">
                                <span className="block text-[10px] font-black uppercase tracking-wide text-muted-foreground">Mínimo</span>
                                <span className="mt-1 block font-bold tabular-nums">{snapshot.minStock === null ? '—' : snapshot.minStock}</span>
                              </div>
                            </div>
                            {!isSelected || !selectedItem.isVariable ? (
                              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/40 pt-3">
                                <label htmlFor={`solicitud-quantity-${product.id}`} className="min-w-0 text-xs font-bold">Cantidad total a solicitar</label>
                                <Input id={`solicitud-quantity-${product.id}`} type="number" min={1} className="h-9 w-24 shrink-0 text-right text-xs" value={isSelected ? selectedItem.quantity : ''} onChange={(event) => updateSolicitudQuantity(product.id, Number(event.target.value))} disabled={!isSelected || solicitudCreating} placeholder="—" aria-label={`Cantidad total a solicitar de ${product.name}`} />
                              </div>
                            ) : null}
                            {isSelected && selectedItem?.isVariable && selectedItem.variants?.length ? (
                              <div className="mt-3 space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                                <div className="flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-wide text-primary">
                                  <span>Distribución por variante</span>
                                  <span className="tabular-nums">Total: {getSolicitudVariantAllocation(selectedItem).allocated} uds.</span>
                                </div>
                                {selectedItem.variants.map((variant) => (
                                  <div key={variant.id} className="flex items-center justify-between gap-2">
                                    <span className="min-w-0 truncate text-[10px] font-medium">{variantLabel(variant)}{variant.sku ? <span className="ml-1 font-mono text-[9px] text-muted-foreground">· {variant.sku}</span> : null}</span>
                                    <Input
                                      type="number"
                                      min={0}
                                      className="h-8 w-20 shrink-0 text-right text-xs tabular-nums"
                                      value={selectedItem.variantQuantities?.[variant.id] || ''}
                                      onChange={(event) => updateSolicitudVariantQuantity(product.id, variant.id, Number(event.target.value))}
                                      disabled={solicitudCreating}
                                      aria-label={`Cantidad de ${variantLabel(variant)}`}
                                    />
                                  </div>
                                ))}
                                {!getSolicitudVariantAllocation(selectedItem).complete && <p className="text-[9px] font-semibold text-destructive">Captura al menos una unidad en una variante.</p>}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                    <p>{solicitudOnlySelected && !solicitudProductSearch.trim() ? 'No quedan productos seleccionados en la tabla.' : 'No se encontraron productos con los filtros seleccionados.'}</p>
                    {solicitudOnlySelected && !solicitudProductSearch.trim() && <p className="mt-1 text-[11px]">Busca por nombre, código o categoría para agregar otro producto.</p>}
                  </div>
                )}
              </div>
              {filteredSolicitudProducts.length > SOLICITUD_PAGE_SIZE && (
                <div className="flex flex-col gap-2 pt-1 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Mostrando {((safeSolicitudPage - 1) * SOLICITUD_PAGE_SIZE) + 1}–{Math.min(safeSolicitudPage * SOLICITUD_PAGE_SIZE, filteredSolicitudProducts.length)} de {filteredSolicitudProducts.length} productos
                  </span>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button type="button" variant="outline" size="icon" className="size-8" onClick={() => setSolicitudPage((page) => Math.max(1, page - 1))} disabled={safeSolicitudPage === 1 || solicitudCatalogLoading} aria-label="Página anterior de productos">
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="min-w-20 text-center font-semibold">Página {safeSolicitudPage} de {solicitudPageCount}</span>
                    <Button type="button" variant="outline" size="icon" className="size-8" onClick={() => setSolicitudPage((page) => Math.min(solicitudPageCount, page + 1))} disabled={safeSolicitudPage === solicitudPageCount || solicitudCatalogLoading} aria-label="Página siguiente de productos">
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-border/40 pt-4 sm:gap-0" data-tour="inventory-request-actions">
            <Button className="w-full sm:w-auto" variant="outline" onClick={closeSolicitud} disabled={solicitudCreating}><X className="mr-1 size-3.5" /> Cancelar</Button>
            <Button className="w-full sm:w-auto" onClick={handleCreateSolicitud} disabled={solicitudCreating || solicitudProducts.length === 0 || !solicitudWarehouseId || !solicitudEmployeeId}>
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
