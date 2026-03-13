import React, { useState, useEffect } from 'react';
import { Headphones, Plus, Search, MessageSquare, Clock, CheckCircle, AlertTriangle, XCircle, Eye, Edit, Trash2, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { supportService } from '../services/support.service';
import { usersService } from '../services/users.service';
import { toast } from 'sonner';
import type { Ticket, TicketStatus, Priority, PaginatedResponse, User as UserType } from '../types';

const statusColors: Record<string, string> = {
  'OPEN': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  'IN_PROGRESS': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'RESOLVED': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'CLOSED': 'bg-slate-500/10 text-slate-500 border-slate-500/20',
};

const statusLabels: Record<string, string> = {
  'OPEN': 'Abierto',
  'IN_PROGRESS': 'En Progreso',
  'RESOLVED': 'Resuelto',
  'CLOSED': 'Cerrado',
};

const priorityLabels: Record<string, string> = {
  'LOW': 'Baja',
  'MEDIUM': 'Media',
  'HIGH': 'Alta',
  'URGENT': 'Urgente',
};

const priorityColors: Record<string, string> = {
  'URGENT': 'bg-red-500 text-white shadow-lg shadow-red-500/20',
  'HIGH': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  'MEDIUM': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  'LOW': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

export function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<Partial<Ticket>>({
    subject: '',
    description: '',
    status: 'OPEN',
    priority: 'MEDIUM',
    assignedToId: ''
  });

  useEffect(() => {
    fetchTickets();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await usersService.getAll();
      setUsers(res.data || []);
    } catch (e) { console.error('Error fetching users', e); }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await supportService.getAll() as PaginatedResponse<Ticket>;
      setTickets(res.data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Error al cargar tickets');
    } finally {
      setLoading(false);
    }
  };

  const filtered = tickets.filter(t => 
    t.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDialog = (ticket: Ticket | null = null) => {
    if (ticket) {
      setEditingTicket(ticket);
      setFormData({
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        assignedToId: ticket.assignedToId || ''
      });
    } else {
      setEditingTicket(null);
      setFormData({ 
        subject: '', 
        description: '', 
        status: 'OPEN', 
        priority: 'MEDIUM',
        assignedToId: ''
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.subject || !formData.description) {
      toast.error('Asunto y descripción son requeridos');
      return;
    }
    try {
      if (editingTicket) {
        await supportService.update(editingTicket.id, formData);
        toast.success('Ticket actualizado correctamente');
      } else {
        await supportService.create(formData);
        toast.success('Ticket creado exitosamente');
      }
      setIsDialogOpen(false);
      fetchTickets();
    } catch (error) {
      console.error('Error saving ticket:', error);
      toast.error('Error al guardar el ticket');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este ticket?')) {
      try {
        await supportService.delete(id);
        toast.success('Ticket eliminado');
        fetchTickets();
      } catch (error) {
        console.error('Error deleting ticket:', error);
        toast.error('Error al eliminar');
      }
    }
  };

  if (loading && tickets.length === 0) {
      return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando tickets de soporte...</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Headphones className="size-6 text-primary" /> Tickets y Soporte
          </h1>
          <p className="text-sm text-muted-foreground">Sistema centralizado para solicitudes de asistencia y soporte interno.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="shadow-lg shadow-primary/20">
              <Plus className="mr-2 size-4" /> Nuevo Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingTicket ? `Editar Ticket ${editingTicket.number}` : 'Abrir Nuevo Ticket'}</DialogTitle>
              <DialogDescription>
                {editingTicket ? 'Actualiza el estado o asignación de este ticket.' : 'Proporciona los detalles del problema o solicitud.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Asunto</Label>
                <Input value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} placeholder="Ej. Acceso denegado al módulo de ventas" />
              </div>
              <div className="grid gap-2">
                <Label>Descripción Detallada</Label>
                <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Describe el problema con claridad..." className="min-h-[100px]" />
              </div>
              <div className="grid gap-2">
                <Label>Responsable / Analista</Label>
                <Select value={formData.assignedToId} onValueChange={v => setFormData({ ...formData, assignedToId: v })}>
                  <SelectTrigger><SelectValue placeholder="Asignar a..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin asignar</SelectItem>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Prioridad</Label>
                  <Select value={formData.priority} onValueChange={v => setFormData({ ...formData, priority: v as Priority })}>
                    <SelectTrigger><SelectValue placeholder="Prioridad" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Baja</SelectItem>
                      <SelectItem value="MEDIUM">Media</SelectItem>
                      <SelectItem value="HIGH">Alta</SelectItem>
                      <SelectItem value="URGENT">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Estado</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v as TicketStatus })}>
                    <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Abierto</SelectItem>
                      <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
                      <SelectItem value="RESOLVED">Resuelto</SelectItem>
                      <SelectItem value="CLOSED">Cerrado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Guardar Ticket</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-transparent">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><AlertTriangle className="size-4 text-yellow-500" />Abiertos</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-yellow-500">{tickets.filter(t => t.status === 'OPEN').length}</div></CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Clock className="size-4 text-blue-500" />En Proceso</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-blue-500">{tickets.filter(t => t.status === 'IN_PROGRESS').length}</div></CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><CheckCircle className="size-4 text-emerald-500" />Resueltos</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-emerald-500">{tickets.filter(t => t.status === 'RESOLVED').length}</div></CardContent>
        </Card>
        <Card className="border-slate-500/20 bg-gradient-to-br from-slate-500/5 to-transparent">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><XCircle className="size-4 text-slate-500" />Cerrados</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-slate-400">{tickets.filter(t => t.status === 'CLOSED').length}</div></CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por título o número..." className="pl-9 bg-muted/30 border-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-base">Listado Maestro de Tickets</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="w-[100px]">Número</TableHead>
                  <TableHead>Contenido</TableHead>
                  <TableHead>Analista</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No se encontraron tickets.</TableCell></TableRow>
                ) : (
                  filtered.map(t => (
                    <TableRow key={t.id} className="hover:bg-muted/10 group">
                      <TableCell className="font-mono text-xs font-bold text-primary">{t.number}</TableCell>
                      <TableCell className="max-w-[300px]">
                        <div className="font-semibold group-hover:text-primary transition-colors">{t.subject}</div>
                        <div className="text-xs text-muted-foreground truncate">{t.description}</div>
                      </TableCell>
                      <TableCell>
                          <div className="flex items-center gap-2">
                              <div className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                                  {t.assignedToId ? 'JD' : <User className="size-3 text-muted-foreground" />}
                              </div>
                              <span className="text-xs truncate">{t.assignedToId ? 'Analista Asignado' : 'Sin asignar'}</span>
                          </div>
                      </TableCell>
                      <TableCell>
                          <Badge variant="outline" className={`text-[10px] font-bold ${priorityColors[t.priority] || ''}`}>
                            {priorityLabels[t.priority] || t.priority}
                          </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(t.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                      </TableCell>
                      <TableCell>
                          <Badge variant="secondary" className={`text-[10px] font-bold tracking-tight ${statusColors[t.status]}`}>
                            {statusLabels[t.status] || t.status}
                          </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => handleOpenDialog(t)}>
                              <Edit className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 rounded-full text-red-500 hover:bg-red-500/10" onClick={() => handleDelete(t.id)}>
                              <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
