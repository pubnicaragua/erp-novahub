import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Truck, Wallet, CalendarClock,
  ClipboardList, PackageCheck, RotateCcw,
  Banknote, BadgeDollarSign,
  ClipboardPen,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { cn } from './ui/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useBranchScope } from '../hooks/useBranchScope';
import { BranchScopeFilter } from './ui/BranchScopeFilter';
import { CurrencyValuationBanner } from './ui/CurrencyValuation';
import {
  suppliersService, expensesService, recurringExpensesService,
  purchaseOrdersService, purchaseReceiptsService,
  supplierInvoicesService, recurringSupplierInvoicesService,
  paymentsMadeService, supplierCreditsService,
  purchaseRequestsService,
} from '../services/compras.service';
import { contabilidadService } from '../services/contabilidad.service';
import { inventoryService } from '../services/inventario.service';
import type {
  Supplier, Expense, RecurringExpense, PurchaseOrder,
  PurchaseReceipt, SupplierInvoice, RecurringSupplierInvoice,
  PaymentMade, SupplierCredit, PurchaseRequest,
} from '../types';
import type { SalesPageSize, SalesPaginationControls } from '../types';

import { ProveedoresView }         from './compras/ProveedoresView';
import { GastosView }              from './compras/GastosView';
import { GastosRecurrentesView }   from './compras/GastosRecurrentesView';
import { OrdenesCompraView }       from './compras/OrdenesCompraView';
import { RecepcionesCompraView }   from './compras/RecepcionesCompraView';
import { FacturasProveedorRecView } from './compras/FacturasProveedorRecView';
import { PagosRealizadosView }     from './compras/PagosRealizadosView';
import { CreditosProveedorView }   from './compras/CreditosProveedorView';
import { SolicitudCompraView }     from './compras/SolicitudCompraView';
import type { PurchaseAlertDetail, PurchaseAlertItem } from './compras/PurchaseAlertsButton';

const COMPRAS_SECTIONS = [
  { id: 'solicitudes',   label: 'Solicitudes',         icon: ClipboardPen,   description: 'Solicitudes de compra', requiredModules: ['PURCHASES_REQUESTS', 'PURCHASES'] },
  { id: 'proveedores',   label: 'Proveedores',          icon: Truck,          description: 'Directorio de proveedores', requiredModules: ['PURCHASES_PROVIDERS', 'PURCHASES'] },
  { id: 'gastos',        label: 'Gastos',               icon: Wallet,         description: 'Registro de gastos', requiredModules: ['PURCHASES_EXPENSES', 'PURCHASES'] },
  { id: 'gastos-rec',    label: 'Gastos Recurrentes',   icon: CalendarClock,  description: 'Gastos fijos periódicos', requiredModules: ['PURCHASES_EXPENSES_REC', 'PURCHASES'] },
  { id: 'ordenes',       label: 'Órdenes de Compra',    icon: ClipboardList,  description: 'Pedidos a proveedores', requiredModules: ['PURCHASES_ORDERS', 'PURCHASES'] },
  { id: 'recepciones',   label: 'Recepciones',          icon: PackageCheck,   description: 'Entrada de mercancía', requiredModules: ['PURCHASES_RECEIPTS', 'PURCHASES'] },
  { id: 'facturas-rec',  label: 'Facturas Recurrentes', icon: RotateCcw,      description: 'Contratos periódicos', requiredModules: ['PURCHASES_INVOICES_REC', 'PURCHASES'] },
  { id: 'pagos',         label: 'Pagos Realizados',    icon: Banknote,       description: 'Histórico de pagos', requiredModules: ['PURCHASES_PAYMENTS', 'PURCHASES'] },
  { id: 'creditos',      label: 'Créditos Proveedor',  icon: BadgeDollarSign, description: 'Créditos que el proveedor otorga a favor de la empresa', requiredModules: ['PURCHASES_RETURNS', 'PURCHASES'] },
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
  facturasRec:   RecurringSupplierInvoice[];
  pagos:         PaymentMade[];
  creditos:      SupplierCredit[];
  solicitudes:   PurchaseRequest[];
};

