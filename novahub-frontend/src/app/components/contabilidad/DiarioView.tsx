import { useState, useMemo, useEffect } from 'react';
import { Plus, FileText, Eye, Send, XCircle, Trash2, Search, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { contabilidadService } from '../../services/contabilidad.service';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Combobox } from '../ui/Combobox';
import { cn } from '../ui/utils';
import type { JournalEntry } from '../../types';
import type { ChartAccount } from '../../types/accounting';
import { useAuth } from '../../contexts/AuthContext';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';

const STATUS_COLORS: Record<string, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  DRAFT: 'secondary',
  posted: 'default',
  POSTED: 'default',
  voided: 'destructive',
  VOIDED: 'destructive',
};

const REFERENCE_TYPES = [
  { label: 'Factura Cliente', value: 'INVOICE' },
  { label: 'Factura Proveedor', value: 'SUPPLIER_INVOICE' },
  { label: 'Pago Cliente', value: 'PAYMENT' },
  { label: 'Pago Proveedor', value: 'PAYMENT_MADE' },
  { label: 'Nota Crédito', value: 'CREDIT_NOTE' },
  { label: 'Nota Débito', value: 'DEBIT_NOTE' },
  { label: 'Nómina', value: 'PAYROLL' },
  { label: 'Gasto', value: 'EXPENSE' },
  { label: 'Otro', value: 'OTHER' },
];

