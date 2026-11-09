import { AusenciasView } from './AusenciasView';
import { HolidaysPanel } from './workforce/HolidaysPanel';
import { RecurringLeavePanel } from './workforce/RecurringLeavePanel';
import { ScheduleEditor, type EmployeeOption } from './workforce/ScheduleEditor';
import { WorkforceTabs } from './workforce/WorkforceTabs';

/** Ausencias: solicitudes de siempre, más horario de trabajo, feriados y vacaciones en días fijos. */
export function AusenciasHub({ leaveRequests, employees, onRefresh }: { leaveRequests: unknown; employees: EmployeeOption[]; onRefresh?: () => void }) {
  return (
    <WorkforceTabs label="Ausencias" tabs={[
      { id: 'requests', label: 'Solicitudes', content: <AusenciasView leaveRequests={leaveRequests} employees={employees} onRefresh={onRefresh} /> },
      { id: 'schedule', label: 'Horario', content: <ScheduleEditor employees={employees} /> },
      { id: 'holidays', label: 'Feriados', content: <HolidaysPanel /> },
      { id: 'saturdays', label: 'Vacaciones en días fijos', content: <RecurringLeavePanel employees={employees} /> },
    ]} />
  );
}
