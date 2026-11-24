import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Plus, QrCode, RefreshCw, ShieldCheck, Smartphone, Users } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '../../../services/api';
import { usersService } from '../../../services/users.service';
import { asList, useTenantQuery } from '../../../hooks/useTenantQuery';
import { whatsappService, type WaLine, type WaOverview } from '../../../services/whatsapp.service';
import { useWaTenantKey } from './WhatsAppChat';
import { FALLBACK_LINE_COLOR, PROVIDER_LABEL, STATUS_LABEL, formatPhone, initials } from './whatsappUi';

const SWATCHES = ['#16a34a', '#2563eb', '#9333ea', '#ea580c', '#0891b2', '#db2777', '#65a30d', '#ca8a04'];

type MemberMap = Record<string, { canReply: boolean }>;

const HISTORY_CHOICES = [{ days: 30, label: 'Últimos 30 días' }, { days: 90, label: 'Últimos 3 meses' }, { days: 180, label: 'Últimos 6 meses' }, { days: 365, label: 'Último año' }];

/** Elegir si se traen los chats anteriores. WhatsApp solo lo permite al vincular el número. */
function HistoryOption({ value, onChange }: { value: number | null; onChange: (days: number | null) => void }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <div className="flex items-start gap-3">
        <Switch checked={value != null} onCheckedChange={(on) => onChange(on ? 90 : null)} aria-label="Importar chats anteriores" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">Importar mis chats anteriores</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Trae al ERP las conversaciones y grupos que ya tenías, sin marcarlos como pendientes. Solo se puede elegir ahora, al vincular. Ocupa espacio en el servidor y puede tener un costo adicional.</p>
        </div>
      </div>
      {value != null && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {HISTORY_CHOICES.map((c) => (
            <button key={c.days} type="button" onClick={() => onChange(c.days)} className={`rounded-full border px-3 py-1 text-[11px] font-bold ${value === c.days ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border/60 text-muted-foreground hover:bg-muted/50'}`}>{c.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Texto del avance del historial; un lote que lleva más de 10 minutos sin novedades se da por terminado. */
function historyText(h: NonNullable<WaLine['history']>) {
  const done = h.status === 'DONE' || (h.status === 'IMPORTING' && h.updatedAt && Date.now() - new Date(h.updatedAt).getTime() > 10 * 60_000);
  const n = h.messages.toLocaleString('es-NI');
  if (done) return `Historial importado: ${n} mensajes de los últimos ${h.days} días.`;
  return h.status === 'IMPORTING' ? `Importando historial… ${n} mensajes hasta ahora.` : `Historial pendiente: se importará lo de los últimos ${h.days} días cuando el teléfono lo envíe.`;
}

function sinceLabel(iso?: string | null) {
  if (!iso) return '';
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 1440) return `hace ${Math.round(minutes / 60)} h`;
  return `hace ${Math.round(minutes / 1440)} d`;
}

function MembersEditor({ value, onChange }: { value: MemberMap; onChange: (next: MemberMap) => void }) {
  const users = useTenantQuery(['wa', 'users'], (signal) => usersService.getAll(undefined, signal), { staleTime: 5 * 60_000 });
  const list = asList(users.data).filter((u: any) => u?.isActive !== false);
  if (users.isLoading) return <div className="flex justify-center py-4"><Loader2 className="size-4 animate-spin" /></div>;
  if (!list.length) return <p className="text-xs text-muted-foreground">No encontré usuarios en la empresa.</p>;
  return (
    <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border/50 p-1.5">
      {list.map((u: any) => {
        const on = Boolean(value[u.id]);
        return (
          <div key={u.id} className={`flex items-center gap-3 rounded-lg px-2.5 py-2 ${on ? 'bg-primary/[0.06]' : ''}`}>
            <input
              type="checkbox" checked={on} className="size-4 accent-emerald-600" aria-label={`Asignar a ${u.name}`}
              onChange={(e) => { const next = { ...value }; if (e.target.checked) next[u.id] = { canReply: true }; else delete next[u.id]; onChange(next); }}
            />
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{u.name}</p><p className="truncate text-[10px] text-muted-foreground">{u.email}</p></div>
            {on && (
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                Puede responder
                <Switch checked={value[u.id].canReply} onCheckedChange={(checked) => onChange({ ...value, [u.id]: { canReply: checked } })} />
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Muestra el QR, cambia solo a "Conectado" cuando el teléfono lo escanea y pide un código nuevo si vence. */
function PairingPanel({ lineId, initialQr, onConnected }: { lineId: string; initialQr?: string; onConnected: () => void }) {
  const [restarting, setRestarting] = useState(false);
  const [historyDays, setHistoryDays] = useState<number | null>(null);
  const notified = useRef(false);
  const status = useQuery({
    queryKey: ['wa-pairing', lineId],
    queryFn: ({ signal }) => whatsappService.pairingStatus(lineId, false, signal),
    refetchInterval: (q) => (q.state.data?.state === 'open' ? false : 3000),
    refetchIntervalInBackground: false, retry: true, staleTime: 0, gcTime: 0,
  });
  const open = status.data?.state === 'open';
  const closed = status.data?.state === 'close';
  // WhatsApp invalida cada código a los ~45 segundos (no se puede alargar); se consulta seguido para mostrar siempre el vigente.
  const qrQuery = useQuery({
    queryKey: ['wa-pairing-qr', lineId],
    queryFn: ({ signal }) => whatsappService.pairingStatus(lineId, true, signal),
    enabled: !open && !closed,
    refetchInterval: 5_000, refetchIntervalInBackground: false, staleTime: 0, gcTime: 0, retry: true,
  });
  const qr = qrQuery.data?.qr || initialQr;
  useEffect(() => {
    if (open && !notified.current) { notified.current = true; onConnected(); }
  }, [open, onConnected]);

  const restart = async () => {
    setRestarting(true);
    try { await whatsappService.restartPairing(lineId, { historyDays }); void status.refetch(); void qrQuery.refetch(); } catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo generar un código nuevo.')); } finally { setRestarting(false); }
  };

  if (open) {
    return <div className="py-8 text-center"><CheckCircle2 className="mx-auto size-14 text-emerald-500" /><p className="mt-3 text-lg font-black">¡Conectado!</p><p className="mt-1 text-sm text-muted-foreground">Tu número ya está vinculado. Sigue funcionando en tu teléfono como siempre.</p></div>;
  }
  return (
    <div className="grid gap-5 py-1 sm:grid-cols-[1fr_auto]">
      <ol className="space-y-3 text-sm">
        {['Abre WhatsApp en tu teléfono', 'Toca Menú (⋮) o Configuración y entra a Dispositivos vinculados', 'Toca Vincular un dispositivo y escanea este código'].map((t, i) => (
          <li key={t} className="flex items-start gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-800">{i + 1}</span><span>{t}</span></li>
        ))}
        <li className="rounded-lg bg-muted/50 p-2.5 text-[11px] text-muted-foreground">Tu número sigue funcionando en tu teléfono. WhatsApp renueva el código cada ~45 segundos por seguridad y aquí se actualiza solo, sin que tengas que hacer nada. Puedes dejar esta ventana abierta y escanear el que veas en ese momento; si ya no aparece uno, pulsa «Generar código».</li>
      </ol>
      {closed && <div className="sm:col-span-2"><HistoryOption value={historyDays} onChange={setHistoryDays} /></div>}
      <div className="mx-auto flex size-56 items-center justify-center rounded-2xl border border-border/60 bg-white p-2">
        {closed ? (
          <div className="px-3 text-center"><p className="text-xs text-slate-600">La sesión no está activa.</p><Button type="button" size="sm" className="mt-2" onClick={() => void restart()} disabled={restarting}>{restarting ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}Generar código</Button></div>
        ) : qr ? <img src={qr} alt="Código QR para vincular WhatsApp" className="size-full object-contain" /> : <Loader2 className="size-6 animate-spin text-slate-400" />}
      </div>
    </div>
  );
}

function PairingDialog({ line, onClose, onDone }: { line: WaLine | null; onClose: () => void; onDone: () => void }) {
  return (
    <Dialog open={Boolean(line)} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>Vincular {line?.name}</DialogTitle><DialogDescription>Escanea el código desde el WhatsApp de tu teléfono.</DialogDescription></DialogHeader>
        {line && <PairingPanel key={line.id} lineId={line.id} onConnected={onDone} />}
        <DialogFooter><Button type="button" variant="ghost" onClick={onClose}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConnectDialog({ open, onClose, overview, onDone }: { open: boolean; onClose: () => void; overview: WaOverview; onDone: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [provider, setProvider] = useState<'QR' | 'META_CLOUD'>('QR');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [members, setMembers] = useState<MemberMap>({});
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: string; qr?: string } | null>(null);
  const [historyDays, setHistoryDays] = useState<number | null>(null);

  const reset = () => { setHistoryDays(null); setStep(1); setProvider('QR'); setName(''); setPhone(''); setPhoneNumberId(''); setAccessToken(''); setMembers({}); setCreated(null); };
  const close = () => { if (saving) return; const done = step === 4; reset(); onClose(); if (done) onDone(); };
  const step2Valid = name.trim().length > 0 && (provider === 'QR' || (phoneNumberId.trim() && accessToken.trim()));
  const qrUnavailable = provider === 'QR' && !overview.qrEnabled;

  const save = async () => {
    setSaving(true);
    try {
      const line = await whatsappService.createLine({
        name: name.trim(), provider, phone: phone.trim() || undefined,
        phoneNumberId: provider === 'META_CLOUD' ? phoneNumberId.trim() : undefined,
        accessToken: provider === 'META_CLOUD' ? accessToken.trim() : undefined,
        members: Object.entries(members).map(([userId, m]) => ({ userId, canReply: m.canReply })),
        historyDays: provider === 'QR' && historyDays ? historyDays : undefined,
      });
      onDone();
      if (provider === 'QR') { setCreated({ id: line.id, qr: line.pairing?.qr }); setStep(4); return; }
      if (line.status === 'ERROR') toast.warning(`El número se guardó pero Meta no lo validó: ${line.lastError || 'revisa el identificador y el token.'}`);
      else toast.success('Número conectado.');
      reset(); onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo conectar el número.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp</DialogTitle>
          <DialogDescription>{step === 4 ? 'Último paso · Escanea el código' : `Paso ${step} de 3 · ${step === 1 ? 'Elige cómo conectar' : step === 2 ? 'Datos del número' : '¿Quién lo atiende?'}`}</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-2.5 py-1">
            <button type="button" onClick={() => setProvider('QR')} className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left ${provider === 'QR' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-border/60 hover:bg-muted/40'}`}>
              <QrCode className="mt-0.5 size-5 text-emerald-600" />
              <div><p className="text-sm font-black">Escanear un código QR <span className="ml-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] text-white">Más fácil</span></p><p className="mt-0.5 text-xs text-muted-foreground">Igual que WhatsApp Web: vinculas tu número en segundos y sigues usándolo en tu teléfono. Es una conexión no oficial de WhatsApp; úsala con números de tu empresa y sin envíos masivos.</p></div>
            </button>
            <button type="button" onClick={() => setProvider('META_CLOUD')} className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left ${provider === 'META_CLOUD' ? 'border-primary bg-primary/[0.06]' : 'border-border/60 hover:bg-muted/40'}`}>
              <ShieldCheck className="mt-0.5 size-5 text-primary" />
              <div><p className="text-sm font-black">API oficial de Meta <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[9px]">Avanzado</span></p><p className="mt-0.5 text-xs text-muted-foreground">Conexión autorizada por Meta. Requiere una cuenta de Meta for Developers, un token y la verificación de tu empresa.</p></div>
            </button>
            {qrUnavailable && <p className="rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">La conexión por QR todavía no está activada en el servidor. Avisa a NovaHub.</p>}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 py-1">
            <div className="space-y-1.5"><Label htmlFor="wa-name">Nombre del número</Label><Input id="wa-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ventas 1, Sucursal Estelí…" autoFocus /></div>
            <div className="space-y-1.5"><Label htmlFor="wa-phone">Teléfono (opcional)</Label><Input id="wa-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+505 8888-1234" inputMode="tel" /></div>
            {provider === 'QR' && <HistoryOption value={historyDays} onChange={setHistoryDays} />}
            {provider === 'META_CLOUD' && (
              <>
                <div className="space-y-1.5"><Label htmlFor="wa-pnid">Identificador del número (Phone number ID)</Label><Input id="wa-pnid" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="1234567890123456" inputMode="numeric" /></div>
                <div className="space-y-1.5"><Label htmlFor="wa-token">Token de acceso</Label><Input id="wa-token" type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="EAAG…" autoComplete="off" /></div>
                <p className="rounded-lg bg-muted/50 p-2.5 text-[11px] text-muted-foreground">Los encuentras en Meta for Developers › tu app › WhatsApp › Configuración de la API. El token se guarda cifrado y nunca se vuelve a mostrar.</p>
                {!overview.webhookConfigured && <p className="rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Aviso: el servidor de NovaHub aún no tiene configurado el webhook de Meta, así que podrás enviar pero los mensajes entrantes no llegarán hasta que NovaHub lo active.</p>}
                {!overview.encryptionConfigured && <p className="rounded-lg bg-rose-50 p-2.5 text-[11px] text-rose-900 dark:bg-rose-950/30 dark:text-rose-200">El servidor aún no puede guardar credenciales. Avisa a NovaHub.</p>}
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2 py-1">
            <p className="text-xs text-muted-foreground">Elige quién verá y responderá este número. Los administradores de la empresa siempre lo ven. Puedes cambiarlo después.</p>
            <MembersEditor value={members} onChange={setMembers} />
          </div>
        )}

        {step === 4 && created && <PairingPanel lineId={created.id} initialQr={created.qr} onConnected={onDone} />}

        <DialogFooter className="gap-2 sm:justify-between">
          {step === 4 ? (
            <Button type="button" className="ml-auto" onClick={close}>Listo</Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => (step === 1 ? close() : setStep((step - 1) as 1 | 2))} disabled={saving}>{step === 1 ? 'Cancelar' : 'Atrás'}</Button>
              {step < 3
                ? <Button type="button" onClick={() => setStep((step + 1) as 2 | 3)} disabled={(step === 1 && qrUnavailable) || (step === 2 && !step2Valid)}>Continuar</Button>
                : <Button type="button" onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="mr-1 size-4 animate-spin" />}{provider === 'QR' ? 'Generar código' : 'Conectar'}</Button>}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageDialog({ line, onClose, onDone }: { line: WaLine | null; onClose: () => void; onDone: () => void }) {
  return (
    <Dialog open={Boolean(line)} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-lg">{line && <ManageForm key={line.id} line={line} onClose={onClose} onDone={onDone} />}</DialogContent>
    </Dialog>
  );
}

function ManageForm({ line, onClose, onDone }: { line: WaLine; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(line.name);
  const [color, setColor] = useState(line.color || FALLBACK_LINE_COLOR);
  const [roundRobin, setRoundRobin] = useState(line.assignmentMode === 'ROUND_ROBIN');
  const [token, setToken] = useState('');
  const [members, setMembers] = useState<MemberMap>(() => Object.fromEntries(line.members.map((m) => [m.userId, { canReply: m.canReply }])));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await whatsappService.updateLine(line.id, { name: name.trim(), color, assignmentMode: roundRobin ? 'ROUND_ROBIN' : 'MANUAL', ...(token.trim() ? { accessToken: token.trim() } : {}) });
      await whatsappService.setMembers(line.id, Object.entries(members).map(([userId, m]) => ({ userId, canReply: m.canReply })));
      toast.success('Cambios guardados.');
      onDone(); onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo guardar.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader><DialogTitle>Gestionar {line.name}</DialogTitle><DialogDescription>{PROVIDER_LABEL[line.provider]}{line.phone ? ` · ${formatPhone(line.phone)}` : ''}</DialogDescription></DialogHeader>
      <div className="space-y-4 py-1">
        <div className="space-y-1.5"><Label htmlFor="wa-edit-name">Nombre</Label><Input id="wa-edit-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label>Color</Label>
          <div className="flex gap-2">{SWATCHES.map((s) => <button key={s} type="button" aria-label={`Color ${s}`} onClick={() => setColor(s)} className={`size-7 rounded-full border-2 ${color === s ? 'border-foreground' : 'border-transparent'}`} style={{ backgroundColor: s }} />)}</div>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border/50 p-3">
          <span><span className="block text-xs font-black">Repartir conversaciones nuevas automáticamente</span><span className="text-[11px] text-muted-foreground">Cada chat nuevo va al usuario con menos conversaciones abiertas.</span></span>
          <Switch checked={roundRobin} onCheckedChange={setRoundRobin} />
        </label>
        <div className="space-y-1.5"><Label>Usuarios con acceso</Label><MembersEditor value={members} onChange={setMembers} /></div>
        {line.provider === 'META_CLOUD' && (
          <div className="space-y-1.5"><Label htmlFor="wa-edit-token">Nuevo token de acceso (opcional)</Label><Input id="wa-edit-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Déjalo vacío para conservar el actual" autoComplete="off" /></div>
        )}
      </div>
      <DialogFooter><Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button><Button type="button" onClick={() => void save()} disabled={saving || !name.trim()}>{saving && <Loader2 className="mr-1 size-4 animate-spin" />}Guardar</Button></DialogFooter>
    </>
  );
}

function LineCard({ line, isAdmin, onManage, onArchive, onChanged, onScan }: { line: WaLine; isAdmin: boolean; onManage: () => void; onArchive: () => void; onChanged: () => void; onScan: () => void }) {
  const status = STATUS_LABEL[line.status] || STATUS_LABEL.PENDING;
  const [busy, setBusy] = useState<'verify' | null>(null);
  const run = async (kind: 'verify') => {
    setBusy(kind);
    try {
      const result = await whatsappService.verifyLine(line.id);
      if (result.status === 'CONNECTED') toast.success('El número responde correctamente.'); else toast.error(result.lastError || 'No se pudo verificar el número.');
      onChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo completar la acción.'));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-col rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white" style={{ backgroundColor: line.color || FALLBACK_LINE_COLOR }}>{initials(line.name)}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black">{line.name}</p>
          <p className="truncate text-xs text-muted-foreground">{line.phone ? formatPhone(line.phone) : 'Sin teléfono registrado'}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${status.text}`}><span className={`size-2 rounded-full ${status.dot}`} />{status.label}</span>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">{PROVIDER_LABEL[line.provider]}{line.qualityRating ? ` · calidad ${line.qualityRating}` : ''}</p>
      {line.lastError && line.status !== 'CONNECTED' && <p className="mt-1 rounded-lg bg-rose-50 p-2 text-[11px] text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{line.lastError}{line.disconnectedAt ? ` (desconectado ${sinceLabel(line.disconnectedAt)})` : ''}</p>}
      {line.history && <p className="mt-1 rounded-lg bg-sky-50 p-2 text-[11px] text-sky-900 dark:bg-sky-950/30 dark:text-sky-200">{historyText(line.history)}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-muted/40 py-2"><p className="text-lg font-black leading-none">{line.openConversations}</p><p className="mt-1 text-[10px] font-bold text-muted-foreground">Conversaciones abiertas</p></div>
        <div className="rounded-xl bg-muted/40 py-2"><p className={`text-lg font-black leading-none ${line.unread ? 'text-emerald-600' : ''}`}>{line.unread}</p><p className="mt-1 text-[10px] font-bold text-muted-foreground">Sin leer</p></div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Users className="size-3.5" />{line.members.length ? line.members.map((m) => m.name.split(' ')[0]).slice(0, 3).join(', ') + (line.members.length > 3 ? ` +${line.members.length - 3}` : '') : 'Solo administradores'}</div>
      {isAdmin && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" className="h-8 rounded-lg text-xs" onClick={onManage}>Gestionar</Button>
          {line.provider !== 'QR' && <Button type="button" size="sm" variant="outline" className="h-8 gap-1 rounded-lg text-xs" disabled={busy !== null} onClick={() => void run('verify')}>{busy === 'verify' ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}Verificar</Button>}
          {line.provider === 'QR' && line.status !== 'CONNECTED' && <Button type="button" size="sm" className="h-8 gap-1 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700" onClick={onScan}><QrCode className="size-3" />Escanear QR</Button>}
          <Button type="button" size="sm" variant="ghost" className="ml-auto h-8 rounded-lg text-xs text-muted-foreground" onClick={onArchive}>Archivar</Button>
        </div>
      )}
    </div>
  );
}

export function WhatsAppLines({ overview }: { overview: WaOverview }) {
  const qc = useQueryClient();
  const key = useWaTenantKey();
  const [connectOpen, setConnectOpen] = useState(false);
  const [managing, setManaging] = useState<WaLine | null>(null);
  const [archiving, setArchiving] = useState<WaLine | null>(null);
  const [scanning, setScanning] = useState<WaLine | null>(null);
  const refresh = () => { void qc.invalidateQueries({ queryKey: key('overview') }); void qc.invalidateQueries({ queryKey: key('conversations') }); };
  const { plan, isAdmin, lines } = overview;
  const pct = Math.min(100, Math.round((plan.used / Math.max(1, plan.maxLines)) * 100));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/50 bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Plan {plan.name}</p>
            <p className="mt-1 text-sm font-bold">{plan.used} de {plan.maxLines} números conectados</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${pct >= 100 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} /></div>
          </div>
          {isAdmin && (
            <Button type="button" className="h-10 gap-2 rounded-xl" onClick={() => setConnectOpen(true)} disabled={plan.available <= 0}>
              <Plus className="size-4" />Conectar WhatsApp
            </Button>
          )}
        </div>
        {isAdmin && plan.available <= 0 && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Llegaste al límite de tu plan. Mejora tu plan para conectar más números: {overview.plans.map((p) => `${p.name} (hasta ${p.maxLines}, $${p.priceUsd}/mes)`).join(' · ')}.</p>}

        {lines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
            <Smartphone className="mx-auto size-10 text-emerald-500/60" />
            <p className="mt-3 text-sm font-black">Conecta tu primer WhatsApp</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{isAdmin ? 'En menos de un minuto: elige el número, dile quién lo atiende y empieza a recibir conversaciones.' : 'Aún no tienes números asignados. Pídele al administrador que te dé acceso.'}</p>
            {isAdmin && <Button type="button" className="mt-4 gap-2 rounded-xl" onClick={() => setConnectOpen(true)}><Plus className="size-4" />Conectar WhatsApp</Button>}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lines.map((line) => <LineCard key={line.id} line={line} isAdmin={isAdmin} onManage={() => setManaging(line)} onArchive={() => setArchiving(line)} onChanged={refresh} onScan={() => setScanning(line)} />)}
          </div>
        )}
      </div>
      <ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} overview={overview} onDone={refresh} />
      <ManageDialog line={managing} onClose={() => setManaging(null)} onDone={refresh} />
      <PairingDialog line={scanning} onClose={() => setScanning(null)} onDone={refresh} />
      <ConfirmDialog
        open={Boolean(archiving)} onOpenChange={(next) => { if (!next) setArchiving(null); }} variant="warning"
        title={`¿Archivar ${archiving?.name || 'el número'}?`}
        description="El número deja de recibir y enviar mensajes desde NovaHub y libera un espacio de tu plan. El historial se conserva."
        confirmLabel="Archivar"
        onConfirm={async () => {
          if (!archiving) return;
          try { await whatsappService.archiveLine(archiving.id); toast.success('Número archivado.'); refresh(); } catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo archivar.')); }
        }}
      />
    </div>
  );
}
