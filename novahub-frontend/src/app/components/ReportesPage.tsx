import { BarChart3, MapPinned, Package, ShoppingCart, Truck, Users, Wallet } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent } from './ui/tabs';
import { useAuth } from '../contexts/AuthContext';

import { FinanceReportTab } from './reportes/FinanceReportTab';
import { SalesReportTab } from './reportes/SalesReportTab';
import { ProvidersReportTab } from './reportes/ProvidersReportTab';
import { PurchasesReportTab } from './reportes/PurchasesReportTab';
import { CustomersReportTab } from './reportes/CustomersReportTab';
import { InventoryReportTab } from './reportes/InventoryReportTab';
import { HRReportTab } from './reportes/HRReportTab';
import { MarketingReportTab } from './reportes/MarketingReportTab';
import type { ReportExportRef } from './reportes/types';
import { CurrencyValuationBanner } from './ui/CurrencyValuation';
import { ModuleSubnavigation } from './ui/ModuleSubnavigation';
import { ExportMenu } from './ui/ExportMenu';
import type { PdfPaperFormat } from '../utils/pdfDownloadFormats';

interface ReportesPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (subModule: string) => void;
}

const REPORT_TAB_CONFIG = [
  { id: 'reportes-ventas', label: 'Ventas', module: 'REPORTS_SALES', icon: ShoppingCart },
  { id: 'reportes-compras', label: 'Compras', module: 'REPORTS_PURCHASES', icon: ShoppingCart },
  { id: 'reportes-financieros', label: 'Financiero', module: 'REPORTS_FINANCIAL', icon: Wallet },
  { id: 'reportes-inventario', label: 'Inventario de Mercancías', module: 'REPORTS_INVENTORY', icon: Package },
  { id: 'reportes-clientes', label: 'Clientes', module: 'REPORTS_CLIENTS', icon: Users },
  { id: 'reportes-proveedores', label: 'Proveedores', module: 'REPORTS_PROVIDERS', icon: Truck },
  { id: 'reportes-rrhh', label: 'Recursos Humanos', module: 'REPORTS_HR', icon: Users },
  // Reutiliza el permiso de Marketing › Analítica (no existe un permiso REPORTS_MARKETING aparte).
  { id: 'reportes-marketing', label: 'Marketing', module: 'MARKETING_ANALYTICS', exportAction: 'view', icon: BarChart3 },
] as const;

