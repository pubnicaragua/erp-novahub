import React, { useState, useEffect } from 'react';
import {
  Users, FileSpreadsheet, ClipboardList, FileText,
  RotateCcw, CreditCard, FileOutput, FileMinus,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { useAuth } from '../contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { ShoppingBag } from 'lucide-react';
import { 
  customersService, 
  estimatesService, 
  salesOrdersService, 
  invoicesService, 
  paymentsService,
  recurringInvoicesService,
  salesReturnsService,
  creditNotesService,
} from '../services/ventas.service';
import type { 
  Customer, Estimate, SalesOrder, Invoice, 
  PaymentReceived, RecurringInvoice, SalesReturn,
  CreditNote, Product
} from '../types';
import { inventoryService } from '../services/inventario.service';
import { hrService } from '../services/hr.service';

// Sub-Views
import { ClientesView } from './ventas/ClientesView';
import { EstimacionesView } from './ventas/EstimacionesView';
import { OrdenesVentaView } from './ventas/OrdenesVentaView';
import { FacturasView } from './ventas/FacturasView';
import { FacturasRecurrentesView } from './ventas/FacturasRecurrentesView';
import { PagosRecibidosView } from './ventas/PagosRecibidosView';
import { DevolucionesView } from './ventas/DevolucionesView';
import { NotasCreditoView } from './ventas/NotasCreditoView';

const SALES_SECTIONS = [
  { id: 'clientes', label: 'Clientes', icon: Users, description: 'Directorio y saldos', requiredModules: ['SALES_CLIENTS'] },
  { id: 'estimaciones', label: 'Estimaciones', icon: FileSpreadsheet, description: 'Cotizaciones comerciales', requiredModules: ['SALES_QUOTES'] },
  { id: 'ordenes-venta', label: 'Órdenes de Venta', icon: ClipboardList, description: 'Pedidos por procesar', requiredModules: ['SALES_ORDERS'] },
  { id: 'facturas', label: 'Facturas', icon: FileText, description: 'Control de cobros', requiredModules: ['SALES_INVOICES'] },
  { id: 'facturas-recurrentes', label: 'Facturas Recurrentes', icon: RotateCcw, description: 'Suscripciones y contratos', requiredModules: ['SALES_RECURRING'] },
  { id: 'pagos-recibidos', label: 'Pagos Recibidos', icon: CreditCard, description: 'Historial de ingresos', requiredModules: ['SALES_PAYMENTS'] },
  { id: 'devoluciones-venta', label: 'Devoluciones', icon: FileOutput, description: 'Retornos de mercancía', requiredModules: ['SALES_RETURNS'] },
  { id: 'notas-credito', label: 'Notas de Crédito', icon: FileMinus, description: 'Ajustes y créditos emitidos', requiredModules: ['SALES_CREDIT_NOTES'] },
];

interface VentasPageProps {
  activeSubModule?: string;
  onSubModuleChange?: (sub: string) => void;
}

export function VentasPage({ activeSubModule, onSubModuleChange }: VentasPageProps) {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState(activeSubModule || 'clientes');
  const [invoiceDraft, setInvoiceDraft] = useState<Partial<Invoice> | null>(null);

  // Sync section with Sidebar prop
  useEffect(() => {
    if (activeSubModule) {
      const exists = SALES_SECTIONS.some(s => s.id === activeSubModule);
      if (exists) {
        setActiveSection(activeSubModule);
      }
    }
  }, [activeSubModule]);
  
  // Data State
  const [data, setData] = useState({
    clientes: [] as Customer[],
    estimaciones: [] as Estimate[],
    ordenes: [] as SalesOrder[],
    facturas: [] as Invoice[],
    recurrentes: [] as RecurringInvoice[],
    pagos: [] as PaymentReceived[],
    devoluciones: [] as SalesReturn[],
    notasCredito: [] as CreditNote[],
    productos: [] as Product[],
    series: [] as any[],
    warehouses: [] as any[],
    employees: [] as any[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeSection]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cus, est, ord, inv, pay, rec, ret, cn, prod, series, warehouses, emp] = await Promise.all([
        customersService.getAll(),
        estimatesService.getAll(),
        salesOrdersService.getAll(),
        invoicesService.getAll(),
        paymentsService.getAll(),
        recurringInvoicesService.getAll(),
        salesReturnsService.getAll(),
        creditNotesService.getAll(),
        inventoryService.getProducts(),
        inventoryService.getSeries(),
        inventoryService.getWarehouses(),
        hrService.getEmployees(),
      ]);
      
      const toArr = (r: any) => Array.isArray(r) ? r : (r?.data || []);
      setData({
        clientes: toArr(cus),
        estimaciones: toArr(est),
        ordenes: toArr(ord),
        facturas: toArr(inv),
        recurrentes: toArr(rec),
        pagos: toArr(pay),
        devoluciones: toArr(ret),
        notasCredito: toArr(cn),
        productos: toArr(prod),
        series: toArr(series),
        warehouses: toArr(warehouses),
        employees: toArr(emp),
      });
    } catch (error) {
      console.error('Error fetching sales data:', error);
      toast.error('Error al cargar datos del módulo de Ventas');
    } finally {
      setLoading(false);
    }
  };

  const currentSectionInfo = SALES_SECTIONS.find(s => s.id === activeSection) || SALES_SECTIONS[0];

  const handleGenerateInvoice = async (order: SalesOrder) => {
    toast.info('Preparando borrador de factura...');
    setInvoiceDraft({
      customerId: order.customerId,
      number: `FAC-${Date.now().toString().slice(-6)}`,
      salesOrderId: order.id,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      currency: order.currency || 'NIO',
      exchangeRate: order.exchangeRate,
      items: (order.items?.map(i => ({
        id: Date.now().toString() + Math.random(),
        productId: i.productId,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxRate: i.taxRate,
        discount: i.discount,
        total: i.total
      })) || []) as any,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      discountAmount: order.discountAmount,
      total: order.total,
      notes: order.notes ? `[Desde Orden ${order.number}] ${order.notes}` : `Generado desde Orden ${order.number}`,
    });
    setActiveSection('facturas');
  };



  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="p-6 md:p-10 max-w-[1700px] mx-auto min-h-[calc(100vh-5rem)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <ShoppingBag className="size-9 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
                  Ventas <span className="text-primary">& CRM</span>
                </h1>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                    {data.clientes.length} clientes · {data.facturas.length} facturas
                  </Badge>
                </div>
              </div>
            </div>
            

          </div>

          <Tabs value={activeSection} className="w-full" onValueChange={(val) => { setActiveSection(val); if (onSubModuleChange) onSubModuleChange(val); }}>
            <TabsList className="w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto justify-start pb-2 flex-nowrap gap-1.5 rounded-2xl border border-border/40 mb-6">
              {SALES_SECTIONS.map((section) => {
                const hasAccess = !section.requiredModules || !user?.enabledModules
                  || section.requiredModules.some(mod => user.enabledModules.includes(mod));
                if (!hasAccess) return null;
                return (
                <TabsTrigger 
                  key={section.id} 
                  value={section.id}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
                    data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                    data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
                >
                  <section.icon className="size-4" />
                  <span className="hidden sm:inline">{section.label}</span>
                </TabsTrigger>
                );
              })}
            </TabsList>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeSection === 'clientes' && (
                <ClientesView data={data.clientes} loading={loading} onRefresh={fetchData} />
              )}
              {activeSection === 'estimaciones' && (
                <EstimacionesView data={data.estimaciones} loading={loading} onRefresh={fetchData} customers={data.clientes} products={data.productos} />
              )}
              {activeSection === 'ordenes-venta' && (
                <OrdenesVentaView data={data.ordenes} loading={loading} onRefresh={fetchData} onGenerateInvoice={handleGenerateInvoice} customers={data.clientes} products={data.productos} />
              )}
              {activeSection === 'facturas' && (
                <FacturasView 
                  data={data.facturas} 
                  loading={loading} 
                  onRefresh={fetchData} 
                  customers={data.clientes} 
                  products={data.productos} 
                  series={data.series}
                  warehouses={data.warehouses}
                  employees={data.employees}
                  invoiceDraft={invoiceDraft}
                  onClearInvoiceDraft={() => setInvoiceDraft(null)}
                />
              )}
              {activeSection === 'facturas-recurrentes' && (
                <FacturasRecurrentesView data={data.recurrentes} loading={loading} onRefresh={fetchData} customers={data.clientes} products={data.productos} />
              )}
              {activeSection === 'pagos-recibidos' && (
                <PagosRecibidosView data={data.pagos} loading={loading} onRefresh={fetchData} customers={data.clientes} invoices={data.facturas} />
              )}
              {activeSection === 'devoluciones-venta' && (
                <DevolucionesView data={data.devoluciones} loading={loading} onRefresh={fetchData} customers={data.clientes} invoices={data.facturas} products={data.productos} />
              )}
              {activeSection === 'notas-credito' && (
                <NotasCreditoView data={data.notasCredito} loading={loading} onRefresh={fetchData} customers={data.clientes} />
              )}
            </motion.div>
          </AnimatePresence>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
