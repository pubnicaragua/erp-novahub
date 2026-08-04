import { useState, useEffect } from 'react';
import { 
  FileOutput, Plus, Search, Clock, CheckCircle2, XCircle, Eye, Trash2, ChevronLeft, ShieldCheck, FileDown
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { salesReturnsService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import type { SalesReturn, Customer, Invoice, Product, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { generateEstimatePDF } from '../../utils/pdfGenerator';
import { AccountingAccountSelect } from '../ui/AccountingAccountSelect';
import { PriceMissingBadge, SalesLinePriceListSelect } from './SalesLinePriceListSelect';
import { formatSalesAmount, getMissingSalesPriceMessage } from '../../utils/salesPriceList';
import { SalesIrSelector } from './SalesIrSelector';
import { SalesDateRangeFilter } from './SalesDateRangeFilter';
import { SalesViewTutorial } from './SalesViewTutorial';
import { SalesKpiCard } from './SalesKpiCard';

interface DevolucionesViewProps {
  data: SalesReturn[];
  loading: boolean;
  onRefresh: () => void;
  customers?: Customer[];
  invoices?: Invoice[];
  products?: Product[];
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateRangeChange?: (dateFrom: string, dateTo: string) => void;
}

const statusOptions = [
  { label: 'Pendiente',  value: 'PENDING',   color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Aprobada',   value: 'APPROVED',  color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Procesada',  value: 'PROCESSED', color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Rechazada',  value: 'REJECTED',  color: 'bg-rose-500/10 text-rose-500' },
];

export function DevolucionesView({ data, loading, onRefresh, customers = [], invoices = [], products = [], pagination, onSearchChange, dateFrom = '', dateTo = '', onDateRangeChange }: DevolucionesViewProps) {
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<any>(null);
  const productCatalog = products.filter((p) => p.itemType !== 'SERVICE');
  const serviceCatalog = products.filter((p) => p.itemType === 'SERVICE');
  const resolveItemType = (item: any) => item.itemType || (products.find((p) => p.id === item.productId)?.itemType === 'SERVICE' ? 'SERVICE' : 'PRODUCT');
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
    (statusFilter === 'ALL' || String(r.status || '').toUpperCase() === statusFilter) &&
    (r.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const startNew = () => {
    setIsCreating(true);
    setEditingId(null);
    setLocalDoc({
      customerId: '',
      invoiceId: '',
      date: new Date().toISOString().split('T')[0],
      reason: '',
      items: [],
      total: 0,
      currency: displayCurrency,
      exchangeRate: globalRate,
      accountId: '',
    });
  };

  const recalcTotal = (items: any[]) => items.reduce((acc: number, it: any) => { const gross = Number(it.quantity || 0) * Number(it.unitPrice || 0); const discount = gross * Number(it.discount || 0) / 100; const net = gross - discount; const tax = net * Number(it.taxRate || 0) / 100; const ir = net * Number(it.irRate || 0) / 100; return acc + net + tax - ir; }, 0);

  const handleSave = async () => {
    if (!localDoc) return;
    if (!localDoc.customerId) { toast.error('Selecciona un cliente'); return; }
    if (!localDoc.invoiceId) { toast.error('Selecciona la factura de origen'); return; }
    if (!localDoc.reason.trim()) { toast.error('Ingresa la razón de la devolución'); return; }
    if (!localDoc.accountId) { toast.error('Selecciona la cuenta contable de la devolución'); return; }
    const priceMessage = getMissingSalesPriceMessage(localDoc.items || []);
    if (priceMessage) { toast.error(priceMessage); return; }
    const saveToastId = toast.loading(isCreating ? 'Creando devolución...' : 'Guardando cambios...');
    try {
      if (isCreating) {
        await salesReturnsService.create({
          customerId: localDoc.customerId,
          invoiceId: localDoc.invoiceId,
          date: new Date(localDoc.date).toISOString(),
          reason: localDoc.reason.trim(),
          items: (localDoc.items || []).map((item: any) => ({
            productId: item.productId || undefined,
            description: item.description || '',
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            priceListId: item.priceListId || undefined,
            total: Number(item.total || 0),
          })),
          total: localDoc.total,
          status: 'PENDING',
          currency: localDoc.currency || displayCurrency,
          exchangeRate: localDoc.exchangeRate || globalRate,
          priceListId: localDoc.priceListId || undefined,
          accountId: localDoc.accountId,
        } as any);
        toast.success('Devolución registrada', { id: saveToastId });
      } else {
        await salesReturnsService.update(localDoc.id, localDoc);
      }
      setIsCreating(false); setEditingId(null); setLocalDoc(null); onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'No se pudo guardar', { id: saveToastId }); }
  };

  const handleExportPDF = async (row: SalesReturn) => {
    try {
      const tenantName = user?.tenantName || 'Mi Empresa';
      await generateEstimatePDF({
        estimate: { ...row, number: row.number, customer: row.customer },
        tenantName,
        formatAmount: formatConvertedAmount,
        documentType: 'return',
      });
      toast.success('PDF generado exitosamente');
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al generar PDF'); }
  };

  const handleApprove = async (id: string) => {
    try {
      await salesReturnsService.approve(id);
      toast.success('Devolución aprobada');
      onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al aprobar'); }
  };

  // Get invoices for selected customer
  const customerInvoices = localDoc?.customerId
    ? invoices.filter(i => i.customerId === localDoc.customerId)
    : [];

  const columns: ColumnDef<SalesReturn>[] = [
    { key: 'number', header: 'Nº Devolución', width: '140px',
      render: (val, row) => (
        <span 
          className={cn(
            "text-xs font-black font-mono text-primary",
            canPerform('SALES_RETURNS', 'edit') ? "cursor-pointer hover:underline" : "cursor-default"
          )} 
          onClick={() => canPerform('SALES_RETURNS', 'edit') && setEditingId(row.id)}
        >
          {val}
        </span>
      )
    },
    { key: 'customer', header: 'Cliente', render: (_, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Cliente'}</span> },
    { key: 'invoice', header: 'Factura Origen', render: (_, row) => <span className="text-xs font-bold text-blue-500">{row.invoice?.number || 'N/A'}</span> },
    { key: 'date', header: 'Fecha', render: (val) => <span className="text-xs font-medium text-muted-foreground">{new Date(val).toLocaleDateString()}</span> },
    { key: 'total', header: 'Total', width: '130px', render: (val, row) => <span className="text-[13px] font-black tabular-nums text-rose-500">{formatConvertedAmount(Number(val||0), (row as any).currency, (row as any).exchangeRate)}</span> },
    { key: 'status', header: 'Estado', width: '110px', render: (val) => {
      const opt = statusOptions.find(o => o.value === (val||'').toUpperCase());
      return <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none", opt?.color || 'bg-muted/20 text-muted-foreground')}>{opt?.label || val}</Badge>; } },
  ];

  const totalReturnedInDisplayCurrency = data.reduce(
    (acc, salesReturn) => acc + convertAmount(salesReturn.total || 0, (salesReturn as any).currency, (salesReturn as any).exchangeRate),
    0,
  );

  // ─── INLINE FORM ────────────────────────────────────────────────────
  if ((editingId || isCreating) && localDoc) {
    const statusOpt = statusOptions.find(o => o.value === (localDoc?.status || '').toUpperCase());
    const canApprove = !isCreating && (localDoc?.status || '').toUpperCase() === 'PENDING';
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { setEditingId(null); setIsCreating(false); setLocalDoc(null); }} className="rounded-full"><ChevronLeft className="size-5" /></Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isCreating ? 'Nueva Devolución' : `Devolución ${localDoc?.number}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{isCreating ? 'Registrar nueva devolución' : 'Detalle de la devolución'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canPerform('SALES_RETURNS', 'edit') && (
              <>
                {!isCreating && <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={async () => { await salesReturnsService.delete(localDoc.id); setEditingId(null); onRefresh(); }}><Trash2 className="size-3 mr-2" /> Eliminar</Button>}
                {canApprove && <Button variant="outline" className="rounded-xl border-emerald-500/50 text-emerald-500 hover:bg-emerald-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => { handleApprove(localDoc.id); setEditingId(null); }}><ShieldCheck className="size-3 mr-2" /> Aprobar Devolución</Button>}
                <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6" onClick={handleSave}>
                  {isCreating ? 'Registrar Devolución' : 'Guardar Cambios'}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-[10px] text-muted-foreground mb-1">Cliente</p>
                  <Combobox 
                    options={(customers || [])
                      .filter(c => (c.status || '').toUpperCase() === 'ACTIVE' || c.id === localDoc?.customerId)
                      .map(c => ({ label: c.name, value: c.id, description: (c.code ? `[${c.code}] ` : '') + (c.phone || 'Sin teléfono') }))} 
                    value={localDoc?.customerId || ''} 
                    onChange={(val) => { const customer = customers?.find((entry) => entry.id === val); const priceListId = customer?.priceListId || null; const items = (localDoc?.items || []).map((item: any) => item.productId ? { ...item, priceListId, unitPrice: 0, total: 0, priceMissing: false } : { ...item, priceListId }); setLocalDoc({ ...localDoc, customerId: val, priceListId, items, invoiceId: '' }); }}
                    placeholder="Seleccionar Cliente" 
                  /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Factura Origen</p>
                  <Combobox options={customerInvoices.map(i => ({ label: `${i.number} — ${formatConvertedAmount(Number(i.total||0), i.currency, i.exchangeRate)}`, value: i.id }))} value={localDoc?.invoiceId || ''} onChange={(val) => {
                    const inv = invoices.find(i => i.id === val);
                    setLocalDoc({
                      ...localDoc,
                      invoiceId: val,
                      currency: inv?.currency || localDoc?.currency || displayCurrency,
                      exchangeRate: inv?.exchangeRate || localDoc?.exchangeRate || globalRate,
                    });
                  }} placeholder="Seleccionar Factura" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Fecha</p>
                  <Input type="date" value={localDoc?.date ? (typeof localDoc.date === 'string' && localDoc.date.includes('T') ? localDoc.date.split('T')[0] : localDoc.date) : ''} onChange={(e) => setLocalDoc({ ...localDoc, date: e.target.value })} className="h-8 text-xs" /></div>
                {!isCreating && <div><p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${statusOpt?.color || 'bg-muted/20 text-muted-foreground'}`}>{statusOpt?.label || localDoc?.status}</span></div>}
              </div>
              <AccountingAccountSelect
                value={localDoc?.accountId || ''}
                onChange={(accountId) => setLocalDoc({ ...localDoc, accountId })}
                assetOnly
                label="Cuenta contable de la devolución"
                required
              />
              <div><p className="text-[10px] text-muted-foreground mb-1">Razón de la Devolución</p>
                <textarea value={localDoc?.reason || ''} onChange={(e) => setLocalDoc({ ...localDoc, reason: e.target.value })}
                  className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" placeholder="Describe el motivo de la devolución..." /></div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen</p>
              <div className="flex justify-between items-center text-base border-b pb-3 border-border/50">
                <span className="font-black">Total Devolución</span>
                <span className="text-rose-500 font-black text-lg">{formatConvertedAmount(Number(localDoc?.total||0), localDoc?.currency || displayCurrency, localDoc?.exchangeRate)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground italic">Al aprobar esta devolución, el estado cambiará a aprobado. Los ajustes contables deben realizarse mediante una Nota de Crédito manual.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos Devueltos</p>
              <div className="flex flex-wrap gap-2">
              {(['PRODUCT', 'SERVICE'] as const).map((itemType) => <Button key={itemType} type="button" variant="outline" size="sm" disabled={!localDoc?.customerId} onClick={() => {
                const newItems = [...(localDoc.items || []), { id: Date.now().toString(), itemType, productId: '', description: '', quantity: 1, unitPrice: 0, total: 0 }];
                setLocalDoc({ ...localDoc, items: newItems });
              }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl"><Plus className="size-3 mr-2" /> Agregar {itemType === 'PRODUCT' ? 'Producto' : 'Servicio'}</Button>)}
              </div>
            </div>
            <div className="space-y-2">
              <div className="hidden xl:grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className="col-span-4">Descripción</div><div className="col-span-2 text-right">Cant.</div><div className="col-span-2 text-right">Precio U.</div><div className="col-span-2 text-right">Total</div><div className="col-span-1"></div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} data-item-layout="standard" className="sales-item-row grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-border/50 bg-muted/5 p-3 items-start xl:grid-cols-12 xl:gap-2 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0">
                  <div className="col-span-5"><div className="flex min-w-0 items-center gap-2"><div className="min-w-0 flex-1"><Combobox options={(resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog).map(p => ({ label: `${resolveItemType(item) === 'SERVICE' ? 'Servicio' : 'Producto'} · ${p.code} - ${p.name}`, value: p.id }))} value={item.productId || ''}
                    onChange={(val) => { const ni = [...(localDoc.items || [])]; const prod = (resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog).find(p => p.id === val);
                    const unitPrice = Number(prod?.salePrice ?? prod?.price ?? 0);
                      ni[idx] = { ...ni[idx], productId: val, description: prod?.name || '', unitPrice, total: Number(ni[idx].quantity || 1) * unitPrice };
                    setLocalDoc({ ...localDoc, items: ni, total: recalcTotal(ni) }); }} placeholder={resolveItemType(item) === 'SERVICE' ? 'Seleccionar servicio...' : 'Seleccionar producto...'} /></div><SalesLinePriceListSelect productId={item.productId} productCode={(resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog).find((product) => product.id === item.productId)?.code || item.code} value={item.priceListId} defaultPriceListId={localDoc?.priceListId} currency={localDoc?.currency} exchangeRate={Number(localDoc?.exchangeRate || globalRate || 1)} onChange={(priceListId, result) => { const ni = [...(localDoc.items || [])] as any[]; ni[idx] = { ...ni[idx], priceListId, unitPrice: result.unitPrice || 0, priceMissing: result.priceMissing, total: Number(ni[idx].quantity || 1) * Number(result.unitPrice || 0) }; setLocalDoc({ ...localDoc, items: ni, total: recalcTotal(ni), priceListId }); }} /><SalesIrSelector value={item.irTaxId} rate={Number(item.irRate || 0)} compact onChange={(option) => { const next = [...(localDoc.items || [])] as any[]; next[idx] = { ...next[idx], irRate: Number(option?.rate || 0), irTaxId: option?.id || null }; setLocalDoc({ ...localDoc, items: next, total: recalcTotal(next) }); }} /></div></div>
                    {item.priceMissing && <PriceMissingBadge className="mt-1" />}
                  <div className="col-span-2"><Input type="number" min="0" value={Number(item.quantity) || ''} onChange={(e) => {
                    const ni = [...(localDoc.items || [])]; ni[idx] = { ...ni[idx], quantity: Number(e.target.value), total: Number(e.target.value) * Number(ni[idx].unitPrice || 0) };
                      setLocalDoc({ ...localDoc, items: ni, total: recalcTotal(ni) }); }} /></div>
                  <div className="col-span-2"><Input type="text" value={item.unitPrice === undefined || item.unitPrice === null ? '' : formatSalesAmount(item.unitPrice)} readOnly className="bg-muted/20 text-right" onChange={(e) => {
                    const ni = [...(localDoc.items || [])]; ni[idx] = { ...ni[idx], unitPrice: Number(e.target.value), total: Number(ni[idx].quantity || 1) * Number(e.target.value) };
                      setLocalDoc({ ...localDoc, items: ni, total: recalcTotal(ni) }); }} /></div>
                  <div className="col-span-2 text-right"><span className="text-xs font-black text-rose-500">{formatConvertedAmount(Number(item.total || 0), localDoc?.currency || displayCurrency, localDoc?.exchangeRate)}</span></div>
                  <div className="col-span-1 flex justify-end"><Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-md"
                    onClick={() => { const ni = [...(localDoc.items || [])]; ni.splice(idx, 1); setLocalDoc({ ...localDoc, items: ni, total: recalcTotal(ni) }); }}><Trash2 className="size-3" /></Button></div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">Sin productos devueltos. Haz clic en "Agregar Item".</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── TABLE VIEW ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="sales-list-kpis">
        <SalesKpiCard title="Total Devuelto" value={formatConvertedAmount(totalReturnedInDisplayCurrency, displayCurrency)} icon={FileOutput} color="text-rose-500" bg="bg-rose-500/10" />
        <SalesKpiCard title="Pendientes" value={data.filter(r => (r.status||'').toUpperCase() === 'PENDING').length} icon={Clock} color="text-amber-500" bg="bg-amber-500/10" active={statusFilter === 'PENDING'} onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')} />
        <SalesKpiCard title="Aprobadas" value={data.filter(r => (r.status||'').toUpperCase() === 'APPROVED').length} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" active={statusFilter === 'APPROVED'} onClick={() => setStatusFilter(statusFilter === 'APPROVED' ? 'ALL' : 'APPROVED')} />
        <SalesKpiCard title="Rechazadas" value={data.filter(r => (r.status||'').toUpperCase() === 'REJECTED').length} icon={XCircle} color="text-muted-foreground" bg="bg-muted/10" active={statusFilter === 'REJECTED'} onClick={() => setStatusFilter(statusFilter === 'REJECTED' ? 'ALL' : 'REJECTED')} />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
          <div><h2 className="text-xl font-black uppercase tracking-tight text-foreground" data-tour="sales-list-title">Devoluciones de Venta</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Gestión de retornos y aprobación de mercancía.</p></div>
          <div className="flex flex-wrap items-center justify-end gap-3" data-tour="sales-list-actions">
            <SalesViewTutorial view="returns" />
            <SalesDateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={onDateRangeChange || (() => undefined)} />
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input placeholder="Buscar devolución..." className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold tracking-widest" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
            {canPerform('SALES_RETURNS', 'create') && (
              <Button onClick={startNew} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
                <Plus className="size-4" /> Nueva Devolución</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered}
          pagination={pagination}
          onBulkDelete={async (ids) => { try { for (const id of ids) { if (String(id).startsWith('new-')) continue; await salesReturnsService.delete(id as string); } toast.success('Eliminados'); onRefresh(); } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error'); } }}
          columns={columns} onRowUpdate={async () => {}} onRowClick={(row) => setEditingId(row.id)} isLoading={loading} actionsWidth="w-28" fitContent showHorizontalControls
          actions={(row) => (
            <div className="flex items-center gap-1">
               {canPerform('SALES_RETURNS', 'edit') && (row.status||'').toUpperCase() === 'PENDING' && (
                 <Button title="Aprobar Devolución" variant="ghost" size="icon" className="size-8 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors" onClick={() => handleApprove(row.id)}><ShieldCheck className="size-4" /></Button>
               )}
               <Button title="PDF" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => handleExportPDF(row)}><FileDown className="size-4" /></Button>
               <Button title="Ver detalle" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
               {canPerform('SALES_RETURNS', 'delete') && (
                 <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
               )}
            </div>
          )}
        />
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title={"¿Eliminar devolución?"}
        description="¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          try {
            setDeleteLoading(true);
            await salesReturnsService.delete(pendingDeleteId);
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

