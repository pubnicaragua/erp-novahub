import { useRef, useState } from 'react';
import { CheckCircle2, FileSignature, Loader2, Paperclip, Plus, Printer, Trash2 } from 'lucide-react';
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
import { storageService } from '../../../services/storage.service';
import { BILLING_LABEL, CONTRACT_HEALTH_LABEL, CONTRACT_STATUS_LABEL, clientContractsService, type BillingFrequency, type ContractDetail, type ContractStatus } from '../../../services/client-contracts.service';
import { getCurrencyDecimalPlaces } from '../../../utils/currency';

const failure = (error: unknown) => (error as any)?.response?.data?.message?.toString?.() || (error as Error)?.message || 'No se pudo completar la acción.';
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-NI', { dateStyle: 'medium', timeZone: 'UTC' }) : '—');
const iso = (value: string | null) => (value ? value.slice(0, 10) : '');
const money = (amount: number, currency: string) => `${currency} ${new Intl.NumberFormat('es-NI', { minimumFractionDigits: getCurrencyDecimalPlaces() }).format(amount)}`;
const field = 'h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60';
type Tab = 'resumen' | 'texto' | 'hitos' | 'seguimiento';

function printContractText(contract: ContractDetail) {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) { toast.error('Tu navegador bloqueó la ventana de impresión. Permite las ventanas emergentes.'); return; }
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escape(contract.number)}</title><style>body{font-family:Georgia,serif;max-width:760px;margin:32px auto;padding:0 24px;line-height:1.6;color:#111}pre{white-space:pre-wrap;font-family:inherit;font-size:14px;text-align:justify}@media print{body{margin:0}}</style></head><body><pre>${escape(contract.body)}</pre></body></html>`);
  win.document.close();
  win.focus();
  win.setTimeout(() => win.print(), 300);
}

