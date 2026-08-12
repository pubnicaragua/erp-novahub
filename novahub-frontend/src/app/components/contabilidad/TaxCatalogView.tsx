import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { Switch } from '../ui/switch'
import { toast } from 'sonner'
import { Plus, Trash2, Save, ShieldAlert, Loader2 } from 'lucide-react'
import { contabilidadService } from '../../services/contabilidad.service'
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery'
import { useAuth } from '../../contexts/AuthContext'

interface TaxEntry {
  id?: string
  name: string
  code: string
  type: string
  category: string
  rate: number
  baseCalculation: string
  appliesTo: string
  requiresAuth: boolean
  isActive: boolean
}

export function TaxCatalogView() {
  const { canPerform } = useAuth()
  const canCreate = canPerform('ACCOUNTING', 'create')
  const canEdit = canPerform('ACCOUNTING', 'edit')
  const canDeactivate = canPerform('ACCOUNTING', 'deactivate')
  const queryClient = useQueryClient()
  const [newEntry, setNewEntry] = useState<TaxEntry>({
    name: '', code: '', type: 'WITHHOLDING', category: 'IR',
    rate: 0, baseCalculation: 'LINE_TOTAL', appliesTo: 'ALL',
    requiresAuth: false, isActive: true,
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  const entriesQuery = useAccountingQuery<TaxEntry[]>(['tax-catalog'], async (signal) => accountingList(await contabilidadService.getTaxCatalog(undefined, signal)))
  const entries = entriesQuery.data || []
  const loading = entriesQuery.isLoading || entriesQuery.isFetching
  const fetchEntries = () => entriesQuery.refetch()

  const handleCreate = async () => {
    if (!canCreate) return
    if (!newEntry.name || !newEntry.code) { toast.error('Nombre y código requeridos'); return }
    try {
      await contabilidadService.createTaxCatalogEntry(newEntry)
      toast.success('Entrada creada')
      setNewEntry({ name: '', code: '', type: 'WITHHOLDING', category: 'IR', rate: 0, baseCalculation: 'LINE_TOTAL', appliesTo: 'ALL', requiresAuth: false, isActive: true })
      await queryClient.invalidateQueries({ queryKey: ['accounting'] })
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error')
    }
  }

  const handleUpdate = async (id: string, data: Partial<TaxEntry>) => {
    const isDeactivation = data.isActive === false
    if (isDeactivation ? !canDeactivate : !canEdit) return
    try {
      await contabilidadService.updateTaxCatalogEntry(id, data)
      toast.success('Actualizado')
      setEditingId(null)
      await queryClient.invalidateQueries({ queryKey: ['accounting'] })
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!canDeactivate) return
    try {
      await contabilidadService.deleteTaxCatalogEntry(id)
      toast.success('Eliminado')
      await queryClient.invalidateQueries({ queryKey: ['accounting'] })
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error')
    }
  }

  const handleSeed = async () => {
    if (!canCreate) return
    try {
      const res = await contabilidadService.seedDefaultTaxCatalog()
      const data = res?.data || res
      toast.success(data?.skipped ? 'Catálogo ya sembrado' : `Creadas ${data?.created || 0} entradas`)
      await queryClient.invalidateQueries({ queryKey: ['accounting'] })
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3 px-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-primary" />
            <CardTitle className="text-sm font-black uppercase tracking-tight">Catálogo Tributario</CardTitle>
            <Badge variant="outline" className="text-[10px]">{entries.length}</Badge>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {canCreate && <Button variant="outline" size="sm" onClick={handleSeed}>
              <Loader2 className="size-3.5 mr-1" /> Sembrar datos por defecto
            </Button>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Configure las tasas de impuestos (IVA, ISC) y retenciones (IR, IVA) según la normativa DGI vigente.
        </p>

        {/* New entry form */}
        {canCreate && <div className="grid grid-cols-1 gap-3 items-end rounded-xl bg-muted/20 p-3 sm:grid-cols-12 sm:gap-2">
          <div className="sm:col-span-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Nombre</label>
            <Input size={1} value={newEntry.name} onChange={e => setNewEntry(prev => ({ ...prev, name: e.target.value }))} placeholder="Ej: IR Bienes 2%" />
          </div>
          <div className="sm:col-span-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Código</label>
            <Input size={1} value={newEntry.code} onChange={e => setNewEntry(prev => ({ ...prev, code: e.target.value }))} placeholder="IR_BIENES_2" />
          </div>
          <div className="sm:col-span-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Tipo</label>
            <select value={newEntry.type} onChange={e => setNewEntry(prev => ({ ...prev, type: e.target.value }))} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              <option value="TAX">Impuesto</option>
              <option value="WITHHOLDING">Retención</option>
            </select>
          </div>
          <div className="sm:col-span-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Categoría</label>
            <select value={newEntry.category} onChange={e => setNewEntry(prev => ({ ...prev, category: e.target.value }))} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              <option value="IVA">IVA</option>
              <option value="IR">IR</option>
              <option value="ISC">ISC</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>
          <div className="sm:col-span-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Tasa %</label>
            <Input type="number" value={newEntry.rate} onChange={e => setNewEntry(prev => ({ ...prev, rate: Number(e.target.value) }))} />
          </div>
          <div className="sm:col-span-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Base cálculo</label>
            <select value={newEntry.baseCalculation} onChange={e => setNewEntry(prev => ({ ...prev, baseCalculation: e.target.value }))} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              <option value="LINE_TOTAL">Línea</option>
              <option value="SUBTOTAL">Subtotal</option>
              <option value="WITH_IVA">Con IVA</option>
              <option value="GROSS">Bruto</option>
            </select>
          </div>
          <div className="sm:col-span-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Aplica a</label>
            <select value={newEntry.appliesTo} onChange={e => setNewEntry(prev => ({ ...prev, appliesTo: e.target.value }))} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              <option value="ALL">Todos</option>
              <option value="GOODS">Bienes</option>
              <option value="SERVICES">Servicios</option>
              <option value="BOTH">Ambos</option>
            </select>
          </div>
          <div className="flex items-center gap-1 pt-1 sm:col-span-1 sm:pt-5">
            <Switch checked={newEntry.requiresAuth} onCheckedChange={v => setNewEntry(prev => ({ ...prev, requiresAuth: v }))} />
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Auth</label>
          </div>
          <div className="sm:col-span-1">
            <Button size="sm" onClick={handleCreate}><Plus className="size-3.5 mr-1" />Agregar</Button>
          </div>
        </div>}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-2">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 px-1 font-bold uppercase tracking-wider">Nombre</th>
                  <th className="text-left py-2 px-1 font-bold uppercase tracking-wider">Código</th>
                  <th className="text-left py-2 px-1 font-bold uppercase tracking-wider">Tipo</th>
                  <th className="text-left py-2 px-1 font-bold uppercase tracking-wider">Cat.</th>
                  <th className="text-right py-2 px-1 font-bold uppercase tracking-wider">Tasa %</th>
                  <th className="text-left py-2 px-1 font-bold uppercase tracking-wider">Base</th>
                  <th className="text-left py-2 px-1 font-bold uppercase tracking-wider">Aplica</th>
                  <th className="text-center py-2 px-1 font-bold uppercase tracking-wider">Auth</th>
                  <th className="text-center py-2 px-1 font-bold uppercase tracking-wider">Activo</th>
                  <th className="text-right py-2 px-1 font-bold uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.id} className="border-b border-muted/30 hover:bg-muted/10">
                    <td className="py-2 px-1">{editingId === entry.id ? <Input value={draftName} onChange={e => setDraftName(e.target.value)} /> : entry.name}</td>
                    <td className="py-2 px-1 font-mono">{entry.code}</td>
                    <td className="py-2 px-1"><Badge variant={entry.type === 'TAX' ? 'default' : 'secondary'} className="text-[10px]">{entry.type === 'TAX' ? 'Impuesto' : 'Retención'}</Badge></td>
                    <td className="py-2 px-1">{entry.category}</td>
                    <td className="py-2 px-1 text-right font-mono">{Number(entry.rate).toFixed(1)}%</td>
                    <td className="py-2 px-1">{entry.baseCalculation}</td>
                    <td className="py-2 px-1">{entry.appliesTo}</td>
                    <td className="py-2 px-1 text-center">{entry.requiresAuth ? <ShieldAlert className="size-3.5 text-amber-500 mx-auto" /> : '—'}</td>
                    <td className="py-2 px-1 text-center">
                      {(canEdit || canDeactivate) && <Switch checked={entry.isActive} disabled={entry.isActive ? !canDeactivate : !canEdit} onCheckedChange={v => entry.id && handleUpdate(entry.id, { isActive: v })} />}
                    </td>
                    <td className="py-2 px-1 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (editingId === entry.id ? (
                          <Button variant="ghost" size="icon" aria-label="Guardar entrada tributaria" className="size-7" onClick={() => entry.id && handleUpdate(entry.id, { name: draftName, rate: Number(entry.rate), baseCalculation: entry.baseCalculation, appliesTo: entry.appliesTo, requiresAuth: entry.requiresAuth })}><Save className="size-3.5" /></Button>
                        ) : (
                          <Button variant="ghost" size="icon" aria-label="Editar entrada tributaria" className="size-7" onClick={() => { setEditingId(entry.id || null); setDraftName(entry.name) }}>✎</Button>
                        ))}
                        {canDeactivate && <Button variant="ghost" size="icon" aria-label="Desactivar entrada tributaria" className="size-7 text-destructive" onClick={() => entry.id && handleDelete(entry.id)}><Trash2 className="size-3.5" /></Button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">Sin entradas. Siembre los datos por defecto o agregue manualmente.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {entries.length === 0 ? <p className="py-8 text-center text-xs text-muted-foreground">Sin entradas.</p> : entries.map(entry => (
              <div key={entry.id} className="min-w-0 rounded-xl border border-border/30 bg-muted/20 p-3">
                <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-xs font-bold">{entry.name}</p><p className="mt-1 break-all text-[10px] font-mono text-muted-foreground">{entry.code}</p></div><Badge variant={entry.type === 'TAX' ? 'default' : 'secondary'} className="shrink-0 text-[9px]">{entry.type === 'TAX' ? 'Impuesto' : 'Retención'}</Badge></div>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/20 pt-2 text-[10px]"><div><span className="block text-muted-foreground">Categoría</span><span>{entry.category}</span></div><div><span className="block text-muted-foreground">Tasa</span><span className="font-mono">{Number(entry.rate).toFixed(1)}%</span></div><div><span className="block text-muted-foreground">Aplica a</span><span>{entry.appliesTo}</span></div><div><span className="block text-muted-foreground">Estado</span><span>{entry.isActive ? 'Activo' : 'Inactivo'}</span></div><div className="col-span-2 flex justify-end gap-1">{canEdit && <Button variant="ghost" size="icon" aria-label="Editar entrada tributaria" className="size-7" onClick={() => { setEditingId(entry.id || null); setDraftName(entry.name) }}>✎</Button>}{canDeactivate && <Button variant="ghost" size="icon" aria-label="Desactivar entrada tributaria" className="size-7 text-destructive" onClick={() => entry.id && handleDelete(entry.id)}><Trash2 className="size-3.5" /></Button>}</div></div>
              </div>
            ))}
          </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
