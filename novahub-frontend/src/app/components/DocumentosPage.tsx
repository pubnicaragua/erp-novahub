import { useState, useEffect } from 'react';
import { Files, FileText, Scale, FileBarChart, HardDrive, Cloud } from 'lucide-react';
import { cn } from './ui/utils';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { motion, AnimatePresence } from 'motion/react';
import { ContratosView } from './documentos/ContratosView';
import { FacturasLegalesView } from './documentos/FacturasLegalesView';
import { ReportesView } from './documentos/ReportesView';
import { ArchivosView } from './documentos/ArchivosView';
import { NovaCloudPlanesView } from './documentos/NovaCloudPlanesView';
import { contractsService, legalInvoicesService, reportsService, filesService } from '../services/documentos.service';
import { useAuth } from '../contexts/AuthContext';
import { asList, useTenantQuery } from '../hooks/useTenantQuery';
import { CurrencyValuationBanner } from './ui/CurrencyValuation';

interface DocumentosPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (subModule: string) => void;
}

export const DocumentosPage = ({ activeSubModule, onSubModuleChange, isSidebarCollapsed}: DocumentosPageProps) => {
  const { user, canPerform } = useAuth();
  const normalizeTab = (value?: string) => value === 'nova-cloud-planes' ? 'planes' : value;
  const tabs = [
    { id: 'archivos', label: 'Archivos', icon: HardDrive, color: 'text-blue-500', module: 'DOCUMENTS_FILES' },
    { id: 'contratos', label: 'Contratos', icon: Scale, color: 'text-emerald-500', module: 'DOCUMENTS_CONTRACTS' },
    { id: 'facturas', label: 'Facturas Legales', icon: FileText, color: 'text-amber-500', module: 'DOCUMENTS_INVOICES' },
    { id: 'reportes', label: 'Reportes', icon: FileBarChart, color: 'text-purple-500', module: 'DOCUMENTS_REPORTS' },
    { id: 'carpetas', label: 'Carpetas', icon: Files, color: 'text-indigo-500', module: 'DOCUMENTS_FOLDERS' },
    { id: 'planes', label: 'Nova Cloud', icon: Cloud, color: 'text-cyan-500', module: 'DOCUMENTS_STORAGE_PLANS' },
  ];
  const visibleTabs = tabs.filter((tab) => {
    const hasRequired = user?.enabledModules?.includes(tab.module);
    const hasFallback = user?.enabledModules?.includes('DOCUMENTS');
    return (!user?.enabledModules || hasRequired || hasFallback) && canPerform(tab.module, 'view');
  });
  const [activeTab, setActiveTab] = useState(() => normalizeTab(activeSubModule) || 'archivos');
  const filesQuery = useTenantQuery<any[]>(['documents', 'files'], signal => filesService.getAll(signal), { enabled: (activeTab === 'archivos' && canPerform('DOCUMENTS_FILES', 'view')) || (activeTab === 'carpetas' && canPerform('DOCUMENTS_FOLDERS', 'view')) });
  const contractsQuery = useTenantQuery<any[]>(['documents', 'contracts'], signal => contractsService.getAll(signal), { enabled: activeTab === 'contratos' && canPerform('DOCUMENTS_CONTRACTS', 'view') });
  const invoicesQuery = useTenantQuery<any[]>(['documents', 'legal-invoices'], signal => legalInvoicesService.getAll(signal), { enabled: activeTab === 'facturas' && canPerform('DOCUMENTS_INVOICES', 'view') });
  const reportsQuery = useTenantQuery<any[]>(['documents', 'reports'], signal => reportsService.getAll(signal), { enabled: activeTab === 'reportes' && canPerform('DOCUMENTS_REPORTS', 'view') });
  const data = {
    archivos: asList(filesQuery.data), contratos: asList(contractsQuery.data),
    facturas: asList(invoicesQuery.data), reportes: asList(reportsQuery.data),
  };
  const activeQuery = activeTab === 'archivos' || activeTab === 'carpetas' ? filesQuery : activeTab === 'contratos' ? contractsQuery : activeTab === 'facturas' ? invoicesQuery : reportsQuery;
  const loading = activeTab === 'planes' ? false : activeQuery.isLoading || activeQuery.isFetching;
  const fetchData = () => activeQuery.refetch();

  useEffect(() => {
    const requestedTab = normalizeTab(activeSubModule);
    if (requestedTab && visibleTabs.some((tab) => tab.id === requestedTab)) {
      setActiveTab(requestedTab);
      return;
    }
    if (visibleTabs.length > 0 && !visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [activeSubModule, activeTab, visibleTabs]);

  const handleTabChange = (value: string) => {
    if (!visibleTabs.some((tab) => tab.id === value)) return;
    setActiveTab(value);
    onSubModuleChange?.(value === 'planes' ? 'nova-cloud-planes' : value);
  };

  return (
    <div className="flex flex-1 bg-background w-full">
      <main className="flex-1 relative">
        <div className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-[1700px] p-4 sm:p-6 md:px-10 md:pb-10 md:pt-4">

          <CurrencyValuationBanner className="mb-3" />

          <Tabs value={activeTab} className="w-full" onValueChange={handleTabChange}>
          <div className={cn("w-full overflow-x-auto custom-scrollbar mb-4", !isSidebarCollapsed && "hidden lg:hidden")}>
          <TabsList className="flex w-max min-w-full h-auto gap-1.5 bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 rounded-2xl border border-border/40 [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground">
              {visibleTabs.map((tab) => {
                return (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
                    data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                    data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
                >
                  <tab.icon className="size-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
                );
              })}
          </TabsList>
          </div>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {(activeTab === 'archivos' || activeTab === 'carpetas') && <ArchivosView data={data.archivos} loading={loading} onRefresh={fetchData} />}
                {activeTab === 'contratos' && <ContratosView data={data.contratos} loading={loading} onRefresh={fetchData} />}
                {activeTab === 'facturas' && <FacturasLegalesView data={data.facturas} loading={loading} onRefresh={fetchData} />}
                {activeTab === 'reportes' && <ReportesView data={data.reportes} loading={loading} onRefresh={fetchData} />}
                {activeTab === 'planes' && <NovaCloudPlanesView />}
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </div>
      </main>
    </div>
  );
};
