import { useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '../ui/sheet';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import type { Paginated, Params } from '../../services/marketing.service';
import { toPayload, type FieldDef, type FormValues } from './mkt.helpers';
import { EmptyState, ErrorState, Field, NativeSelect, controlClass } from '../organizacion/OrgBits';
import { errorMessage, serifStyle } from '../organizacion/organizacion.utils';
import { STATUS_CLASS } from './marketing.constants';

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold', STATUS_CLASS[status] ?? STATUS_CLASS.DRAFT)}>{label}</span>;
}

export function Kpi({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        {icon && <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-primary dark:text-accent">{icon}</span>}
        <span className="min-w-0 truncate" style={serifStyle}>{label}</span>
      </div>
      <p className="mt-2 truncate text-2xl font-bold text-primary dark:text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ───────────────────────── Tabla de recursos ─────────────────────────
export interface Column<T> { key: string; header: string; render: (row: T) => ReactNode; className?: string }
export interface FilterDef { key: string; label: string; options: Array<{ value: string; label: string }> }

export function ResourceTable<T extends { id: string }>({
  id, fetcher, columns, filters = [], searchPlaceholder = 'Buscar…', toolbar, onRowClick, emptyTitle = 'Sin registros', emptyDescription = 'Crea el primer registro para empezar.', pageSize = 10, extraParams,
}: {
  id: string;
  fetcher: (params: Params, signal?: AbortSignal) => Promise<Paginated<T>>;
  columns: Array<Column<T>>;
  filters?: FilterDef[];
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  extraParams?: Params;
}) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const params = useMemo<Params>(() => ({ q: q.trim() || undefined, page, pageSize, ...filterValues, ...extraParams }), [q, page, pageSize, filterValues, extraParams]);
  const query = useTenantQuery(['marketing', 'list', id, JSON.stringify(params)], (signal) => fetcher(params, signal), { staleTime: 15_000, placeholderData: (prev: Paginated<T> | undefined) => prev });
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="min-w-0 space-y-3" data-tour="resource-table">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="pl-9" />
        </div>
        {filters.map((f) => (
          <NativeSelect key={f.key} aria-label={f.label} className="h-10 w-auto min-w-[150px]" value={filterValues[f.key] ?? ''}
            onChange={(e) => { setFilterValues((v) => ({ ...v, [f.key]: e.target.value })); setPage(1); }}>
            <option value="">{f.label}: todos</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </NativeSelect>
        ))}
        {toolbar}
      </div>

      {query.isLoading ? (
        <div className="space-y-2" aria-busy="true"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error, 'No se pudieron cargar los registros')} onRetry={() => void query.refetch()} />
      ) : (query.data?.data.length ?? 0) === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>{columns.map((c) => <th key={c.key} scope="col" className={cn('px-3 py-2 font-semibold', c.className)}>{c.header}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {query.data!.data.map((row) => (
                <tr key={row.id} className={cn('transition hover:bg-muted/30', onRowClick && 'cursor-pointer')}
                  tabIndex={onRowClick ? 0 : undefined} onClick={() => onRowClick?.(row)}
                  onKeyDown={(e) => { if (onRowClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRowClick(row); } }}>
                  {columns.map((c) => <td key={c.key} className={cn('px-3 py-2.5 align-middle', c.className)}>{c.render(row)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > pageSize && (
        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
          <span>Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}</span>
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior"><ChevronLeft className="size-4" /></Button>
            <span className="px-2">{page} / {pages}</span>
            <Button type="button" size="icon" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Página siguiente"><ChevronRight className="size-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Formulario por configuración ─────────────────────────
export function FormSheet({ open, onOpenChange, title, description, fields, initial, submitLabel = 'Guardar', onSubmit, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; fields: FieldDef[];
  initial?: FormValues; submitLabel?: string; onSubmit: (payload: Record<string, unknown>) => Promise<unknown>; children?: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {open && <FormBody {...{ onOpenChange, title, description, fields, initial, submitLabel, onSubmit }}>{children}</FormBody>}
      </SheetContent>
    </Sheet>
  );
}

function FormBody({ onOpenChange, title, description, fields, initial, submitLabel, onSubmit, children }: Omit<Parameters<typeof FormSheet>[0], 'open'>) {
  const [values, setValues] = useState<FormValues>(() => Object.fromEntries(fields.map((f) => [f.key, initial?.[f.key] ?? ''])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const submit = async () => {
    const missing = fields.find((f) => f.required && !String(values[f.key] ?? '').trim());
    if (missing) return setError(`El campo «${missing.label}» es obligatorio.`);
    setSaving(true); setError('');
    try {
      await onSubmit(toPayload(fields, values));
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e, 'No se pudo guardar. Tus datos se conservaron.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SheetHeader className="space-y-1 border-b border-border px-6 pb-4 pt-6 text-left">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Marketing</p>
        <SheetTitle className="text-3xl text-primary dark:text-foreground" style={serifStyle}>{title}</SheetTitle>
        {description && <SheetDescription>{description}</SheetDescription>}
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => {
            const id = `mkt-${f.key}`;
            return (
              <Field key={f.key} label={f.label} htmlFor={id} required={f.required} hint={f.hint} className={f.span === 2 || f.type === 'textarea' ? 'sm:col-span-2' : undefined}>
                {f.type === 'textarea' ? <Textarea id={id} rows={4} value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} />
                  : f.type === 'select' ? (
                    <NativeSelect id={id} value={values[f.key]} onChange={(e) => set(f.key, e.target.value)}>
                      <option value="">{f.placeholder ?? 'Sin definir'}</option>
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </NativeSelect>
                  ) : (
                    <input id={id} className={controlClass} value={values[f.key]} onChange={(e) => set(f.key, e.target.value)}
                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : 'text'}
                      min={f.type === 'number' ? 0 : undefined} step={f.type === 'number' ? 'any' : undefined} placeholder={f.type === 'tags' ? 'Separados por coma' : undefined} />
                  )}
              </Field>
            );
          })}
        </div>
        {children}
        {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[12px] text-destructive">{error}</p>}
      </div>
      <SheetFooter className="grid grid-cols-2 gap-3 border-t border-border px-6 py-4">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
        <Button type="button" onClick={submit} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{submitLabel}</Button>
      </SheetFooter>
    </>
  );
}
