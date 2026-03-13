import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Plus, Search, Filter, ArrowRight, Package, Clock, Check, TrendingUp, TrendingDown, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Label } from './ui/label';
import { transfersService } from '../services/transfers.service';
import type { Transfer, PaginatedResponse } from '../types';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'PENDING': {
    label: 'Pendiente',
    color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
    icon: <Clock className="size-3" />
  },
  'IN_TRANSIT': {
    label: 'En Tránsito',
    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    icon: <ArrowRightLeft className="size-3" />
  },
  'COMPLETED': {
    label: 'Completada',
    color: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
    icon: <Check className="size-3" />
  },
  'CANCELLED': {
    label: 'Cancelada',
    color: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
    icon: <Clock className="size-3" />
  },
};

const bodegas = ['Bodega Central', 'Bodega Norte', 'Bodega Sur', 'Bodega Este'];

export function TransferenciasPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [isNewTransferOpen, setIsNewTransferOpen] = useState(false);
  const [transfersArr, setTransfersArr] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransfers();
  }, []);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const res = await transfersService.getAll() as PaginatedResponse<Transfer>;
      setTransfersArr(res.data || []);
    } catch (error) {
      console.error('Error fetching transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = transfersArr.filter(transfer => {
    const matchesSearch =
      transfer.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (transfer as any).fromId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (transfer as any).toId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || transfer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    pendientes: transfersArr.filter(t => t.status === 'PENDING').length,
    enTransito: transfersArr.filter(t => t.status === 'IN_TRANSIT').length,
    completadas: transfersArr.filter(t => t.status === 'COMPLETED').length,
    totalUnidades: transfersArr.reduce((sum, t) => sum + (t.items?.reduce((s, i) => s + Number(i.quantity), 0) || 0), 0),
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transferencias entre Bodegas</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona movimientos de inventario entre ubicaciones
          </p>
        </div>
        <Dialog open={isNewTransferOpen} onOpenChange={setIsNewTransferOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Nueva Transferencia
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nueva Transferencia</DialogTitle>
              <DialogDescription>
                Crea una nueva transferencia de inventario entre bodegas
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="origen">Bodega Origen</Label>
                  <Select>
                    <SelectTrigger id="origen">
                      <SelectValue placeholder="Selecciona origen" />
                    </SelectTrigger>
                    <SelectContent>
                      {bodegas.map(bodega => (
                        <SelectItem key={bodega} value={bodega}>{bodega}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="destino">Bodega Destino</Label>
                  <Select>
                    <SelectTrigger id="destino">
                      <SelectValue placeholder="Selecciona destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {bodegas.map(bodega => (
                        <SelectItem key={bodega} value={bodega}>{bodega}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fecha">Fecha de Transferencia</Label>
                <Input id="fecha" type="date" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="responsable">Responsable</Label>
                <Input id="responsable" placeholder="Nombre del responsable" />
              </div>
              <div className="grid gap-2">
                <Label>Productos a Transferir</Label>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Selecciona los productos y cantidades a transferir
                  </p>
                  <Button variant="outline" size="sm">
                    <Plus className="mr-2 size-4" />
                    Agregar Producto
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notas">Notas Adicionales</Label>
                <Input id="notas" placeholder="Información adicional sobre la transferencia..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewTransferOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setIsNewTransferOpen(false)}>
                Crear Transferencia
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="size-4" />
              Transferencias Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">{stats.pendientes}</div>
            <p className="text-xs text-muted-foreground mt-1">Por iniciar</p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowRightLeft className="size-4" />
              En Tránsito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{stats.enTransito}</div>
            <p className="text-xs text-muted-foreground mt-1">En proceso</p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Check className="size-4" />
              Completadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{stats.completadas}</div>
            <p className="text-xs text-muted-foreground mt-1">Este mes</p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="size-4" />
              Total Unidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">
              {stats.totalUnidades.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Transferidas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID, bodega origen o destino..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <Filter className="mr-2 size-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="en-transito">En Tránsito</SelectItem>
            <SelectItem value="completada">Completada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transfers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Transferencias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Transferencia</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-center">Cantidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((transfer) => {
                  const config = statusConfig[transfer.status] || statusConfig['PENDING'];
                  const totalQty = transfer.items?.reduce((s, i) => s + Number(i.quantity), 0) || 0;
                  return (
                    <TableRow key={transfer.id} className="hover:bg-muted/20">
                      <TableCell className="font-medium">{transfer.number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{(transfer as any).fromId || 'Origen'}</span>
                          <ArrowRight className="size-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-primary">{(transfer as any).toId || 'Destino'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(transfer.date).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {transfer.items?.length || 0}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {totalQty}
                      </TableCell>
                      <TableCell>
                        <Badge
                           variant="secondary"
                           className={`${config.color} flex items-center gap-1 w-fit`}
                        >
                          {config.icon}
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {transfer.number || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      {/* Quick Stats Pivot */}
      <div className="grid gap-6 md:grid-cols-2 mt-4">
        {/* Actividad por Bodega - Glassmorphism Card */}
        <Card className="bg-card/50 backdrop-blur-sm shadow-sm border-border/50 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 size-40 bg-blue-500/10 rounded-full blur-2xl opacity-50 group-hover:scale-150 transition-transform duration-700 pointer-events-none" />
          <CardHeader className="pb-3 border-b border-border/40 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <ArrowRightLeft className="size-5 text-blue-500" />
              </div>
              <CardTitle className="text-base font-semibold">Actividad por Bodega</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 relative z-10">
            <div className="space-y-4">
              {bodegas.map((bodega, index) => {
                const salidas = transfersArr.filter(t => (t as any).fromId === bodega).length;
                const entradas = transfersArr.filter(t => (t as any).toId === bodega).length;
                return (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors">
                    <span className="font-semibold text-sm mb-2 sm:mb-0">{bodega}</span>
                    <div className="flex items-center gap-4 text-sm font-medium">
                      <div className="flex items-center gap-1.5 bg-red-500/10 text-red-500 px-2 py-1 rounded-md border border-red-500/20">
                        <TrendingUp className="size-3.5" />
                        <span>{salidas} salidas</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-green-500/10 text-green-500 px-2 py-1 rounded-md border border-green-500/20">
                        <TrendingDown className="size-3.5" />
                        <span>{entradas} entradas</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Resumen del Mes - Premium Dark Card */}
        <Card className="bg-gradient-to-br from-[#05602b]/90 to-[#033b1a] text-white shadow-lg shadow-[#05602b]/20 border-transparent relative overflow-hidden group">
          <div className="absolute -left-10 -bottom-10 size-40 bg-white/10 rounded-full blur-2xl opacity-50 group-hover:scale-150 transition-transform duration-700 pointer-events-none" />
          <CardHeader className="pb-3 border-b border-white/10 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg border border-white/20 backdrop-blur-md">
                <FileSpreadsheet className="size-5 text-white" />
              </div>
              <CardTitle className="text-base font-semibold text-white/90">Resumen del Mes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 relative z-10">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-sm font-medium text-white/70">Total Transferencias</span>
                  <p className="text-3xl font-bold tracking-tight text-white">{transfersArr.length}</p>
                </div>
                <div className="p-3 bg-white/10 rounded-full backdrop-blur-sm">
                  <Package className="size-6 text-white/80" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-black/20 border border-white/10 backdrop-blur-sm">
                  <span className="text-xs font-medium text-white/60 uppercase tracking-wider">Tasa de Éxito</span>
                  <div className="flex items-end gap-2 mt-1">
                    <span className="text-2xl font-bold text-green-400">
                      {transfersArr.length > 0 ? Math.round((stats.completadas / transfersArr.length) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-black/20 border border-white/10 backdrop-blur-sm">
                  <span className="text-xs font-medium text-white/60 uppercase tracking-wider">T. Promedio</span>
                  <div className="flex items-end gap-2 mt-1">
                    <span className="text-2xl font-bold text-blue-300">2.5 d</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
