import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { customersService } from '@/app/services/ventas.service';
import { SalesViewTutorial } from './SalesViewTutorial';

interface QuickAddCustomerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function QuickAddCustomerModal({ open, onOpenChange, onSuccess }: QuickAddCustomerModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  
  const defaultForm = {
    name: '',
    type: 'INDIVIDUAL' as 'INDIVIDUAL' | 'COMPANY',
    email: '',
    phone: '',
    identificationNumber: '',
    ruc: '',
    address: '',
    city: '',
    country: '',
    notes: ''
  };

  const [form, setForm] = useState(defaultForm);

  const handleUpdate = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('El nombre del cliente es obligatorio');
      return;
    }
    if (form.type === 'COMPANY' && !form.ruc.trim()) {
      toast.error('El RUC es obligatorio cuando el cliente es una empresa');
      return;
    }

    setIsSaving(true);
    try {
      await customersService.create({
        ...form,
        taxId: form.type === 'INDIVIDUAL' ? form.identificationNumber.trim() || undefined : undefined,
        ruc: form.type === 'COMPANY' ? form.ruc.trim() : undefined,
      });
      toast.success('Cliente registrado exitosamente');
      setForm(defaultForm);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || 'Error al guardar el cliente');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isSaving) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSave}>
          <DialogHeader data-tour="sales-form-title">
            <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
              <UserPlus className="size-5 text-primary" /> Agregar Cliente
            </DialogTitle>
            <DialogDescription>
              Registra un nuevo cliente para esta facturación. Solo el nombre es obligatorio.
            </DialogDescription>
            <SalesViewTutorial view="customers" context="form" />
          </DialogHeader>

          <div className="grid gap-4 py-4" data-tour="sales-form-data">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                Nombre / Empresa *
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => handleUpdate('name', e.target.value)}
                placeholder="Nombre del cliente"
                className="h-10 rounded-xl"
                disabled={isSaving}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                  Tipo de cliente *
                </Label>
                <select
                  value={form.type}
                  onChange={e => handleUpdate('type', e.target.value)}
                  disabled={isSaving}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="INDIVIDUAL">Particular</option>
                  <option value="COMPANY">Empresa</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                  Teléfono
                </Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={e => handleUpdate('phone', e.target.value)}
                  placeholder="+505..."
                  className="h-10 rounded-xl"
                  disabled={isSaving}
                />
              </div>
            </div>

            {form.type === 'COMPANY' ? (
              <div className="space-y-1.5">
                <Label htmlFor="ruc" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                  RUC *
                </Label>
                <Input
                  id="ruc"
                  value={form.ruc}
                  onChange={e => handleUpdate('ruc', e.target.value)}
                  placeholder="J0000000000001"
                  className="h-10 rounded-xl"
                  disabled={isSaving}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="identification" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                  Cédula
                </Label>
                <Input
                  id="identification"
                  value={form.identificationNumber}
                  onChange={e => handleUpdate('identificationNumber', e.target.value)}
                  placeholder="001-010190-1000A"
                  className="h-10 rounded-xl"
                  disabled={isSaving}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                Correo Electrónico
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={e => handleUpdate('email', e.target.value)}
                placeholder="correo@ejemplo.com"
                className="h-10 rounded-xl"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                Dirección
              </Label>
              <Input
                id="address"
                value={form.address}
                onChange={e => handleUpdate('address', e.target.value)}
                placeholder="Dirección completa"
                className="h-10 rounded-xl"
                disabled={isSaving}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                  Ciudad
                </Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={e => handleUpdate('city', e.target.value)}
                  placeholder="Managua"
                  className="h-10 rounded-xl"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                  País
                </Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={e => handleUpdate('country', e.target.value)}
                  placeholder="Nicaragua"
                  className="h-10 rounded-xl"
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="space-y-1.5" data-tour="sales-form-summary">
              <Label htmlFor="notes" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                Notas (Opcional)
              </Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={e => handleUpdate('notes', e.target.value)}
                placeholder="Observaciones adicionales"
                className="resize-none rounded-xl border border-border bg-background"
                disabled={isSaving}
              />
            </div>
          </div>

          <DialogFooter data-tour="sales-form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="h-10 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !form.name.trim()}
              className="h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              {isSaving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Guardar Cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
