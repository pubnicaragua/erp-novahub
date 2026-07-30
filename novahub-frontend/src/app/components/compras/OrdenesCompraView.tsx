import { useState, useEffect } from 'react';
import { 
  ClipboardList, Plus, Search, Eye, Trash2, CheckCircle2, Clock, TrendingDown, ChevronLeft, FileInput, Download, FileText, X
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Combobox } from '../ui/Combobox';
import { purchaseOrdersService, suppliersService } from '../../services/compras.service';
import { inventoryService } from '../../services/inventario.service';
import { storageService } from '../../services/storage.service';
import type { PurchaseOrder, Supplier, SupplierInvoice } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { generatePurchaseOrderPDF } from '../../utils/pdfGenerator';
import { exportToCsv } from '../../utils/exportUtils';
import { PurchaseAuditButton } from './PurchaseAuditButton';

interface Props {
  data: PurchaseOrder[];
  loading: boolean;
  onRefresh: () => void;
  onConvertToInvoice?: (draft: any) => void;
  supplierInvoices?: SupplierInvoice[];
}

const MAX_EVIDENCE_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024;

const statusOpts = [
  { label: 'Borrador',   value: 'DRAFT',      color: 'bg-muted/20 text-muted-foreground' },
  { label: 'Pendiente',  value: 'PENDING',    color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Aprobada',   value: 'APPROVED',   color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Recibida',   value: 'RECEIVED',   color: 'bg-purple-500/10 text-purple-500' },
  { label: 'Cancelada',  value: 'CANCELLED',  color: 'bg-rose-500/10 text-rose-500' },
];

