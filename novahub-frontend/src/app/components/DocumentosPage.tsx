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

interface DocumentosPageProps {
  activeSubModule?: string;
}

export const DocumentosPage = ({ activeSubModule }: DocumentosPageProps) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(() => activeSubModule || 'archivos');
  const [data, setData] = useState<any>({
    contratos: [],
    facturas: [],
    reportes: [],
    archivos: []
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [contratos, facturas, reportes, archivos] = await Promise.all([
        contractsService.getAll().catch(() => []),
        legalInvoicesService.getAll().catch(() => []),
        reportsService.getAll().catch(() => []),
        filesService.getAll().catch(() => [])
      ]);
      setData({ contratos, facturas, reportes, archivos });
    } catch (error) {
      console.error('Error fetching documentos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeSubModule) {
      setActiveTab(activeSubModule);
    }
  }, [activeSubModule]);

  const tabs = [
    { id: 'archivos', label: 'Archivos', icon: HardDrive, color: 'text-blue-500', module: 'DOCUMENTS_FILES' },
    { id: 'contratos', label: 'Contratos', icon: Scale, color: 'text-emerald-500', module: 'DOCUMENTS_CONTRACTS' },
    { id: 'facturas', label: 'Facturas Legales', icon: FileText, color: 'text-amber-500', module: 'DOCUMENTS_INVOICES' },
    { id: 'reportes', label: 'Reportes', icon: FileBarChart, color: 'text-purple-500', module: 'DOCUMENTS_REPORTS' },
    { id: 'planes', label: 'Nova Cloud', icon: Cloud, color: 'text-cyan-500', module: 'DOCUMENTS' }
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="p-6 md:p-10 max-w-[1700px] mx-auto min-h-[calc(100vh-5rem)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Files className="size-9 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
                  Nova Cloud
                </h1>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mt-2">
                  Almacenamiento y gestión documental en la nube
                </p>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
            <TabsList className="w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto justify-start pb-2 flex-nowrap gap-1.5 rounded-2xl border border-border/40 mb-6">
              {tabs.map((tab) => {
                const hasRequired = user?.enabledModules?.includes(tab.module);
                const hasSpecificSubmodules = user?.enabledModules?.some(m => m.startsWith('DOCUMENTS_'));
                const hasFallback = user?.enabledModules?.includes('DOCUMENTS') && !hasSpecificSubmodules;
                const hasAccess = !user?.enabledModules || hasRequired || hasFallback;
                if (!hasAccess) return null;
                return (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
                    data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                    data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
                >
                  <tab.icon className={cn("size-4", activeTab === tab.id ? "" : tab.color)} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
                );
              })}
            </TabsList>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'archivos' && <ArchivosView data={data.archivos} loading={loading} onRefresh={fetchData} />}
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
