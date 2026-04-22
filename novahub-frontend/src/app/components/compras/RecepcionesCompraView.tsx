import { useState, useEffect } from 'react';
import { PackageCheck, Plus, Search, Eye, Trash2, CheckCircle2, ChevronLeft, Clock, PackageOpen, Download } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { purchaseReceiptsService, suppliersService, purchaseOrdersService } from '../../services/compras.service';
import type { PurchaseReceipt, Supplier, PurchaseOrder } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { generatePurchaseReceptionPDF } from '../../utils/pdfGenerator';

interface Props { data: PurchaseReceipt[]; loading: boolean; onRefresh: () => void; }

const statusOpts = [
  { label: 'Pendiente',  value: 'PENDING',  color: 'bg-orange-500/10 text-orange-500' },
  { label: 'Parcial',    value: 'PARTIAL',  color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Recibido',   value: 'RECEIVED', color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Rechazado',  value: 'REJECTED', color: 'bg-rose-500/10 text-rose-500' },
];

export function RecepcionesCompraView({ data, loading, onRefresh }: Props) {
  const { canPerform, user } = useAuth();
  const { themeConfig } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<PurchaseReceipt> | null>(null);

  useEffect(() => {
    suppliersService.getAll().then(res => {
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setSuppliers(list);
    }).catch();
    purchaseOrdersService.getAll().then(res => {
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setOrders(list);
    }).catch();
  }, []);

  useEffect(() => {
    if (editingId) {
      if (editingId === 'NEW') {
         setLocalDoc({
           supplierId: '',
           purchaseOrderId: '',
           date: new Date().toISOString(),
           status: 'PENDING' as any,
           items: [],
         });
      } else {
         const found = data.find(x => x.id === editingId);
         setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
      }
    } else {
      setLocalDoc(null);
    }
  }, [editingId, data]);

  const todayStr = new Date().toLocaleDateString();
  const recepcionesHoy = data.filter(r => r.date && new Date(r.date).toLocaleDateString() === todayStr).length;
  const pendientes = data.filter(r => (r.status || '').toUpperCase() === 'PENDING').length;

  const kpis = [
    { title: 'Total Recepciones', value: data.length,                                                                                  icon: PackageCheck, color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Artículos Recibidos', value: data.reduce((acc, r) => acc + (r.items?.reduce((a,i:any) => a + Number(i.quantityReceived||0),0)||0), 0), icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Hoy',               value: recepcionesHoy,                                                                          icon: Clock,        color: 'text-purple-500',  bg: 'bg-purple-500/10'  },
    { title: 'Pendientes',        value: pendientes,                                                                              icon: PackageOpen,  color: 'text-amber-500',   bg: 'bg-amber-500/10'   },
  ];

  const columns: ColumnDef<PurchaseReceipt>[] = [
    { key: 'number',    header: 'Recibo #',    width: '120px',
      render: (val) => <span className="font-black font-mono text-primary text-xs">{val}</span> },
    { key: 'supplier',  header: 'Proveedor',   width: '200px',
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',      header: 'Fecha',       width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'items',     header: 'Total Ítems', width: '100px',
      render: (val) => <span className="text-xs font-black tabular-nums">{Array.isArray(val) ? val.length : 0} art.</span> },
    { key: 'status',    header: 'Estado',      width: '120px', editable: canPerform('compras', 'edit'), type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<PurchaseReceipt>) => {
    try { await (purchaseReceiptsService as any).update(id as string, updates); toast.success('Recepción actualizada'); onRefresh(); }
    catch { toast.error('Error al actualizar'); throw new Error('Update failed'); }
  };

  const handleSaveDoc = async () => {
    if (!localDoc?.supplierId) return toast.error('Debe seleccionar un proveedor');
    if (!localDoc?.purchaseOrderId) return toast.error('Debe seleccionar una orden de compra');
    
    try {
      if (editingId === 'NEW') {
        await purchaseReceiptsService.create(localDoc as any);
        toast.success('Recepción creada');
      } else {
        await (purchaseReceiptsService as any).update(editingId!, localDoc as any);
        toast.success('Recepción guardada');
      }
      setEditingId(null);
      onRefresh();
    } catch (e: any) {
      toast.error('Error al guardar: ' + (e.message || 'Error'));
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
    setLocalDoc({ ...localDoc, items: newItems as any });
  };

  const filtered = data.filter(r =>
    (r.number||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.supplier?.name||'').toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Nueva Recepción' : `Recepción ${localDoc.number||''}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Inventario ingresado</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {!isNew && (
                <Button
                  variant="outline"
                  className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => generatePurchaseReceptionPDF({
                    reception: localDoc,
                    tenantName: user?.tenantName || 'Empresa',
                    tenantLogo: themeConfig?.logo,
                    primaryColor: themeConfig?.colors.primary
                  })}
                >
                  <Download className="size-3 mr-2" /> Descargar
                </Button>
             )}
             {!isNew && canPerform('compras', 'delete') && (
                <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => setPendingDeleteId(editingId)}>
                  <Trash2 className="size-3 mr-2" /> Eliminar
                </Button>
             )}
            {((isNew && canPerform('compras', 'create')) || (!isNew && canPerform('compras', 'edit'))) && (
              <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                Guardar
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50 col-span-2">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Proveedor</p>
                  <Combobox 
                    disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                    options={suppliers
                      .filter(s => (s.status || '').toUpperCase() === 'ACTIVE' || s.id === localDoc.supplierId)
                      .map(s => ({ label: s.name, value: s.id, description: (s.code ? `[${s.code}] ` : '') + (s.phone || 'Sin teléfono') }))}
                    value={localDoc.supplierId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val, purchaseOrderId: '' })}
                    placeholder="Seleccionar Proveedor"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Orden de Compra</p>
                  <Combobox 
                    disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                    options={orders.filter(o => o.supplierId === localDoc?.supplierId && ['APPROVED'].includes((o.status||'').toUpperCase())).map(c => ({ label: `${c.number} (Total: ${c.total})`, value: c.id }))}
                    value={localDoc.purchaseOrderId || ''}
                    onChange={(val) => {
                       const ord = orders.find(x => x.id === val);
                       const newItems = ord?.items?.map(it => ({
                          description: (it as any).description,
                          quantityOrdered: (it as any).quantity,
                          quantityReceived: (it as any).quantity,
                          productId: (it as any).productId
                       })) || [];
                       setLocalDoc({ ...localDoc, purchaseOrderId: val, items: newItems as any });
                    }}
                    placeholder={localDoc.supplierId ? "Seleccionar Orden" : "Seleccione un proveedor primero"}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Recepción</p>
                  <Input 
                    disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                    type="date" 
                    value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <select 
                    disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                    value={localDoc.status || 'PENDING'} 
                    onChange={(e) => setLocalDoc({ ...localDoc, status: e.target.value as any })}
                    className={cn("h-8 w-full rounded-md border border-input px-2 text-xs font-bold uppercase", currentStatus?.color || 'bg-background')}
                  >
                    {statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos Recibidos</p>
              {((isNew && canPerform('compras', 'create')) || (!isNew && canPerform('compras', 'edit'))) && (
                <Button variant="outline" size="sm" onClick={() => {
                  const newItems = [...(localDoc.items || []), { id: `new-${Date.now()}`, description: '', quantityOrdered: 0, quantityReceived: 1 }];
                  setLocalDoc({ ...localDoc, items: newItems as any });
                }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                  <Plus className="size-3 mr-2" /> Agregar Item
                </Button>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 hidden md:grid">
                <div className="col-span-6">Descripción</div>
                <div className="col-span-2 text-right">Cant. Ord.</div>
                <div className="col-span-2 text-right">Cant. Rec.</div>
                <div className="col-span-2 text-right"></div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center border-b md:border-none pb-4 md:pb-0">
                  <div className="md:col-span-6">
                    <p className="text-[10px] md:hidden font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Descripción</p>
                    <Input 
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                      value={item.description || ''} 
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)} 
                      className="h-8 text-xs font-bold text-primary" 
                    />
                  </div>
                  <div className="grid grid-cols-2 md:contents gap-2">
                    <div>
                      <p className="text-[10px] md:hidden font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Cant. Ord.</p>
                      <Input 
                        disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                        type="number" 
                        min="0" 
                        value={item.quantityOrdered === 0 ? '' : item.quantityOrdered} 
                        onChange={(e) => handleItemChange(idx, 'quantityOrdered', e.target.value)} 
                        className="h-8 text-xs text-right bg-muted/20" 
                      />
                    </div>
                    <div>
                      <p className="text-[10px] md:hidden font-black uppercase tracking-widest text-muted-foreground/60 mb-1 text-emerald-500">Cant. Rec.</p>
                      <Input 
                        disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                        type="number" 
                        min="0" 
                        value={item.quantityReceived === 0 ? '' : item.quantityReceived} 
                        onChange={(e) => handleItemChange(idx, 'quantityReceived', e.target.value)} 
                        className="h-8 text-xs text-right font-bold text-emerald-500 border-emerald-500/50" 
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end md:col-span-2">
                    {((isNew && canPerform('compras', 'create')) || (!isNew && canPerform('compras', 'edit'))) && (
                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-lg" onClick={() => handleDeleteItem(idx)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && (
                <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">
                  No hay ítems registrados.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
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
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Recepciones de Compra</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 text-left">Control de entrada de inventario y suministros</p>
          </div>
          {canPerform('compras', 'create') && (
            <Button onClick={() => setEditingId('NEW')} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl gap-2 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
              <Plus className="size-4" /> Nueva Recepción
            </Button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-muted/5 p-2 rounded-2xl border border-border/40">
           <div className="flex items-center gap-2 flex-1">
              <Badge variant="outline" className="h-9 px-4 rounded-xl border-border/50 bg-background/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                {data.length} Recepciones Registradas
              </Badge>
           </div>
           
           <div className="relative w-full lg:w-72">
             <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
             <Input 
               placeholder="Buscar..." 
               className="pl-9 h-10 w-full bg-background border-border/50 rounded-xl text-xs" 
               value={searchTerm} 
               onChange={e => setSearchTerm(e.target.value)} 
             />
           </div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
          <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} allowAddRow={false}
            onBulkDelete={canPerform('compras', 'delete') ? async (ids) => {
              try {
                for (const id of ids) {
                  if (String(id).startsWith('new-')) continue;
                  await purchaseReceiptsService.delete(id as string);
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
                    await toast.promise(generatePurchaseReceptionPDF({
                      reception: row,
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
        title={"¿Eliminar recepción?"}
        description="¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          try {
            setDeleteLoading(true);
            await purchaseReceiptsService.delete(pendingDeleteId);
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
