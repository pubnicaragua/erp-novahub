import { useMemo, useState } from 'react';
import { CheckCircle2, Download, FileText, Loader2, Pencil, Plus, Search, Send, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { enterpriseGroupsService, type PlatformQuote, type PlatformQuoteItem } from '../../services/enterprise-groups.service';
import { downloadPlatformQuotePdf } from '../../utils/platformQuotePdf';

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
      prospectCompany: quote.prospectCompany, prospectName: quote.prospectName, prospectEmail: quote.prospectEmail || '', prospectPhone: quote.prospectPhone || '', country: quote.country || '', currency: quote.currency,
      validDays: quote.validUntil ? Math.max(1, Math.ceil((new Date(quote.validUntil).getTime() - Date.now()) / 86400000)) : 15, enterpriseGroupId: quote.enterpriseGroup?.id || '', clientTenantId: quote.clientTenant?.id || '', discountAmount: quote.discountAmount, taxRate: quote.taxRate, notes: quote.notes || '',
      items: quote.items.map((item) => ({ section: item.section, description: item.description, detail: item.detail || '', periodicity: item.periodicity || '', quantity: item.quantity, unitPrice: item.unitPrice, isOptional: item.isOptional })),
    });
  };
  const save = async () => {
    if (!draft?.prospectCompany.trim() || !draft.prospectName.trim()) { toast.error('Indica la empresa y el contacto prospecto.'); return; }
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
        <div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300"><Sparkles className="size-3.5" /> Comercial de plataforma</p><h2 className="mt-2 text-2xl font-black uppercase italic tracking-tight sm:text-3xl">Cotizaciones <span className="text-emerald-300">NOVA</span></h2><p className="mt-2 max-w-2xl text-sm text-slate-300">Genera propuestas profesionales para prospectos, grupos y empresas que todavía no existen como tenant.</p></div>
        <Button className="h-11 rounded-xl bg-emerald-500 px-5 text-white hover:bg-emerald-400" onClick={openNew}><Plus className="mr-2 size-4" /> Nueva cotización</Button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3"><Kpi label="Oportunidades" value={totals.total} /><Kpi label="Enviadas" value={totals.sent} /><Kpi label="Valor cotizado" value={money(totals.value, 'USD')} /></div>
    </div>

    {draft && <QuoteEditor draft={draft} setDraft={setDraft} editingId={editingId} groups={groups} preview={preview} onSave={save} onClose={() => { setDraft(null); setEditingId(null); }} />}

    <Card className="rounded-3xl border-border/60 shadow-sm"><CardHeader className="gap-4 p-5 pb-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><FileText className="size-5 text-primary" /> Historial comercial</CardTitle><p className="mt-1 text-sm text-muted-foreground">La cotización permanece separada de las operaciones del tenant.</p></div><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar prospecto…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary sm:w-56" /></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"><option value="">Todos los estados</option><option value="DRAFT">Borradores</option><option value="SENT">Enviadas</option><option value="ACCEPTED">Aceptadas</option><option value="REJECTED">Rechazadas</option><option value="EXPIRED">Vencidas</option></select></div></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-muted/30 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground"><tr><th className="px-5 py-3">Cotización</th><th className="px-5 py-3">Prospecto</th><th className="px-5 py-3">Vigencia</th><th className="px-5 py-3 text-right">Total</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Acciones</th></tr></thead><tbody>{quotes.map((quote) => <tr key={quote.id} className="border-t border-border/50"><td className="px-5 py-4"><p className="font-bold">{quote.number}</p><p className="text-xs text-muted-foreground">{new Date(quote.createdAt).toLocaleDateString('es-NI')}</p></td><td className="px-5 py-4"><p className="font-semibold">{quote.prospectCompany}</p><p className="text-xs text-muted-foreground">{quote.prospectName}</p></td><td className="px-5 py-4 text-muted-foreground">{quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('es-NI') : 'Sin fecha'}</td><td className="px-5 py-4 text-right font-black">{money(quote.total, quote.currency)}</td><td className="px-5 py-4"><Badge variant={quote.status === 'ACCEPTED' ? 'default' : quote.status === 'REJECTED' ? 'destructive' : 'outline'}>{statusLabel(quote.status)}</Badge></td><td className="px-5 py-4"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="Descargar PDF" onClick={() => downloadPlatformQuotePdf(quote)}><Download className="size-4" /></Button><Button variant="ghost" size="icon" title="Editar" disabled={quote.status === 'ACCEPTED'} onClick={() => openEdit(quote)}><Pencil className="size-4" /></Button>{quote.status === 'DRAFT' && <Button variant="ghost" size="icon" title="Marcar como enviada" onClick={() => markSent(quote)}><Send className="size-4" /></Button>}{quote.status === 'DRAFT' && <Button variant="ghost" size="icon" title="Eliminar" onClick={() => remove(quote)}><Trash2 className="size-4 text-red-500" /></Button>}</div></td></tr>)}</tbody></table></div>{quotesQuery.isLoading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div> : !quotes.length ? <div className="p-12 text-center text-sm text-muted-foreground">Aún no hay cotizaciones. Crea la primera propuesta comercial.</div> : null}</CardContent></Card>
  </div>;
}

function Kpi({ label, value }: { label: string; value: string | number }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>; }

