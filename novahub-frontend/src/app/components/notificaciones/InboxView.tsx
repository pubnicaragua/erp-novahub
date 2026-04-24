import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  Bell, 
  AlertTriangle, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  Trash2,
  Calendar,
  ClipboardList,
  Zap,
  Search,
  Sparkles
} from 'lucide-react';
import { inboxService } from '../../services/notificaciones.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface InboxViewProps {
  data: any[];
  loading: boolean;
  onRefresh: () => void;
}

export const InboxView: React.FC<InboxViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleMarkRead = async (id: string) => {
    try {
      await inboxService.markRead(id);
      onRefresh();
    } catch {
      toast.error('Error al marcar como leída');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await inboxService.delete(id);
      toast.success('Notificación eliminada');
      onRefresh();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleReadAll = async () => {
    try {
      await inboxService.readAll();
      toast.success('Todas marcadas como leídas');
      onRefresh();
    } catch {
      toast.error('Error');
    }
  };

  const handleAction = (item: any) => {
    const content = (item.content || '').toUpperCase();
    const metadata = item.metadata || {};
    
    if (metadata.module) {
      window.dispatchEvent(new CustomEvent('navigate-module', { 
        detail: { 
          module: metadata.module.toLowerCase(), 
          subModule: metadata.subModule || undefined 
        } 
      }));
      toast.success(`Navegando a ${metadata.module}`);
    } else if (content.includes('TAREA')) {
      window.dispatchEvent(new CustomEvent('navigate-module', { 
        detail: { module: 'actividades', subModule: 'tareas' } 
      }));
    } else if (content.includes('FACTURA') || content.includes('VENTA')) {
      window.dispatchEvent(new CustomEvent('navigate-module', { 
        detail: { module: 'ventas', subModule: 'facturas' } 
      }));
    } else if (content.includes('COMPRA') || content.includes('GASTO')) {
      window.dispatchEvent(new CustomEvent('navigate-module', { 
        detail: { module: 'compras' } 
      }));
    } else {
      toast.info('Detalle de notificación', { description: item.content });
    }
    
    if (!item.isRead) handleMarkRead(item.id);
  };

  const getIconData = (type: string, content: string) => {
    const c = content.toUpperCase();
    if (c.includes('TAREA')) return { icon: ClipboardList, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
    if (c.includes('RECORDATORIO')) return { icon: Calendar, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    if (c.includes('URGENTE')) return { icon: Zap, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
    
    switch (type) {
      case 'ALERT': return { icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
      case 'MESSAGE': return { icon: MessageSquare, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' };
      case 'PUSH': return { icon: Send, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
      default: return { icon: Bell, color: 'text-muted-foreground', bg: 'bg-muted/10', border: 'border-border' };
    }
  };

  const filtered = data.filter(n => 
    n.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    n.content?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6">
        <div className="relative">
          <div className="size-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
          <Sparkles className="absolute -top-2 -right-2 size-6 text-primary animate-bounce" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40 animate-pulse italic">Cargando Actividad...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-background/40 backdrop-blur-xl p-6 rounded-[2rem] border border-border/40 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary rounded-2xl shadow-lg shadow-primary/20">
            <Bell className="size-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">Bandeja de Entrada</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mt-1 italic">Stream de actividad unificada</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
            <Input 
              placeholder="Buscar evento..." 
              className="pl-9 h-11 w-full md:w-64 bg-background/50 border-border/50 rounded-2xl text-xs focus:ring-primary/20" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
          <Button 
            variant="outline"
            onClick={handleReadAll}
            disabled={!data.some(n => !n.isRead)}
            className="h-11 rounded-2xl border-primary/20 bg-primary/5 hover:bg-primary hover:text-primary-foreground text-[10px] font-black uppercase tracking-widest gap-2 transition-all"
          >
            <CheckCircle2 className="size-4" />
            Marcar Todo
          </Button>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center">
               <div className="inline-flex p-6 bg-muted/10 rounded-full mb-4">
                 <Bell className="size-10 text-muted-foreground/20" />
               </div>
               <p className="text-sm font-black uppercase tracking-tighter text-muted-foreground/40">Sin notificaciones nuevas</p>
            </motion.div>
          ) : (
            filtered.map((item, idx) => {
              const iconData = getIconData(item.type, item.content);
              const Icon = iconData.icon;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05, type: 'spring', damping: 20 }}
                  className="group relative"
                >
                  <Card 
                    className={cn(
                      "border-border/40 hover:border-primary/30 transition-all duration-500 cursor-pointer rounded-3xl overflow-hidden group-hover:shadow-xl group-hover:shadow-primary/5",
                      item.isRead ? "bg-background/40 opacity-70" : "bg-background shadow-md shadow-primary/5"
                    )}
                    onClick={() => handleAction(item)}
                  >
                    <CardContent className="p-5 flex items-start gap-5">
                      <div className={cn(
                        "size-12 rounded-2xl flex items-center justify-center shrink-0 border transition-transform duration-500 group-hover:scale-110",
                        iconData.bg, iconData.border
                      )}>
                        <Icon className={cn("size-6", iconData.color)} />
                      </div>

                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <h3 className={cn(
                              "text-sm font-bold uppercase tracking-tight truncate",
                              item.isRead ? "text-muted-foreground" : "text-foreground"
                            )}>
                              {item.title}
                            </h3>
                            {!item.isRead && (
                              <Badge className="bg-primary text-[7px] h-3.5 px-1.5 rounded-full font-black animate-pulse">NEW</Badge>
                            )}
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 bg-muted/10 px-2 py-1 rounded-lg flex items-center gap-1.5">
                            <Clock className="size-3" />
                            {format(new Date(item.createdAt), 'HH:mm')}
                            <span className="opacity-20 mx-0.5">|</span>
                            {format(new Date(item.createdAt), 'dd MMM')}
                          </span>
                        </div>

                        <p className={cn(
                          "text-xs italic leading-relaxed",
                          item.isRead ? "text-muted-foreground/40" : "text-muted-foreground/70"
                        )}>
                          {item.content.includes(':') ? item.content.split(':').pop()?.trim() : item.content}
                        </p>

                        {/* Inline Actions (Visible on Hover) */}
                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/20 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-[9px] font-black uppercase tracking-widest gap-2 px-4"
                          >
                            <ArrowRight className="size-3" />
                            Ver Detalles
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-8 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 ml-auto"
                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {filtered.length > 0 && (
        <p className="text-center text-[9px] font-black uppercase tracking-[0.5em] text-muted-foreground/10 py-8">
          Fin del Historial
        </p>
      )}
    </div>
  );
};
