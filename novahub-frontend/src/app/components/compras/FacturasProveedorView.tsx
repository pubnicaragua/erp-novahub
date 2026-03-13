import React, { useState, useEffect } from 'react';
import { FileStack, Plus, Printer, CreditCard, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { billsService } from '../../services/compras.service';
import { EditableDataTable } from '../ui/EditableDataTable';
import { toast } from 'sonner';

export function FacturasProveedorView() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await billsService.getAll();
      setData(response.data || []);
    } catch (error) {
      console.error('Error fetching bills:', error);
      toast.error('Error al cargar facturas');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'number', header: 'Factura #', editable: false },
    { 
      key: 'supplier', 
      header: 'Proveedor', 
      editable: false,
      render: (val: any) => val?.name || '-'
    },
    { 
      key: 'dueDate', 
      header: 'Vencimiento', 
      editable: true,
      render: (val: string) => val ? new Date(val).toLocaleDateString() : '-'
    },
    { 
      key: 'total', 
      header: 'Total', 
      editable: true,
      render: (val: number) => (
        <span className="font-bold text-foreground">
          ${val?.toLocaleString()}
        </span>
      )
    },
    { 
      key: 'status', 
      header: 'Estado', 
      editable: true,
      render: (val: string) => {
        const colors: Record<string, string> = {
          'DRAFT': 'bg-gray-500/10 text-gray-400',
          'OPEN': 'bg-blue-500/10 text-blue-400',
          'PAID': 'bg-green-500/10 text-green-400',
          'OVERDUE': 'bg-red-500/10 text-red-400',
          'draft': 'bg-gray-500/10 text-gray-400',
          'open': 'bg-blue-500/10 text-blue-400',
          'paid': 'bg-green-500/10 text-green-400',
          'overdue': 'bg-red-500/10 text-red-400',
        };
        return (
          <Badge variant="secondary" className={colors[val] || 'bg-primary/10'}>
            {val}
          </Badge>
        );
      }
    },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<any>) => {
    try {
      await billsService.update(id as string, updates);
      toast.success('Factura actualizada');
      fetchData();
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const totals = {
    porPagar: data.filter(b => b.status === 'OPEN' || b.status === 'open' || b.status === 'OVERDUE' || b.status === 'overdue').reduce((acc, curr) => acc + (curr.total || 0), 0),
    vencidas: data.filter(b => b.status === 'OVERDUE' || b.status === 'overdue').length,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-500/20 rounded-xl">
                <Clock className="size-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-orange-500/80">Total por Pagar</p>
                <p className="text-2xl font-bold text-orange-500">${totals.porPagar.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/20 rounded-xl">
                <CreditCard className="size-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-500/80">Facturas Vencidas</p>
                <p className="text-2xl font-bold text-red-500">{totals.vencidas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border/10">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <FileStack className="size-5 text-primary" />
              Facturas de Proveedor
            </CardTitle>
            <CardDescription>Gestión de cuentas por pagar y vencimientos</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Printer className="size-4 mr-2" /> Reporte
            </Button>
            <Button className="bg-[#05602b] hover:bg-[#044c22]">
              <Plus className="mr-2 h-4 w-4" /> Nueva Factura
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
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
