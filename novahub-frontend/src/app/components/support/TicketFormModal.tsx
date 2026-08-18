import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Loader2 } from 'lucide-react';
import type { Ticket } from '../../types';
import { supportService } from '../../services/support.service';
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

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [status, setStatus] = useState('OPEN');
  const [customerId, setCustomerId] = useState('');

  useEffect(() => {
    if (open) {
      if (ticket?.id) {
        setSubject(ticket.subject || '');
        setDescription(ticket.description || '');
        setPriority(ticket.priority || 'MEDIUM');
        setStatus(ticket.status || 'OPEN');
        setCustomerId(ticket.customerId || '');
      } else {
        setSubject('');
        setDescription('');
        setPriority('MEDIUM');
        setStatus('OPEN');
        setCustomerId('');
      }
    }
  }, [open, ticket]);

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
      const data: Partial<Ticket> = {
        subject: subject.trim(),
        description: description.trim(),
        priority: priority as any,
        status: status as any,
        ...(customerId ? { customerId } : {}),
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
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Sin cliente asociado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin cliente</SelectItem>
                  {customerCatalog.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
