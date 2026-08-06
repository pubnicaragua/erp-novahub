import { useState } from 'react';
import { 
  FileMinus, Plus, Search, TrendingUp, Clock, CheckCircle2, Eye, Trash2, ChevronLeft, Send, FileDown
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { creditNotesService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import type { CreditNote, Customer, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { generateEstimatePDF } from '../../utils/pdfGenerator';
import { SalesAccountingLegend } from './SalesAccountingLegend';
import { PriceMissingBadge, SalesLinePriceListSelect } from './SalesLinePriceListSelect';
import { formatSalesAmount, getMissingSalesPriceMessage } from '../../utils/salesPriceList';
import { SalesIrSelector } from './SalesIrSelector';
import { SalesDateRangeFilter } from './SalesDateRangeFilter';
import { SalesViewTutorial } from './SalesViewTutorial';
import { SalesKpiCard } from './SalesKpiCard';

interface NotasCreditoViewProps {
  data: CreditNote[];
  loading: boolean;
  onRefresh: () => void;
  customers?: Customer[];
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateRangeChange?: (dateFrom: string, dateTo: string) => void;
}

const statusOptions = [
  { label: 'Borrador', value: 'DRAFT',   color: 'bg-muted/20 text-muted-foreground' },
  { label: 'Emitida',  value: 'ISSUED',  color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Aplicada', value: 'APPLIED', color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Anulada',  value: 'VOIDED',  color: 'bg-rose-500/10 text-rose-500' },
];

export function NotasCreditoView({ data, loading, onRefresh, customers = [], pagination, onSearchChange, dateFrom = '', dateTo = '', onDateRangeChange }: NotasCreditoViewProps) {
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, formatConvertedAmount, toBaseAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'ISSUED'>('ALL');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [prevEditingId, setPrevEditingId] = useState(editingId);
  if (prevEditingId !== editingId) {
    setPrevEditingId(editingId);
    if (editingId) {
      const cn = data.find(x => x.id === editingId);
      if (cn) setLocalDoc(JSON.parse(JSON.stringify(cn)));
    } else if (!isCreating) {
      setLocalDoc(null);
    }
  }

  const filtered = data.filter(cn =>
    (statusFilter === 'ALL' || String(cn.status || '').toUpperCase() === statusFilter) &&
    (cn.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cn.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    cn.reason.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const recalcTotal = (items: any[]) => items.reduce((acc: number, it: any) => { const gross = Number(it.quantity || 0) * Number(it.unitPrice || 0); const discount = gross * Number(it.discount || 0) / 100; const net = gross - discount; return acc + net + net * Number(it.taxRate || 0) / 100 - net * Number(it.irRate || 0) / 100; }, 0);

  const startNew = () => {
    setIsCreating(true);
    setEditingId(null);
    setLocalDoc({
      customerId: '',
      date: new Date().toISOString().split('T')[0],
      reason: '',
      items: [],
      total: 0,
      currency: displayCurrency,
      exchangeRate: globalRate,
    });
  };

  const handleSave = async () => {
    if (!localDoc) return;
    if (!localDoc.customerId) { toast.error('Selecciona un cliente'); return; }
    if (!localDoc.reason.trim()) { toast.error('Ingresa la razón de la nota'); return; }
    const priceMessage = getMissingSalesPriceMessage(localDoc.items || []);
    if (priceMessage) { toast.error(priceMessage); return; }
    const saveToastId = toast.loading(isCreating ? 'Creando nota de crédito...' : 'Guardando cambios...');
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
            productId: item.productId || undefined,
            priceListId: item.priceListId || undefined,
            total: Number(item.total || 0),
          })),
          total: localDoc.total,
          status: 'DRAFT',
          currency: localDoc.currency || displayCurrency,
          exchangeRate: localDoc.exchangeRate || globalRate,
          priceListId: localDoc.priceListId || undefined,
        } as any);
        toast.success('Nota de crédito creada', { id: saveToastId });
      } else {
        const { accountId: _accountId, ...creditNotePayload } = localDoc;
        await creditNotesService.update(localDoc.id, creditNotePayload);
      }
      setIsCreating(false); setEditingId(null); setLocalDoc(null); onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'No se pudo guardar', { id: saveToastId }); }
  };

  const handleIssue = async (id: string) => {
    try {
      await creditNotesService.issue(id);
      toast.success('Nota de crédito emitida — Balance del cliente actualizado');
      setEditingId(null); onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al emitir nota de crédito'); }
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
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al generar PDF'); }
  };

  const getCustomerName = (cn: CreditNote) => cn.customer?.name || customers.find(c => c.id === cn.customerId)?.name || 'Cliente';

  const columns: ColumnDef<CreditNote>[] = [
    { key: 'number', header: 'Nº Nota', width: '140px',
      render: (val, row) => (
        <span 
          className={cn(
            "text-xs font-black font-mono text-primary",
            canPerform('SALES_CREDIT_NOTES', 'edit') ? "cursor-pointer hover:underline" : "cursor-default"
          )} 
          onClick={() => canPerform('SALES_CREDIT_NOTES', 'edit') && setEditingId(row.id)}
        >
          {val}
        </span>
      )
    },
    { key: 'customerId', header: 'Cliente', render: (_, row) => <span className="text-[13px] font-bold text-foreground">{getCustomerName(row)}</span> },
    { key: 'date', header: 'Fecha', render: (val) => <span className="text-xs font-medium text-muted-foreground">{new Date(val).toLocaleDateString()}</span> },
    { key: 'reason', header: 'Razón', render: (val) => <span className="text-xs text-muted-foreground truncate max-w-[200px] block">{val}</span> },
    { key: 'total', header: 'Total', width: '130px', render: (val, row) => <span className="text-[13px] font-black tabular-nums text-rose-500">{formatConvertedAmount(Number(val||0), (row as any).currency, (row as any).exchangeRate)}</span> },
    { key: 'status', header: 'Estado', width: '110px', render: (val) => {
      const opt = statusOptions.find(o => o.value === (val||'').toUpperCase());
      return <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none", opt?.color || 'bg-muted/20 text-muted-foreground')}>{opt?.label || val}</Badge>; } },
  ];

  const issuedTotalInDisplayCurrency = data
    .filter(cn => (cn.status||'').toUpperCase() === 'ISSUED')
    .reduce((acc, cn) => acc + ((cn as any).baseTotal !== null && (cn as any).baseTotal !== undefined
      ? Number((cn as any).baseTotal)
      : toBaseAmount(cn.total || 0, (cn as any).currency, (cn as any).exchangeRate)), 0);
  const liveCreditInDisplayCurrency = data
    .filter(cn => ['ISSUED','APPLIED'].includes((cn.status||'').toUpperCase()))
    .reduce((acc, cn) => acc + ((cn as any).baseTotal !== null && (cn as any).baseTotal !== undefined
      ? Number((cn as any).baseTotal)
      : toBaseAmount(cn.total || 0, (cn as any).currency, (cn as any).exchangeRate)), 0);

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
            {canPerform('SALES_CREDIT_NOTES', 'edit') && (
              <>
                {!isCreating && <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={async () => { await creditNotesService.delete(localDoc.id); setEditingId(null); onRefresh(); }}><Trash2 className="size-3 mr-2" /> Eliminar</Button>}
                {canIssue && <Button variant="outline" className="rounded-xl border-emerald-500/50 text-emerald-500 hover:bg-emerald-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => handleIssue(localDoc.id)}><Send className="size-3 mr-2" /> Emitir NC</Button>}
                <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6" onClick={handleSave}>
                  {isCreating ? 'Crear Nota' : 'Guardar'}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información de la Nota</p>
              <SalesAccountingLegend flow="creditNote" />
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-[10px] text-muted-foreground mb-1">Cliente</p>
                  <Combobox 
                    options={(customers || [])
                      .filter(c => (c.status || '').toUpperCase() === 'ACTIVE' || c.id === localDoc?.customerId)
                      .map(c => ({ label: c.name, value: c.id, description: (c.code ? `[${c.code}] ` : '') + (c.phone || 'Sin teléfono') }))} 
                    value={localDoc?.customerId || ''} 
                    onChange={(val) => { const customer = customers?.find((entry) => entry.id === val); const priceListId = customer?.priceListId || null; const items = (localDoc?.items || []).map((item: any) => item.productId ? { ...item, priceListId, unitPrice: 0, total: 0, priceMissing: false } : { ...item, priceListId }); setLocalDoc({ ...localDoc, customerId: val, priceListId, items }); }}
                    placeholder="Seleccionar Cliente" 
                  /></div>
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
                <span className="text-rose-500 font-black text-lg">{formatConvertedAmount(Number(localDoc?.total||0), localDoc?.currency || displayCurrency, localDoc?.exchangeRate)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground italic">Al emitir esta nota, el ajuste se aplicará a la factura relacionada según el flujo de devoluciones y crédito.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Items de la Nota de Crédito</p>
              <Button type="button" variant="outline" size="sm" disabled={!localDoc?.customerId} onClick={() => {
                const newItems = [...(localDoc.items || []), { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, total: 0 }];
                setLocalDoc({ ...localDoc, items: newItems });
              }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl"><Plus className="size-3 mr-2" /> Agregar Item</Button>
            </div>
            <div className="space-y-2">
              <div className="hidden xl:grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className="col-span-4">Descripción</div><div className="col-span-2 text-right">Cant.</div><div className="col-span-2 text-right">Precio U.</div><div className="col-span-2 text-right">Total</div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} data-item-layout="standard" className="sales-item-row grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-border/50 bg-muted/5 p-3 items-start xl:grid-cols-12 xl:gap-2 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0">
                  <div className="col-span-6"><div className="flex min-w-0 items-center gap-2"><div className="min-w-0 flex-1"><Input value={item.description || ''} onChange={(e) => {
                    const ni = [...(localDoc.items || [])]; ni[idx] = { ...ni[idx], description: e.target.value };
                    setLocalDoc({ ...localDoc, items: ni }); }} className="h-8 text-xs" placeholder="Descripción del concepto..." /></div><SalesLinePriceListSelect productId={item.productId} productCode={item.code} value={item.priceListId} defaultPriceListId={localDoc?.priceListId} currency={localDoc?.currency} exchangeRate={Number(localDoc?.exchangeRate || globalRate || 1)} onChange={(priceListId, result) => { const ni = [...(localDoc.items || [])] as any[]; ni[idx] = { ...ni[idx], priceListId, unitPrice: result.unitPrice || 0, priceMissing: result.priceMissing, total: Number(ni[idx].quantity || 1) * Number(result.unitPrice || 0) }; setLocalDoc({ ...localDoc, items: ni, total: recalcTotal(ni), priceListId }); }} /><SalesIrSelector value={item.irTaxId} rate={Number(item.irRate || 0)} compact onChange={(option) => { const ni = [...(localDoc.items || [])] as any[]; ni[idx] = { ...ni[idx], irRate: Number(option?.rate || 0), irTaxId: option?.id || null }; setLocalDoc({ ...localDoc, items: ni, total: recalcTotal(ni) }); }} /></div></div>
                    {item.priceMissing && <PriceMissingBadge className="mt-1" />}
                  <div className="col-span-2"><Input type="number" min="0" value={Number(item.quantity) || ''} onChange={(e) => {
                    const ni = [...(localDoc.items || [])]; ni[idx] = { ...ni[idx], quantity: Number(e.target.value), total: Number(e.target.value) * Number(ni[idx].unitPrice || 0) };
                      setLocalDoc({ ...localDoc, items: ni, total: recalcTotal(ni) }); }} /></div>
                  <div className="col-span-2"><Input type="text" value={item.unitPrice === undefined || item.unitPrice === null ? '' : formatSalesAmount(item.unitPrice)} readOnly className="bg-muted/20 text-right" onChange={(e) => {
                    const ni = [...(localDoc.items || [])]; ni[idx] = { ...ni[idx], unitPrice: Number(e.target.value), total: Number(ni[idx].quantity || 1) * Number(e.target.value) };
                      setLocalDoc({ ...localDoc, items: ni, total: recalcTotal(ni) }); }} /></div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <span className="text-xs font-black text-rose-500">{formatConvertedAmount(Number(item.total || 0), localDoc?.currency || displayCurrency, localDoc?.exchangeRate)}</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="sales-list-kpis">
        <SalesKpiCard title={`Total Emitido (${baseCurrency})`} value={formatConvertedAmount(issuedTotalInDisplayCurrency, baseCurrency)} icon={FileMinus} color="text-rose-500" bg="bg-rose-500/10" />
        <SalesKpiCard title="Borradores" value={data.filter(cn => (cn.status||'').toUpperCase() === 'DRAFT').length} icon={Clock} color="text-amber-500" bg="bg-amber-500/10" active={statusFilter === 'DRAFT'} onClick={() => setStatusFilter(statusFilter === 'DRAFT' ? 'ALL' : 'DRAFT')} />
        <SalesKpiCard title="Emitidas" value={data.filter(cn => (cn.status||'').toUpperCase() === 'ISSUED').length} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" active={statusFilter === 'ISSUED'} onClick={() => setStatusFilter(statusFilter === 'ISSUED' ? 'ALL' : 'ISSUED')} />
        <SalesKpiCard title={`Crédito Vivo (${baseCurrency})`} value={formatConvertedAmount(liveCreditInDisplayCurrency, baseCurrency)} icon={TrendingUp} color="text-primary" bg="bg-primary/10" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
          <div><h2 className="text-xl font-black uppercase tracking-tight text-foreground" data-tour="sales-list-title">Notas de Crédito</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Registros de crédito emitidos a clientes.</p></div>
          <div className="flex flex-wrap items-center justify-end gap-3" data-tour="sales-list-actions">
            <SalesViewTutorial view="credit-notes" />
            <SalesDateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={onDateRangeChange || (() => undefined)} />
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input placeholder="Buscar nota..." className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold tracking-widest" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
            {canPerform('SALES_CREDIT_NOTES', 'create') && (
              <Button onClick={startNew} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
                <Plus className="size-4" /> Nueva NC</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered}
          pagination={pagination}
          onBulkDelete={async (ids) => { try { for (const id of ids) { await creditNotesService.delete(id as string); } toast.success('Eliminadas'); onRefresh(); } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error'); } }}
          columns={columns} onRowUpdate={async () => {}} onRowClick={(row) => setEditingId(row.id)} isLoading={loading} actionsWidth="w-28" fitContent showHorizontalControls
          actions={(row) => (
            <div className="flex items-center gap-1">
               {canPerform('SALES_CREDIT_NOTES', 'edit') && (row.status||'').toUpperCase() === 'DRAFT' && (
                 <Button title="Emitir" variant="ghost" size="icon" className="size-8 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors" onClick={() => handleIssue(row.id)}><Send className="size-4" /></Button>
               )}
               <Button title="PDF" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => handleExportPDF(row)}><FileDown className="size-4" /></Button>
               <Button title="Ver" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
               {canPerform('SALES_CREDIT_NOTES', 'delete') && (
                 <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
               )}
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

