import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  FileBarChart, FileText, Receipt, Users, Building2, Eye, ChevronDown, ChevronUp,
  Upload, Download, Trash2, Paperclip, FileSpreadsheet, Clock,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../ui/select';
import { Label } from '../ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../ui/table';
import { contabilidadService } from '../../services/contabilidad.service';
import { storageService } from '../../services/storage.service';
import { toast } from 'sonner';
import { useAccountingQuery } from '../../hooks/useAccountingQuery';

const statusStyles: Record<string, string> = {
  DRAFT: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  FINAL: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  SUBMITTED: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  FINAL: 'Final',
  SUBMITTED: 'Presentado',
};

const reportTypeInfo: Record<string, { label: string; icon: any; desc: string; color: string }> = {
  IVA: { label: 'Declaración IVA', icon: Receipt, desc: 'Registra el respaldo de la declaración mensual de IVA enviada a la DGI.', color: 'bg-blue-500/10 text-blue-500' },
  IR: { label: 'Declaración IR', icon: FileText, desc: 'Registra el respaldo de la declaración anual de IR enviada.', color: 'bg-emerald-500/10 text-emerald-500' },
  INSS: { label: 'Planilla INSS', icon: Users, desc: 'Registra el respaldo de la planilla mensual enviada al INSS.', color: 'bg-amber-500/10 text-amber-500' },
  INATEC: { label: 'Planilla INATEC', icon: Building2, desc: 'Registra el respaldo de la planilla mensual enviada al INATEC.', color: 'bg-purple-500/10 text-purple-500' },
};

const REPORT_TYPES = ['IVA', 'IR', 'INSS', 'INATEC'];

// El enum de la BD usa IVA_DECLARATION/IR_DECLARATION/INSS_PAYROLL/INATEC_PAYROLL;
// se normaliza a la clave corta para los labels e iconos.
const ENUM_TO_KEY: Record<string, string> = {
  IVA_DECLARATION: 'IVA',
  IR_DECLARATION: 'IR',
  INSS_PAYROLL: 'INSS',
  INATEC_PAYROLL: 'INATEC',
};

const reportTypeKey = (raw: string) => ENUM_TO_KEY[String(raw || '').toUpperCase()] || raw;

const ACCEPTED_EXTENSIONS = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

