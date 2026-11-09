import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Skeleton } from '../../ui/skeleton';
import { Textarea } from '../../ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { cn } from '../../ui/utils';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import {
  ACTIVITY_LABEL, HEALTH_LABEL, SIGNAL_LABEL, SOURCE_LABEL, STAGES, businessLeadsService, formatMoney, type ActivityKind, type LeadDetail, type LeadInput, type LeadSource, type LeadStage,
} from '../../../services/business-leads.service';

import { AssistantChat } from './AssistantChat';
import { OfferAdvisor } from './OfferAdvisor';
import { failure } from './leadUtils';
const field = 'h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary';
const dateOnly = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');
const when = (iso: string) => new Date(iso).toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' });

interface FormState {
  company: string; contactName: string; contactRole: string; phone: string; email: string; businessLine: string; source: LeadSource; estimatedValue: string; currency: string;
  probability: string; expectedCloseDate: string; nextAction: string; nextActionAt: string; strategy: string; introducedByContactId: string;
  country: string; website: string; industry: string; audienceSize: string; budgetEstimate: string; signals: string[];
}
const blank: FormState = {
  company: '', contactName: '', contactRole: '', phone: '', email: '', businessLine: '', source: 'OTHER', estimatedValue: '', currency: 'USD', probability: '', expectedCloseDate: '',
  nextAction: '', nextActionAt: '', strategy: '', introducedByContactId: '',
  country: '', website: '', industry: '', audienceSize: '', budgetEstimate: '', signals: [],
};
const fromLead = (lead: LeadDetail): FormState => ({
  company: lead.company, contactName: lead.contactName ?? '', contactRole: lead.contactRole ?? '', phone: lead.phone ?? '', email: lead.email ?? '', businessLine: lead.businessLine ?? '',
  source: lead.source, estimatedValue: lead.estimatedValue === null ? '' : String(lead.estimatedValue), currency: lead.currency, probability: String(lead.probability),
  expectedCloseDate: dateOnly(lead.expectedCloseDate), nextAction: lead.nextAction ?? '', nextActionAt: dateOnly(lead.nextActionAt), strategy: lead.strategy ?? '', introducedByContactId: lead.introducedByContactId ?? '',
  country: lead.country ?? '', website: lead.website ?? '', industry: lead.industry ?? '', audienceSize: lead.audienceSize === null ? '' : String(lead.audienceSize),
  budgetEstimate: lead.budgetSource === 'MANUAL' && lead.budgetEstimate !== null ? String(lead.budgetEstimate) : '', signals: lead.signals ?? [],
});
const toInput = (form: FormState, withStage?: LeadStage): LeadInput => ({
  company: form.company.trim(), contactName: form.contactName.trim() || null, contactRole: form.contactRole.trim() || null, phone: form.phone.trim() || null, email: form.email.trim() || null,
  businessLine: form.businessLine.trim() || null, source: form.source, estimatedValue: form.estimatedValue === '' ? null : Number(form.estimatedValue), currency: form.currency,
  ...(form.probability !== '' ? { probability: Number(form.probability) } : {}), expectedCloseDate: form.expectedCloseDate || null, nextAction: form.nextAction.trim() || null,
  nextActionAt: form.nextActionAt || null, strategy: form.strategy.trim() || null, introducedByContactId: form.introducedByContactId || null, ...(withStage ? { stage: withStage } : {}),
  country: form.country.trim() || null, website: form.website.trim() || null, industry: form.industry.trim() || null, audienceSize: form.audienceSize === '' ? null : Number(form.audienceSize),
  budgetEstimate: form.budgetEstimate === '' ? null : Number(form.budgetEstimate), signals: form.signals,
});

/** Crear un lead (rápido, pensado para cargar varios al día) o abrir uno para trabajarlo: datos, estrategia, bitácora y etapa. */
export function LeadDialog({ leadId, businessLines, initial, onClose }: { leadId: string | null; businessLines: string[]; initial?: Partial<LeadInput>; onClose: () => void }) {
  const detail = useTenantQuery(['sales', 'business-lead', leadId], (signal) => businessLeadsService.get(leadId as string, signal), { enabled: Boolean(leadId), staleTime: 0 });
  if (leadId && detail.isLoading) {
    return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Lead</DialogTitle><DialogDescription>Cargando…</DialogDescription></DialogHeader><Skeleton className="h-64 w-full" aria-busy="true" /></DialogContent></Dialog>;
  }
  if (leadId && !detail.data) {
    return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent><DialogHeader><DialogTitle>Lead</DialogTitle><DialogDescription>No se pudo cargar el lead.</DialogDescription></DialogHeader></DialogContent></Dialog>;
  }
  return <LeadForm key={detail.data?.id ?? 'new'} lead={detail.data ?? null} businessLines={businessLines} initial={initial} onClose={onClose} />;
}

