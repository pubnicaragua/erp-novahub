import React, { useState, useEffect } from 'react';
import { Truck, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { suppliersService } from '../../services/compras.service';
import type { Supplier } from '../../types';
import { EditableDataTable } from '../ui/EditableDataTable';
import { toast } from 'sonner';

export function ProveedoresView() {
  const [data, setData] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await suppliersService.getAll();
      setData(response.data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'code', header: 'Código', editable: true },
    { key: 'name', header: 'Nombre', editable: true },
    { key: 'contactName', header: 'Contacto', editable: true },
    { key: 'email', header: 'Email', editable: true },
    { key: 'phone', header: 'Teléfono', editable: true },
    { 
      key: 'balance', 
      header: 'Saldo', 
      editable: false,
      render: (val: number) => (
        <span className="font-semibold text-primary">
          ${val?.toLocaleString() || '0'}
        </span>
      )
    },
    { 
      key: 'status', 
      header: 'Estado', 
      editable: true,
      render: (val: string) => (
        <Badge variant="secondary" className={
          val === 'ACTIVE' || val === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
        }>
          {val}
        </Badge>
      )
    },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Supplier>) => {
    try {
      await suppliersService.update(id as string, updates);
      toast.success('Proveedor actualizado');
      fetchData();
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const handleAddSupplier = async () => {
    try {
      const newSupplier = {
        name: 'Nuevo Proveedor',
        code: `PRV-${Date.now().toString().slice(-4)}`,
        status: 'ACTIVE' as any,
        balance: 0
      };
      await suppliersService.create(newSupplier as any);
      toast.success('Proveedor añadido');
      fetchData();
    } catch (error) {
      toast.error('Error al añadir proveedor');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid gap-5 md:grid-cols-3">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Truck className="size-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Proveedores</p>
                <p className="text-2xl font-bold">{data.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 text-emerald-400">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl">
                <Truck className="size-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground text-emerald-400/80">Activos</p>
                <p className="text-2xl font-bold">{data.filter(s => s.status === 'ACTIVE' || s.status === 'active').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 text-orange-400">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-xl">
                <Truck className="size-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground text-orange-400/80">Saldo Pendiente</p>
                <p className="text-2xl font-bold">${data.reduce((acc, s) => acc + (s.balance || 0), 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl font-bold">Directorio de Proveedores</CardTitle>
            <CardDescription>Gestión centralizada de aliados comerciales</CardDescription>
          </div>
          <Button onClick={handleAddSupplier} className="bg-[#05602b] hover:bg-[#044c22]">
            <Plus className="mr-2 h-4 w-4" /> Nuevo Proveedor
          </Button>
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
