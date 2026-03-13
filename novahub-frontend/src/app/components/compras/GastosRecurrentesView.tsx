import React, { useState, useEffect } from 'react';
import { CalendarClock, Plus, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { recurringExpensesService } from '../../services/compras.service';
import type { RecurringExpense } from '../../types';
import { EditableDataTable } from '../ui/EditableDataTable';
import { toast } from 'sonner';

export function GastosRecurrentesView() {
  const [data, setData] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await recurringExpensesService.getAll();
      setData(response.data || []);
    } catch (error) {
      console.error('Error fetching recurring expenses:', error);
      toast.error('Error al cargar gastos recurrentes');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'description', header: 'Descripción', editable: true },
    { 
      key: 'supplier', 
      header: 'Proveedor', 
      editable: false,
      render: (val: any) => val?.name || '-'
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
      key: 'frequency', 
      header: 'Frecuencia', 
      editable: true,
      render: (val: string) => (
        <Badge variant="outline" className="bg-blue-500/5 text-blue-400 border-blue-500/20">
          {val}
        </Badge>
      )
    },
    { 
      key: 'startDate', 
      header: 'Fecha Inicio', 
      editable: true,
      render: (val: string) => new Date(val).toLocaleDateString()
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

  const handleUpdate = async (id: string | number, updates: Partial<RecurringExpense>) => {
    try {
      // Assuming recurringExpensesService has an update method, otherwise we'd need to add it
      toast.info('Actualización de gastos recurrentes en desarrollo');
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const handleAddRecurring = async () => {
    try {
      const newRecurring = {
        description: 'Nuevo Gasto Recurrente',
        amount: 0,
        frequency: 'MONTHLY' as any,
        startDate: new Date().toISOString(),
        status: 'ACTIVE' as any,
        accountId: 'acct-purchases-001'
      };
      await recurringExpensesService.create(newRecurring as any);
      toast.success('Gasto recurrente registrado');
      fetchData();
    } catch (error) {
      toast.error('Error al registrar gasto recurrente');
    }
  };

  const totals = {
    activos: data.filter(e => e.status === 'ACTIVE' || e.status === 'active').length,
    mensualEstimado: data.reduce((acc, curr) => {
      const freq = curr.frequency?.toString().toUpperCase();
      return acc + (freq === 'MONTHLY' ? curr.amount : 0);
    }, 0)
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm transition-all hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <CalendarClock className="size-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Gastos Activos</p>
                <p className="text-2xl font-bold text-blue-500">{totals.activos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm transition-all hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl font-bold text-emerald-500">
                $
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Proyectado Mensual</p>
                <p className="text-2xl font-bold text-emerald-500">${totals.mensualEstimado.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl font-bold text-[#05602b]">Gastos Recurrentes</CardTitle>
            <CardDescription>Planificación de pagos fijos y suscripciones</CardDescription>
          </div>
          <Button onClick={handleAddRecurring} className="bg-[#05602b] hover:bg-[#044c22] shadow-md shadow-[#05602b]/20">
            <Plus className="mr-2 h-4 w-4" /> Configurar Recurrencia
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
