import { useState, useEffect } from 'react'
import { contabilidadService } from '../../services/contabilidad.service'
import { Input } from './input'
import { Label } from './label'
import { ShieldAlert } from 'lucide-react'
import { isTaxExempt } from '../../utils/taxUtils'

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
      className="flex h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-foreground/65 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      {type === 'TAX' && <option value="">Seleccionar IVA</option>}
      {type === 'WITHHOLDING' && <option value="NONE">Sin retención</option>}
      {value && value !== 'NONE' && !entries.some(entry => entry.isActive && entry.code === value) && (
        <option value={value}>{value === 'GRAVADO' ? 'IVA gravado' : value}</option>
      )}
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
  disabled?: boolean
}

const formatTwoDecimals = (value: unknown) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00'
}

export function TaxDetail({ item, onItemChange, lineTotal, currency: propCurrency, disabled = false }: TaxDetailProps) {
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

  const effectiveTaxRate = item.taxRate !== undefined && item.taxRate !== null
    ? Number(item.taxRate)
    : (taxEntry ? taxEntry.rate : (item.taxType === 'GRAVADO' || item.taxType === 'GRAVADO_15' ? 15 : 0))
  const effectiveWhRate = item.withholdingRate !== undefined && item.withholdingRate !== null
    ? Number(item.withholdingRate)
    : (whEntry ? whEntry.rate : 0)

  const calcTaxAmount = (base: number) => base * effectiveTaxRate / 100
  const calcWhAmount = (base: number) => base * effectiveWhRate / 100

  const hasTax = Boolean(item.taxType && !isTaxExempt(item.taxType))
  const hasWithholding = Boolean(item.withholdingType && item.withholdingType !== 'NONE')
  const taxBase = Number(item.taxBase || lineTotal)
  const taxAmount = Number(item.taxAmount || calcTaxAmount(taxBase))
  const withholdingBase = Number(item.withholdingBase || lineTotal)

  return (
    <div className="min-w-0">
      <div className="grid min-w-0 grid-cols-2 items-end gap-x-2 gap-y-2 md:grid-cols-4 xl:grid-cols-[minmax(8rem,1.35fr)_minmax(6.5rem,1fr)_minmax(4.5rem,.72fr)_minmax(6rem,.9fr)_minmax(8rem,1.25fr)_minmax(6.5rem,1fr)_minmax(4.5rem,.72fr)_minmax(7rem,.9fr)]">
        <div className="min-w-0 xl:col-start-1">
          <Label className="whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-foreground">Tipo IVA</Label>
          <TaxTypeSelect
            type="TAX"
            value={item.taxType || ''}
            disabled={disabled}
            onChange={(v) => {
              const entry = taxEntries.find(e => e.code === v)
              onItemChange('taxType', v)
              if (entry) {
                const rate = Number(entry.rate)
                const base = Number((entry.baseCalculation === 'LINE_TOTAL' ? lineTotal : item.taxBase || lineTotal).toFixed(2))
                onItemChange('taxRate', rate)
                onItemChange('taxBase', base)
                onItemChange('taxAmount', Number((base * rate / 100).toFixed(2)))
              }
            }}
          />
        </div>
        {hasTax ? (
          <>
            <div className="min-w-0 xl:col-start-2">
              <Label className="whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-foreground">Base IVA</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formatTwoDecimals(item.taxBase || 0)}
                disabled={disabled}
                className="h-8 min-w-0 px-2 text-right text-xs"
                onChange={(e) => {
                  const base = Number(e.target.value || 0)
                  onItemChange('taxBase', base)
                  onItemChange('taxAmount', Number(calcTaxAmount(base).toFixed(2)))
                }}
              />
            </div>
            <div className="min-w-0 xl:col-start-3">
              <Label className="whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-foreground">
                Tasa %
                {isTaxManual && <ShieldAlert className="ml-1 inline size-3 text-amber-500" />}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formatTwoDecimals(effectiveTaxRate)}
                disabled={disabled}
                className="h-8 min-w-0 px-2 text-right text-xs"
                onChange={(e) => {
                  const rate = Number(e.target.value || 0)
                  onItemChange('taxRate', rate)
                  onItemChange('taxAmount', Number((taxBase * rate / 100).toFixed(2)))
                }}
              />
            </div>
            <div className="min-w-0 xl:col-start-4">
              <Label className="whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-foreground">IVA</Label>
              <div className="flex h-8 items-center text-right text-sm font-medium tabular-nums text-rose-500">
                {sym} {formatTwoDecimals(taxAmount)}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="hidden xl:col-start-2 xl:block xl:invisible" aria-hidden="true" />
            <div className="hidden xl:col-start-3 xl:block xl:invisible" aria-hidden="true" />
            <div className="hidden xl:col-start-4 xl:block xl:invisible" aria-hidden="true" />
          </>
        )}
        <div className="min-w-0 xl:col-start-5">
          <Label className="whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-foreground">Retención</Label>
          <TaxTypeSelect
            type="WITHHOLDING"
            value={item.withholdingType || 'NONE'}
            disabled={disabled}
            onChange={(v) => {
              const entry = whEntries.find(e => e.code === v)
              onItemChange('withholdingType', v)
              if (entry && v !== 'NONE') {
                const base = Number((entry.baseCalculation === 'LINE_TOTAL' ? lineTotal : Number(item.withholdingBase || lineTotal)).toFixed(2))
                onItemChange('withholdingRate', entry.rate)
                onItemChange('withholdingBase', base)
              } else {
                onItemChange('withholdingRate', 0)
                onItemChange('withholdingBase', 0)
              }
            }}
          />
        </div>
        {hasWithholding ? (
          <>
            <div className="min-w-0 xl:col-start-6">
              <Label className="whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-foreground">Base Retención</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formatTwoDecimals(item.withholdingBase || 0)}
                disabled={disabled}
                className="h-8 min-w-0 px-2 text-right text-xs"
                onChange={(e) => onItemChange('withholdingBase', Number(e.target.value || 0))}
              />
            </div>
            <div className="min-w-0 xl:col-start-7">
              <Label className="whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-foreground">
                Tasa %
                {isWhManual && <ShieldAlert className="ml-1 inline size-3 text-amber-500" />}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formatTwoDecimals(effectiveWhRate)}
                disabled={disabled}
                className="h-8 min-w-0 px-2 text-right text-xs"
                onChange={(e) => onItemChange('withholdingRate', Number(e.target.value || 0))}
              />
            </div>
            <div className="min-w-0 xl:col-start-8">
              <Label className="whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-foreground">Monto Retenido</Label>
              <div className="flex h-8 items-center text-right text-sm font-medium tabular-nums text-amber-600">
                -{sym} {formatTwoDecimals(calcWhAmount(withholdingBase))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="hidden xl:col-start-6 xl:block xl:invisible" aria-hidden="true" />
            <div className="hidden xl:col-start-7 xl:block xl:invisible" aria-hidden="true" />
            <div className="hidden xl:col-start-8 xl:block xl:invisible" aria-hidden="true" />
          </>
        )}
      </div>
    </div>
  )
}