const MONTHS = [
  { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' }, { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
];

interface BackupForm {
  month: string;
  year: string;
  submittedAt: string;
  file: File | null;
  acta: File | null;
  notes: string;
}

function toLocalDateTime(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function createInitialForm(): BackupForm {
  return {
    month: '1',
    year: String(new Date().getFullYear()),
    submittedAt: toLocalDateTime(new Date()),
    file: null,
    acta: null,
    notes: '',
  };
}

const isAllowedBackupFile = (file: File): boolean =>
  ACCEPTED_EXTENSIONS.includes(file.type) || /\.(pdf|xlsx|xls)$/i.test(file.name);

export function ReportesFiscalesView() {
  const queryClient = useQueryClient();
  const [expandedGenerate, setExpandedGenerate] = useState(true);
  const [showMeta, setShowMeta] = useState<any>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, BackupForm>>(() => {
    const initial: Record<string, BackupForm> = {};
    REPORT_TYPES.forEach((type) => { initial[type] = createInitialForm(); });
    return initial;
  });

  const reportsQuery = useAccountingQuery<any[]>(['fiscal-reports'], async (signal) =>
    (await contabilidadService.getFiscalReports(signal)) || [],
  );
  const reports = reportsQuery.data || [];
  const loading = reportsQuery.isLoading || reportsQuery.isFetching;

  const updateForm = (type: string, patch: Partial<BackupForm>) => {
    setForms((current) => ({ ...current, [type]: { ...current[type], ...patch } }));
  };

  const refreshReports = () => {
    queryClient.invalidateQueries({ queryKey: ['accounting'] });
  };

  const handleRegisterBackup = async (type: string) => {
    const form = forms[type];
    if (!form.file) {
      toast.error('Adjunta el archivo del reporte (xlsx o pdf) antes de registrar');
      return;
    }
    if (!isAllowedBackupFile(form.file)) {
      toast.error('El archivo del reporte debe ser xlsx o pdf');
      return;
    }
    if (form.acta && !/\.(pdf|xlsx|xls|png|jpe?g|webp)$/i.test(form.acta.name)) {
      toast.error('El acta digital debe ser pdf, xlsx o una imagen');
      return;
    }
    if (!Number.isFinite(Number(form.year)) || Number(form.year) < 2000 || Number(form.year) > 2100) {
      toast.error('Indica un año válido');
      return;
    }
    if (!form.submittedAt) {
      toast.error('Indica la fecha y hora del envío');
      return;
    }
    try {
      setUploading(type);
      const fileUploaded = await storageService.uploadFile('fiscal-reports', form.file, {
        folder: `fiscal-${type.toLowerCase()}`,
      });
      let actaUploaded: { uri: string } | null = null;
      if (form.acta) {
        actaUploaded = await storageService.uploadFile('fiscal-reports', form.acta, {
          folder: `fiscal-${type.toLowerCase()}/actas`,
        });
      }
      await contabilidadService.registerFiscalReportBackup({
        type,
        year: Number(form.year),
        month: type === 'IR' ? null : Number(form.month),
        fileUri: fileUploaded.uri,
        fileName: form.file.name,
        actaUri: actaUploaded?.uri || null,
        actaFileName: form.acta?.name || null,
        submittedAt: new Date(form.submittedAt).toISOString(),
        notes: form.notes.trim() || null,
      });
      toast.success(`${reportTypeInfo[type].label} registrada como respaldo`);
      refreshReports();
      updateForm(type, { file: null, acta: null, notes: '' });
    } catch (e: any) {
      toast.error(e?.message || `Error al registrar el respaldo de ${type}`);
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteReport = async (report: any) => {
    if (!window.confirm('¿Eliminar este respaldo? Los archivos adjuntos también se eliminarán del almacenamiento.')) return;
    try {
      const result = await contabilidadService.deleteFiscalReport(report.id);
      (result?.fileUris || []).forEach((uri: string) => {
        storageService.deleteFile(uri).catch(() => undefined);
      });
      toast.success('Respaldo eliminado');
      refreshReports();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo eliminar el respaldo');
    }
  };

  const openStoredFile = async (uri?: string | null) => {
    if (!uri) return;
    try {
      const url = await storageService.resolveUrl(uri);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo abrir el archivo');
    }
  };

  const formatReportType = (type: string) => reportTypeInfo[reportTypeKey(type)]?.label || type;
  const monthLabel = (month: any) => MONTHS.find((m) => m.value === String(month))?.label || month;

  return (
    <div className="min-w-0 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Reportes Fiscales</h2>
        </div>
        <Button
          variant="outline"
          onClick={() => setExpandedGenerate(!expandedGenerate)}
          className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2"
        >
          {expandedGenerate ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          Registrar Respaldo
        </Button>
      </div>

      {expandedGenerate && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {REPORT_TYPES.map((type) => {
            const info = reportTypeInfo[type];
            const Icon = info.icon;
            const form = forms[type];
            const isIR = type === 'IR';
            return (
              <Card key={type} className="rounded-2xl border-border/50">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2.5 rounded-xl', info.color)}>
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest">{info.label}</p>
                      <p className="text-[9px] text-muted-foreground/60">{isIR ? 'Anual' : 'Mensual'}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{info.desc}</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {!isIR && (
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Mes</Label>
                        <Select value={form.month} onValueChange={(v) => updateForm(type, { month: v })}>
                          <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MONTHS.map((m) => <SelectItem key={m.value} value={m.value} className="text-[10px]">{m.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className={cn('space-y-1.5', isIR && 'col-span-2')}>
                      <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Año</Label>
                      <Input type="number" value={form.year} onChange={(e) => updateForm(type, { year: e.target.value })} className="h-8 text-[10px]" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3" /> Fecha y hora del envío
                    </Label>
                    <Input
                      type="datetime-local"
                      value={form.submittedAt}
                      onChange={(e) => updateForm(type, { submittedAt: e.target.value })}
                      className="h-8 text-[10px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      <FileSpreadsheet className="size-3" /> Archivo del reporte (xlsx/pdf)
                    </Label>
                    <label className={cn(
                      'flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 px-3 py-2.5 text-[10px] font-bold transition-all',
                      form.file ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-600' : 'hover:border-primary/50 hover:bg-muted/30',
                    )}>
                      <Upload className="size-3.5" />
                      <span className="max-w-[180px] truncate">{form.file ? form.file.name : 'Seleccionar archivo'}</span>
                      <input
                        type="file"
                        accept=".pdf,.xlsx,.xls"
                        className="hidden"
                        onChange={(e) => updateForm(type, { file: e.target.files?.[0] || null })}
                      />
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      <Paperclip className="size-3" /> Acta digital (opcional)
                    </Label>
                    <label className={cn(
                      'flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 px-3 py-2.5 text-[10px] font-bold transition-all',
                      form.acta ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-600' : 'hover:border-primary/50 hover:bg-muted/30',
                    )}>
                      <Paperclip className="size-3.5" />
                      <span className="max-w-[180px] truncate">{form.acta ? form.acta.name : 'Adjuntar acta digital'}</span>
                      <input
                        type="file"
                        accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
                        className="hidden"
                        onChange={(e) => updateForm(type, { acta: e.target.files?.[0] || null })}
                      />
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Observaciones</Label>
                    <Input
                      value={form.notes}
                      onChange={(e) => updateForm(type, { notes: e.target.value })}
                      placeholder="Notas del envío..."
                      className="h-8 text-[10px]"
                    />
                  </div>
                  <Button
                    className="w-full h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[9px] tracking-widest shadow-lg shadow-blue-500/20"
                    onClick={() => handleRegisterBackup(type)}
                    disabled={uploading !== null}
                  >
                    {uploading === type ? 'Subiendo y registrando...' : 'Registrar Respaldo'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-0">
          <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Tipo</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Período</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha y hora de envío</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Archivo</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Acta digital</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground/50 italic py-12">Cargando...</TableCell></TableRow>
              ) : reports.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground/50 italic py-12">No hay respaldos registrados. Usa las tarjetas de arriba para subir los archivos enviados.</TableCell></TableRow>
              ) : reports.map((r) => {
                const info = reportTypeInfo[reportTypeKey(r.type as string)];
                const Icon = info?.icon || FileBarChart;
                const isBackup = r.status === 'SUBMITTED' && r.fileUri;
                const submittedDate = r.submittedAt || r.generatedAt || r.createdAt;
                return (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" />
                      <span className="text-xs font-bold">{formatReportType(r.type)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.period || 'N/A'}
                    {!['IR'].includes(r.type) && r.month ? ` · ${monthLabel(r.month)}` : ''}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {submittedDate ? new Date(submittedDate).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {isBackup ? (
                      <button
                        type="button"
                        onClick={() => openStoredFile(r.fileUri)}
                        title={r.fileName || 'Abrir archivo'}
                        className="flex max-w-[180px] items-center gap-1.5 rounded-lg border border-border/40 bg-muted/30 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/10"
                      >
                        <FileSpreadsheet className="size-3.5 shrink-0" />
                        <span className="truncate">{r.fileName || 'Ver archivo'}</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isBackup && r.actaUri ? (
                      <button
                        type="button"
                        onClick={() => openStoredFile(r.actaUri)}
                        title={r.actaFileName || 'Abrir acta'}
                        className="flex max-w-[180px] items-center gap-1.5 rounded-lg border border-border/40 bg-muted/30 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/10"
                      >
                        <Paperclip className="size-3.5 shrink-0" />
                        <span className="truncate">{r.actaFileName || 'Ver acta'}</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5', statusStyles[r.status || 'DRAFT'])}>
                      {statusLabels[r.status || 'DRAFT']}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                        onClick={() => setShowMeta(r)}
                        title="Ver detalle"
                      >
                        <Eye className="size-4" />
                      </Button>
                      {isBackup && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500"
                          onClick={() => openStoredFile(r.fileUri)}
                          title="Descargar"
                        >
                          <Download className="size-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDeleteReport(r)}
                        title="Eliminar"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
          <div className="space-y-2 p-3 md:hidden">
            {loading ? <p className="py-8 text-center text-xs text-muted-foreground">Cargando...</p> : reports.length === 0 ? <p className="py-8 text-center text-xs text-muted-foreground">No hay respaldos registrados.</p> : reports.map((r) => {
              const isBackup = r.status === 'SUBMITTED' && r.fileUri;
              const submittedDate = r.submittedAt || r.generatedAt || r.createdAt;
              return (
              <div key={r.id} className="min-w-0 rounded-xl border border-border/30 bg-muted/20 p-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-xs font-bold">{formatReportType(r.type)}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{r.period || 'N/A'} · {submittedDate ? new Date(submittedDate).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}</p>
                  </div>
                  <Badge variant="outline" className={cn('shrink-0 text-[9px] font-black uppercase tracking-widest', statusStyles[r.status || 'DRAFT'])}>{statusLabels[r.status || 'DRAFT']}</Badge>
                </div>
                {(isBackup) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/20 pt-2">
                    <button type="button" onClick={() => openStoredFile(r.fileUri)} className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-background/40 px-2 py-1 text-[10px] font-bold text-primary">
                      <FileSpreadsheet className="size-3.5" /> {r.fileName || 'Archivo'}
                    </button>
                    {r.actaUri && (
                      <button type="button" onClick={() => openStoredFile(r.actaUri)} className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-background/40 px-2 py-1 text-[10px] font-bold text-primary">
                        <Paperclip className="size-3.5" /> {r.actaFileName || 'Acta'}
                      </button>
                    )}
                  </div>
                )}
                <div className="mt-2 flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => setShowMeta(r)}><Eye className="size-4" /></Button>
                  <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={() => handleDeleteReport(r)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!showMeta} onOpenChange={(o) => { if (!o) setShowMeta(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">
              {showMeta?.type ? formatReportType(showMeta.type) : ''} · {showMeta?.period || ''}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {showMeta?.status === 'SUBMITTED'
                ? 'Respaldo registrado por el contador con los archivos enviados'
                : `Reporte en estado <strong>${statusLabels[showMeta?.status] || showMeta?.status}</strong>`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-muted/30 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Período</p>
                <p className="text-sm font-bold">{showMeta?.period || 'N/A'}</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</p>
                <p className="text-sm font-bold">{statusLabels[showMeta?.status] || showMeta?.status}</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha y hora de envío</p>
                <p className="text-sm font-bold">
                  {(showMeta?.submittedAt || showMeta?.generatedAt || showMeta?.createdAt)
                    ? new Date(showMeta?.submittedAt || showMeta?.generatedAt || showMeta?.createdAt).toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'short' })
                    : 'N/A'}
                </p>
              </div>
              <div className="rounded-xl bg-muted/30 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Registrado</p>
                <p className="text-sm font-bold">
                  {showMeta?.createdAt ? new Date(showMeta.createdAt).toLocaleDateString('es-NI') : 'N/A'}
                </p>
              </div>
            </div>
            {showMeta?.status === 'SUBMITTED' && (
              <div className="space-y-2">
                {showMeta?.fileUri && (
                  <button
                    type="button"
                    onClick={() => openStoredFile(showMeta.fileUri)}
                    className="flex w-full items-center gap-2 rounded-xl border border-border/40 bg-muted/30 px-4 py-3 text-left text-xs font-bold text-primary hover:bg-primary/10"
                  >
                    <FileSpreadsheet className="size-4" /> Archivo del reporte: {showMeta?.fileName || 'descargar'}
                  </button>
                )}
                {showMeta?.actaUri && (
                  <button
                    type="button"
                    onClick={() => openStoredFile(showMeta.actaUri)}
                    className="flex w-full items-center gap-2 rounded-xl border border-border/40 bg-muted/30 px-4 py-3 text-left text-xs font-bold text-primary hover:bg-primary/10"
                  >
                    <Paperclip className="size-4" /> Acta digital: {showMeta?.actaFileName || 'descargar'}
                  </button>
                )}
                {showMeta?.metadata?.notes && (
                  <div className="rounded-xl bg-muted/30 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observaciones</p>
                    <p className="mt-1 text-xs">{showMeta.metadata.notes}</p>
                  </div>
                )}
              </div>
            )}
            {showMeta?.metadata && (
              <div className="rounded-xl border border-border/30">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4 pt-3 pb-2">Detalles del cálculo</p>
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/20">
                    <tr>
                      <th className="text-left px-4 py-2 font-bold text-muted-foreground">Campo</th>
                      <th className="text-right px-4 py-2 font-bold text-muted-foreground">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(showMeta.metadata)
                      .filter(([k]) => !['period', 'month', 'source', 'notes'].includes(k))
                      .map(([key, val]: [string, any]) => (
                      <tr key={key} className="border-t border-border/10">
                        <td className="px-4 py-1.5 font-medium">{{
                          year: 'Año', netProfit: 'Utilidad Neta', irRate: 'Tasa IR',
                          irAmount: 'IR Calculado', totalIngresos: 'Total Ingresos',
                          totalGastos: 'Total Gastos', totalGross: 'Total Bruto',
                          inssLaboral: 'INSS Laboral', inssPatronal: 'INSS Patronal',
                          employerRate: 'Tasa Patronal', employeeRate: 'Tasa Laboral',
                          totalAmount: 'Monto Total', taxAmount: 'Impuesto'
                        }[key] || key}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums font-mono">
                          {typeof val === 'number' ? (key === 'year' ? String(val) : key.includes('Rate') ? `${(val * 100).toFixed(1)}%` : `C$ ${val.toLocaleString()}`) : String(val)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
