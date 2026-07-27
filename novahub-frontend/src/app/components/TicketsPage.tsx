import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Headphones, TicketIcon, Users, BookOpen, CircleHelp } from 'lucide-react';
import { cn } from './ui/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { motion, AnimatePresence } from 'motion/react';
import { TicketsView } from './support/TicketsView';
import { Ticket } from '../types';
import { supportService, knowledgeBaseService, supportAgentsService } from '../services/support.service';
import { KnowledgeBaseView } from './support/KnowledgeBaseView';
import { AgentsView } from './support/AgentsView';
import { GuidedTour, type GuidedTourStep } from './ui/GuidedTour';

interface KnowledgeArticle {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  folder?: string | null;
}

interface SupportAgent {
  id: string;
  name: string;
  email: string;
  role?: string;
  isActive?: boolean;
  lastLoginAt?: string | null;
}

const TICKETS_TOUR_STEPS: GuidedTourStep[] = [
  {
    target: '[data-tour="tickets-title"]',
    title: 'Soporte y Ayuda',
    description: 'Gestiona todos los tickets de soporte, consulta la base de conocimiento y administra los agentes de soporte desde esta vista.',
    tip: 'Los tickets pueden ser abiertos por clientes desde el portal o creados internamente.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="tickets-tabs"]',
    title: 'Secciones de Soporte',
    description: 'Tres secciones principales: Tickets (gestión de incidencias), Base de Conocimiento (artículos de ayuda) y Agentes (usuarios con permiso de soporte).',
    placement: 'bottom',
  },
];

interface TicketsPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (module: string) => void;
}

export const TicketsPage = ({ activeSubModule, onSubModuleChange, isSidebarCollapsed}: TicketsPageProps) => {
  const [activeTab, setActiveTab] = useState(activeSubModule || 'tickets');
  const [data, setData] = useState<{
    tickets: Ticket[];
    knowledgeBase: KnowledgeArticle[];
    agents: SupportAgent[];
  }>({
    tickets: [],
    knowledgeBase: [],
    agents: [],
  });
  const [loading, setLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);

  const normalizeList = <T,>(response: any): T[] => {
    if (Array.isArray(response)) return response as T[];
    if (Array.isArray(response?.data)) return response.data as T[];
    return [];
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ticketsRes, kbRes, agentsRes] = await Promise.allSettled([
        supportService.getAll(),
        knowledgeBaseService.getAll(),
        supportAgentsService.getAll(),
      ]);

      setData({
        tickets: ticketsRes.status === 'fulfilled' ? normalizeList<Ticket>(ticketsRes.value) : [],
        knowledgeBase: kbRes.status === 'fulfilled' ? normalizeList<KnowledgeArticle>(kbRes.value) : [],
        agents: agentsRes.status === 'fulfilled' ? normalizeList<SupportAgent>(agentsRes.value) : [],
      });

      if (ticketsRes.status === 'rejected') console.error('Error fetching tickets:', ticketsRes.reason);
      if (kbRes.status === 'rejected') console.error('Error fetching knowledge base:', kbRes.reason);
      if (agentsRes.status === 'rejected') console.error('Error fetching agents:', agentsRes.reason);
    } catch (error) {
      console.error('Error fetching support data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeSubModule && activeSubModule !== activeTab) {
      setActiveTab(activeSubModule);
    }
  }, [activeSubModule]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (onSubModuleChange) {
      onSubModuleChange(value);
    }
  };

  const tabs = [
    { id: 'tickets', label: 'Tickets', icon: TicketIcon, color: 'text-blue-500' },
    { id: 'faqs', label: 'Base de Conocimiento', icon: BookOpen, color: 'text-emerald-500' },
    { id: 'agents', label: 'Agentes', icon: Users, color: 'text-amber-500' }
  ];

  return (
    <div className="flex flex-1 bg-background w-full">
      <main className="flex-1 relative">
        <div className="p-6 md:p-10 max-w-[1700px] mx-auto min-h-[calc(100vh-5rem)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex items-center gap-3" data-tour="tickets-title">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Headphones className="size-9 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
                  Soporte <span className="text-primary">& Ayuda</span>
                </h1>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mt-2">
                  Mesa de ayuda y atención al cliente
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowTutorial(true)}>
              <CircleHelp className="size-3.5 mr-1" /> Tutorial
            </Button>
          </div>

          <Tabs value={activeTab} className="w-full" onValueChange={handleTabChange}>
            <TabsList className={cn(!isSidebarCollapsed && "hidden lg:hidden", "w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto justify-start pb-2 flex-nowrap gap-1.5 rounded-2xl border border-border/40 mb-6 [&>button]:flex-none")} data-tour="tickets-tabs [&>button]:flex-none">
              {tabs.map((tab) => (
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
              ))}
            </TabsList>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'tickets' && <TicketsView data={data.tickets} loading={loading} onRefresh={fetchData} />}
                {activeTab === 'faqs' && (
                  <KnowledgeBaseView data={data.knowledgeBase} loading={loading} onRefresh={fetchData} />
                )}
                {activeTab === 'agents' && (
                  <AgentsView data={data.agents} tickets={data.tickets} loading={loading} onRefresh={fetchData} />
                )}
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </div>
        {showTutorial && <GuidedTour steps={TICKETS_TOUR_STEPS} onClose={() => setShowTutorial(false)} title="Soporte y Ayuda" />}
      </main>
    </div>
  );
};
