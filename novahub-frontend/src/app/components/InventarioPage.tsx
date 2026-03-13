import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, 
  Warehouse, 
  BarChart3, 
  Truck, 
  Scale, 
  History, 
  Download,
  Plus,
  RefreshCw
} from 'lucide-react';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';

import { DashboardView } from './inventory/DashboardView';
import { ProductosView } from './inventory/ProductosView';
import { AlmacenesView } from './inventory/AlmacenesView';
import { TransferenciasView } from './inventory/TransferenciasView';
import { ControlStockView } from './inventory/ControlStockView';
import { MovimientosView } from './inventory/MovimientosView';

import { inventoryService } from '../services/inventario.service';

export function InventarioPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      
      const [
        productsRes, 
        warehousesRes, 
        categoriesRes,
        transfersRes,
        adjustmentsRes,
        lotsRes,
        seriesRes,
        movementsRes
      ] = await Promise.all([
        inventoryService.getProducts(),
        inventoryService.getWarehouses(),
        inventoryService.getCategories(),
        inventoryService.getTransfers(),
        inventoryService.getAdjustments(),
        inventoryService.getLots(),
        inventoryService.getSeries(),
        inventoryService.getMovements()
      ]);

      setData({
        products: productsRes.data || [],
        warehouses: warehousesRes || [],
        categories: categoriesRes || [],
        transfers: transfersRes || [],
        adjustments: adjustmentsRes || [],
        lots: lotsRes || [],
        series: seriesRes || [],
        movements: movementsRes || []
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
          <div className="p-3 bg-[#05602b] rounded-xl">
            <Package className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inventario</h1>
            <p className="text-sm text-muted-foreground">
              {data.products.length} productos · {data.warehouses.length} almacenes
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`size-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportData}
          >
            <Download className="size-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
        <TabsList className="w-full h-12 bg-muted/50 p-1">
          <TabsTrigger value="dashboard" className="flex-1 gap-2 data-[state=active]:bg-background">
            <BarChart3 className="size-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="productos" className="flex-1 gap-2 data-[state=active]:bg-background">
            <Package className="size-4" />
            <span className="hidden sm:inline">Productos</span>
          </TabsTrigger>
          <TabsTrigger value="almacenes" className="flex-1 gap-2 data-[state=active]:bg-background">
            <Warehouse className="size-4" />
            <span className="hidden sm:inline">Almacenes</span>
          </TabsTrigger>
          <TabsTrigger value="transferencias" className="flex-1 gap-2 data-[state=active]:bg-background">
            <Truck className="size-4" />
            <span className="hidden sm:inline">Transferencias</span>
          </TabsTrigger>
          <TabsTrigger value="ajustes" className="flex-1 gap-2 data-[state=active]:bg-background">
            <Scale className="size-4" />
            <span className="hidden sm:inline">Ajustes</span>
          </TabsTrigger>
          <TabsTrigger value="movimientos" className="flex-1 gap-2 data-[state=active]:bg-background">
            <History className="size-4" />
            <span className="hidden sm:inline">Movimientos</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 min-h-[600px]">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="size-10 border-4 border-muted border-t-[#05602b] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <TabsContent value="dashboard" className="m-0">
                <DashboardView 
                  products={data.products} 
                  warehouses={data.warehouses} 
                  movements={data.movements}
                  transfers={data.transfers}
                  adjustments={data.adjustments}
                />
              </TabsContent>
              <TabsContent value="productos" className="m-0">
                <ProductosView 
                  products={data.products} 
                  categories={data.categories}
                  warehouses={data.warehouses}
                  onRefresh={() => fetchData(true)}
                />
              </TabsContent>
              <TabsContent value="almacenes" className="m-0">
                <AlmacenesView 
                  warehouses={data.warehouses}
                  onRefresh={() => fetchData(true)}
                />
              </TabsContent>
              <TabsContent value="transferencias" className="m-0">
                <TransferenciasView 
                  transfers={data.transfers}
                  warehouses={data.warehouses}
                  products={data.products}
                  onRefresh={() => fetchData(true)}
                />
              </TabsContent>
              <TabsContent value="ajustes" className="m-0">
                <ControlStockView 
                  adjustments={data.adjustments}
                  warehouses={data.warehouses}
                  products={data.products}
                  onRefresh={() => fetchData(true)}
                />
              </TabsContent>
              <TabsContent value="movimientos" className="m-0">
                <MovimientosView 
                  movements={data.movements}
                  warehouses={data.warehouses}
                />
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
