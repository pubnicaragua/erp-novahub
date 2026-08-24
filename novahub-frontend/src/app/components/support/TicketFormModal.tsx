import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ImagePlus, Loader2, X } from 'lucide-react';
import type { Ticket } from '../../types';
import { supportService } from '../../services/support.service';
import { MAX_EVIDENCE_FILES, validateEvidenceFile } from '../../services/soporte-tecnico.service';
import { storageService } from '../../services/storage.service';
import { toast } from 'sonner';

interface TicketFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket?: Ticket | null;
  onRefresh: () => void;
  customerCatalog?: any[];
}

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
];

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Abierto' },
  { value: 'IN_PROGRESS', label: 'En Progreso' },
  { value: 'RESOLVED', label: 'Resuelto' },
  { value: 'CLOSED', label: 'Cerrado' },
];

export function TicketFormModal({ open, onOpenChange, ticket, onRefresh, customerCatalog = [] }: TicketFormModalProps) {
  const isEditing = Boolean(ticket?.id);
  const [saving, setSaving] = useState(false);

  const [subject, setSubject] = useState(ticket?.subject || '');
  const [description, setDescription] = useState(ticket?.description || '');
  const [priority, setPriority] = useState<string>(ticket?.priority || 'MEDIUM');
  const [status, setStatus] = useState<string>(ticket?.status || 'OPEN');
  const [customerId, setCustomerId] = useState(ticket?.customerId || '');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);

  const handleEvidenceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.currentTarget.value = '';
    if (evidenceFiles.length + selected.length > MAX_EVIDENCE_FILES) {
      toast.error(`Solo puedes adjuntar hasta ${MAX_EVIDENCE_FILES} imágenes por ticket.`);
      return;
    }
    try {
      selected.forEach(validateEvidenceFile);
      setEvidenceFiles(current => [...current, ...selected]);
    } catch (error: any) {
      toast.error(error?.message || 'La evidencia no es válida');
    }
  };

  const handleSave = async () => {
    if (!subject.trim()) {
      toast.error('El asunto es obligatorio');
      return;
    }
    if (!description.trim()) {
      toast.error('La descripción es obligatoria');
      return;
    }

    setSaving(true);
    try {
      const uploadedEvidence = await Promise.all(
        evidenceFiles.map((file, index) => storageService.uploadFile('support-evidence', file, { folder: `tickets/evidencia-${index + 1}` })),
      );
      const data: Partial<Ticket> = {
        subject: subject.trim(),
        description: description.trim(),
        priority: priority as any,
        status: status as any,
        ...(customerId ? { customerId } : {}),
        ...(uploadedEvidence.length > 0
          ? {
              evidenceUrl1: uploadedEvidence[0]?.uri,
              evidenceUrl2: uploadedEvidence[1]?.uri,
            }
          : {}),
      };

      if (isEditing && ticket?.id) {
        await supportService.update(ticket.id, data);
        toast.success('Ticket actualizado');
      } else {
        await supportService.create(data);
        toast.success('Ticket creado');
      }

      onOpenChange(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al guardar ticket');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Ticket' : 'Nuevo Ticket'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifica los datos del ticket de soporte.' : 'Crea un nuevo ticket de soporte para un cliente o incidencia interna.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Asunto *</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-9 text-xs"
              placeholder="Ej: Error al facturar, Solicitud de cambio..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Descripción *</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs min-h-[80px]"
              placeholder="Describe el problema o solicitud en detalle..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Prioridad</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isEditing && (
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Estado</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {customerCatalog.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Cliente asociado (opcional)</label>
              <Select value={customerId || '__none__'} onValueChange={(value) => setCustomerId(value === '__none__' ? '' : value)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Sin cliente asociado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin cliente</SelectItem>
                  {customerCatalog.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-muted-foreground">
                  <ImagePlus className="size-3.5 text-primary" /> Evidencias
                </label>
                <p className="mt-1 text-[10px] text-muted-foreground">Hasta 2 imágenes JPG, PNG, WEBP o GIF de 10 MB originales; se optimizan antes de guardarse.</p>
              </div>
              {evidenceFiles.length < MAX_EVIDENCE_FILES && (
                <label className="relative inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 text-[10px] font-black uppercase text-primary hover:bg-primary/15">
                  <ImagePlus className="size-4" /> Adjuntar
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="absolute inset-0 cursor-pointer opacity-0" onChange={handleEvidenceChange} />
                </label>
              )}
            </div>
            {(ticket?.evidenceUrl1 || ticket?.evidenceUrl2 || evidenceFiles.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {[ticket?.evidenceUrl1, ticket?.evidenceUrl2].filter(Boolean).map((url, index) => (
                  url?.startsWith('storage://') ? (
                    <span key={`existing-${url}`} className="max-w-full truncate rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground">Evidencia existente {index + 1}</span>
                  ) : (
                    <a key={`existing-${url}`} href={url} target="_blank" rel="noreferrer" className="max-w-full truncate rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-[10px] font-semibold text-primary hover:underline">Evidencia existente {index + 1}</a>
                  )
                ))}
                {evidenceFiles.map((file, index) => (
                  <span key={`${file.name}-${file.lastModified}`} className="flex max-w-full items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-[10px] font-semibold">
                    <span className="max-w-[180px] truncate">{file.name}</span>
                    <button type="button" onClick={() => setEvidenceFiles(current => current.filter((_, i) => i !== index))} className="text-muted-foreground hover:text-rose-500" aria-label={`Quitar ${file.name}`}>
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {isEditing && evidenceFiles.length > 0 && <p className="text-[10px] text-amber-600">Al guardar, las nuevas evidencias reemplazarán las existentes.</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
            {isEditing ? 'Guardar cambios' : 'Crear Ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
