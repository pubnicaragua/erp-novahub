import { CalendarDays, CalendarClock, CheckCircle2, Clock3, DollarSign, FileText, Flag, Hash, Info, Link2, MapPin, Paperclip, Users, XCircle, BookOpen, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '../ui/sheet';
import { cn } from '../ui/utils';

export type ActivityDetailKind = 'task' | 'event' | 'reminder' | 'log';

interface ActivityDetailSheetProps {
  kind: ActivityDetailKind;
  item: any | null;
  users?: any[];
  accounts?: any[];
  linkedExpense?: any;
  linkedIncome?: any;
  linkedExpenseAccount?: any;
  linkedIncomeAccount?: any;
  linkedExpenseJournal?: any;
  linkedIncomeJournal?: any;
  onOpenChange: (open: boolean) => void;
}

const labels: Record<ActivityDetailKind, { title: string; singular: string; accent: string }> = {
  task: { title: 'Detalle de la tarea', singular: 'Tarea', accent: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  event: { title: 'Detalle del evento', singular: 'Evento', accent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  reminder: { title: 'Detalle del recordatorio', singular: 'Recordatorio', accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  log: { title: 'Detalle de bitácora', singular: 'Registro', accent: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
};

const formatDate = (value: any) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const getTaskDisplayStatus = (item: any) => {
  const status = String(item?.status || 'PENDING').toUpperCase();
  const dueTime = item?.dueDate ? new Date(item.dueDate).getTime() : Number.NaN;
  return ['PENDING', 'IN_PROGRESS'].includes(status) && Number.isFinite(dueTime) && dueTime < Date.now()
    ? 'OVERDUE'
    : status;
};

const translatedLabels: Record<string, string> = {
  LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente',
  PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', COMPLETED: 'Completada', CANCELLED: 'Cancelada', OVERDUE: 'Vencida',
  SENT: 'Enviado', SNOOZED: 'Pospuesto',
  CREATE: 'Creación', UPDATE: 'Actualización', DELETE: 'Eliminación', UPLOAD: 'Carga de archivo', READ: 'Consulta', LOGIN: 'Inicio de sesión', EXPORT: 'Exportación', APPROVE: 'Aprobación', COMPLETE: 'Cierre',
  TASK: 'Tarea', EVENT: 'Evento', CALL: 'Llamada', MEETING: 'Reunión', EMAIL: 'Correo', DEADLINE: 'Fecha límite',
  PERSONAL: 'Personal', DEPARTMENT: 'Departamento', GLOBAL: 'Global',
  ACTIVITY: 'Actividad', ACTIVITIES: 'Actividades', REMINDER: 'Recordatorio', USER: 'Usuario', INVOICE: 'Factura', PRODUCT: 'Producto', CUSTOMER: 'Cliente', SUPPLIER: 'Proveedor', PURCHASE_ORDER: 'Orden de compra', SALES_ORDER: 'Orden de venta', DOCUMENT: 'Documento', FILE: 'Archivo', REPORT: 'Reporte', EXPENSE: 'Gasto', INCOME: 'Ingreso', ACCOUNT: 'Cuenta', PAID: 'Pagado', POSTED: 'Contabilizado', DRAFT: 'Borrador', VOIDED: 'Anulado',
};

const formatLabel = (value: any) => {
  const raw = String(value || '—').trim();
  const key = raw.replaceAll('_', ' ').toUpperCase().replaceAll(' ', '_');
  return translatedLabels[key] || raw.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
};

const formatFileType = (value: any) => {
  const type = String(value || '').toLowerCase();
  if (!type) return 'Archivo';
  if (type.includes('pdf')) return 'Documento PDF';
  if (type.includes('word') || type.includes('document')) return 'Documento de texto';
  if (type.includes('sheet') || type.includes('excel') || type.includes('spreadsheet')) return 'Hoja de cálculo';
  if (type.startsWith('image/')) return 'Imagen';
  if (type.startsWith('video/')) return 'Video';
  if (type.startsWith('audio/')) return 'Audio';
  return 'Archivo';
};

function DetailItem({ label, value, icon: Icon = FileText, mono = false }: { label: string; value?: any; icon?: any; mono?: boolean }) {
  const hasValue = value !== undefined && value !== null && value !== '';
  return (
    <div className="min-w-0 rounded-xl border border-border/40 bg-muted/[0.14] p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <Icon className="size-3.5 text-primary" /> {label}
      </p>
      <p className={cn('mt-1 break-words text-sm font-semibold text-foreground', mono && 'font-mono text-xs')}>{hasValue ? value : '—'}</p>
    </div>
  );
}

function StatusBadge({ value, kind }: { value: any; kind: ActivityDetailKind }) {
  const normalized = String(value || '').toUpperCase();
  const tone = normalized === 'COMPLETED' || normalized === 'SENT' || normalized === 'CREATE' || normalized === 'UPLOAD'
    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    : normalized === 'CANCELLED' || normalized === 'OVERDUE' || normalized === 'DELETE'
      ? 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400'
      : normalized === 'PENDING' || normalized === 'SNOOZED'
        ? 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
        : normalized === 'IN_PROGRESS' || normalized === 'UPDATE'
          ? 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400'
      : kind === 'event' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-primary/20 bg-primary/10 text-primary';
  return <Badge variant="outline" className={cn('border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest', tone)}>{formatLabel(value)}</Badge>;
}

function TaskDetails({ item }: { item: any }) {
  const assignments = item.assignments || [];
  const evidence = item.evidences?.[0];
  const displayStatus = getTaskDisplayStatus(item);
  const isOverdue = displayStatus === 'OVERDUE';
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <DetailItem label="Estado" value={<StatusBadge value={displayStatus} kind="task" />} icon={CheckCircle2} />
        <DetailItem label="Prioridad" value={formatLabel(item.priority)} icon={Flag} />
        <DetailItem label="Vencimiento" value={<span className={isOverdue ? 'text-rose-600 dark:text-rose-400' : undefined}>{formatDate(item.dueDate)}{isOverdue && ' · Vencida'}</span>} icon={Clock3} />
        <DetailItem label="Creada" value={formatDate(item.createdAt)} icon={CalendarDays} />
      </div>
      <DetailSection title="Seguimiento" icon={Info}>
        <div className="grid gap-3 sm:grid-cols-2"><DetailItem label="Tipo de actividad" value={formatLabel(item.type || 'TASK')} icon={FileText} /><DetailItem label="Responsables" value={`${assignments.length} ${assignments.length === 1 ? 'persona asignada' : 'personas asignadas'}`} icon={Users} /><DetailItem label="Responsable principal" value={assignments[0]?.user?.name || assignments[0]?.user?.email || (assignments.length ? 'Responsable asignado' : 'Sin asignar')} icon={Users} /><DetailItem label="Última actualización" value={formatDate(item.updatedAt || item.createdAt)} icon={CalendarClock} /></div>
      </DetailSection>
      <DetailSection title="Descripción" icon={FileText}>
        <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description || 'Esta tarea no tiene una descripción.'}</p>
      </DetailSection>
      <DetailSection title="Responsables" icon={Users}>
        {assignments.length > 0 ? <div className="flex flex-wrap gap-2">{assignments.map((assignment: any) => <Badge key={assignment.id || assignment.userId} variant="secondary" className="rounded-lg px-2.5 py-1 text-xs">{assignment.user?.name || assignment.user?.email || assignment.userId || 'Usuario'}</Badge>)}</div> : <p className="text-sm text-muted-foreground">Sin usuarios asignados.</p>}
      </DetailSection>
      {evidence ? <DetailSection title="Evidencia de cierre" icon={Paperclip}><div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/[0.14] p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{evidence.fileName || 'Archivo de evidencia'}</p><p className="mt-1 text-xs text-muted-foreground">{formatFileType(evidence.fileType)}{evidence.fileSize ? ` · ${formatFileSize(evidence.fileSize)}` : ''} · {formatDate(evidence.uploadedAt)}</p></div><a className="shrink-0 rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/15" href={evidence.fileUrl} target="_blank" rel="noreferrer">Abrir</a></div></DetailSection> : <DetailSection title="Evidencia de cierre" icon={Paperclip}><p className="text-sm text-muted-foreground">Aún no hay evidencia adjunta para esta tarea.</p></DetailSection>}
    </>
  );
}

function AccountingMovementCard({ type, amount, currency, movement, journal, account }: { type: 'expense' | 'income'; amount: any; currency?: string; movement?: any; journal?: any; account: string }) {
  const isExpense = type === 'expense';
  const journalValue = journal ? `${journal.number || 'Asiento generado'} · ${formatLabel(journal.status || 'POSTED')}` : 'Pendiente de contabilizar';
  return (
    <div className="rounded-2xl border border-border/50 bg-muted/[0.12] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', isExpense ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')}>
            {isExpense ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
          </div>
          <div className="min-w-0"><p className="text-sm font-black">{isExpense ? 'Costo del evento' : 'Ingreso del evento'}</p><p className="truncate text-[10px] text-muted-foreground">{movement?.number || 'Movimiento financiero vinculado'}</p></div>
        </div>
        <p className={cn('shrink-0 text-sm font-black tabular-nums', isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>{currency || 'USD'} {Number(amount || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</p>
      </div>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cuenta contable</p><p className="mt-1 break-words font-semibold">{account}</p></div>
        <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado del movimiento</p><p className="mt-1 font-semibold">{formatLabel(movement?.status || (journal ? 'POSTED' : 'PENDING'))}</p></div>
        <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Libro Diario</p><p className="mt-1 break-words font-semibold">{journalValue}</p></div>
        <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Libro Mayor</p><p className="mt-1 font-semibold">{journal ? 'Movimiento generado desde las líneas del asiento' : 'Se generará al completar el evento'}</p></div>
      </div>
    </div>
  );
}

function EventDetails({ item, accounts = [], linkedExpense, linkedIncome, linkedExpenseAccount, linkedIncomeAccount, linkedExpenseJournal, linkedIncomeJournal }: { item: any; accounts?: any[]; linkedExpense?: any; linkedIncome?: any; linkedExpenseAccount?: any; linkedIncomeAccount?: any; linkedExpenseJournal?: any; linkedIncomeJournal?: any }) {
  const balance = (Number(item.income) || 0) - (Number(item.cost) || 0);
  const duration = item.startDate && item.endDate ? Math.max(0, Math.round((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / 60000)) : 0;
  const eventStatus = String(item.status || 'PENDING').toUpperCase();
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <DetailItem label="Estado del evento" value={<StatusBadge value={eventStatus} kind="event" />} icon={CheckCircle2} />
        <DetailItem label="Inicio" value={formatDate(item.startDate)} icon={CalendarDays} />
        <DetailItem label="Fin" value={formatDate(item.endDate)} icon={Clock3} />
        <DetailItem label="Ubicación" value={item.location} icon={MapPin} />
        <DetailItem label="Invitados" value={item.guestEmails?.length || item.attendees?.length || 0} icon={Users} />
      </div>
      <DetailSection title="Ficha del evento" icon={Info}><div className="grid gap-3 sm:grid-cols-2"><DetailItem label="Tipo" value={formatLabel(item.type || 'EVENT')} icon={CalendarDays} /><DetailItem label="Duración" value={duration ? `${Math.floor(duration / 60)} h ${duration % 60 ? `${duration % 60} min` : ''}` : 'No especificada'} icon={Clock3} /><DetailItem label="Creado" value={formatDate(item.createdAt)} icon={CalendarClock} /><DetailItem label="Moneda" value={item.currency || 'USD'} icon={DollarSign} /></div></DetailSection>
      <DetailSection title="Descripción y notas" icon={FileText}><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description || 'Este evento no tiene notas adicionales.'}</p></DetailSection>
      <DetailSection title="Resumen financiero" icon={DollarSign}>
        <div className="grid grid-cols-3 gap-2"><DetailItem label="Costo" value={`${item.currency || 'USD'} ${Number(item.cost || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}`} /><DetailItem label="Ingreso" value={`${item.currency || 'USD'} ${Number(item.income || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}`} /><DetailItem label="Balance" value={<span className={balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{`${item.currency || 'USD'} ${balance.toLocaleString('es-NI', { minimumFractionDigits: 2 })}`}</span>} /></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><DetailItem label="Costo base" value={item.baseCost != null ? String(item.baseCost) : undefined} icon={DollarSign} /><DetailItem label="Ingreso base" value={item.baseIncome != null ? String(item.baseIncome) : undefined} icon={DollarSign} /><DetailItem label="Tasa de cambio" value={item.exchangeRate || undefined} icon={Link2} mono /><DetailItem label="Cuenta de gasto" value={formatAccount(linkedExpense?.accountId || item.expense?.accountId || item.expenseAccountId || item.expenseId, accounts, linkedExpense?.account || linkedExpenseAccount || item.expense?.account || item.expenseAccount)} icon={Link2} /><DetailItem label="Cuenta de ingreso" value={formatAccount(linkedIncome?.accountId || item.income?.accountId || item.incomeAccountId || item.incomeId, accounts, linkedIncome?.account || linkedIncomeAccount || item.income?.account || item.incomeAccount)} icon={Link2} /></div>
      </DetailSection>
      <DetailSection title="Contabilidad" icon={BookOpen}>
        <div className="space-y-3">
          {(Number(item.cost) || 0) > 0 ? <AccountingMovementCard type="expense" amount={item.cost} currency={item.currency} movement={linkedExpense} journal={linkedExpenseJournal} account={formatAccount(linkedExpense?.accountId || item.expense?.accountId || item.expenseAccountId || item.expenseId, accounts, linkedExpense?.account || linkedExpenseAccount || item.expense?.account || item.expenseAccount)} /> : <p className="rounded-xl border border-dashed border-border/60 p-3 text-sm text-muted-foreground">Este evento no tiene un costo registrado.</p>}
          {(Number(item.income) || 0) > 0 ? <AccountingMovementCard type="income" amount={item.income} currency={item.currency} movement={linkedIncome} journal={linkedIncomeJournal} account={formatAccount(linkedIncome?.accountId || item.income?.accountId || item.incomeAccountId || item.incomeId, accounts, linkedIncome?.account || linkedIncomeAccount || item.income?.account || item.incomeAccount)} /> : <p className="rounded-xl border border-dashed border-border/60 p-3 text-sm text-muted-foreground">Este evento no tiene un ingreso registrado.</p>}
        </div>
      </DetailSection>
      {((item.guestEmails || item.attendees || []).length > 0) && <DetailSection title="Invitados" icon={Users}><div className="flex flex-wrap gap-2">{(item.guestEmails || item.attendees || []).map((guest: string) => <Badge key={guest} variant="outline" className="rounded-lg text-xs">{guest}</Badge>)}</div></DetailSection>}
    </>
  );
}

function ReminderDetails({ item, users = [] }: { item: any; users?: any[] }) {
  const targetIds = parseTargetIds(item.targetId);
  const userById = new Map(users.map((user) => [String(user.id), user]));
  return (
    <>
      <div className="grid grid-cols-2 gap-3"><DetailItem label="Estado" value={<StatusBadge value={item.status} kind="reminder" />} icon={CheckCircle2} /><DetailItem label="Alcance" value={formatLabel(item.scope)} icon={Users} /><DetailItem label="Fecha del aviso" value={formatDate(item.reminderDate)} icon={Clock3} /><DetailItem label="Creado" value={formatDate(item.createdAt)} icon={CalendarDays} /><DetailItem label="Actualizado" value={formatDate(item.updatedAt || item.createdAt)} icon={CalendarClock} /><DetailItem label="Actividad vinculada" value={item.activityId} icon={Link2} mono /></div>
      <DetailSection title="Mensaje" icon={FileText}><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description || 'Este recordatorio no tiene detalles adicionales.'}</p></DetailSection>
      <DetailSection title="Destinatarios" icon={Users}><div className="space-y-3"><div className="rounded-xl border border-primary/15 bg-primary/5 p-3"><p className="text-sm font-bold text-foreground">{item.targetId === 'ALL' ? 'Todos los usuarios' : targetIds.length ? `${targetIds.length} usuario${targetIds.length === 1 ? '' : 's'} destinatario${targetIds.length === 1 ? '' : 's'}` : 'No especificados'}</p><p className="mt-1 text-xs text-muted-foreground">El alcance define quién recibirá la notificación programada.</p></div>{targetIds.length > 0 && <div className="space-y-2">{targetIds.map((id) => { const user = userById.get(id); return <div key={id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/[0.14] px-3 py-2"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary">{(user?.name || id).slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-xs font-semibold">{user?.name || 'Usuario destinatario'}</p><p className="truncate font-mono text-[10px] text-muted-foreground">{user?.email || id}</p></div></div>; })}</div>}</div></DetailSection>
    </>
  );
}

function LogDetails({ item }: { item: any }) {
  const linkedActivity = item.activity;
  return (
    <>
      <div className="grid grid-cols-2 gap-3"><DetailItem label="Acción" value={<StatusBadge value={item.action} kind="log" />} icon={Hash} /><DetailItem label="Entidad" value={formatLabel(item.entity)} icon={FileText} /><DetailItem label="Fecha" value={formatDate(item.createdAt || item.timestamp)} icon={CalendarDays} /><DetailItem label="ID de actividad" value={item.activityId || item.entityId} icon={Link2} mono /></div>
      <DetailSection title="Comentarios" icon={FileText}><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.details || 'Sin comentarios.'}</p></DetailSection>
      {linkedActivity && <DetailSection title="Actividad vinculada" icon={Link2}><div className="grid gap-3 sm:grid-cols-2"><DetailItem label="Título" value={linkedActivity.title} icon={FileText} /><DetailItem label="Tipo" value={formatLabel(linkedActivity.type)} icon={Hash} /><DetailItem label="Estado" value={<StatusBadge value={linkedActivity.status} kind="task" />} icon={CheckCircle2} /></div></DetailSection>}
      {item.fileUrl ? <DetailSection title="Archivo adjunto" icon={Paperclip}><div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/[0.14] p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.fileName || 'Archivo adjunto'}</p><p className="mt-1 text-xs text-muted-foreground">{formatFileType(item.fileType)}{item.fileSize ? ` · ${formatFileSize(item.fileSize)}` : ''}</p></div><a className="shrink-0 rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/15" href={item.fileUrl} target="_blank" rel="noreferrer">Abrir</a></div></DetailSection> : <DetailSection title="Archivo adjunto" icon={Paperclip}><p className="text-sm text-muted-foreground">Este registro no tiene archivos adjuntos.</p></DetailSection>}
    </>
  );
}

function parseTargetIds(value: any): string[] {
  if (!value || value === 'ALL') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [String(parsed)];
  } catch {
    return [String(value)];
  }
}

function formatAccount(value: any, accounts: any[], embeddedAccount?: any) {
  const accountId = typeof value === 'object' ? value?.id : value;
  if (!accountId && !embeddedAccount) return 'Sin cuenta vinculada';
  const account = embeddedAccount || accounts.find((candidate) => String(candidate.id) === String(accountId));
  if (!account) return 'Cuenta vinculada';
  return [account.code || account.accountCode, account.name || account.accountName || account.nombre].filter(Boolean).join(' · ') || 'Cuenta vinculada';
}

function formatFileSize(value: any) {
  const bytes = Number(value || 0);
  if (!bytes) return 'Tamaño no disponible';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DetailSection({ title, icon: Icon, children }: { title: string; icon: any; children: ReactNode }) {
  return <Card className="space-y-3 rounded-2xl border-border/50 bg-card/80 p-4 shadow-sm"><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><Icon className="size-4 text-primary" /> {title}</h3>{children}</Card>;
}

export function ActivityDetailSheet({ kind, item, users, accounts, linkedExpense, linkedIncome, linkedExpenseAccount, linkedIncomeAccount, linkedExpenseJournal, linkedIncomeJournal, onOpenChange }: ActivityDetailSheetProps) {
  const config = labels[kind];
  const title = item?.title || (kind === 'log' ? formatLabel(item?.entity) : item?.entity) || config.singular;
  const displayStatus = kind === 'task' ? getTaskDisplayStatus(item) : item?.status;
  const description = kind === 'event' ? (item?.location || 'Registro de actividad') : kind === 'log' ? (item?.action ? formatLabel(item.action) : 'Auditoría del sistema') : (displayStatus ? formatLabel(displayStatus) : 'Registro de actividad');

  return (
    <Sheet open={Boolean(item)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="erp-detail-panel w-full gap-0 overflow-hidden border-l border-border/50 bg-background p-0 sm:max-w-xl">
        <SheetHeader className="sticky top-0 z-10 space-y-3 border-b border-border/50 bg-background/95 px-5 py-5 backdrop-blur-md sm:px-6">
          <div className="flex items-start gap-3 pr-8">
            <div className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl', config.accent)}><FileText className="size-6" /></div>
            <div className="min-w-0 flex-1"><SheetTitle className="truncate text-lg font-black tracking-tight">{title}</SheetTitle><SheetDescription className="mt-1 truncate text-xs">{config.singular} · {description}</SheetDescription></div>
          </div>
          <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-lg border-border/50 text-[10px] font-bold uppercase tracking-wider">ID {item?.id || '—'}</Badge>{displayStatus && <StatusBadge value={displayStatus} kind={kind} />}</div>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1"><div className="space-y-5 p-5 sm:p-6">{item && kind === 'task' && <TaskDetails item={item} />}{item && kind === 'event' && <EventDetails item={item} accounts={accounts} linkedExpense={linkedExpense} linkedIncome={linkedIncome} linkedExpenseAccount={linkedExpenseAccount} linkedIncomeAccount={linkedIncomeAccount} linkedExpenseJournal={linkedExpenseJournal} linkedIncomeJournal={linkedIncomeJournal} />}{item && kind === 'reminder' && <ReminderDetails item={item} users={users} />}{item && kind === 'log' && <LogDetails item={item} />}</div></ScrollArea>
        <SheetFooter className="border-t border-border/50 px-5 py-3 sm:px-6"><Button type="button" variant="outline" className="min-w-24 rounded-xl" onClick={() => onOpenChange(false)}><XCircle className="mr-2 size-4" />Cerrar</Button></SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
