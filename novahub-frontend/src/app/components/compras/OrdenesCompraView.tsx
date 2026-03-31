import { useState, useEffect } from 'react';
import { 
  ClipboardList, Plus, Search, Eye, Trash2, CheckCircle2, Clock, TrendingDown, ChevronLeft, FileInput, Download, FileText
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Combobox } from '../ui/Combobox';
import { purchaseOrdersService, suppliersService } from '../../services/compras.service';
import { storageService } from '../../services/storage.service';
import type { PurchaseOrder, Supplier } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { generatePurchaseOrderPDF } from '../../utils/pdfGenerator';
import { exportToCsv } from '../../utils/exportUtils';

interface Props { data: PurchaseOrder[]; loading: boolean; onRefresh: () => void; onConvertToInvoice?: (draft: any) => void; }

const MAX_EVIDENCE_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024;

const statusOpts = [
  { label: 'Borrador',   value: 'DRAFT',      color: 'bg-muted/20 text-muted-foreground' },
  { label: 'Pendiente',  value: 'PENDING',    color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Aprobada',   value: 'APPROVED',   color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Recibida',   value: 'RECEIVED',   color: 'bg-purple-500/10 text-purple-500' },
  { label: 'Cancelada',  value: 'CANCELLED',  color: 'bg-rose-500/10 text-rose-500' },
];

