import { useState, useEffect } from 'react';
import { 
  Wallet, Plus, Search, Eye, Trash2, CheckCircle2, TrendingDown, ChevronLeft, Clock, Download, FileMinus
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { vendorCreditsService, suppliersService } from '../../services/compras.service';
import type { VendorCredit, Supplier } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { generateSupplierCreditPDF } from '../../utils/pdfGenerator';

interface Props { data: VendorCredit[]; loading: boolean; onRefresh: () => void; }

const statusOpts = [
  { label: 'Emitido',   value: 'OPEN',   color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Aplicado',  value: 'CLOSED', color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Anulado',   value: 'VOIDED', color: 'bg-rose-500/10 text-rose-500' },
];

export function CreditosProveedorView({ data, loading, onRefresh }: Props) {
  const { canPerform, user } = useAuth();
  const { formatConvertedAmount, displayCurrency, globalRate } = useCurrency();
  const { themeConfig } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<VendorCredit> | null>(null);

  useEffect(() => {
    suppliersService.getAll().then(res => {
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setSuppliers(list);
    }).catch();
  }, []);

  useEffect(() => {
    if (editingId) {
      if (editingId === 'NEW') {
         setLocalDoc({
           supplierId: '',
           date: new Date().toISOString(),
           total: 0,
           balance: 0,
           status: 'OPEN' as any,
           notes: '',
           currency: displayCurrency,
           exchangeRate: globalRate,
         });
      } else {
         const found = data.find(x => x.id === editingId);
         setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
      }
    } else {
      setLocalDoc(null);
    }
  }, [editingId, data, displayCurrency, globalRate]);

  const filtered = data.filter(c =>
    (c.number||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.supplier?.name||'').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: ColumnDef<VendorCredit>[] = [
    { key: 'number',    header: 'Crédito #',    width: '120px',
      render: (val) => <span className="font-black font-mono text-primary text-xs">{val}</span> },
    { key: 'supplier',  header: 'Proveedor',   width: '200px',
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',      header: 'Fecha',       width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'total',     header: 'Monto Total', width: '130px',
      render: (val, row) => <span className="font-bold tabular-nums">{formatConvertedAmount(val, row.currency, row.exchangeRate)}</span> },
    { key: 'balance',   header: 'Saldo Disp.', width: '130px',
      render: (val, row) => <span className="font-black tabular-nums text-emerald-500">{formatConvertedAmount(val, row.currency, row.exchangeRate)}</span> },
    { key: 'status',    header: 'Estado',      width: '120px', editable: canPerform('PURCHASES_RETURNS', 'edit'), type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<VendorCredit>) => {
    try { await (vendorCreditsService as any).update(id as string, updates); toast.success('Crédito actualizado'); onRefresh(); }
    catch { toast.error('Error al actualizar'); throw new Error('Update failed'); }
  };

  const handleSaveDoc = async () => {
    if (!localDoc?.supplierId) return toast.error('Debe seleccionar un proveedor');
    if (!localDoc?.total || localDoc.total <= 0) return toast.error('El monto debe ser mayor a 0');
    
    try {
      if (editingId === 'NEW') {
        await vendorCreditsService.create({...localDoc, balance: localDoc.total} as any);
        toast.success('Crédito creado');
      } else {
        await (vendorCreditsService as any).update(editingId!, localDoc as any);
        toast.success('Crédito guardado');
      }
      setEditingId(null);
      onRefresh();
    } catch (e: any) {
      toast.error('Error al guardar: ' + (e.response?.data?.message || 'Error'));
    }
  };

  const todayStr = new Date().toLocaleDateString();
  const kpis = [
    { title: 'Total Créditos', value: data.length,                                                                                  icon: Wallet,       color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: `Balance Total (${displayCurrency})`, value: formatConvertedAmount(data.reduce((acc, c) => acc + Number(c.balance || 0), 0)), icon: TrendingDown, color: 'text-rose-500',    bg: 'bg-rose-500/10'    },
    { title: 'Créditos Disponibles', value: data.filter(c => Number(c.balance || 0) > 0).length,                                    icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Créditos Hoy',   value: data.filter(c => c.date && new Date(c.date).toLocaleDateString() === todayStr).length,        icon: Clock,        color: 'text-purple-500',  bg: 'bg-purple-500/10'  },
  ];

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const currentStatus = statusOpts.find(s => s.value === (localDoc.status||'').toUpperCase());
    
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Nuevo Nota de Crédito' : `Crédito ${localDoc.number||''}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Saldos a favor del proveedor</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {!isNew && (
                <Button
                  variant="outline"
                  className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => generateSupplierCreditPDF({
                    credit: localDoc,
                    tenantName: user?.tenantName || 'Empresa',
                    tenantLogo: themeConfig?.logo,
                    formatAmount: formatConvertedAmount,
                    primaryColor: themeConfig?.colors.primary
                  })}
                >
                  <Download className="size-3 mr-2" /> Descargar
                </Button>
             )}
             {!isNew && canPerform('PURCHASES_RETURNS', 'delete') && (
                <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => setPendingDeleteId(editingId)}>
                  <Trash2 className="size-3 mr-2" /> Eliminar
                </Button>
             )}
            {((isNew && canPerform('PURCHASES_RETURNS', 'create')) || (!isNew && canPerform('PURCHASES_RETURNS', 'edit'))) && (
              <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                Guardar
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50 col-span-2 md:col-span-1">
            <CardContent className="p-6 space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Detalles del Crédito</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Proveedor</p>
                  <Combobox 
                    options={suppliers.map(s => ({ label: s.name, value: s.id }))}
                    value={localDoc.supplierId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val })}
                    placeholder="Seleccionar Proveedor"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha</p>
                  <Input type="date" value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} onChange={e => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} className="h-8 text-xs" />
                </div>
                <div>
                   <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                   <select value={localDoc.status || 'OPEN'} onChange={e => setLocalDoc({ ...localDoc, status: e.target.value as any })} className={cn("h-8 w-full rounded-md border text-xs font-bold uppercase", currentStatus?.color)}>
                     {statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                   </select>
                </div>
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Notas</p>
                  <Input value={localDoc.notes || ''} onChange={e => setLocalDoc({ ...localDoc, notes: e.target.value })} className="h-8 text-xs" placeholder="Motivo del crédito..." />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 flex flex-col justify-center h-full">
               <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Monto del Crédito</p>
               <Input type="number" value={localDoc.total || ''} onChange={e => setLocalDoc({ ...localDoc, total: Number(e.target.value), balance: Number(e.target.value) })} className="h-16 text-3xl font-black text-primary" placeholder="0.00" />
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mt-2">Este monto estará disponible para aplicar a facturas.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <Card key={i} className="bg-card border-border/50 rounded-2xl shadow-sm">
            <CardContent className="p-5"><div className="flex items-center gap-4">
              <div className={cn('p-3 rounded-xl', k.bg, k.color)}><k.icon className="size-5" /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{k.title}</p><p className="text-2xl font-black tabular-nums">{k.value}</p></div>
            </div></CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">Créditos de Proveedores</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 text-left">Notas de crédito y saldos a favor</p>
          </div>
          {canPerform('compras', 'create') && (
            <Button onClick={() => setEditingId('NEW')} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl gap-2 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
              <FileMinus className="size-4" /> Nuevo Crédito
            </Button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-muted/5 p-2 rounded-2xl border border-border/40">
          <div className="flex items-center gap-2 flex-1">
             <Badge variant="outline" className="h-9 px-4 rounded-xl border-border/50 bg-background/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
               {filtered.length} Registros
             </Badge>
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
            <Input 
              placeholder="Buscar..." 
              className="pl-9 h-10 w-full bg-background/50 border-border/50 rounded-xl text-xs" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
          <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} allowAddRow={false}
            onBulkDelete={canPerform('PURCHASES_RETURNS', 'delete') ? async (ids) => {
              try {
                for (const id of ids) {
                   if (String(id).startsWith('new-')) continue;
                   await vendorCreditsService.delete(id as string);
                }
                toast.success('Elementos eliminados');
                onRefresh();
              } catch (e) {
                toast.error('Error al eliminar');
              }
            } : undefined}
            actions={(row) => (
              <div className="flex gap-1">
                <Button title={canPerform('compras', 'edit') ? "Editar" : "Ver"} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
                <Button title="Descargar PDF" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-slate-500/10 hover:text-slate-500 transition-colors" onClick={async () => {
                  try {
                    await toast.promise(generateSupplierCreditPDF({
                      credit: row,
                      tenantName: user?.tenantName || 'Empresa',
                      tenantLogo: themeConfig?.logo,
                      formatAmount: formatConvertedAmount,
                      primaryColor: themeConfig?.colors.primary
                    }), {
                      loading: 'Generando PDF...',
                      success: 'PDF generado exitosamente',
                      error: 'Error al generar PDF'
                    });
                  } catch(e) { console.error(e) }
                }}><Download className="size-4" /></Button>
                {canPerform('compras', 'delete') && (
                  <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
                )}
              </div>
            )}
          />
        </div>
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title={"¿Eliminar crédito?"}
        description="Esta acción eliminará el saldo a favor del proveedor. Si ya fue aplicado, podría haber inconsistencias."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          try {
            setDeleteLoading(true);
            await vendorCreditsService.delete(pendingDeleteId);
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
