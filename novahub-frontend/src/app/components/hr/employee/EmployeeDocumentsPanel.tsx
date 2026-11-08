import { useRef, useState } from 'react';
import { AlertTriangle, FileText, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Skeleton } from '../../ui/skeleton';
import { cn } from '../../ui/utils';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { storageService } from '../../../services/storage.service';
import { DOCUMENT_TYPE_LABEL, FILE_STATUS_LABEL, employeeProfileService } from '../../../services/employee-profile.service';

const MAX_BYTES = 25 * 1024 * 1024;
const failure = (error: unknown) => (error as any)?.response?.data?.message?.toString?.() || (error as Error)?.message || 'No se pudo completar la acción.';

/** Pestaña «Documentos»: cédula, contrato, títulos, certificados y constancias, con aviso de vencimiento. */
export function EmployeeDocumentsPanel({ employeeId, canCreate, canDelete }: { employeeId: string; canCreate: boolean; canDelete: boolean }) {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('ID');
  const [expiry, setExpiry] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const query = useTenantQuery(['hr', 'employee-files', employeeId], (signal) => employeeProfileService.getFiles(employeeId, signal), { staleTime: 15_000 });
  const refresh = () => void client.invalidateQueries({ queryKey: ['tenant-module'] });

  const pick = (selected: File | null) => {
    if (selected && selected.size > MAX_BYTES) { toast.error('El archivo pesa más de 25 MB.'); return; }
    setFile(selected);
    if (selected && !title.trim()) setTitle(selected.name.replace(/\.[^.]+$/, ''));
  };
  const save = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const uploaded = await storageService.uploadFile('hr-documents', file, { folder: employeeId });
      await employeeProfileService.createFile(employeeId, { title: title.trim(), type, fileUrl: uploaded.uri, expiryDate: expiry || undefined });
      toast.success('Documento guardado');
      setTitle(''); setExpiry(''); setFile(null); if (input.current) input.current.value = '';
      refresh();
    } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  const open = async (documentId: string) => {
    try { const { url } = await employeeProfileService.getFileUrl(employeeId, documentId); window.open(url, '_blank', 'noopener,noreferrer'); } catch (error) { toast.error(failure(error)); }
  };
  const remove = async (documentId: string, name: string) => {
    if (!window.confirm(`¿Eliminar «${name}»? El archivo se borra del expediente.`)) return;
    try { await employeeProfileService.deleteFile(employeeId, documentId); refresh(); } catch (error) { toast.error(failure(error)); }
  };
  const alerts = query.data?.filter((row) => row.status === 'EXPIRED' || row.status === 'EXPIRING') ?? [];

  return (
    <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><FileText className="size-4 text-primary" aria-hidden /> Documentos del expediente</h3>
      {alerts.length > 0 && <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"><AlertTriangle className="size-4 shrink-0" aria-hidden /> {alerts.filter((row) => row.status === 'EXPIRED').length} vencido(s) y {alerts.filter((row) => row.status === 'EXPIRING').length} por vencer en los próximos 30 días.</p>}

      {query.isLoading ? <Skeleton className="h-24 w-full" aria-busy="true" />
        : query.isError ? <p className="text-sm text-destructive" role="alert">No se pudieron cargar los documentos.</p>
        : !query.data?.length ? <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">Este empleado no tiene documentos guardados.</p>
        : (
          <ul className="space-y-2">
            {query.data.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3">
                <div className="min-w-0"><p className="break-words font-semibold">{row.title}</p><p className="text-xs text-muted-foreground">{DOCUMENT_TYPE_LABEL[row.type] ?? row.type} · subido {new Date(row.uploadedAt).toLocaleDateString('es-NI', { dateStyle: 'medium' })}{row.expiryDate ? ` · vence ${new Date(row.expiryDate).toLocaleDateString('es-NI', { dateStyle: 'medium', timeZone: 'UTC' })}` : ''}</p></div>
                <div className="flex items-center gap-2"><span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', FILE_STATUS_LABEL[row.status].tone)}>{FILE_STATUS_LABEL[row.status].label}</span><Button type="button" size="sm" variant="outline" onClick={() => void open(row.id)}>Abrir</Button>{canDelete && <button type="button" aria-label={`Eliminar ${row.title}`} className="text-muted-foreground hover:text-destructive" onClick={() => void remove(row.id, row.title)}><Trash2 className="size-4" /></button>}</div>
              </li>
            ))}
          </ul>
        )}

      {canCreate && (
        <div className="grid gap-3 rounded-xl border border-border/60 p-3 sm:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="doc-title">Nombre del documento</Label><Input id="doc-title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="doc-type">Tipo</Label><select id="doc-type" className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm" value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(DOCUMENT_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="doc-expiry">Vence (si aplica)</Label><Input id="doc-expiry" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="doc-file">Archivo (PDF, imagen, Word o Excel; hasta 25 MB)</Label><input id="doc-file" ref={input} type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.csv,.txt" className="block w-full text-sm" onChange={(e) => pick(e.target.files?.[0] ?? null)} /></div>
          <div className="flex justify-end sm:col-span-6"><Button type="button" onClick={() => void save()} disabled={busy || !file || !title.trim()}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Paperclip className="mr-2 size-4" />}Subir documento</Button></div>
        </div>
      )}
    </Card>
  );
}
