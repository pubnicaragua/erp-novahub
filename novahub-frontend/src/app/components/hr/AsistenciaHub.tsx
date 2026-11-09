import { AsistenciaView } from './AsistenciaView';
import { OvertimePanel } from './workforce/OvertimePanel';
import type { EmployeeOption } from './workforce/ScheduleEditor';
import { WorkforceTabs } from './workforce/WorkforceTabs';
import { useAuth } from '../../contexts/AuthContext';

/** Asistencia: el registro de siempre, más el simulador de horas extra y las ventas por día y hora. */
export function AsistenciaHub({ attendance, employees, onRefresh }: { attendance: unknown; employees: EmployeeOption[]; onRefresh?: () => void }) {
  const { canPerform } = useAuth();
  const tabs = [{ id: 'attendance', label: 'Asistencia', content: <AsistenciaView attendance={attendance} employees={employees} onRefresh={onRefresh} /> }];
  if (canPerform('HR_PAYROLL', 'view')) tabs.push({ id: 'overtime', label: 'Horas extra y ventas', content: <OvertimePanel employees={employees} /> });
  return <WorkforceTabs label="Asistencia" tabs={tabs} />;
}