function LeadForm({ lead, businessLines, initial, onClose }: { lead: LeadDetail | null; businessLines: string[]; initial?: Partial<LeadInput>; onClose: () => void }) {
  const client = useQueryClient();
  const { canPerform } = useAuth();
  const canEdit = canPerform('SALES_LEADS', lead ? 'edit' : 'create');
  const contacts = useTenantQuery(['sales', 'business-leads-network'], (signal) => businessLeadsService.network(signal), { staleTime: 30_000 });
  const [form, setForm] = useState<FormState>(() => (lead ? fromLead(lead) : { ...blank, ...Object.fromEntries(Object.entries(initial ?? {}).map(([key, value]) => [key, value === null || value === undefined ? '' : String(value)])) }));
  const [busy, setBusy] = useState(false);
  const [logKind, setLogKind] = useState<ActivityKind>('CALL');
  const [logText, setLogText] = useState('');
  const [logNextAction, setLogNextAction] = useState('');
  const [logNextAt, setLogNextAt] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [askLost, setAskLost] = useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const refresh = () => { void client.invalidateQueries({ queryKey: ['tenant-module'] }); };

  const run = async (action: () => Promise<unknown>, success: string, closeAfter = false) => {
    setBusy(true);
    try { await action(); toast.success(success); refresh(); if (closeAfter) onClose(); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  const save = () => run(() => (lead ? businessLeadsService.update(lead.id, toInput(form)) : businessLeadsService.create(toInput(form, initial?.stage))), lead ? 'Lead guardado' : 'Lead registrado', true);
  const moveStage = (stage: LeadStage, reason?: string) => run(async () => { await businessLeadsService.changeStage(lead!.id, { stage, reason }); setAskLost(false); setLostReason(''); }, 'Etapa actualizada', stage === 'WON' || stage === 'LOST');
  const logActivity = () => run(async () => {
    await businessLeadsService.addActivity(lead!.id, { kind: logKind, message: logText.trim(), ...(logNextAt ? { nextActionAt: logNextAt } : {}), ...(logNextAction.trim() ? { nextAction: logNextAction.trim() } : {}) });
    setLogText(''); setLogNextAction(''); setLogNextAt('');
  }, 'Registrado');
  const health = lead ? HEALTH_LABEL[lead.health] : null;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">{lead ? lead.company : 'Nuevo lead'}{health && <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase', health.tone)}>{health.label}</span>}</DialogTitle>
          <DialogDescription>{lead ? `${lead.stageLabel}${lead.estimatedValue !== null ? ` · ${formatMoney(lead.estimatedValue, lead.currency)} · valor ponderado ${formatMoney(lead.weighted, lead.currency)}` : ''}` : 'Un lead no es una cotización: es alguien a quien queremos venderle. Regístralo apenas lo encuentres.'}</DialogDescription>
        </DialogHeader>

        {lead && canEdit && (
          <div className="space-y-2" role="group" aria-label="Etapa del lead">
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((stage) => (
                <button key={stage.id} type="button" disabled={busy || lead.stage === stage.id} aria-pressed={lead.stage === stage.id}
                  onClick={() => (stage.id === 'LOST' ? setAskLost(true) : void moveStage(stage.id))}
                  className={cn('rounded-lg border px-2.5 py-1 text-[11px] font-bold', lead.stage === stage.id ? `${stage.tone} border-transparent` : 'border-border hover:bg-muted/50')}>{stage.label}</button>
              ))}
            </div>
            {askLost && (
              <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-muted/30 p-3">
                <div className="min-w-[200px] flex-1 space-y-1"><Label htmlFor="ld-lost">¿Por qué se perdió?</Label><Input id="ld-lost" value={lostReason} maxLength={300} onChange={(e) => setLostReason(e.target.value)} placeholder="Sin presupuesto, eligió a otro…" /></div>
                <Button type="button" variant="outline" onClick={() => setAskLost(false)} disabled={busy}>Cancelar</Button>
                <Button type="button" onClick={() => void moveStage('LOST', lostReason)} disabled={busy || !lostReason.trim()}>Marcar perdido</Button>
              </div>
            )}
          </div>
        )}

        {lead && lead.reviewStatus === 'APPROVED' && <OfferAdvisor leadId={lead.id} canEdit={canEdit} />}
        {lead && <AssistantChat leadId={lead.id} className="border-t border-border pt-4" />}
        <fieldset disabled={!canEdit || busy} className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ld-company">Empresa o prospecto</Label><Input id="ld-company" value={form.company} maxLength={160} onChange={(e) => set('company', e.target.value)} placeholder="Starcell" /></div>
          <div className="space-y-1.5"><Label htmlFor="ld-contact">Contacto</Label><Input id="ld-contact" value={form.contactName} maxLength={120} onChange={(e) => set('contactName', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ld-role">Cargo</Label><Input id="ld-role" value={form.contactRole} maxLength={120} onChange={(e) => set('contactRole', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ld-phone">Teléfono / WhatsApp</Label><Input id="ld-phone" value={form.phone} maxLength={40} onChange={(e) => set('phone', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ld-email">Correo</Label><Input id="ld-email" type="email" value={form.email} maxLength={160} onChange={(e) => set('email', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ld-line">Línea de negocio</Label><Input id="ld-line" list="ld-lines" value={form.businessLine} maxLength={80} onChange={(e) => set('businessLine', e.target.value)} placeholder="Páginas web" /><datalist id="ld-lines">{businessLines.map((name) => <option key={name} value={name} />)}</datalist></div>
          <div className="space-y-1.5"><Label htmlFor="ld-source">¿Cómo lo encontramos?</Label><select id="ld-source" className={field} value={form.source} onChange={(e) => set('source', e.target.value as LeadSource)}>{(Object.keys(SOURCE_LABEL) as LeadSource[]).map((key) => <option key={key} value={key}>{SOURCE_LABEL[key]}</option>)}</select></div>
          <div className="space-y-1.5"><Label htmlFor="ld-country">País</Label><Input id="ld-country" value={form.country} maxLength={80} onChange={(e) => set('country', e.target.value)} placeholder="Nicaragua" /></div>
          <div className="space-y-1.5"><Label htmlFor="ld-website">Sitio web o red social</Label><Input id="ld-website" value={form.website} maxLength={200} onChange={(e) => set('website', e.target.value)} placeholder="instagram.com/negocio" /></div>
          <div className="space-y-1.5"><Label htmlFor="ld-industry">Giro del negocio</Label><Input id="ld-industry" value={form.industry} maxLength={80} onChange={(e) => set('industry', e.target.value)} placeholder="Restaurante, clínica, tienda…" /></div>
          <div className="space-y-1.5"><Label htmlFor="ld-audience">Seguidores o audiencia</Label><Input id="ld-audience" type="number" min="0" value={form.audienceSize} onChange={(e) => set('audienceSize', e.target.value)} placeholder="50000" /></div>
          <div className="space-y-1.5"><Label htmlFor="ld-value">¿Cuánto podría representar?</Label><div className="flex gap-2"><Input id="ld-value" type="number" min="0" step="0.01" value={form.estimatedValue} onChange={(e) => set('estimatedValue', e.target.value)} placeholder="1500" /><select aria-label="Moneda" className={`${field} w-24`} value={form.currency} onChange={(e) => set('currency', e.target.value)}><option>USD</option><option>NIO</option></select></div></div>
          <div className="space-y-1.5"><Label htmlFor="ld-prob">Probabilidad de cierre (%)</Label><Input id="ld-prob" type="number" min="0" max="100" value={form.probability} onChange={(e) => set('probability', e.target.value)} placeholder={lead ? undefined : 'Según la etapa'} /></div>
          <div className="space-y-1.5"><Label htmlFor="ld-close">Cierre estimado</Label><Input id="ld-close" type="date" value={form.expectedCloseDate} onChange={(e) => set('expectedCloseDate', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ld-intro">Nos acercó…</Label><select id="ld-intro" className={field} value={form.introducedByContactId} onChange={(e) => set('introducedByContactId', e.target.value)}><option value="">Nadie / no aplica</option>{contacts.data?.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.company ? ` · ${contact.company}` : ''}</option>)}</select></div>
          <div className="space-y-1.5"><Label htmlFor="ld-next">Siguiente paso</Label><Input id="ld-next" value={form.nextAction} maxLength={200} onChange={(e) => set('nextAction', e.target.value)} placeholder="Llamar para agendar reunión" /></div>
          <div className="space-y-1.5"><Label htmlFor="ld-nextat">¿Para cuándo?</Label><Input id="ld-nextat" type="date" value={form.nextActionAt} onChange={(e) => set('nextActionAt', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ld-budget">Presupuesto que tiene (si lo sabes)</Label><Input id="ld-budget" type="number" min="0" step="0.01" value={form.budgetEstimate} onChange={(e) => set('budgetEstimate', e.target.value)} placeholder={lead?.budgetEstimate != null ? `Estimado: ${lead.budgetEstimate}` : 'Se estima por las señales'} /></div>
          <fieldset className="space-y-1.5 sm:col-span-2"><legend className="text-sm font-medium">¿Qué sabemos de este prospecto?</legend><div className="flex flex-wrap gap-1.5">{Object.entries(SIGNAL_LABEL).map(([key, label]) => <label key={key} className={cn('cursor-pointer rounded-full border px-2.5 py-1 text-xs font-semibold', form.signals.includes(key) ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground')}><input type="checkbox" className="sr-only" checked={form.signals.includes(key)} onChange={() => set('signals', form.signals.includes(key) ? form.signals.filter((item) => item !== key) : [...form.signals, key])} />{label}</label>)}</div></fieldset>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ld-strategy">Estrategia: ¿cómo le entramos?</Label><Textarea id="ld-strategy" rows={3} value={form.strategy} maxLength={4000} onChange={(e) => set('strategy', e.target.value)} placeholder="Quién lo conoce, qué le duele, con qué ejemplo entrarle, si hay que activar un contacto…" /></div>
        </fieldset>

        {canEdit && <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cerrar</Button><Button type="button" onClick={() => void save()} disabled={busy || !form.company.trim()}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}{lead ? 'Guardar cambios' : 'Registrar lead'}</Button></div>}


        {lead && (
          <section className="space-y-3 border-t border-border pt-4" aria-label="Bitácora del lead">
            <h3 className="nh-section-title">Bitácora</h3>
            {canEdit && (
              <div className="grid gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 sm:grid-cols-[130px_1fr]">
                <select aria-label="Tipo de actividad" className={field} value={logKind} onChange={(e) => setLogKind(e.target.value as ActivityKind)}>{(['CALL', 'WHATSAPP', 'VISIT', 'MEETING', 'EMAIL', 'NOTE'] as ActivityKind[]).map((kind) => <option key={kind} value={kind}>{ACTIVITY_LABEL[kind]}</option>)}</select>
                <Input aria-label="Qué pasó" value={logText} maxLength={1000} onChange={(e) => setLogText(e.target.value)} placeholder="¿Qué pasó? Ej.: pidió ver ejemplos" />
                <Input aria-label="Siguiente paso" className="sm:col-start-2" value={logNextAction} maxLength={200} onChange={(e) => setLogNextAction(e.target.value)} placeholder="Siguiente paso (opcional)" />
                <div className="flex gap-2 sm:col-start-2"><Input aria-label="Fecha del siguiente paso" type="date" value={logNextAt} onChange={(e) => setLogNextAt(e.target.value)} /><Button type="button" onClick={() => void logActivity()} disabled={busy || !logText.trim()}>Registrar</Button></div>
              </div>
            )}
            {lead.activities.length === 0 ? <p className="text-xs text-muted-foreground">Aún no hay movimientos.</p> : (
              <ol className="space-y-2">{lead.activities.map((activity) => <li key={activity.id} className="rounded-lg border border-border/50 px-3 py-2 text-sm"><p className="text-[11px] text-muted-foreground"><b>{ACTIVITY_LABEL[activity.kind] ?? activity.kind}</b> · {activity.userName} · {when(activity.createdAt)}</p><p className="mt-0.5 break-words">{activity.message}</p></li>)}</ol>
            )}
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
