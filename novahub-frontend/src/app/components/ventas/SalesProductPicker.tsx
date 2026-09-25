import { useMemo, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, Check, ChevronLeft, ChevronRight, Grid2X2, List, MapPin, Package, Search, Warehouse } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import type { SalesOtherLocationsViewModule } from '../../services/inventario.service';
import { SalesOtherLocationsDialog } from './SalesOtherLocationsDialog';
import { formatCurrencyAmount } from '../../utils/currency';
import {
  formatSalesStock,
  getAvailableSalesStock,
  getSingleSalesVariant,
  getSalesWarehouseStockBreakdown,
  getSalesStockOptionLabel,
  tracksSalesInventory,
  type SalesStockProduct,
} from '../../utils/sales-stock';

export type SalesCatalogItem = SalesStockProduct & {
  id: string;
  code?: string | null;
  name?: string | null;
  categoryId?: string | null;
  category?: { id?: string | null; name?: string | null } | string | null;
  brand?: string | null;
  commercialNote?: string | null;
  salePrice?: number | string | null;
  price?: number | string | null;
  imageUrl?: string | null;
  isActive?: boolean;
};

export type SalesCatalogVariant = NonNullable<SalesStockProduct['variants']>[number];

type PickerView = 'cards' | 'list';
type AvailabilityFilter = 'all' | 'available' | 'empty';
const PICKER_PAGE_SIZE = 200;

type SalesProductPickerProps = {
  products: SalesCatalogItem[];
  value?: string | null;
  onChange: (productId: string, variant?: SalesCatalogVariant) => void;
  warehouseId?: string | null;
  variantId?: string | null;
  itemType: 'PRODUCT' | 'SERVICE';
  placeholder?: string;
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogLoading?: boolean;
  catalogError?: boolean;
  allowOutOfStockSelection?: boolean;
  otherLocationsPermissionModule: SalesOtherLocationsViewModule;
  className?: string;
};

const normalizeSearch = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

function getCategoryName(product: SalesCatalogItem) {
  if (typeof product.category === 'string') return product.category;
  return product.category?.name || '';
}

function getVariantName(variant?: SalesCatalogVariant | null) {
  const attributes = Array.isArray(variant?.attributes)
    ? (variant.attributes as Array<{ value?: string }>).map((attribute) => attribute?.value).filter(Boolean).join(' / ')
    : '';
  return attributes || variant?.name || variant?.sku || '';
}

function getItemType(product: SalesCatalogItem) {
  return String(product.itemType || product.type || '').toUpperCase() === 'SERVICE' ? 'SERVICE' : 'PRODUCT';
}

function stockState(product: SalesCatalogItem, warehouseId?: string | null, variantId?: string | null) {
  if (!tracksSalesInventory(product)) return 'untracked' as const;
  if (!String(warehouseId || '').trim()) return 'needs-warehouse' as const;
  const available = getAvailableSalesStock(product, warehouseId, variantId);
  if (available === null) return 'unknown' as const;
  return available > 0 ? 'available' as const : 'empty' as const;
}

function getOtherBranchWarehouseStock(product: SalesCatalogItem, warehouseId?: string | null, variantId?: string | null) {
  const selectedWarehouseId = String(warehouseId || '').trim();
  if (!selectedWarehouseId) return [];
  return getSalesWarehouseStockBreakdown(product, variantId)
    .filter((warehouse) => warehouse.id !== selectedWarehouseId && (warehouse.available ?? 0) > 0);
}

function CatalogProductImage({ product }: { product: SalesCatalogItem }) {
  const [failed, setFailed] = useState(false);
  if (product.imageUrl && !failed) {
    return <img src={product.imageUrl} alt="" className="size-full object-cover" onError={() => setFailed(true)} />;
  }
  return getItemType(product) === 'SERVICE'
    ? <BriefcaseBusiness className="size-4 shrink-0" aria-hidden="true" />
    : <Package className="size-4 shrink-0" aria-hidden="true" />;
}

