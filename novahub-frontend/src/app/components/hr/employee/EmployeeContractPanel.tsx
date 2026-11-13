import { useState } from 'react';
import { CheckCircle2, Copy, FileSignature, Loader2, Printer, Send } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Skeleton } from '../../ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { RequiredReasonField } from '../../ui/RequiredReasonField';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { CONTRACT_STATUS_LABEL, employeeProfileService, type Contract } from '../../../services/employee-profile.service';

const failure = (error: unknown) => (error as any)?.response?.data?.message?.toString?.() || (error as Error)?.message || 'No se pudo completar la acción.';
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const TONE: Record<string, string> = { DRAFT: 'bg-slate-100 text-slate-800', SENT: 'bg-amber-100 text-amber-900', SIGNED: 'bg-emerald-100 text-emerald-900', EXPIRED: 'bg-red-100 text-red-900', CANCELLED: 'bg-slate-200 text-slate-600' };

/** Abre el contrato en una ventana limpia lista para imprimir o guardar como PDF. */
export function printContract(contract: Pick<Contract, 'title' | 'body' | 'signerName' | 'signedAt' | 'documentHash' | 'companySignerName' | 'companySignedAt'> & { signatureData?: string | null }) {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) { toast.error('Tu navegador bloqueó la ventana de impresión. Permite las ventanas emergentes.'); return; }
  const signed = contract.signedAt ? `<div class="sig"><p><strong>Firmado en línea por ${escape(contract.signerName ?? '')}</strong> el ${escape(new Date(contract.signedAt).toLocaleString('es-NI'))}</p>${contract.signatureData ? `<img alt="Firma" src="${contract.signatureData}" />` : ''}<p class="hash">Huella del documento: ${escape(contract.documentHash ?? '')}</p></div>` : '';
  const company = contract.companySignedAt ? `<p class="hash">Firmado por la empresa: ${escape(contract.companySignerName ?? '')} el ${escape(new Date(contract.companySignedAt).toLocaleString('es-NI'))}</p>` : '';
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escape(contract.title)}</title><style>body{font-family:Georgia,serif;max-width:760px;margin:32px auto;padding:0 24px;line-height:1.6;color:#111}h1{font-size:18px;text-align:center;text-transform:uppercase}pre{white-space:pre-wrap;font-family:inherit;font-size:14px;text-align:justify}.sig{margin-top:32px;border-top:1px solid #999;padding-top:12px}.sig img{max-height:90px}.hash{font-size:11px;color:#555;word-break:break-all}@media print{body{margin:0}}</style></head><body><h1>${escape(contract.title)}</h1><pre>${escape(contract.body)}</pre>${company}${signed}</body></html>`);
  win.document.close();
  win.focus();
  win.setTimeout(() => win.print(), 300);
}

