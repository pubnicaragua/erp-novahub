import { useMemo, useState } from 'react';
import { Link2, Loader2, Plus, Trash2, UserPlus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
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
  CONTACT_KIND_LABEL, INTRO_LABEL, STAGES, businessLeadsService, formatMoneyMap, type ContactKind, type IntroStatus, type NetworkContact, type NetworkContactRow,
} from '../../../services/business-leads.service';
import { failure } from './leadUtils';

const field = 'h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary';
const KIND_COLOR: Record<ContactKind, string> = { CLIENT: '#059669', PARTNER: '#2563eb', SUPPLIER: '#7c3aed', FRIEND: '#d97706', OTHER: '#64748b' };
const STAGE_COLOR: Record<string, string> = { IDENTIFIED: '#94a3b8', CONTACTED: '#0ea5e9', MEETING: '#6366f1', PROPOSAL: '#f59e0b', NEGOTIATION: '#f97316', WON: '#10b981', LOST: '#cbd5e1' };
const short = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Mapa visual: nuestra empresa al centro, los contactos alrededor (tamaño = fuerza de la relación) y de cada uno los leads que trajo y a quién más nos puede acercar. */
function NetworkMap({ contacts, selectedId, onSelect, onOpenLead }: { contacts: NetworkContact[]; selectedId: string | null; onSelect: (id: string) => void; onOpenLead: (id: string) => void }) {
  const shown = contacts.slice(0, 16);
  const cx = 420; const cy = 270; const ring = 175;
  return (
    <svg viewBox="0 0 840 540" role="img" aria-label="Mapa de la red de contactos" className="h-auto w-full rounded-2xl border border-border/60 bg-muted/20">
      {shown.map((contact, index) => {
        const angle = (index / shown.length) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * ring; const y = cy + Math.sin(angle) * ring * 0.85;
        const children = [
          ...contact.leads.slice(0, 5).map((lead) => ({ key: lead.id, label: lead.company, color: STAGE_COLOR[lead.stage], dashed: false, leadId: lead.id })),
          ...contact.introductions.filter((intro) => !intro.leadId && intro.status !== 'DECLINED').slice(0, 3).map((intro) => ({ key: intro.id, label: intro.targetCompany || intro.targetName, color: '#cbd5e1', dashed: true, leadId: null as string | null })),
        ];
        return (
          <g key={contact.id}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.15 + contact.strength * 0.08} strokeWidth={1 + contact.strength * 0.5} />
            {children.map((child, childIndex) => {
              const spread = (childIndex - (children.length - 1) / 2) * 0.55;
              const out = Math.atan2(y - cy, x - cx) + spread;
              const lx = x + Math.cos(out) * 82; const ly = y + Math.sin(out) * 62;
              return (
                <g key={child.key} className={child.leadId ? 'cursor-pointer' : undefined} onClick={() => child.leadId && onOpenLead(child.leadId)}>
                  <line x1={x} y1={y} x2={lx} y2={ly} stroke={child.color} strokeWidth={1.5} strokeDasharray={child.dashed ? '4 3' : undefined} />
                  <circle cx={lx} cy={ly} r={9} fill={child.dashed ? 'none' : child.color} stroke={child.color} strokeWidth={2} strokeDasharray={child.dashed ? '3 2' : undefined} />
                  <text x={lx} y={ly + 21} textAnchor="middle" fontSize="10" fill="currentColor" opacity={0.8}>{short(child.label, 16)}</text>
                </g>
              );
            })}
            <g className="cursor-pointer" onClick={() => onSelect(contact.id)} role="button" tabIndex={0} aria-label={`Contacto ${contact.name}`} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect(contact.id); }}>
              <circle cx={x} cy={y} r={14 + contact.strength * 2.5} fill={KIND_COLOR[contact.kind]} fillOpacity={0.9} stroke={selectedId === contact.id ? 'currentColor' : 'white'} strokeWidth={selectedId === contact.id ? 4 : 2} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="white">{contact.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</text>
              <text x={x} y={y - 22 - contact.strength * 2.5} textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">{short(contact.name, 20)}</text>
            </g>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={44} className="fill-primary" />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="13" fontWeight="800" fill="white">Nuestra</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="13" fontWeight="800" fill="white">empresa</text>
    </svg>
  );
}

function ContactDialog({ contact, candidates, onClose }: { contact: NetworkContact | null; candidates: Array<{ id: string; name: string }>; onClose: () => void }) {
  const client = useQueryClient();
  const [form, setForm] = useState({ name: contact?.name ?? '', company: contact?.company ?? '', role: contact?.role ?? '', phone: contact?.phone ?? '', email: contact?.email ?? '', kind: (contact?.kind ?? 'OTHER') as ContactKind, strength: String(contact?.strength ?? 3), notes: contact?.notes ?? '' });
  const [busy, setBusy] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const refresh = () => { void client.invalidateQueries({ queryKey: ['tenant-module'] }); };
  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try { await action(); toast.success(success); refresh(); onClose(); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  const payload = (): Partial<NetworkContactRow> => ({ name: form.name.trim(), company: form.company.trim() || null, role: form.role.trim() || null, phone: form.phone.trim() || null, email: form.email.trim() || null, kind: form.kind, strength: Number(form.strength), notes: form.notes.trim() || null });
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{contact ? 'Editar contacto' : 'Nuevo contacto de la red'}</DialogTitle><DialogDescription>Personas que nos pueden acercar a otros clientes: clientes, aliados, proveedores o conocidos.</DialogDescription></DialogHeader>
        {!contact && candidates.length > 0 && (
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="min-w-[200px] flex-1 space-y-1"><Label htmlFor="nc-customer">Traer a un cliente que ya tenemos</Label><select id="nc-customer" className={field} value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Elegir…</option>{candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <Button type="button" variant="outline" disabled={!customerId || busy} onClick={() => void run(() => businessLeadsService.contactFromCustomer(customerId), 'Cliente agregado a la red')}>Agregar</Button>
          </div>
        )}
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ct-name">Nombre</Label><Input id="ct-name" value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ct-company">Empresa</Label><Input id="ct-company" value={form.company} maxLength={160} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ct-role">Cargo</Label><Input id="ct-role" value={form.role} maxLength={120} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ct-phone">Teléfono</Label><Input id="ct-phone" value={form.phone} maxLength={40} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ct-email">Correo</Label><Input id="ct-email" type="email" value={form.email} maxLength={160} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ct-kind">Tipo</Label><select id="ct-kind" className={field} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ContactKind })}>{(Object.keys(CONTACT_KIND_LABEL) as ContactKind[]).map((k) => <option key={k} value={k}>{CONTACT_KIND_LABEL[k]}</option>)}</select></div>
          <div className="space-y-1.5"><Label htmlFor="ct-strength">Fuerza de la relación</Label><select id="ct-strength" className={field} value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })}>{['1 · Apenas lo conocemos', '2', '3 · Buena', '4', '5 · Muy fuerte'].map((label, i) => <option key={label} value={i + 1}>{label}</option>)}</select></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ct-notes">Notas</Label><Textarea id="ct-notes" rows={3} value={form.notes} maxLength={2000} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Cómo lo conocimos, a qué se dedica, con quién se mueve…" /></div>
        </fieldset>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="button" disabled={busy || !form.name.trim()} onClick={() => void run(() => (contact ? businessLeadsService.updateContact(contact.id, payload()) : businessLeadsService.createContact(payload())), contact ? 'Contacto guardado' : 'Contacto agregado')}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Guardar</Button></div>
      </DialogContent>
    </Dialog>
  );
}

