import { useMemo } from 'react'
import { Landmark } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { useCurrency } from '../../contexts/CurrencyContext'
import { normalizeCurrency, summarizeAmountsByCurrency, type SupportedCurrency } from '../../utils/currency'

interface Props { incomes: any[]; expenses: any[]; accounts?: any[] }

export function FinanceGeneralBalanceView({ incomes, expenses, accounts }: Props) {
  const { displayCurrency, displayMode, valuationMode, valuationModeSuffix, formatCurrentAmount, convertAmount, convertCurrentAmount, formatExplicitAmount } = useCurrency()
  const fmt = (n: number) => formatCurrentAmount(n, displayCurrency)
  const toDisplayAmount = (amount: number, currency?: string, rate?: number) => valuationMode === 'CURRENT'
    ? convertCurrentAmount(amount, currency)
    : convertAmount(amount, currency, rate)

  const totalIncome = useMemo(() => incomes.reduce((a, i) => a + toDisplayAmount(Number(i.amount ?? i.baseAmount ?? 0), i.currency, i.exchangeRate), 0), [incomes, valuationMode, convertAmount, convertCurrentAmount])
  const totalExpense = useMemo(() => expenses.reduce((a, e) => a + toDisplayAmount(Number(e.amount ?? e.baseAmount ?? 0), e.currency, e.exchangeRate), 0), [expenses, valuationMode, convertAmount, convertCurrentAmount])
  const netIncome = totalIncome - totalExpense

  const assetAccounts = (accounts || []).filter((a: any) => String(a.type || '').toUpperCase() === 'ASSET')
  const liabilityAccounts = (accounts || []).filter((a: any) => String(a.type || '').toUpperCase() === 'LIABILITY')
  const equityAccounts = (accounts || []).filter((a: any) => String(a.type || '').toUpperCase() === 'EQUITY')
  const totalAssets = assetAccounts.reduce((a: number, acc: any) => a + toDisplayAmount(Number(acc.balance || 0), acc.currency, acc.exchangeRate), 0)
  const totalLiabilities = liabilityAccounts.reduce((a: number, acc: any) => a + toDisplayAmount(Number(acc.balance || 0), acc.currency, acc.exchangeRate), 0)
  const totalEquity = equityAccounts.reduce((a: number, acc: any) => a + toDisplayAmount(Number(acc.balance || 0), acc.currency, acc.exchangeRate), 0)
  const totalLiabilitiesEquity = totalLiabilities + totalEquity + netIncome
  const difference = totalAssets - totalLiabilitiesEquity
  const allAccounts = [...assetAccounts, ...liabilityAccounts, ...equityAccounts]
  const originalCurrencies = summarizeAmountsByCurrency([...incomes, ...expenses, ...allAccounts], () => 0, (row: any) => row.currency).map((item) => item.currency)
  const originalSum = (rows: any[], amountOf: (row: any) => number, currency: SupportedCurrency) => rows
    .filter((row) => normalizeCurrency(row.currency) === currency)
    .reduce((sum, row) => sum + (Number.isFinite(amountOf(row)) ? amountOf(row) : 0), 0)
  const originalIncome = (currency: SupportedCurrency) => originalSum(incomes, (row) => Number(row.amount ?? row.baseAmount ?? 0), currency)
  const originalExpense = (currency: SupportedCurrency) => originalSum(expenses, (row) => Number(row.amount ?? row.baseAmount ?? 0), currency)
  const originalAssets = (currency: SupportedCurrency) => originalSum(assetAccounts, (row) => Number(row.balance || 0), currency)
  const originalLiabilities = (currency: SupportedCurrency) => originalSum(liabilityAccounts, (row) => Number(row.balance || 0), currency)
  const originalEquity = (currency: SupportedCurrency) => originalSum(equityAccounts, (row) => Number(row.balance || 0), currency)
  const formatAccountBalance = (account: any) => displayMode === 'ORIGINAL'
    ? formatExplicitAmount(Number(account.balance || 0), normalizeCurrency(account.currency))
    : fmt(toDisplayAmount(Number(account.balance || 0), account.currency, account.exchangeRate))
  const renderSummaryKpi = (label: string, total: number, color: string, amountByCurrency: (currency: SupportedCurrency) => number, detail: (currency: SupportedCurrency) => string) => displayMode === 'ORIGINAL'
    ? originalCurrencies.map((currency) => <Card key={`${label}-${currency}`} className="rounded-2xl border-border/40 bg-card shadow-sm"><CardContent className="p-4"><p className={`text-[10px] font-black uppercase tracking-widest ${color}`}>{label} ({currency})</p><p className={`text-2xl font-black tabular-nums ${color}`}>{formatExplicitAmount(amountByCurrency(currency), currency)}</p><p className="mt-1 text-[10px] text-muted-foreground">{detail(currency)}</p></CardContent></Card>)
    : <Card className="rounded-2xl border-border/40 bg-card shadow-sm"><CardContent className="p-4"><p className={`text-[10px] font-black uppercase tracking-widest ${color}`}>{label}{valuationModeSuffix}</p><p className={`text-2xl font-black tabular-nums ${color}`}>{fmt(total)}</p><p className="mt-1 text-[10px] text-muted-foreground">{formatCurrencyLabel(displayCurrency)}</p></CardContent></Card>
  const formatCurrencyLabel = (currency: string) => currency === 'USD' ? 'Dólar estadounidense' : 'Córdoba nicaragüense'

  return (
    <div className="min-w-0 space-y-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Landmark className="size-5 text-primary" />
        <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Balance General{valuationModeSuffix}</h3>
        <Badge variant="outline" className="text-xs">Al {new Date().toLocaleDateString('es-NI')}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {renderSummaryKpi('Activos', totalAssets, 'text-emerald-500', originalAssets, (currency) => `${assetAccounts.filter((account: any) => normalizeCurrency(account.currency) === currency).length} cuenta(s)`)}
        {renderSummaryKpi('Pasivos', totalLiabilities, 'text-rose-500', originalLiabilities, (currency) => `${liabilityAccounts.filter((account: any) => normalizeCurrency(account.currency) === currency).length} cuenta(s)`)}
        {renderSummaryKpi('Patrimonio', totalEquity + netIncome, 'text-primary', (currency) => originalEquity(currency) + originalIncome(currency) - originalExpense(currency), (currency) => `Utilidad del período: ${formatExplicitAmount(originalIncome(currency) - originalExpense(currency), currency)}`)}
      </div>

      <div className={`text-xs text-center py-4 px-4 rounded-xl ${Math.abs(difference) > 1 ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-emerald-500/5 border border-emerald-500/20'}`}>
        <p className={Math.abs(difference) > 1 ? 'text-rose-500' : 'text-emerald-500'}>
          {displayMode === 'ORIGINAL' ? originalCurrencies.map((currency) => {
            const assets = originalAssets(currency); const liabilities = originalLiabilities(currency); const equity = originalEquity(currency) + originalIncome(currency) - originalExpense(currency);
            return <span key={currency} className="block">Activos ({formatExplicitAmount(assets, currency)}) = Pasivos ({formatExplicitAmount(liabilities, currency)}) + Patrimonio ({formatExplicitAmount(equity, currency)})</span>;
          }) : <>Activos ({fmt(totalAssets)}) = Pasivos ({fmt(totalLiabilities)}) + Patrimonio ({fmt(totalEquity + netIncome)})</>}
        </p>
        {displayMode === 'ORIGINAL' ? originalCurrencies.map((currency) => {
          const assets = originalAssets(currency); const liabilities = originalLiabilities(currency); const equity = originalEquity(currency) + originalIncome(currency) - originalExpense(currency); const currencyDifference = assets - liabilities - equity;
          return Math.abs(currencyDifference) > 1 ? <p key={currency} className="text-rose-400 font-bold mt-1">Diferencia ({currency}): {formatExplicitAmount(currencyDifference, currency)} — Revisar saldos de cuentas contables</p> : <p key={currency} className="text-emerald-400 mt-1">✓ Balance {currency} cuadra correctamente</p>;
        }) : Math.abs(difference) > 1 ? (
          <p className="text-rose-400 font-bold mt-1">
            Diferencia: {fmt(difference)} — Revisar saldos de cuentas contables
          </p>
        ) : (
          <p className="text-emerald-400 mt-1">✓ Balance cuadra correctamente</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-3 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Activos</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {assetAccounts.length === 0 ? (
              <p className="text-center py-6 text-xs text-muted-foreground">Sin cuentas de activo configuradas</p>
            ) : (
              assetAccounts.map((acc: any) => (
                <div key={acc.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-border/20 py-1.5 text-xs">
                  <span className="min-w-0 break-words font-mono text-foreground">{acc.code} - {acc.name}</span>
                  <span className="shrink-0 text-right font-black text-emerald-500">{formatAccountBalance(acc)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-3 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Pasivos + Patrimonio</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {[...liabilityAccounts, ...equityAccounts].length === 0 ? (
              <p className="text-center py-6 text-xs text-muted-foreground">Sin cuentas de pasivo/patrimonio configuradas</p>
            ) : (
              [...liabilityAccounts, ...equityAccounts].map((acc: any) => (
                <div key={acc.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-border/20 py-1.5 text-xs">
                  <span className="min-w-0 break-words font-mono text-foreground">{acc.code} - {acc.name}</span>
                  <span className="shrink-0 text-right font-black text-foreground">{formatAccountBalance(acc)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
