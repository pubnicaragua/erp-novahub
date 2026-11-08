import { useMemo, useState } from 'react';
import { ORGANIZACION_GUIDES } from './guides';
import { useQueryClient } from '@tanstack/react-query';
import { addMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, ChevronRight, Download, Loader2, Pencil, Plus, Search, Send, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { eventsService } from '../../services/actividades.service';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { organizacionService, type OrgPreferences, type OrgUser, type SharedEvent } from '../../services/organizacion.service';
import { toast } from '../../services/toast';
import { NuevaActividadSheet } from './NuevaActividadSheet';
import { ItemDetailSheet } from './ItemDetailSheet';
import { InvitadosSheet } from './InvitadosSheet';
import { EmptyState, ErrorState, Heading, Panel, PageTitle } from './OrgBits';
import { errorMessage, timeZoneLabel, type CalendarItem } from './organizacion.utils';
import { civilDate, formatTime, partsInTz, rangeToInstants, todayCivil } from './organizacion.time';
import { endOfMonth, startOfMonth } from 'date-fns';

interface Props {
  preferences: OrgPreferences;
  users: OrgUser[];
  onOpenAgenda: () => void;
  onOpenSettings: () => void;
}

type Tab = 'events' | 'rsvp' | 'access';
type Filter = 'ALL' | 'EVENTS' | 'PENDING';

const RSVP_BADGE = { ACCEPTED: ['Confirmado', 'bg-emerald-100 text-emerald-900'], PENDING: ['Pendiente RSVP', 'bg-amber-100 text-amber-900'], DECLINED: ['Rechazado', 'bg-rose-100 text-rose-900'] } as const;
const LEVEL_LABEL = { AVAILABILITY: 'Solo disponibilidad', SHARED_EVENTS: 'Ver eventos compartidos', EDIT: 'Ver y editar autorizados' } as const;
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

export function CompartidoView({ preferences, users, onOpenAgenda, onOpenSettings }: Props) {
  const { user, canPerform } = useAuth();
  const queryClient = useQueryClient();
  const tz = preferences.timezone;
  const [tab, setTab] = useState<Tab>('events');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [monthAnchor, setMonthAnchor] = useState(() => todayCivil(tz));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [editItem, setEditItem] = useState<CalendarItem | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const range = useMemo(() => rangeToInstants(startOfMonth(monthAnchor), endOfMonth(monthAnchor), tz), [monthAnchor, tz]);
  const events = useTenantQuery(
    ['organizacion', 'shared-events', format(monthAnchor, 'yyyy-MM'), tz],
    (signal) => organizacionService.getSharedEvents({ from: range.from.toISOString(), to: range.to.toISOString() }, signal),
    { staleTime: 15_000 },
  );
  const access = useTenantQuery(['organizacion', 'access'], (signal) => organizacionService.getAccess(signal), { enabled: tab === 'access', staleTime: 30_000 });

  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['tenant-module'] }); };

  const list = useMemo(() => {
    const all = events.data ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((e) => {
      if (tab === 'rsvp' && e.myRsvp === null) return false;
      if (filter === 'PENDING' && e.myRsvp !== 'PENDING') return false;
      if (filter === 'EVENTS' && e.kind !== 'EVENT') return false;
      if (!q) return true;
      return e.title.toLowerCase().includes(q) || e.guests.some((g) => g.name.toLowerCase().includes(q));
    });
  }, [events.data, filter, search, tab]);

  const selected: SharedEvent | null = list.find((e) => e.id === selectedId) ?? list[0] ?? null;
  const when = (e: SharedEvent) => {
    if (!e.startDate) return 'Sin fecha';
    const s = new Date(e.startDate);
    const p = partsInTz(s, tz);
    const day = format(civilDate(p.y, p.mo, p.d), "EEEE d 'de' MMMM", { locale: es });
    const end = e.endDate ? ` – ${formatTime(new Date(e.endDate), tz)}` : '';
    return `${day} · ${formatTime(s, tz)}${end}`;
  };
  const shortWhen = (e: SharedEvent) => {
    if (!e.startDate) return '';
    const s = new Date(e.startDate);
    const p = partsInTz(s, tz);
    return `${format(civilDate(p.y, p.mo, p.d), 'dd MMM', { locale: es })}, ${formatTime(s, tz)}`;
  };

  const eventModule = selected?.kind === 'MEETING' ? 'ACTIVITIES_MEETINGS' : 'ACTIVITIES_EVENTS';
  const canEdit = Boolean(selected) && canPerform(eventModule, 'edit');
  const canInvite = Boolean(selected) && canPerform(eventModule, 'sendInvitations');
  const canExport = Boolean(selected) && canPerform(eventModule, 'export');
  const canManageGuests = Boolean(selected) && canPerform(eventModule, 'manageGuests');
  const canRespond = canPerform('ORGANIZATION_SHARED', 'edit');
  const canCreateEvent = canPerform('ACTIVITIES_EVENTS', 'create') || canPerform('ACTIVITIES_MEETINGS', 'create');

  const act = async (key: string, fn: () => Promise<unknown>, ok: string, reload = false) => {
    setBusy(key);
    try { await fn(); toast.success(ok); if (reload) refresh(); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(null); }
  };

  const toCalendarItem = (e: SharedEvent): CalendarItem => ({
    key: `event-${e.id}`, id: e.id, kind: e.kind, title: e.title, start: new Date(e.startDate || Date.now()), end: new Date(e.endDate || e.startDate || Date.now()),
    status: e.status, raw: {
      id: e.id, kind: e.kind, busy: false, title: e.title, description: e.description, status: e.status, location: e.location,
      startDate: e.startDate, endDate: e.endDate, meetingUrl: e.meetingUrl, guestCount: e.guests.length,
    },
  });

  const tabs: Array<[Tab, string]> = [['events', 'Eventos compartidos'], ['rsvp', 'Invitaciones RSVP'], ['access', 'Usuarios autorizados']];

  const renderRsvp = (event: SharedEvent) => (event.myRsvp === null ? null : (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 p-3">
      <span className="text-[12px] font-semibold">Tu respuesta:</span>
      <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', RSVP_BADGE[event.myRsvp][1])}>{RSVP_BADGE[event.myRsvp][0].replace(' RSVP', '')}</span>
      {canRespond && (
        <span className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy !== null || event.myRsvp === 'ACCEPTED'}
            onClick={() => void act(`ok-${event.id}`, () => organizacionService.respondRsvp(event.id, 'ACCEPTED'), 'Asistencia confirmada', true)}>
            {busy === `ok-${event.id}` && <Loader2 className="size-3.5 animate-spin" />}Confirmar
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy !== null || event.myRsvp === 'DECLINED'}
            onClick={() => void act(`no-${event.id}`, () => organizacionService.respondRsvp(event.id, 'DECLINED'), 'Asistencia rechazada', true)}>
            {busy === `no-${event.id}` && <Loader2 className="size-3.5 animate-spin" />}Rechazar
          </Button>
        </span>
      )}
    </div>
  ));

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle guide={ORGANIZACION_GUIDES.compartido}
        eyebrow="Organización" title="Compartido"
        subtitle="Consulta eventos de equipo, invitados y confirmaciones RSVP sin salir de NovaHub."
        actions={(
          <>
            <Button type="button" variant="outline" onClick={onOpenAgenda}><CalendarDays className="size-4" aria-hidden="true" />Abrir mi agenda</Button>
            {canCreateEvent && <Button type="button" onClick={() => setNewOpen(true)}><Plus className="size-4" aria-hidden="true" />Nuevo evento</Button>}
          </>
        )}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Secciones de Compartido" className="flex flex-wrap gap-2">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={cn('rounded-lg border px-4 py-2 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', tab === id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted/50')}>
              {label}
            </button>
          ))}
        </div>
        {tab !== 'access' && (
          <div className="flex items-center gap-2">
            <Button type="button" size="icon" variant="outline" onClick={() => setMonthAnchor((m) => addMonths(m, -1))} aria-label="Mes anterior"><ChevronRight className="size-4 rotate-180" /></Button>
            <span className="min-w-36 text-center text-[13px] font-semibold capitalize">{format(monthAnchor, "MMMM 'de' yyyy", { locale: es })}</span>
            <Button type="button" size="icon" variant="outline" onClick={() => setMonthAnchor((m) => addMonths(m, 1))} aria-label="Mes siguiente"><ChevronRight className="size-4" /></Button>
          </div>
        )}
      </div>

      {tab === 'access' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Personas con acceso a tu agenda" icon={<ShieldCheck className="size-4" />}
            action={<Button type="button" size="sm" variant="outline" onClick={onOpenSettings}>Administrar</Button>}>
            {access.isLoading ? <Skeleton className="h-24 w-full" /> : access.isError ? <ErrorState message={errorMessage(access.error)} onRetry={() => void access.refetch()} /> : (
              <ul className="divide-y divide-border">
                {(access.data?.granted ?? []).length === 0 && <li className="py-3 text-[12px] text-muted-foreground">Aún no has autorizado a nadie.</li>}
                {(access.data?.granted ?? []).map((g) => (
                  <li key={g.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex size-9 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-primary dark:text-accent" aria-hidden="true">{initials(g.user.name)}</span>
                    <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold">{g.user.name}</p><p className="truncate text-[11px] text-muted-foreground">{g.user.email}</p></div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">{LEVEL_LABEL[g.level]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Agendas que puedes consultar" icon={<Users className="size-4" />}>
            {access.isLoading ? <Skeleton className="h-24 w-full" /> : (
              <ul className="divide-y divide-border">
                {(access.data?.received ?? []).length === 0 && <li className="py-3 text-[12px] text-muted-foreground">Nadie te ha autorizado todavía. Elige la agenda desde Mi agenda → Filtrar → Calendario cuando alguien lo haga.</li>}
                {(access.data?.received ?? []).map((g) => (
                  <li key={g.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex size-9 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-primary dark:text-accent" aria-hidden="true">{initials(g.user.name)}</span>
                    <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold">{g.user.name}</p></div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">{LEVEL_LABEL[g.level]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <Panel title="Eventos e invitaciones" icon={<Users className="size-4" />} action={<span className="text-[11px] text-muted-foreground">{list.length} {list.length === 1 ? 'próximo' : 'próximos'}</span>}>
            <div className="mb-3 flex flex-wrap gap-2">
              {([['ALL', 'Todos'], ['EVENTS', 'Eventos'], ['PENDING', 'Pendientes RSVP']] as Array<[Filter, string]>).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}
                  className={cn('rounded-lg border px-3 py-1.5 text-[12px] font-semibold', filter === id ? 'border-accent bg-accent/15 text-primary dark:text-accent' : 'border-border hover:bg-muted/50')}>{label}</button>
              ))}
            </div>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar evento o participante" aria-label="Buscar evento o participante"
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-primary/25" />
            </div>
            {events.isLoading ? (
              <div className="space-y-2" aria-busy="true"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
            ) : events.isError ? (
              <ErrorState message={errorMessage(events.error, 'No se pudieron cargar los eventos compartidos')} onRetry={() => void events.refetch()} />
            ) : list.length === 0 ? (
              <EmptyState title="Sin eventos compartidos" description={tab === 'rsvp' ? 'No tienes invitaciones en este periodo.' : 'No hay eventos con invitados en este periodo. Crea un evento e invita a tu equipo.'} />
            ) : (
              <ul className="space-y-2">
                {list.map((e) => {
                  const badge = e.myRsvp ? RSVP_BADGE[e.myRsvp] : (e.rsvpCounts.pending ? RSVP_BADGE.PENDING : RSVP_BADGE.ACCEPTED);
                  return (
                    <li key={e.id}>
                      <button type="button" onClick={() => setSelectedId(e.id)} aria-current={selected?.id === e.id}
                        className={cn('flex w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', selected?.id === e.id ? 'border-accent bg-accent/10' : 'border-border')}>
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-primary dark:text-accent" aria-hidden="true"><CalendarDays className="size-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold">{e.title}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{shortWhen(e)} · {e.guests.length} invitados</span>
                        </span>
                        <span className={cn('hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline', badge[1])}>{badge[0]}</span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title={selected ? 'Evento compartido' : 'Detalle'} icon={<CalendarDays className="size-4" />}>
            {!selected ? <EmptyState title="Selecciona un evento" description="Verás el organizador, los invitados y las confirmaciones." /> : (
              <div className="space-y-4">
                <div>
                  <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-[11px] font-semibold text-primary dark:text-accent">{selected.kind === 'MEETING' ? 'Reunión compartida' : 'Evento compartido'}</span>
                  <Heading level={3} className="mt-2 break-words text-2xl font-semibold text-primary dark:text-foreground" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic' }}>{selected.title}</Heading>
                  <p className="text-[12px] capitalize text-muted-foreground">{when(selected)}</p>
                  <p className="text-[11px] text-muted-foreground">Zona horaria: {timeZoneLabel(tz)}</p>
                </div>
                <dl className="grid grid-cols-2 gap-3 border-y border-border py-3 text-[12px]">
                  <div><dt className="text-muted-foreground">Organizador</dt><dd className="font-semibold">{selected.organizer?.name || (selected.isOrganizer ? user?.name : 'No registrado')}</dd></div>
                  <div><dt className="text-muted-foreground">Visibilidad</dt><dd className="font-semibold">Invitados y autorizados</dd></div>
                  <div className="col-span-2"><dt className="text-muted-foreground">Lugar / modalidad</dt><dd className="break-words font-semibold">{selected.location || 'No especificado'}</dd></div>
                </dl>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Heading level={4} className="text-[13px] font-semibold">Invitados y confirmaciones</Heading>
                    <Button type="button" size="sm" variant="outline" onClick={() => setGuestsOpen(true)}><UserPlus className="size-3.5" aria-hidden="true" />{canManageGuests ? 'Agregar invitado' : 'Ver invitados'}</Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selected.guests.slice(0, 4).map((g) => <span key={g.id} title={g.name} className="flex size-8 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-primary dark:text-accent">{initials(g.name)}</span>)}
                    {selected.guests.length > 4 && <span className="flex size-8 items-center justify-center rounded-full bg-muted text-[10px] font-bold">+{selected.guests.length - 4}</span>}
                    <span className="ml-1 text-[11px] text-muted-foreground">{selected.guests.length} invitados en total</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-900">{selected.rsvpCounts.confirmed} confirmados</span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">{selected.rsvpCounts.pending} pendiente(s)</span>
                    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-900">{selected.rsvpCounts.declined} rechazado(s)</span>
                  </div>
                </div>

                {renderRsvp(selected)}

                <div className="flex flex-wrap gap-2">
                  {canEdit && <Button type="button" onClick={() => setEditItem(toCalendarItem(selected))}><Pencil className="size-4" aria-hidden="true" />Editar evento</Button>}
                  {canInvite && (
                    <Button type="button" variant="outline" disabled={busy !== null || selected.guests.length === 0}
                      onClick={() => void act('invite', () => eventsService.sendInvitations(selected.id), 'Invitaciones enviadas')}>
                      {busy === 'invite' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" aria-hidden="true" />}Enviar invitación
                    </Button>
                  )}
                  {canExport && (
                    <Button type="button" variant="outline" disabled={busy !== null}
                      onClick={() => void act('ics', () => eventsService.downloadIcs(selected.id, selected.title), 'Archivo .ics descargado')}>
                      {busy === 'ics' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" aria-hidden="true" />}Archivo .ics
                    </Button>
                  )}
                </div>
                <p className="rounded-xl bg-muted/40 p-3 text-[11px] text-muted-foreground">
                  Las confirmaciones RSVP corresponden a invitaciones de eventos; no representan reservas de horarios ni booking público. El archivo .ics agrega el evento a un calendario externo, sin sincronización bidireccional.
                </p>
              </div>
            )}
          </Panel>
        </div>
      )}

      <Panel title="Acceso y visibilidad" icon={<ShieldCheck className="size-4" />}>
        <p className="mb-3 text-[12px] text-muted-foreground">Solo se muestran eventos compartidos con tu empresa o personas autorizadas.</p>
        <div className="grid gap-3 md:grid-cols-3">
          {[['Mis eventos', 'Creación y edición según permisos de Actividades.'], ['Compartido', 'Invitados y participantes vinculados al evento.'], ['Permisos', 'Usuarios con acceso explícito desde Configuración.']].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-border p-3"><p className="text-[13px] font-semibold">{t}</p><p className="text-[11px] text-muted-foreground">{d}</p></div>
          ))}
        </div>
      </Panel>

      <InvitadosSheet event={guestsOpen ? selected : null} users={users} dateLabel={selected ? when(selected) : ''} onClose={() => setGuestsOpen(false)} onChanged={refresh} />
      <ItemDetailSheet item={editItem} readOnly={false} timezone={tz} timezoneLabel={timeZoneLabel(tz)} onClose={() => setEditItem(null)} onChanged={refresh} />
      <NuevaActividadSheet open={newOpen} onOpenChange={setNewOpen} initialKind="EVENT" timezone={tz} users={users} onCreated={refresh} />
    </div>
  );
}
