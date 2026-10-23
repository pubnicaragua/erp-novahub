import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { Warehouse } from 'lucide-react';
import { Badge } from '../ui/badge';
import type { ManagerBranchScopeRule } from './ManagerBranchAccessEditor';

export type ManagerAssignableWarehouse = {
  id: string;
  name: string;
  businessUnitId: string;
  authorizedBranchIds: string[];
};

type ManagerWarehouseAccessEditorProps = {
  warehouses: ManagerAssignableWarehouse[];
  branches: Array<{ id: string; name: string; businessUnitId?: string | null }>;
  scopeRules: ManagerBranchScopeRule[];
  selectedWarehouseIds: string[];
  setSelectedWarehouseIds: Dispatch<SetStateAction<string[]>>;
  warehouseScopeRestricted: boolean;
  setWarehouseScopeRestricted: (restricted: boolean) => void;
  isOwner: boolean;
};

export function ManagerWarehouseAccessEditor({
  warehouses,
  branches,
  scopeRules,
  selectedWarehouseIds,
  setSelectedWarehouseIds,
  warehouseScopeRestricted,
  setWarehouseScopeRestricted,
  isOwner,
}: ManagerWarehouseAccessEditorProps) {
  const availableWarehouses = useMemo(() => {
    const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
    return warehouses
      .filter((warehouse) => scopeRules.some((scope) => {
        if (scope.businessUnitId !== warehouse.businessUnitId) return false;
        if (scope.branchMode === 'ALL_CURRENT_AND_FUTURE') return true;
        return (scope.branchIds || []).some((branchId) => warehouse.authorizedBranchIds.includes(branchId));
      }))
      .map((warehouse) => ({
        ...warehouse,
        branchNames: warehouse.authorizedBranchIds
          .map((branchId) => branchNames.get(branchId))
          .filter((name): name is string => Boolean(name)),
      }));
  }, [branches, scopeRules, warehouses]);

  useEffect(() => {
    const availableIds = new Set(availableWarehouses.map((warehouse) => warehouse.id));
    setSelectedWarehouseIds((current) => {
      const next = current.filter((id) => availableIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [availableWarehouses, setSelectedWarehouseIds]);

  const toggleWarehouse = (warehouseId: string, checked: boolean) => {
    setWarehouseScopeRestricted(true);
    setSelectedWarehouseIds(checked
      ? [...new Set([...selectedWarehouseIds, warehouseId])]
      : selectedWarehouseIds.filter((id) => id !== warehouseId));
  };

  const setInherited = (inherited: boolean) => {
    setWarehouseScopeRestricted(!inherited);
    if (inherited) setSelectedWarehouseIds([]);
  };

  return <section className="space-y-3 rounded-2xl border border-border/60 bg-muted/15 p-4" aria-labelledby="manager-warehouse-access-title">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 id="manager-warehouse-access-title" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
          <Warehouse className="size-4 text-primary" />Bodegas corporativas
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">Las bodegas operativas siguen el acceso de sucursal configurado arriba.</p>
      </div>
      <Badge variant="outline" className="w-fit shrink-0">{availableWarehouses.length} disponible(s)</Badge>
    </div>

    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-background p-3 text-sm">
      <input
        type="checkbox"
        checked={!warehouseScopeRestricted}
        onChange={(event) => setInherited(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
        aria-label="Heredar alcance de bodegas corporativas"
      />
      <span className="min-w-0">
        <span className="block font-semibold">{isOwner ? 'Sin restricción adicional' : 'Heredar mi alcance corporativo'}</span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {isOwner
            ? 'El Manager verá las bodegas corporativas autorizadas por su rubro y sus sucursales.'
            : 'El Backend intersecta el alcance del nuevo Manager con las bodegas corporativas que tú puedes ver.'}
        </span>
      </span>
    </label>

    {warehouseScopeRestricted && <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {selectedWarehouseIds.length
          ? 'Solo podrá ver las bodegas marcadas.'
          : 'No verá bodegas corporativas. Las bodegas propias de sus sucursales se conservan.'}
      </p>
      {availableWarehouses.length ? <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2">
        {availableWarehouses.map((warehouse) => <label key={warehouse.id} className="flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-background p-3 text-sm">
          <input
            type="checkbox"
            checked={selectedWarehouseIds.includes(warehouse.id)}
            onChange={(event) => toggleWarehouse(warehouse.id, event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
            aria-label={`Permitir bodega ${warehouse.name}`}
          />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{warehouse.name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {warehouse.branchNames.length ? `Vinculada a ${warehouse.branchNames.join(', ')}` : 'Sin sucursales vinculadas'}
            </span>
          </span>
        </label>)}
      </div> : <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">No hay bodegas corporativas disponibles para el alcance seleccionado.</p>}
    </div>}
  </section>;
}
