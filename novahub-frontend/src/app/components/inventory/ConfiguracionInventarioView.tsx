"use client"

import { useState, useEffect, useCallback } from 'react'
import {
  Settings2, Building2, Link2, Activity, Factory, RefreshCw,
  Loader2, Sparkles, Plus,
} from 'lucide-react'
import { Card } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Combobox } from '../ui/Combobox'
import { Switch } from '../ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { inventoryService } from '../../services/inventario.service'
import { contabilidadService } from '../../services/contabilidad.service'
import { tenantsService } from '../../services/tenants.service'
import { api, getApiErrorMessage } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { AlmacenesView } from './AlmacenesView'
import { cn } from '../ui/utils'

type AccountInfo = {
  id: string
  code: string
  name: string
  type?: string
  isActive?: boolean
  acceptsPostings?: boolean
}

const STATUS_META: Record<string, { label: string; tone: 'success' | 'warn' | 'danger' | 'muted' }> = {
  VINCULADO: { label: 'Vinculado', tone: 'success' },
  PENDIENTE: { label: 'Pendiente', tone: 'warn' },
  CUENTA_INACTIVA: { label: 'Cuenta inactiva', tone: 'danger' },
  CUENTA_NO_POSTEABLE: { label: 'No posteable', tone: 'danger' },
}

