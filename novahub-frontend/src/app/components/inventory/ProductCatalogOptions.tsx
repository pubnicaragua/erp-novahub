"use client"

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Eye, EyeOff } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { toast } from '@/app/services/toast'
import { api, getApiErrorMessage } from '../../services/api'
import { useTenantQuery } from '../../hooks/useTenantQuery'

export interface MeasureUnitOption { value: string; label: string; hidden: boolean }
export interface ProductClassOption { value: string; label: string; hidden: boolean; units: string[]; presentations: string[] }

const FALLBACK_UNITS: MeasureUnitOption[] = [
  ['unidad', 'Unidad'], ['kilo', 'Kilo'], ['libra', 'Libra'], ['docena', 'Docena'], ['caja', 'Caja'],
  ['litro', 'Litro'], ['galon', 'Galón'], ['metro', 'Metro'], ['par', 'Par'], ['rollo', 'Rollo'], ['pieza', 'Pieza'],
].map(([value, label]) => ({ value, label, hidden: false }))

const QUERY_UNITS = ['inventory', 'measure-units']
const QUERY_CLASSES = ['inventory', 'product-classes']

/** Unidades y clasificaciones de la empresa. Si el servidor no responde se usan las de siempre. */
export function useProductCatalogOptions() {
  const unitsQuery = useTenantQuery<MeasureUnitOption[]>(QUERY_UNITS, (signal) => api.get<MeasureUnitOption[]>('/inventory/measure-units', { signal }))
  const classesQuery = useTenantQuery<ProductClassOption[]>(QUERY_CLASSES, (signal) => api.get<ProductClassOption[]>('/inventory/product-classes', { signal }))
  const units = unitsQuery.data && unitsQuery.data.length > 0 ? unitsQuery.data : FALLBACK_UNITS
  const classes = classesQuery.data || []
  return { units, classes, loading: unitsQuery.isLoading || classesQuery.isLoading }
}

/** Unidades visibles; si el producto usa una oculta (o desconocida) se conserva para no perder su valor. */
export function visibleUnitsFor(units: MeasureUnitOption[], currentValue?: string): MeasureUnitOption[] {
  const current = String(currentValue || '').trim()
  const visible = units.filter((unit) => !unit.hidden || unit.value === current)
  if (current && !visible.some((unit) => unit.value === current)) {
    return [...visible, { value: current, label: current.charAt(0).toUpperCase() + current.slice(1), hidden: true }]
  }
  return visible
}

export function MeasureUnitItems({ units, current }: { units: MeasureUnitOption[]; current?: string }) {
  return <>{visibleUnitsFor(units, current).map((unit) => (
    <SelectItem key={unit.value} value={unit.value}>{unit.label}{unit.hidden ? ' (oculta)' : ''}</SelectItem>
  ))}</>
}