export function SalesProductPicker({
  products,
  value,
  onChange,
  warehouseId,
  variantId,
  itemType,
  placeholder,
  disabled = false,
  open,
  onOpenChange,
  catalogLoading = false,
  catalogError = false,
  allowOutOfStockSelection = false,
  otherLocationsPermissionModule,
  className,
}: SalesProductPickerProps) {
  const { canPerform } = useAuth();
  const canViewOtherLocations = canPerform(otherLocationsPermissionModule, 'viewOtherLocations');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState<PickerView>('cards');
  const [variantProductSelection, setVariantProductSelection] = useState<SalesCatalogItem | null>(null);
  const [otherLocationsProduct, setOtherLocationsProduct] = useState<SalesCatalogItem | null>(null);
  const selectedProduct = products.find((product) => String(product.id) === String(value || ''));
  const selectedVariant = selectedProduct?.variants?.find((variant) => variant.id === variantId);
  const selectedVariantId = variantId || getSingleSalesVariant(selectedProduct)?.id;

  const categories = useMemo(() => {
    const values = new Map<string, string>();
    products.filter((product) => getItemType(product) === itemType).forEach((product) => {
      const name = getCategoryName(product).trim();
      const id = String(product.categoryId || (typeof product.category === 'object' ? product.category?.id : '') || name).trim();
      if (id && name) values.set(id, name);
    });
    return [...values.entries()].sort((left, right) => left[1].localeCompare(right[1], 'es'));
  }, [itemType, products]);

  const brands = useMemo(() => [...new Set(products
    .filter((product) => getItemType(product) === itemType)
    .map((product) => String(product.brand || '').trim())
    .filter(Boolean))].sort((left, right) => left.localeCompare(right, 'es')), [itemType, products]);

  const filteredProducts = useMemo(() => {
    const query = normalizeSearch(search);
    return products
      .filter((product) => getItemType(product) === itemType)
      .filter((product) => product.isActive !== false || String(product.id) === String(value || ''))
      .filter((product) => {
        if (!query) return true;
        const searchable = [
          product.code,
          product.name,
          product.brand,
          product.commercialNote,
          getCategoryName(product),
          ...(product.variants || []).map((variant) => (variant as { sku?: string | null }).sku),
        ].map(normalizeSearch).join(' ');
        return searchable.includes(query);
      })
      .filter((product) => brandFilter === 'all' || normalizeSearch(product.brand) === normalizeSearch(brandFilter))
      .filter((product) => {
        if (categoryFilter === 'all') return true;
        const categoryId = String(product.categoryId || (typeof product.category === 'object' ? product.category?.id : '') || getCategoryName(product)).trim();
        return categoryId === categoryFilter;
      })
      .filter((product) => availabilityFilter === 'all' || stockState(product, warehouseId, String(product.id) === String(value || '') ? selectedVariantId : getSingleSalesVariant(product)?.id) === availabilityFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availabilityFilter, brandFilter, categoryFilter, itemType, products, search, value, variantId, warehouseId]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PICKER_PAGE_SIZE));
  const page = Math.max(1, Math.min(currentPage, totalPages));
  const pageStart = (page - 1) * PICKER_PAGE_SIZE;
  const paginatedProducts = filteredProducts.slice(pageStart, pageStart + PICKER_PAGE_SIZE);
  const firstVisibleResult = filteredProducts.length > 0 ? pageStart + 1 : 0;
  const lastVisibleResult = Math.min(pageStart + PICKER_PAGE_SIZE, filteredProducts.length);

  const warehouseName = (id?: string | null) => {
    const normalizedId = String(id || '').trim();
    if (!normalizedId) return '';
    return products.flatMap((product) => product.warehouseCatalog || []).find((warehouse) => String(warehouse.id) === normalizedId)?.name
      || 'Bodega seleccionada';
  };

  const getWarehouseStockSummary = (product: SalesCatalogItem, scopedVariantId?: string | null) =>
    getSalesWarehouseStockBreakdown(product, scopedVariantId)
      .map((warehouse) => `${warehouse.name}${warehouse.isActive === false ? ' (inactiva)' : ''}: ${warehouse.available === null ? 'no disponible' : formatSalesStock(warehouse.available)}`)
      .join(' · ');

  const selectedStockLabel = selectedProduct
    ? getSalesStockOptionLabel(selectedProduct, warehouseId, selectedVariantId)
    : null;
  const closeAndReset = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setSearch('');
      setCategoryFilter('all');
      setBrandFilter('all');
      setAvailabilityFilter('all');
      setCurrentPage(1);
      setVariantProductSelection(null);
      setOtherLocationsProduct(null);
    }
  };
  const choose = (product: SalesCatalogItem) => {
    const allVariants = product.variants || [];
    const variants = allVariants.filter((variant) => variant.isActive !== false);
    if (getItemType(product) !== 'SERVICE' && allVariants.length > 0 && variants.length === 0) return;
    if (getItemType(product) !== 'SERVICE' && variants.length > 1) {
      setVariantProductSelection(product);
      return;
    }
    const onlyVariant = getItemType(product) === 'SERVICE' ? undefined : variants[0];
    const availability = onlyVariant && tracksSalesInventory(product)
      ? getAvailableSalesStock(product, warehouseId, onlyVariant.id)
      : tracksSalesInventory(product) ? getAvailableSalesStock(product, warehouseId) : null;
    if (!allowOutOfStockSelection && availability === 0) return;
    onChange(product.id, onlyVariant);
    closeAndReset(false);
  };
  const chooseVariant = (variant: SalesCatalogVariant) => {
    if (!variantProductSelection) return;
    if (!allowOutOfStockSelection
      && tracksSalesInventory(variantProductSelection)
      && getAvailableSalesStock(variantProductSelection, warehouseId, variant.id) === 0) return;
    onChange(variantProductSelection.id, variant);
    closeAndReset(false);
  };

  const renderPrice = (product: SalesCatalogItem) => {
    const rawPrice = product.salePrice ?? product.price;
    if (rawPrice === undefined || rawPrice === null) return null;
    const numericPrice = Number(rawPrice);
    if (!Number.isFinite(numericPrice)) return null;
    const currency = (product as { priceCurrency?: string }).priceCurrency || 'NIO';
    return (
      <Badge
        variant="outline"
          className="shrink-0 font-semibold border-green-500/30 text-green-700 dark:text-green-300 bg-green-50/50 dark:bg-green-950/30"
      >
        Precio: {formatCurrencyAmount(numericPrice, currency)}
      </Badge>
    );
  };

  const renderAvailability = (product: SalesCatalogItem, scopedVariantId?: string | null) => {
    if (getItemType(product) === 'SERVICE') return null;
    if (!tracksSalesInventory(product)) return <Badge variant="outline" className="shrink-0">No controla inventario</Badge>;
    const availability = getAvailableSalesStock(product, warehouseId, scopedVariantId);
    const label = getSalesStockOptionLabel(product, warehouseId, scopedVariantId);
    return (
      <Badge
        variant="outline"
        className={cn(
          'max-w-full shrink-0 whitespace-normal text-left',
          availability === null ? 'border-border text-muted-foreground' : availability > 0 ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/30 text-amber-700 dark:text-amber-300',
        )}
      >
        {label}
      </Badge>
    );
  };

  const renderProductButton = (product: SalesCatalogItem) => {
    const isSelected = String(product.id) === String(value || '');
    const scopedVariantId = isSelected && variantId ? variantId : getSingleSalesVariant(product)?.id;
    const stock = tracksSalesInventory(product) ? getAvailableSalesStock(product, warehouseId, scopedVariantId) : null;
    const otherBranchWarehouseStock = canViewOtherLocations && stock === 0
      ? getOtherBranchWarehouseStock(product, warehouseId, scopedVariantId)
      : [];
    const activeVariantCount = (product.variants || []).filter((variant) => variant.isActive !== false).length;
    const hasVariantsButNoneActive = (product.variants || []).length > 0 && activeVariantCount === 0;
    const selectionBlocked = (getItemType(product) !== 'SERVICE' && hasVariantsButNoneActive)
      || (!allowOutOfStockSelection && tracksSalesInventory(product) && activeVariantCount <= 1 && stock === 0);
    return (
      <div
        key={product.id}
        className={cn(
          'flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card transition-colors',
          view === 'cards' && 'min-h-32',
          isSelected ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border/70',
        )}
      >
        <button
          type="button"
          onClick={() => choose(product)}
          disabled={selectionBlocked}
          className={cn(
            'group flex min-w-0 w-full flex-1 gap-3 bg-transparent p-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent',
            view === 'cards' ? 'flex-col justify-between gap-3 min-h-32' : 'flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5',
          )}
          aria-pressed={isSelected}
          aria-label={`${product.name || 'Artículo'}${hasVariantsButNoneActive ? '. Sin variantes activas' : selectionBlocked ? '. Sin existencias en la bodega seleccionada' : ''}`}
        >
          <div className={cn('flex min-w-0 gap-3', view === 'cards' ? 'items-start' : 'flex-1 items-center')}>
            <div className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground', view === 'cards' ? 'size-14 sm:size-16' : 'size-12')}>
              <CatalogProductImage product={product} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-semibold text-foreground">{product.name || 'Artículo'}</p>
              <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{product.code || 'Sin código'}{product.brand ? ` · ${product.brand}` : ''}</p>
              {getCategoryName(product) && <p className="mt-1 truncate text-[10px] text-muted-foreground">{getCategoryName(product)}</p>}
            </div>
          </div>
          <div className={cn('flex min-w-0 flex-wrap items-center gap-1.5', view === 'list' && 'w-full sm:w-auto sm:ml-auto justify-start sm:justify-end')}>
            {renderPrice(product)}
            {renderAvailability(product, scopedVariantId)}
            {hasVariantsButNoneActive && <Badge variant="outline" className="shrink-0 border-amber-500/30 text-amber-700 dark:text-amber-300">Sin variantes activas</Badge>}
            {view === 'list' && stock !== null && tracksSalesInventory(product) && <span className="sr-only">{formatSalesStock(stock)} disponibles</span>}
            {isSelected && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
          </div>
        </button>
        {otherBranchWarehouseStock.length > 0 && (
          <p role="status" className="mx-3 mb-2 flex min-w-0 items-start gap-1.5 rounded-lg bg-muted/50 px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
            <MapPin className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {otherBranchWarehouseStock.map((warehouse, index) => (
                <span key={warehouse.id}>
                  {index > 0 ? ' · ' : ''}<strong className="text-foreground">Disponible en la bodega {warehouse.name}: {formatSalesStock(warehouse.available ?? 0)}</strong>
                </span>
              ))}
            </span>
          </p>
        )}
        {canViewOtherLocations && tracksSalesInventory(product) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mx-2 mb-2 h-7 max-w-[calc(100%-1rem)] justify-start px-2 text-[10px] text-primary"
            onClick={() => setOtherLocationsProduct(product)}
            aria-label={`Ver existencias de ${product.name || product.code} en otras ubicaciones`}
          >
            <MapPin className="mr-1 size-3 shrink-0" aria-hidden="true" /> Ver en otras ubicaciones
          </Button>
        )}
      </div>
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => onOpenChange(true)}
        className={cn('h-9 w-full min-w-0 justify-between rounded-md text-left font-normal', className)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={selectedProduct ? `Cambiar ${itemType === 'SERVICE' ? 'servicio' : 'producto'}: ${selectedProduct.name}${selectedVariant ? `, variante ${getVariantName(selectedVariant)}` : ''}` : placeholder || `Seleccionar ${itemType === 'SERVICE' ? 'servicio' : 'producto'}`}
      >
        <span className="min-w-0 truncate">
          {selectedProduct ? `${selectedProduct.code ? `${selectedProduct.code} - ` : ''}${selectedProduct.name || 'Artículo'}${selectedVariant ? ` · ${getVariantName(selectedVariant)}` : ''}` : placeholder || `Seleccionar ${itemType === 'SERVICE' ? 'servicio...' : 'producto...'}`}
        </span>
        {selectedStockLabel && <span className="ml-2 max-w-32 shrink-0 truncate text-[10px] text-muted-foreground" title={selectedStockLabel}>{selectedStockLabel}</span>}
      </Button>

      <Dialog open={open} onOpenChange={closeAndReset}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-6xl gap-3 p-4 sm:p-6">
          <DialogHeader className="pr-8 text-left">
            {variantProductSelection && (
              <Button type="button" variant="ghost" size="sm" className="mb-1 w-fit px-2" onClick={() => setVariantProductSelection(null)}>
                <ArrowLeft className="mr-1 size-4" aria-hidden="true" /> Volver a productos
              </Button>
            )}
            <DialogTitle>{variantProductSelection ? 'Seleccionar variante' : itemType === 'SERVICE' ? 'Seleccionar servicio' : 'Seleccionar producto'}</DialogTitle>
            <DialogDescription>
              {variantProductSelection
                ? `${variantProductSelection.name || 'Producto'} · variantes para ${warehouseName(warehouseId) || 'la bodega seleccionada'}.`
                : `Busca por código, nombre, marca o SKU de variante y revisa la disponibilidad en ${warehouseName(warehouseId) || 'la bodega seleccionada'}.`}
            </DialogDescription>
          </DialogHeader>

          {!variantProductSelection && <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar código, nombre, marca o SKU..."
                className="pl-9"
                aria-label="Buscar productos y servicios"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger aria-label="Filtrar por categoría"><SelectValue placeholder="Todas las categorías" /></SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto scrollbar-overlay">
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger aria-label="Filtrar por marca"><SelectValue placeholder="Todas las marcas" /></SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto scrollbar-overlay">
                <SelectItem value="all">Todas las marcas</SelectItem>
                {brands.map((brand) => <SelectItem key={brand} value={brand}>{brand}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>}

          {!variantProductSelection && <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            {itemType === 'PRODUCT' ? (
              <Select value={availabilityFilter} onValueChange={(value) => setAvailabilityFilter(value as AvailabilityFilter)}>
                <SelectTrigger className="w-full sm:w-52" aria-label="Filtrar por existencia"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo</SelectItem>
                  <SelectItem value="available">Con existencias</SelectItem>
                  <SelectItem value="empty">Sin existencias</SelectItem>
                </SelectContent>
              </Select>
            ) : <span className="text-xs text-muted-foreground">Servicios activos: {filteredProducts.length}</span>}
            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border p-1" aria-label="Formato del catálogo">
              <Button type="button" size="sm" variant={view === 'cards' ? 'secondary' : 'ghost'} className="h-8 px-2" aria-pressed={view === 'cards'} aria-label="Ver en tarjetas" onClick={() => setView('cards')}>
                <Grid2X2 className="size-4" />
              </Button>
              <Button type="button" size="sm" variant={view === 'list' ? 'secondary' : 'ghost'} className="h-8 px-2" aria-pressed={view === 'list'} aria-label="Ver en lista" onClick={() => setView('list')}>
                <List className="size-4" />
              </Button>
            </div>
            <p className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
              <Warehouse className="size-3 shrink-0" />
              <span className="truncate">{warehouseId ? warehouseName(warehouseId) : 'Selecciona una bodega para consultar existencias'}</span>
            </p>
          </div>}

          {variantProductSelection ? (
            <div className="min-h-24 max-h-[min(56vh,calc(100dvh-14rem))] min-w-0 space-y-2 overflow-y-auto overscroll-contain rounded-xl border border-border/50 bg-muted/10 p-2">
              <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                  <CatalogProductImage product={variantProductSelection} />
                </div>
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-foreground">{variantProductSelection.name || 'Producto'}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">{variantProductSelection.code || 'Sin código'}</p>
                </div>
              </div>
              {(variantProductSelection.variants || []).filter((variant) => variant.isActive !== false).map((variant, index) => {
                const variantAttributes = Array.isArray(variant.attributes)
                  ? (variant.attributes as Array<{ value?: string }>).map((attribute) => attribute?.value).filter(Boolean).join(' / ')
                  : '';
                const label = variantAttributes || variant.name || `Variante ${index + 1}`;
                const variantStock = tracksSalesInventory(variantProductSelection)
                  ? getAvailableSalesStock(variantProductSelection, warehouseId, variant.id)
                  : null;
                const variantBlocked = !allowOutOfStockSelection && variantStock === 0;
                const warehouseStockSummary = tracksSalesInventory(variantProductSelection)
                  && canViewOtherLocations
                  ? getWarehouseStockSummary(variantProductSelection, variant.id)
                  : '';
                const otherBranchWarehouseStock = canViewOtherLocations && variantStock === 0
                  ? getOtherBranchWarehouseStock(variantProductSelection, warehouseId, variant.id)
                  : [];
                const otherBranchWarehouseLabel = otherBranchWarehouseStock
                  .map((warehouse) => `Disponible en la bodega ${warehouse.name}: ${formatSalesStock(warehouse.available ?? 0)}`)
                  .join(' · ');
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => chooseVariant(variant)}
                    disabled={variantBlocked}
                    className="flex min-w-0 w-full flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border/70 disabled:hover:bg-card sm:flex-row sm:items-center sm:justify-between"
                    aria-label={`Seleccionar variante ${variant.sku || label}. ${getSalesStockOptionLabel(variantProductSelection, warehouseId, variant.id) || ''}${otherBranchWarehouseLabel ? `. ${otherBranchWarehouseLabel}` : ''}`}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="break-words text-sm font-semibold text-foreground">{label}</span>
                      <span className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">SKU {variant.sku || 'Sin SKU'}</span>
                    </span>
                    {renderAvailability(variantProductSelection, variant.id)}
                    {warehouseStockSummary && <span className="basis-full break-words text-[10px] leading-4 text-muted-foreground">Stock por bodega: {warehouseStockSummary}</span>}
                    {otherBranchWarehouseLabel && <span className="flex basis-full min-w-0 items-start gap-1 break-words text-[10px] leading-4 text-primary"><MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" /> {otherBranchWarehouseLabel}</span>}
                  </button>
                );
              })}
            </div>
          ) : <div className={cn('min-h-24 max-h-[min(56vh,calc(100dvh-19rem))] min-w-0 overflow-y-auto overscroll-contain rounded-xl border border-border/50 bg-muted/10 p-2', view === 'cards' ? 'grid grid-cols-1 content-start gap-2 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-2')}>
            {catalogLoading
              ? <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Cargando catálogo de productos y existencias...</p>
              : catalogError
                ? <p role="alert" className="col-span-full py-10 text-center text-sm text-destructive">No se pudo cargar el catálogo. Actualiza Ventas e inténtalo de nuevo.</p>
                : filteredProducts.length > 0
              ? paginatedProducts.map(renderProductButton)
              : <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No se encontraron {itemType === 'SERVICE' ? 'servicios' : 'productos'} con esos filtros.</p>}
          </div>}
          {!variantProductSelection && <div className="flex min-w-0 flex-col items-center justify-between gap-2 sm:flex-row">
            <p className="text-[10px] text-muted-foreground" aria-live="polite">
              Mostrando {firstVisibleResult}–{lastVisibleResult} de {filteredProducts.length} resultado(s)
            </p>
            <nav className="flex items-center gap-2" aria-label={`Paginación de ${itemType === 'SERVICE' ? 'servicios' : 'productos'}`}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2"
                disabled={page <= 1}
                onClick={() => setCurrentPage(Math.max(1, page - 1))}
                aria-label="Página anterior"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                <span className="sr-only">Anterior</span>
              </Button>
              <span className="min-w-24 text-center text-xs text-muted-foreground">Página {page} de {totalPages}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2"
                disabled={page >= totalPages}
                onClick={() => setCurrentPage(Math.min(totalPages, page + 1))}
                aria-label="Página siguiente"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
                <span className="sr-only">Siguiente</span>
              </Button>
            </nav>
          </div>}
        </DialogContent>
      </Dialog>
      <SalesOtherLocationsDialog
        product={otherLocationsProduct}
        warehouseId={warehouseId}
        viewModule={otherLocationsPermissionModule}
        open={Boolean(otherLocationsProduct)}
        onOpenChange={(nextOpen) => { if (!nextOpen) setOtherLocationsProduct(null); }}
      />
    </>
  );
}
