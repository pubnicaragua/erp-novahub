'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Package,
  Warehouse,
  History,
  Hash,
  TrendingDown,
  AlertCircle,
  Info,
  Layers,
  Barcode,
  Truck,
  Calendar,
  DollarSign,
  Tag,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Activity,
  ChevronRight,
  User as UserIcon,
  Check,
  Pencil,
  Loader2,
} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Progress } from '../ui/progress';

import { Separator } from '../ui/separator';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { inventoryService } from '../../services/inventario.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { ProductThumbnail } from '../ui/ProductImage';
import { toast } from 'sonner';
import { InventoryViewTutorial } from './InventoryViewTutorial';
import { useAuth } from '../../contexts/AuthContext';
import { AuditHistoryModal } from '../ui/AuditHistoryModal';

// ============================================================================
// Tipos del componente
// ============================================================================

interface ProductDetailDrawerProps {
  /** ID del producto a mostrar. Si es null el drawer no se renderiza. */
  productId: string | null;
  /** Callback cuando el drawer se abre/cierra. */
  onOpenChange: (open: boolean) => void;
  /** Snapshot ligero del producto desde la lista (para mostrar de inmediato). */
  productSnapshot?: any;
  /** Lista de bodegas globales (usada como fallback para nombres). */
  warehouses?: any[];
  /** Movimientos globales (fallback para kardex si el endpoint no los trae). */
  movements?: any[];
  /** Series/IMEI globales (fallback para tab series). */
  series?: any[];
}

type TabKey = 'general' | 'stock' | 'kardex' | 'series' | 'historial';

// ============================================================================
// Helpers
// ============================================================================

const MOVEMENT_REFERENCE_LABELS: Record<string, string> = {
  PURCHASE_RECEIPT: 'Recepción de compra',
  SALE: 'Venta',
  SALE_RETURN: 'Devolución de venta',
  INVENTORY_ADJUSTMENT: 'Ajuste de inventario',
  TRANSFER: 'Transferencia',
  PURCHASE: 'Compra',
  STOCK_INITIAL: 'Stock inicial',
  SALES_ORDER: 'Orden de venta',
  SUPPLIER_INVOICE: 'Factura de compra',
};

function formatKardexReference(reference: string | null | undefined): { label: string; full: string } {
  const raw = String(reference || '').trim();
  if (!raw) return { label: '—', full: '' };

  const parts = raw.split(':');
  if (parts.length > 1) {
    const type = parts[0].toUpperCase();
    const label = MOVEMENT_REFERENCE_LABELS[type] || type;
    const shortId = parts[1]?.slice(0, 8);
    return { label: shortId ? `${label} · ${shortId}` : label, full: raw };
  }

  return { label: raw, full: raw };
}

/**
 * Devuelve el color semántico para un tipo de movimiento.
 */
const getMovementBadge = (type: string) => {
  const t = String(type || '').toUpperCase();
  switch (t) {
    case 'IN':
    case 'ENTRADA':
      return {
        label: 'Entrada',
        color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        icon: ArrowDownToLine,
      };
    case 'OUT':
    case 'SALIDA':
      return {
        label: 'Salida',
        color: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
        icon: ArrowUpFromLine,
      };
    case 'ADJUST':
    case 'ADJUSTMENT':
    case 'AJUSTE':
      return {
        label: 'Ajuste',
        color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        icon: Activity,
      };
    case 'TRANSFER':
    case 'TRANSFERENCIA':
      return {
        label: 'Transferencia',
        color: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
        icon: ArrowLeftRight,
      };
    default:
      return {
        label: t || '—',
        color: 'bg-muted text-muted-foreground border-border',
        icon: ArrowLeftRight,
      };
  }
};

/**
 * Devuelve el badge para el estado de una serie/IMEI.
 */
