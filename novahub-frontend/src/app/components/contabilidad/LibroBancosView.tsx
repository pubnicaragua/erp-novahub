import { Fragment, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Landmark, Calendar, ChevronDown, ChevronLeft, ChevronRight, Banknote, AlertTriangle, Loader2, Network
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../ui/table';
import { Combobox } from '../ui/Combobox';
import { contabilidadService } from '../../services/contabilidad.service';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
import { ViewConnectionsDialog, type ViewConnection } from './ViewConnectionsDialog';

const currentMonth = new Date().toISOString().slice(0, 7);

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: 'Cuenta corriente',
  SAVINGS: 'Cuenta de ahorro',
  CURRENT: 'Cuenta corriente',
  SAVING: 'Cuenta de ahorro',
};

const MONTH_LABELS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const formatMonthLabel = (value: string) => {
  if (!/^\d{4}-\d{2}$/.test(value)) return 'Seleccionar mes';
  const [year, mon] = value.split('-').map(Number);
  return `${MONTH_LABELS_SHORT[mon - 1]} ${year}`;
};

const BOOK_CONNECTIONS: ViewConnection[] = [
  {
    id: 'diario',
    label: 'Libro Diario',
    description: 'Cada movimiento de este libro aparece como un asiento en el Libro Diario, generado automáticamente desde los cierres de caja, facturas y pagos.',
    relation: 'Alimenta',
    direction: 'feeds',
  },
  {
    id: 'libro-mayor',
    label: 'Libro Mayor',
    description: 'La cuenta de banco vinculada agrega sus movimientos por cuenta en el Libro Mayor. Revisa los saldos por cuenta bancaria desde allí.',
    relation: 'Alimenta',
    direction: 'feeds',
  },
  {
    id: 'balance-comprobacion',
    label: 'Balance de Comprobación',
    description: 'El saldo de la cuenta de banco se incluye en el balance de comprobación del período correspondiente.',
    relation: 'Alimenta',
    direction: 'feeds',
  },
  {
    id: 'conciliacion',
    label: 'Conciliación Bancaria',
    description: 'El libro diario de bancos es independiente de la conciliación: esta valida el cuadre mensual contra el estado de cuenta del banco.',
    relation: 'Valida por separado',
    direction: 'validates',
  },
  {
    id: 'flujo-efectivo',
    label: 'Flujo de Efectivo',
    description: 'Las cuentas vinculadas a bancos se toman como cuentas de efectivo para calcular el flujo del período.',
    relation: 'Alimenta',
    direction: 'feeds',
  },
  {
    id: 'balance-general-contable',
    label: 'Balance General',
    description: 'El saldo de la cuenta de banco forma parte de los activos corrientes del balance general.',
    relation: 'Alimenta',
    direction: 'feeds',
  },
];

