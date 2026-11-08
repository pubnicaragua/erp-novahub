import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { IdCard, Loader2, Printer, Save, Upload } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Skeleton } from '../../ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { toast } from '../../../services/toast';
import { hrService } from '../../../services/hr.service';
import { storageService } from '../../../services/storage.service';
import { employeeProfileService, type CardData, type CardDesign, type CardEmployee } from '../../../services/employee-profile.service';
import { buildCardsHtml } from './employee-card-html';

const failure = (error: unknown) => (error as any)?.response?.data?.message?.toString?.() || (error as Error)?.message || 'No se pudo completar la acción.';
const LAYOUTS: Array<{ value: CardDesign['layout']; label: string }> = [
  { value: 'CLASSIC', label: 'Clásico (horizontal)' }, { value: 'MODERN', label: 'Moderno (horizontal)' }, { value: 'BOLD', label: 'Destacado (horizontal)' },
  { value: 'MINIMAL', label: 'Minimalista (horizontal)' }, { value: 'CORPORATE', label: 'Corporativo (horizontal)' }, { value: 'VERTICAL', label: 'Vertical' },
];
const FONTS: Array<{ value: CardDesign['fontFamily']; label: string }> = [
  { value: 'SANS', label: 'Moderna (sin serifa)' }, { value: 'SERIF', label: 'Clásica (con serifa)' }, { value: 'ROUNDED', label: 'Amigable' }, { value: 'CONDENSED', label: 'Condensada' }, { value: 'MONO', label: 'Máquina de escribir' },
];
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** Lo que lleva el QR de un empleado: el enlace de la empresa con {numero}, {id} y {nombre} reemplazados, o el código de NovaHub. */
function qrText(template: string | null, employee: CardEmployee): string {
  const raw = (template ?? '').trim();
  if (!raw) return employee.qr;
  return raw.split('{numero}').join(encodeURIComponent(employee.number)).split('{id}').join(encodeURIComponent(employee.id)).split('{nombre}').join(encodeURIComponent(`${employee.firstName} ${employee.lastName}`.trim()));
}

