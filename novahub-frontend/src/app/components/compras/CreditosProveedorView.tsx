import { useState, useEffect } from 'react';
import { 
  FileMinus, Plus, Search, TrendingUp, Clock, CheckCircle2, Eye, Trash2, ChevronLeft, Send, FileDown
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { supplierCreditsService, suppliersService } from '../../services/compras.service';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import type { SupplierCredit, Supplier } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  data: SupplierCredit[];
  loading: boolean;
  onRefresh: () => void;
}

const statusOptions = [
  { label: 'Borrador', value: 'DRAFT',   color: 'bg-muted/20 text-muted-foreground' },
  { label: 'Emitido',  value: 'ISSUED',  color: 'bg-orange-500/10 text-orange-500' },
  { label: 'Pagada',   value: 'PAID',    color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Pagada',   value: 'APPLIED', color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Anulado',  value: 'VOIDED',  color: 'bg-rose-500/10 text-rose-500' },
];

export function CreditosProveedorView({ data, loading, onRefresh }: Props) {
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const { themeConfig } = useTheme();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingApplyId, setPendingApplyId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('TRANSFER');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    suppliersService.getAll().then(res => {
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setSuppliers(list);
    }).catch();
  }, []);

  useEffect(() => {
    if (editingId) {
      const doc = data.find(x => x.id === editingId);
      if (doc) setLocalDoc(JSON.parse(JSON.stringify(doc)));
    } else if (!isCreating) {
      setLocalDoc(null);
    }
  }, [editingId, isCreating]);

  const recalcTotal = (items: any[]) => items.reduce((acc: number, it: any) => acc + Number(it.total || 0), 0);

  const startNew = () => {
    setIsCreating(true);
    setEditingId(null);
    setLocalDoc({
      supplierId: '',
      date: new Date().toISOString().split('T')[0],
      reason: '',
      items: [],
      total: 0,
      currency: displayCurrency,
      exchangeRate: globalRate,
      status: 'DRAFT'
    });
  };

  const handleSave = async () => {
    if (!localDoc) return;
    if (!localDoc.supplierId) { toast.error('Selecciona un proveedor'); return; }
    if (!localDoc.reason?.trim()) { toast.error('Ingresa el motivo del crédito'); return; }
    try {
      const payload = {
        ...localDoc,
        items: (localDoc.items || []).map((it: any) => ({
          description: it.description || '',
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || 0),
          total: Number(it.total || 0),
        })),
        total: Number(localDoc.total || 0)
      };

      if (isCreating) {
        await supplierCreditsService.create(payload);
        toast.success('Crédito de proveedor creado');
      } else {
        await supplierCreditsService.update(localDoc.id, payload);
        toast.success('Crédito actualizado');
      }
      setIsCreating(false); setEditingId(null); setLocalDoc(null); onRefresh();
    } catch { toast.error('Error al guardar'); }
  };

  const handleIssue = async (id: string) => {
    try {
      await supplierCreditsService.issue(id);
      toast.success('Crédito emitido — Balance de proveedor actualizado');
      setEditingId(null); onRefresh();
    } catch { toast.error('Error al emitir crédito'); }
  };

  const handleApply = async (id: string) => {
    setPendingApplyId(id);
  };

  const columns: ColumnDef<any>[] = [
    { key: 'number', header: 'Nº Crédito', width: '140px',
      render: (val, row) => (
        <span className="text-xs font-black font-mono text-primary cursor-pointer hover:underline" onClick={() => setEditingId(row.id)}>{val}</span>
      )
    },
    { key: 'supplierId', header: 'Proveedor', render: (_, row) => <span className="text-[13px] font-bold text-foreground">{row.supplier?.name || 'Proveedor'}</span> },
    { key: 'date', header: 'Fecha', render: (val) => <span className="text-xs font-medium text-muted-foreground">{new Date(val).toLocaleDateString()}</span> },
    { key: 'reason', header: 'Motivo', render: (val) => <span className="text-xs text-muted-foreground truncate max-w-[200px] block">{val}</span> },
    { key: 'total', header: 'Total', width: '130px', render: (val, row) => <span className="text-[13px] font-black tabular-nums text-emerald-500">{formatConvertedAmount(Number(val||0), (row as any).currency, (row as any).exchangeRate)}</span> },
    { key: 'status', header: 'Estado', width: '120px', render: (val) => {
      const opt = statusOptions.find(o => o.value === (val||'').toUpperCase());
      return <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none", opt?.color || 'bg-muted/20 text-muted-foreground')}>{opt?.label || val}</Badge>; } },
  ];

  const issuedTotal = data.filter(c => c.status?.toUpperCase() === 'ISSUED').reduce((acc, c) => acc + convertAmount(c.total, (c as any).currency, (c as any).exchangeRate), 0);
  
  const kpis = [
    { title: 'Total Emitido',  value: formatConvertedAmount(issuedTotal, displayCurrency), icon: FileMinus,    color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Borradores',     value: data.filter(c => c.status?.toUpperCase() === 'DRAFT').length,  icon: Clock,        color: 'text-amber-500',   bg: 'bg-amber-500/10'    },
    { title: 'Créditos Vivos',  value: data.filter(c => ['ISSUED'].includes(c.status?.toUpperCase())).length, icon: TrendingUp,   color: 'text-primary',     bg: 'bg-primary/10'      },
  ];

  if ((editingId || isCreating) && localDoc) {
    const statusOpt = statusOptions.find(o => o.value === (localDoc?.status || '').toUpperCase());
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { setEditingId(null); setIsCreating(false); setLocalDoc(null); }} className="rounded-full"><ChevronLeft className="size-5" /></Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isCreating ? 'Nuevo Crédito de Proveedor' : `Crédito ${localDoc?.number}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Detalle del documento de crédito</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {!isCreating && <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
               onClick={async () => { await supplierCreditsService.delete(localDoc.id); setEditingId(null); onRefresh(); }}><Trash2 className="size-3 mr-2" /> Eliminar</Button>}
             {!isCreating && localDoc.status === 'DRAFT' && <Button variant="outline" className="rounded-xl border-emerald-500/50 text-emerald-500 hover:bg-emerald-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
               onClick={() => handleIssue(localDoc.id)}><Send className="size-3 mr-2" /> Emitir Crédito</Button>}
             {!isCreating && localDoc.status === 'ISSUED' && <Button variant="outline" className="rounded-xl border-emerald-500/50 text-emerald-500 hover:bg-emerald-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
             onClick={() => handleApply(localDoc.id)}><CheckCircle2 className="size-3 mr-2" /> Marcar como Pagada</Button>}
             {!isCreating && (localDoc.status === 'APPLIED' || localDoc.status === 'PAID') && <Button variant="outline" className="rounded-xl border-emerald-500/50 text-emerald-500 font-black uppercase text-[10px] tracking-widest px-4 cursor-default opacity-50"><CheckCircle2 className="size-3 mr-2" /> Nota Pagada</Button>}
             <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6" onClick={handleSave}>Guardar</Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><p className="text-[10px] text-muted-foreground mb-1">Proveedor</p>
                  <Combobox 
                    options={suppliers.map(s => ({ label: s.name, value: s.id }))} 
                    value={localDoc?.supplierId || ''} 
                    onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val })} 
                    placeholder="Seleccionar Proveedor" 
                  /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Fecha</p>
                  <Input type="date" value={localDoc?.date ? localDoc.date.split('T')[0] : ''} onChange={(e) => setLocalDoc({ ...localDoc, date: e.target.value })} className="h-8 text-xs" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${statusOpt?.color || 'bg-muted/20 text-muted-foreground'}`}>{statusOpt?.label || localDoc?.status}</span></div>
              </div>
              <div><p className="text-[10px] text-muted-foreground mb-1">Motivo / Razón</p>
                <textarea value={localDoc?.reason || ''} onChange={(e) => setLocalDoc({ ...localDoc, reason: e.target.value })}
                  className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" placeholder="Motivo del crédito..." /></div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen de Montos</p>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b pb-3 border-border/50">
                <span className="font-black">Total Crédito</span>
                <span className="text-emerald-500 font-black text-2xl text-right">{formatConvertedAmount(Number(localDoc?.total||0), localDoc?.currency || displayCurrency, localDoc?.exchangeRate)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground italic">Al emitir este crédito, se registrará un gasto en finanzas y se ajustará el balance con el proveedor.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Ítems del Crédito</p>
              <Button variant="outline" size="sm" onClick={() => {
                const newItems = [...(localDoc.items || []), { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, total: 0 }];
                setLocalDoc({ ...localDoc, items: newItems });
              }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl"><Plus className="size-3 mr-2" /> Agregar Item</Button>
            </div>
            <div className="space-y-2">
              <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className="col-span-6">Descripción</div><div className="col-span-2 text-right">Cant.</div><div className="col-span-2 text-right">Precio U.</div><div className="col-span-2 text-right">Total</div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} className="flex flex-col md:grid md:grid-cols-12 gap-2 items-center">
                  <div className="w-full md:col-span-6"><Input value={item.description || ''} onChange={(e) => {
                    const ni = [...(localDoc.items || [])]; ni[idx].description = e.target.value; setLocalDoc({ ...localDoc, items: ni });
                  }} className="h-8 text-xs font-bold" /></div>
                  <div className="w-full md:col-span-2"><Input type="number" value={item.quantity} onChange={(e) => {
                    const ni = [...(localDoc.items || [])]; ni[idx].quantity = Number(e.target.value); ni[idx].total = ni[idx].quantity * ni[idx].unitPrice;
                    setLocalDoc({ ...localDoc, items: ni, total: recalcTotal(ni) });
                  }} className="h-8 text-xs text-right" /></div>
                  <div className="w-full md:col-span-2"><Input type="number" value={item.unitPrice} onChange={(e) => {
                    const ni = [...(localDoc.items || [])]; ni[idx].unitPrice = Number(e.target.value); ni[idx].total = ni[idx].quantity * ni[idx].unitPrice;
                    setLocalDoc({ ...localDoc, items: ni, total: recalcTotal(ni) });
                  }} className="h-8 text-xs text-right" /></div>
                  <div className="w-full md:col-span-2 flex items-center justify-end gap-2">
                    <span className="text-xs font-black text-emerald-500 tabular-nums">{formatConvertedAmount(item.total, localDoc.currency, localDoc.exchangeRate)}</span>
                    <Button variant="ghost" size="icon" onClick={() => {
                      const ni = [...(localDoc.items || [])]; ni.splice(idx, 1); setLocalDoc({ ...localDoc, items: ni, total: recalcTotal(ni) });
                    }} className="size-6 text-muted-foreground hover:text-rose-500"><Trash2 className="size-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("p-3 rounded-xl", kpi.bg, kpi.color)}><kpi.icon className="size-5" /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p><p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{kpi.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between py-2">
          <div><h2 className="text-xl font-black uppercase tracking-tight">Créditos de Proveedor</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Créditos recibidos por compras o devoluciones.</p></div>
          <Button onClick={startNew} className="bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20"><Plus className="size-4" /> Nuevo Crédito</Button>
        </div>
        <EditableDataTable data={data} isLoading={loading} columns={columns} 
          actions={(row) => (
            <div className="flex items-center gap-1">
               <Button title="Ver" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
               {row.status?.toUpperCase() === 'DRAFT' && (
                 <>
                   <Button title="Emitir" variant="ghost" size="icon" className="size-8 rounded-lg text-emerald-500" onClick={() => handleIssue(row.id)}><Send className="size-4" /></Button>
                   <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg text-rose-500 hover:bg-rose-500/10" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
                 </>
               )}
               {row.status?.toUpperCase() === 'ISSUED' && <Button title="Marcar como Pagado" variant="ghost" size="icon" className="size-8 rounded-lg text-emerald-500" onClick={() => handleApply(row.id)}><CheckCircle2 className="size-4" /></Button>}
               {['APPLIED', 'PAID'].includes(row.status?.toUpperCase()) && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-none px-2 py-1"><CheckCircle2 className="size-3 mr-1" /> Pagada</Badge>}
            </div>
          )}
        />
      </div>

      <ConfirmDialog open={pendingDeleteId !== null} onOpenChange={(o) => !o && setPendingDeleteId(null)}
        title="¿Eliminar Crédito?"
        description="Esta acción eliminará el borrador permanentemente."
        confirmLabel="Eliminar Borrador"
        variant="destructive"
        onConfirm={async () => {
          if (pendingDeleteId) {
            setDeleteLoading(true);
            try { await supplierCreditsService.delete(pendingDeleteId); toast.success('Borrador eliminado'); onRefresh(); } catch { toast.error('Error al eliminar'); }
            finally { setDeleteLoading(false); setPendingDeleteId(null); }
          }
        }}
      />

      <ConfirmDialog open={pendingApplyId !== null} onOpenChange={(o) => !o && setPendingApplyId(null)}
        title="¿Liquidar Crédito de Proveedor?"
        description="Selecciona el método de pago utilizado para esta liquidación."
        confirmLabel="Confirmar Liquidación"
        onConfirm={async () => {
          if (pendingApplyId) {
            setApplyLoading(true);
            try { await supplierCreditsService.apply(pendingApplyId, { paymentMethod }); toast.success('Crédito liquidado'); onRefresh(); setEditingId(null); } catch { toast.error('Error al liquidar'); }
            finally { setApplyLoading(false); setPendingApplyId(null); }
          }
        }}
      >
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button 
            onClick={() => setPaymentMethod('CASH')}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-300",
              paymentMethod === 'CASH' 
                ? "bg-primary/5 border-primary shadow-[0_0_20px_rgba(var(--primary),0.1)] scale-[1.02]" 
                : "border-border/40 hover:bg-muted text-muted-foreground opacity-60"
            )}
          >
            <div className={cn("p-2 rounded-lg", paymentMethod === 'CASH' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
              <Clock className="size-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Efectivo</span>
          </button>
          <button 
            onClick={() => setPaymentMethod('TRANSFER')}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-300",
              paymentMethod === 'TRANSFER' 
                ? "bg-primary/5 border-primary shadow-[0_0_20px_rgba(var(--primary),0.1)] scale-[1.02]" 
                : "border-border/40 hover:bg-muted text-muted-foreground opacity-60"
            )}
          >
            <div className={cn("p-2 rounded-lg", paymentMethod === 'TRANSFER' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
              <TrendingUp className="size-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Transferencia</span>
          </button>
        </div>
      </ConfirmDialog>
      </div>
  );
}
