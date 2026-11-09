import { useEffect, useRef, useState } from 'react';
import { Archive, ArchiveRestore, Copy, Download, FilePlus2, FileSpreadsheet, FileText, Folder, FolderInput, FolderOpen, FolderPlus, Loader2, MoreVertical, Pencil, Search, Share2, Trash2, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../ui/dropdown-menu';
import { PromptDialog } from '../../ui/PromptDialog';
import { Skeleton } from '../../ui/skeleton';
import { cn } from '../../ui/utils';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { organizacionService } from '../../../services/organizacion.service';
import {
  blobToBase64, orgDocumentsService, saveBlob, type OrgDocKind, type OrgDocumentDetail, type OrgDocumentSummary,
} from '../../../services/org-documents.service';
import { toast } from '../../../services/toast';
import { EmptyState, ErrorState, Field, NativeSelect, PageTitle, controlClass } from '../OrgBits';
import { errorMessage } from '../organizacion.utils';
import { DocumentWorkspace } from './DocumentWorkspace';
import { AUDIENCE_LABEL, PERMISSION_LABEL } from './labels';
import { NewDocumentDialog } from './NewDocumentDialog';
import { ShareDialog } from './ShareDialog';

const when = (iso: string) => new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
const EXTENSION: Record<OrgDocKind, string> = { DOC: 'docx', SHEET: 'xlsx' };
const KIND_LABEL: Record<OrgDocKind, string> = { DOC: 'Documento', SHEET: 'Hoja de cálculo' };
const MAX_IMPORT_BYTES = 15 * 1024 * 1024;
const SCOPES = [{ id: '', label: 'Todos' }, { id: 'mine', label: 'Míos' }, { id: 'shared', label: 'Compartidos conmigo' }, { id: 'archived', label: 'Archivados' }] as const;

/** Documentos: textos (.docx) y hojas de cálculo (.xlsx) que se crean y editan dentro del ERP y se comparten como las estrategias. */
export function DocumentosView({ initialOpenId, onOpenChange }: { initialOpenId?: string | null; onOpenChange?: (id: string | null) => void }) {
  const { canPerform } = useAuth();
  const canEdit = canPerform('ORGANIZATION_SHARED', 'edit');
  const client = useQueryClient();
  const [scope, setScope] = useState<string>('');
  const [kind, setKind] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [openId, setOpenIdState] = useState<string | null>(initialOpenId ?? null);
  const [naming, setNaming] = useState<OrgDocKind | null>(null);
  const [renaming, setRenaming] = useState<OrgDocumentSummary | null>(null);
  const [sharing, setSharing] = useState<OrgDocumentDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [folder, setFolder] = useState<string>(''); // '' = todas, 'none' = sin carpeta, o el id de una carpeta
  const [newFolder, setNewFolder] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<{ id: string; name: string } | null>(null);
  const [moving, setMoving] = useState<OrgDocumentSummary | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const setOpenId = (id: string | null) => { setOpenIdState(id); onOpenChange?.(id); };
  useEffect(() => { const timer = window.setTimeout(() => setQuery(search.trim()), 350); return () => window.clearTimeout(timer); }, [search]);
  const params = { scope: scope || undefined, kind: kind || undefined, q: query || undefined, folder: folder || undefined, pageSize: 60 };
  const folders = useTenantQuery(['org-documents', 'folders'], (signal) => orgDocumentsService.listFolders(signal), { staleTime: 15_000 });
  const list = useTenantQuery(['org-documents', 'list', JSON.stringify(params)], (signal) => orgDocumentsService.list(params, signal), { staleTime: 15_000, placeholderData: (previous) => previous });
  const users = useTenantQuery(['organizacion', 'users'], (signal) => organizacionService.getUsers(signal), { staleTime: 5 * 60_000 });
  const refresh = () => void client.invalidateQueries({ queryKey: ['tenant-module'] });

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try { await action(); if (success) toast.success(success); refresh(); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  /** Crea el documento con su archivo vacío ya generado, para que se pueda descargar desde el primer momento. */
  const create = async (title: string, type: OrgDocKind, templateId = 'blank') => {
    await run(async () => {
      let blob: Blob; let searchText: string;
      const templates = await import('./doc-templates');
      if (type === 'DOC') {
        const { editorJsonToDocx } = await import('./docx-convert');
        const json = (templates.DOC_TEMPLATES.find((t) => t.id === templateId) ?? templates.DOC_TEMPLATES[0]).build();
        blob = await editorJsonToDocx(json, title); searchText = templates.docText(json).slice(0, 20_000);
      } else {
        const { workbookToXlsx, workbookSearchText } = await import('./xlsx-convert');
        const workbook = (templates.SHEET_TEMPLATES.find((t) => t.id === templateId) ?? templates.SHEET_TEMPLATES[0]).build();
        blob = await workbookToXlsx(workbook, title); searchText = workbookSearchText(workbook);
      }
      const created = await orgDocumentsService.create({ kind: type, title, contentBase64: await blobToBase64(blob), ...(searchText ? { searchText } : {}) });
      setNaming(null); setOpenId(created.id);
    });
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    const type: OrgDocKind | null = lower.endsWith('.docx') ? 'DOC' : lower.endsWith('.xlsx') ? 'SHEET' : null;
    if (!type) { toast.error('Solo se pueden importar archivos .docx (Word) y .xlsx (Excel).'); return; }
    if (file.size > MAX_IMPORT_BYTES) { toast.error('El archivo pesa más de 15 MB.'); return; }
    await run(async () => {
      const readText = async () => (type === 'DOC'
        ? (await (await import('./docx-convert')).docxToHtml(file)).text.replace(/\s+/g, ' ').slice(0, 20_000)
        : (await (await import('./xlsx-convert')).xlsxToWorkbook(file)).searchText);
      const searchText = await readText().catch(() => { throw new Error('No se pudo leer el archivo. Comprueba que sea un .docx o .xlsx válido y no esté protegido con contraseña.'); });
      const title = file.name.replace(/\.(docx|xlsx)$/i, '').trim().slice(0, 160) || 'Documento importado';
      const created = await orgDocumentsService.create({ kind: type, title, contentBase64: await blobToBase64(file), searchText });
      toast.success('Archivo importado'); setOpenId(created.id);
    });
  };

  const download = async (item: OrgDocumentSummary) => {
    try { const { blob } = await orgDocumentsService.file(item.id); saveBlob(blob, `${item.title}.${EXTENSION[item.kind]}`); } catch (e) { toast.error(errorMessage(e)); }
  };

  if (openId) {
    return <DocumentWorkspace key={openId} id={openId} users={users.data ?? []} onClose={() => { setOpenId(null); refresh(); }} onChanged={refresh} />;
  }

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle eyebrow="Organización" title="Documentos" subtitle="Escribe documentos y hojas de cálculo sin salir del ERP, compártelos con quien quieras y descárgalos como Word o Excel."
        actions={canEdit ? (
          <>
            <Button type="button" variant="outline" disabled={busy} onClick={() => importInput.current?.click()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}Importar</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setNaming('SHEET')}><FileSpreadsheet className="size-4" />Nueva hoja</Button>
            <Button type="button" disabled={busy} onClick={() => setNaming('DOC')}><FilePlus2 className="size-4" />Nuevo documento</Button>
            <input ref={importInput} type="file" accept=".docx,.xlsx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" aria-label="Importar un archivo .docx o .xlsx"
              onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; void importFile(file); }} />
          </>
        ) : undefined} />

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Buscar" htmlFor="doc-search" className="min-w-52 flex-1">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><input id="doc-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre o contenido" className={cn(controlClass, 'pl-9')} /></div>
        </Field>
        <Field label="Tipo" className="w-44"><NativeSelect value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Todos</option><option value="DOC">Documentos</option><option value="SHEET">Hojas de cálculo</option></NativeSelect></Field>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Carpetas">
        {[{ id: '', label: 'Todas las carpetas', count: null as number | null }, { id: 'none', label: 'Sin carpeta', count: folders.data?.withoutFolder ?? null }, ...(folders.data?.folders ?? []).map((item) => ({ id: item.id, label: item.name, count: item.count }))].map((item) => (
          <button key={item.id || 'all'} type="button" aria-pressed={folder === item.id} onClick={() => setFolder(item.id)}
            className={cn('inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition', folder === item.id ? 'border-primary bg-primary/10 text-primary dark:text-accent' : 'border-border hover:bg-muted/50')}>
            <Folder className="size-3.5" aria-hidden="true" />{item.label}{item.count !== null && <span className="text-[10px] text-muted-foreground">{item.count}</span>}
          </button>
        ))}
        {canEdit && <button type="button" onClick={() => setNewFolder(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-muted/50"><FolderPlus className="size-3.5" aria-hidden="true" />Nueva carpeta</button>}
        {(() => {
          const current = folders.data?.folders.find((item) => item.id === folder);
          return current?.canManage ? (
            <span className="ml-1 inline-flex items-center gap-2 text-[11px] font-semibold">
              <button type="button" className="inline-flex items-center gap-1 text-primary underline dark:text-accent" onClick={() => setRenamingFolder({ id: current.id, name: current.name })}><Pencil className="size-3" aria-hidden="true" />Renombrar</button>
              <button type="button" className="inline-flex items-center gap-1 text-destructive underline" onClick={() => { if (window.confirm(`¿Borrar la carpeta «${current.name}»? Sus documentos no se borran: pasan a «Sin carpeta».`)) void run(async () => { await orgDocumentsService.deleteFolder(current.id); setFolder(''); }, 'Carpeta borrada'); }}><Trash2 className="size-3" aria-hidden="true" />Borrar</button>
            </span>
          ) : null;
        })()}
      </div>
      <div role="tablist" aria-label="Filtrar documentos" className="flex flex-wrap gap-2">
        {SCOPES.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={scope === item.id} onClick={() => setScope(item.id)}
            className={cn('rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition', scope === item.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted/50')}>{item.label}</button>
        ))}
      </div>

      {list.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>
        : list.isError ? <ErrorState message={errorMessage(list.error, 'No se pudieron cargar los documentos')} onRetry={() => void list.refetch()} />
        : !list.data?.items.length ? <EmptyState title={query || scope || kind || folder ? 'No hay documentos con ese filtro' : 'Aún no hay documentos'} description={scope === 'archived' ? 'Los documentos que archives aparecerán aquí.' : 'Crea tu primer documento u hoja de cálculo, o importa un archivo de Word o Excel.'} />
        : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.data.items.map((item) => (
              <DocCard key={item.id} item={item} canEdit={canEdit} onOpen={() => setOpenId(item.id)}
                onRename={() => setRenaming(item)} onMove={() => setMoving(item)} onShare={() => void run(async () => setSharing(await orgDocumentsService.get(item.id)))} onDownload={() => void download(item)}
                onDuplicate={() => void run(async () => { await orgDocumentsService.duplicate(item.id); }, 'Se creó una copia solo para ti')}
                onArchive={() => void run(() => (item.archived ? orgDocumentsService.restore(item.id) : orgDocumentsService.archive(item.id)), item.archived ? 'Documento restaurado' : 'Documento archivado')} />
            ))}
          </ul>
        )}

      {naming && <NewDocumentDialog kind={naming} busy={busy} onClose={() => setNaming(null)} onCreate={(name, templateId) => void create(name, naming, templateId)} />}
      {renaming && <PromptDialog open onOpenChange={(open) => !open && setRenaming(null)} title="Cambiar el nombre" label="Nombre" initialValue={renaming.title} confirmLabel="Guardar" loading={busy} onConfirm={(value) => run(async () => { await orgDocumentsService.update(renaming.id, { title: value.trim() }); setRenaming(null); }, 'Nombre actualizado')} />}
      {newFolder && <PromptDialog open onOpenChange={(open) => !open && setNewFolder(false)} title="Nueva carpeta" description="Sirve para ordenar los documentos; quién ve cada uno sigue dependiendo del documento." label="Nombre" placeholder="Contratos 2027" confirmLabel="Crear" loading={busy} onConfirm={(value) => run(async () => { const created = await orgDocumentsService.createFolder(value.trim()); setNewFolder(false); setFolder(created.id); }, 'Carpeta creada')} />}
      {renamingFolder && <PromptDialog open onOpenChange={(open) => !open && setRenamingFolder(null)} title="Renombrar la carpeta" label="Nombre" initialValue={renamingFolder.name} confirmLabel="Guardar" loading={busy} onConfirm={(value) => run(async () => { await orgDocumentsService.renameFolder(renamingFolder.id, value.trim()); setRenamingFolder(null); }, 'Carpeta renombrada')} />}
      {moving && (
        <div role="dialog" aria-modal="true" aria-label={`Mover ${moving.title} a una carpeta`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setMoving(null)}>
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-background p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <p className="font-semibold">Mover «{moving.title}»</p>
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {[{ id: '', name: 'Sin carpeta' }, ...(folders.data?.folders ?? [])].map((item) => (
                <li key={item.id || 'root'}><button type="button" disabled={busy || (moving.folderId ?? '') === item.id} onClick={() => void run(async () => { await orgDocumentsService.update(moving.id, { folderId: item.id || null }); setMoving(null); }, 'Documento movido')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/50 disabled:opacity-50"><Folder className="size-4" aria-hidden="true" />{item.name}{(moving.folderId ?? '') === item.id ? ' (actual)' : ''}</button></li>
              ))}
            </ul>
            <div className="flex justify-end"><Button type="button" variant="outline" onClick={() => setMoving(null)}>Cerrar</Button></div>
          </div>
        </div>
      )}
      {sharing && <ShareDialog doc={sharing} users={users.data ?? []} onClose={() => setSharing(null)} onSaved={() => { setSharing(null); refresh(); }} />}
    </div>
  );
}

