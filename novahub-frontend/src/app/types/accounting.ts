export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type AccountSubtype = 'MAIN_GROUP' | 'GROUP' | 'DETAIL_ACCOUNT' | 'SUBACCOUNT';
export type AccountDetailType = 'BALANCE_SHEET' | 'INCOME_STATEMENT';

export interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  detailType: AccountDetailType;
  parentId: string | null;
  balance: number;
  currency: string;
  allowManualEntry: boolean;
  isActive: boolean;
  notes?: string | null;
  children?: ChartAccount[];
}

export interface ChartAccountCsvRow {
  codigo: string;
  nombre: string;
  tipo_cuenta: string;
  subtipo: string;
  tipo_detalle: string;
  moneda: string;
  codigo_padre: string;
  permite_manual: string;
  activa: string;
  notas: string;
}
