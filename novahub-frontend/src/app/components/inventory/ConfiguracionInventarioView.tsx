"use client"

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import {
  Settings2, Building2, Link2, Activity, Factory, RefreshCw,
  Loader2, Sparkles, Plus, CircleHelp, Warehouse, CheckCircle2, AlertTriangle, GitBranch,
  ChevronRight, ChevronDown, Unlink, Info,
} from 'lucide-react'
import { Card } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Combobox } from '../ui/Combobox'
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour'
import { Switch } from '../ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { inventoryService } from '../../services/inventario.service'
import { contabilidadService } from '../../services/contabilidad.service'
import { tenantsService } from '../../services/tenants.service'
import { api, getApiErrorMessage } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { AlmacenesView } from './AlmacenesView'
import { cn } from '../ui/utils'
import { InventoryViewTutorial } from './InventoryViewTutorial'

type AccountInfo = {
  id: string
  code: string
  name: string
  type?: string
  isActive?: boolean
  acceptsPostings?: boolean
}

const STATUS_META: Record<string, { label: string; tone: 'success' | 'warn' | 'danger' | 'muted'; description: string }> = {
  VINCULADO: { label: 'Vinculado', tone: 'success', description: 'La bodega tiene una cuenta contable activa que acepta movimientos.' },
  PENDIENTE: { label: 'Pendiente', tone: 'warn', description: 'La bodega aún no tiene una cuenta contable vinculada. Usa el botón Configurar.' },
  CUENTA_INACTIVA: { label: 'Cuenta inactiva', tone: 'danger', description: 'La cuenta vinculada está inactiva. Vincula una cuenta activa.' },
  CUENTA_NO_POSTEABLE: { label: 'No posteable', tone: 'danger', description: 'La cuenta vinculada no acepta movimientos. Debe ser una cuenta de detalle que acepte posteos.' },
}

function StatusBadge({ status }: { status?: string }) {
  const meta = STATUS_META[status || 'PENDIENTE'] || STATUS_META.PENDIENTE
  const toneClass = {
    success: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    warn: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    danger: 'bg-red-500/10 text-red-600 border-red-500/20',
    muted: 'bg-muted/50 text-muted-foreground border-border/40',
  }[meta.tone]
  return <Badge variant="outline" title={meta.description} className={cn('gap-1 text-[9px] font-black uppercase tracking-widest', toneClass)}>{meta.label}</Badge>
}

const flattenAccounts = (list: any[]): any[] => {
  const result: any[] = [];
  const recurse = (items: any[]) => {
    for (const item of items) {
      result.push(item);
      if (item.children && Array.isArray(item.children) && item.children.length > 0) {
        recurse(item.children);
      }
    }
  };
  recurse(list);
  return result;
};

// Estado derivado de la cuenta contable vinculada. Sin cuenta -> PENDIENTE;
// con cuenta inactiva o que no acepta posteos -> error; en cualquier otro
// caso la vinculación está vigente (VINCULADO).
const accountStatusFromAccount = (account?: { isActive?: boolean; acceptsPostings?: boolean } | null): string => {
  if (!account) return 'PENDIENTE';
  if (account.isActive === false) return 'CUENTA_INACTIVA';
  if (account.acceptsPostings === false) return 'CUENTA_NO_POSTEABLE';
  return 'VINCULADO';
};

const CONFIG_INVENTORY_TOUR_STEPS: GuidedTourStep[] = [
  {
    target: '[data-tour="config-header"]',
    title: 'Configuración contable de Inventario',
    description: 'Esta vista conecta las bodegas de la sucursal con las cuentas de inventario del Plan de Cuentas, para que los movimientos de mercadería se registren automáticamente en Contabilidad.',
    tip: 'La lógica es una jerarquía: Cuenta control → Cuenta de sucursal → Cuenta de bodega.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="config-tab-general"]',
    title: 'Cuenta control y reglas',
    description: 'Aquí eliges la cuenta control de Inventario (por ejemplo 1105). Es el ancla de la rama: bajo ella se cuelgan las cuentas agrupadoras de cada sucursal y las cuentas posteables de cada bodega. También puedes exigir que cada bodega tenga su propia cuenta.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="config-tab-almacenes"]',
    title: 'Bodegas',
    description: 'Crea y administra las bodegas operativas de esta sucursal. Cada bodega aparecerá después en las tablas de vinculación contable.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="config-tab-contable"]',
    title: 'Vinculación contable',
    description: 'Tabla de cada bodega con su sucursal, su cuenta contable y su estado. El botón Configurar abre dos opciones: crear automáticamente la cuenta de sucursal + bodega, o vincular una cuenta existente.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="config-tab-estado"]',
    title: 'Estado de vinculación',
    description: 'Resumen del avance: cuántas sucursales y bodegas existen, cuántas ya tienen cuenta vinculada, cuántas están pendientes y cuáles tienen errores en su cuenta.',
    placement: 'bottom',
  },
];

interface ConfiguracionInventarioViewProps {
  isSidebarCollapsed?: boolean
}

