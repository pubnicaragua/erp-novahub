import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Lock } from 'lucide-react';
import { DenominationCounter, NIO_BILLS, NIO_COINS, USD_BILLS, USD_COINS, DenominationState } from './DenominationCounter';
import { useCurrency } from '../../../contexts/CurrencyContext';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../../services/api';

interface AperturaCajaStepProps {
  selectedRegister: string;
  onOpenSession: (dto: any) => Promise<void>;
}

export function AperturaCajaStep({ selectedRegister, onOpenSession }: AperturaCajaStepProps) {
  const { exchangeRate } = useCurrency();
  const [nioDenominations, setNioDenominations] = useState<DenominationState[]>([
    ...NIO_BILLS.map(v => ({ value: v, quantity: 0, type: 'bill' as const })),
    ...NIO_COINS.map(v => ({ value: v, quantity: 0, type: 'coin' as const }))
  ]);
  const [usdDenominations, setUsdDenominations] = useState<DenominationState[]>([
    ...USD_BILLS.map(v => ({ value: v, quantity: 0, type: 'bill' as const })),
    ...USD_COINS.map(v => ({ value: v, quantity: 0, type: 'coin' as const }))
  ]);

  const calcTotalNIO = () => nioDenominations.reduce((acc, d) => acc + (d.value * d.quantity), 0);
  const calcTotalUSD = () => usdDenominations.reduce((acc, d) => acc + (d.value * d.quantity), 0);

  const handleOpenSession = async () => {
    try {
      if (!selectedRegister) {
        toast.error('Seleccione una caja primero');
        return;
      }
      const initialNIO = calcTotalNIO();
      const initialUSD = calcTotalUSD();
      
      const denoms = [
        ...nioDenominations.filter(d => d.quantity > 0).map(d => ({ currency: 'NIO', value: d.value, quantity: d.quantity, subtotal: d.value * d.quantity })),
        ...usdDenominations.filter(d => d.quantity > 0).map(d => ({ currency: 'USD', value: d.value, quantity: d.quantity, subtotal: d.value * d.quantity }))
      ];

      await onOpenSession({
        cashRegisterId: selectedRegister,
        exchangeRateUSD: exchangeRate,
        initialAmountNIO: initialNIO,
        initialAmountUSD: initialUSD,
        denominations: denoms,
        notes: ''
      });
      toast.success('Caja aperturada exitosamente');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Error al aperturar caja'));
    }
  };

  return (
    <Card className="border-border/50 shadow-sm border-t-4 border-t-primary">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg">Ingreso de Efectivo: Apertura</CardTitle>
            <CardDescription>Ingrese el fondo inicial en físico para comenzar a operar.</CardDescription>
          </div>
          <Button onClick={handleOpenSession} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-all shadow-sm">
            <Lock className="size-4 mr-2" /> Aperturar Caja
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <DenominationCounter 
          nioDenominations={nioDenominations} setNioDenominations={setNioDenominations}
          usdDenominations={usdDenominations} setUsdDenominations={setUsdDenominations}
          totalNIO={calcTotalNIO()} totalUSD={calcTotalUSD()}
        />
      </CardContent>
    </Card>
  );
}
