import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Settings2, Save, Building2, Upload, FileDown, RefreshCw,
  Loader2, CheckCircle2, Globe, DollarSign,
  FileSpreadsheet, Link2, BookOpen, Eye, X,
  Plus, Info, Trash2,
  FileText, Receipt, Package, Wallet,
  Users, BarChart3, RotateCcw, Undo2, Network, ArrowLeftRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { Switch } from '../ui/switch'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { Combobox } from '../ui/Combobox'
import { cn } from '../ui/utils'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'
import { BankAccountsView } from './BankAccountsView'
import { TaxCatalogView } from './TaxCatalogView'
import { contabilidadService } from '../../services/contabilidad.service'
import { CHART_ACCOUNT_CSV_HEADERS, csvRowsToText, downloadCsv, templateRows } from '../../utils/chartOfAccountsCsv'
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery'

const INDUSTRIES = [
  { value: 'RETAIL', label: 'Comercio Minorista' },
  { value: 'TECHNOLOGY', label: 'Tecnología' },
  { value: 'SERVICES', label: 'Servicios' },
  { value: 'MANUFACTURING', label: 'Manufactura' },
  { value: 'CONSTRUCTION', label: 'Construcción' },
  { value: 'AGRICULTURE', label: 'Agricultura' },
  { value: 'HEALTHCARE', label: 'Salud' },
  { value: 'EDUCATION', label: 'Educación' },
  { value: 'HOSPITALITY', label: 'Hostelería' },
  { value: 'RESTAURANT', label: 'Restaurante' },
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'REAL_ESTATE', label: 'Bienes Raíces' },
  { value: 'TRANSPORTATION', label: 'Transporte' },
  { value: 'ARCHITECTURE', label: 'Arquitectura' },
  { value: 'OTHER', label: 'Otros' },
]

const CURRENCIES = ['NIO', 'USD']
const HR_ACCOUNT_CODES = new Set([
  '1120', '2200', '2210', '2220', '2300', '2400', '2410', '2420', '2430', '2500',
  '5100', '5110', '5120', '5130', '5140', '5150', '5160', '5170', '5180', '5600', '5700',
])

type AccountInfo = {
  id: string
  code: string
  name: string
  type: string
  subtype?: string
  detailType?: string
  parentId?: string | null
  isLeaf?: boolean
  isActive?: boolean
  acceptsPostings?: boolean
}

type ModuleField = {
  key: string
  label: string
  side: 'debit' | 'credit'
  description: string
  defaultCode: string
  defaultName: string
  defaultType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'
}

