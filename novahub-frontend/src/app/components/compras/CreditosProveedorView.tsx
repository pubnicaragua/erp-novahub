import React, { useState, useEffect } from 'react';
import { Tag, Plus, Printer, Coins, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { vendorCreditsService } from '../../services/compras.service';
import { EditableDataTable } from '../ui/EditableDataTable';
import { toast } from 'sonner';

export function CreditosProveedorView() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await vendorCreditsService.getAll();
      setData(response.data || []);
    } catch (error) {
      console.error('Error fetching credits:', error);
      toast.error('Error al cargar créditos');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'number', header: 'Nota Crédito #', editable: false },
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
      render: (val: string) => val ? new Date(val).toLocaleDateString() : '-'
    },
    { 
      key: 'total', 
      header: 'Monto Original', 
      editable: true,
      render: (val: number) => (
        <span className="font-bold text-foreground">
          ${val?.toLocaleString()}
        </span>
      )
    },
    { 
      key: 'balance', 
      header: 'Saldo Disponible', 
      editable: false,
      render: (val: number) => (
        <span className="font-extrabold text-[#05602b]">
          ${val?.toLocaleString()}
        </span>
      )
    },
    { 
      key: 'status', 
      header: 'Estado', 
      editable: true,
      render: (val: string) => (
        <Badge variant="secondary" className={
          val === 'OPEN' || val === 'open' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'
        }>
          {val}
        </Badge>
      )
    },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<any>) => {
    try {
      await vendorCreditsService.update(id as string, updates);
      toast.success('Crédito actualizado');
      fetchData();
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const totals = {
    disponible: data.reduce((acc, curr) => acc + (curr.balance || 0), 0),
    pendientes: data.filter(c => c.status === 'OPEN' || c.status === 'open').length,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <Coins className="size-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-500/80">Crédito a Favor (Total)</p>
                <p className="text-2xl font-bold text-emerald-500">${totals.disponible.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <RefreshCcw className="size-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-500/80">Notas Disponibles</p>
                <p className="text-2xl font-bold text-blue-500">{totals.pendientes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border/10">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Tag className="size-5 text-primary" />
              Créditos de Proveedor
            </CardTitle>
            <CardDescription>Gestión de notas de crédito y saldos a favor</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Printer className="size-4 mr-2" /> Listado
            </Button>
            <Button className="bg-[#05602b] hover:bg-[#044c22]">
              <Plus className="mr-2 h-4 w-4" /> Nuevo Crédito
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