/** Clasificación (Combustibles / Lubricantes...) y presentación del producto. */
export function ProductClassFields({
  classes, productClass, presentation, onChange, disabled, compact,
}: {
  classes: ProductClassOption[]
  productClass?: string | null
  presentation?: string | null
  onChange: (next: { productClass: string; presentation: string }) => void
  disabled?: boolean
  compact?: boolean
}) {
  const selectable = classes.filter((option) => !option.hidden || option.value === productClass)
  const selected = classes.find((option) => option.value === productClass)
  if (selectable.length === 0) return null
  const triggerClass = compact ? 'h-8 text-xs mt-1' : 'h-8 !rounded-none text-xs mt-1'
  return (
    <>
      <div className="col-span-1">
        <label className="text-[10px] uppercase font-bold text-muted-foreground">Clasificación</label>
        <Select value={productClass || '__none__'} disabled={disabled} onValueChange={(value) => onChange({ productClass: value === '__none__' ? '' : value, presentation: '' })}>
          <SelectTrigger className={triggerClass}><SelectValue placeholder="Sin clasificar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin clasificar</SelectItem>
            {selectable.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {selected && selected.presentations.length > 0 && (
        <div className="col-span-1">
          <label className="text-[10px] uppercase font-bold text-muted-foreground">Presentación</label>
          <Select value={presentation || '__none__'} disabled={disabled} onValueChange={(value) => onChange({ productClass: selected.value, presentation: value === '__none__' ? '' : value })}>
            <SelectTrigger className={triggerClass}><SelectValue placeholder="Sin presentación" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin presentación</SelectItem>
              {selected.presentations.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  )
}

/** Administra unidades y clasificaciones: crear, renombrar y ocultar (nunca borrar). */
export function CatalogOptionsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const { units, classes } = useProductCatalogOptions()
  const [draftUnits, setDraftUnits] = useState<MeasureUnitOption[]>([])
  const [draftClasses, setDraftClasses] = useState<ProductClassOption[]>([])
  const [saving, setSaving] = useState(false)
  const [newUnit, setNewUnit] = useState('')
  const [newClass, setNewClass] = useState('')

  useEffect(() => {
    if (!open) return
    setDraftUnits(units.map((unit) => ({ ...unit })))
    setDraftClasses(classes.map((option) => ({ ...option, units: [...option.units], presentations: [...option.presentations] })))
    // Solo al abrir: no pisar lo que la persona está editando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const unitLabelByValue = useMemo(() => new Map(draftUnits.map((unit) => [unit.value, unit.label])), [draftUnits])

  const patchUnit = (index: number, patch: Partial<MeasureUnitOption>) =>
    setDraftUnits((current) => current.map((unit, i) => (i === index ? { ...unit, ...patch } : unit)))
  const patchClass = (index: number, patch: Partial<ProductClassOption>) =>
    setDraftClasses((current) => current.map((option, i) => (i === index ? { ...option, ...patch } : option)))

  const addUnit = () => {
    const label = newUnit.trim()
    if (!label) return
    setDraftUnits((current) => [...current, { value: '', label, hidden: false }])
    setNewUnit('')
  }
  const addClass = () => {
    const label = newClass.trim()
    if (!label) return
    setDraftClasses((current) => [...current, { value: '', label, hidden: false, units: [], presentations: [] }])
    setNewClass('')
  }

  const save = async () => {
    setSaving(true)
    try {
      const savedUnits = await api.put<MeasureUnitOption[]>('/inventory/measure-units', { units: draftUnits })
      const classPayload = draftClasses.map((option) => ({
        ...option,
        units: option.units.filter((value) => savedUnits.some((unit) => unit.value === value)),
      }))
      await api.put<ProductClassOption[]>('/inventory/product-classes', { classes: classPayload })
      await queryClient.invalidateQueries({ queryKey: ['tenant-module'] })
      toast.success('Unidades y clasificaciones guardadas')
      onOpenChange(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron guardar los cambios. Revisa los nombres e intenta de nuevo.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Unidades de medida y clasificación</DialogTitle>
          <DialogDescription>Cambia el nombre de una unidad, ocúltala si ya no la usas o agrega nuevas. Nada se borra: los productos que ya la usan la conservan.</DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-sm font-bold">Unidades de medida</h3>
          {draftUnits.map((unit, index) => (
            <div key={`${unit.value}-${index}`} className="flex items-center gap-2">
              <Input value={unit.label} onChange={(event) => patchUnit(index, { label: event.target.value })} className={unit.hidden ? 'h-8 text-xs opacity-60' : 'h-8 text-xs'} aria-label="Nombre de la unidad" />
              <Button type="button" variant="outline" size="sm" onClick={() => patchUnit(index, { hidden: !unit.hidden })} title={unit.hidden ? 'Mostrar en los selectores' : 'Ocultar de los selectores'}>
                {unit.hidden ? <><EyeOff className="mr-1 h-3.5 w-3.5" />Oculta</> : <><Eye className="mr-1 h-3.5 w-3.5" />Visible</>}
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input value={newUnit} onChange={(event) => setNewUnit(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addUnit() } }} placeholder="Nueva unidad (ej. Tambor)" className="h-8 text-xs" />
            <Button type="button" size="sm" variant="outline" onClick={addUnit}><Plus className="mr-1 h-3.5 w-3.5" />Agregar</Button>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-bold">Clasificación de productos</h3>
          {draftClasses.map((option, index) => (
            <div key={`${option.value}-${index}`} className="space-y-2 rounded-lg border border-border/50 p-3">
              <div className="flex items-center gap-2">
                <Input value={option.label} onChange={(event) => patchClass(index, { label: event.target.value })} className="h-8 text-xs font-semibold" aria-label="Nombre de la clasificación" />
                <Button type="button" variant="outline" size="sm" onClick={() => patchClass(index, { hidden: !option.hidden })}>
                  {option.hidden ? <><EyeOff className="mr-1 h-3.5 w-3.5" />Oculta</> : <><Eye className="mr-1 h-3.5 w-3.5" />Visible</>}
                </Button>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Unidades permitidas (vacío = todas)</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {draftUnits.filter((unit) => unit.value).map((unit) => {
                    const active = option.units.includes(unit.value)
                    return (
                      <Button key={unit.value} type="button" size="sm" variant={active ? 'default' : 'outline'} className="h-7 px-2 text-[11px]"
                        onClick={() => patchClass(index, { units: active ? option.units.filter((v) => v !== unit.value) : [...option.units, unit.value] })}>
                        {unitLabelByValue.get(unit.value) || unit.value}
                      </Button>
                    )
                  })}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Presentaciones (separadas por coma)</p>
                <PresentationsInput value={option.presentations} onCommit={(presentations) => patchClass(index, { presentations })} />
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Input value={newClass} onChange={(event) => setNewClass(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addClass() } }} placeholder="Nueva clasificación (ej. Aditivos)" className="h-8 text-xs" />
            <Button type="button" size="sm" variant="outline" onClick={addClass}><Plus className="mr-1 h-3.5 w-3.5" />Agregar</Button>
          </div>
        </section>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PresentationsInput({ value, onCommit }: { value: string[]; onCommit: (next: string[]) => void }) {
  const [text, setText] = useState(value.join(', '))
  useEffect(() => { setText(value.join(', ')) }, [value])
  const commit = () => onCommit(text.split(',').map((item) => item.trim()).filter(Boolean))
  return <Input value={text} onChange={(event) => setText(event.target.value)} onBlur={commit} placeholder="Galones, Cuartos de galón, Litros, Balde/Cubeta" className="mt-1 h-8 text-xs" />
}
