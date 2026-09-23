import { useEffect, useState } from 'react';
import { CalendarDays, Clock, MapPin, CheckCircle2, XCircle, Building2, User, Video, ExternalLink, Sparkles, Download, QrCode, CalendarPlus, X } from 'lucide-react';
import { api, getApiUrl } from '../../services/api';
import { toast } from 'sonner';

export function PublicRsvpPage() {
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Extraer token de la URL /rsvp/:token (trabajador interno) o /public/rsvp/:token (invitado externo)
  const pathname = window.location.pathname;
  const token = pathname.split('/').filter(Boolean).pop() || '';

  useEffect(() => {
    if (!token) {
      setError('Token de invitación no especificado');
      setLoading(false);
      return;
    }
    fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/activities/public/invitation/${token}`);
      setInvitation(res.data || res);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo cargar la invitación. El enlace puede haber expirado.');
    } finally {
      setLoading(false);
    }
  };

  const handleRsvp = async (status: 'ACCEPTED' | 'DECLINED') => {
    if (!token || updating) return;
    setUpdating(true);
    try {
      await api.patch(`/activities/public/invitation/${token}/rsvp`, { rsvpStatus: status });
      toast.success(status === 'ACCEPTED' ? '¡Has confirmado tu asistencia con éxito!' : 'Has notificado que no podrás asistir.');
      setInvitation((prev: any) => ({ ...prev, rsvpStatus: status }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al actualizar respuesta');
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('es-NI', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  const formatGoogleDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    } catch {
      return '';
    }
  };

  const getGoogleCalendarUrl = () => {
    if (!invitation?.activity) return '#';
    const act = invitation.activity;
    const start = formatGoogleDate(act.startDate);
    const end = act.endDate ? formatGoogleDate(act.endDate) : start;
    const title = encodeURIComponent(act.title || 'Evento');
    const details = encodeURIComponent(act.description || '');
    const location = encodeURIComponent(act.location || act.meetingUrl || '');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
  };

  const icsDownloadUrl = token ? getApiUrl(`/activities/public/invitation/${token}/ics`) : '#';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm font-semibold text-muted-foreground">Cargando invitación...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="max-w-md w-full rounded-3xl border border-border/60 bg-card p-6 text-center shadow-2xl">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <XCircle className="size-8" />
          </div>
          <h2 className="mt-4 text-lg font-black">Enlace no disponible</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error || 'La invitación ya no se encuentra disponible.'}</p>
        </div>
      </div>
    );
  }

  const activity = invitation.activity || {};
  const tenant = activity.clientTenant || {};
  const currentStatus = invitation.rsvpStatus || 'PENDING';
  const isInternal = invitation.guestType === 'INTERNAL';
  const guestName = isInternal ? (invitation.internalUser?.name || invitation.internalUser?.email) : (invitation.externalName || invitation.externalEmail);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4 text-foreground sm:p-6">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-border/60 bg-card shadow-2xl backdrop-blur-md">
        {/* Banner Superior */}
        <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-6 border-b border-border/40">
          <div className="flex items-center gap-3">
            {tenant.logo ? (
              <div className="flex size-12 items-center justify-center rounded-2xl bg-background border border-border/50 p-1 shadow-md overflow-hidden shrink-0">
                <img src={tenant.logo} alt={tenant.name || 'Empresa'} className="h-full w-full object-contain rounded-xl" />
              </div>
            ) : (
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shrink-0">
                <Building2 className="size-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wider text-primary">Invitación a Evento</p>
              <h1 className="truncate text-lg font-black text-foreground">{tenant.name || 'NovaHub ERP'}</h1>
            </div>
          </div>
        </div>

        {/* Cuerpo del Evento */}
        <div className="p-6 space-y-6">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <Sparkles className="size-3.5" />
              {activity.type === 'MEETING' ? 'Reunión' : 'Evento especial'}
            </span>
            <h2 className="mt-2.5 text-xl font-black leading-snug">{activity.title}</h2>
            {activity.description && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">{activity.description}</p>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-border/40 bg-muted/20 p-4 text-sm">
            <div className="flex items-start gap-3">
              <CalendarDays className="size-4 shrink-0 text-primary mt-0.5" />
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Inicio</p>
                <p className="font-semibold capitalize text-foreground">{formatDate(activity.startDate)}</p>
              </div>
            </div>

            {activity.endDate && (
              <div className="flex items-start gap-3 pt-2 border-t border-border/30">
                <Clock className="size-4 shrink-0 text-primary mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground">Finalización</p>
                  <p className="font-semibold capitalize text-foreground">{formatDate(activity.endDate)}</p>
                </div>
              </div>
            )}

            {activity.location && (
              <div className="flex items-start gap-3 pt-2 border-t border-border/30">
                <MapPin className="size-4 shrink-0 text-primary mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground">Ubicación</p>
                  <p className="font-semibold text-foreground">{activity.location}</p>
                </div>
              </div>
            )}

            {activity.meetingUrl && (
              <div className="flex items-start gap-3 pt-2 border-t border-border/30">
                <Video className="size-4 shrink-0 text-primary mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Videollamada ({activity.meetingPlatform || 'Online'})</p>
                  <a
                    href={activity.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-primary hover:underline truncate max-w-full"
                  >
                    {activity.meetingUrl}
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Persona invitada */}
          <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <User className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invitado registrado</p>
              <p className="truncate text-xs font-bold text-foreground">{guestName || 'Invitado'}</p>
            </div>
            <div className="shrink-0">
              {currentStatus === 'ACCEPTED' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" /> Asistiré
                </span>
              )}
              {currentStatus === 'DECLINED' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                  <XCircle className="size-3.5" /> Rechazado
                </span>
              )}
              {currentStatus === 'PENDING' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Clock className="size-3.5" /> Pendiente
                </span>
              )}
            </div>
          </div>

          {/* Opciones de Calendario */}
          <div className="space-y-2.5 rounded-2xl border border-border/50 bg-muted/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarPlus className="size-4 text-primary" />
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Agregar a mi Calendario</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <a
                href={icsDownloadUrl}
                download={`evento-${activity.id || 'invitacion'}.ics`}
                className="flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 text-xs font-bold text-foreground shadow-sm transition hover:bg-muted hover:border-primary/50"
              >
                <Download className="size-4 text-primary shrink-0" />
                Descargar (.ics)
              </a>

              <a
                href={getGoogleCalendarUrl()}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 text-xs font-bold text-foreground shadow-sm transition hover:bg-muted hover:border-primary/50"
              >
                <ExternalLink className="size-4 text-primary shrink-0" />
                Google Calendar
              </a>
            </div>

            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/10"
            >
              <QrCode className="size-4 shrink-0" />
              Escanear QR para agregar al móvil
            </button>
          </div>

          {/* Botones de Respuesta RSVP */}
          <div className="space-y-3 pt-1">
            <p className="text-center text-xs font-bold text-muted-foreground">¿Confirmas tu asistencia a este evento?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={updating}
                onClick={() => handleRsvp('ACCEPTED')}
                className={`h-12 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md ${
                  currentStatus === 'ACCEPTED'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-500/50'
                    : 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400'
                }`}
              >
                <CheckCircle2 className="size-5" />
                Sí, asistiré
              </button>

              <button
                type="button"
                disabled={updating}
                onClick={() => handleRsvp('DECLINED')}
                className={`h-12 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md ${
                  currentStatus === 'DECLINED'
                    ? 'bg-rose-600 text-white ring-2 ring-rose-500/50'
                    : 'bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 dark:text-rose-400'
                }`}
              >
                <XCircle className="size-5" />
                No podré ir
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Código QR */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl border border-border/60 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="size-5 text-primary" />
                <h3 className="font-black text-base text-foreground">Escanear Calendario</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Escanea este código con la cámara de tu celular para abrir y agregar el evento automáticamente a tu calendario:
            </p>

            <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl shadow-inner border border-border/20">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(getGoogleCalendarUrl())}`}
                alt="Código QR del Calendario"
                className="size-48 object-contain"
              />
            </div>

            <div className="space-y-2 pt-1 text-center">
              <p className="text-[11px] font-semibold text-muted-foreground">
                Compatible con Google Calendar, Apple Calendar y cámaras iOS/Android.
              </p>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="w-full h-10 rounded-xl bg-muted font-bold text-xs hover:bg-muted/80 text-foreground transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
