import { useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Combobox } from '../ui/Combobox';
import { toast } from '@/app/services/toast';
import { hrService } from '../../services/hr.service';
import { EMPLOYEE_STATUS_SUFFIX, sortEmployees } from './employeeOrder';

interface HistoricalResult { created: number; alreadyExisted: number; outOfEmployment: number; notYetClosed: number; failed: Array<{ employee: string; period: string; reason: string }> }
const monthValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/** Carga las nóminas de meses anteriores que ya se pagaron para que no aparezcan pendientes y el historial del último año esté completo. */
export function HistoricalPayrollDialog({ employees, onClose, onDone }: { employees: Array<{ id: string; employeeNumber?: string; firstName?: string; lastName?: string; employmentStatus?: string }>; onClose: () => void; onDone: () => void }) {
  const lastMonth = monthValue(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  const [employeeId, setEmployeeId] = useState('all');
  const [from, setFrom] = useState(monthValue(new Date(new Date().getFullYear(), new Date().getMonth() - 6, 1)));
  const [to, setTo] = useState(lastMonth);
  const [reference, setReference] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [periodSalary, setPeriodSalary] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HistoricalResult | null>(null);
  const options = [{ value: 'all', label: 'Todos los empleados' }, ...sortEmployees(employees).map((employee) => ({
    value: employee.id, label: `${employee.employeeNumber ? `${employee.employeeNumber} · ` : ''}${employee.firstName ?? ''} ${employee.lastName ?? ''}${EMPLOYEE_STATUS_SUFFIX[String(employee.employmentStatus || '').toUpperCase()] ? ` (${EMPLOYEE_STATUS_SUFFIX[String(employee.employmentStatus).toUpperCase()]})` : ''}`.trim(),
  }))];
  const valid = Boolean(from && to && from <= to);

  const submit = async () => {
    setBusy(true);
    try {
      const response = await hrService.registerHistoricalPayrolls({
        from, to, ...(employeeId !== 'all' ? { employeeIds: [employeeId] } : {}), ...(reference.trim() ? { paymentReference: reference.trim() } : {}),
        ...(paymentDate ? { paymentDate } : {}), ...(employeeId !== 'all' && periodSalary !== '' ? { periodSalary: Number(periodSalary) } : {}),
      });
      const body = response as { data?: { data?: HistoricalResult } & HistoricalResult };
      const data: HistoricalResult = body?.data?.data ?? body?.data ?? (response as unknown as HistoricalResult);
      setResult(data);
      if (data.created > 0) { toast.success(`Se cargaron ${data.created} nóminas como ya pagadas`); onDone(); } else toast.info('No había nóminas nuevas por cargar en ese rango.');
    } catch (error) {
      const failure = error as { response?: { data?: { message?: unknown } }; message?: string };
      const message = failure?.response?.data?.message || failure?.message || 'No se pudieron cargar las nóminas';
      toast.error(String(Array.isArray(message) ? message[0] : message));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History className="size-5 text-primary" aria-hidden /> Cargar nóminas ya pagadas</DialogTitle>
          <DialogDescription>Para meses anteriores que ya pagaste fuera del sistema. Se crean los períodos que le tocan a cada empleado según su frecuencia (mensual, quincenal o semanal), quedan como pagados y sirven para el historial y los reportes. <b>No generan asientos contables ni mueven caja.</b></DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Empleado</Label><Combobox value={employeeId} onChange={setEmployeeId} options={options} placeholder="Todos los empleados" ariaLabel="Empleado" /></div>
          <div className="space-y-1.5"><Label htmlFor="hp-from">Desde el mes</Label><Input id="hp-from" type="month" value={from} max={lastMonth} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="hp-to">Hasta el mes</Label><Input id="hp-to" type="month" value={to} max={lastMonth} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="hp-ref">Referencia o transferencia</Label><Input id="hp-ref" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} placeholder="Opcional" /></div>
          <div className="space-y-1.5"><Label htmlFor="hp-date">Fecha de pago</Label><Input id="hp-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /><p className="text-[11px] text-muted-foreground">Si la dejas vacía se usa el último día de cada período.</p></div>
          {employeeId !== 'all' && <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="hp-salary">Monto del período (si el salario era otro)</Label><Input id="hp-salary" type="number" min="0" step="0.01" value={periodSalary} onChange={(e) => setPeriodSalary(e.target.value)} placeholder="Vacío = el salario actual del empleado" /></div>}
        </div>
        {result && (
          <div className="space-y-1 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm" role="status">
            <p><b>{result.created}</b> cargadas · {result.alreadyExisted} ya existían · {result.outOfEmployment} fuera de su contratación · {result.notYetClosed} aún no cierran</p>
            {result.failed.length > 0 && <ul className="list-disc pl-5 text-xs text-destructive">{result.failed.slice(0, 8).map((item, index) => <li key={index}>{item.employee} · {item.period}: {item.reason}</li>)}</ul>}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cerrar</Button>
          <Button type="button" onClick={() => void submit()} disabled={busy || !valid}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Cargar nóminas</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
