import { useMemo, useState } from 'react';
import { MARKETING_GUIDES } from './guides';
import { Loader2, Plus, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { customersService } from '../../services/ventas.service';
import { marketingApi, mktResources, type MktAccount, type MktBrief } from '../../services/marketing.service';
import { toast } from '../../services/toast';
import { PageTitle } from '../organizacion/OrgBits';
import { errorMessage } from '../organizacion/organizacion.utils';
import { ACCOUNT_STATUS_LABEL, BRIEF_STATUS_LABEL, fmtDate } from './marketing.constants';
import { FormSheet, ResourceTable, StatusBadge, type Column } from './MktBits';
import { options, toInitial, useMktRefresh, useMktUsers, userName, userOptions, type FieldDef } from './mkt.helpers';
import { cn } from '../ui/utils';

const STRATEGY_FIELDS: Array<[string, string]> = [
  ['problem', 'Problema u oportunidad'], ['objectives', 'Objetivos'], ['audience', 'Público objetivo'],
  ['pillars', 'Pilares de mensaje'], ['channels', 'Canales de difusión'], ['deliverables', 'Entregables clave'],
];

export function ClientesView({ openCreate = false }: { openCreate?: boolean }) {
  const { canPerform } = useAuth();
  const refresh = useMktRefresh();
  const users = useMktUsers();
  const canCreate = canPerform('MARKETING_CLIENTS', 'create');
  // Desde el acceso rápido "Nuevo brief" se abre directo la pestaña de briefs con el formulario listo.
  const [tab, setTab] = useState<'accounts' | 'briefs'>(openCreate && canCreate ? 'briefs' : 'accounts');
  const [form, setForm] = useState<{ kind: 'accounts' | 'briefs'; row?: MktAccount | MktBrief } | null>(openCreate && canCreate ? { kind: 'briefs' } : null);
  const [busy, setBusy] = useState(false);
  const canEdit = canPerform('MARKETING_CLIENTS', 'edit');
  const canSubmit = canPerform('MARKETING_CLIENTS', 'submit');

  // Clientes de Ventas: se vinculan (sin duplicar sus datos) solo si el rol puede consultarlos.
  const canLinkCustomers = canPerform('SALES_CLIENTS', 'view');
  const customers = useTenantQuery(['marketing', 'customers-lookup'], (signal) => customersService.getLookup({ pageSize: 100 }, signal), { enabled: canLinkCustomers, staleTime: 5 * 60_000 });
  const accountsList = useTenantQuery(['marketing', 'accounts-all'], (signal) => mktResources.accounts.list({ pageSize: 100 }, signal), { staleTime: 60_000 });

  const accountFields: FieldDef[] = useMemo(() => [
    { key: 'name', label: 'Nombre del cliente o cuenta', type: 'text', required: true, span: 2 },
    ...(canLinkCustomers ? [{ key: 'customerId', label: 'Cliente de Ventas', type: 'select', options: (customers.data?.data ?? []).map((c) => ({ value: c.id, label: c.companyName || c.name })), hint: 'Vincula el registro existente sin duplicar sus datos.', placeholder: 'Sin vincular' } as FieldDef] : []),
    { key: 'industry', label: 'Industria', type: 'text' },
    { key: 'tier', label: 'Tipo de cuenta', type: 'select', options: [{ value: 'STANDARD', label: 'Estándar' }, { value: 'STRATEGIC', label: 'Estratégica' }] },
    { key: 'status', label: 'Estado', type: 'select', options: options(ACCOUNT_STATUS_LABEL) },
    { key: 'ownerUserId', label: 'Responsable de la cuenta', type: 'select', options: userOptions(users.data) },
    { key: 'contactName', label: 'Contacto principal', type: 'text' },
    { key: 'contactEmail', label: 'Correo', type: 'text' },
    { key: 'contactPhone', label: 'Teléfono', type: 'text' },
    { key: 'website', label: 'Sitio web', type: 'text' },
    { key: 'serviceLines', label: 'Líneas de servicio', type: 'tags' },
    { key: 'notes', label: 'Notas', type: 'textarea' },
  ], [canLinkCustomers, customers.data, users.data]);

  const briefFields: FieldDef[] = useMemo(() => [
    { key: 'title', label: 'Título del brief', type: 'text', required: true, span: 2 },
    { key: 'accountId', label: 'Cuenta', type: 'select', options: (accountsList.data?.data ?? []).map((a) => ({ value: a.id, label: a.name })) },
    { key: 'status', label: 'Estado', type: 'select', options: options(BRIEF_STATUS_LABEL) },
    { key: 'budgetTotal', label: 'Presupuesto total', type: 'number' },
    { key: 'dueDate', label: 'Vencimiento', type: 'date' },
    { key: 'ownerUserId', label: 'Responsable', type: 'select', options: userOptions(users.data) },
    ...STRATEGY_FIELDS.map(([k, label]) => ({ key: `s_${k}`, label, type: 'textarea', span: 2 } as FieldDef)),
  ], [accountsList.data, users.data]);

  const accountColumns: Array<Column<MktAccount>> = [
    { key: 'name', header: 'Cliente / cuenta', render: (r) => <div><p className="font-semibold">{r.name}</p><p className="text-[11px] text-muted-foreground">{r.tier === 'STRATEGIC' ? 'Cuenta estratégica' : 'Cuenta estándar'}{r.industry ? ` · ${r.industry}` : ''}</p></div> },
    { key: 'contact', header: 'Contacto', render: (r) => <div><p>{r.contactName || '—'}</p><p className="text-[11px] text-muted-foreground">{r.contactEmail || r.contactPhone || ''}</p></div> },
    { key: 'lines', header: 'Líneas de servicio', render: (r) => <div className="flex flex-wrap gap-1">{r.serviceLines.slice(0, 3).map((s) => <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{s}</span>)}</div> },
    { key: 'status', header: 'Estado', render: (r) => <StatusBadge status={r.status} label={ACCOUNT_STATUS_LABEL[r.status] ?? r.status} /> },
    { key: 'owner', header: 'Responsable', render: (r) => userName(users.data, r.ownerUserId) },
  ];
  const briefColumns: Array<Column<MktBrief>> = [
    { key: 'code', header: 'Código', render: (r) => <span className="font-mono text-[12px]">{r.code}</span> },
    { key: 'title', header: 'Brief', render: (r) => <span className="font-semibold">{r.title}</span> },
    { key: 'account', header: 'Cuenta', render: (r) => accountsList.data?.data.find((a) => a.id === r.accountId)?.name ?? '—' },
    { key: 'status', header: 'Estado', render: (r) => <StatusBadge status={r.status} label={BRIEF_STATUS_LABEL[r.status]} /> },
    { key: 'due', header: 'Vence', render: (r) => fmtDate(r.dueDate) },
    { key: 'owner', header: 'Responsable', render: (r) => userName(users.data, r.ownerUserId) },
  ];

  const save = async (payload: Record<string, unknown>) => {
    if (!form) return;
    let body = payload;
    if (form.kind === 'briefs') {
      const strategy = Object.fromEntries(STRATEGY_FIELDS.map(([k]) => [k, payload[`s_${k}`]]).filter(([, v]) => v));
      body = Object.fromEntries(Object.entries(payload).filter(([k]) => !k.startsWith('s_')));
      body.strategy = strategy;
    }
    const api = mktResources[form.kind] as { create: (d: Record<string, unknown>) => Promise<unknown>; update: (id: string, d: Record<string, unknown>) => Promise<unknown> };
    await (form.row ? api.update(form.row.id, body) : api.create(body));
    toast.success(form.row ? 'Cambios guardados' : 'Registro creado');
    refresh();
  };

  const requestStrategy = async (brief: MktBrief) => {
    setBusy(true);
    try { await marketingApi.requestStrategy(brief.id); toast.success('Se solicitó la aprobación de la estrategia'); setForm(null); refresh(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const fields = form?.kind === 'briefs' ? briefFields : accountFields;
  const initial = form?.kind === 'briefs' && form.row
    ? { ...toInitial(briefFields, form.row), ...Object.fromEntries(STRATEGY_FIELDS.map(([k]) => [`s_${k}`, String((form.row as MktBrief).strategy?.[k] ?? '')])) }
    : toInitial(fields, form?.row);
  const editingBrief = form?.kind === 'briefs' ? (form.row as MktBrief | undefined) : undefined;

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle guide={MARKETING_GUIDES.clientes} eyebrow="Marketing" title="Clientes y briefs" subtitle="Directorio de cuentas de marketing y briefs con su estrategia. Los clientes de Ventas se vinculan, no se duplican." />
      <div role="tablist" aria-label="Clientes y briefs" className="flex gap-2">
        {([['accounts', 'Cuentas'], ['briefs', 'Briefs y estrategias']] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={cn('rounded-lg border px-4 py-2 text-[13px] font-semibold', tab === id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted/50')}>{label}</button>
        ))}
      </div>

      {tab === 'accounts' ? (
        <ResourceTable<MktAccount> id="accounts" fetcher={mktResources.accounts.list} columns={accountColumns} searchPlaceholder="Buscar cliente, contacto o industria…"
          filters={[{ key: 'status', label: 'Estado', options: options(ACCOUNT_STATUS_LABEL) }]}
          emptyTitle="Aún no hay cuentas" emptyDescription="Crea una cuenta o vincula un cliente de Ventas para empezar."
          onRowClick={canEdit ? (row) => setForm({ kind: 'accounts', row }) : undefined}
          toolbar={canCreate ? <Button type="button" onClick={() => setForm({ kind: 'accounts' })}><Plus className="size-4" aria-hidden="true" />Nuevo cliente</Button> : undefined} />
      ) : (
        <ResourceTable<MktBrief> id="briefs" fetcher={mktResources.briefs.list} columns={briefColumns} searchPlaceholder="Buscar brief o código…"
          filters={[{ key: 'status', label: 'Etapa', options: options(BRIEF_STATUS_LABEL) }]}
          emptyTitle="Aún no hay briefs" emptyDescription="Registra un brief con su estrategia antes de crear la campaña."
          onRowClick={canEdit ? (row) => setForm({ kind: 'briefs', row }) : undefined}
          toolbar={canCreate ? <Button type="button" onClick={() => setForm({ kind: 'briefs' })}><Plus className="size-4" aria-hidden="true" />Nuevo brief</Button> : undefined} />
      )}

      <FormSheet key={form ? `${form.kind}-${form.row?.id ?? 'new'}` : 'closed'} open={Boolean(form)} onOpenChange={(o) => { if (!o) setForm(null); }}
        title={`${form?.row ? 'Editar' : 'Nuevo'} ${form?.kind === 'briefs' ? 'brief' : 'cliente'}`} fields={fields} initial={initial} onSubmit={save}>
        {editingBrief && canSubmit && ['DRAFT', 'IN_DEVELOPMENT'].includes(editingBrief.status) && (
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-[12px]">
            <p className="mb-2">Cuando la estrategia esté lista, solicita su aprobación. Los aprobadores recibirán una notificación.</p>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void requestStrategy(editingBrief)}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" aria-hidden="true" />}Solicitar aprobación de estrategia
            </Button>
          </div>
        )}
      </FormSheet>
    </div>
  );
}