function DocCard({ item, canEdit, onOpen, onRename, onMove, onShare, onDownload, onDuplicate, onArchive }: {
  item: OrgDocumentSummary; canEdit: boolean; onOpen: () => void; onRename: () => void; onMove: () => void; onShare: () => void; onDownload: () => void; onDuplicate: () => void; onArchive: () => void;
}) {
  const Icon = item.kind === 'DOC' ? FileText : FileSpreadsheet;
  return (
    <li className="relative">
      <button type="button" onClick={onOpen} className="flex h-full w-full min-w-0 flex-col gap-2 rounded-2xl border border-border bg-card p-4 pr-12 text-left shadow-sm transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-primary dark:text-accent"><Icon className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="break-words text-[14px] font-semibold">{item.title}</p>
            <p className="text-[11px] text-muted-foreground">{KIND_LABEL[item.kind]} · .{EXTENSION[item.kind]}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-800">{AUDIENCE_LABEL[item.audience]}</span>
          {item.audience !== 'PRIVATE' && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary dark:text-accent">{PERMISSION_LABEL[item.permission]}</span>}
          {!item.canEdit && !item.archived && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">Solo lectura</span>}
          {item.archived && <span className="rounded-full bg-muted px-2 py-0.5">Archivado</span>}
        </div>
        <p className="mt-auto text-[11px] text-muted-foreground">{item.mine ? 'Tuyo' : `De ${item.ownerName}`} · {item.lastEditedByName ? `editó ${item.lastEditedByName}, ` : ''}{when(item.updatedAt)}</p>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`Acciones de ${item.title}`} className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"><MoreVertical className="size-4" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onOpen}><FolderOpen className="size-4" />Abrir</DropdownMenuItem>
          <DropdownMenuItem onSelect={onDownload}><Download className="size-4" />Descargar .{EXTENSION[item.kind]}</DropdownMenuItem>
          {canEdit && <DropdownMenuItem onSelect={onDuplicate}><Copy className="size-4" />Duplicar</DropdownMenuItem>}
          {canEdit && item.canManage && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onRename}><Pencil className="size-4" />Cambiar el nombre</DropdownMenuItem>
              <DropdownMenuItem onSelect={onMove}><FolderInput className="size-4" />Mover a una carpeta</DropdownMenuItem>
              <DropdownMenuItem onSelect={onShare}><Share2 className="size-4" />Compartir</DropdownMenuItem>
              <DropdownMenuItem onSelect={onArchive}>{item.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}{item.archived ? 'Restaurar' : 'Archivar'}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
