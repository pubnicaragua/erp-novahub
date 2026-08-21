import { Store } from 'lucide-react';
import { useBranchScope } from '../../hooks/useBranchScope';
import { cn } from './utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

interface Props {
  className?: string;
  showLabel?: boolean;
  onChange?: (branchId: string) => void;
}

export function BranchScopeFilter({ className, showLabel = true, onChange }: Props) {
  const { accessibleBranches, selectedBranchId, setSelectedBranchId, isRestricted } = useBranchScope();

  if (accessibleBranches.length <= 1) return null;

  const handleChange = (val: string) => {
    const selectedValue = val === '__all_branches__' ? '' : val;
    setSelectedBranchId(selectedValue);
    onChange?.(selectedValue);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && (
        <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <Store className="size-3.5" /> Sucursal
        </div>
      )}
      <Select value={selectedBranchId || '__all_branches__'} onValueChange={handleChange}>
        <SelectTrigger className="h-10 rounded-xl border-border/50 bg-background px-3 text-xs font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {!isRestricted && <SelectItem value="__all_branches__">Todas las sucursales</SelectItem>}
          {accessibleBranches.map(b => (
            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
