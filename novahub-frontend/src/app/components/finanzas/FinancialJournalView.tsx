import { useQuery } from '@tanstack/react-query';
import { BookOpen, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import { journalEntriesService, transactionsService } from '../../services/finanzas.service';

interface FinancialJournalViewProps {
  kind: 'journal' | 'ledger';
}

const toList = (value: any) => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];

export function FinancialJournalView({ kind }: FinancialJournalViewProps) {
  const { canPerform } = useAuth();
  const isJournal = kind === 'journal';
  const permission = isJournal ? 'FINANCIAL_JOURNAL' : 'FINANCIAL_LEDGER';
  const query = useQuery({
    queryKey: ['finance', kind],
    queryFn: ({ signal }) => isJournal
      ? journalEntriesService.getAll({ page: 1, pageSize: 500 }, signal)
      : transactionsService.getAll({ page: 1, pageSize: 500 }, signal),
    enabled: canPerform(permission, 'view'),
    staleTime: 30_000,
  });
  const rows = toList(query.data);

  return (
    <Card className="rounded-2xl border-border/50 shadow-sm">
      <CardHeader className="border-b border-border/40 bg-muted/10">
        <CardTitle className="flex items-center gap-2 text-lg font-black">
          {isJournal ? <FileText className="size-5 text-primary" /> : <BookOpen className="size-5 text-primary" />}
          {isJournal ? 'Diario financiero' : 'Libro mayor financiero'}
          <Badge variant="outline" className="ml-auto text-[10px]">{rows.length} registros</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {query.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando registros...</div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No hay registros financieros para mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead><tr className="border-b border-border/50 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-5 py-3">Fecha</th><th className="px-5 py-3">Referencia</th><th className="px-5 py-3">Descripción</th><th className="px-5 py-3 text-right">Monto</th>
              </tr></thead>
              <tbody>{rows.map((row: any, index: number) => (
                <tr key={row.id || index} className="border-b border-border/30 last:border-0">
                  <td className="px-5 py-3 text-muted-foreground">{row.date || row.createdAt ? new Date(row.date || row.createdAt).toLocaleDateString('es-NI') : '—'}</td>
                  <td className="px-5 py-3 font-mono font-semibold">{row.number || row.reference || row.id || '—'}</td>
                  <td className="px-5 py-3">{row.description || row.memo || row.source || 'Sin descripción'}</td>
                  <td className="px-5 py-3 text-right font-black">{Number(row.amount || row.total || row.debit || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
