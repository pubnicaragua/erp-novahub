export type ManagerHrView =
  | 'overview'
  | 'employees'
  | 'departments'
  | 'payroll'
  | 'commissions'
  | 'attendance'
  | 'leaves'
  | 'performance'
  | 'kpi'
  | 'training'
  | 'benefits';

export const MANAGER_HR_VIEWS: Array<{ id: ManagerHrView; label: string }> = [
  { id: 'overview', label: 'Resumen de RR. HH.' },
  { id: 'employees', label: 'Empleados' },
  { id: 'departments', label: 'Departamentos' },
  { id: 'payroll', label: 'Nóminas' },
  { id: 'attendance', label: 'Asistencia' },
  { id: 'leaves', label: 'Vacaciones y permisos' },
  { id: 'performance', label: 'Desempeño' },
  { id: 'training', label: 'Formación' },
  { id: 'benefits', label: 'Beneficios' },
];
