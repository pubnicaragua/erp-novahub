import { useQuery } from '@tanstack/react-query'
import { Landmark, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { useCurrency } from '../../contexts/CurrencyContext'
import { accountsService } from '../../services/finanzas.service'
import { invoicesService } from '../../services/ventas.service'
import { supplierInvoicesService, paymentsMadeService } from '../../services/compras.service'
import { toast } from 'sonner'
import { useAuth } from '../../contexts/AuthContext'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, ComposedChart, Cell, Legend,
} from 'recharts'
import { FINANCE_AXIS_TICK, FINANCE_GRID, FINANCE_TOOLTIP_WRAPPER, FinanceTooltipCard } from './financeChartTheme'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316']

export function FinanceCashView() {
  const { displayCurrency } = useCurrency()
  const { user } = useAuth()
  const tenantKey = user?.clientTenantId || user?.tenantId || 'current'
  const sym = displayCurrency === 'USD' ? '$' : 'C$'
  const fmt = (n: number) => sym + ' ' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtShort = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return sym + (n / 1_000_000).toFixed(1) + 'M'
    if (Math.abs(n) >= 1_000) return sym + (n / 1_000).toFixed(1) + 'K'
    return sym + n.toLocaleString(undefined, { minimumFractionDigits: 0 })
  }

  const toList = (response: any) => Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : [])
  const accountsQuery = useQuery({ queryKey: ['finance', 'accounts', tenantKey], queryFn: ({ signal }) => accountsService.getAll({ page: 1, pageSize: 500 }, signal), staleTime: 60_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false, retry: 1 })
  const salesInvoicesQuery = useQuery({ queryKey: ['finance', 'sales-invoices', tenantKey], queryFn: ({ signal }) => invoicesService.getAll({ page: 1, pageSize: 200 }, signal), staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1 })
  const supplierInvoicesQuery = useQuery({ queryKey: ['finance', 'supplier-invoices', tenantKey], queryFn: ({ signal }) => supplierInvoicesService.getAll({ page: 1, pageSize: 200 }, signal), staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1 })
  const paymentsQuery = useQuery({ queryKey: ['finance', 'payments-made', tenantKey], queryFn: ({ signal }) => paymentsMadeService.getAll({ page: 1, pageSize: 200 }, signal), staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1 })
  const bankAccounts = toList(accountsQuery.data).filter((a: any) => ['CASH', 'BANK'].includes(String(a.subtype || '').toUpperCase()) || String(a.name || '').toUpperCase().includes('CAJA') || String(a.name || '').toUpperCase().includes('BANCO'))
  const salesInvoices = toList(salesInvoicesQuery.data)
  const supplierInvoices = toList(supplierInvoicesQuery.data)
  const paymentsMade = toList(paymentsQuery.data)
  const loading = [accountsQuery, salesInvoicesQuery, supplierInvoicesQuery, paymentsQuery].some(query => query.isLoading)

  const totalBalance = bankAccounts.reduce((a, acc: any) => a + Number(acc.balance || 0), 0)
  const cashAccounts = bankAccounts.filter((a: any) => String(a.subtype || '').toUpperCase() === 'CASH')
  const bankAccs = bankAccounts.filter((a: any) => String(a.subtype || '').toUpperCase() !== 'CASH')
  const cashTotal = cashAccounts.reduce((a: number, ac: any) => a + Number(ac.balance || 0), 0)
  const bankTotal = bankAccs.reduce((a: number, ac: any) => a + Number(ac.balance || 0), 0)

  // Aggregate real monthly data from invoices + payments
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const now = new Date()
  const balanceHistory = months.slice(0, now.getMonth() + 1).map((month, i) => {
    const m = String(i + 1).padStart(2, '0')
    const y = now.getFullYear()
    const entradas = salesInvoices
      .filter((inv: any) => { const d = inv.date || inv.createdAt; return d && d.startsWith(`${y}-${m}`) && String(inv.status || '').toUpperCase() !== 'CANCELLED' })
      .reduce((a: number, inv: any) => a + Number(inv.total || 0), 0)
    const salidas = supplierInvoices
      .filter((inv: any) => { const d = inv.date || inv.createdAt; return d && d.startsWith(`${y}-${m}`) && String(inv.status || '').toUpperCase() !== 'CANCELLED' })
      .reduce((a: number, inv: any) => a + Number(inv.total || 0), 0)
    const pags = paymentsMade
      .filter((p: any) => { const d = p.date || p.createdAt; return d && d.startsWith(`${y}-${m}`) })
      .reduce((a: number, p: any) => a + Number(p.amount || 0), 0)
    return { month, saldo: entradas - salidas - pags, entradas, salidas: salidas + pags }
  })

  const distribution = [
    ...bankAccs.map((a: any) => ({ name: a.name || 'Banco', value: Number(a.balance || 0) })),
    ...cashAccounts.map((a: any) => ({ name: a.name || 'Caja', value: Number(a.balance || 0) })),
  ]
  if (distribution.length === 0) distribution.push({ name: 'Efectivo', value: 0 }, { name: 'Bancos', value: 0 })

  const subtypeLabel = (s: string) => {
    const map: Record<string, string> = { CASH: 'Efectivo', BANK: 'Banco', DETAIL_ACCOUNT: 'Cuenta Detalle', GROUP_ACCOUNT: 'Cuenta Grupo', PRINCIPAL_ACCOUNT: 'Cuenta Principal' }
    return map[s?.toUpperCase()] || s?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()) || '—'
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saldo Total Disponible</p>
            <p className="text-2xl font-black tabular-nums text-primary">{fmt(totalBalance)}</p>
            <p className="text-[9px] text-muted-foreground mt-1">{bankAccounts.length} cuenta(s) · {cashAccounts.length} caja(s) · {bankAccs.length} banco(s)</p>
          </CardContent>
        </Card>
        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">En Efectivo (Cajas)</p>
            <p className="text-lg font-black tabular-nums text-emerald-500">{fmt(cashTotal)}</p>
          </CardContent>
        </Card>
        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">En Bancos</p>
            <p className="text-lg font-black tabular-nums text-blue-500">{fmt(bankTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-0 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Evolución del Saldo</CardTitle>
            <p className="text-[10px] text-muted-foreground">Entradas y salidas de efectivo por mes</p>
          </CardHeader>
          <CardContent className="min-w-0 overflow-visible px-2 pb-3">
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={balanceHistory} margin={{ top: 12, right: 20, left: 8, bottom: 14 }}>
                <defs><linearGradient id="balG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity={0.25} /><stop offset="100%" stopColor="#06b6d4" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="4 4" stroke={FINANCE_GRID} opacity={0.45} vertical={false} />
                <XAxis dataKey="month" tick={FINANCE_AXIS_TICK} tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tick={FINANCE_AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v: number) => sym + (v / 1000).toFixed(0) + 'K'} width={64} />
                <Tooltip content={<FinanceTooltipCard formatter={fmt} />} wrapperStyle={FINANCE_TOOLTIP_WRAPPER} cursor={{ stroke: '#06b6d4', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Legend verticalAlign="bottom" height={28} formatter={(value: string) => <span style={{ color: 'var(--foreground)', fontWeight: 600, fontSize: 11 }}>{value}</span>} />
                <Area dataKey="saldo" fill="url(#balG)" stroke="#06b6d4" strokeWidth={2.5} type="monotone" dot={{ r: 3, fill: '#06b6d4', strokeWidth: 0 }} />
                <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} onClick={(data: any) => toast.info(`Entradas ${data.month}: ${fmt(data.entradas)}`)} style={{ cursor: 'pointer' }} />
                <Bar dataKey="salidas" name="Salidas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} onClick={(data: any) => toast.info(`Salidas ${data.month}: ${fmt(data.salidas)}`)} style={{ cursor: 'pointer' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-0 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Distribución del Dinero</CardTitle>
            <p className="text-[10px] text-muted-foreground">Por caja o cuenta bancaria</p>
          </CardHeader>
          <CardContent className="min-w-0 overflow-visible px-2 pb-3">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={distribution} layout="vertical" margin={{ top: 8, right: 20, left: 8, bottom: 14 }}>
                <CartesianGrid strokeDasharray="4 4" stroke={FINANCE_GRID} opacity={0.45} horizontal={false} />
                <XAxis type="number" tick={FINANCE_AXIS_TICK} tickFormatter={(v: number) => fmtShort(v)} tickMargin={8} />
                <YAxis dataKey="name" type="category" tick={{ ...FINANCE_AXIS_TICK, fill: 'var(--foreground)', fontWeight: 500 }} width={112} />
                <Tooltip content={<FinanceTooltipCard formatter={fmt} />} wrapperStyle={FINANCE_TOOLTIP_WRAPPER} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={32} onClick={(data: any) => toast.info(`${data.name}: ${fmt(data.value)}`)} style={{ cursor: 'pointer' }}>
                  {distribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
        <CardHeader className="pb-2 px-5 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Cuentas Bancarias y Cajas</CardTitle>
            <Badge variant="outline" className="text-[10px]">{bankAccounts.length} cuentas</Badge>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {loading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Cargando...</div>
          ) : bankAccounts.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <Wallet className="size-8 mx-auto mb-2 text-muted-foreground/30" />
              <p>No hay cuentas bancarias o cajas configuradas.</p>
              <p className="text-xs mt-1">Configure cuentas de tipo CASH o BANK en el Plan de Cuentas (Contabilidad).</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 font-bold uppercase tracking-wider">Cuenta</th>
                  <th className="text-left py-2 font-bold uppercase tracking-wider">Tipo</th>
                  <th className="text-left py-2 font-bold uppercase tracking-wider">Moneda</th>
                  <th className="text-right py-2 font-bold uppercase tracking-wider">Saldo</th>
                </tr></thead>
                <tbody>
                  {bankAccounts.map((acc: any) => (
                    <tr key={acc.id} className="border-b border-border/20">
                      <td className="py-2 font-mono text-foreground">{acc.code} - {acc.name}</td>
                      <td className="py-2"><Badge variant="secondary" className="text-[10px]">{subtypeLabel(acc.subtype || acc.type)}</Badge></td>
                      <td className="py-2 text-muted-foreground">{acc.currency || 'NIO'}</td>
                      <td className="py-2 text-right font-black tabular-nums text-foreground">{fmt(Number(acc.balance || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
