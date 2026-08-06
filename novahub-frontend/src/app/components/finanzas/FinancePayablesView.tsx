import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { useCurrency } from '../../contexts/CurrencyContext'
import { useAuth } from '../../contexts/AuthContext'
import { supplierInvoicesService } from '../../services/compras.service'
import { toast } from 'sonner'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from 'recharts'
import { FINANCE_AXIS_TICK, FINANCE_GRID, FINANCE_TOOLTIP_WRAPPER, FinanceTooltipCard } from './financeChartTheme'

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#3b82f6']

export function FinancePayablesView() {
  const { displayCurrency, valuationMode, valuationModeSuffix, formatCurrentAmount, convertAmount, convertCurrentAmount } = useCurrency()
  const { user } = useAuth()
  const tenantKey = user?.clientTenantId || user?.tenantId || 'current'
  const sym = displayCurrency === 'USD' ? '$' : 'C$'
  const fmt = (n: number) => formatCurrentAmount(n, displayCurrency)
  const fmtShort = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return sym + (n / 1_000_000).toFixed(1) + 'M'
    if (Math.abs(n) >= 1_000) return sym + (n / 1_000).toFixed(1) + 'K'
    return sym + n.toLocaleString(undefined, { minimumFractionDigits: 0 })
  }

  const invoicesQuery = useQuery({
    queryKey: ['finance', 'supplier-invoices', tenantKey],
    queryFn: ({ signal }) => supplierInvoicesService.getAll({ page: 1, pageSize: 200 }, signal),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
  const invoices = useMemo(() => {
    const response: any = invoicesQuery.data
    return Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : [])
  }, [invoicesQuery.data])
  const loading = invoicesQuery.isLoading

  const pending = invoices.filter((inv: any) => { const s = String(inv.status || '').toUpperCase(); return s !== 'PAID' && s !== 'CANCELLED' && s !== 'CANCELED' })
  const balanceOf = (inv: any) => {
    const amount = Number(inv.balance ?? inv.balanceDue ?? (Number(inv.total || 0) - Number(inv.amountPaid || 0)))
    return valuationMode === 'CURRENT' ? convertCurrentAmount(amount, inv.currency) : convertAmount(amount, inv.currency, inv.exchangeRate)
  }
  const toDisplayAmount = (amount: number, currency?: string, rate?: number) => valuationMode === 'CURRENT'
    ? convertCurrentAmount(amount, currency)
    : convertAmount(amount, currency, rate)
  const totalPending = pending.reduce((a: number, inv: any) => a + balanceOf(inv), 0)
  const overdue = pending.filter((inv: any) => { const due = inv.dueDate ? new Date(inv.dueDate) : null; return due && due < new Date() })
  const totalOverdue = overdue.reduce((a: number, inv: any) => a + balanceOf(inv), 0)
  const notDue = totalPending - totalOverdue

  const agingData = ['0-30', '31-60', '61-90', '+90'].map(label => {
    const [min, max] = label === '+90' ? [91, Infinity] : label.split('-').map(Number)
    const total = overdue.filter((inv: any) => { const due = inv.dueDate ? new Date(inv.dueDate) : null; if (!due) return false; const days = Math.floor((new Date().getTime() - due.getTime()) / (1000 * 60 * 60 * 24)); return days >= min && days <= max }).reduce((a: number, inv: any) => a + balanceOf(inv), 0)
    return { label, amount: total }
  })

  const topCreditors = Object.entries(pending.reduce((acc: Record<string, number>, inv: any) => { const name = inv.supplier?.name || inv.supplierName || inv.supplier?.businessName || 'Proveedor'; acc[name] = (acc[name] || 0) + balanceOf(inv); return acc }, {})).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, amount]) => ({ name, amount }))

  return (
    <div className="min-w-0 space-y-6">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <AlertTriangle className="size-5 text-primary" />
        <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Cuentas por Pagar{valuationModeSuffix}</h3>
        <Badge variant="outline" className="text-xs">{pending.length} facturas pendientes</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total por Pagar{valuationModeSuffix}</p>
            <p className="text-2xl font-black tabular-nums text-amber-500">{fmt(totalPending)}</p>
          </CardContent>
        </Card>
        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vencido</p>
            <p className="text-2xl font-black tabular-nums text-rose-500">{fmt(totalOverdue)}</p>
          </CardContent>
        </Card>
        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Por Vencer</p>
            <p className="text-2xl font-black tabular-nums text-emerald-500">{fmt(notDue)}</p>
          </CardContent>
        </Card>
        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Facturas</p>
            <p className="text-2xl font-black tabular-nums text-foreground">{pending.length} / {invoices.length}</p>
            <p className="text-[9px] text-muted-foreground">pendientes / totales</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-0 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Antigüedad de Saldos</CardTitle>
            <p className="text-[10px] text-muted-foreground">Distribución de facturas vencidas por rango de días</p>
          </CardHeader>
          <CardContent className="min-w-0 overflow-visible px-2 pb-3">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={agingData} margin={{ top: 12, right: 20, left: 8, bottom: 14 }}>
                <defs><linearGradient id="ageG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.85} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0.55} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="4 4" stroke={FINANCE_GRID} opacity={0.45} vertical={false} />
                <XAxis dataKey="label" tick={FINANCE_AXIS_TICK} tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tick={FINANCE_AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtShort(v)} width={64} />
                <Tooltip content={<FinanceTooltipCard formatter={fmt} />} wrapperStyle={FINANCE_TOOLTIP_WRAPPER} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Bar dataKey="amount" fill="url(#ageG)" radius={[6, 6, 0, 0]} maxBarSize={52} onClick={(data: any) => toast.info(`CxP vencido ${data.label}: ${fmt(data.amount)}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-0 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Deuda por Proveedor</CardTitle>
            <p className="text-[10px] text-muted-foreground">Top 5 proveedores con mayor saldo pendiente</p>
          </CardHeader>
          <CardContent className="min-w-0 overflow-visible px-2 pb-3">
            {topCreditors.length === 0 ? (
              <p className="text-xs text-muted-foreground py-12 text-center">Sin proveedores con deuda</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topCreditors} layout="vertical" margin={{ top: 8, right: 20, left: 8, bottom: 14 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke={FINANCE_GRID} opacity={0.45} horizontal={false} />
                  <XAxis type="number" tick={FINANCE_AXIS_TICK} tickFormatter={(v: number) => fmtShort(v)} tickMargin={8} />
                  <YAxis dataKey="name" type="category" tick={{ ...FINANCE_AXIS_TICK, fill: 'var(--foreground)', fontWeight: 500 }} width={96} />
                  <Tooltip content={<FinanceTooltipCard formatter={fmt} />} wrapperStyle={FINANCE_TOOLTIP_WRAPPER} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Bar dataKey="amount" radius={[0, 5, 5, 0]} maxBarSize={32} onClick={(data: any) => toast.info(`${data.name}: ${fmt(data.amount)}`)} style={{ cursor: 'pointer' }}>
                    {topCreditors.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
        <CardHeader className="pb-2 px-5 pt-4">
          <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Facturas Pendientes con Proveedores</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {loading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Cargando...</div>
          ) : pending.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground"><CheckCircle2 className="size-8 mx-auto mb-2 text-emerald-500/50" /><p>No hay facturas pendientes de pago.</p></div>
          ) : (
            <div className="space-y-3">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 font-bold uppercase tracking-wider">Proveedor</th>
                  <th className="text-left py-2 font-bold uppercase tracking-wider">Factura</th>
                  <th className="text-left py-2 font-bold uppercase tracking-wider">Vencimiento</th>
                  <th className="text-right py-2 font-bold uppercase tracking-wider">Total</th>
                  <th className="text-right py-2 font-bold uppercase tracking-wider">Retenciones</th>
                  <th className="text-right py-2 font-bold uppercase tracking-wider">Saldo</th>
                  <th className="text-center py-2 font-bold uppercase tracking-wider">Estado</th>
                </tr></thead>
                <tbody>
                  {pending.map((inv: any) => {
                    const due = inv.dueDate ? new Date(inv.dueDate) : null
                    const daysOverdue = due ? Math.floor((new Date().getTime() - due.getTime()) / (1000 * 60 * 60 * 24)) : 0
                    return (
                      <tr key={inv.id} className="border-b border-border/20">
                        <td className="py-2 font-medium text-foreground">{inv.supplier?.name || inv.supplierName || inv.supplier?.businessName || '—'}</td>
                        <td className="py-2 font-mono text-primary">{inv.number || inv.code || '—'}</td>
                        <td className="py-2 text-muted-foreground">{due ? due.toLocaleDateString('es-NI') : '—'}</td>
                        <td className="py-2 text-right font-mono text-foreground">{fmt(toDisplayAmount(Number(inv.total || 0), inv.currency, inv.exchangeRate))}</td>
                        <td className="py-2 text-right font-mono text-amber-500">{fmt(toDisplayAmount(Number(inv.withholdingTotal || 0), inv.currency, inv.exchangeRate))}</td>
                        <td className="py-2 text-right font-black text-foreground">{fmt(balanceOf(inv))}</td>
                        <td className="py-2 text-center">
                          {daysOverdue > 0 ? <Badge variant="destructive" className="text-[9px]">{daysOverdue}d vencido</Badge> : <Badge variant="secondary" className="text-[9px]">Al día</Badge>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 md:hidden">
              {pending.map((inv: any) => {
                const due = inv.dueDate ? new Date(inv.dueDate) : null
                const daysOverdue = due ? Math.floor((new Date().getTime() - due.getTime()) / (1000 * 60 * 60 * 24)) : 0
                return (
                  <div key={inv.id} className="min-w-0 rounded-xl border border-border/40 bg-muted/20 p-3">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-xs font-bold text-foreground">{inv.supplier?.name || inv.supplierName || inv.supplier?.businessName || '—'}</p>
                        <p className="mt-1 text-[10px] font-mono text-primary">{inv.number || inv.code || '—'}</p>
                      </div>
                      {daysOverdue > 0 ? <Badge variant="destructive" className="shrink-0 text-[9px]">{daysOverdue}d vencido</Badge> : <Badge variant="secondary" className="shrink-0 text-[9px]">Al día</Badge>}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/30 pt-3 text-[10px]">
                      <div><span className="block text-muted-foreground">Vencimiento</span><span>{due ? due.toLocaleDateString('es-NI') : '—'}</span></div>
                      <div><span className="block text-muted-foreground">Total</span><span className="font-mono">{fmt(toDisplayAmount(Number(inv.total || 0), inv.currency, inv.exchangeRate))}</span></div>
                      <div><span className="block text-muted-foreground">Retenciones</span><span className="font-mono text-amber-500">{fmt(toDisplayAmount(Number(inv.withholdingTotal || 0), inv.currency, inv.exchangeRate))}</span></div>
                      <div><span className="block text-muted-foreground">Saldo</span><span className="font-black">{fmt(balanceOf(inv))}</span></div>
                    </div>
                  </div>
                )
              })}
            </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
