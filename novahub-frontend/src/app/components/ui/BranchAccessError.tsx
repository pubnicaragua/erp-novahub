import { Store, AlertTriangle } from 'lucide-react';

interface Props {
  message?: string;
  branchName?: string;
}

export function BranchAccessError({ message, branchName }: Props) {
  const text = message || (branchName
    ? `No tienes acceso a la sucursal "${branchName}". Contacta al administrador si necesitas permisos.`
    : 'No tienes acceso a esta sucursal. Contacta al administrador si necesitas permisos.');

  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs font-medium">
      <AlertTriangle className="size-4 shrink-0" />
      <Store className="size-3.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
