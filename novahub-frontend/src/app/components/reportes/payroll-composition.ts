type PayrollTotals = {
  salario: number;
  horasExtra: number;
  comisiones: number;
  prestaciones: number;
  cargas: number;
  deducciones: number;
  total: number;
};

/** Shared by the pie and its persistent breakdown; preserves the cost denominator. */
export function payrollComposition(current: PayrollTotals, previous: PayrollTotals) {
  return ([
    { key: 'salario', name: 'Salario base', value: current.salario, prev: previous.salario },
    { key: 'variables', name: 'Variables (extra, comisiones, prestaciones)', value: current.horasExtra + current.comisiones + current.prestaciones, prev: previous.horasExtra + previous.comisiones + previous.prestaciones },
    { key: 'cargas', name: 'Cargas patronales', value: current.cargas, prev: previous.cargas },
    { key: 'deducciones', name: 'Deducciones del trabajador', value: current.deducciones, prev: previous.deducciones },
  ] as const).filter(row => row.value > 0).map(row => ({
    ...row,
    pct: current.total > 0 ? (row.value / current.total) * 100 : 0,
  }));
}
