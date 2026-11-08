import { useState, type ReactNode } from 'react';
import { Card, CardContent } from '../ui/card';
import { AguinaldoPanel } from './AguinaldoPanel';
import { LiquidacionPanel } from './LiquidacionPanel';

type PayrollScope = 'nominas' | 'aguinaldo' | 'liquidacion';

const SCOPE_OPTIONS: Array<{ value: PayrollScope; label: string }> = [
  { value: 'nominas', label: 'Nóminas' },
  { value: 'aguinaldo', label: 'Aguinaldo' },
  { value: 'liquidacion', label: 'Liquidación final (baja de empleado)' },
];

/**
 * Nóminas con un filtro «Mostrar»: nóminas normales (por defecto), aguinaldo o liquidación final.
 * Aguinaldo y liquidación ya no son pestañas aparte; son una vista más del mismo filtro.
 */
export function PrestacionesSection({ employees, children }: { employees: Array<{ id: string; firstName?: string; lastName?: string; employeeNumber?: string }>; children: ReactNode }) {
  const [scope, setScope] = useState<PayrollScope>('nominas');
  return (
    <div data-testid="hr-prestaciones" className="space-y-4">
      <div className="flex items-center gap-2">
        <label htmlFor="hr-payroll-scope" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mostrar</label>
        <select
          id="hr-payroll-scope"
          value={scope}
          onChange={(event) => setScope(event.target.value as PayrollScope)}
          className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium"
        >
          {SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      {scope === 'nominas' && children}
      {scope === 'aguinaldo' && <Card className="rounded-2xl border-border/60 bg-card/80 shadow-sm"><CardContent className="p-3 sm:p-4"><AguinaldoPanel embedded /></CardContent></Card>}
      {scope === 'liquidacion' && <Card className="rounded-2xl border-border/60 bg-card/80 shadow-sm"><CardContent className="p-3 sm:p-4"><LiquidacionPanel employees={employees} /></CardContent></Card>}
    </div>
  );
}
