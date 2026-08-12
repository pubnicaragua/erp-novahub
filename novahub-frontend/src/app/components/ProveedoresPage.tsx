import { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Search, Edit, Star, Download, Filter, Phone, Mail, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

import { suppliersService } from '../services/compras.service';
import type { Supplier, EntityStatus } from '../types';
import { useCurrency } from '../contexts/CurrencyContext';
import { useAuth } from '../contexts/AuthContext';
import { CurrencyValuationBanner } from './ui/CurrencyValuation';
import { toast } from 'sonner';

export function ProveedoresPage() {
  const { canPerform } = useAuth();
  const { formatConvertedAmount } = useCurrency();
  const [proveedoresData, setProveedoresData] = useState<Supplier[]>([]);
  const [, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '',
    type: 'COMPANY' as 'COMPANY' | 'INDIVIDUAL',
    ruc: '',
    email: '',
    phone: '',
    contactName: '',
    status: 'active' as EntityStatus,
  });

  const fetchProveedores = useCallback(async () => {
    try {
      setLoading(true);
      const res = await suppliersService.getAll();
      setProveedoresData(res.data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(fetchProveedores, 0);
    return () => window.clearTimeout(timer);
  }, [fetchProveedores]);

  const filtered = proveedoresData.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.contactName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDialog = (proveedor: Supplier | null = null) => {
    if (proveedor) {
      setEditingProveedor(proveedor);
      setFormData({
        name: proveedor.name,
        type: String(proveedor.type || 'COMPANY').toUpperCase() === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'COMPANY',
        ruc: proveedor.ruc || '',
        email: proveedor.email,
        phone: proveedor.phone,
        contactName: proveedor.contactName,
        status: proveedor.status
      });
    } else {
      setEditingProveedor(null);
      setFormData({ name: '', type: 'COMPANY' as 'COMPANY' | 'INDIVIDUAL', ruc: '', email: '', phone: '', contactName: '', status: 'ACTIVE' as EntityStatus });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    const isCompany = String(formData.type || 'COMPANY').toUpperCase() === 'COMPANY';
    if (!formData.name?.trim()) {
      toast.error('El nombre del proveedor es obligatorio');
      return;
    }
    if (isCompany && !formData.ruc?.trim()) {
      toast.error('El RUC es obligatorio para un proveedor empresa');
      return;
    }
    try {
      if (editingProveedor) {
        await suppliersService.update(editingProveedor.id, formData);
      } else {
        await suppliersService.create(formData);
      }
      fetchProveedores();
      setIsDialogOpen(false);
      toast.success(editingProveedor ? 'Proveedor actualizado' : 'Proveedor creado');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al guardar el proveedor');
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <CurrencyValuationBanner />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-lg">
            <Truck className="size-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Directorio de Proveedores</h1>
            <p className="text-sm text-muted-foreground">Gestiona tus socios comerciales y calificación de cadena de suministro</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2"><Download className="size-4" /> Exportar</Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            {canPerform('PURCHASES_PROVIDERS', 'create') && (
              <DialogTrigger asChild>
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleOpenDialog()}>
                  <Plus className="size-4" /> Nuevo Proveedor
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
                <DialogDescription>
                  {editingProveedor ? 'Actualiza los datos del proveedor o fabricante de la cadena de suministro.' : 'Registra un nuevo proveedor o socio logístico.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="nombre">Nombre {formData.type === 'COMPANY' ? 'de la Empresa' : 'del Proveedor'}</Label>
                  <Input id="nombre" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Tipo</Label>
                    <Select value={formData.type as string || 'COMPANY'} onValueChange={(v: any) => setFormData({ ...formData, type: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecciona el tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="COMPANY">Empresa</SelectItem>
                        <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ruc">RUC {formData.type === 'COMPANY' && <span className="text-destructive">*</span>}</Label>
                    <Input id="ruc" value={formData.ruc || ''} onChange={e => setFormData({ ...formData, ruc: e.target.value })} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contacto">Nombre del Contacto Principal</Label>
                  <Input id="contacto" value={formData.contactName || ''} onChange={e => setFormData({ ...formData, contactName: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Correo Institucional</Label>
                  <Input id="email" type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input id="telefono" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Estado</Label>
                  <Select value={formData.status} onValueChange={(v: EntityStatus) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona el estado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Activo</SelectItem>
                      <SelectItem value="INACTIVE">Inactivo</SelectItem>
                      <SelectItem value="ARCHIVED">Archivado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">Guardar Detalles</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Proveedores</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-400">{proveedoresData.length}</div></CardContent></Card>
        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Activos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-400">{proveedoresData.filter(p => p.status === 'ACTIVE').length}</div></CardContent></Card>
        <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Calificacion Promedio</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-orange-400 flex items-center gap-1"><Star className="size-5 fill-orange-400" />{(proveedoresData.reduce((acc, p) => acc + (p.rating || 0), 0) / (proveedoresData.length || 1)).toFixed(1)}</div></CardContent></Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, contacto o categoría..." className="pl-9 w-full bg-background" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Button variant="outline" className="gap-2 sm:w-auto w-full"><Filter className="size-4" /> Filtros Avanzados</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Directorio de Proveedores</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="w-[200px]">Contacto</TableHead>
                  <TableHead className="text-center w-[150px]">Calificación</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => {
                  const stars = p.rating || 0;
                  return (
                    <TableRow key={p.id} className="hover:bg-muted/20">
                      <TableCell>
                        <div className="flex gap-3 items-center">
                          <div className="hidden sm:flex size-10 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500">
                            <Building2 className="size-5" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground text-sm flex items-center gap-2">{p.name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground font-mono">{p.code || p.id}</span>
                              <Badge variant="outline" className="text-[10px] font-normal tracking-wide h-4 py-0 px-1.5">Proveedor</Badge>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-sm font-medium flex items-center gap-2 hover:text-primary cursor-pointer transition-colors"><Mail className="size-3.5 text-muted-foreground" /> {p.email}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-2"><Phone className="size-3.5" /> {p.phone}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(star => (
                              <Star key={star} className={`size-3.5 ${star <= Math.round(stars) ? 'fill-orange-400 text-orange-400' : 'fill-muted text-muted-foreground/30'}`} />
                            ))}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-medium">{stars.toFixed(1)} / 5.0</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-bold text-foreground">{formatConvertedAmount(Number(p.balance || 0), 'NIO')}</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance Actual</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className={`capitalize ${p.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20'}`}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canPerform('PURCHASES_PROVIDERS', 'edit') && (
                            <Button variant="ghost" size="icon" className="size-8 hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => handleOpenDialog(p)}><Edit className="size-4" /></Button>
                          )}
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
