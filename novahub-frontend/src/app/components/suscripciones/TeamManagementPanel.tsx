import { useState, useEffect } from 'react'
import { Building2, UserCog, Plus, Trash2, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { toast } from 'sonner'
import { api } from '../../services/api'
import { useTenantQuery, asList } from '../../hooks/useTenantQuery'

interface TeamPanelProps {
  tenantId: string
  tenantName: string
}

export function TeamManagementPanel({ tenantId, tenantName }: TeamPanelProps) {
  const [departments, setDepartments] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [newDept, setNewDept] = useState('')
  const [newRole, setNewRole] = useState('')

  const { data: teamData, refetch: refetchTeam } = useTenantQuery(
    ['my-company-team-management', tenantId],
    async (signal) => {
      const [dRes, rRes] = await Promise.all([
        api.get<any>('/hr/departments', { params: { type: 'ACCESS' }, signal }),
        api.get<any>('/roles', { signal }),
      ])
      return { departments: asList(dRes), roles: asList(rRes) }
    },
    { enabled: Boolean(tenantId), onError: (error) => toast.error(error.message || 'No se pudo cargar la configuración del equipo') },
  )

  useEffect(() => {
    if (!teamData) return
    setDepartments(teamData.departments)
    setRoles(teamData.roles)
  }, [teamData])

  const load = async () => {
    try { await refetchTeam() } catch { /* silent */ }
  }

  const createDepartment = async () => {
    const name = newDept.trim()
    if (!name) { toast.error('Escribe el nombre del departamento'); return }
    try {
      await api.post('/hr/departments', { name, type: 'ACCESS' })
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

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-3">
        <Clock className="size-4 text-amber-500 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Administrá los <strong>departamentos</strong> y <strong>roles</strong> de <strong>{tenantName}</strong> desde un solo lugar. Las bodegas se gestionan en Inventario.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

      </div>
    </div>
  )
}