export function ConfiguracionInventarioView(_props: ConfiguracionInventarioViewProps) {
  const { user, canPerform } = useAuth()
  const canViewInventory = canPerform('INVENTORY', 'view')
  const canViewAccounting = canPerform('ACCOUNTING', 'view')
  const canViewCompany = canPerform('CONFIG_COMPANY', 'view')
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('general')
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [costCenters, setCostCenters] = useState<any[]>([])
  const [tenantIndustry, setTenantIndustry] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [controlAccountId, setControlAccountId] = useState('')
  const [requiresPerWarehouse, setRequiresPerWarehouse] = useState(false)
  const [configLoading, setConfigLoading] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set())

  const toggleBranchCollapse = (branchId: string) => {
    setCollapsedBranches(prev => {
      const next = new Set(prev)
      if (next.has(branchId)) next.delete(branchId)
      else next.add(branchId)
      return next
    })
  }

  // Configurar dialog
  const [configTarget, setConfigTarget] = useState<any | null>(null)
  const [configBranch, setConfigBranch] = useState<any | null>(null)
  const [configMode, setConfigMode] = useState<'auto' | 'existing'>('auto')
  const [existingAccountId, setExistingAccountId] = useState('')
  const [branchAccountId, setBranchAccountId] = useState('')
  const [configSaving, setConfigSaving] = useState(false)

  // Desvincular dialog
  const [unlinkTarget, setUnlinkTarget] = useState<{ wh: any; branch: any } | null>(null)
  const [unlinkSaving, setUnlinkSaving] = useState(false)

  const isManufacturing = tenantIndustry === 'MANUFACTURING'

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      const [whRes, branchRes, accRes, cfgRes] = await Promise.all([
        canViewInventory ? inventoryService.getWarehouses() : Promise.resolve([]),
        canViewInventory ? api.get<any[]>('/sucursales') : Promise.resolve([]),
        canViewAccounting ? contabilidadService.getChartOfAccounts(false) : Promise.resolve([]),
        canViewAccounting ? contabilidadService.getConfig() : Promise.resolve({}),
      ])
      setWarehouses(Array.isArray(whRes) ? whRes : [])
      const branchList = Array.isArray(branchRes) ? branchRes : (branchRes as any)?.data || []
      setBranches(Array.isArray(branchList) ? branchList : [])
      setAccounts(Array.isArray(accRes) ? accRes : (accRes as any)?.data || accRes || [])

      const cfg = (cfgRes as any)?.config || cfgRes || {}
      setControlAccountId(cfg.accountMappings?.inventory?.control || '')
      setRequiresPerWarehouse(!!cfg.inventory?.requiresAccountPerWarehouse)

      if (user?.tenantId && canViewCompany) {
        try {
          const tenant = await tenantsService.getOne(user.tenantId)
          setTenantIndustry(tenant?.industry || '')
        } catch { /* ignorar */ }
      }
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al cargar la configuración'))
    } finally {
      setLoading(false)
    }
  }, [user?.tenantId, canViewInventory, canViewAccounting, canViewCompany])

  useEffect(() => { void fetchAll() }, [fetchAll])

  useEffect(() => {
    if (!isManufacturing || !canViewAccounting) return
    api.get<any>('/accounting/cost-centers').then((res) => {
      setCostCenters(Array.isArray(res) ? res : (res as any)?.data || [])
    }).catch(() => setCostCenters([]))
  }, [isManufacturing, canViewAccounting])

  const refresh = async () => {
    setRefreshing(true)
    await fetchAll()
    await queryClient.invalidateQueries({ queryKey: ['accounting'] })
    setRefreshing(false)
  }

  const flatAccounts = flattenAccounts(accounts);
  const activeAccounts = flatAccounts.filter((a) => String(a.type || '').toUpperCase() === 'ASSET');

  // Cuentas elegibles para vincular a un almacén: solo de Activo, activas y
  // que aceptan posteos. El backend rechaza (400) cualquier otra cuenta, por
  // lo que la lista solo ofrece combinaciones válidas.
  const linkableAccounts = useMemo(
    () => activeAccounts.filter((a: any) => a.isActive !== false && a.acceptsPostings !== false),
    [activeAccounts],
  );
  const excludedAccountCount = activeAccounts.length - linkableAccounts.length;

  // Cuentas agrupadoras candidatas para la sucursal: Activo, activas, que NO
  // aceptan posteos directos y sin movimientos (se adopta una cuenta limpia).
  const branchGroupAccounts = useMemo(
    () => flatAccounts.filter((a: any) =>
      String(a.type || '').toUpperCase() === 'ASSET' &&
      a.isActive !== false &&
      a.acceptsPostings !== true &&
      ((a as any)._count?.transactions ?? 0) === 0,
    ),
    [flatAccounts],
  );

  // Cuenta agrupadora ya existente de una sucursal (INV_GROUP:<branchId>).
  const branchGroupFor = (branchId?: string) => {
    if (!branchId) return null
    return flatAccounts.find((a: any) => a.notes === `INV_GROUP:${branchId}`) || null
  }

  // La cuenta control puede llamarse "Inventario", "Inventario de
  // Mercancias", "Mercaderia", "Existencias", etc. Incluimos cuentas de
  // Activo relacionadas con inventario, sean agrupadoras o de detalle.
  const inventoryControlOptions = useMemo(() => {
    const opts = activeAccounts
      .filter((a: any) => {
        const normalizedName = String(a.name || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toLowerCase()
        return ['inventario', 'mercancia', 'mercaderia', 'existencia']
          .some((keyword) => normalizedName.includes(keyword))
      })
      .map((a: any) => ({ label: `${a.code} - ${a.name}`, value: a.code, description: a.code }));
    const current = flatAccounts.find((a: any) => a.code === controlAccountId);
    if (current && !opts.some((o) => o.value === current.code)) {
      opts.unshift({ label: `${current.code} - ${current.name}`, value: current.code, description: current.code });
    }
    return opts;
  }, [activeAccounts, flatAccounts, controlAccountId]);

  const saveControlAccount = async () => {
    setConfigLoading(true)
    try {
      await contabilidadService.updateConfig({
        // Este formulario solo modifica la cuenta control. El backend usa el
        // parche para validar este campo sin volver a bloquear el guardado por
        // una cuenta histórica inválida de otro módulo (por ejemplo,
        // supplierInvoice.inventory).
        accountMappings: { inventory: { control: controlAccountId } },
        accountMappingPatch: {
          moduleId: 'inventory',
          fieldKey: 'control',
          value: controlAccountId,
        },
        inventory: { requiresAccountPerWarehouse: requiresPerWarehouse },
      })
      await queryClient.invalidateQueries({ queryKey: ['accounting'] })
      toast.success('Configuración contable guardada')
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al guardar configuración'))
    } finally {
      setConfigLoading(false)
    }
  }

  // Estado y cuenta contable de la bodega. Ya no existe una cuenta por vínculo
  // bodega-sucursal; la cuenta vive directamente en Warehouse.
  const linkInfo = (wh: any, _branchId?: string) => {
    const link = null
    const account = wh?.inventoryAccount ?? null
    // El backend entrega el estado calculado; si falta (datos antiguos), se
    // deriva de la cuenta: sin cuenta -> pendiente; con cuenta -> vinculado.
    const status = link?.accountingStatus ?? wh?.accountingStatus ?? accountStatusFromAccount(account)
    return {
      link,
      status,
      account,
      accountId: wh?.inventoryAccountId ?? null,
    }
  }

  const openConfig = (wh: any, branch?: any) => {
    const info = linkInfo(wh)
    setConfigTarget(wh)
    setConfigBranch(null)
    setConfigMode(info.accountId ? 'existing' : 'auto')
    setExistingAccountId(info.accountId || '')
    setBranchAccountId('')
  }

  const branchForWarehouse = useCallback((warehouse: any) => branches.find((branch: any) =>
    branch.id === warehouse.clientTenantId ||
    branch.warehouseId === warehouse.id ||
    (Array.isArray(branch.warehouses) && branch.warehouses.some((linked: any) => linked.id === warehouse.id)),
  ) || (Array.isArray(warehouse.branches) ? warehouse.branches.map((link: any) => branches.find((branch: any) => branch.id === link.id)).find(Boolean) : null), [branches])

  const buildHierarchyPreview = (wh: any, branchOverride?: any) => {
    const control = flatAccounts.find((a: any) => a.code === controlAccountId)
    const branch = branchOverride || branchForWarehouse(wh)
    const info = linkInfo(wh)
    const whAccount = info.accountId ? flatAccounts.find((a: any) => a.id === info.accountId) : undefined
    const levels = [
      { code: control?.code, name: control?.name || 'Inventario', exists: !!control, note: 'Cuenta control (consolida)' },
    ]
    if (branch) {
      const branchGroup = flatAccounts.find((a: any) => a.notes === `INV_GROUP:${branch.id}`)
      const branchLabel = String(branch.name || '').toLowerCase().startsWith('sucursal') ? branch.name : `Sucursal ${branch.name}`
      levels.push({
        code: branchGroup?.code,
        name: branchGroup?.name || `Inventario ${branchLabel}`,
        exists: !!branchGroup,
        note: 'Cuenta de sucursal (agrupa)',
      })
    }
    levels.push({
      code: whAccount?.code,
      name: whAccount?.name || `Inventario Bodega ${wh?.name || ''}`,
      exists: !!whAccount,
      note: 'Cuenta de la bodega (recibe movimientos)',
    })
    return levels
  }

  const runConfigure = async () => {
    if (!configTarget) return
    setConfigSaving(true)
    try {
      if (configMode === 'existing') {
        if (!existingAccountId) {
          toast.error('Selecciona una cuenta contable')
          return
        }
        await inventoryService.updateWarehouse(configTarget.id, { inventoryAccountId: existingAccountId })
        toast.success('Cuenta vinculada a la bodega. Revisa Contabilidad → Plan de Cuentas')
      } else {
        await inventoryService.autoCreateAccountingLink(configTarget.id)
        toast.success('Cuenta de la bodega creada y vinculada. Revisa Contabilidad → Plan de Cuentas')
      }
      setConfigTarget(null)
      setConfigBranch(null)
      await refresh()
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al configurar la bodega'))
    } finally {
      setConfigSaving(false)
    }
  }

  const runUnlink = async () => {
    if (!unlinkTarget) return
    setUnlinkSaving(true)
    try {
      await inventoryService.updateWarehouse(unlinkTarget.wh.id, { inventoryAccountId: null })
      toast.success('Cuenta contable desvinculada de la bodega')
      setUnlinkTarget(null)
      await refresh()
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al desvincular la cuenta contable'))
      throw e
    } finally {
      setUnlinkSaving(false)
    }
  }

  const statusCounts = warehouses.reduce<Record<string, number>>((acc, w) => {
    const key = w.accountingStatus || 'PENDIENTE'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const linkedCount = statusCounts.VINCULADO || 0
  const pendingCount = statusCounts.PENDIENTE || 0
  const errorCount = (statusCounts.CUENTA_INACTIVA || 0) + (statusCounts.CUENTA_NO_POSTEABLE || 0)
  const progressPercent = warehouses.length === 0 ? 0 : Math.round((linkedCount / warehouses.length) * 100)

  const controlAccount = flatAccounts.find((a: any) => a.code === controlAccountId)
  const exampleWarehouse = warehouses.find((w: any) => w.accountingStatus === 'VINCULADO') || warehouses[0]
  const hierarchyPreview = exampleWarehouse ? buildHierarchyPreview(exampleWarehouse, branchForWarehouse(exampleWarehouse)) : null

  const branchGroups = useMemo(() => {
    const groups: { branch: any; warehouses: any[] }[] = []
    const upsert = (branch: any, wh: any) => {
      const existing = branch ? groups.find((g) => g.branch.id === branch.id) : null
      if (existing) existing.warehouses.push(wh)
      else groups.push({ branch: branch || { id: 'sin-sucursal', name: 'Sin sucursal' }, warehouses: [wh] })
    }
    for (const wh of warehouses) upsert(branchForWarehouse(wh), wh)
    return groups.sort((a, b) => a.branch.name.localeCompare(b.branch.name))
  }, [warehouses, branchForWarehouse])

  if (loading) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between" data-tour="config-header">
        <div className="min-w-0">
          <h3 className="flex items-start gap-2 text-base font-black uppercase leading-tight tracking-tight italic sm:text-lg">
            <Settings2 className="size-5 text-primary" /> Configuración contable de Inventario
          </h3>
          <p className="mt-1 text-[10px] font-bold uppercase leading-relaxed tracking-widest text-muted-foreground">
            Conecta sucursales y bodegas con el Plan de Cuentas para registrar los movimientos en Contabilidad
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setShowTutorial(true)}>
            <CircleHelp className="mr-1 size-3.5" /> Cómo configurar inventario
          </Button>
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={cn('mr-1 size-3.5', refreshing && 'animate-spin')} /> Actualizar
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto w-full max-w-full flex-nowrap justify-start gap-1.5 overflow-x-auto rounded-2xl border border-border/40 bg-muted/40 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger className="!flex-none !whitespace-nowrap px-3 py-2 text-xs sm:text-sm" value="general" data-tour="config-tab-general"><Building2 className="size-4 mr-1.5" /> General</TabsTrigger>
          <TabsTrigger className="!flex-none !whitespace-nowrap px-3 py-2 text-xs sm:text-sm" value="almacenes" data-tour="config-tab-almacenes"><Link2 className="size-4 mr-1.5" /> Bodegas</TabsTrigger>
          <TabsTrigger className="!flex-none !whitespace-nowrap px-3 py-2 text-xs sm:text-sm" value="contable" data-tour="config-tab-contable"><Settings2 className="size-4 mr-1.5" /> Configuración Contable</TabsTrigger>
          <TabsTrigger className="!flex-none !whitespace-nowrap px-3 py-2 text-xs sm:text-sm" value="estado" data-tour="config-tab-estado"><Activity className="size-4 mr-1.5" /> Estado de Vinculación</TabsTrigger>
          {isManufacturing && <TabsTrigger className="!flex-none !whitespace-nowrap px-3 py-2 text-xs sm:text-sm" value="costos"><Factory className="size-4 mr-1.5" /> Centros de Costos</TabsTrigger>}
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="m-0 mt-4">
          <div className="grid gap-4 lg:grid-cols-5">
            {/* Columna izquierda: formulario de cuenta control */}
            <Card className="p-5 lg:col-span-2">
              <div className="mb-4">
                <h4 className="font-bold">Cuenta control de Inventario</h4>
                <p className="text-xs text-muted-foreground">
                  Es el ancla de la rama contable de inventario. Los movimientos se registran en las cuentas de cada bodega
                  (nivel más bajo) y se consolidan automáticamente aquí en el Plan de Cuentas:
                  <span className="mt-1 block font-mono text-[10px] text-primary/80">
                    Cuenta control → Cuenta de sucursal (agrupa) → Cuenta de bodega (recibe movimientos)
                  </span>
                </p>
              </div>
              <div className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label>Cuenta contable (Activo)</Label>
                  <Combobox
                    options={inventoryControlOptions}
                    value={controlAccountId}
                    onChange={setControlAccountId}
                    placeholder="Selecciona la cuenta control de Inventario"
                    searchPlaceholder="Buscar por código o nombre..."
                    emptyMessage="No hay cuentas de inventario en el Plan de Cuentas."
                  />
                  {controlAccount && (
                    <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <CheckCircle2 className="size-3 text-emerald-500" />
                      {controlAccount.code} - {controlAccount.name} · {controlAccount.isActive === false ? 'cuenta inactiva' : controlAccount.acceptsPostings === false ? 'cuenta agrupadora (consolida)' : 'cuenta de detalle'}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
                  <div>
                    <p className="text-sm font-semibold">Exigir cuenta por bodega</p>
                    <p className="text-xs text-muted-foreground">Al activarlo, los movimientos de una bodega sin cuenta vinculada serán bloqueados y aparecerá como pendiente en las tablas de vinculación.</p>
                  </div>
                  <Switch checked={requiresPerWarehouse} onCheckedChange={setRequiresPerWarehouse} />
                </div>
                <Button onClick={saveControlAccount} disabled={configLoading}>
                  {configLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />} Guardar
                </Button>
              </div>
            </Card>

            {/* Columna derecha: estado, jerarquía y ramas */}
            <div className="space-y-4 lg:col-span-3">
              {/* Estado de vinculación */}
              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="flex items-center gap-2 font-bold"><Activity className="size-4 text-primary" /> Estado de vinculación</h4>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{linkedCount} de {warehouses.length} bodegas vinculadas</span>
                </div>
                <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-border/40 p-3">
                    <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground"><Building2 className="size-3" /> Sucursales</p>
                    <p className="mt-1 text-2xl font-black">{branches.length}</p>
                  </div>
                  <div className="rounded-xl border border-border/40 p-3">
                    <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground"><Warehouse className="size-3" /> Bodegas</p>
                    <p className="mt-1 text-2xl font-black">{warehouses.length}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-600"><CheckCircle2 className="size-3" /> Vinculados</p>
                    <p className="mt-1 text-2xl font-black text-emerald-600">{linkedCount}</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-amber-600"><AlertTriangle className="size-3" /> Pendientes / errores</p>
                    <p className="mt-1 text-2xl font-black text-amber-600">{pendingCount + errorCount}</p>
                  </div>
                </div>
              </Card>

              {/* Jerarquía de ejemplo */}
              {hierarchyPreview && (
                <Card className="p-5">
                  <h4 className="mb-1 flex items-center gap-2 font-bold"><GitBranch className="size-4 text-primary" /> Así se ve en el Plan de Cuentas</h4>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Ejemplo con la bodega <span className="font-semibold text-foreground">{exampleWarehouse?.name}</span>{exampleWarehouse && exampleWarehouse.primaryBranch ? ` (sucursal ${exampleWarehouse.primaryBranch.name})` : ''}:
                  </p>
                  <div className="space-y-0">
                    {hierarchyPreview.map((level, i) => (
                      <div key={i} className="relative flex items-center gap-3">
                        {i < hierarchyPreview.length - 1 && <span className="absolute left-[7px] top-7 h-5 w-px bg-border" />}
                        <span className={cn('z-10 size-[15px] shrink-0 rounded-full border-2', level.exists ? 'border-emerald-500 bg-emerald-500/20' : 'border-primary bg-primary/20')} />
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate font-mono text-[11px] font-bold">{level.code ? `${level.code} · ${level.name}` : level.name}</p>
                            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{level.note}</p>
                          </div>
                          {level.exists
                            ? <Badge variant="outline" className="shrink-0 bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest text-emerald-600">Existente</Badge>
                            : <Badge variant="outline" className="shrink-0 bg-primary/10 text-[9px] font-black uppercase tracking-widest text-primary">Se creará</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Ramas por sucursal */}
              <Card className="p-5">
                <h4 className="mb-3 flex items-center gap-2 font-bold"><Link2 className="size-4 text-primary" /> Ramas por sucursal</h4>
                {branchGroups.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Aún no hay bodegas. Créala desde la pestaña <span className="font-semibold">Bodegas</span> y luego vincúlala en <span className="font-semibold">Configuración Contable</span>.
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {branchGroups.map(({ branch, warehouses: whs }) => (
                      <div key={branch.id} className="rounded-xl border border-border/40 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-bold">
                            <Building2 className="size-3.5 shrink-0 text-muted-foreground" /> {branch.name}
                          </p>
                          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-muted-foreground">{whs.length} bodega{whs.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="space-y-1.5">
                          {whs.map((wh: any) => (
                            <div key={wh.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/30 px-2.5 py-1.5">
                              <p className="min-w-0 truncate text-xs font-medium">{wh.name}</p>
                              <StatusBadge status={linkInfo(wh, branch.id).status} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Bodegas */}
        <TabsContent value="almacenes" className="m-0 mt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Crea y administra tus bodegas. Cada bodega creada aquí podrá vincularse a una cuenta contable desde la pestaña <span className="font-semibold text-foreground">Configuración Contable</span>.
          </p>
          <Card className="p-4">
            <AlmacenesView warehouses={warehouses} onRefresh={refresh} />
          </Card>
        </TabsContent>

        {/* Configuración Contable */}
        <TabsContent value="contable" className="m-0 mt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Cada bodega necesita una cuenta contable de inventario para registrar sus movimientos. Usa <span className="font-semibold text-foreground">Configurar</span> para crearla automáticamente (sucursal + bodega) o vincular una existente. Las cuentas quedan visibles en <span className="font-mono text-[10px]">Contabilidad → Plan de Cuentas</span>.
          </p>
          <Card className="p-3 sm:p-4">
            <div className="space-y-3 lg:hidden">
              {branchGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No hay bodegas. Crea una desde la pestaña <span className="font-semibold text-foreground">Bodegas</span> para poder configurar su cuenta contable.
                </div>
              ) : branchGroups.map(({ branch, warehouses: groupWarehouses }) => {
                const isCollapsed = collapsedBranches.has(branch.id)
                const linkedInGroup = groupWarehouses.filter((w: any) => linkInfo(w, branch.id).status === 'VINCULADO').length
                return (
                  <div key={branch.id} className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 bg-muted/40 px-3 py-3 text-left transition-colors hover:bg-muted/60"
                      onClick={() => toggleBranchCollapse(branch.id)}
                      aria-expanded={!isCollapsed}
                    >
                      {isCollapsed
                        ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
                      <Building2 className="size-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{branch.name}</span>
                      <span className="shrink-0 text-right text-[9px] font-black uppercase leading-tight tracking-widest text-muted-foreground">
                        {linkedInGroup}/{groupWarehouses.length} vinculadas
                      </span>
                    </button>

                    {!isCollapsed && (
                      <div className="space-y-2 p-2.5">
                        {groupWarehouses.map((wh: any) => {
                          const whLinks = Array.isArray(wh.branches) ? wh.branches : []
                          const isPrimaryInGroup = whLinks.some((b: any) => b.id === branch.id && b.isPrimary)
                          const isShared = whLinks.length > 1
                          const info = linkInfo(wh, branch.id)
                          const actionLabel = info.status === 'VINCULADO'
                            ? 'Editar'
                            : info.status === 'CUENTA_INACTIVA' || info.status === 'CUENTA_NO_POSTEABLE'
                              ? 'Corregir'
                              : 'Configurar'
                          return (
                            <div key={wh.id} className="rounded-xl border border-border/50 bg-muted/15 p-3">
                              <div className="flex min-w-0 items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="break-words text-sm font-semibold">{wh.name}</p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {isPrimaryInGroup && <Badge variant="outline" className="bg-primary/10 text-[9px] font-black uppercase tracking-widest text-primary">Principal</Badge>}
                                    {!isPrimaryInGroup && isShared && <Badge variant="outline" className="bg-amber-500/10 text-[9px] font-black uppercase tracking-widest text-amber-600">Compartido</Badge>}
                                  </div>
                                </div>
                                <StatusBadge status={info.status} />
                              </div>
                              <div className="mt-3 border-t border-border/40 pt-2">
                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cuenta contable</p>
                                <p className="mt-1 break-words font-mono text-[11px] text-foreground">
                                  {info.account ? `${info.account.code} - ${info.account.name}` : 'Sin cuenta configurada'}
                                </p>
                              </div>
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 w-full gap-1 text-[10px] font-black uppercase tracking-widest"
                                  onClick={() => openConfig(wh, branch)}
                                >
                                  <Settings2 className="size-3.5" /> {actionLabel}
                                </Button>
                                {info.status === 'VINCULADO' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 w-full gap-1 border-red-500/20 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-500/10 hover:text-red-600"
                                    onClick={() => setUnlinkTarget({ wh, branch })}
                                  >
                                    <Unlink className="size-3.5" /> Desvincular
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto lg:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Sucursal</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Bodega</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Cuenta Contable</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branchGroups.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No hay bodegas. Crea una desde la pestaña <span className="font-semibold">Bodegas</span> para poder configurar su cuenta contable.</TableCell></TableRow>
                ) : branchGroups.map(({ branch, warehouses: groupWarehouses }) => {
                  const isCollapsed = collapsedBranches.has(branch.id)
                  const linkedInGroup = groupWarehouses.filter((w: any) => linkInfo(w, branch.id).status === 'VINCULADO').length
                  return (
                    <Fragment key={branch.id}>
                      <TableRow
                        className="cursor-pointer bg-muted/40 hover:bg-muted/60"
                        onClick={() => toggleBranchCollapse(branch.id)}
                        title={isCollapsed ? 'Expandir sucursal' : 'Colapsar sucursal'}
                      >
                        <TableCell colSpan={5} className="py-2.5">
                          <div className="flex items-center gap-2">
                            {isCollapsed
                              ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                              : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
                            <Building2 className="size-4 shrink-0 text-primary" />
                            <span className="truncate text-sm font-bold">{branch.name}</span>
                            <span className="ml-auto shrink-0 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                              {linkedInGroup} de {groupWarehouses.length} vinculado{groupWarehouses.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>

                      {!isCollapsed && groupWarehouses.map((wh: any) => {
                        const whLinks = Array.isArray(wh.branches) ? wh.branches : []
                        const isPrimaryInGroup = whLinks.some((b: any) => b.id === branch.id && b.isPrimary)
                        const isShared = whLinks.length > 1
                        const info = linkInfo(wh, branch.id)
                        return (
                        <TableRow key={wh.id}>
                          <TableCell className="pl-10 text-sm text-muted-foreground/50">
                            <span className="font-mono text-[10px]">└─</span>
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate">{wh.name}</span>
                              {isPrimaryInGroup ? (
                              <Badge variant="outline" className="shrink-0 bg-primary/10 text-[9px] font-black uppercase tracking-widest text-primary" title="Esta bodega es la principal de esta sucursal">Principal</Badge>
                              ) : isShared ? (
                              <Badge variant="outline" className="shrink-0 bg-amber-500/10 text-[9px] font-black uppercase tracking-widest text-amber-600" title="Esta bodega también pertenece a otra sucursal. Puede tener su propia cuenta en cada sucursal.">Compartido</Badge>
                              ) : null}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {info.account ? `${info.account.code} - ${info.account.name}` : 'Sin cuenta'}
                          </TableCell>
                          <TableCell><StatusBadge status={info.status} /></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button variant="outline" size="sm" className="h-8 gap-1 text-[10px] font-black uppercase tracking-widest" onClick={() => openConfig(wh, branch)} title={`${info.status === 'VINCULADO' ? 'Editar' : 'Configurar'} la cuenta contable de la bodega ${wh.name} en ${branch.name}`}>
                                <Settings2 className="size-3.5" /> {info.status === 'VINCULADO' ? 'Editar' : info.status === 'CUENTA_INACTIVA' || info.status === 'CUENTA_NO_POSTEABLE' ? 'Corregir' : 'Configurar'}
                              </Button>
                              {info.status === 'VINCULADO' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1 border-red-500/20 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-500/10 hover:text-red-600"
                                  onClick={() => setUnlinkTarget({ wh, branch })}
                                  title={`Desvincular la cuenta contable de la bodega ${wh.name} en ${branch.name}`}
                                >
                                  <Unlink className="size-3.5" /> Desvincular
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )})}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Estado de Vinculación */}
        <TabsContent value="estado" className="m-0 mt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Resumen del vínculo entre bodegas y sus cuentas contables. Pasa el cursor sobre cada estado para ver su significado.
          </p>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Card className="p-4"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Sucursales</p><p className="text-2xl font-black">{branches.length}</p></Card>
            <Card className="p-4"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Bodegas</p><p className="text-2xl font-black">{warehouses.length}</p></Card>
            <Card className="p-4"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Vinculados</p><p className="text-2xl font-black text-emerald-600">{statusCounts.VINCULADO || 0}</p></Card>
            <Card className="p-4"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Pendientes</p><p className="text-2xl font-black text-amber-600">{statusCounts.PENDIENTE || 0}</p></Card>
            <Card className="p-4"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Con errores</p><p className="text-2xl font-black text-red-600">{(statusCounts.CUENTA_INACTIVA || 0) + (statusCounts.CUENTA_NO_POSTEABLE || 0)}</p></Card>
          </div>
          <Card className="p-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Sucursal</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Bodega</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Cuenta</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((wh: any) => (
                  <TableRow key={wh.id}>
                    <TableCell className="text-sm">
                      {Array.isArray(wh.branches) && wh.branches.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {wh.branches.map((b: any) => {
                            const linkStatus = b.accountingStatus || 'PENDIENTE'
                            return (
                              <Badge
                                key={b.id}
                                variant="outline"
                                className={cn('text-[9px] font-black uppercase tracking-widest', linkStatus === 'VINCULADO' ? 'bg-emerald-500/10 text-emerald-600' : linkStatus === 'PENDIENTE' ? (b.isPrimary ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground') : 'bg-red-500/10 text-red-600')}
                                title={`${b.isPrimary ? 'Sucursal principal' : 'Sucursal adicional'} · ${linkStatus === 'VINCULADO' ? 'cuenta vinculada' : linkStatus === 'PENDIENTE' ? 'sin cuenta vinculada' : 'cuenta con error'}`}
                              >
                                {b.name}
                              </Badge>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin sucursal</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{wh.name}</TableCell>
                    <TableCell className="text-xs font-mono">{wh.inventoryAccount?.code || '—'}</TableCell>
                    <TableCell><StatusBadge status={wh.accountingStatus} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Centros de Costos */}
        {isManufacturing && (
          <TabsContent value="costos" className="m-0 mt-4">
            <CostCentersView costCenters={costCenters} onChange={setCostCenters} />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog de configuración */}
      <Dialog open={!!configTarget} onOpenChange={(open) => { if (!open) { setConfigTarget(null); setConfigBranch(null); } }}>
        <DialogContent className="!w-[calc(100vw-2rem)] !max-w-[min(94vw,720px)] max-h-[min(88vh,calc(100dvh-3rem))] overflow-y-auto rounded-3xl p-5 sm:p-6">
          <DialogHeader data-tour="inventory-config-modal-title">
            <DialogTitle className="flex items-center gap-2"><Settings2 className="size-5 text-primary" /> Configurar {configTarget?.name}</DialogTitle>
            <DialogDescription>
              Vincula esta bodega con su cuenta contable de inventario{configBranch ? <> en la sucursal <span className="font-semibold text-foreground">{configBranch.name}</span></> : null}. Elige la cuenta agrupadora de la sucursal y la cuenta posteable de la bodega; si faltan, el sistema las crea automáticamente. Las cuentas quedan visibles en <span className="font-mono text-[10px]">Contabilidad → Plan de Cuentas</span>.
            </DialogDescription>
            <InventoryViewTutorial label="Cómo vincular bodega a contabilidad" targetPrefix="inventory-config-modal" copy={{ data: { description: 'Elige crear la cuenta automáticamente o vincular una cuenta de Activo existente.' }, actions: { description: 'Confirma para guardar la configuración contable de la bodega.' } }} />
          </DialogHeader>
          <div className="space-y-4 py-2" data-tour="inventory-config-modal-data">
            <div className="space-y-2">
              <Button
                variant={configMode === 'auto' ? 'default' : 'outline'}
                className={cn('flex h-auto w-full items-center gap-3 px-3 py-3 text-left', configMode !== 'auto' && 'bg-transparent')}
                onClick={() => setConfigMode('auto')}
              >
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', configMode === 'auto' ? 'bg-primary/15' : 'bg-muted')}>
                  <Sparkles className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black uppercase tracking-widest leading-tight">Crear automáticamente</span>
                  <span className="mt-0.5 block text-[10px] font-normal normal-case leading-snug opacity-80">Crea cuenta de sucursal + bodega si faltan</span>
                </span>
              </Button>
              <Button
                variant={configMode === 'existing' ? 'default' : 'outline'}
                className={cn('flex h-auto w-full items-center gap-3 px-3 py-3 text-left', configMode !== 'existing' && 'bg-transparent')}
                onClick={() => setConfigMode('existing')}
              >
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', configMode === 'existing' ? 'bg-primary/15' : 'bg-muted')}>
                  <Link2 className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black uppercase tracking-widest leading-tight">Vincular existente</span>
                  <span className="mt-0.5 block text-[10px] font-normal normal-case leading-snug opacity-80">Elige la cuenta de sucursal y la de la bodega</span>
                </span>
              </Button>
            </div>

            {configMode === 'auto' && configTarget && (
              <div className="rounded-xl border border-border/40 bg-muted/30 p-3">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Jerarquía resultante</p>
                <div className="space-y-1.5">
                  {buildHierarchyPreview(configTarget, configBranch).map((level, i) => (
                    <div key={i} className={cn('flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-card px-2.5 py-1.5', i === 2 && 'border-primary/30')}>
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[10px] font-bold">{level.code ? `${level.code} - ${level.name}` : level.name}</p>
                        <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{level.note}</p>
                      </div>
                      {level.exists
                        ? <Badge variant="outline" className="shrink-0 text-[9px] font-black uppercase tracking-widest text-emerald-600">Existente</Badge>
                        : <Badge variant="outline" className="shrink-0 text-[9px] font-black uppercase tracking-widest text-primary">Se creará</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {configMode === 'existing' && (
              <div className="space-y-4">
                {/* Cuenta agrupadora de la sucursal */}
                <div className="space-y-2">
                  <Label>Cuenta de sucursal (agrupadora)</Label>
                  {(() => {
                    const existingGroup = branchGroupFor(configBranch?.id)
                    const options = [
                      ...(existingGroup ? [{ label: `${existingGroup.code} - ${existingGroup.name} (existente)`, value: existingGroup.id, description: existingGroup.code }] : []),
                      ...branchGroupAccounts
                        .filter((a: any) => a.id !== existingGroup?.id && !String(a.notes || '').startsWith('INV_GROUP:'))
                        .map((a: any) => ({ label: `${a.code} - ${a.name}`, value: a.id, description: a.code })),
                    ]
                    if (options.length === 0) {
                      return (
                        <div className="flex items-start gap-2 rounded-xl border border-border/40 bg-muted/30 p-3">
                          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                          <p className="text-[11px] leading-snug text-muted-foreground">
                            No hay cuentas agrupadoras disponibles. Se creará automáticamente bajo la cuenta control de Inventario.
                          </p>
                        </div>
                      )
                    }
                    return (
                      <Combobox
                        options={options}
                        value={branchAccountId}
                        onChange={setBranchAccountId}
                        placeholder="Selecciona la agrupadora de la sucursal..."
                        searchPlaceholder="Buscar por código o nombre..."
                        emptyMessage="No se encontraron cuentas agrupadoras."
                      />
                    )
                  })()}
                  {branchGroupFor(configBranch?.id) && branchAccountId === branchGroupFor(configBranch?.id)?.id ? (
                    <p className="flex items-center gap-1.5 text-[10px] text-emerald-600">
                      <CheckCircle2 className="size-3" /> Esta sucursal ya tiene cuenta agrupadora y se reutilizará.
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">
                      Agrupadora no posteable bajo la cuenta control. Si no seleccionas una, el sistema la crea o reutiliza automáticamente.
                    </p>
                  )}
                </div>

                {/* Cuenta de la bodega (posteo) */}
                <div className="space-y-2">
                  <Label>Cuenta de la bodega (recibe movimientos)</Label>
                  {linkableAccounts.length === 0 ? (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                      <p className="text-[11px] leading-snug text-amber-700">
                        No hay cuentas de Activo activas que acepten posteos. Crea una desde <span className="font-semibold">Contabilidad → Plan de Cuentas</span> o usa <span className="font-semibold">Crear automáticamente</span>.
                      </p>
                    </div>
                  ) : (
                    <Combobox
                      options={linkableAccounts.map((a) => ({ label: `${a.code} - ${a.name}`, value: a.id, description: a.code }))}
                      value={existingAccountId}
                      onChange={setExistingAccountId}
                      placeholder="Buscar cuenta de Activo..."
                      searchPlaceholder="Buscar por código o nombre..."
                      emptyMessage="No se encontraron cuentas elegibles."
                    />
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Solo se muestran cuentas de Activo activas que aceptan movimientos (posteables), que son las que el sistema puede vincular.{excludedAccountCount > 0 ? ` Hay ${excludedAccountCount} cuenta${excludedAccountCount !== 1 ? 's' : ''} de Activo inactiva${excludedAccountCount !== 1 ? 's' : ''} o sin posteos que no se incluye${excludedAccountCount !== 1 ? 'n' : ''}.` : ''}
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter data-tour="inventory-config-modal-actions">
            <Button variant="outline" onClick={() => setConfigTarget(null)}>Cancelar</Button>
            <Button
              onClick={runConfigure}
              disabled={configSaving || (configMode === 'existing' && (!existingAccountId || linkableAccounts.length === 0))}
            >
              {configSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} {configMode === 'auto' ? 'Crear y vincular' : 'Vincular'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!unlinkTarget}
        onOpenChange={(open) => { if (!open && !unlinkSaving) setUnlinkTarget(null) }}
        title="¿Desvincular cuenta contable?"
        description={(() => {
          if (!unlinkTarget) return ''
          const info = linkInfo(unlinkTarget.wh, unlinkTarget.branch?.id)
          return `Se quitará la cuenta ${info.account ? `${info.account.code} - ${info.account.name}` : 'vinculada'} de la bodega "${unlinkTarget.wh.name}"${unlinkTarget.branch ? ` en la sucursal ${unlinkTarget.branch.name}` : ''}. La bodega pasará a estado Pendiente y podrás configurar otra cuenta cuando lo necesites.`
        })()}
        confirmLabel="Desvincular"
        variant="destructive"
        loading={unlinkSaving}
        onConfirm={runUnlink}
      />

      {showTutorial && <GuidedTour steps={CONFIG_INVENTORY_TOUR_STEPS} onClose={() => setShowTutorial(false)} title="Configuración de Inventario" allowTargetInteraction />}
    </div>
  )
}

function CostCentersView({ costCenters, onChange }: { costCenters: any[]; onChange: (centers: any[]) => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const addCenter = async () => {
    if (!code.trim() || !name.trim()) {
      toast.error('Código y nombre son obligatorios')
      return
    }
    setSaving(true)
    try {
      await api.post('/accounting/cost-centers', { code: code.trim(), name: name.trim() })
      const res = await api.get<any>('/accounting/cost-centers')
      onChange(Array.isArray(res) ? res : (res as any)?.data || [])
      setCode(''); setName('')
      toast.success('Centro de costo creado')
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al crear centro de costo'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-[10px]">Código</Label>
          <Input className="h-9 w-40" placeholder="CC-MP" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Nombre</Label>
          <Input className="h-9 w-56" placeholder="Materia Prima" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button onClick={addCenter} disabled={saving} className="h-9 gap-1">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Agregar
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-[10px] font-black uppercase tracking-widest">Código</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest">Nombre</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {costCenters.map((c: any) => (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-xs">{c.code}</TableCell>
              <TableCell className="text-sm">{c.name}</TableCell>
              <TableCell>
                <Badge variant={c.isActive ? 'default' : 'secondary'} className={c.isActive ? 'bg-emerald-500/10 text-emerald-600' : ''}>
                  {c.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          {costCenters.length === 0 && (
            <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Sin centros de costo</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  )
}