/** Carnet de uno o varios empleados: diseño de la empresa (logo, colores, textos), vista previa e impresión. */
export function EmployeeCardDialog({ employeeIds, canEditDesign, onClose }: { employeeIds: string[]; canEditDesign: boolean; onClose: () => void }) {
  const [data, setData] = useState<CardData | null>(null);
  const [design, setDesign] = useState<CardDesign | null>(null);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;
    employeeProfileService.getCardData(employeeIds)
      .then((result) => { if (!active) return; setData(result); setDesign((current) => current ?? result.design); })
      .catch((reason) => { if (active) setError(failure(reason)); });
    return () => { active = false; };
  }, [employeeIds.join(','), reload]); // eslint-disable-line react-hooks/exhaustive-deps

  // El QR se vuelve a generar cuando cambia el enlace que la empresa escribió
  const qrTemplate = design?.qrLinkTemplate ?? null;
  useEffect(() => {
    if (!data) return undefined;
    let active = true;
    (async () => {
      const codes: Record<string, string> = {};
      for (const employee of data.employees) codes[employee.id] = await QRCode.toDataURL(qrText(qrTemplate, employee), { margin: 0, width: 240, errorCorrectionLevel: 'M' });
      if (active) setQr(codes);
    })().catch(() => undefined);
    return () => { active = false; };
  }, [data, qrTemplate]);

  const uploadPhoto = async (file: File | null) => {
    if (!file || employeeIds.length !== 1) return;
    if (!file.type.startsWith('image/')) { toast.error('Elige una imagen (JPG, PNG o WebP).'); return; }
    if (file.size > MAX_PHOTO_BYTES) { toast.error('La foto pesa más de 2 MB.'); return; }
    setUploading(true);
    try {
      const uploaded = await storageService.uploadFile('user-avatar', file, { folder: employeeIds[0] });
      await hrService.updateEmployee(employeeIds[0], { photoUrl: uploaded.url });
      toast.success('Foto guardada');
      setReload((value) => value + 1);
    } catch (reason) { toast.error(failure(reason)); } finally { setUploading(false); }
  };

  const html = useMemo(() => (data && design ? buildCardsHtml({ ...data, design }, { qrByEmployee: qr, preview: true }) : ''), [data, design, qr]);
  const set = <K extends keyof CardDesign>(key: K, value: CardDesign[K]) => setDesign((current) => (current ? { ...current, [key]: value } : current));

  const print = () => {
    if (!data || !design) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { toast.error('Tu navegador bloqueó la ventana de impresión. Permite las ventanas emergentes.'); return; }
    win.document.write(buildCardsHtml({ ...data, design }, { qrByEmployee: qr }));
    win.document.close();
    win.focus();
    win.setTimeout(() => win.print(), 600); // da tiempo a cargar el logo y las fotos
  };
  const saveDesign = async () => {
    if (!design) return;
    setBusy(true);
    try { await employeeProfileService.saveCardDesign(design); toast.success('Diseño del carnet guardado para toda la empresa'); } catch (reason) { toast.error(failure(reason)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><IdCard className="size-5" aria-hidden /> Carnet de empleado</DialogTitle><DialogDescription>Frente y reverso en tamaño tarjeta (85.6 × 54 mm). El logo es el de la empresa; la foto es la del expediente del empleado (o la de su usuario).</DialogDescription></DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!data || !design ? (!error && <Skeleton className="h-64 w-full" aria-busy="true" />) : (
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="cd-layout">Distribución</Label><select id="cd-layout" disabled={!canEditDesign} className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm" value={design.layout} onChange={(e) => set('layout', e.target.value as CardDesign['layout'])}>{LAYOUTS.map((layout) => <option key={layout.value} value={layout.value}>{layout.label}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="cd-font">Tipografía</Label><select id="cd-font" disabled={!canEditDesign} className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm" value={design.fontFamily} onChange={(e) => set('fontFamily', e.target.value as CardDesign['fontFamily'])}>{FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}</select></div>
              <div className="grid grid-cols-3 gap-2">
                {([['primaryColor', 'Principal'], ['accentColor', 'Acento'], ['textColor', 'Texto']] as const).map(([key, label]) => <div key={key} className="space-y-1.5"><Label htmlFor={`cd-${key}`} className="text-[11px]">{label}</Label><input id={`cd-${key}`} type="color" disabled={!canEditDesign} value={design[key]} onChange={(e) => set(key, e.target.value)} className="h-9 w-full cursor-pointer rounded-lg border border-border/60 bg-background p-0.5" /></div>)}
              </div>
              {([['showPhoto', 'Mostrar foto'], ['showQr', 'Mostrar código QR'], ['showDepartment', 'Mostrar departamento']] as const).map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" disabled={!canEditDesign} checked={design[key]} onChange={(e) => set(key, e.target.checked)} /> {label}</label>)}
              <div className="space-y-1.5"><Label htmlFor="cd-qr">Enlace del código QR</Label><Input id="cd-qr" disabled={!canEditDesign} maxLength={300} value={design.qrLinkTemplate ?? ''} onChange={(e) => set('qrLinkTemplate', e.target.value || null)} placeholder="https://miempresa.com/empleado/{numero}" /><p className="text-[11px] text-muted-foreground">Puedes usar {'{numero}'}, {'{id}'} y {'{nombre}'}. Vacío = código de identificación de NovaHub.</p></div>
              {employeeIds.length === 1 && <div className="space-y-1.5"><Label htmlFor="cd-photo">Foto del empleado</Label><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border/60 px-3 py-2 text-sm hover:bg-muted/40">{uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}{uploading ? 'Subiendo…' : data.employees[0]?.photo ? 'Cambiar foto' : 'Subir foto'}<input id="cd-photo" type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => { void uploadPhoto(e.target.files?.[0] ?? null); e.target.value = ''; }} /></label><p className="text-[11px] text-muted-foreground">JPG, PNG o WebP de hasta 2 MB. Se guarda en el expediente del empleado.</p></div>}
              <div className="space-y-1.5"><Label htmlFor="cd-footer">Texto al pie del frente</Label><Input id="cd-footer" disabled={!canEditDesign} maxLength={300} value={design.footerText ?? ''} onChange={(e) => set('footerText', e.target.value || null)} placeholder={data.company.name} /></div>
              <div className="space-y-1.5"><Label htmlFor="cd-back">Texto del reverso</Label><Input id="cd-back" disabled={!canEditDesign} maxLength={300} value={design.backText ?? ''} onChange={(e) => set('backText', e.target.value || null)} placeholder="Este carnet es personal e intransferible…" /></div>
              {!data.company.logo && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">La empresa no tiene logo cargado; se imprime su nombre. Súbelo en Configuración › Empresa.</p>}
            </div>
            <div className="min-w-0 space-y-3">
              <iframe title="Vista previa de los carnets" srcDoc={html} sandbox="" className="h-[420px] w-full rounded-xl border border-border/60 bg-slate-200" />
              <div className="flex flex-wrap justify-end gap-2">
                {canEditDesign && <Button type="button" variant="outline" onClick={() => void saveDesign()} disabled={busy}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Guardar diseño</Button>}
                <Button type="button" onClick={print}><Printer className="mr-2 size-4" /> Imprimir {data.employees.length > 1 ? `${data.employees.length} carnets` : 'carnet'}</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">En el cuadro de impresión elige tamaño «Tarjeta» o personalizado de 85.6 × 54 mm, sin márgenes. El QR solo identifica a la persona; no contiene datos personales.</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
