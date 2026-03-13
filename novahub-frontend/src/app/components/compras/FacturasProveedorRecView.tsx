import React, { useState, useEffect } from 'react';
import { Repeat, Plus, Printer, CalendarClock, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { billsService } from '../../services/compras.service';
import { EditableDataTable } from '../ui/EditableDataTable';
import { toast } from 'sonner';

export function FacturasProveedorRecView() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Simulating recurring bills with filtered data if available, or just showing the table skeleton
      const response = await billsService.getAll();
      setData(response.data?.filter((b: any) => b.isRecurring) || []);
    } catch (error) {
      console.error('Error fetching recurring bills:', error);
      toast.error('Error al cargar facturas recurrentes');
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
      key: 'frequency', 
      header: 'Frecuencia', 
      editable: true,
      render: (val: string) => (
        <Badge variant="outline" className="bg-purple-500/5 text-purple-400 border-purple-500/20">
          {val || 'Mensual'}
        </Badge>
      )
    },
    { 
      key: 'total', 
      header: 'Monto Fijo', 
      editable: true,
      render: (val: number) => (
        <span className="font-bold text-foreground">
          ${val?.toLocaleString()}
        </span>
      )
    },
    { 
      key: 'nextDate', 
      header: 'Próxima Factura', 
      editable: true,
      render: (val: string) => val ? new Date(val).toLocaleDateString() : '01/04/2026'
    },
    { 
      key: 'status', 
      header: 'Estado', 
      editable: true,
      render: (val: string) => (
        <Badge variant="secondary" className="bg-green-500/10 text-green-400">
          Activo
        </Badge>
      )
    },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<any>) => {
    toast.info('Actualización de facturas recurrentes en desarrollo');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <CalendarClock className="size-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-500/80">Suscripciones / Servicios</p>
                <p className="text-2xl font-bold text-purple-500">{data.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#05602b]/10 to-[#05602b]/5 border-[#05602b]/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#05602b]/20 rounded-xl">
                <ShieldCheck className="size-6 text-[#05602b]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#05602b]/80">Auto-Generación</p>
                <p className="text-2xl font-bold text-[#05602b]">Habilitado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border/10">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Repeat className="size-5 text-primary" />
              Facturas Recurrentes
            </CardTitle>
            <CardDescription>Configuración de pagos automáticos y servicios fijos</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Printer className="size-4 mr-2" /> Historial
            </Button>
            <Button className="bg-[#05602b] hover:bg-[#044c22]">
              <Plus className="mr-2 h-4 w-4" /> Nueva Configuración
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
