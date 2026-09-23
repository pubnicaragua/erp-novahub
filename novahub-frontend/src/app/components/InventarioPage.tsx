import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import {
  Package,
  Warehouse,
  Truck,
  Scale,
  History,
  RefreshCw,
  BriefcaseBusiness,
  Settings2,
  AlertTriangle,
  ClipboardCheck,
  TrendingDown,
  Building2,
  Tags
} from 'lucide-react';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from '@/app/services/toast';
import { useAuth } from '../contexts/AuthContext';

import { ProductosView, type ProductExportOptions, type ProductStatusFilter } from './inventory/ProductosView';
import { CrearProductoView } from './inventory/CrearProductoView';
import { ServiciosView } from './inventory/ServiciosView';
import { AlmacenesView } from './inventory/AlmacenesView';
import { TransferenciasView } from './inventory/TransferenciasView';
import { ControlStockView } from './inventory/ControlStockView';
import { MovimientosView, type MovementExportOptions } from './inventory/MovimientosView';
import { MobiliarioEquiposView } from './inventory/MobiliarioEquiposView';
import { ConfiguracionInventarioView } from './inventory/ConfiguracionInventarioView';
import { InventoryAuditsView } from './inventory/InventoryAuditsView';
import { InventoryLossesView } from './inventory/InventoryLossesView';
import { AtributosView } from './inventory/AtributosView';
import { LinkedWarehouseProductsView } from './inventory/LinkedWarehouseProductsView';
import { MarcasClienteView } from './inventory/MarcasClienteView';
import { api } from '../services/api';
import { inventoryService } from '../services/inventario.service';
import { buildDateFilteredDownloadFileName } from '../utils/exportFileNames';
import { motion } from 'motion/react';
import { Skeleton as BoneyardSkeleton } from 'boneyard-js/react';
import { BranchScopeFilter } from './ui/BranchScopeFilter';
import { useBranchScope } from '../hooks/useBranchScope';
import { CurrencyValuationBanner } from './ui/CurrencyValuation';
import type { SalesPageSize, SalesPaginationControls } from '../types';
import { cn } from './ui/utils';
import { fetchAllReportPages } from '../hooks/useTenantQuery';

const INVENTORY_SECTIONS = [
  { id: 'productos',       label: 'Productos',       icon: Package,   requiredModules: ['INVENTORY_PRODUCTS'] },
  { id: 'marcas-clientes', label: 'Marcas por cliente', icon: Tags, requiredModules: ['INVENTORY_PRODUCTS'] },
  { id: 'servicios',       label: 'Servicios',       icon: BriefcaseBusiness, requiredModules: ['INVENTORY_SERVICES'] },
  { id: 'atributos',       label: 'Atributos y Categoría', icon: Tags, requiredModules: ['INVENTORY_ATTRIBUTES'] },
  { id: 'almacenes',       label: 'Bodegas',         icon: Warehouse, requiredModules: ['INVENTORY_WAREHOUSES'] },
  { id: 'transferencias',  label: 'Transferencias',  icon: Truck,     requiredModules: ['INVENTORY_TRANSFERS'] },
  { id: 'ajustes',         label: 'Ajustes',         icon: Scale,     requiredModules: ['INVENTORY_ADJUSTMENTS'] },
  { id: 'auditorias',      label: 'Auditorías',      icon: ClipboardCheck, requiredModules: ['INVENTORY_AUDITS'] },
  { id: 'perdidas',        label: 'Pérdidas',        icon: TrendingDown, requiredModules: ['INVENTORY_LOSSES'] },
  { id: 'movimientos',     label: 'Movimientos',     icon: History,   requiredModules: ['INVENTORY_MOVEMENTS'] },
  { id: 'mobiliario-equipos', label: 'Mobiliario y Equipos', icon: Building2, requiredModules: ['INVENTORY_ASSETS'] },
  { id: 'configuracion',   label: 'Configuración',   icon: Settings2, requiredModules: ['INVENTORY_CONFIG'] },
];

interface InventarioPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (subModule?: string) => void;
}

