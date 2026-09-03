import { cn } from './ui/utils';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Download, FileSpreadsheet, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

import { FinanceReportTab } from './reportes/FinanceReportTab';
import { SalesReportTab } from './reportes/SalesReportTab';
import { ProvidersReportTab } from './reportes/ProvidersReportTab';
import { PurchasesReportTab } from './reportes/PurchasesReportTab';
import { CustomersReportTab } from './reportes/CustomersReportTab';
import { InventoryReportTab } from './reportes/InventoryReportTab';
import { HRReportTab } from './reportes/HRReportTab';
import type { ReportExportRef } from './reportes/types';
import { CurrencyValuationBanner } from './ui/CurrencyValuation';

interface ReportesPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (subModule: string) => void;
}

const REPORT_TAB_CONFIG = [
  { id: 'reportes-ventas', label: 'Ventas', module: 'REPORTS_SALES' },
  { id: 'reportes-compras', label: 'Compras', module: 'REPORTS_PURCHASES' },
  { id: 'reportes-financieros', label: 'Financiero', module: 'REPORTS_FINANCIAL' },
  { id: 'reportes-inventario', label: 'Inventario de Mercancías', module: 'REPORTS_INVENTORY' },
  { id: 'reportes-clientes', label: 'Clientes', module: 'REPORTS_CLIENTS' },
  { id: 'reportes-proveedores', label: 'Proveedores', module: 'REPORTS_PROVIDERS' },
  { id: 'reportes-rrhh', label: 'Recursos Humanos', module: 'REPORTS_HR' },
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

  const visibleReportTabs = useMemo(() => REPORT_TAB_CONFIG.filter((tab) => {
    const hasRequired = user?.enabledModules?.includes(tab.module);
    const hasFallback = user?.enabledModules?.includes('REPORTS');
    const hasAccess = (!user?.enabledModules || hasRequired || hasFallback) && canPerform(tab.module, 'view');
    const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'superadmin';
    return hasAccess && (!tab.superOnly || isSuperAdmin);
  }), [user, canPerform]);

  const activeReportTab = REPORT_TAB_CONFIG.find((tab) => tab.id === activeTab);
  const canExportActiveReport = Boolean(activeReportTab && canPerform(activeReportTab.module, 'export'));

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

  const handleExportPDF = () => {
    if (!canExportActiveReport) return;
    switch (activeTab) {
      case 'reportes-financieros': financeRef.current?.exportPDF(); break;
      case 'reportes-ventas': salesRef.current?.exportPDF(); break;
      case 'reportes-compras': purchasesRef.current?.exportPDF(); break;
      case 'reportes-proveedores': providersRef.current?.exportPDF(); break;
      case 'reportes-clientes': customersRef.current?.exportPDF(); break;
      case 'reportes-inventario': inventoryRef.current?.exportPDF(); break;
      case 'reportes-rrhh': hrRef.current?.exportPDF(); break;
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
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-4 p-4 pb-20 sm:p-6 md:p-10">
      <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-[66px] shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <BarChart3 className="size-9 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
              Reportes <span className="text-primary">Analíticos</span>
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                Resultados y cuadros de mando interactivos
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex min-w-0 flex-wrap items-center gap-2 mt-4 md:mt-0">
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
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={!canExportActiveReport} className="gap-2">
            <Download className="w-4 h-4" /> PDF
          </Button>
          <Button variant="default" size="sm" onClick={handleExportExcel} disabled={!canExportActiveReport} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </Button>
        </div>
      </div>

      <CurrencyValuationBanner />

      <Tabs value={activeTab} onValueChange={handleReportTabChange} className="w-full">
        <TabsList className={cn(!isSidebarCollapsed && "hidden lg:hidden", "w-full min-w-0 h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto flex-nowrap gap-1.5 rounded-2xl border border-border/40 mb-6 [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground")}>
          {visibleReportTabs.map((tab) => {
            return (
              <TabsTrigger 
                key={tab.id}
                value={tab.id} 
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
              >
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

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
      </Tabs>
    </div>
  );
}
