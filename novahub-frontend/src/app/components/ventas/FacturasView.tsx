import { useState, useEffect } from 'react';
import {
  FileText, Plus, Search, TrendingUp, CheckCircle2, AlertCircle, Eye, Trash2, ChevronLeft, FileDown, History, FilePlus, PlusCircle
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { invoicesService, paymentsService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import type { Invoice, Customer, Product } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { generateEstimatePDF } from '../../utils/pdfGenerator';
import { AuditHistoryModal } from '../ui/AuditHistoryModal';

interface FacturasViewProps {
  data: Invoice[];
  loading: boolean;
  onRefresh: () => void;
  customers?: Customer[];
  products?: Product[];
  series?: any[];
  warehouses?: any[];
  employees?: any[];
  invoiceDraft?: any;
  onClearInvoiceDraft?: () => void;
}

// Todos los estados posibles (para visualización en badges)
const statusOptions = [
  { label: 'Borrador', value: 'DRAFT', color: 'bg-slate-500/10 text-slate-500' },
  { label: 'Pendiente', value: 'PENDING', color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Pagada', value: 'PAID', color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Cancelada', value: 'CANCELLED', color: 'bg-rose-500/10 text-rose-500' },
  { label: 'Vencida', value: 'OVERDUE', color: 'bg-orange-500/10 text-orange-500' },
  { label: 'Parcial', value: 'PARTIAL', color: 'bg-blue-500/10 text-blue-500' },
];

// Solo los estados que el usuario puede asignar manualmente (PARTIAL es auto-gestionado por pagos)
const editableStatusOptions = [
  { label: 'Borrador', value: 'DRAFT', color: 'bg-slate-500/10 text-slate-500' },
  { label: 'Pendiente', value: 'PENDING', color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Pagada', value: 'PAID', color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Vencida', value: 'OVERDUE', color: 'bg-orange-500/10 text-orange-500' },
  { label: 'Cancelada', value: 'CANCELLED', color: 'bg-rose-500/10 text-rose-500' },
];

export function FacturasView({ data, loading, onRefresh, customers = [], products = [], series = [], warehouses = [], employees = [], invoiceDraft, onClearInvoiceDraft }: FacturasViewProps) {
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const { themeConfig } = useTheme();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<any>(null);
  const [localRates, setLocalRates] = useState({ dRate: 0, tRate: 15 });
  const [isCreating, setIsCreating] = useState(false);
  const [auditInvoiceId, setAuditInvoiceId] = useState<string | null>(null);
  const [pendingPaidInvoice, setPendingPaidInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('TRANSFER');
  const [statusLoading, setStatusLoading] = useState(false);

  const isSerialTracked = (product: any) =>
    Boolean(
      product?.trackSerialNumbers ||
      product?.serialTracking ||
      product?.serialNumberTracking ||
      String(product?.trackingType || '').toUpperCase() === 'SERIAL',
    );

  const getAvailableSeriesForItem = (item: any) => {
    if (!item?.productId) return [];
    return series.filter((s: any) => {
      const sameProduct = s.productId === item.productId || s.product?.id === item.productId;
      if (!sameProduct) return false;
      if (item.warehouseId) {
        const serialWh = s.warehouseId || s.warehouse?.id;
        if (serialWh && serialWh !== item.warehouseId) return false;
      }
      const status = String(s.status || 'AVAILABLE').toUpperCase();
      return ['AVAILABLE', 'IN_STOCK', 'ACTIVE', ''].includes(status);
    });
  };

  // Helper para mostrar la fecha sin desfase de zona horaria (UTC-local)
  const formatDateSafe = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const [y, m, d] = clean.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return new Date(y, m - 1, d).toLocaleDateString();
  };

  useEffect(() => {
    if (invoiceDraft) {
      setIsCreating(true);
      setEditingId(null);
      setLocalDoc(JSON.parse(JSON.stringify(invoiceDraft)));

      const sub = Number(invoiceDraft.subtotal || 0);
      if (sub > 0) {
        const dRate = (Number(invoiceDraft.discountAmount || 0) / sub) * 100;
        const base = sub - Number(invoiceDraft.discountAmount || 0);
        const tRate = base > 0 ? (Number(invoiceDraft.taxAmount || 0) / base) * 100 : 0;
        setLocalRates({ dRate: Math.round(dRate * 100) / 100, tRate: Math.round(tRate * 100) / 100 });
      } else {
        setLocalRates({ dRate: 0, tRate: 15 });
      }

      if (onClearInvoiceDraft) {
        setTimeout(() => onClearInvoiceDraft(), 0);
      }
    } else if (editingId) {
      const inv = data.find(x => x.id === editingId);
      if (inv) {
        setLocalDoc(JSON.parse(JSON.stringify(inv)));
        const sub = Number(inv.subtotal || 0);
        if (sub > 0) {
          const dRate = (Number(inv.discountAmount || 0) / sub) * 100;
          const base = sub - Number(inv.discountAmount || 0);
          const tRate = base > 0 ? (Number(inv.taxAmount || 0) / base) * 100 : 0;
          setLocalRates({ dRate: Math.round(dRate * 100) / 100, tRate: Math.round(tRate * 100) / 100 });
        }
      }
    } else if (!isCreating) {
      setLocalDoc(null);
    }
  }, [editingId, invoiceDraft]);

  const handleUpdate = async (id: string | number, updates: Partial<Invoice>) => {
    try {
      await invoicesService.update(id.toString(), updates);
      toast.success('Factura actualizada');
      onRefresh();
    } catch (error) {
      toast.error('Error al actualizar');
      throw error;
    }
  };

  const handleStatusChange = async (newStatus: string, invoiceId?: string, currentInvoiceData?: Invoice) => {
    const targetId = invoiceId || localDoc?.id;
    const targetDoc = currentInvoiceData || data.find(i => i.id === targetId) || localDoc;
    if (!targetId || !targetDoc) return;

    const upperStatus = newStatus.toUpperCase();
    const statusLabel = statusOptions.find(o => o.value === upperStatus)?.label || newStatus;

    // Si el nuevo estado es PAGADA, abrimos el diálogo de método de pago
    if (upperStatus === 'PAID') {
      setPendingPaidInvoice(targetDoc);
      return;
    }

    try {
      // DRAFT, PENDING, CANCELLED, OVERDUE, REFUNDED: enviar SOLO el campo status
      await invoicesService.update(targetId.toString(), { status: upperStatus } as any);
      
      // Sincronizar UI local
      if (localDoc && localDoc.id === targetId) {
        setLocalDoc({ ...localDoc, status: upperStatus });
      }

      toast.success(`Estado actualizado: ${statusLabel}`);
      onRefresh();
    } catch (e: any) {
      console.error('Error in status transition:', e);
      const msg = e.response?.data?.message || e.message || '';
      toast.error(`Error al cambiar a ${statusLabel}: ${Array.isArray(msg) ? msg[0] : msg}`);
    }
  };

  const processPaidStatus = async () => {
    if (!pendingPaidInvoice) return;
    try {
      setStatusLoading(true);
      await paymentsService.create({ 
        customerId: pendingPaidInvoice.customerId, 
        invoiceId: pendingPaidInvoice.id, 
        date: new Date().toISOString(), 
        amount: Number(pendingPaidInvoice.total), 
        currency: pendingPaidInvoice.currency, 
        exchangeRate: pendingPaidInvoice.exchangeRate || globalRate, 
        method: paymentMethod, 
        notes: `Cobro automático (${paymentMethod === 'CASH' ? 'Efectivo' : 'Transferencia'}) - Factura ${pendingPaidInvoice.number}` 
      } as any);

      toast.success(`Factura ${pendingPaidInvoice.number} marcada como pagada`);
      setPendingPaidInvoice(null);
      onRefresh();
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || '';
      toast.error(`Error al procesar pago: ${Array.isArray(msg) ? msg[0] : msg}`);
    } finally {
      setStatusLoading(false);
    }
  };

  const startNewInvoice = () => {
    setIsCreating(true);
    setEditingId(null);
    setLocalDoc({
      customerId: '',
      number: `FAC-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      currency: displayCurrency as any,
      exchangeRate: globalRate,
      items: [],
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      total: 0,
      notes: '',
      sellerEmployeeId: '',
      commissionRate: 0,
    });
    setLocalRates({ dRate: 0, tRate: 15 });
  };

  const handleSaveInvoice = async (emitir = false) => {
    if (!localDoc) return;
    if (!localDoc.customerId) {
      toast.error('Selecciona un cliente');
      return;
    }
    if (!localDoc.items || localDoc.items.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }
    const serialRows = (localDoc.items || []).filter((item: any) => {
      const p = products.find((x: any) => x.id === item.productId);
      return isSerialTracked(p);
    });
    const seenSerials = new Set<string>();
    for (const row of serialRows) {
      if (!row.warehouseId) {
        toast.error('Selecciona almacén origen para cada producto serializado');
        return;
      }
      const serialNumbers = (row.serialNumbers || []).map((n: string) => String(n || '').trim()).filter(Boolean);
      const unique = new Set(serialNumbers);
      if (serialNumbers.length !== unique.size) {
        toast.error('Hay IMEI repetidos en la misma línea');
        return;
      }
      if (Number(row.quantity || 0) !== serialNumbers.length) {
        toast.error('La cantidad debe coincidir con los IMEI seleccionados');
        return;
      }
      const available = getAvailableSeriesForItem(row).map((s: any) => String(s.number || '').trim());
      for (const serial of serialNumbers) {
        if (seenSerials.has(serial)) {
          toast.error(`El IMEI ${serial} está repetido en más de una línea`);
          return;
        }
        seenSerials.add(serial);
        if (available.length > 0 && !available.includes(serial)) {
          toast.error(`El IMEI ${serial} no está disponible para el producto/almacén seleccionado`);
          return;
        }
      }
    }

    const serialNotes = serialRows.length > 0
      ? `\n[SERIALES]\n${serialRows.map((row: any) => {
          const prod = products.find((p: any) => p.id === row.productId);
          const wh = warehouses.find((w: any) => w.id === row.warehouseId);
          return `${prod?.code || row.productId} (${wh?.name || 'Sin almacén'}): ${(row.serialNumbers || []).join(', ')}`;
        }).join('\n')}`
      : '';

    const baseNotes = String(localDoc.notes || '').split('\n[SERIALES]\n')[0];
    const finalNotes = `${baseNotes}${serialNotes}`.trim();

    try {
      if (isCreating) {
        await invoicesService.create({
          customerId: localDoc.customerId,
          number: localDoc.number,
          date: new Date(localDoc.date).toISOString(),
          dueDate: new Date(localDoc.dueDate).toISOString(),
          currency: localDoc.currency,
          exchangeRate: Number(localDoc.exchangeRate || globalRate),
          items: localDoc.items.map((item: any) => ({
            productId: item.productId || undefined,
            description: item.description || '',
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            taxRate: Number(item.taxRate || 0),
            discount: Number(item.discount || 0),
            total: Number(item.total || 0),
          })),
          subtotal: Number(localDoc.subtotal || 0),
          taxAmount: Number(localDoc.taxAmount || 0),
          discountAmount: Number(localDoc.discountAmount || 0),
          total: Number(localDoc.total || 0),
          status: emitir ? 'PENDING' : 'DRAFT',
          notes: finalNotes,
          salesOrderId: localDoc.salesOrderId || undefined,
          sellerEmployeeId: localDoc.sellerEmployeeId || undefined,
          commissionRate: localDoc.commissionRate || undefined,
        } as any);
        toast.success(emitir ? 'Factura emitida exitosamente' : 'Factura guardada como borrador');
      } else {
        await handleUpdate(localDoc.id, {
          ...localDoc,
          items: localDoc.items,
          notes: finalNotes,
          status: emitir ? 'PENDING' : localDoc.status,
        });
      }
      setIsCreating(false);
      setEditingId(null);
      setLocalDoc(null);
      onRefresh();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      toast.error(`Error al guardar: ${Array.isArray(msg) ? msg.join(', ') : (msg || e.message)}`);
    }
  };

  const recalcTotals = (items: any[], dRate: number, tRate: number) => {
    const subtotal = items.reduce((acc: number, it: any) => acc + Number(it.total || 0), 0);
    const discountAmount = subtotal * (dRate / 100);
    const base = subtotal - discountAmount;
    const taxAmount = base * (tRate / 100);
    const total = base + taxAmount;
    return { subtotal, discountAmount, taxAmount, total };
  };



  const columns: ColumnDef<Invoice>[] = [
    {
      key: 'number',
      header: 'Nº Factura',
      width: '140px',
      render: (val, row) => <span className="text-xs font-black font-mono text-primary cursor-pointer hover:underline" onClick={() => setEditingId(row.id)}>{val}</span>
    },
    {
      key: 'customer',
      header: 'Cliente',
      render: (_val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Varios'}</span>
    },
    {
      key: 'date',
      header: 'Fecha Emisión',
      render: (val) => <span className="text-xs font-medium text-muted-foreground">{formatDateSafe(val)}</span>
    },
    {
      key: 'dueDate',
      header: 'Vencimiento',
      render: (val, row) => (
        <span className={cn(
          "text-xs font-bold",
          (row.status || '').toUpperCase() === 'OVERDUE' ? 'text-rose-500' : 'text-muted-foreground'
        )}>
          {new Date(val).toLocaleDateString()}
        </span>
      )
    },
    {
      key: 'total',
      header: 'Total Neto',
      width: '150px',
      render: (val, row) => (
        <span className="text-[13px] font-black tabular-nums text-foreground">
          {formatConvertedAmount(Number(val || 0), row.currency, row.exchangeRate)}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Estado',
      width: '130px',
      editable: canPerform('SALES_INVOICES', 'edit'),
      type: 'select',
      options: editableStatusOptions,
      render: (val) => {
        const opt = statusOptions.find(o => o.value === (val || '').toUpperCase());
        return (
          <Badge variant="outline" className={cn(
            "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none",
            opt?.color || 'bg-muted/20 text-muted-foreground'
          )}>
            {opt?.label || val}
          </Badge>
        );
      }
    }
  ];

  const totalBilledInDisplayCurrency = data.reduce(
    (acc, invoice) => acc + convertAmount(invoice.total || 0, invoice.currency, invoice.exchangeRate),
    0,
  );
  const accountsReceivableInDisplayCurrency = data
    .filter(invoice => ['PENDING', 'OVERDUE', 'PARTIAL'].includes((invoice.status || '').toUpperCase()))
    .reduce((acc, invoice) => acc + convertAmount(invoice.total || 0, invoice.currency, invoice.exchangeRate), 0);
  const paidInDisplayCurrency = data
    .filter(invoice => (invoice.status || '').toUpperCase() === 'PAID')
    .reduce((acc, invoice) => acc + convertAmount(invoice.total || 0, invoice.currency, invoice.exchangeRate), 0);

  const kpis = [
    {
      title: `Facturado Total (${displayCurrency})`,
      value: formatConvertedAmount(totalBilledInDisplayCurrency, displayCurrency),
      icon: FileText,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: `Por Cobrar (${displayCurrency})`,
      value: formatConvertedAmount(accountsReceivableInDisplayCurrency, displayCurrency),
      icon: TrendingUp,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
    { title: 'Vencidas', value: data.filter(f => (f.status || '').toUpperCase() === 'OVERDUE').length, icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    {
      title: `Cobrado (${displayCurrency})`,
      value: formatConvertedAmount(paidInDisplayCurrency, displayCurrency),
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
  ];

  // ─── INLINE EDITOR VIEW ────────────────────────────────────────────────
  if ((editingId || isCreating) && localDoc) {
    const statusOpt = statusOptions.find(o => o.value === (localDoc?.status || '').toUpperCase());
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { setEditingId(null); setIsCreating(false); setLocalDoc(null); }} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isCreating ? 'Nueva Factura' : `Factura ${localDoc?.number}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{isCreating ? 'Completar datos para crear factura' : 'Detalle de la factura'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {((isCreating && canPerform('SALES_INVOICES', 'create')) || (!isCreating && canPerform('SALES_INVOICES', 'edit'))) && (
              <>
                <Button variant="outline" className="rounded-xl border-border/50 font-black uppercase text-[10px] tracking-widest px-6"
                  onClick={() => handleSaveInvoice(false)}>
                  Guardar Borrador
                </Button>
                <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6"
                  onClick={() => handleSaveInvoice(true)}>
                  Emitir Factura
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Número</p>
                  <Input value={localDoc?.number || ''} onChange={(e) => setLocalDoc({ ...localDoc, number: e.target.value })} className="h-8 text-xs font-black uppercase" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  {isCreating ? (
                    <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-muted/20 text-muted-foreground">Nuevo</span>
                  ) : (
                    <select value={(localDoc?.status || '').toUpperCase()} onChange={(e) => handleStatusChange(e.target.value)} className={`h-8 rounded-md border border-input px-2 text-xs font-bold uppercase ${statusOpt?.color || 'bg-background'}`}>
                      {editableStatusOptions.map(o => ( <option key={o.value} value={o.value}>{o.label}</option> ))}
                    </select>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Cliente</p>
                  <Combobox
                    options={customers
                      .filter(c => (c.status || '').toUpperCase() === 'ACTIVE' || c.id === localDoc?.customerId)
                      .map(c => ({ label: c.name, value: c.id, description: (c.code ? `[${c.code}] ` : '') + (c.phone || 'Sin teléfono') }))}
                    value={localDoc?.customerId || ''}
                    onChange={(val) => { setLocalDoc({ ...localDoc, customerId: val }); if (!isCreating) handleUpdate(localDoc!.id, { customerId: val }); }}
                    placeholder="Seleccionar Cliente"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Emisión</p>
                  <Input type="date" value={localDoc?.date ? (typeof localDoc.date === 'string' && localDoc.date.includes('T') ? localDoc.date.split('T')[0] : localDoc.date) : ''}
                    onChange={(e) => setLocalDoc({ ...localDoc, date: e.target.value })} className="h-8 text-xs" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Vencimiento</p>
                  <Input type="date" value={localDoc?.dueDate ? (typeof localDoc.dueDate === 'string' && localDoc.dueDate.includes('T') ? localDoc.dueDate.split('T')[0] : localDoc.dueDate) : ''}
                    onChange={(e) => setLocalDoc({ ...localDoc, dueDate: e.target.value })} className="h-8 text-xs" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Vendedor (Opcional)</p>
                  <Combobox
                    options={(employees || []).filter(e => e.employmentStatus === 'ACTIVE' || e.id === localDoc?.sellerEmployeeId).map(e => ({ 
                      label: `${e.firstName} ${e.lastName}`, 
                      value: e.id, 
                      description: e.position?.title 
                    }))}
                    value={localDoc?.sellerEmployeeId || ''}
                    onChange={(val) => { setLocalDoc({ ...localDoc, sellerEmployeeId: val }); if (!isCreating) handleUpdate(localDoc!.id, { sellerEmployeeId: val }); }}
                    placeholder="Seleccionar Vendedor"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">% Comisión</p>
                  <Input type="number" min="0" max="100" value={localDoc?.commissionRate || ''} placeholder="0" 
                    onChange={(e) => { 
                      const val = Number(e.target.value); 
                      setLocalDoc({ ...localDoc, commissionRate: val }); 
                    }} 
                    onBlur={() => {
                        if (!isCreating) handleUpdate(localDoc!.id, { commissionRate: localDoc?.commissionRate });
                    }} 
                    className={cn("h-8 text-xs", !localDoc?.sellerEmployeeId && "opacity-50 cursor-not-allowed bg-muted/20")} disabled={!localDoc?.sellerEmployeeId} 
                  />
                  {!localDoc?.sellerEmployeeId && <p className="text-[9px] text-muted-foreground/60 mt-0.5 italic">Selecciona vendedor primero</p>}
                </div>
                  {/* Moneda se ajusta dinámicamente según la preferencia del topbar */}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen Financiero</p>
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <div className="flex items-center gap-2">{localDoc?.currency === 'USD' ? '$' : 'C$'} <Input type="number" min="0" value={Number(localDoc?.subtotal || 0)} readOnly className="w-28 h-8 text-right font-bold bg-muted/20" /></div>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 text-sm">
                  <span className="text-muted-foreground">Descuento</span>
                  <div className="flex items-center gap-2 text-rose-500">
                    <div className="flex items-center mr-2"><Input type="number" min="0" max="100" value={localRates.dRate || ''} placeholder="0" onChange={(e) => {
                      const newRate = Number(e.target.value); setLocalRates(p => ({ ...p, dRate: newRate }));
                      const calc = recalcTotals(localDoc?.items || [], newRate, localRates.tRate);
                      setLocalDoc({ ...localDoc, ...calc });
                    }} className="w-16 h-8 text-right font-bold text-rose-500 bg-transparent" /> <span className="ml-1 text-xs font-black">%</span></div>
                    -{localDoc?.currency === 'USD' ? '$' : 'C$'} {Number(localDoc?.discountAmount || 0).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 text-sm">
                  <span className="text-muted-foreground">IVA</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center mr-2"><Input type="number" min="0" max="100" value={localRates.tRate || ''} placeholder="0" onChange={(e) => {
                      const newRate = Number(e.target.value); setLocalRates(p => ({ ...p, tRate: newRate }));
                      const calc = recalcTotals(localDoc?.items || [], localRates.dRate, newRate);
                      setLocalDoc({ ...localDoc, ...calc });
                    }} className="w-16 h-8 text-right font-bold bg-transparent" /> <span className="ml-1 text-xs font-black">%</span></div>
                    {localDoc?.currency === 'USD' ? '$' : 'C$'} {Number(localDoc?.taxAmount || 0).toLocaleString()}
                  </div>
                </div>
                <div className="flex justify-between items-center text-base border-t pt-3 border-border/50">
                  <span className="font-black">Total</span>
                  <div className="flex flex-col items-end">
                    <span className="text-primary font-black text-lg">{localDoc?.currency === 'USD' ? '$' : 'C$'} {Number(localDoc?.total || 0).toLocaleString()}</span>
                    {localDoc?.currency === 'USD' && <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">≈ C$ {(Number(localDoc?.total || 0) * (localDoc?.exchangeRate || globalRate)).toLocaleString()}</p>}
                    {localDoc?.currency === 'NIO' && <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">≈ $ {(Number(localDoc?.total || 0) / (localDoc?.exchangeRate || globalRate)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items */}
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos / Servicios</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const newItems = [...(localDoc.items || []), { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, total: 0, productId: null, warehouseId: '', serialNumbers: [] }];
                  setLocalDoc({ ...localDoc, items: newItems });
                }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                  <PlusCircle className="size-3 mr-2" /> Agregar Item
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className="col-span-5">Descripción</div>
                <div className="col-span-2 text-right">Cant.</div>
                <div className="col-span-2 text-right">Precio U.</div>
                <div className="col-span-2 text-right">Total</div>
                <div className="col-span-1"></div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} className="flex flex-col md:grid md:grid-cols-12 gap-4 md:gap-2 items-start md:items-center p-4 md:p-0 border md:border-none rounded-2xl md:rounded-none bg-muted/5 md:bg-transparent relative group">
                  <div className="w-full md:col-span-5 space-y-1">
                    <label className="md:hidden text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Producto / Servicio</label>
                    <Combobox
                      options={products.map(p => ({ label: `${p.code} - ${p.name}`, value: p.id }))}
                      value={item.productId || ''}
                      onChange={(val) => {
                        const newItems = [...(localDoc.items || [])];
                        const selectedProd = products.find(p => p.id === val);
                        newItems[idx] = { ...newItems[idx], productId: val, warehouseId: '', serialNumbers: [] };
                        if (selectedProd) {
                          newItems[idx].description = selectedProd.name;
                          newItems[idx].unitPrice = Number(selectedProd.price || 0);
                          newItems[idx].total = Number(newItems[idx].quantity) * Number(newItems[idx].unitPrice);
                        }
                        const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                        setLocalDoc({ ...localDoc, items: newItems, ...calc });
                        if (!isCreating) {
                          handleUpdate(localDoc!.id, { items: newItems, ...calc });
                        }
                      }}
                      placeholder="Seleccionar Producto..."
                    />
                    {item.productId && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 px-1">
                        {(() => {
                          const p = products.find(x => x.id === item.productId);
                          if (!p) return null;
                          const stock = Number(p.stock || 0);
                          return (
                            <>
                              <Badge variant="outline" className={cn(
                                "text-[9px] font-black border-none px-1.5 py-0 h-4 bg-muted/20",
                                stock <= 0 ? "text-rose-500 bg-rose-500/10" : "text-emerald-500 bg-emerald-500/10"
                              )}>
                                STOCK: {stock}
                              </Badge>
                              <span className="text-[9px] font-bold text-muted-foreground/60 uppercase">
                                Costo: {formatConvertedAmount(Number(p.costPrice || 0))} | Venta: {formatConvertedAmount(Number(p.salePrice || 0))}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    )}
                    {item.productId && isSerialTracked(products.find(x => x.id === item.productId)) && (
                      <div className="mt-2 space-y-2 rounded-md border border-border/50 p-2 bg-muted/10 w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Almacén origen</p>
                            <Select
                              value={item.warehouseId || ''}
                              onValueChange={(val) => {
                                const newItems = [...(localDoc.items || [])];
                                newItems[idx] = { ...newItems[idx], warehouseId: val, serialNumbers: [] };
                                setLocalDoc({ ...localDoc, items: newItems });
                              }}
                            >
                              <SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="Seleccionar almacén" /></SelectTrigger>
                              <SelectContent>
                                {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">IMEI/Series (uno por línea)</p>
                            <textarea
                              value={(item.serialNumbers || []).join('\n')}
                              onChange={(e) => {
                                const serialNumbers = e.target.value
                                  .split('\n')
                                  .map((n) => n.trim())
                                  .filter(Boolean);
                                const newItems = [...(localDoc.items || [])];
                                newItems[idx] = {
                                  ...newItems[idx],
                                  serialNumbers,
                                  quantity: serialNumbers.length > 0 ? serialNumbers.length : Number(newItems[idx].quantity || 1),
                                  total: (serialNumbers.length > 0 ? serialNumbers.length : Number(newItems[idx].quantity || 1)) * Number(newItems[idx].unitPrice || 0),
                                };
                                const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                                setLocalDoc({ ...localDoc, items: newItems, ...calc });
                              }}
                              className="w-full h-20 rounded-md border border-input bg-background px-2 py-1 text-[10px] font-mono"
                              placeholder="Pega o escanea IMEI..."
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Disponibles: {getAvailableSeriesForItem(item).length} · Seleccionados: {(item.serialNumbers || []).length}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 w-full md:contents">
                    <div className="flex-1 md:col-span-2 space-y-1">
                      <label className="md:hidden text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Cant.</label>
                      <Input type="number" min="0" max={Number(products.find(x => x.id === item.productId)?.stock || 1000000)} value={Number(item.quantity) || ''} placeholder="0"
                        onChange={(e) => {
                          let newQty = Number(e.target.value);
                          const p = products.find(x => x.id === item.productId);
                          if (p && newQty > Number(p.stock || 0)) {
                            toast.warning(`Stock insuficiente. Disponible: ${p.stock}`, { id: `stock-warn-${idx}` });
                            newQty = Number(p.stock || 0);
                          }
                          const newItems = [...(localDoc.items || [])];
                          newItems[idx] = { ...newItems[idx], quantity: newQty, total: newQty * Number(newItems[idx].unitPrice || 0) };
                          const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                          setLocalDoc({ ...localDoc, items: newItems, ...calc });
                        }} onBlur={() => {
                          if (!isCreating) {
                            const calc = recalcTotals(localDoc.items || [], localRates.dRate, localRates.tRate);
                            handleUpdate(localDoc!.id, { items: localDoc.items, ...calc });
                          }
                        }} className="h-9 md:h-8 text-xs md:text-right font-bold" disabled={item.productId && isSerialTracked(products.find(x => x.id === item.productId))} />
                    </div>
                    <div className="flex-1 md:col-span-2 space-y-1">
                      <label className="md:hidden text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Precio U.</label>
                      <Input type="number" min="0" value={Number(item.unitPrice) || ''} placeholder="0"
                        onChange={(e) => {
                          const newItems = [...(localDoc.items || [])];
                          newItems[idx] = { ...newItems[idx], unitPrice: Number(e.target.value), total: Number(newItems[idx].quantity || 1) * Number(e.target.value) };
                          const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                          setLocalDoc({ ...localDoc, items: newItems, ...calc });
                        }} onBlur={() => {
                          if (!isCreating) {
                            const calc = recalcTotals(localDoc.items || [], localRates.dRate, localRates.tRate);
                            handleUpdate(localDoc!.id, { items: localDoc.items, ...calc });
                          }
                        }} className="h-9 md:h-8 text-xs md:text-right font-bold" />
                    </div>
                  </div>

                  <div className="w-full md:col-span-2 flex items-center justify-between md:justify-end gap-2 border-t md:border-none pt-3 md:pt-0 mt-2 md:mt-0">
                    <div className="md:hidden">
                       <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 leading-none mb-1">Total Item</p>
                       <p className="text-sm font-black text-primary">{localDoc?.currency === 'USD' ? '$' : 'C$'}{Number(item.total || 0).toLocaleString()}</p>
                    </div>
                    <span className="hidden md:block text-xs font-black w-24 text-right tabular-nums">
                      {localDoc?.currency === 'USD' ? '$' : 'C$'} {Number(item.total || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="absolute top-2 right-2 md:relative md:top-0 md:right-0 md:col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" className="size-8 md:size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-lg md:rounded-md" onClick={() => {
                      const newItems = [...(localDoc.items || [])]; newItems.splice(idx, 1);
                      const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                      setLocalDoc({ ...localDoc, items: newItems, ...calc });
                    }}><Trash2 className="size-4 md:size-3" /></Button>
                  </div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && (
                <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">
                  No hay productos asignados. Haz clic en "Agregar Item".
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Notas</p>
            <textarea value={localDoc?.notes || ''} onChange={(e) => setLocalDoc({ ...localDoc, notes: e.target.value })}
              className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" placeholder="Agregar notas..." />
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
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-xl shadow-inner", kpi.bg, kpi.color)}>
                  <kpi.icon className="size-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p>
                  <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{kpi.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Control de Facturación</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Gestión de recaudos masivos sin fricción.</p>
          </div>
          <div className="flex items-center gap-3">
            {canPerform('SALES_INVOICES', 'create') && (
              <Button onClick={startNewInvoice} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
                <FilePlus className="size-4" /> Nueva Factura
              </Button>
            )}
          </div>
        </div>

        <EditableDataTable
          data={data}
        columns={columns}
        allowAddRow={false}
        onRowUpdate={async (id, updates) => {
          if (updates.status) {
            const row = data.find(r => r.id === id);
            await handleStatusChange(updates.status, id.toString(), row);
          } else {
            await handleUpdate(id, updates);
          }
        }}
        onBulkDelete={async (ids) => {
            await Promise.all(ids.map(id => invoicesService.delete(id.toString())));
            toast.success(`${ids.length} Facturas eliminadas`);
            onRefresh();
          }}
          isLoading={loading}
          bulkActions={() => null}
          actions={(row) => (
              <div className="flex items-center gap-1">
                <Button title="Exportar PDF" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-slate-500/10 hover:text-slate-500 transition-colors" onClick={async () => { 
                  try { 
                    toast.promise(generateEstimatePDF({ 
                      estimate: row, 
                      tenantName: user?.tenantName || 'Empresa', 
                      formatAmount: formatConvertedAmount as any, 
                      tenantLogo: themeConfig?.logo, 
                      documentType: 'invoice' as any,
                      primaryColor: themeConfig?.colors.primary 
                    }), { 
                      loading: 'Generando PDF...', 
                      success: 'PDF generado exitosamente', 
                      error: 'Error al generar PDF' 
                    }); 
                  } catch(e) { console.error(e) } 
                }}><FileDown className="size-4" /></Button>
                <Button title="Ver Historial" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-amber-500/10 hover:text-amber-500 transition-colors" onClick={() => setAuditInvoiceId(row.id)}><History className="size-4" /></Button>
                <Button title="Ver detalle" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
                {canPerform('SALES_INVOICES', 'delete') && (
                  <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
                )}
              </div>
          )}
        />
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title={"¿Eliminar factura?"}
        description="¿Estás seguro de que deseas eliminar esta factura? Si tiene pagos registrados o notas de crédito, no se podrá eliminar."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          try {
            setDeleteLoading(true);
            await invoicesService.delete(pendingDeleteId);
            toast.success('Factura eliminada');
            setEditingId(null);
            setIsCreating(false);
            onRefresh();
          } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || '';
            if (msg.includes('foreign') || msg.includes('constraint') || msg.includes('reference') || error?.status === 409) {
              toast.error('No se puede eliminar: esta factura tiene pagos o notas de crédito vinculadas.');
            } else {
              toast.error(`Error al eliminar: ${msg || 'Error desconocido'}`);
            }
          } finally {
            setDeleteLoading(false);
            setPendingDeleteId(null);
          }
        }}
      />

      <AuditHistoryModal
        isOpen={!!auditInvoiceId}
        onClose={() => setAuditInvoiceId(null)}
        entity="INVOICE"
        entityId={auditInvoiceId || ''}
        title="Historial de la Factura"
      />
      <ConfirmDialog
        open={pendingPaidInvoice !== null}
        onOpenChange={(open) => { if (!open) setPendingPaidInvoice(null); }}
        title={"Confirmar Pago de Factura"}
        description={`Selecciona cómo se recibió el pago de la factura ${pendingPaidInvoice?.number}.`}
        confirmLabel="Marcar como Pagada"
        variant="default"
        loading={statusLoading}
        onConfirm={processPaidStatus}
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
              <History className="size-5" />
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

