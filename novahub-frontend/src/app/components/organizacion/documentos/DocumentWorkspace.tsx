import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, CloudOff, Download, FileSpreadsheet, FileText, History, Loader2, Share2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Skeleton } from '../../ui/skeleton';
import { cn } from '../../ui/utils';
import { orgDocumentsService, saveBlob, type OrgDocumentDetail, type OrgDocumentVersionInfo } from '../../../services/org-documents.service';
import { toast } from '../../../services/toast';
import { ErrorState, controlClass } from '../OrgBits';
import { errorMessage } from '../organizacion.utils';
import { AUDIENCE_LABEL } from './labels';
import { ShareDialog } from './ShareDialog';
import { useAutosave, type BuiltFile } from './useAutosave';
import type { DocEditorHandle } from './DocEditor';
import type { SheetEditorHandle } from './SheetEditor';
import type { WorkbookData } from './xlsx-convert';

// Las librerías pesadas (TipTap, docx, mammoth, exceljs) solo se descargan al abrir un documento.
const DocEditor = lazy(() => import('./DocEditor').then((m) => ({ default: m.DocEditor })));
const SheetEditor = lazy(() => import('./SheetEditor').then((m) => ({ default: m.SheetEditor })));

const when = (iso: string) => new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
const EXTENSION = { DOC: 'docx', SHEET: 'xlsx' } as const;

interface Loaded { doc: OrgDocumentDetail; blob: Blob | null; workbook: WorkbookData | null; truncated: boolean }

