import { useEffect, useState } from 'react';
import { Pencil, ShieldCheck } from 'lucide-react';
import { getPasswordError, isValidEmail } from '../../utils/accountValidation';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { PasswordRequirements } from '../PasswordRequirements';

type ManagerUserEditorDialogProps = {
  user: any | null;
  open: boolean;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: { name: string; email: string; password?: string; isActive: boolean }) => void;
};

export function ManagerUserEditorDialog({ user, open, saving = false, onOpenChange, onSave }: ManagerUserEditorDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setEmail(user.email || '');
    setPassword('');
    setIsActive(user.isActive !== false);
  }, [user]);

  const emailValid = isValidEmail(email);
  const passwordError = getPasswordError(password, false);
  const isProtectedAdmin = String(user?.role || '').toUpperCase() === 'ADMIN'
    || String(user?.userType || '').toUpperCase() === 'ADMIN';
  const canSave = Boolean(name.trim()) && emailValid && !passwordError && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] !max-w-2xl rounded-3xl p-5 sm:p-7">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black uppercase italic tracking-tight">
            <Pencil className="size-5 text-primary" /> Editar usuario de sucursal
          </DialogTitle>
          <DialogDescription>
            Actualiza los datos operativos sin cambiar su rol ni moverlo de sucursal.
          </DialogDescription>
        </DialogHeader>

        {user && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <ShieldCheck className="size-4 text-primary" />
              <span className="text-sm font-semibold">{user.clientTenant?.name || 'Sucursal'}</span>
              <Badge variant="outline">{user.role || 'Usuario'}</Badge>
              {user.employee ? <Badge variant="secondary">Vinculado a RR. HH.</Badge> : <Badge variant="secondary">Usuario independiente</Badge>}
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="min-w-0 space-y-2 text-sm font-semibold">
                <span>Nombre completo</span>
                <input value={name} onChange={(event) => setName(event.target.value)} className="h-11 w-full max-w-full rounded-xl border border-border bg-background px-3 text-sm font-normal outline-none focus:border-primary" />
              </label>
              <label className="min-w-0 space-y-2 text-sm font-semibold">
                <span>Correo de acceso</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full max-w-full rounded-xl border border-border bg-background px-3 text-sm font-normal outline-none focus:border-primary" />
                {!!email && !emailValid && <span className="block text-xs font-normal text-destructive">Escribe un correo válido.</span>}
              </label>
              {!isProtectedAdmin ? <label className="min-w-0 space-y-2 text-sm font-semibold sm:col-span-2">
                <span>Nueva contraseña <span className="font-normal text-muted-foreground">(opcional)</span></span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Déjala vacía para conservarla" className="h-11 w-full max-w-full rounded-xl border border-border bg-background px-3 text-sm font-normal outline-none focus:border-primary" />
                <PasswordRequirements value={password} required={false} />
                {passwordError && <span className="block text-xs font-normal text-destructive">{passwordError}</span>}
              </label> : <p className="text-xs font-normal text-muted-foreground sm:col-span-2">La contraseña de los administradores de sucursal solo la puede cambiar el administrador principal de esa sucursal.</p>}
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/60 p-4">
              <input type="checkbox" checked={isProtectedAdmin || isActive} disabled={isProtectedAdmin} onChange={(event) => setIsActive(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />
              <span><span className="block text-sm font-bold">Cuenta activa</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Al desactivar se invalidan sus sesiones. El administrador principal de la sucursal está protegido.</span></span>
            </label>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button className="rounded-xl" onClick={() => onSave({ name: name.trim(), email: email.trim(), ...(password ? { password } : {}), isActive })} disabled={!canSave}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