export function OrdenesCompraView({ data, loading, onRefresh, onConvertToInvoice, supplierInvoices = [] }: Props) {
  const { canPerform, user } = useAuth();
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<PurchaseOrder> | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);

  useEffect(() => {
    suppliersService.getAll().then(res => {
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setSuppliers(list);
    }).catch();
    inventoryService.getProducts().then((res: any) => {
      const list = Array.isArray(res)
        ? res
        : (res?.data?.items || res?.data || res?.items || []);
      setProducts(Array.isArray(list) ? list : []);
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
                purchaseType: 'INVENTORY',
                requestedBy: 'Admin',
                address: '',
                items: [],
                subtotal: 0,
                taxAmount: 0,
                withholdingTotal: 0,
                withholdingBase: 0,
                total: 0
          });
      } else {
         const found = data.find(x => x.id === editingId);
         setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
      }
      setEvidenceFiles([]);
    } else {
      setLocalDoc(null);
      setEvidenceFiles([]);
    }
  }, [editingId, data, globalRate]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filtered = data.filter(o => {
    if (statusFilter !== 'ALL' && (o.status || '').toUpperCase() !== statusFilter) return false;
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
    { key: 'status',   header: 'Estado',    width: '120px', editable: canPerform('PURCHASES_ORDERS', 'edit'), type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<PurchaseOrder>) => {
    try { await purchaseOrdersService.update(id as string, updates); toast.success('Orden actualizada'); onRefresh(); }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar'); throw new Error('Update failed'); }
  };

  const handleCancelConfirm = async () => {
    if (!pendingCancelId || !cancelReason.trim()) return;
    setCancelLoading(true);
    try {
      await purchaseOrdersService.cancel(pendingCancelId, cancelReason.trim());
      toast.success('Orden de compra anulada');
      setPendingCancelId(null);
      setCancelReason('');
      if (editingId === pendingCancelId) setEditingId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al anular');
    } finally {
      setCancelLoading(false);
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
      isService: localDoc.purchaseType === 'SERVICE',
      taxRate: 0,
      withholdingRate: 0,
      subtotal: Number(localDoc.subtotal || 0),
      taxAmount: Number(localDoc.taxAmount || 0),
      withholdingTotal: Number(localDoc.withholdingTotal || 0),
      withholdingBase: Number(localDoc.withholdingBase || 0),
      total: Number(localDoc.total || 0),
      items: (localDoc.items || []).map((it: any) => ({
        ...it,
        description: it.description || it.name || '',
        quantity: Number(it.quantity || 0),
        unitPrice: Number(it.unitPrice || 0),
        taxType: it.taxType || 'GRAVADO',
        taxRate: it.taxType === 'EXENTO' || it.taxType === 'NO_GRAVADO' ? 0 : Number(it.taxRate || 15),
        taxBase: it.taxType === 'EXENTO' || it.taxType === 'NO_GRAVADO' ? 0 : Number(it.taxBase || 0),
        taxAmount: Number(it.taxAmount || 0),
        withholdingType: it.withholdingType || 'NONE',
        withholdingRate: Number(it.withholdingRate || 0),
        withholdingBase: it.withholdingType === 'NONE' ? 0 : Number(it.withholdingBase || 0),
        accountId: it.accountId || null,
        costCenterId: it.costCenterId || null,
        stock: it.stock === '' || it.stock === undefined || it.stock === null ? undefined : Number(it.stock),
        total: Number(it.total || 0),
      })),
    };

    if (evidenceFiles.length > 0) {
      const uploaded: { url: string; name: string; type: string; size: number }[] = [];
      for (const file of evidenceFiles) {
        const isImage = file.type.startsWith('image/');
        if (isImage && file.size > MAX_EVIDENCE_IMAGE_BYTES) {
          return toast.error(`La imagen "${file.name}" es muy pesada. Máximo 2MB`);
        }
        if (!isImage && file.size > MAX_EVIDENCE_FILE_BYTES) {
          return toast.error(`El archivo "${file.name}" es muy pesado. Máximo 10MB`);
        }
        try {
          const evidence = await storageService.uploadFile('purchase-evidence', file, { folder: 'ordenes' });
          uploaded.push({ url: evidence.uri, name: file.name, type: file.type, size: file.size });
        } catch {
          return toast.error(`No se pudo procesar el archivo "${file.name}"`);
        }
      }
      cleanedDoc.evidenceFiles = uploaded;
      cleanedDoc.evidenceFileUrl = uploaded[0]?.url;
      cleanedDoc.evidenceFileName = uploaded[0]?.name;
      cleanedDoc.evidenceFileType = uploaded[0]?.type;
      cleanedDoc.evidenceFileSize = uploaded[0]?.size;
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
      setEvidenceFiles([]);
      onRefresh();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '';
      if (msg.toLowerCase().includes('no existe') || e?.response?.status === 404) {
        toast.error('Uno de los productos seleccionados ya no está disponible o fue eliminado. Verifica los ítems e intenta de nuevo.');
      } else {
        toast.error(msg || 'Error al guardar la orden de compra');
      }
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
    const sourceOrderId = order.id;
    const alreadyInvoiced = !!sourceOrderId && supplierInvoices.some((inv) => inv.purchaseOrderId === sourceOrderId);
    if (alreadyInvoiced) {
      toast.error('Esta orden de compra ya fue convertida en factura');
      return;
    }
    if (String(order.status || '').toUpperCase() === 'RECEIVED') {
      toast.error('Esta orden ya fue recibida y no puede volver a convertirse');
      return;
    }
    const draft = {
      supplierId: order.supplierId,
      purchaseOrderId: order.id,
      date: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      currency: order.currency || 'NIO',
      exchangeRate: order.exchangeRate || globalRate,
      status: 'PENDING',
      items: (order.items || []).map((it: any) => ({
        ...it,
        description: it.description || it.name || '',
        productId: it.productId || null,
        taxType: it.taxType || 'GRAVADO',
        taxRate: it.taxType === 'EXENTO' || it.taxType === 'NO_GRAVADO' ? 0 : (it.taxRate || 15),
        taxBase: it.taxBase || 0,
        taxAmount: it.taxAmount || 0,
        withholdingType: it.withholdingType || 'NONE',
        withholdingRate: it.withholdingRate || 0,
        withholdingBase: it.withholdingBase || 0,
        accountId: it.accountId || null,
        unitPrice: Number(it.unitPrice || 0),
        quantity: Number(it.quantity || 0),
        total: Number(it.total || 0),
      })),
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      withholdingTotal: order.withholdingTotal || 0,
      withholdingBase: order.withholdingBase || 0,
      total: order.total,
      _sourceOrderId: order.id,
    };
    onConvertToInvoice(draft);
    toast.success('Abriendo formulario de factura...', { position: 'bottom-right' });
  };

  const calculateTotals = (items: any[]) => {
    const subtotal = items.reduce((acc, it) => acc + (Number(it.quantity||0) * Number(it.unitPrice||0)), 0);
    const taxAmount = items.reduce((acc, it) => {
      const tt = (it.taxType || 'GRAVADO').toUpperCase();
      if (tt !== 'GRAVADO') return acc + 0;
      const lineTotal = Number(it.quantity||0) * Number(it.unitPrice||0);
      const base = Number(it.taxBase) || lineTotal;
      const rate = Number(it.taxRate) || 15;
      return acc + (base * rate / 100);
    }, 0);
    const withholdingTotal = items.reduce((acc, it) => {
      const wt = (it.withholdingType || 'NONE').toUpperCase();
      if (wt === 'NONE') return acc + 0;
      const lineTotal = Number(it.quantity||0) * Number(it.unitPrice||0);
      const base = Number(it.withholdingBase) || lineTotal;
      const rate = Number(it.withholdingRate) || 0;
      return acc + (base * rate / 100);
    }, 0);
    const withholdingBase = items.reduce((acc, it) => {
      const wt = (it.withholdingType || 'NONE').toUpperCase();
      if (wt === 'NONE') return acc + 0;
      const lineTotal = Number(it.quantity||0) * Number(it.unitPrice||0);
      return acc + (Number(it.withholdingBase) || lineTotal);
    }, 0);
    const total = subtotal + taxAmount - withholdingTotal;
    return { subtotal, taxAmount, withholdingTotal, withholdingBase, total };
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    if (!localDoc) return;
    const newItems = [...(localDoc.items || [])];
    newItems[idx] = { ...newItems[idx], [field]: value };

    if (field === 'stockApplies' && !value) {
      newItems[idx].stock = undefined;
    }
    
    if (['quantity', 'unitPrice', 'taxType', 'taxRate', 'withholdingType', 'withholdingRate'].includes(field)) {
       const q = Number(newItems[idx].quantity || 0);
       const p = Number(newItems[idx].unitPrice || 0);
       const sub = q * p;
       const tt = (newItems[idx].taxType || 'GRAVADO').toUpperCase();
       if (tt === 'EXENTO' || tt === 'NO_GRAVADO') {
         newItems[idx].taxRate = 0;
         newItems[idx].taxBase = 0;
         newItems[idx].taxAmount = 0;
       }
       const wt = (newItems[idx].withholdingType || 'NONE').toUpperCase();
       if (wt === 'NONE') {
         newItems[idx].withholdingRate = 0;
         newItems[idx].withholdingBase = 0;
       }
       newItems[idx].total = sub;
    }
    recalculateTotals(newItems);
  };

  const handleSelectExistingProduct = (idx: number, productId: string) => {
    if (!localDoc) return;
    const selected = products.find((p: any) => String(p.id) === String(productId));
    if (!selected) return;

    const newItems = [...(localDoc.items || [])];
    const currentItem = newItems[idx] || {};
    const purchasePrice = Number(selected.costPrice ?? selected.cost ?? selected.price ?? 0);
    const currentStock = selected.stock != null ? selected.stock :
      (selected.inventoryLevels?.[0]?.quantity ?? selected.quantity ?? 0);
    newItems[idx] = {
      ...currentItem,
      productId: selected.id,
      code: selected.code || selected.sku || currentItem.code || '',
      name: selected.name || currentItem.name || '',
      description: selected.description || currentItem.description || selected.name || '',
      category: selected.category?.name || selected.category || selected.categoryId || currentItem.category || '',
      stockApplies: localDoc.purchaseType === 'SERVICE' ? false : true,
      currentStock: Number(currentStock),
      unitPrice: purchasePrice,
      taxType: currentItem.taxType || 'GRAVADO',
      taxRate: currentItem.taxRate || 15,
      withholdingType: currentItem.withholdingType || 'NONE',
      quantity: Number(currentItem.quantity || 1),
      total: Number(currentItem.quantity || 1) * purchasePrice,
    };
    recalculateTotals(newItems);
  };

  const handleServiceToggle = (checked: boolean) => {
    if (!localDoc) return;
    const updatedItems = (localDoc.items || []).map((item: any) => ({
      ...item,
      stockApplies: checked ? false : !!item.stockApplies,
      stock: checked ? undefined : item.stock,
    }));
    setLocalDoc((prev: any) => prev ? { ...prev, purchaseType: checked ? 'SERVICE' : 'INVENTORY', items: updatedItems } : prev);
  };

  const recalculateTotals = (items: any[]) => {
    const totals = calculateTotals(items);
    setLocalDoc(prev => ({ ...prev!, items, ...totals }));
  };

  const handlePurchaseOrderExportCSV = (doc: Partial<PurchaseOrder>) => {
    const rows = (doc.items || []).map((item: any) => [
      item.code || '',
      item.name || '',
      item.category || '',
      item.stock ?? '',
      item.quantity || 0,
      item.unitPrice || 0,
      item.taxType || 'GRAVADO',
      item.withholdingType || 'NONE',
      item.total || 0,
    ]);
    exportToCsv(`OC_${doc.number || doc.id || 'borrador'}`, [
      ['Numero', doc.number || '-'],
      ['Proveedor', doc.supplier?.name || '-'],
      ['Direccion', doc.address || '-'],
      ['Fecha', doc.date ? new Date(doc.date).toLocaleDateString() : '-'],
      ['Entrega Esperada', doc.expectedDelivery ? new Date(doc.expectedDelivery).toLocaleDateString() : '-'],
      ['Moneda', doc.currency || 'NIO'],
      ['Tipo OC', doc.purchaseType || 'INVENTORY'],
      ['Subtotal', Number(doc.subtotal || 0)],
      ['IVA', Number(doc.taxAmount || 0)],
      ['Retencion', Number(doc.withholdingTotal || 0)],
      ['Total', Number(doc.total || 0)],
      [],
      ['Codigo', 'Nombre', 'Categoria', 'Stock', 'Cantidad', 'Precio U.', 'TipoIVA', 'Retencion', 'Total'],
      ...rows,
    ]);
  };

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const currentStatus = statusOpts.find(s => s.value === (localDoc.status||'').toUpperCase());
    
    return (
      <div className="min-w-0 max-w-full space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between flex-wrap gap-4">
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
              {!isNew && canPerform('PURCHASES_ORDERS', 'delete') && (
                 <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                   onClick={() => { setPendingCancelId(editingId); setCancelReason(''); }}>
                   <Trash2 className="size-3 mr-2" /> Anular
                 </Button>
              )}
            {((isNew && canPerform('PURCHASES_ORDERS', 'create')) || (!isNew && canPerform('PURCHASES_ORDERS', 'edit'))) && (
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
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
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
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                    type="date" 
                    value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Entrega Esperada</p>
                  <Input 
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                    type="date" 
                    value={localDoc.expectedDelivery ? new Date(localDoc.expectedDelivery).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, expectedDelivery: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <select 
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
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
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                    value={localDoc.currency || 'NIO'} 
                    onChange={(e) => setLocalDoc({ ...localDoc, currency: e.target.value as any })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase"
                  >
                    <option value="NIO">NIO (Cordobas)</option>
                    <option value="USD">USD (Dolares)</option>
                  </select>
                </div>
                <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Tipo de Compra</p>
                    <select
                      disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                      value={localDoc.purchaseType || 'INVENTORY'}
                      onChange={(e) => {
                        const pt = e.target.value;
                        setLocalDoc({ ...localDoc, purchaseType: pt });
                        if (pt === 'SERVICE') {
                          const updatedItems = (localDoc.items || []).map((item: any) => ({
                            ...item, stockApplies: false, stock: undefined,
                          }));
                          setLocalDoc((prev: any) => prev ? { ...prev, purchaseType: pt, items: updatedItems } : prev);
                        }
                      }}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase"
                    >
                      <option value="INVENTORY">Inventario</option>
                      <option value="ASSET">Activo Fijo</option>
                      <option value="SERVICE">Servicio</option>
                      <option value="ADMIN">Gasto Administrativo</option>
                    </select>
                  </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Dirección</p>
                  <Input
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                    value={localDoc.address || ''}
                    onChange={(e) => setLocalDoc({ ...localDoc, address: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="Dirección de entrega o facturación"
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Adjuntar evidencia (PDF, imagen, XLSX)</p>
                  <Input
                    disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                    type="file"
                    multiple
                    accept=".pdf,.xlsx,.xls,image/*"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setEvidenceFiles(prev => [...prev, ...files]);
                    }}
                    className="h-8 text-xs"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">Imágenes max 2MB. Otros archivos max 10MB.</p>
                  {evidenceFiles.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {evidenceFiles.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                          {file.type.startsWith('image/') ? (
                            <img src={URL.createObjectURL(file)} alt={file.name} className="size-8 rounded object-cover border border-border/50" />
                          ) : (
                            <FileText className="size-4 text-primary shrink-0" />
                          )}
                          <span className="text-[10px] font-bold text-foreground truncate flex-1">{file.name}</span>
                          <span className="text-[9px] text-muted-foreground shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                          <Button variant="ghost" size="icon" className="size-6 shrink-0 text-rose-500 hover:bg-rose-500/10" onClick={() => setEvidenceFiles(prev => prev.filter((_, j) => j !== i))}>
                            <X className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {evidenceFiles.length === 0 && localDoc.evidenceFileName && (
                    <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                      <FileText className="size-4 text-primary shrink-0" />
                      <span className="text-[10px] font-bold text-foreground truncate flex-1">{localDoc.evidenceFileName}</span>
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
                  <span className="font-bold tabular-nums">{localDoc.currency === 'USD' ? '$' : 'C$'} {Number(localDoc.subtotal||0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">IVA</span>
                  <span className="font-bold tabular-nums text-rose-500">{localDoc.currency === 'USD' ? '$' : 'C$'} {Number(localDoc.taxAmount||0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Retenciones</span>
                  <span className="font-bold tabular-nums text-amber-500">-{localDoc.currency === 'USD' ? '$' : 'C$'} {Number(localDoc.withholdingTotal||0).toLocaleString()}</span>
                </div>
                <div className="border-t pt-3 border-border/50">
                  <p className="text-[10px] text-muted-foreground mb-2 font-bold uppercase tracking-widest">Impuestos por línea</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>IVA calculado por producto según tipo fiscal (Gravado/Exento/No Gravado)</p>
                    <p>Retenciones calculadas por producto según tipo de retención</p>
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
              {((isNew && canPerform('PURCHASES_ORDERS', 'create')) || (!isNew && canPerform('PURCHASES_ORDERS', 'edit'))) && (
                  <Button variant="outline" size="sm" onClick={() => {
                  const isServiceOrder = localDoc.purchaseType === 'SERVICE';
                  const newItems = [...(localDoc.items || []), { id: `new-${Date.now()}`, productId: '', code: '', name: '', category: '', stockApplies: isServiceOrder ? false : false, stock: undefined, currentStock: 0, quantity: 1, unitPrice: 0, taxType: 'GRAVADO', taxRate: 15, taxBase: 0, taxAmount: 0, withholdingType: 'NONE', withholdingRate: 0, withholdingBase: 0, accountId: '', total: 0 }];
                  setLocalDoc({ ...localDoc, items: newItems as any });
                }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                  <Plus className="size-3 mr-2" /> Agregar Item
                </Button>
              )}
            </div>
            
            <div className="space-y-3">
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} className="group relative rounded-2xl border border-border/40 bg-background/60 backdrop-blur-sm p-4 space-y-3 hover:border-primary/30 hover:shadow-md transition-all duration-200">
                  {/* Header row: product selector + delete */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1.5">
                        Vincular producto del inventario
                        {item.productId && (
                          <span className="ml-2 inline-flex items-center gap-1 text-primary font-black">
                            <span className="size-1.5 rounded-full bg-primary inline-block" />
                            Vinculado
                          </span>
                        )}
                      </p>
                      <Combobox
                        disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                        options={[
                          { label: 'Sin vincular (ítem manual)', value: '__none__', description: 'Ingresar datos manualmente' },
                          ...products.filter(Boolean).map((p: any) => ({
                            label: p.name || 'Producto',
                            value: String(p.id),
                            description: `${p.code || p.sku || 'SIN-COD'} · ${p.category?.name || p.category || 'Sin categoría'}`,
                          }))
                        ]}
                        value={item.productId ? String(item.productId) : '__none__'}
                        onChange={(val) => {
                          if (val === '__none__' || !val) {
                            handleItemChange(idx, 'productId', '');
                          } else {
                            handleSelectExistingProduct(idx, val);
                          }
                        }}
                        placeholder="Buscar producto por nombre, código o categoría..."
                      />
                    </div>
                    {((isNew && canPerform('PURCHASES_ORDERS', 'create')) || (!isNew && canPerform('PURCHASES_ORDERS', 'edit'))) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground/40 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                        onClick={() => handleDeleteItem(idx)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Fields grid */}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Código</p>
                      <Input
                        disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                        value={item.code || ''}
                        onChange={(e) => handleItemChange(idx, 'code', e.target.value)}
                        className="h-8 text-xs font-mono"
                        placeholder="Código"
                      />
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Nombre</p>
                      <Input
                        disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                        value={item.name || ''}
                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                        className="h-8 text-xs"
                        placeholder={localDoc.purchaseType === 'SERVICE' ? 'Servicio' : 'Producto'}
                      />
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Categoría</p>
                      <Input
                        disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                        value={item.category || ''}
                        onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                        className="h-8 text-xs"
                        placeholder="Categoría"
                      />
                    </div>
                    <div className="col-span-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Stock actual</p>
                      <div className="h-8 flex items-center">
                        {item.currentStock !== undefined ? (
                          <span className="text-xs font-black text-primary tabular-nums">{Number(item.currentStock).toLocaleString()}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Cant.</p>
                      <Input
                        disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                        type="number"
                        min="0"
                        value={item.quantity === 0 ? '' : item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="h-8 text-xs text-right"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Precio</p>
                      <Input
                        disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                        type="number"
                        min="0"
                        value={item.unitPrice === 0 ? '' : item.unitPrice}
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                        className="h-8 text-xs text-right"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Tipo IVA</p>
                      <select
                        disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                        value={item.taxType || 'GRAVADO'}
                        onChange={(e) => handleItemChange(idx, 'taxType', e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-background px-1 text-[10px] font-bold"
                      >
                        <option value="GRAVADO">Gravado</option>
                        <option value="EXENTO">Exento</option>
                        <option value="NO_GRAVADO">No Gravado</option>
                      </select>
                    </div>
                    <div className="col-span-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Retención</p>
                      <select
                        disabled={isNew ? !canPerform('PURCHASES_ORDERS', 'create') : !canPerform('PURCHASES_ORDERS', 'edit')}
                        value={item.withholdingType || 'NONE'}
                        onChange={(e) => handleItemChange(idx, 'withholdingType', e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-background px-1 text-[10px] font-bold"
                      >
                        <option value="NONE">Sin retención</option>
                        <option value="IR_1">IR 1%</option>
                        <option value="IR_2">IR 2%</option>
                        <option value="IR_5">IR 5%</option>
                        <option value="IR_10">IR 10%</option>
                        <option value="IR_15">IR 15%</option>
                        <option value="IR_20">IR 20%</option>
                        <option value="IR_25">IR 25%</option>
                        <option value="IVA_1">IVA 1%</option>
                        <option value="IVA_2">IVA 2%</option>
                        <option value="IVA_3">IVA 3%</option>
                      </select>
                    </div>
                  </div>

                  {/* Subtotal + tax info footer */}
                  <div className="flex items-center justify-end gap-4 pt-1 border-t border-border/30">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Subtotal</span>
                    <span className="text-sm font-black tabular-nums">
                      {localDoc.currency === 'USD' ? '$' : 'C$'} {Number(item.quantity * item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {item.taxType === 'GRAVADO' && (
                      <>
                        <span className="text-[9px] font-black uppercase tracking-widest text-rose-500/60">IVA</span>
                        <span className="text-xs font-black tabular-nums text-rose-500">
                          {localDoc.currency === 'USD' ? '$' : 'C$'} {Number((Number(item.quantity||0) * Number(item.unitPrice||0)) * (Number(item.taxRate||15) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </>
                    )}
                    {item.withholdingType !== 'NONE' && (
                      <>
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-500/60">Ret.</span>
                        <span className="text-xs font-black tabular-nums text-amber-500">
                          -{localDoc.currency === 'USD' ? '$' : 'C$'} {Number((Number(item.quantity||0) * Number(item.unitPrice||0)) * (Number(item.withholdingRate||0) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </>
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
    { title: 'Total Ordenes',   value: data.length,                                                                     icon: ClipboardList, color: 'text-blue-500',    bg: 'bg-blue-500/10',    filter: 'ALL' },
    { title: 'Por Aprobar',     value: data.filter(o => (o.status||'').toUpperCase() === 'PENDING').length,                 icon: Clock,         color: 'text-amber-500',  bg: 'bg-amber-500/10',    filter: 'PENDING' },
    { title: 'Aprobadas',       value: data.filter(o => (o.status||'').toUpperCase() === 'APPROVED').length,             icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10',  filter: 'APPROVED' },
    {
      title: `Monto Total (${displayCurrency})`,
      value: `${displayCurrency === 'USD' ? '$' : 'C$'} ${totalAmountInDisplayCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: TrendingDown,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <button key={i} type="button" onClick={() => setStatusFilter(k.filter)}
            className={cn('rounded-xl border p-4 text-left transition-all', statusFilter === k.filter ? 'border-primary bg-primary/5' : 'border-border/50 bg-card hover:bg-muted/50 shadow-sm')}>
            <div className={cn('p-3 rounded-xl inline-flex mb-3', k.bg, k.color)}><k.icon className="size-5" /></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{k.title}</p>
            <p className="text-2xl font-black tabular-nums mt-0.5">{k.value}</p>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight">Órdenes de Compra</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Pedidos a proveedores</p></div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 min-w-0"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-full sm:w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            {canPerform('PURCHASES_ORDERS', 'create') && (
              <Button onClick={() => setEditingId('NEW')} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nueva Orden</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading}
          onBulkDelete={canPerform('PURCHASES_ORDERS', 'delete') ? async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await purchaseOrdersService.cancel(id as string, 'Anulación masiva');
              }
              toast.success('Órdenes anuladas');
              onRefresh();
            } catch (e: any) {
              toast.error(e?.response?.data?.message || e?.message || 'Error al anular');
            }
          } : undefined}
          actions={(row) => (
            <div className="flex gap-1">
              <Button
                title="Convertir a Factura"
                variant="ghost"
                size="icon"
                disabled={String(row.status || '').toUpperCase() === 'RECEIVED' || supplierInvoices.some((inv) => inv.purchaseOrderId === row.id)}
                className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500 disabled:opacity-50"
                onClick={() => handleConvertToInvoice(row)}
              >
                <FileInput className="size-4" />
              </Button>
              <Button title={canPerform('PURCHASES_ORDERS', 'edit') ? "Editar" : "Ver"} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
              <PurchaseAuditButton entity="PURCHASE_ORDER" entityId={row.id} title="Auditoria de la Orden" />
              {canPerform('PURCHASES_ORDERS', 'delete') && (
                <Button title="Anular" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => { setPendingCancelId(row.id); setCancelReason(''); }}><Trash2 className="size-4" /></Button>
              )}
            </div>
          )}
        />
        <ConfirmDialog
          open={!!pendingCancelId}
          onOpenChange={(open) => { if (!open) { setPendingCancelId(null); setCancelReason(''); } }}
          title="Anular Orden de Compra"
          description="La orden quedará cancelada. No se podrá recibir ni facturar. Esta acción no se puede deshacer."
          confirmLabel="Anular Orden"
          variant="destructive"
          loading={cancelLoading}
          disabled={!cancelReason.trim()}
          onConfirm={handleCancelConfirm}
        >
          <div className="mt-4">
            <label className="text-sm font-medium text-foreground mb-1 block">Motivo de anulación *</label>
            <textarea
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              rows={3}
              placeholder="Ej: Cancelada por el proveedor, error en productos..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
        </ConfirmDialog>
      </div>
    </div>
  );
}
