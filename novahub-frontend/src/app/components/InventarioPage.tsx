import { useState, useEffect, useCallback } from 'react';
import { 
  Package, 
  Warehouse, 
  BarChart3, 
  Truck, 
  Scale, 
  History, 
  Download,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

import { DashboardView } from './inventory/DashboardView';
import { ProductosView } from './inventory/ProductosView';
import { AlmacenesView } from './inventory/AlmacenesView';
import { TransferenciasView } from './inventory/TransferenciasView';
import { ControlStockView } from './inventory/ControlStockView';
import { MovimientosView } from './inventory/MovimientosView';

import { inventoryService } from '../services/inventario.service';
import { motion } from 'motion/react';

const INVENTORY_SECTIONS = [
  { id: 'productos',       label: 'Existencias',     icon: Package,   requiredModules: ['INVENTORY_PRODUCTS'] },
  { id: 'dashboard',       label: 'Resumen',         icon: BarChart3, requiredModules: ['INVENTORY_PRODUCTS', 'INVENTORY_WAREHOUSES', 'INVENTORY_TRANSFERS', 'INVENTORY_ADJUSTMENTS', 'INVENTORY_MOVEMENTS'] },
  { id: 'almacenes',       label: 'Almacenes',       icon: Warehouse, requiredModules: ['INVENTORY_WAREHOUSES'] },
  { id: 'transferencias',  label: 'Transferencias',  icon: Truck,     requiredModules: ['INVENTORY_TRANSFERS'] },
  { id: 'ajustes',         label: 'Ajustes',         icon: Scale,     requiredModules: ['INVENTORY_ADJUSTMENTS'] },
  { id: 'movimientos',     label: 'Movimientos',     icon: History,   requiredModules: ['INVENTORY_MOVEMENTS'] },
];

interface InventarioPageProps {
  activeSubModule?: string;
  onSubModuleChange?: (subModule?: string) => void;
}

export function InventarioPage({ activeSubModule, onSubModuleChange }: InventarioPageProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [data, setData] = useState<any>({
    products: [],
    warehouses: [],
    categories: [],
    transfers: [],
    adjustments: [],
    lots: [],
    series: [],
    movements: []
  });
  const [activeTab, setActiveTab] = useState('productos');

  const fetchData = useCallback(async (showRefresh = false) => {
    try {
      setLoadError('');
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      
      const results = await Promise.allSettled([
        inventoryService.getProducts(),
        inventoryService.getWarehouses(),
        inventoryService.getCategories(),
        inventoryService.getTransfers(),
        inventoryService.getAdjustments(),
        inventoryService.getLots(),
        inventoryService.getSeries(),
        inventoryService.getMovements()
      ]);

      const safeVal = (i: number) => {
        const r = results[i];
        if (r.status !== 'fulfilled') return [];
        const v = (r as any).value;
        return v?.data || (Array.isArray(v) ? v : []);
      };
      if (results[0].status === 'rejected') {
        setLoadError('No pudimos cargar las existencias. Revisa la conexion e intenta nuevamente.');
      }
      setData({
        products: safeVal(0),
        warehouses: safeVal(1),
        categories: safeVal(2),
        transfers: safeVal(3),
        adjustments: safeVal(4),
        lots: safeVal(5),
        series: safeVal(6),
        movements: safeVal(7)
      });
    } catch (error) {
      console.error('Error fetching inventory data:', error);
      toast.error('Error al cargar datos de inventario');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!activeSubModule) return;
    const exists = INVENTORY_SECTIONS.some((section) => section.id === activeSubModule);
    if (exists) setActiveTab(activeSubModule);
  }, [activeSubModule]);

  const handleExportData = async () => {
    try {
      const csvContent = [
        ['Código', 'Nombre', 'Categoría', 'Stock', 'Precio Venta', 'Precio Costo'].join(','),
        ...data.products.map((p: any) => [
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
    } catch (e) {
      toast.error('Error al exportar datos');
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6 pb-20 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Package className="size-9 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none">Inventario</h1>
            <p className="mt-2 text-sm text-muted-foreground">Consulta existencias, precios y disponibilidad en un solo lugar.</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                {data.products.filter((p: any) => (p.itemType || 'PRODUCT').toUpperCase() !== 'SERVICE').length} productos · {data.products.filter((p: any) => (p.itemType || '').toUpperCase() === 'SERVICE').length} servicios · {data.warehouses.length} almacenes
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
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
            Exportar CSV
          </Button>
        </div>
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
        <TabsList className="w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto justify-start pb-2 flex-nowrap gap-1.5 rounded-2xl border border-border/40">
          {INVENTORY_SECTIONS.map((section) => {
            const hasAccess = section.requiredModules.length === 0 || !user?.enabledModules
              || user.enabledModules.includes('INVENTORY')
              || section.requiredModules.some(mod => user.enabledModules.includes(mod));
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
            <div className="space-y-4" aria-label="Cargando inventario">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[0, 1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-muted/60" />)}
              </div>
              <div className="h-96 animate-pulse rounded-2xl bg-muted/40" />
            </div>
          ) : (
            <>
              <TabsContent value="dashboard" className="m-0" asChild>
                <motion.div 
                  initial={{ opacity: 0, y: 16 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }} // Bounce-like slide up
                >
                  <DashboardView 
                    products={data.products} 
                    warehouses={data.warehouses} 
                    movements={data.movements}
                    transfers={data.transfers}
                    adjustments={data.adjustments}
                  />
                </motion.div>
              </TabsContent>
              <TabsContent value="productos" className="m-0" asChild>
                <motion.div 
                  initial={{ opacity: 0, y: 16 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <ProductosView 
                    products={data.products} 
                    categories={data.categories}
                    warehouses={data.warehouses}
                    series={data.series}
                    movements={data.movements}
                    onRefresh={() => fetchData(true)}
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
                    onRefresh={() => fetchData(true)}
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
                    products={data.products}
                    series={data.series}
                    onRefresh={() => fetchData(true)}
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
                    products={data.products}
                    series={data.series}
                    onRefresh={() => fetchData(true)}
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
