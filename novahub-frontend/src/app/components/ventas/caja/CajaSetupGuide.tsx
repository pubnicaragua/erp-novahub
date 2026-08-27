import { useMemo } from 'react';
import { Banknote, CheckCircle2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import type { CashRegister } from '../../../services/caja.service';

interface SetupGuideProps {
  registers: CashRegister[];
  selectedRegister: string;
  onSelectRegister: (id: string) => void;
  onOpenManageCajas: () => void;
}

/**
 * La caja se crea directamente en la sucursal. Las bodegas se seleccionan
 * durante la emisión de cada producto, por eso no forman parte del setup de
 * caja.
 */
export function CajaSetupGuide({
  registers,
  selectedRegister,
  onSelectRegister,
  onOpenManageCajas,
}: SetupGuideProps) {
  const allDone = registers.length > 0 && Boolean(selectedRegister && selectedRegister !== 'ALL');
  const firstRegisterId = useMemo(() => registers[0]?.id || '', [registers]);

  if (allDone) return null;

  const selectAvailableRegister = () => {
    if (firstRegisterId) {
      onSelectRegister(firstRegisterId);
      return;
    }
    onOpenManageCajas();
  };

  return (
    <Card className="border-border/60 bg-gradient-to-br from-background via-muted/20 to-primary/5 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-black">
          {registers.length > 0 ? 'Seleccionar caja para operar' : 'Crear caja para operar'}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          La caja queda asociada a la sucursal activa. Al facturar podrás elegir la bodega de salida de cada producto y consultar existencias de otras sucursales del mismo rubro.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-bold">Sucursal activa</p>
              <p className="text-xs text-muted-foreground">La caja se registra aquí automáticamente.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 p-3">
            <Banknote className="size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-bold">Caja</p>
              <p className="text-xs text-muted-foreground">{registers.length > 0 ? 'Selecciona una caja activa.' : 'Pendiente de creación.'}</p>
            </div>
          </div>
        </div>
        <Button onClick={selectAvailableRegister} className="gap-2">
          {registers.length > 0 ? 'Seleccionar caja disponible' : 'Crear caja ahora'}
        </Button>
      </CardContent>
    </Card>
  );
}
