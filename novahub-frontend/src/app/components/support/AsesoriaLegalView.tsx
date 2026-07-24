import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Scale, Plus, Loader2, ArrowLeft, Eye, X,
  FileText, Clock, Bell, AlertTriangle,
  Calendar, User, Send, Trash2, Search, MessageCircle,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { cn } from '../ui/utils';
import { toast } from 'sonner';
import { legalService, type LegalCase, type LegalReminder } from '../../services/legal.service';
import { useAuth } from '../../contexts/AuthContext';
import { LegalChatPanel } from './LegalChatPanel';

interface AsesoriaLegalViewProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (module: string) => void;
}

export function AsesoriaLegalView({ activeSubModule, onSubModuleChange, isSidebarCollapsed}: AsesoriaLegalViewProps) {
  const { canPerform } = useAuth();
  const [activeTab, setActiveTab] = useState(activeSubModule || 'cases');
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [reminders, setReminders] = useState<LegalReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<LegalCase | null>(null);
  const [showNewCase, setShowNewCase] = useState(false);
  const [showNewReminder, setShowNewReminder] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [casesRes, remindersRes]: any[] = await Promise.all([
        legalService.listCases(filterType !== 'all' ? filterType : undefined, filterStatus !== 'all' ? filterStatus : undefined),
        legalService.listReminders(),
      ]);
      setCases(casesRes?.data || casesRes || []);
      setReminders(remindersRes?.data || remindersRes || []);
    } catch {
      toast.error('Error al cargar datos legales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filterType, filterStatus]);

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

  const filteredCases = cases.filter((c) =>
    !search || c.number.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: cases.length,
    pending: cases.filter((c) => c.status === 'PENDING').length,
    inProgress: cases.filter((c) => c.status === 'IN_PROGRESS').length,
    waitingDocs: cases.filter((c) => c.status === 'WAITING_DOCS').length,
    completed: cases.filter((c) => c.status === 'COMPLETED').length,
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
        <CardContent className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
          <div className="max-w-3xl space-y-4">
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
              Módulo Legal
            </Badge>
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tight sm:text-3xl">
                Asesoría <span className="text-primary">Legal</span>
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Gestioná trámites, contratos, consultas y recordatorios legales de la empresa en un solo lugar.
              </p>
            </div>
          </div>
          <div className="flex size-20 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
            <Scale className="size-10 text-primary" />
          </div>
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {selectedCase ? (
          <motion.div key="detail" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            <CaseDetail
              caseData={selectedCase}
              onBack={() => setSelectedCase(null)}
              onRefresh={fetchData}
            />
          </motion.div>
        ) : (
          <motion.div key="main" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className={cn(!isSidebarCollapsed && "hidden lg:hidden", "w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto justify-start pb-2 flex-nowrap gap-1.5 rounded-2xl border border-border/40 mb-6")}>
                <TabsTrigger value="cases"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
                    data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                    data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                  <FileText className="size-4" /> Casos
                </TabsTrigger>
                <TabsTrigger value="reminders"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
                    data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                    data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                  <Bell className="size-4" /> Recordatorios
                </TabsTrigger>
              </TabsList>

              <TabsContent value="cases" className="mt-0">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 md:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número o descripción..." className="pl-9 h-10 rounded-xl" />
                    </div>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-[180px] h-10 rounded-xl"><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los tipos</SelectItem>
                        {legalService.CASE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-[160px] h-10 rounded-xl"><SelectValue placeholder="Estado" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="PENDING">Pendiente</SelectItem>
                        <SelectItem value="IN_PROGRESS">En Proceso</SelectItem>
                        <SelectItem value="WAITING_DOCS">Esperando Docs</SelectItem>
                        <SelectItem value="COMPLETED">Completado</SelectItem>
                        <SelectItem value="CANCELLED">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {canPerform('LEGAL', 'create') && (
                    <Button onClick={() => setShowNewCase(true)} className="rounded-xl gap-2 font-bold">
                      <Plus className="size-4" /> Nuevo Caso
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  {[
                    { label: 'Total', value: stats.total, color: 'text-foreground' },
                    { label: 'Pendientes', value: stats.pending, color: 'text-amber-600' },
                    { label: 'En Proceso', value: stats.inProgress, color: 'text-blue-600' },
                    { label: 'Esperando Docs', value: stats.waitingDocs, color: 'text-orange-600' },
                    { label: 'Completados', value: stats.completed, color: 'text-emerald-600' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl bg-muted/30 p-3 text-center border border-border/30">
                      <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">{s.label}</div>
                      <div className={cn('text-xl font-black', s.color)}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="size-8 animate-spin text-primary" /></div>
                ) : filteredCases.length === 0 ? (
                  <Card className="border-dashed border-2 border-border/40">
                    <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                      <Scale className="size-12 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-center">No hay casos legales{search ? ' que coincidan' : ''}.</p>
                      <Button onClick={() => setShowNewCase(true)} className="rounded-xl gap-2 font-bold">
                        <Plus className="size-4" /> Crear Primer Caso
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {filteredCases.map((c) => (
                      <Card key={c.id} className="hover:border-primary/50 cursor-pointer transition-all border-border/50" onClick={() => setSelectedCase(c)}>
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1 flex-wrap">
                              <span className="font-mono text-xs text-muted-foreground">{c.number}</span>
                              <Badge className={cn('text-[10px] border', legalService.getStatusColor(c.status))}>
                                {legalService.getStatusLabel(c.status)}
                              </Badge>
                              <Badge className={cn('text-[10px] border', legalService.getUrgencyColor(c.urgency))}>
                                {legalService.getUrgencyLabel(c.urgency)}
                              </Badge>
                            </div>
                            <p className="text-sm font-bold truncate">{legalService.getCaseTypeLabel(c.type)}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.description}</p>
                            <div className="flex items-center gap-4 mt-1">
                              {c.assignedTo && <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="size-3" />{c.assignedTo}</span>}
                              {c.desiredDate && <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="size-3" />{new Date(c.desiredDate).toLocaleDateString('es-NI')}</span>}
                              <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString('es-NI')}</span>
                            </div>
                          </div>
                          <Eye className="size-5 text-muted-foreground shrink-0" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="reminders" className="mt-0">
                <RemindersTab reminders={reminders} onRefresh={fetchData} onNew={() => setShowNewReminder(true)} canPerform={canPerform} />
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showNewCase} onOpenChange={setShowNewCase}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl border-none">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border/30 bg-muted/10">
            <DialogTitle className="text-lg font-black">Nuevo Caso Legal</DialogTitle>
            <button onClick={() => setShowNewCase(false)} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
              <X className="size-4" />
            </button>
          </div>
          <div className="p-4 sm:p-6">
            <NewCaseForm
              onComplete={(c) => { setCases((prev) => [c, ...prev]); setShowNewCase(false); toast.success('Caso creado'); }}
              onCancel={() => setShowNewCase(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewReminder} onOpenChange={setShowNewReminder}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-0 rounded-3xl border-none">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border/30 bg-muted/10">
            <DialogTitle className="text-lg font-black">Nuevo Recordatorio</DialogTitle>
            <button onClick={() => setShowNewReminder(false)} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
              <X className="size-4" />
            </button>
          </div>
          <div className="p-4 sm:p-6">
            <NewReminderForm
              cases={cases}
              onComplete={(r) => { setReminders((prev) => [r, ...prev]); setShowNewReminder(false); toast.success('Recordatorio creado'); }}
              onCancel={() => setShowNewReminder(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewCaseForm({ onComplete, onCancel }: { onComplete: (c: LegalCase) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ type: 'OTHER', description: '', urgency: 'NORMAL', desiredDate: '', assignedTo: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.description.trim()) { toast.error('Descripción requerida'); return; }
    setLoading(true);
    try {
      const res: any = await legalService.createCase(form);
      onComplete(res?.data || res);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al crear caso');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase font-black tracking-widest">Tipo de trámite</Label>
        <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
          <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {legalService.CASE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase font-black tracking-widest">Descripción</Label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Describí el caso o trámite legal..." rows={3} className="rounded-xl resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-black tracking-widest">Urgencia</Label>
          <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="NORMAL">Normal</SelectItem>
              <SelectItem value="URGENT">Urgente</SelectItem>
              <SelectItem value="VERY_URGENT">Muy Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-black tracking-widest">Fecha deseada</Label>
          <Input type="date" value={form.desiredDate} onChange={(e) => setForm({ ...form, desiredDate: e.target.value })} className="h-11 rounded-xl" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase font-black tracking-widest">Asignar a (opcional)</Label>
        <Input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} placeholder="Nombre del abogado o responsable" className="h-11 rounded-xl" />
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} className="h-11 rounded-xl font-bold gap-2 flex-1">Cancelar</Button>
        <Button onClick={handleSubmit} disabled={loading || !form.description.trim()} className="h-11 rounded-xl font-bold gap-2 flex-1">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Crear Caso
        </Button>
      </div>
    </div>
  );
}

function CaseDetail({ caseData, onBack, onRefresh }: { caseData: LegalCase; onBack: () => void; onRefresh: () => void }) {
  const { canPerform } = useAuth();
  const [note, setNote] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [c, setCase] = useState<LegalCase>(caseData);

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setAddingNote(true);
    try {
      await legalService.addNote(c.id, note, isInternal);
      setNote('');
      setIsInternal(false);
      toast.success('Nota agregada');
      const res: any = await legalService.getCase(c.id);
      setCase(res?.data || res);
    } catch { toast.error('Error al agregar nota'); }
    finally { setAddingNote(false); }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await legalService.updateStatus(c.id, newStatus);
      toast.success('Estado actualizado');
      const res: any = await legalService.getCase(c.id);
      setCase(res?.data || res);
      setShowStatusDialog(false);
      onRefresh();
    } catch { toast.error('Error al cambiar estado'); }
  };

  if (showChat) {
    return <LegalChatPanel caseId={c.id} caseNumber={c.number} onBack={() => setShowChat(false)} />;
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-black tracking-tighter">{c.number}</h2>
              <Badge className={cn('text-[10px] border', legalService.getStatusColor(c.status))}>
                {legalService.getStatusLabel(c.status)}
              </Badge>
              <Badge className={cn('text-[10px] border', legalService.getUrgencyColor(c.urgency))}>
                {legalService.getUrgencyLabel(c.urgency)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{legalService.getCaseTypeLabel(c.type)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowChat(true)} className="gap-2 rounded-xl text-xs font-bold">
              <MessageCircle className="size-3" /> Chat
            </Button>
            {canPerform('LEGAL', 'edit') && (
              <Button variant="outline" onClick={() => setShowStatusDialog(true)} className="gap-2 rounded-xl text-xs font-bold">
                <AlertTriangle className="size-3" /> Cambiar Estado
              </Button>
            )}
            <Button variant="outline" onClick={onBack} className="gap-2 rounded-xl"><ArrowLeft className="size-4" /> Volver</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 p-4">
          <p className="text-sm whitespace-pre-wrap">{c.description}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            {c.assignedTo && <span className="flex items-center gap-1"><User className="size-3" />{c.assignedTo}</span>}
            {c.desiredDate && <span className="flex items-center gap-1"><Calendar className="size-3" />Fecha deseada: {new Date(c.desiredDate).toLocaleDateString('es-NI')}</span>}
            <span>Creado: {new Date(c.createdAt).toLocaleDateString('es-NI')}</span>
            {c.completedAt && <span>Completado: {new Date(c.completedAt).toLocaleDateString('es-NI')}</span>}
          </div>
        </div>

        {c.documents.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Documentos ({c.documents.length})</h4>
            <div className="space-y-1">
              {c.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-2 border border-border/30">
                  <span className="text-sm font-bold">{doc.name}</span>
                  <span className="text-xs text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString('es-NI')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Notas ({c.notes.length})</h4>
          {c.notes.length === 0 && <p className="text-xs text-muted-foreground">Sin notas aún.</p>}
          <div className="space-y-2">
            {c.notes.map((n) => (
              <div key={n.id} className={cn('rounded-xl p-3 border text-sm', n.isInternal ? 'bg-amber-50 border-amber-200' : 'bg-muted/30 border-border/30')}>
                <p className="whitespace-pre-wrap">{n.content}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span>{n.createdBy}</span>
                  <span>{new Date(n.createdAt).toLocaleDateString('es-NI')} {new Date(n.createdAt).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })}</span>
                  {n.isInternal && <Badge variant="outline" className="border-amber-300 text-amber-600">Interna</Badge>}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-2 border-t border-border/30">
            <Label className="text-[10px] uppercase font-black tracking-widest">Agregar nota</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escribí una nota..." rows={2} className="rounded-xl resize-none" />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)}
                  className="size-3.5 rounded border-border bg-background text-primary" />
                <span className="text-xs text-muted-foreground">Nota interna</span>
              </label>
              <Button onClick={handleAddNote} disabled={addingNote || !note.trim() || !canPerform('LEGAL', 'edit')} className="h-9 rounded-xl gap-2 text-xs font-bold">
                {addingNote ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />} Agregar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="w-[95vw] max-w-sm p-0 rounded-3xl border-none">
          <div className="p-4 sm:p-6 space-y-3">
            <DialogTitle className="text-lg font-black">Cambiar Estado</DialogTitle>
            {['PENDING', 'IN_PROGRESS', 'WAITING_DOCS', 'COMPLETED', 'CANCELLED'].map((s) => (
              <button key={s} onClick={() => handleStatusChange(s)}
                className={cn('w-full text-left px-4 py-3 rounded-xl border text-sm font-bold transition-all hover:border-primary/50',
                  c.status === s ? 'border-primary bg-primary/10 text-primary' : 'border-border/50')}>
                {legalService.getStatusLabel(s)}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function RemindersTab({ reminders, onRefresh, onNew, canPerform }: { reminders: LegalReminder[]; onRefresh: () => void; onNew: () => void; canPerform: any }) {
  const [cutoff] = useState(new Date());
  const upcoming = reminders.filter((r) => new Date(r.dueDate) >= cutoff).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const past = reminders.filter((r) => new Date(r.dueDate) < cutoff).sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

  const handleDelete = async (id: string) => {
    try {
      await legalService.deleteReminder(id);
      toast.success('Recordatorio eliminado');
      onRefresh();
    } catch { toast.error('Error al eliminar'); }
  };

  const isOverdue = (d: string) => new Date(d) < new Date();

  return (
    <div className="space-y-4">
      {canPerform('LEGAL', 'create') && (
        <div className="flex justify-end">
          <Button onClick={onNew} className="rounded-xl gap-2 font-bold"><Plus className="size-4" /> Nuevo Recordatorio</Button>
        </div>
      )}
      {upcoming.length === 0 && past.length === 0 ? (
        <Card className="border-dashed border-2 border-border/40">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Bell className="size-12 text-muted-foreground/30" />
            <p className="text-muted-foreground text-center">No hay recordatorios.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Próximos / Pendientes</h4>
              {upcoming.map((r) => (
                <Card key={r.id} className="border-border/50">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{r.title}</p>
                      {r.description && <p className="text-xs text-muted-foreground truncate">{r.description}</p>}
                      <div className="flex items-center gap-3 mt-1">
                        <span className={cn('text-xs flex items-center gap-1', isOverdue(r.dueDate) ? 'text-rose-600' : 'text-muted-foreground')}>
                          <Clock className="size-3" />{new Date(r.dueDate).toLocaleDateString('es-NI')}
                        </span>
                        {r.caseId && <Badge variant="outline" className="text-[10px]">Vinculado</Badge>}
                      </div>
                    </div>
                    {canPerform('LEGAL', 'delete') && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Vencidos</h4>
              {past.map((r) => (
                <Card key={r.id} className="border-border/50 opacity-60">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{r.title}</p>
                      <span className="text-xs text-rose-600 flex items-center gap-1">
                        <Clock className="size-3" />Venció {new Date(r.dueDate).toLocaleDateString('es-NI')}
                      </span>
                    </div>
                    {canPerform('LEGAL', 'delete') && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NewReminderForm({ cases, onComplete, onCancel }: { cases: LegalCase[]; onComplete: (r: LegalReminder) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', caseId: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.dueDate) { toast.error('Título y fecha requeridos'); return; }
    setLoading(true);
    try {
      const res: any = await legalService.createReminder({
        title: form.title,
        description: form.description || undefined,
        dueDate: form.dueDate,
        caseId: form.caseId || undefined,
      });
      onComplete(res?.data || res);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al crear recordatorio');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase font-black tracking-widest">Título</Label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: Vencimiento de trámite DGI" className="h-11 rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase font-black tracking-widest">Descripción (opcional)</Label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="rounded-xl resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-black tracking-widest">Fecha</Label>
          <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="h-11 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-black tracking-widest">Caso vinculado</Label>
          <Select value={form.caseId} onValueChange={(v) => setForm({ ...form, caseId: v })}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Ninguno" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Ninguno</SelectItem>
              {cases.map((c) => <SelectItem key={c.id} value={c.id}>{c.number} — {legalService.getCaseTypeLabel(c.type)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} className="h-11 rounded-xl font-bold flex-1">Cancelar</Button>
        <Button onClick={handleSubmit} disabled={loading || !form.title.trim() || !form.dueDate} className="h-11 rounded-xl font-bold gap-2 flex-1">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Crear
        </Button>
      </div>
    </div>
  );
}