function ContractDialog({ contractId, canEdit, onClose, onChanged }: { contractId: string; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const query = useTenantQuery(['hr', 'contract', contractId], (signal) => employeeProfileService.getContract(contractId, signal), { staleTime: 0 });
  const [body, setBody] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; expiresAt: string; sentTo: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonAttempted, setCancelReasonAttempted] = useState(false);
  const contract = query.data;
  const editable = canEdit && contract?.status === 'DRAFT';
  const text = body ?? contract?.body ?? '';

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try { await action(); if (done) toast.success(done); onChanged(); await query.refetch(); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); toast.success('Enlace copiado'); } catch { toast.error('El navegador no permitió copiar el enlace. Selecciónalo y cópialo manualmente.'); } };

  return (
    <>
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{contract?.title ?? 'Contrato'}</DialogTitle><DialogDescription>Revisa y ajusta el texto antes de enviarlo. Es un borrador de referencia: conviene que un asesor legal revise la plantilla.</DialogDescription></DialogHeader>
        {query.isLoading || !contract ? <Skeleton className="h-64 w-full" aria-busy="true" /> : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs"><span className={`rounded-full px-2 py-0.5 font-semibold ${TONE[contract.status]}`}>{CONTRACT_STATUS_LABEL[contract.status]}</span>{contract.companySignedAt && <span className="text-muted-foreground">Firmó la empresa: {contract.companySignerName} · {when(contract.companySignedAt)}</span>}{contract.signedAt && <span className="text-muted-foreground">Firmó {contract.signerName} · {when(contract.signedAt)}</span>}</div>
            <Textarea value={text} onChange={(e) => setBody(e.target.value)} readOnly={!editable} rows={18} className="font-serif text-[13px] leading-relaxed" aria-label="Texto del contrato" />
            {contract.signedAt && <p className="break-all text-[11px] text-muted-foreground">Huella del documento firmado: {contract.documentHash} · IP {contract.signerIp ?? '—'}</p>}
            {link && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                <p className="font-semibold">Enlace de firma (de un solo uso, vence el {when(link.expiresAt)})</p>
                <div className="mt-2 flex flex-wrap gap-2"><Input readOnly value={link.url} aria-label="Enlace de firma" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1" /><Button type="button" variant="outline" onClick={() => void copy(link.url)}><Copy className="mr-1.5 size-4" /> Copiar</Button></div>
                <p className="mt-1 text-[11px] text-muted-foreground">Envíalo por WhatsApp o correo al empleado{link.sentTo ? ` (${link.sentTo})` : ''}. Solo se muestra ahora; si lo pierdes, genera uno nuevo con «Enviar a firmar».</p>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => printContract({ ...contract, body: text })}><Printer className="mr-1.5 size-4" /> Imprimir / PDF</Button>
              {editable && body !== null && body !== contract.body && <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => employeeProfileService.updateContract(contract.id, { body: text }), 'Texto guardado')}>Guardar cambios</Button>}
              {canEdit && ['DRAFT', 'SENT'].includes(contract.status) && !contract.companySignedAt && <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => employeeProfileService.companySign(contract.id), 'Firmado por la empresa')}><FileSignature className="mr-1.5 size-4" /> Firmar por la empresa</Button>}
              {canEdit && ['DRAFT', 'SENT', 'EXPIRED'].includes(contract.status) && <Button type="button" disabled={busy || (editable && body !== null && body !== contract.body)} onClick={() => void run(async () => setLink(await employeeProfileService.sendContract(contract.id)))}>{busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Send className="mr-1.5 size-4" />}Enviar a firmar</Button>}
              {canEdit && contract.status !== 'SIGNED' && contract.status !== 'CANCELLED' && <Button type="button" variant="ghost" className="text-destructive" disabled={busy} onClick={() => { setCancelReason(''); setCancelReasonAttempted(false); setCancelOpen(true); }}>Cancelar contrato</Button>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <ConfirmDialog open={cancelOpen} onOpenChange={(open) => { if (!open && !busy) { setCancelOpen(false); setCancelReason(''); setCancelReasonAttempted(false); } }} title="¿Cancelar contrato?" description="El contrato quedará cancelado y se conservará en el historial del empleado." confirmLabel="Cancelar contrato" variant="destructive" loading={busy} children={<RequiredReasonField id="employee-contract-cancel-reason" label="Motivo de cancelación" value={cancelReason} onChange={setCancelReason} attempted={cancelReasonAttempted} disabled={busy} />} onConfirm={async () => { if (!contract) return; if (!cancelReason.trim()) { setCancelReasonAttempted(true); return false; } await run(() => employeeProfileService.cancelContract(contract.id, cancelReason.trim()), 'Contrato cancelado'); setCancelOpen(false); return true; }} />
    </>
  );
}

