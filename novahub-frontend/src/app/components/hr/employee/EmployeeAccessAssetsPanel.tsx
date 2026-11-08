import { useState } from 'react';
import { KeyRound, Laptop, Loader2, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Skeleton } from '../../ui/skeleton';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { ASSET_CATEGORY_LABEL, employeeProfileService } from '../../../services/employee-profile.service';

const failure = (error: unknown) => (error as any)?.response?.data?.message?.toString?.() || (error as Error)?.message || 'No se pudo completar la acción.';

/** Pestaña «Accesos y equipos»: con qué usuario entra al sistema y qué equipos de la empresa tiene a su cargo. */
export function EmployeeAccessAssetsPanel({ employeeId, canEdit }: { employeeId: string; canEdit: boolean }) {
  const client = useQueryClient();
  const query = useTenantQuery(['hr', 'employee-access-assets', employeeId], (signal) => employeeProfileService.getAccessAssets(employeeId, signal), { staleTime: 15_000 });
  const assignable = useTenantQuery(['hr', 'assignable-assets'], (signal) => employeeProfileService.getAssignableAssets(signal), { staleTime: 15_000, enabled: canEdit });
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = () => void client.invalidateQueries({ queryKey: ['tenant-module'] });
  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try { await action(); toast.success(done); setPick(''); refresh(); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };

  if (query.isLoading) return <Skeleton className="h-40 w-full rounded-2xl" aria-busy="true" />;
  if (query.isError || !query.data) return <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">No se pudo cargar la información.</p>;
  const { access, assets } = query.data;

  return (
    <div className="space-y-5">
      <Card className="space-y-3 rounded-2xl border-border/60 bg-card p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><KeyRound className="size-4 text-primary" aria-hidden /> Acceso al sistema</h3>
        {!access.hasUser ? <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">Este empleado no tiene un usuario del sistema. Sin usuario no entra a NovaHub ni se le pueden asignar equipos.</p> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Usuario</p><p className="break-all text-sm font-semibold">{access.email}</p></div>
            <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rol</p><p className="text-sm font-semibold">{access.customRole ?? access.role}</p></div>
            <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</p><Badge variant={access.isActive ? 'default' : 'outline'}>{access.isActive ? 'Activo' : 'Desactivado'}</Badge></div>
            <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Último ingreso</p><p className="text-sm font-semibold">{access.lastLoginAt ? new Date(access.lastLoginAt).toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' }) : 'Nunca'}</p></div>
            {access.modules.length > 0 && <div className="sm:col-span-2 lg:col-span-4"><p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Módulos a los que tiene acceso</p><div className="flex flex-wrap gap-1.5">{access.modules.map((module) => <Badge key={module} variant="outline" className="text-[10px]">{module}</Badge>)}</div></div>}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Los accesos se cambian en Configuración › Usuarios y roles.</p>
      </Card>

      <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><Laptop className="size-4 text-primary" aria-hidden /> Equipos asignados ({assets.length})</h3>
        {assets.length === 0 ? <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">No tiene equipos asignados.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {assets.map((asset) => (
              <li key={asset.id} className="min-w-0 rounded-xl border border-border/60 p-3">
                <p className="break-words font-bold">{asset.name} <span className="font-mono text-xs font-normal text-muted-foreground">{asset.code}</span></p>
                <p className="text-xs text-muted-foreground">{ASSET_CATEGORY_LABEL[asset.category] ?? asset.category}{asset.brand ? ` · ${asset.brand}` : ''}{asset.model ? ` ${asset.model}` : ''}{asset.serialNumber ? ` · Serie ${asset.serialNumber}` : ''}</p>
                {canEdit && <button type="button" disabled={busy} className="mt-2 text-xs font-semibold text-primary underline disabled:opacity-50 dark:text-accent" onClick={() => void run(() => employeeProfileService.releaseAsset(employeeId, asset.id), 'Equipo devuelto')}>Marcar como devuelto</button>}
              </li>
            ))}
          </ul>
        )}
        {canEdit && access.hasUser && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
            <select aria-label="Equipo a asignar" className="h-9 min-w-0 flex-1 rounded-xl border border-border/60 bg-background px-3 text-sm" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">{assignable.isLoading ? 'Cargando equipos…' : assignable.data?.length ? 'Elegir un equipo disponible…' : 'No hay equipos disponibles'}</option>
              {assignable.data?.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} ({asset.code}){asset.serialNumber ? ` · ${asset.serialNumber}` : ''}</option>)}
            </select>
            <Button type="button" size="sm" disabled={!pick || busy} onClick={() => void run(() => employeeProfileService.assignAsset(employeeId, pick), 'Equipo asignado')}>{busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Plus className="mr-1.5 size-4" />}Asignar</Button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Los equipos se dan de alta en Inventario › Mobiliario y equipos; aquí solo se asignan o se devuelven.</p>
      </Card>
    </div>
  );
}
