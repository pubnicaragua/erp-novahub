
export interface SalesIrOption { id: string; name: string; code: string; rate: number; category?: string; type?: string; isActive?: boolean }

interface SalesIrSelectorProps {
  value?: string | null;
  rate?: number;
  disabled?: boolean;
  compact?: boolean;
  onChange: (option: SalesIrOption | null) => void;
}

const FALLBACK: SalesIrOption[] = [
  { id: 'IR_1', code: 'IR_1', name: 'IR 1%', rate: 1 },
  { id: 'IR_2', code: 'IR_2', name: 'IR 2%', rate: 2 },
  { id: 'IR_3', code: 'IR_3', name: 'IR 3%', rate: 3 },
];

export function SalesIrSelector({ value, rate = 0, disabled, compact, onChange }: SalesIrSelectorProps) {
  return null;
  /*
  const query = useQuery({ queryKey: ['sales', 'ir-options'], queryFn: () => contabilidadService.getTaxCatalog('WITHHOLDING'), staleTime: 60_000 });
  const response = query.data as any;
  const entries = (response?.data || response || []) as SalesIrOption[];
  const allowedCodes = new Set(['IR_1', 'IR_2', 'IR_3']);
  const options = entries.filter((entry) => allowedCodes.has(String(entry.code || '').toUpperCase()) && entry.isActive !== false);
  const available = options.length ? options : FALLBACK;
  const selected = value || (rate > 0 ? available.find((entry) => Number(entry.rate) === Number(rate))?.id : 'NONE');

  return (
    <Select value={selected || 'NONE'} onValueChange={(next) => onChange(next === 'NONE' ? null : (available.find((entry) => entry.id === next) || available.find((entry) => Number(entry.rate) === Number(next)) || null))} disabled={disabled || query.isLoading}>
      <SelectTrigger className={compact ? 'h-7 w-[6rem] min-w-0 px-2 text-[9px]' : 'h-8 w-full text-xs'} aria-label="IR">
        <SelectValue placeholder="IR" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="NONE">Sin IR</SelectItem>
        {available.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.name || `IR ${entry.rate}%`}</SelectItem>)}
      </SelectContent>
    </Select>
  ); */
}
