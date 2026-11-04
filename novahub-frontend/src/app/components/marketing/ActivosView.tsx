import { useRef, useState } from 'react';
import { MARKETING_GUIDES } from './guides';
import { Download, FileText, Image as ImageIcon, Loader2, Trash2, Upload, Video } from 'lucide-react';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { useAuth } from '../../contexts/AuthContext';
import { mktResources, type MktAsset } from '../../services/marketing.service';
import { storageService } from '../../services/storage.service';
import { toast } from '../../services/toast';
import { PageTitle } from '../organizacion/OrgBits';
import { errorMessage, serifStyle } from '../organizacion/organizacion.utils';
import { RIGHTS_LABEL, fmtDate } from './marketing.constants';
import { ResourceTable, type Column } from './MktBits';
import { options, useMktRefresh } from './mkt.helpers';

const kindIcon = (mime?: string | null) => (mime?.startsWith('image/') ? ImageIcon : mime?.startsWith('video/') ? Video : FileText);
const size = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function ActivosView() {
  const { canPerform } = useAuth();
  const refresh = useMktRefresh();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<MktAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const canCreate = canPerform('MARKETING_ASSETS', 'create');
  const canDelete = canPerform('MARKETING_ASSETS', 'delete');

  // Sube cada archivo al almacenamiento privado y registra el activo (referencia, no copia).
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      try {
        const uploaded = await storageService.uploadFile('marketing-assets', file, { folder: 'marketing' });
        await mktResources.assets.create({ name: file.name, fileUri: uploaded.uri, mimeType: file.type || null, sizeBytes: file.size, folder: 'General' });
        ok += 1;
      } catch (e) {
        toast.error(`${file.name}: ${errorMessage(e, 'No se pudo subir')}`);
      }
    }
    setUploading(false);
    if (input.current) input.current.value = '';
    if (ok) { toast.success(`${ok} activo(s) subido(s)`); refresh(); }
  };

  const open = async (asset: MktAsset) => {
    try { window.open(await storageService.resolveUrl(asset.fileUri), '_blank', 'noopener,noreferrer'); }
    catch (e) { toast.error(errorMessage(e, 'No se pudo abrir el archivo')); }
  };

  const remove = async (asset: MktAsset) => {
    setBusy(true);
    try {
      await mktResources.assets.remove(asset.id);
      await storageService.deleteFile(asset.fileUri).catch(() => undefined);
      toast.success('Activo eliminado'); setSelected(null); refresh();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const columns: Array<Column<MktAsset>> = [
    { key: 'name', header: 'Activo', render: (r) => { const Icon = kindIcon(r.mimeType); return <span className="flex items-center gap-2 font-semibold"><Icon className="size-4 shrink-0 text-primary" aria-hidden="true" /><span className="truncate">{r.name}</span></span>; } },
    { key: 'folder', header: 'Carpeta', render: (r) => r.folder },
    { key: 'rights', header: 'Derechos', render: (r) => RIGHTS_LABEL[r.rights] ?? r.rights },
    { key: 'size', header: 'Tamaño', render: (r) => size(r.sizeBytes) },
    { key: 'date', header: 'Subido', render: (r) => fmtDate(r.createdAt) },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle guide={MARKETING_GUIDES.activos} eyebrow="Marketing" title="Biblioteca de activos" subtitle="Archivos creativos y evidencias en almacenamiento privado, vinculados a campañas y piezas." />
      <input ref={input} type="file" multiple className="sr-only" aria-label="Seleccionar archivos" onChange={(e) => void upload(e.target.files)} />
      <ResourceTable<MktAsset> id="assets" fetcher={mktResources.assets.list} columns={columns} searchPlaceholder="Buscar por nombre o descripción…" onRowClick={setSelected}
        filters={[{ key: 'rights', label: 'Derechos', options: options(RIGHTS_LABEL) }]}
        emptyTitle="Aún no hay activos" emptyDescription="Sube imágenes, videos o documentos. Los archivos son privados y respetan los permisos del módulo."
        toolbar={canCreate ? <Button type="button" onClick={() => input.current?.click()} disabled={uploading}>{uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" aria-hidden="true" />}Subir activos</Button> : undefined} />

      <Sheet open={Boolean(selected)} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          {selected && (
            <>
              <SheetHeader className="space-y-1 border-b border-border px-6 pb-4 pt-6 text-left">
                <SheetTitle className="break-words text-2xl text-primary dark:text-foreground" style={serifStyle}>{selected.name}</SheetTitle>
                <SheetDescription>{selected.mimeType || 'Archivo'} · {size(selected.sizeBytes)}</SheetDescription>
              </SheetHeader>
              <dl className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5 text-[13px]">
                <div><dt className="text-muted-foreground">Carpeta</dt><dd className="font-semibold">{selected.folder}</dd></div>
                <div><dt className="text-muted-foreground">Derechos de uso</dt><dd className="font-semibold">{RIGHTS_LABEL[selected.rights] ?? selected.rights}</dd></div>
                <div><dt className="text-muted-foreground">Subido</dt><dd className="font-semibold">{fmtDate(selected.createdAt, true)}</dd></div>
                {selected.tags.length > 0 && <div className="flex flex-wrap gap-1">{selected.tags.map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{t}</span>)}</div>}
                {selected.description && <p className="text-muted-foreground">{selected.description}</p>}
              </dl>
              <div className="flex gap-2 border-t border-border px-6 py-4">
                <Button type="button" onClick={() => void open(selected)}><Download className="size-4" aria-hidden="true" />Abrir</Button>
                {canDelete && <Button type="button" variant="outline" className="text-destructive" disabled={busy} onClick={() => void remove(selected)}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" aria-hidden="true" />}Eliminar</Button>}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
