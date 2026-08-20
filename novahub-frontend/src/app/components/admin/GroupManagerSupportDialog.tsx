import { useEffect, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { enterpriseGroupsService } from '../../services/enterprise-groups.service';
import { authService } from '../../services/auth.service';
import { getPasswordError, isValidEmail, normalizeEmail } from '../../utils/accountValidation';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

export function GroupManagerSupportDialog({ group, onChanged }: { group: any; onChanged?: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [managerForm, setManagerForm] = useState({ name: '', email: '', password: '' });
  const [managerEmailStatus, setManagerEmailStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle');
  const managers = group?.managerAssignments || [];

  useEffect(() => {
    const email = normalizeEmail(managerForm.email);
    let active = true;
    const timer = window.setTimeout(async () => {
      if (!email || !isValidEmail(email)) {
        if (active) setManagerEmailStatus('idle');
        return;
      }
      setManagerEmailStatus('checking');
      try {
        const response = await authService.checkEmail(email);
        const exists = (response as any)?.data?.exists ?? (response as any)?.exists;
        if (active) setManagerEmailStatus(exists ? 'taken' : 'available');
      } catch {
        if (active) setManagerEmailStatus('error');
      }
    }, email && isValidEmail(email) ? 350 : 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [managerForm.email]);

  const resetManagerForm = () => {
    setManagerForm({ name: '', email: '', password: '' });
    setManagerEmailStatus('idle');
  };

  const createMissingManager = async () => {
    const email = normalizeEmail(managerForm.email);
    const passwordError = getPasswordError(managerForm.password);
    if (!managerForm.name.trim() || !isValidEmail(email) || managerEmailStatus !== 'available' || passwordError) {
      toast.error(passwordError || 'Completa el nombre y utiliza un correo disponible');
      return;
    }

    try {
      setSaving(true);
      await enterpriseGroupsService.createMissingPlatformManager(group.id, {
        name: managerForm.name.trim(),
        email,
        password: managerForm.password,
      });
      toast.success('Manager agregado al grupo empresarial');
      setOpen(false);
      resetManagerForm();
      await onChanged?.();
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo agregar el Manager');
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    const error = getPasswordError(password);
    if (error || !selectedManager?.user?.id) {
      toast.error(error || 'Selecciona un Manager');
      return;
    }
    try {
      setSaving(true);
      await enterpriseGroupsService.updatePlatformManagerPassword(group.id, selectedManager.user.id, password);
      toast.success('Contraseña del Manager actualizada');
      setSelectedManager(null);
      setPassword('');
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo actualizar la contraseña');
    } finally {
      setSaving(false);
    }
  };

  return <>
    <Button aria-label={managers.length ? `Soporte de ${managers.length} Managers` : 'Agregar Manager al grupo empresarial'} variant={managers.length ? 'outline' : 'default'} size="sm" className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5" onClick={() => setOpen(true)}>
      <UserRound className="size-3.5" /> <span className="hidden lg:inline">{managers.length ? `Managers (${managers.length})` : 'Agregar Manager'}</span>
    </Button>
    <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) resetManagerForm(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl rounded-3xl p-5 sm:p-7">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black uppercase italic tracking-tight"><ShieldCheck className="size-5 text-primary" /> {managers.length ? 'Soporte de Managers' : 'Agregar Manager al grupo'}</DialogTitle>
          <DialogDescription>{managers.length ? `Administra el acceso global de los Managers de ${group?.name}.` : `Este grupo no tiene Manager asignado. Crea su acceso global para continuar con la configuración de ${group?.name}.`}</DialogDescription>
        </DialogHeader>
        {managers.length ? <>
          <div className="space-y-3">
            {managers.map((assignment: any) => <div key={assignment.user?.id || assignment.id} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{assignment.user?.name}</p><Badge variant={assignment.isOwner ? 'default' : 'outline'}>{assignment.isOwner ? 'Propietario' : 'Manager'}</Badge></div><p className="truncate text-xs text-muted-foreground">{assignment.user?.email}</p></div>
              <Button variant="outline" className="shrink-0 rounded-xl" onClick={() => { setSelectedManager(assignment); setPassword(''); }}><KeyRound className="mr-2 size-4" /> Cambiar contraseña</Button>
            </div>)}
          </div>
          <DialogFooter><Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cerrar</Button></DialogFooter>
        </> : <>
          <div className="grid gap-4 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 sm:grid-cols-2 sm:p-5">
            <label className="space-y-1 text-xs font-bold text-muted-foreground">Nombre completo<input value={managerForm.name} onChange={(event) => setManagerForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre del responsable" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" /></label>
            <label className="space-y-1 text-xs font-bold text-muted-foreground">Correo de acceso<input type="email" value={managerForm.email} onChange={(event) => setManagerForm((current) => ({ ...current, email: event.target.value }))} placeholder="manager@grupo.com" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" /><span className={`mt-1 block text-[11px] font-normal ${managerEmailStatus === 'taken' ? 'text-destructive' : managerEmailStatus === 'available' ? 'text-emerald-600' : 'text-muted-foreground'}`}>{managerEmailStatus === 'checking' ? 'Verificando disponibilidad…' : managerEmailStatus === 'taken' ? 'Este correo ya está registrado en otra cuenta' : managerEmailStatus === 'available' ? 'Correo disponible' : managerEmailStatus === 'error' ? 'No se pudo verificar el correo; intenta nuevamente' : 'Debe ser un correo válido y único'}</span></label>
            <label className="space-y-1 text-xs font-bold text-muted-foreground sm:col-span-2">Contraseña inicial<input type="password" value={managerForm.password} onChange={(event) => setManagerForm((current) => ({ ...current, password: event.target.value }))} placeholder="Contraseña segura" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" /><span className="mt-1 block text-[11px] font-normal">{getPasswordError(managerForm.password) || 'Debe cumplir la política de seguridad de NovaHub.'}</span></label>
          </div>
          <DialogFooter><Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancelar</Button><Button className="rounded-xl" disabled={saving || managerEmailStatus !== 'available' || Boolean(getPasswordError(managerForm.password)) || !managerForm.name.trim()} onClick={createMissingManager}>{saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Guardando…</> : <><ShieldCheck className="mr-2 size-4" />Crear Manager</>}</Button></DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(selectedManager)} onOpenChange={(nextOpen) => { if (!nextOpen) { setSelectedManager(null); setPassword(''); } }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-3xl p-5 sm:p-7">
        <DialogHeader><DialogTitle className="font-black uppercase italic tracking-tight">Cambiar contraseña</DialogTitle><DialogDescription>Actualiza la contraseña de {selectedManager?.user?.name}.</DialogDescription></DialogHeader>
        <input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nueva contraseña" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
        <p className="text-xs text-muted-foreground">Debe cumplir la política de seguridad de NovaHub.</p>
        <DialogFooter><Button variant="outline" className="rounded-xl" onClick={() => setSelectedManager(null)}>Cancelar</Button><Button className="rounded-xl" disabled={saving || Boolean(getPasswordError(password))} onClick={savePassword}>{saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Guardando…</> : 'Guardar contraseña'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
