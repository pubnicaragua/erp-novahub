import { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Download, FileSpreadsheet, Pencil, Plus, Settings2, Square, SquareCheckBig, Upload, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { HorizontalTableScroller } from '../ui/HorizontalTableScroller';
import { toast } from 'sonner';
import { priceListsService, type PriceListItem } from '../../services/price-lists.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
import { formatSalesAmount } from '../../utils/salesPriceList';

interface PriceListsViewProps { products?: any[]; onRefresh?: () => void; isSidebarCollapsed?: boolean; }
type ImportRow = { code: string; name: string; cost: number | ''; prices: Record<string, number | ''>; error?: string };
type PriceImportResult = { updated: number; unchanged: number; errors: string[] };

const currencyLabel = (currency: string) => currency === 'USD' ? 'Dólares' : 'Córdobas';
const normalize = (value: unknown) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const PRICE_LISTS_TOUR_STEPS: GuidedTourStep[] = [
  { target: '[data-tour="price-lists-title"]', title: 'Vista de Listas de precios', description: 'Aquí administras las tarifas de venta por producto. El costo permanece en Inventario; esta vista concentra los precios que utilizará Ventas.', tip: 'Minorista, Mayorista y Distribuidor vienen como listas predeterminadas. Las demás listas se agregan después.', placement: 'bottom' },
  { target: '[data-tour="price-lists-new"]', title: 'Crear una nueva lista', description: 'Usa Nueva lista para agregar una tarifa adicional, por ejemplo Promocional o Institucional. El sistema genera automáticamente su código.', placement: 'bottom' },
  { target: '[data-tour="price-lists-columns"]', title: 'Configurar columnas', description: 'Elige qué listas se ven en la tabla. La misma selección define las columnas que aparecerán al descargar o importar una plantilla.', placement: 'bottom' },
  { target: '[data-tour="price-lists-currency"]', title: 'Moneda de visualización', description: 'Cambia entre córdobas y dólares para consultar o editar precios. El cálculo utiliza la tasa global configurada y conserva el valor base.', placement: 'bottom' },
  { target: '[data-tour="price-lists-pagination"]', title: 'Paginación', description: 'Actívala cuando tengas muchos productos para cargar solo una cantidad de filas por página y mantener la vista ágil.', placement: 'bottom' },
  { target: '[data-tour="price-lists-template"]', title: 'Descargar plantilla', description: 'Selecciona productos en la tabla y descarga una plantilla con el costo de referencia, precios existentes y las listas visibles. Incluye una guía de llenado.', placement: 'bottom' },
  { target: '[data-tour="price-lists-import"]', title: 'Importar precios', description: 'La importación no depende de seleccionar filas: carga un archivo y el sistema identifica los productos por SKU. Primero se abre el modal de carga; después, al presionar Previsualizar actualización, se muestra la tabla completa para editar.', tip: 'Las celdas vacías no cambian precios existentes. Las incidencias se corrigen antes de confirmar y el proceso muestra porcentaje y resultado final.', placement: 'bottom' },
  { target: '[data-tour="price-lists-matrix"]', title: 'Matriz y edición', description: 'Cada fila representa un producto y cada columna una lista. Haz clic en el lápiz para editar todos los precios visibles de esa fila y guarda una sola vez.', placement: 'top' },
];

function PriceImportPreviewPage({
  rows,
  fileName,
  lists,
  currency,
  rate,
  baseCurrency,
  isSidebarCollapsed,
  importing,
  progress,
  result,
  onRowUpdate,
  onBack,
  onConfirm,
  onDone,
}: {
  rows: ImportRow[];
  fileName: string;
  lists: any[];
  currency: 'NIO' | 'USD';
  rate: number;
  baseCurrency: string;
  isSidebarCollapsed: boolean;
  importing: boolean;
  progress: number;
  result: PriceImportResult | null;
  onRowUpdate: (index: number, field: string, value: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  onDone: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const validRows = rows.filter((row) => !row.error).length;
  const issueRows = rows.length - validRows;

  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(timer);
  }, [result, onDone]);

  return (
    <div className={`fixed inset-y-0 right-0 left-0 z-40 flex h-dvh min-h-0 flex-col overflow-hidden bg-background p-4 sm:p-6 ${isSidebarCollapsed ? 'lg:left-[72px]' : 'lg:left-[270px]'}`}>
      <div className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Actualización masiva</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Previsualizar precios</h1>
            <p className="mt-1 text-sm text-muted-foreground">Revisa y corrige los precios antes de actualizar las listas seleccionadas.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
            <Badge variant="outline">{rows.length} registros</Badge>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">{validRows} válidos</Badge>
            <Badge variant="outline" className={issueRows ? 'border-rose-500/30 text-rose-600' : ''}>{issueRows} con incidencias</Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Archivo cargado</p>
            <p className="truncate text-sm font-bold" title={fileName}>{fileName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">Moneda: {currencyLabel(currency)}</Badge>
            <Badge variant="secondary">Tasa: {currency === baseCurrency ? '1' : Number(rate || 1).toFixed(4)}</Badge>
            {lists.map((list) => <Badge key={list.id} variant="outline">{list.name}</Badge>)}
          </div>
        </div>

        <HorizontalTableScroller className="min-h-0 flex-1" label="Desplazamiento horizontal · columna por columna">
          <Table containerClassName="w-max min-w-full max-w-none overflow-visible" className="min-w-[1050px]">
            <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
              <TableRow>
                <TableHead className="w-20 min-w-20 whitespace-nowrap text-center">Estado</TableHead>
                <TableHead className="w-44">Código / SKU</TableHead>
                <TableHead className="min-w-64">Producto</TableHead>
                <TableHead className="w-36 text-right">Costo</TableHead>
                {lists.map((list) => <TableHead key={list.id} className="w-36 text-right">{list.name}</TableHead>)}
                <TableHead className="min-w-52">Validación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={`${row.code}-${index}`} className={row.error ? 'bg-rose-500/5' : ''}>
                  <TableCell className="text-center">{row.error ? <AlertTriangle className="mx-auto size-4 text-rose-500" /> : <CheckCircle2 className="mx-auto size-4 text-emerald-500" />}</TableCell>
                  <TableCell><Input className="h-9 font-mono text-xs" value={row.code} onChange={(event) => onRowUpdate(index, 'code', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell className="font-medium">{row.name || 'Producto no encontrado'}</TableCell>
                  <TableCell><Input className="h-9 text-right text-muted-foreground" type="number" value={row.cost} disabled /></TableCell>
                  {lists.map((list) => <TableCell key={list.id}><Input className="h-9 text-right" type="number" min="0" value={row.prices[list.code] ?? ''} onChange={(event) => onRowUpdate(index, list.code, event.target.value)} disabled={importing} /></TableCell>)}
                  <TableCell className={row.error ? 'text-xs font-medium text-rose-600' : 'text-xs text-emerald-600'}>{row.error || 'Correcto'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!rows.length && <div className="p-12 text-center text-sm text-muted-foreground">El archivo no contiene filas para actualizar.</div>}
        </HorizontalTableScroller>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <Button variant="outline" onClick={onBack} disabled={importing}>Volver a la carga</Button>
          <Button onClick={() => { setConfirmText(''); setConfirmOpen(true); }} disabled={importing || validRows === 0} className="font-bold">
            {importing ? `Actualizando… ${progress}%` : `Actualizar ${validRows} registros`}
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar actualización de precios</DialogTitle>
            <DialogDescription>Se actualizarán {lists.length} listas para {validRows} registros. Las filas con errores se omitirán. Escribe ACTUALIZAR para continuar.</DialogDescription>
          </DialogHeader>
          <Input value={confirmText} onChange={(event) => setConfirmText(event.target.value.toUpperCase())} placeholder="ACTUALIZAR" autoFocus />
          <DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button><Button onClick={() => { setConfirmOpen(false); onConfirm(); }} disabled={confirmText !== 'ACTUALIZAR'}>Confirmar actualización</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importing} onOpenChange={() => undefined}>
        <DialogContent className="max-w-md [&>button]:hidden" onInteractOutside={(event) => event.preventDefault()} onEscapeKeyDown={(event) => event.preventDefault()}>
          <div className="flex flex-col items-center gap-5 py-5 text-center">
            <div className="relative flex size-24 items-center justify-center rounded-full border-4 border-primary/20 bg-primary/5"><div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" /><span className="text-xl font-black text-primary">{progress}%</span></div>
            <div><DialogTitle className="text-xl">Actualizando precios</DialogTitle><DialogDescription className="mt-2">Estamos guardando los cambios en las listas. No cierres esta ventana.</DialogDescription></div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${Math.max(progress, 3)}%` }} /></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={result !== null} onOpenChange={(open) => { if (!open) onDone(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><div className="flex flex-col items-center gap-3 py-3 text-center"><div className="flex size-20 animate-in zoom-in items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 duration-500"><CheckCircle2 className="size-12 animate-pulse" /></div><DialogTitle className="text-xl">Actualización completada</DialogTitle><DialogDescription>Las listas de precios ya fueron actualizadas.</DialogDescription></div></DialogHeader>
          <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-emerald-500">{result?.updated || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Actualizados</p></div><div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-sky-500">{result?.unchanged || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Sin cambios</p></div><div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-rose-500">{result?.errors.length || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Incidencias</p></div></div>
          <DialogFooter><Button className="w-full" onClick={onDone}>Continuar a listas de precios</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PriceListsView({ products = [], isSidebarCollapsed = true }: PriceListsViewProps) {
  const { baseCurrency, exchangeRate } = useCurrency();
  const { user, canPerform } = useAuth();
  const canCreatePriceList = canPerform('SALES_PRICE_LISTS', 'create');
  const canEditPriceList = canPerform('SALES_PRICE_LISTS', 'edit');
  const canImportPriceLists = canPerform('SALES_PRICE_LISTS', 'import');
  const canExportPriceLists = canPerform('SALES_PRICE_LISTS', 'export');
  const queryClient = useQueryClient();
  const tenantKey = user?.tenantId || 'anonymous';
  const matrixQuery = useQuery({
    queryKey: ['sales', 'price-lists', 'matrix', tenantKey],
    queryFn: ({ signal }) => priceListsService.getMatrix(signal),
    enabled: Boolean(user?.tenantId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
  const lists = useMemo(() => matrixQuery.data?.lists || [], [matrixQuery.data]);
  const matrixItems = useMemo(() => (matrixQuery.data?.items || []) as PriceListItem[], [matrixQuery.data]);
  const matrixProducts = useMemo(() => matrixQuery.data?.products || [], [matrixQuery.data]);
  const [visibleListIds, setVisibleListIds] = useState<string[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState<'NIO' | 'USD'>(baseCurrency === 'USD' ? 'USD' : 'NIO');
  const [paginationEnabled, setPaginationEnabled] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [missingSelectedIds, setMissingSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const [editingProductIds, setEditingProductIds] = useState<Set<string>>(new Set());
  const [editingPrices, setEditingPrices] = useState<Record<string, Record<string, string>>>({});
  const [columnConfigOpen, setColumnConfigOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadScopeIds, setDownloadScopeIds] = useState<string[]>([]);
  const [missingOpen, setMissingOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<PriceImportResult | null>(null);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importFile, setImportFile] = useState('');
  const [_importScopeIds, setImportScopeIds] = useState<string[]>([]);
  const [importCurrency, setImportCurrency] = useState(baseCurrency === 'USD' ? 'USD' : 'NIO');
  const [importRate, setImportRate] = useState<number>(Number(exchangeRate || 1));
  const [newListOpen, setNewListOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [newListName, setNewListName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const catalogProducts = useMemo(
    () => (matrixProducts.length ? matrixProducts : products).filter((product) => String(product.itemType || product.type || 'PRODUCT').toUpperCase() !== 'SERVICE'),
    [matrixProducts, products],
  );
  const visibleLists = useMemo(() => lists.filter((list) => visibleListIds.includes(list.id)), [lists, visibleListIds]);
  const itemsByProduct = useMemo(() => {
    const result = new Map<string, Map<string, PriceListItem>>();
    matrixItems.forEach((item) => {
      const byList = result.get(item.productId) || new Map<string, PriceListItem>();
      byList.set(item.priceListId, item);
      result.set(item.productId, byList);
    });
    return result;
  }, [matrixItems]);
  const productByCode = useMemo(() => new Map(catalogProducts.map((product) => [normalize(product.code), product])), [catalogProducts]);
  const missingProducts = useMemo(() => catalogProducts.filter((product) => {
    const byList = itemsByProduct.get(product.id);
    return lists.some((list) => !byList?.has(list.id));
  }), [catalogProducts, itemsByProduct, lists]);
  const missingPriceCount = useMemo(() => missingProducts.reduce((total, product) => {
    const byList = itemsByProduct.get(product.id);
    return total + lists.filter((list) => !byList?.has(list.id)).length;
  }, 0), [missingProducts, itemsByProduct, lists]);
  const selectedCount = selectedProductIds.size;
  const importLists = visibleLists;
  const totalPages = Math.max(1, Math.ceil(catalogProducts.length / pageSize));
  const displayedProducts = useMemo(() => paginationEnabled ? catalogProducts.slice((page - 1) * pageSize, page * pageSize) : catalogProducts, [catalogProducts, page, pageSize, paginationEnabled]);
  const displayedProductIds = useMemo(() => displayedProducts.map((product) => product.id), [displayedProducts]);
  const allDisplayedSelected = displayedProductIds.length > 0 && displayedProductIds.every((id) => selectedProductIds.has(id));

  const loading = matrixQuery.isPending;
  const refreshMatrix = async () => {
    await queryClient.invalidateQueries({ queryKey: ['sales', 'price-lists', 'matrix', tenantKey] });
  };

  useEffect(() => {
    if (matrixQuery.isError) toast.error((matrixQuery.error as any)?.message || 'No se pudo cargar la matriz de precios');
  }, [matrixQuery.isError, matrixQuery.error]);
  const [prevLists, setPrevLists] = useState(lists);
  if (prevLists !== lists && lists.length) {
    setPrevLists(lists);
    setVisibleListIds((current) => current.length ? [...current.filter((id) => lists.some((list) => list.id === id)), ...lists.filter((list) => !current.includes(list.id)).map((list) => list.id)] : lists.map((list) => list.id));
  }
  const [prevBaseCurrency, setPrevBaseCurrency] = useState(baseCurrency);
  if (prevBaseCurrency !== baseCurrency) {
    setPrevBaseCurrency(baseCurrency);
    setDisplayCurrency(baseCurrency === 'USD' ? 'USD' : 'NIO');
  }
  const [prevTotalPages, setPrevTotalPages] = useState(totalPages);
  if (prevTotalPages !== totalPages) {
    setPrevTotalPages(totalPages);
    setPage((current) => Math.min(current, totalPages));
  }
  const [prevMissingOpen, setPrevMissingOpen] = useState(missingOpen);
  const [prevMissingProducts, setPrevMissingProducts] = useState(missingProducts);
  if (missingOpen && (prevMissingOpen !== missingOpen || prevMissingProducts !== missingProducts)) {
    setPrevMissingOpen(missingOpen);
    setPrevMissingProducts(missingProducts);
    setMissingSelectedIds(new Set(missingProducts.map((product) => product.id)));
  }

  const toggleProduct = (id: string, source: 'main' | 'missing' = 'main') => {
    const setter = source === 'main' ? setSelectedProductIds : setMissingSelectedIds;
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = (ids: string[], source: 'main' | 'missing' = 'main') => {
    const setter = source === 'main' ? setSelectedProductIds : setMissingSelectedIds;
    setter((current) => {
      const next = new Set(current);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      ids.forEach((id) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const convertBaseToDisplay = (basePrice: number) => {
    const base = Number(basePrice || 0);
    if (displayCurrency === baseCurrency) return base;
    return baseCurrency === 'USD' ? base * Number(exchangeRate || 1) : base / Number(exchangeRate || 1);
  };

  const formatDisplayPrice = (basePrice: number) => `${displayCurrency === 'USD' ? '$' : 'C$'} ${formatSalesAmount(convertBaseToDisplay(basePrice))}`;

  const beginEditProduct = (productId: string) => {
    if (!canEditPriceList) return;
    const byList = itemsByProduct.get(productId);
    const values = Object.fromEntries(visibleLists.map((list) => {
      const item = byList?.get(list.id);
      return [list.id, item ? formatSalesAmount(convertBaseToDisplay(Number(item.basePrice))) : ''];
    }));
    setEditingPrices((current) => ({ ...current, [productId]: values }));
    setEditingProductIds((current) => new Set(current).add(productId));
  };

  const cancelEditProduct = (productId: string) => {
    setEditingProductIds((current) => {
      const next = new Set(current);
      next.delete(productId);
      return next;
    });
    setEditingPrices((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  };

  const updateEditingPrice = (productId: string, listId: string, value: string) => {
    setEditingPrices((current) => ({ ...current, [productId]: { ...current[productId], [listId]: value } }));
  };

  const saveProductPrices = async (productId: string) => {
    if (!canEditPriceList) return;
    const values = editingPrices[productId] || {};
    const byList = itemsByProduct.get(productId);
    const currency = displayCurrency;
    const rate = currency === baseCurrency ? 1 : Number(exchangeRate || 1);
    const invalidList = visibleLists.find((list) => {
      const rawValue = String(values[list.id] ?? '').trim();
      return rawValue !== '' && (!Number.isFinite(Number(rawValue)) || Number(rawValue) < 0);
    });
    if (invalidList) return toast.error(`El precio de ${invalidList.name} debe ser mayor o igual a cero`);
    const changes = visibleLists.map((list) => {
      const rawValue = String(values[list.id] ?? '').trim();
      if (!rawValue) return null;
      const price = Number(rawValue);
      const existing = byList?.get(list.id);
      const previous = existing ? convertBaseToDisplay(Number(existing.basePrice)) : null;
      if (previous !== null && Math.abs(previous - price) < 0.000001 && existing?.currency === currency && Number(existing.exchangeRate) === rate) return null;
      return { list, price };
    }).filter(Boolean) as Array<{ list: typeof visibleLists[number]; price: number }>;
    if (!changes.length) return cancelEditProduct(productId);
    setSaving(productId);
    try {
      const updatedItems = await Promise.all(changes.map(({ list, price }) => priceListsService.updateItem(list.id, productId, { price, currency, exchangeRate: rate })));
      queryClient.setQueryData(['sales', 'price-lists', 'matrix', tenantKey], (current: any) => {
        if (!current) return current;
        const nextItems = current.items.map((item: PriceListItem) => {
          const index = changes.findIndex(({ list }) => list.id === item.priceListId && item.productId === productId);
          if (index < 0) return item;
          const updated: any = updatedItems[index];
          const price = Number(updated?.price ?? changes[index].price);
          const basePrice = Number(updated?.basePrice ?? (currency === baseCurrency ? price : currency === 'USD' ? price * rate : price / rate));
          return { ...item, ...updated, price, currency, exchangeRate: rate, basePrice };
        });
        const nextProducts = current.products?.map((product: any) => {
          const retailChange = changes.find(({ list }) => list.code === 'RETAIL');
          if (!retailChange || product.id !== productId) return product;
          const retailIndex = changes.findIndex(({ list }) => list.code === 'RETAIL');
          const updated: any = updatedItems[retailIndex];
          return { ...product, salePrice: Number(updated?.basePrice ?? (currency === baseCurrency ? retailChange.price : currency === 'USD' ? retailChange.price * rate : retailChange.price / rate)) };
        });
        return { ...current, items: nextItems, products: nextProducts };
      });
      cancelEditProduct(productId);
      toast.success(`${changes.length} precio(s) guardado(s)`);
    } catch (error: any) { toast.error(error.message || 'No se pudieron guardar los precios'); }
    finally { setSaving(null); }
  };

  const openDownload = (productIds: string[]) => {
    if (!canExportPriceLists) return;
    if (!productIds.length) return toast.error('Selecciona al menos un producto');
    if (!importLists.length) return toast.error('Selecciona al menos una lista visible');
    setDownloadScopeIds(productIds);
    setDownloadOpen(true);
  };

  const downloadTemplate = (productIds: string[]) => {
    if (!canExportPriceLists) return;
    const selectedProducts = catalogProducts.filter((product) => productIds.includes(product.id));
    const headers = ['Código', 'Producto', 'Costo (solo referencia)', ...importLists.map((list) => list.name)];
    const rows = selectedProducts.map((product) => {
      const byList = itemsByProduct.get(product.id);
      return [product.code, product.name, Number(product.costPrice ?? product.details?.costPrice ?? 0), ...importLists.map((list) => byList?.get(list.id)?.price ?? '')];
    });
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet['!cols'] = [{ wch: 18 }, { wch: 34 }, { wch: 22 }, ...importLists.map(() => ({ wch: 20 }))];
    const guide = XLSX.utils.aoa_to_sheet([
      ['GUÍA DE LLENADO · ACTUALIZACIÓN DE PRECIOS'],
      ['1. No cambies los encabezados Código ni los nombres de las listas.'],
      ['2. El costo es informativo y no se actualizará al importar.'],
      ['3. Los precios existentes se incluyen como referencia. Si mantienes el mismo valor, no se hará ningún cambio.'],
      ['4. Ingresa únicamente los precios de las listas que deseas actualizar. Las celdas vacías no modifican el precio existente.'],
      ['5. La moneda y la tasa se eligen en la ventana de carga. Guarda el archivo como .xlsx y cárgalo desde Listas de Precios.'],
      ['Listas incluidas:', ...importLists.map((list) => list.name)],
    ]);
    guide['!cols'] = [{ wch: 72 }, ...importLists.map(() => ({ wch: 24 }))];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Precios');
    XLSX.utils.book_append_sheet(workbook, guide, 'Guía de llenado');
    XLSX.writeFile(workbook, `plantilla_precios_${selectedProducts.length}_productos.xlsx`);
    toast.success('Plantilla descargada');
    setDownloadOpen(false);
  };

  const openImport = (ids: string[] = []) => {
    if (!canImportPriceLists) return;
    if (!importLists.length) return toast.error('Selecciona al menos una lista visible');
    const scope = ids.length ? ids : catalogProducts.map((product) => product.id);
    if (!scope.length) return toast.error('No hay productos disponibles para actualizar');
    setImportScopeIds(scope); setImportRows([]); setImportFile(''); setImportOpen(true);
  };

  const validateImportRow = (row: ImportRow) => {
    const product = productByCode.get(normalize(row.code));
    const values = importLists.map((list) => row.prices[list.code]).filter((value) => value !== '' && value !== undefined);
    if (!row.code) return 'Código requerido';
    if (!product) return 'Código no encontrado';
    if (!values.length) return 'Ingresa al menos un precio';
    if (values.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) return 'Precio inválido';
    return undefined;
  };

  const readFile = (file: File) => {
    if (!canImportPriceLists) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(new Uint8Array(event.target?.result as ArrayBuffer), { type: 'array' });
        const raw = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[workbook.SheetNames.find((name) => normalize(name) === 'precios') || workbook.SheetNames[0]], { header: 1 });
        const headers = (raw[0] || []).map((header: any) => normalize(header));
        const skuIndex = headers.findIndex((header: string) => ['sku', 'codigo', 'codigo / sku', 'code'].includes(header));
        if (skuIndex < 0) throw new Error('La plantilla necesita la columna Código');
        const costIndex = headers.findIndex((header: string) => header.includes('costo'));
        const listIndexes = importLists.map((list) => ({ list, index: headers.findIndex((header: string) => header.includes(normalize(list.code)) || header.includes(normalize(list.name))) })).filter((entry) => entry.index >= 0);
        if (!listIndexes.length) throw new Error('No se encontró ninguna columna de lista de precios visible');
        const rows = raw.slice(1).filter((row: any[]) => row.some((cell) => String(cell ?? '').trim())).map((row: any[]) => {
          const prices: Record<string, number | ''> = {};
          listIndexes.forEach(({ list, index }) => { prices[list.code] = row[index] === '' || row[index] === undefined ? '' : Number(row[index]); });
          const code = String(row[skuIndex] || '').trim();
          const product = productByCode.get(normalize(code));
          const next: ImportRow = { code, name: product?.name || '', cost: costIndex >= 0 && row[costIndex] !== '' && row[costIndex] !== undefined ? Number(row[costIndex]) : Number(product?.costPrice ?? product?.details?.costPrice ?? 0), prices };
          next.error = validateImportRow(next);
          return next;
        });
        setImportRows(rows); setImportFile(file.name); toast.success(`${rows.length} filas encontradas`);
      } catch (error: any) { toast.error(error.message || 'No se pudo leer el archivo'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const updateImportRow = (index: number, field: string, value: string) => {
    setImportRows((current) => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const next = { ...row, prices: { ...row.prices } };
      if (field === 'code') next.code = value;
      else if (!field.startsWith('cost')) next.prices[field] = value === '' ? '' : Number(value);
      next.name = productByCode.get(normalize(next.code))?.name || next.name;
      next.error = validateImportRow(next);
      return next;
    }));
  };

  const executeImport = async () => {
    if (!canImportPriceLists) return;
    if (importRows.some((row) => row.error) || !importRows.length) return;
    setImporting(true);
    setImportProgress(8);
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    try {
      progressTimer = setInterval(() => setImportProgress((current) => Math.min(current + 2, 92)), 180);
      const result = await priceListsService.importMatrix({
        currency: importCurrency,
        exchangeRate: importCurrency === baseCurrency ? 1 : importRate,
        listCodes: importLists.map((list) => list.code),
        rows: importRows.map((row) => ({ code: row.code, prices: row.prices })),
        confirmText: 'ACTUALIZAR',
      });
      if (progressTimer) clearInterval(progressTimer);
      setImportProgress(100);
      setImportResult({ updated: result.updated || 0, unchanged: result.unchanged || 0, errors: result.errors || [] });
      await refreshMatrix();
    } catch (error: any) {
      toast.error(error.message || 'No se pudieron actualizar los precios');
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      setImporting(false);
      setImportProgress(0);
    }
  };

  const finishImport = () => {
    setImportResult(null);
    setImportPreviewOpen(false);
    setImportRows([]);
    setImportFile('');
  };

  if (importPreviewOpen) {
    return <PriceImportPreviewPage
      rows={importRows}
      fileName={importFile}
      lists={importLists}
      currency={importCurrency}
      rate={importRate}
      baseCurrency={baseCurrency}
      isSidebarCollapsed={isSidebarCollapsed}
      importing={importing}
      progress={importProgress}
      result={importResult}
      onRowUpdate={updateImportRow}
      onBack={() => { setImportPreviewOpen(false); setImportOpen(true); }}
      onConfirm={executeImport}
      onDone={finishImport}
    />;
  }

  const createList = async () => {
    if (!canCreatePriceList) return;
    if (!newListName.trim()) return;
    try {
      await priceListsService.create({ name: newListName });
      setNewListOpen(false); setNewListName(''); await refreshMatrix(); toast.success('Lista de precios creada');
    } catch (error: any) { toast.error(error.message || 'No se pudo crear la lista'); }
  };

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-2xl font-black tracking-tight" data-tour="price-lists-title">Listas de Precios</h2><p className="text-sm text-muted-foreground">Configura las tarifas visibles y actualiza varias listas en una sola plantilla.</p></div>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" className="rounded-xl" onClick={() => setShowTutorial(true)}><CircleHelp className="mr-2 size-4" /> Tutorial</Button>{canCreatePriceList && <Button variant="outline" className="rounded-xl" onClick={() => setNewListOpen(true)} data-tour="price-lists-new"><Plus className="mr-2 size-4" /> Nueva lista</Button>}{canExportPriceLists && <Button variant="outline" className="rounded-xl" onClick={() => openDownload([...selectedProductIds])} disabled={!selectedCount} data-tour="price-lists-template"><Download className="mr-2 size-4" /> Plantilla ({selectedCount})</Button>}{canImportPriceLists && <Button className="rounded-xl" onClick={() => openImport([...selectedProductIds])} disabled={!catalogProducts.length || !importLists.length} data-tour="price-lists-import"><Upload className="mr-2 size-4" /> Importar precios</Button>}</div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Productos</p><p className="mt-2 text-3xl font-black">{catalogProducts.length}</p><p className="text-xs text-muted-foreground">en el catálogo de venta</p></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Listas visibles</p><p className="mt-2 text-3xl font-black">{visibleLists.length}</p><p className="text-xs text-muted-foreground">de {lists.length} configuradas</p></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Precios cargados</p><p className="mt-2 text-3xl font-black">{Math.max(0, catalogProducts.length * lists.length - missingPriceCount)}</p><p className="text-xs text-muted-foreground">en todas las listas activas</p></CardContent></Card>
      <button type="button" onClick={() => setMissingOpen(true)} className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-left transition hover:bg-amber-500/10"><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Productos con precios faltantes</p><p className="mt-2 text-3xl font-black text-amber-700">{missingProducts.length}</p><p className="text-xs text-muted-foreground">{missingPriceCount} celdas pendientes · Ver y actualizar</p></button>
    </div>

    <div className="flex flex-wrap justify-end gap-2"><div className="flex items-center gap-2 rounded-xl border px-3 py-1.5" data-tour="price-lists-currency"><span className="text-xs font-bold text-muted-foreground">Moneda</span><Select value={displayCurrency} onValueChange={(value: 'NIO' | 'USD') => setDisplayCurrency(value)}><SelectTrigger className="h-8 w-28 border-0 px-2 shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NIO">Córdobas</SelectItem><SelectItem value="USD">Dólares</SelectItem></SelectContent></Select><span className="text-[10px] text-muted-foreground">Tasa {Number(exchangeRate || 1).toFixed(4)}</span></div><div className="flex items-center gap-2 rounded-xl border px-3 py-1.5" data-tour="price-lists-pagination"><span className="text-xs font-bold text-muted-foreground">Paginación</span><Select value={paginationEnabled ? 'on' : 'off'} onValueChange={(value) => { setPaginationEnabled(value === 'on'); setPage(1); }}><SelectTrigger className="h-8 w-28 border-0 px-2 shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="off">Desactivada</SelectItem><SelectItem value="on">Activada</SelectItem></SelectContent></Select>{paginationEnabled && <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}><SelectTrigger className="h-8 w-20 border-0 px-2 shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="25">25</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select>}</div><Button variant="outline" className="rounded-xl" onClick={() => setColumnConfigOpen(true)} data-tour="price-lists-columns"><Settings2 className="mr-2 size-4" /> Configurar columnas <Badge variant="secondary" className="ml-2">{visibleLists.length}</Badge></Button></div>
    <Dialog open={columnConfigOpen} onOpenChange={setColumnConfigOpen}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><Settings2 className="size-5 text-primary" /> Configurar columnas</DialogTitle><DialogDescription>Elige qué listas se muestran en la tabla y cuáles aparecerán en la plantilla.</DialogDescription></DialogHeader><div className="flex flex-wrap gap-2">{lists.map((list) => { const active = visibleListIds.includes(list.id); return <button key={list.id} type="button" onClick={() => setVisibleListIds((current) => active ? current.filter((id) => id !== list.id) : [...current, list.id])} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${active ? 'border-primary bg-primary/10' : 'border-border bg-muted/20 opacity-60'}`}><span className={`flex size-5 items-center justify-center rounded border ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>{active && <CheckCircle2 className="size-3.5" />}</span><span><b>{list.name}</b></span></button>; })}</div><DialogFooter><Button variant="outline" onClick={() => setVisibleListIds(lists.map((list) => list.id))}>Mostrar todas</Button><Button onClick={() => setColumnConfigOpen(false)}>Aplicar</Button></DialogFooter></DialogContent></Dialog>

    <Card className="rounded-2xl" data-tour="price-lists-matrix"><CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle>Matriz de precios</CardTitle><p className="mt-1 text-xs text-muted-foreground">Selecciona productos para descargar una plantilla. Para importar, el sistema identifica los productos por el SKU del archivo. El costo permanece en Inventario.</p></div><Badge variant="outline">{selectedCount} seleccionados</Badge></CardHeader><CardContent><div className="overflow-x-auto rounded-xl border"><Table className="min-w-[980px]"><TableHeader><TableRow><TableHead className="w-10"><button type="button" onClick={() => toggleAll(displayedProductIds)} className="flex size-7 items-center justify-center rounded-md hover:bg-muted/60">{allDisplayedSelected ? <SquareCheckBig className="size-4 text-primary" /> : <Square className="size-4 text-muted-foreground" />}</button></TableHead><TableHead>Código</TableHead><TableHead>Producto</TableHead><TableHead>Categoría</TableHead>{visibleLists.map((list) => <TableHead key={list.id} className="min-w-36 text-right">{list.name}</TableHead>)}<TableHead className="w-24 text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={5 + visibleLists.length} className="py-10 text-center text-muted-foreground">Cargando matriz…</TableCell></TableRow> : displayedProducts.map((product) => { const byList = itemsByProduct.get(product.id); const isEditing = editingProductIds.has(product.id); return <TableRow key={product.id}><TableCell><button type="button" onClick={() => toggleProduct(product.id)}>{selectedProductIds.has(product.id) ? <SquareCheckBig className="size-4 text-primary" /> : <Square className="size-4 text-muted-foreground" />}</button></TableCell><TableCell className="font-mono text-xs">{product.code}</TableCell><TableCell className="font-medium">{product.name}</TableCell><TableCell className="text-xs text-muted-foreground">{product.category?.name || '-'}</TableCell>{visibleLists.map((list) => { const item = byList?.get(list.id); return <TableCell key={list.id} className="text-right">{isEditing ? <Input className="ml-auto h-8 w-32 text-right" type="number" min="0" value={editingPrices[product.id]?.[list.id] ?? ''} onChange={(event) => updateEditingPrice(product.id, list.id, event.target.value)} disabled={saving === product.id} /> : <div className={`ml-auto flex min-h-8 w-32 items-center justify-end px-2 py-1.5 text-right text-sm font-semibold tabular-nums ${!item ? 'rounded-md bg-amber-500/10 font-medium italic text-amber-700' : 'text-foreground'}`}>{item ? formatDisplayPrice(Number(item.basePrice)) : 'Sin precio'}</div>}<span className="mt-1 block text-[10px] text-muted-foreground">{item ? currencyLabel(displayCurrency) : 'Pendiente'}</span></TableCell>; })}<TableCell className="text-right">{isEditing ? <div className="flex items-center justify-end gap-1"><Button variant="ghost" size="icon" className="size-7 text-emerald-600" onClick={() => saveProductPrices(product.id)} disabled={saving === product.id}><Check className="size-4" /></Button><Button variant="ghost" size="icon" className="size-7 text-red-600" onClick={() => cancelEditProduct(product.id)} disabled={saving === product.id}><X className="size-4" /></Button></div> : canEditPriceList && <Button variant="ghost" size="icon" className="size-7" title="Editar precios" aria-label={`Editar precios de ${product.name}`} onClick={() => beginEditProduct(product.id)}><Pencil className="size-4" /></Button>}</TableCell></TableRow>; })}</TableBody></Table></div>{paginationEnabled && <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>Mostrando {displayedProducts.length} de {catalogProducts.length} productos</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" className="h-8" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}><ChevronLeft className="size-4" /></Button><span>Página {page} de {totalPages}</span><Button variant="outline" size="sm" className="h-8" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}><ChevronRight className="size-4" /></Button></div></div>}{!catalogProducts.length && <p className="py-8 text-center text-sm text-muted-foreground">No hay productos disponibles.</p>}{!visibleLists.length && <p className="py-8 text-center text-sm text-muted-foreground">Selecciona al menos una lista para mostrar columnas.</p>}</CardContent></Card>

    <Dialog open={missingOpen} onOpenChange={setMissingOpen}><DialogContent className="max-w-5xl max-h-[90vh] flex flex-col"><DialogHeader><DialogTitle>Productos con precios faltantes</DialogTitle><DialogDescription>Selecciona los productos y descarga una plantilla con las listas visibles pendientes. Las celdas vacías no modifican precios existentes.</DialogDescription></DialogHeader><div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="outline">{missingSelectedIds.size} seleccionados</Badge><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => openDownload([...missingSelectedIds])} disabled={!missingSelectedIds.size}><Download className="mr-2 size-4" /> Descargar plantilla</Button><Button size="sm" onClick={() => { setMissingOpen(false); openImport([...missingSelectedIds]); }} disabled={!missingSelectedIds.size}><Upload className="mr-2 size-4" /> Importar plantilla</Button></div></div><div className="min-h-0 flex-1 overflow-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead className="w-10"><button type="button" onClick={() => toggleAll(missingProducts.map((product) => product.id), 'missing')}>{missingSelectedIds.size === missingProducts.length && missingProducts.length > 0 ? <SquareCheckBig className="size-4 text-primary" /> : <Square className="size-4 text-muted-foreground" />}</button></TableHead><TableHead>Código</TableHead><TableHead>Producto</TableHead><TableHead>Listas pendientes</TableHead></TableRow></TableHeader><TableBody>{missingProducts.map((product) => { const byList = itemsByProduct.get(product.id); return <TableRow key={product.id}><TableCell><button type="button" onClick={() => toggleProduct(product.id, 'missing')}>{missingSelectedIds.has(product.id) ? <SquareCheckBig className="size-4 text-primary" /> : <Square className="size-4 text-muted-foreground" />}</button></TableCell><TableCell className="font-mono text-xs">{product.code}</TableCell><TableCell className="font-medium">{product.name}</TableCell><TableCell className="flex flex-wrap gap-1">{lists.filter((list) => !byList?.has(list.id)).map((list) => <Badge key={list.id} variant="outline" className="text-[10px]">{list.name}</Badge>)}</TableCell></TableRow>; })}</TableBody></Table>{!missingProducts.length && <p className="p-8 text-center text-sm text-muted-foreground">Todos los productos tienen precios en las listas activas.</p>}</div><DialogFooter><Button variant="outline" onClick={() => setMissingOpen(false)}>Cerrar</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={downloadOpen} onOpenChange={setDownloadOpen}><DialogContent><DialogHeader><DialogTitle>Preparar plantilla de precios</DialogTitle><DialogDescription>Revisa el contenido antes de descargar el archivo.</DialogDescription></DialogHeader><div className="space-y-3 rounded-xl border bg-muted/20 p-4 text-sm"><div className="flex justify-between"><span>Productos seleccionados</span><b>{downloadScopeIds.length}</b></div><div className="flex justify-between"><span>Listas incluidas</span><b>{importLists.length}</b></div><div className="flex justify-between"><span>Precios existentes incluidos</span><b>{catalogProducts.filter((product) => downloadScopeIds.includes(product.id)).reduce((total, product) => total + importLists.filter((list) => itemsByProduct.get(product.id)?.has(list.id)).length, 0)}</b></div><div className="flex justify-between"><span>Costo de referencia</span><b>Incluido</b></div></div><div className="space-y-2 text-xs text-muted-foreground"><p>• La plantilla incluirá el código, nombre, costo informativo y una columna por cada lista visible.</p><p>• Los precios existentes se descargarán para usarlos como referencia.</p><p>• El costo no se modifica al importar. Si un precio permanece igual, el sistema no hará ningún cambio.</p></div><DialogFooter><Button variant="outline" onClick={() => setDownloadOpen(false)}>Cancelar</Button><Button onClick={() => downloadTemplate(downloadScopeIds)}><Download className="mr-2 size-4" /> Descargar plantilla</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={importOpen} onOpenChange={(open) => { if (!open && !importing) { setImportRows([]); setImportFile(''); } setImportOpen(open); }}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Actualizar precios en varias listas</DialogTitle><DialogDescription>Carga el archivo y luego abre la previsualización completa para editarlo antes de confirmar.</DialogDescription></DialogHeader>
        <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border bg-muted/20 p-3"><span className="text-xs font-bold uppercase">Moneda</span><Select value={importCurrency} onValueChange={setImportCurrency}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NIO">Córdoba</SelectItem><SelectItem value="USD">Dólares</SelectItem></SelectContent></Select><span className="text-xs font-bold uppercase">Tasa</span><Input className="h-9 w-28" type="number" min="0.0001" step="any" value={importRate} onChange={(event) => setImportRate(Number(event.target.value) || 1)} disabled={importCurrency === baseCurrency} /><div className="flex w-full min-w-0 flex-wrap gap-1 sm:ml-auto sm:w-auto sm:justify-end">{importLists.map((list) => <Badge key={list.id} variant="secondary" className="max-w-full">{list.name}</Badge>)}</div></div>
        {!importFile ? <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center sm:p-12"><FileSpreadsheet className="size-12 text-primary" /><p className="font-bold">Carga el archivo Excel de precios</p><p className="text-xs text-muted-foreground">La tabla editable aparecerá en una vista completa después de cargarlo.</p><Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-2 size-4" />Seleccionar archivo</Button><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} /></div> : <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5"><CheckCircle2 className="size-8 shrink-0 text-emerald-500" /><div className="min-w-0 flex-1"><p className="font-bold">Archivo listo para previsualizar</p><p className="break-words text-sm text-muted-foreground">{importFile} · {importRows.length} filas detectadas</p></div><Button variant="ghost" size="sm" className="shrink-0" onClick={() => { setImportFile(''); setImportRows([]); }}>Cambiar</Button></div>}
        <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground"><p className="font-bold text-foreground">Listas incluidas</p><p className="mt-1 break-words">{importLists.map((list) => list.name).join(' · ')}</p><p className="mt-2 break-words">El costo se conserva como referencia. Las celdas vacías no modifican precios existentes.</p></div>
        <DialogFooter className="flex-wrap"><Button variant="outline" onClick={() => setImportOpen(false)}>Cerrar</Button>{importFile && <Button onClick={() => { setImportOpen(false); setImportPreviewOpen(true); }}>Previsualizar actualización</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={newListOpen} onOpenChange={setNewListOpen}><DialogContent><DialogHeader><DialogTitle>Nueva lista de precios</DialogTitle><DialogDescription>Agrega una tarifa adicional para mostrarla como nueva columna en la matriz. El sistema asignará automáticamente su identificador.</DialogDescription></DialogHeader><Input placeholder="Nombre (ej. Promocional)" value={newListName} onChange={(event) => setNewListName(event.target.value)} autoFocus /><DialogFooter><Button variant="outline" onClick={() => setNewListOpen(false)}>Cancelar</Button><Button onClick={createList} disabled={!newListName.trim()}>Crear lista</Button></DialogFooter></DialogContent></Dialog>
    {showTutorial && <GuidedTour steps={PRICE_LISTS_TOUR_STEPS} onClose={() => setShowTutorial(false)} title="Listas de precios" allowTargetInteraction />}
  </div>;
}
