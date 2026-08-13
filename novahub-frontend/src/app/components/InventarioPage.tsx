import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Package,
  Warehouse,
  Truck,
  Scale,
  History,
  Download,
  RefreshCw,
  BriefcaseBusiness,
  Settings2,
  AlertTriangle,
  ClipboardCheck,
  TrendingDown,
  Building2
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

import { ProductosView, type ProductStatusFilter } from './inventory/ProductosView';
import { ServiciosView } from './inventory/ServiciosView';
import { AlmacenesView } from './inventory/AlmacenesView';
import { TransferenciasView } from './inventory/TransferenciasView';
import { ControlStockView } from './inventory/ControlStockView';
import { MovimientosView } from './inventory/MovimientosView';
import { MobiliarioEquiposView } from './inventory/MobiliarioEquiposView';
import { ConfiguracionInventarioView } from './inventory/ConfiguracionInventarioView';
import { InventoryAuditsView } from './inventory/InventoryAuditsView';
import { InventoryLossesView } from './inventory/InventoryLossesView';
import { inventoryService } from '../services/inventario.service';
import { motion } from 'motion/react';
import { Skeleton as BoneyardSkeleton } from 'boneyard-js/react';
import { BranchScopeFilter } from './ui/BranchScopeFilter';
import { useBranchScope } from '../hooks/useBranchScope';
import { CurrencyValuationBanner } from './ui/CurrencyValuation';
import type { SalesPageSize, SalesPaginationControls } from '../types';

const INVENTORY_SECTIONS = [
  { id: 'productos',       label: 'Productos',       icon: Package,   requiredModules: ['INVENTORY_PRODUCTS'] },
  { id: 'servicios',       label: 'Servicios',       icon: BriefcaseBusiness, requiredModules: ['INVENTORY_PRODUCTS'] },
  { id: 'almacenes',       label: 'Almacenes',       icon: Warehouse, requiredModules: ['INVENTORY_WAREHOUSES'] },
  { id: 'transferencias',  label: 'Transferencias',  icon: Truck,     requiredModules: ['INVENTORY_TRANSFERS'] },
  { id: 'ajustes',         label: 'Ajustes',         icon: Scale,     requiredModules: ['INVENTORY_ADJUSTMENTS'] },
  { id: 'auditorias',      label: 'Auditorías',      icon: ClipboardCheck, requiredModules: ['INVENTORY_ADJUSTMENTS'] },
  { id: 'perdidas',        label: 'Pérdidas',        icon: TrendingDown, requiredModules: ['INVENTORY_ADJUSTMENTS'] },
  { id: 'movimientos',     label: 'Movimientos',     icon: History,   requiredModules: ['INVENTORY_MOVEMENTS'] },
  { id: 'mobiliario-equipos', label: 'Mobiliario y Equipos', icon: Building2, requiredModules: [] },
  { id: 'configuracion',   label: 'Configuración',   icon: Settings2, requiredModules: ['INVENTORY_WAREHOUSES'] },
];

interface InventarioPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (subModule?: string) => void;
}

