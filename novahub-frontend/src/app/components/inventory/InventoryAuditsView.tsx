import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck, Plus, Trash2, Eye, Paperclip, Upload, UserCheck, Warehouse as WarehouseIcon, X, ChevronLeft,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../ui/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
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
  onRefreshWarehouses?: () => Promise<unknown> | void;
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

interface AuditParticipant {
  userId?: string | null;
  name: string;
}

type ParticipantRole = 'supervisor' | 'stockKeeper';

interface AuditParticipantPickerProps {
  selected: AuditParticipant[];
  users: { id: string; name: string }[];
  pendingUserId: string;
  manualDraft: string;
  manualPlaceholder: string;
  onManualDraftChange: (value: string) => void;
  onSelectUser: (userId: string) => void;
  onRemove: (index: number) => void;
  onAddManual: () => void;
}

function normalizeAuditParticipants(value: unknown): AuditParticipant[] {
  let source = value;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(source)) return [];
  const seen = new Set<string>();
  return source.reduce<AuditParticipant[]>((result, participant: any) => {
    const name = String(participant?.name || '').trim();
    const userId = participant?.userId || participant?.id || participant?.user?.id || null;
    if (!name) return result;
    const key = `${userId || ''}:${name.toLocaleLowerCase()}`;
    if (seen.has(key)) return result;
    seen.add(key);
    result.push({ userId: userId ? String(userId) : null, name });
    return result;
  }, []);
}

function getAuditParticipants(audit: any, role: ParticipantRole): AuditParticipant[] {
  const list = normalizeAuditParticipants(role === 'supervisor' ? audit?.supervisors : audit?.stockKeepers);
  if (list.length > 0) return list;
  const userId = role === 'supervisor' ? audit?.supervisorId : audit?.stockKeeperId;
  const name = role === 'supervisor' ? audit?.supervisorName : audit?.stockKeeperName;
  return name || userId ? [{ userId: userId || null, name: String(name || 'Usuario') }] : [];
}

function auditParticipantNames(audit: any, role: ParticipantRole): string {
  return getAuditParticipants(audit, role).map((participant) => participant.name).join(', ');
}