function GenerateDialog({ employeeId, onClose, onCreated }: { employeeId: string; onClose: () => void; onCreated: (contract: Contract) => void }) {
  const templates = useTenantQuery(['hr', 'contract-templates'], (signal) => employeeProfileService.getContractTemplates(signal), { staleTime: 60_000 });
  const [templateId, setTemplateId] = useState('');
  const [company, setCompany] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const defaults = templates.data?.company ?? {};
  const value = (key: string) => company[key] ?? defaults[key] ?? '';
  const fields: Array<{ key: string; label: string; payload: string }> = [
    { key: 'empresa.nombre', label: 'Nombre de la empresa', payload: 'name' }, { key: 'empresa.ruc', label: 'RUC', payload: 'ruc' }, { key: 'empresa.direccion', label: 'Dirección', payload: 'address' },
    { key: 'empresa.representante', label: 'Representante que firma', payload: 'representative' }, { key: 'ciudad', label: 'Ciudad', payload: 'city' },
  ];
  const generate = async () => {
    setBusy(true);
    try {
      const created = await employeeProfileService.generateContract(employeeId, { templateId: templateId || undefined, company: Object.fromEntries(fields.map((field) => [field.payload, value(field.key)])) });
      if (created.missing?.length) toast.warning(`Faltan datos en la ficha para: ${created.missing.join(', ')}. Quedaron como línea para llenar.`);
      onCreated(created);
    } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Generar contrato</DialogTitle><DialogDescription>Se llena con los datos de la ficha del empleado. Los datos de la empresa se recuerdan para el siguiente contrato.</DialogDescription></DialogHeader>
        {templates.isLoading ? <Skeleton className="h-32 w-full" aria-busy="true" /> : (
          <div className="grid gap-3">
            <div className="space-y-1.5"><Label htmlFor="ct-template">Plantilla</Label><select id="ct-template" className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm" value={templateId} onChange={(e) => setTemplateId(e.target.value)}><option value="">Según el tipo de contrato</option>{templates.data?.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></div>
            {fields.map((field) => <div key={field.key} className="space-y-1.5"><Label htmlFor={`ct-${field.payload}`}>{field.label}</Label><Input id={`ct-${field.payload}`} value={value(field.key)} onChange={(e) => setCompany({ ...company, [field.key]: e.target.value })} /></div>)}
          </div>
        )}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="button" onClick={() => void generate()} disabled={busy || templates.isLoading}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Generar borrador</Button></div>
      </DialogContent>
    </Dialog>
  );
}

/** Pestaña «Contrato»: contratos laborales del empleado, con impresión y firma en línea. */
export function EmployeeContractPanel({ employeeId, canEdit }: { employeeId: string; canEdit: boolean }) {
  const client = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const list = useTenantQuery(['hr', 'employee-contracts', employeeId], (signal) => employeeProfileService.getContracts(employeeId, signal), { staleTime: 15_000 });
  const refresh = () => void client.invalidateQueries({ queryKey: ['tenant-module'] });
  return (
    <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><FileSignature className="size-4 text-primary" /> Contrato laboral</h3>
        {canEdit && <Button type="button" size="sm" onClick={() => setGenerating(true)}><FileSignature className="mr-1.5 size-4" /> Generar contrato</Button>}
      </div>
      {list.isLoading ? <Skeleton className="h-20 w-full" aria-busy="true" />
        : list.isError ? <p className="text-sm text-destructive" role="alert">No se pudieron cargar los contratos.</p>
        : !list.data?.length ? <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">Todavía no hay contrato. Se genera solo al crear un empleado de tiempo completo, parcial o temporal; también puedes generarlo aquí.</p>
        : (
          <ul className="space-y-2">
            {list.data.map((contract) => (
              <li key={contract.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <div className="min-w-0"><p className="break-words font-bold">{contract.title}</p><p className="text-xs text-muted-foreground">Creado {when(contract.createdAt)}{contract.signedAt ? ` · Firmado ${when(contract.signedAt)}` : ''}</p></div>
                <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[contract.status]}`}>{contract.status === 'SIGNED' && <CheckCircle2 className="mr-1 inline size-3" aria-hidden />}{CONTRACT_STATUS_LABEL[contract.status]}</span><Button type="button" size="sm" variant="outline" onClick={() => setOpen(contract.id)}>Abrir</Button></div>
              </li>
            ))}
          </ul>
        )}
      <Badge variant="outline" className="text-[10px]">La firma en línea guarda nombre, fecha, IP y una huella del texto firmado.</Badge>
      {generating && <GenerateDialog employeeId={employeeId} onClose={() => setGenerating(false)} onCreated={(created) => { setGenerating(false); refresh(); setOpen(created.id); }} />}
      {open && <ContractDialog contractId={open} canEdit={canEdit} onClose={() => setOpen(null)} onChanged={refresh} />}
    </Card>
  );
}
