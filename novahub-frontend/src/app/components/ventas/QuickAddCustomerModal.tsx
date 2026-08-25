import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { Building2, FileText, Loader2, Mail, MapPin, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { customersService } from '@/app/services/ventas.service';
import { SalesViewTutorial } from './SalesViewTutorial';

interface QuickAddCustomerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type QuickCustomerForm = {
  name: string;
  type: 'INDIVIDUAL' | 'COMPANY';
  fiscalRegime: string;
  email: string;
  phone: string;
  identificationNumber: string;
  ruc: string;
  address: string;
  city: string;
  department: string;
  country: string;
  notes: string;
};

const DEFAULT_FORM: QuickCustomerForm = {
  name: '',
  type: 'INDIVIDUAL',
  fiscalRegime: '',
  email: '',
  phone: '',
  identificationNumber: '',
  ruc: '',
  address: '',
  city: '',
  department: '',
  country: 'Nicaragua',
  notes: '',
};

const FISCAL_REGIMES = ['Régimen Simplificado (Cuota Fija)', 'Régimen General'];
const fieldClass = 'h-11 rounded-xl border-border/70 bg-background/80 shadow-sm transition focus-visible:ring-2 focus-visible:ring-primary/20';
const labelClass = 'text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground';

function SectionHeading({ number, icon: Icon, title, description }: { number: string; icon: typeof Building2; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black tracking-[0.18em] text-primary">{number}</span>
          <h3 className="text-sm font-black uppercase tracking-widest">{title}</h3>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function QuickAddCustomerModal({ open, onOpenChange, onSuccess }: QuickAddCustomerModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<QuickCustomerForm>(DEFAULT_FORM);

  const handleUpdate = (field: keyof QuickCustomerForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    if (isSaving) return;
    setForm(DEFAULT_FORM);
    onOpenChange(false);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    const taxId = form.identificationNumber.trim();
    const ruc = form.ruc.trim();

    if (!name) {
      toast.error('El nombre del cliente es obligatorio');
      return;
    }
    if (form.type === 'COMPANY' && !ruc) {
      toast.error('El RUC es obligatorio cuando el cliente es una empresa');
      return;
    }

    setIsSaving(true);
    try {
      const { identificationNumber: _identificationNumber, ...customerData } = form;
      await customersService.create({
        ...customerData,
        name,
        taxId: taxId || undefined,
        ruc: ruc || undefined,
        fiscalRegime: form.fiscalRegime || undefined,
        department: form.department.trim() || undefined,
      });
      toast.success('Cliente registrado exitosamente');
      setForm(DEFAULT_FORM);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || 'Error al guardar el cliente');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!isSaving) { if (!value) setForm(DEFAULT_FORM); onOpenChange(value); } }}>
      <DialogContent className="!flex !max-h-[92vh] !w-[calc(100vw-1rem)] !max-w-[min(94vw,980px)] !flex-col !gap-0 overflow-hidden rounded-3xl border-border/70 bg-background/95 p-0 shadow-2xl backdrop-blur-sm">
        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="relative shrink-0 overflow-hidden border-b border-border/50 bg-gradient-to-br from-primary/[0.10] via-background to-background px-5 py-5 sm:px-7 sm:py-6" data-tour="sales-form-title">
            <div className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-primary/[0.08] blur-2xl" />
            <div className="relative flex items-start gap-3 pr-8">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <UserPlus className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Facturación rápida</span>
                  <Badge variant="outline" className="rounded-full border-primary/25 bg-primary/5 text-[9px] font-black uppercase tracking-wider text-primary">Nuevo registro</Badge>
                </div>
                <DialogTitle className="mt-1 text-xl font-black uppercase tracking-tight sm:text-2xl">Agregar cliente</DialogTitle>
                <DialogDescription className="mt-2 max-w-3xl text-sm leading-5 text-muted-foreground">
                  Registra los datos esenciales del cliente sin salir de la facturación. Solo el nombre es obligatorio.
                </DialogDescription>
              </div>
            </div>
            <div className="relative mt-4 flex flex-wrap gap-2 text-[10px] font-bold text-muted-foreground">
              <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1.5">Código automático</span>
              <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1.5">Cédula y RUC independientes</span>
              <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1.5">Datos editables después</span>
            </div>
            <SalesViewTutorial
              view="customers"
              context="form"
              className="relative mt-4 h-auto min-h-10 w-full justify-center rounded-xl border-primary/20 bg-background/75 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] hover:bg-primary/5"
            />
          </DialogHeader>

          <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5 sm:space-y-5 sm:p-7" data-tour="sales-form-data">
            <section className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5">
              <SectionHeading number="01" icon={Building2} title="Identificación" description="Define quién es el cliente y registra cualquiera de sus identificadores fiscales." />
              <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                  <Label htmlFor="quick-customer-name" className={labelClass}>Nombre / empresa *</Label>
                  <Input id="quick-customer-name" value={form.name} onChange={(event) => handleUpdate('name', event.target.value)} placeholder="Nombre del particular o empresa" className={fieldClass} autoFocus required disabled={isSaving} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quick-customer-type" className={labelClass}>Tipo de cliente *</Label>
                  <Select value={form.type} onValueChange={(value) => handleUpdate('type', value)}>
                    <SelectTrigger id="quick-customer-type" disabled={isSaving} className={`${fieldClass} w-full px-3 text-sm`}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="INDIVIDUAL">Particular</SelectItem><SelectItem value="COMPANY">Empresa</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quick-customer-tax-id" className={labelClass}>Cédula</Label>
                  <Input id="quick-customer-tax-id" value={form.identificationNumber} onChange={(event) => handleUpdate('identificationNumber', event.target.value)} placeholder="001-010190-1000A" className={fieldClass} disabled={isSaving} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quick-customer-ruc" className={labelClass}>RUC {form.type === 'COMPANY' && <span className="text-destructive">*</span>}</Label>
                  <Input id="quick-customer-ruc" value={form.ruc} onChange={(event) => handleUpdate('ruc', event.target.value)} placeholder="J0310000000000" className={fieldClass} required={form.type === 'COMPANY'} disabled={isSaving} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quick-customer-fiscal-regime" className={labelClass}>Régimen fiscal</Label>
                  <Select value={form.fiscalRegime || '__none__'} onValueChange={(value) => handleUpdate('fiscalRegime', value === '__none__' ? '' : value)}>
                    <SelectTrigger id="quick-customer-fiscal-regime" disabled={isSaving} className={`${fieldClass} w-full px-3 text-sm`}><SelectValue placeholder="Seleccionar régimen" /></SelectTrigger>
                    <SelectContent><SelectItem value="__none__">Sin especificar</SelectItem>{FISCAL_REGIMES.map((regime) => <SelectItem key={regime} value={regime}>{regime}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5">
              <SectionHeading number="02" icon={Mail} title="Contacto" description="Agrega los datos que se utilizarán para comunicación y seguimiento." />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="quick-customer-email" className={labelClass}>Correo electrónico</Label><Input id="quick-customer-email" type="email" value={form.email} onChange={(event) => handleUpdate('email', event.target.value)} placeholder="correo@ejemplo.com" className={fieldClass} disabled={isSaving} /></div>
                <div className="space-y-1.5"><Label htmlFor="quick-customer-phone" className={labelClass}>Teléfono / WhatsApp</Label><Input id="quick-customer-phone" value={form.phone} onChange={(event) => handleUpdate('phone', event.target.value)} placeholder="+505 8888-8888" className={fieldClass} disabled={isSaving} /></div>
              </div>
            </section>

            <section className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5">
              <SectionHeading number="03" icon={MapPin} title="Ubicación" description="La dirección ayuda a identificar y atender correctamente al cliente." />
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3"><Label htmlFor="quick-customer-address" className={labelClass}>Dirección</Label><Input id="quick-customer-address" value={form.address} onChange={(event) => handleUpdate('address', event.target.value)} placeholder="Calle, número y referencias" className={fieldClass} disabled={isSaving} /></div>
                <div className="space-y-1.5"><Label htmlFor="quick-customer-city" className={labelClass}>Ciudad</Label><Input id="quick-customer-city" value={form.city} onChange={(event) => handleUpdate('city', event.target.value)} placeholder="Managua" className={fieldClass} disabled={isSaving} /></div>
                <div className="space-y-1.5"><Label htmlFor="quick-customer-department" className={labelClass}>Departamento</Label><Input id="quick-customer-department" value={form.department} onChange={(event) => handleUpdate('department', event.target.value)} placeholder="Managua" className={fieldClass} disabled={isSaving} /></div>
                <div className="space-y-1.5"><Label htmlFor="quick-customer-country" className={labelClass}>País</Label><Input id="quick-customer-country" value={form.country} onChange={(event) => handleUpdate('country', event.target.value)} placeholder="Nicaragua" className={fieldClass} disabled={isSaving} /></div>
              </div>
            </section>

            <section className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5" data-tour="sales-form-summary">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><FileText className="size-4" /></div>
                <div><h3 className="text-sm font-black uppercase tracking-widest">Notas internas</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Guarda una referencia útil para el equipo. Este campo no se muestra como requisito de facturación.</p></div>
              </div>
              <Textarea id="quick-customer-notes" value={form.notes} onChange={(event) => handleUpdate('notes', event.target.value)} placeholder="Observaciones adicionales" className="mt-5 min-h-24 resize-y rounded-xl border-border/70 bg-background/80 shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20" disabled={isSaving} />
            </section>
          </div>

          <DialogFooter className="shrink-0 flex-col gap-2 border-t border-border/50 bg-muted/[0.12] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7" data-tour="sales-form-actions">
            <p className="order-2 text-center text-[11px] text-muted-foreground sm:order-1 sm:text-left"><span className="font-bold text-foreground">Consejo:</span> podrás completar o editar estos datos desde Clientes.</p>
            <div className="order-1 flex w-full gap-2 sm:order-2 sm:w-auto">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving} className="h-10 flex-1 rounded-xl sm:flex-none">Cancelar</Button>
              <Button type="submit" disabled={isSaving || !form.name.trim() || (form.type === 'COMPANY' && !form.ruc.trim())} className="h-10 flex-1 rounded-xl bg-primary font-bold text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 sm:flex-none">
                {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UserPlus className="mr-2 size-4" />}
                {isSaving ? 'Guardando...' : 'Guardar cliente'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
