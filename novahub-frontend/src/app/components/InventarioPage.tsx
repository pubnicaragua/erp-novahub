import { cn } from './ui/utils';
import { useState, useEffect, useCallback } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

import { ProductosView } from './inventory/ProductosView';
import { ServiciosView } from './inventory/ServiciosView';
import { AlmacenesView } from './inventory/AlmacenesView';
import { TransferenciasView } from './inventory/TransferenciasView';
import { ControlStockView } from './inventory/ControlStockView';
import { MovimientosView } from './inventory/MovimientosView';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useCurrency } from '../contexts/CurrencyContext';

import { inventoryService } from '../services/inventario.service';
import { motion } from 'motion/react';
import { Skeleton as BoneyardSkeleton } from 'boneyard-js/react';
import { BranchScopeFilter } from './ui/BranchScopeFilter';

const INVENTORY_SECTIONS = [
  { id: 'dashboard',       label: 'Resumen',         icon: Package,   requiredModules: ['INVENTORY_DASHBOARD'] },
  { id: 'productos',       label: 'Productos',       icon: Package,   requiredModules: ['INVENTORY_PRODUCTS'] },
  { id: 'servicios',       label: 'Servicios',       icon: BriefcaseBusiness, requiredModules: ['INVENTORY_PRODUCTS'] },
  { id: 'almacenes',       label: 'Almacenes',       icon: Warehouse, requiredModules: ['INVENTORY_WAREHOUSES'] },
  { id: 'transferencias',  label: 'Transferencias',  icon: Truck,     requiredModules: ['INVENTORY_TRANSFERS'] },
  { id: 'ajustes',         label: 'Ajustes',         icon: Scale,     requiredModules: ['INVENTORY_ADJUSTMENTS'] },
  { id: 'movimientos',     label: 'Movimientos',     icon: History,   requiredModules: ['INVENTORY_MOVEMENTS'] },
];

interface InventarioPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (subModule?: string) => void;
}

