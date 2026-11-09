import { useState } from 'react';
import { MapPin, Play, Search, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { cn } from '../../ui/utils';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { SIGNAL_LABEL, businessLeadsService, type SearchResult } from '../../../services/business-leads.service';
import { failure } from './leadUtils';

const scoreTone = (score: number) => (score >= 60 ? 'bg-emerald-100 text-emerald-900' : score >= 30 ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-700');
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-NI', { day: 'numeric', month: 'short' }) : 'Nunca');

/** Búsqueda de negocios reales en Google Maps: solo abiertos, con su sitio web revisado y sin repetir lo que ya tienes. */
export function MapsSearch({ isAdmin, onSaved }: { isAdmin: boolean; onSaved: () => void }) {
  const client = useQueryClient();
  const profiles = useTenantQuery(['sales', 'business-leads-searches'], (signal) => businessLeadsService.searches(signal), { staleTime: 15_000 });
  const [form, setForm] = useState({ query: '', city: '', country: 'Nicaragua' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const refresh = () => { void client.invalidateQueries({ queryKey: ['tenant-module'] }); onSaved(); };

  const run = async () => {
    setBusy(true); setResult(null);
    try {
      const data = await businessLeadsService.searchPlaces({ query: form.query.trim(), city: form.city.trim(), country: form.country.trim() || undefined });
      setResult(data);
      setPicked(new Set(data.items.filter((item) => item.ready).map((item) => item.placeId)));
    } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  const save = async () => {
    if (!result) return;
    setBusy(true);
    try {
      const chosen = result.items.filter((item) => picked.has(item.placeId) && item.ready).map((item) => item.lead);
      const saved = await businessLeadsService.bulkCreatePending(chosen);
      toast.success(`${saved.created} negocio${saved.created === 1 ? '' : 's'} enviado${saved.created === 1 ? '' : 's'} a «Por revisar»`);
      setResult(null); refresh();
    } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  const saveProfile = async () => {
    try {
      await businessLeadsService.createSearch({ name: `${form.query.trim()} en ${form.city.trim()}`, query: form.query.trim(), city: form.city.trim(), country: form.country.trim() || 'Nicaragua' });
      toast.success('Búsqueda guardada: se repetirá sola y lo nuevo llegará a «Por revisar»');
      refresh();
    } catch (error) { toast.error(failure(error)); }
  };
  const toggle = (id: string) => setPicked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <section className="space-y-3 rounded-2xl border border-border/60 bg-card p-4" aria-label="Buscar en Google Maps">
      <h3 className="flex items-center gap-1.5 nh-section-title"><MapPin className="size-4 text-primary" aria-hidden /> Buscar negocios en Google Maps</h3>
      <p className="text-xs text-muted-foreground">Trae negocios reales y abiertos, revisa si su sitio web abre y qué tan abandonado está, y marca los que ya tienes. Cada búsqueda cuenta contra el cupo de Google (hasta 40 al día).</p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void run(); }} aria-label="Datos de la búsqueda">
        <label className="min-w-[180px] flex-1 space-y-1 text-xs font-semibold">Qué buscas<Input value={form.query} maxLength={80} onChange={(e) => setForm({ ...form, query: e.target.value })} placeholder="clínicas, restaurantes, ferreterías…" /></label>
        <label className="min-w-[140px] space-y-1 text-xs font-semibold">Ciudad<Input value={form.city} maxLength={80} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="León" /></label>
        <label className="min-w-[130px] space-y-1 text-xs font-semibold">País<Input value={form.country} maxLength={80} onChange={(e) => setForm({ ...form, country: e.target.value })} /></label>
        <Button type="submit" disabled={busy || form.query.trim().length < 2 || !form.city.trim()}><Search className="mr-1.5 size-4" />{busy && !result ? 'Buscando…' : 'Buscar'}</Button>
      </form>

      {result && (
        <div className="space-y-2" aria-label="Resultados de la búsqueda">
          <p className="text-xs text-muted-foreground">{result.summary.total} encontrados · <b>{result.summary.ready} listos para guardar</b>{result.summary.closed ? ` · ${result.summary.closed} cerrados (no se guardan)` : ''}{result.summary.duplicates ? ` · ${result.summary.duplicates} ya los tienes` : ''}. Te quedan {result.remainingToday} búsquedas hoy.</p>
          <ul className="space-y-2">
            {result.items.map((item) => (
              <li key={item.placeId} className={cn('flex min-w-0 items-start gap-3 rounded-xl border border-border/60 p-3', !item.ready && 'opacity-60')}>
                <input type="checkbox" aria-label={`Guardar ${item.name}`} className="mt-1" disabled={!item.ready} checked={picked.has(item.placeId)} onChange={() => toggle(item.placeId)} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="break-words text-sm font-bold">{item.name}</p><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', scoreTone(item.fitScore))}>{item.fitScore}/100</span>
                    {item.closed && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black uppercase text-slate-700">Cerrado</span>}
                    {item.duplicate && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900">Ya lo tienes: {item.duplicate.company}</span>}</div>
                  <p className="text-[11px] text-muted-foreground">{[item.address, item.lead.phone, item.rating !== null ? `${item.rating} ★${item.reviews !== null ? ` (${item.reviews})` : ''}` : null].filter(Boolean).join(' · ')}</p>
                  <div className="flex flex-wrap gap-1">{item.signals.filter((signal) => signal !== 'CLOSED').map((signal) => <span key={signal} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{SIGNAL_LABEL[signal] ?? signal}</span>)}{item.webProblems.map((problem) => <span key={problem} className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-900">{problem}</span>)}</div>
                  {item.mapsUrl && <a className="text-[11px] font-semibold text-primary underline" href={item.mapsUrl} target="_blank" rel="noreferrer">Ver en Google Maps</a>}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => void saveProfile()}>Repetir esta búsqueda cada semana</Button>
            <Button type="button" onClick={() => void save()} disabled={busy || picked.size === 0}>Enviar {picked.size} a «Por revisar»</Button>
          </div>
        </div>
      )}

      <div className="space-y-2 border-t border-border pt-3" aria-label="Búsquedas guardadas">
        <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Búsquedas que se repiten solas</h4>
        {(profiles.data ?? []).length === 0 ? <p className="text-xs text-muted-foreground">Aún no hay ninguna. Haz una búsqueda y pulsa «Repetir esta búsqueda cada semana»: de madrugada, NovaHub la ejecuta y deja lo nuevo en «Por revisar».</p>
          : (
            <ul className="space-y-1.5">{(profiles.data ?? []).map((profile) => (
              <li key={profile.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm">
                <div className="min-w-0"><p className="truncate font-semibold">{profile.name}{!profile.active && <span className="ml-2 text-[10px] font-black uppercase text-muted-foreground">En pausa</span>}</p><p className="text-[11px] text-muted-foreground">Cada {profile.frequencyDays} días · última vez {when(profile.lastRunAt)}{profile.lastRunAt ? ` (${profile.lastFound} nuevos)` : ''}{isAdmin && profile.ownerName ? ` · ${profile.ownerName}` : ''}</p></div>
                <div className="flex gap-1.5">
                  <Button type="button" size="sm" variant="outline" onClick={() => void businessLeadsService.runSearch(profile.id).then((r) => { toast.success(`${r.saved} nuevos enviados a «Por revisar»`); refresh(); }).catch((e) => toast.error(failure(e)))}><Play className="mr-1 size-3.5" />Ejecutar ahora</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void businessLeadsService.updateSearch(profile.id, { active: !profile.active }).then(refresh).catch((e) => toast.error(failure(e)))}>{profile.active ? 'Pausar' : 'Reanudar'}</Button>
                  <Button type="button" size="sm" variant="ghost" aria-label={`Borrar ${profile.name}`} onClick={() => void businessLeadsService.removeSearch(profile.id).then(refresh).catch((e) => toast.error(failure(e)))}><Trash2 className="size-4" /></Button>
                </div>
              </li>))}</ul>
          )}
      </div>
    </section>
  );
}
