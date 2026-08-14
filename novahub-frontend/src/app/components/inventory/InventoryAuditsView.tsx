import { useMemo, useState } from 'react';
import {
  ClipboardCheck, Plus, Trash2, Eye, Paperclip, Upload, UserCheck, Warehouse as WarehouseIcon, X,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../ui/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventario.service';
import { storageService } from '../../services/storage.service';
import { usersService } from '../../services/users.service';
import { useQuery } from '@tanstack/react-query';
import type { SalesPaginationControls } from '../../types';
import { InventoryViewTutorial } from './InventoryViewTutorial';

interface InventoryAuditsViewProps {
  audits: any[];
  warehouses: any[];
  products: any[];
  onRefresh: () => void;
  pagination?: SalesPaginationControls;
}

interface AuditItemDraft {
  key: string;
  productId: string;
  code: string;
  name: string;
  systemStock: number;
  countedStock: number;
  difference: number;
}

function toLocalDateTime(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

const ACCEPTED_ACTA = '.pdf,.xlsx,.xls,.png,.jpg,.jpeg,.webp';

export function InventoryAuditsView({ audits, warehouses, products, onRefresh, pagination }: InventoryAuditsViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [detailAudit, setDetailAudit] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    auditDate: toLocalDateTime(new Date()),
    warehouseId: '',
    supervisorId: '',
    supervisorName: '',
    stockKeeperId: '',
    stockKeeperName: '',
    notes: '',
  });
  const [actaFile, setActaFile] = useState<File | null>(null);
  const [items, setItems] = useState<AuditItemDraft[]>([]);

  const usersQuery = useQuery({
    queryKey: ['tenant-users', 'audits'],
    queryFn: () => usersService.getAll(),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });
  const tenantUsers = useMemo(() => {
    const list = usersQuery.data || [];
    return list
      .filter((u: any) => u?.isActive !== false)
      .map((u: any) => ({ id: u.id, name: u.name || u.email || 'Usuario' }))
      .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
  }, [usersQuery.data]);

  const productOptions = useMemo(() => {
    return products
      .filter((p: any) => String(p.itemType || p.type || 'PRODUCT').toUpperCase() !== 'SERVICE')
      .map((p: any) => ({ id: p.id, code: p.code, name: p.name, stock: Number(p.stock || 0) }));
  }, [products]);

  const totalContado = items.reduce((acc, item) => acc + (Number.isFinite(item.countedStock) ? item.countedStock : 0), 0);
  const totalDiferencia = items.reduce((acc, item) => acc + (Number.isFinite(item.difference) ? item.difference : 0), 0);
  const itemsWithProduct = items.filter((item) => item.productId);
  const canSave = Boolean(form.auditDate) && (form.supervisorName.trim() !== '' || form.supervisorId) && itemsWithProduct.length > 0;

  const updateForm = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  const handleUserSelect = (field: 'supervisorId' | 'stockKeeperId', value: string) => {
    const user = tenantUsers.find((u) => u.id === value);
    const nameField = field === 'supervisorId' ? 'supervisorName' : 'stockKeeperName';
    updateForm({ [field]: value, [nameField]: user?.name || '' } as any);
  };

  const addItem = () => {
    if (items.length >= 50) { toast.error('Máximo 50 productos por acta'); return; }
    setItems((current) => [...current, {
      key: `item-${Date.now()}-${current.length}`,
      productId: '',
      code: '',
      name: '',
      systemStock: 0,
      countedStock: 0,
    }]);
  };

  const removeItem = (key: string) => {
    setItems((current) => current.filter((item) => item.key !== key));
  };

  const selectProduct = (key: string, productId: string) => {
    const product = productOptions.find((p) => p.id === productId);
    setItems((current) => current.map((item) => item.key === key ? {
      ...item,
      productId,
      code: product?.code || '',
      name: product?.name || '',
      systemStock: product?.stock || 0,
      countedStock: product?.stock || 0,
    } : item));
  };

  const updateCounted = (key: string, value: number) => {
    setItems((current) => current.map((item) => item.key === key ? {
      ...item,
      countedStock: value,
      difference: value - item.systemStock,
    } : item));
  };

  const openActa = async (uri?: string | null) => {
    if (!uri) return;
    try {
      const url = await storageService.resolveUrl(uri);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo abrir el acta');
    }
  };

  const resetForm = () => {
    setForm({
      auditDate: toLocalDateTime(new Date()),
      warehouseId: '',
      supervisorId: '',
      supervisorName: '',
      stockKeeperId: '',
      stockKeeperName: '',
      notes: '',
    });
    setActaFile(null);
    setItems([]);
  };

  const handleSave = async () => {
    if (!form.auditDate) { toast.error('Indica la fecha y hora de la inspección'); return; }
    if (!form.supervisorName.trim()) { toast.error('Indica quién es el encargado del proceso'); return; }
    if (itemsWithProduct.length === 0) { toast.error('Agrega al menos un producto al acta'); return; }
    if (actaFile && !new RegExp(`\\.(pdf|xlsx|xls|png|jpe?g|webp)$`, 'i').test(actaFile.name)) {
      toast.error('El acta debe ser pdf, xlsx o una imagen'); return;
    }
    try {
      setSaving(true);
      let actaUri: string | null = null;
      if (actaFile) {
        const uploaded = await storageService.uploadFile('inventory-audit', actaFile, {
          folder: 'actas-inspeccion',
        });
        actaUri = uploaded.uri;
      }
      await inventoryService.createAudit({
        auditDate: new Date(form.auditDate).toISOString(),
        warehouseId: form.warehouseId || null,
        supervisorId: form.supervisorId || null,
        supervisorName: form.supervisorName.trim() || null,
        stockKeeperId: form.stockKeeperId || null,
        stockKeeperName: form.stockKeeperName.trim() || null,
        notes: form.notes.trim() || null,
        actaUri,
        actaFileName: actaFile?.name || null,
        items: itemsWithProduct.map((item) => ({
          productId: item.productId,
          code: item.code,
          name: item.name,
          systemStock: item.systemStock,
          countedStock: item.countedStock,
          difference: item.countedStock - item.systemStock,
        })),
      });
      toast.success('Acta de inspección registrada');
      setIsCreating(false);
      resetForm();
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo registrar el acta de inspección');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (audit: any) => {
    if (!window.confirm(`¿Eliminar el acta ${audit.number}? El archivo adjunto también se eliminará del almacenamiento.`)) return;
    try {
      setDeletingId(audit.id);
      const result = await inventoryService.deleteAudit(audit.id);
      (result?.fileUris || []).forEach((uri: string) => storageService.deleteFile(uri).catch(() => undefined));
      toast.success('Acta eliminada');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo eliminar el acta');
    } finally {
      setDeletingId(null);
    }
  };

  const fmtQty = (n: number) => Number(n || 0).toLocaleString('es-NI', { maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-tour="inventory-audits-title">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
            <ClipboardCheck className="size-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest">Inventario Selectivo</h3>
            <p className="text-[10px] text-muted-foreground">
              Acta de inspección física firmada por el encargado y el usuario de bodega, con respaldo del documento.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-tour="inventory-audits-actions">
        <InventoryViewTutorial label="Cómo gestionar auditorías" targetPrefix="inventory-audits" copy={{ data: { description: 'Consulta las actas, inspecciones, responsables, almacenes y productos revisados.' }, actions: { description: 'Crea una nueva auditoría o abre el detalle de un acta existente.' } }} />
        <Button onClick={() => setIsCreating(true)} className="gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-[10px] tracking-widest h-9">
          <Plus className="size-4" /> Nueva Auditoría
        </Button>
        </div>
      </div>

      <Card className="rounded-2xl border-border/50" data-tour="inventory-audits-data">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Acta</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha y hora</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Encargado</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Usuario Bodega</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Almacén</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Productos</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Acta adjunta</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audits.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-xs text-muted-foreground">No hay actas de inspección registradas.</TableCell></TableRow>
              ) : audits.map((audit) => {
                const itemCount = Array.isArray(audit.items) ? audit.items.length : 0;
                const warehouse = warehouses.find((w: any) => w.id === audit.warehouseId);
                return (
                <TableRow key={audit.id}>
                  <TableCell>
                    <span className="font-mono text-xs font-bold">{audit.number}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {audit.auditDate ? new Date(audit.auditDate).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                  </TableCell>
                  <TableCell className="text-xs">{audit.supervisorName || '—'}</TableCell>
                  <TableCell className="text-xs">{audit.stockKeeperName || '—'}</TableCell>
                  <TableCell className="text-xs">{warehouse?.name || audit.warehouseId ? (warehouse?.name || '—') : '—'}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{itemCount}</TableCell>
                  <TableCell className="text-right">
                    {audit.actaUri ? (
                      <Button variant="ghost" size="sm" className="h-7 gap-1.5 rounded-lg text-primary" onClick={() => openActa(audit.actaUri)}>
                        <Paperclip className="size-3.5" /> {audit.actaFileName || 'Acta'}
                      </Button>
                    ) : <span className="text-[10px] text-muted-foreground/50">Sin adjunto</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setDetailAudit(audit)} title="Ver detalle">
                        <Eye className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-destructive/10 hover:text-destructive" disabled={deletingId === audit.id} onClick={() => handleDelete(audit)} title="Eliminar">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pagination && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <span>Página {pagination.page} de {pagination.totalPages}</span>
            <span>·</span>
            <span>{pagination.total} acta(s)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" disabled={pagination.page <= 1} onClick={() => pagination.onPageChange(pagination.page - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" className="h-8" disabled={pagination.page >= pagination.totalPages} onClick={() => pagination.onPageChange(pagination.page + 1)}>Siguiente</Button>
          </div>
        </div>
      )}

      <Dialog open={isCreating} onOpenChange={(open) => { if (!open) { setIsCreating(false); resetForm(); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader data-tour="inventory-audit-form-title">
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Acta de Inspección · Inventario Selectivo</DialogTitle>
            <DialogDescription className="text-xs">
              Registra la auditoría realizada por el encargado del proceso junto con el usuario de bodega. El acta se guarda como respaldo.
            </DialogDescription>
            <InventoryViewTutorial label="Cómo registrar auditoría" targetPrefix="inventory-audit-form" stepKeys={['title', 'data', 'items', 'actions']} copy={{ data: { description: 'Define fecha, almacén, encargado, usuario de bodega, respaldo y observaciones.' }, items: { description: 'Agrega productos y registra el stock contado para calcular diferencias.' }, actions: { description: 'Registra el acta cuando los responsables y el conteo estén completos.' } }} />
          </DialogHeader>
          <div className="space-y-4" data-tour="inventory-audit-form-data">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Fecha y hora de la inspección</Label>
                <Input type="datetime-local" value={form.auditDate} onChange={(e) => updateForm({ auditDate: e.target.value })} className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Almacén</Label>
                <Select value={form.warehouseId} onValueChange={(v) => updateForm({ warehouseId: v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Seleccionar almacén" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <Paperclip className="size-3" /> Acta digital (respaldo)
                </Label>
                <label className={cnActa(!!actaFile)}>
                  <Upload className="size-3.5" />
                  <span className="max-w-[200px] truncate">{actaFile ? actaFile.name : 'Subir acta (pdf/xlsx)'}</span>
                  <input type="file" accept={ACCEPTED_ACTA} className="hidden" onChange={(e) => setActaFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <UserCheck className="size-3" /> Encargado del proceso
                </Label>
                <div className="flex gap-2">
                  <Select value={form.supervisorId} onValueChange={(v) => handleUserSelect('supervisorId', v)}>
                    <SelectTrigger className="h-9 flex-1 text-xs"><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger>
                    <SelectContent>
                      {tenantUsers.map((u) => <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    value={form.supervisorName}
                    onChange={(e) => updateForm({ supervisorName: e.target.value, supervisorId: '' })}
                    placeholder="o escribir nombre"
                    className="h-9 w-40 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <WarehouseIcon className="size-3" /> Usuario de bodega
                </Label>
                <div className="flex gap-2">
                  <Select value={form.stockKeeperId} onValueChange={(v) => handleUserSelect('stockKeeperId', v)}>
                    <SelectTrigger className="h-9 flex-1 text-xs"><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger>
                    <SelectContent>
                      {tenantUsers.map((u) => <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    value={form.stockKeeperName}
                    onChange={(e) => updateForm({ stockKeeperName: e.target.value, stockKeeperId: '' })}
                    placeholder="o escribir nombre"
                    className="h-9 w-40 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Observaciones</Label>
              <Input value={form.notes} onChange={(e) => updateForm({ notes: e.target.value })} placeholder="Notas de la inspección..." className="h-9 text-xs" />
            </div>

            <div className="rounded-xl border border-border/40" data-tour="inventory-audit-form-items">
              <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="size-4 text-amber-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Productos inspeccionados</p>
                  <Badge variant="outline" className="text-[9px]">{itemsWithProduct.length}</Badge>
                </div>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-[10px]" onClick={addItem}>
                  <Plus className="size-3.5" /> Agregar producto
                </Button>
              </div>
              <div className="overflow-x-auto p-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest">Producto</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-right">Stock sistema</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-right">Cantidad contada</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-right">Diferencia</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.key}>
                        <TableCell className="min-w-[220px]">
                          <Select value={item.productId} onValueChange={(v) => selectProduct(item.key, v)}>
                            <SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="Buscar producto..." /></SelectTrigger>
                            <SelectContent>
                              {productOptions.map((p) => <SelectItem key={p.id} value={p.id} className="text-[10px]">{p.code} · {p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-xs text-muted-foreground">{fmtQty(item.systemStock)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            value={Number.isFinite(item.countedStock) ? item.countedStock : ''}
                            onChange={(e) => updateCounted(item.key, Number(e.target.value))}
                            className="ml-auto h-8 w-28 text-right font-mono text-xs"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={cn('font-mono text-xs font-bold', item.difference < 0 ? 'text-red-600' : item.difference > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
                            {item.difference > 0 ? '+' : ''}{fmtQty(item.difference)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={() => removeItem(item.key)}><X className="size-3.5" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {items.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="py-6 text-center text-[10px] text-muted-foreground">Agrega productos al acta para registrar el conteo físico.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
                {itemsWithProduct.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-4 border-t border-border/40 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span>Total contado: <span className="text-foreground tabular-nums">{fmtQty(totalContado)}</span></span>
                    <span>Diferencia neta: <span className={cn('tabular-nums', totalDiferencia < 0 ? 'text-red-600' : totalDiferencia > 0 ? 'text-emerald-600' : '')}>{totalDiferencia > 0 ? '+' : ''}{fmtQty(totalDiferencia)}</span></span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 pt-4" data-tour="inventory-audit-form-actions">
            <Button variant="outline" onClick={() => { setIsCreating(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !canSave} className="gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-[10px] tracking-widest">
              {saving ? 'Registrando...' : 'Registrar Acta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailAudit} onOpenChange={(open) => { if (!open) setDetailAudit(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader data-tour="inventory-audit-detail-title">
            <DialogTitle className="text-lg font-black uppercase tracking-tight">
              {detailAudit?.number} · Acta de Inspección
            </DialogTitle>
            <DialogDescription className="text-xs">
              {detailAudit?.auditDate ? new Date(detailAudit.auditDate).toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'short' }) : ''}
            </DialogDescription>
            <InventoryViewTutorial label="Cómo consultar auditoría" targetPrefix="inventory-audit-detail" stepKeys={['title', 'data']} copy={{ data: { description: 'Revisa responsables, almacén, respaldo, observaciones, stock del sistema y diferencias encontradas.' } }} />
          </DialogHeader>
          <div className="space-y-4" data-tour="inventory-audit-detail-data">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Encargado</p>
                <p className="mt-0.5 text-xs font-bold">{detailAudit?.supervisorName || '—'}</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Usuario bodega</p>
                <p className="mt-0.5 text-xs font-bold">{detailAudit?.stockKeeperName || '—'}</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Almacén</p>
                <p className="mt-0.5 text-xs font-bold">{warehouses.find((w: any) => w.id === detailAudit?.warehouseId)?.name || '—'}</p>
              </div>
            </div>
            {detailAudit?.notes && (
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Observaciones</p>
                <p className="mt-0.5 text-xs">{detailAudit.notes}</p>
              </div>
            )}
            {detailAudit?.actaUri && (
              <Button variant="outline" className="gap-2 text-xs font-bold" onClick={() => openActa(detailAudit.actaUri)}>
                <Paperclip className="size-4" /> Acta digital: {detailAudit.actaFileName || 'descargar'}
              </Button>
            )}
            {Array.isArray(detailAudit?.items) && detailAudit.items.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-border/40">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest">Código</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest">Producto</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-right">Stock sistema</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-right">Contado</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-right">Diferencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailAudit.items.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-[10px]">{item.code}</TableCell>
                        <TableCell className="text-xs">{item.name}</TableCell>
                        <TableCell className="text-right font-mono text-[10px]">{fmtQty(item.systemStock)}</TableCell>
                        <TableCell className="text-right font-mono text-[10px]">{fmtQty(item.countedStock)}</TableCell>
                        <TableCell className={cn('text-right font-mono text-[10px] font-bold', Number(item.difference) < 0 ? 'text-red-600' : Number(item.difference) > 0 ? 'text-emerald-600' : '')}>
                          {Number(item.difference) > 0 ? '+' : ''}{fmtQty(item.difference)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cnActa(hasFile: boolean) {
  return `flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 px-3 py-2.5 text-[10px] font-bold transition-all h-9 ${
    hasFile ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-600' : 'hover:border-primary/50 hover:bg-muted/30'
  }`;
}
