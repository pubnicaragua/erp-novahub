import { Settings2 } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useUserViewPreferences } from '../../hooks/useUserViewPreferences';

export interface ManagerPreferenceColumn {
  key: string;
  label: string;
}

export function useManagerTableColumnPreferences(preferenceKey: string, columns: ManagerPreferenceColumn[]) {
  const preferences = useUserViewPreferences(preferenceKey);
  const allKeys = columns.map((column) => column.key);
  const selectedKeys = preferences.preferences.visibleColumnKeys || allKeys;
  const requiredKey = allKeys[0];
  const visibleKeys = allKeys.filter((key) => key === requiredKey || selectedKeys.includes(key));
  const visibleColumns = columns.filter((column) => visibleKeys.includes(column.key));

  const toggle = (key: string, checked: boolean | 'indeterminate') => {
    const next = new Set(visibleKeys);
    if (checked) next.add(key);
    else if (key !== requiredKey && next.size > 1) next.delete(key);
    void preferences.save({ visibleColumnKeys: [...next] });
  };

  const columnSettings = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" disabled={preferences.isLoading || preferences.loadError}>
          <Settings2 className="size-4" /> Columnas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.key}
            checked={visibleKeys.includes(column.key)}
            disabled={column.key === requiredKey || (visibleKeys.length <= 1 && visibleKeys.includes(column.key))}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) => toggle(column.key, checked)}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={visibleKeys.length === allKeys.length}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={(checked) => { if (checked) void preferences.save({ visibleColumnKeys: allKeys }); }}
        >
          Restablecer columnas
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return { visibleKeys, visibleColumns, columnSettings, isLoading: preferences.isLoading };
}
