import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Headphones, TicketIcon, Users, BookOpen } from 'lucide-react';
import { cn } from './ui/utils';
import { TicketsView } from './support/TicketsView';
import { Ticket } from '../types';
import { supportService } from '../services/support.service';

export const TicketsPage = () => {
  const [activeTab, setActiveTab] = useState('tickets');
  const [data, setData] = useState<{ tickets: Ticket[] }>({ tickets: [] });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await supportService.getAll().catch(() => ({ data: [] }));
      setData({ tickets: res.data || [] });
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
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-muted/10 font-sans">
      <div className="flex-none bg-background/80 backdrop-blur-2xl border-b border-border/50 sticky top-0 z-40">
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Headphones className="size-5 text-primary" />
                </div>
                <h1 className="text-2xl font-black tracking-tight uppercase">Soporte</h1>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
                Mesa de ayuda y atención al cliente
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
          {activeTab === 'tickets' && <TicketsView data={data.tickets} loading={loading} onRefresh={fetchData} />}
          {activeTab !== 'tickets' && (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
              <div className="p-4 bg-muted/30 rounded-full mb-4">
                <Headphones className="size-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight mb-2">Próximamente</h3>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground max-w-sm">
                Esta sección está en desarrollo y estará disponible en la próxima actualización.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
