import { useState, useEffect } from 'react';
import {
  LifeBuoy, Search, X, Clock, CheckCircle2, Loader2, MessageSquareText,
  ImagePlus, Eye, ChevronRight, Building2, Send, AlertTriangle, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { soporteTecnicoService } from '../../services/soporte-tecnico.service';
import { cn } from '../ui/utils';

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  OPEN: { label: 'Abierto', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: Clock },
  IN_PROGRESS: { label: 'En Progreso', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Loader2 },
  RESOLVED: { label: 'Resuelto', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle2 },
  CLOSED: { label: 'Cerrado', color: 'bg-muted/50 text-muted-foreground border-border/50', icon: X },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Baja', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  MEDIUM: { label: 'Media', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  HIGH: { label: 'Alta', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  URGENT: { label: 'Urgente', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
};

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export function SoporteTecnicoAdminView() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [ticketsRes, statsRes] = await Promise.all([
        soporteTecnicoService.getAll(),
        soporteTecnicoService.getStats(),
      ]);
      setTickets(Array.isArray(ticketsRes) ? ticketsRes : []);
      setStats(statsRes || {});
    } catch { toast.error('Error al cargar soporte técnico'); }
    finally { setLoading(false); }
  };

  const handleRespond = async () => {
    if (!selectedTicket) return;
    try {
      setSaving(true);
      await soporteTecnicoService.respond(selectedTicket.id, {
        ...(adminResponse.trim() ? { adminResponse: adminResponse.trim() } : {}),
        ...(newStatus ? { status: newStatus } : {}),
      });
      toast.success('Ticket actualizado');
      setSelectedTicket(null);
      setAdminResponse('');
      setNewStatus('');
      fetchAll();
    } catch { toast.error('Error al responder'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este ticket?')) return;
    try {
      await soporteTecnicoService.remove(id);
      toast.success('Ticket eliminado');
      fetchAll();
    } catch { toast.error('Error al eliminar'); }
  };

  const openTicketDetail = (ticket: any) => {
    setSelectedTicket(ticket);
    setAdminResponse(ticket.adminResponse || '');
    setNewStatus(ticket.status);
  };

  const filtered = tickets.filter(t => {
    const matchSearch = t.subject?.toLowerCase().includes(search.toLowerCase()) || t.number?.toLowerCase().includes(search.toLowerCase()) || t.clientTenant?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'ALL' || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 p-4 md:p-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter flex items-center gap-3 uppercase italic">
            <LifeBuoy className="size-9 text-primary" />
            Soporte <span className="text-primary">Técnico</span>
          </h1>
          <p className="text-muted-foreground mt-1 font-medium flex items-center gap-2">
            <MessageSquareText className="size-4" />
            Gestión de solicitudes de soporte de empresas
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total || 0, gradient: 'from-primary/10' },
          { label: 'Abiertos', value: stats.open || 0, gradient: 'from-blue-500/10' },
          { label: 'En Progreso', value: stats.inProgress || 0, gradient: 'from-amber-500/10' },
          { label: 'Resueltos', value: stats.resolved || 0, gradient: 'from-emerald-500/10' },
        ].map(s => (
          <div key={s.label} className={cn("bg-gradient-to-br to-transparent p-4 rounded-3xl border border-border/30 shadow-sm", s.gradient)}>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">{s.label}</p>
            <p className="text-3xl font-black tracking-tighter italic">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-muted/30 p-2 rounded-3xl border border-border/40 backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Buscar por empresa, asunto o número..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11 bg-background/50 border-transparent focus:bg-background rounded-2xl h-12 text-sm font-bold shadow-none" />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 px-2 no-scrollbar">
          {['ALL', ...STATUS_OPTIONS].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border border-transparent", filterStatus === s ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105" : "bg-background/50 text-muted-foreground hover:bg-background hover:text-primary")}>{s === 'ALL' ? 'Todos' : STATUS_MAP[s]?.label}</button>
          ))}
        </div>
      </div>

      {/* Tickets List */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4">{[1,2,3].map(i => <div key={i} className="h-28 rounded-3xl bg-muted animate-pulse border border-border/40" />)}</div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((ticket, idx) => {
            const statusInfo = STATUS_MAP[ticket.status] || STATUS_MAP.OPEN;
            const StatusIcon = statusInfo.icon;
            const priorityInfo = PRIORITY_MAP[ticket.priority] || PRIORITY_MAP.MEDIUM;
            return (
              <motion.div key={ticket.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                <Card className="group overflow-hidden rounded-2xl border-border/40 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all cursor-pointer" onClick={() => openTicketDetail(ticket)}>
                  <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="p-2.5 rounded-xl bg-primary/10 shrink-0"><Building2 className="size-5 text-primary" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{ticket.number}</span>
                          <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", statusInfo.color)}><StatusIcon className="size-3 mr-1" />{statusInfo.label}</Badge>
                          <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", priorityInfo.color)}>{priorityInfo.label}</Badge>
                          <Badge variant="outline" className="text-[9px] font-bold bg-indigo-500/10 text-indigo-500 border-indigo-500/20"><Building2 className="size-3 mr-1" />{ticket.clientTenant?.name || 'N/A'}</Badge>
                        </div>
                        <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{ticket.subject}</h3>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">De: {ticket.createdByName} ({ticket.createdByEmail})</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {(ticket.evidenceUrl1 || ticket.evidenceUrl2) && <Badge variant="outline" className="text-[9px] font-bold gap-1"><ImagePlus className="size-3" />{[ticket.evidenceUrl1, ticket.evidenceUrl2].filter(Boolean).length}</Badge>}
                      {ticket.adminResponse ? <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-bold gap-1"><CheckCircle2 className="size-3" />Respondido</Badge> : <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[9px] font-bold gap-1"><AlertTriangle className="size-3" />Sin respuesta</Badge>}
                      <span className="text-[10px] text-muted-foreground">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10" onClick={(e) => { e.stopPropagation(); handleDelete(ticket.id); }}><Trash2 className="size-4" /></Button>
                      <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/10 rounded-[40px] border-2 border-dashed border-border/40">
          <div className="size-24 rounded-full bg-muted flex items-center justify-center mb-6 shadow-inner"><LifeBuoy className="size-12 text-muted-foreground/30" /></div>
          <h2 className="text-2xl font-black tracking-tight uppercase italic">Sin solicitudes</h2>
          <p className="text-muted-foreground mt-2 text-sm">No hay tickets de soporte pendientes</p>
        </div>
      )}

      {/* Respond Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedTicket(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl bg-background rounded-[32px] overflow-hidden shadow-2xl border border-border/40 p-8 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-2xl"><Eye className="size-6 text-primary" /></div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tighter uppercase italic leading-none">{selectedTicket.number}</h2>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">{selectedTicket.clientTenant?.name}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedTicket(null)} className="text-muted-foreground hover:text-primary"><X className="size-6" /></button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={cn("font-black uppercase text-[10px]", STATUS_MAP[selectedTicket.status]?.color)}>{STATUS_MAP[selectedTicket.status]?.label}</Badge>
                  <Badge variant="outline" className={cn("font-black uppercase text-[10px]", PRIORITY_MAP[selectedTicket.priority]?.color)}>{PRIORITY_MAP[selectedTicket.priority]?.label}</Badge>
                  <Badge variant="outline" className="text-[10px] font-bold">{selectedTicket.category}</Badge>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Asunto</p>
                  <p className="font-bold text-lg">{selectedTicket.subject}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Descripción</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/20 p-4 rounded-2xl border border-border/30">{selectedTicket.description}</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground"><span>De: {selectedTicket.createdByName}</span><span>{selectedTicket.createdByEmail}</span><span>{new Date(selectedTicket.createdAt).toLocaleString()}</span></div>
                {(selectedTicket.evidenceUrl1 || selectedTicket.evidenceUrl2) && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Evidencia</p>
                    <div className="flex gap-3">
                      {[selectedTicket.evidenceUrl1, selectedTicket.evidenceUrl2].filter(Boolean).map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={`Ev ${i+1}`} className="h-40 rounded-xl border border-border/50 object-cover hover:scale-105 transition-transform shadow-sm" /></a>
                      ))}
                    </div>
                  </div>
                )}
                {/* Respond Section */}
                <div className="border-t border-border/30 pt-6 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Responder al ticket</p>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Estado</label>
                    <div className="grid grid-cols-4 gap-2">
                      {STATUS_OPTIONS.map(s => (
                        <button key={s} onClick={() => setNewStatus(s)} className={cn("px-3 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border", newStatus === s ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50")}>{STATUS_MAP[s]?.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Respuesta</label>
                    <textarea placeholder="Escribe la respuesta para la empresa..." value={adminResponse} onChange={(e) => setAdminResponse(e.target.value)} className="w-full min-h-[120px] p-4 rounded-2xl font-bold bg-muted/30 border-transparent focus:bg-background resize-none text-sm outline-none" />
                  </div>
                  <Button onClick={handleRespond} disabled={saving} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest h-14 rounded-2xl shadow-xl shadow-primary/20 border-b-4 border-primary/50 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50">
                    {saving ? <Loader2 className="size-5 animate-spin" /> : <><Send className="size-5 mr-2" />Enviar Respuesta</>}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