const BUILTIN_MODULES: { id: string; label: string; icon: typeof FileText; description: string; fields: ModuleField[] }[] = [
  {
    id: 'invoice', label: 'Facturas de Venta', icon: FileText,
    description: 'Cuando la factura queda pagada, se registra una sola vez contra el cobro real',
    fields: [
      { key: 'income', label: 'Ingresos', side: 'credit', description: 'Se acredita el subtotal (sin IVA)', defaultCode: '4000', defaultName: 'Ingresos Operativos', defaultType: 'INCOME' },
      { key: 'ivaPayable', label: 'IVA por Pagar', side: 'credit', description: 'Se acredita el IVA', defaultCode: '2100', defaultName: 'IVA por Pagar', defaultType: 'LIABILITY' },
    ],
  },
  {
    id: 'payment', label: 'Cobros', icon: Receipt,
    description: 'Cuando la factura queda pagada, se registra el cobro según su forma de pago',
    fields: [
      { key: 'cash', label: 'Efectivo / Caja', side: 'debit', description: 'Se debita el efectivo recibido', defaultCode: '1000', defaultName: 'Caja y Bancos', defaultType: 'ASSET' },
      { key: 'card', label: 'Tarjetas', side: 'debit', description: 'Se debita la cuenta configurada para tarjetas', defaultCode: '1010', defaultName: 'Bancos - Tarjetas', defaultType: 'ASSET' },
      { key: 'transfer', label: 'Transferencias', side: 'debit', description: 'Se debita la cuenta configurada para transferencias', defaultCode: '1020', defaultName: 'Bancos - Transferencias', defaultType: 'ASSET' },
      { key: 'check', label: 'Cheques', side: 'debit', description: 'Se debita la cuenta configurada para cheques', defaultCode: '1030', defaultName: 'Cheques por Depositar', defaultType: 'ASSET' },
      { key: 'other', label: 'Otros medios de cobro', side: 'debit', description: 'Se debita la cuenta para otros medios de cobro', defaultCode: '1090', defaultName: 'Otros Medios de Cobro', defaultType: 'ASSET' },
      { key: 'receivable', label: 'Cuenta por Cobrar', side: 'credit', description: 'Se acredita la cuenta por cobrar', defaultCode: '1100', defaultName: 'Cuentas por Cobrar', defaultType: 'ASSET' },
    ],
  },
  {
    id: 'cashSale', label: 'Facturación por Caja', icon: Wallet,
    description: 'Venta POS pagada en el momento → medios de cobro + Ingresos + IVA',
    fields: [
      { key: 'cash', label: 'Efectivo / Caja', side: 'debit', description: 'Se debita la cuenta global de efectivo para Facturación por Caja', defaultCode: '1000', defaultName: 'Caja y Bancos', defaultType: 'ASSET' },
      { key: 'card', label: 'Tarjetas', side: 'debit', description: 'Se debita la cuenta POS configurada para tarjetas', defaultCode: '1010', defaultName: 'Bancos - Tarjetas', defaultType: 'ASSET' },
      { key: 'transfer', label: 'Transferencias', side: 'debit', description: 'Se debita la cuenta POS configurada para transferencias', defaultCode: '1020', defaultName: 'Bancos - Transferencias', defaultType: 'ASSET' },
      { key: 'check', label: 'Cheques', side: 'debit', description: 'Se debita la cuenta POS configurada para cheques', defaultCode: '1030', defaultName: 'Cheques por Depositar', defaultType: 'ASSET' },
      { key: 'other', label: 'Otros medios de cobro', side: 'debit', description: 'Se debita la cuenta POS para otros medios', defaultCode: '1090', defaultName: 'Otros Medios de Cobro', defaultType: 'ASSET' },
      { key: 'income', label: 'Ingresos por Ventas', side: 'credit', description: 'Se acredita el subtotal de la venta POS', defaultCode: '4000', defaultName: 'Ingresos por Ventas', defaultType: 'INCOME' },
      { key: 'ivaPayable', label: 'IVA por Pagar', side: 'credit', description: 'Se acredita el IVA de la venta POS', defaultCode: '2100', defaultName: 'IVA por Pagar', defaultType: 'LIABILITY' },
    ],
  },
  {
    id: 'supplierInvoice', label: 'Facturas de proveedor pagadas', icon: Package,
    description: 'Solo al pagar la factura → inventario/gasto + IVA acreditable + IR + IVA retenido + otras retenciones + medio de pago',
    fields: [
      { key: 'inventory', label: 'Inventario / Gasto', side: 'debit', description: 'Se debita el costo del inventario o gasto', defaultCode: '1200', defaultName: 'Inventario', defaultType: 'ASSET' },
      { key: 'ivaCreditable', label: 'IVA Acreditable', side: 'debit', description: 'Se debita el IVA soportado que la empresa puede acreditar', defaultCode: '1130', defaultName: 'IVA Acreditable', defaultType: 'ASSET' },
      { key: 'irWithholdingPayable', label: 'IR retenido por pagar', side: 'credit', description: 'Se acredita el IR retenido al proveedor', defaultCode: '2300', defaultName: 'IR Retenido por Pagar', defaultType: 'LIABILITY' },
      { key: 'ivaWithholdingPayable', label: 'IVA retenido por pagar', side: 'credit', description: 'Se acredita el IVA retenido al proveedor', defaultCode: '2110', defaultName: 'IVA Retenido por Pagar', defaultType: 'LIABILITY' },
      { key: 'otherWithholdingPayable', label: 'Otras retenciones por pagar', side: 'credit', description: 'Se acreditan retenciones fiscales distintas de IR e IVA', defaultCode: '2130', defaultName: 'Otras Retenciones por Pagar', defaultType: 'LIABILITY' },
      { key: 'payable', label: 'Cuenta por Pagar', side: 'credit', description: 'Se acredita la deuda con el proveedor', defaultCode: '2000', defaultName: 'Cuentas por Pagar', defaultType: 'LIABILITY' },
      { key: 'cash', label: 'Efectivo / Caja', side: 'credit', description: 'Se acredita cuando la factura pagada sale de caja', defaultCode: '1000', defaultName: 'Caja y Bancos', defaultType: 'ASSET' },
      { key: 'card', label: 'Tarjetas', side: 'credit', description: 'Se acredita la cuenta configurada para pagos con tarjeta', defaultCode: '1010', defaultName: 'Bancos - Tarjetas', defaultType: 'ASSET' },
      { key: 'transfer', label: 'Transferencias', side: 'credit', description: 'Se acredita la cuenta configurada para transferencias', defaultCode: '1020', defaultName: 'Bancos - Transferencias', defaultType: 'ASSET' },
      { key: 'check', label: 'Cheques', side: 'credit', description: 'Se acredita la cuenta configurada para cheques', defaultCode: '1030', defaultName: 'Cheques por Depositar', defaultType: 'ASSET' },
      { key: 'other', label: 'Otros medios de pago', side: 'credit', description: 'Se acredita la cuenta configurada para otros medios', defaultCode: '1090', defaultName: 'Otros Medios de Pago', defaultType: 'ASSET' },
    ],
  },
  {
    id: 'expense', label: 'Gastos', icon: FileText,
    description: 'Solo al pagar el gasto → cuenta de gasto + medio de pago',
    fields: [
      { key: 'expense', label: 'Cuenta de Gasto', side: 'debit', description: 'Se debita el gasto', defaultCode: '5000', defaultName: 'Gastos Operativos', defaultType: 'EXPENSE' },
      { key: 'cash', label: 'Caja / Bancos', side: 'credit', description: 'Se acredita la salida de efectivo', defaultCode: '1000', defaultName: 'Caja y Bancos', defaultType: 'ASSET' },
      { key: 'card', label: 'Tarjetas', side: 'credit', description: 'Se acredita la cuenta configurada para pagos con tarjeta', defaultCode: '1010', defaultName: 'Bancos - Tarjetas', defaultType: 'ASSET' },
      { key: 'transfer', label: 'Transferencias', side: 'credit', description: 'Se acredita la cuenta configurada para transferencias', defaultCode: '1020', defaultName: 'Bancos - Transferencias', defaultType: 'ASSET' },
      { key: 'check', label: 'Cheques', side: 'credit', description: 'Se acredita la cuenta configurada para cheques', defaultCode: '1030', defaultName: 'Cheques por Depositar', defaultType: 'ASSET' },
      { key: 'other', label: 'Otros medios de pago', side: 'credit', description: 'Se acredita la cuenta configurada para otros medios', defaultCode: '1090', defaultName: 'Otros Medios de Pago', defaultType: 'ASSET' },
    ],
  },
  {
    id: 'supplierCredit', label: 'Créditos de proveedor aplicados', icon: RotateCcw,
    description: 'Crédito aplicado → disminuye CxP y revierte inventario o compras',
    fields: [
      { key: 'payable', label: 'Cuenta por Pagar', side: 'debit', description: 'Se debita la deuda que disminuye con el crédito', defaultCode: '2000', defaultName: 'Cuentas por Pagar', defaultType: 'LIABILITY' },
      { key: 'inventory', label: 'Inventario / Compras', side: 'credit', description: 'Se acredita la reversión del inventario o la compra', defaultCode: '1200', defaultName: 'Inventario y compras', defaultType: 'ASSET' },
    ],
  },
  {
    id: 'payroll', label: 'Nóminas', icon: Users,
    description: 'Un solo asiento al pagar la nómina: costos laborales, obligaciones y salida del neto',
    fields: [
      { key: 'salaryExpense', label: 'Salario base', side: 'debit', description: 'Se debita el salario base devengado', defaultCode: '5100', defaultName: 'Salarios base', defaultType: 'EXPENSE' },
      { key: 'bonusesExpense', label: 'Bonificaciones', side: 'debit', description: 'Se debitan las bonificaciones devengadas', defaultCode: '5110', defaultName: 'Bonificaciones', defaultType: 'EXPENSE' },
      { key: 'overtimeExpense', label: 'Horas extras', side: 'debit', description: 'Se debita el pago por horas extras', defaultCode: '5120', defaultName: 'Horas extras', defaultType: 'EXPENSE' },
      { key: 'commissionsExpense', label: 'Comisiones', side: 'debit', description: 'Se debita la comisión incluida en nómina', defaultCode: '5130', defaultName: 'Comisiones', defaultType: 'EXPENSE' },
      { key: 'inssPatronalExpense', label: 'Gasto INSS patronal', side: 'debit', description: 'Se debita el aporte patronal asumido por la empresa', defaultCode: '5140', defaultName: 'Aporte patronal INSS', defaultType: 'EXPENSE' },
      { key: 'inatecExpense', label: 'Gasto INATEC', side: 'debit', description: 'Se debita el aporte patronal de INATEC', defaultCode: '5150', defaultName: 'Aporte patronal INATEC', defaultType: 'EXPENSE' },
      { key: 'thirteenthExpense', label: 'Provisión de aguinaldo', side: 'debit', description: 'Se debita la provisión del décimo tercer mes', defaultCode: '5160', defaultName: 'Provisión de aguinaldo', defaultType: 'EXPENSE' },
      { key: 'vacationExpense', label: 'Provisión de vacaciones', side: 'debit', description: 'Se debita la provisión de vacaciones', defaultCode: '5170', defaultName: 'Provisión de vacaciones', defaultType: 'EXPENSE' },
      { key: 'indemnityExpense', label: 'Provisión de indemnización', side: 'debit', description: 'Se debita la provisión de indemnización', defaultCode: '5180', defaultName: 'Provisión de indemnización', defaultType: 'EXPENSE' },
      { key: 'inssLaboralPayable', label: 'INSS laboral por pagar', side: 'credit', description: 'Retención INSS al empleado', defaultCode: '2200', defaultName: 'INSS laboral por pagar', defaultType: 'LIABILITY' },
      { key: 'inssPatronalPayable', label: 'INSS patronal por pagar', side: 'credit', description: 'Obligación patronal de INSS', defaultCode: '2210', defaultName: 'INSS patronal por pagar', defaultType: 'LIABILITY' },
      { key: 'inatecPayable', label: 'INATEC por pagar', side: 'credit', description: 'Obligación patronal de INATEC', defaultCode: '2220', defaultName: 'INATEC por pagar', defaultType: 'LIABILITY' },
      { key: 'irPayable', label: 'IR por pagar', side: 'credit', description: 'Retención de IR al empleado', defaultCode: '2300', defaultName: 'IR por Pagar', defaultType: 'LIABILITY' },
      { key: 'otherDeductionsPayable', label: 'Otras deducciones', side: 'credit', description: 'Deducciones adicionales retenidas al empleado', defaultCode: '2400', defaultName: 'Otras deducciones por pagar', defaultType: 'LIABILITY' },
      { key: 'thirteenthPayable', label: 'Aguinaldo por pagar', side: 'credit', description: 'Pasivo acumulado por aguinaldo', defaultCode: '2410', defaultName: 'Aguinaldo por pagar', defaultType: 'LIABILITY' },
      { key: 'vacationPayable', label: 'Vacaciones por pagar', side: 'credit', description: 'Pasivo acumulado por vacaciones', defaultCode: '2420', defaultName: 'Vacaciones por pagar', defaultType: 'LIABILITY' },
      { key: 'indemnityPayable', label: 'Indemnización por pagar', side: 'credit', description: 'Pasivo acumulado por indemnización', defaultCode: '2430', defaultName: 'Indemnización por pagar', defaultType: 'LIABILITY' },
      { key: 'cash', label: 'Caja / Bancos', side: 'credit', description: 'Se acredita al pagar el neto al empleado', defaultCode: '1000', defaultName: 'Caja y Bancos', defaultType: 'ASSET' },
    ],
  },
  {
    id: 'inventoryAdjustment', label: 'Ajustes de Inventario', icon: BarChart3,
    description: 'Ajuste físico → ajusta inventario y reconoce pérdida/ganancia',
    fields: [
      { key: 'inventory', label: 'Inventario', side: 'debit', description: 'Ajusta el inventario (débito si sobra)', defaultCode: '1200', defaultName: 'Inventario', defaultType: 'ASSET' },
      { key: 'adjustment', label: 'Pérdida/Ganancia', side: 'credit', description: 'Contrapartida del ajuste', defaultCode: '5300', defaultName: 'Perdida/Ganancia por Ajuste', defaultType: 'EXPENSE' },
    ],
  },
  {
    id: 'creditNote', label: 'Notas de Crédito', icon: RotateCcw,
    description: 'N/C al cliente → reversa ingreso y disminuye CxC',
    fields: [
      { key: 'returns', label: 'Devoluciones', side: 'debit', description: 'Se debita la cuenta de devoluciones', defaultCode: '4100', defaultName: 'Devoluciones y Descuentos', defaultType: 'INCOME' },
      { key: 'receivable', label: 'Cuenta por Cobrar', side: 'credit', description: 'Se acredita la CxC (disminuye)', defaultCode: '1100', defaultName: 'Cuentas por Cobrar', defaultType: 'ASSET' },
    ],
  },
  {
    id: 'saleReturn', label: 'Devoluciones de Venta', icon: Undo2,
    description: 'Devolución de mercancía → reversa ingreso y CxC',
    fields: [
      { key: 'returns', label: 'Devoluciones', side: 'debit', description: 'Se debita devoluciones', defaultCode: '4100', defaultName: 'Devoluciones y Descuentos', defaultType: 'INCOME' },
      { key: 'receivable', label: 'Cuenta por Cobrar', side: 'credit', description: 'Se acredita CxC', defaultCode: '1100', defaultName: 'Cuentas por Cobrar', defaultType: 'ASSET' },
    ],
  },
  {
    id: 'hrTraining', label: 'Formación y Capacitaciones', icon: Users,
    description: 'Gasto pagado de formación → gasto + medio de pago propio de esta subvista',
    fields: [
      { key: 'expense', label: 'Gasto de Formación', side: 'debit', description: 'Se debita el costo pagado de la capacitación', defaultCode: '5600', defaultName: 'Formación y capacitación', defaultType: 'EXPENSE' },
      { key: 'cash', label: 'Efectivo / Caja', side: 'credit', description: 'Se acredita el efectivo pagado en Formación', defaultCode: '1000', defaultName: 'Caja y Bancos', defaultType: 'ASSET' },
      { key: 'card', label: 'Tarjetas', side: 'credit', description: 'Se acredita la cuenta propia de tarjetas para Formación', defaultCode: '1010', defaultName: 'Bancos - Tarjetas', defaultType: 'ASSET' },
      { key: 'transfer', label: 'Transferencias', side: 'credit', description: 'Se acredita la cuenta propia de transferencias para Formación', defaultCode: '1020', defaultName: 'Bancos - Transferencias', defaultType: 'ASSET' },
      { key: 'check', label: 'Cheques', side: 'credit', description: 'Se acredita la cuenta propia de cheques para Formación', defaultCode: '1030', defaultName: 'Cheques por Depositar', defaultType: 'ASSET' },
      { key: 'other', label: 'Otros medios de pago', side: 'credit', description: 'Se acredita la cuenta propia de otros medios para Formación', defaultCode: '1090', defaultName: 'Otros Medios de Pago', defaultType: 'ASSET' },
    ],
  },
  {
    id: 'hrBenefit', label: 'Beneficios de Empleados', icon: Users,
    description: 'Gasto pagado de beneficios → gasto + medio de pago propio de esta subvista',
    fields: [
      { key: 'expense', label: 'Gasto de Beneficios', side: 'debit', description: 'Se debita el costo pagado de los beneficios', defaultCode: '5700', defaultName: 'Beneficios de empleados', defaultType: 'EXPENSE' },
      { key: 'cash', label: 'Efectivo / Caja', side: 'credit', description: 'Se acredita el efectivo pagado en Beneficios', defaultCode: '1000', defaultName: 'Caja y Bancos', defaultType: 'ASSET' },
      { key: 'card', label: 'Tarjetas', side: 'credit', description: 'Se acredita la cuenta propia de tarjetas para Beneficios', defaultCode: '1010', defaultName: 'Bancos - Tarjetas', defaultType: 'ASSET' },
      { key: 'transfer', label: 'Transferencias', side: 'credit', description: 'Se acredita la cuenta propia de transferencias para Beneficios', defaultCode: '1020', defaultName: 'Bancos - Transferencias', defaultType: 'ASSET' },
      { key: 'check', label: 'Cheques', side: 'credit', description: 'Se acredita la cuenta propia de cheques para Beneficios', defaultCode: '1030', defaultName: 'Cheques por Depositar', defaultType: 'ASSET' },
      { key: 'other', label: 'Otros medios de pago', side: 'credit', description: 'Se acredita la cuenta propia de otros medios para Beneficios', defaultCode: '1090', defaultName: 'Otros Medios de Pago', defaultType: 'ASSET' },
    ],
  },
  {
    id: 'financialIncome', label: 'Ingresos de Finanzas', icon: DollarSign,
    description: 'Ingresos manuales y recurrentes → cuenta de ingreso configurada',
    fields: [
      { key: 'income', label: 'Cuenta de Ingresos', side: 'credit', description: 'Cuenta contable donde se clasifica el ingreso', defaultCode: '4000', defaultName: 'Ingresos Financieros', defaultType: 'INCOME' },
    ],
  },
  {
    id: 'financialExpense', label: 'Gastos de Finanzas', icon: Wallet,
    description: 'Gastos manuales y recurrentes → cuenta de gasto configurada',
    fields: [
      { key: 'expense', label: 'Cuenta de Gastos', side: 'debit', description: 'Cuenta contable donde se clasifica el gasto', defaultCode: '5000', defaultName: 'Gastos Financieros', defaultType: 'EXPENSE' },
    ],
  },
  {
    id: 'cashRegister', label: 'Cierre de Caja', icon: Wallet,
    description: 'Apertura y cierre son control operativo; solo las diferencias del arqueo generan asiento',
    fields: [
      { key: 'cash', label: 'Caja global', side: 'debit', description: 'Cuenta única del efectivo físico de todas las cajas', defaultCode: '1000', defaultName: 'Caja', defaultType: 'ASSET' },
      { key: 'shortage', label: 'Faltantes de Caja', side: 'debit', description: 'Se debita cuando el efectivo contado es menor al esperado', defaultCode: '5310', defaultName: 'Faltantes de Caja', defaultType: 'EXPENSE' },
      { key: 'surplus', label: 'Sobrantes de Caja', side: 'credit', description: 'Se acredita cuando el efectivo contado supera al esperado', defaultCode: '4020', defaultName: 'Sobrantes de Caja', defaultType: 'INCOME' },
    ],
  },
  {
    id: 'currencyRevaluation', label: 'Diferencias Cambiarias', icon: ArrowLeftRight,
    description: 'Revaluación de saldos abiertos en moneda extranjera al cierre',
    fields: [
      { key: 'unrealizedGain', label: 'Ganancia cambiaria no realizada', side: 'credit', description: 'Se acredita cuando la revaluación incrementa el valor económico', defaultCode: '4200', defaultName: 'Ganancia Cambiaria No Realizada', defaultType: 'INCOME' },
      { key: 'unrealizedLoss', label: 'Pérdida cambiaria no realizada', side: 'debit', description: 'Se debita cuando la revaluación reduce el valor económico', defaultCode: '5400', defaultName: 'Pérdida Cambiaria No Realizada', defaultType: 'EXPENSE' },
    ],
  },
]

