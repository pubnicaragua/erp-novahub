import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { toast } from '@/app/services/toast';
import { contabilidadService } from '../../services/contabilidad.service';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
import { selectableIncomeAccounts, type LineIncomeConfigResponse } from '../../hooks/useSalesLineIncome';

/**
 * Ajuste por empresa: elegir cuenta de ingreso y centro de costo en cada línea de la factura.
 * Apagado por defecto: las empresas que no lo activan se contabilizan exactamente igual que antes.
 */
export function SalesLineIncomeSettings({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const configQuery = useAccountingQuery<LineIncomeConfigResponse>(['config', 'sales-line-income'], (signal) => contabilidadService.getConfig(signal));
  const accountsQuery = useAccountingQuery<Parameters<typeof selectableIncomeAccounts>[0]>(['accounts', 'income-leaf'], async (signal) => accountingList(await contabilidadService.getChartOfAccounts(false, signal)));
  const [enabled, setEnabled] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const cfg = configQuery.data?.config ?? configQuery.data;
    if (!cfg) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(cfg.salesLineIncome === true);
    setCodes(Array.isArray(cfg.salesLineIncomeAccounts) ? cfg.salesLineIncomeAccounts : []);
  }, [configQuery.data]);

  const options = selectableIncomeAccounts(accountsQuery.data || []);

  const save = async () => {
    setSaving(true);
    try {
      await contabilidadService.updateConfig({ salesLineIncome: enabled, salesLineIncomeAccounts: codes });
      await queryClient.invalidateQueries({ queryKey: ['accounting'] });
      toast.success('Ajuste guardado. Aplica a las facturas nuevas.');
    } catch (error) {
      const e = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo guardar el ajuste');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cuenta de ingreso y centro de costo por línea de factura</CardTitle>
        <CardDescription>
          Permite elegir, en cada línea de la factura, a qué cuenta de ingreso va (por ejemplo Gravado, Exento o Transportes) y de qué área es.
          Si una línea no elige cuenta, usa la de Ventas configurada arriba. Apagado, todo funciona como antes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!canEdit} aria-label="Activar cuenta y centro de costo por línea" />
          Activar en las facturas
        </label>
        {enabled && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Cuentas que se ofrecen en las líneas. Sin marcar ninguna, se ofrecen todas las cuentas de ingreso de detalle.</p>
            <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-xl border p-2 sm:grid-cols-2">
              {options.map((account) => (
                <label key={account.id} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={codes.includes(account.code)}
                    onChange={(e) => setCodes((current) => e.target.checked ? [...current, account.code] : current.filter((code) => code !== account.code))}
                  />
                  <span className="font-mono">{account.code}</span> {account.name}
                </label>
              ))}
              {options.length === 0 && <span className="text-xs text-muted-foreground">No hay cuentas de ingreso de detalle.</span>}
            </div>
          </div>
        )}
        {canEdit && <Button size="sm" onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="mr-1 size-4 animate-spin" />}Guardar ajuste</Button>}
      </CardContent>
    </Card>
  );
}
