import { useState, useEffect, useCallback } from 'react';
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
import type { JournalEntry, Account } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

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
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterRefType, setFilterRefType] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [viewJournal, setViewJournal] = useState<JournalEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formDescription, setFormDescription] = useState('');
  const [formLines, setFormLines] = useState<JournalLineInput[]>([emptyLine()]);
  const [formRefType, setFormRefType] = useState('');
  const [formRefId, setFormRefId] = useState('');
  const [formCostCenter, setFormCostCenter] = useState('');

  const loadJournals = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterStatus && filterStatus !== 'ALL') params.status = filterStatus;
      if (filterDateFrom) params.dateFrom = filterDateFrom;
      if (filterDateTo) params.dateTo = filterDateTo;
      if (filterAccountId) params.accountId = filterAccountId;
      if (filterRefType) params.referenceType = filterRefType;
      const data = await contabilidadService.getJournals(params);
      setJournals(data as JournalEntry[]);
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar asientos');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterDateFrom, filterDateTo, filterAccountId, filterRefType]);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await contabilidadService.getChartOfAccounts();
      setAccounts(data as Account[]);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => { loadJournals(); }, [loadJournals]);
  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const accountOptions = accounts.map((a) => ({
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
    } catch (err: any) {
      toast.error(err.message || 'Error al contabilizar');
    }
  }

  async function handleVoid(journal: JournalEntry) {
    try {
      await contabilidadService.voidJournal(journal.id);
      toast.success(`Asiento #${journal.number} anulado`);
      loadJournals();
    } catch (err: any) {
      toast.error(err.message || 'Error al anular');
    }
  }

  async function handleView(journal: JournalEntry) {
    try {
      const full = await contabilidadService.getJournal(journal.id);
      setViewJournal(full as JournalEntry);
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar detalle');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 min-w-[140px]">
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
            <div className="space-y-1 min-w-[140px]">
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
            <div className="space-y-1 min-w-[140px]">
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
            <div className="space-y-1 min-w-[200px]">
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
            <div className="space-y-1 min-w-[160px]">
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
                          {statusKey === 'draft' ? 'Borrador' : statusKey === 'posted' ? 'Contabilizado' : statusKey === 'voided' ? 'Anulado' : j.status}
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
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => handleView(j)}
                            title="Ver detalle"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          {statusKey === 'draft' && canPerform('ACCOUNTING_JOURNAL', 'edit') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-emerald-600 hover:text-emerald-600 hover:bg-emerald-500/10"
                              onClick={() => handlePost(j)}
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
                              onClick={() => handleVoid(j)}
                              title="Anular"
                            >
                              <XCircle className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Detail Dialog */}
      <Dialog open={!!viewJournal} onOpenChange={(open) => { if (!open) setViewJournal(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Asiento #{(viewJournal as any)?.number}
            </DialogTitle>
            <DialogDescription>
              Detalle completo del asiento contable
            </DialogDescription>
          </DialogHeader>

          {viewJournal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
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
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewJournal(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
