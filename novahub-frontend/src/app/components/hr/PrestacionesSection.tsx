import { Gift, UserMinus } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { AguinaldoPanel } from './AguinaldoPanel';
import { LiquidacionPanel } from './LiquidacionPanel';

/** Prestaciones laborales: aguinaldo (décimo tercer mes) y liquidación final de un empleado. */
export function PrestacionesSection({ employees }: { employees: Array<{ id: string; firstName?: string; lastName?: string; employeeNumber?: string }> }) {
  return (
    <Card className="mb-4 rounded-2xl border-border/60 bg-card/80 shadow-sm" data-testid="hr-prestaciones">
      <CardContent className="p-3 sm:p-4">
        <Tabs defaultValue="aguinaldo">
          <TabsList className="mb-3">
            <TabsTrigger value="aguinaldo" className="gap-1.5"><Gift className="size-4" aria-hidden /> Aguinaldo</TabsTrigger>
            <TabsTrigger value="liquidacion" className="gap-1.5"><UserMinus className="size-4" aria-hidden /> Liquidación de empleado</TabsTrigger>
          </TabsList>
          <TabsContent value="aguinaldo" className="m-0"><AguinaldoPanel embedded /></TabsContent>
          <TabsContent value="liquidacion" className="m-0"><LiquidacionPanel employees={employees} /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
