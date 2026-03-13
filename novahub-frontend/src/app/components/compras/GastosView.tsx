import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { expensesService } from '../../services/compras.service';
import type { Expense } from '../../types';
import { EditableDataTable } from '../ui/EditableDataTable';
import { toast } from 'sonner';

export function GastosView() {
  const [data, setData] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await expensesService.getAll();
      setData(response.data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Error al cargar gastos');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'number', header: 'Número', editable: false },
    { key: 'description', header: 'Descripción', editable: true },
    { 
      key: 'supplier', 
      header: 'Proveedor', 
      editable: false,
      render: (val: any) => val?.name || '-'
    },
    { 
      key: 'category', 
      header: 'Categoría', 
      editable: true,
      render: (val: string) => (
        <Badge variant="outline" className="capitalize">
          {val?.toLowerCase()}
        </Badge>
      )
    },
    { 
      key: 'amount', 
      header: 'Monto', 
      editable: true,
      render: (val: number) => (
        <span className="font-bold text-foreground">
          ${val?.toLocaleString()}
        </span>
      )
    },
    { 
      key: 'date', 
      header: 'Fecha', 
      editable: true,
      render: (val: string) => new Date(val).toLocaleDateString()
    },
    { 
      key: 'status', 
      header: 'Estado', 
      editable: true,
      render: (val: string) => (
        <Badge variant="secondary" className={
          val === 'PAID' || val === 'paid' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
        }>
          {val}
        </Badge>
      )
    },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Expense>) => {
    try {
      await expensesService.update(id as string, updates);
      toast.success('Gasto actualizado');
      fetchData();
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const handleAddExpense = async () => {
    try {
      const newExpense = {
        description: 'Nuevo Gasto Operativo',
        amount: 0,
        category: 'OTROS',
        date: new Date().toISOString(),
        status: 'PENDING' as any,
        currency: 'USD',
        // Note: accountId would be needed in a real scenario
        accountId: 'acct-purchases-001' 
      };
      await expensesService.create(newExpense as any);
      toast.success('Gasto registrado');
      fetchData();
    } catch (error) {
      toast.error('Error al registrar gasto');
    }
  };

  const totals = {
    mes: data.reduce((acc, curr) => acc + (curr.amount || 0), 0),
    pendientes: data.filter(e => e.status !== 'PAID' && e.status !== 'paid').length,
    categorias: new Set(data.map(e => e.category)).size
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid gap-5 md:grid-cols-3">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl font-bold text-primary">
                $
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Gastos</p>
                <p className="text-2xl font-bold">${totals.mes.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-500/10 rounded-xl">
                <Filter className="size-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pendientes de Pago</p>
                <p className="text-2xl font-bold text-yellow-500">{totals.pendientes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Wallet className="size-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Categorías</p>
                <p className="text-2xl font-bold text-blue-500">{totals.categorias}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl font-bold">Registro de Gastos</CardTitle>
            <CardDescription>Control detallado de salidas de efectivo operativas</CardDescription>
          </div>
          <Button onClick={handleAddExpense} className="bg-[#05602b] hover:bg-[#044c22]">
            <Plus className="mr-2 h-4 w-4" /> Registrar Gasto
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
