import { Store } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useAuth } from '../contexts/AuthContext';

export function BranchFilter() {
  const { userBranches, selectedBranchId, setSelectedBranchId } = useAuth();

  if (userBranches.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <Store className="size-4 text-muted-foreground shrink-0" />
      <Select value={selectedBranchId ?? ''} onValueChange={(v) => setSelectedBranchId(v || null)}>
        <SelectTrigger className="w-[200px] h-8 text-xs">
          <SelectValue placeholder="Todas las sucursales" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todas las sucursales</SelectItem>
          {userBranches.map(b => (
            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