export function InventarioPage({ activeSubModule, onSubModuleChange, isSidebarCollapsed}: InventarioPageProps) {
  const { user, canPerform } = useAuth();
  const canViewInventorySection = useCallback((sectionId: string) => {
    const section = INVENTORY_SECTIONS.find((candidate) => candidate.id === sectionId);
    return Boolean(section?.requiredModules.some((module) => canPerform(module, 'view')));
  }, [canPerform]);
  // Un rol puede recibir una vista granular sin tener una fila padre. Ese
  // permiso también debe habilitar la pantalla y sus consultas autorizadas.
  const canReadInventory = canPerform('INVENTORY', 'view')
    || INVENTORY_SECTIONS.some((section) => canViewInventorySection(section.id));
  const canExportInventory = canPerform('INVENTORY_PRODUCTS', 'export') || canPerform('INVENTORY_SERVICES', 'export');
  const canViewInventoryCost = canPerform('INVENTORY_PRODUCTS', 'viewCost');
  const queryClient = useQueryClient();
  const { selectedBranchId, setSelectedBranchId, branchWarehouseIds, allBranches, accessibleBranches, refreshBranches, isLoading: branchScopeLoading } = useBranchScope();
  const [activeTab, setActiveTab] = useState(activeSubModule === 'dashboard' ? 'productos' : (activeSubModule || 'productos'));
  const [createProductViewOpen, setCreateProductViewOpen] = useState(false);
  const tenantKey = user?.tenantId || 'anonymous';
  const branchScopeEnabled = Boolean(selectedBranchId);
  const branchWarehouseIdSet = useMemo(() => new Set(branchWarehouseIds), [branchWarehouseIds]);
  const linkedWarehousesQuery = useQuery({
    queryKey: ['inventory', 'linked-warehouses', tenantKey, selectedBranchId],
    queryFn: ({ signal }) => api.get<{ sources?: any[] }>('/inventory/warehouse-supply-requests/options', {
      params: selectedBranchId ? { branchId: selectedBranchId } : undefined,
      signal,
    }),
    enabled: Boolean(user) && (canViewInventorySection('productos') || canViewInventorySection('servicios')) && ['productos', 'servicios'].includes(activeTab),
    staleTime: 30_000,
    retry: 1,
  });
  const linkedWarehouseOptions = useMemo(() => {
    const response: any = linkedWarehousesQuery.data;
    const sources = response?.sources || response?.data?.sources || [];
    return Array.isArray(sources) ? sources.filter((warehouse: any) => warehouse?.isActive !== false) : [];
  }, [linkedWarehousesQuery.data]);
  const allBranchWarehouseIds = useMemo(() => [...new Set(
    (allBranches || []).flatMap((branch: any) => [
      branch?.warehouseId,
      ...((branch?.warehouses || []) as any[]).map((warehouse: any) => warehouse?.id),
    ].filter(Boolean)),
  )], [allBranches]);
  const productScopeWarehouseIds = useMemo(() => [...new Set([
    ...(branchScopeEnabled ? branchWarehouseIds : allBranchWarehouseIds),
    ...linkedWarehouseOptions.map((warehouse: any) => warehouse.id),
  ].filter(Boolean))], [allBranchWarehouseIds, branchScopeEnabled, branchWarehouseIds, linkedWarehouseOptions]);
  const productScopeWarehouseIdSet = useMemo(() => new Set(productScopeWarehouseIds), [productScopeWarehouseIds]);
  const linkedWarehouseIdSet = useMemo(
    () => new Set(linkedWarehouseOptions.map((warehouse: any) => warehouse.id).filter(Boolean)),
    [linkedWarehouseOptions],
  );
  const [searchState, setSearchState] = useState<Record<string, string>>({});
  const [debouncedSearchState, setDebouncedSearchState] = useState<Record<string, string>>({});
  const [statusState, setStatusState] = useState<Record<string, string>>({});
  const [movementFilters, setMovementFilters] = useState({ type: 'all', warehouseId: 'all', from: '', to: '' });
  const [productFilters, setProductFilters] = useState<Record<string, { categoryIds: string[]; warehouseIds: string[] }>>({});
  const [productBrandFilters, setProductBrandFilters] = useState<Record<string, string>>({});
  const [productStockStatusFilters, setProductStockStatusFilters] = useState<Record<string, string>>({});
  const [productScope, setProductScope] = useState<'branch' | 'linkedWarehouses'>('branch');
  const [paginationState, setPaginationState] = useState<Record<string, { page: number; pageSize: SalesPageSize }>>({});
  const [productTarget, setProductTarget] = useState<{ id?: string; code?: string; stockFilter?: 'all' | 'available' | 'low' | 'out' | 'expiring' } | null>(null);
  const productListIsActive = ['productos', 'servicios'].includes(activeTab);
  const [summaryLoadAllowed, setSummaryLoadAllowed] = useState(false);

  const pageFor = (section: string) => paginationState[section] || { page: 1, pageSize: 50 as SalesPageSize };
  const updatePage = (section: string, page: number) => setPaginationState((current) => ({ ...current, [section]: { ...pageFor(section), page: Math.max(1, page) } }));
  const updatePageSize = (section: string, pageSize: SalesPageSize) => setPaginationState((current) => ({ ...current, [section]: { page: 1, pageSize } }));
  const updateSearch = (section: string, value: string) => { setSearchState((current) => ({ ...current, [section]: value })); updatePage(section, 1); };
  const updateStatus = (section: string, value: string) => { setStatusState((current) => ({ ...current, [section]: value })); updatePage(section, 1); };
  const updateMovementFilter = (field: 'type' | 'warehouseId', value: string) => {
    setMovementFilters((current) => ({ ...current, [field]: value }));
    updatePage('movimientos', 1);
  };
  const updateMovementDateFilter = (from: string, to: string) => {
    setMovementFilters((current) => ({ ...current, from, to }));
    updatePage('movimientos', 1);
  };
  const updateProductFilters = (section: string, field: 'categoryIds' | 'warehouseIds', value: string[]) => {
    setProductFilters((current) => ({ ...current, [section]: { ...(current[section] || { categoryIds: [], warehouseIds: [] }), [field]: value } }));
    updatePage(section, 1);
  };
  const updateProductBrandFilter = (section: string, value: string) => {
    setProductBrandFilters((current) => ({ ...current, [section]: value }));
    updatePage(section, 1);
  };
  const updateProductStockStatusFilter = (section: string, value: string) => {
    setProductStockStatusFilters((current) => ({ ...current, [section]: value }));
    updatePage(section, 1);
  };
  const searchFor = (section: string) => debouncedSearchState[section]?.trim() || undefined;
  const statusFor = (section: string) => statusState[section] && statusState[section] !== 'ALL' && statusState[section] !== 'all' ? statusState[section] : undefined;
  const stockStatusFor = (section: string) => {
    const val = productStockStatusFilters[section];
    return val && val !== 'all' ? val : undefined;
  };
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
  const productScopeWarehouseParam = branchScopeEnabled && productScopeWarehouseIdSet.size > 0
    ? [...productScopeWarehouseIdSet].join(',')
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
    return productWarehouseIds(product).some((warehouseId) => productScopeWarehouseIdSet.has(warehouseId));
  }, [branchScopeEnabled, productScopeWarehouseIdSet]);

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
        stockFilter: detail.stockFilter === 'out' || detail.filter === 'out'
          ? 'out'
          : detail.stockFilter === 'low' || detail.filter === 'low'
            ? 'low'
            : detail.stockFilter === 'expiring' || detail.filter === 'expiring'
              ? 'expiring'
            : 'all',
      });
      if (detail.productCode) updateSearch('productos', String(detail.productCode));
    };
    window.addEventListener('navigate-module', handler);
    return () => window.removeEventListener('navigate-module', handler);
  }, [onSubModuleChange]);

  const toList = (value: any) => value?.data || (Array.isArray(value) ? value : []);
  const commonQueryOptions = {
    enabled: Boolean(user) && canReadInventory,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  } as const;
  const productsQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'products', tenantKey, activeTab, pageFor(activeTab === 'servicios' ? 'servicios' : 'productos').page, pageFor(activeTab === 'servicios' ? 'servicios' : 'productos').pageSize, searchFor(activeTab === 'servicios' ? 'servicios' : 'productos'), productStatusFor(activeTab === 'servicios' ? 'servicios' : 'productos'), productFilters[activeTab === 'servicios' ? 'servicios' : 'productos'], productBrandFilters[activeTab === 'servicios' ? 'servicios' : 'productos'], stockStatusFor(activeTab === 'servicios' ? 'servicios' : 'productos'), selectedBranchId, productScopeWarehouseIds.join(',')],
    queryFn: ({ signal }) => {
      const section = activeTab === 'servicios' ? 'servicios' : 'productos';
      const page = pageFor(section);
      const filters = productFilters[section] || { categoryIds: [], warehouseIds: [] };
      const selectedWarehouseIds = filters.warehouseIds.filter((id) => productScopeWarehouseIdSet.has(id));
      const selectedLinkedWarehouse = selectedWarehouseIds.some((id) => linkedWarehouseIdSet.has(id));
      const localWarehouseFallbackIds = branchScopeEnabled ? branchWarehouseIds : allBranchWarehouseIds;
      const requestedWarehouseIds = branchScopeEnabled
        ? (selectedWarehouseIds.length > 0
          ? [...new Set([
            ...selectedWarehouseIds,
            ...(selectedLinkedWarehouse ? localWarehouseFallbackIds : []),
          ])]
          : [...productScopeWarehouseIdSet])
        : (selectedWarehouseIds.length > 0
          ? [...new Set([
            ...selectedWarehouseIds,
            ...(selectedLinkedWarehouse ? localWarehouseFallbackIds : []),
          ])]
          : []);
      return inventoryService.getProducts({ type: activeTab === 'servicios' ? 'SERVICE' : 'PRODUCT', light: true, page: page.page, pageSize: page.pageSize, search: searchFor(section), status: activeTab === 'servicios' ? undefined : productStatusFor(section), stockStatus: stockStatusFor(section), categoryId: filters.categoryIds.join(',') || undefined, brand: activeTab === 'servicios' ? undefined : productBrandFilters[section]?.trim() || undefined, warehouseId: requestedWarehouseIds.length > 0 ? requestedWarehouseIds.join(',') : (branchScopeEnabled ? '__none__' : undefined), includeInactive: true }, signal);
    },
    // Espera a que el alcance de sucursal y sus bodegas vinculadas estén
    // resueltos. Así evita pintar una página sin alcance y volver a pedirla
    // cuando llegan /sucursales o /warehouse-supply-requests/options.
    enabled: Boolean(user) && !branchScopeLoading && !linkedWarehousesQuery.isPending && canViewInventorySection(activeTab) && productListIsActive,
  });
  useEffect(() => {
    if (!productListIsActive || !productsQuery.data || summaryLoadAllowed) return;
    const timer = window.setTimeout(() => setSummaryLoadAllowed(true), 450);
    return () => window.clearTimeout(timer);
  }, [productListIsActive, productsQuery.data, summaryLoadAllowed]);
  const productCatalogQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'products-catalog', tenantKey, selectedBranchId],
    queryFn: ({ signal }) => inventoryService.getProducts({ type: 'PRODUCT', report: true, page: 1, pageSize: 5000, warehouseId: scopeWarehouseParam || scopeNoWarehouseParam }, signal),
    enabled: Boolean(user) && canViewInventorySection(activeTab) && ['transferencias', 'ajustes', 'auditorias'].includes(activeTab),
  });
  // Catálogo completo (sin paginar) para los KPIs de Productos/Servicios: el
  // listado principal es paginado (50/página) y no debe limitar los totales.
  const productsSummaryQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'products-summary', tenantKey, activeTab === 'servicios' ? 'SERVICE' : 'PRODUCT', selectedBranchId, productScopeWarehouseIds.join(',')],
    queryFn: ({ signal }) => inventoryService.getProducts({ type: activeTab === 'servicios' ? 'SERVICE' : 'PRODUCT', light: true, report: true, page: 1, pageSize: 5000, warehouseId: productScopeWarehouseParam || scopeNoWarehouseParam, includeInactive: true }, signal),
    // El resumen puede ser grande; primero se pinta la página visible y luego
    // se resuelven KPIs, marcas y exportación sin bloquear la primera vista.
    enabled: Boolean(user) && Boolean(productsQuery.data) && summaryLoadAllowed && canViewInventorySection(activeTab) && productListIsActive,
  });
  const warehousesQuery = useQuery({
    ...commonQueryOptions,
    staleTime: 0,
    refetchOnMount: 'always',
    queryKey: ['inventory', 'warehouses', tenantKey],
    queryFn: ({ signal }) => inventoryService.getWarehouses(signal),
    enabled: Boolean(user) && ['almacenes', 'transferencias', 'ajustes', 'auditorias', 'perdidas', 'movimientos', 'configuracion'].some((section) => canViewInventorySection(section)),
  });
  const refreshWarehouses = useCallback(() => warehousesQuery.refetch(), [warehousesQuery.refetch]);
  const categoriesQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'categories', tenantKey],
    queryFn: ({ signal }) => inventoryService.getCategories(signal),
    enabled: Boolean(user) && canViewInventorySection(activeTab) && ['productos', 'servicios', 'atributos'].includes(activeTab),
  });
  const transfersQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'transfers', tenantKey, pageFor('transferencias').page, pageFor('transferencias').pageSize, searchFor('transferencias'), statusFor('transferencias'), selectedBranchId],
    queryFn: ({ signal }) => inventoryService.getTransfers({ page: pageFor('transferencias').page, pageSize: pageFor('transferencias').pageSize, search: searchFor('transferencias'), status: statusFor('transferencias'), warehouseId: scopeWarehouseParam, branchId: selectedBranchId || undefined }, signal),
    enabled: Boolean(user) && canViewInventorySection('transferencias') && activeTab === 'transferencias',
  });
  const adjustmentsQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'adjustments', tenantKey, pageFor('ajustes').page, pageFor('ajustes').pageSize, searchFor('ajustes'), statusFor('ajustes'), selectedBranchId],
    queryFn: ({ signal }) => inventoryService.getAdjustments({ page: pageFor('ajustes').page, pageSize: pageFor('ajustes').pageSize, search: searchFor('ajustes'), status: statusFor('ajustes'), warehouseId: scopeWarehouseParam }, signal),
    enabled: Boolean(user) && canViewInventorySection('ajustes') && activeTab === 'ajustes',
  });
  const auditsQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'audits', tenantKey, pageFor('auditorias').page, pageFor('auditorias').pageSize, searchFor('auditorias'), selectedBranchId],
    queryFn: ({ signal }) => inventoryService.getAudits({ page: pageFor('auditorias').page, pageSize: pageFor('auditorias').pageSize, search: searchFor('auditorias'), warehouseId: scopeWarehouseParam }, signal),
    enabled: Boolean(user) && canViewInventorySection('auditorias') && activeTab === 'auditorias',
  });
  const pendingAuditsForAdjustmentsQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'pending-audits-for-adjustments', tenantKey, selectedBranchId],
    queryFn: ({ signal }) => inventoryService.getAudits({ page: 1, pageSize: 5000, report: true, status: 'PENDING', warehouseId: scopeWarehouseParam }, signal),
    enabled: Boolean(user) && canViewInventorySection('ajustes') && activeTab === 'ajustes',
  });
  const seriesQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'series', tenantKey, activeTab],
    queryFn: ({ signal }) => inventoryService.getSeries({ report: true, page: 1, pageSize: 5000 }, signal),
    // El detalle del producto ya trae sus series; la consulta masiva solo es
    // necesaria en vistas que realmente listan series.
    enabled: Boolean(user) && canViewInventorySection(activeTab) && ['transferencias', 'ajustes'].includes(activeTab),
  });
  const movementsQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'movements', tenantKey, pageFor('movimientos').page, pageFor('movimientos').pageSize, searchFor('movimientos'), movementFilters.type, movementFilters.warehouseId, movementFilters.from, movementFilters.to, selectedBranchId],
    queryFn: ({ signal }) => inventoryService.getMovements({
      page: pageFor('movimientos').page,
      pageSize: pageFor('movimientos').pageSize,
      search: searchFor('movimientos'),
      type: movementFilters.type !== 'all' ? movementFilters.type : undefined,
      warehouseId: movementFilters.warehouseId !== 'all' ? movementFilters.warehouseId : scopeWarehouseParam,
      from: movementFilters.from || undefined,
      to: movementFilters.to || undefined,
    }, signal),
    enabled: Boolean(user) && canViewInventorySection('movimientos') && activeTab === 'movimientos',
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
  const productWarehouseOptions = Array.from(new Map([
    ...scopedWarehouses,
    ...linkedWarehouseOptions,
  ].map((warehouse: any) => [warehouse.id, warehouse])).values());
  const activeQueries = [
    ...(productsQuery.isEnabled ? [productsQuery] : []),
    ...(linkedWarehousesQuery.isEnabled ? [linkedWarehousesQuery] : []),
    ...(productCatalogQuery.isEnabled ? [productCatalogQuery] : []),
    ...(warehousesQuery.isEnabled ? [warehousesQuery] : []),
    ...(categoriesQuery.isEnabled ? [categoriesQuery] : []),
    ...(transfersQuery.isEnabled ? [transfersQuery] : []),
    ...(adjustmentsQuery.isEnabled ? [adjustmentsQuery] : []),
    ...(auditsQuery.isEnabled ? [auditsQuery] : []),
    ...(pendingAuditsForAdjustmentsQuery.isEnabled ? [pendingAuditsForAdjustmentsQuery] : []),
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
  const exportMovements = useCallback(async ({ amount, sortOrder }: MovementExportOptions) => {
    const filters = {
      search: searchFor('movimientos'),
      type: movementFilters.type !== 'all' ? movementFilters.type : undefined,
      warehouseId: movementFilters.warehouseId !== 'all' ? movementFilters.warehouseId : scopeWarehouseParam,
      from: movementFilters.from || undefined,
      to: movementFilters.to || undefined,
      report: true,
      export: true,
      includeUsers: true,
      sortOrder,
      pageSize: 5000,
    };
    if (amount !== 'all' && amount <= 5000) {
      const response = await inventoryService.getMovements({ ...filters, page: 1, pageSize: amount });
      return toList(response);
    }
    const rows = await fetchAllReportPages(
      (pageFilters) => inventoryService.getMovements(pageFilters),
      filters,
    );
    return amount === 'all' ? rows : rows.slice(0, amount);
  }, [debouncedSearchState, movementFilters, scopeWarehouseParam]);
  const loadingQueries = productListIsActive ? [productsQuery] : activeQueries;
  const loading = loadingQueries.some((query) => query.isPending && !query.data);
  const refreshing = activeQueries.some((query) => query.isFetching) && !loading;
  const firstError = activeQueries.find((query) => query.error)?.error;
  const loadError = firstError ? (firstError as Error).message : '';
  const fetchData = useCallback(async (scope: 'all' | 'products' = 'all') => {
    // El alcance de la sucursal vive en useBranchScope: se refresca junto con
    // el inventario para que los almacenes vinculados (activos) y los
    // productos reflejen la última edición de la sucursal.
    refreshBranches();
    if (scope === 'products') {
      await queryClient.invalidateQueries({ queryKey: ['inventory', 'products', tenantKey] });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['inventory'] });
  }, [queryClient, tenantKey, refreshBranches]);

  // Si la sucursal se edita desde otro módulo (Configuración, etc.), el
  // evento refresca el alcance y vuelve a consultar el inventario para que el
  // filtro por sucursal y los productos queden al día.
  useEffect(() => {
    const handleBranchesChanged = () => {
      refreshBranches();
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    };
    window.addEventListener('sucursales-changed', handleBranchesChanged);
    return () => window.removeEventListener('sucursales-changed', handleBranchesChanged);
  }, [queryClient, refreshBranches]);

  const productItems = data.products.filter((product: any) => product.itemType !== 'SERVICE');
  const serviceItems = data.products.filter((product: any) => product.itemType === 'SERVICE');
  // Lista completa para KPIs (independiente de la paginación de la tabla).
  const summaryProducts = toList(productsSummaryQuery.data).map((product: any) => ({
    ...product,
    itemType: String(product.itemType || product.type || 'PRODUCT').toUpperCase(),
  })).filter((product: any) => isProductInScope(product));
  const availableProductBrands = useMemo(() => {
    const uniqueBrands = new Map<string, string>();
    summaryProducts.forEach((product: any) => {
      const brand = String(product.brand || product.details?.brand || '').trim();
      if (!brand) return;
      const normalized = brand.toLocaleLowerCase();
      if (!uniqueBrands.has(normalized)) uniqueBrands.set(normalized, brand);
    });
    return Array.from(uniqueBrands.values()).sort((left, right) => left.localeCompare(right, 'es', { sensitivity: 'base' }));
  }, [summaryProducts]);

  useEffect(() => {
    const nextTab = activeSubModule === 'dashboard' ? 'productos' : activeSubModule;
    if (!nextTab) return;
    const exists = INVENTORY_SECTIONS.some((section) => section.id === nextTab) && canViewInventorySection(nextTab);
    if (exists) {
      setActiveTab(nextTab);
      if (activeSubModule === 'dashboard') onSubModuleChange?.('productos');
    }
  }, [activeSubModule, canViewInventorySection, onSubModuleChange]);

  useEffect(() => {
    if (canViewInventorySection(activeTab)) return;
    const fallback = INVENTORY_SECTIONS.find((section) => canViewInventorySection(section.id))?.id;
    if (fallback) {
      setActiveTab(fallback);
      onSubModuleChange?.(fallback);
    }
  }, [activeTab, canViewInventorySection, onSubModuleChange]);

  useEffect(() => {
    if (activeTab !== 'productos') setCreateProductViewOpen(false);
  }, [activeTab]);

  const handleExportData = async ({ amount, sortOrder, rows, kind = 'product' }: ProductExportOptions = { amount: 'all', sortOrder: 'asc', scope: 'all', rows: undefined }) => {
    if (!canExportInventory) return;
    try {
      // La consulta de resumen contiene el catálogo completo dentro del
      // alcance actual; usarla evita exportar únicamente la página visible.
      const sourceProducts = Array.isArray(rows)
        ? rows
        : (summaryProducts.length > 0 ? summaryProducts : productItems);
      const orderedProducts = [...sourceProducts]
        .filter((product: any) => kind === 'service'
          ? String(product.itemType || product.type || '').toUpperCase() === 'SERVICE'
          : String(product.itemType || product.type || 'PRODUCT').toUpperCase() !== 'SERVICE')
        .sort((left: any, right: any) => {
          const comparison = String(left.code || left.name || '').localeCompare(String(right.code || right.name || ''), 'es', { numeric: true, sensitivity: 'base' });
          return sortOrder === 'desc' ? -comparison : comparison;
        });
      const productsToExport = amount === 'all' ? orderedProducts : orderedProducts.slice(0, amount);
      const exportWarehouseIds = new Set(productScopeWarehouseIds.map((id) => String(id || '').trim()).filter(Boolean));
      const inExportScope = (level: any) => !selectedBranchId
        || exportWarehouseIds.size === 0
        || exportWarehouseIds.has(String(level?.warehouseId || level?.warehouse?.id || '').trim());
      const getScopedLevels = (product: any) => (Array.isArray(product?.stockLevels) ? product.stockLevels : []).filter(inExportScope);
      const getWarehouseNames = (product: any, levels: any[]) => [...new Set([
        ...(Array.isArray(product?.warehouseCatalogs) ? product.warehouseCatalogs : []).filter(inExportScope).map((entry: any) => entry?.warehouse?.name || entry?.warehouseName),
        ...levels.map((level: any) => level?.warehouse?.name || level?.warehouseName),
      ].map((name) => String(name || '').trim()).filter(Boolean))].join(' · ');
      const getStock = (product: any, levels: any[]) => levels.length > 0
        ? levels.reduce((total: number, level: any) => total + Number(level?.quantity || 0), 0)
        : Number(product?.stock || 0);
      const getConfiguredStockLimit = (product: any, levels: any[], field: 'minStock' | 'maxStock') => {
        const directValue = product?.[field] ?? product?.details?.[field];
        if (directValue !== undefined && directValue !== null && directValue !== '') return directValue;
        const values = levels.map((level: any) => Number(level?.[field])).filter((value) => Number.isFinite(value));
        return values.length > 0 ? Math.max(...values) : '';
      };
      const productHeaders = kind === 'service'
        ? ['Código', 'Nombre', 'Categoría', 'Unidad', 'Precio', ...(canViewInventoryCost ? ['Costo'] : []), 'Estado']
        : ['Código', 'Nombre', 'Marca', 'Cliente', 'Categoría', 'Unidad', 'Nota comercial', 'Stock', 'Stock mínimo', 'Stock máximo', 'Bodegas', 'Precio de venta', ...(canViewInventoryCost ? ['Costo'] : []), 'Estado'];
      const productRows = productsToExport.map((product: any) => {
        if (kind === 'service') return [product.code || '', product.name || '', product.category?.name || product.categoryName || '', product.unit || product.details?.unit || 'servicio', product.salePrice ?? product.price ?? '', ...(canViewInventoryCost ? [product.costPrice ?? product.details?.costPrice ?? ''] : []), product.isActive === false ? 'Inactivo' : 'Activo'];
        const levels = getScopedLevels(product);
        return [
          product.code || '',
          product.name || '',
          product.brand || product.details?.brand || '',
          product.brandCustomerName || product.brandCustomer?.name || '',
          product.category?.name || product.categoryName || '',
          product.unit || product.details?.unit || 'unidad',
          product.commercialNote || '',
          getStock(product, levels),
          getConfiguredStockLimit(product, levels, 'minStock'),
          getConfiguredStockLimit(product, levels, 'maxStock'),
          getWarehouseNames(product, levels),
          product.salePrice ?? product.salePriceOriginal ?? '',
          ...(canViewInventoryCost ? [product.costPrice ?? product.details?.costPrice ?? ''] : []),
          product.isActive === false ? 'Inactivo' : 'Activo',
        ];
      });
      const variantHeaders = ['Código producto', 'SKU variante', 'Nombre variante', 'Atributos y valores', ...(canViewInventoryCost ? ['Costo variante'] : [])];
      const variantRows = productsToExport.flatMap((product: any) => (Array.isArray(product.variants) ? product.variants : []).map((variant: any) => [
        product.code || '',
        variant.sku || '',
        variant.name || '',
        (Array.isArray(variant.attributes) ? variant.attributes : []).map((attribute: any) => `${attribute.attributeName || attribute.name || ''}: ${attribute.value || ''}`).filter(Boolean).join(' · '),
        ...(canViewInventoryCost ? [variant.costPrice ?? ''] : []),
      ]));
      const appendSheet = (workbook: XLSX.WorkBook, name: string, rows: any[][]) => {
        const sheet = XLSX.utils.aoa_to_sheet(rows);
        sheet['!cols'] = (rows[0] || []).map((header) => ({ wch: Math.max(14, Math.min(36, String(header).length + 3)) }));
        XLSX.utils.book_append_sheet(workbook, sheet, name);
      };
      const workbook = XLSX.utils.book_new();
      appendSheet(workbook, 'Productos', [productHeaders, ...productRows]);
      appendSheet(workbook, 'Variantes', [variantHeaders, ...variantRows]);
      appendSheet(workbook, 'Guía de llenado', [
        ['Exportación de productos registrados'],
        [`Este archivo contiene ${productsToExport.length} producto(s) ya ingresados en el catálogo, dentro del alcance de la sucursal actual.`],
        ['Productos', 'Incluye código, nombre, marca, categoría, unidad, nota comercial, existencias, límites de stock, bodegas, precio, estado e imagen.'],
        ['Variantes', 'Incluye el SKU, nombre, atributos y costo de cada variante disponible.'],
        ['Alcance', selectedBranchId ? 'Se exportaron los registros disponibles para la sucursal seleccionada.' : 'Se exportaron los registros disponibles para el alcance actual del usuario.'],
      ]);
       XLSX.writeFile(workbook, buildDateFilteredDownloadFileName([kind === 'service' ? 'reporte_inventario_servicios' : 'reporte_inventario_productos_registrados'], 'xlsx'));
       toast.success(`Archivo Excel descargado con ${productsToExport.length} ${kind === 'service' ? 'servicio(s)' : 'producto(s)'}`);
    } catch {
      toast.error('Error al exportar datos');
    }
  };

  return (
    <div className="inventory-module mx-auto min-w-0 w-full max-w-[1700px] space-y-4 overflow-x-hidden p-3 pb-20 sm:p-6 md:px-10 md:pb-20 md:pt-4">
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
        <div className={cn("mb-4 w-full overflow-x-auto custom-scrollbar", !isSidebarCollapsed && "hidden lg:hidden")}>
        <TabsList className="flex h-auto w-max min-w-full gap-1.5 rounded-2xl border border-border/40 bg-gradient-to-br from-muted/30 to-muted/50 p-1.5 backdrop-blur-sm [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground sm:min-w-0">
          {INVENTORY_SECTIONS.map((section) => {
            if (!canViewInventorySection(section.id)) return null;
            return (
              <TabsTrigger
                key={section.id}
                value={section.id} 
                className="flex min-h-10 min-w-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest sm:min-w-[9rem]
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
              <TabsContent value="productos" className="m-0">
                {createProductViewOpen ? (
                  <CrearProductoView
                    categories={data.categories}
                    warehouses={scopedWarehouses}
                    brands={availableProductBrands}
                    onBack={() => setCreateProductViewOpen(false)}
                    onRefresh={() => fetchData('products')}
                  />
                ) : (
                <Tabs value={productScope} onValueChange={(value) => setProductScope(value as 'branch' | 'linkedWarehouses')} className="w-full">
                  <div className="mb-5 w-full max-w-full">
                    <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border border-border/40 bg-muted/20 p-1 sm:p-1.5">
                      <TabsTrigger
                        value="branch"
                        className="flex h-auto min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-2 py-2 sm:px-4 sm:py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground min-w-0"
                      >
                        <Package className="size-3.5 sm:size-4 shrink-0" />
                        <span className="truncate sm:whitespace-normal">Productos de la sucursal</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="linkedWarehouses"
                        className="flex h-auto min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-2 py-2 sm:px-4 sm:py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground min-w-0"
                      >
                        <Warehouse className="size-3.5 sm:size-4 shrink-0" />
                        <span className="truncate sm:whitespace-normal">Productos de los Almacenes</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="branch" className="m-0">
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                    >
                      <ProductosView
                        products={productItems}
                        summaryProducts={summaryProducts}
                        branches={allBranches}
                        categories={data.categories}
                        warehouses={scopedWarehouses}
                        productWarehouseOptions={productWarehouseOptions}
                        series={data.series}
                        movements={data.movements}
                        onRefresh={() => fetchData('products')}
                        onExport={canExportInventory ? handleExportData : undefined}
                        isRefreshing={refreshing}
                        onCreateProduct={() => setCreateProductViewOpen(true)}
                        pagination={productsPagination}
                        onSearchChange={(value) => updateSearch('productos', value)}
                        onCategoryChange={(value) => updateProductFilters('productos', 'categoryIds', value)}
                        onBrandChange={(value) => updateProductBrandFilter('productos', value)}
                        onWarehouseChange={(value) => updateProductFilters('productos', 'warehouseIds', value)}
                        brandFilter={productBrandFilters.productos || ''}
                        productStatusFilter={productStatusFor('productos')}
                        onProductStatusFilterChange={(value) => updateStatus('productos', value)}
                        stockStatusFilter={productStockStatusFilters.productos || ''}
                        onStockStatusChange={(value) => updateProductStockStatusFilter('productos', value)}
                        targetProductId={productTarget?.id}
                        initialStockFilter={productTarget?.stockFilter}
                        onClearTargetProduct={() => setProductTarget(null)}
                        selectedBranchId={selectedBranchId}
                        branchWarehouseIds={productScopeWarehouseIds}
                        stockWarehouseIds={branchWarehouseIds}
                        isSidebarCollapsed={isSidebarCollapsed}
                      />
                    </motion.div>
                  </TabsContent>
                  <TabsContent value="linkedWarehouses" className="m-0">
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                    >
                      <LinkedWarehouseProductsView selectedBranchId={selectedBranchId} />
                    </motion.div>
                  </TabsContent>
                </Tabs>
                )}
              </TabsContent>
              <TabsContent value="marcas-clientes" className="m-0">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <MarcasClienteView />
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
                    summaryProducts={summaryProducts}
                    branches={allBranches}
                    categories={data.serviceCategories}
                    warehouses={scopedWarehouses}
                    series={data.series}
                    movements={data.movements}
                     onRefresh={() => fetchData()}
                     onExport={canPerform('INVENTORY_SERVICES', 'export') ? handleExportData : undefined}
                     isRefreshing={refreshing}
                    pagination={productsPagination}
                    onSearchChange={(value) => updateSearch('servicios', value)}
                    onCategoryChange={(value) => updateProductFilters('servicios', 'categoryIds', value)}
                    onWarehouseChange={(value) => updateProductFilters('servicios', 'warehouseIds', value)}
                    isSidebarCollapsed={isSidebarCollapsed}
                  />
                </motion.div>
              </TabsContent>
              <TabsContent value="atributos" className="m-0" asChild>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <AtributosView />
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
                    branches={accessibleBranches}
                    selectedBranchId={selectedBranchId}
                    onGoToConfig={() => {
                      setActiveTab('configuracion');
                      onSubModuleChange?.('configuracion');
                    }}
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
                    auditsForAdjustment={toList(pendingAuditsForAdjustmentsQuery.data).filter((audit: any) => inScope(audit.warehouseId))}
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
                    onExportData={exportMovements}
                    onSearchChange={(value) => updateSearch('movimientos', value)}
                    onTypeChange={(value) => updateMovementFilter('type', value)}
                    onWarehouseChange={(value) => updateMovementFilter('warehouseId', value)}
                    onDateChange={updateMovementDateFilter}
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
                    onRefreshWarehouses={refreshWarehouses}
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
                    active={activeTab === 'perdidas'}
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

export default InventarioPage;
