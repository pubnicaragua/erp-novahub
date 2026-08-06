import { Calendar, CalendarClock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { useCurrency } from '../../contexts/CurrencyContext'

interface Props { recurringExpenses: any[]; recurringIncomes?: any[] }

export function FinanceCalendarView({ recurringExpenses, recurringIncomes }: Props) {
  const { displayCurrency, convertAmount } = useCurrency()
  const sym = displayCurrency === 'USD' ? '$' : 'C$'
  const fmt = (n: number) => sym + ' ' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const activeRecExpenses = (recurringExpenses || []).filter((r: any) => r.status === 'ACTIVE' && Number(r.amount) > 0)
  const activeRecIncomes = (recurringIncomes || []).filter((r: any) => r.status === 'ACTIVE' && Number(r.amount) > 0)
  const totalMonthlyExpenses = activeRecExpenses.reduce((a, r) => a + convertAmount(r.amount || 0, r.currency, r.exchangeRate), 0)
  const totalMonthlyIncomes = activeRecIncomes.reduce((a, r) => a + convertAmount(r.amount || 0, r.currency, r.exchangeRate), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock className="size-5 text-primary" />
        <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Calendario Financiero</h3>
        <Badge variant="outline" className="text-xs">{activeRecExpenses.length + activeRecIncomes.length} compromisos activos</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Compromisos Mensuales</p>
            <p className="text-2xl font-black tabular-nums text-rose-500">{fmt(totalMonthlyExpenses)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ingresos Mensuales Esperados</p>
            <p className="text-2xl font-black tabular-nums text-emerald-500">{fmt(totalMonthlyIncomes)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saldo Proyectado Mensual</p>
            <p className={`text-2xl font-black tabular-nums ${totalMonthlyIncomes - totalMonthlyExpenses >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{fmt(totalMonthlyIncomes - totalMonthlyExpenses)}</p>
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
                <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <div>
                    <p className="text-xs font-bold text-foreground">{r.description || r.source}</p>
                    <p className="text-[10px] text-muted-foreground">{r.frequency} · Próxima: {r.nextDate ? new Date(r.nextDate).toLocaleDateString('es-NI') : 'Pendiente'}</p>
                  </div>
                  <span className="text-xs font-black text-rose-500">-{fmt(convertAmount(r.amount || 0, r.currency, r.exchangeRate))}</span>
                </div>
              ))}
              {activeRecIncomes.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div>
                    <p className="text-xs font-bold text-foreground">{r.description || r.source}</p>
                    <p className="text-[10px] text-muted-foreground">{r.frequency} · Próxima: {r.nextDate ? new Date(r.nextDate).toLocaleDateString('es-NI') : 'Pendiente'}</p>
                  </div>
                  <span className="text-xs font-black text-emerald-500">+{fmt(convertAmount(r.amount || 0, r.currency, r.exchangeRate))}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