/** Contrato con un cliente: datos, texto editable, hitos, seguimiento y los pasos del ciclo (firma, suspensión, renovación). */
export function ClientContractDialog({ contractId, onClose, onChanged }: { contractId: string; onClose: () => void; onChanged: () => void }) {
  const client = useQueryClient();
  const { canPerform } = useAuth();
  const canEdit = canPerform('SALES_QUOTES', 'edit');
  const query = useTenantQuery(['sales', 'client-contract', contractId], (signal) => clientContractsService.get(contractId, signal), { staleTime: 0 });
  const [tab, setTab] = useState<Tab>('resumen');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [body, setBody] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signer, setSigner] = useState('');
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [renewDate, setRenewDate] = useState('');
  const [mTitle, setMTitle] = useState(''); const [mDue, setMDue] = useState(''); const [mAmount, setMAmount] = useState('');
  const [note, setNote] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const [nowTs] = useState(() => Date.now());
  const contract = query.data;

  const refresh = async () => { await query.refetch(); void client.invalidateQueries({ queryKey: ['tenant-module'] }); onChanged(); };
  const run = async (action: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try { await action(); if (done) toast.success(done); await refresh(); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  const value = (key: string, fallback: string | boolean) => (key in draft ? draft[key] : fallback);
  const set = (key: string, next: string | boolean) => setDraft((current) => ({ ...current, [key]: next }));
  const isDraft = contract?.status === 'DRAFT';
  const closed = contract?.status === 'COMPLETED' || contract?.status === 'CANCELLED';
  const editable = canEdit && !closed;

  const saveFields = () => {
    if (!contract) return;
    const data: Record<string, unknown> = {};
    for (const [key, next] of Object.entries(draft)) data[key] = key === 'amount' || key === 'renewalNoticeDays' ? Number(next) : next === '' && (key === 'startDate' || key === 'endDate') ? null : next;
    void run(async () => { await clientContractsService.update(contract.id, data as any); setDraft({}); }, 'Cambios guardados');
  };
  const step = (status: ContractStatus, extra: { note?: string } = {}) => contract && run(() => clientContractsService.transition(contract.id, { status, ...extra }), 'Estado actualizado');
  const confirmSign = () => contract && run(async () => {
    let uploaded: { uri: string } | null = null;
    if (signedFile) uploaded = await storageService.uploadFile('client-contract', signedFile, { folder: 'client-contracts' });
    await clientContractsService.transition(contract.id, { status: 'ACTIVE', signedByClient: signer.trim(), startDate: contract.startDate ? undefined : new Date().toISOString().slice(0, 10), ...(uploaded ? { signedFileUri: uploaded.uri, signedFileName: signedFile?.name } : {}) });
    setSigning(false); setSigner(''); setSignedFile(null);
  }, 'Contrato firmado y vigente');
  const openSigned = async () => { try { const { url } = await clientContractsService.signedFileUrl(contractId); window.open(url, '_blank', 'noopener,noreferrer'); } catch (error) { toast.error(failure(error)); } };

  const tabs: Array<{ id: Tab; label: string }> = [{ id: 'resumen', label: 'Resumen' }, { id: 'texto', label: 'Texto del contrato' }, { id: 'hitos', label: `Hitos${contract ? ` (${contract.milestoneProgress.done}/${contract.milestoneProgress.total})` : ''}` }, { id: 'seguimiento', label: 'Seguimiento' }];

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">{contract ? `${contract.number} · ${contract.title}` : 'Contrato'}{contract && <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', CONTRACT_STATUS_LABEL[contract.status].tone)}>{CONTRACT_STATUS_LABEL[contract.status].label}</span>}{contract && CONTRACT_HEALTH_LABEL[contract.health] && <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', CONTRACT_HEALTH_LABEL[contract.health]!.tone)}>{CONTRACT_HEALTH_LABEL[contract.health]!.label}</span>}</DialogTitle>
          <DialogDescription>{contract ? `${contract.clientName} · ${money(contract.amount, contract.currency)} · ${BILLING_LABEL[contract.billingFrequency]}` : 'Cargando…'}</DialogDescription>
        </DialogHeader>
        {query.isLoading || !contract ? <Skeleton className="h-64 w-full" aria-busy="true" /> : (
          <div className="space-y-4">
            <div role="tablist" aria-label="Secciones del contrato" className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/30 p-1">
              {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={cn('whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold', tab === item.id ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground')}>{item.label}</button>)}
            </div>

            {tab === 'resumen' && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5"><Label htmlFor="cc-client">Cliente</Label><Input id="cc-client" disabled={!isDraft || !editable} value={String(value('clientName', contract.clientName))} onChange={(e) => set('clientName', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="cc-contact">Contacto</Label><Input id="cc-contact" disabled={!editable} value={String(value('contactName', contract.contactName ?? ''))} onChange={(e) => set('contactName', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="cc-email">Correo del contacto</Label><Input id="cc-email" type="email" disabled={!editable} value={String(value('contactEmail', contract.contactEmail ?? ''))} onChange={(e) => set('contactEmail', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="cc-title">Título</Label><Input id="cc-title" disabled={!isDraft || !editable} value={String(value('title', contract.title))} onChange={(e) => set('title', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="cc-amount">Monto ({contract.currency})</Label><Input id="cc-amount" type="number" min="0" step="0.01" disabled={!isDraft || !editable} value={String(value('amount', String(contract.amount)))} onChange={(e) => set('amount', e.target.value)} currencyPrecision /></div>
                  <div className="space-y-1.5"><Label htmlFor="cc-bill">Facturación</Label><select id="cc-bill" className={field} disabled={!isDraft || !editable} value={String(value('billingFrequency', contract.billingFrequency))} onChange={(e) => set('billingFrequency', e.target.value)}>{(Object.keys(BILLING_LABEL) as BillingFrequency[]).map((key) => <option key={key} value={key}>{BILLING_LABEL[key]}</option>)}</select></div>
                  <div className="space-y-1.5"><Label htmlFor="cc-start">Inicio</Label><Input id="cc-start" type="date" disabled={!isDraft || !editable} value={String(value('startDate', iso(contract.startDate)))} onChange={(e) => set('startDate', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="cc-end">Fin</Label><Input id="cc-end" type="date" disabled={!editable} value={String(value('endDate', iso(contract.endDate)))} onChange={(e) => set('endDate', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="cc-notice">Avisar antes de vencer (días)</Label><Input id="cc-notice" type="number" min="0" max="365" disabled={!editable} value={String(value('renewalNoticeDays', String(contract.renewalNoticeDays)))} onChange={(e) => set('renewalNoticeDays', e.target.value)} /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cc-terms">Condiciones de pago</Label><Input id="cc-terms" disabled={!editable} value={String(value('paymentTerms', contract.paymentTerms ?? ''))} onChange={(e) => set('paymentTerms', e.target.value)} placeholder="Ej. Pago a 15 días de la factura" /></div>
                  <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" disabled={!editable} checked={Boolean(value('autoRenew', contract.autoRenew))} onChange={(e) => set('autoRenew', e.target.checked)} /> Se renueva solo</label>
                </div>
                {contract.description && <div><p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Alcance</p><pre className="mt-1 whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/20 p-3 font-sans text-sm">{contract.description}</pre></div>}
                {contract.signedAt && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><CheckCircle2 className="mr-1 inline size-4" aria-hidden /> Firmado por {contract.signedByClient} el {day(contract.signedAt)}. {contract.signedFileName && <button type="button" className="font-semibold underline" onClick={() => void openSigned()}>Abrir copia firmada ({contract.signedFileName})</button>}</p>}
                {Object.keys(draft).length > 0 && <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDraft({})} disabled={busy}>Descartar</Button><Button type="button" onClick={saveFields} disabled={busy}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Guardar cambios</Button></div>}
              </div>
            )}

            {tab === 'texto' && (
              <div className="space-y-3">
                <Textarea aria-label="Texto del contrato" rows={20} readOnly={!isDraft || !editable} value={body ?? contract.body} onChange={(e) => setBody(e.target.value)} className="font-serif text-[13px] leading-relaxed" />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => printContractText({ ...contract, body: body ?? contract.body })}><Printer className="mr-1.5 size-4" /> Imprimir / PDF</Button>
                  {isDraft && editable && body !== null && body !== contract.body && <Button type="button" disabled={busy} onClick={() => void run(async () => { await clientContractsService.update(contract.id, { body: body ?? '' }); setBody(null); }, 'Texto guardado')}>Guardar texto</Button>}
                </div>
                {!isDraft && <p className="text-[11px] text-muted-foreground">El texto solo se edita mientras el contrato es borrador.</p>}
              </div>
            )}

            {tab === 'hitos' && (
              <div className="space-y-3">
                {contract.milestones.length === 0 ? <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">Sin hitos. Agrega las entregas o pagos acordados para darles seguimiento.</p> : (
                  <ul className="space-y-2">
                    {contract.milestones.map((milestone) => {
                      const overdue = milestone.status === 'PENDING' && milestone.dueDate && new Date(milestone.dueDate).getTime() + 86_400_000 < nowTs;
                      return (
                        <li key={milestone.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3 text-sm">
                          <div className="min-w-0"><p className={cn('break-words font-semibold', milestone.status === 'CANCELLED' && 'line-through opacity-60')}>{milestone.title}</p><p className="text-xs text-muted-foreground">{milestone.dueDate ? `Vence ${day(milestone.dueDate)}` : 'Sin fecha'}{milestone.amount !== null ? ` · ${money(milestone.amount, contract.currency)}` : ''}{milestone.completedAt ? ` · cumplido ${day(milestone.completedAt)}` : ''}</p></div>
                          <div className="flex items-center gap-2">
                            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', milestone.status === 'DONE' ? 'bg-emerald-100 text-emerald-900' : overdue ? 'bg-red-100 text-red-900' : 'bg-slate-100 text-slate-800')}>{milestone.status === 'DONE' ? 'Cumplido' : milestone.status === 'CANCELLED' ? 'Cancelado' : overdue ? 'Atrasado' : 'Pendiente'}</span>
                            {editable && milestone.status === 'PENDING' && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(() => clientContractsService.updateMilestone(contract.id, milestone.id, { status: 'DONE' }))}>Marcar cumplido</Button>}
                            {editable && milestone.status === 'DONE' && <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => void run(() => clientContractsService.updateMilestone(contract.id, milestone.id, { status: 'PENDING' }))}>Reabrir</button>}
                            {editable && <button type="button" aria-label={`Quitar ${milestone.title}`} className="text-muted-foreground hover:text-destructive" onClick={() => void run(() => clientContractsService.removeMilestone(contract.id, milestone.id))}><Trash2 className="size-4" /></button>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {editable && (
                  <div className="grid gap-3 rounded-xl border border-border/60 p-3 sm:grid-cols-6">
                    <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="ms-title">Nuevo hito</Label><Input id="ms-title" value={mTitle} maxLength={160} onChange={(e) => setMTitle(e.target.value)} placeholder="Entrega, pago, capacitación…" /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ms-due">Fecha</Label><Input id="ms-due" type="date" value={mDue} onChange={(e) => setMDue(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="ms-amount">Monto</Label><Input id="ms-amount" type="number" min="0" step="0.01" value={mAmount} onChange={(e) => setMAmount(e.target.value)} currencyPrecision /></div>
                    <div className="flex justify-end sm:col-span-6"><Button type="button" disabled={busy || !mTitle.trim()} onClick={() => void run(async () => { await clientContractsService.addMilestone(contract.id, { title: mTitle.trim(), dueDate: mDue || null, amount: mAmount === '' ? null : Number(mAmount) }); setMTitle(''); setMDue(''); setMAmount(''); })}><Plus className="mr-1.5 size-4" /> Agregar hito</Button></div>
                  </div>
                )}
              </div>
            )}

            {tab === 'seguimiento' && (
              <div className="space-y-3">
                {canEdit && <div className="flex gap-2"><Input aria-label="Nueva nota" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Anota una llamada, acuerdo o novedad" /><Button type="button" disabled={busy || !note.trim()} onClick={() => void run(async () => { await clientContractsService.addNote(contract.id, note.trim()); setNote(''); })}>Agregar</Button></div>}
                <ul className="space-y-2">
                  {contract.events.map((event) => <li key={event.id} className="rounded-xl border border-border/60 px-3 py-2 text-sm"><p className="break-words">{event.message}</p><p className="text-[11px] text-muted-foreground">{event.userName} · {new Date(event.createdAt).toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' })}</p></li>)}
                </ul>
              </div>
            )}

            {editable && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-border/50 pt-3">
                {contract.status === 'DRAFT' && <Button type="button" disabled={busy} onClick={() => void step('PENDING_SIGNATURE')}><FileSignature className="mr-1.5 size-4" /> Enviar a firma</Button>}
                {contract.status === 'PENDING_SIGNATURE' && <><Button type="button" variant="outline" disabled={busy} onClick={() => void step('DRAFT')}>Volver a borrador</Button><Button type="button" disabled={busy} onClick={() => setSigning(true)}><CheckCircle2 className="mr-1.5 size-4" /> Registrar firma del cliente</Button></>}
                {contract.status === 'ACTIVE' && <><Button type="button" variant="outline" disabled={busy} onClick={() => setRenewing(true)}>Renovar</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void step('SUSPENDED')}>Suspender</Button><Button type="button" disabled={busy} onClick={() => void step('COMPLETED')}>Marcar completado</Button></>}
                {contract.status === 'SUSPENDED' && <Button type="button" disabled={busy} onClick={() => void step('ACTIVE')}>Reanudar</Button>}
                <Button type="button" variant="ghost" className="text-destructive" disabled={busy} onClick={() => { if (window.confirm('¿Cancelar este contrato? Ya no podrá editarse.')) void step('CANCELLED'); }}>Cancelar contrato</Button>
              </div>
            )}

            {signing && (
              <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <p className="font-semibold">Registrar la firma del cliente</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="sg-who">¿Quién firmó por el cliente?</Label><Input id="sg-who" value={signer} onChange={(e) => setSigner(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="sg-file">Copia firmada (PDF o imagen, opcional)</Label><input id="sg-file" ref={fileInput} type="file" accept=".pdf,image/*" className="block w-full text-sm" onChange={(e) => setSignedFile(e.target.files?.[0] ?? null)} /></div>
                </div>
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setSigning(false)}>Cancelar</Button><Button type="button" disabled={busy || signer.trim().length < 3} onClick={() => void confirmSign()}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Paperclip className="mr-2 size-4" />}Dejar vigente</Button></div>
              </div>
            )}
            {renewing && (
              <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <p className="font-semibold">Renovar contrato</p>
                <div className="space-y-1.5"><Label htmlFor="rn-date">Nueva fecha final</Label><Input id="rn-date" type="date" value={renewDate} onChange={(e) => setRenewDate(e.target.value)} /></div>
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setRenewing(false)}>Cancelar</Button><Button type="button" disabled={busy || !renewDate} onClick={() => void run(async () => { await clientContractsService.renew(contract.id, { endDate: renewDate }); setRenewing(false); setRenewDate(''); }, 'Contrato renovado')}>Renovar</Button></div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