const formatAmount = (value: any, currency?: string) => {
  const symbol = currency === 'USD' ? 'US$' : 'C$';
  return `${symbol} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
};

export function LibroBancosView({ onGoToSection }: { onGoToSection?: (sectionId: string) => void }) {
  const queryClient = useQueryClient();
  const [bankAccountId, setBankAccountId] = useState('');
  const [month, setMonth] = useState(currentMonth);
  const [monthOpen, setMonthOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => Number(currentMonth.split('-')[0]));
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [connectionsOpen, setConnectionsOpen] = useState(false);

  const handleMonthOpenChange = (open: boolean) => {
    setMonthOpen(open);
    if (open && /^\d{4}-\d{2}$/.test(month)) setViewYear(Number(month.split('-')[0]));
  };

  const bankAccountsQuery = useAccountingQuery<any[]>(['bank-accounts'], async (signal) => accountingList(await api.get('/bank-accounts', { signal })));
  const bankAccounts = (bankAccountsQuery.data || []).filter((bank: any) => bank.isActive !== false && bank.accountId);

  const { dateFrom, dateTo } = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return { dateFrom: undefined, dateTo: undefined };
    }
    const [year, mon] = month.split('-').map(Number);
    const today = new Date();
    const isCurrentMonth = year === today.getFullYear() && mon === today.getMonth() + 1;
    return {
      dateFrom: `${year}-${String(mon).padStart(2, '0')}-01`,
      dateTo: isCurrentMonth ? today.toISOString().slice(0, 10) : new Date(year, mon, 0).toISOString().slice(0, 10),
    };
  }, [month]);

  const bookQuery = useAccountingQuery<any>(
    ['bank-daily-book', bankAccountId || 'all', month],
    async (signal) => contabilidadService.getBankDailyBook(
      { ...(bankAccountId ? { bankAccountId } : {}), dateFrom, dateTo },
      signal,
    ),
    { enabled: !!dateFrom && !!dateTo },
  );
  const books: any[] = bookQuery.data?.books || [];
  const loading = bookQuery.isLoading || bankAccountsQuery.isLoading;

  const toggleDay = (key: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['accounting'] });
    toast.success('Libro actualizado');
  };

  return (
    <div className="min-w-0 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Libro Diario de Bancos</h2>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:gap-3">
          <Combobox
            options={[
              { label: 'Todos los bancos', value: '__all' },
              ...bankAccounts.map((bank: any) => ({
                label: `${bank.bankName} · ${bank.accountNumber}${bank.currency ? ` (${bank.currency})` : ''}`,
                value: bank.id,
              })),
            ]}
            value={bankAccountId || '__all'}
            onChange={(value) => setBankAccountId(value === '__all' ? '' : value)}
            placeholder="Seleccionar banco"
            searchPlaceholder="Buscar banco o cuenta..."
            maxVisibleOptions={100}
            className="col-span-2 h-10 w-full min-w-0 text-xs sm:col-span-1 sm:w-60 sm:shrink-0"
            emptyMessage="No se encontraron bancos con cuenta contable vinculada."
          />
          <div className="relative col-span-1">
            <Popover open={monthOpen} onOpenChange={handleMonthOpenChange}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-10 w-full items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 text-[10px] font-bold tracking-widest transition-colors hover:bg-muted/50 sm:w-44 sm:shrink-0"
                >
                  <Calendar className="size-4 shrink-0 text-muted-foreground/40" />
                  <span className="truncate">{formatMonthLabel(month)}</span>
                  <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground/40" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Button variant="ghost" size="icon" className="size-7 rounded-lg" onClick={() => setViewYear((v) => v - 1)} aria-label="Año anterior">
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-xs font-black uppercase tracking-widest">{viewYear}</span>
                  <Button variant="ghost" size="icon" className="size-7 rounded-lg" onClick={() => setViewYear((v) => v + 1)} aria-label="Año siguiente">
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {MONTH_LABELS_SHORT.map((label, index) => {
                    const value = `${viewYear}-${String(index + 1).padStart(2, '0')}`;
                    const isSelected = month === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => { setMonth(value); setMonthOpen(false); }}
                        className={cn(
                          'h-9 rounded-lg text-[11px] font-black uppercase tracking-wider transition-colors',
                          isSelected
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 h-8 w-full text-[10px] font-black uppercase tracking-widest"
                  onClick={() => { setMonth(currentMonth); setMonthOpen(false); }}
                >
                  Este mes
                </Button>
              </PopoverContent>
            </Popover>
          </div>
          <Button
            variant="outline"
            onClick={refresh}
            className="col-span-1 h-10 w-full whitespace-nowrap rounded-xl border-border/50 text-[10px] font-black uppercase tracking-widest sm:w-36 sm:shrink-0"
          >
            Actualizar
          </Button>
          <Button
            variant="outline"
            onClick={() => setConnectionsOpen(true)}
            className="col-span-2 h-10 w-full whitespace-nowrap gap-1.5 rounded-xl border-primary/30 bg-primary/5 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 sm:col-span-1 sm:w-36 sm:shrink-0"
          >
            <Network className="size-4" /> Conexiones
          </Button>
        </div>
      </div>

      <ViewConnectionsDialog
        open={connectionsOpen}
        onOpenChange={setConnectionsOpen}
        viewLabel="Libro Diario de Bancos"
        description="Vistas contables conectadas con este libro: a cuáles alimenta, de cuáles se alimenta y qué valida. Abre una conexión para ir directamente a esa vista."
        connections={BOOK_CONNECTIONS}
        onGoTo={(sectionId) => onGoToSection?.(sectionId)}
      />

      <div className="flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/5 p-3 text-[10px] text-muted-foreground">
        <Landmark className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <span>
          Se alimenta <strong className="text-foreground">directamente de los cierres de caja diarios</strong> (depósitos = ingresos) y de los
          cheques/egresos de la cuenta bancaria. Es <strong className="text-foreground">independiente de la Conciliación Bancaria</strong> (esa solo
          valida el cuadre mensual). La cuenta de banco alimenta Libro Diario, Libro Mayor, Balance de Comprobación, Estado de Resultados,
          Balance General y Flujo de Efectivo.
        </span>
      </div>

      {loading ? (
        <Card className="rounded-2xl border-border/50">
          <CardContent className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Cargando libro de bancos...
          </CardContent>
        </Card>
      ) : books.length === 0 ? (
        <Card className="rounded-2xl border-border/50">
          <CardContent className="flex items-start gap-2 py-16 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            No hay cuentas bancarias con cuenta contable vinculada para este período. Regístralas en Contabilidad → Configuración → Cuentas Bancarias.
          </CardContent>
        </Card>
      ) : (
        books.map((book) => (
          <Card key={book.bank.id} className="rounded-2xl border-border/50">
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 p-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-tight">
                    {book.bank.bankName} · {book.bank.accountNumber}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {book.accountCode} {book.accountName} · {ACCOUNT_TYPE_LABELS[book.bank.accountType] || book.bank.accountType || 'Cuenta'} · {book.bank.currency || 'NIO'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-muted/10">
                    Saldo inicial: {formatAmount(book.saldoInicial, book.bank.currency)}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    Ingresos: {formatAmount(book.totalIngresos, book.bank.currency)}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-rose-500/10 text-rose-600 border-rose-500/20">
                    Cheques/egresos: {formatAmount(book.totalEgresos, book.bank.currency)}
                  </Badge>
                  <Badge className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-primary/10 text-primary border-primary/20">
                    Saldo final: {formatAmount(book.saldoFinal, book.bank.currency)}
                  </Badge>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest">Día</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Saldo inicial</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Ingresos</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Cheques / Egresos</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Saldo final</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Movs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {book.rows.map((row: any) => {
                      const dayKey = `${book.bank.id}|${row.date}`;
                      const expanded = expandedDays.has(dayKey);
                      const date = new Date(row.date + 'T12:00:00');
                      return (
                        <Fragment key={dayKey}>
                          <TableRow
                            key={dayKey}
                            className={cn('cursor-pointer hover:bg-muted/30', row.count === 0 && 'opacity-55', expanded && 'bg-muted/40')}
                            onClick={() => row.count > 0 && toggleDay(dayKey)}
                          >
                            <TableCell className="py-2.5">
                              {row.count > 0 ? (
                                <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform duration-200', expanded && 'rotate-180')} />
                              ) : (
                                <span className="inline-block size-3.5" />
                              )}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <span className="text-xs font-black">{date.toLocaleDateString('es', { day: '2-digit', month: 'short' })}</span>
                              <p className="text-[9px] text-muted-foreground/70">{date.toLocaleDateString('es', { weekday: 'short' })}</p>
                            </TableCell>
                            <TableCell className="py-2.5 text-right text-xs tabular-nums">{formatAmount(row.saldoInicial, book.bank.currency)}</TableCell>
                            <TableCell className={cn('py-2.5 text-right text-xs font-bold tabular-nums', row.ingresos > 0 && 'text-emerald-600')}>
                              {row.ingresos > 0 ? formatAmount(row.ingresos, book.bank.currency) : '—'}
                            </TableCell>
                            <TableCell className={cn('py-2.5 text-right text-xs font-bold tabular-nums', row.egresos > 0 && 'text-rose-600')}>
                              {row.egresos > 0 ? formatAmount(row.egresos, book.bank.currency) : '—'}
                            </TableCell>
                            <TableCell className="py-2.5 text-right text-xs font-black tabular-nums text-primary">{formatAmount(row.saldoFinal, book.bank.currency)}</TableCell>
                            <TableCell className="py-2.5 text-right text-xs tabular-nums">{row.count || '—'}</TableCell>
                          </TableRow>
                          {expanded && (
                            <TableRow key={`${dayKey}-detail`}>
                              <TableCell colSpan={7} className="p-0">
                                <div className="rounded-xl border border-border/40 bg-muted/10 m-2 p-2">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest">Movimiento</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest">Referencia</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest">Tipo</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-right">Débito</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-right">Crédito</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {row.movimientos.map((m: any) => (
                                        <TableRow key={m.id}>
                                          <TableCell className="text-[11px] font-medium max-w-[320px] truncate" title={m.description}>
                                            {m.description || '—'}
                                          </TableCell>
                                          <TableCell className="text-[10px] text-muted-foreground">{m.reference || '—'}</TableCell>
                                          <TableCell>
                                            <Badge
                                              variant="outline"
                                              className={cn(
                                                'text-[8px] font-black uppercase tracking-widest px-2 py-0.5',
                                                m.tipo === 'INGRESO'
                                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                  : 'bg-rose-500/10 text-rose-600 border-rose-500/20',
                                              )}
                                            >
                                              <Banknote className="size-2.5 mr-1" />
                                              {m.tipo === 'INGRESO' ? 'Ingreso (depósito)' : 'Cheque / egreso'}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="text-right text-[11px] font-bold tabular-nums text-emerald-600">
                                            {m.debit > 0 ? formatAmount(m.debit, book.bank.currency) : '—'}
                                          </TableCell>
                                          <TableCell className="text-right text-[11px] font-bold tabular-nums text-rose-600">
                                            {m.credit > 0 ? formatAmount(m.credit, book.bank.currency) : '—'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                    <TableRow className="border-t-2 border-border/60 bg-muted/30">
                      <TableCell colSpan={2} className="text-[10px] font-black uppercase tracking-widest text-foreground">Totales del período</TableCell>
                      <TableCell className="text-right text-xs font-black tabular-nums">{formatAmount(book.saldoInicial, book.bank.currency)}</TableCell>
                      <TableCell className="text-right text-xs font-black tabular-nums text-emerald-600">{formatAmount(book.totalIngresos, book.bank.currency)}</TableCell>
                      <TableCell className="text-right text-xs font-black tabular-nums text-rose-600">{formatAmount(book.totalEgresos, book.bank.currency)}</TableCell>
                      <TableCell className="text-right text-xs font-black tabular-nums text-primary">{formatAmount(book.saldoFinal, book.bank.currency)}</TableCell>
                      <TableCell className="text-right text-xs font-black tabular-nums">{book.totalMovs}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
