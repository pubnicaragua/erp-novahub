import React, { useState, useEffect } from 'react';
import {
  Users, FileSpreadsheet, ClipboardList, FileText,
  RotateCcw, CreditCard, FileOutput, FileMinus,
  LayoutDashboard, ChevronRight, Menu, X, ShoppingBag, Search, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from './ui/utils';
import { 
  customersService, 
  estimatesService, 
  salesOrdersService, 
  invoicesService, 
  paymentsService,
  recurringInvoicesService,
  salesReturnsService
} from '../services/ventas.service';
import type { 
  Customer, Estimate, SalesOrder, Invoice, 
  PaymentReceived, RecurringInvoice, SalesReturn 
} from '../types';

// New Sub-Views
import { ClientesView } from './ventas/ClientesView';
import { EstimacionesView } from './ventas/EstimacionesView';
import { OrdenesVentaView } from './ventas/OrdenesVentaView';
import { FacturasView } from './ventas/FacturasView';
import { FacturasRecurrentesView } from './ventas/FacturasRecurrentesView';
import { PagosRecibidosView } from './ventas/PagosRecibidosView';
import { DevolucionesView } from './ventas/DevolucionesView';

const SALES_SECTIONS = [
  { id: 'clientes', label: 'Clientes', icon: Users, description: 'Directorio y saldos' },
  { id: 'estimaciones', label: 'Estimaciones', icon: FileSpreadsheet, description: 'Cotizaciones comerciales' },
  { id: 'ordenes', label: 'Órdenes de Venta', icon: ClipboardList, description: 'Pedidos por procesar' },
  { id: 'facturas', label: 'Facturas', icon: FileText, description: 'Control de cobros' },
  { id: 'recurrentes', label: 'Facturas Recurrentes', icon: RotateCcw, description: 'Suscripciones y contratos' },
  { id: 'pagos', label: 'Pagos Recibidos', icon: CreditCard, description: 'Historial de ingresos' },
  { id: 'devoluciones', label: 'Devoluciones', icon: FileOutput, description: 'Notas de crédito y retornos' },
];

interface VentasPageProps {
  activeSubModule?: string;
}

export function VentasPage({ activeSubModule }: VentasPageProps) {
  const [activeSection, setActiveSection] = useState(activeSubModule || 'clientes');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync section with Sidebar prop
  useEffect(() => {
    if (activeSubModule) {
      // Normalize IDs: 'ordenes-venta' -> 'ordenes', etc.
      const normalized = activeSubModule
        .replace('-venta', '')
        .replace('-recibidos', '')
        .replace('facturas-recurrentes', 'recurrentes')
        .replace('pagos-recibidos', 'pagos')
        .replace('devoluciones-venta', 'devoluciones')
        .replace('notas-credito', 'devoluciones'); // Notes redirect to returns for now
      
      const exists = SALES_SECTIONS.some(s => s.id === normalized);
      if (exists) {
        setActiveSection(normalized);
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
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeSection]); // Refetch when section changes to ensure fresh data if needed, or just keep global

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cus, est, ord, inv, pay, rec, ret] = await Promise.all([
        customersService.getAll(),
        estimatesService.getAll(),
        salesOrdersService.getAll(),
        invoicesService.getAll(),
        paymentsService.getAll(),
        recurringInvoicesService.getAll(),
        salesReturnsService.getAll()
      ]);
      
      setData({
        clientes: cus.data || [],
        estimaciones: est.data || [],
        ordenes: ord.data || [],
        facturas: inv.data || [],
        recurrentes: rec.data || [],
        pagos: pay.data || [],
        devoluciones: ret.data || [],
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
    toast.info(`Generando factura para orden ${order.number}...`);
    // Placeholder for real logic
    setTimeout(() => {
      toast.success('Factura generada exitosamente');
      setActiveSection('facturas');
      fetchData();
    }, 1000);
  };

  const handleMarkAsPaid = async (invoice: Invoice) => {
    toast.info(`Registrando pago para factura ${invoice.number}...`);
    // Placeholder for real logic
    setTimeout(() => {
      toast.success('Pago registrado correctamente');
      fetchData();
    }, 1000);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        <header className="sticky top-0 z-20 w-full h-20 bg-background/80 backdrop-blur-md border-b border-border/50 flex items-center justify-between px-6 md:px-10">
           <div className="flex flex-col">
              <div className="flex items-center gap-2 text-muted-foreground/40 text-[10px] font-black uppercase tracking-widest mb-1">
                 <span>Operaciones</span>
                 <ChevronRight className="size-3" />
                 <span className="text-primary/60">{currentSectionInfo.label}</span>
              </div>
              <h2 className="text-xl font-black text-foreground uppercase tracking-tighter">
                {currentSectionInfo.label}
              </h2>
           </div>

           <div className="flex items-center gap-4">
              <Button 
                onClick={fetchData} 
                variant="ghost" 
                size="icon" 
                className="size-10 rounded-full hover:bg-primary/10 transition-colors"
                disabled={loading}
              >
                <RotateCcw className={cn("size-5 text-muted-foreground", loading && "animate-spin")} />
              </Button>
           </div>
        </header>

        <div className="p-6 md:p-10 max-w-[1700px] mx-auto min-h-[calc(100vh-5rem)]">
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
                <EstimacionesView data={data.estimaciones} loading={loading} onRefresh={fetchData} />
              )}
              {activeSection === 'ordenes' || activeSection === 'ordenes-venta' && (
                <OrdenesVentaView data={data.ordenes} loading={loading} onRefresh={fetchData} onGenerateInvoice={handleGenerateInvoice} />
              )}
              {activeSection === 'facturas' && (
                <FacturasView data={data.facturas} loading={loading} onRefresh={fetchData} onMarkAsPaid={handleMarkAsPaid} />
              )}
              {activeSection === 'recurrentes' || activeSection === 'facturas-recurrentes' && (
                <FacturasRecurrentesView data={data.recurrentes} loading={loading} onRefresh={fetchData} />
              )}
              {activeSection === 'pagos' || activeSection === 'pagos-recibidos' && (
                <PagosRecibidosView data={data.pagos} loading={loading} onRefresh={fetchData} />
              )}
              {activeSection === 'devoluciones' || activeSection === 'devoluciones-venta' && (
                <DevolucionesView data={data.devoluciones} loading={loading} onRefresh={fetchData} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