/** Abre un documento o una hoja en pantalla completa, con guardado automático y aviso si alguien más lo cambió. */
export function DocumentWorkspace({ id, users, onClose, onChanged }: { id: string; users: Array<{ id: string; name: string }>; onClose: () => void; onChanged: () => void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => { setLoaded(null); setFailure(''); setReloadKey((k) => k + 1); };

  useEffect(() => {
    let active = true;
    (async () => {
      const doc = await orgDocumentsService.get(id);
      let blob: Blob | null = null; let workbook: WorkbookData | null = null; let truncated = false;
      if (doc.hasContent) {
        blob = (await orgDocumentsService.file(id)).blob;
        if (doc.kind === 'SHEET') {
          const { xlsxToWorkbook } = await import('./xlsx-convert');
          const parsed = await xlsxToWorkbook(blob); workbook = parsed.data; truncated = parsed.truncated;
        }
      } else if (doc.kind === 'SHEET') {
        const { emptyWorkbook } = await import('./xlsx-convert'); workbook = emptyWorkbook();
      }
      if (active) setLoaded({ doc, blob, workbook, truncated });
    })().catch((e) => { if (active) setFailure(errorMessage(e, 'No se pudo abrir el documento')); });
    return () => { active = false; };
  }, [id, reloadKey]);

  if (failure) {
    return <div className="space-y-3"><Button type="button" variant="outline" size="sm" onClick={onClose}><ArrowLeft className="size-4" />Volver</Button><ErrorState message={failure} onRetry={() => reload()} /></div>;
  }
  if (!loaded) return <div className="space-y-3" aria-busy="true" aria-label="Abriendo el documento"><Skeleton className="h-10 w-72" /><Skeleton className="h-[480px] w-full" /></div>;
  return <Session key={`${id}-${reloadKey}`} loaded={loaded} users={users} onClose={onClose} onChanged={onChanged} onReload={reload} />;
}

function Session({ loaded, users, onClose, onChanged, onReload }: { loaded: Loaded; users: Array<{ id: string; name: string }>; onClose: () => void; onChanged: () => void; onReload: () => void }) {
  const [doc, setDoc] = useState(loaded.doc);
  const readOnly = !doc.canEdit;
  const docEditor = useRef<DocEditorHandle>(null);
  const sheetEditor = useRef<SheetEditorHandle>(null);
  const [sharing, setSharing] = useState(false);
  const [history, setHistory] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [title, setTitle] = useState(doc.title);

  const build = useCallback(async (): Promise<BuiltFile> => {
    const handle = doc.kind === 'DOC' ? docEditor.current : sheetEditor.current;
    if (!handle) throw new Error('El editor todavía no está listo');
    return handle.build();
  }, [doc.kind]);

  const save = useAutosave({ doc, build, readOnly, onSaved: (detail) => { setDoc(detail); onChanged(); } });

  const markDirty = () => { setDismissed(false); save.markDirty(); };

  const close = async () => {
    if (save.hasPending() && !readOnly) {
      const ok = await save.saveNow();
      if (!ok && !window.confirm('No se pudieron guardar los últimos cambios. ¿Salir de todos modos y perderlos?')) return;
    }
    onClose();
  };
  const download = async () => {
    try {
      const { blob } = await build();
      saveBlob(blob, `${doc.title}.${EXTENSION[doc.kind]}`);
    } catch (e) { toast.error(errorMessage(e, 'No se pudo preparar la descarga')); }
  };
  const rename = async () => {
    const next = title.trim();
    if (!next || next === doc.title) { setTitle(doc.title); return; }
    try { const saved = await orgDocumentsService.update(doc.id, { title: next }); setDoc((cur) => ({ ...saved, version: Math.max(cur.version, saved.version) })); setTitle(saved.title); onChanged(); } catch (e) { toast.error(errorMessage(e)); setTitle(doc.title); }
  };

  const Icon = doc.kind === 'DOC' ? FileText : FileSpreadsheet;
  return (
    <div className="min-w-0 max-w-full space-y-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void close()}><ArrowLeft className="size-4" />Documentos</Button>
        <Icon className="size-5 shrink-0 text-primary dark:text-accent" aria-hidden="true" />
        <input aria-label="Nombre del documento" value={title} maxLength={160} readOnly={!doc.canManage} onChange={(e) => setTitle(e.target.value)} onBlur={() => void rename()} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          className={cn(controlClass, 'h-9 min-w-40 max-w-md flex-1 text-[14px] font-semibold')} />
        <SaveBadge state={save.state} savedAt={save.savedAt} error={save.error} onRetry={() => void save.saveNow()} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setHistory(true)}><History className="size-4" />Historial</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void download()}><Download className="size-4" />Descargar .{EXTENSION[doc.kind]}</Button>
          {doc.canManage && <Button type="button" size="sm" onClick={() => setSharing(true)}><Share2 className="size-4" />Compartir</Button>}
        </div>
      </div>
      <p className="text-[12px] text-muted-foreground">
        {AUDIENCE_LABEL[doc.audience]}{doc.audience !== 'PRIVATE' ? ` · ${doc.permission === 'EDIT' ? 'pueden editar' : 'solo pueden ver'}` : ''} · De {doc.ownerName}
        {doc.lastEditedByName ? ` · Último cambio de ${doc.lastEditedByName}, ${when(doc.updatedAt)}` : ''}{readOnly ? ' · Solo lectura: no tienes permiso para editar' : ''}{doc.archived ? ' · Archivado' : ''}
      </p>
      {loaded.truncated && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">Este archivo es muy grande: solo se cargaron las primeras 5,000 filas, 100 columnas y 60,000 celdas.</p>}

      <Suspense fallback={<Skeleton className="h-[480px] w-full" aria-busy="true" />}>
        {doc.kind === 'DOC'
          ? <DocEditor ref={docEditor} title={doc.title} source={loaded.blob} readOnly={readOnly} onChange={markDirty} />
          : <SheetEditor ref={sheetEditor} title={doc.title} initial={loaded.workbook!} readOnly={readOnly} onChange={markDirty} />}
      </Suspense>

      {sharing && <ShareDialog doc={doc} users={users} onClose={() => setSharing(false)} onSaved={(detail) => { setDoc((cur) => ({ ...detail, version: Math.max(cur.version, detail.version) })); setSharing(false); onChanged(); }} />}
      {history && <HistoryDialog doc={doc} canRestore={!readOnly} beforeRestore={() => save.saveNow()} onClose={() => setHistory(false)} onRestored={() => { setHistory(false); onChanged(); onReload(); }} />}
      {save.state === 'conflict' && save.conflict && (
        <Dialog open={!dismissed} onOpenChange={(open) => setDismissed(!open)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><AlertTriangle className="size-5 text-amber-600" aria-hidden="true" />Alguien cambió este documento</DialogTitle>
              <DialogDescription>{save.conflict.lastEditedByName ? `${save.conflict.lastEditedByName} guardó cambios` : 'Otra persona guardó cambios'} después de que lo abriste. Tus cambios todavía no se guardaron.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Button type="button" onClick={onReload}>Abrir la versión más reciente (descarto mis cambios)</Button>
              <Button type="button" variant="outline" onClick={() => void save.overwrite()}>Guardar la mía encima de la suya</Button>
              <Button type="button" variant="outline" onClick={() => void download()}><Download className="size-4" />Descargar mi copia primero</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function SaveBadge({ state, savedAt, error, onRetry }: { state: string; savedAt: Date | null; error: string; onRetry: () => void }) {
  const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold';
  if (state === 'saving') return <span role="status" className={`${base} bg-muted text-muted-foreground`}><Loader2 className="size-3 animate-spin" />Guardando…</span>;
  if (state === 'dirty') return <span role="status" className={`${base} bg-amber-100 text-amber-900`}>Cambios sin guardar</span>;
  if (state === 'conflict') return <span role="alert" className={`${base} bg-red-100 text-red-900`}><AlertTriangle className="size-3" />Alguien más lo cambió</span>;
  if (state === 'error') return <button type="button" role="alert" onClick={onRetry} title={error} className={`${base} bg-red-100 text-red-900`}><CloudOff className="size-3" />No se guardó. Reintentar</button>;
  if (state === 'readonly') return <span className={`${base} bg-muted text-muted-foreground`}>Solo lectura</span>;
  return <span role="status" className={`${base} bg-emerald-100 text-emerald-900`}><Check className="size-3" />{savedAt ? `Guardado ${new Intl.DateTimeFormat('es-NI', { timeStyle: 'short' }).format(savedAt)}` : 'Todo guardado'}</span>;
}

function HistoryDialog({ doc, canRestore, beforeRestore, onClose, onRestored }: { doc: OrgDocumentDetail; canRestore: boolean; beforeRestore: () => Promise<boolean>; onClose: () => void; onRestored: () => void }) {
  const [versions, setVersions] = useState<OrgDocumentVersionInfo[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    orgDocumentsService.versions(doc.id).then((v) => { if (active) setVersions(v); }).catch((e) => { if (active) setError(errorMessage(e)); });
    return () => { active = false; };
  }, [doc.id]);
  const download = async (version: number) => {
    setBusy(version);
    try { const { blob } = await orgDocumentsService.file(doc.id, version); saveBlob(blob, `${doc.title} (versión ${version}).${EXTENSION[doc.kind]}`); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(null); }
  };
  const restore = async (version: number) => {
    if (!window.confirm(`¿Restaurar la versión ${version}? Quedará como la versión más reciente y no se pierde el historial.`)) return;
    setBusy(version);
    try {
      if (!(await beforeRestore())) { toast.error('Guarda o resuelve tus cambios antes de restaurar.'); return; }
      const current = await orgDocumentsService.get(doc.id);
      await orgDocumentsService.restoreVersion(doc.id, version, current.version);
      toast.success(`Se restauró la versión ${version}`); onRestored();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(null); }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Historial de versiones</DialogTitle><DialogDescription>Se conservan las últimas 10 versiones de «{doc.title}».</DialogDescription></DialogHeader>
        {error ? <ErrorState message={error} /> : !versions ? <Skeleton className="h-32 w-full" aria-busy="true" /> : !versions.length ? <p className="text-[13px] text-muted-foreground">Todavía no hay versiones guardadas.</p> : (
          <ul className="space-y-2">
            {versions.map((v) => (
              <li key={v.version} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-[12px]">
                <span><span className="font-semibold">Versión {v.version}{v.version === doc.version ? ' (actual)' : ''}</span><br />{v.createdByName} · {when(v.createdAt)}</span>
                <span className="flex gap-1.5">
                  <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void download(v.version)}><Download className="size-3.5" />Descargar</Button>
                  {canRestore && v.version !== doc.version && <Button type="button" size="sm" disabled={busy !== null} onClick={() => void restore(v.version)}>{busy === v.version && <Loader2 className="size-3.5 animate-spin" />}Restaurar</Button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
