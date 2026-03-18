import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Files, FileText, Scale, FileBarChart, HardDrive } from 'lucide-react';
import { cn } from './ui/utils';
import { ContratosView } from './documentos/ContratosView';
import { FacturasLegalesView } from './documentos/FacturasLegalesView';
import { ReportesView } from './documentos/ReportesView';
import { ArchivosView } from './documentos/ArchivosView';
import { contractsService, legalInvoicesService, reportsService, filesService } from '../services/documentos.service';

export const DocumentosPage = () => {
  const [activeTab, setActiveTab] = useState('archivos');
  const [data, setData] = useState({
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

  const tabs = [
    { id: 'archivos', label: 'Archivos', icon: HardDrive, color: 'text-blue-500' },
    { id: 'contratos', label: 'Contratos', icon: Scale, color: 'text-emerald-500' },
    { id: 'facturas', label: 'Facturas Legales', icon: FileText, color: 'text-amber-500' },
    { id: 'reportes', label: 'Reportes', icon: FileBarChart, color: 'text-purple-500' }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-muted/10 font-sans">
      <div className="flex-none bg-background/80 backdrop-blur-2xl border-b border-border/50 sticky top-0 z-40">
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Files className="size-5 text-primary" />
                </div>
                <h1 className="text-2xl font-black tracking-tight uppercase">Documentos</h1>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
                Gestión documental centralizada
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 max-w-[1600px] mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
            {tabs.map(tab => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'default' : 'outline'}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-xl h-10 px-4 font-black uppercase text-[10px] tracking-widest transition-all duration-300 min-w-fit gap-2 border-none",
                  activeTab === tab.id 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "bg-background/50 hover:bg-muted/50 text-muted-foreground"
                )}
              >
                <tab.icon className={cn("size-4", activeTab === tab.id ? "" : tab.color)} />
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-[1600px] mx-auto">
          {activeTab === 'archivos' && <ArchivosView data={data.archivos} loading={loading} onRefresh={fetchData} />}
          {activeTab === 'contratos' && <ContratosView data={data.contratos} loading={loading} onRefresh={fetchData} />}
          {activeTab === 'facturas' && <FacturasLegalesView data={data.facturas} loading={loading} onRefresh={fetchData} />}
          {activeTab === 'reportes' && <ReportesView data={data.reportes} loading={loading} onRefresh={fetchData} />}
        </div>
      </div>
    </div>
  );
};
