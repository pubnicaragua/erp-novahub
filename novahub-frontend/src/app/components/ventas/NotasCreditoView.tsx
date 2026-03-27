import React, { useState, useEffect } from 'react';
import { 
  FileMinus, Plus, Search, TrendingUp, Clock, CheckCircle2, XCircle, Eye, Trash2, ChevronLeft, Send, FileDown
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { creditNotesService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import type { CreditNote, Customer } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { generateEstimatePDF } from '../../utils/pdfGenerator';

interface NotasCreditoViewProps {
  data: CreditNote[];
  loading: boolean;
  onRefresh: () => void;
  customers?: Customer[];
}

const statusOptions = [
  { label: 'Borrador', value: 'DRAFT',   color: 'bg-muted/20 text-muted-foreground' },
  { label: 'Emitida',  value: 'ISSUED',  color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Aplicada', value: 'APPLIED', color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Anulada',  value: 'VOIDED',  color: 'bg-rose-500/10 text-rose-500' },
];

export function NotasCreditoView({ data, loading, onRefresh, customers = [] }: NotasCreditoViewProps) {
  const { displayCurrency, formatConvertedAmount } = useCurrency();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (editingId) {
      const cn = data.find(x => x.id === editingId);
      if (cn) setLocalDoc(JSON.parse(JSON.stringify(cn)));
    } else if (!isCreating) {
      setLocalDoc(null);
    }
  }, [editingId]);

  const filtered = data.filter(cn => 
    cn.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (cn.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    cn.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const recalcTotal = (items: any[]) => items.reduce((acc: number, it: any) => acc + Number(it.total || 0), 0);

  const startNew = () => {
    setIsCreating(true);
    setEditingId(null);
    setLocalDoc({
      customerId: '',
      date: new Date().toISOString().split('T')[0],
      reason: '',
      items: [],
      total: 0,
    });
  };

  const handleSave = async () => {
    if (!localDoc) return;
    if (!localDoc.customerId) { toast.error('Selecciona un cliente'); return; }
    if (!localDoc.reason.trim()) { toast.error('Ingresa la razón de la nota'); return; }
    try {
      if (isCreating) {
        await creditNotesService.create({
          customerId: localDoc.customerId,
          invoiceId: localDoc.invoiceId || undefined,
          date: new Date(localDoc.date).toISOString(),
          reason: localDoc.reason.trim(),
          items: (localDoc.items || []).map((item: any) => ({
            description: item.description || '',
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            total: Number(item.total || 0),
          })),
          total: localDoc.total,
          status: 'DRAFT',
          currency: displayCurrency === 'USD' ? 'USD' : 'NIO',
        } as any);
        toast.success('Nota de crédito creada exitosamente');
      } else {
        await creditNotesService.update(localDoc.id, localDoc);
        toast.success('Nota de crédito actualizada');
      }
      setIsCreating(false); setEditingId(null); setLocalDoc(null); onRefresh();
    } catch { toast.error('Error al guardar'); }
  };

  const handleIssue = async (id: string) => {
    try {
      await creditNotesService.issue(id);
      toast.success('Nota de crédito emitida — Balance del cliente actualizado');
      setEditingId(null); onRefresh();
    } catch { toast.error('Error al emitir nota de crédito'); }
  };

  const handleExportPDF = async (row: CreditNote) => {
    try {
      const tenantName = user?.tenantName || 'Mi Empresa';
      await generateEstimatePDF({
        estimate: { ...row, number: row.number, customer: row.customer || customers.find(c => c.id === row.customerId) },
        tenantName,
        formatAmount: formatConvertedAmount,
        documentType: 'credit-note',
      });
      toast.success('PDF generado exitosamente');
    } catch { toast.error('Error al generar PDF'); }
  };

  const getCustomerName = (cn: CreditNote) => cn.customer?.name || customers.find(c => c.id === cn.customerId)?.name || 'Cliente';

  const columns: ColumnDef<CreditNote>[] = [
    { key: 'number', header: 'Nº Nota', width: '140px',
      render: (val, row) => <span className="text-xs font-black font-mono text-primary cursor-pointer hover:underline" onClick={() => setEditingId(row.id)}>{val}</span> },
    { key: 'customerId', header: 'Cliente', render: (val, row) => <span className="text-[13px] font-bold text-foreground">{getCustomerName(row)}</span> },
    { key: 'date', header: 'Fecha', render: (val) => <span className="text-xs font-medium text-muted-foreground">{new Date(val).toLocaleDateString()}</span> },
    { key: 'reason', header: 'Razón', render: (val) => <span className="text-xs text-muted-foreground truncate max-w-[200px] block">{val}</span> },
    { key: 'total', header: 'Total', width: '130px', render: (val) => <span className="text-[13px] font-black tabular-nums text-rose-500">{formatConvertedAmount(Number(val||0), 'USD')}</span> },
    { key: 'status', header: 'Estado', width: '120px', render: (val) => {
      const opt = statusOptions.find(o => o.value === (val||'').toUpperCase());
      return <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none", opt?.color || 'bg-muted/20 text-muted-foreground')}>{opt?.label || val}</Badge>; } },
  ];

  const kpis = [
    { title: 'Total Emitido',  value: formatConvertedAmount(data.filter(cn => (cn.status||'').toUpperCase() === 'ISSUED').reduce((acc, cn) => acc + Number(cn.total||0), 0), 'USD'), icon: FileMinus,    color: 'text-rose-500',    bg: 'bg-rose-500/10'     },
    { title: 'Borradores',     value: data.filter(cn => (cn.status||'').toUpperCase() === 'DRAFT').length,  icon: Clock,        color: 'text-amber-500',   bg: 'bg-amber-500/10'    },
    { title: 'Emitidas',       value: data.filter(cn => (cn.status||'').toUpperCase() === 'ISSUED').length, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10'  },
    { title: 'Crédito Vivo',   value: formatConvertedAmount(data.filter(cn => ['ISSUED','APPLIED'].includes((cn.status||'').toUpperCase())).reduce((acc, cn) => acc + Number(cn.total||0), 0), 'USD'), icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  // ─── INLINE FORM ────────────────────────────────────────────────────
  if ((editingId || isCreating) && localDoc) {
    const statusOpt = statusOptions.find(o => o.value === (localDoc?.status || '').toUpperCase());
    const canIssue = !isCreating && (localDoc?.status || '').toUpperCase() === 'DRAFT';
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { setEditingId(null); setIsCreating(false); setLocalDoc(null); }} className="rounded-full"><ChevronLeft className="size-5" /></Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isCreating ? 'Nueva Nota de Crédito' : `Nota ${localDoc?.number}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{isCreating ? 'Crear nota de crédito manual' : 'Detalle de la nota de crédito'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isCreating && <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
              onClick={async () => { await creditNotesService.delete(localDoc.id); setEditingId(null); onRefresh(); }}><Trash2 className="size-3 mr-2" /> Eliminar</Button>}
            {canIssue && <Button variant="outline" className="rounded-xl border-emerald-500/50 text-emerald-500 hover:bg-emerald-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
              onClick={() => handleIssue(localDoc.id)}><Send className="size-3 mr-2" /> Emitir NC</Button>}
            <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6" onClick={handleSave}>
              {isCreating ? 'Crear Nota' : 'Guardar'}
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información de la Nota</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-[10px] text-muted-foreground mb-1">Cliente</p>
                  <Combobox options={customers.map(c => ({ label: c.phone ? `${c.name} — ${c.phone}` : c.name, value: c.id }))} value={localDoc?.customerId || ''} onChange={(val) => setLocalDoc({ ...localDoc, customerId: val })} placeholder="Seleccionar Cliente" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Fecha</p>
                  <Input type="date" value={localDoc?.date ? (typeof localDoc.date === 'string' && localDoc.date.includes('T') ? localDoc.date.split('T')[0] : localDoc.date) : ''} onChange={(e) => setLocalDoc({ ...localDoc, date: e.target.value })} className="h-8 text-xs" /></div>
                {!isCreating && <div><p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${statusOpt?.color || 'bg-muted/20 text-muted-foreground'}`}>{statusOpt?.label || localDoc?.status}</span></div>}
                {localDoc?.salesReturnId && <div><p className="text-[10px] text-muted-foreground mb-1">Devolución Asociada</p>
                  <span className="text-xs font-bold text-blue-500">{localDoc.salesReturnId.slice(0, 10)}...</span></div>}
              </div>
              <div><p className="text-[10px] text-muted-foreground mb-1">Razón</p>
                <textarea value={localDoc?.reason || ''} onChange={(e) => setLocalDoc({ ...localDoc, reason: e.target.value })}
                  className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" placeholder="Razón de la nota de crédito..." /></div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen</p>
              <div className="flex justify-between items-center text-base border-b pb-3 border-border/50">
                <span className="font-black">Total Nota de Crédito</span>
                <span className="text-rose-500 font-black text-lg">{formatConvertedAmount(Number(localDoc?.total||0), 'USD')}</span>
              </div>
              <p className="text-[10px] text-muted-foreground italic">Al emitir esta nota, el balance del cliente se reducirá por el monto total.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Items de la Nota de Crédito</p>
              <Button variant="outline" size="sm" onClick={() => {
                const newItems = [...(localDoc.items || []), { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, total: 0 }];
                setLocalDoc({ ...localDoc, items: newItems });
              }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl"><Plus className="size-3 mr-2" /> Agregar Item</Button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className="col-span-6">Descripción</div><div className="col-span-2 text-right">Cant.</div><div className="col-span-2 text-right">Precio U.</div><div className="col-span-2 text-right">Total</div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6"><Input value={item.description || ''} onChange={(e) => {
                    const ni = [...(localDoc.items || [])]; ni[idx] = { ...ni[idx], description: e.target.value };
                    setLocalDoc({ ...localDoc, items: ni }); }} className="h-8 text-xs" placeholder="Descripción del concepto..." /></div>
                  <div className="col-span-2"><Input type="number" min="0" value={Number(item.quantity) || ''} onChange={(e) => {
                    const ni = [...(localDoc.items || [])]; ni[idx] = { ...ni[idx], quantity: Number(e.target.value), total: Number(e.target.value) * Number(ni[idx].unitPrice || 0) };
                    setLocalDoc({ ...localDoc, items: ni, total: recalcTotal(ni) }); }} className="h-8 text-xs text-right" /></div>
                  <div className="col-span-2"><Input type="number" min="0" value={Number(item.unitPrice) || ''} onChange={(e) => {
                    const ni = [...(localDoc.items || [])]; ni[idx] = { ...ni[idx], unitPrice: Number(e.target.value), total: Number(ni[idx].quantity || 1) * Number(e.target.value) };
                    setLocalDoc({ ...localDoc, items: ni, total: recalcTotal(ni) }); }} className="h-8 text-xs text-right" /></div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <span className="text-xs font-black text-rose-500">{formatConvertedAmount(Number(item.total || 0), 'USD')}</span>
                    <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-md"
                      onClick={() => { const ni = [...(localDoc.items || [])]; ni.splice(idx, 1); setLocalDoc({ ...localDoc, items: ni, total: recalcTotal(ni) }); }}><Trash2 className="size-3" /></Button>
                  </div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">Sin items. Haz clic en "Agregar Item".</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── TABLE VIEW ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
            <CardContent className="p-5"><div className="flex items-center gap-4"><div className={cn("p-3 rounded-xl shadow-inner", kpi.bg, kpi.color)}><kpi.icon className="size-5" /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p><p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{kpi.value}</p></div></div></CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
          <div><h2 className="text-xl font-black uppercase tracking-tight text-foreground">Notas de Crédito</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Registros de crédito emitidos a clientes.</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input placeholder="Buscar nota..." className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold uppercase tracking-widest" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
            <Button onClick={startNew} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
              <Plus className="size-4" /> Nueva NC</Button>
          </div>
        </div>
        <EditableDataTable data={filtered}
          onBulkDelete={async (ids) => { try { for (const id of ids) { await creditNotesService.delete(id as string); } toast.success('Eliminadas'); onRefresh(); } catch { toast.error('Error'); } }}
          columns={columns} onRowUpdate={async () => {}} isLoading={loading}
          actions={(row) => (
            <div className="flex items-center gap-1">
               {(row.status||'').toUpperCase() === 'DRAFT' && (
                 <Button title="Emitir" variant="ghost" size="icon" className="size-8 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors" onClick={() => handleIssue(row.id)}><Send className="size-4" /></Button>
               )}
               <Button title="PDF" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => handleExportPDF(row)}><FileDown className="size-4" /></Button>
               <Button title="Ver" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
               <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
            </div>
          )}
        />
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title={"¿Eliminar nota de crédito?"}
        description="¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          try {
            setDeleteLoading(true);
            await creditNotesService.delete(pendingDeleteId);
            toast.success('Registro eliminado');
            onRefresh();
          } catch (error: any) {
            toast.error(error?.message || 'Error al eliminar');
          } finally {
            setDeleteLoading(false);
            setPendingDeleteId(null);
          }
        }}
      />
    </div>
  );
}
