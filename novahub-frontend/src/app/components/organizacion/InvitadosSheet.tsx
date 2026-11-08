import { useState } from 'react';
import { Download, Loader2, Send, Trash2, UserPlus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { eventsService } from '../../services/actividades.service';
import type { OrgUser, SharedEvent } from '../../services/organizacion.service';
import { toast } from '../../services/toast';
import { NativeSelect } from './OrgBits';
import { errorMessage, serifStyle } from './organizacion.utils';

const RSVP_LABEL = { ACCEPTED: 'Confirmado', PENDING: 'Pendiente', DECLINED: 'Rechazado' } as const;
const RSVP_CLASS = {
  ACCEPTED: 'bg-emerald-100 text-emerald-900',
  PENDING: 'bg-amber-100 text-amber-900',
  DECLINED: 'bg-rose-100 text-rose-900',
} as const;

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

interface Props {
  event: SharedEvent | null;
  users: OrgUser[];
  dateLabel: string;
  onClose: () => void;
  onChanged: () => void;
}

/** Gestión de invitados y confirmaciones. RSVP confirma asistencia a un evento: no crea reservas ni disponibilidad. */
export function InvitadosSheet({ event, users, dateLabel, onClose, onChanged }: Props) {
  const { canPerform } = useAuth();
  const [newGuest, setNewGuest] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const module = event?.kind === 'MEETING' ? 'ACTIVITIES_MEETINGS' : 'ACTIVITIES_EVENTS';
  const canManage = canPerform(module, 'manageGuests');
  const canInvite = canPerform(module, 'sendInvitations');
  const canExport = canPerform(module, 'export');

  const run = async (key: string, fn: () => Promise<unknown>, success?: string, refresh = true) => {
    setBusy(key); setError('');
    try {
      await fn();
      if (success) toast.success(success);
      if (refresh) onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const existing = new Set((event?.guests ?? []).map((g) => g.email?.toLowerCase()).filter(Boolean));
  const addable = users.filter((u) => !existing.has(u.email.toLowerCase()));

  return (
    <Sheet open={Boolean(event)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <SheetHeader className="space-y-1 border-b border-border px-6 pb-4 pt-6 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Organización</p>
          <SheetTitle className="text-3xl text-primary dark:text-foreground" style={serifStyle}>Invitados y RSVP</SheetTitle>
          <SheetDescription>Evento: {event?.title} · {dateLabel}</SheetDescription>
        </SheetHeader>

        {event && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="rounded-xl bg-accent/10 p-4">
              <p className="text-[18px] font-bold text-primary dark:text-foreground">{event.guests.length} invitados</p>
              <p className="text-[12px] text-muted-foreground">
                {event.rsvpCounts.confirmed} confirmados · {event.rsvpCounts.pending} pendiente(s) · {event.rsvpCounts.declined} rechazado(s)
              </p>
            </div>

            <section aria-labelledby="inv-list">
              <h3 id="inv-list" className="mb-2 text-[14px] font-semibold">Lista de participantes</h3>
              <ul className="divide-y divide-border">
                {event.guests.length === 0 && <li className="py-3 text-[12px] text-muted-foreground">Este evento aún no tiene invitados.</li>}
                {event.guests.map((g) => (
                  <li key={g.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-primary dark:text-accent" aria-hidden="true">{initials(g.name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{g.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{g.type === 'EXTERNAL' ? 'Invitado externo' : 'Equipo'}{g.email ? ` · ${g.email}` : ''}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${RSVP_CLASS[g.rsvpStatus]}`}>{RSVP_LABEL[g.rsvpStatus]}</span>
                    {canManage && (
                      <Button type="button" size="icon" variant="ghost" className="size-8 text-destructive" aria-label={`Quitar a ${g.name}`}
                        disabled={busy !== null}
                        onClick={() => void run(`rm-${g.id}`, () => api.delete(`/activities/events/${event.id}/guests/${g.id}`), 'Invitado eliminado')}>
                        {busy === `rm-${g.id}` ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {canManage && (
              <section aria-labelledby="inv-add" className="space-y-2">
                <h3 id="inv-add" className="text-[14px] font-semibold">Agregar invitado</h3>
                <div className="flex gap-2">
                  <NativeSelect value={newGuest} onChange={(e) => setNewGuest(e.target.value)} aria-label="Usuario a invitar">
                    <option value="">Selecciona un usuario…</option>
                    {addable.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </NativeSelect>
                  <Button type="button" disabled={!newGuest || busy !== null}
                    onClick={() => void run('add', async () => { await api.post(`/activities/events/${event.id}/guests`, { guestType: 'INTERNAL', internalUserId: newGuest }); setNewGuest(''); }, 'Invitado agregado')}>
                    {busy === 'add' ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" aria-hidden="true" />}Agregar
                  </Button>
                </div>
              </section>
            )}

            <section aria-labelledby="inv-actions">
              <h3 id="inv-actions" className="mb-2 text-[14px] font-semibold">Acciones de invitación</h3>
              <p className="rounded-xl border border-border bg-muted/30 p-3 text-[12px]">
                <strong>RSVP confirma asistencia a un evento.</strong> No crea reservas ni bloqueos de disponibilidad.
              </p>
            </section>
            {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[12px] text-destructive">{error}</p>}
          </div>
        )}

        <SheetFooter className="grid grid-cols-2 gap-3 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" disabled={!event || !canExport || busy !== null}
            title={canExport ? undefined : 'Tu rol no puede exportar eventos'}
            onClick={() => event && void run('ics', () => eventsService.downloadIcs(event.id, event.title), 'Archivo .ics descargado', false)}>
            {busy === 'ics' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" aria-hidden="true" />}Archivo .ics
          </Button>
          <Button type="button" disabled={!event || !canInvite || event.guests.length === 0 || busy !== null}
            title={canInvite ? undefined : 'Tu rol no puede enviar invitaciones'}
            onClick={() => event && void run('invite', () => eventsService.sendInvitations(event.id), 'Invitaciones enviadas')}>
            {busy === 'invite' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" aria-hidden="true" />}Enviar invitaciones
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
