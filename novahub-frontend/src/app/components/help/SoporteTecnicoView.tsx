import React, { useState, useEffect } from 'react';
import {
  LifeBuoy, Plus, Search, X, Send, Clock, CheckCircle2,
  Loader2, MessageSquareText, ImagePlus, Eye,
  ChevronRight, Bug, HelpCircle, Settings, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { soporteTecnicoService } from '../../services/soporte-tecnico.service';
import { cn } from '../ui/utils';

const CATEGORIES = [
  { id: 'ALL', label: 'Todos', icon: LifeBuoy },
  { id: 'BUG', label: 'Error / Bug', icon: Bug },
  { id: 'HELP', label: 'Ayuda General', icon: HelpCircle },
  { id: 'CONFIG', label: 'Configuración', icon: Settings },
  { id: 'FEATURE', label: 'Solicitud', icon: Zap },
  { id: 'GENERAL', label: 'General', icon: MessageSquareText },
];

const PRIORITY_OPTIONS = [
  { id: 'LOW', label: 'Baja', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  { id: 'MEDIUM', label: 'Media', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  { id: 'HIGH', label: 'Alta', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  { id: 'URGENT', label: 'Urgente', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
];

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  OPEN: { label: 'Abierto', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: Clock },
  IN_PROGRESS: { label: 'En Progreso', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Loader2 },
  RESOLVED: { label: 'Resuelto', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle2 },
  CLOSED: { label: 'Cerrado', color: 'bg-muted/50 text-muted-foreground border-border/50', icon: X },
};

export function SoporteTecnicoView() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    subject: '', description: '', category: 'BUG', priority: 'MEDIUM',
    evidenceFiles: [] as File[],
  });

  useEffect(() => { fetchTickets(); }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await soporteTecnicoService.getMyTickets();
      setTickets(Array.isArray(res) ? res : []);
    } catch { toast.error('Error al cargar tickets'); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.subject.trim() || !form.description.trim()) { toast.error('Completa asunto y descripción'); return; }
    try {
      setSaving(true);
      toast.loading('Enviando ticket...', { id: 'create-ticket' });
      await soporteTecnicoService.create(form);
      toast.success('Ticket enviado correctamente', { id: 'create-ticket' });
      setShowCreateModal(false);
      setForm({ subject: '', description: '', category: 'BUG', priority: 'MEDIUM', evidenceFiles: [] });
      fetchTickets();
    } catch { toast.error('Error al enviar ticket', { id: 'create-ticket' }); }
    finally { setSaving(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (form.evidenceFiles.length + files.length > 2) { toast.error('Máximo 2 imágenes'); return; }
    setForm({ ...form, evidenceFiles: [...form.evidenceFiles, ...files].slice(0, 2) });
  };

  const removeFile = (idx: number) => {
    setForm({ ...form, evidenceFiles: form.evidenceFiles.filter((_, i) => i !== idx) });
  };

  const filtered = tickets.filter(t => {
    const matchSearch = t.subject?.toLowerCase().includes(search.toLowerCase()) || t.number?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = activeCategory === 'ALL' || t.category === activeCategory;
    return matchSearch && matchCategory;
  });

  const getPriorityBadge = (priority: string) => {
    const p = PRIORITY_OPTIONS.find(o => o.id === priority) || PRIORITY_OPTIONS[1];
    return <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", p.color)}>{p.label}</Badge>;
  };

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
            Reporta incidencias o solicita asistencia a Nova
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-xs px-6 py-6 rounded-2xl shadow-lg shadow-primary/20 border-b-4 border-primary/50 active:border-b-0 active:translate-y-1 transition-all">
          <Plus className="size-5 mr-2" /> Nuevo Ticket
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: tickets.length, gradient: 'from-primary/10' },
          { label: 'Abiertos', value: tickets.filter(t => t.status === 'OPEN').length, gradient: 'from-blue-500/10' },
          { label: 'En Progreso', value: tickets.filter(t => t.status === 'IN_PROGRESS').length, gradient: 'from-amber-500/10' },
          { label: 'Resueltos', value: tickets.filter(t => t.status === 'RESOLVED').length, gradient: 'from-emerald-500/10' },
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
          <Input placeholder="Buscar por asunto o número..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11 bg-background/50 border-transparent focus:bg-background rounded-2xl h-12 text-sm font-bold shadow-none" />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 px-2 no-scrollbar">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border border-transparent", activeCategory === cat.id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105" : "bg-background/50 text-muted-foreground hover:bg-background hover:text-primary")}>{cat.label}</button>
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
            const catInfo = CATEGORIES.find(c => c.id === ticket.category);
            const CatIcon = catInfo?.icon || LifeBuoy;
            return (
              <motion.div key={ticket.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                <Card className="group overflow-hidden rounded-2xl border-border/40 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all cursor-pointer" onClick={() => setSelectedTicket(ticket)}>
                  <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="p-2.5 rounded-xl bg-primary/10 shrink-0"><CatIcon className="size-5 text-primary" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{ticket.number}</span>
                          <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", statusInfo.color)}><StatusIcon className="size-3 mr-1" />{statusInfo.label}</Badge>
                          {getPriorityBadge(ticket.priority)}
                        </div>
                        <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{ticket.subject}</h3>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{ticket.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {(ticket.evidenceUrl1 || ticket.evidenceUrl2) && <Badge variant="outline" className="text-[9px] font-bold gap-1"><ImagePlus className="size-3" />{[ticket.evidenceUrl1, ticket.evidenceUrl2].filter(Boolean).length} img</Badge>}
                      {ticket.adminResponse && <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-bold gap-1"><CheckCircle2 className="size-3" />Respondido</Badge>}
                      <span className="text-[10px] text-muted-foreground">{new Date(ticket.createdAt).toLocaleDateString()}</span>
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
          <h2 className="text-2xl font-black tracking-tight uppercase italic">No hay tickets</h2>
          <Button variant="outline" onClick={() => setShowCreateModal(true)} className="mt-6 rounded-2xl font-black uppercase tracking-widest text-[10px]"><Plus className="size-4 mr-2" /> Crear Ticket</Button>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedTicket(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl bg-background rounded-[32px] overflow-hidden shadow-2xl border border-border/40 p-8 my-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-2xl"><Eye className="size-6 text-primary" /></div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tighter uppercase italic leading-none">{selectedTicket.number}</h2>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Detalle del Ticket</p>
                  </div>
                </div>
                <button onClick={() => setSelectedTicket(null)} className="text-muted-foreground hover:text-primary"><X className="size-6" /></button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={cn("font-black uppercase text-[10px]", STATUS_MAP[selectedTicket.status]?.color)}>{STATUS_MAP[selectedTicket.status]?.label}</Badge>
                  {getPriorityBadge(selectedTicket.priority)}
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
                {(selectedTicket.evidenceUrl1 || selectedTicket.evidenceUrl2) && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Evidencia</p>
                    <div className="flex gap-3">
                      {[selectedTicket.evidenceUrl1, selectedTicket.evidenceUrl2].filter(Boolean).map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={`Evidencia ${i+1}`} className="h-32 rounded-xl border border-border/50 object-cover hover:scale-105 transition-transform shadow-sm" /></a>
                      ))}
                    </div>
                  </div>
                )}
                {selectedTicket.adminResponse && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2 flex items-center gap-2"><CheckCircle2 className="size-4" /> Respuesta de Nova</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedTicket.adminResponse}</p>
                    {selectedTicket.respondedBy && <p className="text-[10px] text-muted-foreground mt-3">Respondido por {selectedTicket.respondedBy} • {selectedTicket.respondedAt ? new Date(selectedTicket.respondedAt).toLocaleString() : ''}</p>}
                  </div>
                )}
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-4 border-t border-border/30">
                  <span>Creado: {new Date(selectedTicket.createdAt).toLocaleString()}</span>
                  <span>Por: {selectedTicket.createdByName}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-background rounded-[32px] overflow-hidden shadow-2xl border border-border/40 p-8 my-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-2xl"><Send className="size-6 text-primary" /></div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tighter uppercase italic leading-none">Nuevo Ticket</h2>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Soporte Técnico Nova</p>
                  </div>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-primary"><X className="size-6" /></button>
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Asunto</label>
                  <Input placeholder="Ej: Error al generar factura PDF" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="h-12 rounded-2xl font-bold bg-muted/30 border-transparent focus:bg-background shadow-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Descripción</label>
                  <textarea placeholder="Describe el problema con detalle..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full min-h-[120px] p-4 rounded-2xl font-bold bg-muted/30 border-transparent focus:bg-background resize-none text-sm outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Categoría</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.filter(c => c.id !== 'ALL').map(cat => (
                      <button key={cat.id} onClick={() => setForm({ ...form, category: cat.id })} className={cn("px-3 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5 justify-center", form.category === cat.id ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50")}><cat.icon className="size-3.5" />{cat.label}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Prioridad</label>
                  <div className="grid grid-cols-4 gap-2">
                    {PRIORITY_OPTIONS.map(p => (
                      <button key={p.id} onClick={() => setForm({ ...form, priority: p.id })} className={cn("px-3 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border", form.priority === p.id ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50")}>{p.label}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Evidencia (máx. 2 imágenes)</label>
                  <div className="flex gap-3">
                    {form.evidenceFiles.map((file, i) => (
                      <div key={i} className="relative group">
                        <img src={URL.createObjectURL(file)} alt={`Ev ${i+1}`} className="h-24 w-24 rounded-xl object-cover border border-border/50" />
                        <button onClick={() => removeFile(i)} className="absolute -top-2 -right-2 size-6 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="size-3" /></button>
                      </div>
                    ))}
                    {form.evidenceFiles.length < 2 && (
                      <div className="relative group">
                        <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                        <div className="h-24 w-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center border-border/60 group-hover:border-primary/40 group-hover:bg-primary/5">
                          <ImagePlus className="size-6 text-muted-foreground/40 group-hover:text-primary/60" />
                          <span className="text-[8px] font-bold text-muted-foreground mt-1">Agregar</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <Button onClick={handleCreate} disabled={saving || !form.subject.trim() || !form.description.trim()} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest h-14 rounded-2xl shadow-xl shadow-primary/20 mt-4 border-b-4 border-primary/50 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50">
                  {saving ? <Loader2 className="size-5 animate-spin" /> : <><Send className="size-5 mr-2" />Enviar Ticket</>}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
