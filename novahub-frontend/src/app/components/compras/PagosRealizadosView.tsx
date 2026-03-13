import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Printer, CheckCircle2, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { paymentsService } from '../../services/compras.service';
import { EditableDataTable } from '../ui/EditableDataTable';
import { toast } from 'sonner';

export function PagosRealizadosView() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await paymentsService.getAll();
      setData(response.data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Error al cargar pagos');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'reference', header: 'Referencia', editable: true },
    { 
      key: 'supplier', 
      header: 'Proveedor', 
      editable: false,
      render: (val: any) => val?.name || '-'
    },
    { 
      key: 'paymentDate', 
      header: 'Fecha Pago', 
      editable: true,
      render: (val: string) => val ? new Date(val).toLocaleDateString() : '-'
    },
    { 
      key: 'amount', 
      header: 'Monto Pagado', 
      editable: true,
      render: (val: number) => (
        <span className="font-bold text-emerald-500">
          ${val?.toLocaleString()}
        </span>
      )
    },
    { 
      key: 'paymentMethod', 
      header: 'Método', 
      editable: true,
      render: (val: string) => (
        <Badge variant="outline" className="capitalize">
          {val?.toLowerCase()}
        </Badge>
      )
    },
    { 
      key: 'status', 
      header: 'Estado', 
      editable: true,
      render: (val: string) => (
        <Badge variant="secondary" className="bg-green-500/10 text-green-400">
          Confirmado
        </Badge>
      )
    },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<any>) => {
    try {
      await paymentsService.update(id as string, updates);
      toast.success('Pago actualizado');
      fetchData();
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const stats = {
    totalPagado: data.reduce((acc, curr) => acc + (curr.amount || 0), 0),
    transacciones: data.length,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <Wallet className="size-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-500/80">Efectivo Desembolsado</p>
                <p className="text-2xl font-bold text-emerald-500">${stats.totalPagado.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <CheckCircle2 className="size-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-500/80">Pagos Conciliados</p>
                <p className="text-2xl font-bold text-blue-500">{stats.transacciones}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border/10">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="size-5 text-primary" />
              Pagos Realizados
            </CardTitle>
            <CardDescription>Registro histórico de desembolsos a proveedores</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Printer className="size-4 mr-2" /> Comprobantes
            </Button>
            <Button className="bg-[#05602b] hover:bg-[#044c22]">
              <Plus className="mr-2 h-4 w-4" /> Registrar Pago
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 bg-muted/20 border-b border-border/10 text-[11px] text-muted-foreground italic flex items-center gap-2">
             <span>💡 Los pagos se asocian automáticamente a las facturas pendientes por fecha de vencimiento.</span>
          </div>
          <EditableDataTable 
            data={data} 
            columns={columns} 
            onRowUpdate={handleUpdate}
            isLoading={loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