function AuditParticipantPicker({
  selected,
  users,
  pendingUserId,
  manualDraft,
  manualPlaceholder,
  onManualDraftChange,
  onSelectUser,
  onRemove,
  onAddManual,
}: AuditParticipantPickerProps) {
  const selectedIds = new Set(selected.map((participant) => participant.userId).filter(Boolean));
  const availableUsers = users.filter((user) => !selectedIds.has(user.id));

  return (
    <div className="min-w-0 space-y-2 rounded-xl border border-border/50 bg-muted/10 p-2.5">
      {selected.length > 0 && (
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {selected.map((participant, index) => (
            <span key={`${participant.userId || participant.name}-${index}`} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-foreground">
              <span className="max-w-[220px] truncate">{participant.name}</span>
              <button type="button" aria-label={`Quitar a ${participant.name}`} onClick={() => onRemove(index)} className="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        <Select value={pendingUserId} onValueChange={onSelectUser}>
          <SelectTrigger className="h-9 min-w-0 text-xs"><SelectValue placeholder="Agregar usuario del sistema" /></SelectTrigger>
          <SelectContent className="max-w-[calc(100vw-2rem)]">
            {availableUsers.length > 0
              ? availableUsers.map((user) => <SelectItem key={user.id} value={user.id} className="max-w-full truncate text-xs">{user.name}</SelectItem>)
              : <SelectItem value="__no_available_participant__" disabled className="text-xs">No hay más usuarios disponibles</SelectItem>}
          </SelectContent>
        </Select>
        <div className="flex min-w-0 gap-2">
          <Input
            value={manualDraft}
            onChange={(event) => onManualDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                onAddManual();
              }
            }}
            placeholder={manualPlaceholder}
            className="h-9 min-w-0 flex-1 text-xs"
          />
          <Button type="button" variant="outline" size="icon" aria-label="Agregar participante seleccionado" title="Agregar participante" className="size-9 shrink-0" onClick={onAddManual} disabled={!manualDraft.trim() && !pendingUserId}>
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">Selecciona una persona o escribe un nombre y pulsa + para agregarlo. Puedes repetirlo para sumar varias.</p>
    </div>
  );
}

function toLocalDateTime(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

const ACCEPTED_ACTA = '.pdf,.xlsx,.xls,.png,.jpg,.jpeg,.webp';

function warehouseParentId(warehouse: any): string | null {
  return warehouse?.parentId || warehouse?.parent?.id || null;
}

function warehouseRootId(warehouseId: string, warehouseById: Map<string, any>): string {
  let currentId = String(warehouseId);
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const parentId = warehouseParentId(warehouseById.get(currentId));
    if (!parentId || !warehouseById.has(String(parentId))) break;
    currentId = String(parentId);
  }
  return currentId;
}

function warehouseFamilyIds(warehouseId: string, warehouses: any[], warehouseById: Map<string, any>): string[] {
  const rootId = warehouseRootId(warehouseId, warehouseById);
  const familyIds = warehouses
    .filter((warehouse: any) => warehouseRootId(String(warehouse.id), warehouseById) === rootId)
    .map((warehouse: any) => String(warehouse.id));
  return [...new Set([String(warehouseId), ...familyIds])];
}

function productWarehouseIds(product: any): string[] {
  const ids = [
    ...(Array.isArray(product?.warehouseCatalogs) ? product.warehouseCatalogs.map((catalog: any) => catalog.warehouseId || catalog.warehouse?.id) : []),
    ...(Array.isArray(product?.stockLevels) ? product.stockLevels.map((level: any) => level.warehouseId || level.warehouse?.id) : []),
    ...(Array.isArray(product?.allocations) ? product.allocations.map((allocation: any) => allocation.warehouseId || allocation.warehouse?.id) : []),
  ];
  return [...new Set(ids.filter(Boolean).map(String))];
}

function productStockForWarehouses(product: any, warehouseIds: Set<string>): number {
  // The report endpoint returns stockLevels after the backend change below.
  // Keep the fallback only for older API responses; never use the tenant-wide
  // total when warehouse-specific levels are present.
  if (!Array.isArray(product?.stockLevels)) return Number(product?.stock || 0);
  return product.stockLevels
    .filter((level: any) => warehouseIds.has(String(level.warehouseId || level.warehouse?.id || '')))
    .reduce((total: number, level: any) => total + Number(level.quantity || 0), 0);
}

export function InventoryAuditsView({ audits, warehouses, products, onRefresh, onRefreshWarehouses, pagination }: InventoryAuditsViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [detailAudit, setDetailAudit] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    auditDate: toLocalDateTime(new Date()),
    warehouseId: '',
    supervisors: [] as AuditParticipant[],
    stockKeepers: [] as AuditParticipant[],
    supervisorPendingUserId: '',
    stockKeeperPendingUserId: '',
    supervisorDraft: '',
    stockKeeperDraft: '',
    notes: '',
  });
  const [actaFile, setActaFile] = useState<File | null>(null);
  const [items, setItems] = useState<AuditItemDraft[]>([]);

  const warehouseById = useMemo(() => new Map(warehouses.map((warehouse: any) => [String(warehouse.id), warehouse])), [warehouses]);
  const selectedWarehouseFamilyIds = useMemo(
    () => form.warehouseId ? warehouseFamilyIds(form.warehouseId, warehouses, warehouseById) : [],
    [form.warehouseId, warehouses, warehouseById],
  );
  const selectedWarehouseFamilySet = useMemo(() => new Set(selectedWarehouseFamilyIds), [selectedWarehouseFamilyIds]);
  const selectedWarehouse = form.warehouseId ? warehouseById.get(String(form.warehouseId)) : null;
  const warehouseLabel = (warehouse: any): string => {
    const parentId = warehouseParentId(warehouse);
    const parentName = parentId ? warehouseById.get(String(parentId))?.name || warehouse?.parent?.name : null;
    if (parentName) return `${warehouse.name} · hijo de ${parentName}`;
    const childCount = warehouses.filter((candidate: any) => warehouseParentId(candidate) === warehouse?.id).length;
    return childCount > 0 ? `${warehouse.name} · principal (${childCount} hijos comparten inventario)` : warehouse.name;
  };
  const selectedWarehouseFamilyNames = selectedWarehouseFamilyIds
    .map((id) => warehouseById.get(id)?.name)
    .filter(Boolean);

  useEffect(() => {
    if (isCreating) void onRefreshWarehouses?.();
  }, [isCreating, onRefreshWarehouses]);

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
      .map((u: any) => ({ id: String(u.id), name: String(u.name || u.email || 'Usuario') }))
      .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
  }, [usersQuery.data]);

  const productOptions = useMemo(() => {
    if (!form.warehouseId) return [];
    return products
      .filter((p: any) => String(p.itemType || p.type || 'PRODUCT').toUpperCase() !== 'SERVICE')
      .filter((p: any) => productWarehouseIds(p).some((warehouseId) => selectedWarehouseFamilySet.has(warehouseId)))
      .map((p: any) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        stock: productStockForWarehouses(p, selectedWarehouseFamilySet),
      }));
  }, [form.warehouseId, products, selectedWarehouseFamilySet]);

  const totalContado = items.reduce((acc, item) => acc + (Number.isFinite(item.countedStock) ? item.countedStock : 0), 0);
  const totalDiferencia = items.reduce((acc, item) => acc + (Number.isFinite(item.difference) ? item.difference : 0), 0);
  const itemsWithProduct = items.filter((item) => item.productId);
  const canSave = Boolean(form.auditDate && form.warehouseId) && form.supervisors.length > 0 && itemsWithProduct.length > 0;

  const updateForm = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  const handleWarehouseChange = (warehouseId: string) => {
    const nextFamilyIds = new Set(warehouseFamilyIds(warehouseId, warehouses, warehouseById));
    const invalidItems = items.filter((item) => {
      const product = products.find((candidate: any) => candidate.id === item.productId);
      return product?.id && !productWarehouseIds(product).some((id) => nextFamilyIds.has(id));
    }).length;

    updateForm({ warehouseId });
    setItems((current) => current.map((item) => {
      if (!item.productId) return item;
      const product = products.find((candidate: any) => candidate.id === item.productId);
      if (!product || !productWarehouseIds(product).some((id) => nextFamilyIds.has(id))) {
        return { ...item, productId: '', code: '', name: '', systemStock: 0, countedStock: 0, difference: 0 };
      }
      const nextSystemStock = productStockForWarehouses(product, nextFamilyIds);
      const nextCountedStock = item.countedStock === item.systemStock ? nextSystemStock : item.countedStock;
      return { ...item, systemStock: nextSystemStock, countedStock: nextCountedStock, difference: nextCountedStock - nextSystemStock };
    }));
    if (invalidItems > 0) {
      toast.info('Se limpiaron los productos que no pertenecen al nuevo alcance del almacén.');
    }
  };

  const addParticipant = (role: ParticipantRole, participant: AuditParticipant) => {
    const name = participant.name.trim();
    if (!name) return;
    const listField = role === 'supervisor' ? 'supervisors' : 'stockKeepers';
    const draftField = role === 'supervisor' ? 'supervisorDraft' : 'stockKeeperDraft';
    const pendingField = role === 'supervisor' ? 'supervisorPendingUserId' : 'stockKeeperPendingUserId';
    setForm((current) => {
      const currentList = current[listField];
      const duplicate = currentList.some((currentParticipant) => (
        participant.userId && currentParticipant.userId
          ? participant.userId === currentParticipant.userId
          : currentParticipant.name.toLocaleLowerCase() === name.toLocaleLowerCase()
      ));
      if (duplicate) return { ...current, [draftField]: '', [pendingField]: '' };
      return {
        ...current,
        [listField]: [...currentList, { userId: participant.userId || null, name }],
        [draftField]: '',
        [pendingField]: '',
      };
    });
  };

  const handleUserSelect = (role: ParticipantRole, value: string) => {
    const pendingField = role === 'supervisor' ? 'supervisorPendingUserId' : 'stockKeeperPendingUserId';
    updateForm({ [pendingField]: value } as Partial<typeof form>);
  };

  const handleManualParticipantDraftChange = (role: ParticipantRole, value: string) => {
    const draftField = role === 'supervisor' ? 'supervisorDraft' : 'stockKeeperDraft';
    const pendingField = role === 'supervisor' ? 'supervisorPendingUserId' : 'stockKeeperPendingUserId';
    updateForm({
      [draftField]: value,
      ...(value.trim() ? { [pendingField]: '' } : {}),
    } as Partial<typeof form>);
  };

  const handleManualParticipantAdd = (role: ParticipantRole) => {
    const draft = role === 'supervisor' ? form.supervisorDraft : form.stockKeeperDraft;
    const pendingUserId = role === 'supervisor' ? form.supervisorPendingUserId : form.stockKeeperPendingUserId;
    const pendingUser = tenantUsers.find((user) => user.id === pendingUserId);
    if (pendingUser) {
      addParticipant(role, { userId: pendingUser.id, name: pendingUser.name });
      return;
    }
    const name = draft.replace(/,+$/, '').trim();
    if (name) addParticipant(role, { userId: null, name });
  };

  const removeParticipant = (role: ParticipantRole, index: number) => {
    const listField = role === 'supervisor' ? 'supervisors' : 'stockKeepers';
    setForm((current) => ({
      ...current,
      [listField]: current[listField].filter((_, participantIndex) => participantIndex !== index),
    }));
  };

  const addItem = () => {
    if (!form.warehouseId) { toast.info('Selecciona un almacén antes de agregar productos'); return; }
    if (items.length >= 50) { toast.error('Máximo 50 productos por acta'); return; }
    setItems((current) => [...current, {
      key: `item-${Date.now()}-${current.length}`,
      productId: '',
      code: '',
      name: '',
      systemStock: 0,
      countedStock: 0,
      difference: 0,
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
      difference: 0,
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
      supervisors: [],
      stockKeepers: [],
      supervisorPendingUserId: '',
      stockKeeperPendingUserId: '',
      supervisorDraft: '',
      stockKeeperDraft: '',
      notes: '',
    });
    setActaFile(null);
    setItems([]);
  };

  const closeCreateView = () => {
    setIsCreating(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!form.auditDate) { toast.error('Indica la fecha y hora de la inspección'); return; }
    if (!form.warehouseId) { toast.error('Selecciona el almacén de la inspección'); return; }
    if (form.supervisors.length === 0) { toast.error('Indica al menos un encargado del proceso'); return; }
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
        supervisorId: form.supervisors.find((participant) => participant.userId)?.userId || null,
        supervisorName: form.supervisors.map((participant) => participant.name).join(', ') || null,
        supervisors: form.supervisors.map((participant) => ({ userId: participant.userId || null, name: participant.name })),
        stockKeeperId: form.stockKeepers.find((participant) => participant.userId)?.userId || null,
        stockKeeperName: form.stockKeepers.map((participant) => participant.name).join(', ') || null,
        stockKeepers: form.stockKeepers.map((participant) => ({ userId: participant.userId || null, name: participant.name })),
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

  if (isCreating) {
    return (
      <div className="min-w-0 space-y-6 animate-in slide-in-from-right duration-300" data-tour="inventory-audit-form-title">
        <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Volver a auditorías" onClick={closeCreateView} className="size-10 shrink-0 rounded-full hover:bg-primary/10 hover:text-primary">
              <ChevronLeft className="size-5" />
            </Button>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Nueva auditoría</p>
              <h2 className="truncate text-xl font-black uppercase tracking-tight sm:text-2xl">Acta de inspección · Inventario selectivo</h2>
              <p className="mt-1 text-xs text-muted-foreground">Registra el conteo físico y deja el respaldo de la inspección.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2" data-tour="inventory-audit-form-actions">
            <InventoryViewTutorial label="Cómo registrar auditoría" targetPrefix="inventory-audit-form" stepKeys={['title', 'data', 'items', 'actions']} copy={{ data: { description: 'Define fecha, almacén, encargado, usuario de bodega, respaldo y observaciones.' }, items: { description: 'Agrega productos y registra el stock contado para calcular diferencias.' }, actions: { description: 'Registra el acta cuando los responsables y el conteo estén completos.' } }} />
            <Button variant="outline" onClick={closeCreateView} className="rounded-xl text-xs font-bold">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !canSave} className="gap-2 rounded-xl bg-primary text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90">
              {saving ? 'Registrando...' : 'Registrar acta'}
            </Button>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-border/50 bg-card p-4 shadow-sm sm:p-6">
          <div className="min-w-0 space-y-5" data-tour="inventory-audit-form-data">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <ClipboardCheck className="size-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest">Datos de la inspección</h3>
                <p className="text-xs text-muted-foreground">Completa los responsables, el almacén y las observaciones.</p>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Fecha y hora de la inspección</Label>
                <Input type="datetime-local" value={form.auditDate} onChange={(e) => updateForm({ auditDate: e.target.value })} className="h-10 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Almacén</Label>
                <Select value={form.warehouseId} onValueChange={handleWarehouseChange}>
                  <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Seleccionar almacén" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id} className="max-w-full text-xs">{warehouseLabel(w)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {selectedWarehouse && (
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    {selectedWarehouseFamilyIds.length > 1
                      ? <>Alcance compartido: <span className="font-semibold text-foreground">{selectedWarehouseFamilyNames.join(', ')}</span>. Se suman padre e hijos para esta inspección.</>
                      : 'Este almacén no tiene almacenes padre o hijos relacionados.'}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  <Paperclip className="size-3" /> Acta digital (respaldo)
                </Label>
                <label className={cnActa(!!actaFile)}>
                  <Upload className="size-3.5" />
                  <span className="max-w-[260px] truncate">{actaFile ? actaFile.name : 'Subir acta (pdf/xlsx)'}</span>
                  <input type="file" accept={ACCEPTED_ACTA} className="hidden" onChange={(e) => setActaFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  <UserCheck className="size-3" /> Encargado del proceso
                </Label>
                <AuditParticipantPicker
                  selected={form.supervisors}
                  users={tenantUsers}
                  pendingUserId={form.supervisorPendingUserId}
                  manualDraft={form.supervisorDraft}
                  manualPlaceholder="Escribir otro encargado"
                  onManualDraftChange={(value) => handleManualParticipantDraftChange('supervisor', value)}
                  onSelectUser={(value) => handleUserSelect('supervisor', value)}
                  onRemove={(index) => removeParticipant('supervisor', index)}
                  onAddManual={() => handleManualParticipantAdd('supervisor')}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  <WarehouseIcon className="size-3" /> Usuario de bodega
                </Label>
                <AuditParticipantPicker
                  selected={form.stockKeepers}
                  users={tenantUsers}
                  pendingUserId={form.stockKeeperPendingUserId}
                  manualDraft={form.stockKeeperDraft}
                  manualPlaceholder="Escribir otro usuario de bodega"
                  onManualDraftChange={(value) => handleManualParticipantDraftChange('stockKeeper', value)}
                  onSelectUser={(value) => handleUserSelect('stockKeeper', value)}
                  onRemove={(index) => removeParticipant('stockKeeper', index)}
                  onAddManual={() => handleManualParticipantAdd('stockKeeper')}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Observaciones</Label>
              <Input value={form.notes} onChange={(e) => updateForm({ notes: e.target.value })} placeholder="Notas de la inspección..." className="h-10 text-xs" />
            </div>

            <div className="rounded-xl border border-border/40" data-tour="inventory-audit-form-items">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-3 py-3">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="size-4 text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Productos inspeccionados</p>
                  <Badge variant="outline" className="text-[9px]">{itemsWithProduct.length}</Badge>
                </div>
                <Button variant="outline" size="sm" disabled={!form.warehouseId} className="h-8 gap-1 text-[10px]" onClick={addItem}>
                  <Plus className="size-3.5" /> Agregar producto
                </Button>
              </div>
              <div className="min-w-0 space-y-3 p-3">
                <div className="space-y-3 md:hidden">
                  {items.map((item) => (
                    <div key={item.key} className="min-w-0 rounded-xl border border-border/50 bg-muted/10 p-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Producto</Label>
                          <Select value={item.productId} onValueChange={(v) => selectProduct(item.key, v)} disabled={!form.warehouseId}>
                            <SelectTrigger className="h-9 w-full min-w-0 text-[10px]"><SelectValue placeholder={form.warehouseId ? 'Buscar producto...' : 'Selecciona un almacén'} /></SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
                              {productOptions.length > 0 ? productOptions.map((p) => <SelectItem key={p.id} value={p.id} className="max-w-full truncate text-[10px]">{p.code} · {p.name}</SelectItem>) : <SelectItem value="__empty_mobile__" disabled className="text-[10px]">No hay productos en este alcance</SelectItem>}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button variant="ghost" size="icon" aria-label="Quitar producto" className="mt-5 size-8 shrink-0 hover:text-destructive" onClick={() => removeItem(item.key)}><X className="size-3.5" /></Button>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-3">
                        <div><p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Stock sistema</p><p className="mt-1 font-mono text-xs tabular-nums">{fmtQty(item.systemStock)}</p></div>
                        <div><Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Contado</Label><Input type="number" min={0} value={Number.isFinite(item.countedStock) ? item.countedStock : ''} onChange={(e) => updateCounted(item.key, Number(e.target.value))} className="mt-1 h-8 w-full text-right font-mono text-xs" /></div>
                        <div className="text-right"><p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Diferencia</p><p className={cn('mt-2 font-mono text-xs font-bold tabular-nums', item.difference < 0 ? 'text-red-600' : item.difference > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>{item.difference > 0 ? '+' : ''}{fmtQty(item.difference)}</p></div>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <p className="py-6 text-center text-[10px] text-muted-foreground">Agrega productos al acta para registrar el conteo físico.</p>}
                </div>

                <div className="hidden md:block">
                  <Table containerClassName="overflow-x-auto" className="min-w-[680px]">
                    <TableHeader><TableRow><TableHead className="text-[9px] font-black uppercase tracking-widest">Producto</TableHead><TableHead className="text-right text-[9px] font-black uppercase tracking-widest">Stock sistema</TableHead><TableHead className="text-right text-[9px] font-black uppercase tracking-widest">Cantidad contada</TableHead><TableHead className="text-right text-[9px] font-black uppercase tracking-widest">Diferencia</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.key}>
                          <TableCell className="min-w-[220px]"><Select value={item.productId} onValueChange={(v) => selectProduct(item.key, v)} disabled={!form.warehouseId}><SelectTrigger className="h-8 min-w-0 text-[10px]"><SelectValue placeholder={form.warehouseId ? 'Buscar producto...' : 'Selecciona un almacén'} /></SelectTrigger><SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">{productOptions.length > 0 ? productOptions.map((p) => <SelectItem key={p.id} value={p.id} className="max-w-full truncate text-[10px]">{p.code} · {p.name}</SelectItem>) : <SelectItem value="__empty_desktop__" disabled className="text-[10px]">No hay productos en este alcance</SelectItem>}</SelectContent></Select></TableCell>
                          <TableCell className="text-right"><span className="font-mono text-xs text-muted-foreground">{fmtQty(item.systemStock)}</span></TableCell>
                          <TableCell className="text-right"><Input type="number" min={0} value={Number.isFinite(item.countedStock) ? item.countedStock : ''} onChange={(e) => updateCounted(item.key, Number(e.target.value))} className="ml-auto h-8 w-28 text-right font-mono text-xs" /></TableCell>
                          <TableCell className="text-right"><span className={cn('font-mono text-xs font-bold', item.difference < 0 ? 'text-red-600' : item.difference > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>{item.difference > 0 ? '+' : ''}{fmtQty(item.difference)}</span></TableCell>
                          <TableCell className="text-right"><Button variant="ghost" size="icon" aria-label="Quitar producto" className="size-7 hover:text-destructive" onClick={() => removeItem(item.key)}><X className="size-3.5" /></Button></TableCell>
                        </TableRow>
                      ))}
                      {items.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-[10px] text-muted-foreground">Agrega productos al acta para registrar el conteo físico.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
                {itemsWithProduct.length > 0 && <div className="mt-2 flex flex-wrap items-center justify-end gap-4 border-t border-border/40 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"><span>Total contado: <span className="text-foreground tabular-nums">{fmtQty(totalContado)}</span></span><span>Diferencia neta: <span className={cn('tabular-nums', totalDiferencia < 0 ? 'text-red-600' : totalDiferencia > 0 ? 'text-emerald-600' : '')}>{totalDiferencia > 0 ? '+' : ''}{fmtQty(totalDiferencia)}</span></span></div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-tour="inventory-audits-title">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <ClipboardCheck className="size-5 text-primary" />
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
        <Button onClick={() => setIsCreating(true)} className="h-9 gap-2 rounded-xl bg-primary text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/90">
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
                  <TableCell className="max-w-[240px] text-xs" title={auditParticipantNames(audit, 'supervisor')}>{auditParticipantNames(audit, 'supervisor') || '—'}</TableCell>
                  <TableCell className="max-w-[240px] text-xs" title={auditParticipantNames(audit, 'stockKeeper')}>{auditParticipantNames(audit, 'stockKeeper') || '—'}</TableCell>
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

      <Dialog open={!!detailAudit} onOpenChange={(open) => { if (!open) setDetailAudit(null); }}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl min-w-0 max-h-[85vh] overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          <DialogHeader data-tour="inventory-audit-detail-title">
            <DialogTitle className="text-lg font-black uppercase tracking-tight">
              {detailAudit?.number} · Acta de Inspección
            </DialogTitle>
            <DialogDescription className="text-xs">
              {detailAudit?.auditDate ? new Date(detailAudit.auditDate).toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'short' }) : ''}
            </DialogDescription>
            <InventoryViewTutorial label="Cómo consultar auditoría" targetPrefix="inventory-audit-detail" stepKeys={['title', 'data']} copy={{ data: { description: 'Revisa responsables, almacén, respaldo, observaciones, stock del sistema y diferencias encontradas.' } }} />
          </DialogHeader>
          <div className="min-w-0 space-y-4" data-tour="inventory-audit-detail-data">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Encargado</p>
                <p className="mt-0.5 break-words text-xs font-bold">{auditParticipantNames(detailAudit, 'supervisor') || '—'}</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Usuario bodega</p>
                <p className="mt-0.5 break-words text-xs font-bold">{auditParticipantNames(detailAudit, 'stockKeeper') || '—'}</p>
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
              <div className="min-w-0 overflow-x-auto rounded-xl border border-border/40">
                <Table containerClassName="overflow-x-auto" className="min-w-[620px]">
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
