import { CalendarDays, CalendarClock, CheckCircle2, Clock3, DollarSign, FileText, Flag, Hash, History, Info, Link2, MapPin, Paperclip, Trash2, Users, XCircle, BookOpen, ArrowDownLeft, ArrowUpRight, Copy, Check, Eye, Mail, Phone, ExternalLink } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '../ui/sheet';
import { cn } from '../ui/utils';
import { AuditHistoryDisclosure } from '../ui/AuditHistoryDisclosure';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SubtasksManager } from './SubtasksManager';
import { TimeTracker } from './TimeTracker';

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
  extraActions?: ReactNode;
  onUpdate?: () => void;
  onDelete?: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}

const labels: Record<ActivityDetailKind, { title: string; singular: string; accent: string }> = {
  task: { title: 'Detalle de la tarea', singular: 'Tarea', accent: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  event: { title: 'Detalle del evento', singular: 'Evento', accent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  reminder: { title: 'Detalle del recordatorio', singular: 'Recordatorio', accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  log: { title: 'Detalle de bitácora', singular: 'Registro', accent: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
};

const auditEntityByKind: Record<ActivityDetailKind, string> = {
  task: 'TASK',
  event: 'EVENT',
  reminder: 'REMINDER',
  log: 'ACTIVITY_LOG',
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
  PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', WAITING_APPROVAL: 'Por aprobar', COMPLETED: 'Completada', CANCELLED: 'Cancelada', OVERDUE: 'Vencida',
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
        : normalized === 'WAITING_APPROVAL'
          ? 'border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400'
          : normalized === 'IN_PROGRESS' || normalized === 'UPDATE'
            ? 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400'
      : kind === 'event' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-primary/20 bg-primary/10 text-primary';
  return <Badge variant="outline" className={cn('border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest', tone)}>{formatLabel(value)}</Badge>;
}

function TaskDetails({ item, onUpdate }: { item: any; onUpdate?: () => void }) {
  const assignments = item.assignments || [];
  const evidence = item.evidences?.[0];
  const subtasks = item.subtasks || [];
  const timeEntries = item.timeEntries || [];
  const completedSubtasks = subtasks.filter((s: any) => s.isCompleted).length;
  const totalSeconds = timeEntries.reduce((acc: number, entry: any) => acc + (Number(entry.durationSeconds) || 0), 0);
  const totalHours = (totalSeconds / 3600).toFixed(1);

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

      {item.rejectedReason && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <p className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">Motivo de rechazo</p>
          <p className="mt-1 text-sm font-semibold text-rose-700 dark:text-rose-300">{item.rejectedReason}</p>
          {item.rejectedBy?.name && <p className="mt-1 text-xs text-muted-foreground">Rechazado por: {item.rejectedBy.name} el {formatDate(item.rejectedAt)}</p>}
        </div>
      )}

      {item.approvalNotes && (
        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4">
          <p className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">Notas de envío a aprobación</p>
          <p className="mt-1 text-sm font-semibold text-purple-700 dark:text-purple-300">{item.approvalNotes}</p>
        </div>
      )}

      <DetailSection title="Seguimiento" icon={Info}>
        <div className="grid gap-3 sm:grid-cols-2"><DetailItem label="Tipo de actividad" value={formatLabel(item.type || 'TASK')} icon={FileText} /><DetailItem label="Responsables" value={`${assignments.length} ${assignments.length === 1 ? 'persona asignada' : 'personas asignadas'}`} icon={Users} /><DetailItem label="Responsable principal" value={assignments[0]?.user?.name || assignments[0]?.user?.email || (assignments.length ? 'Responsable asignado' : 'Sin asignar')} icon={Users} /><DetailItem label="Última actualización" value={formatDate(item.updatedAt || item.createdAt)} icon={CalendarClock} /></div>
      </DetailSection>
      <DetailSection title="Descripción" icon={FileText}>
        <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description || 'Esta tarea no tiene una descripción.'}</p>
      </DetailSection>

      <DetailSection title="Checklist y Subtareas" icon={CheckCircle2}>
        <SubtasksManager
          taskId={String(item.id)}
          subtasks={subtasks}
          onSubtasksChange={() => onUpdate?.()}
        />
      </DetailSection>

      <DetailSection title="Control de Tiempo" icon={Clock3}>
        <TimeTracker
          taskId={String(item.id)}
          timeEntries={timeEntries}
          onEntriesChange={() => onUpdate?.()}
        />
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

function EventGuestsList({ item }: { item: any }) {
  const guests = item.guests || [];
  const rawEmails = item.guestEmails || item.attendees || [];

  const handleCopyLink = (token: string) => {
    if (!token) return;
    const url = `${window.location.origin}/rsvp/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Enlace de invitación RSVP copiado al portapapeles');
  };

  const handleSendEmail = (email: string, name: string, token: string) => {
    if (!email) {
      toast.error('Este invitado no tiene un correo registrado');
      return;
    }
    const url = `${window.location.origin}/rsvp/${token}`;
    const subject = encodeURIComponent(`Invitación: ${item.title || 'Evento'}`);
    const body = encodeURIComponent(
      `Hola ${name},\n\nTe invitamos cordialmente a participar en el evento:\n\n` +
      `📌 ${item.title}\n` +
      (item.startDate ? `🗓️ Fecha: ${new Date(item.startDate).toLocaleString('es-NI')}\n` : '') +
      (item.location ? `📍 Lugar: ${item.location}\n` : '') +
      (item.meetingUrl ? `💻 Enlace virtual: ${item.meetingUrl}\n` : '') +
      `\nPor favor confirma tu asistencia en el siguiente enlace:\n${url}\n\n¡Te esperamos!`
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    toast.success(`Abriendo correo para ${email}`);
  };

  const handleSendWhatsApp = (phone: string, name: string, token: string) => {
    if (!phone) {
      toast.error('Este invitado no tiene un número de teléfono registrado');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const url = `${window.location.origin}/rsvp/${token}`;
    const text = encodeURIComponent(
      `¡Hola ${name}! Te invitamos al evento *${item.title || 'Evento'}*.\n\n` +
      (item.startDate ? `🗓️ *Fecha:* ${new Date(item.startDate).toLocaleString('es-NI')}\n` : '') +
      (item.location ? `📍 *Lugar:* ${item.location}\n` : '') +
      (item.meetingUrl ? `💻 *Reunión virtual:* ${item.meetingUrl}\n` : '') +
      `\nPuedes confirmar tu asistencia aquí:\n${url}\n\n¡Esperamos contar contigo!`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
    toast.success(`Abriendo WhatsApp para ${phone}`);
  };

  if (guests.length === 0 && rawEmails.length === 0) {
    return (
      <DetailSection title="Invitados al evento" icon={Users}>
        <p className="text-sm text-muted-foreground">No hay invitados registrados en este evento.</p>
      </DetailSection>
    );
  }

  const acceptedCount = guests.filter((g: any) => g.rsvpStatus === 'ACCEPTED').length;
  const pendingCount = guests.filter((g: any) => g.rsvpStatus === 'PENDING' || !g.rsvpStatus).length;
  const declinedCount = guests.filter((g: any) => g.rsvpStatus === 'DECLINED').length;

  return (
    <DetailSection title="Invitados y Confirmación RSVP" icon={Users}>
      {/* Resumen de RSVP */}
      {guests.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 pb-2 border-b border-border/40 text-xs font-semibold">
          <span className="text-emerald-600 dark:text-emerald-400">✓ {acceptedCount} confirmados</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-amber-600 dark:text-amber-400">• {pendingCount} pendientes</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-rose-600 dark:text-rose-400">✕ {declinedCount} rechazados</span>
        </div>
      )}

      {/* Lista detallada de ActivityGuest */}
      {guests.length > 0 ? (
        <div className="space-y-2.5">
          {guests.map((guest: any) => {
            const isInternal = guest.guestType === 'INTERNAL';
            const name = isInternal
              ? (guest.internalUser?.name || guest.internalUser?.email || 'Usuario interno')
              : (guest.externalName || guest.externalEmail || 'Invitado externo');
            const email = isInternal ? guest.internalUser?.email : guest.externalEmail;
            const phone = guest.externalPhone || guest.internalUser?.employee?.phone || (guest.internalUser as any)?.phone || '';
            const rsvp = guest.rsvpStatus || 'PENDING';
            const roleLabel = guest.role === 'HOST' ? 'Anfitrión' : guest.role === 'SPEAKER' ? 'Conferencista' : guest.role === 'STAFF' ? 'Staff' : 'Invitado';
            const token = guest.accessToken || '';

            return (
              <div
                key={guest.id || token}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border/40 bg-muted/20 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-xs font-bold text-foreground">{name}</p>
                    <span className={cn(
                      'text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider',
                      isInternal ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    )}>
                      {isInternal ? 'Interno' : 'Externo'}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {roleLabel}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                    {email ? (
                      <span className="truncate flex items-center gap-1">
                        <Mail className="size-3 shrink-0 text-primary/70" /> {email}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 italic">Sin correo</span>
                    )}
                    {phone ? (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3 shrink-0 text-emerald-600/70" /> {phone}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 italic">Sin teléfono</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/30">
                  {/* Badge de RSVP */}
                  <div>
                    {rsvp === 'ACCEPTED' && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Confirmado
                      </span>
                    )}
                    {rsvp === 'DECLINED' && (
                      <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        Rechazado
                      </span>
                    )}
                    {rsvp === 'PENDING' && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Pendiente
                      </span>
                    )}
                  </div>

                  {/* Acciones de reenvío de invitación */}
                  <div className="flex items-center gap-1">
                    {/* Ver enlace */}
                    {token && (
                      <a
                        href={`/rsvp/${token}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Ver página de invitación RSVP"
                        className="rounded-lg border border-border/50 bg-background p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                      >
                        <Eye className="size-3.5" />
                      </a>
                    )}

                    {/* Reenviar por correo */}
                    <button
                      type="button"
                      disabled={!email}
                      title={email ? `Reenviar invitación por correo a ${email}` : 'Sin correo registrado'}
                      onClick={() => handleSendEmail(email, name, token)}
                      className={cn(
                        'rounded-lg border border-border/50 bg-background p-1.5 transition-all',
                        email
                          ? 'text-muted-foreground hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400'
                          : 'opacity-30 cursor-not-allowed text-muted-foreground'
                      )}
                    >
                      <Mail className="size-3.5" />
                    </button>

                    {/* Reenviar por WhatsApp */}
                    <button
                      type="button"
                      disabled={!phone}
                      title={phone ? `Reenviar invitación por WhatsApp a ${phone}` : 'Sin teléfono registrado'}
                      onClick={() => handleSendWhatsApp(phone, name, token)}
                      className={cn(
                        'rounded-lg border border-border/50 bg-background p-1.5 transition-all',
                        phone
                          ? 'text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400'
                          : 'opacity-30 cursor-not-allowed text-muted-foreground'
                      )}
                    >
                      <Phone className="size-3.5" />
                    </button>

                    {/* Copiar enlace */}
                    {token && (
                      <button
                        type="button"
                        title="Copiar enlace RSVP personal"
                        onClick={() => handleCopyLink(token)}
                        className="rounded-lg border border-border/50 bg-background p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Fallback para rawEmails sencillos */
        <div className="flex flex-wrap gap-2">
          {rawEmails.map((guestEmail: string) => (
            <Badge key={guestEmail} variant="outline" className="rounded-lg text-xs">
              {guestEmail}
            </Badge>
          ))}
        </div>
      )}
    </DetailSection>
  );
}

function EventDetails({ item, accounts = [], linkedExpense, linkedIncome, linkedExpenseAccount, linkedIncomeAccount, linkedExpenseJournal, linkedIncomeJournal }: { item: any; accounts?: any[]; linkedExpense?: any; linkedIncome?: any; linkedExpenseAccount?: any; linkedIncomeAccount?: any; linkedExpenseJournal?: any; linkedIncomeJournal?: any }) {
  const balance = (Number(item.income) || 0) - (Number(item.cost) || 0);
  const duration = item.startDate && item.endDate ? Math.max(0, Math.round((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / 60000)) : 0;
  const eventStatus = String(item.status || 'PENDING').toUpperCase();
  const guestCount = (item.guests || []).length || (item.guestEmails || item.attendees || []).length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <DetailItem label="Estado del evento" value={<StatusBadge value={eventStatus} kind="event" />} icon={CheckCircle2} />
        <DetailItem label="Inicio" value={formatDate(item.startDate)} icon={CalendarDays} />
        <DetailItem label="Fin" value={formatDate(item.endDate)} icon={Clock3} />
        <DetailItem label="Ubicación" value={item.location} icon={MapPin} />
        <DetailItem label="Invitados" value={guestCount} icon={Users} />
      </div>

      {item.meetingUrl && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wider text-primary">Videollamada ({item.meetingPlatform || 'Online'})</p>
            <p className="mt-0.5 truncate text-xs font-mono text-muted-foreground">{item.meetingUrl}</p>
          </div>
          <a href={item.meetingUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90">
            Unirse
          </a>
        </div>
      )}

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
      <EventGuestsList item={item} />
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

export function ActivityDetailSheet({ kind, item, users, accounts, linkedExpense, linkedIncome, linkedExpenseAccount, linkedIncomeAccount, linkedExpenseJournal, linkedIncomeJournal, extraActions, onUpdate, onDelete, onOpenChange }: ActivityDetailSheetProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const config = labels[kind];
  const title = item?.title || (kind === 'log' ? formatLabel(item?.entity) : item?.entity) || config.singular;
  const displayStatus = kind === 'task' ? getTaskDisplayStatus(item) : item?.status;
  const description = kind === 'event' ? (item?.location || 'Registro de actividad') : kind === 'log' ? (item?.action ? formatLabel(item.action) : 'Auditoría del sistema') : (displayStatus ? formatLabel(displayStatus) : 'Registro de actividad');

  return (
    <>
    <Sheet open={Boolean(item)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="erp-detail-panel w-full gap-0 overflow-hidden border-l border-border/50 bg-background p-0 sm:max-w-xl">
        <SheetHeader className="sticky top-0 z-10 space-y-3 border-b border-border/50 bg-background/95 px-5 py-5 backdrop-blur-md sm:px-6">
          <div className="flex items-start gap-3 pr-8">
            <div className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl', config.accent)}><FileText className="size-6" /></div>
            <div className="min-w-0 flex-1"><SheetTitle className="truncate text-lg font-black tracking-tight">{title}</SheetTitle><SheetDescription className="mt-1 truncate text-xs">{config.singular} · {description}</SheetDescription></div>
          </div>
          <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-lg border-border/50 text-[10px] font-bold uppercase tracking-wider">ID {item?.id || '—'}</Badge>{displayStatus && <StatusBadge value={displayStatus} kind={kind} />}</div>
          {(extraActions || onDelete) && <div className="flex flex-wrap gap-2" data-tour="activity-detail-actions">{extraActions}{onDelete && <Button type="button" variant="outline" className="rounded-xl border-rose-500/30 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-2 size-4" />Eliminar</Button>}</div>}
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1"><div className="space-y-5 p-5 sm:p-6">{item && kind === 'task' && <TaskDetails item={item} onUpdate={onUpdate} />}{item && kind === 'event' && <EventDetails item={item} accounts={accounts} linkedExpense={linkedExpense} linkedIncome={linkedIncome} linkedExpenseAccount={linkedExpenseAccount} linkedIncomeAccount={linkedIncomeAccount} linkedExpenseJournal={linkedExpenseJournal} linkedIncomeJournal={linkedIncomeJournal} />}{item && kind === 'reminder' && <ReminderDetails item={item} users={users} />}{item && kind === 'log' && <LogDetails item={item} />}{item && <AuditHistoryDisclosure entity={auditEntityByKind[kind]} entityId={String(item.id)} createdAt={item.createdAt} />}</div></ScrollArea>
        <SheetFooter className="border-t border-border/50 px-5 py-3 sm:px-6"><Button type="button" variant="outline" className="min-w-24 rounded-xl" onClick={() => onOpenChange(false)}><XCircle className="mr-2 size-4" />Cerrar</Button></SheetFooter>
      </SheetContent>
    </Sheet>
    <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={`¿Eliminar ${config.singular.toLowerCase()}?`} description="Esta acción eliminará el registro y no se puede deshacer." confirmLabel="Eliminar" onConfirm={async () => { await onDelete?.(); setDeleteOpen(false); }} />
    </>
  );
}
