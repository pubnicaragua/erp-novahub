import { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart, Truck, Wallet, CalendarClock,
  ClipboardList, PackageCheck, FileInput, RotateCcw,
  Banknote, BadgeDollarSign,
  ClipboardPen,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useBranchScope } from '../hooks/useBranchScope';
import { BranchScopeFilter } from './ui/BranchScopeFilter';
import {
  suppliersService, expensesService, recurringExpensesService,
  purchaseOrdersService, purchaseReceiptsService,
  supplierInvoicesService, recurringSupplierInvoicesService,
  paymentsMadeService, supplierCreditsService,
  purchaseRequestsService,
} from '../services/compras.service';
import type {
  Supplier, Expense, RecurringExpense, PurchaseOrder,
  PurchaseReceipt, SupplierInvoice, RecurringSupplierInvoice,
  PaymentMade, SupplierCredit, PurchaseRequest,
} from '../types';

import { ProveedoresView }         from './compras/ProveedoresView';
import { GastosView }              from './compras/GastosView';
import { GastosRecurrentesView }   from './compras/GastosRecurrentesView';
import { OrdenesCompraView }       from './compras/OrdenesCompraView';
import { RecepcionesCompraView }   from './compras/RecepcionesCompraView';
import { FacturasProveedorView }   from './compras/FacturasProveedorView';
import { FacturasProveedorRecView } from './compras/FacturasProveedorRecView';
import { PagosRealizadosView }     from './compras/PagosRealizadosView';
import { CreditosProveedorView }   from './compras/CreditosProveedorView';
import { SolicitudCompraView }     from './compras/SolicitudCompraView';

const COMPRAS_SECTIONS = [
  { id: 'solicitudes',   label: 'Solicitudes',         icon: ClipboardPen,   description: 'Solicitudes de compra', requiredModules: ['PURCHASES_REQUESTS', 'PURCHASES'] },
  { id: 'proveedores',   label: 'Proveedores',          icon: Truck,          description: 'Directorio de proveedores', requiredModules: ['PURCHASES_PROVIDERS', 'PURCHASES'] },
  { id: 'gastos',        label: 'Gastos',               icon: Wallet,         description: 'Registro de gastos', requiredModules: ['PURCHASES_EXPENSES', 'PURCHASES'] },
  { id: 'gastos-rec',    label: 'Gastos Recurrentes',   icon: CalendarClock,  description: 'Gastos fijos periódicos', requiredModules: ['PURCHASES_EXPENSES_REC', 'PURCHASES'] },
  { id: 'ordenes',       label: 'Órdenes de Compra',    icon: ClipboardList,  description: 'Pedidos a proveedores', requiredModules: ['PURCHASES_ORDERS', 'PURCHASES'] },
  { id: 'recepciones',   label: 'Recepciones',          icon: PackageCheck,   description: 'Entrada de mercancía', requiredModules: ['PURCHASES_RECEIPTS', 'PURCHASES'] },
  { id: 'facturas-prov', label: 'Facturas Proveedor',  icon: FileInput,      description: 'Cuentas por pagar', requiredModules: ['PURCHASES_INVOICES', 'PURCHASES'] },
  { id: 'facturas-rec',  label: 'Facturas Recurrentes', icon: RotateCcw,      description: 'Contratos periódicos', requiredModules: ['PURCHASES_INVOICES_REC', 'PURCHASES'] },
  { id: 'pagos',         label: 'Pagos Realizados',    icon: Banknote,       description: 'Histórico de pagos', requiredModules: ['PURCHASES_PAYMENTS', 'PURCHASES'] },
  { id: 'creditos',      label: 'Créditos Proveedor',  icon: BadgeDollarSign, description: 'Notas de crédito', requiredModules: ['PURCHASES_RETURNS', 'PURCHASES'] },
];

interface ComprasPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
}