function ContactDetail({ contact, canEdit, canCreate, onEdit, onOpenLead }: { contact: NetworkContact; canEdit: boolean; canCreate: boolean; onEdit: () => void; onOpenLead: (id: string) => void }) {
  const client = useQueryClient();
  const [target, setTarget] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = () => { void client.invalidateQueries({ queryKey: ['tenant-module'] }); };
  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try { await action(); if (success) toast.success(success); refresh(); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  return (
    <Card className="min-w-0 space-y-4 rounded-2xl p-4" data-testid="network-contact">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><p className="break-words text-base font-black">{contact.name}</p><p className="text-xs text-muted-foreground">{[contact.role, contact.company, CONTACT_KIND_LABEL[contact.kind]].filter(Boolean).join(' · ')}</p>{(contact.phone || contact.email) && <p className="text-xs text-muted-foreground">{[contact.phone, contact.email].filter(Boolean).join(' · ')}</p>}</div>
        {canEdit && <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={onEdit}>Editar</Button><Button type="button" size="sm" variant="outline" aria-label={`Borrar a ${contact.name}`} disabled={busy} onClick={() => { if (window.confirm(`¿Borrar a ${contact.name} de la red? Los leads que trajo se conservan.`)) void run(() => businessLeadsService.removeContact(contact.id), 'Contacto borrado'); }}><Trash2 className="size-4" /></Button></div>}
      </div>
      {contact.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{contact.notes}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-muted/30 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">En proceso por su medio</p><p className="text-lg font-black">{formatMoneyMap(contact.pipeline)}</p></div>
        <div className="rounded-xl bg-muted/30 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ganado por su medio</p><p className="text-lg font-black text-emerald-700">{formatMoneyMap(contact.won)}</p></div>
      </div>
      {contact.leads.length > 0 && <div><p className="mb-1 text-xs font-black">Leads que trajo</p><div className="flex flex-wrap gap-2">{contact.leads.map((lead) => <button key={lead.id} type="button" onClick={() => onOpenLead(lead.id)} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted/50">{lead.company} · {STAGES.find((s) => s.id === lead.stage)?.label}</button>)}</div></div>}
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-black"><Link2 className="size-3.5" aria-hidden /> A quién nos puede acercar</p>
        {contact.introductions.length === 0 && <p className="text-xs text-muted-foreground">Todavía no hay ideas. Anota a quién conoce que nos serviría.</p>}
        <ul className="space-y-2">
          {contact.introductions.map((intro) => (
            <li key={intro.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm">
              <div className="min-w-0"><p className="break-words font-semibold">{intro.targetCompany ? `${intro.targetCompany} · ` : ''}{intro.targetName}</p>{intro.note && <p className="break-words text-xs text-muted-foreground">{intro.note}</p>}</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase', INTRO_LABEL[intro.status].tone)}>{INTRO_LABEL[intro.status].label}</span>
                {canEdit && !intro.leadId && (
                  <>
                    <select aria-label="Estado de la introducción" className="h-8 rounded-lg border border-border/60 bg-background px-2 text-xs" value={intro.status} disabled={busy} onChange={(e) => void run(() => businessLeadsService.updateIntroduction(intro.id, { status: e.target.value as IntroStatus }))}>{(Object.keys(INTRO_LABEL) as IntroStatus[]).filter((s) => s !== 'INTRODUCED').map((s) => <option key={s} value={s}>{INTRO_LABEL[s].label}</option>)}</select>
                    {canCreate && <Button type="button" size="sm" disabled={busy || intro.status === 'DECLINED'} onClick={() => void run(() => businessLeadsService.convertIntroduction(intro.id), 'Se creó el lead')}>Ya nos presentó → lead</Button>}
                  </>
                )}
                {intro.leadId && <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => onOpenLead(intro.leadId as string)}>Ver lead</button>}
              </div>
            </li>
          ))}
        </ul>
        {canCreate && (
          <div className="grid gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-2">
            <Input aria-label="Persona o cargo" value={target} maxLength={160} onChange={(e) => setTarget(e.target.value)} placeholder="¿A quién? (persona o cargo)" />
            <Input aria-label="Empresa a la que nos acerca" value={targetCompany} maxLength={160} onChange={(e) => setTargetCompany(e.target.value)} placeholder="Empresa" />
            <Input aria-label="Nota" className="sm:col-span-2" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Por qué nos sirve (ej.: importan celulares)" />
            <div className="sm:col-span-2"><Button type="button" size="sm" disabled={busy || !target.trim()} onClick={() => void run(async () => { await businessLeadsService.addIntroduction(contact.id, { targetName: target.trim(), targetCompany: targetCompany.trim() || undefined, note: note.trim() || undefined }); setTarget(''); setTargetCompany(''); setNote(''); }, 'Idea anotada')}><Plus className="mr-1 size-4" />Anotar idea</Button></div>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Red de contactos estratégica: mapa visual, lista de contactos y, para cada uno, a quién nos puede acercar. */
export function NetworkView({ onOpenLead }: { onOpenLead: (id: string) => void }) {
  const { canPerform } = useAuth();
  const canCreate = canPerform('SALES_QUOTES', 'create');
  const canEdit = canPerform('SALES_QUOTES', 'edit');
  const network = useTenantQuery(['sales', 'business-leads-network'], (signal) => businessLeadsService.network(signal), { staleTime: 15_000 });
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'new' | 'edit' | null>(null);
  const contacts = useMemo(() => network.data?.contacts ?? [], [network.data]);
  const selected = contacts.find((contact) => contact.id === pickedId) ?? contacts[0] ?? null;

  if (network.isLoading) return <Skeleton className="h-80 w-full rounded-2xl" aria-busy="true" />;
  if (network.isError || !network.data) return <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">No se pudo cargar la red de contactos.</p>;
  const { summary } = network.data;
  return (
    <div className="min-w-0 space-y-4" data-testid="network-view">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{summary.contacts} contactos · {summary.openIdeas} ideas de introducción abiertas · {summary.introduced} concretadas</p>
        {canCreate && <Button type="button" onClick={() => setDialog('new')}><UserPlus className="mr-1.5 size-4" />Nuevo contacto</Button>}
      </div>
      {contacts.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-8 text-center text-sm text-muted-foreground">Aquí vive tu red estratégica. Agrega a quienes te pueden presentar a nuevos clientes — o trae a un cliente que ya tienes y anota a quién más conoce.</Card>
      ) : (
        <>
          <NetworkMap contacts={contacts} selectedId={selected?.id ?? null} onSelect={setPickedId} onOpenLead={onOpenLead} />
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground" aria-hidden>
            {(Object.keys(CONTACT_KIND_LABEL) as ContactKind[]).map((kind) => <span key={kind} className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ background: KIND_COLOR[kind] }} />{CONTACT_KIND_LABEL[kind]}</span>)}
            <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full border-2 border-dashed border-slate-400" />Idea de introducción</span>
          </div>
          <div className="grid min-w-0 gap-4 lg:grid-cols-[260px_1fr]">
            <ul className="max-h-[420px] min-w-0 space-y-1 overflow-y-auto rounded-2xl border border-border/60 p-2" aria-label="Contactos">
              {contacts.map((contact) => (
                <li key={contact.id}><button type="button" onClick={() => setPickedId(contact.id)} aria-current={selected?.id === contact.id} className={cn('w-full rounded-xl px-3 py-2 text-left text-sm', selected?.id === contact.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50')}><span className="block truncate font-semibold">{contact.name}</span><span className="block truncate text-[11px] text-muted-foreground">{contact.company || CONTACT_KIND_LABEL[contact.kind]} · {contact.leads.length} leads · {contact.introductions.filter((i) => !i.leadId).length} ideas</span></button></li>
              ))}
            </ul>
            {selected && <ContactDetail key={selected.id} contact={selected} canEdit={canEdit} canCreate={canCreate} onEdit={() => setDialog('edit')} onOpenLead={onOpenLead} />}
          </div>
        </>
      )}
      {dialog === 'new' && <ContactDialog contact={null} candidates={network.data.customerCandidates} onClose={() => setDialog(null)} />}
      {dialog === 'edit' && selected && <ContactDialog key={selected.id} contact={selected} candidates={[]} onClose={() => setDialog(null)} />}
    </div>
  );
}