export function ComprasPage({ activeSubModule, isSidebarCollapsed}: ComprasPageProps) {
  const { user, canPerform } = useAuth();
  const { isRestricted, accessibleBranches, selectedBranchId } = useBranchScope();
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
       'facturas-prov': 'recepciones',
       'facturas-proveedor': 'recepciones',
      'facturas-proveedor-rec': 'facturas-rec',
      'pagos-realizados': 'pagos',
      'creditos-proveedor': 'creditos',
    };
    return map[s] || s;
  };

  const tabsRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState(normalize(activeSubModule));
  const queryClient = useQueryClient();
  const tenantKey = user?.tenantId || 'anonymous';
  const canReadAccounting = canPerform('ACCOUNTING', 'view');
  const canReadInventory = canPerform('INVENTORY', 'view');
  const canReadPurchases = canPerform('PURCHASES', 'view');
  const purchasesStaleTime = 15_000;
  const [searchState, setSearchState] = useState<Record<string, string>>({});
  const [debouncedSearchState, setDebouncedSearchState] = useState<Record<string, string>>({});
  const [statusState, setStatusState] = useState<Record<string, string>>({});
  const [paginationState, setPaginationState] = useState<Record<string, { page: number; pageSize: SalesPageSize }>>({});

  const [ordersPrefilter, setOrdersPrefilter] = useState<string | undefined>(undefined);
  const [targetRecord, setTargetRecord] = useState<{ section: string; id: string } | null>(null);
  const [expenseDateFilter, setExpenseDateFilter] = useState<{ from?: string; to?: string }>({});
  const updateExpenseDate = useCallback((from?: string, to?: string) => {
    setExpenseDateFilter((current) => (current.from === from && current.to === to) ? current : { from, to });
  }, []);

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
  const statusFor = (section: string) => statusState[section] && statusState[section] !== 'ALL' && statusState[section] !== 'all' ? statusState[section] : undefined;
  const updateStatus = (section: string, value: string) => {
    setStatusState((current) => ({ ...current, [section]: value }));
    updatePage(section, 1);
  };

  const handleApprovedOrderReceipt = () => {
    setActiveSection('recepciones');
  };

  useEffect(() => {
    if (activeSubModule) setActiveSection(normalize(activeSubModule));
  }, [activeSubModule]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as any;
      if (detail?.module !== 'compras') return;
      if (detail?.subModule === 'ordenes-compra' && detail?.filter === 'TO_APPROVE') {
        setActiveSection('ordenes');
        setStatusState((s) => ({ ...s, ordenes: 'ALL' }));
        setOrdersPrefilter('TO_APPROVE');
        return;
      }
      const section = normalize(detail?.subModule);
      if (!COMPRAS_SECTIONS.some((item) => item.id === section)) return;
      setActiveSection(section);
      const targetId = String(detail?.targetId || '').trim();
      const number = String(detail?.number || '').trim();
      setTargetRecord(targetId ? { section, id: targetId } : null);
      if (number) updateSearch(section, number);
    };
    window.addEventListener('navigate-module', handler);
    return () => window.removeEventListener('navigate-module', handler);
  }, []);

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

  // Cada pestaña consulta únicamente lo que necesita. React Query conserva las
  // pestañas visitadas y cancela solicitudes obsoletas cuando se cambia rápido.
  const suppliersPage = pageFor('proveedores');
  const suppliersQuery = useQuery({
    queryKey: ['purchases', 'suppliers', tenantKey, suppliersPage.page, suppliersPage.pageSize, searchFor('proveedores')],
    queryFn: ({ signal }) => suppliersService.getAll({ page: suppliersPage.page, pageSize: suppliersPage.pageSize, search: searchFor('proveedores') }, signal),
    enabled: canReadPurchases && activeSection === 'proveedores',
    placeholderData: keepPreviousData,
    staleTime: purchasesStaleTime,
  });
  const suppliersCatalogQuery = useQuery({
    queryKey: ['purchases', 'suppliers-catalog', tenantKey, 1, 200],
    queryFn: ({ signal }) => suppliersService.getAll({ page: 1, pageSize: 200, status: 'ACTIVE' }, signal),
    enabled: canReadPurchases && ['solicitudes', 'gastos', 'gastos-rec', 'ordenes', 'recepciones', 'facturas-rec', 'pagos', 'creditos'].includes(activeSection),
    placeholderData: keepPreviousData,
    staleTime: purchasesStaleTime,
  });
  const supplierCatalog = useMemo(() => toArr(suppliersCatalogQuery.data) as Supplier[], [suppliersCatalogQuery.data]);
  const chartAccountsQuery = useQuery({
    queryKey: ['purchases', 'chart-accounts-catalog', tenantKey],
    queryFn: ({ signal }) => contabilidadService.getChartOfAccounts(false, signal),
    enabled: canReadAccounting && ['gastos', 'recepciones'].includes(activeSection),
    staleTime: 30_000,
  });
  const expenseCategoriesQuery = useQuery({
    queryKey: ['purchases', 'expense-categories-catalog', tenantKey],
    queryFn: ({ signal }) => contabilidadService.getExpenseCategories(undefined, signal),
    enabled: canReadAccounting && activeSection === 'gastos',
    staleTime: 30_000,
  });
  const warehouseCatalogQuery = useQuery({
    queryKey: ['purchases', 'warehouses-catalog', tenantKey, selectedBranchId],
    queryFn: ({ signal }) => inventoryService.getWarehouseCatalog({
      branchId: selectedBranchId || user?.clientTenantId || user?.tenantId || undefined,
      scopeType: 'BRANCH',
      page: 1,
      pageSize: 200,
    }, signal),
    // Compras también tiene autorización para consultar este catálogo; no
    // debe depender del permiso de la pantalla completa de Inventario.
    enabled: (canReadInventory || canReadPurchases) && ['solicitudes', 'ordenes', 'recepciones'].includes(activeSection),
    staleTime: 30_000,
  });
  const productCatalogQuery = useQuery({
    queryKey: ['purchases', 'products-catalog', tenantKey, 1, 200],
    queryFn: ({ signal }) => inventoryService.getProducts({ page: 1, pageSize: 200 }, signal),
    enabled: canReadInventory && ['ordenes', 'recepciones', 'creditos'].includes(activeSection),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const productCategoriesQuery = useQuery({
    queryKey: ['purchases', 'products-categories-catalog', tenantKey],
    queryFn: ({ signal }) => inventoryService.getCategories(signal),
    enabled: canReadInventory && ['ordenes', 'recepciones'].includes(activeSection),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const orderCatalogQuery = useQuery({
    queryKey: ['purchases', 'orders-catalog', tenantKey, 1, 200],
    queryFn: ({ signal }) => purchaseOrdersService.getAll({ page: 1, pageSize: 200 }, signal),
    enabled: canReadPurchases && activeSection === 'recepciones',
    placeholderData: keepPreviousData,
    staleTime: purchasesStaleTime,
  });
  const chartAccountCatalog = useMemo(() => toArr(chartAccountsQuery.data) as any[], [chartAccountsQuery.data]);
  const expenseCategoryCatalog = useMemo(() => toArr(expenseCategoriesQuery.data) as any[], [expenseCategoriesQuery.data]);
  const warehouseCatalog = useMemo(() => toArr(warehouseCatalogQuery.data) as any[], [warehouseCatalogQuery.data]);
  const productCatalog = useMemo(() => toArr(productCatalogQuery.data) as any[], [productCatalogQuery.data]);
  const productCategories = useMemo(() => toArr(productCategoriesQuery.data) as any[], [productCategoriesQuery.data]);
  const orderCatalog = useMemo(() => toArr(orderCatalogQuery.data) as any[], [orderCatalogQuery.data]);
  const expensesPage = pageFor('gastos');
  const expensesQuery = useQuery({
    queryKey: ['purchases', 'expenses', tenantKey, expensesPage.page, expensesPage.pageSize, searchFor('gastos'), expenseDateFilter.from, expenseDateFilter.to],
    queryFn: ({ signal }) => expensesService.getAll({ page: expensesPage.page, pageSize: expensesPage.pageSize, search: searchFor('gastos'), dateFrom: expenseDateFilter.from, dateTo: expenseDateFilter.to }, signal),
    enabled: canReadPurchases && activeSection === 'gastos',
    placeholderData: keepPreviousData,
    staleTime: purchasesStaleTime,
  });
  const recurringExpensesPage = pageFor('gastos-rec');
  const recurringExpensesQuery = useQuery({
    queryKey: ['purchases', 'recurring-expenses', tenantKey, recurringExpensesPage.page, recurringExpensesPage.pageSize, searchFor('gastos-rec')],
    queryFn: ({ signal }) => recurringExpensesService.getAll({ page: recurringExpensesPage.page, pageSize: recurringExpensesPage.pageSize, search: searchFor('gastos-rec') }, signal),
    enabled: canReadPurchases && activeSection === 'gastos-rec',
    placeholderData: keepPreviousData,
    staleTime: purchasesStaleTime,
  });
  const ordersPage = pageFor('ordenes');
  const ordersQuery = useQuery({
    queryKey: ['purchases', 'orders', tenantKey, ordersPage.page, ordersPage.pageSize, searchFor('ordenes'), statusFor('ordenes'), selectedBranchId],
    queryFn: ({ signal }) => purchaseOrdersService.getAll({ page: ordersPage.page, pageSize: ordersPage.pageSize, search: searchFor('ordenes'), status: statusFor('ordenes'), branchId: selectedBranchId || undefined }, signal),
    enabled: canReadPurchases && activeSection === 'ordenes',
    placeholderData: keepPreviousData,
    staleTime: purchasesStaleTime,
  });
  const receiptsPage = pageFor('recepciones');
  const receiptsQuery = useQuery({
    queryKey: ['purchases', 'receipts', tenantKey, receiptsPage.page, receiptsPage.pageSize, searchFor('recepciones'), selectedBranchId],
    queryFn: ({ signal }) => purchaseReceiptsService.getAll({ page: receiptsPage.page, pageSize: receiptsPage.pageSize, search: searchFor('recepciones'), branchId: selectedBranchId || undefined }, signal),
    enabled: canReadPurchases && activeSection === 'recepciones',
    placeholderData: keepPreviousData,
    staleTime: purchasesStaleTime,
  });
  const invoicesCatalogQuery = useQuery({
    queryKey: ['purchases', 'invoices-catalog', tenantKey, 1, 200, selectedBranchId],
    queryFn: ({ signal }) => supplierInvoicesService.getAll({ page: 1, pageSize: 200, branchId: selectedBranchId || undefined }, signal),
    enabled: canReadPurchases && ['pagos', 'creditos'].includes(activeSection),
    placeholderData: keepPreviousData,
    staleTime: purchasesStaleTime,
  });
  const invoiceCatalog = useMemo(() => toArr(invoicesCatalogQuery.data) as SupplierInvoice[], [invoicesCatalogQuery.data]);
  const recurringInvoicesPage = pageFor('facturas-rec');
  const recurringInvoicesQuery = useQuery({
    queryKey: ['purchases', 'recurring-invoices', tenantKey, recurringInvoicesPage.page, recurringInvoicesPage.pageSize, searchFor('facturas-rec')],
    queryFn: ({ signal }) => recurringSupplierInvoicesService.getAll({ page: recurringInvoicesPage.page, pageSize: recurringInvoicesPage.pageSize, search: searchFor('facturas-rec') }, signal),
    enabled: canReadPurchases && activeSection === 'facturas-rec',
    placeholderData: keepPreviousData,
    staleTime: purchasesStaleTime,
  });
  const paymentsPage = pageFor('pagos');
  const paymentsQuery = useQuery({
    queryKey: ['purchases', 'payments', tenantKey, paymentsPage.page, paymentsPage.pageSize, searchFor('pagos'), selectedBranchId],
    queryFn: ({ signal }) => paymentsMadeService.getAll({ page: paymentsPage.page, pageSize: paymentsPage.pageSize, search: searchFor('pagos'), branchId: selectedBranchId || undefined }, signal),
    enabled: canReadPurchases && activeSection === 'pagos',
    placeholderData: keepPreviousData,
    staleTime: purchasesStaleTime,
  });
  const creditsPage = pageFor('creditos');
  const creditsQuery = useQuery({
    queryKey: ['purchases', 'credits', tenantKey, creditsPage.page, creditsPage.pageSize, searchFor('creditos'), selectedBranchId],
    queryFn: ({ signal }) => supplierCreditsService.getAll({ page: creditsPage.page, pageSize: creditsPage.pageSize, search: searchFor('creditos'), branchId: selectedBranchId || undefined }, signal),
    enabled: canReadPurchases && activeSection === 'creditos',
    placeholderData: keepPreviousData,
    staleTime: purchasesStaleTime,
  });
  const requestsPage = pageFor('solicitudes');
  const requestsQuery = useQuery({
    queryKey: ['purchases', 'requests', tenantKey, requestsPage.page, requestsPage.pageSize, searchFor('solicitudes'), statusFor('solicitudes'), selectedBranchId],
    queryFn: ({ signal }) => purchaseRequestsService.getAll({ page: requestsPage.page, pageSize: requestsPage.pageSize, search: searchFor('solicitudes'), status: statusFor('solicitudes'), branchId: selectedBranchId || undefined }, signal),
    enabled: canReadPurchases && activeSection === 'solicitudes',
    placeholderData: keepPreviousData,
    staleTime: purchasesStaleTime,
  });

  const data: ComprasData = {
    proveedores: toArr(activeSection === 'proveedores' ? suppliersQuery.data : suppliersCatalogQuery.data) as Supplier[],
    gastos: toArr(expensesQuery.data) as Expense[],
    gastosRec: toArr(recurringExpensesQuery.data) as RecurringExpense[],
    ordenes: toArr(ordersQuery.data) as PurchaseOrder[],
    recepciones: toArr(receiptsQuery.data) as PurchaseReceipt[],
    facturasRec: toArr(recurringInvoicesQuery.data) as RecurringSupplierInvoice[],
    pagos: toArr(paymentsQuery.data) as PaymentMade[],
    creditos: toArr(creditsQuery.data) as SupplierCredit[],
    solicitudes: toArr(requestsQuery.data) as PurchaseRequest[],
  };
  const activeQuery = activeSection === 'gastos' ? expensesQuery
    : activeSection === 'gastos-rec' ? recurringExpensesQuery
    : activeSection === 'ordenes' ? ordersQuery
    : activeSection === 'recepciones' ? receiptsQuery
    : activeSection === 'facturas-rec' ? recurringInvoicesQuery
    : activeSection === 'pagos' ? paymentsQuery
    : activeSection === 'creditos' ? creditsQuery
    : activeSection === 'solicitudes' ? requestsQuery
    : suppliersQuery;
  const needsCatalog = activeSection === 'pagos';
  const loading = activeQuery.isLoading || (needsCatalog && invoicesCatalogQuery.isLoading);
  const fetchData = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['purchases'] });
  }, [queryClient]);

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
    proveedores: makePagination('proveedores', suppliersQuery),
    gastos: makePagination('gastos', expensesQuery),
    gastosRec: makePagination('gastos-rec', recurringExpensesQuery),
    ordenes: makePagination('ordenes', ordersQuery),
    recepciones: makePagination('recepciones', receiptsQuery),
    facturasRec: makePagination('facturas-rec', recurringInvoicesQuery),
    pagos: makePagination('pagos', paymentsQuery),
    creditos: makePagination('creditos', creditsQuery),
    solicitudes: makePagination('solicitudes', requestsQuery),
  };

  const filteredData = {
    proveedores: data.proveedores,
    gastos: data.gastos,
    gastosRec: data.gastosRec,
    ordenes: data.ordenes,
    recepciones: data.recepciones,
    facturasRec: data.facturasRec,
    pagos: data.pagos,
    creditos: data.creditos,
    solicitudes: data.solicitudes,
  };

  const purchaseAlert = useMemo<PurchaseAlertDetail | null>(() => {
    const requestItems: PurchaseAlertItem[] = (filteredData.solicitudes as PurchaseRequest[]).filter((request) => {
      const status = String(request.status || '').toUpperCase();
      return !['APPROVED', 'CONVERTED_TO_ORDER', 'CLOSED', 'CANCELLED', 'REJECTED'].includes(status);
    }).map((request) => ({
      id: String(request.id),
      label: request.number,
      detail: request.supplier?.name || `${request.requestedBy?.firstName || ''} ${request.requestedBy?.lastName || ''}`.trim() || 'Sin proveedor asignado',
    }));
    const orderItems: PurchaseAlertItem[] = (filteredData.ordenes as PurchaseOrder[])
      .filter((order) => ['PENDING', 'DRAFT'].includes(String(order.status || '').toUpperCase()))
      .map((order) => ({ id: String(order.id), label: order.number, detail: order.supplier?.name || 'Sin proveedor asignado' }));
    const receiptItems: PurchaseAlertItem[] = (filteredData.recepciones as PurchaseReceipt[])
      .filter((receipt) => ['PENDING', 'PARTIAL', 'WITH_INCIDENTS'].includes(String(receipt.status || 'PENDING').toUpperCase()))
      .map((receipt) => ({ id: String(receipt.id), label: receipt.number, detail: receipt.supplier?.name || 'Sin proveedor asignado' }));
    const expenseItems: PurchaseAlertItem[] = (filteredData.gastos as Expense[])
      .filter((expense) => String(expense.status || '').toUpperCase() === 'PENDING')
      .map((expense) => ({
        id: String(expense.id),
        label: expense.number,
        detail: `${expense.description || 'Gasto'} · ${expense.supplier?.name || 'Sin proveedor'}`,
      }));

    const bySection: Record<'solicitudes' | 'ordenes' | 'recepciones' | 'gastos', PurchaseAlertDetail> = {
      solicitudes: { label: 'Solicitudes nuevas', singularLabel: 'solicitud nueva', count: requestItems.length, items: requestItems },
      ordenes: { label: 'Órdenes nuevas', singularLabel: 'orden nueva', count: orderItems.length, items: orderItems },
      recepciones: { label: 'Recepciones nuevas', singularLabel: 'recepción nueva', count: receiptItems.length, items: receiptItems },
      gastos: { label: 'Gastos nuevos', singularLabel: 'gasto nuevo', count: expenseItems.length, items: expenseItems },
    };
    if (!(Object.keys(bySection) as Array<keyof typeof bySection>).includes(activeSection as keyof typeof bySection)) {
      return null;
    }
    return bySection[activeSection as keyof typeof bySection];
  }, [activeSection, filteredData.gastos, filteredData.ordenes, filteredData.recepciones, filteredData.solicitudes]);

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
          <CurrencyValuationBanner className="mb-5" />

          <Tabs value={activeSection} className="w-full" onValueChange={(val) => { setActiveSection(val); }}>
        <div className={cn("w-full overflow-x-auto custom-scrollbar mb-6", !isSidebarCollapsed && "hidden lg:hidden")}>
        <TabsList ref={tabsRef} className="flex w-max min-w-full h-auto gap-1.5 bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 rounded-2xl border border-border/40 [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground">
              {COMPRAS_SECTIONS.map((section) => {
                const hasRequired = section.requiredModules && section.requiredModules.some(mod => user?.enabledModules?.includes(mod));
                // La suscripción al módulo padre (PURCHASES) habilita todas
                // sus vistas, incluso con submódulos granulares contratados.
                const hasFallback = user?.enabledModules?.includes('PURCHASES');
                const hasAccess = (!user?.enabledModules || !section.requiredModules || hasRequired || hasFallback)
                  && (!section.requiredModules || section.requiredModules.some(mod => canPerform(mod, 'view')));
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
               const commonProps = { loading, onRefresh: fetchData, isSidebarCollapsed };
               return (
                 <motion.div
                   className="min-w-0 max-w-full"
                   key={section.id}
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -10 }}
                   transition={{ duration: 0.2 }}
                 >
                    {section.id === 'solicitudes'  && <SolicitudCompraView  {...commonProps} purchaseAlert={purchaseAlert || undefined} warehouseCatalog={warehouseCatalog} supplierCatalog={supplierCatalog} productCatalog={productCatalog} data={filteredData.solicitudes} pagination={pagination.solicitudes} onSearchChange={(value) => updateSearch('solicitudes', value)} onStatusChange={(value) => updateStatus('solicitudes', value)} />}
                    {section.id === 'proveedores'  && <ProveedoresView    {...commonProps} data={filteredData.proveedores} pagination={pagination.proveedores} onSearchChange={(value) => updateSearch('proveedores', value)} />}
                    {section.id === 'gastos'        && <GastosView         {...commonProps} purchaseAlert={purchaseAlert || undefined} targetId={targetRecord?.section === 'gastos' ? targetRecord.id : null} onClearTargetId={() => setTargetRecord(null)} supplierCatalog={supplierCatalog} expenseCategoryCatalog={expenseCategoryCatalog} data={filteredData.gastos} pagination={pagination.gastos} onSearchChange={(value) => updateSearch('gastos', value)} onDateChange={updateExpenseDate} />}
                    {section.id === 'gastos-rec'    && <GastosRecurrentesView {...commonProps} supplierCatalog={supplierCatalog} data={filteredData.gastosRec} pagination={pagination.gastosRec} onSearchChange={(value) => updateSearch('gastos-rec', value)} />}
                     {section.id === 'ordenes'       && <OrdenesCompraView  {...commonProps} purchaseAlert={purchaseAlert || undefined} targetId={targetRecord?.section === 'ordenes' ? targetRecord.id : null} onClearTargetId={() => setTargetRecord(null)} supplierCatalog={supplierCatalog} warehouseCatalog={warehouseCatalog} selectedBranchId={selectedBranchId} productCatalog={productCatalog} productCategories={productCategories} data={filteredData.ordenes} initialStatus={ordersPrefilter} onApprovedToReceipt={handleApprovedOrderReceipt} pagination={pagination.ordenes} onSearchChange={(value) => updateSearch('ordenes', value)} onStatusChange={(value) => updateStatus('ordenes', value)} />}
                    {section.id === 'recepciones'   && <RecepcionesCompraView {...commonProps} purchaseAlert={purchaseAlert || undefined} targetId={targetRecord?.section === 'recepciones' ? targetRecord.id : null} onClearTargetId={() => setTargetRecord(null)} supplierCatalog={supplierCatalog} accountCatalog={chartAccountCatalog} warehouseCatalog={warehouseCatalog.filter((warehouse: any) => !selectedBranchId || warehouse?.clientTenantId === selectedBranchId)} orderCatalog={orderCatalog} productCatalog={productCatalog} productCategories={productCategories} data={filteredData.recepciones} pagination={pagination.recepciones} onSearchChange={(value) => updateSearch('recepciones', value)} />}
                   {section.id === 'facturas-rec'  && <FacturasProveedorRecView {...commonProps} supplierCatalog={supplierCatalog} data={filteredData.facturasRec} pagination={pagination.facturasRec} onSearchChange={(value) => updateSearch('facturas-rec', value)} />}
                   {section.id === 'pagos'         && (
                    <PagosRealizadosView
                      {...commonProps}
                      supplierCatalog={supplierCatalog}
                      targetId={targetRecord?.section === 'pagos' ? targetRecord.id : null}
                      onClearTargetId={() => setTargetRecord(null)}
                      data={filteredData.pagos}
                      supplierInvoices={invoiceCatalog}
                      pagination={pagination.pagos}
                      onSearchChange={(value) => updateSearch('pagos', value)}
                    />
                  )}
                   {section.id === 'creditos'      && <CreditosProveedorView {...commonProps} supplierCatalog={supplierCatalog} supplierInvoices={invoiceCatalog} productCatalog={productCatalog} data={filteredData.creditos} pagination={pagination.creditos} onSearchChange={(value) => updateSearch('creditos', value)} />}
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
