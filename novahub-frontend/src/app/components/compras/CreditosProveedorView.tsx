import { useState, useEffect } from 'react';
import { BadgeDollarSign, Plus, Search, Eye, TrendingUp, Hash, Trash2, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { vendorCreditsService } from '../../services/compras.service';
import type { SupplierCredit, Supplier } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PurchaseAuditButton } from './PurchaseAuditButton';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';

interface Props { data: SupplierCredit[]; loading: boolean; onRefresh: () => void; supplierCatalog?: Supplier[]; pagination?: SalesPaginationControls; onSearchChange?: (value: string) => void; }

const statusOpts = [
  { label: 'Borrador',  value: 'draft',   color: 'bg-muted/20 text-muted-foreground' },
  { label: 'Emitido',   value: 'issued',  color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Aplicado',  value: 'applied', color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Anulado',   value: 'voided',  color: 'bg-rose-500/10 text-rose-500' },
];

export function CreditosProveedorView({ data, loading, onRefresh, supplierCatalog = [], pagination, onSearchChange }: Props) {
  const { canPerform } = useAuth();
  const { displayCurrency, convertAmount, formatConvertedAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ISSUED'>('ALL');
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<SupplierCredit> | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => { setSuppliers(supplierCatalog); }, [supplierCatalog]);

  useEffect(() => {
    if (editingId) {
      if (editingId === 'NEW') {
         setLocalDoc({
           supplierId: '',
           date: new Date().toISOString(),
           reason: '',
           status: 'issued',
           items: [],
           total: 0
         });
      } else {
         const found = data.find(x => x.id === editingId);
         setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
      }
    } else {
      setLocalDoc(null);
    }
  }, [editingId, data]);

  const filtered = data.filter(c => {
    if (statusFilter === 'ISSUED' && String(c.status || '').toLowerCase() !== 'issued') return false;
    return (c.number||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.supplier?.name||'').toLowerCase().includes(searchTerm.toLowerCase());
  });

  const resolveSourceCurrency = (value?: string) => ((value || '').toUpperCase() === 'USD' ? 'USD' : 'NIO');

  const columns: ColumnDef<SupplierCredit>[] = [
    { key: 'number',   header: 'Nota #',     width: '120px',
      render: (_v, row) => <span className="font-black font-mono text-primary text-xs">{row.number||row.id?.slice(0,8)}</span> },
    { key: 'supplier', header: 'Proveedor',
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',     header: 'Fecha',      width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'total',    header: 'Total',      width: '120px',
      render: (val, row) => <span className="font-black tabular-nums">{formatConvertedAmount(Number(val || 0), resolveSourceCurrency((row as any)?.currency), (row as any)?.exchangeRate)}</span> },
    { key: 'status',   header: 'Estado',     width: '110px', editable: canPerform('PURCHASES_RETURNS', 'edit'), type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toLowerCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<SupplierCredit>) => {
    try { await vendorCreditsService.update(id as string, updates); toast.success('Crédito actualizado'); onRefresh(); }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar'); throw new Error('Update failed'); }
  };

  const recalculatedTotal = (localDoc?.items || []).reduce((acc, it) => acc + (Number(it.quantity || 0) * Number(it.unitPrice || 0)), 0);
  
  const handleSaveDoc = async () => {
    if (!localDoc?.supplierId) return toast.error('Seleccione un proveedor');
    
    try {
      const creditCurrency = localDoc.currency || displayCurrency;
      const creditRate = creditCurrency === 'NIO' ? 1 : (localDoc.exchangeRate || 1);
      const finalDoc = {
          ...localDoc,
          total: recalculatedTotal,
          currency: creditCurrency,
          exchangeRate: creditRate,
          baseTotal: creditCurrency === 'NIO' ? recalculatedTotal : recalculatedTotal * creditRate,
      };
      if (editingId === 'NEW') {
        await vendorCreditsService.create(finalDoc as any);
        toast.success('Crédito registrado exitosamente');
      } else {
        await vendorCreditsService.update(editingId!, finalDoc as any);
        toast.success('Crédito guardado');
      }
      setEditingId(null);
      onRefresh();
    } catch (e: any) { 
        toast.error(e?.response?.data?.message || e?.message || 'Error al registrar'); 
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    setDeleteLoading(true);
    try {
      await vendorCreditsService.delete(pendingDeleteId);
      toast.success('Crédito eliminado exitosamente');
      setPendingDeleteId(null);
      setEditingId(null);
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al eliminar');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteItem = (idx: number) => {
    if (!localDoc) return;
    const newItems = [...(localDoc.items || [])];
    newItems.splice(idx, 1);
    setLocalDoc({ ...localDoc, items: newItems as any });
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    if (!localDoc) return;
    const newItems = [...(localDoc.items || [])];
    newItems[idx] = { ...newItems[idx], [field]: value };
    
    if (['quantity', 'unitPrice'].includes(field)) {
       const q = Number(newItems[idx].quantity || 0);
       const p = Number(newItems[idx].unitPrice || 0);
       newItems[idx].total = q * p;
    }
    setLocalDoc({ ...localDoc, items: newItems as any });
  };

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const currentStatus = statusOpts.find(s => s.value === (localDoc.status||'').toLowerCase());

    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Nueva Nota de Crédito' : `Nota ${localDoc.number || 'de Crédito'}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Saldos a favor</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {!isNew && canPerform('PURCHASES_RETURNS', 'delete') && (
                <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => setPendingDeleteId(editingId)}>
                  <Trash2 className="size-3 mr-2" /> Eliminar
                </Button>
             )}
            {((isNew && canPerform('PURCHASES_RETURNS', 'create')) || (!isNew && canPerform('PURCHASES_RETURNS', 'edit'))) && (
              <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                Guardar Nota
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50 col-span-2">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Datos del Crédito</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Proveedor</p>
                  <Combobox
                    disabled={isNew ? !canPerform('PURCHASES_RETURNS', 'create') : !canPerform('PURCHASES_RETURNS', 'edit')}
                    options={suppliers
                      .filter(s => (s.status || '').toUpperCase() === 'ACTIVE' || s.id === localDoc.supplierId)
                      .map(s => ({ label: s.name, value: s.id, description: (s.code ? `[${s.code}] ` : '') + (s.phone || 'Sin teléfono') }))}
                    value={localDoc.supplierId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val })}
                    placeholder="Seleccionar proveedor..."
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Emisión</p>
                  <Input 
                    disabled={isNew ? !canPerform('PURCHASES_RETURNS', 'create') : !canPerform('PURCHASES_RETURNS', 'edit')}
                    type="date" 
                    value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <select 
                    disabled={isNew ? !canPerform('PURCHASES_RETURNS', 'create') : !canPerform('PURCHASES_RETURNS', 'edit')}
                    value={localDoc.status || 'issued'} 
                    onChange={(e) => setLocalDoc({ ...localDoc, status: e.target.value as any })}
                    className={cn("h-8 w-full rounded-md border border-input px-2 text-xs font-bold uppercase", currentStatus?.color || 'bg-background')}
                  >
                    {statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Moneda</p>
                  <select
                    disabled={isNew ? !canPerform('PURCHASES_RETURNS', 'create') : !canPerform('PURCHASES_RETURNS', 'edit')}
                    value={localDoc.currency || displayCurrency}
                    onChange={(e) => {
                      const newCurrency = e.target.value;
                      setLocalDoc({
                        ...localDoc,
                        currency: newCurrency as any,
                        exchangeRate: newCurrency === 'NIO' ? 1 : (localDoc.exchangeRate || 1),
                      });
                    }}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase">
                    <option value="NIO">C$ (NIO)</option>
                    <option value="USD">$ (USD)</option>
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">T.C.</p>
                  <Input
                    disabled={isNew ? !canPerform('PURCHASES_RETURNS', 'create') : !canPerform('PURCHASES_RETURNS', 'edit') || localDoc.currency === 'NIO'}
                    type="number" min="0" step="0.01"
                    value={localDoc.exchangeRate || 1}
                    onChange={(e) => setLocalDoc({ ...localDoc, exchangeRate: Number(e.target.value) })}
                    className="h-8 text-xs font-bold tabular-nums" />
                </div>
                <div className="md:col-span-4">
                  <p className="text-[10px] text-muted-foreground mb-1">Razón / Concepto</p>
                  <Input 
                    disabled={isNew ? !canPerform('PURCHASES_RETURNS', 'create') : !canPerform('PURCHASES_RETURNS', 'edit')}
                    value={localDoc.reason || ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, reason: e.target.value })} 
                    className="h-8 text-xs" 
                    placeholder="Ej. Devolución de mercadería, descuento comercial, bonificación" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 col-span-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Detalles</p>
                {((isNew && canPerform('PURCHASES_RETURNS', 'create')) || (!isNew && canPerform('PURCHASES_RETURNS', 'edit'))) && (
                  <Button variant="outline" size="sm" onClick={() => {
                    const newItems = [...(localDoc.items || []), { id: `new-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, total: 0 }];
                    setLocalDoc({ ...localDoc, items: newItems as any });
                  }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                    <Plus className="size-3 mr-2" /> Agregar Item
                  </Button>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                  <div className="col-span-5">Descripción</div>
                  <div className="col-span-2 text-right">Cant.</div>
                  <div className="col-span-3 text-right">Precio Unitario</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>
                {(localDoc.items || []).map((item: any, idx: number) => (
                  <div key={item.id || idx} data-item-layout="credit" className="purchase-item-row grid min-w-0 grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Input 
                        disabled={isNew ? !canPerform('PURCHASES_RETURNS', 'create') : !canPerform('PURCHASES_RETURNS', 'edit')}
                        value={item.description || ''} 
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)} 
                        className="h-8 text-xs" 
                        placeholder="Concepto" 
                      />
                    </div>
                    <div className="col-span-2">
                      <Input 
                        disabled={isNew ? !canPerform('PURCHASES_RETURNS', 'create') : !canPerform('PURCHASES_RETURNS', 'edit')}
                        type="number" 
                        min="0" 
                        value={item.quantity === 0 ? '' : item.quantity} 
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)} 
                        className="h-8 text-xs text-right" 
                        placeholder="0" 
                      />
                    </div>
                    <div className="col-span-3">
                      <Input 
                        disabled={isNew ? !canPerform('PURCHASES_RETURNS', 'create') : !canPerform('PURCHASES_RETURNS', 'edit')}
                        type="number" 
                        min="0" 
                        value={item.unitPrice === 0 ? '' : item.unitPrice} 
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)} 
                        className="h-8 text-xs text-right" 
                        placeholder="0" 
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <span className="text-xs font-black w-20 text-right tabular-nums">{formatConvertedAmount(Number(item.total || 0), resolveSourceCurrency((localDoc as any)?.currency), (localDoc as any)?.exchangeRate)}</span>
                      {((isNew && canPerform('PURCHASES_RETURNS', 'create')) || (!isNew && canPerform('PURCHASES_RETURNS', 'edit'))) && (
                        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-md" onClick={() => handleDeleteItem(idx)}>
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
               <div className="flex justify-end mt-4">
                  <div className="w-64 space-y-2 text-sm bg-muted/10 p-4 rounded-xl border border-border/50">
                     <div className="flex justify-between pt-2 border-t font-black"><span className="uppercase text-[10px] tracking-widest">Total</span><span className="text-lg text-primary">{formatConvertedAmount(recalculatedTotal, resolveSourceCurrency((localDoc as any)?.currency), (localDoc as any)?.exchangeRate)}</span></div>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>

      </div>
    );
  }

  const disponible = data
    .filter(c => (c.status || '').toLowerCase() === 'issued')
    .reduce((a, c) => a + convertAmount(Number(c.total || 0), resolveSourceCurrency((c as any)?.currency), (c as any)?.exchangeRate), 0);
  const kpis = [
    { title: 'Crédito Disponible', value: formatConvertedAmount(disponible, displayCurrency), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', kind: 'indicator' as const },
    { title: 'Total Notas', value: data.length, icon: Hash, color: 'text-blue-500', bg: 'bg-blue-500/10', kind: 'indicator' as const },
    { title: 'Emitidas', value: data.filter(c => (c.status||'').toLowerCase() === 'issued').length, icon: BadgeDollarSign, color: 'text-purple-500', bg: 'bg-purple-500/10', kind: 'filter' as const, filter: 'ISSUED' as const },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <PurchaseKpiCard key={i} title={k.title} value={k.value} icon={k.icon} color={k.color} bg={k.bg} kind={k.kind} active={k.filter === statusFilter} onClick={k.filter ? () => setStatusFilter(statusFilter === k.filter ? 'ALL' : k.filter) : undefined} />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Créditos de Proveedor</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Saldos a favor</p></div>
          <div className="flex flex-wrap items-center justify-end gap-3" data-tour="purchases-list-actions">
            <PurchaseViewTutorial view="credits" />
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
            {canPerform('PURCHASES_RETURNS', 'create') && (
              <Button onClick={() => setEditingId('NEW')} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nuevo Crédito</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} pagination={pagination}
          actions={(row) => (
             <div className="flex gap-1">
              <Button title={canPerform('PURCHASES_RETURNS', 'edit') ? "Editar" : "Ver"} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
              <PurchaseAuditButton entity="SUPPLIER_CREDIT" entityId={row.id} title="Auditoria del Credito" />
              {canPerform('PURCHASES_RETURNS', 'delete') && (
                <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
              )}
            </div>
          )}
        />
      </div>

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        loading={deleteLoading}
        title="Eliminar Crédito"
        description="¿Estás seguro de eliminar esta nota de crédito? Esta acción no se puede deshacer y los montos a favor del proveedor serán revertidos."
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

