import { Store } from 'lucide-react';
import { useBranchScope } from '../../hooks/useBranchScope';
import { cn } from './utils';

interface Props {
  className?: string;
  showLabel?: boolean;
  onChange?: (branchId: string) => void;
}

export function BranchScopeFilter({ className, showLabel = true, onChange }: Props) {
  const { accessibleBranches, selectedBranchId, setSelectedBranchId, isRestricted } = useBranchScope();

  if (accessibleBranches.length <= 1) return null;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedBranchId(val);
    onChange?.(val);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && (
        <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <Store className="size-3.5" /> Sucursal
        </div>
      )}
      <select
        value={selectedBranchId}
        onChange={handleChange}
        className="h-9 rounded-xl border border-border/50 bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
      >
        {!isRestricted && <option value="">Todas las sucursales</option>}
        {accessibleBranches.map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
  );
}
