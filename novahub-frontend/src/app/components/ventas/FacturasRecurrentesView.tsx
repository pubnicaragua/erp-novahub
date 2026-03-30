import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, Plus, Search, TrendingUp, Clock, Calendar, Play, Pause, Eye, Trash2, ChevronLeft, FileDown
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { recurringInvoicesService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import type { RecurringInvoice, Customer, Product } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { generateEstimatePDF } from '../../utils/pdfGenerator';

interface FacturasRecurrentesViewProps {
  data: RecurringInvoice[];
  loading: boolean;
  onRefresh: () => void;
  customers?: Customer[];
  products?: Product[];
}

const statusOptions = [
  { label: 'Activa',     value: 'ACTIVE',  color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Pausada',    value: 'PAUSED',  color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Finalizada', value: 'EXPIRED', color: 'bg-muted/20 text-muted-foreground' },
];

const frequencyOptions = [
  { label: 'Semanal',    value: 'WEEKLY' },
  { label: 'Mensual',    value: 'MONTHLY' },
  { label: 'Trimestral', value: 'QUARTERLY' },
  { label: 'Anual',      value: 'YEARLY' },
];

export function FacturasRecurrentesView({ data, loading, onRefresh, customers = [], products = [] }: FacturasRecurrentesViewProps) {
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (editingId) {
      const r = data.find(x => x.id === editingId);
      if (r) setLocalDoc(JSON.parse(JSON.stringify(r)));
    } else if (!isCreating) {
      setLocalDoc(null);
    }
  }, [editingId]);

  const filtered = data.filter(r => 
    (r as any).profileName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (r.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdate = async (id: string | number, updates: Partial<RecurringInvoice>) => {
    try {
      await recurringInvoicesService.update(id.toString(), updates);
      toast.success('Suscripción actualizada');
      onRefresh();
    } catch (error) {
      toast.error('Error al actualizar');
      throw error;
    }
  };

  const toggleStatus = async (row: RecurringInvoice) => {
    try {
      if ((row.status||'').toUpperCase() === 'ACTIVE') {
        await recurringInvoicesService.pause(row.id);
        toast.success('Factura recurrente pausada');
      } else {
        await recurringInvoicesService.resume(row.id);
        toast.success('Factura recurrente reanudada');
      }
      onRefresh();
    } catch (error) {
      toast.error('Error al cambiar estado');
    }
  };

  const startNew = () => {
    setIsCreating(true);
    setEditingId(null);
    setLocalDoc({
      customerId: '',
      frequency: 'MONTHLY',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      currency: displayCurrency === 'USD' ? 'USD' : 'NIO',
      exchangeRate: globalRate,
      items: [],
      subtotal: 0,
      taxAmount: 0,
      total: 0,
    });
  };

  // Sync currency from topbar
  useEffect(() => {
    if (localDoc && isCreating) {
      setLocalDoc((prev: any) => ({ ...prev, currency: displayCurrency === 'USD' ? 'USD' : 'NIO' }));
    }
  }, [displayCurrency]);

  const handleExportPDF = async (row: RecurringInvoice) => {
    try {
      const tenantName = user?.tenantName || 'Mi Empresa';
      await generateEstimatePDF({
        estimate: { ...row, number: `REC-${row.id.slice(0, 8)}`, customer: row.customer },
        tenantName,
        formatAmount: formatConvertedAmount,
        documentType: 'recurring',
      });
      toast.success('PDF generado exitosamente');
    } catch { toast.error('Error al generar PDF'); }
  };

  const recalcTotals = (items: any[]) => {
    const subtotal = items.reduce((acc: number, it: any) => acc + Number(it.total || 0), 0);
    return { subtotal, taxAmount: 0, total: subtotal };
  };

  const handleSave = async () => {
    if (!localDoc) return;
    if (!localDoc.customerId) { toast.error('Selecciona un cliente'); return; }
    try {
      if (isCreating) {
        await recurringInvoicesService.create({
          customerId: localDoc.customerId,
          frequency: localDoc.frequency,
          startDate: new Date(localDoc.startDate).toISOString(),
          endDate: localDoc.endDate ? new Date(localDoc.endDate).toISOString() : undefined,
          nextInvoiceDate: new Date(localDoc.startDate).toISOString(),
          currency: localDoc.currency,
          exchangeRate: localDoc.exchangeRate || globalRate,
          items: (localDoc.items || []).map((item: any) => ({
            productId: item.productId || undefined,
            description: item.description || '',
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            total: Number(item.total || 0),
          })),
          subtotal: localDoc.subtotal,
          taxAmount: localDoc.taxAmount,
          total: localDoc.total,
          status: 'ACTIVE',
        } as any);
        toast.success('Factura recurrente creada exitosamente');
      } else {
        await handleUpdate(localDoc.id, localDoc);
      }
      setIsCreating(false); setEditingId(null); setLocalDoc(null); onRefresh();
    } catch { toast.error('Error al guardar'); }
  };

  const formatDateSafe = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const [y, m, d] = clean.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return new Date(y, m - 1, d).toLocaleDateString();
  };

  const columns: ColumnDef<RecurringInvoice>[] = [
    { key: 'id', header: 'Referencia', width: '180px',
      render: (val, row) => (
        <span 
          className={cn(
            "text-xs font-black font-mono text-primary group-hover:underline",
            canPerform('ventas', 'edit') ? "cursor-pointer" : "cursor-default"
          )} 
          onClick={() => canPerform('ventas', 'edit') && setEditingId(row.id)}
        >
          Suscripción #{row.id.slice(0, 8)}
        </span>
      )
    },
    { key: 'customer', header: 'Cliente', render: (val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Cliente'}</span> },
    { key: 'frequency', header: 'Frecuencia', width: '120px', editable: canPerform('ventas', 'edit'), type: 'select', options: frequencyOptions,
      render: (val) => { const freqMap: Record<string, string> = { WEEKLY: 'Semanal', MONTHLY: 'Mensual', QUARTERLY: 'Trimestral', YEARLY: 'Anual' };
        return <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 border-none">{freqMap[(val||'').toUpperCase()] || val}</Badge>; } },
    { key: 'total', header: 'Monto Ciclo', width: '150px',
      render: (val, row) => (
        <span className="text-[13px] font-black tabular-nums text-foreground">
          {formatConvertedAmount(Number(val || 0), (row as any).currency, (row as any).exchangeRate)}
        </span>
      ) },
    { key: 'status', header: 'Estado', width: '130px', render: (val) => { const opt = statusOptions.find(o => o.value === (val||'').toUpperCase());
      return <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none", opt?.color || 'bg-muted/20 text-muted-foreground')}>{opt?.label || val}</Badge>; } },
    { key: 'nextInvoiceDate', header: 'Próxima Fecha', render: (val) => <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground"><Calendar className="size-3" />{formatDateSafe(val)}</div> },
  ];

  const activeRecurringInDisplayCurrency = data
    .filter(recurring => (recurring.status || '').toUpperCase() === 'ACTIVE')
    .reduce((acc, recurring) => acc + convertAmount(recurring.total || 0, (recurring as any).currency, (recurring as any).exchangeRate), 0);
  const totalRecurringInDisplayCurrency = data.reduce(
    (acc, recurring) => acc + convertAmount(recurring.total || 0, (recurring as any).currency, (recurring as any).exchangeRate),
    0,
  );
  const kpis = [
    {
      title: `MRR (Total ${displayCurrency})`,
      value: `${displayCurrency === 'USD' ? '$' : 'C$'} ${activeRecurringInDisplayCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: RotateCcw,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    { title: 'Activas',        value: data.filter(r => (r.status||'').toUpperCase() === 'ACTIVE').length, icon: Calendar,  color: 'text-blue-500',  bg: 'bg-blue-500/10'  },
    { title: 'Pausadas',       value: data.filter(r => (r.status||'').toUpperCase() === 'PAUSED').length, icon: Clock,     color: 'text-amber-500', bg: 'bg-amber-500/10' },
    {
      title: `Total Mensual (${displayCurrency})`,
      value: `${displayCurrency === 'USD' ? '$' : 'C$'} ${totalRecurringInDisplayCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
  ];

  // ─── INLINE EDITOR ─────────────────────────────────────────────────────
  if ((editingId || isCreating) && localDoc) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { setEditingId(null); setIsCreating(false); setLocalDoc(null); }} className="rounded-full"><ChevronLeft className="size-5" /></Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isCreating ? 'Nueva Factura Recurrente' : `Suscripción #${localDoc.id?.slice(0, 8)}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{isCreating ? 'Configurar nueva suscripción' : 'Editar configuración'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canPerform('ventas', 'edit') && (
              <>
                {!isCreating && <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={async () => { await recurringInvoicesService.delete(localDoc.id); setEditingId(null); onRefresh(); }}><Trash2 className="size-3 mr-2" /> Eliminar</Button>}
                <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6" onClick={handleSave}>
                  {isCreating ? 'Crear Suscripción' : 'Guardar Cambios'}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Configuración</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-[10px] text-muted-foreground mb-1">Cliente</p>
                  <Combobox options={customers.map(c => ({ label: c.phone ? `${c.name} — ${c.phone}` : c.name, value: c.id }))} value={localDoc?.customerId || ''} onChange={(val) => setLocalDoc({ ...localDoc, customerId: val })} placeholder="Seleccionar Cliente" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Frecuencia</p>
                  <select value={localDoc?.frequency || 'MONTHLY'} onChange={(e) => setLocalDoc({ ...localDoc, frequency: e.target.value })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase">
                    {frequencyOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Fecha Inicio</p>
                  <Input type="date" value={localDoc?.startDate ? (typeof localDoc.startDate === 'string' && localDoc.startDate.includes('T') ? localDoc.startDate.split('T')[0] : localDoc.startDate) : ''} onChange={(e) => setLocalDoc({ ...localDoc, startDate: e.target.value })} className="h-8 text-xs" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Fecha Fin (Opcional)</p>
                  <Input type="date" value={localDoc?.endDate ? (typeof localDoc.endDate === 'string' && localDoc.endDate.includes('T') ? localDoc.endDate.split('T')[0] : localDoc.endDate) : ''} onChange={(e) => setLocalDoc({ ...localDoc, endDate: e.target.value })} className="h-8 text-xs" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen por Ciclo</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-black">{displayCurrency === 'USD' ? '$' : 'C$'} {Number(localDoc?.subtotal||0).toLocaleString()}</span></div>
                <div className="flex justify-between items-center text-base border-t pt-3 border-border/50"><span className="font-black">Total por Ciclo</span>
                  <span className="text-primary font-black text-lg">{displayCurrency === 'USD' ? '$' : 'C$'} {Number(localDoc?.total||0).toLocaleString()}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos / Servicios</p>
              <Button variant="outline" size="sm" onClick={() => {
                const newItems = [...(localDoc.items || []), { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, total: 0 }];
                setLocalDoc({ ...localDoc, items: newItems });
              }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl"><Plus className="size-3 mr-2" /> Agregar Item</Button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className="col-span-5">Descripción</div><div className="col-span-2 text-right">Cant.</div><div className="col-span-2 text-right">Precio U.</div><div className="col-span-2 text-right">Total</div><div className="col-span-1"></div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5"><Combobox options={products.map(p => ({ label: `${p.code} - ${p.name}`, value: p.id }))} value={item.productId || ''}
                    onChange={(val) => { const ni = [...(localDoc.items || [])]; const prod = products.find(p => p.id === val);
                      ni[idx] = { ...ni[idx], productId: val, description: prod?.name || '', unitPrice: Number(prod?.price || 0), total: Number(ni[idx].quantity || 1) * Number(prod?.price || 0) };
                      const calc = recalcTotals(ni); setLocalDoc({ ...localDoc, items: ni, ...calc }); }} placeholder="Producto..." /></div>
                  <div className="col-span-2"><Input type="number" min="0" value={Number(item.quantity) || ''} onChange={(e) => {
                    const ni = [...(localDoc.items || [])]; ni[idx] = { ...ni[idx], quantity: Number(e.target.value), total: Number(e.target.value) * Number(ni[idx].unitPrice || 0) };
                    const calc = recalcTotals(ni); setLocalDoc({ ...localDoc, items: ni, ...calc }); }} className="h-8 text-xs text-right" /></div>
                  <div className="col-span-2"><Input type="number" min="0" value={Number(item.unitPrice) || ''} onChange={(e) => {
                    const ni = [...(localDoc.items || [])]; ni[idx] = { ...ni[idx], unitPrice: Number(e.target.value), total: Number(ni[idx].quantity || 1) * Number(e.target.value) };
                    const calc = recalcTotals(ni); setLocalDoc({ ...localDoc, items: ni, ...calc }); }} className="h-8 text-xs text-right" /></div>
                  <div className="col-span-2 text-right"><span className="text-xs font-black">{displayCurrency === 'USD' ? '$' : 'C$'} {Number(item.total || 0).toLocaleString()}</span></div>
                  <div className="col-span-1 flex justify-end"><Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-md"
                    onClick={() => { const ni = [...(localDoc.items || [])]; ni.splice(idx, 1); const calc = recalcTotals(ni); setLocalDoc({ ...localDoc, items: ni, ...calc }); }}><Trash2 className="size-3" /></Button></div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">Sin productos. Haz clic en "Agregar Item".</div>}
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
          <div><h2 className="text-xl font-black uppercase tracking-tight text-foreground">Facturación Recurrente</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Gestión de contratos, igualas y servicios por suscripción.</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input placeholder="Buscar suscripción..." className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold uppercase tracking-widest" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
            {canPerform('ventas', 'create') && (
              <Button onClick={startNew} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
                <Plus className="size-4" /> Nueva Recurrente</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered}
          onBulkDelete={async (ids) => { try { for (const id of ids) { if (String(id).startsWith('new-')) continue; await recurringInvoicesService.delete(id as string); } toast.success('Eliminados'); onRefresh(); } catch { toast.error('Error al eliminar'); } }}
          columns={columns} onRowUpdate={handleUpdate} isLoading={loading}
          actions={(row) => (
            <div className="flex items-center gap-1">
               {canPerform('ventas', 'edit') && (
                 (row.status||'').toUpperCase() === 'ACTIVE' ? (
                   <Button title="Pausar" onClick={() => toggleStatus(row)} variant="ghost" size="icon" className="size-8 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors"><Pause className="size-4" /></Button>
                 ) : (
                   <Button title="Reanudar" onClick={() => toggleStatus(row)} variant="ghost" size="icon" className="size-8 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors"><Play className="size-4" /></Button>
                 )
               )}
               <Button title="PDF" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => handleExportPDF(row)}><FileDown className="size-4" /></Button>
               <Button title="Ver detalle" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
               {canPerform('ventas', 'delete') && (
                 <Button variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
               )}
            </div>
          )}
        />
      </div>
      <ConfirmDialog
              open={pendingDeleteId !== null}
              onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
              title={"¿Eliminar factura recurrente?"}
              description="¿Estás seguro de que deseas eliminar esta factura recurrente? Esta acción no se puede deshacer."
              confirmLabel="Eliminar"
              variant="destructive"
              loading={deleteLoading}
              onConfirm={async () => {
                if (!pendingDeleteId) return;
                try {
                  setDeleteLoading(true);
                  await recurringInvoicesService.delete(pendingDeleteId);
                  toast.success('Factura recurrente eliminada');
                  setEditingId(null);
                  onRefresh();
                } catch (error: any) {
                   const msg = error?.response?.data?.message || error?.message || '';
                  if (msg.includes('foreign') || msg.includes('constraint') || msg.includes('reference') || error?.status === 409) {
                    toast.error('No se puede eliminar: tiene dependencias en el sistema.');
                  } else {
                    toast.error(`Error al eliminar: ${msg || 'Error desconocido'}`);
                  }
                } finally {
                  setDeleteLoading(false);
                  setPendingDeleteId(null);
                }
              }}
            />

    </div>
  );
}
