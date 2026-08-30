import { Calendar, CalendarClock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { useCurrency } from '../../contexts/CurrencyContext'
import { normalizeCurrency, summarizeAmountsByCurrency, type SupportedCurrency } from '../../utils/currency'

interface Props { recurringExpenses: any[]; recurringIncomes?: any[] }

export function FinanceCalendarView({ recurringExpenses, recurringIncomes }: Props) {
  const { baseCurrency, displayMode, valuationMode, valuationModeSuffix, formatCurrentAmount, formatExplicitAmount, convertAmount, convertCurrentAmount } = useCurrency()
  const fmt = (n: number) => formatCurrentAmount(n, baseCurrency)

  const activeRecExpenses = (recurringExpenses || []).filter((r: any) => r.status === 'ACTIVE' && Number(r.amount) > 0)
  const activeRecIncomes = (recurringIncomes || []).filter((r: any) => r.status === 'ACTIVE' && Number(r.amount) > 0)
  const toBase = (r: any) => valuationMode === 'CURRENT'
    ? convertCurrentAmount(Number(r.amount ?? r.baseAmount ?? 0), r.currency)
    : convertAmount(Number(r.amount ?? r.baseAmount ?? 0), r.currency, r.exchangeRate)
  const totalMonthlyExpenses = activeRecExpenses.reduce((a, r) => a + toBase(r), 0)
  const totalMonthlyIncomes = activeRecIncomes.reduce((a, r) => a + toBase(r), 0)
  const recurringRows = [...activeRecExpenses, ...activeRecIncomes]
  const originalCurrencies = summarizeAmountsByCurrency(
    recurringRows,
    (r) => Number(r.amount ?? r.baseAmount ?? 0),
    (r) => r.currency,
    baseCurrency,
  )
  const originalExpenses = summarizeAmountsByCurrency(
    activeRecExpenses,
    (r) => Number(r.amount ?? r.baseAmount ?? 0),
    (r) => r.currency,
    baseCurrency,
  )
  const originalIncomes = summarizeAmountsByCurrency(
    activeRecIncomes,
    (r) => Number(r.amount ?? r.baseAmount ?? 0),
    (r) => r.currency,
    baseCurrency,
  )
  const projectedByCurrency = [...new Set(originalCurrencies.map((item) => item.currency))].map((currency) => ({
    currency,
    amount: (originalIncomes.find((item) => item.currency === currency)?.amount || 0)
      - (originalExpenses.find((item) => item.currency === currency)?.amount || 0),
    count: 0,
  }))
  const renderMoneyKpi = (label: string, amount: number, breakdown: Array<{ currency: SupportedCurrency; amount: number }>, color: string) => displayMode === 'ORIGINAL'
    ? breakdown.map((item) => (
      <p key={`${label}-${item.currency}`} className={`text-2xl font-black tabular-nums ${color}`}>
        {formatExplicitAmount(item.amount, item.currency)}
      </p>
    ))
    : <p className={`text-2xl font-black tabular-nums ${color}`}>{fmt(amount)}</p>

  return (
    <div className="min-w-0 space-y-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <CalendarClock className="size-5 text-primary" />
        <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Calendario Financiero{valuationModeSuffix}</h3>
        <Badge variant="outline" className="text-xs">{activeRecExpenses.length + activeRecIncomes.length} compromisos activos</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Compromisos Mensuales</p>
            {renderMoneyKpi('Compromisos Mensuales', totalMonthlyExpenses, originalExpenses, 'text-rose-500')}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ingresos Mensuales Esperados</p>
            {renderMoneyKpi('Ingresos Mensuales Esperados', totalMonthlyIncomes, originalIncomes, 'text-emerald-500')}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saldo Proyectado Mensual</p>
            {renderMoneyKpi('Saldo Proyectado Mensual', totalMonthlyIncomes - totalMonthlyExpenses, projectedByCurrency, totalMonthlyIncomes - totalMonthlyExpenses >= 0 ? 'text-emerald-500' : 'text-rose-500')}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
        <CardHeader className="pb-3 px-5 pt-4">
          <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Próximos Compromisos</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {activeRecExpenses.length === 0 && activeRecIncomes.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Calendar className="size-8 mx-auto mb-2 text-muted-foreground/30" />
              <p>No hay compromisos programados.</p>
              <p className="text-xs mt-1">Configure movimientos recurrentes para ver proyecciones en el calendario.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeRecExpenses.map((r: any) => (
                <div key={r.id} className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2">
                  <div className="min-w-0">
                    <p className="break-words text-xs font-bold text-foreground">{r.description || r.source}</p>
                    <p className="text-[10px] text-muted-foreground">{r.frequency} · Próxima: {r.nextDate ? new Date(r.nextDate).toLocaleDateString('es-NI') : 'Pendiente'}</p>
                  </div>
                  <span className="shrink-0 text-right text-xs font-black text-rose-500">-{displayMode === 'ORIGINAL' ? formatExplicitAmount(Number(r.amount ?? r.baseAmount ?? 0), normalizeCurrency(r.currency || baseCurrency)) : fmt(toBase(r))}</span>
                </div>
              ))}
              {activeRecIncomes.map((r: any) => (
                <div key={r.id} className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                  <div className="min-w-0">
                    <p className="break-words text-xs font-bold text-foreground">{r.description || r.source}</p>
                    <p className="text-[10px] text-muted-foreground">{r.frequency} · Próxima: {r.nextDate ? new Date(r.nextDate).toLocaleDateString('es-NI') : 'Pendiente'}</p>
                  </div>
                  <span className="shrink-0 text-right text-xs font-black text-emerald-500">+{displayMode === 'ORIGINAL' ? formatExplicitAmount(Number(r.amount ?? r.baseAmount ?? 0), normalizeCurrency(r.currency || baseCurrency)) : fmt(toBase(r))}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