export function OrdenesCompraView({ data, loading, onRefresh, onConvertToInvoice }: Props) {
  const { canPerform, user } = useAuth();
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<PurchaseOrder> | null>(null);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

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
                expectedDelivery: new Date(Date.now() + 7 * 86400000).toISOString(),
                currency: displayCurrency,
                exchangeRate: globalRate,
                status: 'DRAFT',
                isService: false,
                requestedBy: 'Admin',
                address: '',
                includeTax: true,
            taxRate: 15,
            withholdingRate: 0,
            items: [],
            subtotal: 0,
            taxAmount: 0,
            withholdingAmount: 0,
            total: 0
          });
      } else {
         const found = data.find(x => x.id === editingId);
         setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
      }
      setEvidenceFile(null);
    } else {
      setLocalDoc(null);
      setEvidenceFile(null);
    }
  }, [editingId, data, globalRate]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filtered = data.filter(o => {
    if (!normalizedSearchTerm) return true;
    const haystack = [
      o.number,
      o.supplier?.name,
      o.address,
      o.requestedBy,
      o.notes,
      ...(o.items || []).flatMap((it: any) => [
        it.code,
        it.name,
        it.category,
        it.description,
      ]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedSearchTerm);
  });

  const columns: ColumnDef<PurchaseOrder>[] = [
    { key: 'number',   header: 'Número',   width: '120px',
      render: (val) => <span className="font-black font-mono text-primary text-xs">{val}</span> },
    { key: 'supplier', header: 'Proveedor',
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',     header: 'Fecha',     width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'total',    header: 'Total',     width: '130px',
      render: (val, row) => (
        <span className="font-black tabular-nums text-foreground">
          {formatConvertedAmount(Number(val || 0), row.currency, row.exchangeRate)}

        </span>
      ) },
    { key: 'status',   header: 'Estado',    width: '120px', editable: canPerform('compras', 'edit'), type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<PurchaseOrder>) => {
    try { await purchaseOrdersService.update(id as string, updates); toast.success('Orden actualizada'); onRefresh(); }
    catch { toast.error('Error al actualizar'); throw new Error('Update failed'); }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    setDeleteLoading(true);
    try {
      await purchaseOrdersService.delete(pendingDeleteId);
      toast.success('Orden de compra eliminada correctamente');
      setPendingDeleteId(null);
      if (editingId === pendingDeleteId) setEditingId(null);
      onRefresh();
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSaveDoc = async () => {
    if (!localDoc?.supplierId) return toast.error('Debe seleccionar un proveedor');
    if (!String(localDoc.address || '').trim()) return toast.error('Debe ingresar la dirección');
    if ((localDoc.items || []).length === 0) return toast.error('Debe agregar al menos un ítem');
    if ((localDoc.items || []).some((it: any) => !String(it.code || '').trim() || !String(it.name || '').trim() || !String(it.category || '').trim())) {
      return toast.error('Cada ítem requiere código, nombre y categoría');
    }

    const cleanedDoc: any = {
      ...localDoc,
      includeTax: localDoc.includeTax !== false,
      taxRate: Number(localDoc.taxRate || 0),
      withholdingRate: Number(localDoc.withholdingRate || 0),
      subtotal: Number(localDoc.subtotal || 0),
      taxAmount: Number(localDoc.taxAmount || 0),
      withholdingAmount: Number(localDoc.withholdingAmount || 0),
      total: Number(localDoc.total || 0),
      items: (localDoc.items || []).map((it: any) => ({
        ...it,
        description: it.description || it.name || '',
        quantity: Number(it.quantity || 0),
        unitPrice: Number(it.unitPrice || 0),
        stock: it.stock === '' || it.stock === undefined || it.stock === null ? undefined : Number(it.stock),
        total: Number(it.total || 0),
      })),
    };
    if (!cleanedDoc.includeTax) {
      cleanedDoc.taxRate = 0;
      cleanedDoc.taxAmount = 0;
    }

    if (evidenceFile) {
      const isImage = evidenceFile.type.startsWith('image/');
      if (isImage && evidenceFile.size > MAX_EVIDENCE_IMAGE_BYTES) {
        return toast.error('La imagen es muy pesada. Máximo 2MB');
      }
      if (!isImage && evidenceFile.size > MAX_EVIDENCE_FILE_BYTES) {
        return toast.error('El archivo es muy pesado. Máximo 10MB');
      }
      try {
        const evidenceFileUrl = await storageService.fileToBase64(evidenceFile);
        cleanedDoc.evidenceFileUrl = evidenceFileUrl;
        cleanedDoc.evidenceFileName = evidenceFile.name;
        cleanedDoc.evidenceFileType = evidenceFile.type;
        cleanedDoc.evidenceFileSize = evidenceFile.size;
      } catch {
        return toast.error('No se pudo procesar el archivo adjunto');
      }
    }
    
    try {
      if (editingId === 'NEW') {
        await purchaseOrdersService.create(cleanedDoc);
        toast.success('Orden creada');
      } else {
        await purchaseOrdersService.update(editingId!, cleanedDoc);
        toast.success('Orden guardada');
      }
      setEditingId(null);
      setEvidenceFile(null);
      onRefresh();
    } catch (e: any) {
      toast.error('Error al guardar: ' + (e.response?.data?.message || 'Error'));
    }
  };

  const handleDeleteItem = (idx: number) => {
    if (!localDoc) return;
    const newItems = [...(localDoc.items || [])];
    newItems.splice(idx, 1);
    recalculateTotals(newItems);
  };

  const handleConvertToInvoice = (order: Partial<PurchaseOrder>) => {
    if (!onConvertToInvoice) return;
    const draft = {
      supplierId: order.supplierId,
      date: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      currency: order.currency || 'NIO',
      exchangeRate: order.exchangeRate || globalRate,
      status: 'PENDING',
      items: (order.items || []).map((it: any) => ({
        ...it,
        description: it.description || it.name || '',
        taxRate: 0,
      })),
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      total: order.total,
      _sourceOrderId: order.id,
    };
    onConvertToInvoice(draft);
    toast.success('Abriendo formulario de factura...', { position: 'bottom-right' });
  };

  const calculateTotals = (items: any[], options?: { includeTax?: boolean; taxRate?: number; withholdingRate?: number }) => {
    const subtotal = items.reduce((acc, it) => acc + (Number(it.quantity||0) * Number(it.unitPrice||0)), 0);
    const includeTax = options?.includeTax ?? (localDoc?.includeTax !== false);
    const taxRate = Number(options?.taxRate ?? localDoc?.taxRate ?? 0);
    const withholdingRate = Number(options?.withholdingRate ?? localDoc?.withholdingRate ?? 0);
    const taxAmount = includeTax ? subtotal * (taxRate / 100) : 0;
    const withholdingAmount = subtotal * (withholdingRate / 100);
    const total = subtotal + taxAmount - withholdingAmount;
    return { subtotal, taxAmount, withholdingAmount, total };
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    if (!localDoc) return;
    const newItems = [...(localDoc.items || [])];
    newItems[idx] = { ...newItems[idx], [field]: value };

    if (field === 'stockApplies' && !value) {
      newItems[idx].stock = undefined;
    }
    
    if (['quantity', 'unitPrice'].includes(field)) {
       const q = Number(newItems[idx].quantity || 0);
       const p = Number(newItems[idx].unitPrice || 0);
       const sub = q * p;
       newItems[idx].total = sub;
    }
    recalculateTotals(newItems);
  };

  const handleServiceToggle = (checked: boolean) => {
    if (!localDoc) return;
    const updatedItems = (localDoc.items || []).map((item: any) => ({
      ...item,
      stockApplies: checked ? false : !!item.stockApplies,
      stock: checked ? undefined : item.stock,
    }));
    setLocalDoc((prev) => prev ? { ...prev, isService: checked, items: updatedItems } : prev);
  };

  const recalculateTotals = (items: any[], options?: { includeTax?: boolean; taxRate?: number; withholdingRate?: number }) => {
    const totals = calculateTotals(items, options);
    setLocalDoc(prev => ({ ...prev!, ...options, items, ...totals }));
  };

  const handleTaxToggle = (checked: boolean) => {
    if (!localDoc) return;
    recalculateTotals(localDoc.items || [], { includeTax: checked });
  };

  const handlePurchaseOrderExportCSV = (doc: Partial<PurchaseOrder>) => {
    const rows = (doc.items || []).map((item: any) => [
      item.code || '',
      item.name || '',
      item.category || '',
      item.stock ?? '',
      item.quantity || 0,
      item.unitPrice || 0,
      item.total || 0,
    ]);
    exportToCsv(`OC_${doc.number || doc.id || 'borrador'}`, [
      ['Numero', doc.number || '-'],
      ['Proveedor', doc.supplier?.name || '-'],
      ['Direccion', doc.address || '-'],
      ['Fecha', doc.date ? new Date(doc.date).toLocaleDateString() : '-'],
      ['Entrega Esperada', doc.expectedDelivery ? new Date(doc.expectedDelivery).toLocaleDateString() : '-'],
      ['Moneda', doc.currency || 'NIO'],
      ['Tipo OC', doc.isService ? 'Servicio' : 'Producto'],
      ['IVA Habilitado', doc.includeTax === false ? 'No' : 'Si'],
      ['IVA %', Number(doc.taxRate || 0)],
      ['Retencion IR %', Number(doc.withholdingRate || 0)],
      ['Subtotal', Number(doc.subtotal || 0)],
      ['IVA', Number(doc.taxAmount || 0)],
      ['Retencion IR', Number(doc.withholdingAmount || 0)],
      ['Total', Number(doc.total || 0)],
      [],
      ['Codigo', 'Nombre', 'Categoria', 'Stock', 'Cantidad', 'Precio U.', 'Total'],
      ...rows,
    ]);
  };

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
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Nueva Orden de Compra' : `Orden ${localDoc.number}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Detalle del registro</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {!isNew && (
                <Button variant="outline" className="rounded-xl border-primary/50 text-primary hover:bg-primary/10 font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => handleConvertToInvoice(localDoc)}>
                  <FileInput className="size-3 mr-2" /> Convertir a Factura
                </Button>
             )}
             {!isNew && (
               <>
                 <Button
                   variant="outline"
                   className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4"
                   onClick={() => generatePurchaseOrderPDF({
                     order: localDoc,
                     tenantName: user?.tenantName || 'Nova Hub',
                     formatAmount: (amount: number, currency?: string, rate?: number) =>
                       formatConvertedAmount(Number(amount || 0), currency || (localDoc.currency as any), rate || localDoc.exchangeRate),
                   })}
                 >
                   <Download className="size-3 mr-2" /> Exportar PDF
                 </Button>
                 <Button
                   variant="outline"
                   className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4"
                   onClick={() => handlePurchaseOrderExportCSV(localDoc)}
                 >
                   <FileText className="size-3 mr-2" /> Exportar Excel
                 </Button>
               </>
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
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {!isNew && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Número</p>
                    <Input value={localDoc.number || ''} disabled className="h-8 text-xs font-black uppercase bg-muted/20" />
                  </div>
                )}
                <div className={isNew ? 'col-span-2' : ''}>
                  <p className="text-[10px] text-muted-foreground mb-1">Proveedor</p>
                  <Combobox 
                    disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                    options={suppliers
                      .filter(s => (s.status || '').toUpperCase() === 'ACTIVE' || s.id === localDoc.supplierId)
                      .map(s => ({ label: s.name, value: s.id, description: (s.code ? `[${s.code}] ` : '') + (s.phone || 'Sin teléfono') }))}
                    value={localDoc.supplierId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val })}
                    placeholder="Seleccionar Proveedor"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Emisión</p>
                  <Input 
                    disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                    type="date" 
                    value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Entrega Esperada</p>
                  <Input 
                    disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                    type="date" 
                    value={localDoc.expectedDelivery ? new Date(localDoc.expectedDelivery).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, expectedDelivery: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <select 
                    disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                    value={localDoc.status || 'DRAFT'} 
                    onChange={(e) => setLocalDoc({ ...localDoc, status: e.target.value as any })}
                    className={cn("h-8 w-full rounded-md border border-input px-2 text-xs font-bold uppercase", currentStatus?.color || 'bg-background')}
                  >
                    {statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Moneda</p>
                  <select 
                    disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                    value={localDoc.currency || 'NIO'} 
                    onChange={(e) => setLocalDoc({ ...localDoc, currency: e.target.value as any })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase"
                  >
                    <option value="NIO">NIO (Cordobas)</option>
                    <option value="USD">USD (Dolares)</option>
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Tipo de OC</p>
                  <div className="h-8 px-3 rounded-md border border-input bg-background flex items-center justify-between">
                    <span className="text-xs font-bold">{localDoc.isService ? 'Servicio' : 'Producto'}</span>
                    <Switch
                      checked={!!localDoc.isService}
                      onCheckedChange={handleServiceToggle}
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Dirección</p>
                  <Input
                    disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                    value={localDoc.address || ''}
                    onChange={(e) => setLocalDoc({ ...localDoc, address: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="Dirección de entrega o facturación"
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Adjuntar evidencia (PDF, imagen, XLSX)</p>
                  <Input
                    disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                    type="file"
                    accept=".pdf,.xlsx,.xls,image/*"
                    onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                    className="h-8 text-xs"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">Imágenes max 2MB. Otros archivos max 10MB.</p>
                  {(evidenceFile || localDoc.evidenceFileName) && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-primary">
                      <FileText className="size-3" />
                      {evidenceFile?.name || localDoc.evidenceFileName}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 flex flex-col justify-center h-full space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen Financiero</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-bold tabular-nums">${Number(localDoc.subtotal||0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">IVA</span>
                  <span className="font-bold tabular-nums text-rose-500">${Number(localDoc.taxAmount||0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Retención IR</span>
                  <span className="font-bold tabular-nums text-amber-500">-${Number(localDoc.withholdingAmount||0).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t pt-3 border-border/50">
                  <div className="col-span-1">
                    <p className="text-[10px] text-muted-foreground mb-1">IVA habilitado</p>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={localDoc.includeTax !== false}
                        onChange={(e) => handleTaxToggle(e.target.checked)}
                      />
                      <span>{localDoc.includeTax !== false ? 'Sí' : 'No'}</span>
                    </label>
                  </div>
                  <div className="col-span-1">
                    <p className="text-[10px] text-muted-foreground mb-1">IVA %</p>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={localDoc.includeTax === false}
                      value={localDoc.taxRate === 0 ? '' : localDoc.taxRate}
                      onChange={(e) => recalculateTotals(localDoc.items || [], { taxRate: Number(e.target.value || 0) })}
                      className="h-8 text-xs text-right"
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-1">
                    <p className="text-[10px] text-muted-foreground mb-1">Retención IR %</p>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={localDoc.withholdingRate === 0 ? '' : localDoc.withholdingRate}
                      onChange={(e) => recalculateTotals(localDoc.items || [], { withholdingRate: Number(e.target.value || 0) })}
                      className="h-8 text-xs text-right"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center text-base border-t pt-3 border-border/50">
                  <span className="font-black uppercase text-xs tracking-widest">Total</span>
                  <span className="font-black text-xl text-primary tabular-nums text-right">
                     {localDoc.currency === 'USD' ? '$' : 'C$'} {Number(localDoc.total||0).toLocaleString()}
                     {localDoc.currency === 'NIO' && <span className="block text-[9px] text-muted-foreground mt-1">≈ $ {(Number(localDoc.total||0) / (localDoc.exchangeRate || globalRate)).toLocaleString(undefined, {maximumFractionDigits:2})}</span>}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Ítems de Orden</p>
              {((isNew && canPerform('compras', 'create')) || (!isNew && canPerform('compras', 'edit'))) && (
                <Button variant="outline" size="sm" onClick={() => {
                  const isServiceOrder = !!localDoc.isService;
                  const newItems = [...(localDoc.items || []), { id: `new-${Date.now()}`, code: '', name: '', category: '', stockApplies: isServiceOrder ? false : false, stock: undefined, quantity: 1, unitPrice: 0, total: 0 }];
                  setLocalDoc({ ...localDoc, items: newItems as any });
                }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                  <Plus className="size-3 mr-2" /> Agregar Item
                </Button>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className="col-span-2">Código</div>
                <div className="col-span-2">Nombre</div>
                <div className="col-span-2">Categoría</div>
                <div className="col-span-2 text-right">Stock</div>
                <div className="col-span-1 text-right">Cant.</div>
                <div className="col-span-1 text-right">Precio</div>
                <div className="col-span-1 text-right">Total</div>
                <div className="col-span-1"></div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-2">
                    <Input 
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                      value={item.code || ''} 
                      onChange={(e) => handleItemChange(idx, 'code', e.target.value)} 
                      className="h-8 text-xs" 
                      placeholder="Código" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                      value={item.name || ''} 
                      onChange={(e) => handleItemChange(idx, 'name', e.target.value)} 
                      className="h-8 text-xs" 
                      placeholder={localDoc.isService ? 'Nombre del servicio' : 'Nombre del producto'} 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                      value={item.category || ''} 
                      onChange={(e) => handleItemChange(idx, 'category', e.target.value)} 
                      className="h-8 text-xs" 
                      placeholder="Categoría" 
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center justify-end gap-2">
                      <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={!!item.stockApplies}
                          onChange={(e) => handleItemChange(idx, 'stockApplies', e.target.checked)}
                          disabled={!!localDoc.isService || (isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit'))}
                        />
                        Stock
                      </label>
                      <Input 
                        disabled={!item.stockApplies || (isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit'))}
                        type="number"
                        min="0"
                        value={item.stock === 0 ? '' : (item.stock ?? '')} 
                        onChange={(e) => handleItemChange(idx, 'stock', e.target.value)} 
                        className="h-8 text-xs text-right w-20" 
                        placeholder="-" 
                      />
                    </div>
                  </div>
                  <div className="col-span-1">
                    <Input 
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                      type="number" 
                      min="0" 
                      value={item.quantity === 0 ? '' : item.quantity} 
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)} 
                      className="h-8 text-xs text-right" 
                      placeholder="0" 
                    />
                  </div>
                  <div className="col-span-1">
                    <Input 
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                      type="number" 
                      min="0" 
                      value={item.unitPrice === 0 ? '' : item.unitPrice} 
                      onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)} 
                      className="h-8 text-xs text-right" 
                      placeholder="0" 
                    />
                  </div>
                  <div className="col-span-1">
                    <Input 
                      disabled
                      type="number" 
                      value={Number(item.total || 0)} 
                      className="h-8 text-xs text-right bg-muted/20" 
                      readOnly
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-end gap-2">
                    {((isNew && canPerform('compras', 'create')) || (!isNew && canPerform('compras', 'edit'))) && (
                      <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-md" onClick={() => handleDeleteItem(idx)}>
                        <Trash2 className="size-3" />
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

  const totalAmountInDisplayCurrency = data.reduce(
    (acc, order) => acc + convertAmount(order.total || 0, order.currency, order.exchangeRate),
    0,
  );
  const kpis = [
    { title: 'Total Ordenes',   value: data.length,                                                                     icon: ClipboardList, color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Por Aprobar',     value: data.filter(o => (o.status||'').toUpperCase() === 'PENDING').length,                 icon: Clock,         color: 'text-amber-500',  bg: 'bg-amber-500/10'   },
    { title: 'Aprobadas',       value: data.filter(o => (o.status||'').toUpperCase() === 'APPROVED').length,             icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    {
      title: `Monto Total (${displayCurrency})`,
      value: `${displayCurrency === 'USD' ? '$' : 'C$'} ${totalAmountInDisplayCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: TrendingDown,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
  ];

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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight">Órdenes de Compra</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Pedidos a proveedores</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            {canPerform('compras', 'create') && (
              <Button onClick={() => setEditingId('NEW')} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nueva Orden</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading}
          onBulkDelete={canPerform('compras', 'delete') ? async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await purchaseOrdersService.delete(id as string);
              }
              toast.success('Elementos eliminados');
              onRefresh();
            } catch (e) {
              toast.error('Error al eliminar');
            }
          } : undefined}
          actions={(row) => (
            <div className="flex gap-1">
              <Button title="Convertir a Factura" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500" onClick={() => handleConvertToInvoice(row)}><FileInput className="size-4" /></Button>
              <Button title={canPerform('compras', 'edit') ? "Editar" : "Ver"} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
              {canPerform('compras', 'delete') && (
                <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
              )}
            </div>
          )}
        />
        <ConfirmDialog
          open={!!pendingDeleteId}
          onOpenChange={(open) => !open && setPendingDeleteId(null)}
          title="Eliminar Orden de Compra"
          description="¿Estás seguro de que deseas eliminar esta orden? Esta acción no se puede deshacer."
          confirmLabel="Eliminar Orden"
          onConfirm={handleDeleteConfirm}
          loading={deleteLoading}
        />
      </div>
    </div>
  );
}