export function ReportesPage({ activeSubModule, onSubModuleChange, isSidebarCollapsed}: ReportesPageProps) {
  const { user, canPerform } = useAuth();
  const [dateRange, setDateRange] = useState('ultimo-mes');
  const [activeTab, setActiveTab] = useState(() => activeSubModule || 'reportes-financieros');
  
  // References to trigger export functionalities on the corresponding tabs
  const financeRef = useRef<ReportExportRef>(null);
  const salesRef = useRef<ReportExportRef>(null);
  const purchasesRef = useRef<ReportExportRef>(null);
  const providersRef = useRef<ReportExportRef>(null);
  const customersRef = useRef<ReportExportRef>(null);
  const inventoryRef = useRef<ReportExportRef>(null);
  const hrRef = useRef<ReportExportRef>(null);
  const marketingRef = useRef<ReportExportRef>(null);

  const visibleReportTabs = useMemo(() => REPORT_TAB_CONFIG.filter((tab) => {
    const hasRequired = user?.enabledModules?.includes(tab.module);
    const hasFallback = user?.enabledModules?.includes('REPORTS');
    const hasAccess = (!user?.enabledModules || hasRequired || hasFallback) && canPerform(tab.module, 'view');
    const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'superadmin';
    return hasAccess && (!tab.superOnly || isSuperAdmin);
  }), [user, canPerform]);
  const visibleNavigationTabs = [
    ...visibleReportTabs.map((tab) => ({ id: tab.id, label: tab.label, icon: <tab.icon className="size-4" /> })),
    ...((!user?.enabledModules || user.enabledModules.includes('FORCE_SALES')) && canPerform('FORCE_SALES', 'view')
      ? [{ id: 'reportes-gestores-cobro', label: 'Gestores de cobro', icon: <MapPinned className="size-4" /> }]
      : []),
  ];

  const activeReportTab = REPORT_TAB_CONFIG.find((tab) => tab.id === activeTab);
  const canExportActiveReport = Boolean(activeReportTab && canPerform(activeReportTab.module, ('exportAction' in activeReportTab ? activeReportTab.exportAction : 'export')));

  useEffect(() => {
    if (visibleReportTabs.length > 0 && !visibleReportTabs.some((tab) => tab.id === activeTab)) {
      const fallback = visibleReportTabs[0].id;
      setActiveTab(fallback);
      onSubModuleChange?.(fallback);
    }
  }, [activeTab, onSubModuleChange, visibleReportTabs]);

  const prevSubModule = useRef(activeSubModule);

  useEffect(() => {
    if (activeSubModule && activeSubModule !== prevSubModule.current && activeSubModule.startsWith('reportes-') && REPORT_TAB_CONFIG.some((tab) => tab.id === activeSubModule)) {
      prevSubModule.current = activeSubModule;
      setActiveTab(activeSubModule);
    }
  }, [activeSubModule]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (onSubModuleChange) onSubModuleChange(value);
  };

  const handleExportPDF = (paperFormat: PdfPaperFormat) => {
    if (!canExportActiveReport) return;
    switch (activeTab) {
      case 'reportes-financieros': financeRef.current?.exportPDF(paperFormat); break;
      case 'reportes-ventas': salesRef.current?.exportPDF(paperFormat); break;
      case 'reportes-compras': purchasesRef.current?.exportPDF(paperFormat); break;
      case 'reportes-proveedores': providersRef.current?.exportPDF(paperFormat); break;
      case 'reportes-clientes': customersRef.current?.exportPDF(paperFormat); break;
      case 'reportes-inventario': inventoryRef.current?.exportPDF(paperFormat); break;
      case 'reportes-rrhh': hrRef.current?.exportPDF(paperFormat); break;
      case 'reportes-marketing': marketingRef.current?.exportPDF(paperFormat); break;
    }
  };

  const handleReportTabChange = (value: string) => {
    if (!visibleReportTabs.some((tab) => tab.id === value)) return;
    handleTabChange(value);
  };

  const handleExportExcel = () => {
    if (!canExportActiveReport) return;
    switch (activeTab) {
      case 'reportes-financieros': financeRef.current?.exportExcel(); break;
      case 'reportes-ventas': salesRef.current?.exportExcel(); break;
      case 'reportes-compras': purchasesRef.current?.exportExcel(); break;
      case 'reportes-proveedores': providersRef.current?.exportExcel(); break;
      case 'reportes-clientes': customersRef.current?.exportExcel(); break;
      case 'reportes-inventario': inventoryRef.current?.exportExcel(); break;
      case 'reportes-rrhh': hrRef.current?.exportExcel(); break;
      case 'reportes-marketing': marketingRef.current?.exportExcel(); break;
    }
  };

  return (
    <div className="reports-module mx-auto w-full max-w-[1700px] space-y-4 p-4 pb-20 sm:p-6 md:px-10 md:pb-20 md:pt-4">
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-full max-w-full bg-background sm:w-[180px]">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hoy">Hoy</SelectItem>
              <SelectItem value="ultima-semana">Últimos 7 días</SelectItem>
              <SelectItem value="ultimo-mes">Mes actual</SelectItem>
              <SelectItem value="ultimo-trimestre">Último Trimestre</SelectItem>
              <SelectItem value="ultimo-año">Último Año</SelectItem>
              <SelectItem value="todo">Histórico completo</SelectItem>
            </SelectContent>
          </Select>
          <ExportMenu disabled={!canExportActiveReport} onPdf={handleExportPDF} onExcel={handleExportExcel} />
      </div>

      <CurrencyValuationBanner />

      <Tabs value={activeTab} onValueChange={handleReportTabChange} className="w-full">
        <ModuleSubnavigation
          items={visibleNavigationTabs}
          value={activeTab}
          onValueChange={(value) => {
            if (value === 'reportes-gestores-cobro') onSubModuleChange?.(value);
            else handleReportTabChange(value);
          }}
          isSidebarCollapsed={isSidebarCollapsed}
          ariaLabel="Navegación de Reportes"
        />

        <TabsContent value="reportes-ventas" className="m-0 mt-4 outline-none">
          {activeTab === 'reportes-ventas' && <SalesReportTab ref={salesRef} dateRange={dateRange} />}
        </TabsContent>
        <TabsContent value="reportes-compras" className="m-0 mt-4 outline-none">
          {activeTab === 'reportes-compras' && <PurchasesReportTab ref={purchasesRef} dateRange={dateRange} />}
        </TabsContent>
        <TabsContent value="reportes-financieros" className="m-0 mt-4 outline-none">
          {activeTab === 'reportes-financieros' && <FinanceReportTab ref={financeRef} dateRange={dateRange} />}
        </TabsContent>
        <TabsContent value="reportes-inventario" className="m-0 mt-4 outline-none">
          {activeTab === 'reportes-inventario' && <InventoryReportTab ref={inventoryRef} dateRange={dateRange} />}
        </TabsContent>
        <TabsContent value="reportes-clientes" className="m-0 mt-4 outline-none">
          {activeTab === 'reportes-clientes' && <CustomersReportTab ref={customersRef} dateRange={dateRange} />}
        </TabsContent>
        <TabsContent value="reportes-proveedores" className="m-0 mt-4 outline-none">
          {activeTab === 'reportes-proveedores' && <ProvidersReportTab ref={providersRef} dateRange={dateRange} />}
        </TabsContent>
        <TabsContent value="reportes-rrhh" className="m-0 mt-4 outline-none">
          {activeTab === 'reportes-rrhh' && <HRReportTab ref={hrRef} dateRange={dateRange} />}
        </TabsContent>
        <TabsContent value="reportes-marketing" className="m-0 mt-4 outline-none">
          {activeTab === 'reportes-marketing' && <MarketingReportTab ref={marketingRef} dateRange={dateRange} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