type JournalLineInput = {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  description: string;
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function emptyLine(): JournalLineInput {
  return { id: crypto.randomUUID(), accountId: '', debit: 0, credit: 0, description: '' };
}

export function DiarioView() {
  const { canPerform } = useAuth();
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterRefType, setFilterRefType] = useState('');
  const [filterRefId, setFilterRefId] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [journalPage, setJournalPage] = useState(1);
  const journalPageSize = 50;

  const [createOpen, setCreateOpen] = useState(false);
  const [viewJournalId, setViewJournalId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filterSearch.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [filterSearch]);

  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formDescription, setFormDescription] = useState('');
  const [formLines, setFormLines] = useState<JournalLineInput[]>([emptyLine()]);
  const [formRefType, setFormRefType] = useState('');
  const [formRefId, setFormRefId] = useState('');
  const [formCostCenter, setFormCostCenter] = useState('');

  const journalParams = useMemo(() => ({
    ...(filterStatus && filterStatus !== 'ALL' ? { status: filterStatus } : {}),
    ...(filterDateFrom ? { dateFrom: filterDateFrom } : {}),
    ...(filterDateTo ? { dateTo: filterDateTo } : {}),
    ...(filterAccountId ? { accountId: filterAccountId } : {}),
    ...(filterRefType ? { referenceType: filterRefType } : {}),
    ...(filterRefId ? { referenceId: filterRefId } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    page: journalPage,
    pageSize: journalPageSize,
  }), [filterStatus, filterDateFrom, filterDateTo, filterAccountId, filterRefType, filterRefId, debouncedSearch, journalPage]);
  const journalsQuery = useAccountingQuery<any>(['journals', journalParams], async (signal) => await contabilidadService.getJournals(journalParams, signal));
  const accountsQuery = useAccountingQuery<ChartAccount[]>(['accounts'], async (signal) => accountingList(await contabilidadService.getChartOfAccounts(false, signal)) as ChartAccount[]);
  const journalDetailQuery = useAccountingQuery<JournalEntry | null>(
    ['journal-detail', viewJournalId],
    async (signal) => viewJournalId ? await contabilidadService.getJournal(viewJournalId, signal) as JournalEntry : null,
    { enabled: Boolean(viewJournalId), staleTime: 5 * 60_000 },
  );
  const journals = accountingList(journalsQuery.data) as JournalEntry[];
  const journalMeta = journalsQuery.data?.meta as { total: number; page: number; pageSize: number; totalPages: number } | undefined;
  const viewJournal = journalDetailQuery.data || null;
  const loading = journalsQuery.isLoading || journalsQuery.isFetching;
  const accounts = useMemo(() => {
    const flatten = (items: ChartAccount[]): ChartAccount[] => items.flatMap(account => [account, ...flatten(account.children ?? [])]);
    return flatten(accountsQuery.data || []);
  }, [accountsQuery.data]);
  const loadJournals = () => journalsQuery.refetch();
  const loadAccounts = () => accountsQuery.refetch();

  const accountOptions = accounts
    .filter((account) => account.isActive && account.allowManualEntry !== false && account.acceptsPostings !== false)
    .map((a) => ({
    label: `${a.code} - ${a.name}`,
    value: a.id,
    description: a.type,
    }));

  const refTypeOptions = REFERENCE_TYPES.map((r) => ({ label: r.label, value: r.value }));

  function handleAddLine() {
    setFormLines((prev) => [...prev, emptyLine()]);
  }

  function handleRemoveLine(id: string) {
    setFormLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
  }

  function handleLineChange(id: string, field: keyof JournalLineInput, value: string | number) {
    setFormLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  }

  const totalDebits = formLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredits = formLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebits - totalCredits) < 0.01;
  const canSave = formDescription.trim() && formLines.some((l) => l.accountId) && balanced && totalDebits > 0;

  async function handleCreateJournal() {
    if (!canSave || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        date: formDate,
        description: formDescription,
        lines: formLines.map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description || undefined,
        })),
        referenceType: formRefType || undefined,
        referenceId: formRefId || undefined,
        costCenterId: formCostCenter || undefined,
      };
      await contabilidadService.createJournal(payload);
      toast.success('Asiento creado exitosamente');
      setCreateOpen(false);
      resetForm();
      loadJournals();
    } catch (err: any) {
      toast.error(err.message || 'Error al crear asiento');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormDescription('');
    setFormLines([emptyLine()]);
    setFormRefType('');
    setFormRefId('');
    setFormCostCenter('');
  }

  async function handlePost(journal: JournalEntry) {
    try {
      await contabilidadService.postJournal(journal.id);
      toast.success(`Asiento #${journal.number} contabilizado`);
      loadJournals();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al contabilizar');
    }
  }

  async function handleVoid(journal: JournalEntry) {
    try {
      await contabilidadService.voidJournal(journal.id);
      toast.success(`Asiento #${journal.number} anulado`);
      loadJournals();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al anular');
    }
  }

  function handleView(journal: JournalEntry) {
    setViewJournalId(journal.id);
  }

  function journalStatusLabel(status?: string) {
    const statusKey = status?.toLowerCase();
    return statusKey === 'draft' ? 'Borrador'
      : statusKey === 'posted' ? 'Contabilizado'
        : statusKey === 'voided' ? 'Anulado'
          : status || 'Sin estado';
  }

  function renderJournalActions(journal: JournalEntry) {
    const statusKey = journal.status?.toLowerCase();
    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => handleView(journal)}
          title="Ver detalle"
        >
          <Eye className="size-3.5" />
        </Button>
        {statusKey === 'draft' && canPerform('ACCOUNTING_JOURNAL', 'edit') && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
            onClick={() => handlePost(journal)}
            title="Contabilizar"
          >
            <Send className="size-3.5" />
          </Button>
        )}
        {statusKey === 'posted' && canPerform('ACCOUNTING_JOURNAL', 'edit') && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            onClick={() => handleVoid(journal)}
            title="Anular"
          >
            <XCircle className="size-3.5" />
          </Button>
        )}
      </div>
    );
  }

  useEffect(() => {
    if (journalDetailQuery.error) toast.error(journalDetailQuery.error.message || 'Error al cargar detalle');
  }, [journalDetailQuery.error]);

  useEffect(() => {
    setJournalPage(1);
  }, [filterStatus, filterDateFrom, filterDateTo, filterAccountId, filterRefType, filterRefId, debouncedSearch]);

  return (
    <div className="min-w-0 space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase italic">
            Libro <span className="text-primary">Diario</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Registro cronológico de todos los asientos contables
          </p>
        </div>
        {canPerform('ACCOUNTING_JOURNAL', 'create') && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" />
                Nuevo Asiento
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nuevo Asiento Contable</DialogTitle>
              <DialogDescription>
                Ingresa los datos del asiento. Los débitos deben ser igual a los créditos.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="journal-date">Fecha</Label>
                <Input
                  id="journal-date"
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="journal-desc">Descripción</Label>
                <Input
                  id="journal-desc"
                  placeholder="Descripción del asiento"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo Referencia</Label>
                <Combobox
                  options={refTypeOptions}
                  value={formRefType}
                  onChange={setFormRefType}
                  placeholder="Seleccionar tipo..."
                  emptyMessage="Sin resultados"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="journal-ref">ID Referencia</Label>
                <Input
                  id="journal-ref"
                  placeholder="ID del documento origen"
                  value={formRefId}
                  onChange={(e) => setFormRefId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Centro de Costo</Label>
                <Combobox
                  options={[]}
                  value={formCostCenter}
                  onChange={setFormCostCenter}
                  placeholder="Opcional..."
                  emptyMessage="Sin resultados"
                />
              </div>
            </div>

            <Separator className="my-2" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Líneas del Asiento</Label>
                <Button variant="outline" size="sm" onClick={handleAddLine} className="gap-1">
                  <Plus className="size-3.5" />
                  Agregar Línea
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Cuenta</TableHead>
                      <TableHead className="w-[120px] text-right">Débito</TableHead>
                      <TableHead className="w-[120px] text-right">Crédito</TableHead>
                      <TableHead className="min-w-[160px]">Descripción</TableHead>
                      <TableHead className="w-[40px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formLines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <Combobox
                            options={accountOptions}
                            value={line.accountId}
                            onChange={(v) => handleLineChange(line.id, 'accountId', v)}
                            placeholder="Buscar cuenta..."
                            emptyMessage="Sin resultados"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={line.debit || ''}
                            onChange={(e) => handleLineChange(line.id, 'debit', e.target.value === '' ? 0 : Number(e.target.value))}
                            className="text-right h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={line.credit || ''}
                            onChange={(e) => handleLineChange(line.id, 'credit', e.target.value === '' ? 0 : Number(e.target.value))}
                            className="text-right h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Descripción (opcional)"
                            value={line.description}
                            onChange={(e) => handleLineChange(line.id, 'description', e.target.value)}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            disabled={formLines.length <= 1}
                            onClick={() => handleRemoveLine(line.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="flex items-center justify-end gap-6 text-sm font-medium pt-2 border-t">
                <span className="flex items-center gap-2">
                  Total Débitos:
                  <span className="tabular-nums">{formatCurrency(totalDebits)}</span>
                </span>
                <span className="flex items-center gap-2">
                  Total Créditos:
                  <span className="tabular-nums">{formatCurrency(totalCredits)}</span>
                </span>
                <span className={cn('flex items-center gap-2', balanced ? 'text-emerald-500' : 'text-destructive')}>
                  {balanced ? '✓ Balanceado' : `✗ Diferencia: ${formatCurrency(Math.abs(totalDebits - totalCredits))}`}
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button onClick={handleCreateJournal} disabled={!canSave || submitting}>
                {submitting ? 'Guardando...' : 'Crear Asiento'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 space-y-1 sm:min-w-[180px]">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Buscar
              </Label>
              <Input
                placeholder="Descripción, # asiento, referencia..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="min-w-0 space-y-1 sm:min-w-[140px]">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Estado
              </Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="DRAFT">Borrador</SelectItem>
                  <SelectItem value="POSTED">Contabilizado</SelectItem>
                  <SelectItem value="VOIDED">Anulado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1 sm:min-w-[140px]">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Desde
              </Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="min-w-0 space-y-1 sm:min-w-[140px]">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Hasta
              </Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="min-w-0 space-y-1 sm:min-w-[200px]">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Cuenta Contable
              </Label>
              <Combobox
                options={accountOptions}
                value={filterAccountId}
                onChange={setFilterAccountId}
                placeholder="Todas las cuentas"
                emptyMessage="Sin resultados"
              />
            </div>
            <div className="min-w-0 space-y-1 sm:min-w-[160px]">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Tipo Referencia
              </Label>
              <Combobox
                options={refTypeOptions}
                value={filterRefType}
                onChange={setFilterRefType}
                placeholder="Todos"
                emptyMessage="Sin resultados"
              />
            </div>
            <div className="min-w-0 space-y-1 sm:min-w-[140px]">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                ID Referencia
              </Label>
              <Input
                placeholder="ID del documento..."
                value={filterRefId}
                onChange={(e) => setFilterRefId(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              onClick={() => {
                setFilterStatus('');
                setFilterDateFrom('');
                setFilterDateTo('');
                setFilterAccountId('');
                setFilterRefType('');
                setFilterRefId('');
                setFilterSearch('');
              }}
            >
              <RotateCcw className="size-3.5" />
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Journal List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : journals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="size-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No hay asientos contables</p>
              <p className="text-xs mt-1">Crea un nuevo asiento para comenzar</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto sm:block">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">#</TableHead>
                  <TableHead className="w-[110px]">Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-[100px]">Estado</TableHead>
                  <TableHead className="w-[120px] text-right">Débitos</TableHead>
                  <TableHead className="w-[120px] text-right">Créditos</TableHead>
                  <TableHead className="w-[110px]">Ref. Tipo</TableHead>
                  <TableHead className="w-[130px]">Ref. ID</TableHead>
                  <TableHead className="w-[120px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journals.map((j) => {
                  const totalDeb = j.lines?.reduce((s, l) => s + l.debit, 0) || 0;
                  const totalCred = j.lines?.reduce((s, l) => s + l.credit, 0) || 0;
                  const statusKey = j.status?.toLowerCase();
                  return (
                    <TableRow key={j.id}>
                      <TableCell className="font-mono text-xs font-bold">{j.number}</TableCell>
                      <TableCell className="text-xs">{new Date(j.date).toLocaleDateString('es-NI')}</TableCell>
                      <TableCell className="text-xs max-w-[260px] truncate">{j.description}</TableCell>
                      <TableCell>
                        <Badge
                          variant={STATUS_COLORS[statusKey] || 'outline'}
                          className="text-[10px] font-black uppercase tracking-wider"
                        >
                          {journalStatusLabel(j.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatCurrency(totalDeb)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatCurrency(totalCred)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(j as any).referenceType || '-'}
                      </TableCell>
                      <TableCell className="text-xs font-mono max-w-[130px] truncate" title={j.referenceId || ''}>
                        {j.referenceId || '-'}
                      </TableCell>
                      <TableCell>{renderJournalActions(j)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              </Table>
              </div>
              <div className="space-y-3 p-3 sm:hidden">
                {journals.map((j) => {
                  const totalDeb = j.lines?.reduce((s, l) => s + l.debit, 0) || 0;
                  const totalCred = j.lines?.reduce((s, l) => s + l.credit, 0) || 0;
                  const statusKey = j.status?.toLowerCase();
                  const referenceType = (j as any).referenceType;
                  return (
                    <div key={j.id} className="rounded-xl border border-border/70 bg-card/60 p-3 shadow-sm transition-colors hover:border-primary/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="shrink-0 font-mono text-xs font-black text-primary">#{j.number}</span>
                            <Badge
                              variant={STATUS_COLORS[statusKey] || 'outline'}
                              className="shrink-0 px-1.5 py-0 text-[9px] font-black uppercase tracking-wider"
                            >
                              {journalStatusLabel(j.status)}
                            </Badge>
                          </div>
                          <p className="mt-1.5 truncate text-sm font-bold" title={j.description}>{j.description}</p>
                          <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            {new Date(j.date).toLocaleDateString('es-NI')}
                          </p>
                        </div>
                        {renderJournalActions(j)}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-3">
                        <div className="min-w-0 rounded-lg bg-muted/30 px-2.5 py-2">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Débitos</p>
                          <p className="mt-0.5 truncate text-sm font-black tabular-nums">{formatCurrency(totalDeb)}</p>
                        </div>
                        <div className="min-w-0 rounded-lg bg-muted/30 px-2.5 py-2">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Créditos</p>
                          <p className="mt-0.5 truncate text-sm font-black tabular-nums">{formatCurrency(totalCred)}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex min-w-0 flex-wrap gap-x-3 gap-y-1 border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                        {referenceType && <span className="truncate"><strong className="text-foreground/80">Ref.:</strong> {referenceType}</span>}
                        {j.referenceId && <span className="truncate font-mono"><strong className="font-sans text-foreground/80">ID:</strong> {j.referenceId}</span>}
                        {!referenceType && !j.referenceId && <span>Sin referencia asociada</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
        {journalMeta && journalMeta.totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t px-3 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <span>Mostrando {journals.length} de {journalMeta.total} asientos</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" disabled={journalPage <= 1 || loading} onClick={() => setJournalPage((page) => page - 1)}>Anterior</Button>
              <span>Página {journalMeta.page} de {journalMeta.totalPages}</span>
              <Button variant="outline" size="sm" disabled={journalPage >= journalMeta.totalPages || loading} onClick={() => setJournalPage((page) => page + 1)}>Siguiente</Button>
            </div>
          </div>
        )}
      </Card>

      {/* View Detail Dialog */}
      <Dialog open={!!viewJournalId} onOpenChange={(open) => { if (!open) setViewJournalId(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Asiento #{(viewJournal as any)?.number}
            </DialogTitle>
            <DialogDescription>
              Detalle completo del asiento contable
            </DialogDescription>
          </DialogHeader>

          {journalDetailQuery.isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Cargando detalle...</div>
          ) : viewJournal ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground block">Fecha</span>
                  <span className="font-medium">{new Date(viewJournal.date).toLocaleDateString('es-NI')}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground block">Estado</span>
                  <Badge
                    variant={STATUS_COLORS[viewJournal.status?.toLowerCase()] || 'outline'}
                    className="text-[10px] font-black uppercase tracking-wider"
                  >
                    {(viewJournal.status as string)?.toLowerCase() === 'draft' ? 'Borrador' : (viewJournal.status as string)?.toLowerCase() === 'posted' ? 'Contabilizado' : (viewJournal.status as string)?.toLowerCase() === 'voided' ? 'Anulado' : viewJournal.status}
                  </Badge>
                </div>
                {(viewJournal as any).referenceType && (
                  <div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground block">Ref. Tipo</span>
                    <span className="font-medium">{(viewJournal as any).referenceType}</span>
                  </div>
                )}
                {(viewJournal as any).referenceId && (
                  <div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground block">Ref. ID</span>
                    <span className="font-mono text-xs">{(viewJournal as any).referenceId}</span>
                  </div>
                )}
                {(viewJournal as any).costCenterId && (
                  <div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground block">Centro Costo</span>
                    <span className="font-medium">{(viewJournal as any).costCenterId}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">Descripción</span>
                <p className="text-sm bg-muted/30 rounded-md p-3">{viewJournal.description}</p>
              </div>

              <Separator />

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Líneas del Asiento
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuenta</TableHead>
                      <TableHead className="text-right w-[100px]">Débito</TableHead>
                      <TableHead className="text-right w-[100px]">Crédito</TableHead>
                      <TableHead>Descripción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewJournal.lines?.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="text-xs">
                          {line.account ? `${line.account.code} - ${line.account.name}` : line.accountId}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs font-medium">
                          {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs font-medium">
                          {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {line.description || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals row */}
                    <TableRow className="font-bold border-t-2">
                      <TableCell className="text-xs uppercase tracking-wider">Totales</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatCurrency(viewJournal.lines?.reduce((s, l) => s + l.debit, 0) || 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatCurrency(viewJournal.lines?.reduce((s, l) => s + l.credit, 0) || 0)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t text-[10px] text-muted-foreground">
                <span>Creado: {new Date(viewJournal.createdAt).toLocaleString('es-NI')}</span>
                {viewJournal.updatedAt !== viewJournal.createdAt && (
                  <span>| Actualizado: {new Date(viewJournal.updatedAt).toLocaleString('es-NI')}</span>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewJournalId(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
