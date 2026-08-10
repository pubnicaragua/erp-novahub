import { useState, useEffect } from 'react'
import { contabilidadService } from '../../services/contabilidad.service'
import { Input } from './input'
import { Label } from './label'
import { ShieldAlert } from 'lucide-react'

interface TaxCatalogEntry {
  id: string
  name: string
  code: string
  type: 'TAX' | 'WITHHOLDING'
  category: string
  rate: number
  baseCalculation: string
  requiresAuth: boolean
  isActive: boolean
}

interface TaxSelectorProps {
  value: string
  onChange: (value: string) => void
  type: 'TAX' | 'WITHHOLDING'
  disabled?: boolean
}

export function TaxTypeSelect({ value, onChange, type, disabled }: TaxSelectorProps) {
  const [entries, setEntries] = useState<TaxCatalogEntry[]>([])

  useEffect(() => {
    contabilidadService.getTaxCatalog(type).then((res: any) => {
      setEntries((res?.data || res || []) as TaxCatalogEntry[])
    }).catch(() => {})
  }, [type])

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      {type === 'TAX' && <option value="">Seleccionar IVA</option>}
      {type === 'WITHHOLDING' && <option value="NONE">Sin retención</option>}
      {entries.filter(e => e.isActive).map(entry => (
        <option key={entry.id} value={entry.code}>
          {entry.name} ({entry.rate}%)
        </option>
      ))}
    </select>
  )
}

interface TaxDetailProps {
  item: {
    taxType?: string
    taxRate?: number
    taxBase?: number
    taxAmount?: number
    withholdingType?: string
    withholdingRate?: number
    withholdingBase?: number
    currency?: string
  }
  onItemChange: (field: string, value: any) => void
  lineTotal: number
  currency?: string
}

export function TaxDetail({ item, onItemChange, lineTotal, currency: propCurrency }: TaxDetailProps) {
  const [taxEntries, setTaxEntries] = useState<TaxCatalogEntry[]>([])
  const [whEntries, setWhEntries] = useState<TaxCatalogEntry[]>([])
  const sym = (item.currency || propCurrency) === 'USD' ? '$' : 'C$'

  useEffect(() => {
    Promise.all([
      contabilidadService.getTaxCatalog('TAX'),
      contabilidadService.getTaxCatalog('WITHHOLDING'),
    ]).then(([taxRes, whRes]: [any, any]) => {
      setTaxEntries((taxRes?.data || taxRes || []) as TaxCatalogEntry[])
      setWhEntries((whRes?.data || whRes || []) as TaxCatalogEntry[])
    }).catch(() => {})
  }, [])

  const taxEntry = taxEntries.find(e => e.code === item.taxType && e.isActive)
  const whEntry = whEntries.find(e => e.code === item.withholdingType && e.isActive)

  const isTaxManual = taxEntry?.requiresAuth ?? true
  const isWhManual = whEntry?.requiresAuth ?? true

  const effectiveTaxRate = taxEntry ? taxEntry.rate : (item.taxType === 'GRAVADO' || item.taxType === 'GRAVADO_15' ? 15 : 0)
  const effectiveWhRate = whEntry ? whEntry.rate : Number(item.withholdingRate || 0)

  const calcTaxAmount = (base: number) => base * effectiveTaxRate / 100
  const calcWhAmount = (base: number) => base * effectiveWhRate / 100

  return (
    <div className="min-w-0 space-y-2">
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Tipo IVA</Label>
          <TaxTypeSelect
            type="TAX"
            value={item.taxType || ''}
            onChange={(v) => {
              const entry = taxEntries.find(e => e.code === v)
              onItemChange('taxType', v)
              if (entry) {
                onItemChange('taxRate', entry.rate)
                const base = entry.baseCalculation === 'LINE_TOTAL' ? lineTotal : item.taxBase || lineTotal
                onItemChange('taxBase', base)
                onItemChange('taxAmount', base * Number(entry.rate) / 100)
              }
            }}
          />
        </div>
        {item.taxType && item.taxType !== 'EXENTO' && item.taxType !== 'EXONERADO' && item.taxType !== 'NO_SUJETO' && item.taxType !== '' && (
          <>
            <div>
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Base IVA</Label>
              <Input
                type="number"
                value={item.taxBase || 0}
                className="h-9 min-w-0 px-2 text-xs"
                onChange={(e) => {
                  const base = Number(e.target.value)
                  onItemChange('taxBase', base)
                  onItemChange('taxAmount', calcTaxAmount(base))
                }}
              />
            </div>
            <div>
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                Tasa %
                {isTaxManual && <ShieldAlert className="inline size-3 ml-1 text-amber-500" />}
              </Label>
              <Input
                type="number"
                value={effectiveTaxRate}
                className="h-9 min-w-0 px-2 text-xs"
                onChange={(e) => {
                  const rate = Number(e.target.value)
                  onItemChange('taxRate', rate)
                  onItemChange('taxAmount', calcTaxAmount(Number(item.taxBase || lineTotal)))
                }}
              />
            </div>
            <div>
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">IVA</Label>
              <div className="h-9 flex items-center text-sm font-medium text-rose-500">
                {sym} {(item.taxAmount || calcTaxAmount(Number(item.taxBase || lineTotal))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Retención</Label>
          <TaxTypeSelect
            type="WITHHOLDING"
            value={item.withholdingType || 'NONE'}
            onChange={(v) => {
              const entry = whEntries.find(e => e.code === v)
              onItemChange('withholdingType', v)
              if (entry && v !== 'NONE') {
                onItemChange('withholdingRate', entry.rate)
                const base = entry.baseCalculation === 'LINE_TOTAL' ? lineTotal : Number(item.withholdingBase || lineTotal)
                onItemChange('withholdingBase', base)
              } else {
                onItemChange('withholdingRate', 0)
                onItemChange('withholdingBase', 0)
              }
            }}
          />
        </div>
        {item.withholdingType && item.withholdingType !== 'NONE' && (
          <>
            <div>
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Base Retención</Label>
              <Input
                type="number"
                value={item.withholdingBase || 0}
                className="h-9 min-w-0 px-2 text-xs"
                onChange={(e) => {
                  const base = Number(e.target.value)
                  onItemChange('withholdingBase', base)
                }}
              />
            </div>
            <div>
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                Tasa %
                {isWhManual && <ShieldAlert className="inline size-3 ml-1 text-amber-500" />}
              </Label>
              <Input
                type="number"
                value={effectiveWhRate}
                className="h-9 min-w-0 px-2 text-xs"
                onChange={(e) => onItemChange('withholdingRate', Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Monto Retenido</Label>
              <div className="h-9 flex items-center text-sm font-medium text-amber-600">
                -{sym} {(calcWhAmount(Number(item.withholdingBase || lineTotal))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
