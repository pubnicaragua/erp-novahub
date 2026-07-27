import { useEffect, useRef, useState } from 'react';
import { cn } from './ui/utils';
import {
  Users, FileSpreadsheet, ClipboardList, FileText,
  RotateCcw, CreditCard, FileOutput, FileMinus,
  ShoppingCart, BarChart3, Vault, Calculator, Coins
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
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
import { FacturacionCajaView } from './ventas/FacturacionCajaView';
import { ControlDashboardCajaView } from './ventas/ControlDashboardCajaView';

const SALES_SECTIONS = [
  { id: 'clientes', label: 'Clientes', icon: Users, description: 'Directorio y saldos', requiredModules: ['SALES_CLIENTS'] },
  { id: 'estimaciones', label: 'Cotizaciones', icon: FileSpreadsheet, description: 'Cotizaciones comerciales', requiredModules: ['SALES_QUOTES'] },
  { id: 'ordenes-venta', label: 'Órdenes de Venta', icon: ClipboardList, description: 'Pedidos por procesar', requiredModules: ['SALES_ORDERS'] },
  { id: 'facturas', label: 'Facturas', icon: FileText, description: 'Control de cobros', requiredModules: ['SALES_INVOICES'] },
  { id: 'facturas-recurrentes', label: 'Facturas Recurrentes', icon: RotateCcw, description: 'Suscripciones y contratos', requiredModules: ['SALES_RECURRING'] },
  { id: 'pagos-recibidos', label: 'Pagos Recibidos', icon: CreditCard, description: 'Historial de ingresos', requiredModules: ['SALES_PAYMENTS'] },
  { id: 'devoluciones-venta', label: 'Devoluciones', icon: FileOutput, description: 'Retornos de mercancía', requiredModules: ['SALES_RETURNS'] },
  { id: 'notas-credito', label: 'Notas de Crédito', icon: FileMinus, description: 'Ajustes y créditos emitidos', requiredModules: ['SALES_CREDIT_NOTES'] },
  { id: 'facturacion-caja', label: 'Facturación por Caja', icon: Calculator, description: 'POS y facturación directa', requiredModules: ['RETAIL_POS', 'SALES_POS'] },
  { id: 'control-caja', label: 'Control de Caja', icon: Coins, description: 'Apertura, arqueo y dashboard', requiredModules: ['RETAIL_POS', 'SALES_POS'] },
];

interface VentasPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (sub: string) => void;
}

