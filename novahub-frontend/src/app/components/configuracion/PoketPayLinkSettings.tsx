import { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, KeyRound, Link2, Loader2, Save, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '../../services/api';
import { poketPayLinkService, type PoketConfig } from '../../services/poket-paylink.service';

export function PoketPayLinkSettings({ canEdit }: { canEdit: boolean }) {
  const [config, setConfig] = useState<PoketConfig | null>(null);
  const [merchantId, setMerchantId] = useState('');
  const [terminalId, setTerminalId] = useState('');
  const [pat, setPat] = useState('');
  const [currency, setCurrency] = useState<'NIO' | 'USD'>('NIO');
  const [bankAccountId, setBankAccountId] = useState('');
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = async () => {
    try {
      const next = await poketPayLinkService.getConfig();
      setConfig(next);
      setMerchantId(next.merchantId || '');
      setTerminalId(next.terminalId || '');
      setCurrency(next.currency || 'NIO');
      setBankAccountId(next.bankAccountId || '');
      setActive(Boolean(next.active));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar la configuración de Poket.'));
    } finally {
      setLoading(false);
    }
  };

  // La carga inicial sincroniza el formulario con la configuración persistida.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!merchantId.trim() || !terminalId.trim() || (!config?.hasPat && !pat.trim())) {
      toast.error('Completa Merchant ID, Terminal ID y PAT.');
      return;
    }
    if (active && !bankAccountId) {
      toast.error('Selecciona la cuenta bancaria que recibirá los cobros de Poket.');
      return;
    }
    try {
      setSaving(true);
      const saved = await poketPayLinkService.saveConfig({ merchantId: merchantId.trim(), terminalId: terminalId.trim(), pat: pat.trim() || undefined, active, currency, bankAccountId: bankAccountId || null });
      setConfig(saved);
      setPat('');
      toast.success('Configuración de Poket guardada.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo guardar la configuración de Poket.'));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    try {
      setTesting(true);
      const result = await poketPayLinkService.testConnection();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo probar la conexión con Poket.'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/50 shadow-sm">
        <CardHeader className="border-b border-border/30 bg-muted/10">
          <CardTitle className="flex items-center gap-2 text-lg font-black"><CreditCard className="size-5 text-primary" />Poket PayLink</CardTitle>
          <CardDescription>Genera enlaces de pago desde una factura y registra automáticamente la confirmación de tarjeta en NovaHub.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Cargando configuración...</div> : <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="poket-merchant">Merchant ID</Label><Input id="poket-merchant" value={merchantId} onChange={(event) => setMerchantId(event.target.value)} disabled={!canEdit} placeholder="Merchant ID de Poket" /></div>
              <div className="space-y-2"><Label htmlFor="poket-terminal">Terminal ID Ecommerce</Label><Input id="poket-terminal" value={terminalId} onChange={(event) => setTerminalId(event.target.value)} disabled={!canEdit} placeholder="Terminal ID" /></div>
              <div className="space-y-2"><Label htmlFor="poket-pat">PAT</Label><div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="poket-pat" type="password" value={pat} onChange={(event) => setPat(event.target.value)} disabled={!canEdit} className="pl-9" placeholder={config?.patMasked || 'PAT de Poket (se guarda cifrado)'} autoComplete="new-password" /></div><p className="text-[11px] text-muted-foreground">Nunca se envía al navegador después de guardar ni aparece completo en logs.</p></div>
              <div className="space-y-2"><Label>Moneda predeterminada</Label><Select value={currency} onValueChange={(value) => setCurrency(value as 'NIO' | 'USD')} disabled={!canEdit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NIO">NIO · Córdobas</SelectItem><SelectItem value="USD">USD · Dólares</SelectItem></SelectContent></Select></div>
            </div>
            <BankAccountSelect currency={currency} endpoint="/bank-accounts/payment-options" value={bankAccountId} onChange={setBankAccountId} disabled={!canEdit} label="Cuenta bancaria receptora" />
            <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-muted/20 p-4"><div><p className="font-bold">Activar PayLink</p><p className="text-xs text-muted-foreground">Permite generar enlaces para las facturas de esta empresa.</p></div><Switch checked={active} onCheckedChange={setActive} disabled={!canEdit} /></div>
            <div className="flex flex-wrap gap-3 border-t border-border/40 pt-5"><Button type="button" onClick={() => void save()} disabled={!canEdit || saving} className="gap-2"><Save className="size-4" />{saving ? 'Guardando...' : 'Guardar configuración'}</Button><Button type="button" variant="outline" onClick={() => void test()} disabled={testing || !config?.hasPat} className="gap-2"><Link2 className="size-4" />{testing ? 'Probando...' : 'Probar conexión'}</Button></div>
            <div className="flex gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" /><p className="text-muted-foreground">El cobro confirmado por Poket entra por el mismo servicio de pagos de NovaHub, conserva la trazabilidad de la factura y evita duplicados.</p><CheckCircle2 className="ml-auto mt-0.5 size-5 shrink-0 text-emerald-600" /></div>
          </>}
        </CardContent>
      </Card>
    </div>
  );
}
