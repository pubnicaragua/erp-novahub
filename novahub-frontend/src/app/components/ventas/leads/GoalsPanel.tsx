import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Skeleton } from '../../ui/skeleton';
import { cn } from '../../ui/utils';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { businessLeadsService, type LeadGoalSettings, type LeadOffer, type SellerProfile } from '../../../services/business-leads.service';
import { failure } from './leadUtils';

const field = 'h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary';
const hours = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ''}`.trim() : `${minutes} min`);
const split = (value: string) => value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
const emptyProfile: SellerProfile = { focusIndustries: [], focusCountries: [], offerIds: [], notes: null };

function SettingsEditor({ data, offers }: { data: LeadGoalSettings; offers: LeadOffer[] }) {
  const client = useQueryClient();
  const [form, setForm] = useState<{ dailyGoal: string; warnAt: string; closeAt: string; goalUserIds: string[]; profiles: Record<string, SellerProfile>; companyPitch: string; idealClient: string; tone: 'USTED' | 'TU'; landingUrl: string }>(() => ({ companyPitch: data.companyPitch ?? '', idealClient: data.idealClient ?? '', tone: data.tone, landingUrl: data.landingUrl ?? '', dailyGoal: String(data.dailyGoal), warnAt: data.warnAt, closeAt: data.closeAt, goalUserIds: data.goalUserIds, profiles: Object.fromEntries(Object.entries(data.sellerProfiles).filter(([, value]) => value).map(([id, value]) => [id, value as SellerProfile])) }));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await businessLeadsService.updateSettings({ dailyGoal: Number(form.dailyGoal), warnAt: form.warnAt, closeAt: form.closeAt, goalUserIds: form.goalUserIds, sellerProfiles: form.profiles, companyPitch: form.companyPitch.trim() || null, idealClient: form.idealClient.trim() || null, tone: form.tone, landingUrl: form.landingUrl.trim() || null });
      toast.success('Metas guardadas');
      void client.invalidateQueries({ queryKey: ['tenant-module'] });
    } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  const profile = (id: string): SellerProfile => form.profiles[id] ?? emptyProfile;
  const setProfile = (id: string, patch: Partial<SellerProfile>) => setForm((current) => ({ ...current, profiles: { ...current.profiles, [id]: { ...profile(id), ...patch } } }));

  return (
      <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-4" aria-label="Ajustes de metas">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Metas y horario del equipo</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-semibold">Meta diaria por persona<Input type="number" min="0" max="200" value={form.dailyGoal} onChange={(e) => setForm({ ...form, dailyGoal: e.target.value })} /></label>
            <label className="space-y-1 text-xs font-semibold">Primer aviso a las<input type="time" className={field} value={form.warnAt} onChange={(e) => setForm({ ...form, warnAt: e.target.value })} /></label>
            <label className="space-y-1 text-xs font-semibold">Cierre del día a las<input type="time" className={field} value={form.closeAt} onChange={(e) => setForm({ ...form, closeAt: e.target.value })} /></label>
          </div>
          <div className="grid gap-3 rounded-xl border border-border/50 bg-muted/10 p-3 sm:grid-cols-2" aria-label="Datos de la empresa para el asistente">
            <p className="text-xs text-muted-foreground sm:col-span-2"><b>Lo que sabe el asistente de tu empresa.</b> Lo usa el chat y los prompts para ChatGPT o Claude. Mientras mejor lo describas, mejores sugerencias.</p>
            <label className="space-y-1 text-xs font-semibold sm:col-span-2">Quiénes somos y qué vendemos<textarea className="min-h-[64px] w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm font-normal" maxLength={1200} value={form.companyPitch} onChange={(e) => setForm({ ...form, companyPitch: e.target.value })} placeholder="Somos NovaHub, una empresa nicaragüense que vende páginas web, tiendas en línea y sistemas a la medida…" /></label>
            <label className="space-y-1 text-xs font-semibold sm:col-span-2">Cliente ideal<textarea className="min-h-[64px] w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm font-normal" maxLength={1200} value={form.idealClient} onChange={(e) => setForm({ ...form, idealClient: e.target.value })} placeholder="Empresas con dinero para invertir que buscan software a la medida o llevan planilla y contabilidad en Excel…" /></label>
            <label className="space-y-1 text-xs font-semibold">Página o presentación para enviarle al cliente<Input value={form.landingUrl} onChange={(e) => setForm({ ...form, landingUrl: e.target.value })} placeholder="https://…" /></label>
            <label className="space-y-1 text-xs font-semibold">Cómo les hablamos a los clientes<select className={field} value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value as 'USTED' | 'TU' })}><option value="USTED">De usted</option><option value="TU">De tú</option></select></label>
          </div>
          <fieldset className="space-y-2"><legend className="text-xs font-semibold">¿A quién le corresponde la meta? <span className="font-normal text-muted-foreground">(si no eliges a nadie, a quienes registraron leads en los últimos 14 días)</span></legend>
            <div className="space-y-2">{data.users.map((user) => {
              const checked = form.goalUserIds.includes(user.id);
              const p = profile(user.id);
              return (
                <div key={user.id} className="rounded-xl border border-border/50 p-2.5">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={checked} onChange={() => setForm({ ...form, goalUserIds: checked ? form.goalUserIds.filter((id) => id !== user.id) : [...form.goalUserIds, user.id] })} />{user.name}</label>
                  {checked && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="space-y-1 text-[11px] font-semibold">Meta propia (vacío = la del equipo)<Input type="number" min="0" max="200" value={p.dailyGoal ?? ''} onChange={(e) => setProfile(user.id, { dailyGoal: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
                      <label className="space-y-1 text-[11px] font-semibold">Giros en los que se enfoca<Input value={p.focusIndustries.join(', ')} onChange={(e) => setProfile(user.id, { focusIndustries: split(e.target.value) })} placeholder="clínicas, tiendas" /></label>
                      <label className="space-y-1 text-[11px] font-semibold">Países en los que se enfoca<Input value={p.focusCountries.join(', ')} onChange={(e) => setProfile(user.id, { focusCountries: split(e.target.value) })} placeholder="Nicaragua, Costa Rica" /></label>
                      <label className="space-y-1 text-[11px] font-semibold">Notas para el asistente<Input value={p.notes ?? ''} maxLength={500} onChange={(e) => setProfile(user.id, { notes: e.target.value || null })} placeholder="Ej.: vende mejor a dueños de restaurantes" /></label>
                      {offers.length > 0 && (
                        <fieldset className="space-y-1 sm:col-span-2"><legend className="text-[11px] font-semibold">Ofertas que puede proponer <span className="font-normal text-muted-foreground">(ninguna marcada = todas)</span></legend>
                          <div className="flex flex-wrap gap-1.5">{offers.filter((offer) => offer.active).map((offer) => {
                            const on = p.offerIds.includes(offer.id);
                            return <label key={offer.id} className={cn('cursor-pointer rounded-full border px-2.5 py-1 text-xs font-semibold', on ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground')}><input type="checkbox" className="sr-only" checked={on} onChange={() => setProfile(user.id, { offerIds: on ? p.offerIds.filter((id) => id !== offer.id) : [...p.offerIds, offer.id] })} />{offer.name}</label>;
                          })}</div>
                        </fieldset>
                      )}
                    </div>
                  )}
                </div>
              );
            })}</div>
          </fieldset>
          <div className="flex justify-end"><Button type="button" onClick={() => void save()} disabled={busy}>Guardar metas</Button></div>
        </section>
      );
}

/** Cuántos leads lleva cada persona hoy frente a su meta y, para el administrador, los ajustes del equipo y de cada vendedor. */
export function GoalsPanel({ isAdmin }: { isAdmin: boolean }) {
  const progress = useTenantQuery(['sales', 'business-leads-progress'], (signal) => businessLeadsService.progress(signal), { staleTime: 30_000, refetchInterval: 60_000 });
  const settings = useTenantQuery(['sales', 'business-leads-settings'], (signal) => businessLeadsService.settings(signal), { staleTime: 30_000 });
  const offers = useTenantQuery(['sales', 'business-leads-offers'], (signal) => businessLeadsService.offers(signal), { staleTime: 30_000, enabled: isAdmin });
  const data = progress.data;

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-label="Avance de hoy">
        {progress.isLoading ? <Skeleton className="h-24 w-full rounded-2xl" aria-busy="true" />
          : !data ? <p className="text-sm text-destructive" role="alert">No se pudo cargar el avance.</p>
          : (
            <>
              <p className="text-xs text-muted-foreground">{data.phase === 'CLOSED' ? `El día cerró a las ${data.closeAt}.` : data.phase === 'WARN' ? `Faltan ${hours(data.minutesToClose)} para cerrar (${data.closeAt}).` : `El aviso llega a las ${data.warnAt}; el cierre es a las ${data.closeAt}.`}</p>
              {data.people.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nadie tiene meta todavía. {isAdmin ? 'Elige abajo a quién le corresponde.' : ''}</p>
                : <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.people.map((person) => {
                  const pct = person.goal > 0 ? Math.min(100, Math.round((person.count / person.goal) * 100)) : 100;
                  return (
                    <li key={person.userId} className="space-y-1.5 rounded-xl border border-border/60 bg-card p-3">
                      <div className="flex items-baseline justify-between gap-2"><p className="truncate text-sm font-bold">{person.name}</p><p className={cn('text-sm font-black tabular-nums', person.met ? 'text-emerald-700' : data.phase === 'BEFORE' ? '' : 'text-red-700')}>{person.count}/{person.goal}</p></div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Meta de ${person.name}`}><div className={cn('h-full rounded-full', person.met ? 'bg-emerald-600' : 'bg-primary')} style={{ width: `${pct}%` }} /></div>
                      <p className="text-[11px] text-muted-foreground">{person.met ? 'Meta cumplida' : `Faltan ${person.goal - person.count}`}</p>
                    </li>
                  );
                })}</ul>}
            </>
          )}
      </section>

      {isAdmin && settings.data && <SettingsEditor key={JSON.stringify(settings.data)} data={settings.data} offers={offers.data ?? []} />}
    </div>
  );
}
