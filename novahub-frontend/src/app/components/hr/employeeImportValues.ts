export const employeeContractTypeOptions = [
  { value: 'FULL_TIME', label: 'Tiempo completo', importValue: 'Tiempo completo' },
  { value: 'PART_TIME', label: 'Medio tiempo', importValue: 'Medio tiempo' },
  { value: 'CONTRACTOR', label: 'Contratista', importValue: 'Contratista' },
  { value: 'INTERN', label: 'Pasante', importValue: 'Pasante' },
  { value: 'TEMPORARY', label: 'Temporal', importValue: 'Temporal' },
] as const;

export const employeePayFrequencyOptions = [
  { value: 'WEEKLY', label: 'Semanal', importValue: 'Semanal' },
  { value: 'BIWEEKLY', label: 'Quincenal', importValue: 'Quincenal' },
  { value: 'MONTHLY', label: 'Mensual', importValue: 'Mensual' },
  { value: 'HOURLY', label: 'Por hora', importValue: 'Por hora' },
] as const;

export const employeeStatusOptions = [
  { value: 'ACTIVE', label: 'Activo', importValue: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo', importValue: 'Inactivo' },
  { value: 'ON_LEAVE', label: 'En ausencia', importValue: 'En ausencia' },
  { value: 'TERMINATED', label: 'Terminado', importValue: 'Terminado' },
] as const;

export const employeeContractTypeValues = employeeContractTypeOptions.map(({ value }) => value);
export const employeePayFrequencyValues = employeePayFrequencyOptions.map(({ value }) => value);
export const employeeStatusValues = employeeStatusOptions.map(({ value }) => value);
export const employeeContractTypeImportValues = employeeContractTypeOptions.map(({ importValue }) => importValue);
export const employeePayFrequencyImportValues = employeePayFrequencyOptions.map(({ importValue }) => importValue);
export const employeeStatusImportValues = employeeStatusOptions.map(({ importValue }) => importValue);

/**
 * Normaliza el formato de un valor para comparar encabezados y códigos.
 */
export const normalizeEmployeeImportCode = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase()
  .replace(/[\s-]+/g, '_')
  .replace(/[^A-Z0-9_]/g, '')
  .replace(/_+/g, '_')
  .replace(/^_|_$/g, '');

export type EmployeeImportValueField = 'contractType' | 'payFrequency' | 'employmentStatus';

const employeeImportAliases: Record<EmployeeImportValueField, Record<string, string>> = {
  contractType: {
    TIEMPO_COMPLETO: 'FULL_TIME',
    MEDIO_TIEMPO: 'PART_TIME',
    CONTRATISTA: 'CONTRACTOR',
    PASANTE: 'INTERN',
    TEMPORAL: 'TEMPORARY',
  },
  payFrequency: {
    SEMANAL: 'WEEKLY',
    QUINCENAL: 'BIWEEKLY',
    MENSUAL: 'MONTHLY',
    POR_HORA: 'HOURLY',
  },
  employmentStatus: {
    ACTIVO: 'ACTIVE',
    INACTIVO: 'INACTIVE',
    EN_AUSENCIA: 'ON_LEAVE',
    TERMINADO: 'TERMINATED',
  },
};

/** Convierte los valores visibles en español a los enums canónicos del API. */
export const normalizeEmployeeImportValue = (field: EmployeeImportValueField, value: unknown) => {
  const normalized = normalizeEmployeeImportCode(value);
  return employeeImportAliases[field][normalized] || normalized;
};
