import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Settings2, Save, Building2, Upload, FileDown, RefreshCw,
  Loader2, CheckCircle2, Globe, DollarSign,
  FileSpreadsheet, Link2, BookOpen, Eye, X,
  Plus, HelpCircle, Trash2,
  FileText, Receipt, Package, Wallet,
  Users, BarChart3, RotateCcw, Undo2, Network,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { Switch } from '../ui/switch'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { BankAccountsView } from './BankAccountsView'
import { contabilidadService } from '../../services/contabilidad.service'
import { CHART_ACCOUNT_CSV_HEADERS, csvRowsToText, downloadCsv, templateRows } from '../../utils/chartOfAccountsCsv'

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

type AccountInfo = { id: string; code: string; name: string; type: string }

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
    description: 'Cuando se crea una factura, el motor genera un asiento contable automático',
    fields: [
      { key: 'receivable', label: 'Cuenta por Cobrar', side: 'debit', description: 'Se debita el total de la factura', defaultCode: '1100', defaultName: 'Cuentas por Cobrar', defaultType: 'ASSET' },
      { key: 'income', label: 'Ingresos', side: 'credit', description: 'Se acredita el subtotal (sin IVA)', defaultCode: '4000', defaultName: 'Ingresos Operativos', defaultType: 'INCOME' },
      { key: 'ivaPayable', label: 'IVA por Pagar', side: 'credit', description: 'Se acredita el IVA', defaultCode: '2100', defaultName: 'IVA por Pagar', defaultType: 'LIABILITY' },
    ],
  },
  {
    id: 'payment', label: 'Cobros', icon: Receipt,
    description: 'Cuando se recibe un pago, se genera el asiento de cobro',
    fields: [
      { key: 'cash', label: 'Caja / Bancos', side: 'debit', description: 'Se debita el monto recibido', defaultCode: '1000', defaultName: 'Caja y Bancos', defaultType: 'ASSET' },
      { key: 'receivable', label: 'Cuenta por Cobrar', side: 'credit', description: 'Se acredita la cuenta por cobrar', defaultCode: '1100', defaultName: 'Cuentas por Cobrar', defaultType: 'ASSET' },
    ],
  },
  {
    id: 'supplierInvoice', label: 'Facturas de Proveedor', icon: Package,
    description: 'Factura de compra → inventario + IVA + cuenta por pagar',
    fields: [
      { key: 'inventory', label: 'Inventario / Gasto', side: 'debit', description: 'Se debita el costo del inventario o gasto', defaultCode: '1200', defaultName: 'Inventario', defaultType: 'ASSET' },
      { key: 'ivaCreditable', label: 'IVA Acreditable', side: 'debit', description: 'Se debita el IVA (es acreditable)', defaultCode: '2105', defaultName: 'IVA Acreditable', defaultType: 'ASSET' },
      { key: 'payable', label: 'Cuenta por Pagar', side: 'credit', description: 'Se acredita la deuda con el proveedor', defaultCode: '2000', defaultName: 'Cuentas por Pagar', defaultType: 'LIABILITY' },
    ],
  },
  {
    id: 'paymentMade', label: 'Pagos a Proveedores', icon: Wallet,
    description: 'Pago realizado → disminuye CxP y disminuye caja',
    fields: [
      { key: 'payable', label: 'Cuenta por Pagar', side: 'debit', description: 'Se debita la deuda (disminuye)', defaultCode: '2000', defaultName: 'Cuentas por Pagar', defaultType: 'LIABILITY' },
      { key: 'cash', label: 'Caja / Bancos', side: 'credit', description: 'Se acredita la salida de efectivo', defaultCode: '1000', defaultName: 'Caja y Bancos', defaultType: 'ASSET' },
    ],
  },
  {
    id: 'expense', label: 'Gastos', icon: FileText,
    description: 'Gasto operativo → se registra el gasto y la salida de caja',
    fields: [
      { key: 'expense', label: 'Cuenta de Gasto', side: 'debit', description: 'Se debita el gasto', defaultCode: '5000', defaultName: 'Gastos Operativos', defaultType: 'EXPENSE' },
      { key: 'cash', label: 'Caja / Bancos', side: 'credit', description: 'Se acredita la salida de efectivo', defaultCode: '1000', defaultName: 'Caja y Bancos', defaultType: 'ASSET' },
    ],
  },
  {
    id: 'payroll', label: 'Nóminas', icon: Users,
    description: 'Nómina → gasto de nómina + obligaciones laborales + neto a pagar',
    fields: [
      { key: 'expense', label: 'Gasto de Nómina', side: 'debit', description: 'Se debita el total devengado', defaultCode: '5100', defaultName: 'Gastos de Nomina', defaultType: 'EXPENSE' },
      { key: 'inssPayable', label: 'INSS por Pagar', side: 'credit', description: 'Aportes INSS (laboral + patronal)', defaultCode: '2200', defaultName: 'INSS por Pagar', defaultType: 'LIABILITY' },
      { key: 'irPayable', label: 'IR por Pagar', side: 'credit', description: 'Retención IR', defaultCode: '2300', defaultName: 'IR por Pagar', defaultType: 'LIABILITY' },
      { key: 'netPayable', label: 'Neto a Pagar', side: 'credit', description: 'Sueldo neto a pagar a empleados', defaultCode: '2400', defaultName: 'Neto a Pagar', defaultType: 'LIABILITY' },
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
]

function AccountCodeInput({ code, field, allAccounts, onChange }: {
  code: string
  field: ModuleField
  allAccounts: AccountInfo[]
  onChange: (val: string) => void
}) {
  const account = allAccounts.find(a => a.code === code)
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-bold ${field.side === 'debit' ? 'text-orange-600' : 'text-blue-600'}`}>
          {field.side === 'debit' ? 'DÉBITO' : 'CRÉDITO'}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">→</span>
        <span className="text-[10px] font-medium">{field.label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-muted-foreground">Código:</span>
        <Input
          value={code}
          onChange={e => onChange(e.target.value)}
          className={`w-20 h-7 text-xs font-mono ${account ? 'border-emerald-500/30' : code ? 'border-red-500/30' : ''}`}
        />
        {account && (
          <span className="text-[9px] text-emerald-600 font-medium truncate max-w-[140px]">
            {account.name}
          </span>
        )}
        {!account && code && (
          <span className="text-[9px] text-red-500">No existe — se creará automáticamente</span>
        )}
        {!code && (
          <span className="text-[9px] text-muted-foreground">Usará default: {field.defaultCode}</span>
        )}
      </div>
      <p className="text-[8px] text-muted-foreground leading-tight">{field.description}</p>
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const [autoGenEnabled, setAutoGenEnabled] = useState(true)
  const [defaultCurrency, setDefaultCurrency] = useState('NIO')
  const [taxRate, setTaxRate] = useState(15)
  const [industry, setIndustry] = useState('RETAIL')
  const [accountMappings, setAccountMappings] = useState<Record<string, any>>({})
  const [customModules, setCustomModules] = useState<ConnectionModule[]>([])
  const [allAccounts, setAllAccounts] = useState<AccountInfo[]>([])

  const [connections, setConnections] = useState<any>(null)
  const [connectionsLoading, setConnectionsLoading] = useState(false)

  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['invoice', 'payment']))

  useEffect(() => {
    loadConfig()
    loadAccounts()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const res = await contabilidadService.getConfig()
      const cfg = res?.config || res || {}
      setAutoGenEnabled(cfg.autoGenEnabled ?? true)
      setDefaultCurrency(cfg.defaultCurrency || 'NIO')
      setTaxRate(cfg.taxRate ?? 15)
      setIndustry(cfg.industry || 'RETAIL')
      setAccountMappings(cfg.accountMappings || {})
      setCustomModules(cfg.customModules || [])
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al cargar configuración')
    } finally {
      setLoading(false)
    }
  }

  const loadAccounts = async () => {
    try {
      const res = await contabilidadService.getChartOfAccounts()
      const flat: AccountInfo[] = []
      const flatten = (items: any[]) => {
        for (const item of items) {
          flat.push({ id: item.id, code: item.code, name: item.name, type: item.type })
          if (item.children) flatten(item.children)
        }
      }
      flatten(Array.isArray(res) ? res : [])
      setAllAccounts(flat)
    } catch {
      // non-critical
    }
  }

  const loadConnections = useCallback(async () => {
    setConnectionsLoading(true)
    try {
      const res = await contabilidadService.testConnections()
      setConnections(res)
    } catch {
      setConnections(null)
    } finally {
      setConnectionsLoading(false)
    }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { autoGenEnabled, defaultCurrency, taxRate, industry, accountMappings, customModules }
      await contabilidadService.updateConfig(payload)
      toast.success('Configuración guardada. El motor usará estas cuentas en adelante.')
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al guardar configuración contable')
    } finally {
      setSaving(false)
    }
  }

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
    setAccountMappings(prev => {
      const next = { ...prev }
      if (!next[moduleId]) next[moduleId] = {}
      next[moduleId] = { ...next[moduleId], [fieldKey]: value }
      return next
    })
  }

  const toggleExpand = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const addCustomModule = () => {
    const id = `custom_${Date.now()}`
    const newMod: ConnectionModule = {
      id,
      label: 'Nueva Conexión',
      description: 'Conexión personalizada definida por el usuario',
      fields: [
        { key: 'debitAccount', label: 'Cuenta Débito', side: 'debit', description: 'Cuenta que se debitará', defaultCode: '1000', defaultName: 'Cuenta Débito', defaultType: 'ASSET' },
        { key: 'creditAccount', label: 'Cuenta Crédito', side: 'credit', description: 'Cuenta que se acreditará', defaultCode: '2000', defaultName: 'Cuenta Crédito', defaultType: 'LIABILITY' },
      ],
    }
    setCustomModules(prev => [...prev, newMod])
    setAccountMappings(prev => ({
      ...prev,
      [id]: { debitAccount: '1000', creditAccount: '2000' },
    }))
    setExpandedModules(prev => new Set(prev).add(id))
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
    const builtins = BUILTIN_MODULES.map(m => ({
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

  const totalAccounts = useMemo(() => allAccounts.length, [allAccounts])
  const okCount = connections?.modules?.filter((m: any) => m.status === 'connected')?.length ?? 0
  const totalMods = connections?.modules?.length ?? allModuleDefs.length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground/40" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings2 className="size-6 text-primary" />
            Configuración Contable
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define las cuentas contables que usa cada módulo del ERP para generar asientos automáticos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSeedConfig} disabled={seeding}>
            {seeding ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <RefreshCw className="size-3.5 mr-1" />}
            Restablecer
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Save className="size-3.5 mr-1" />}
            Guardar Cambios
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="space-y-2">
              <Label className="text-xs font-bold">Industria</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map(ind => (
                    <SelectItem key={ind.value} value={ind.value}>{ind.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[9px] text-muted-foreground">Determina el catálogo de cuentas por defecto</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/20 border border-border/30">
            <HelpCircle className="size-4 text-primary shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              <strong className="text-foreground">¿Cómo funciona?</strong> Cuando creas una factura, un cobro, un gasto, etc., el motor contable genera automáticamente un asiento en el Libro Diario usando las cuentas que definas abajo. Cada módulo tiene campos de <span className="text-orange-600 font-bold">DÉBITO</span> y <span className="text-blue-600 font-bold">CRÉDITO</span> — el código que ingreses es el número de cuenta del Plan de Cuentas. Si la cuenta no existe, se crea automáticamente.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Motor de Asientos */}
      <Card>
        <CardHeader className="pb-3 px-5 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-primary" />
              <CardTitle className="text-sm font-black uppercase tracking-tight">Motor de Asientos Automáticos</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">
                {autoGenEnabled ? 'Activado' : 'Desactivado'}
              </span>
              <Switch checked={autoGenEnabled} onCheckedChange={setAutoGenEnabled} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <p className="text-xs text-muted-foreground mb-4">
            Cuando está activo, cada transacción (factura, cobro, gasto, nómina, etc.) genera automáticamente su asiento contable en el Libro Diario y actualiza el Libro Mayor.
          </p>
        </CardContent>
      </Card>

      {/* Conexiones entre Módulos y Cuentas Contables */}
      <Card>
        <CardHeader className="pb-3 px-5 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="size-4 text-primary" />
              <CardTitle className="text-sm font-black uppercase tracking-tight">Conexiones entre Módulos y Cuentas Contables</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={loadConnections} disabled={connectionsLoading}>
                <RefreshCw className={`size-3 ${connectionsLoading ? 'animate-spin' : ''} mr-1`} />
                Probar Todo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground mb-2">
            Expande cada módulo para ver y editar las cuentas contables que usa. El estado indica si las cuentas existen en tu Plan de Cuentas.
          </p>

          {allModuleDefs.map(mod => {
            const modMapping = accountMappings[mod.id] || {}
            const status = connections?.modules?.find((m: any) => m.id === mod.id)?.status ?? null
            const listMod = connections?.modules?.find((m: any) => m.id === mod.id)
            const Icon = mod.icon
            const isExpanded = expandedModules.has(mod.id)

            return (
              <div key={mod.id} className="rounded-xl border border-border/30 overflow-hidden">
                {/* Header (clickable) */}
                <button
                  onClick={() => toggleExpand(mod.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/10 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-4 text-muted-foreground" />
                    <div>
                      <span className="text-xs font-bold">{mod.label}</span>
                      <p className="text-[9px] text-muted-foreground">{mod.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Status */}
                    {status === null ? (
                      <Badge variant="outline" className="text-[9px] text-muted-foreground border-border/30">Sin probar</Badge>
                    ) : status === 'connected' ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px]">Conectado</Badge>
                    ) : status === 'partial' ? (
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[9px]">Parcial</Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-[9px]">Desconectado</Badge>
                    )}
                    {/* Field summaries */}
                    {!isExpanded && mod.fields.map(f => {
                      const code = modMapping[f.key] || f.defaultCode
                      const acct = allAccounts.find(a => a.code === code)
                      return (
                        <span key={f.key} className="hidden md:inline-flex items-center gap-1 text-[8px] text-muted-foreground bg-muted/20 px-1.5 py-0.5 rounded">
                          <span className={`size-1.5 rounded-full ${acct ? 'bg-emerald-500' : 'bg-red-400'}`} />
                          <span className="font-mono">{code}</span>
                        </span>
                      )
                    })}
                    {isExpanded ? <ChevronUp className="size-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-border/20 pt-3 space-y-3">
                    {/* Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {mod.fields.map(f => (
                        <AccountCodeInput
                          key={f.key}
                          code={modMapping[f.key] ?? ''}
                          field={f}
                          allAccounts={allAccounts}
                          onChange={val => updateMapping(mod.id, f.key, val)}
                        />
                      ))}
                    </div>

                    {/* Custom module: add field button */}
                    {!mod.isBuiltin && (
                      <div className="flex items-center gap-2 pt-2 border-t border-border/10">
                        <Button variant="ghost" size="sm" onClick={() => addCustomField(mod.id)}>
                          <Plus className="size-3 mr-1" /> Agregar Campo
                        </Button>
                        {mod.fields.map(f => (
                          <div key={f.key} className="flex items-center gap-1 text-[9px] text-muted-foreground bg-muted/10 px-2 py-1 rounded-lg">
                            <span className="font-medium">{f.label}</span>
                            <button onClick={() => removeCustomField(mod.id, f.key)} className="hover:text-red-500">
                              <X className="size-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Connection status detail */}
                    {listMod && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/10">
                        {listMod.fields.map((f: any) => (
                          <div key={f.key} className="flex items-center gap-1 text-[9px]">
                            <span className={`size-1.5 rounded-full ${f.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span className="text-muted-foreground">{f.label}:</span>
                            <span className="font-mono font-bold">{f.code}</span>
                            {f.accountName && <span className="text-muted-foreground">({f.accountName})</span>}
                            {!f.accountExists && <span className="text-red-500">creará</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Delete custom module */}
                    {!mod.isBuiltin && (
                      <div className="pt-2 border-t border-border/10 flex justify-end">
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => removeCustomModule(mod.id)}>
                          <Trash2 className="size-3 mr-1" /> Eliminar conexión
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <Button variant="outline" size="sm" onClick={addCustomModule} className="w-full">
            <Plus className="size-3.5 mr-1" /> Agregar Conexión Personalizada
          </Button>
        </CardContent>
      </Card>

      {/* Catálogo por Defecto */}
      <Card>
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
              <SelectTrigger className="w-64 h-9">
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
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-muted/30">
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tipo detallados de Cuentas */}
      <Card>
        <CardHeader className="pb-3 px-5 pt-4">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <CardTitle className="text-sm font-black uppercase tracking-tight">Tipo detallados de Cuentas</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Subtipos de cuenta y su tipo de detalle asignado a cada cuenta del catálogo.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border/30">
            <table className="w-full text-[11px]">
              <thead className="bg-muted/30">
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
                ) : allAccounts.slice(0, 50).map((acc, i) => (
                  <tr key={i} className="border-b border-border/10 hover:bg-muted/10">
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
            {allAccounts.length > 50 && (
              <p className="text-center text-[10px] text-muted-foreground py-2 border-t border-border/10">
                Mostrando 50 de {allAccounts.length} cuentas
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <BankAccountsView />

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
          <div className="flex items-center gap-3">
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
