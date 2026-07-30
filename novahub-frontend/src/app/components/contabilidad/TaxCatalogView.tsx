import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { Switch } from '../ui/switch'
import { toast } from 'sonner'
import { Plus, Trash2, Save, ShieldAlert, Loader2 } from 'lucide-react'
import { contabilidadService } from '../../services/contabilidad.service'

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
  const [entries, setEntries] = useState<TaxEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [newEntry, setNewEntry] = useState<TaxEntry>({
    name: '', code: '', type: 'WITHHOLDING', category: 'IR',
    rate: 0, baseCalculation: 'LINE_TOTAL', appliesTo: 'ALL',
    requiresAuth: false, isActive: true,
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  const fetchEntries = () => {
    setLoading(true)
    contabilidadService.getTaxCatalog().then((res: any) => {
      setEntries(res?.data || res || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { fetchEntries() }, [])

  const handleCreate = async () => {
    if (!newEntry.name || !newEntry.code) { toast.error('Nombre y código requeridos'); return }
    try {
      await contabilidadService.createTaxCatalogEntry(newEntry)
      toast.success('Entrada creada')
      setNewEntry({ name: '', code: '', type: 'WITHHOLDING', category: 'IR', rate: 0, baseCalculation: 'LINE_TOTAL', appliesTo: 'ALL', requiresAuth: false, isActive: true })
      fetchEntries()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error')
    }
  }

  const handleUpdate = async (id: string, data: Partial<TaxEntry>) => {
    try {
      await contabilidadService.updateTaxCatalogEntry(id, data)
      toast.success('Actualizado')
      setEditingId(null)
      fetchEntries()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await contabilidadService.deleteTaxCatalogEntry(id)
      toast.success('Eliminado')
      fetchEntries()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error')
    }
  }

  const handleSeed = async () => {
    try {
      const res = await contabilidadService.seedDefaultTaxCatalog()
      const data = res?.data || res
      toast.success(data?.skipped ? 'Catálogo ya sembrado' : `Creadas ${data?.created || 0} entradas`)
      fetchEntries()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3 px-5 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-primary" />
            <CardTitle className="text-sm font-black uppercase tracking-tight">Catálogo Tributario</CardTitle>
            <Badge variant="outline" className="text-[10px]">{entries.length}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSeed}>
              <Loader2 className="size-3.5 mr-1" /> Sembrar datos por defecto
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Configure las tasas de impuestos (IVA, ISC) y retenciones (IR, IVA) según la normativa DGI vigente.
        </p>

        {/* New entry form */}
        <div className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/20 rounded-xl">
          <div className="col-span-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Nombre</label>
            <Input size={1} value={newEntry.name} onChange={e => setNewEntry(prev => ({ ...prev, name: e.target.value }))} placeholder="Ej: IR Bienes 2%" />
          </div>
          <div className="col-span-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Código</label>
            <Input size={1} value={newEntry.code} onChange={e => setNewEntry(prev => ({ ...prev, code: e.target.value }))} placeholder="IR_BIENES_2" />
          </div>
          <div className="col-span-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Tipo</label>
            <select value={newEntry.type} onChange={e => setNewEntry(prev => ({ ...prev, type: e.target.value }))} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              <option value="TAX">Impuesto</option>
              <option value="WITHHOLDING">Retención</option>
            </select>
          </div>
          <div className="col-span-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Categoría</label>
            <select value={newEntry.category} onChange={e => setNewEntry(prev => ({ ...prev, category: e.target.value }))} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              <option value="IVA">IVA</option>
              <option value="IR">IR</option>
              <option value="ISC">ISC</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>
          <div className="col-span-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Tasa %</label>
            <Input type="number" value={newEntry.rate} onChange={e => setNewEntry(prev => ({ ...prev, rate: Number(e.target.value) }))} />
          </div>
          <div className="col-span-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Base cálculo</label>
            <select value={newEntry.baseCalculation} onChange={e => setNewEntry(prev => ({ ...prev, baseCalculation: e.target.value }))} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              <option value="LINE_TOTAL">Línea</option>
              <option value="SUBTOTAL">Subtotal</option>
              <option value="WITH_IVA">Con IVA</option>
              <option value="GROSS">Bruto</option>
            </select>
          </div>
          <div className="col-span-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Aplica a</label>
            <select value={newEntry.appliesTo} onChange={e => setNewEntry(prev => ({ ...prev, appliesTo: e.target.value }))} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              <option value="ALL">Todos</option>
              <option value="GOODS">Bienes</option>
              <option value="SERVICES">Servicios</option>
              <option value="BOTH">Ambos</option>
            </select>
          </div>
          <div className="col-span-1 flex items-center gap-1 pt-5">
            <Switch checked={newEntry.requiresAuth} onCheckedChange={v => setNewEntry(prev => ({ ...prev, requiresAuth: v }))} />
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Auth</label>
          </div>
          <div className="col-span-1">
            <Button size="sm" onClick={handleCreate}><Plus className="size-3.5 mr-1" />Agregar</Button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
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
                    <td className="py-2 px-1">{editingId === entry.id ? <Input value={entry.name} onChange={e => setEntries(prev => prev.map(p => p.id === entry.id ? { ...p, name: e.target.value } : p))} /> : entry.name}</td>
                    <td className="py-2 px-1 font-mono">{entry.code}</td>
                    <td className="py-2 px-1"><Badge variant={entry.type === 'TAX' ? 'default' : 'secondary'} className="text-[10px]">{entry.type === 'TAX' ? 'Impuesto' : 'Retención'}</Badge></td>
                    <td className="py-2 px-1">{entry.category}</td>
                    <td className="py-2 px-1 text-right font-mono">{Number(entry.rate).toFixed(1)}%</td>
                    <td className="py-2 px-1">{entry.baseCalculation}</td>
                    <td className="py-2 px-1">{entry.appliesTo}</td>
                    <td className="py-2 px-1 text-center">{entry.requiresAuth ? <ShieldAlert className="size-3.5 text-amber-500 mx-auto" /> : '—'}</td>
                    <td className="py-2 px-1 text-center">
                      <Switch checked={entry.isActive} onCheckedChange={v => entry.id && handleUpdate(entry.id, { isActive: v })} />
                    </td>
                    <td className="py-2 px-1 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {editingId === entry.id ? (
                          <Button variant="ghost" size="icon" className="size-7" onClick={() => entry.id && handleUpdate(entry.id, { name: entry.name, rate: Number(entry.rate), baseCalculation: entry.baseCalculation, appliesTo: entry.appliesTo, requiresAuth: entry.requiresAuth })}><Save className="size-3.5" /></Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditingId(entry.id || null)}>✎</Button>
                        )}
                        <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => entry.id && handleDelete(entry.id)}><Trash2 className="size-3.5" /></Button>
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
        )}
      </CardContent>
    </Card>
  )
}