function QuoteEditor({ draft, setDraft, editingId, groups, preview, onSave, onClose }: { draft: DraftQuote; setDraft: (next: DraftQuote) => void; editingId: string | null; groups: any[]; preview: { subtotal: number; optional: number; tax: number; total: number }; onSave: () => Promise<void>; onClose: () => void }) {
  const field = (key: keyof DraftQuote, value: string | number) => setDraft({ ...draft, [key]: value });
  const updateItem = (index: number, key: keyof DraftItem, value: string | number | boolean) => setDraft({ ...draft, items: draft.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) });
  return <Card className="rounded-3xl border-emerald-500/30 bg-emerald-500/[0.03] shadow-sm"><CardHeader className="flex-row items-center justify-between p-5 pb-3"><div><CardTitle className="text-lg font-black uppercase">{editingId ? 'Editar cotización' : 'Nueva cotización'}</CardTitle><p className="mt-1 text-sm text-muted-foreground">Los conceptos pueden ser anuales, mensuales o de pago único.</p></div><Button variant="ghost" size="icon" onClick={onClose}><X className="size-5" /></Button></CardHeader><CardContent className="space-y-5 p-5">
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Input label="Empresa prospecto *" value={draft.prospectCompany} onChange={(value) => field('prospectCompany', value)} /><Input label="Contacto *" value={draft.prospectName} onChange={(value) => field('prospectName', value)} /><Input label="Correo" value={draft.prospectEmail} onChange={(value) => field('prospectEmail', value)} type="email" /><Input label="Teléfono" value={draft.prospectPhone} onChange={(value) => field('prospectPhone', value)} /></div>
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5"><Input label="País" value={draft.country} onChange={(value) => field('country', value)} /><label className="space-y-1 text-xs font-bold text-muted-foreground">Moneda<select value={draft.currency} onChange={(event) => field('currency', event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary"><option value="USD">USD — Dólar</option><option value="NIO">NIO — Córdoba</option></select></label><Input label="Vigencia (días)" type="number" value={draft.validDays} onChange={(value) => field('validDays', Number(value))} /><label className="space-y-1 text-xs font-bold text-muted-foreground lg:col-span-2">Grupo empresarial (opcional)<select value={draft.enterpriseGroupId} onChange={(event) => field('enterpriseGroupId', event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary"><option value="">Prospecto sin grupo</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label></div>
    <div className="grid gap-3 md:grid-cols-2"><Input label="Descuento" type="number" value={draft.discountAmount} onChange={(value) => field('discountAmount', Number(value))} /><Input label="Impuesto (%)" type="number" value={draft.taxRate} onChange={(value) => field('taxRate', Number(value))} /></div>
    <div className="overflow-x-auto rounded-2xl border border-border/70"><table className="w-full min-w-[980px] text-sm"><thead className="bg-muted/30 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground"><tr><th className="px-3 py-3">Sección</th><th className="px-3 py-3">Concepto</th><th className="px-3 py-3">Periodicidad</th><th className="px-3 py-3">Detalle</th><th className="px-3 py-3">Cant.</th><th className="px-3 py-3">Precio</th><th className="px-3 py-3">Opcional</th><th /></tr></thead><tbody>{draft.items.map((item, index) => <tr key={`${index}-${item.description}`} className="border-t border-border/50"><td className="p-2"><SmallInput value={item.section} onChange={(value) => updateItem(index, 'section', value)} /></td><td className="p-2"><SmallInput value={item.description} onChange={(value) => updateItem(index, 'description', value)} /></td><td className="p-2"><SmallInput value={item.periodicity || ''} onChange={(value) => updateItem(index, 'periodicity', value)} /></td><td className="p-2"><SmallInput value={item.detail || ''} onChange={(value) => updateItem(index, 'detail', value)} /></td><td className="p-2"><SmallInput type="number" value={item.quantity} onChange={(value) => updateItem(index, 'quantity', Number(value))} /></td><td className="p-2"><SmallInput type="number" value={item.unitPrice} onChange={(value) => updateItem(index, 'unitPrice', Number(value))} /></td><td className="p-2 text-center"><input type="checkbox" checked={item.isOptional} onChange={(event) => updateItem(index, 'isOptional', event.target.checked)} /></td><td className="p-2"><Button variant="ghost" size="icon" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="size-4 text-red-500" /></Button></td></tr>)}</tbody></table></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" className="rounded-xl" onClick={() => setDraft({ ...draft, items: [...draft.items, { section: '2. MÓDULOS Y SERVICIOS ADICIONALES', description: '', periodicity: 'Mensual', detail: '', quantity: 1, unitPrice: 0, isOptional: true }] })}><Plus className="mr-2 size-4" /> Agregar concepto</Button><div className="grid min-w-[270px] gap-1 text-right text-sm"><p className="text-muted-foreground">Base: <strong>{money(preview.subtotal, draft.currency)}</strong> · Opcionales: <strong>{money(preview.optional, draft.currency)}</strong></p><p className="text-xl font-black text-emerald-600">Total: {money(preview.total, draft.currency)}</p></div></div>
    <label className="block space-y-1 text-xs font-bold text-muted-foreground">Notas y condiciones<textarea value={draft.notes} onChange={(event) => field('notes', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm font-normal text-foreground outline-none focus:border-primary" /></label>
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" className="rounded-xl" onClick={onClose}>Cancelar</Button><Button className="rounded-xl" onClick={onSave}><CheckCircle2 className="mr-2 size-4" /> Guardar cotización</Button></div>
  </CardContent></Card>;
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) { return <label className="space-y-1 text-xs font-bold text-muted-foreground">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary" /></label>; }
function SmallInput({ value, onChange, type = 'text' }: { value: string | number; onChange: (value: string) => void; type?: string }) { return <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full min-w-0 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary" />; }
