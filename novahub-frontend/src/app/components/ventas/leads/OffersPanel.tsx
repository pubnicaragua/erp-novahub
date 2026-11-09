import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Skeleton } from '../../ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { cn } from '../../ui/utils';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { SIGNAL_LABEL, businessLeadsService, formatMoney, type DiscountRequest, type LeadOffer } from '../../../services/business-leads.service';
import { failure } from './leadUtils';

const field = 'h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary';
const split = (value: string) => value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);

function OfferDialog({ offer, onClose }: { offer: LeadOffer | null; onClose: () => void }) {
  const client = useQueryClient();
  const [form, setForm] = useState({
    name: offer?.name ?? '', description: offer?.description ?? '', industries: offer?.industries.join(', ') ?? '', signals: offer?.signals ?? [] as string[],
    minPrice: offer ? String(offer.minPrice) : '', maxPrice: offer ? String(offer.maxPrice) : '', currency: offer?.currency ?? 'USD', materialUrl: offer?.materialUrl ?? '', active: offer?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const toggleSignal = (signal: string) => setForm((current) => ({ ...current, signals: current.signals.includes(signal) ? current.signals.filter((item) => item !== signal) : [...current.signals, signal] }));
  const save = async () => {
    setBusy(true);
    try {
      const data = { name: form.name.trim(), description: form.description.trim() || null, industries: split(form.industries), signals: form.signals, minPrice: Number(form.minPrice), maxPrice: Number(form.maxPrice || form.minPrice), currency: form.currency, materialUrl: form.materialUrl.trim() || null, active: form.active };
      await (offer ? businessLeadsService.updateOffer(offer.id, data) : businessLeadsService.createOffer(data));
      toast.success('Oferta guardada');
      void client.invalidateQueries({ queryKey: ['tenant-module'] });
      onClose();
    } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{offer ? 'Editar oferta' : 'Nueva oferta'}</DialogTitle><DialogDescription>Lo que vendemos, con su precio mínimo (por debajo hace falta aprobación) y el precio de lista.</DialogDescription></DialogHeader>
        <fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="of-name">Nombre</Label><Input id="of-name" value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Página web, Tienda en línea, Sistema a la medida…" /></div>
          <div className="space-y-1.5"><Label htmlFor="of-min">Precio mínimo</Label><Input id="of-min" type="number" min="0" step="0.01" value={form.minPrice} onChange={(e) => setForm({ ...form, minPrice: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="of-max">Precio de lista</Label><div className="flex gap-2"><Input id="of-max" type="number" min="0" step="0.01" value={form.maxPrice} onChange={(e) => setForm({ ...form, maxPrice: e.target.value })} /><select aria-label="Moneda" className={`${field} w-24`} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option>USD</option><option>NIO</option></select></div></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="of-ind">¿Para qué tipo de negocio? (separados por coma)</Label><Input id="of-ind" value={form.industries} onChange={(e) => setForm({ ...form, industries: e.target.value })} placeholder="tienda, restaurante, clínica" /></div>
          <fieldset className="space-y-1.5 sm:col-span-2"><legend className="text-sm font-medium">¿Cuándo conviene ofrecerla?</legend><div className="flex flex-wrap gap-1.5">{Object.entries(SIGNAL_LABEL).filter(([key]) => key !== 'CLOSED').map(([key, label]) => <label key={key} className={cn('cursor-pointer rounded-full border px-2.5 py-1 text-xs font-semibold', form.signals.includes(key) ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground')}><input type="checkbox" className="sr-only" checked={form.signals.includes(key)} onChange={() => toggleSignal(key)} />{label}</label>)}</div></fieldset>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="of-url">Material para enviar (enlace al PDF o presentación)</Label><Input id="of-url" value={form.materialUrl} onChange={(e) => setForm({ ...form, materialUrl: e.target.value })} placeholder="https://…" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="of-desc">Descripción</Label><Textarea id="of-desc" rows={2} value={form.description} maxLength={1000} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <label className="inline-flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Activa (se sugiere a los vendedores)</label>
        </fieldset>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="button" onClick={() => void save()} disabled={busy || !form.name.trim() || form.minPrice === ''}>Guardar</Button></div>
      </DialogContent>
    </Dialog>
  );
}

function DiscountRow({ request, canDecide, onChanged }: { request: DiscountRequest; canDecide: boolean; onChanged: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const decide = async (decision: 'approve' | 'reject') => {
    setBusy(true);
    try { await businessLeadsService.decideDiscount(request.id, { decision, note: note.trim() || undefined }); toast.success(decision === 'approve' ? 'Descuento aprobado' : 'Descuento rechazado'); onChanged(); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  const tone = request.status === 'PENDING' ? 'bg-amber-100 text-amber-900' : request.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-700';
  return (
    <li className="space-y-2 rounded-xl border border-border/60 bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{request.lead?.company ?? 'Lead'} · {request.offerName}</p><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase', tone)}>{request.status === 'PENDING' ? 'Pendiente' : request.status === 'APPROVED' ? 'Aprobado' : 'Rechazado'}</span></div>
      <p className="text-xs text-muted-foreground">{request.requestedByName ?? 'Alguien'} pide {formatMoney(request.requestedPrice, request.currency)} (mínimo {formatMoney(request.minPrice, request.currency)}). «{request.reason}»{request.decisionNote ? ` — Respuesta: ${request.decisionNote}` : ''}</p>
      {canDecide && request.status === 'PENDING' && (
        <div className="flex flex-wrap items-center gap-2"><Input aria-label="Respuesta" className="h-9 min-w-[160px] flex-1" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" /><Button type="button" size="sm" onClick={() => void decide('approve')} disabled={busy}>Aprobar</Button><Button type="button" size="sm" variant="outline" onClick={() => void decide('reject')} disabled={busy}>Rechazar</Button></div>
      )}
    </li>
  );
}

/** Catálogo de ofertas (qué vendemos y a qué precio) y solicitudes de descuento por debajo del mínimo. */
export function OffersPanel({ isAdmin }: { isAdmin: boolean }) {
  const client = useQueryClient();
  const offers = useTenantQuery(['sales', 'business-leads-offers'], (signal) => businessLeadsService.offers(signal), { staleTime: 15_000 });
  const discounts = useTenantQuery(['sales', 'business-leads-discounts'], (signal) => businessLeadsService.discounts(undefined, signal), { staleTime: 10_000 });
  const [editing, setEditing] = useState<LeadOffer | 'new' | null>(null);
  const refresh = () => { void client.invalidateQueries({ queryKey: ['tenant-module'] }); };
  const pending = (discounts.data ?? []).filter((item) => item.status === 'PENDING');
  const done = (discounts.data ?? []).filter((item) => item.status !== 'PENDING').slice(0, 10);

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-label="Catálogo de ofertas">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Lo que vendemos. El asistente solo recomienda de aquí, respetando el presupuesto de cada lead.</p>{isAdmin && <Button type="button" size="sm" onClick={() => setEditing('new')}><Plus className="mr-1.5 size-4" />Nueva oferta</Button>}</div>
        {offers.isLoading ? <Skeleton className="h-32 w-full rounded-2xl" aria-busy="true" />
          : (offers.data ?? []).length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{isAdmin ? 'Aún no hay ofertas. Agrega página web, tienda en línea, sistema a la medida… con su precio mínimo y de lista.' : 'Un administrador aún no ha cargado el catálogo.'}</p>
          : (
            <div className="overflow-x-auto rounded-xl border border-border/60"><table className="w-full min-w-[620px] text-sm"><thead className="bg-muted/30 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground"><tr><th className="px-3 py-2">Oferta</th><th className="px-3 py-2 text-right">Mínimo</th><th className="px-3 py-2 text-right">Lista</th><th className="px-3 py-2">Conviene cuando</th><th className="px-3 py-2" /></tr></thead>
              <tbody>{(offers.data ?? []).map((offer) => (
                <tr key={offer.id} className={cn('border-t border-border/40', !offer.active && 'opacity-60')}>
                  <td className="px-3 py-2 font-semibold">{offer.name}{!offer.active && <span className="ml-2 text-[10px] font-black uppercase text-muted-foreground">Inactiva</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(offer.minPrice, offer.currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(offer.maxPrice, offer.currency)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{[...offer.industries, ...offer.signals.map((signal) => SIGNAL_LABEL[signal] ?? signal)].join(' · ') || 'Cualquiera'}</td>
                  <td className="px-3 py-2 text-right">{isAdmin && <Button type="button" variant="ghost" size="sm" aria-label={`Editar ${offer.name}`} onClick={() => setEditing(offer)}><Pencil className="size-4" /></Button>}</td>
                </tr>))}</tbody></table></div>
          )}
      </section>

      <section className="space-y-3" aria-label="Solicitudes de descuento">
        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Descuentos por debajo del mínimo · {pending.length} pendiente{pending.length === 1 ? '' : 's'}</h3>
        {discounts.isLoading ? <Skeleton className="h-16 w-full rounded-2xl" aria-busy="true" />
          : pending.length + done.length === 0 ? <p className="text-xs text-muted-foreground">No hay solicitudes. Cuando alguien necesite bajar de un precio mínimo, la pide desde el lead y aparece aquí.</p>
          : <ul className="space-y-2">{[...pending, ...done].map((request) => <DiscountRow key={request.id} request={request} canDecide={isAdmin} onChanged={refresh} />)}</ul>}
      </section>

      {editing && <OfferDialog key={editing === 'new' ? 'new' : editing.id} offer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