const SALES_MODULE_IDS = new Set(['invoice', 'payment', 'cashSale', 'saleReturn', 'creditNote', 'cashRegister'])

const OPERATIONAL_ONLY_MODULE_IDS = new Set(['paymentMade', 'purchaseReceipt'])

const ACCOUNTING_MODULE_GROUPS = [
  {
    id: 'purchases',
    label: 'Cuentas contables de Compras',
    description: 'Solo procesos que generan asiento: facturas pagadas, gastos pagados y créditos de proveedor aplicados.',
    icon: Package,
    moduleIds: ['supplierInvoice', 'expense', 'supplierCredit'],
  },
  {
    id: 'hr',
    label: 'Cuentas contables de Recursos Humanos',
    description: 'Nómina, obligaciones laborales y gastos de RRHH.',
    icon: Users,
    moduleIds: ['payroll', 'hrTraining', 'hrBenefit'],
  },
  {
    id: 'finance',
    label: 'Cuentas contables de Finanzas',
    description: 'Clasificación contable de ingresos y gastos financieros.',
    icon: DollarSign,
    moduleIds: ['financialIncome', 'financialExpense'],
  },
  {
    id: 'operations',
    label: 'Cuentas contables de Inventario y operaciones',
    description: 'Ajustes de inventario y diferencias cambiarias.',
    icon: Link2,
    moduleIds: ['inventoryAdjustment', 'cashRegister', 'currencyRevaluation'],
  },
  {
    id: 'other',
    label: 'Otras conexiones contables',
    description: 'Conexiones personalizadas definidas para procesos particulares.',
    icon: Network,
    moduleIds: [],
  },
]

