import React, { useState } from 'react';
import { History, ArrowUpRight, ArrowDownLeft, RefreshCcw, Search, Download, FileDown } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toast } from 'sonner';
import { cn } from '../ui/utils';

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
      case 'IN': return <ArrowDownLeft className="size-4 text-emerald-500" />;
      case 'OUT': return <ArrowUpRight className="size-4 text-rose-500" />;
      case 'TRANSFER': return <RefreshCcw className="size-4 text-blue-500" />;
      default: return <History className="size-4 text-muted-foreground" />;
    }
  };

  const getTypeLabel = (type: string) => {
    return TYPE_OPTIONS.find(t => t.value === type)?.label || type;
  };


  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-2 flex-1 w-full">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40" />
            <Input 
              placeholder="Buscar producto o referencia..." 
              className="pl-9 h-10 w-full bg-background/50 border-border/50 rounded-xl text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-32 h-10 bg-background/50 border-border/50 rounded-xl text-[10px] font-black uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className="w-full sm:w-40 h-10 bg-background/50 border-border/50 rounded-xl text-[10px] font-black uppercase">
                <SelectValue placeholder="Almacén" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">TODOS LOS ALMACENES</SelectItem>
                {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Mobile View (Cards) */}
      <div className="md:hidden space-y-4">
        {filteredMovements.length === 0 ? (
          <div className="text-center py-20 bg-muted/5 rounded-3xl border border-dashed border-border/50">
            <History className="size-12 mx-auto mb-4 text-muted-foreground/20" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">No hay movimientos registrados</p>
          </div>
        ) : (
          filteredMovements.map((move: any) => (
            <Card key={move.id} className="p-4 border-border/50 rounded-2xl shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h4 className="font-black text-sm uppercase text-foreground leading-none">{move.product?.name || 'PRODUCTO DESCONOCIDO'}</h4>
                  <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">{move.warehouse?.name || 'SIN ALMACÉN'}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn("text-sm font-black tabular-nums", move.type === 'IN' ? 'text-emerald-500' : move.type === 'OUT' ? 'text-rose-500' : 'text-blue-500')}>
                    {move.type === 'OUT' ? '-' : '+'}{move.quantity}
                  </span>
                  <Badge variant="outline" className="text-[8px] font-black uppercase px-1 h-4 border-border/50">{getTypeLabel(move.type)}</Badge>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-border/40 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                <div className="flex items-center gap-1">
                  {getMovementIcon(move.type)}
                  <span>{new Date(move.date).toLocaleDateString()}</span>
                </div>
                <span className="truncate max-w-[150px]">{move.reference || '-'}</span>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Desktop View (Table) */}
      <div className="hidden md:block rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-40">Fecha</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-28">Tipo</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Producto</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Almacén</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-20">Cantidad</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Referencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMovements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16">
                  <History className="size-12 mx-auto mb-4 text-muted-foreground/20" />
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">No hay movimientos que mostrar</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredMovements.map((move: any) => (
                <TableRow key={move.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-[10px] font-black uppercase text-muted-foreground/60">
                    {new Date(move.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getMovementIcon(move.type)}
                      <Badge variant="outline" className="text-[9px] font-black uppercase border-border/50 bg-background/50">{getTypeLabel(move.type)}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-black uppercase tracking-tight">{move.product?.name || '-'}</TableCell>
                  <TableCell className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">{move.warehouse?.name || '-'}</TableCell>
                  <TableCell className="text-right">
                    <span className={cn("font-black tabular-nums", move.type === 'IN' ? 'text-emerald-500' : move.type === 'OUT' ? 'text-rose-500' : 'text-blue-500')}>
                      {move.type === 'OUT' ? '-' : '+'}{move.quantity}
                    </span>
                  </TableCell>
                  <TableCell className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest truncate max-w-[200px]">{move.reference || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="px-2 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
        {filteredMovements.length} movimientos encontrados en el periodo
      </div>
    </div>
  );
}

