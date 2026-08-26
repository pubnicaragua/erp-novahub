import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
import { referenceTypeLabel } from '../../utils/accountingLabels';

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
  referenceType?: string | null;
  referenceId?: string | null;
  referenceNumber?: string | null;
  sourceDocument?: SourceDocument | null;
  debit: number;
  credit: number;
  balance: number;
}

interface SourceDocumentItem {
  id: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discount?: number;
  total: number;
}

interface SourceDocument {
  type: string;
  id: string;
  number?: string | null;
  date?: string | null;
  total: number;
  currency?: string | null;
  counterpartyName?: string | null;
  items: SourceDocumentItem[];
}

const formatCurrency = (value: number) => new Intl.NumberFormat('es-NI', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const formatQuantity = (value: number) => new Intl.NumberFormat('es-NI', {
  maximumFractionDigits: 4,
}).format(Number(value || 0));

const formatDate = (value?: string) => {
  if (!value) return '—';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString('es-NI');
  return new Date(value).toLocaleDateString('es-NI');
};

const normalizeTransferDescription = (description: unknown, referenceType?: string | null) => {
  const value = String(description || 'Sin descripción');
  if (String(referenceType || '').toUpperCase() !== 'TRANSFER') return value;
  // Compatibilidad con asientos históricos que guardaron el UUID de la
  // variante/producto en lugar de su nombre. El backend intenta resolverlo;
  // este último filtro evita que el UUID llegue a la pantalla si el asiento
  // antiguo todavía no ha sido sincronizado.
  return value.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    'Producto',
  );
};

export function AccountMovementsDetail({ accountId, codigo, cuenta, tipo, dateFrom, dateTo }: AccountMovementsDetailProps) {
  const query = useAccountingQuery<MovementRow[]>(
    ['account-movements-detail', accountId, dateFrom, dateTo],
    async (signal) => {
      const raw: any = await contabilidadService.getLedger({ accountId, dateFrom, dateTo }, signal);
      return accountingList(raw).map((row: any) => ({
        id: String(row.id || `${row.date}-${row.reference}-${row.description}`),
        date: row.date,
        description: normalizeTransferDescription(row.description, row.referenceType),
        reference: row.reference || '—',
        journalNumber: row.journalNumber || null,
        referenceType: row.referenceType || null,
        referenceId: row.referenceId || null,
        referenceNumber: row.referenceNumber || null,
        sourceDocument: row.sourceDocument
          ? {
            ...row.sourceDocument,
            total: Number(row.sourceDocument.total || 0),
            items: Array.isArray(row.sourceDocument.items)
              ? row.sourceDocument.items.map((item: any) => ({
                ...item,
                quantity: Number(item.quantity || 0),
                unitPrice: Number(item.unitPrice || 0),
                taxRate: Number(item.taxRate || 0),
                discount: Number(item.discount || 0),
                total: Number(item.total || 0),
              }))
              : [],
          }
          : null,
        debit: Number(row.debit || 0),
        credit: Number(row.credit || 0),
        balance: Number(row.balance || 0),
      }));
    },
    { enabled: Boolean(accountId) },
  );

  const rows = useMemo(() => query.data || [], [query.data]);
  const sourceDocuments = useMemo(() => {
    const seen = new Set<string>();
    return rows.reduce<SourceDocument[]>((documents, row) => {
      const source = row.sourceDocument;
      if (!source || seen.has(source.id)) return documents;
      seen.add(source.id);
      documents.push(source);
      return documents;
    }, []);
  }, [rows]);
  const [isSourceDocumentOpen, setIsSourceDocumentOpen] = useState(false);
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
          <Table className="min-w-[980px]">
            <TableHeader className="bg-muted/35">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-foreground">Fecha</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-foreground">Referencia</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-foreground">Documento origen</TableHead>
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
                  <TableCell className="min-w-[13rem] text-xs">
                    {row.referenceType ? (
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground" title={referenceTypeLabel(row.referenceType)}>{referenceTypeLabel(row.referenceType)}</p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground" title={row.referenceNumber || row.referenceId || ''}>
                          {row.referenceNumber || row.referenceId || 'Referencia sin número'}
                        </p>
                      </div>
                    ) : '—'}
                  </TableCell>
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
                <TableCell colSpan={4} className="text-xs uppercase tracking-widest">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Totales</span>
                    {sourceDocuments.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsSourceDocumentOpen((open) => !open)}
                        aria-expanded={isSourceDocumentOpen}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-background/70 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <FileText className="size-3.5" />
                        {isSourceDocumentOpen ? 'Ocultar documento' : 'Ver documento origen'}
                        {isSourceDocumentOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums text-emerald-600">{formatCurrency(totals.debit)}</TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums text-rose-600">{formatCurrency(totals.credit)}</TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums text-primary">{formatCurrency(totals.balance)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {!query.isLoading && !query.error && isSourceDocumentOpen && sourceDocuments.length > 0 && (
        <section className="mt-3 space-y-3" aria-label="Documentos origen relacionados">
          {sourceDocuments.map((source) => (
            <div key={source.id} className="overflow-hidden rounded-xl border border-primary/20 bg-background/70 shadow-sm">
              <div className="flex flex-col gap-2 border-b border-border/50 bg-primary/[0.06] px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wide text-foreground">
                    {referenceTypeLabel(source.type)} · {source.number || 'Sin número'}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDate(source.date || undefined)}{source.counterpartyName ? ` · ${source.counterpartyName}` : ''}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm font-black text-primary">
                  {source.currency || 'NIO'} {formatCurrency(source.total)}
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {source.items.length > 0 ? source.items.map((item) => (
                  <div key={item.id} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                    <p className="min-w-0 break-words text-xs font-semibold text-foreground">{item.description || 'Detalle sin descripción'}</p>
                    <p className="whitespace-nowrap text-[11px] text-muted-foreground">{formatQuantity(item.quantity)} × {formatCurrency(item.unitPrice)}</p>
                    <p className="whitespace-nowrap text-right font-mono text-xs font-bold text-foreground">{formatCurrency(item.total)}</p>
                  </div>
                )) : (
                  <p className="px-3 py-3 text-xs text-muted-foreground">La factura no tiene líneas de detalle registradas.</p>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
