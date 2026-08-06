import { useState, useEffect } from 'react'
import { Building2, UserCog, Store, Plus, Trash2, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { toast } from 'sonner'
import { api } from '../../services/api'

interface TeamPanelProps {
  tenantId: string
  tenantName: string
}

const normalizeList = (res: any): any[] => {
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.data)) return res.data
  return []
}

const Block = ({ title, icon: Icon, count, children }: { title: string; icon: any; count: number; children: React.ReactNode }) => (
  <Card className="bg-card border-border/50">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
        <Icon className="size-4 text-primary" /> {title} ({count})
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {children}
    </CardContent>
  </Card>
)

const ItemRow = ({ name, extra, onDelete }: { name: string; extra?: React.ReactNode; onDelete: () => void }) => (
  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/20 text-xs">
    <span className="font-medium truncate">{name}</span>
    <div className="flex items-center gap-1 shrink-0">
      {extra}
      <button onClick={onDelete} className="text-rose-500 hover:bg-rose-500/10 p-1 rounded"><Trash2 className="size-3" /></button>
    </div>
  </div>
)

export function TeamManagementPanel({ tenantId, tenantName }: TeamPanelProps) {
  const [departments, setDepartments] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [newDept, setNewDept] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newBranch, setNewBranch] = useState('')

  const load = async () => {
    try {
      const [dRes, rRes, bRes] = await Promise.all([
        api.get<any>(`/hr/departments`).catch(() => []),
        api.get<any>(`/roles`).catch(() => []),
        api.get<any>(`/sucursales`).catch(() => []),
      ])
      setDepartments(normalizeList(dRes))
      setRoles(normalizeList(rRes))
      setBranches(normalizeList(bRes))
    } catch { /* silent */ }
  }

  useEffect(() => { Promise.resolve().then(load) }, [])

  const createDepartment = async () => {
    const name = newDept.trim()
    if (!name) { toast.error('Escribe el nombre del departamento'); return }
    try {
      const code = 'DEPT-' + name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) + Math.floor(Math.random() * 100)
      await api.post('/hr/departments', { name, code })
      toast.success('Departamento creado')
      setNewDept('')
      load()
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al crear departamento') }
  }

  const deleteDepartment = async (id: string) => {
    try {
      await api.delete(`/hr/departments/${id}`)
      toast.success('Departamento eliminado')
      load()
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar') }
  }

  const createRole = async () => {
    const name = newRole.trim()
    if (!name) { toast.error('Escribe el nombre del rol'); return }
    try {
      await api.post('/roles', { name })
      toast.success('Rol creado')
      setNewRole('')
      load()
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al crear rol') }
  }

  const deleteRole = async (id: string) => {
    try {
      await api.delete(`/roles/${id}`)
      toast.success('Rol eliminado')
      load()
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar') }
  }

  const createBranch = async () => {
    const name = newBranch.trim()
    if (!name) { toast.error('Escribe el nombre de la sucursal'); return }
    try {
      const warehouses = normalizeList(await api.get<any>('/inventory/warehouses').catch(() => []))
      const wh = warehouses.find((w: any) => w.isActive !== false)
      if (!wh) {
        toast.error('Primero crea un almacén en Inventario para poder crear la sucursal')
        return
      }
      const code = 'SUC-' + name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) + Math.floor(Math.random() * 100)
      await api.post('/sucursales', { name, code, warehouseId: wh.id, location: null, isActive: true })
      toast.success('Sucursal creada')
      setNewBranch('')
      load()
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al crear sucursal') }
  }

  const deleteBranch = async (id: string) => {
    try {
      await api.delete(`/sucursales/${id}`)
      toast.success('Sucursal eliminada')
      load()
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar') }
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-3">
        <Clock className="size-4 text-amber-500 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Administrá los <strong>departamentos</strong>, <strong>roles</strong> y <strong>sucursales</strong> de <strong>{tenantName}</strong> desde un solo lugar.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Block title="Departamentos" icon={Building2} count={departments.length}>
          <div className="flex gap-2">
            <Input value={newDept} onChange={e => setNewDept(e.target.value)} placeholder="Nuevo departamento..." className="h-8 text-xs"
              onKeyDown={e => e.key === 'Enter' && createDepartment()} />
            <Button size="sm" className="h-8 shrink-0" onClick={createDepartment}><Plus className="size-3.5" /></Button>
          </div>
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {departments.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sin departamentos</p>}
            {departments.map((d: any) => (
              <ItemRow key={d.id || d.name} name={d.name} onDelete={() => deleteDepartment(d.id)} />
            ))}
          </div>
        </Block>

        <Block title="Roles" icon={UserCog} count={roles.length}>
          <div className="flex gap-2">
            <Input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Nuevo rol..." className="h-8 text-xs"
              onKeyDown={e => e.key === 'Enter' && createRole()} />
            <Button size="sm" className="h-8 shrink-0" onClick={createRole}><Plus className="size-3.5" /></Button>
          </div>
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {roles.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sin roles</p>}
            {roles.map((r: any) => (
              <ItemRow key={r.id || r.name} name={r.name}
                extra={<Badge variant="secondary" className="text-[9px]">{Array.isArray(r.allowedModules) ? r.allowedModules.length : 0} módulos</Badge>}
                onDelete={() => deleteRole(r.id)} />
            ))}
          </div>
        </Block>

        <Block title="Sucursales" icon={Store} count={branches.length}>
          <div className="flex gap-2">
            <Input value={newBranch} onChange={e => setNewBranch(e.target.value)} placeholder="Nueva sucursal..." className="h-8 text-xs"
              onKeyDown={e => e.key === 'Enter' && createBranch()} />
            <Button size="sm" className="h-8 shrink-0" onClick={createBranch}><Plus className="size-3.5" /></Button>
          </div>
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {branches.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sin sucursales</p>}
            {branches.map((b: any) => (
              <ItemRow key={b.id || b.name} name={b.name} onDelete={() => deleteBranch(b.id)} />
            ))}
          </div>
        </Block>
      </div>
    </div>
  )
}
