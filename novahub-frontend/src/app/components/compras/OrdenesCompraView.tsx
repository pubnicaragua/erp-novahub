import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Printer, Send, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { purchaseOrdersService } from '../../services/compras.service';
import type { PurchaseOrder } from '../../types';
import { EditableDataTable } from '../ui/EditableDataTable';
import { toast } from 'sonner';

export function OrdenesCompraView() {
  const [data, setData] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await purchaseOrdersService.getAll();
      setData(response.data || []);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      toast.error('Error al cargar órdenes de compra');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'number', header: 'Número', editable: false },
    { 
      key: 'supplier', 
      header: 'Proveedor', 
      editable: false,
      render: (val: any) => val?.name || '-'
    },
    { 
      key: 'date', 
      header: 'Fecha Emisión', 
      editable: true,
      render: (val: string) => new Date(val).toLocaleDateString()
    },
    { 
      key: 'expectedDelivery', 
      header: 'Entrega Esperada', 
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
          'SENT': 'bg-blue-500/10 text-blue-400',
          'APPROVED': 'bg-green-500/10 text-green-400',
          'CANCELLED': 'bg-red-500/10 text-red-400',
          'draft': 'bg-gray-500/10 text-gray-400',
          'sent': 'bg-blue-500/10 text-blue-400',
          'approved': 'bg-green-500/10 text-green-400',
          'cancelled': 'bg-red-500/10 text-red-400',
        };
        return (
          <Badge variant="secondary" className={colors[val] || 'bg-primary/10'}>
            {val}
          </Badge>
        );
      }
    },
    { key: 'requestedBy', header: 'Solicitante', editable: true },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<PurchaseOrder>) => {
    try {
      await purchaseOrdersService.update(id as string, updates);
      toast.success('Orden de compra actualizada');
      fetchData();
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const handleAddOrder = async () => {
    try {
      const newOrder = {
        number: `OC-${Date.now().toString().slice(-4)}`,
        date: new Date().toISOString(),
        status: 'DRAFT' as any,
        total: 0,
        requestedBy: 'Admin',
        currency: 'USD'
      };
      await purchaseOrdersService.create(newOrder as any);
      toast.success('Orden de compra creada como borrador');
      fetchData();
    } catch (error) {
      toast.error('Error al crear orden');
    }
  };

  const stats = {
    pendientesAprobacion: data.filter(o => o.status === 'SENT' || o.status === 'sent').length,
    aprobadasHoy: data.filter(o => (o.status === 'APPROVED' || o.status === 'approved') && new Date(o.createdAt).toDateString() === new Date().toDateString()).length,
    totalMonto: data.reduce((acc, curr) => acc + (curr.total || 0), 0)
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid gap-5 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 shadow-none">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-blue-500/20 rounded-lg text-blue-500">
                <Send className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-500/80">Por Aprobar</p>
                <p className="text-2xl font-bold text-blue-500">{stats.pendientesAprobacion}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 shadow-none">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-emerald-500/20 rounded-lg text-emerald-500">
                <CheckCircle className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-500/80">Aprobadas</p>
                <p className="text-2xl font-bold text-emerald-500">{data.filter(o => o.status === 'APPROVED' || o.status === 'approved').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#05602b]/10 to-[#05602b]/5 border-[#05602b]/20 shadow-none">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-[#05602b]/20 rounded-lg text-[#05602b]">
                <ClipboardList className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#05602b]/80">Total Gestión</p>
                <p className="text-2xl font-bold text-[#05602b]">${stats.totalMonto.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border/10">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <ClipboardList className="size-5 text-primary" />
              Órdenes de Compra
            </CardTitle>
            <CardDescription>Planificación y aprobación de pedidos a proveedores</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-9">
              <Printer className="size-4 mr-2" /> Imprimir Lote
            </Button>
            <Button onClick={handleAddOrder} className="bg-[#05602b] hover:bg-[#044c22] h-9">
              <Plus className="mr-2 h-4 w-4" /> Crear Borrador
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
