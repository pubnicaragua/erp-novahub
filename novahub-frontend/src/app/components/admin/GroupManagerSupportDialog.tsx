import { useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { enterpriseGroupsService } from '../../services/enterprise-groups.service';
import { getPasswordError } from '../../utils/accountValidation';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

export function GroupManagerSupportDialog({ group }: { group: any }) {
  const [open, setOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const managers = group?.managerAssignments || [];

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
    <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5" disabled={!managers.length} onClick={() => setOpen(true)}>
      <ShieldCheck className="size-3.5" /> <span className="hidden lg:inline">Managers ({managers.length})</span>
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl rounded-3xl p-5 sm:p-7">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black uppercase italic tracking-tight"><ShieldCheck className="size-5 text-primary" /> Soporte de Managers</DialogTitle>
          <DialogDescription>Administra el acceso global de los Managers de {group?.name}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {managers.map((assignment: any) => <div key={assignment.user?.id || assignment.id} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{assignment.user?.name}</p><Badge variant={assignment.isOwner ? 'default' : 'outline'}>{assignment.isOwner ? 'Propietario' : 'Manager'}</Badge></div><p className="truncate text-xs text-muted-foreground">{assignment.user?.email}</p></div>
            <Button variant="outline" className="shrink-0 rounded-xl" onClick={() => { setSelectedManager(assignment); setPassword(''); }}><KeyRound className="mr-2 size-4" /> Cambiar contraseña</Button>
          </div>)}
          {!managers.length && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Este grupo no tiene Managers registrados.</p>}
        </div>
        <DialogFooter><Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cerrar</Button></DialogFooter>
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
