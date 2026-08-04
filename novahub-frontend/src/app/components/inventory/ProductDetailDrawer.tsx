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
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
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
import { ProductThumbnail } from '../ui/ProductImage';

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
  const { formatAmount, currency, baseCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kardexMovements, setKardexMovements] = useState<any[] | null>(null);
  const [expandedImageOpen, setExpandedImageOpen] = useState(false);

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
        setDetail(product);

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
    if (!product) return [] as Array<{ warehouseId: string; warehouseName: string; quantity: number; minStock?: number; maxStock?: number }>;

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
            warehouseName,
            quantity: Number(level.quantity || 0),
            minStock: level.minStock != null ? Number(level.minStock) : undefined,
            maxStock: level.maxStock != null ? Number(level.maxStock) : undefined,
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
        className="w-full sm:max-w-3xl p-0 flex flex-col gap-0"
      >
        {/* ===== Tabs envuelve header + contenido para que Radix comparta contexto ===== */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabKey)}
          className="flex flex-col flex-1 min-h-0 gap-0"
        >
          {/* ===== Header sticky ===== */}
          <SheetHeader className="sticky top-0 z-10 bg-background border-b px-6 py-4 space-y-2">
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
                  <SheetTitle className="text-base font-bold truncate">
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
                <SheetDescription className="flex items-center gap-3 text-xs">
                  <span className="font-mono">{product?.code || product?.sku || '—'}</span>
                  {product?.category?.name && (
                    <>
                      <span className="text-border">·</span>
                      <span className="flex items-center gap-1">
                        <Tag className="size-3" />
                        {product.category.name}
                      </span>
                    </>
                  )}
                  {product?.updatedAt && (
                    <>
                      <span className="text-border">·</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {format(new Date(product.updatedAt), 'dd MMM yyyy', { locale: es })}
                      </span>
                    </>
                  )}
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
          </SheetHeader>

        {/* ===== Contenido con scroll ===== */}
        <ScrollArea className="flex-1">
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricCard
                      label="Stock total"
                      value={isService ? '—' : totalStock.toString()}
                      icon={Package}
                      accent="text-primary"
                      loading={loading && !productSnapshot}
                    />
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
                    <MetricCard
                      label="Valor stock"
                      value={isService ? '—' : formatAmount(stockValue, currency)}
                      icon={DollarSign}
                      accent="text-emerald-500"
                      loading={loading && !productSnapshot}
                    />
                    <MetricCard
                      label="Precio costo"
                      value={formatAmount(costPrice, currency)}
                      icon={TrendingDown}
                      accent="text-rose-500"
                      loading={loading && !productSnapshot}
                    />
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
                        label="Código de barras"
                        value={product?.barcode || product?.ean || '—'}
                        icon={Barcode}
                        mono
                      />
                      <InfoField
                        label="SKU"
                        value={product?.sku || product?.code || '—'}
                        icon={Hash}
                        mono
                      />
                      <InfoField
                        label="Unidad de medida"
                        value={product?.unit || 'Unidad'}
                        icon={Layers}
                      />
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
                      <InfoField
                        label="Stock mínimo"
                        value={
                          product?.minStock != null
                            ? String(product.minStock)
                            : '—'
                        }
                        icon={AlertCircle}
                      />
                    </div>
                  </Card>
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
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stockByWarehouse.map((item: { warehouseId: string; warehouseName: string; quantity: number; minStock?: number; maxStock?: number }) => {
                            const pct = totalStockByWarehouse > 0
                              ? Math.round((item.quantity / totalStockByWarehouse) * 100)
                              : 0;
                            return (
                              <TableRow key={`${item.warehouseId}-${item.warehouseName}`}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Warehouse className="size-3.5 text-muted-foreground" />
                                    <span className="text-sm font-medium">{item.warehouseName}</span>
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
                                <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                                  {item.minStock != null || item.maxStock != null
                                    ? `${item.minStock ?? '—'} / ${item.maxStock ?? '—'}`
                                    : '—'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
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
                            <TableHead className="text-[10px] uppercase tracking-widest text-right">Costo Unit.</TableHead>
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
                                <TableCell className="text-right text-xs">
                                  {move.unitCost !== undefined && move.unitCost !== null ? (
                                    <div className="flex flex-col">
                                      <span>{move.currency || 'NIO'} {move.unitCost || 0}</span>
                                      {move.baseCost && move.currency !== baseCurrency && (
                                        <span className="text-[10px] text-muted-foreground">{baseCurrency} {move.baseCost}</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs font-mono text-muted-foreground">
                                  {move.reference || '—'}
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
                  <Card className="p-8 gap-3 flex flex-col items-center text-center">
                    <div className="size-14 rounded-full bg-muted/40 flex items-center justify-center">
                      <Clock className="size-7 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold">Historial de auditoría</p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        El historial de auditoría se mostrará aquí cuando esté disponible el módulo de auditoría.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[9px] uppercase tracking-widest mt-2">
                      Próximamente
                    </Badge>
                  </Card>
                </TabsContent>
              </>
            )}
          </div>
        </ScrollArea>

        {/* ===== Footer sticky con acción ===== */}
        <div className="sticky bottom-0 z-10 bg-background border-t px-6 py-3 flex items-center justify-between gap-2">
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
          <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl border-0 bg-transparent p-2 shadow-none">
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
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
  loading?: boolean;
}

function MetricCard({ label, value, icon: Icon, accent = 'text-foreground', loading }: MetricCardProps) {
  return (
    <Card className="p-3 gap-1.5 hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          {label}
        </p>
        <Icon className={`size-3.5 ${accent}`} />
      </div>
      {loading ? (
        <Skeleton className="h-5 w-3/4 mt-1" />
      ) : (
        <p className={`text-base font-black tabular-nums ${accent} truncate`} title={value}>
          {value}
        </p>
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
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <Icon className="size-3" />
        {label}
      </Label>
      <p
        className={`text-xs ${mono ? 'font-mono' : 'font-medium'} ${muted ? 'text-muted-foreground italic' : ''} break-words`}
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