const getDefaultAccountMappings = () => Object.fromEntries(
  BUILTIN_MODULES
    .filter(module => !OPERATIONAL_ONLY_MODULE_IDS.has(module.id))
    .map(module => [module.id, Object.fromEntries(module.fields.map(field => [field.key, field.defaultCode]))]),
)

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ASSET: 'Activo',
  LIABILITY: 'Pasivo',
  EQUITY: 'Patrimonio',
  INCOME: 'Ingreso',
  EXPENSE: 'Gasto',
}

const accountTypeLabel = (type?: string) => ACCOUNT_TYPE_LABELS[String(type || '').toUpperCase()] || 'Tipo no definido'

type AccountOptionState = {
  disabled: boolean
  label: string
  className: string
}

type AccountOption = AccountInfo & {
  disabled: boolean
  optionState: AccountOptionState
}

function getAccountOptionStateForType(account: AccountInfo, expectedType: ModuleField['defaultType']): AccountOptionState {
  if (account.isActive === false) return { disabled: true, label: 'Inactiva', className: 'text-red-500' }
  if (account.acceptsPostings === false) return { disabled: true, label: 'Activa · No contabilizable', className: 'text-red-500' }
  if (account.isLeaf === false) return { disabled: true, label: 'Activa · Agrupadora', className: 'text-red-500' }
  if (String(account.type).toUpperCase() !== expectedType) {
    return { disabled: true, label: `Activa · Es ${accountTypeLabel(account.type)}`, className: 'text-amber-500' }
  }
  return { disabled: false, label: 'Activa · Disponible', className: 'text-emerald-600' }
}

function getAccountOptionState(account: AccountInfo, field: ModuleField) {
  return getAccountOptionStateForType(account, field.defaultType)
}

function AccountCodeInput({ code, field, account, accountOptions, onChange }: {
  code: string
  field: ModuleField
  account?: AccountInfo
  accountOptions: AccountOption[]
  onChange: (val: string) => void
}) {
  const accountState = account ? getAccountOptionState(account, field) : null
  const accountUnavailable = Boolean(accountState?.disabled)
  const accountTypeMismatch = Boolean(account && String(account.type).toUpperCase() !== field.defaultType)
  const accountIsGroup = account?.isLeaf === false
  const accountSelectOptions = useMemo(() => {
    const options = accountOptions.map(accountOption => ({
      value: accountOption.code,
      label: `${accountOption.code} · ${accountOption.name}`,
      description: `${accountTypeLabel(accountOption.type)} · ${accountOption.optionState.label}`,
      disabled: accountOption.disabled,
    }))

    // Mantiene visible una configuración antigua aunque la cuenta ya no exista
    // en el catálogo, sin convertirla en una opción seleccionable.
    if (code && !options.some(option => option.value === code)) {
      options.push({
        value: code,
        label: `${code} · Cuenta configurada no encontrada`,
        description: 'No encontrada en el plan de cuentas',
        disabled: true,
      })
    }

    return options
  }, [accountOptions, code])

  return (
    <div className="min-w-0 space-y-1.5 rounded-xl border border-border/40 bg-background/60 p-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${field.side === 'debit' ? 'bg-orange-500/10 text-orange-600' : 'bg-blue-500/10 text-blue-600'}`}>
            {field.side === 'debit' ? 'Debe' : 'Haber'}
          </span>
          <span className="min-w-0 truncate text-[11px] font-bold">{field.label}</span>
        </div>
        <span className="shrink-0 rounded-md border border-border/40 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
          Espera: {accountTypeLabel(field.defaultType)}
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-muted-foreground">
        <span>Referencia: <span className="font-mono font-bold">{field.defaultCode}</span> · {field.defaultName}</span>
        <span>La cuenta elegida debe ser de detalle y aceptar movimientos.</span>
      </div>
      <Combobox
        options={accountSelectOptions}
        value={code || ''}
        onChange={onChange}
        placeholder={`Seleccionar ${field.label.toLowerCase()}`}
        searchPlaceholder="Buscar por código o nombre..."
        maxVisibleOptions={500}
        className="h-9 text-xs"
        emptyMessage="No se encontraron cuentas con ese código o nombre."
      />
      <div className="flex min-w-0 items-center justify-between gap-2">
        {account ? (
          <span className={`min-w-0 truncate text-[10px] font-semibold ${accountTypeMismatch || accountUnavailable ? (accountTypeMismatch ? 'text-amber-500' : 'text-red-500') : 'text-emerald-600'}`} title={`${account.code} · ${account.name}`}>
            {account.code} · {account.name}
            {accountTypeMismatch
              ? ` · Tipo incorrecto: ${accountTypeLabel(account.type)}; se espera ${accountTypeLabel(field.defaultType)}`
              : accountIsGroup
                ? ' · Cuenta agrupadora: selecciona una cuenta de detalle'
                : accountUnavailable
                  ? ` · ${accountState?.label || 'No seleccionable'}`
                  : ' · Disponible'}
          </span>
        ) : code ? (
          <span className="text-[10px] text-red-500">La cuenta no existe en el plan</span>
        ) : (
          <span className="text-[10px] text-muted-foreground">Sugerida: {field.defaultCode} · {accountTypeLabel(field.defaultType)}</span>
        )}
      </div>
      <p className="text-[9px] leading-tight text-muted-foreground">{field.description}</p>
    </div>
  )
}

type ConnectionModule = {
  id: string
  label: string
  fields: ModuleField[]
  description: string
}