const getSeriesBadge = (status: string) => {
  const s = String(status || 'AVAILABLE').toUpperCase();
  switch (s) {
    case 'AVAILABLE':
    case 'DISPONIBLE':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'SOLD':
    case 'VENDIDO':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'RESERVED':
    case 'RESERVADO':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'DAMAGED':
    case 'DAÑADO':
      return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
    case 'IN_TRANSIT':
    case 'EN_TRANSITO':
      return 'bg-sky-500/10 text-sky-600 border-sky-500/20';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

/**
 * Traduce el estado del producto (EntityStatus) a español.
 */
const getStatusBadge = (status: string) => {
  const s = String(status || '').toUpperCase();
  switch (s) {
    case 'ACTIVE':
    case 'ACTIVO':
      return { label: 'Activo', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
    case 'INACTIVE':
    case 'INACTIVO':
      return { label: 'Inactivo', className: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20' };
    case 'DISCONTINUED':
    case 'DESCONTINUADO':
      return { label: 'Descontinuado', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' };
    default:
      return { label: status || '—', className: 'bg-muted text-muted-foreground border-border' };
  }
};

// ============================================================================
// Componente principal
// ============================================================================

export function ProductDetailDrawer({
  productId,
  onOpenChange,
  productSnapshot,
  warehouses = [],
  movements = [],
  series = [],
}: ProductDetailDrawerProps) {
  const { baseCurrency } = useCurrency();
  const { canPerform } = useAuth();
  const canViewInventoryCost = canPerform('INVENTORY_PRODUCTS', 'viewCost');
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kardexMovements, setKardexMovements] = useState<any[] | null>(null);
  const [expandedImageOpen, setExpandedImageOpen] = useState(false);
  const [levelDrafts, setLevelDrafts] = useState<Record<string, { minStock: string; maxStock: string }>>({});
  const [savingLevelId, setSavingLevelId] = useState<string | null>(null);
  const [catalogAttrs, setCatalogAttrs] = useState<any[]>([]);

  // Cargar catálogo de atributos para resolver nombres
  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();
    inventoryService.getAttributes(controller.signal)
      .then((res) => {
        const data = (res as any)?.data || res || [];
        setCatalogAttrs(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [productId]);

  // Sincroniza los borradores de min/max cuando cambia el detalle del producto
  useEffect(() => {
    const levels = Array.isArray(detail?.stockLevels) ? detail.stockLevels : [];
    const next: Record<string, { minStock: string; maxStock: string }> = {};
    levels.forEach((level: any) => {
      if (level.warehouseId) {
        next[String(level.warehouseId)] = {
          minStock: level.minStock != null ? String(level.minStock) : '0',
          maxStock: level.maxStock != null ? String(level.maxStock) : '0',
        };
      }
    });
    setLevelDrafts(next);
  }, [detail]);

  const saveLevelMinMax = async (item: { warehouseId: string; variantId?: string | null; quantity: number; readOnly?: boolean }) => {
    if (item.readOnly) return;
    const draft = levelDrafts[String(item.warehouseId)];
    if (!draft) return;
    const minStock = Math.max(0, Number(draft.minStock) || 0);
    const maxStock = Math.max(0, Number(draft.maxStock) || 0);
    if (maxStock > 0 && maxStock < minStock) {
      toast.error('El máximo no puede ser menor que el mínimo');
      return;
    }
    setSavingLevelId(String(item.warehouseId));
    try {
      await inventoryService.updateStockLevel({
        productId: String(detail?.id || productId),
        warehouseId: item.warehouseId,
        variantId: item.variantId || '',
        quantity: item.quantity,
        minStock,
        maxStock,
      });
      setDetail((prev: any) => ({
        ...prev,
        stockLevels: (prev?.stockLevels || []).map((level: any) =>
          level.warehouseId === item.warehouseId ? { ...level, minStock, maxStock } : level,
        ),
      }));
      toast.success('Mínimo y máximo actualizados');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudieron actualizar los niveles');
    } finally {
      setSavingLevelId(null);
    }
  };

  // ------------------------------------------------------------------
  // Fetch del detalle completo cuando se abre el drawer
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!productId) {
      setDetail(null);
      setKardexMovements(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Fetch del producto completo
        const resp: any = await inventoryService.getProduct(productId, controller.signal);
        const product = resp?.data?.data || resp?.data || resp;
        if (cancelled) return;
        // El producto de la tabla puede traer niveles de almacenes corporativos
        // autorizados para la sucursal. El endpoint de detalle consulta el
        // registro local y, por eso, no siempre devuelve esos niveles. Los
        // conservamos al combinar ambos resultados por ID de almacén.
        const detailLevels = Array.isArray(product?.stockLevels) ? product.stockLevels : [];
        const snapshotLevels = Array.isArray(productSnapshot?.stockLevels) ? productSnapshot.stockLevels : [];
        const detailWarehouseIds = new Set(
          detailLevels.map((level: any) => String(level?.warehouseId || level?.warehouse?.id || '')).filter(Boolean),
        );
        const sharedSnapshotLevels = snapshotLevels.filter((level: any) => {
          const warehouseId = String(level?.warehouseId || level?.warehouse?.id || '');
          return Boolean(level?.__sharedWarehouseLevel) && warehouseId && !detailWarehouseIds.has(warehouseId);
        });
        setDetail(sharedSnapshotLevels.length > 0
          ? { ...product, stockLevels: [...detailLevels, ...sharedSnapshotLevels], __sharedWarehouseLevelsMerged: true }
          : product);

        // Intentar traer movimientos frescos para el kardex
        try {
          const movResp: any = await inventoryService.getMovements({ productId, page: 1, pageSize: 200 }, controller.signal);
          const list = Array.isArray(movResp) ? movResp : movResp?.data?.data || movResp?.data || [];
          if (!cancelled) setKardexMovements(Array.isArray(list) ? list : []);
        } catch {
          // Si falla, dejamos que se use el fallback desde props
          if (!cancelled) setKardexMovements([]);
        }
      } catch (e: any) {
        if (!cancelled) {
          // El snapshot de la tabla sigue siendo suficiente para mostrar el detalle
          // cuando falla la consulta complementaria. No tapar la vista con un error.
          if (!productSnapshot) setError(e?.message || 'No se pudo cargar el producto');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [productId]);

  // ------------------------------------------------------------------
  // Resetear tab a 'general' cada vez que cambia el producto
  // ------------------------------------------------------------------
  useEffect(() => {
    setActiveTab('general');
  }, [productId]);

  // ------------------------------------------------------------------
  // Datos derivados
  // ------------------------------------------------------------------
  const product = detail ?? productSnapshot ?? null;
  const isOpen = Boolean(productId);

  const itemType = String(product?.itemType || 'PRODUCT').toUpperCase();
  const isService = itemType === 'SERVICE';

  const costPrice = Number(product?.costPrice ?? product?.cost ?? 0);
  const servicePrice = (() => {
    const sourceCurrency = String(product?.priceCurrency || baseCurrency).toUpperCase();
    const originalAmount = Number(product?.salePriceOriginal);
    return sourceCurrency !== baseCurrency && Number.isFinite(originalAmount) && originalAmount > 0
      ? { amount: originalAmount, sourceCurrency, sourceExchangeRate: Number(product?.priceExchangeRate || 1) }
      : { amount: Number(product?.salePrice || 0), sourceCurrency: baseCurrency, sourceExchangeRate: 1 };
  })();
  // El endpoint de detalle incluye stockLevels. Derivarlo aquí también evita
  // mostrar cero si se consume una versión anterior del backend sin `stock`.
  const stockFromLevels = Array.isArray(product?.stockLevels)
    ? product.stockLevels.reduce(
        (total: number, level: any) => total + Number(level?.quantity ?? 0),
        0,
      )
    : null;
  const totalStock = stockFromLevels ?? Number(product?.stock ?? 0);
  const stockValue = totalStock * costPrice;

  const statusInfo = getStatusBadge(product?.status);

  /**
   * Stock por bodega: prioriza stockLevels del detail, fallback sumando movements.
   */
  const stockByWarehouse = useMemo(() => {
    if (!product) return [] as Array<{ warehouseId: string; variantId?: string | null; warehouseName: string; quantity: number; minStock?: number; maxStock?: number }>;

    const stockLevels = Array.isArray(product.stockLevels) ? product.stockLevels : [];

    if (stockLevels.length > 0) {
      return stockLevels
        .map((level: any) => {
          const warehouseId = level.warehouseId || level.warehouse?.id;
          const warehouseName =
            level.warehouse?.name ||
            warehouses.find((w: any) => w.id === warehouseId)?.name ||
            'Sin bodega';
          return {
            warehouseId,
            variantId: level.variantId || null,
            warehouseName,
            quantity: Number(level.quantity || 0),
            minStock: level.minStock != null ? Number(level.minStock) : undefined,
            maxStock: level.maxStock != null ? Number(level.maxStock) : undefined,
            __sharedWarehouseLevel: Boolean(level.__sharedWarehouseLevel),
          };
        })
        .sort((a: { quantity: number }, b: { quantity: number }) => b.quantity - a.quantity);
    }

    // Fallback: calcular desde los movements globales
    const sourceMovements = (kardexMovements && kardexMovements.length > 0) ? kardexMovements : movements;
    const summary = new Map<string, number>();

    sourceMovements
      .filter((move: any) => {
        const pid = move.productId || move.product?.id;
        return pid === product.id;
      })
      .forEach((move: any) => {
        const warehouseId = move.warehouseId || move.warehouse?.id || 'unknown';
        const qty = Number(move.quantity || 0);
        const delta = String(move.type).toUpperCase() === 'OUT' ? -qty : qty;
        summary.set(warehouseId, Number(summary.get(warehouseId) || 0) + delta);
      });

    return Array.from(summary.entries())
      .map(([warehouseId, quantity]) => ({
        warehouseId,
        warehouseName:
          warehouses.find((w: any) => w.id === warehouseId)?.name ||
          'Sin bodega',
        quantity,
      }))
      .sort((a: { quantity: number }, b: { quantity: number }) => b.quantity - a.quantity);
  }, [product, warehouses, movements, kardexMovements]);

  const totalStockByWarehouse = useMemo(
    () =>
      stockByWarehouse.reduce(
        (acc: number, item: { quantity: number }) => acc + item.quantity,
        0,
      ),
    [stockByWarehouse],
  );

  const variantStockDistribution = useMemo(() => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    const stockLevels = Array.isArray(product?.stockLevels) ? product.stockLevels : [];

    return variants.map((variant: any) => {
      const variantLevels = stockLevels.filter((level: any) => String(level?.variantId || '') === String(variant.id));
      const levelQuantity = variantLevels.reduce((total: number, level: any) => total + Number(level?.quantity || 0), 0);
      const fallbackQuantity = Number(variant?.currentStock ?? variant?.stock ?? 0);
      const attributes = Array.isArray(variant?.attributes) ? variant.attributes : [];
      const label = attributes.length > 0
        ? attributes.map((attribute: any) => attribute?.value).filter(Boolean).join(' / ')
        : variant?.name || variant?.sku || 'Variante';

      return {
        id: String(variant.id),
        label,
        attributes,
        sku: variant?.sku || '',
        quantity: variantLevels.length > 0 ? levelQuantity : fallbackQuantity,
        // El costo propio de la variante reemplaza al costo base. Cuando no
        // existe, se muestra el costo heredado más el modificador legado.
        costPrice: variant?.costPrice === null || variant?.costPrice === undefined
          ? Math.max(0, costPrice + Number(variant?.costModifier || 0))
          : Number(variant.costPrice),
        inheritsCost: variant?.costPrice === null || variant?.costPrice === undefined,
      };
    });
  }, [product, costPrice]);

  const totalVariantStock = useMemo(
    () => variantStockDistribution.reduce((total, variant) => total + variant.quantity, 0),
    [variantStockDistribution],
  );

  /**
   * Kardex del producto: prioriza lo traído del endpoint, fallback a props globales.
   */
  const productMovements = useMemo(() => {
    if (!product) return [];
    const source = (kardexMovements && kardexMovements.length > 0) ? kardexMovements : movements;
    return source
      .filter((move: any) => {
        const pid = move.productId || move.product?.id;
        return pid === product.id;
      })
      .slice()
      .sort((a: any, b: any) => {
        const da = new Date(a.createdAt || a.date || 0).getTime();
        const db = new Date(b.createdAt || b.date || 0).getTime();
        return db - da;
      });
  }, [product, movements, kardexMovements]);

  /**
   * Series/IMEI del producto.
   */
  const productSeries = useMemo(() => {
    if (!product) return [];
    return series.filter(
      (item: any) =>
        item.productId === product.id || item.product?.id === product.id,
    );
  }, [product, series]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="erp-detail-panel flex w-full flex-col gap-0 overflow-hidden p-0"
      >
        {/* ===== Tabs envuelve header + contenido para que Radix comparta contexto ===== */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabKey)}
          className="flex flex-col flex-1 min-h-0 gap-0 overflow-hidden"
        >
          {/* ===== Header sticky ===== */}
          <SheetHeader className="sticky top-0 z-10 bg-background border-b px-6 py-4 space-y-2" data-tour="inventory-product-detail-title">
            <div className="flex items-start gap-3 pr-8">
              {product?.imageUrl ? (
                <button
                  type="button"
                  className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => setExpandedImageOpen(true)}
                  aria-label={`Ver imagen de ${product?.name || 'producto'}`}
                  title="Ver imagen"
                >
                  <ProductThumbnail
                    src={product.imageUrl}
                    alt={product?.name || 'Producto'}
                    size="lg"
                    className="ring-1 ring-primary/10"
                  />
                </button>
              ) : (
                <ProductThumbnail
                  src={undefined}
                  alt={product?.name || 'Producto'}
                  size="lg"
                  className="ring-1 ring-primary/10"
                 />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <SheetTitle className="min-w-0 whitespace-normal break-words text-base font-bold leading-tight [overflow-wrap:anywhere]">
                    {product?.name || 'Cargando…'}
                  </SheetTitle>
                  {product?.status && (
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-black uppercase tracking-wider border ${statusInfo.className}`}
                    >
                      {statusInfo.label}
                    </Badge>
                  )}
                  {product?.trackSerialNumbers && (
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider border-violet-500/30 text-violet-600 bg-violet-500/10">
                      IMEI
                    </Badge>
                  )}
                  {isService && (
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider border-violet-500/30 text-violet-600 bg-violet-500/10">
                      Servicio
                    </Badge>
                  )}
                </div>
                <SheetDescription className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-1 text-xs">
                  <span className="min-w-0 max-w-full break-words font-mono [overflow-wrap:anywhere]">{product?.code || product?.sku || '—'}</span>
                  {product?.category?.name && (
                    <>
                      <span className="text-border">·</span>
                      <span className="flex min-w-0 max-w-full items-start gap-1 break-words [overflow-wrap:anywhere]">
                        <Tag className="mt-0.5 size-3 shrink-0" />
                        {product.category.name}
                      </span>
                    </>
                  )}
                  {product?.updatedAt && (
                    <>
                      <span className="text-border">·</span>
                      <span className="flex min-w-0 max-w-full items-start gap-1 break-words [overflow-wrap:anywhere]">
                        <Calendar className="mt-0.5 size-3 shrink-0" />
                        {format(new Date(product.updatedAt), 'dd MMM yyyy', { locale: es })}
                      </span>
                    </>
                  )}
                  {loading && <span role="status" className="inline-flex items-center gap-1 font-bold text-primary"><Loader2 className="size-3 animate-spin" /> Cargando detalle…</span>}
                </SheetDescription>
              </div>
            </div>

            {/* ===== Tabs (Radix Root sigue siendo el mismo de arriba) ===== */}
            <TabsList className="w-full justify-start overflow-x-auto [&>button]:flex-none">
              <TabsTrigger value="general" className="gap-1.5">
                <Info className="size-3.5" />
                General
              </TabsTrigger>
              <TabsTrigger value="stock" className="gap-1.5">
                <Warehouse className="size-3.5" />
                Stock por bodega
              </TabsTrigger>
              <TabsTrigger value="kardex" className="gap-1.5">
                <History className="size-3.5" />
                Kardex
              </TabsTrigger>
              <TabsTrigger value="series" className="gap-1.5">
                <Hash className="size-3.5" />
                IMEI / Series
              </TabsTrigger>
              <TabsTrigger value="historial" className="gap-1.5">
                <Clock className="size-3.5" />
                Historial
              </TabsTrigger>
            </TabsList>
            <InventoryViewTutorial label={isService ? 'Cómo consultar servicio' : 'Cómo consultar producto'} targetPrefix="inventory-product-detail" stepKeys={['title', 'data']} copy={{ data: { description: isService ? 'Revisa la descripción, precio, disponibilidad y el historial del servicio. Los servicios no tienen stock ni distribución por bodega.' : 'Revisa información general, stock por bodega, kardex, series y movimientos históricos.' } }} />
          </SheetHeader>

        {/* ===== Contenido con scroll ===== */}
        <div className="flex-1 min-h-0 overflow-y-auto" data-tour="inventory-product-detail-data">
          <div className="px-6 py-4">
            {error && !product && (
              <Card className="p-4 border-rose-500/30 bg-rose-500/5 flex items-start gap-3">
                <AlertCircle className="size-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-rose-600">Error al cargar</p>
                  <p className="text-muted-foreground mt-1">{error}</p>
                </div>
              </Card>
            )}

            {loading && !detail && (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            )}

            {product && (
              <>
                {/* ============================ TAB: GENERAL ============================ */}
                <TabsContent value="general" className="mt-0 space-y-4">
                  {/* Grid de métricas principales */}
                  <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4">
                      {!isService && (
                      <MetricCard
                        label="Stock total"
                        value={totalStock.toString()}
                        icon={Package}
                        accent="text-primary"
                        loading={loading && !productSnapshot}
                      />
                      )}
                     <MetricCard
                      label="Categoría"
                      value={product?.category?.name || '—'}
                      icon={Tag}
                      accent="text-blue-500"
                      loading={false}
                    />
                    <MetricCard
                      label="Tipo"
                      value={isService ? 'Servicio' : 'Producto'}
                      icon={Layers}
                      accent={isService ? 'text-violet-500' : 'text-sky-500'}
                      loading={false}
                    />
                     {!isService && canViewInventoryCost && (
                      <MetricCard
                        label="Valor stock"
                        value={<CurrencyValuationAmount amount={stockValue} sourceCurrency={product?.priceCurrency || baseCurrency} sourceExchangeRate={product?.priceExchangeRate} className="text-base" />}
                        icon={DollarSign}
                        accent="text-emerald-500"
                        loading={loading && !productSnapshot}
                       />
                     )}
                    {isService ? (
                      <MetricCard
                        label="Precio"
                        value={<CurrencyValuationAmount {...servicePrice} className="text-base" />}
                        icon={DollarSign}
                        accent="text-emerald-500"
                        loading={loading && !productSnapshot}
                      />
                     ) : canViewInventoryCost ? (
                      <MetricCard
                        label="Precio costo"
                        value={<CurrencyValuationAmount amount={costPrice} sourceCurrency={product?.costCurrency || product?.priceCurrency || baseCurrency} sourceExchangeRate={product?.costExchangeRate || product?.priceExchangeRate} className="text-base" />}
                        icon={TrendingDown}
                        accent="text-rose-500"
                        loading={loading && !productSnapshot}
                      />
                     ) : null}
                     <MetricCard
                      label="Última act."
                      value={
                        product?.updatedAt
                          ? format(new Date(product.updatedAt), 'dd MMM yyyy', { locale: es })
                          : '—'
                      }
                      icon={Calendar}
                      accent="text-muted-foreground"
                      loading={false}
                    />
                  </div>

                  <Separator />

                  {/* Información adicional */}
                  <Card className="p-4 gap-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Información adicional
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <InfoField
                        label="Descripción"
                        value={product?.description || product?.descriptionHtml || 'Sin descripción'}
                        icon={Info}
                        muted={!product?.description && !product?.descriptionHtml}
                      />
                      <InfoField
                        label="Nota comercial"
                        value={product?.commercialNote || 'Sin nota comercial'}
                        icon={Info}
                        muted={!product?.commercialNote}
                      />
                      {!isService && canViewInventoryCost && (
                        <InfoField
                          label="Código de barras"
                          value={product?.barcode || product?.ean || '—'}
                          icon={Barcode}
                          mono
                        />
                      )}
                      <InfoField
                        label="SKU"
                        value={product?.sku || product?.code || '—'}
                        icon={Hash}
                        mono
                      />
                      {!isService && (
                        <InfoField
                          label="Unidad de medida"
                          value={product?.unit || 'Unidad'}
                          icon={Layers}
                        />
                      )}
                      {!isService && (
                        <InfoField
                          label="Proveedor preferido"
                          value={
                            product?.preferredSupplier?.name ||
                            product?.supplier?.name ||
                            product?.preferredSupplierName ||
                            '—'
                          }
                          icon={Truck}
                        />
                      )}
                      {!isService && (
                        <InfoField
                          label="Stock mínimo"
                          value={
                            product?.minStock != null
                              ? String(product.minStock)
                              : '—'
                          }
                          icon={AlertCircle}
                        />
                      )}
                    </div>
                  </Card>

                  {/* Atributos vinculados */}
                  {!isService && ((product?.linkedAttributes && Array.isArray(product.linkedAttributes) && product.linkedAttributes.length > 0) || (product?.attributes && Array.isArray(product.attributes) && product.attributes.length > 0)) && (
                    <Card className="border-border/50">
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Tag className="size-4 text-primary" />
                          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Atributos vinculados</p>
                        </div>
                        <div className="space-y-2">
                          {(() => {
                            const attrList = product.linkedAttributes || product.attributes || [];
                            return attrList.map((linked: any, idx: number) => {
                              const catalogAttr = catalogAttrs.find((a: any) => a.id === linked.attributeId);
                              const name = linked.name || catalogAttr?.name || 'Atributo';
                              const options = linked.selectedOptions || linked.options || [];
                              return (
                                <div key={idx} className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">{name}</p>
                                  {options.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {options.map((opt: string, i: number) => (
                                        <Badge key={i} variant="secondary" className="text-[9px]">
                                          {opt}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                        {variantStockDistribution.length > 0 && (
                          <div className="mt-4 border-t border-border/40 pt-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Stock por variante</p>
                                <p className="mt-1 text-[10px] text-muted-foreground">Así se distribuye el stock entre los atributos seleccionados.</p>
                              </div>
                              <Badge variant="outline" className="font-mono text-[10px]">
                                Total: {totalVariantStock} unidades
                              </Badge>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {variantStockDistribution.map((variant) => {
                                const percentage = totalVariantStock > 0
                                  ? Math.round((variant.quantity / totalVariantStock) * 100)
                                  : 0;
                                return (
                                  <div key={variant.id} className="rounded-lg border border-border/50 bg-background/70 p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="break-words text-xs font-bold leading-tight [overflow-wrap:anywhere]" title={variant.label}>{variant.label}</p>
                                        <p className="mt-1 break-words text-[10px] leading-snug text-muted-foreground [overflow-wrap:anywhere]" title={variant.attributes.map((attribute: any) => `${attribute?.attributeName || 'Atributo'}: ${attribute?.value || '—'}`).join(' · ')}>
                                          {variant.attributes.length > 0
                                            ? variant.attributes.map((attribute: any) => `${attribute?.attributeName || 'Atributo'}: ${attribute?.value || '—'}`).join(' · ')
                                            : variant.sku || 'Sin atributos'}
                                        </p>
                                        {variant.sku && <p className="mt-1 font-mono text-[9px] text-muted-foreground/80">SKU: {variant.sku}</p>}
                                      </div>
                                      <Badge variant={variant.quantity > 0 ? 'secondary' : 'outline'} className="shrink-0 font-mono text-[10px]">
                                        {variant.quantity} u.
                                      </Badge>
                                    </div>
                                    {canViewInventoryCost && (
                                      <div className="mt-2 flex min-w-0 items-center justify-between gap-2 border-t border-border/30 pt-2 text-[10px]">
                                        <span className="shrink-0 text-muted-foreground">
                                          Costo{variant.inheritsCost ? ' · base' : ' · propio'}
                                        </span>
                                        <CurrencyValuationAmount
                                          amount={variant.costPrice}
                                          sourceCurrency={baseCurrency}
                                          sourceExchangeRate={1}
                                          className="min-w-0 text-right text-xs font-semibold"
                                          showDifference={false}
                                        />
                                      </div>
                                    )}
                                    <div className="mt-2 flex items-center gap-2">
                                      <Progress value={percentage} className="h-1.5" />
                                      <span className="w-8 text-right text-[9px] font-bold tabular-nums text-muted-foreground">{percentage}%</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                </TabsContent>

                {/* ============================ TAB: STOCK ============================ */}
                <TabsContent value="stock" className="mt-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">Stock por bodega</p>
                      <p className="text-xs text-muted-foreground">
                        Distribución del inventario en todas las bodegas
                      </p>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      Total: {totalStockByWarehouse}
                    </Badge>
                  </div>

                  {isService ? (
                    <EmptyState
                      icon={Package}
                      title="Los servicios no manejan stock"
                      description="Este ítem es un servicio, no aplica distribución por bodega."
                    />
                  ) : stockByWarehouse.length === 0 ? (
                    <EmptyState
                      icon={Warehouse}
                      title="Sin stock distribuido"
                      description="Aún no hay registros de stock por bodega para este producto."
                    />
                  ) : (
                    <Card className="gap-0 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-[10px] uppercase tracking-widest">Bodega</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-widest text-right">Cantidad</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-widest">% del total</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-widest text-right">Mín / Máx</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-widest text-right"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stockByWarehouse.map((item: { warehouseId: string; variantId?: string | null; warehouseName: string; quantity: number; minStock?: number; maxStock?: number; __sharedWarehouseLevel?: boolean }) => {
                            const pct = totalStockByWarehouse > 0
                              ? Math.round((item.quantity / totalStockByWarehouse) * 100)
                              : 0;
                            const draft = levelDrafts[String(item.warehouseId)];
                            const isSavingLevel = savingLevelId === String(item.warehouseId);
                            const isReadOnlyLevel = Boolean(item.__sharedWarehouseLevel);
                            return (
                              <TableRow key={`${item.warehouseId}-${item.warehouseName}`}>
                                <TableCell>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Warehouse className="size-3.5 text-muted-foreground" />
                                    <span className="text-sm font-medium">{item.warehouseName}</span>
                                    {isReadOnlyLevel && <Badge variant="outline" className="text-[9px] text-sky-600">Corporativo</Badge>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className="font-mono font-bold tabular-nums">
                                    {item.quantity}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2 min-w-[120px]">
                                    <Progress value={pct} className="h-1.5" />
                                    <span className="text-[10px] font-bold tabular-nums w-8 text-right">
                                      {pct}%
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Input
                                      type="number"
                                      min={0}
                                      value={draft?.minStock ?? (item.minStock != null ? String(item.minStock) : '0')}
                                      onChange={(e) => setLevelDrafts((prev) => ({ ...prev, [String(item.warehouseId)]: { minStock: e.target.value, maxStock: draft?.maxStock ?? (item.maxStock != null ? String(item.maxStock) : '0') } }))}
                                      onKeyDown={(e) => { if (e.key === 'Enter') void saveLevelMinMax(item); }}
                                      aria-label={`Stock mínimo en ${item.warehouseName}`}
                                      title={isReadOnlyLevel ? 'Nivel corporativo de solo lectura' : 'Stock mínimo editable'}
                                      disabled={isReadOnlyLevel}
                                      className="h-8 w-16 min-w-0 text-right text-xs"
                                    />
                                    <span className="text-muted-foreground">/</span>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={draft?.maxStock ?? (item.maxStock != null ? String(item.maxStock) : '0')}
                                      onChange={(e) => setLevelDrafts((prev) => ({ ...prev, [String(item.warehouseId)]: { minStock: draft?.minStock ?? (item.minStock != null ? String(item.minStock) : '0'), maxStock: e.target.value } }))}
                                      onKeyDown={(e) => { if (e.key === 'Enter') void saveLevelMinMax(item); }}
                                      aria-label={`Stock máximo en ${item.warehouseName}`}
                                      title={isReadOnlyLevel ? 'Nivel corporativo de solo lectura' : 'Stock máximo editable'}
                                      disabled={isReadOnlyLevel}
                                      className="h-8 w-16 min-w-0 text-right text-xs"
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 rounded-lg text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                                    disabled={isSavingLevel || isReadOnlyLevel}
                                    title={isReadOnlyLevel ? 'Nivel corporativo de solo lectura' : 'Guardar mínimo y máximo de esta bodega'}
                                    aria-label={`Guardar niveles de ${item.warehouseName}`}
                                    onClick={() => void saveLevelMinMax(item)}
                                  >
                                    {isSavingLevel ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      <div className="border-t border-border/40 bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground">
                        El stock se administra mediante movimientos y ajustes. El mínimo y el máximo son configurables por bodega; los niveles corporativos se muestran como solo lectura.
                      </div>
                    </Card>
                  )}
                </TabsContent>

                {/* ============================ TAB: KARDEX ============================ */}
                <TabsContent value="kardex" className="mt-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">Kardex de movimientos</p>
                      <p className="text-xs text-muted-foreground">
                        Entradas, salidas, ajustes y transferencias del producto
                      </p>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {productMovements.length} movimientos
                    </Badge>
                  </div>

                  {productMovements.length === 0 ? (
                    <EmptyState
                      icon={History}
                      title="Sin movimientos registrados"
                      description="Aún no hay entradas, salidas o ajustes para este producto."
                    />
                  ) : (
                    <Card className="gap-0 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-[10px] uppercase tracking-widest">Fecha</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-widest">Tipo</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-widest text-right">Cantidad</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-widest text-right">Stock Ant.</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-widest text-right">Stock Res.</TableHead>
                             {canViewInventoryCost && <TableHead className="text-[10px] uppercase tracking-widest text-right">Costo Unit.</TableHead>}
                            <TableHead className="text-[10px] uppercase tracking-widest">Referencia</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-widest">Almacén</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-widest">Usuario</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productMovements.map((move: any, idx: number) => {
                            const meta = getMovementBadge(move.type);
                            const Icon = meta.icon;
                            const date = move.createdAt || move.date;
                            const reference = formatKardexReference(move.reference);
                            const warehouseName =
                              move.warehouse?.name ||
                              warehouses.find((w: any) => w.id === (move.warehouseId || move.warehouse?.id))?.name ||
                              '—';
                            const userName =
                              move.user?.name ||
                              move.user?.fullName ||
                              move.userName ||
                              move.createdBy?.name ||
                              '—';
                            return (
                              <TableRow key={move.id || `${date}-${idx}`}>
                                <TableCell className="text-xs tabular-nums whitespace-nowrap">
                                  {date ? format(new Date(date), 'dd MMM yyyy HH:mm', { locale: es }) : '—'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-wider border ${meta.color}`}>
                                    <Icon className="size-3" />
                                    {meta.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className={`font-mono font-bold tabular-nums ${String(move.type).toUpperCase() === 'OUT' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {String(move.type).toUpperCase() === 'OUT' ? '-' : '+'}
                                    {Number(move.quantity || 0)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                                  {move.previousQty != null ? Number(move.previousQty) : '—'}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums font-medium">
                                  {move.resultingQty != null ? Number(move.resultingQty) : '—'}
                                </TableCell>
                                 {canViewInventoryCost && <TableCell className="text-right text-xs">
                                  {move.unitCost !== undefined && move.unitCost !== null ? (
                                    <div className="flex flex-col">
                                      <CurrencyValuationAmount amount={Number(move.unitCost || 0)} sourceCurrency={move.currency || 'NIO'} sourceExchangeRate={move.exchangeRate} className="font-medium" />
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                 </TableCell>}
                                <TableCell className="max-w-[220px] whitespace-normal break-words text-xs font-mono text-muted-foreground [overflow-wrap:anywhere]" title={reference.full || undefined}>
                                  <span className="block break-words">{reference.label}</span>
                                </TableCell>
                                <TableCell className="text-xs">{warehouseName}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <UserIcon className="size-3" />
                                    {userName}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </Card>
                  )}
                </TabsContent>

                {/* ============================ TAB: SERIES ============================ */}
                <TabsContent value="series" className="mt-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">IMEI / Números de serie</p>
                      <p className="text-xs text-muted-foreground">
                        Series físicas asignadas a este producto
                      </p>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {productSeries.length} series
                    </Badge>
                  </div>

                  {productSeries.length === 0 ? (
                    <EmptyState
                      icon={Hash}
                      title="Sin series registradas"
                      description={
                        product?.trackSerialNumbers
                          ? 'Este producto rastrea series, pero aún no hay ninguna registrada.'
                          : 'Este producto no rastrea series. Activa la opción IMEI en su edición para llevar control por unidad.'
                      }
                    />
                  ) : (
                    <Card className="gap-0 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-[10px] uppercase tracking-widest">Serie / IMEI</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-widest">Estado</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-widest">Bodega</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productSeries.map((item: any, idx: number) => {
                            const warehouseName =
                              item.warehouse?.name ||
                              warehouses.find((w: any) => w.id === item.warehouseId)?.name ||
                              '—';
                            return (
                              <TableRow key={item.id || item.number || idx}>
                                <TableCell className="font-mono text-xs">{item.number || '—'}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-wider border ${getSeriesBadge(item.status)}`}>
                                    {item.status || 'AVAILABLE'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">{warehouseName}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </Card>
                  )}
                </TabsContent>

                {/* ============================ TAB: HISTORIAL ============================ */}
                <TabsContent value="historial" className="mt-0">
                  <Card className="p-4 gap-0">
                    <div className="flex items-start gap-3">
                      <div className="size-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Clock className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-bold">Historial de auditoría</p>
                        <p className="text-xs text-muted-foreground">
                          Creaciones, ediciones y cambios de estado registrados para este producto.
                        </p>
                      </div>
                    </div>
                    <AuditHistoryModal
                      isOpen={activeTab === 'historial'}
                      onClose={() => setActiveTab('general')}
                      entity="PRODUCT"
                      entityId={String(product.id || productId)}
                      title="Historial del producto"
                      presentation="inline"
                    />
                  </Card>
                </TabsContent>
              </>
            )}
          </div>
        </div>

        {/* ===== Footer sticky con acción ===== */}
        <div className="sticky bottom-0 z-10 bg-background border-t px-6 py-3 flex items-center justify-between gap-2" data-tour="inventory-product-detail-actions">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Detalle del producto
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="gap-1.5"
          >
            Cerrar
            <ChevronRight className="size-3" />
          </Button>
        </div>
        </Tabs>
        <Dialog open={expandedImageOpen} onOpenChange={setExpandedImageOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] !max-w-4xl border-0 bg-transparent p-2 shadow-none">
            <DialogTitle className="sr-only">Imagen del producto</DialogTitle>
            {product?.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.name || 'Producto'}
                className="max-h-[85vh] w-full rounded-2xl object-contain shadow-2xl"
              />
            )}
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// Sub-componentes auxiliares
// ============================================================================

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
  loading?: boolean;
}

function MetricCard({ label, value, icon: Icon, accent = 'text-foreground', loading }: MetricCardProps) {
  return (
    <Card className="min-w-0 overflow-hidden p-3 gap-1.5 transition-colors hover:border-primary/30">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="min-w-0 whitespace-normal break-words text-[10px] font-bold uppercase leading-tight tracking-widest text-muted-foreground [overflow-wrap:anywhere]">
          {label}
        </p>
        <Icon className={`size-3.5 shrink-0 ${accent}`} />
      </div>
      {loading ? (
        <Skeleton className="h-5 w-3/4 mt-1" />
      ) : (
        <div className={`min-w-0 whitespace-normal break-words text-base font-black leading-tight tabular-nums ${accent} [overflow-wrap:anywhere]`}>
          {value}
        </div>
      )}
    </Card>
  );
}

interface InfoFieldProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  mono?: boolean;
  muted?: boolean;
}

function InfoField({ label, value, icon: Icon, mono, muted }: InfoFieldProps) {
  return (
    <div className="min-w-0 space-y-1">
      <Label className="flex min-w-0 items-start gap-1.5 whitespace-normal break-words text-[10px] uppercase leading-tight tracking-widest text-muted-foreground [overflow-wrap:anywhere]">
        <Icon className="mt-0.5 size-3 shrink-0" />
        {label}
      </Label>
      <p
        className={`min-w-0 whitespace-normal break-words text-xs leading-snug [overflow-wrap:anywhere] ${mono ? 'font-mono' : 'font-medium'} ${muted ? 'text-muted-foreground italic' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <Card className="p-8 gap-2 flex flex-col items-center text-center">
      <div className="size-12 rounded-full bg-muted/30 flex items-center justify-center">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-bold mt-2">{title}</p>
      <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
    </Card>
  );
}

export default ProductDetailDrawer;
