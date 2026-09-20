import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, Check, Clock3, Loader2, MessageCircle, Pencil, Plus, Save, Send, Settings2, Trash2, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../services/api';
import { novaPulseService, type NovaPulseConfig, type NovaPulseRecipient } from '../../services/nova-pulse.service';

const DEFAULT_CONFIG: NovaPulseConfig = {
  id: '', enabled: false, timezone: 'America/Managua', sendTime: '07:00', frequency: 'DAILY', customDays: [],
  includeSales: true, includeProfit: true, includeReceivables: true, includePayables: false, includeInventory: true,
  includeInactiveCustomers: true, includeCash: true, includeAlerts: true, includeNovaInsight: true,
  recipients: [], deliveries: [],
};

const INDICATORS: Array<{ key: keyof NovaPulseConfig; label: string; help: string }> = [
  { key: 'includeSales', label: 'Ventas', help: 'Ventas totales, pagadas y ticket promedio' },
  { key: 'includeProfit', label: 'Utilidad estimada', help: 'Utilidad y margen del período' },
  { key: 'includeReceivables', label: 'Cuentas por cobrar', help: 'Saldo pendiente y vencido' },
  { key: 'includePayables', label: 'Cuentas por pagar', help: 'Compromisos pendientes con proveedores' },
  { key: 'includeInventory', label: 'Inventario crítico', help: 'Agotados, mínimos y productos inmovilizados' },
  { key: 'includeInactiveCustomers', label: 'Clientes inactivos', help: 'Clientes con más de 30 días sin comprar' },
  { key: 'includeCash', label: 'Caja', help: 'Movimiento neto de caja' },
  { key: 'includeAlerts', label: 'Alertas', help: 'Riesgos y operaciones que requieren atención' },
  { key: 'includeNovaInsight', label: 'Insight de Nova AI', help: 'Conclusión ejecutiva de máximo tres frases' },
];

function maskPhone(phone: string) {
  const compact = phone.replace(/\s/g, '');
  return compact.length > 7 ? `${compact.slice(0, 4)} ${'•'.repeat(Math.max(2, compact.length - 7))} ${compact.slice(-3)}` : compact;
}

