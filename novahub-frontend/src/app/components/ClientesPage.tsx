import React, { useState, useEffect } from 'react';
import { UserCircle, Plus, Search, Eye, Edit, Trash2, Mail, Phone, MapPin, Download, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

import { customersService } from '../services/ventas.service';
import type { Customer } from '../types';

export function ClientesPage() {
  const [clientesData, setClientesData] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    type: 'company',
    contactName: '',
    email: '',
    phone: '',
    status: 'active'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await customersService.getAll();
      setClientesData(res.data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = clientesData.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.contactName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDialog = (cliente: Customer | null = null) => {
    if (cliente) {
      setEditingCliente(cliente);
      setFormData({
        name: cliente.name,
        type: cliente.type,
        contactName: cliente.contactName,
        email: cliente.email,
        phone: cliente.phone,
        status: cliente.status
      });
    } else {
      setEditingCliente(null);
      setFormData({ name: '', type: 'company', contactName: '', email: '', phone: '', status: 'active' });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingCliente) {
        await customersService.update(editingCliente.id, formData);
      } else {
        await customersService.create(formData);
      }
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving customer:', error);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-lg">
            <UserCircle className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Directorio de Clientes</h1>
            <p className="text-sm text-muted-foreground">Gestiona la información y líneas de crédito de tus clientes</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2"><Download className="size-4" /> Exportar</Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => handleOpenDialog()}>
                <Plus className="size-4" /> Nuevo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
                <DialogDescription>
                  {editingCliente ? 'Modifica los datos del cliente aquí.' : 'Ingresa los datos del nuevo cliente.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="nombre">Nombre de la Empresa / Persona</Label>
                  <Input id="nombre" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Tipo</Label>
                  <Select value={formData.type?.toUpperCase() || 'COMPANY'} onValueChange={v => setFormData({ ...formData, type: v as any })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona el tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMPANY">Empresa</SelectItem>
                      <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contacto">Nombre del Contacto</Label>
                  <Input id="contacto" value={formData.contactName || ''} onChange={e => setFormData({ ...formData, contactName: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input id="telefono" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Estado</Label>
                  <Select value={formData.status?.toUpperCase() || 'ACTIVE'} onValueChange={v => setFormData({ ...formData, status: v as any })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona el estado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Activo</SelectItem>
                      <SelectItem value="INACTIVE">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave}>Guardar Cambios</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Clientes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-400">{clientesData.length}</div></CardContent></Card>
        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Clientes Activos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-400">{clientesData.filter(c => (c.status || '').toUpperCase() === 'ACTIVE').length}</div></CardContent></Card>
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Nuevos este Mes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-purple-400">{clientesData.filter(c => c.createdAt && new Date(c.createdAt).getMonth() === new Date().getMonth()).length}</div></CardContent></Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, contacto o email..." className="pl-9 w-full bg-background" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Button variant="outline" className="gap-2 sm:w-auto w-full"><Filter className="size-4" /> Filtros Avanzados</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Directorio de Clientes</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Contacto</TableHead><TableHead>Rendimiento</TableHead><TableHead>Línea de Crédito</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.map(c => {
                  const limite = c.creditLimit || 0;
                  const usado = (c as any).balance || 0;
                  const percent = limite > 0 ? Math.min(Math.round((usado / limite) * 100), 100) : 0;
                  const isHigh = percent > 80;
                  return (
                    <TableRow key={c.id} className="hover:bg-muted/20">
                      <TableCell>
                        <div className="flex flex-col">
                           <span className="font-semibold text-foreground">{c.name}</span>
                          <span className="text-xs text-muted-foreground">{c.code || c.id} • {(c.type || '').toUpperCase() === 'COMPANY' ? 'Empresa' : 'Individual'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm flex items-center gap-1.5"><UserCircle className="size-3.5 text-muted-foreground" />{c.contactName || 'N/A'}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="size-3.5" />{c.email || 'N/A'}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="size-3.5" />{c.phone || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-green-500">${(c as any).totalSales?.toLocaleString() || '0.00'}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Monto Histórico</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-48 space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Usado: ${usado.toLocaleString()}</span>
                            <span className="font-medium text-foreground">Max: ${limite.toLocaleString()}</span>
                          </div>
                          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                            <div className={`h-full ${isHigh ? 'bg-red-500' : 'bg-primary'} transition-all`} style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={(c.status || '').toUpperCase() === 'ACTIVE' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}>
                          {(c.status || '').toUpperCase() === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => handleOpenDialog(c)}><Edit className="size-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
