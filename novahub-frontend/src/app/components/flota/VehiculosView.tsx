import { useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { flotaService, type FleetVehicle } from '../../services/flota.service';
import { toast } from '../../services/toast';
import { ErrorState, Field, PageTitle } from '../organizacion/OrgBits';
import { errorMessage } from '../organizacion/organizacion.utils';
import { formatNumber, useFleetRefresh, VEHICLE_STATUS_LABEL } from './flota.helpers';

type Draft = { code: string; plate: string; name: string; vehicleType: string; capacityGallons: string; kmPerGallon: string; commissionPercent: string; status: string; notes: string };
const EMPTY: Draft = { code: '', plate: '', name: '', vehicleType: '', capacityGallons: '', kmPerGallon: '', commissionPercent: '', status: 'ACTIVE', notes: '' };

const toDraft = (vehicle: FleetVehicle): Draft => ({
  code: vehicle.code, plate: vehicle.plate ?? '', name: vehicle.name ?? '', vehicleType: vehicle.vehicleType ?? '',
  capacityGallons: vehicle.capacityGallons != null ? String(vehicle.capacityGallons) : '',
  kmPerGallon: vehicle.kmPerGallon != null ? String(vehicle.kmPerGallon) : '',
  commissionPercent: vehicle.commissionPercent != null ? String(vehicle.commissionPercent) : '',
  status: vehicle.status, notes: vehicle.notes ?? '',
});

export function VehiculosView() {
  const { canPerform } = useAuth();
  const refresh = useFleetRefresh();
  const canCreate = canPerform('FLEET_VEHICLES', 'create');
  const canEdit = canPerform('FLEET_VEHICLES', 'edit');
  const canDelete = canPerform('FLEET_VEHICLES', 'delete');
  const [search, setSearch] = useState('');
  const query = useTenantQuery(['fleet', 'vehicles', search], (signal) => flotaService.listVehicles({ search: search || undefined }, signal));
  const [editing, setEditing] = useState<FleetVehicle | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState<FleetVehicle | null>(null);

  const open = (vehicle: FleetVehicle | 'new') => {
    setEditing(vehicle); setError('');
    setDraft(vehicle === 'new' ? EMPTY : toDraft(vehicle));
  };
  const set = (field: keyof Draft, value: string) => setDraft((current) => ({ ...current, [field]: value }));

  const save = async () => {
    setSaving(true); setError('');
    const body = {
      code: draft.code, plate: draft.plate, name: draft.name, vehicleType: draft.vehicleType, status: draft.status, notes: draft.notes,
      capacityGallons: draft.capacityGallons, kmPerGallon: draft.kmPerGallon, commissionPercent: draft.commissionPercent,
    };
    try {
      if (editing === 'new') await flotaService.createVehicle(body);
      else if (editing) await flotaService.updateVehicle(editing.id, body);
      toast.success('Vehículo guardado');
      setEditing(null);
      await refresh();
    } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await flotaService.removeVehicle(toDelete.id);
      toast.success('Vehículo eliminado');
      setToDelete(null);
      await refresh();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const vehicles = query.data ?? [];
  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle
        eyebrow="Flota y fletes" title="Vehículos" subtitle="Camiones y vehículos de transporte con su capacidad, rendimiento por galón y comisión."
        actions={canCreate ? <Button type="button" onClick={() => open('new')}><Plus className="size-4" aria-hidden="true" />Nuevo vehículo</Button> : undefined}
      />
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código, placa o nombre" aria-label="Buscar vehículos" className="max-w-sm" />
      {query.isLoading && <Skeleton className="h-64 w-full" aria-busy="true" />}
      {query.isError && <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />}
      {!query.isLoading && !query.isError && (
        <div className="min-w-0 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Código</th><th className="px-3 py-2">Placa</th><th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">Capacidad (gal)</th><th className="px-3 py-2 text-right">Km por galón</th><th className="px-3 py-2 text-right">Comisión %</th>
                <th className="px-3 py-2">Estado</th><th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 && <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">Todavía no hay vehículos. {canCreate ? 'Agrega el primero con «Nuevo vehículo».' : ''}</td></tr>}
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 font-mono text-[12px]">{vehicle.code}</td>
                  <td className="px-3 py-2">{vehicle.plate || '—'}</td>
                  <td className="px-3 py-2">{vehicle.name || '—'}</td>
                  <td className="px-3 py-2">{vehicle.vehicleType || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(vehicle.capacityGallons, 3)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(vehicle.kmPerGallon, 3)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(vehicle.commissionPercent, 3)}</td>
                  <td className="px-3 py-2">{VEHICLE_STATUS_LABEL[vehicle.status] ?? vehicle.status}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {canEdit && <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => open(vehicle)} aria-label={`Editar ${vehicle.code}`}><Pencil className="size-4" /></Button>}
                      {canDelete && <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setToDelete(vehicle)} aria-label={`Eliminar ${vehicle.code}`}><Trash2 className="size-4" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(value) => { if (!value) setEditing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing === 'new' ? 'Nuevo vehículo' : 'Editar vehículo'}</DialogTitle></DialogHeader>
          {error && <ErrorState message={error} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Código" htmlFor="veh-code" required><Input id="veh-code" value={draft.code} onChange={(event) => set('code', event.target.value)} placeholder="CAMION-05" /></Field>
            <Field label="Placa" htmlFor="veh-plate"><Input id="veh-plate" value={draft.plate} onChange={(event) => set('plate', event.target.value)} /></Field>
            <Field label="Nombre" htmlFor="veh-name"><Input id="veh-name" value={draft.name} onChange={(event) => set('name', event.target.value)} /></Field>
            <Field label="Tipo" htmlFor="veh-type"><Input id="veh-type" value={draft.vehicleType} onChange={(event) => set('vehicleType', event.target.value)} placeholder="Cisterna, camión…" /></Field>
            <Field label="Capacidad (galones)" htmlFor="veh-cap"><Input id="veh-cap" inputMode="decimal" value={draft.capacityGallons} onChange={(event) => set('capacityGallons', event.target.value)} /></Field>
            <Field label="Rendimiento (km por galón)" htmlFor="veh-kmg" hint="Si lo dejas vacío se usa el de Parámetros."><Input id="veh-kmg" inputMode="decimal" value={draft.kmPerGallon} onChange={(event) => set('kmPerGallon', event.target.value)} /></Field>
            <Field label="Comisión (%)" htmlFor="veh-com" hint="Si lo dejas vacío se usa el tramo por capacidad."><Input id="veh-com" inputMode="decimal" value={draft.commissionPercent} onChange={(event) => set('commissionPercent', event.target.value)} /></Field>
            <Field label="Estado" htmlFor="veh-status">
              <Select value={draft.status} onValueChange={(value) => set('status', value)}>
                <SelectTrigger id="veh-status"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(VEHICLE_STATUS_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Notas" htmlFor="veh-notes" className="sm:col-span-2"><Input id="veh-notes" value={draft.notes} onChange={(event) => set('notes', event.target.value)} /></Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null} onOpenChange={(value) => { if (!value) setToDelete(null); }}
        title="Eliminar vehículo" description={`Se eliminará ${toDelete?.code ?? ''}. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar" variant="destructive" onConfirm={remove}
      />
    </div>
  );
}
