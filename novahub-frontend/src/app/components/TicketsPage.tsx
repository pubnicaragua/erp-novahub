import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Headphones, TicketIcon, Users, BookOpen } from 'lucide-react';
import { cn } from './ui/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { motion, AnimatePresence } from 'motion/react';
import { TicketsView } from './support/TicketsView';
import { Ticket } from '../types';
import { supportService, knowledgeBaseService, supportAgentsService } from '../services/support.service';
import { KnowledgeBaseView } from './support/KnowledgeBaseView';
import { AgentsView } from './support/AgentsView';

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

export const TicketsPage = () => {
  const [activeTab, setActiveTab] = useState('tickets');
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

  const tabs = [
    { id: 'tickets', label: 'Tickets', icon: TicketIcon, color: 'text-blue-500' },
    { id: 'faqs', label: 'Base de Conocimiento', icon: BookOpen, color: 'text-emerald-500' },
    { id: 'agents', label: 'Agentes', icon: Users, color: 'text-amber-500' }
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="p-6 md:p-10 max-w-[1700px] mx-auto min-h-[calc(100vh-5rem)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex items-center gap-3">
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
          </div>

          <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
            <TabsList className="w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto justify-start pb-2 flex-nowrap gap-1.5 rounded-2xl border border-border/40 mb-6">
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
      </main>
    </div>
  );
};
