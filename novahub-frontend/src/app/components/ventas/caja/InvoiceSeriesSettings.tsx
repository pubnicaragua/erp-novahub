import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, FileCog, Link2, Loader2, RotateCcw, Unlink2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Switch } from '../../ui/switch';
import { getApiErrorMessage } from '../../../services/api';
import { invoicesService, type InvoiceSeriesConfiguration } from '../../../services/ventas.service';

const typeLabel: Record<string, string> = {
  SALES_INVOICE: 'Facturación normal',
  POS_INVOICE: 'Facturación por caja / POS',
};

export function InvoiceSeriesSettings() {
  const [configuration, setConfiguration] = useState<InvoiceSeriesConfiguration | null>(null);
  const [selectedScope, setSelectedScope] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sharePrefix, setSharePrefix] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await invoicesService.getSeriesConfiguration();
      setConfiguration(data);
      setSelectedScope((current) => current || data.items[0]?.scopeKey || '');
      setDrafts(Object.fromEntries(data.items.map((item) => [item.scopeKey + ':' + item.documentType, item.prefix])));
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo cargar la configuración de prefijos.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const scopes = useMemo(() => {
    if (!configuration) return [];
    const seen = new Set<string>();
    return configuration.items.filter((item) => {
      if (seen.has(item.scopeKey)) return false;
      seen.add(item.scopeKey);
      return true;
    });
  }, [configuration]);

  const visibleItems = configuration?.items.filter((item) => item.scopeKey === selectedScope) || [];
  const normalItem = visibleItems.find((item) => item.documentType === 'SALES_INVOICE');
  const posItem = visibleItems.find((item) => item.documentType === 'POS_INVOICE');
  const normalKey = normalItem ? normalItem.scopeKey + ':' + normalItem.documentType : '';
  const posKey = posItem ? posItem.scopeKey + ':' + posItem.documentType : '';

  useEffect(() => {
    if (!normalItem || !posItem) return;
    setSharePrefix(normalItem.prefix === posItem.prefix);
  }, [normalItem, posItem]);

  const updateDraft = (item: InvoiceSeriesConfiguration['items'][number], value: string) => {
    setDrafts((current) => ({ ...current, [item.scopeKey + ':' + item.documentType]: value.toUpperCase() }));
  };

  const save = async (item: InvoiceSeriesConfiguration['items'][number], reset = false) => {
    const key = item.scopeKey + ':' + item.documentType;
    const prefix = reset ? null : String(drafts[key] || '').trim().toUpperCase();
    if (!reset && !prefix) {
      toast.error('Escribe un prefijo o usa Restaurar predeterminado.');
      return;
    }
    const useSharedSeries = sharePrefix && item.documentType === 'SALES_INVOICE' && Boolean(normalItem && posItem);
    setSaving(useSharedSeries ? normalKey + ':shared' : key);
    setError('');
    try {
      await invoicesService.saveSeriesConfiguration({
        branchId: item.branchId,
        documentType: useSharedSeries ? 'SALES_INVOICE' : item.documentType,
        prefix,
        shareWithOtherType: useSharedSeries,
      });
      toast.success(reset ? 'Prefijo predeterminado restaurado.' : useSharedSeries ? 'Serie compartida guardada para facturación y Caja.' : 'Prefijo de facturación guardado.');
      await load();
    } catch (err) {
      const message = getApiErrorMessage(err, 'No se pudo guardar el prefijo.');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(null);
    }
  };

  const toggleSharing = (checked: boolean) => {
    setSharePrefix(checked);
    if (checked && normalItem && posItem) {
      setDrafts((current) => ({ ...current, [posKey]: current[normalKey] || normalItem.prefix }));
    }
  };

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <Card className="overflow-hidden border-border/50 shadow-sm">
        <CardHeader className="bg-gradient-to-br from-primary/10 via-card to-card">
          <div className="flex min-w-0 flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight"><FileCog className="size-5 shrink-0 text-primary" /> Series de facturación</CardTitle>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Define el prefijo antes del consecutivo. El número lo genera el sistema de forma fija y atómica: 001, 002, 003…</p>
            </div>
            {configuration && <Badge variant="outline" className="w-fit shrink-0">Sucursal actual: {configuration.currentTenant.name}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {loading ? <div className="flex items-center justify-center py-12 text-sm text-muted-foreground"><Loader2 className="mr-2 size-5 animate-spin" /> Cargando series…</div> : error && !configuration ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div> : (
            <>
              {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
              <div className="max-w-xl space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sucursal / alcance a configurar</label><Select value={selectedScope} onValueChange={setSelectedScope}><SelectTrigger><SelectValue placeholder="Selecciona una sucursal" /></SelectTrigger><SelectContent>{scopes.map((scope) => <SelectItem key={scope.scopeKey} value={scope.scopeKey}>{scope.branchName} · {scope.branchCode}</SelectItem>)}</SelectContent></Select></div>

              {normalItem && posItem && <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  {sharePrefix ? <Link2 className="mt-0.5 size-5 shrink-0 text-primary" /> : <Unlink2 className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0">
                    <label htmlFor="share-invoice-series" className="font-black">Usar el mismo prefijo y consecutivo</label>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{sharePrefix ? 'Recomendado: una factura enviada a Caja conserva su número y no se crea otra factura al cobrarla.' : 'Caja utilizará una serie independiente y solo se aplicará si se factura directamente desde POS.'}</p>
                  </div>
                </div>
                <Switch id="share-invoice-series" checked={sharePrefix} onCheckedChange={toggleSharing} aria-label="Usar el mismo prefijo y consecutivo en facturación normal y Caja" />
              </div>}

              <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
                {visibleItems.map((item) => {
                  const key = item.scopeKey + ':' + item.documentType;
                  const isSharedPos = sharePrefix && item.documentType === 'POS_INVOICE' && Boolean(normalItem);
                  const isSaving = saving === key || saving === normalKey + ':shared';
                  const displayedPrefix = isSharedPos && normalItem ? (drafts[normalKey] || normalItem.prefix) : (drafts[key] || '');
                  const nextNumberSuffix = String(item.nextNumber).split('-').pop() || '001';
                  return <Card key={key} className="min-w-0 border-border/60 bg-muted/10">
                    <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><CardTitle className="text-base font-black">{typeLabel[item.documentType] || item.documentLabel}</CardTitle><Badge variant={item.configured ? 'default' : 'secondary'}>{isSharedPos ? 'Compartido' : item.configured ? 'Personalizado' : 'Predeterminado'}</Badge></div></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                        <label className="min-w-0 space-y-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Prefijo<Input value={displayedPrefix} readOnly={isSharedPos} maxLength={20} onChange={(event) => updateDraft(item, event.target.value)} placeholder={item.defaultPrefix} className="mt-1 font-mono text-base font-bold tracking-wider" /></label>
                        <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-2.5 text-center sm:min-w-36"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Siguiente</p><p className="break-all font-mono text-lg font-black text-primary">{displayedPrefix ? displayedPrefix.toUpperCase() + '-' + nextNumberSuffix : item.nextNumber}</p></div>
                      </div>
                      <p className="text-xs leading-5 text-muted-foreground">{isSharedPos ? 'Heredado de Facturación normal. Una factura enviada a Caja se cobra sobre el mismo registro.' : <>Predeterminado: <span className="font-mono font-semibold">{item.defaultPrefix}-001</span>. El consecutivo no se puede duplicar dentro de la empresa.</>}</p>
                      <div className="flex flex-wrap gap-2">
                        {(!isSharedPos || item.documentType === 'SALES_INVOICE') && <Button className="gap-2" onClick={() => void save(item)} disabled={isSaving || !String(displayedPrefix || '').trim()}>{isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {sharePrefix && item.documentType === 'SALES_INVOICE' ? 'Guardar serie compartida' : 'Guardar prefijo'}</Button>}
                        {item.configured && !isSharedPos && <Button variant="outline" className="gap-2" onClick={() => void save(item, true)} disabled={isSaving}><RotateCcw className="size-4" /> Restaurar predeterminado</Button>}
                      </div>
                    </CardContent>
                  </Card>;
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
