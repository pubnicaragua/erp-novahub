import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, FileCog, Info, Link2, Loader2, RefreshCw, RotateCcw, Unlink2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { getApiErrorMessage } from '../../services/api';
import {
  enterpriseGroupsService,
  type ManagerInvoiceSeriesBranch,
  type ManagerInvoiceSeriesConfiguration,
  type ManagerInvoiceSeriesItem,
} from '../../services/enterprise-groups.service';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';

type Props = {
  groupId: string;
  businessUnitId?: string;
  branchId?: string;
};

const documentTypeLabel: Record<ManagerInvoiceSeriesItem['documentType'], string> = {
  SALES_INVOICE: 'Facturación normal',
  POS_INVOICE: 'Facturación por caja / POS',
};

export function ManagerInvoiceSeriesSettings({ groupId, businessUnitId, branchId }: Props) {
  const [selectedClientTenantId, setSelectedClientTenantId] = useState(branchId || '');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sharePrefix, setSharePrefix] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const query = useTenantQuery<ManagerInvoiceSeriesConfiguration>(
    ['manager-invoice-series', groupId, businessUnitId || 'all', branchId || 'all'],
    (signal) => enterpriseGroupsService.getManagerInvoiceSeriesConfiguration(groupId, { businessUnitId, branchId }, signal),
    { enabled: Boolean(groupId) },
  );
  const branches = query.data?.branches || [];
  const selectedBranch = useMemo<ManagerInvoiceSeriesBranch | undefined>(
    () => branches.find((branch) => branch.clientTenantId === selectedClientTenantId) || branches[0],
    [branches, selectedClientTenantId],
  );

  useEffect(() => {
    if (selectedBranch && selectedBranch.clientTenantId !== selectedClientTenantId) setSelectedClientTenantId(selectedBranch.clientTenantId);
  }, [selectedBranch, selectedClientTenantId]);

  useEffect(() => {
    setDrafts(Object.fromEntries((selectedBranch?.items || []).map((item) => [item.scopeKey + ':' + item.documentType, item.prefix])));
  }, [selectedBranch]);

  const normalItem = selectedBranch?.items.find((item) => item.documentType === 'SALES_INVOICE');
  const posItem = selectedBranch?.items.find((item) => item.documentType === 'POS_INVOICE');
  const normalKey = normalItem ? normalItem.scopeKey + ':' + normalItem.documentType : '';
  const posKey = posItem ? posItem.scopeKey + ':' + posItem.documentType : '';

  useEffect(() => {
    if (!normalItem || !posItem) return;
    setSharePrefix(normalItem.prefix === posItem.prefix);
  }, [normalItem, posItem]);

  const updateDraft = (item: ManagerInvoiceSeriesItem, value: string) => {
    setDrafts((current) => ({ ...current, [item.scopeKey + ':' + item.documentType]: value.toUpperCase() }));
  };

  const save = async (item: ManagerInvoiceSeriesItem, reset = false) => {
    if (!selectedBranch) return;
    const key = item.scopeKey + ':' + item.documentType;
    const prefix = reset ? null : String(drafts[key] || '').trim().toUpperCase();
    if (!reset && !prefix) {
      toast.error('Escribe un prefijo o restáuralo al valor predeterminado.');
      return;
    }
    const useSharedSeries = sharePrefix && item.documentType === 'SALES_INVOICE' && Boolean(normalItem && posItem);
    setSaving(useSharedSeries ? normalKey + ':shared' : key);
    setError('');
    try {
      await enterpriseGroupsService.saveManagerInvoiceSeriesConfiguration(groupId, {
        clientTenantId: selectedBranch.clientTenantId,
        businessUnitId,
        documentType: useSharedSeries ? 'SALES_INVOICE' : item.documentType,
        prefix,
        shareWithOtherType: useSharedSeries,
      });
      toast.success(reset ? 'Prefijo predeterminado restaurado.' : useSharedSeries ? 'Serie compartida guardada para facturación y Caja.' : 'Prefijo de facturación guardado.');
      await query.refetch();
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
    <div className="manager-invoice-series min-w-0 space-y-5 overflow-x-hidden">
      <Card className="overflow-hidden rounded-3xl border-border/60 shadow-sm">
        <CardHeader className="bg-gradient-to-br from-primary/10 via-card to-card">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-xl font-black uppercase italic tracking-tight"><FileCog className="size-5 shrink-0 text-primary" /> Series de facturación</CardTitle>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Configura desde Manager el prefijo que utilizará cada sucursal en facturación normal y facturación por caja/POS. El consecutivo se conserva automático y atómico.</p>
            </div>
            <Badge variant="outline" className="w-fit shrink-0 rounded-full border-primary/20 bg-primary/5 text-primary">Configuración por sucursal</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-4 text-sm sm:flex-row sm:items-start"><Info className="mt-0.5 size-4 shrink-0 text-sky-600" /><p className="min-w-0 leading-5 text-muted-foreground">Selecciona una sucursal operativa del grupo. Sus bodegas y cajas internas comparten la misma serie fiscal; los prefijos no modifican facturas ya emitidas.</p></div>

          <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <label className="min-w-0 space-y-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground md:max-w-xl md:flex-1"><span>Sucursal / empresa operativa</span><select value={selectedBranch?.clientTenantId || ''} onChange={(event) => setSelectedClientTenantId(event.target.value)} className="h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm font-semibold normal-case tracking-normal text-foreground"><option value="">Seleccionar sucursal</option>{branches.map((branch) => <option key={branch.clientTenantId} value={branch.clientTenantId}>{branch.name} · {branch.slug}</option>)}</select></label>
            <Button type="button" variant="outline" className="w-full rounded-xl md:w-auto" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={query.isFetching ? 'mr-2 size-4 animate-spin' : 'mr-2 size-4'} />Actualizar</Button>
          </div>

          {query.isLoading && <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-5 animate-spin" />Cargando sucursales y series…</div>}
          {query.error && <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{getApiErrorMessage(query.error, 'No se pudo cargar la configuración de facturación.')}</div>}
          {error && <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
          {!query.isLoading && !query.error && !branches.length && <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center"><Building2 className="size-8 text-muted-foreground/50" /><p className="mt-3 font-black">No hay sucursales disponibles</p><p className="mt-1 text-sm text-muted-foreground">Verifica el alcance asignado a este Manager.</p></div>}

          {selectedBranch && <div className="space-y-4">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3"><div className="flex min-w-0 items-center gap-2"><Building2 className="size-4 shrink-0 text-primary" /><span className="truncate font-black">{selectedBranch.name}</span></div><Badge variant="outline" className="shrink-0 rounded-full">{selectedBranch.items.length} configuración(es)</Badge></div>
            {normalItem && posItem && <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                {sharePrefix ? <Link2 className="mt-0.5 size-5 shrink-0 text-primary" /> : <Unlink2 className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}
                <div className="min-w-0"><label htmlFor="manager-share-invoice-series" className="font-black">Usar el mismo prefijo y consecutivo</label><p className="mt-1 text-xs leading-5 text-muted-foreground">{sharePrefix ? 'Recomendado: una factura enviada a Caja conserva su número y no se crea otra factura al cobrarla.' : 'Caja utilizará una serie independiente y solo se aplicará si se factura directamente desde POS.'}</p></div>
              </div>
              <Switch id="manager-share-invoice-series" checked={sharePrefix} onCheckedChange={toggleSharing} aria-label="Usar el mismo prefijo y consecutivo en facturación normal y Caja" />
            </div>}
            <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">{selectedBranch.items.map((item) => {
              const key = item.scopeKey + ':' + item.documentType;
              const isSharedPos = sharePrefix && item.documentType === 'POS_INVOICE' && Boolean(normalItem);
              const isSaving = saving === key || saving === normalKey + ':shared';
              const displayedPrefix = isSharedPos && normalItem ? (drafts[normalKey] || normalItem.prefix) : (drafts[key] || item.prefix);
              const nextNumberSuffix = String(item.nextNumber).split('-').pop() || '001';
              return <Card key={key} className="min-w-0 rounded-2xl border-border/60 shadow-sm"><CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3"><div className="min-w-0"><CardTitle className="text-base font-black">{documentTypeLabel[item.documentType]}</CardTitle><p className="mt-1 truncate text-xs text-muted-foreground">Sucursal: {item.branchName}</p></div><Badge variant={item.configured ? 'default' : 'outline'} className="shrink-0 rounded-full">{isSharedPos ? 'Compartido' : item.configured ? 'Personalizado' : 'Predeterminado'}</Badge></CardHeader><CardContent className="space-y-3"><div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(150px,auto)] sm:items-end"><label className="min-w-0 space-y-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground"><span>Prefijo</span><Input value={displayedPrefix} readOnly={isSharedPos} onChange={(event) => updateDraft(item, event.target.value)} maxLength={20} className="h-11 w-full font-mono uppercase tracking-wider" /></label><div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] px-3 py-2.5 sm:min-w-[170px]"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Siguiente</p><p className="mt-1 break-all font-mono text-sm font-black text-primary">{displayedPrefix.toUpperCase() + '-' + nextNumberSuffix}</p></div></div><p className="text-xs leading-5 text-muted-foreground">{isSharedPos ? 'Heredado de Facturación normal. El cobro en Caja actualiza la misma factura.' : <>Predeterminado: <span className="font-mono font-bold text-foreground">{item.defaultPrefix}-001</span>. El consecutivo se genera automáticamente.</>}</p><div className="flex flex-wrap gap-2">{(!isSharedPos || item.documentType === 'SALES_INVOICE') && <Button type="button" className="rounded-xl" onClick={() => void save(item)} disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}{sharePrefix && item.documentType === 'SALES_INVOICE' ? 'Guardar serie compartida' : 'Guardar prefijo'}</Button>}{item.configured && !isSharedPos && <Button type="button" variant="outline" className="rounded-xl" onClick={() => void save(item, true)} disabled={isSaving}><RotateCcw className="mr-2 size-4" />Restaurar</Button>}</div></CardContent></Card>;
            })}</div>
          </div>}
        </CardContent>
      </Card>
    </div>
  );
}
