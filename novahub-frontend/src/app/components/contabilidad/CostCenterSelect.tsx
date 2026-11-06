import { useCallback, useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { contabilidadService, type CostCenter } from '../../services/contabilidad.service';
import { CostCenterFormDialog } from './CostCentersDialog';

const NONE = '__none__';
const CREATE = '__create__';

/**
 * Selector de centro de costo con "+ Crear centro" dentro de la misma lista.
 * Solo ofrece centros activos (más el ya elegido, aunque luego se haya desactivado).
 */
export function CostCenterSelect({
  value, onChange, canCreate = true, placeholder = 'Sin centro de costo', className,
}: { value?: string | null; onChange: (id: string) => void; canCreate?: boolean; placeholder?: string; className?: string }) {
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try { setCenters(await contabilidadService.getCostCenters()); } catch { /* el selector queda vacío si falla */ }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const options = centers.filter((center) => center.isActive || center.id === value);

  return (
    <>
      <Select
        value={value || NONE}
        onValueChange={(next) => {
          if (next === CREATE) { setCreating(true); return; }
          onChange(next === NONE ? '' : next);
        }}
      >
        <SelectTrigger className={className ?? 'rounded-xl text-sm'}><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{placeholder}</SelectItem>
          {options.map((center) => <SelectItem key={center.id} value={center.id} className="text-xs">{center.code} · {center.name}{center.isActive ? '' : ' (inactivo)'}</SelectItem>)}
          {canCreate && <SelectItem value={CREATE} className="text-xs font-semibold text-primary">+ Crear centro de costo…</SelectItem>}
        </SelectContent>
      </Select>
      <CostCenterFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(created) => { setCenters((list) => [...list.filter((c) => c.id !== created.id), created]); onChange(created.id); void load(); }}
      />
    </>
  );
}
