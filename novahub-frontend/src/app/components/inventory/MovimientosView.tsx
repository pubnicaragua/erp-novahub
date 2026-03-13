import React, { useState } from 'react';
import { History, ArrowUpRight, ArrowDownLeft, RefreshCcw, Search, Download } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toast } from 'sonner';

interface MovimientosViewProps {
  movements: any[];
  warehouses: any[];
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'IN', label: 'Entrada' },
  { value: 'OUT', label: 'Salida' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'ADJUSTMENT', label: 'Ajuste' },
];

export function MovimientosView({ movements, warehouses }: MovimientosViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');

  const filteredMovements = movements.filter(m => {
    const matchesSearch = !searchTerm || 
      m.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.reference?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || m.type === typeFilter;
    const matchesWarehouse = warehouseFilter === 'all' || m.warehouseId === warehouseFilter;
    return matchesSearch && matchesType && matchesWarehouse;
  });

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'IN': return <ArrowDownLeft className="size-4 text-green-500" />;
      case 'OUT': return <ArrowUpRight className="size-4 text-red-500" />;
      case 'TRANSFER': return <RefreshCcw className="size-4 text-blue-500" />;
      default: return <History className="size-4 text-muted-foreground" />;
    }
  };

  const getTypeLabel = (type: string) => {
    return TYPE_OPTIONS.find(t => t.value === type)?.label || type;
  };

  const handleExport = () => {
    try {
      const csvContent = [
        ['Fecha', 'Tipo', 'Producto', 'Almacén', 'Cantidad', 'Referencia'].join(','),
        ...filteredMovements.map(m => [
          new Date(m.date).toLocaleString(),
          m.type,
          `"${m.product?.name || ''}"`,
          `"${m.warehouse?.name || ''}"`,
          m.quantity,
          `"${m.reference || ''}"`
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `movimientos_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast.success('Movimientos exportados');
    } catch (e) {
      toast.error('Error al exportar');
    }
  };

  return (
    <Card className="p-4 border bg-card rounded-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar producto o referencia..." 
              className="pl-9 h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Almacén" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="size-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold text-xs w-40">Fecha</TableHead>
              <TableHead className="font-semibold text-xs w-28">Tipo</TableHead>
              <TableHead className="font-semibold text-xs">Producto</TableHead>
              <TableHead className="font-semibold text-xs">Almacén</TableHead>
              <TableHead className="font-semibold text-xs text-right w-20">Cantidad</TableHead>
              <TableHead className="font-semibold text-xs">Referencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMovements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <History className="size-10 mx-auto mb-2 opacity-20" />
                  <p className="font-medium">No hay movimientos</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredMovements.map((move: any) => (
                <TableRow key={move.id} className="hover:bg-muted/30">
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(move.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getMovementIcon(move.type)}
                      <Badge variant="outline" className="text-[10px]">{getTypeLabel(move.type)}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{move.product?.name || '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{move.warehouse?.name || '-'}</TableCell>
                  <TableCell className="text-right">
                    <span className={`font-medium ${move.type === 'IN' ? 'text-green-600' : move.type === 'OUT' ? 'text-red-600' : 'text-blue-600'}`}>
                      {move.type === 'OUT' ? '-' : '+'}{move.quantity}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{move.reference || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        {filteredMovements.length} de {movements.length} movimientos
      </div>
    </Card>
  );
}
