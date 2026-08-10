import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';

interface AccountMovementsDetailProps {
  accountId: string;
  codigo: string;
  cuenta: string;
  tipo?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface MovementRow {
  id: string;
  date?: string;
  description?: string;
  reference?: string;
  journalNumber?: string | null;
  debit: number;
  credit: number;
  balance: number;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('es-NI', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const formatDate = (value?: string) => {
  if (!value) return '—';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString('es-NI');
  return new Date(value).toLocaleDateString('es-NI');
};

export function AccountMovementsDetail({ accountId, codigo, cuenta, tipo, dateFrom, dateTo }: AccountMovementsDetailProps) {
  const query = useAccountingQuery<MovementRow[]>(
    ['account-movements-detail', accountId, dateFrom, dateTo],
    async (signal) => {
      const raw: any = await contabilidadService.getLedger({ accountId, dateFrom, dateTo }, signal);
      return accountingList(raw).map((row: any) => ({
        id: String(row.id || `${row.date}-${row.reference}-${row.description}`),
        date: row.date,
        description: row.description || 'Sin descripción',
        reference: row.reference || '—',
        journalNumber: row.journalNumber || null,
        debit: Number(row.debit || 0),
        credit: Number(row.credit || 0),
        balance: Number(row.balance || 0),
      }));
    },
    { enabled: Boolean(accountId) },
  );

  const rows = query.data || [];
  const totals = useMemo(() => {
    const debit = rows.reduce((sum, row) => sum + row.debit, 0);
    const credit = rows.reduce((sum, row) => sum + row.credit, 0);
    const balance = ['LIABILITY', 'EQUITY', 'INCOME'].includes(String(tipo || '').toUpperCase())
      ? credit - debit
      : debit - credit;
    return { debit, credit, balance };
  }, [rows, tipo]);

  return (
    <div className="border-t border-primary/20 bg-primary/[0.035] p-3 sm:p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Detalle de movimientos</p>
          <p className="mt-1 break-words text-xs font-semibold text-foreground">
            <span className="font-mono">{codigo}</span> · {cuenta}
          </p>
        </div>
        <Badge variant="outline" className="w-fit shrink-0 text-[9px] font-black uppercase tracking-widest">
          {query.isFetching ? 'Actualizando' : `${rows.length} registros`}
        </Badge>
      </div>

      {query.isLoading ? (
        <div className="flex min-h-24 items-center justify-center gap-2 rounded-xl border border-border/50 bg-background/50 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cargando movimientos...
        </div>
      ) : query.error ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs text-rose-600">
          No se pudieron cargar los movimientos de esta cuenta.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-background/50 p-4 text-center text-xs text-muted-foreground">
          No hay movimientos registrados para esta cuenta en el período seleccionado.
        </div>
      ) : (
        <div className="min-w-0 overflow-x-auto rounded-xl border border-border/60 bg-background/60">
          <Table className="min-w-[800px]">
            <TableHeader className="bg-muted/35">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-foreground">Fecha</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-foreground">Referencia</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-foreground">Descripción</TableHead>
                <TableHead className="text-right text-[9px] font-black uppercase tracking-widest text-foreground">Débito</TableHead>
                <TableHead className="text-right text-[9px] font-black uppercase tracking-widest text-foreground">Crédito</TableHead>
                <TableHead className="text-right text-[9px] font-black uppercase tracking-widest text-foreground">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="border-border/30 hover:bg-muted/25">
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(row.date)}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{row.journalNumber || row.reference || '—'}</TableCell>
                  <TableCell className="max-w-[28rem] whitespace-normal break-words text-xs">{row.description}</TableCell>
                  <TableCell className={cn('text-right font-mono text-xs tabular-nums', row.debit > 0 && 'text-emerald-600')}>
                    {formatCurrency(row.debit)}
                  </TableCell>
                  <TableCell className={cn('text-right font-mono text-xs tabular-nums', row.credit > 0 && 'text-rose-600')}>
                    {formatCurrency(row.credit)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold tabular-nums">{formatCurrency(row.balance)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-primary/25 bg-primary/10 font-black">
                <TableCell colSpan={3} className="text-xs uppercase tracking-widest">Totales</TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums text-emerald-600">{formatCurrency(totals.debit)}</TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums text-rose-600">{formatCurrency(totals.credit)}</TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums text-primary">{formatCurrency(totals.balance)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
