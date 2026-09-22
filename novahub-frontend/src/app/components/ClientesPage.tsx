import { useState, useEffect } from 'react';
import { UserCircle, Plus, Search, Edit, Mail, Phone, Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from '@/app/services/toast';

import { customersService } from '../services/ventas.service';
import type { Customer } from '../types';
import { useCurrency } from '../contexts/CurrencyContext';
import { useAuth } from '../contexts/AuthContext';
import { CurrencyValuationBanner } from './ui/CurrencyValuation';
import { getApiErrorMessage } from '../services/api';
import { normalizeCurrency } from '../utils/currency';
import { CustomerCountrySelect, CustomerIdentifierInput, CustomerPhoneInput, useCustomerFormOptions, countryNameForForm } from './ventas/CustomerContactFields';
import { countryCodeFromLegacy, customerRucRequired, formatCustomerPhoneForDisplay, isCustomerIdentifierValid, isCustomerPhoneValid } from '../utils/customer-data';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { generateConfiguredReportSectionsPDF } from '../utils/pdfGenerator';
import { buildDatedDownloadFileName } from '../utils/exportFileNames';

export function ClientesPage() {
  const { user, canPerform } = useAuth();
  const { countries, defaultCountryCode } = useCustomerFormOptions();
  const { baseCurrency, exchangeRate, formatConvertedAmount } = useCurrency();
  const [clientesData, setClientesData] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Customer | null>(null);
  const [, setLoading] = useState(true);

  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    type: 'company',
    contactName: '',
    email: '',
    phone: '',
    contactPhone: '',
    taxId: '',
    countryCode: 'NI',
    country: 'Nicaragua',
    status: 'active'
  });

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  }, []);

  const fetchData = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const res = await customersService.getAll(undefined, signal);
      setClientesData(res.data || []);
    } catch (error) {
      if (signal?.aborted) return;
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

  const exportCustomers = async (format: 'pdf' | 'xlsx') => {
    if (!canPerform('SALES_CLIENTS', 'export')) return;
    const exportResponse = await customersService.getAll({
      search: searchTerm.trim() || undefined,
      page: 1,
      pageSize: 5000,
      report: true,
      export: true,
    });
    const exportCustomersRows = Array.isArray(exportResponse?.data) ? exportResponse.data : filtered;
    const rows = exportCustomersRows.map((customer) => ({
      Código: customer.code || customer.id?.slice(0, 8) || '—',
      Cliente: customer.name || '—',
      Contacto: customer.contactName || '—',
      Correo: customer.email || '—',
      Teléfono: customer.phone || '—',
      Estado: String(customer.status || '').toUpperCase() === 'INACTIVE' ? 'Inactivo' : 'Activo',
    }));
    if (!rows.length) { toast.error('No hay clientes para exportar con los filtros actuales.'); return; }
    try {
      if (format === 'xlsx') {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Clientes');
        XLSX.writeFile(workbook, buildDatedDownloadFileName(['reporte_clientes'], 'xlsx'));
      } else {
        await generateConfiguredReportSectionsPDF({
          targetKey: 'ventas.customers', title: 'Listado de clientes', tenantName: user?.tenantName || 'Mi Empresa', tenantLogo: user?.sessionBranding?.logo || '',
          periodLabel: `Registros filtrados: ${rows.length}`,
          sections: [{ id: 'sales-customers', title: 'Clientes', headers: Object.keys(rows[0]), rows: rows.map((row) => Object.values(row)) }],
          fileName: buildDatedDownloadFileName(['reporte_clientes'], 'pdf'),
        });
      }
      toast.success(`Reporte de clientes exportado en ${format === 'xlsx' ? 'Excel' : 'PDF'}.`);
    } catch (error: any) { toast.error(error?.message || 'No se pudo exportar el reporte de clientes.'); }
  };

  const handleOpenDialog = (cliente: Customer | null = null) => {
    if (cliente) {
      setEditingCliente(cliente);
      setFormData({
        name: cliente.name,
        type: String(cliente.type || 'company').toLowerCase() as Customer['type'],
        ruc: cliente.ruc || '',
        taxId: cliente.taxId || '',
        countryCode: cliente.countryCode || 'NI',
        country: cliente.country || countryNameForForm(cliente.countryCode || 'NI', countries),
        dv: cliente.dv || '',
        razonSocial: cliente.razonSocial || '',
        contactName: cliente.contactName,
        contactPhone: cliente.contactPhone || '',
        email: cliente.email,
        phone: cliente.phone,
        status: cliente.status
      });
    } else {
      setEditingCliente(null);
      setFormData({ name: '', type: 'company', ruc: '', taxId: '', dv: '', razonSocial: '', contactName: '', email: '', phone: '', contactPhone: '', countryCode: defaultCountryCode, country: countryNameForForm(defaultCountryCode, countries), status: 'active' });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    const countryCode = String(formData.countryCode || defaultCountryCode);
    if (!formData.name?.trim()) {
      toast.error('El nombre del cliente es obligatorio');
      return;
    }
    if (customerRucRequired(formData.type, countryCode) && !formData.ruc?.trim()) {
      toast.error('El RUC es obligatorio para una empresa');
      return;
    }
    if (formData.taxId && !isCustomerIdentifierValid(formData.taxId, 'taxId', countryCode)) { toast.error('La identificación fiscal no tiene un formato válido para el país seleccionado'); return; }
    if (formData.ruc && !isCustomerIdentifierValid(formData.ruc, 'ruc', countryCode)) { toast.error('El RUC no tiene un formato válido para el país seleccionado'); return; }
    if (formData.phone && !isCustomerPhoneValid(formData.phone, countryCode)) { toast.error('El teléfono no es válido para el país seleccionado'); return; }
    if (formData.contactPhone && !isCustomerPhoneValid(formData.contactPhone, countryCode)) { toast.error('El teléfono del contacto no es válido para el país seleccionado'); return; }
    try {
      if (editingCliente) {
        await customersService.update(editingCliente.id, formData);
      } else {
        await customersService.create(formData);
      }
      setIsDialogOpen(false);
      toast.success(editingCliente ? 'Cliente actualizado' : 'Cliente creado');
      fetchData();
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, 'Error al guardar el cliente'));
    }
  };

  return (
    <div className="space-y-6 bg-background p-4 md:px-6 md:pb-6 md:pt-4">
      <CurrencyValuationBanner />
      <div className="flex min-w-0 justify-end">
        <div className="flex flex-wrap items-center gap-2">
          {canPerform('SALES_CLIENTS', 'export') && <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" className="gap-2"><Download className="size-4" /> Exportar <ChevronDown className="size-3.5" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem className="gap-2 text-xs" onClick={() => void exportCustomers('pdf')}><FileText className="size-3.5 text-rose-600" /> Exportar PDF</DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-xs" onClick={() => void exportCustomers('xlsx')}><FileSpreadsheet className="size-3.5 text-emerald-600" /> Exportar Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            {canPerform('SALES_CLIENTS', 'create') && (
              <DialogTrigger asChild>
                <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => handleOpenDialog()} data-testid="customers-new">
                  <Plus className="size-4" /> Nuevo cliente
                </Button>
              </DialogTrigger>
            )}
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
                  <Input id="nombre" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} data-testid="customer-name" />
                </div>
                <div className="grid gap-2">
                  <Label>Tipo</Label>
                  <Select value={formData.type?.toUpperCase() || 'COMPANY'} onValueChange={v => setFormData({ ...formData, type: v.toLowerCase() as any })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona el tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMPANY">Empresa</SelectItem>
                      <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.type === 'company' && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="razonSocial">Razón Social</Label>
                      <Input id="razonSocial" value={formData.razonSocial || ''} onChange={e => setFormData({ ...formData, razonSocial: e.target.value })} />
                    </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <CustomerIdentifierInput id="ruc" value={formData.ruc || ''} onChange={(value) => setFormData({ ...formData, ruc: value })} countryCode={String(formData.countryCode || defaultCountryCode)} kind="ruc" required={customerRucRequired(formData.type, formData.countryCode || defaultCountryCode)} className="h-11 rounded-xl" />
                      <div className="grid gap-2">
                        <Label htmlFor="dv">DV</Label>
                        <Input id="dv" value={formData.dv || ''} onChange={e => setFormData({ ...formData, dv: e.target.value })} />
                      </div>
                    </div>
                  </>
                )}
                {formData.type !== 'company' && <CustomerIdentifierInput id="taxId" value={formData.taxId || ''} onChange={(value) => setFormData({ ...formData, taxId: value })} countryCode={String(formData.countryCode || defaultCountryCode)} kind="taxId" className="h-11 rounded-xl" />}
                <div className="grid gap-2">
                  <Label htmlFor="contacto">Nombre del Contacto</Label>
                  <Input id="contacto" value={formData.contactName || ''} onChange={e => setFormData({ ...formData, contactName: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} data-testid="customer-email" />
                </div>
                <CustomerPhoneInput id="telefono" value={formData.phone || ''} onChange={(value) => setFormData({ ...formData, phone: value })} countryCode={String(formData.countryCode || defaultCountryCode)} />
                <CustomerPhoneInput id="telefono-contacto" label="Teléfono del contacto" value={formData.contactPhone || ''} onChange={(value) => setFormData({ ...formData, contactPhone: value })} countryCode={String(formData.countryCode || defaultCountryCode)} />
                <CustomerCountrySelect id="country" value={String(formData.countryCode || defaultCountryCode)} countries={countries} onChange={(value) => setFormData({ ...formData, countryCode: value, country: countryNameForForm(value, countries) })} disabled={false} />
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
                <Button onClick={handleSave} data-testid="customer-save">Guardar Cambios</Button>
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
      </div>

      <Card>
        <CardHeader><CardTitle>Directorio de clientes</CardTitle></CardHeader>
        <CardContent>
          <Table
            containerClassName="max-h-[min(62vh,42rem)] overflow-auto rounded-xl border border-border/50 scrollbar-overlay"
            data-testid="customers-table"
          >
              <TableHeader className="sticky top-0 z-20 bg-card shadow-sm" style={{ backgroundColor: 'var(--card)' }}>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Rendimiento</TableHead>
                  <TableHead>Línea de Crédito</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => {
                  const limite = c.creditLimit || 0;
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
                          <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground"><Phone className="size-3.5" />{c.phone ? formatCustomerPhoneForDisplay(c.phone, c.countryCode || countryCodeFromLegacy(c.country) || 'NI') : 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-green-500">{formatConvertedAmount(Number((c as any).totalSales || 0), 'NIO')}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Monto Histórico</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-48 space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Límite configurado</span>
                          <span className="font-medium text-foreground">{formatConvertedAmount(limite, normalizeCurrency(c.creditLimitCurrency, baseCurrency), exchangeRate)}</span>
                          </div>
                          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-primary transition-all" style={{ width: limite > 0 ? '100%' : '0%' }} />
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
                          {canPerform('SALES_CLIENTS', 'edit') && (
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => handleOpenDialog(c)}><Edit className="size-4" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
