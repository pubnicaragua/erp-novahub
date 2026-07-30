import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { cn } from './ui/utils';
import {
  Users, FileSpreadsheet, ClipboardList, FileText,
  RotateCcw, CreditCard, FileOutput, FileMinus,
  ShoppingCart, BarChart3, Vault, Calculator, Coins, Tags
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useBranchScope } from '../hooks/useBranchScope';
import { BranchScopeFilter } from './ui/BranchScopeFilter';
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
import type { SalesPageSize, SalesPaginationControls } from '../types';
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
import { PriceListsView } from './ventas/PriceListsView';

const SALES_SECTIONS = [
  { id: 'clientes', label: 'Clientes', icon: Users, description: 'Directorio y saldos', requiredModules: ['SALES_CLIENTS'] },
  { id: 'estimaciones', label: 'Cotizaciones', icon: FileSpreadsheet, description: 'Cotizaciones comerciales', requiredModules: ['SALES_QUOTES'] },
  { id: 'ordenes-venta', label: 'Órdenes de Venta', icon: ClipboardList, description: 'Pedidos por procesar', requiredModules: ['SALES_ORDERS'] },
  { id: 'facturas', label: 'Facturas', icon: FileText, description: 'Control de cobros', requiredModules: ['SALES_INVOICES'] },
  { id: 'facturas-recurrentes', label: 'Facturas Recurrentes', icon: RotateCcw, description: 'Suscripciones y contratos', requiredModules: ['SALES_RECURRING'] },
  { id: 'pagos-recibidos', label: 'Pagos Recibidos', icon: CreditCard, description: 'Historial de ingresos', requiredModules: ['SALES_PAYMENTS'] },
  { id: 'devoluciones-venta', label: 'Devoluciones', icon: FileOutput, description: 'Retornos de mercancía', requiredModules: ['SALES_RETURNS'] },
  { id: 'notas-credito', label: 'Notas de Crédito', icon: FileMinus, description: 'Ajustes y créditos emitidos', requiredModules: ['SALES_CREDIT_NOTES'] },
  { id: 'listas-precios', label: 'Listas de Precios', icon: Tags, description: 'Tarifas de venta', requiredModules: ['SALES'] },
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
  const { selectedBranchId, filterByBranch, isRestricted, accessibleBranches } = useBranchScope();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState(activeSubModule || 'clientes');
  const [invoiceDraft, setInvoiceDraft] = useState<Partial<Invoice> | null>(null);
  const [targetInvoiceId, setTargetInvoiceId] = useState<string | null>(null);
  const [targetOrderId, setTargetOrderId] = useState<string | null>(null);
  const [controlCajaTargetParams, setControlCajaTargetParams] = useState<{registerId?: string, section?: 'dashboard' | 'session' | 'history'} | null>(null);
  const [searchState, setSearchState] = useState<Record<string, string>>({});
  const [debouncedSearchState, setDebouncedSearchState] = useState<Record<string, string>>({});
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
  
  const tenantKey = user?.tenantId || 'anonymous';
  const toArray = (response: any) => Array.isArray(response) ? response : (response?.data || []);
  const [paginationState, setPaginationState] = useState<Record<string, { page: number; pageSize: SalesPageSize }>>({});
  const pageFor = (section: string) => paginationState[section] || { page: 1, pageSize: 50 as SalesPageSize };
  const updatePage = (section: string, page: number) => setPaginationState((current) => ({
    ...current,
    [section]: { ...pageFor(section), page: Math.max(1, page) },
  }));
  const updatePageSize = (section: string, pageSize: SalesPageSize) => setPaginationState((current) => ({
    ...current,
    [section]: { page: 1, pageSize },
  }));
  const updateSearch = (section: string, value: string) => {
    setSearchState((current) => ({ ...current, [section]: value }));
    updatePage(section, 1);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchState(searchState), 350);
    return () => window.clearTimeout(timer);
  }, [searchState]);
  const searchFor = (section: string) => debouncedSearchState[section]?.trim() || undefined;
  const isListSection = !['facturacion-caja', 'control-caja'].includes(activeSection);
  const needsCatalogs = isListSection && activeSection !== 'clientes';
  const needsProducts = ['estimaciones', 'ordenes-venta', 'facturas', 'devoluciones-venta'].includes(activeSection);
  const needsInvoices = ['ordenes-venta', 'facturas', 'pagos-recibidos', 'devoluciones-venta'].includes(activeSection);
  const customersPage = pageFor('clientes');
  const estimatesPage = pageFor('estimaciones');
  const ordersPage = pageFor('ordenes-venta');
  const invoicesPage = pageFor('facturas');
  const paymentsPage = pageFor('pagos-recibidos');
  const recurringPage = pageFor('facturas-recurrentes');
  const returnsPage = pageFor('devoluciones-venta');
  const creditNotesPage = pageFor('notas-credito');

  // TanStack Query keeps the active tab fast and prevents duplicate requests.
  // Catalogs use the maximum allowed page so existing comboboxes keep all their
  // current options while the transactional tables use the default page of 50.
  const customersListQuery = useQuery({
    queryKey: ['sales', 'customers', tenantKey, customersPage.page, customersPage.pageSize, searchFor('clientes')],
    queryFn: () => customersService.getAll({ page: customersPage.page, pageSize: customersPage.pageSize, search: searchFor('clientes') }),
    enabled: activeSection === 'clientes',
    placeholderData: keepPreviousData,
  });
  const customersCatalogQuery = useQuery({
    queryKey: ['sales', 'customers-catalog', tenantKey, 1, 200],
    queryFn: () => customersService.getAll({ page: 1, pageSize: 200, status: 'ACTIVE' }),
    enabled: needsCatalogs,
    placeholderData: keepPreviousData,
  });
  const estimatesQuery = useQuery({
    queryKey: ['sales', 'estimates', tenantKey, estimatesPage.page, estimatesPage.pageSize, searchFor('estimaciones')],
    queryFn: () => estimatesService.getAll({ page: estimatesPage.page, pageSize: estimatesPage.pageSize, search: searchFor('estimaciones') }),
    enabled: activeSection === 'estimaciones',
    placeholderData: keepPreviousData,
  });
  const ordersQuery = useQuery({
    queryKey: ['sales', 'orders', tenantKey, ordersPage.page, ordersPage.pageSize, searchFor('ordenes-venta')],
    queryFn: () => salesOrdersService.getAll({ page: ordersPage.page, pageSize: ordersPage.pageSize, search: searchFor('ordenes-venta') }),
    enabled: activeSection === 'ordenes-venta',
    placeholderData: keepPreviousData,
  });
  const invoicesQuery = useQuery({
    queryKey: ['sales', 'invoices', tenantKey, invoicesPage.page, invoicesPage.pageSize, searchFor('facturas')],
    queryFn: () => invoicesService.getAll({ page: invoicesPage.page, pageSize: invoicesPage.pageSize, search: searchFor('facturas') }),
    enabled: needsInvoices,
    placeholderData: keepPreviousData,
  });
  const paymentsQuery = useQuery({
    queryKey: ['sales', 'payments', tenantKey, paymentsPage.page, paymentsPage.pageSize, searchFor('pagos-recibidos')],
    queryFn: () => paymentsService.getAll({ page: paymentsPage.page, pageSize: paymentsPage.pageSize, search: searchFor('pagos-recibidos') }),
    enabled: activeSection === 'pagos-recibidos',
    placeholderData: keepPreviousData,
  });
  const recurringQuery = useQuery({
    queryKey: ['sales', 'recurring-invoices', tenantKey, recurringPage.page, recurringPage.pageSize, searchFor('facturas-recurrentes')],
    queryFn: () => recurringInvoicesService.getAll({ page: recurringPage.page, pageSize: recurringPage.pageSize, search: searchFor('facturas-recurrentes') }),
    enabled: activeSection === 'facturas-recurrentes',
    placeholderData: keepPreviousData,
  });
  const returnsQuery = useQuery({
    queryKey: ['sales', 'returns', tenantKey, returnsPage.page, returnsPage.pageSize, searchFor('devoluciones-venta')],
    queryFn: () => salesReturnsService.getAll({ page: returnsPage.page, pageSize: returnsPage.pageSize, search: searchFor('devoluciones-venta') }),
    enabled: activeSection === 'devoluciones-venta',
    placeholderData: keepPreviousData,
  });
  const creditNotesQuery = useQuery({
    queryKey: ['sales', 'credit-notes', tenantKey, creditNotesPage.page, creditNotesPage.pageSize, searchFor('notas-credito')],
    queryFn: () => creditNotesService.getAll({ page: creditNotesPage.page, pageSize: creditNotesPage.pageSize, search: searchFor('notas-credito') }),
    enabled: activeSection === 'notas-credito',
    placeholderData: keepPreviousData,
  });
  const productsQuery = useQuery({
    queryKey: ['sales', 'products-catalog', tenantKey, 1, 200],
    queryFn: () => inventoryService.getProducts({ page: 1, pageSize: 200 }),
    enabled: needsProducts,
    placeholderData: keepPreviousData,
  });
  const seriesQuery = useQuery({
    queryKey: ['sales', 'series', tenantKey],
    queryFn: () => inventoryService.getSeries(),
    enabled: activeSection === 'facturas',
    placeholderData: keepPreviousData,
  });
  const warehousesQuery = useQuery({
    queryKey: ['sales', 'warehouses', tenantKey],
    queryFn: () => inventoryService.getWarehouses(),
    enabled: activeSection === 'facturas',
    placeholderData: keepPreviousData,
  });
  const employeesQuery = useQuery({
    queryKey: ['sales', 'employees', tenantKey],
    queryFn: () => hrService.getEmployees(),
    enabled: ['ordenes-venta', 'facturas'].includes(activeSection),
    placeholderData: keepPreviousData,
  });

  const data = {
    clientes: toArray(activeSection === 'clientes' ? customersListQuery.data : customersCatalogQuery.data) as Customer[],
    estimaciones: toArray(estimatesQuery.data) as Estimate[],
    ordenes: toArray(ordersQuery.data) as SalesOrder[],
    facturas: toArray(invoicesQuery.data) as Invoice[],
    recurrentes: toArray(recurringQuery.data) as RecurringInvoice[],
    pagos: toArray(paymentsQuery.data) as PaymentReceived[],
    devoluciones: toArray(returnsQuery.data) as SalesReturn[],
    notasCredito: toArray(creditNotesQuery.data) as CreditNote[],
    productos: toArray(productsQuery.data) as Product[],
    series: toArray(seriesQuery.data),
    warehouses: toArray(warehousesQuery.data),
    employees: toArray(employeesQuery.data),
  };

  const filteredData = {
    clientes: filterByBranch(data.clientes),
    estimaciones: filterByBranch(data.estimaciones),
    ordenes: filterByBranch(data.ordenes),
    facturas: filterByBranch(data.facturas),
    recurrentes: filterByBranch(data.recurrentes),
    pagos: filterByBranch(data.pagos),
    devoluciones: filterByBranch(data.devoluciones),
    notasCredito: filterByBranch(data.notasCredito),
    productos: data.productos,
    series: data.series,
    warehouses: data.warehouses,
    employees: data.employees,
  };

  const activeQuery = activeSection === 'clientes' ? customersListQuery
    : activeSection === 'estimaciones' ? estimatesQuery
      : activeSection === 'ordenes-venta' ? ordersQuery
        : activeSection === 'facturas' ? invoicesQuery
          : activeSection === 'facturas-recurrentes' ? recurringQuery
            : activeSection === 'pagos-recibidos' ? paymentsQuery
              : activeSection === 'devoluciones-venta' ? returnsQuery
                : activeSection === 'notas-credito' ? creditNotesQuery
                  : undefined;
  const loading = Boolean(activeQuery?.isPending || (needsCatalogs && customersCatalogQuery.isPending) || (needsProducts && productsQuery.isPending));

  const makePagination = (section: string, query: any): SalesPaginationControls => {
    const state = pageFor(section);
    const meta = query.data?.meta;
    return {
      ...state,
      total: Number(meta?.total || 0),
      totalPages: Number(meta?.totalPages || 1),
      onPageChange: (page) => updatePage(section, page),
      onPageSizeChange: (pageSize) => updatePageSize(section, pageSize),
    };
  };
  const pagination = {
    clientes: makePagination('clientes', customersListQuery),
    estimaciones: makePagination('estimaciones', estimatesQuery),
    ordenes: makePagination('ordenes-venta', ordersQuery),
    facturas: makePagination('facturas', invoicesQuery),
    recurrentes: makePagination('facturas-recurrentes', recurringQuery),
    pagos: makePagination('pagos-recibidos', paymentsQuery),
    devoluciones: makePagination('devoluciones-venta', returnsQuery),
    notasCredito: makePagination('notas-credito', creditNotesQuery),
  };

  const fetchData = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['sales'] });
  }, [queryClient]);

  const handleGenerateInvoice = async (order: SalesOrder) => {
    const existingInvoice = data.facturas.find((invoice) => invoice.salesOrderId === order.id);
    if (existingInvoice) {
      toast.info(`La orden ya está facturada${existingInvoice.number ? ` con ${existingInvoice.number}` : ''}; verificando sus datos`);
    } else {
      toast.info('Enviando orden a Facturación...');
    }
    const invoice = await salesOrdersService.convertToInvoice(order.id, {
      ...(order.accountId ? { accountId: order.accountId } : {}),
      ...(order.sellerEmployeeId ? { sellerEmployeeId: order.sellerEmployeeId } : {}),
    });
    setInvoiceDraft(null);
    setTargetInvoiceId(invoice.id);
    setActiveSection('facturas');
    onSubModuleChange?.('facturas');
    await fetchData();
  };

  const handleConvertedQuoteToOrder = (orderId: string) => {
    setTargetOrderId(orderId);
    setActiveSection('ordenes-venta');
    onSubModuleChange?.('ordenes-venta');
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
                    {customersListQuery.data?.meta?.total ?? data.clientes.length} clientes · {invoicesQuery.data?.meta?.total ?? data.facturas.length} facturas
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
                <ClientesView data={data.clientes} loading={loading} onRefresh={fetchData} pagination={pagination.clientes} onSearchChange={(value) => updateSearch('clientes', value)} isSidebarCollapsed={isSidebarCollapsed} />
              )}
              {activeSection === 'estimaciones' && (
                <EstimacionesView data={filteredData.estimaciones} loading={loading} onRefresh={fetchData} onConvertedToOrder={handleConvertedQuoteToOrder} customers={filteredData.clientes} products={data.productos} pagination={pagination.estimaciones} onSearchChange={(value) => updateSearch('estimaciones', value)} />
              )}
              {activeSection === 'ordenes-venta' && (
                <OrdenesVentaView data={filteredData.ordenes} loading={loading} onRefresh={fetchData} onGenerateInvoice={handleGenerateInvoice} targetOrderId={targetOrderId} onClearTargetOrderId={() => setTargetOrderId(null)} customers={filteredData.clientes} products={data.productos} employees={data.employees} pagination={pagination.ordenes} onSearchChange={(value) => updateSearch('ordenes-venta', value)} />
              )}
              {activeSection === 'facturas' && (
                <FacturasView 
                  data={filteredData.facturas} 
                  loading={loading} 
                  onRefresh={fetchData} 
                  customers={filteredData.clientes} 
                  products={data.productos} 
                  series={data.series}
                  warehouses={data.warehouses}
                  employees={data.employees}
                  invoiceDraft={invoiceDraft || undefined}
                  onClearInvoiceDraft={() => setInvoiceDraft(null)}
                  targetInvoiceId={targetInvoiceId}
                  onClearTargetInvoiceId={() => setTargetInvoiceId(null)}
                  pagination={pagination.facturas}
                  onSearchChange={(value) => updateSearch('facturas', value)}
                />
              )}
              {activeSection === 'facturas-recurrentes' && (
                <FacturasRecurrentesView data={filteredData.recurrentes} loading={loading} onRefresh={fetchData} customers={filteredData.clientes} products={data.productos} pagination={pagination.recurrentes} onSearchChange={(value) => updateSearch('facturas-recurrentes', value)} />
              )}
              {activeSection === 'pagos-recibidos' && (
                <PagosRecibidosView data={filteredData.pagos} loading={loading} onRefresh={fetchData} customers={filteredData.clientes} invoices={filteredData.facturas} pagination={pagination.pagos} onSearchChange={(value) => updateSearch('pagos-recibidos', value)} />
              )}
              {activeSection === 'devoluciones-venta' && (
                <DevolucionesView data={filteredData.devoluciones} loading={loading} onRefresh={fetchData} customers={filteredData.clientes} invoices={filteredData.facturas} products={data.productos} pagination={pagination.devoluciones} onSearchChange={(value) => updateSearch('devoluciones-venta', value)} />
              )}
              {activeSection === 'notas-credito' && (
                <NotasCreditoView data={filteredData.notasCredito} loading={loading} onRefresh={fetchData} customers={filteredData.clientes} pagination={pagination.notasCredito} onSearchChange={(value) => updateSearch('notas-credito', value)} />
              )}
              {activeSection === 'listas-precios' && (
                <PriceListsView products={data.productos} onRefresh={fetchData} isSidebarCollapsed={isSidebarCollapsed} />
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