export function InventarioPage({ activeSubModule, onSubModuleChange, isSidebarCollapsed}: InventarioPageProps) {
  const { user, canPerform } = useAuth();
  const queryClient = useQueryClient();
  const { selectedBranchId, setSelectedBranchId, branchWarehouseIds } = useBranchScope();
  const [activeTab, setActiveTab] = useState(activeSubModule === 'dashboard' ? 'productos' : (activeSubModule || 'productos'));
  const tenantKey = user?.tenantId || 'anonymous';
  const branchScopeEnabled = Boolean(selectedBranchId);
  const branchWarehouseIdSet = useMemo(() => new Set(branchWarehouseIds), [branchWarehouseIds]);
  const [searchState, setSearchState] = useState<Record<string, string>>({});
  const [debouncedSearchState, setDebouncedSearchState] = useState<Record<string, string>>({});
  const [statusState, setStatusState] = useState<Record<string, string>>({});
  const [movementFilters, setMovementFilters] = useState({ type: 'all', warehouseId: 'all' });
  const [productFilters, setProductFilters] = useState<Record<string, { categoryIds: string[]; warehouseIds: string[] }>>({});
  const [paginationState, setPaginationState] = useState<Record<string, { page: number; pageSize: SalesPageSize }>>({});
  const [productTarget, setProductTarget] = useState<{ id?: string; code?: string; stockFilter?: 'all' | 'available' | 'low' | 'out' } | null>(null);

  const pageFor = (section: string) => paginationState[section] || { page: 1, pageSize: 50 as SalesPageSize };
  const updatePage = (section: string, page: number) => setPaginationState((current) => ({ ...current, [section]: { ...pageFor(section), page: Math.max(1, page) } }));
  const updatePageSize = (section: string, pageSize: SalesPageSize) => setPaginationState((current) => ({ ...current, [section]: { page: 1, pageSize } }));
  const updateSearch = (section: string, value: string) => { setSearchState((current) => ({ ...current, [section]: value })); updatePage(section, 1); };
  const updateStatus = (section: string, value: string) => { setStatusState((current) => ({ ...current, [section]: value })); updatePage(section, 1); };
  const updateMovementFilter = (field: 'type' | 'warehouseId', value: string) => {
    setMovementFilters((current) => ({ ...current, [field]: value }));
    updatePage('movimientos', 1);
  };
  const updateProductFilters = (section: string, field: 'categoryIds' | 'warehouseIds', value: string[]) => {
    setProductFilters((current) => ({ ...current, [section]: { ...(current[section] || { categoryIds: [], warehouseIds: [] }), [field]: value } }));
    updatePage(section, 1);
  };
  const searchFor = (section: string) => debouncedSearchState[section]?.trim() || undefined;
  const statusFor = (section: string) => statusState[section] && statusState[section] !== 'ALL' && statusState[section] !== 'all' ? statusState[section] : undefined;
  const productStatusFor = (section: string): ProductStatusFilter => {
    const status = String(statusState[section] || 'ALL').toUpperCase();
    return status === 'ACTIVE' || status === 'INACTIVE' ? status : 'ALL';
  };

  // ─── Scope por sucursal ───────────────────────────────────────────────────
  // El filtro del servidor recibe la lista de almacenes de la sucursal; el
  // filtro cliente es un respaldo que garantiza el resultado sobre la página
  // cargada (idempotente: no altera nada cuando el servidor ya filtró).
  const scopeWarehouseParam = branchScopeEnabled && branchWarehouseIdSet.size > 0
    ? [...branchWarehouseIdSet].join(',')
    : undefined;
  const scopeNoWarehouseParam = branchScopeEnabled ? '__none__' : undefined;

  const inScope = useCallback((warehouseId?: string | null) => {
    if (!branchScopeEnabled) return true;
    return Boolean(warehouseId && branchWarehouseIdSet.has(warehouseId));
  }, [branchScopeEnabled, branchWarehouseIdSet]);

  const productWarehouseIds = (product: any): string[] => [
    ...(Array.isArray(product?.warehouseCatalogs) ? product.warehouseCatalogs.map((c: any) => c.warehouseId || c.warehouse?.id) : []),
    ...(Array.isArray(product?.stockLevels) ? product.stockLevels.map((l: any) => l.warehouseId || l.warehouse?.id) : []),
    ...(Array.isArray(product?.allocations) ? product.allocations.map((a: any) => a.warehouseId || a.warehouse?.id) : []),
  ].filter(Boolean);

  const isProductInScope = useCallback((product: any) => {
    if (!branchScopeEnabled) return true;
    return productWarehouseIds(product).some((warehouseId) => branchWarehouseIdSet.has(warehouseId));
  }, [branchScopeEnabled, branchWarehouseIdSet]);

  // Al cambiar de sucursal se reinician las páginas y los filtros de almacén.
  const handleBranchChange = useCallback((branchId: string) => {
    setSelectedBranchId(branchId);
    setPaginationState((current) => {
      const next: Record<string, { page: number; pageSize: SalesPageSize }> = {};
      for (const [section, value] of Object.entries(current)) next[section] = { ...value, page: 1 };
      return next;
    });
    setProductFilters((current) => {
      const next: Record<string, { categoryIds: string[]; warehouseIds: string[] }> = {};
      for (const [section, value] of Object.entries(current)) next[section] = { ...value, warehouseIds: [] };
      return next;
    });
    setMovementFilters((current) => ({ ...current, warehouseId: 'all' }));
  }, [setSelectedBranchId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchState(searchState), 350);
    return () => window.clearTimeout(timer);
  }, [searchState]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as any;
      if (detail?.module !== 'inventario' || detail?.subModule !== 'productos') return;
      setActiveTab('productos');
      onSubModuleChange?.('productos');
      setProductTarget({
        id: detail.productId || detail.targetId || undefined,
        code: detail.productCode || undefined,
        stockFilter: detail.stockFilter === 'out' ? 'out' : detail.stockFilter === 'low' ? 'low' : 'all',
      });
      if (detail.productCode) updateSearch('productos', String(detail.productCode));
    };
    window.addEventListener('navigate-module', handler);
    return () => window.removeEventListener('navigate-module', handler);
  }, [onSubModuleChange]);

  const toList = (value: any) => value?.data || (Array.isArray(value) ? value : []);
  const commonQueryOptions = {
    enabled: Boolean(user),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  } as const;
  const productsQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'products', tenantKey, activeTab, pageFor(activeTab === 'servicios' ? 'servicios' : 'productos').page, pageFor(activeTab === 'servicios' ? 'servicios' : 'productos').pageSize, searchFor(activeTab === 'servicios' ? 'servicios' : 'productos'), productStatusFor(activeTab === 'servicios' ? 'servicios' : 'productos'), productFilters[activeTab === 'servicios' ? 'servicios' : 'productos'], selectedBranchId],
    queryFn: ({ signal }) => {
      const section = activeTab === 'servicios' ? 'servicios' : 'productos';
      const page = pageFor(section);
      const filters = productFilters[section] || { categoryIds: [], warehouseIds: [] };
      const requestedWarehouseIds = branchScopeEnabled
        ? (filters.warehouseIds.length > 0 ? filters.warehouseIds.filter((id) => branchWarehouseIdSet.has(id)) : [...branchWarehouseIdSet])
        : filters.warehouseIds;
      return inventoryService.getProducts({ type: activeTab === 'servicios' ? 'SERVICE' : 'PRODUCT', page: page.page, pageSize: page.pageSize, search: searchFor(section), status: activeTab === 'servicios' ? undefined : productStatusFor(section), categoryId: filters.categoryIds.join(',') || undefined, warehouseId: requestedWarehouseIds.length > 0 ? requestedWarehouseIds.join(',') : (branchScopeEnabled ? '__none__' : undefined), includeInactive: true }, signal);
    },
    enabled: Boolean(user) && ['productos', 'servicios'].includes(activeTab),
  });
  const productCatalogQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'products-catalog', tenantKey, selectedBranchId],
    queryFn: ({ signal }) => inventoryService.getProducts({ type: 'PRODUCT', report: true, page: 1, pageSize: 5000, warehouseId: scopeWarehouseParam || scopeNoWarehouseParam }, signal),
    enabled: Boolean(user) && ['transferencias', 'ajustes', 'auditorias'].includes(activeTab),
  });
  const warehousesQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'warehouses', tenantKey],
    queryFn: ({ signal }) => inventoryService.getWarehouses(signal),
    enabled: Boolean(user),
  });
  const categoriesQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'categories', tenantKey],
    queryFn: ({ signal }) => inventoryService.getCategories(signal),
    enabled: Boolean(user) && ['productos', 'servicios'].includes(activeTab),
  });
  const transfersQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'transfers', tenantKey, pageFor('transferencias').page, pageFor('transferencias').pageSize, searchFor('transferencias'), statusFor('transferencias'), selectedBranchId],
    queryFn: ({ signal }) => inventoryService.getTransfers({ page: pageFor('transferencias').page, pageSize: pageFor('transferencias').pageSize, search: searchFor('transferencias'), status: statusFor('transferencias'), warehouseId: scopeWarehouseParam }, signal),
    enabled: Boolean(user) && activeTab === 'transferencias',
  });
  const adjustmentsQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'adjustments', tenantKey, pageFor('ajustes').page, pageFor('ajustes').pageSize, searchFor('ajustes'), statusFor('ajustes'), selectedBranchId],
    queryFn: ({ signal }) => inventoryService.getAdjustments({ page: pageFor('ajustes').page, pageSize: pageFor('ajustes').pageSize, search: searchFor('ajustes'), status: statusFor('ajustes'), warehouseId: scopeWarehouseParam }, signal),
    enabled: Boolean(user) && activeTab === 'ajustes',
  });
  const auditsQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'audits', tenantKey, pageFor('auditorias').page, pageFor('auditorias').pageSize, searchFor('auditorias'), selectedBranchId],
    queryFn: ({ signal }) => inventoryService.getAudits({ page: pageFor('auditorias').page, pageSize: pageFor('auditorias').pageSize, search: searchFor('auditorias'), warehouseId: scopeWarehouseParam }, signal),
    enabled: Boolean(user) && activeTab === 'auditorias',
  });
  const seriesQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'series', tenantKey, activeTab],
    queryFn: ({ signal }) => inventoryService.getSeries({ report: true, page: 1, pageSize: 5000 }, signal),
    enabled: Boolean(user) && ['productos', 'servicios', 'transferencias', 'ajustes'].includes(activeTab),
  });
  const movementsQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'movements', tenantKey, pageFor('movimientos').page, pageFor('movimientos').pageSize, searchFor('movimientos'), movementFilters.type, movementFilters.warehouseId, selectedBranchId],
    queryFn: ({ signal }) => inventoryService.getMovements({
      page: pageFor('movimientos').page,
      pageSize: pageFor('movimientos').pageSize,
      search: searchFor('movimientos'),
      type: movementFilters.type !== 'all' ? movementFilters.type : undefined,
      warehouseId: movementFilters.warehouseId !== 'all' ? movementFilters.warehouseId : scopeWarehouseParam,
    }, signal),
    enabled: Boolean(user) && activeTab === 'movimientos',
  });
  const categories = toList(categoriesQuery.data).map((category: any) => ({
    ...category,
    type: String(category.type || 'PRODUCT').toUpperCase(),
  }));
  const data = {
    products: toList(productsQuery.data || productCatalogQuery.data).map((product: any) => ({
      ...product,
      itemType: String(product.itemType || product.type || 'PRODUCT').toUpperCase(),
    })).filter((product: any) => isProductInScope(product)),
    warehouses: toList(warehousesQuery.data),
    categories: categories.filter((category: any) => category.type === 'PRODUCT'),
    serviceCategories: categories.filter((category: any) => category.type === 'SERVICE'),
    transfers: toList(transfersQuery.data).filter((transfer: any) =>
      inScope(transfer.fromId || transfer.from?.id) || inScope(transfer.toId || transfer.to?.id)),
    adjustments: toList(adjustmentsQuery.data).filter((adjustment: any) =>
      inScope(adjustment.warehouseId || adjustment.warehouse?.id)),
    audits: toList(auditsQuery.data).filter((audit: any) => inScope(audit.warehouseId)),
    lots: [],
    series: toList(seriesQuery.data),
    movements: toList(movementsQuery.data).filter((movement: any) => inScope(movement.warehouseId)),
  };
  const scopedWarehouses = data.warehouses.filter((warehouse: any) =>
    !branchScopeEnabled || branchWarehouseIdSet.has(warehouse.id));
  const activeQueries = [
    ...(productsQuery.isEnabled ? [productsQuery] : []),
    ...(productCatalogQuery.isEnabled ? [productCatalogQuery] : []),
    ...(warehousesQuery.isEnabled ? [warehousesQuery] : []),
    ...(categoriesQuery.isEnabled ? [categoriesQuery] : []),
    ...(transfersQuery.isEnabled ? [transfersQuery] : []),
    ...(adjustmentsQuery.isEnabled ? [adjustmentsQuery] : []),
    ...(auditsQuery.isEnabled ? [auditsQuery] : []),
    ...(seriesQuery.isEnabled ? [seriesQuery] : []),
    ...(movementsQuery.isEnabled ? [movementsQuery] : []),
  ];
  const makePagination = (section: string, query: any): SalesPaginationControls => {
    const page = pageFor(section);
    const meta = query.data?.meta;
    return {
      page: meta?.page || page.page,
      pageSize: meta?.pageSize || page.pageSize,
      total: meta?.total || 0,
      totalPages: meta?.totalPages || 1,
      onPageChange: (nextPage) => updatePage(section, nextPage),
      onPageSizeChange: (nextSize) => updatePageSize(section, nextSize),
    };
  };
  const productSection = activeTab === 'servicios' ? 'servicios' : 'productos';
  const productsPagination = makePagination(productSection, productsQuery);
  const transfersPagination = makePagination('transferencias', transfersQuery);
  const adjustmentsPagination = makePagination('ajustes', adjustmentsQuery);
  const auditsPagination = makePagination('auditorias', auditsQuery);
  const movementsPagination = makePagination('movimientos', movementsQuery);
  const loading = activeQueries.some((query) => query.isPending && !query.data);
  const refreshing = activeQueries.some((query) => query.isFetching) && !loading;
  const firstError = activeQueries.find((query) => query.error)?.error;
  const loadError = firstError ? (firstError as Error).message : '';
  const fetchData = useCallback(async (scope: 'all' | 'products' = 'all') => {
    if (scope === 'products') {
      await queryClient.invalidateQueries({ queryKey: ['inventory', 'products', tenantKey] });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['inventory'] });
  }, [queryClient, tenantKey]);

  const productItems = data.products.filter((product: any) => product.itemType !== 'SERVICE');
  const serviceItems = data.products.filter((product: any) => product.itemType === 'SERVICE');

  useEffect(() => {
    const nextTab = activeSubModule === 'dashboard' ? 'productos' : activeSubModule;
    if (!nextTab) return;
    const exists = INVENTORY_SECTIONS.some((section) => section.id === nextTab);
    if (exists) {
      setActiveTab(nextTab);
      if (activeSubModule === 'dashboard') onSubModuleChange?.('productos');
    }
  }, [activeSubModule, onSubModuleChange]);

  const handleExportData = async () => {
    try {
      const csvContent = [
        ['Código', 'Nombre', 'Categoría', 'Stock', 'Precio Venta', 'Precio Costo'].join(','),
        ...productItems.map((p: any) => [
          p.code,
          `"${p.name}"`,
          p.category?.name || '',
          p.stock || 0,
          p.salePrice || 0,
          p.costPrice || 0
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast.success('Archivo CSV descargado');
    } catch (e: any) {
      toast.error('Error al exportar datos');
    }
  };

  return (
    <div className="inventory-module mx-auto min-w-0 w-full max-w-[1700px] space-y-4 overflow-x-hidden p-3 pb-20 sm:p-6 md:p-10">
      {/* Header */}
      <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-[66px] shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Package className="size-9 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
              Inventario <span className="text-primary">de Mercancías</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Gestiona existencias, precios, almacenes y movimientos en un solo lugar.</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                {productItems.length} productos · {serviceItems.length} servicios · {data.warehouses.length} almacenes
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData()}
            disabled={refreshing}
            className="min-w-0 flex-1 rounded-xl font-bold sm:flex-none"
          >
            <RefreshCw className={`size-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportData}
            className="min-w-0 flex-1 rounded-xl font-bold sm:flex-none"
          >
            <Download className="size-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <CurrencyValuationBanner />

      {/* Branch Scope Filter */}
        <div className="flex min-w-0 flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <BranchScopeFilter onChange={handleBranchChange} />
        <div />
      </div>

      {/* Main Navigation Tabs */}
      <Tabs
        value={activeTab}
        className="w-full"
        onValueChange={(nextTab) => {
          setActiveTab(nextTab);
          if (onSubModuleChange) onSubModuleChange(nextTab);
        }}
      >
        <div className="mb-6 w-full overflow-x-auto custom-scrollbar">
        <TabsList className="flex h-auto w-max min-w-full gap-1.5 rounded-2xl border border-border/40 bg-gradient-to-br from-muted/30 to-muted/50 p-1.5 backdrop-blur-sm [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground sm:min-w-0">
          <span className="flex shrink-0 items-center gap-1.5 px-2 text-[9px] font-black uppercase tracking-[0.2em] text-primary/80">
            <Package className="size-3" /> Inventario de Mercancías
          </span>
          {INVENTORY_SECTIONS.map((section) => {
            const hasRequired = section.requiredModules && section.requiredModules.some(mod => user?.enabledModules?.includes(mod));
            // La suscripción al módulo padre (INVENTORY) habilita todas sus
            // vistas, incluso con submódulos granulares contratados.
            const hasFallback = user?.enabledModules?.includes('INVENTORY');
            const hasAccess = (!user?.enabledModules || section.requiredModules.length === 0 || hasRequired || hasFallback)
              && (section.requiredModules.length === 0 || section.requiredModules.some(mod => canPerform(mod, 'view')));
            if (!hasAccess) return null;
            return (
              <TabsTrigger
                key={section.id}
                value={section.id} 
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
                  data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                  data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                <section.icon className="size-4" />
                <span className="hidden sm:inline">{section.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        </div>

        {/* El key remonta las vistas al cambiar de sucursal: resetea formularios,
            filtros locales y selecciones que dependen del alcance de almacenes. */}
        <div key={selectedBranchId || 'all'} className="mt-4 min-h-[600px]">
          {loadError ? (
            <div className="flex min-h-80 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
              <div className="max-w-md">
                <AlertTriangle className="mx-auto size-9 text-destructive" />
                <h2 className="mt-3 text-lg font-bold">No se pudo mostrar el inventario</h2>
                <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
                <Button className="mt-5 rounded-xl" onClick={() => fetchData()}>
                  <RefreshCw className="mr-2 size-4" /> Reintentar
                </Button>
              </div>
            </div>
          ) : loading ? (
            <BoneyardSkeleton
              name="inventory-workspace"
              loading
              select="viewport"
              animate="shimmer"
              fallback={<div className="space-y-4" aria-label="Cargando inventario">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[0, 1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-muted/60" />)}
                </div>
                <div className="h-96 w-full rounded-2xl bg-muted/40" />
              </div>}
            >
              <div />
            </BoneyardSkeleton>
          ) : (
            <>
              <TabsContent value="productos" className="m-0" asChild>
                <motion.div 
                  initial={{ opacity: 0, y: 16 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <ProductosView 
                    products={productItems}
                    categories={data.categories}
                    warehouses={scopedWarehouses}
                    series={data.series}
                    movements={data.movements}
                    onRefresh={() => fetchData('products')}
                    pagination={productsPagination}
                    onSearchChange={(value) => updateSearch('productos', value)}
                    onCategoryChange={(value) => updateProductFilters('productos', 'categoryIds', value)}
                    onWarehouseChange={(value) => updateProductFilters('productos', 'warehouseIds', value)}
                    productStatusFilter={productStatusFor('productos')}
                    onProductStatusFilterChange={(value) => updateStatus('productos', value)}
                    targetProductId={productTarget?.id}
                    initialStockFilter={productTarget?.stockFilter}
                    onClearTargetProduct={() => setProductTarget(null)}
                    selectedBranchId={selectedBranchId}
                    branchWarehouseIds={branchWarehouseIds}
                  />
                </motion.div>
              </TabsContent>
              <TabsContent value="servicios" className="m-0" asChild>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <ServiciosView
                    products={serviceItems}
                    categories={data.serviceCategories}
                    warehouses={scopedWarehouses}
                    series={data.series}
                    movements={data.movements}
                    onRefresh={() => fetchData()}
                    pagination={productsPagination}
                    onSearchChange={(value) => updateSearch('servicios', value)}
                    onCategoryChange={(value) => updateProductFilters('servicios', 'categoryIds', value)}
                    onWarehouseChange={(value) => updateProductFilters('servicios', 'warehouseIds', value)}
                    isSidebarCollapsed={isSidebarCollapsed}
                  />
                </motion.div>
              </TabsContent>
              <TabsContent value="almacenes" className="m-0" asChild>
                <motion.div 
                  initial={{ opacity: 0, y: 16 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <AlmacenesView 
                    warehouses={scopedWarehouses}
                    onRefresh={() => fetchData()}
                  />
                </motion.div>
              </TabsContent>
              <TabsContent value="transferencias" className="m-0" asChild>
                <motion.div 
                  initial={{ opacity: 0, y: 16 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <TransferenciasView 
                    transfers={data.transfers}
                    warehouses={scopedWarehouses}
                    products={productItems}
                    series={data.series}
                    onRefresh={() => fetchData()}
                    pagination={transfersPagination}
                    onSearchChange={(value) => updateSearch('transferencias', value)}
                    onStatusChange={(value) => updateStatus('transferencias', value)}
                  />
                </motion.div>
              </TabsContent>
              <TabsContent value="ajustes" className="m-0" asChild>
                <motion.div 
                  initial={{ opacity: 0, y: 16 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <ControlStockView 
                    adjustments={data.adjustments}
                    warehouses={scopedWarehouses}
                    products={productItems}
                    series={data.series}
                    onRefresh={() => fetchData()}
                    pagination={adjustmentsPagination}
                    onSearchChange={(value) => updateSearch('ajustes', value)}
                    onStatusChange={(value) => updateStatus('ajustes', value)}
                  />
                </motion.div>
              </TabsContent>
              <TabsContent value="movimientos" className="m-0" asChild>
                <motion.div 
                  initial={{ opacity: 0, y: 16 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <MovimientosView 
                    movements={data.movements}
                    warehouses={scopedWarehouses}
                    pagination={movementsPagination}
                    onSearchChange={(value) => updateSearch('movimientos', value)}
                    onTypeChange={(value) => updateMovementFilter('type', value)}
                    onWarehouseChange={(value) => updateMovementFilter('warehouseId', value)}
                  />
                </motion.div>
              </TabsContent>
              <TabsContent value="configuracion" className="m-0" asChild>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <ConfiguracionInventarioView isSidebarCollapsed={isSidebarCollapsed} />
                </motion.div>
              </TabsContent>
              <TabsContent value="auditorias" className="m-0" asChild>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <InventoryAuditsView
                    audits={data.audits}
                    warehouses={scopedWarehouses}
                    products={data.products}
                    onRefresh={() => fetchData()}
                    pagination={auditsPagination}
                  />
                </motion.div>
              </TabsContent>
              <TabsContent value="perdidas" className="m-0" asChild>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <InventoryLossesView
                    warehouses={scopedWarehouses}
                    warehouseId={scopeWarehouseParam}
                  />
                </motion.div>
              </TabsContent>
              <TabsContent value="mobiliario-equipos" className="m-0" asChild>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <MobiliarioEquiposView externalBranchId={selectedBranchId || undefined} />
                </motion.div>
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
