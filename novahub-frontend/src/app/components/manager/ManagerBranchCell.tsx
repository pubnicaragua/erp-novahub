import { Badge } from '../ui/badge';

export function ManagerBranchCell({ name, fallback = 'Sucursal no identificada' }: { name?: unknown; fallback?: string }) {
  const label = String(name ?? '').trim() || fallback;

  return (
    <Badge
      variant="secondary"
      title={label}
      className="h-auto min-h-6 min-w-44 max-w-64 justify-start whitespace-normal break-words px-2 py-1 text-left leading-4 [overflow-wrap:anywhere]"
    >
      {label}
    </Badge>
  );
}