function deliveryStatus(status: string) {
  if (status === 'SENT' || status === 'DELIVERED' || status === 'READ') return { label: 'Enviado', className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' };
  if (status === 'FAILED') return { label: 'Error', className: 'border-rose-500/20 bg-rose-500/10 text-rose-600' };
  return { label: 'En cola', className: 'border-amber-500/20 bg-amber-500/10 text-amber-600' };
}

export function NovaPulseView({ canEdit, canSend }: { canEdit: boolean; canSend: boolean }) {
  const [config, setConfig] = useState<NovaPulseConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [recipientDialog, setRecipientDialog] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<NovaPulseRecipient | null>(null);
  const [recipientForm, setRecipientForm] = useState({ name: '', phoneNumber: '' });
  const [testDialog, setTestDialog] = useState(false);
  const [testRecipientId, setTestRecipientId] = useState('');
  const [confirmSend, setConfirmSend] = useState(false);

  const activeRecipients = useMemo(() => config.recipients.filter((recipient) => recipient.enabled), [config.recipients]);

  const load = async () => {
    setLoading(true);
    try { setConfig(await novaPulseService.get()); }
    catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo cargar Nova Pulse.')); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let cancelled = false;

    const loadInitialConfig = async () => {
      setLoading(true);
      try {
        const nextConfig = await novaPulseService.get();
        if (!cancelled) setConfig(nextConfig);
      } catch (error) {
        if (!cancelled) toast.error(getApiErrorMessage(error, 'No se pudo cargar Nova Pulse.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadInitialConfig();
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await novaPulseService.update({ enabled: config.enabled, timezone: config.timezone, sendTime: config.sendTime, frequency: config.frequency, customDays: config.customDays, ...Object.fromEntries(INDICATORS.map(({ key }) => [key, config[key]])) });
      setConfig(updated);
      toast.success('Configuración de Nova Pulse guardada.');
    } catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo guardar Nova Pulse.')); }
    finally { setSaving(false); }
  };

  const openRecipient = (recipient?: NovaPulseRecipient) => {
    setEditingRecipient(recipient || null);
    setRecipientForm(recipient ? { name: recipient.name, phoneNumber: recipient.phoneNumber } : { name: '', phoneNumber: '' });
    setRecipientDialog(true);
  };

  const saveRecipient = async () => {
    if (!recipientForm.name.trim() || !recipientForm.phoneNumber.trim()) return toast.error('Completa el nombre y el número de WhatsApp.');
    try {
      if (editingRecipient) await novaPulseService.updateRecipient(editingRecipient.id, recipientForm);
      else await novaPulseService.addRecipient(recipientForm);
      setRecipientDialog(false); await load(); toast.success(editingRecipient ? 'Destinatario actualizado.' : 'Destinatario agregado.');
    } catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo guardar el destinatario.')); }
  };

  const toggleRecipient = async (recipient: NovaPulseRecipient) => {
    try { await novaPulseService.updateRecipient(recipient.id, { enabled: !recipient.enabled }); await load(); }
    catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo actualizar el destinatario.')); }
  };

  const removeRecipient = async (recipient: NovaPulseRecipient) => {
    if (!window.confirm(`¿Eliminar a ${recipient.name} de Nova Pulse?`)) return;
    try { await novaPulseService.deleteRecipient(recipient.id); await load(); toast.success('Destinatario eliminado.'); }
    catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo eliminar el destinatario.')); }
  };

  const sendNow = async (test = false) => {
    setSending(true);
    try {
      const result = test ? await novaPulseService.sendTest(testRecipientId) : await novaPulseService.sendNow();
      if (result.failed) toast.warning(`Resumen enviado a ${result.sent} de ${result.total} destinatarios. ${result.failed} presentó un error.`);
      else toast.success(`Resumen enviado a ${result.sent} destinatario${result.sent === 1 ? '' : 's'}.`);
      setTestDialog(false); setConfirmSend(false); await load();
    } catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo enviar el resumen por WhatsApp.')); }
    finally { setSending(false); }
  };

  if (loading) return <Card className="border-border/50"><CardContent className="flex items-center gap-3 py-14 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Cargando configuración de Nova Pulse…</CardContent></Card>;

  return <div className="space-y-6">
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.09] via-background to-background shadow-sm">
      <CardContent className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between lg:p-8">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><MessageCircle className="size-7" /></div>
          <div><div className="mb-1 flex flex-wrap items-center gap-2"><p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Nova Pulse</p><Badge variant="outline" className="border-primary/30 text-primary">WhatsApp ejecutivo</Badge></div><h2 className="text-2xl font-black tracking-tight">Resumen de tu negocio</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Recibí automáticamente por WhatsApp un resumen ejecutivo de tu empresa.</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/75 px-4 py-3"><div><p className="text-xs font-bold text-muted-foreground">Estado del resumen</p><p className="font-bold">{config.enabled ? 'Activo' : 'Pausado'}</p></div><Switch checked={config.enabled} onCheckedChange={(enabled) => setConfig((current) => ({ ...current, enabled }))} disabled={!canEdit} /></div>
      </CardContent>
    </Card>

    <div className="grid gap-6 xl:grid-cols-[1.08fr_.92fr]">
      <Card className="border-border/50 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Clock3 className="size-5 text-primary" />Programación</CardTitle><CardDescription>Nova Pulse usa la zona horaria de tu empresa y guarda la próxima ejecución en UTC.</CardDescription></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2"><Label>Frecuencia</Label><select value={config.frequency} onChange={(event) => setConfig((current) => ({ ...current, frequency: event.target.value as NovaPulseConfig['frequency'] }))} disabled={!canEdit} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="DAILY">Todos los días</option><option value="WEEKDAYS">Lunes a viernes</option><option value="CUSTOM">Días seleccionados</option></select></div>
        <div className="space-y-2"><Label>Hora de envío</Label><Input type="time" value={config.sendTime} onChange={(event) => setConfig((current) => ({ ...current, sendTime: event.target.value }))} disabled={!canEdit} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Zona horaria</Label><select value={config.timezone} onChange={(event) => setConfig((current) => ({ ...current, timezone: event.target.value }))} disabled={!canEdit} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"><option>America/Managua</option><option>America/Costa_Rica</option><option>America/Panama</option><option>America/Guatemala</option><option>America/Mexico_City</option><option>America/New_York</option><option>UTC</option></select></div>
        {config.frequency === 'CUSTOM' && <div className="space-y-2 sm:col-span-2"><Label>Días de envío</Label><div className="flex flex-wrap gap-2">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day, index) => { const value = index + 1; const selected = config.customDays.includes(value); return <button key={day} type="button" disabled={!canEdit} onClick={() => setConfig((current) => ({ ...current, customDays: selected ? current.customDays.filter((item) => item !== value) : [...current.customDays, value].sort() }))} className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-muted-foreground hover:border-primary/50'}`}>{selected && <Check className="mr-1 inline size-3" />}{day}</button>; })}</div></div>}
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 sm:col-span-2"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Próximo envío</p><p className="mt-1 text-lg font-black">{config.nextRunLabel || 'Se calculará al activar'}</p><p className="mt-1 text-xs text-muted-foreground">Último envío: {config.lastRunLabel || 'Todavía no hay envíos registrados'}</p></div>
      </CardContent></Card>

      <Card className="border-border/50 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Settings2 className="size-5 text-primary" />Incluir en el resumen</CardTitle><CardDescription>Seleccioná la información que cada envío debe mostrar.</CardDescription></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2">{INDICATORS.map(({ key, label, help }) => <label key={String(key)} className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border/50 p-3 transition-colors hover:bg-muted/30"><span><span className="block text-sm font-bold">{label}</span><span className="block text-[11px] leading-4 text-muted-foreground">{help}</span></span><Switch checked={Boolean(config[key])} onCheckedChange={(checked) => setConfig((current) => ({ ...current, [key]: checked }))} disabled={!canEdit} /></label>)}</CardContent></Card>
    </div>

    <Card className="border-border/50 shadow-sm"><CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2 text-lg"><Users className="size-5 text-primary" />Destinatarios</CardTitle><CardDescription>Los teléfonos se normalizan al formato internacional y pertenecen únicamente a tu empresa.</CardDescription></div><Button onClick={() => openRecipient()} disabled={!canEdit}><Plus className="size-4" />Agregar destinatario</Button></CardHeader><CardContent>{config.recipients.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{config.recipients.map((recipient) => <div key={recipient.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 p-4"><div className="min-w-0"><p className="truncate font-bold">{recipient.name}</p><p className="text-sm text-muted-foreground">{maskPhone(recipient.phoneNumber)}</p><Badge variant="outline" className={recipient.enabled ? 'mt-2 border-emerald-500/20 bg-emerald-500/10 text-emerald-600' : 'mt-2'}>{recipient.enabled ? 'Activo' : 'Pausado'}</Badge></div><div className="flex shrink-0 items-center gap-1"><Switch checked={recipient.enabled} onCheckedChange={() => void toggleRecipient(recipient)} disabled={!canEdit} /><Button size="icon" variant="ghost" onClick={() => openRecipient(recipient)} disabled={!canEdit} aria-label="Editar"><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => void removeRecipient(recipient)} disabled={!canEdit} aria-label="Eliminar"><Trash2 className="size-4 text-rose-500" /></Button></div></div>)}</div> : <div className="rounded-2xl border border-dashed border-border/70 px-5 py-8 text-center"><Users className="mx-auto size-8 text-muted-foreground/50" /><p className="mt-3 font-bold">Todavía no hay destinatarios</p><p className="mt-1 text-sm text-muted-foreground">Agregá al propietario, gerencia o contabilidad para recibir el reporte.</p></div>}</CardContent></Card>

    <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">Listo para reportarte</p><p className="text-sm text-muted-foreground">El resumen se enviará desde el número corporativo de NovaHub.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setTestRecipientId(activeRecipients[0]?.id || ''); setTestDialog(true); }} disabled={!canSend || !activeRecipients.length}><Send className="size-4" />Enviar prueba</Button><Button onClick={() => setConfirmSend(true)} disabled={!canSend || !activeRecipients.length}><MessageCircle className="size-4" />Enviar resumen ahora</Button><Button variant="outline" onClick={() => void save()} disabled={!canEdit || saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Guardar cambios</Button></div></div>

    <Card className="border-border/50 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><BellRing className="size-5 text-primary" />Últimos envíos</CardTitle><CardDescription>Historial de envíos y errores por destinatario.</CardDescription></CardHeader><CardContent>{config.deliveries.length ? <div className="divide-y divide-border/50">{config.deliveries.map((delivery) => { const status = deliveryStatus(delivery.status); return <div key={delivery.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{delivery.recipient?.name || maskPhone(delivery.phoneNumber)}</p><p className="text-xs text-muted-foreground">{new Date(delivery.createdAt).toLocaleString('es-NI')} · {delivery.type === 'TEST' ? 'Prueba' : delivery.type === 'SCHEDULED' ? 'Programado' : 'Manual'}</p></div><div className="flex items-center gap-2"><Badge variant="outline" className={status.className}>{status.label}</Badge>{delivery.errorMessage && <span className="max-w-sm truncate text-xs text-rose-600">{delivery.errorMessage}</span>}</div></div>; })}</div> : <p className="py-6 text-sm text-muted-foreground">Aún no hay envíos registrados.</p>}</CardContent></Card>

    <Dialog open={recipientDialog} onOpenChange={setRecipientDialog}><DialogContent><DialogHeader><DialogTitle>{editingRecipient ? 'Editar destinatario' : 'Agregar destinatario'}</DialogTitle><DialogDescription>Usá el número con código de país, por ejemplo +50588888888.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Nombre</Label><Input value={recipientForm.name} onChange={(event) => setRecipientForm((current) => ({ ...current, name: event.target.value }))} placeholder="Propietario" /></div><div className="space-y-2"><Label>WhatsApp</Label><Input value={recipientForm.phoneNumber} onChange={(event) => setRecipientForm((current) => ({ ...current, phoneNumber: event.target.value }))} placeholder="+50588888888" /></div></div><DialogFooter><Button variant="outline" onClick={() => setRecipientDialog(false)}>Cancelar</Button><Button onClick={() => void saveRecipient()}><Check className="size-4" />Guardar</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={testDialog} onOpenChange={setTestDialog}><DialogContent><DialogHeader><DialogTitle>Enviar prueba</DialogTitle><DialogDescription>Se generará el resumen real actual y se enviará sólo al destinatario seleccionado.</DialogDescription></DialogHeader><select value={testRecipientId} onChange={(event) => setTestRecipientId(event.target.value)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">{activeRecipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name} · {maskPhone(recipient.phoneNumber)}</option>)}</select><DialogFooter><Button variant="outline" onClick={() => setTestDialog(false)}>Cancelar</Button><Button onClick={() => void sendNow(true)} disabled={!testRecipientId || sending}>{sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Enviar prueba</Button></DialogFooter></DialogContent></Dialog>
    <ConfirmDialog open={confirmSend} onOpenChange={setConfirmSend} title="Enviar resumen ahora" description={`Se enviará el resumen actual a ${activeRecipients.length} destinatario${activeRecipients.length === 1 ? '' : 's'}.`} confirmLabel="Enviar resumen" onConfirm={() => sendNow(false)} loading={sending} variant="default" />
  </div>;
}