export function VentasPage({ activeSubModule, onSubModuleChange, isSidebarCollapsed }: VentasPageProps) {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState(activeSubModule || 'clientes');
  const [invoiceDraft, setInvoiceDraft] = useState<Partial<Invoice> | null>(null);
  const [targetInvoiceId, setTargetInvoiceId] = useState<string | null>(null);
  const [targetOrderId, setTargetOrderId] = useState<string | null>(null);
  const [controlCajaTargetParams, setControlCajaTargetParams] = useState<{registerId?: string, section?: 'dashboard' | 'session' | 'history'} | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Sync section with Sidebar prop
  useEffect(() => {
    if (activeSubModule) {
      const exists = SALES_SECTIONS.some(s => s.id === activeSubModule);
      if (exists) {
        setActiveSection(activeSubModule);
      }
    }
  }, [activeSubModule]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (activeSection === 'clientes' && tabsRef.current) {
        tabsRef.current.scrollLeft = 0;
        return;
      }
      const activeTab = tabsRef.current?.querySelector<HTMLElement>('[data-state="active"]');
      activeTab?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeSection, isSidebarCollapsed]);
  
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
      const results = await Promise.allSettled([
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
      const val = (i: number) => results[i].status === 'fulfilled' ? toArr((results[i] as any).value) : [];
      
      setData({
        clientes: val(0),
        estimaciones: val(1),
        ordenes: val(2),
        facturas: val(3),
        recurrentes: val(5),
        pagos: val(4),
        devoluciones: val(6),
        notasCredito: val(7),
        productos: val(8),
        series: val(9),
        warehouses: val(10),
        employees: val(11),
      });
    } catch (error) {
      console.error('Error fetching sales data:', error);
      toast.error('Error al cargar datos del módulo de Ventas');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvoice = async (order: SalesOrder) => {
    const existingInvoice = data.facturas.find((invoice) => invoice.salesOrderId === order.id);
    if (existingInvoice) {
      toast.info(`La orden ya está facturada${existingInvoice.number ? ` con ${existingInvoice.number}` : ''}`);
    setTargetInvoiceId(existingInvoice.id);
      setActiveSection('facturas');
      return;
    }
    toast.info('Enviando orden a Facturación...');
    const invoice = await salesOrdersService.convertToInvoice(order.id);
    setInvoiceDraft(null);
    setTargetInvoiceId(invoice.id);
    setActiveSection('facturas');
    await fetchData();
  };

  const handleConvertedQuoteToOrder = (orderId: string) => {
    setTargetOrderId(orderId);
    setActiveSection('ordenes-venta');
  };



  return (
    <div className="sales-module flex min-w-0 flex-1 overflow-x-hidden bg-background w-full">
      <main className="min-w-0 max-w-full flex-1 relative overflow-x-hidden">
        <div className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-[1700px] min-w-0 p-4 sm:p-6 md:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-[66px] shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <ShoppingBag className="size-9 text-primary" />
              </div>
              <div className="min-w-0">
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
            <div className={cn("w-full overflow-x-auto custom-scrollbar mb-6", !isSidebarCollapsed && "hidden lg:hidden")}>
            <TabsList ref={tabsRef} className="flex w-max min-w-full h-auto gap-1.5 bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 rounded-2xl border border-border/40 [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground">
              {SALES_SECTIONS.map((section) => {
                const hasAccess = !section.requiredModules || !user?.enabledModules
                  || user.enabledModules.includes('SALES')
                  || section.requiredModules.some(mod => user.enabledModules.includes(mod));
                if (!hasAccess) return null;
                return (
                <TabsTrigger 
                  key={section.id} 
                  value={section.id}
                  className="flex flex-none shrink-0 items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
                    data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                    data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
                >
                  <section.icon className="size-4" />
                  <span className="hidden sm:inline">{section.label}</span>
                </TabsTrigger>
                );
              })}
            </TabsList>
            </div>
          <AnimatePresence mode="wait">
            <motion.div
              className="min-w-0 max-w-full"
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
                <EstimacionesView data={data.estimaciones} loading={loading} onRefresh={fetchData} onConvertedToOrder={handleConvertedQuoteToOrder} customers={data.clientes} products={data.productos} />
              )}
              {activeSection === 'ordenes-venta' && (
                <OrdenesVentaView data={data.ordenes} loading={loading} onRefresh={fetchData} onGenerateInvoice={handleGenerateInvoice} targetOrderId={targetOrderId} onClearTargetOrderId={() => setTargetOrderId(null)} customers={data.clientes} products={data.productos} employees={data.employees} />
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
                  invoiceDraft={invoiceDraft || undefined}
                  onClearInvoiceDraft={() => setInvoiceDraft(null)}
                  targetInvoiceId={targetInvoiceId}
                  onClearTargetInvoiceId={() => setTargetInvoiceId(null)}
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
              {activeSection === 'facturacion-caja' && (
                <FacturacionCajaView 
                  onNavigateToControlCaja={(registerId) => {
                    setControlCajaTargetParams(registerId ? { registerId, section: 'dashboard' } : null);
                    setActiveSection('control-caja');
                    onSubModuleChange?.('control-caja');
                  }}
                />
              )}
              {activeSection === 'control-caja' && (
                <ControlDashboardCajaView 
                  onNavigateToFacturacion={() => {
                    setActiveSection('facturacion-caja');
                    if (onSubModuleChange) onSubModuleChange('facturacion-caja');
                  }}
                  initialRegisterId={controlCajaTargetParams?.registerId}
                  initialSection={controlCajaTargetParams?.section}
                />
              )}
            </motion.div>
          </AnimatePresence>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
