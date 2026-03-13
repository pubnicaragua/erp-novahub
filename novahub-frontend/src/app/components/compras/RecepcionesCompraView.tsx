import React, { useState, useEffect } from 'react';
import { Truck, Plus, Printer, CheckCircle, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { purchaseOrdersService } from '../../services/compras.service';
import { EditableDataTable } from '../ui/EditableDataTable';
import { toast } from 'sonner';

export function RecepcionesCompraView() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // For now, we use POs with 'APPROVED' or 'RECEIVED' status to simulate receipts
      const response = await purchaseOrdersService.getAll();
      setData(response.data || []);
    } catch (error) {
      console.error('Error fetching receipts:', error);
      toast.error('Error al cargar recepciones');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'number', header: 'Orden #', editable: false },
    { 
      key: 'supplier', 
      header: 'Proveedor', 
      editable: false,
      render: (val: any) => val?.name || '-'
    },
    { 
      key: 'expectedDelivery', 
      header: 'Fecha Recepción', 
      editable: true,
      render: (val: string) => val ? new Date(val).toLocaleDateString() : '-'
    },
    { 
      key: 'status', 
      header: 'Estado', 
      editable: true,
      render: (val: string) => {
        const isReceived = val === 'RECEIVED' || val === 'received';
        return (
          <Badge variant="secondary" className={isReceived ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}>
            {isReceived ? 'Recibido' : 'Pendiente'}
          </Badge>
        );
      }
    },
    { key: 'requestedBy', header: 'Recibido Por', editable: true },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<any>) => {
    try {
      await purchaseOrdersService.update(id as string, updates);
      toast.success('Recepción actualizada');
      fetchData();
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const totals = {
    pendientes: data.filter(o => o.status === 'APPROVED' || o.status === 'approved').length,
    recibidosHoy: data.filter(o => (o.status === 'RECEIVED' || o.status === 'received')).length,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Package className="size-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-500/80">En Tránsito / Pendiente</p>
                <p className="text-2xl font-bold text-blue-500">{totals.pendientes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <CheckCircle className="size-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-500/80">Recibidos (Total)</p>
                <p className="text-2xl font-bold text-emerald-500">{totals.recibidosHoy}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border/10">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Truck className="size-5 text-primary" />
              Recepciones de Compra
            </CardTitle>
            <CardDescription>Control de entrada de mercancía y validación de pedidos</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Printer className="size-4 mr-2" /> Etiquetas
            </Button>
            <Button className="bg-[#05602b] hover:bg-[#044c22]">
              <Plus className="mr-2 h-4 w-4" /> Registrar Entrada
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