export function ConfiguracionContableView() {
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const [autoGenEnabled, setAutoGenEnabled] = useState(true)
  const [defaultCurrency, setDefaultCurrency] = useState('NIO')
  const [taxRate, setTaxRate] = useState(15)
  const [industry, setIndustry] = useState('RETAIL')
  const [accountMappings, setAccountMappings] = useState<Record<string, any>>({})
  const accountMappingsRef = useRef<Record<string, any>>({})
  const accountMappingSaveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const [customModules, setCustomModules] = useState<ConnectionModule[]>([])
  const configQuery = useAccountingQuery<any>(['config'], async (signal) => contabilidadService.getConfig(signal))
  const accountsQuery = useAccountingQuery<any[]>(['accounts'], async (signal) => accountingList(await contabilidadService.getChartOfAccounts(false, signal)))
  const connectionsQuery = useAccountingQuery<any>(['connections'], async (signal) => contabilidadService.testConnections(signal), { enabled: false, staleTime: 30_000 })
  const loading = configQuery.isLoading
  const connections = connectionsQuery.data
  const connectionsLoading = connectionsQuery.isFetching
  const allAccounts = useMemo(() => {
    const flat: AccountInfo[] = []
    const flatten = (items: any[]) => items.forEach(item => {
      flat.push({
        id: item.id,
        code: item.code,
        name: item.name,
        type: item.type,
        subtype: item.subtype,
        detailType: item.detailType ?? (item.type === 'INCOME' || item.type === 'EXPENSE' ? 'INCOME_STATEMENT' : 'BALANCE_SHEET'),
        parentId: item.parentId,
        isLeaf: !(item.children?.length),
        isActive: item.isActive,
        acceptsPostings: item.acceptsPostings,
      })
      if (item.children) flatten(item.children)
    })
    flatten(accountsQuery.data || [])
    return flat
  }, [accountsQuery.data])

  const [accountMappingsExpanded, setAccountMappingsExpanded] = useState(false)
  const [salesExpanded, setSalesExpanded] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    const res = configQuery.data
    if (!res) return
      const cfg = res?.config || res || {}
      setAutoGenEnabled(cfg.autoGenEnabled ?? true)
      setDefaultCurrency(cfg.defaultCurrency || 'NIO')
      setTaxRate(cfg.taxRate ?? 15)
      setIndustry(cfg.industry || 'RETAIL')
      const configuredMappings = cfg.accountMappings || {}
      const defaultMappings = getDefaultAccountMappings()
      const mergedMappings: Record<string, Record<string, string>> = { ...defaultMappings }
      Object.entries(configuredMappings).forEach(([moduleId, mapping]) => {
        mergedMappings[moduleId] = { ...(mergedMappings[moduleId] || {}), ...(mapping as Record<string, string>) }
      })
      // Compatibilidad con la configuración anterior, que agrupaba IR y todas
      // las retenciones en `withholdingPayable`. La cuenta histórica se usa
      // como IR hasta que el usuario configure las cuentas separadas.
      const legacySupplierWithholding = configuredMappings?.supplierInvoice?.withholdingPayable
      if (legacySupplierWithholding && !configuredMappings?.supplierInvoice?.irWithholdingPayable) {
        mergedMappings.supplierInvoice.irWithholdingPayable = legacySupplierWithholding
      }
      if (mergedMappings.supplierInvoice) {
        const { withholdingPayable: _legacyWithholding, ...supplierInvoiceMapping } = mergedMappings.supplierInvoice
        mergedMappings.supplierInvoice = supplierInvoiceMapping
      }
      accountMappingsRef.current = mergedMappings
      setAccountMappings(mergedMappings)
      setCustomModules(cfg.customModules || [])
  }, [configQuery.data])

  useEffect(() => {
    accountMappingsRef.current = accountMappings
  }, [accountMappings])

  useEffect(() => {
    if (configQuery.error) toast.error(configQuery.error.message || 'Error al cargar configuración')
  }, [configQuery.error])

  const loadConfig = () => configQuery.refetch()
  const loadAccounts = () => accountsQuery.refetch()
  const loadConnections = () => connectionsQuery.refetch()

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { autoGenEnabled, defaultCurrency, taxRate, industry, accountMappings: accountMappingsRef.current, customModules }
      await contabilidadService.updateConfig(payload)
      toast.success('Configuración guardada. El motor usará estas cuentas en adelante.')
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al guardar configuración contable')
    } finally {
      setSaving(false)
    }
  }

  const persistAccountMappings = useCallback((nextMappings: Record<string, any>) => {
    const saveTask = accountMappingSaveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        setSaving(true)
        try {
          await contabilidadService.updateConfig({
            autoGenEnabled,
            defaultCurrency,
            taxRate,
            industry,
            accountMappings: nextMappings,
            customModules,
          })
          toast.success('Cuenta contable guardada automáticamente', { id: 'account-mapping-save' })
        } catch (error: any) {
          toast.error(
            error?.response?.data?.message || error?.message || 'No se pudo guardar la cuenta contable',
            { id: 'account-mapping-save' },
          )
        } finally {
          setSaving(false)
        }
      })
    accountMappingSaveQueueRef.current = saveTask
    return saveTask
  }, [autoGenEnabled, defaultCurrency, taxRate, industry, customModules])

  const handleSeedConfig = async () => {
    setSeeding(true)
    try {
      await contabilidadService.seedConfig()
      toast.success('Configuración restablecida a valores por defecto')
      loadConfig()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al restablecer')
    } finally {
      setSeeding(false)
    }
  }

  const updateMapping = (moduleId: string, fieldKey: string, value: string) => {
    const module = allModuleDefs.find(item => item.id === moduleId)
    const field = module?.fields.find(item => item.key === fieldKey)
    const account = allAccounts.find(item => item.code === value)
    const optionState = field && account ? getAccountOptionState(account, field) : undefined
    if (account && optionState?.disabled) {
      toast.error(`No se puede seleccionar ${account.code}: ${optionState.label}`)
      return
    }

    const next = {
      ...accountMappingsRef.current,
      [moduleId]: {
        ...(accountMappingsRef.current[moduleId] || {}),
        [fieldKey]: value,
      },
    }
    accountMappingsRef.current = next
    setAccountMappings(next)
    void persistAccountMappings(next)
  }

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const removeCustomModule = (id: string) => {
    setCustomModules(prev => prev.filter(m => m.id !== id))
    setAccountMappings(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const addCustomField = (moduleId: string) => {
    setCustomModules(prev => prev.map(m => {
      if (m.id !== moduleId) return m
      const key = `field${m.fields.length + 1}`
      return {
        ...m,
        fields: [...m.fields, { key, label: 'Nuevo Campo', side: 'debit' as const, description: '', defaultCode: '1000', defaultName: 'Cuenta', defaultType: 'ASSET' as 'ASSET' }],
      }
    }))
    setAccountMappings(prev => ({
      ...prev,
      [moduleId]: { ...prev[moduleId], [`field${(customModules.find(m => m.id === moduleId)?.fields.length || 0) + 1}`]: '1000' },
    }))
  }

  const removeCustomField = (moduleId: string, fieldKey: string) => {
    setCustomModules(prev => prev.map(m => {
      if (m.id !== moduleId) return m
      return { ...m, fields: m.fields.filter(f => f.key !== fieldKey) }
    }))
    setAccountMappings(prev => {
      const next = { ...prev }
      if (next[moduleId]) {
        const mod = { ...next[moduleId] }
        delete mod[fieldKey]
        next[moduleId] = mod
      }
      return next
    })
  }

  const handlePreviewCatalog = async (ind: string) => {
    if (!ind) return
    try {
      const res = await contabilidadService.getDefaultAccountsByIndustry(ind)
      setPreviewAccounts(Array.isArray(res) ? res : [])
      setShowPreviewCatalog(true)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al obtener catálogo')
    }
  }

  const handleImportCatalog = async () => {
    if (!industry) { toast.error('Selecciona una industria'); return }
    try {
      const res = await contabilidadService.importDefaultsWithHierarchy(industry)
      toast.success(res?.message || 'Catálogo importado')
      loadAccounts()
      setShowPreviewCatalog(false)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al importar')
    }
  }

  const handleExportAccounts = async () => {
    try {
      const raw = await contabilidadService.exportAccounts()
      if (!Array.isArray(raw) || raw.length === 0) throw new Error('El servidor no devolvió cuentas para exportar')
      downloadCsv('plan_cuentas.csv', raw)
      toast.success('Plan de cuentas exportado')
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al exportar')
    }
  }

  const handleDownloadTemplate = () => {
    downloadCsv('plantilla_cuentas.csv', templateRows())
    toast.success('Plantilla descargada')
  }

  const [showPreviewCatalog, setShowPreviewCatalog] = useState(false)
  const [previewAccounts, setPreviewAccounts] = useState<any[]>([])

  // builtin + custom modules combined for display
  const allModuleDefs = useMemo(() => {
    const builtins = BUILTIN_MODULES.filter(m => !OPERATIONAL_ONLY_MODULE_IDS.has(m.id)).map(m => ({
      ...m,
      isBuiltin: true as const,
      fields: m.fields,
    }))
    const customs = customModules.map(m => ({
      id: m.id,
      label: m.label,
      icon: Network,
      description: m.description,
      isBuiltin: false as const,
      fields: m.fields,
    }))
    return [...builtins, ...customs]
  }, [customModules])

  const accountsByCode = useMemo(() => new Map(allAccounts.map(account => [account.code, account])), [allAccounts])
  const accountOptionsByType = useMemo(() => {
    const expectedTypes = new Set(allModuleDefs.flatMap(module => module.fields.map(field => field.defaultType)))
    return Object.fromEntries(Array.from(expectedTypes).map(expectedType => [
      expectedType,
      allAccounts
        .map(account => {
          const optionState = getAccountOptionStateForType(account, expectedType)
          return { ...account, disabled: optionState.disabled, optionState }
        })
        .sort((left, right) => Number(left.disabled) - Number(right.disabled) || left.code.localeCompare(right.code)),
    ])) as Record<string, AccountOption[]>
  }, [allAccounts, allModuleDefs])

  const salesModuleDefs = useMemo(() => allModuleDefs.filter(mod => SALES_MODULE_IDS.has(mod.id)), [allModuleDefs])
  const invoiceSalesModule = salesModuleDefs.find(mod => mod.id === 'invoice')
  const invoicePaymentModule = salesModuleDefs.find(mod => mod.id === 'payment')
  const otherSalesModuleDefs = salesModuleDefs.filter(mod => !['invoice', 'payment'].includes(mod.id))
  const otherModuleDefs = useMemo(() => allModuleDefs.filter(mod => !SALES_MODULE_IDS.has(mod.id)), [allModuleDefs])
  const groupedOtherModules = useMemo(() => {
    const assigned = new Set<string>()
    const groups = ACCOUNTING_MODULE_GROUPS.map(group => {
      const modules = otherModuleDefs.filter(mod => {
        const included = group.moduleIds.includes(mod.id) || (group.id === 'other' && !ACCOUNTING_MODULE_GROUPS.some(item => item.moduleIds.includes(mod.id)))
        if (included) assigned.add(mod.id)
        return included
      })
      return { ...group, modules }
    }).filter(group => group.modules.length > 0)

    const unassigned = otherModuleDefs.filter(mod => !assigned.has(mod.id))
    if (unassigned.length > 0) {
      groups.push({ ...ACCOUNTING_MODULE_GROUPS[ACCOUNTING_MODULE_GROUPS.length - 1], modules: unassigned })
    }
    return groups
  }, [otherModuleDefs])

  const renderConnectionModule = (mod: (typeof allModuleDefs)[number]) => {
    const modMapping = accountMappings[mod.id] || {}
    const listMod = connections?.modules?.find((m: any) => m.id === mod.id)
    const Icon = mod.icon
    const isPayroll = mod.id === 'payroll'

    return (
      <div key={mod.id} className={cn(
        'min-w-0 rounded-2xl border border-border/40 bg-background/35 p-4',
        isPayroll && 'xl:col-span-2',
      )}>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-xs font-black uppercase tracking-tight">{mod.label}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{mod.description}</p>
            </div>
          </div>
        </div>
        <div className={cn(
          'mt-4 grid grid-cols-1 gap-3 md:grid-cols-2',
          isPayroll && 'xl:grid-cols-4',
        )}>
          {mod.fields.map(field => (
            <AccountCodeInput
              key={field.key}
              code={modMapping[field.key] || field.defaultCode}
              field={field}
              account={accountsByCode.get(modMapping[field.key] || field.defaultCode)}
              accountOptions={accountOptionsByType[field.defaultType] || []}
              onChange={value => updateMapping(mod.id, field.key, value)}
            />
          ))}
        </div>
        {listMod && (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/10 pt-2">
            {listMod.fields.map((field: any) => (
              <span key={field.key} className="text-[9px] text-muted-foreground">
                <span className={`mr-1 inline-block size-1.5 rounded-full ${field.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {field.label}: <span className="font-mono font-bold">{field.code}</span>
                {field.reason && <span className="ml-1 text-red-500">({field.reason})</span>}
              </span>
            ))}
          </div>
        )}
        {!mod.isBuiltin && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/10 pt-2">
            <Button variant="ghost" size="sm" onClick={() => addCustomField(mod.id)}>
              <Plus className="mr-1 size-3" /> Agregar Campo
            </Button>
            {mod.fields.map(field => (
              <div key={field.key} className="flex items-center gap-1 rounded-lg bg-muted/10 px-2 py-1 text-[9px] text-muted-foreground">
                <span className="font-medium">{field.label}</span>
                <button
                  type="button"
                  aria-label={`Eliminar campo ${field.label}`}
                  onClick={() => removeCustomField(mod.id, field.key)}
                  className="hover:text-red-500"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => removeCustomModule(mod.id)}>
              <Trash2 className="mr-1 size-3" /> Eliminar conexión
            </Button>
          </div>
        )}
      </div>
    )
  }

  const renderInvoiceSalesCard = (
    invoiceModule: (typeof allModuleDefs)[number],
    paymentModule: (typeof allModuleDefs)[number],
  ) => {
    const invoiceMapping = accountMappings[invoiceModule.id] || {}
    const paymentMapping = accountMappings[paymentModule.id] || {}
    const fields = [
      ...invoiceModule.fields.map(field => ({ module: invoiceModule, mapping: invoiceMapping, field })),
      ...paymentModule.fields.map(field => ({ module: paymentModule, mapping: paymentMapping, field })),
    ]

    return (
      <div key="invoice-sales-cycle" className="min-w-0 rounded-2xl border border-primary/20 bg-primary/[0.025] p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-tight">Facturas de venta</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                Un solo asiento para la factura pagada: ingreso, IVA y cuenta de cobro según la forma de pago.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
          {fields.map(({ module, mapping, field }) => {
            const code = mapping[field.key] || field.defaultCode
            return (
              <AccountCodeInput
                key={`${module.id}-${field.key}`}
                code={code}
                field={field}
                account={accountsByCode.get(code)}
                accountOptions={accountOptionsByType[field.defaultType] || []}
                onChange={value => updateMapping(module.id, field.key, value)}
              />
            )
          })}
        </div>
      </div>
    )
  }

  const renderSalesModuleCard = (mod: (typeof allModuleDefs)[number]) => {
    const modMapping = accountMappings[mod.id] || {}
    const Icon = mod.icon
    const label = mod.id === 'payment' ? 'Cobros de facturas' : mod.label

    return (
      <div key={mod.id} className="min-w-0 rounded-2xl border border-border/40 bg-background/35 p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-xs font-black uppercase tracking-tight">{label}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{mod.description}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {mod.fields.map(field => {
            const code = modMapping[field.key] || field.defaultCode
            return (
              <AccountCodeInput
                key={field.key}
                code={code}
                field={field}
                account={accountsByCode.get(code)}
                accountOptions={accountOptionsByType[field.defaultType] || []}
                onChange={value => updateMapping(mod.id, field.key, value)}
              />
            )
          })}
        </div>
      </div>
    )
  }

  const totalAccounts = useMemo(() => allAccounts.length, [allAccounts])
  const [accountPage, setAccountPage] = useState(1)
  const [accountPageSize, setAccountPageSize] = useState(50)
  const accountTotalPages = Math.max(1, Math.ceil(totalAccounts / accountPageSize))
  const currentAccountPage = Math.min(accountPage, accountTotalPages)
  const paginatedAccounts = useMemo(() => {
    const start = (currentAccountPage - 1) * accountPageSize
    return allAccounts.slice(start, start + accountPageSize)
  }, [allAccounts, currentAccountPage, accountPageSize])
  const accountRangeStart = totalAccounts === 0 ? 0 : (currentAccountPage - 1) * accountPageSize + 1
  const accountRangeEnd = Math.min(currentAccountPage * accountPageSize, totalAccounts)
  const visibleModuleIds = useMemo(() => new Set(allModuleDefs.map(module => module.id)), [allModuleDefs])
  const okCount = connections?.modules?.filter((m: any) => visibleModuleIds.has(m.id) && m.status === 'connected')?.length ?? 0
  const totalMods = allModuleDefs.length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground/40" />
      </div>
    )
  }

  return (
    <div className="accounting-config-view min-w-0 w-full max-w-none space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings2 className="size-6 text-primary" />
            Configuración Contable
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define las cuentas contables que usa cada módulo del ERP para generar asientos automáticos
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button variant="ghost" size="sm" onClick={loadConnections} disabled={connectionsLoading} aria-label="Probar conexiones contables">
            <RefreshCw className={`size-3.5 mr-1 ${connectionsLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Probar conexiones</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleSeedConfig} disabled={seeding}>
            {seeding ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <RefreshCw className="size-3.5 mr-1" />}
            Restablecer
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Save className="size-3.5 mr-1" />}
            Guardar configuración general
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <BookOpen className="size-5 text-primary shrink-0" />
            <div>
              <p className="text-2xl font-bold">{totalAccounts}</p>
              <p className="text-[10px] text-muted-foreground">Cuentas contables</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="size-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{okCount}/{totalMods}</p>
              <p className="text-[10px] text-muted-foreground">Conexiones activas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="size-5 text-primary shrink-0" />
            <div>
              <p className="text-2xl font-bold">{autoGenEnabled ? 'ACTIVO' : 'INACTIVO'}</p>
              <p className="text-[10px] text-muted-foreground">Motor automático</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Link2 className="size-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-2xl font-bold">{allModuleDefs.length}</p>
              <p className="text-[10px] text-muted-foreground">Módulos configurados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Parámetros Generales */}
      <Card>
        <CardHeader className="pb-3 px-5 pt-4">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-primary" />
            <CardTitle className="text-sm font-black uppercase tracking-tight">Parámetros Generales</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(300px,0.9fr)] md:items-start">
            <div className="space-y-2">
              <Label className="text-xs font-bold">Moneda por Defecto</Label>
              <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => (
                    <SelectItem key={c} value={c}>{c === 'NIO' ? 'Córdobas (NIO)' : 'Dólares (USD)'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[9px] text-muted-foreground">Moneda base para los asientos contables</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">Tasa de IVA (%)</Label>
              <Input
                type="number"
                value={taxRate}
                onChange={e => setTaxRate(Number(e.target.value) || 0)}
                className="h-9"
              />
              <p className="text-[9px] text-muted-foreground">Nicaragua: 15%</p>
            </div>
            <div className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] px-3 py-2 md:mt-6 md:w-full">
              <BookOpen className="size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-tight">Asientos automáticos</p>
                <p className="text-[9px] leading-relaxed text-muted-foreground">Conecta los módulos con el Libro Diario, el Libro Mayor y el Plan de Cuentas.</p>
              </div>
              <span className="text-[9px] font-bold uppercase text-muted-foreground">{autoGenEnabled ? 'Activo' : 'Inactivo'}</span>
              <Switch
                checked={autoGenEnabled}
                onCheckedChange={setAutoGenEnabled}
                aria-label="Activar asientos contables automáticos"
                className="scale-90"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    aria-label="Información sobre los asientos automáticos"
                  >
                    <Info className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-[10px] leading-relaxed">
                  Los procesos que cumplan su condición contable generan asientos con las cuentas configuradas en cada módulo. Los movimientos alimentan el Libro Diario y el Libro Mayor, y después se reflejan en los reportes contables.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuración de cuentas para asientos contables */}
      <Card id="configuracion-cuentas-asientos" className="border-primary/25 bg-gradient-to-br from-card via-card to-primary/[0.04] shadow-sm">
        <CardHeader className="border-b border-border/30 px-5 pb-4 pt-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <button
              type="button"
              onClick={() => setAccountMappingsExpanded(value => !value)}
              className="flex min-w-0 items-start gap-3 text-left"
              aria-expanded={accountMappingsExpanded}
              aria-controls="configuracion-cuentas-asientos-content"
            >
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><BookOpen className="size-5" /></div>
              <div className="min-w-0">
                <CardTitle className="text-sm font-black uppercase tracking-tight">Configuración de cuentas para asientos contables por módulos y vistas</CardTitle>
                <p className="mt-1 max-w-4xl text-xs leading-relaxed text-muted-foreground">
                  Define las cuentas Debe y Haber que alimentan el Libro Diario, el Libro Mayor y los reportes contables del ERP. Cada selección se guarda automáticamente; los módulos que no utilices pueden permanecer sin configurar.
                </p>
              </div>
            </button>
            <div className="flex items-center gap-2 self-end lg:self-start">
              <Badge className="w-fit shrink-0 border-primary/20 bg-primary/10 text-[9px] font-black uppercase tracking-widest text-primary">
                {allModuleDefs.length} módulos
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => setAccountMappingsExpanded(value => !value)}
                aria-label={accountMappingsExpanded ? 'Contraer configuración de cuentas' : 'Expandir configuración de cuentas'}
                aria-expanded={accountMappingsExpanded}
                aria-controls="configuracion-cuentas-asientos-content"
              >
                {accountMappingsExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        {accountMappingsExpanded && <CardContent id="configuracion-cuentas-asientos-content" className="space-y-5 p-5">
          {/* Cuentas contables de Ventas */}
      <Card id="ventas-cuentas-contables" className="border-primary/25 bg-gradient-to-br from-card via-card to-primary/[0.04] shadow-sm">
        <CardHeader className="border-b border-border/30 px-5 pb-4 pt-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <button
              type="button"
              onClick={() => setSalesExpanded(value => !value)}
              className="flex min-w-0 items-start gap-3 text-left"
              aria-expanded={salesExpanded}
              aria-controls="ventas-cuentas-contables-content"
            >
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Receipt className="size-5" /></div>
              <div className="min-w-0">
                <CardTitle className="text-sm font-black uppercase tracking-tight">Cuentas contables de Ventas</CardTitle>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                  Configura las cuentas de facturas, cobros por forma de pago, devoluciones, notas de crédito y caja.
                </p>
              </div>
            </button>
            <div className="flex items-center gap-2 self-end lg:self-start">
              <Badge className="w-fit shrink-0 border-primary/20 bg-primary/10 text-[9px] font-black uppercase tracking-widest text-primary">
                {salesModuleDefs.length} {salesModuleDefs.length === 1 ? 'módulo' : 'módulos'}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => setSalesExpanded(value => !value)}
                aria-label={salesExpanded ? 'Contraer cuentas de ventas' : 'Expandir cuentas de ventas'}
                aria-expanded={salesExpanded}
                aria-controls="ventas-cuentas-contables-content"
              >
                {salesExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        {salesExpanded && <CardContent id="ventas-cuentas-contables-content" className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-2">
          {invoiceSalesModule && invoicePaymentModule && (
            renderInvoiceSalesCard(invoiceSalesModule, invoicePaymentModule)
          )}
          {otherSalesModuleDefs.map(renderSalesModuleCard)}
        </CardContent>}
      </Card>

      {/* Otros módulos contables */}
      <div className="space-y-5">
        {groupedOtherModules.map(group => {
          const GroupIcon = group.icon
          const isExpanded = expandedGroups.has(group.id)
          return (
            <Card key={group.id} className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.025] shadow-sm">
              <CardHeader className="border-b border-border/30 px-5 pb-4 pt-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="flex min-w-0 items-start gap-3 text-left"
                    aria-expanded={isExpanded}
                    aria-controls={`${group.id}-cuentas-contables-content`}
                  >
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><GroupIcon className="size-5" /></div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-black uppercase tracking-tight">{group.label}</CardTitle>
                      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{group.description}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 self-end lg:self-start">
                    <Badge className="w-fit shrink-0 border-primary/20 bg-primary/10 text-[9px] font-black uppercase tracking-widest text-primary">
                      {group.modules.length} {group.modules.length === 1 ? 'módulo' : 'módulos'}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => toggleGroup(group.id)}
                      aria-label={isExpanded ? `Contraer ${group.label}` : `Expandir ${group.label}`}
                      aria-expanded={isExpanded}
                      aria-controls={`${group.id}-cuentas-contables-content`}
                    >
                      {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent id={`${group.id}-cuentas-contables-content`} className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-2">
                  {group.modules.map(renderConnectionModule)}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
        </CardContent>}
      </Card>

      {/* Catálogo por Defecto */}
      <Card className="min-w-0">
        <CardHeader className="pb-3 px-5 pt-4">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            <CardTitle className="text-sm font-black uppercase tracking-tight">Catálogo de Cuentas por Defecto</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <p className="text-xs text-muted-foreground mb-4">
            Importa un catálogo completo de cuentas contables según la industria. Usa <strong>Vista Previa</strong> para ver las cuentas antes de importar.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={industry} onValueChange={v => { setIndustry(v); setShowPreviewCatalog(false) }}>
              <SelectTrigger className="h-9 w-full sm:w-64">
                <SelectValue placeholder="Seleccionar industria..." />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map(ind => (
                  <SelectItem key={ind.value} value={ind.value}>{ind.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => handlePreviewCatalog(industry)} disabled={!industry}>
              <Eye className="size-3.5 mr-1" />
              Vista Previa
            </Button>
            <Button onClick={handleImportCatalog} disabled={!industry} size="sm">
              <Upload className="size-3.5 mr-1" />
              Importar Catálogo
            </Button>
          </div>
          {showPreviewCatalog && previewAccounts.length > 0 && (
            <div className="mt-4 rounded-xl border border-border/40 overflow-hidden">
              <div className="bg-muted/20 px-4 py-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Vista previa — {previewAccounts.length} cuentas
                </span>
                <button onClick={() => setShowPreviewCatalog(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="relative hidden max-h-60 overflow-auto sm:block">
                <table className="w-full min-w-[560px] text-[11px]">
                  <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                    <tr className="border-b border-border/20">
                      <th className="text-left px-3 py-1.5 font-bold text-muted-foreground">Código</th>
                      <th className="text-left px-3 py-1.5 font-bold text-muted-foreground">Nombre</th>
                      <th className="text-left px-3 py-1.5 font-bold text-muted-foreground">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewAccounts.map((acc, i) => (
                      <tr key={i} className="border-b border-border/10 hover:bg-muted/10">
                        <td className="px-3 py-1 font-mono">{acc.code}</td>
                        <td className="px-3 py-1">{acc.name}</td>
                        <td className="px-3 py-1">
                          <Badge variant="outline" className="text-[9px]">
                            {acc.type === 'ASSET' ? 'Activo' : acc.type === 'LIABILITY' ? 'Pasivo' : acc.type === 'EQUITY' ? 'Patrimonio' : acc.type === 'INCOME' ? 'Ingreso' : 'Gasto'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 p-2 sm:hidden">
                {previewAccounts.map((acc, i) => (
                  <div key={i} className="rounded-lg border border-border/50 bg-card/60 p-2.5">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] text-muted-foreground">{acc.code}</p>
                        <p className="truncate text-xs font-bold" title={acc.name}>{acc.name}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[9px]">
                        {acc.type === 'ASSET' ? 'Activo' : acc.type === 'LIABILITY' ? 'Pasivo' : acc.type === 'EQUITY' ? 'Patrimonio' : acc.type === 'INCOME' ? 'Ingreso' : 'Gasto'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tipo detallados de Cuentas */}
      <Card className="min-w-0">
        <CardHeader className="pb-3 px-5 pt-4">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <CardTitle className="text-sm font-black uppercase tracking-tight">Tipos detallados de cuentas</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Clasificación financiera de cada cuenta. El catálogo incluye las obligaciones, provisiones, nómina, formación y beneficios que utiliza Recursos Humanos.
          </p>
          <div className="flex flex-wrap gap-2" aria-label="Resumen de tipos de detalle">
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-[10px]">
              <span className="size-1.5 rounded-full bg-sky-500" />
              Balance General · {allAccounts.filter(acc => acc.detailType === 'BALANCE_SHEET').length}
            </Badge>
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-[10px]">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Estado de Resultados · {allAccounts.filter(acc => acc.detailType === 'INCOME_STATEMENT').length}
            </Badge>
            <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 px-2.5 py-1 text-[10px] text-primary">
              <Users className="size-3" />
              RRHH incluido · {allAccounts.filter(acc => HR_ACCOUNT_CODES.has(acc.code)).length} cuentas
            </Badge>
          </div>
          <div className="rounded-xl border border-border/30">
            <div className="relative hidden max-h-[28rem] overflow-auto sm:block">
            <table className="w-full min-w-[680px] text-[11px]">
              <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                <tr className="border-b border-border/20">
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground">Subtipo de cuenta</th>
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground">Nombre</th>
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground">Tipo detalle</th>
                  <th className="text-center px-3 py-2 font-bold text-muted-foreground">Activo</th>
                </tr>
              </thead>
              <tbody>
                {allAccounts.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-xs">No hay cuentas contables</td></tr>
                ) : paginatedAccounts.map(acc => (
                  <tr key={acc.id} className="border-b border-border/10 hover:bg-muted/10">
                    <td className="px-3 py-1.5">
                      <Badge variant="outline" className="text-[9px]">
                        {acc.subtype === 'MAIN_GROUP' ? 'Grupo principal' : acc.subtype === 'GROUP' ? 'Grupo' : acc.subtype === 'DETAIL_ACCOUNT' ? 'Cuenta de detalle' : 'Subcuenta'}
                      </Badge>
                    </td>
                    <td className="px-3 py-1.5 font-medium">{acc.code} - {acc.name}</td>
                    <td className="px-3 py-1.5">
                      <Badge variant="outline" className="text-[9px]">
                        {acc.detailType === 'BALANCE_SHEET' ? 'Balance General' : 'Estado de Resultados'}
                      </Badge>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <Badge variant={acc.isActive !== false ? 'default' : 'secondary'} className="text-[9px]">
                        {acc.isActive !== false ? 'Sí' : 'No'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="space-y-2 p-2 sm:hidden">
              {allAccounts.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">No hay cuentas contables</p>
              ) : paginatedAccounts.map(acc => (
                <div key={acc.id} className="rounded-lg border border-border/50 bg-card/60 p-2.5">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold" title={`${acc.code} - ${acc.name}`}>{acc.code} - {acc.name}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{acc.subtype === 'MAIN_GROUP' ? 'Grupo principal' : acc.subtype === 'GROUP' ? 'Grupo' : acc.subtype === 'DETAIL_ACCOUNT' ? 'Cuenta de detalle' : 'Subcuenta'}</p>
                    </div>
                    <Badge variant={acc.isActive !== false ? 'default' : 'secondary'} className="shrink-0 text-[9px]">{acc.isActive !== false ? 'Activo' : 'Inactivo'}</Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2 text-[10px]">
                    <span className="text-muted-foreground">Tipo detalle</span>
                    <Badge variant="outline" className="text-[9px]">{acc.detailType === 'BALANCE_SHEET' ? 'Balance General' : 'Estado de Resultados'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-col items-stretch justify-between gap-3 border-t border-border/40 pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center" data-tour="account-detail-pagination">
            <div className="flex items-center gap-2">
              <span>Mostrar</span>
              <select
                value={accountPageSize}
                onChange={event => {
                  setAccountPageSize(Number(event.target.value))
                  setAccountPage(1)
                }}
                className="h-8 rounded-lg border border-border/50 bg-background px-2 font-bold text-foreground outline-none"
                aria-label="Registros por página"
              >
                {[50, 100, 200].map(size => <option key={size} value={size}>{size}</option>)}
              </select>
              <span>por página</span>
              <span className="ml-2 rounded-lg border border-border/40 px-2 py-1">
                {totalAccounts === 0 ? 0 : `${accountRangeStart}-${accountRangeEnd}`} de {totalAccounts}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 sm:justify-end">
              <button
                type="button"
                className="rounded-lg border border-border/50 p-2 disabled:opacity-30"
                onClick={() => setAccountPage(1)}
                disabled={currentAccountPage <= 1}
                aria-label="Primera página"
              >
                <ChevronsLeft className="size-4" />
              </button>
              <button
                type="button"
                className="rounded-lg border border-border/50 p-2 disabled:opacity-30"
                onClick={() => setAccountPage(page => Math.max(1, page - 1))}
                disabled={currentAccountPage <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="min-w-24 text-center font-bold text-foreground">Pág. {currentAccountPage} / {accountTotalPages}</span>
              <button
                type="button"
                className="rounded-lg border border-border/50 p-2 disabled:opacity-30"
                onClick={() => setAccountPage(page => Math.min(accountTotalPages, page + 1))}
                disabled={currentAccountPage >= accountTotalPages}
                aria-label="Página siguiente"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                type="button"
                className="rounded-lg border border-border/50 p-2 disabled:opacity-30"
                onClick={() => setAccountPage(accountTotalPages)}
                disabled={currentAccountPage >= accountTotalPages}
                aria-label="Última página"
              >
                <ChevronsRight className="size-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <BankAccountsView />

      <TaxCatalogView />

      {/* Import / Export CSV */}
      <Card>
        <CardHeader className="pb-3 px-5 pt-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-primary" />
            <CardTitle className="text-sm font-black uppercase tracking-tight">Importar / Exportar CSV</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Formato CSV esperado para importar cuentas (UTF-8). Columnas: {CHART_ACCOUNT_CSV_HEADERS.join(', ')}.
            Los campos <code>permite_manual</code> y <code>activa</code> usan 1/0.
          </p>
          <div className="bg-muted/20 rounded-xl p-3 font-mono text-[10px] overflow-x-auto">
            <pre className="text-muted-foreground whitespace-pre">{csvRowsToText(templateRows())}</pre>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleExportAccounts}>
              <FileDown className="size-3.5 mr-1" /> Exportar Cuentas
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <FileSpreadsheet className="size-3.5 mr-1" /> Descargar Plantilla
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
