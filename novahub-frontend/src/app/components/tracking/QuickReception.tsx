import { useRef, useState } from 'react';
import { Loader2, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { getApiErrorMessage } from '../../services/api';
import { logisticsService, type ImportDefaults } from '../../services/logistics.service';

interface QuickReceptionProps {
  defaults: ImportDefaults;
  fixed: {
    sku?: string;
    warehouseId?: string;
    shipmentModeCode?: string;
  };
  onImported: () => void;
}

export function QuickReception({ defaults, onImported }: QuickReceptionProps) {
  const [rows, setRows] = useState<Array<{ tracking: string; weight: string }>>([{ tracking: '', weight: '' }]);
  const [busy, setBusy] = useState(false);
  const trackingRef = useRef<HTMLInputElement>(null);

  const submitRows = async (list: Array<{ tracking: string; weight: string }>) => {
    const payloadRows = list
      .filter((r) => r.tracking.trim() && Number(r.weight) > 0)
      .map((r) => ({ tracking: r.tracking.trim(), weight: Number(r.weight), sku: defaults.sku }));
    if (payloadRows.length === 0) return;
    setBusy(true);
    try {
      const res = await logisticsService.quickReception({ rows: payloadRows, defaults });
      const importedCount = res.imported;
      const errors = res.rows.filter((r) => r.result === 'ERROR');
      if (importedCount > 0) toast.success(`${importedCount} paquete(s) registrado(s)`);
      if (errors.length > 0) toast.error(`${errors.length} con error (duplicados/invÃ¡lidos)`);
      setRows([{ tracking: '', weight: '' }]);
      onImported();
      setTimeout(() => trackingRef.current?.focus(), 50);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al registrar'));
    } finally { setBusy(false); }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>, index: number, field: 'tracking' | 'weight') => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const row = rows[index];
    if (field === 'tracking' && row.tracking.trim()) {
      document.getElementById(`qw-${index}`)?.focus();
    } else if (field === 'weight' && Number(row.weight) > 0) {
      if (index === rows.length - 1) {
        submitRows(rows);
      } else {
        document.getElementById(`qt-${index + 1}`)?.focus();
      }
    }
  };

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl border-primary/20 bg-primary/5 p-4">
        <p className="flex items-center gap-1.5 text-xs font-black text-primary"><Zap className="size-4" /> ConfiguraciÃ³n fija (se mantiene entre paquetes)</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="rounded-lg text-[10px]">Tipo: {defaults.shipmentModeCode || 'Custom'}</Badge>
          <Badge variant="outline" className="rounded-lg text-[10px]">SKU: {defaults.sku || 'SIN-SKU'}</Badge>
          <Badge variant="outline" className="rounded-lg text-[10px]">Bodega: {defaults.warehouseId ? 'Configurada' : 'Sin bodega'}</Badge>
          <Badge variant="outline" className="rounded-lg text-[10px]">Agencia: {defaults.agency?.name || 'â€”'}</Badge>
        </div>
      </Card>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex gap-2">
            <Input
              id={`qt-${index}`}
              ref={index === 0 ? trackingRef : undefined}
              placeholder="Tracking (escÃ¡ner â†’ ENTER)"
              value={row.tracking}
              onChange={(e) => setRows((rs) => rs.map((r, i) => (i === index ? { ...r, tracking: e.target.value } : r)))}
              onKeyDown={(e) => handleKey(e, index, 'tracking')}
              className="rounded-xl font-mono"
              autoFocus={index === 0}
            />
            <Input
              id={`qw-${index}`}
              type="number"
              step="0.01"
              min="0"
              placeholder="Peso"
              value={row.weight}
              onChange={(e) => setRows((rs) => rs.map((r, i) => (i === index ? { ...r, weight: e.target.value } : r)))}
              onKeyDown={(e) => handleKey(e, index, 'weight')}
              className="w-32 rounded-xl"
            />
            {index === rows.length - 1 ? (
              <Button className="rounded-xl" onClick={() => submitRows(rows)} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} Registrar
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="rounded-xl text-destructive" onClick={() => setRows((rs) => rs.filter((_, i) => i !== index))}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
        <button className="text-xs font-bold text-primary" onClick={() => setRows((rs) => [...rs, { tracking: '', weight: '' }])}>+ Agregar fila</button>
      </div>

      <p className="text-[11px] text-muted-foreground">Flujo por paquete: Escanear â†’ Peso â†’ ENTER. Al terminar se limpian los campos y se mantiene la configuraciÃ³n.</p>
    </div>
  );
}