export function InventarioPage({ activeSubModule, onSubModuleChange, isSidebarCollapsed}: InventarioPageProps) {
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(activeSubModule || 'productos');
  const tenantKey = user?.tenantId || 'anonymous';

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
    queryKey: ['inventory', 'products', tenantKey],
    queryFn: () => inventoryService.getProducts(),
    enabled: Boolean(user) && ['dashboard', 'productos', 'servicios', 'transferencias', 'ajustes'].includes(activeTab),
  });
  const warehousesQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'warehouses', tenantKey],
    queryFn: inventoryService.getWarehouses,
    enabled: Boolean(user) && activeTab !== 'dashboard',
  });
  const categoriesQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'categories', tenantKey],
    queryFn: inventoryService.getCategories,
    enabled: Boolean(user) && ['productos', 'servicios'].includes(activeTab),
  });
  const transfersQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'transfers', tenantKey],
    queryFn: inventoryService.getTransfers,
    enabled: Boolean(user) && activeTab === 'transferencias',
  });
  const adjustmentsQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'adjustments', tenantKey],
    queryFn: inventoryService.getAdjustments,
    enabled: Boolean(user) && activeTab === 'ajustes',
  });
  const seriesQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'series', tenantKey],
    queryFn: inventoryService.getSeries,
    enabled: Boolean(user) && ['productos', 'servicios', 'transferencias', 'ajustes'].includes(activeTab),
  });
  const movementsQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'movements', tenantKey],
    queryFn: inventoryService.getMovements,
    enabled: Boolean(user) && ['productos', 'servicios', 'transferencias', 'ajustes', 'movimientos'].includes(activeTab),
  });
  const dashboardQuery = useQuery({
    ...commonQueryOptions,
    queryKey: ['inventory', 'dashboard', tenantKey],
    queryFn: inventoryService.getDashboardStats,
    enabled: Boolean(user) && activeTab === 'dashboard',
  });
  const categories = toList(categoriesQuery.data).map((category: any) => ({
    ...category,
    type: String(category.type || 'PRODUCT').toUpperCase(),
  }));
  const data = {
    products: toList(productsQuery.data).map((product: any) => ({
      ...product,
      itemType: String(product.itemType || product.type || 'PRODUCT').toUpperCase(),
    })),
    warehouses: toList(warehousesQuery.data),
    categories: categories.filter((category: any) => category.type === 'PRODUCT'),
    serviceCategories: categories.filter((category: any) => category.type === 'SERVICE'),
    transfers: toList(transfersQuery.data),
    adjustments: toList(adjustmentsQuery.data),
    lots: [],
    series: toList(seriesQuery.data),
    movements: toList(movementsQuery.data),
    dashboardStats: dashboardQuery.data?.data || dashboardQuery.data || null,
  };
  const activeQueries = [
    ...(productsQuery.isEnabled ? [productsQuery] : []),
    ...(warehousesQuery.isEnabled ? [warehousesQuery] : []),
    ...(categoriesQuery.isEnabled ? [categoriesQuery] : []),
    ...(transfersQuery.isEnabled ? [transfersQuery] : []),
    ...(adjustmentsQuery.isEnabled ? [adjustmentsQuery] : []),
    ...(seriesQuery.isEnabled ? [seriesQuery] : []),
    ...(movementsQuery.isEnabled ? [movementsQuery] : []),
    ...(dashboardQuery.isEnabled ? [dashboardQuery] : []),
  ];
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
    if (!activeSubModule) return;
    const exists = INVENTORY_SECTIONS.some((section) => section.id === activeSubModule);
    if (exists) setActiveTab(activeSubModule);
  }, [activeSubModule]);

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
    <div className="mx-auto min-w-0 w-full max-w-[1700px] space-y-4 overflow-x-hidden p-4 pb-20 sm:p-6 md:p-10">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-[66px] shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Package className="size-9 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
              Inventario <span className="text-primary">&amp; Stock</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Gestiona existencias, precios, almacenes y movimientos en un solo lugar.</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                {productItems.length} productos · {serviceItems.length} servicios · {data.warehouses.length} almacenes
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData()}
            disabled={refreshing}
            className="rounded-xl font-bold"
          >
            <RefreshCw className={`size-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportData}
            className="rounded-xl font-bold"
          >
            <Download className="size-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Branch Scope Filter */}
      <div className="flex items-center justify-between mb-4">
        <BranchScopeFilter />
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
        <div className={cn("w-full overflow-x-auto custom-scrollbar mb-6", !isSidebarCollapsed && "hidden lg:hidden")}>
        <TabsList className="flex w-max min-w-full h-auto gap-1.5 bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 rounded-2xl border border-border/40 [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground">
          {INVENTORY_SECTIONS.map((section) => {
            const hasRequired = section.requiredModules && section.requiredModules.some(mod => user?.enabledModules?.includes(mod));
            const hasSpecificSubmodules = user?.enabledModules?.some(m => m.startsWith('INVENTORY_'));
            const hasFallback = user?.enabledModules?.includes('INVENTORY') && !hasSpecificSubmodules;
            const hasAccess = !user?.enabledModules || section.requiredModules.length === 0 || hasRequired || hasFallback;
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

        <div className="mt-4 min-h-[600px]">
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
              <TabsContent value="dashboard" className="m-0" asChild>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <Card className="rounded-2xl border-border/40 shadow-sm">
                        <CardContent className="p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Productos</p>
                          <p className="text-2xl font-black mt-1">{productItems.length}</p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-2xl border-border/40 shadow-sm">
                        <CardContent className="p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Almacenes</p>
                          <p className="text-2xl font-black mt-1">{data.warehouses.length}</p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-2xl border-border/40 shadow-sm">
                        <CardContent className="p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor Inventario</p>
                          <p className="text-2xl font-black mt-1">{formatAmount(productItems.reduce((acc: number, p: any) => acc + Number(p.stock || 0) * Number(p.costPrice || 0), 0))}</p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-2xl border-border/40 shadow-sm">
                        <CardContent className="p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Stock Bajo</p>
                          <p className="text-2xl font-black mt-1 text-amber-500">{productItems.filter((p: any) => Number(p.stock || 0) > 0 && Number(p.stock || 0) < 10).length}</p>
                        </CardContent>
                      </Card>
                    </div>
                    {data.dashboardStats && (
                      <Card className="rounded-2xl border-border/40 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-sm font-black uppercase tracking-tight">Dashboard de Inventario</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-xs text-muted-foreground overflow-auto max-h-80">
                            {JSON.stringify(data.dashboardStats, null, 2)}
                          </pre>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </motion.div>
              </TabsContent>
              <TabsContent value="productos" className="m-0" asChild>
                <motion.div 
                  initial={{ opacity: 0, y: 16 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <ProductosView 
                    products={productItems}
                    categories={data.categories}
                    warehouses={data.warehouses}
                    series={data.series}
                    movements={data.movements}
                    onRefresh={() => fetchData('products')}
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
                    warehouses={data.warehouses}
                    series={data.series}
                    movements={data.movements}
                    onRefresh={() => fetchData()}
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
                    warehouses={data.warehouses}
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
                    warehouses={data.warehouses}
                    products={productItems}
                    series={data.series}
                    onRefresh={() => fetchData()}
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
                    warehouses={data.warehouses}
                    products={productItems}
                    series={data.series}
                    onRefresh={() => fetchData()}
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
                    warehouses={data.warehouses}
                  />
                </motion.div>
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