type ComprasData = {
  proveedores:   Supplier[];
  gastos:        Expense[];
  gastosRec:     RecurringExpense[];
  ordenes:       PurchaseOrder[];
  recepciones:   PurchaseReceipt[];
  facturasProv:  SupplierInvoice[];
  facturasRec:   RecurringSupplierInvoice[];
  pagos:         PaymentMade[];
  creditos:      SupplierCredit[];
  solicitudes:   PurchaseRequest[];
};

export function ComprasPage({ activeSubModule, isSidebarCollapsed}: ComprasPageProps) {
  const { user } = useAuth();
  const { selectedBranchId, filterByBranch, isRestricted, accessibleBranches } = useBranchScope();
  const normalize = (s?: string) => {
    if (!s) return 'solicitudes';
    const map: Record<string, string> = {
      'solicitudes': 'solicitudes',
      'solicitudes-compra': 'solicitudes',
      'proveedores': 'proveedores',
      'gastos': 'gastos',
      'gastos-recurrentes': 'gastos-rec',
      'ordenes-compra': 'ordenes',
      'recepciones-compra': 'recepciones',
      'facturas-proveedor': 'facturas-prov',
      'facturas-proveedor-rec': 'facturas-rec',
      'pagos-realizados': 'pagos',
      'creditos-proveedor': 'creditos',
    };
    return map[s] || s;
  };

  const tabsRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState(normalize(activeSubModule));
  const [draftInvoiceFromOrder, setDraftInvoiceFromOrder] = useState<any>(null);
  const [draftPaymentFromInvoice, setDraftPaymentFromInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ComprasData>({
    proveedores: [], gastos: [], gastosRec: [], ordenes: [],
    recepciones: [], facturasProv: [], facturasRec: [], pagos: [], creditos: [],
    solicitudes: [],
  });

  const handleConvertToInvoice = (draft: any) => {
    setDraftInvoiceFromOrder(draft);
    setActiveSection('facturas-prov');
  };

  const handleRegisterPaymentFromInvoice = (draft: any) => {
    setDraftPaymentFromInvoice(draft);
    setActiveSection('pagos');
  };

  useEffect(() => {
    if (activeSubModule) setActiveSection(normalize(activeSubModule));
  }, [activeSubModule]);

  useEffect(() => { fetchData(); }, [activeSection]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (activeSection === 'solicitudes' && tabsRef.current) {
        tabsRef.current.scrollLeft = 0;
        return;
      }
      const activeTab = tabsRef.current?.querySelector<HTMLElement>('[data-state="active"]');
      activeTab?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeSection]);

  const toArr = (r: any) => Array.isArray(r) ? r : (r?.data || []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sup, exp, expRec, ord, rec, inv, invRec, pay, cred, req] = await Promise.all([
        suppliersService.getAll().catch(() => []),
        expensesService.getAll().catch(() => []),
        recurringExpensesService.getAll().catch(() => []),
        purchaseOrdersService.getAll().catch(() => []),
        purchaseReceiptsService.getAll().catch(() => []),
        supplierInvoicesService.getAll().catch(() => []),
        recurringSupplierInvoicesService.getAll().catch(() => []),
        paymentsMadeService.getAll().catch(() => []),
        supplierCreditsService.getAll().catch(() => []),
        purchaseRequestsService.getAll().catch(() => []),
      ]);
      setData({
        proveedores:   toArr(sup),
        gastos:        toArr(exp),
        gastosRec:     toArr(expRec),
        ordenes:       toArr(ord),
        recepciones:   toArr(rec),
        facturasProv:  toArr(inv),
        facturasRec:   toArr(invRec),
        pagos:         toArr(pay),
        creditos:      toArr(cred),
        solicitudes:   toArr(req),
      });
    } catch (e: any) {
      toast.error('Error al cargar módulo de Compras');
    } finally {
      setLoading(false);
    }
  };

  const filteredData = {
    proveedores: filterByBranch(data.proveedores),
    gastos: filterByBranch(data.gastos),
    gastosRec: filterByBranch(data.gastosRec),
    ordenes: filterByBranch(data.ordenes),
    recepciones: filterByBranch(data.recepciones),
    facturasProv: filterByBranch(data.facturasProv),
    facturasRec: filterByBranch(data.facturasRec),
    pagos: filterByBranch(data.pagos),
    creditos: filterByBranch(data.creditos),
    solicitudes: filterByBranch(data.solicitudes),
  };

  return (
    <div className="purchases-module flex min-w-0 flex-1 overflow-x-hidden bg-background w-full">
      <main className="min-w-0 max-w-full flex-1 relative overflow-x-hidden">
        <div className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-[1700px] min-w-0 p-4 sm:p-6 md:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-[66px] shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Truck className="size-9 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
                  Compras <span className="text-primary">& Abastecimiento</span>
                </h1>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                    {data.proveedores.length} proveedores · {data.ordenes.length} órdenes
                  </Badge>
                  {isRestricted && (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                      {accessibleBranches.length} sucursal(es)
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <BranchScopeFilter className="ml-auto" showLabel={false} />
          </div>

          <Tabs value={activeSection} className="w-full" onValueChange={(val) => { setActiveSection(val); }}>
        <div className={cn("w-full overflow-x-auto custom-scrollbar mb-6", !isSidebarCollapsed && "hidden lg:hidden")}>
        <TabsList ref={tabsRef} className="flex w-max min-w-full h-auto gap-1.5 bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 rounded-2xl border border-border/40 [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground">
              {COMPRAS_SECTIONS.map((section) => {
                const hasRequired = section.requiredModules && section.requiredModules.some(mod => user?.enabledModules?.includes(mod));
                const hasSpecificSubmodules = user?.enabledModules?.some(m => m.startsWith('PURCHASES_'));
                const hasFallback = user?.enabledModules?.includes('PURCHASES') && !hasSpecificSubmodules;
                const hasAccess = !user?.enabledModules || !section.requiredModules || hasRequired || hasFallback;
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
            {COMPRAS_SECTIONS.map(section => {
               if (activeSection !== section.id) return null;
               const commonProps = { loading, onRefresh: fetchData };
               return (
                 <motion.div
                   className="min-w-0 max-w-full"
                   key={section.id}
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -10 }}
                   transition={{ duration: 0.2 }}
                 >
                    {section.id === 'solicitudes'  && <SolicitudCompraView  {...commonProps} data={filteredData.solicitudes} />}
                    {section.id === 'proveedores'  && <ProveedoresView    {...commonProps} data={filteredData.proveedores} />}
                    {section.id === 'gastos'        && <GastosView         {...commonProps} data={filteredData.gastos} />}
                    {section.id === 'gastos-rec'    && <GastosRecurrentesView {...commonProps} data={filteredData.gastosRec} />}
                     {section.id === 'ordenes'       && <OrdenesCompraView  {...commonProps} data={filteredData.ordenes} supplierInvoices={filteredData.facturasProv} onConvertToInvoice={handleConvertToInvoice} />}
                     {section.id === 'recepciones'   && <RecepcionesCompraView {...commonProps} data={filteredData.recepciones} onConvertToInvoice={handleConvertToInvoice} />}
                   {section.id === 'facturas-prov' && (
                     <FacturasProveedorView
                       {...commonProps}
                       data={filteredData.facturasProv}
                       draftInvoiceFromOrder={draftInvoiceFromOrder}
                       onDraftConsumed={() => setDraftInvoiceFromOrder(null)}
                       onRegisterPaymentFromInvoice={handleRegisterPaymentFromInvoice}
                     />
                   )}
                   {section.id === 'facturas-rec'  && <FacturasProveedorRecView {...commonProps} data={filteredData.facturasRec} />}
                   {section.id === 'pagos'         && (
                    <PagosRealizadosView
                      {...commonProps}
                      data={filteredData.pagos}
                      supplierInvoices={filteredData.facturasProv}
                      draftPaymentFromInvoice={draftPaymentFromInvoice}
                      onDraftConsumed={() => setDraftPaymentFromInvoice(null)}
                    />
                   )}
                   {section.id === 'creditos'      && <CreditosProveedorView {...commonProps} data={filteredData.creditos} />}
                 </motion.div>
               );
            })}
          </AnimatePresence>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