function StatusBadge({ status }: { status?: string }) {
  const meta = STATUS_META[status || 'PENDIENTE'] || STATUS_META.PENDIENTE
  const toneClass = {
    success: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    warn: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    danger: 'bg-red-500/10 text-red-600 border-red-500/20',
    muted: 'bg-muted/50 text-muted-foreground border-border/40',
  }[meta.tone]
  return <Badge variant="outline" className={cn('gap-1 text-[9px] font-black uppercase tracking-widest', toneClass)}>{meta.label}</Badge>
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

interface ConfiguracionInventarioViewProps {
  isSidebarCollapsed?: boolean
}

export function ConfiguracionInventarioView(_props: ConfiguracionInventarioViewProps) {
  const { user } = useAuth()
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

  // Configurar dialog
  const [configTarget, setConfigTarget] = useState<any | null>(null)
  const [configMode, setConfigMode] = useState<'auto' | 'existing'>('auto')
  const [existingAccountId, setExistingAccountId] = useState('')
  const [configSaving, setConfigSaving] = useState(false)

  const isManufacturing = tenantIndustry === 'MANUFACTURING'

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      const [whRes, brRes, accRes, cfgRes] = await Promise.all([
        inventoryService.getWarehouses(),
        api.get<any>('/sucursales'),
        contabilidadService.getChartOfAccounts(false),
        contabilidadService.getConfig(),
      ])
      setWarehouses(Array.isArray(whRes) ? whRes : [])
      setBranches(Array.isArray(brRes) ? brRes : (brRes as any)?.data || [])
      setAccounts(Array.isArray(accRes) ? accRes : (accRes as any)?.data || accRes || [])

      const cfg = (cfgRes as any)?.config || cfgRes || {}
      setControlAccountId(cfg.accountMappings?.inventory?.control || '')
      setRequiresPerWarehouse(!!cfg.inventory?.requiresAccountPerWarehouse)

      if (user?.tenantId) {
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
  }, [user?.tenantId])

  useEffect(() => { void fetchAll() }, [fetchAll])

  useEffect(() => {
    if (!isManufacturing) return
    api.get<any>('/accounting/cost-centers').then((res) => {
      setCostCenters(Array.isArray(res) ? res : (res as any)?.data || [])
    }).catch(() => setCostCenters([]))
  }, [isManufacturing])

  const refresh = async () => {
    setRefreshing(true)
    await fetchAll()
    await queryClient.invalidateQueries({ queryKey: ['accounting'] })
    setRefreshing(false)
  }

  const flatAccounts = flattenAccounts(accounts);
  const activeAccounts = flatAccounts.filter((a) => String(a.type || '').toUpperCase() === 'ASSET');

  const saveControlAccount = async () => {
    setConfigLoading(true)
    try {
      const cfg = await contabilidadService.getConfig()
      const config = cfg?.config || cfg || {}
      const accountMappings = {
        ...(config.accountMappings || {}),
        inventory: { ...(config.accountMappings?.inventory || {}), control: controlAccountId },
      }
      await api.put('/accounting/config', {
        accountMappings,
        inventory: { ...(config.inventory || {}), requiresAccountPerWarehouse: requiresPerWarehouse },
      })
      await queryClient.invalidateQueries({ queryKey: ['accounting'] })
      toast.success('Configuración contable guardada')
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al guardar configuración'))
    } finally {
      setConfigLoading(false)
    }
  }

  const openConfig = (wh: any) => {
    setConfigTarget(wh)
    setConfigMode('auto')
    setExistingAccountId(wh.inventoryAccountId || '')
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
        await inventoryService.updateWarehouse(configTarget.id, { inventoryAccountId: existingAccountId } as any)
        toast.success('Cuenta vinculada al almacén')
      } else {
        await inventoryService.autoCreateAccountingLink(configTarget.id)
        toast.success('Cuenta de inventario creada y vinculada')
      }
      setConfigTarget(null)
      await refresh()
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al configurar el almacén'))
    } finally {
      setConfigSaving(false)
    }
  }

  const statusCounts = warehouses.reduce<Record<string, number>>((acc, w) => {
    const key = w.accountingStatus || 'PENDIENTE'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-black uppercase tracking-tight italic">
            <Settings2 className="size-5 text-primary" /> Configuración de Inventario
          </h3>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Vincula sucursales, almacenes y cuentas contables de inventario
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={cn('mr-1 size-3.5', refreshing && 'animate-spin')} /> Actualizar
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto w-full flex-wrap gap-1.5 rounded-2xl border border-border/40 bg-muted/40 p-1.5">
          <TabsTrigger value="general"><Building2 className="size-4 mr-1.5" /> General</TabsTrigger>
          <TabsTrigger value="almacenes"><Link2 className="size-4 mr-1.5" /> Sucursales y Almacenes</TabsTrigger>
          <TabsTrigger value="contable"><Settings2 className="size-4 mr-1.5" /> Configuración Contable</TabsTrigger>
          <TabsTrigger value="estado"><Activity className="size-4 mr-1.5" /> Estado de Vinculación</TabsTrigger>
          {isManufacturing && <TabsTrigger value="costos"><Factory className="size-4 mr-1.5" /> Centros de Costos</TabsTrigger>}
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="m-0 mt-4">
          <Card className="p-5">
            <div className="mb-4">
              <h4 className="font-bold">Cuenta control de Inventario</h4>
              <p className="text-xs text-muted-foreground">
                La cuenta que consolida el inventario de todas las sucursales. Los movimientos se registran en las cuentas de cada almacén y aquí se agregan automáticamente.
              </p>
            </div>
            <div className="max-w-md space-y-4">
              <div className="space-y-2">
                <Label>Cuenta contable (Activo)</Label>
                <Combobox
                  options={activeAccounts.map((a) => ({ label: `${a.code} - ${a.name}`, value: a.code, description: a.code }))}
                  value={controlAccountId}
                  onChange={setControlAccountId}
                  placeholder="Selecciona la cuenta control de Inventario"
                  searchPlaceholder="Buscar por código o nombre..."
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
                <div>
                  <p className="text-sm font-semibold">Exigir cuenta por almacén</p>
                  <p className="text-xs text-muted-foreground">Bloquea movimientos de almacenes sin cuenta de inventario vinculada.</p>
                </div>
                <Switch checked={requiresPerWarehouse} onCheckedChange={setRequiresPerWarehouse} />
              </div>
              <Button onClick={saveControlAccount} disabled={configLoading}>
                {configLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />} Guardar
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Sucursales y Almacenes */}
        <TabsContent value="almacenes" className="m-0 mt-4">
          <Card className="p-4">
            <AlmacenesView warehouses={warehouses} onRefresh={refresh} />
          </Card>
        </TabsContent>

        {/* Configuración Contable */}
        <TabsContent value="contable" className="m-0 mt-4">
          <Card className="p-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Sucursal</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Almacén</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Cuenta Contable</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((wh: any) => {
                  const branch = wh.primaryBranch || wh.branches?.[0] || branches.find((b: any) => b.warehouses?.some((w: any) => w.id === wh.id)) || null
                  return (
                    <TableRow key={wh.id}>
                      <TableCell className="text-sm">{branch?.name || 'Sin sucursal'}</TableCell>
                      <TableCell className="text-sm font-medium">{wh.name}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {wh.inventoryAccount ? `${wh.inventoryAccount.code} - ${wh.inventoryAccount.name}` : 'Sin cuenta'}
                      </TableCell>
                      <TableCell><StatusBadge status={wh.accountingStatus} /></TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="h-8 gap-1 text-[10px] font-black uppercase tracking-widest" onClick={() => openConfig(wh)}>
                          <Settings2 className="size-3.5" /> Configurar
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {warehouses.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No hay almacenes</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Estado de Vinculación */}
        <TabsContent value="estado" className="m-0 mt-4">
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Card className="p-4"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Sucursales</p><p className="text-2xl font-black">{branches.length}</p></Card>
            <Card className="p-4"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Almacenes</p><p className="text-2xl font-black">{warehouses.length}</p></Card>
            <Card className="p-4"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Vinculados</p><p className="text-2xl font-black text-emerald-600">{statusCounts.VINCULADO || 0}</p></Card>
            <Card className="p-4"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Pendientes</p><p className="text-2xl font-black text-amber-600">{statusCounts.PENDIENTE || 0}</p></Card>
            <Card className="p-4"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Con errores</p><p className="text-2xl font-black text-red-600">{(statusCounts.CUENTA_INACTIVA || 0) + (statusCounts.CUENTA_NO_POSTEABLE || 0)}</p></Card>
          </div>
          <Card className="p-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Sucursal</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Almacén</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Cuenta</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((wh: any) => {
                  const branch = wh.primaryBranch || wh.branches?.[0] || branches.find((b: any) => b.warehouses?.some((w: any) => w.id === wh.id)) || null
                  return (
                    <TableRow key={wh.id}>
                      <TableCell className="text-sm">{branch?.name || 'Sin sucursal'}</TableCell>
                      <TableCell className="text-sm font-medium">{wh.name}</TableCell>
                      <TableCell className="text-xs font-mono">{wh.inventoryAccount?.code || '—'}</TableCell>
                      <TableCell><StatusBadge status={wh.accountingStatus} /></TableCell>
                    </TableRow>
                  )
                })}
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
      <Dialog open={!!configTarget} onOpenChange={(open) => !open && setConfigTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings2 className="size-5 text-primary" /> Configurar {configTarget?.name}</DialogTitle>
            <DialogDescription>Vincula una cuenta contable de inventario a este almacén.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={configMode === 'auto' ? 'default' : 'outline'}
                className={cn('h-auto flex-col items-start gap-1 py-3', configMode !== 'auto' && 'bg-transparent')}
                onClick={() => setConfigMode('auto')}
              >
                <Sparkles className="size-4" />
                <span className="text-xs font-black uppercase tracking-widest">Crear automáticamente</span>
                <span className="text-[10px] font-normal normal-case opacity-80">Genera cuenta de sucursal + almacén</span>
              </Button>
              <Button
                variant={configMode === 'existing' ? 'default' : 'outline'}
                className={cn('h-auto flex-col items-start gap-1 py-3', configMode !== 'existing' && 'bg-transparent')}
                onClick={() => setConfigMode('existing')}
              >
                <Link2 className="size-4" />
                <span className="text-xs font-black uppercase tracking-widest">Vincular existente</span>
                <span className="text-[10px] font-normal normal-case opacity-80">Usar una cuenta ya creada</span>
              </Button>
            </div>
            {configMode === 'existing' && (
              <div className="space-y-2">
                <Label>Cuenta contable</Label>
                <Combobox
                  options={activeAccounts.map((a) => ({ label: `${a.code} - ${a.name}`, value: a.id, description: a.code }))}
                  value={existingAccountId}
                  onChange={setExistingAccountId}
                  placeholder="Buscar cuenta de Activo..."
                  searchPlaceholder="Buscar por código o nombre..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigTarget(null)}>Cancelar</Button>
            <Button onClick={runConfigure} disabled={configSaving}>
              {configSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
