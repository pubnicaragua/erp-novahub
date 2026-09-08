import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { TicketIcon, Users, BookOpen, CircleHelp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { motion, AnimatePresence } from 'motion/react';
import { TicketsView } from './support/TicketsView';
import { Ticket } from '../types';
import { supportService, knowledgeBaseService, supportAgentsService } from '../services/support.service';
import { KnowledgeBaseView } from './support/KnowledgeBaseView';
import { AgentsView } from './support/AgentsView';
import { GuidedTour, type GuidedTourStep } from './ui/GuidedTour';
import { asList, useTenantQuery } from '../hooks/useTenantQuery';
import { useAuth } from '../contexts/AuthContext';
import { customersService } from '../services/ventas.service';
import { invoicesService } from '../services/ventas.service';
import { inventoryService } from '../services/inventario.service';

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
    title: 'Gestión de tickets',
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

export const TicketsPage = ({ activeSubModule, onSubModuleChange }: TicketsPageProps) => {
  const { canPerform } = useAuth();
  const canViewTickets = canPerform('TICKETS_LIST', 'view');
  const canViewKnowledge = canPerform('TICKETS_KNOWLEDGE_BASE', 'view');
  const canViewAgents = canPerform('TICKETS_AGENTS', 'view');
  const tabs = [
    { id: 'tickets', label: 'Tickets', icon: TicketIcon, color: 'text-blue-500', canView: canViewTickets },
    { id: 'faqs', label: 'Base de Conocimiento', icon: BookOpen, color: 'text-emerald-500', canView: canViewKnowledge },
    { id: 'agents', label: 'Agentes', icon: Users, color: 'text-amber-500', canView: canViewAgents },
  ];
  const visibleTabs = tabs.filter((tab) => tab.canView);
  const [internalActiveTab, setInternalActiveTab] = useState('tickets');
  const activeTab = activeSubModule || internalActiveTab;
  const [showTutorial, setShowTutorial] = useState(false);
  const [targetTicketId, setTargetTicketId] = useState<string | null>(null);

  useEffect(() => {
    const handleTicketNavigation = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.module !== 'tickets' || detail.subModule !== 'tickets' || !detail.targetId) return;
      window.setTimeout(() => setTargetTicketId(String(detail.targetId)), 0);
    };
    window.addEventListener('navigate-module', handleTicketNavigation);
    return () => window.removeEventListener('navigate-module', handleTicketNavigation);
  }, []);

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    const requestedTab = activeSubModule || internalActiveTab;
    if (visibleTabs.some((tab) => tab.id === requestedTab)) return;
    const fallback = visibleTabs[0].id;
    const timeout = window.setTimeout(() => {
      setInternalActiveTab(fallback);
      onSubModuleChange?.(fallback);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [activeSubModule, internalActiveTab, onSubModuleChange, visibleTabs]);

  // Las pestañas son independientes: no cargamos tickets, artículos y agentes
  // al mismo tiempo cuando el usuario solo necesita una de ellas.
  const ticketsQuery = useTenantQuery<any>(['support', 'tickets'], signal => supportService.getAll({ page: 1, pageSize: 200 }, signal), {
    enabled: canViewTickets && (activeTab === 'tickets' || activeTab === 'agents'),
  });
  const knowledgeBaseQuery = useTenantQuery<any[]>(['support', 'knowledge-base'], signal => knowledgeBaseService.getAll(undefined, signal), {
    enabled: canViewKnowledge && activeTab === 'faqs',
  });
  const agentsQuery = useTenantQuery<SupportAgent[]>(['support', 'agents'], signal => supportAgentsService.getAll({ status: 'ACTIVE' }, signal), {
    enabled: canViewAgents && (activeTab === 'agents' || activeTab === 'tickets'),
  });
  const customersQuery = useTenantQuery<any[]>(['support', 'customers'], signal => customersService.getAll({ page: 1, pageSize: 200, status: 'ACTIVE' }, signal).then(asList), {
    enabled: canViewTickets && activeTab === 'tickets',
  });
  const categoriesQuery = useTenantQuery<any[]>(['support', 'categories'], signal => supportService.getCategories(signal).then(asList), {
    enabled: canViewTickets && activeTab === 'tickets',
  });
  const invoicesQuery = useTenantQuery<any[]>(['support', 'invoices', 'paid'], signal => invoicesService.getAll({ page: 1, pageSize: 200, status: 'PAID' }, signal).then(asList), {
    enabled: canViewTickets && activeTab === 'tickets' && canPerform('SALES_INVOICES', 'view'),
  });
  const productsQuery = useTenantQuery<any[]>(['support', 'products'], signal => inventoryService.getProducts({ page: 1, pageSize: 200, includeInactive: false }, signal).then(asList), {
    enabled: canViewTickets && activeTab === 'tickets' && canPerform('INVENTORY_PRODUCTS', 'view'),
  });

  const data = {
    tickets: asList(ticketsQuery.data) as Ticket[],
    customers: asList(customersQuery.data),
    categories: asList(categoriesQuery.data),
    agents: asList(agentsQuery.data),
    invoices: asList(invoicesQuery.data),
    products: asList(productsQuery.data),
    knowledgeBase: asList(knowledgeBaseQuery.data),
  };
  const activeQuery = activeTab === 'tickets' || activeTab === 'agents' ? ticketsQuery
    : activeTab === 'faqs' ? knowledgeBaseQuery : agentsQuery;
  const loading = activeTab === 'agents'
    ? ticketsQuery.isLoading || ticketsQuery.isFetching || agentsQuery.isLoading || agentsQuery.isFetching
    : activeQuery.isLoading || activeQuery.isFetching;
  const fetchData = () => activeTab === 'agents'
    ? Promise.all([ticketsQuery.refetch(), agentsQuery.refetch()])
    : activeTab === 'tickets'
      ? Promise.all([ticketsQuery.refetch(), customersQuery.refetch(), categoriesQuery.refetch(), agentsQuery.refetch(), invoicesQuery.refetch(), productsQuery.refetch()])
      : activeQuery.refetch();

  const handleTabChange = (value: string) => {
    if (!visibleTabs.some((tab) => tab.id === value)) return;
    setInternalActiveTab(value);
    if (onSubModuleChange) {
      onSubModuleChange(value);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 overflow-x-hidden bg-background w-full">
      <main className="relative min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto min-h-[calc(100vh-5rem)] w-full min-w-0 max-w-[1700px] overflow-x-hidden p-4 sm:p-6 md:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex items-center gap-3" data-tour="tickets-title">
              <div className="flex size-[66px] shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <TicketIcon className="size-9 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
                  Gestión <span className="text-primary">de tickets</span>
                </h1>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowTutorial(true)}>
              <CircleHelp className="size-3.5 mr-1" /> Tutorial
            </Button>
          </div>

          <Tabs value={activeTab} className="w-full min-w-0" onValueChange={handleTabChange}>
            <div className="mb-6 w-full min-w-0 max-w-full overflow-x-auto custom-scrollbar">
            <TabsList className="flex h-auto min-w-full w-max max-w-none gap-1.5 rounded-2xl border border-border/40 bg-gradient-to-br from-muted/30 to-muted/50 p-1.5 backdrop-blur-sm [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground" data-tour="tickets-tabs">
              {visibleTabs.map((tab) => (
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
              ))}
            </TabsList>
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                className="min-w-0 max-w-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'tickets' && <TicketsView data={data.tickets} customerCatalog={data.customers} categoryCatalog={data.categories} agentCatalog={data.agents} invoiceCatalog={data.invoices} productCatalog={data.products} loading={loading} onRefresh={fetchData} targetTicketId={targetTicketId} onTargetTicketHandled={() => setTargetTicketId(null)} />}
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
        {showTutorial && <GuidedTour steps={TICKETS_TOUR_STEPS} onClose={() => setShowTutorial(false)} title="Gestión de tickets" />}
      </main>
    </div>
  );
};
