import { useState, useMemo, useEffect } from 'react';
import { Plus, FileText, Send, Ban, Trash2, Search, RotateCcw, X, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
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

function referenceTypeLabel(value?: string) {
  if (!value) return '—';
  return REFERENCE_TYPES.find((r) => r.value === value)?.label || value;
}

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
  const journalPageSize = 10000;

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
  const viewJournal = journalDetailQuery.data || null;
  const journalGridCols = viewJournal
    ? '48px 1fr 1.15fr 0.85fr 1.35fr 1.35fr 1fr 1.35fr 84px'
    : '48px 1fr 2.2fr 0.85fr 1fr 1fr 1fr 1.35fr 84px';
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
        {statusKey === 'draft' && canPerform('ACCOUNTING_JOURNAL', 'edit') && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
            onClick={(e) => { e.stopPropagation(); handlePost(journal); }}
            title="Contabilizar"
          >
            <Send className="size-3.5" />
          </Button>
        )}
        {statusKey === 'posted' && canPerform('ACCOUNTING_JOURNAL', 'edit') && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-white hover:text-white"
            onClick={(e) => { e.stopPropagation(); handleVoid(journal); }}
            title="Anular"
          >
            <Ban className="size-3.5" />
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

      <div className={cn('grid min-w-0 grid-cols-1 gap-6', viewJournal ? 'lg:grid-cols-[13fr_7fr]' : 'lg:grid-cols-1')}>
      <div className="min-w-0">

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
              <div className="hidden max-h-[600px] overflow-y-auto sm:block">
                <div className="min-w-0 divide-y divide-border/60">
                <div className="hidden min-w-0 items-center gap-0 bg-muted/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 sm:grid" style={{ gridTemplateColumns: journalGridCols }}>
                  <span className="px-1">#</span>
                  <span className="px-1">Fecha</span>
                  <span className="min-w-0 truncate px-1">Descripción</span>
                  <span className="px-1">Estado</span>
                  <span className="px-1 text-center">Debe</span>
                  <span className="px-1 text-center">Haber</span>
                  <span className="min-w-0 truncate px-1">Ref. Tipo</span>
                  <span className="min-w-0 truncate px-1">Ref. ID</span>
                  <span className="px-1 text-right">Acciones</span>
                </div>
                {journals.map((j) => {
                  const totalDeb = j.lines?.reduce((s, l) => s + Number(l.debit), 0) || 0;
                  const totalCred = j.lines?.reduce((s, l) => s + Number(l.credit), 0) || 0;
                  const statusKey = j.status?.toLowerCase();
                  return (
                    <div key={j.id} className="grid min-w-0 cursor-pointer items-center gap-0 px-3 py-2 transition-colors hover:bg-muted/40" style={{ gridTemplateColumns: journalGridCols }} onClick={() => handleView(j)}>
                      <span className="truncate px-1 font-mono text-xs font-bold">{j.number}</span>
                      <span className="truncate px-1 text-xs">{new Date(j.date).toLocaleDateString('es-NI')}</span>
                      <span className="min-w-0 truncate px-1 text-xs" title={j.description}>{j.description}</span>
                      <span className="px-1">
                        <Badge variant={STATUS_COLORS[statusKey] || 'outline'} className="text-[10px] font-black uppercase tracking-wider">
                          {journalStatusLabel(j.status)}
                        </Badge>
                      </span>
                      <span className="truncate px-1 text-right text-xs tabular-nums">{formatCurrency(totalDeb)}</span>
                      <span className="truncate px-1 text-right text-xs tabular-nums">{formatCurrency(totalCred)}</span>
                      <span className="min-w-0 truncate px-1 text-xs text-muted-foreground" title={referenceTypeLabel((j as any).referenceType)}>{referenceTypeLabel((j as any).referenceType) || '-'}</span>
                      <span className="min-w-0 truncate px-1 font-mono text-xs" title={j.referenceId || ''}>{j.referenceId || '-'}</span>
                      <span className="flex justify-end px-1">{renderJournalActions(j)}</span>
                    </div>
                  );
                })}
                </div>
              </div>
              <div className="max-h-[600px] space-y-3 overflow-y-auto p-3 sm:hidden">
                {journals.map((j) => {
                  const totalDeb = j.lines?.reduce((s, l) => s + Number(l.debit), 0) || 0;
                  const totalCred = j.lines?.reduce((s, l) => s + Number(l.credit), 0) || 0;
                  const statusKey = j.status?.toLowerCase();
                  const referenceType = (j as any).referenceType;
                  return (
                    <div key={j.id} className="cursor-pointer rounded-xl border border-border/70 bg-card/60 p-3 shadow-sm transition-colors hover:border-primary/40" onClick={() => handleView(j)}>
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
                        {referenceType && <span className="truncate"><strong className="text-foreground/80">Ref.:</strong> {referenceTypeLabel(referenceType)}</span>}
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
      </Card>

      </div>

      {/* Detail Panel */}
      {viewJournal && (
        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <Card className="overflow-hidden">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Detalle del Asiento</CardTitle>
                </div>
                {viewJournal && (
                  <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setViewJournalId(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-5 p-4 sm:p-5">
              {journalDetailQuery.isLoading ? (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-border/60 py-16">
                  <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Asiento contable · #{viewJournal.number}</p>
                        <h3 className="mt-1 truncate text-lg font-black tracking-tight" title={viewJournal.description}>{viewJournal.description}</h3>
                      </div>
                      <Badge variant={STATUS_COLORS[viewJournal.status?.toLowerCase()] || 'outline'} className="shrink-0">
                        {journalStatusLabel(viewJournal.status)}
                      </Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Importe total</p>
                        <p className="mt-1 text-2xl font-black tabular-nums tracking-tight">
                          {formatCurrency(viewJournal.lines?.reduce((s, l) => s + Number(l.debit), 0) || 0)}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {new Date(viewJournal.date).toLocaleDateString('es-NI')}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 2xl:grid-cols-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fecha</p>
                      <p className="text-sm font-semibold">{new Date(viewJournal.date).toLocaleDateString('es-NI')}</p>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estado</p>
                      <Badge variant={STATUS_COLORS[viewJournal.status?.toLowerCase()] || 'outline'} className="shrink-0">
                        {journalStatusLabel(viewJournal.status)}
                      </Badge>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ref. Tipo</p>
                      <p className="truncate text-sm font-semibold">{referenceTypeLabel((viewJournal as any).referenceType)}</p>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ref. ID</p>
                      <p className="truncate font-mono text-xs font-bold">{(viewJournal as any).referenceId || '—'}</p>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Centro de Costo</p>
                      <p className="truncate text-sm font-semibold">{(viewJournal as any).costCenterId || '—'}</p>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Líneas</p>
                      <p className="text-sm font-semibold tabular-nums">{viewJournal.lines?.length ?? 0}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Descripción</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{viewJournal.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {viewJournal.status?.toLowerCase() === 'draft' && canPerform('ACCOUNTING_JOURNAL', 'edit') && (
                      <Button className="flex-1" size="sm" onClick={() => { void handlePost(viewJournal); }}>
                        <Send className="mr-1 size-3.5" /> Contabilizar
                      </Button>
                    )}
                    {viewJournal.status?.toLowerCase() === 'posted' && canPerform('ACCOUNTING_JOURNAL', 'edit') && (
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => { void handleVoid(viewJournal); }}>
                        <Ban className="mr-1 size-3.5" /> Anular
                      </Button>
                    )}
                  </div>

                  <Separator />

                  <section className="min-w-0">
                    <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <ArrowDownLeft className="size-4 text-primary" />
                          <h3 className="truncate text-sm font-black uppercase tracking-tight">Líneas del Asiento</h3>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">Movimientos de débito y crédito del asiento.</p>
                      </div>
                    </div>

                    {!viewJournal.lines || viewJournal.lines.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center">
                        <p className="text-sm font-semibold">Sin líneas</p>
                        <p className="mt-1 text-xs text-muted-foreground">Este asiento no tiene movimientos.</p>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-border/60">
                        <div className="divide-y divide-border/60">
                          {viewJournal.lines.map((line) => (
                            <div key={line.id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-3 py-3">
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                                {line.debit > 0 ? <ArrowDownLeft className="size-3.5 text-emerald-600" /> : <ArrowUpRight className="size-3.5 text-rose-500" />}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold" title={line.account ? `${line.account.code} - ${line.account.name}` : line.accountId}>
                                  {line.account ? `${line.account.code} - ${line.account.name}` : line.accountId}
                                </p>
                                {line.description && <p className="mt-1 truncate text-[10px] text-muted-foreground" title={line.description}>{line.description}</p>}
                              </div>
                              <div className="shrink-0 text-right font-mono text-[11px] font-bold tabular-nums">
                                {line.debit > 0 && <p className="text-emerald-600">Débito {formatCurrency(line.debit)}</p>}
                                {line.credit > 0 && <p className="text-rose-500">Crédito {formatCurrency(line.credit)}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/30 px-3 py-2.5 font-mono text-[11px] font-black tabular-nums">
                          <span className="uppercase tracking-wider text-muted-foreground">Totales</span>
                          <span className="text-right"><span className="text-emerald-600">D {formatCurrency(viewJournal.lines?.reduce((s, l) => s + Number(l.debit), 0) || 0)}</span> · <span className="text-rose-500">C {formatCurrency(viewJournal.lines?.reduce((s, l) => s + Number(l.credit), 0) || 0)}</span></span>
                        </div>
                      </div>
                    )}
                  </section>

                  <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-3 text-[10px] text-muted-foreground">
                    <span>Creado: {new Date(viewJournal.createdAt).toLocaleString('es-NI')}</span>
                    {viewJournal.updatedAt !== viewJournal.createdAt && (
                      <span>| Actualizado: {new Date(viewJournal.updatedAt).toLocaleString('es-NI')}</span>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}
