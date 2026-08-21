import { Fragment, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { CheckCircle2, Download, FileText, Loader2, Pencil, Plus, Search, Send, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { enterpriseGroupsService, type PlatformQuote, type PlatformQuoteItem } from '../../services/enterprise-groups.service';
import { downloadPlatformQuotePdf } from '../../utils/platformQuotePdf';
import { NovaHubLogo } from '../NovaHubLogo';

type DraftItem = Omit<PlatformQuoteItem, 'id' | 'amount' | 'sortOrder'>;
type DraftQuote = {
  prospectCompany: string;
  prospectName: string;
  prospectEmail: string;
  prospectPhone: string;
  country: string;
  currency: 'USD' | 'NIO';
  validDays: number;
  enterpriseGroupId: string;
  clientTenantId: string;
  discountAmount: number;
  taxRate: number;
  notes: string;
  items: DraftItem[];
};

const defaultItems: DraftItem[] = [
  { section: '1. CONTRATACIÓN INICIAL', description: 'ERP', periodicity: 'Anual', detail: '', quantity: 1, unitPrice: 600, isOptional: false },
  { section: '1. CONTRATACIÓN INICIAL', description: 'ERP', periodicity: 'Mensual', detail: '', quantity: 1, unitPrice: 60, isOptional: false },
  { section: '1. CONTRATACIÓN INICIAL', description: 'Implementación', periodicity: 'Pago único', detail: '', quantity: 1, unitPrice: 200, isOptional: false },
  { section: '1. CONTRATACIÓN INICIAL', description: 'Comisión del freelancer', periodicity: 'Pago único', detail: '', quantity: 1, unitPrice: 100, isOptional: false },
  { section: '2. MÓDULOS Y SERVICIOS ADICIONALES', description: 'Dominio propio', periodicity: 'Anual', detail: 'Incluye 5 correos corporativos', quantity: 1, unitPrice: 100, isOptional: true },
  { section: '2. MÓDULOS Y SERVICIOS ADICIONALES', description: 'Módulo contable', periodicity: 'Mensual', detail: '', quantity: 1, unitPrice: 100, isOptional: true },
  { section: '2. MÓDULOS Y SERVICIOS ADICIONALES', description: 'Módulo de RR. HH.', periodicity: 'Mensual', detail: '', quantity: 1, unitPrice: 75, isOptional: true },
  { section: '2. MÓDULOS Y SERVICIOS ADICIONALES', description: 'E-commerce', periodicity: 'Anual', detail: '', quantity: 1, unitPrice: 600, isOptional: true },
  { section: '2. MÓDULOS Y SERVICIOS ADICIONALES', description: 'Landing page', periodicity: 'Anual', detail: '', quantity: 1, unitPrice: 300, isOptional: true },
  { section: '2. MÓDULOS Y SERVICIOS ADICIONALES', description: 'Píxel de Meta', periodicity: 'Pago único', detail: '', quantity: 1, unitPrice: 100, isOptional: true },
  { section: '2. MÓDULOS Y SERVICIOS ADICIONALES', description: 'Nova Suite', periodicity: 'Mensual', detail: '', quantity: 1, unitPrice: 49.99, isOptional: true },
  { section: '2. MÓDULOS Y SERVICIOS ADICIONALES', description: 'Conexión de Nova Suite', periodicity: 'Pago único', detail: '', quantity: 1, unitPrice: 100, isOptional: true },
];

const emptyDraft = (): DraftQuote => ({
  prospectCompany: '', prospectName: '', prospectEmail: '', prospectPhone: '', country: 'Nicaragua', currency: 'USD', validDays: 15,
  enterpriseGroupId: '', clientTenantId: '', discountAmount: 0, taxRate: 0, notes: 'Los módulos y servicios adicionales son opcionales y se contratan por separado del ERP.',
  items: defaultItems.map((item) => ({ ...item })),
});

const safeTrim = (value: unknown) => String(value ?? '').trim();

function money(value: number, currency: string) {
  return new Intl.NumberFormat('es-NI', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value || 0));
}

function statusLabel(status: PlatformQuote['status']) {
  return { DRAFT: 'Borrador', SENT: 'Enviada', ACCEPTED: 'Aceptada', REJECTED: 'Rechazada', EXPIRED: 'Vencida' }[status];
}

export function PlatformQuotesPanel({ groups = [] }: { groups?: any[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [draft, setDraft] = useState<DraftQuote | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const quotesQuery = useTenantQuery(['platform-quotes', search, status], (signal) => enterpriseGroupsService.getPlatformQuotes({ search, status }, signal), { enabled: true });
  const quotes = useMemo(() => quotesQuery.data || [], [quotesQuery.data]);
  const totals = useMemo(() => ({ total: quotes.length, sent: quotes.filter((quote) => quote.status === 'SENT').length, value: quotes.reduce((sum, quote) => sum + Number(quote.total || 0), 0) }), [quotes]);
  const preview = useMemo(() => {
    if (!draft) return { subtotal: 0, optional: 0, tax: 0, total: 0 };
    const subtotal = draft.items.filter((item) => !item.isOptional).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
    const optional = draft.items.filter((item) => item.isOptional).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
    const taxable = Math.max(0, subtotal + optional - Number(draft.discountAmount || 0));
    const tax = taxable * Number(draft.taxRate || 0) / 100;
    return { subtotal, optional, tax, total: taxable + tax };
  }, [draft]);

  const openNew = () => { setEditingId(null); setDraft(emptyDraft()); };
  const openEdit = (quote: PlatformQuote) => {
    setEditingId(quote.id);
    setDraft({
      prospectCompany: safeTrim(quote.prospectCompany), prospectName: safeTrim(quote.prospectName), prospectEmail: safeTrim(quote.prospectEmail), prospectPhone: safeTrim(quote.prospectPhone), country: safeTrim(quote.country), currency: quote.currency,
      validDays: quote.validUntil ? Math.max(1, Math.ceil((new Date(quote.validUntil).getTime() - Date.now()) / 86400000)) : 15, enterpriseGroupId: quote.enterpriseGroup?.id || '', clientTenantId: quote.clientTenant?.id || '', discountAmount: quote.discountAmount, taxRate: quote.taxRate, notes: quote.notes || '',
      items: (Array.isArray(quote.items) ? quote.items : []).map((item) => ({ section: safeTrim(item.section), description: safeTrim(item.description), detail: safeTrim(item.detail), periodicity: safeTrim(item.periodicity), quantity: item.quantity, unitPrice: item.unitPrice, isOptional: Boolean(item.isOptional) })),
    });
  };
  const save = async () => {
    if (!safeTrim(draft?.prospectCompany) || !safeTrim(draft?.prospectName)) { toast.error('Indica la empresa y el contacto prospecto.'); return; }
    if (!draft.items.length) { toast.error('Agrega al menos un concepto.'); return; }
    const payload = { ...draft, validUntil: new Date(Date.now() + Math.max(1, Number(draft.validDays || 15)) * 86400000).toISOString(), items: draft.items.map((item) => ({ ...item, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) })) };
    try {
      if (editingId) await enterpriseGroupsService.updatePlatformQuote(editingId, payload);
      else await enterpriseGroupsService.createPlatformQuote(payload as any);
      toast.success(editingId ? 'Cotización actualizada.' : 'Cotización creada.');
      setDraft(null); setEditingId(null); await quotesQuery.refetch();
    } catch (error: any) { toast.error(error?.message || 'No se pudo guardar la cotización.'); }
  };
  const markSent = async (quote: PlatformQuote) => {
    try { await enterpriseGroupsService.updatePlatformQuoteStatus(quote.id, 'SENT'); toast.success('Cotización marcada como enviada.'); await quotesQuery.refetch(); } catch (error: any) { toast.error(error?.message || 'No se pudo cambiar el estado.'); }
  };
  const remove = async (quote: PlatformQuote) => {
    if (!window.confirm(`¿Eliminar ${quote.number}?`)) return;
    try { await enterpriseGroupsService.deletePlatformQuote(quote.id); toast.success('Cotización eliminada.'); await quotesQuery.refetch(); } catch (error: any) { toast.error(error?.message || 'Solo se pueden eliminar borradores.'); }
  };

  return <div className="space-y-5">
    <div className="rounded-3xl bg-slate-950 p-5 text-white shadow-lg sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300"><Sparkles className="size-3.5" /> Comercial de plataforma</p><h2 className="mt-2 text-2xl font-black uppercase italic tracking-tight sm:text-3xl">Cotizaciones <span className="text-emerald-300">NOVA</span></h2></div>
        <Button className="h-11 rounded-xl bg-emerald-500 px-5 text-white hover:bg-emerald-400" onClick={openNew}><Plus className="mr-2 size-4" /> Nueva cotización</Button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3"><Kpi label="Oportunidades" value={totals.total} /><Kpi label="Enviadas" value={totals.sent} /><Kpi label="Valor cotizado" value={money(totals.value, 'USD')} /></div>
    </div>

    {draft && <QuoteEditor draft={draft} setDraft={setDraft} editingId={editingId} groups={groups} preview={preview} onSave={save} onClose={() => { setDraft(null); setEditingId(null); }} />}

    <Card className="rounded-3xl border-border/60 shadow-sm"><CardHeader className="gap-4 p-5 pb-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><FileText className="size-5 text-primary" /> Historial comercial</CardTitle><p className="mt-1 text-sm text-muted-foreground">La cotización permanece separada de las operaciones del tenant.</p></div><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar prospecto…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary sm:w-56" /></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"><option value="">Todos los estados</option><option value="DRAFT">Borradores</option><option value="SENT">Enviadas</option><option value="ACCEPTED">Aceptadas</option><option value="REJECTED">Rechazadas</option><option value="EXPIRED">Vencidas</option></select></div></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-muted/30 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground"><tr><th className="px-5 py-3">Cotización</th><th className="px-5 py-3">Prospecto</th><th className="px-5 py-3">Vigencia</th><th className="px-5 py-3 text-right">Total</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Acciones</th></tr></thead><tbody>{quotes.map((quote) => <tr key={quote.id} className="border-t border-border/50"><td className="px-5 py-4"><p className="font-bold">{quote.number}</p><p className="text-xs text-muted-foreground">{new Date(quote.createdAt).toLocaleDateString('es-NI')}</p></td><td className="px-5 py-4"><p className="font-semibold">{quote.prospectCompany}</p><p className="text-xs text-muted-foreground">{quote.prospectName}</p></td><td className="px-5 py-4 text-muted-foreground">{quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('es-NI') : 'Sin fecha'}</td><td className="px-5 py-4 text-right font-black">{money(quote.total, quote.currency)}</td><td className="px-5 py-4"><Badge variant={quote.status === 'ACCEPTED' ? 'default' : quote.status === 'REJECTED' ? 'destructive' : 'outline'}>{statusLabel(quote.status)}</Badge></td><td className="px-5 py-4"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="Descargar PDF" onClick={() => downloadPlatformQuotePdf(quote)}><Download className="size-4" /></Button><Button variant="ghost" size="icon" title="Editar" disabled={quote.status === 'ACCEPTED'} onClick={() => openEdit(quote)}><Pencil className="size-4" /></Button>{quote.status === 'DRAFT' && <Button variant="ghost" size="icon" title="Marcar como enviada" onClick={() => markSent(quote)}><Send className="size-4" /></Button>}{quote.status === 'DRAFT' && <Button variant="ghost" size="icon" title="Eliminar" onClick={() => remove(quote)}><Trash2 className="size-4 text-red-500" /></Button>}</div></td></tr>)}</tbody></table></div>{quotesQuery.isLoading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div> : !quotes.length ? <div className="p-12 text-center text-sm text-muted-foreground">Aún no hay cotizaciones. Crea la primera propuesta comercial.</div> : null}</CardContent></Card>
  </div>;
}

function Kpi({ label, value }: { label: string; value: string | number }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>; }

function QuoteEditor({ draft, setDraft, editingId, groups, preview, onSave, onClose }: { draft: DraftQuote; setDraft: Dispatch<SetStateAction<DraftQuote | null>>; editingId: string | null; groups: any[]; preview: { subtotal: number; optional: number; tax: number; total: number }; onSave: () => Promise<void>; onClose: () => void }) {
  const updateDraft = (updater: (current: DraftQuote) => DraftQuote) => setDraft((current) => current ? updater(current) : current);
  const field = (key: keyof DraftQuote, value: string | number) => updateDraft((current) => ({ ...current, [key]: value }));
  const updateItem = (index: number, key: keyof DraftItem, value: string | number | boolean) => updateDraft((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }));
  const numberValue = (value: string) => value === '' ? 0 : Number(value);
  const periodTotals = draft.items.reduce<Record<string, number>>((totals, item) => {
    const label = item.periodicity || 'Por definir';
    totals[label] = (totals[label] || 0) + Number(item.quantity || 0) * Number(item.unitPrice || 0);
    return totals;
  }, {});
  const periods = ['Mensual', 'Anual', 'Pago único'].filter((label) => periodTotals[label] > 0);
  const removeItem = (index: number) => updateDraft((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
  const addItem = () => updateDraft((current) => ({ ...current, items: [...current.items, { section: '2. MÓDULOS Y SERVICIOS ADICIONALES', description: '', periodicity: 'Mensual', detail: '', quantity: 1, unitPrice: 0, isOptional: true }] }));

  return <Card className="overflow-hidden rounded-[28px] border-emerald-500/25 bg-[#eaf3ee] shadow-xl shadow-emerald-950/5">
    <CardHeader className="border-b border-emerald-950/10 bg-white p-5 sm:px-7"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><CardTitle className="text-lg font-black uppercase tracking-tight text-slate-950">{editingId ? 'Editar cotización' : 'Nueva cotización'}</CardTitle><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700">Vista editable</span></div><p className="mt-1 text-sm text-slate-500">Haz clic directamente sobre el documento. La vista y el PDF usan la misma jerarquía comercial.</p></div><Button variant="ghost" size="icon" onClick={onClose}><X className="size-5" /></Button></div></CardHeader>
    <CardContent className="space-y-4 p-3 sm:p-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-emerald-900/10 bg-white/80 p-3 shadow-sm"><div className="mr-auto"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700">Configuración comercial</p><p className="mt-1 text-xs text-slate-500">Estos valores alimentan el resumen de la propuesta.</p></div><label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Moneda<select value={draft.currency} onChange={(event) => field('currency', event.target.value)} className="mt-1 h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"><option value="USD">USD — Dólar</option><option value="NIO">NIO — Córdoba</option></select></label><Input label="Vigencia (días)" type="number" value={draft.validDays} onChange={(value) => field('validDays', numberValue(value))} /><Input label="Descuento" type="number" value={draft.discountAmount} onChange={(value) => field('discountAmount', numberValue(value))} /><Input label="Impuesto (%)" type="number" value={draft.taxRate} onChange={(value) => field('taxRate', numberValue(value))} /><label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Grupo<select value={draft.enterpriseGroupId} onChange={(event) => field('enterpriseGroupId', event.target.value)} className="mt-1 h-9 max-w-[180px] rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"><option value="">Sin grupo</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label></div>

      <div className="overflow-x-auto pb-2"><div className="mx-auto min-w-[760px] max-w-[980px] overflow-hidden rounded-[5px] bg-white shadow-[0_20px_70px_rgba(15,23,42,0.16)] ring-1 ring-slate-900/10">
        <div className="relative flex min-h-[124px] items-start gap-5 overflow-hidden bg-[#0A0A0A] px-7 py-6 text-white sm:px-9"><div className="flex h-[58px] w-[190px] shrink-0 items-center gap-3 rounded-xl bg-white px-3 shadow-lg"><NovaHubLogo size={43} /><div className="leading-none"><p className="text-[21px] font-black tracking-tight text-slate-950">Nova<span className="text-[#16a34a]">Hub</span></p><p className="mt-1 text-[7px] font-bold uppercase tracking-[0.22em] text-slate-500">ERP Platform</p></div></div><div className="min-w-0 pt-1"><p className="text-xl font-black uppercase tracking-tight">Cotización de plataforma</p><p className="mt-1 max-w-[390px] text-[10px] text-slate-300">Estructura de costos, implementación y servicios adicionales</p></div><div className="ml-auto shrink-0 text-right text-[10px]"><p className="font-black text-[#22C55E]">BORRADOR NOVA</p><p className="mt-2 text-slate-300">Emitida {new Date().toLocaleDateString('es-NI')}</p><p className="mt-1 text-slate-300">Válida {draft.validDays} días</p></div></div><div className="h-1 bg-[#22C55E]" />
        <div className="space-y-4 p-6 sm:p-8"><div className="grid gap-4 rounded-2xl bg-[#effaf4] p-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Preparada para</p><DocumentInput value={draft.prospectCompany} placeholder="Empresa prospecto *" onChange={(value) => field('prospectCompany', value)} className="mt-1 text-lg font-black text-slate-950" /><div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-slate-500"><DocumentInput value={draft.prospectName} placeholder="Contacto *" onChange={(value) => field('prospectName', value)} /><span>·</span><DocumentInput value={draft.prospectEmail} placeholder="correo" onChange={(value) => field('prospectEmail', value)} /><span>·</span><DocumentInput value={draft.prospectPhone} placeholder="teléfono" onChange={(value) => field('prospectPhone', value)} /><span>·</span><DocumentInput value={draft.country} placeholder="país" onChange={(value) => field('country', value)} /></div></div><div className="sm:text-right"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Moneda</p><p className="mt-1 text-lg font-black text-slate-950">{draft.currency}</p></div></div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#f7fcf9] px-4 py-2.5"><span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#16a34a]">Modalidad de cobro</span>{periods.length ? periods.map((period) => <span key={period} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${period === 'Mensual' ? 'bg-emerald-100 text-emerald-700' : period === 'Anual' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{period}</span>) : <span className="text-[10px] text-slate-400">Por definir</span>}</div>
          <table className="w-full border-collapse text-[10px]"><thead><tr className="bg-[#0A0A0A] text-left text-[9px] font-black uppercase tracking-wider text-white"><th className="w-[27%] px-3 py-3">Concepto</th><th className="w-[15%] px-2 py-3 text-right">Precio unit.</th><th className="w-[15%] px-2 py-3 text-center">Cobro</th><th className="w-[28%] px-2 py-3">Detalle</th><th className="w-[15%] px-3 py-3 text-right">Importe</th></tr></thead><tbody>{draft.items.map((item, index) => <Fragment key={`quote-row-${index}`}>{(index === 0 || item.section !== draft.items[index - 1]?.section) && <tr><td colSpan={5} className="border-b border-emerald-900/10 bg-[#e1f5e9] px-3 py-2"><DocumentInput value={item.section} placeholder="Sección" onChange={(value) => updateItem(index, 'section', value)} className="w-full text-[10px] font-black uppercase text-slate-950" /></td></tr>}<tr className="group border-b border-slate-200"><td className="px-3 py-1.5"><div className="flex items-center gap-1"><DocumentInput value={item.description} placeholder="Concepto" onChange={(value) => updateItem(index, 'description', value)} className="flex-1 font-medium text-slate-800" />{item.isOptional && <span className="shrink-0 text-[9px] font-bold text-slate-500">· Opcional</span>}<button type="button" aria-label="Eliminar concepto" title="Eliminar concepto" onClick={() => removeItem(index)} className="ml-auto shrink-0 rounded p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 focus:opacity-100"><Trash2 className="size-3" /></button></div></td><td className="px-2 py-1.5 text-right"><div className="flex items-center justify-end gap-1"><span className="text-[9px] text-slate-400">×</span><DocumentNumberInput value={item.quantity} onChange={(value) => updateItem(index, 'quantity', numberValue(value))} className="w-7 text-center" /><span className="text-[9px] text-slate-500">{draft.currency}</span><DocumentNumberInput value={item.unitPrice} onChange={(value) => updateItem(index, 'unitPrice', numberValue(value))} /></div></td><td className="px-2 py-1.5 text-center"><select value={item.periodicity || ''} onChange={(event) => updateItem(index, 'periodicity', event.target.value)} className={`w-full rounded-md border-0 px-1 py-1 text-center text-[9px] font-bold outline-none ${item.periodicity === 'Mensual' ? 'bg-emerald-50 text-emerald-700' : item.periodicity === 'Anual' ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-600'}`}><option value="Mensual">Mensual</option><option value="Anual">Anual</option><option value="Pago único">Pago único</option></select></td><td className="px-2 py-1.5"><DocumentInput value={item.detail || ''} placeholder="—" onChange={(value) => updateItem(index, 'detail', value)} className="text-slate-500" /></td><td className="px-3 py-1.5 text-right font-semibold text-slate-800">{money(Number(item.quantity || 0) * Number(item.unitPrice || 0), draft.currency)}</td></tr></Fragment>)}</tbody></table>
          <div className="flex justify-end"><div className="w-full max-w-[300px] space-y-1 text-[10px]"><p className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Resumen comercial</p><SummaryLine label="Servicios base" value={preview.subtotal} currency={draft.currency} /><SummaryLine label="Opcionales" value={preview.optional} currency={draft.currency} />{draft.discountAmount > 0 && <SummaryLine label="Descuento" value={-draft.discountAmount} currency={draft.currency} negative />}{draft.taxRate > 0 && <SummaryLine label={`Impuestos (${draft.taxRate}%)`} value={preview.tax} currency={draft.currency} />}<div className="mt-2 flex items-center justify-between border-t-2 border-[#22C55E] pt-2 text-sm font-black text-slate-950"><span>TOTAL</span><span className="text-[#16a34a]">{money(preview.total, draft.currency)}</span></div>{periods.length > 0 && <div className="mt-4 border-t border-slate-200 pt-3"><p className="mb-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Referencia por periodicidad</p>{periods.map((period) => <SummaryLine key={period} label={period} value={periodTotals[period]} currency={draft.currency} accent={period === 'Mensual'} />)}</div>}</div></div>
          <div className="border-t border-slate-200 pt-4"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-700">Notas y condiciones</p><textarea value={draft.notes} onChange={(event) => field('notes', event.target.value)} rows={2} className="mt-1 w-full resize-none rounded-md border border-transparent bg-transparent p-0 text-[10px] leading-relaxed text-slate-500 outline-none transition focus:border-emerald-400 focus:bg-emerald-50/50" /></div>
        </div><div className="flex items-center justify-between border-t border-slate-200 bg-[#f8fafc] px-6 py-3 text-[9px] text-slate-500 sm:px-8"><span>Propuesta comercial confidencial · NovaHub ERP Platform</span><span>Documento editable</span></div>
      </div></div>

      <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" className="rounded-xl border-emerald-700/20 bg-white" onClick={addItem}><Plus className="mr-2 size-4" /> Agregar concepto</Button><div className="flex items-center gap-2"><span className="hidden text-xs text-slate-500 sm:inline">Puedes editar todos los textos del documento</span><Button variant="outline" className="rounded-xl bg-white" onClick={onClose}>Cancelar</Button><Button className="rounded-xl bg-[#0A0A0A] text-white hover:bg-slate-800" onClick={onSave}><CheckCircle2 className="mr-2 size-4 text-[#22C55E]" /> Guardar cotización</Button></div></div>
    </CardContent>
  </Card>;
}

function SummaryLine({ label, value, currency, negative = false, accent = false }: { label: string; value: number; currency: string; negative?: boolean; accent?: boolean }) { return <div className="flex items-center justify-between gap-4 text-slate-500"><span>{label}</span><strong className={negative ? 'text-red-600' : accent ? 'text-emerald-700' : 'text-slate-800'}>{money(value, currency)}</strong></div>; }
function DocumentInput({ value, onChange, placeholder, className = '' }: { value: string; onChange: (value: string) => void; placeholder: string; className?: string }) { return <input value={value} placeholder={placeholder} title="Haz clic para editar" onChange={(event) => onChange(event.target.value)} className={`min-w-0 max-w-full border-b border-transparent bg-transparent px-0 py-0.5 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-emerald-50/60 ${className}`} />; }
function DocumentNumberInput({ value, onChange, className = '' }: { value: number; onChange: (value: string) => void; className?: string }) { return <input type="number" value={value} title="Haz clic para editar" onChange={(event) => onChange(event.target.value)} className={`w-[78px] min-w-0 border-b border-transparent bg-transparent px-0 py-0.5 text-right font-medium text-slate-800 outline-none transition hover:border-slate-300 focus:border-emerald-500 focus:bg-emerald-50/60 ${className}`} />; }
function Input({ label, value, onChange, type = 'text' }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) { return <label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-9 w-[92px] rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-emerald-500" /></label>; }
