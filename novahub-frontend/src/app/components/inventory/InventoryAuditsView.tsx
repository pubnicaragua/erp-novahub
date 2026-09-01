import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import {
  ClipboardCheck, Plus, Trash2, Eye, Paperclip, Upload, UserCheck, Warehouse as WarehouseIcon, X, ChevronLeft,
  PauseCircle, CheckCircle2, RotateCcw, XCircle, ListPlus, AlertTriangle, Loader2, Search, SlidersHorizontal,
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
import { useAuth } from '../../contexts/AuthContext';
import type { SalesPaginationControls } from '../../types';
import { InventoryViewTutorial } from './InventoryViewTutorial';
import { MultiSelectFilter } from './MultiSelectFilter';

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
  variantId?: string;
  variantLabel?: string;
  variantSku?: string;
  code: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  systemStock: number;
  countedStock: number;
  difference: number;
  reason: string;
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

function normalizeAuditItems(value: unknown): any[] {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

function auditItemKey(item: any, index: number): string {
  return String(item?.productId || item?.code || `row-${index}`);
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
const BULK_UNCATEGORIZED = '__uncategorized__';
const MAX_AUDIT_ITEMS = 5000;

const AUDIT_REASON_OPTIONS = [
  { value: 'SURPLUS', label: 'Sobrante' },
  { value: 'SHRINKAGE', label: 'Merma' },
  { value: 'SHORTAGE', label: 'Faltante' },
  { value: 'LOSS', label: 'Pérdida' },
  { value: 'DETERIORATION', label: 'Deterioro' },
];

function AuditReasonSelect({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-8 min-w-[9rem] text-[10px]">
        <SelectValue placeholder={disabled ? 'Sin diferencia' : 'Seleccionar motivo'} />
      </SelectTrigger>
      <SelectContent>
        {AUDIT_REASON_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value} className="text-[10px]">{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
    } else {
      globalThis.setTimeout(resolve, 0);
    }
  });
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 767px)').matches
      : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleChange = () => setIsMobile(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, []);

  return isMobile;
}

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
    .filter((level: any) => (
      levelBelongsToProduct(product, level)
      && warehouseIds.has(String(level.warehouseId || level.warehouse?.id || ''))
    ))
    .reduce((total: number, level: any) => total + Number(level.quantity || 0), 0);
}

function variantDisplayLabel(variant: any): string {
  const attributes = Array.isArray(variant?.attributes) ? variant.attributes : [];
  if (attributes.length > 0) return attributes.map((attribute: any) => attribute?.value).filter(Boolean).join(' / ');
  return String(variant?.name || variant?.sku || 'Estándar');
}

function levelBelongsToProduct(product: any, level: any): boolean {
  const levelProductId = String(level?.productId || '').trim();
  return !levelProductId || levelProductId === String(product?.id || '').trim();
}

function productVariantRows(product: any, warehouseIds?: Set<string>) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const ownVariantIds = new Set<string>(
    variants.map((variant: any) => String(variant?.id || '').trim()).filter(Boolean),
  );
  const levels = (Array.isArray(product?.stockLevels) ? product.stockLevels : []).filter((level: any) => (
    levelBelongsToProduct(product, level)
    && (!warehouseIds || warehouseIds.has(String(level?.warehouseId || level?.warehouse?.id || '')))
  ));
  const variantIds = new Set<string>([
    ...ownVariantIds,
    ...levels.map((level: any) => String(level?.variantId || level?.variant?.id || '').trim())
      .filter((variantId: string) => variantId && ownVariantIds.has(variantId)),
  ]);

  return Array.from(variantIds).map((variantId) => {
    const variant = variants.find((candidate: any) => String(candidate?.id) === variantId)
      || levels.find((level: any) => String(level?.variantId || level?.variant?.id || '') === variantId)?.variant
      || { id: variantId, sku: variantId, name: 'Estándar' };
    const variantLevels = levels.filter((level: any) => String(level?.variantId || level?.variant?.id || '') === variantId);
    return {
      variantId,
      variantLabel: variantDisplayLabel(variant),
      variantSku: String(variant?.sku || ''),
      stock: variantLevels.reduce((total: number, level: any) => total + Number(level?.quantity || 0), 0),
    };
  });
}

function auditItemSelectionValue(item: Pick<AuditItemDraft, 'productId' | 'variantId'>): string {
  return item.variantId ? `${item.productId}::${item.variantId}` : item.productId;
}

type AuditRenderRow =
  | { kind: 'category'; id: string; name: string; count: number }
  | { kind: 'item'; id: string; item: AuditItemDraft };

function useVirtualAuditRows(rows: AuditRenderRow[], estimatedRowHeight: number, viewportHeight = 620, overscan = 8) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollTopRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const totalSize = rows.length * estimatedRowHeight;
  useEffect(() => () => {
    if (frameRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(frameRef.current);
    }
  }, []);
  const safeScrollTop = Math.min(scrollTop, Math.max(0, totalSize - viewportHeight));
  const startIndex = Math.max(0, Math.floor(safeScrollTop / estimatedRowHeight) - overscan);
  const endIndex = Math.min(rows.length, Math.ceil((safeScrollTop + viewportHeight) / estimatedRowHeight) + overscan);
  const onScroll = useCallback((event: UIEvent<HTMLElement>) => {
    scrollTopRef.current = event.currentTarget.scrollTop;
    if (frameRef.current !== null || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') setScrollTop(scrollTopRef.current);
      return;
    }
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      setScrollTop(scrollTopRef.current);
    });
  }, []);

  return {
    rows: rows.slice(startIndex, endIndex),
    topSpacer: startIndex * estimatedRowHeight,
    bottomSpacer: Math.max(0, totalSize - endIndex * estimatedRowHeight),
    onScroll,
  };
}

export function InventoryAuditsView({ audits, warehouses, products, onRefresh, onRefreshWarehouses, pagination }: InventoryAuditsViewProps) {
  const { canPerform } = useAuth();
  const isMobile = useIsMobile();
  const canViewUsers = canPerform('CONFIG_USERS', 'view');
  const canCreateAudits = canPerform('INVENTORY_AUDITS', 'create');
  const canApproveAudits = canPerform('INVENTORY_AUDITS', 'approve');
  const canDeleteAudits = canPerform('INVENTORY_AUDITS', 'delete');
  const [isCreating, setIsCreating] = useState(false);
  const [detailAudit, setDetailAudit] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState<string | null>(null);
  const [comparisonAudit, setComparisonAudit] = useState<any | null>(null);
  const [comparisonTargetStatus, setComparisonTargetStatus] = useState<'CLOSED' | 'APPROVED'>('CLOSED');
  const [comparisonReasons, setComparisonReasons] = useState<Record<string, string>>({});
  const [theoreticalItems, setTheoreticalItems] = useState<any[]>([]);
  const [loadingTheoretical, setLoadingTheoretical] = useState(false);
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
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkCategoryIds, setBulkCategoryIds] = useState<string[]>([]);
  const [inventoryProductSearch, setInventoryProductSearch] = useState('');
  const [inventoryStockFilter, setInventoryStockFilter] = useState<'all' | 'available' | 'out'>('all');

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
    enabled: canViewUsers,
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
      .flatMap((p: any) => {
        const variants = productVariantRows(p, selectedWarehouseFamilySet);
        const rows = variants.length > 0 ? variants : [{ variantId: '', variantLabel: '', variantSku: '', stock: productStockForWarehouses(p, selectedWarehouseFamilySet) }];
        return rows.map((variant) => ({
          id: p.id,
          value: variant.variantId ? `${p.id}::${variant.variantId}` : p.id,
          variantId: variant.variantId || undefined,
          variantLabel: variant.variantLabel,
          variantSku: variant.variantSku,
          code: p.code,
          name: p.name,
          stock: variant.stock,
          categoryId: p.categoryId || p.category?.id || BULK_UNCATEGORIZED,
          categoryName: p.category?.name || 'Sin categoría',
        }));
      });
  }, [form.warehouseId, products, selectedWarehouseFamilySet]);

  const productCategoryOptions = useMemo(() => {
    const categories = new Map<string, string>();
    productOptions.forEach((product) => {
      categories.set(String(product.categoryId || BULK_UNCATEGORIZED), product.categoryName || 'Sin categoría');
    });
    return Array.from(categories.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [productOptions]);

  const filteredProductOptions = useMemo(() => {
    const search = inventoryProductSearch.trim().toLocaleLowerCase();
    return productOptions.filter((product) => {
      const matchesSearch = !search
        || String(product.code || '').toLocaleLowerCase().includes(search)
        || String(product.name || '').toLocaleLowerCase().includes(search)
        || String(product.variantLabel || '').toLocaleLowerCase().includes(search)
        || String(product.variantSku || '').toLocaleLowerCase().includes(search);
      const matchesCategory = bulkCategoryIds.length === 0 || bulkCategoryIds.includes(product.categoryId);
      const matchesStock = inventoryStockFilter === 'all'
        || (inventoryStockFilter === 'available' && Number(product.stock || 0) > 0)
        || (inventoryStockFilter === 'out' && Number(product.stock || 0) <= 0);
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [bulkCategoryIds, inventoryProductSearch, inventoryStockFilter, productOptions]);
  const productOptionItems = useMemo(
    () => filteredProductOptions.map((product) => (
      <SelectItem key={product.value} value={product.value} className="max-w-full truncate text-[10px]">
        {product.code} · {product.name}{product.variantLabel ? ` · ${product.variantLabel}` : ''}
      </SelectItem>
    )),
    [filteredProductOptions],
  );

  const totalContado = items.reduce((acc, item) => acc + (Number.isFinite(item.countedStock) ? item.countedStock : 0), 0);
  const totalDiferencia = items.reduce((acc, item) => acc + (Number.isFinite(item.difference) ? item.difference : 0), 0);
  const itemsWithProduct = items.filter((item) => item.productId);
  const productById = useMemo(() => new Map(products.map((product: any) => [String(product.id), product])), [products]);
  const groupedItems = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; items: AuditItemDraft[] }>();
    items.forEach((item) => {
      const product = productById.get(String(item.productId));
      const categoryId = String(item.categoryId || product?.categoryId || product?.category?.id || BULK_UNCATEGORIZED);
      const categoryName = item.categoryName || product?.category?.name || 'Sin categoría';
      const group = groups.get(categoryId) || { id: categoryId, name: categoryName, items: [] as AuditItemDraft[] };
      group.items.push(item);
      groups.set(categoryId, group);
    });
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [items, productById]);
  const auditRenderRows = useMemo<AuditRenderRow[]>(() => groupedItems.flatMap((group) => [
    { kind: 'category' as const, id: group.id, name: group.name, count: group.items.length },
    ...group.items.map((item) => ({ kind: 'item' as const, id: item.key, item })),
  ]), [groupedItems]);
  const mobileAuditRows = useVirtualAuditRows(auditRenderRows, 150, 620);
  const desktopAuditRows = useVirtualAuditRows(auditRenderRows, 48, 620);
  const missingReasons = itemsWithProduct.some((item) => item.difference !== 0 && !item.reason);
  const canSave = Boolean(form.auditDate && form.warehouseId) && form.supervisors.length > 0 && itemsWithProduct.length > 0 && !missingReasons;

  const updateForm = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  const handleWarehouseChange = (warehouseId: string) => {
    const nextFamilyIds = new Set(warehouseFamilyIds(warehouseId, warehouses, warehouseById));
    const invalidItems = items.filter((item) => {
      const product = productById.get(String(item.productId));
      return product?.id && !productWarehouseIds(product).some((id) => nextFamilyIds.has(id));
    }).length;

    updateForm({ warehouseId });
    setBulkCategoryIds([]);
    setInventoryProductSearch('');
    setInventoryStockFilter('all');
    setItems((current) => current.map((item) => {
      if (!item.productId) return item;
      const product = productById.get(String(item.productId));
      if (!product || !productWarehouseIds(product).some((id) => nextFamilyIds.has(id))) {
        return { ...item, productId: '', variantId: undefined, variantLabel: '', variantSku: '', code: '', name: '', categoryId: undefined, categoryName: undefined, systemStock: 0, countedStock: 0, difference: 0, reason: '' };
      }
      const nextSystemStock = item.variantId
        ? productVariantRows(product, nextFamilyIds).find((variant) => variant.variantId === item.variantId)?.stock || 0
        : productStockForWarehouses(product, nextFamilyIds);
      const nextCountedStock = item.countedStock === item.systemStock ? nextSystemStock : item.countedStock;
      return {
        ...item,
        categoryId: product.categoryId || product.category?.id || BULK_UNCATEGORIZED,
        categoryName: product.category?.name || 'Sin categoría',
        systemStock: nextSystemStock,
        countedStock: nextCountedStock,
        difference: nextCountedStock - nextSystemStock,
        reason: nextCountedStock - nextSystemStock === 0 ? '' : item.reason,
      };
    }));
    if (invalidItems > 0) {
      toast.info('Se limpiaron los productos que no pertenecen al nuevo alcance de la bodega.');
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
    if (!form.warehouseId) { toast.info('Selecciona una bodega antes de agregar productos'); return; }
    if (items.length >= MAX_AUDIT_ITEMS) { toast.error(`Máximo ${MAX_AUDIT_ITEMS} productos por acta`); return; }
    setItems((current) => [...current, {
      key: `item-${Date.now()}-${current.length}`,
      productId: '',
      variantId: undefined,
      variantLabel: '',
      variantSku: '',
      code: '',
      name: '',
      systemStock: 0,
      countedStock: 0,
      difference: 0,
      reason: '',
    }]);
  };

  const removeItem = (key: string) => {
    setItems((current) => current.filter((item) => item.key !== key));
  };

  const makeAuditItem = (product: { id: string; value?: string; variantId?: string; variantLabel?: string; variantSku?: string; code?: string; name?: string; stock?: number; categoryId?: string; categoryName?: string }, index: number): AuditItemDraft => ({
    key: `item-${Date.now()}-${index}-${product.value || product.id}`,
    productId: product.id,
    variantId: product.variantId,
    variantLabel: product.variantLabel,
    variantSku: product.variantSku,
    code: product.code || '',
    name: product.name || '',
    categoryId: product.categoryId || BULK_UNCATEGORIZED,
    categoryName: product.categoryName || 'Sin categoría',
    systemStock: Number(product.stock || 0),
    countedStock: Number(product.stock || 0),
    difference: 0,
    reason: '',
  });

  const addProductsInBulk = async (selectedProducts: typeof productOptions, sourceLabel: string) => {
    if (bulkAdding) return;
    if (!form.warehouseId) {
      toast.info('Selecciona una bodega antes de cargar productos');
      return;
    }
    const existingIds = new Set(items.map((item) => `${item.productId}:${item.variantId || ''}`).filter(Boolean));
    const newProducts = selectedProducts.filter((product) => !existingIds.has(`${product.id}:${product.variantId || ''}`));
    if (newProducts.length === 0) {
      toast.info('Los productos seleccionados ya están en el acta');
      return;
    }
    const availableSlots = Math.max(0, MAX_AUDIT_ITEMS - items.length);
    const productsToAdd = newProducts.slice(0, availableSlots);
    if (productsToAdd.length === 0) {
      toast.error(`Máximo ${MAX_AUDIT_ITEMS} productos por acta`);
      return;
    }
    setBulkAdding(true);
    const batchSize = 80;
    let added = 0;
    try {
      for (let offset = 0; offset < productsToAdd.length; offset += batchSize) {
        const batch = productsToAdd.slice(offset, offset + batchSize);
        setItems((current) => [...current, ...batch.map((product, index) => makeAuditItem(product, current.length + index))]);
        added += batch.length;
        if (offset + batchSize < productsToAdd.length) await yieldToBrowser();
      }
    } finally {
      setBulkAdding(false);
    }
    const skipped = newProducts.length - productsToAdd.length;
    toast.success(`${added} productos agregados ${sourceLabel}${skipped > 0 ? `. Se omitieron ${skipped} por el límite del acta` : ''}`);
  };

  const addAllProducts = () => { void addProductsInBulk(productOptions, 'al acta'); };

  const addFilteredProducts = () => { void addProductsInBulk(filteredProductOptions, 'según los filtros de Inventario'); };

  const selectProduct = (key: string, selection: string) => {
    const product = productOptions.find((p) => p.value === selection || (!p.variantId && p.id === selection));
    setItems((current) => current.map((item) => item.key === key ? {
      ...item,
      productId: product?.id || '',
      variantId: product?.variantId,
      variantLabel: product?.variantLabel || '',
      variantSku: product?.variantSku || '',
      code: product?.code || '',
      name: product?.name || '',
      categoryId: product?.categoryId || BULK_UNCATEGORIZED,
      categoryName: product?.categoryName || 'Sin categoría',
      systemStock: product?.stock || 0,
      countedStock: product?.stock || 0,
      difference: 0,
      reason: '',
    } : item));
  };

  const updateCounted = (key: string, value: number) => {
    setItems((current) => current.map((item) => {
      if (item.key !== key) return item;
      const difference = value - item.systemStock;
      return {
        ...item,
        countedStock: value,
        difference,
        reason: difference > 0 ? 'SURPLUS' : difference === 0 || (difference < 0 && item.reason === 'SURPLUS') ? '' : item.reason,
      };
    }));
  };

  const updateReason = (key: string, value: string) => {
    setItems((current) => current.map((item) => item.key === key ? { ...item, reason: value } : item));
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

  const auditStatusLabel = (status?: string): string => {
    const s = String(status || 'OPEN').toUpperCase();
    const labels: Record<string, string> = {
      PENDING: 'PENDIENTE',
      OPEN: 'ABIERTO',
      IN_PROGRESS: 'EN CONTEO',
      CLOSED: 'CERRADO',
      APPROVED: 'APROBADO',
      CANCELLED: 'CANCELADO',
      REOPENED: 'REABIERTO',
      ADJUSTMENT_PENDING: 'AJUSTE PENDIENTE',
      COMPLETED: 'ABIERTO',
    };
    return labels[s] || s;
  };

  const auditStatusBadgeClass = (status?: string): string => {
    const s = String(status || 'OPEN').toUpperCase();
    const classes: Record<string, string> = {
      PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
      OPEN: 'bg-gray-100 text-gray-700 border-gray-200',
      IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
      CLOSED: 'bg-orange-100 text-orange-700 border-orange-200',
      APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      CANCELLED: 'bg-red-100 text-red-700 border-red-200',
      REOPENED: 'bg-purple-100 text-purple-700 border-purple-200',
      ADJUSTMENT_PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
      COMPLETED: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return classes[s] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const handleWorkflow = async (audit: any, targetStatus: string) => {
    if (targetStatus === 'CANCELLED' ? !canDeleteAudits : !canApproveAudits) return;
    const labels: Record<string, string> = {
      IN_PROGRESS: 'iniciar el conteo',
      CLOSED: 'cerrar el conteo',
      APPROVED: 'aprobar las diferencias',
      REOPENED: 'reabrir el conteo',
      CANCELLED: 'cancelar',
    };
    const label = labels[targetStatus] || targetStatus;
    if (!window.confirm(`¿${label.charAt(0).toUpperCase() + label.slice(1)} del acta ${audit.number}?`)) return;

    // Before closing or approving, show the physical-vs-theoretical
    // comparison so the user can see exactly what will be adjusted.
    if ((targetStatus === 'CLOSED' || targetStatus === 'APPROVED') && audit.snapshotAt) {
      setComparisonAudit(audit);
      setComparisonTargetStatus(targetStatus as 'CLOSED' | 'APPROVED');
      setComparisonReasons(Object.fromEntries(normalizeAuditItems(audit.items).map((item: any, index: number) => {
        const systemStock = Number(item.originalSystemStock ?? item.systemStock ?? item.snapshotStock ?? item.theoreticalStock ?? 0);
        const countedStock = Number(item.countedStock ?? 0);
        const difference = countedStock - systemStock;
        return [auditItemKey(item, index), String(item.reason || (difference > 0 ? 'SURPLUS' : ''))];
      })));
      setLoadingTheoretical(true);
      try {
        const items = await inventoryService.getAuditTheoretical(audit.id);
        setTheoreticalItems(Array.isArray(items) ? items : normalizeAuditItems(items));
      } catch {
        setTheoreticalItems(normalizeAuditItems(audit.items));
      } finally {
        setLoadingTheoretical(false);
      }
      return;
    }

    try {
      setWorkflowLoading(audit.id);
      if (targetStatus === 'APPROVED') {
        await inventoryService.approveAudit(audit.id);
      } else {
        await inventoryService.changeAuditStatus(audit.id, targetStatus);
      }
      toast.success(`Acta ${audit.number}: ${label} exitoso`);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || `No se pudo ${label}`);
    } finally {
      setWorkflowLoading(null);
    }
  };

  const confirmCloseAndApprove = async () => {
    if (!comparisonAudit) return;
    if (hasMissingComparisonReasons()) {
      toast.error('Selecciona el motivo de cada diferencia antes de aplicar el ajuste');
      return;
    }
    const adjustmentItems = getComparisonAdjustmentItems();
    try {
      setWorkflowLoading(comparisonAudit.id);
      // When the dialog was opened from IN_PROGRESS, close first. If the act
      // was already CLOSED, approve directly.
      if (comparisonAudit.status !== 'CLOSED') {
        await inventoryService.changeAuditStatus(comparisonAudit.id, 'CLOSED', adjustmentItems);
      }
      // Then approve
      await inventoryService.approveAudit(comparisonAudit.id, adjustmentItems);
      toast.success(`Acta ${comparisonAudit.number}: ajuste generado como borrador; debe aprobarse desde el panel autorizado`);
      setComparisonAudit(null);
      setComparisonReasons({});
      setTheoreticalItems([]);
      setComparisonTargetStatus('CLOSED');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo aprobar las diferencias');
    } finally {
      setWorkflowLoading(null);
    }
  };

  const confirmCloseOnly = async () => {
    if (!comparisonAudit) return;
    if (hasMissingComparisonReasons()) {
      toast.error('Selecciona el motivo de cada diferencia antes de cerrar el conteo');
      return;
    }
    const adjustmentItems = getComparisonAdjustmentItems();
    try {
      setWorkflowLoading(comparisonAudit.id);
      if (comparisonAudit.status !== 'CLOSED') {
        await inventoryService.changeAuditStatus(comparisonAudit.id, 'CLOSED', adjustmentItems);
      }
      toast.success(`Acta ${comparisonAudit.number}: conteo cerrado`);
      setComparisonAudit(null);
      setComparisonReasons({});
      setTheoreticalItems([]);
      setComparisonTargetStatus('CLOSED');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo cerrar el conteo');
    } finally {
      setWorkflowLoading(null);
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
    setComparisonReasons({});
    setBulkCategoryIds([]);
    setInventoryProductSearch('');
    setInventoryStockFilter('all');
  };

  const closeCreateView = () => {
    setIsCreating(false);
    resetForm();
  };

  const renderAuditMobileRow = (row: AuditRenderRow) => {
    if (row.kind === 'category') {
      return <div key={`mobile-category-${row.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2">
        <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-primary">Categoría</p><p className="truncate text-xs font-bold">{row.name}</p></div>
        <Badge variant="outline" className="shrink-0 text-[9px]">{row.count} productos</Badge>
      </div>;
    }
    const item = row.item;
    return <div key={item.key} className="min-w-0 rounded-xl border border-border/50 bg-muted/10 p-3">
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Producto / variante</Label>
          <Select value={auditItemSelectionValue(item)} onValueChange={(v) => selectProduct(item.key, v)} disabled={!form.warehouseId}>
            <SelectTrigger className="h-9 w-full min-w-0 text-[10px]"><SelectValue placeholder={form.warehouseId ? 'Selecciona un producto' : 'Selecciona una bodega'} /></SelectTrigger>
            <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">{productOptionItems.length > 0 ? productOptionItems : <SelectItem value="__empty_mobile__" disabled className="text-[10px]">No hay coincidencias con estos filtros</SelectItem>}</SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="icon" aria-label="Quitar producto" className="mt-5 size-8 shrink-0 hover:text-destructive" onClick={() => removeItem(item.key)}><X className="size-3.5" /></Button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-3">
        <div><p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Stock sistema</p><p className="mt-1 font-mono text-xs tabular-nums">{fmtQty(item.systemStock)}</p></div>
        <div><Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Contado</Label><Input type="number" min={0} value={Number.isFinite(item.countedStock) ? item.countedStock : ''} onChange={(e) => updateCounted(item.key, Number(e.target.value))} className="mt-1 h-8 w-full text-right font-mono text-xs" /></div>
        <div className="text-right"><p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Diferencia</p><p className={cn('mt-2 font-mono text-xs font-bold tabular-nums', item.difference < 0 ? 'text-red-600' : item.difference > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>{item.difference > 0 ? '+' : ''}{fmtQty(item.difference)}</p></div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/40 pt-3">
        <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Motivo</Label>
        <AuditReasonSelect value={item.reason} onChange={(value) => updateReason(item.key, value)} disabled={item.difference === 0} />
      </div>
    </div>;
  };

  const renderAuditDesktopRow = (row: AuditRenderRow) => {
    if (row.kind === 'category') {
      return <TableRow key={`desktop-category-${row.id}`} className="bg-primary/5 hover:bg-primary/5"><TableCell colSpan={6} className="py-2"><div className="flex items-center justify-between gap-3"><span className="text-[9px] font-black uppercase tracking-widest text-primary">{row.name}</span><Badge variant="outline" className="text-[9px]">{row.count} productos</Badge></div></TableCell></TableRow>;
    }
    const item = row.item;
    return <TableRow key={item.key}>
      <TableCell className="min-w-[260px]"><Select value={auditItemSelectionValue(item)} onValueChange={(v) => selectProduct(item.key, v)} disabled={!form.warehouseId}><SelectTrigger className="h-8 min-w-0 text-[10px]"><SelectValue placeholder={form.warehouseId ? 'Selecciona un producto o variante' : 'Selecciona una bodega'} /></SelectTrigger><SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">{productOptionItems.length > 0 ? productOptionItems : <SelectItem value="__empty_desktop__" disabled className="text-[10px]">No hay coincidencias con estos filtros</SelectItem>}</SelectContent></Select></TableCell>
      <TableCell className="text-right"><span className="font-mono text-xs text-muted-foreground">{fmtQty(item.systemStock)}</span></TableCell>
      <TableCell className="text-right"><Input type="number" min={0} value={Number.isFinite(item.countedStock) ? item.countedStock : ''} onChange={(e) => updateCounted(item.key, Number(e.target.value))} className="ml-auto h-8 w-28 text-right font-mono text-xs" /></TableCell>
      <TableCell className="text-right"><span className={cn('font-mono text-xs font-bold', item.difference < 0 ? 'text-red-600' : item.difference > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>{item.difference > 0 ? '+' : ''}{fmtQty(item.difference)}</span></TableCell>
      <TableCell><AuditReasonSelect value={item.reason} onChange={(value) => updateReason(item.key, value)} disabled={item.difference === 0} /></TableCell>
      <TableCell className="text-right"><Button variant="ghost" size="icon" aria-label="Quitar producto" className="size-7 hover:text-destructive" onClick={() => removeItem(item.key)}><X className="size-3.5" /></Button></TableCell>
    </TableRow>;
  };

  const handleSave = async () => {
    if (!canCreateAudits) return;
    if (!form.auditDate) { toast.error('Indica la fecha y hora de la inspección'); return; }
    if (!form.warehouseId) { toast.error('Selecciona la bodega de la inspección'); return; }
    if (form.supervisors.length === 0) { toast.error('Indica al menos un encargado del proceso'); return; }
    if (itemsWithProduct.length === 0) { toast.error('Agrega al menos un producto al acta'); return; }
    if (missingReasons) { toast.error('Selecciona el motivo de cada diferencia antes de guardar el acta'); return; }
    const duplicateLines = new Set<string>();
    const seenLines = new Set<string>();
    itemsWithProduct.forEach((item) => {
      const lineKey = `${item.productId}:${item.variantId || ''}`;
      if (seenLines.has(lineKey)) duplicateLines.add(lineKey);
      seenLines.add(lineKey);
    });
    if (duplicateLines.size > 0) { toast.error('No repitas el mismo producto y variante dentro del acta'); return; }
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
        items: itemsWithProduct.map((item) => {
          const product = productById.get(String(item.productId));
          const ownVariants = Array.isArray(product?.variants) ? product.variants : [];
          const ownVariantIds = new Set(ownVariants.map((variant: any) => String(variant?.id || '').trim()).filter(Boolean));
          // Los productos normales tienen una única variante técnica
          // "Estándar". Si un nivel de inventario combinado dejó un id viejo
          // en la línea, usa la variante propia del producto.
          const variantId = item.variantId && ownVariantIds.has(String(item.variantId))
            ? String(item.variantId)
            : ownVariants.length === 1
              ? String(ownVariants[0].id)
              : undefined;
          const ownedVariant = variantId ? ownVariants.find((variant: any) => String(variant?.id) === variantId) : null;
          return {
            productId: item.productId,
            ...(variantId ? { variantId, variantName: ownedVariant?.name || item.variantLabel || null, variantSku: ownedVariant?.sku || item.variantSku || null } : {}),
            code: item.code,
            name: item.name,
            systemStock: item.systemStock,
            countedStock: item.countedStock,
            difference: item.countedStock - item.systemStock,
            reason: item.difference !== 0 ? item.reason : null,
          };
        }),
      });
      toast.success('Acta registrada como pendiente. Genera el ajuste desde el tab Ajustes.');
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
    if (!canDeleteAudits) return;
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
  const detailAuditItems = normalizeAuditItems(detailAudit?.items).map((item: any) => {
    const systemStock = Number(item.originalSystemStock ?? item.systemStock ?? item.snapshotStock ?? item.theoreticalStock ?? 0);
    const countedStock = Number(item.countedStock ?? 0);
    return {
      ...item,
      systemStock,
      countedStock,
      // Recalculate from the preserved values so old actas with a stale or
      // zero `difference` field still show the real result of the inspection.
      difference: countedStock - systemStock,
    };
  });
  const detailAuditApproved = String(detailAudit?.status || '').toUpperCase() === 'APPROVED';
  const comparisonItems = useMemo(() => {
    const source = theoreticalItems.length > 0 ? theoreticalItems : normalizeAuditItems(comparisonAudit?.items);
    return source.map((item: any, index: number) => {
      const theoreticalStock = Number(item.theoreticalStock ?? item.systemStock ?? item.snapshotStock ?? 0);
      const countedStock = Number(item.countedStock ?? 0);
      const difference = Number.isFinite(Number(item.difference))
        ? Number(item.difference)
        : countedStock - theoreticalStock;
      const key = auditItemKey(item, index);
      const reason = Object.prototype.hasOwnProperty.call(comparisonReasons, key)
        ? comparisonReasons[key]
        : String(item.reason || (difference > 0 ? 'SURPLUS' : ''));
      return { ...item, theoreticalStock, countedStock, difference, reason };
    });
  }, [comparisonAudit, comparisonReasons, theoreticalItems]);
  const comparisonDifferences = comparisonItems.filter((item: any) => item.difference !== 0);
  const comparisonShortages = comparisonDifferences.filter((item: any) => item.difference < 0);
  const comparisonSurpluses = comparisonDifferences.filter((item: any) => item.difference > 0);
  const getComparisonAdjustmentItems = () => comparisonDifferences
    .map((item: any) => ({ productId: String(item.productId || ''), reason: item.reason || null }))
    .filter((item) => item.productId);
  const hasMissingComparisonReasons = () => comparisonDifferences.some((item: any) => item.difference < 0 && !item.reason);
  const closeComparisonDialog = () => {
    if (workflowLoading) return;
    setComparisonAudit(null);
    setComparisonReasons({});
    setTheoreticalItems([]);
    setComparisonTargetStatus('CLOSED');
  };

  const closeWithoutApproval = async () => {
    if (comparisonTargetStatus === 'APPROVED') {
      closeComparisonDialog();
      return;
    }
    await confirmCloseOnly();
  };

  const renderAuditActions = (audit: any, mobile = false) => (
    <div className={cn('flex items-center gap-1', mobile ? 'flex-wrap justify-start' : 'justify-end')}>
      {canDeleteAudits && (audit.status === 'OPEN' || audit.status === 'COMPLETED') && (
        <Button
            variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-red-50 hover:text-red-600"
            disabled={workflowLoading === audit.id}
            onClick={() => handleWorkflow(audit, 'CANCELLED')}
            title="Cancelar" aria-label="Cancelar auditoría"
          >
            <XCircle className="size-4" />
        </Button>
      )}
      {canApproveAudits && audit.status === 'IN_PROGRESS' && (
        <Button
          variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-orange-50 hover:text-orange-600"
          disabled={workflowLoading === audit.id}
          onClick={() => handleWorkflow(audit, 'CLOSED')}
          title="Cerrar conteo" aria-label="Cerrar conteo"
        >
          <PauseCircle className="size-4" />
        </Button>
      )}
      {canApproveAudits && audit.status === 'CLOSED' && (
        <>
          <Button
            variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-emerald-50 hover:text-emerald-600"
            disabled={workflowLoading === audit.id}
            onClick={() => handleWorkflow(audit, 'APPROVED')}
            title="Aprobar diferencias" aria-label="Aprobar diferencias"
          >
            <CheckCircle2 className="size-4" />
          </Button>
          <Button
            variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-purple-50 hover:text-purple-600"
            disabled={workflowLoading === audit.id}
            onClick={() => handleWorkflow(audit, 'REOPENED')}
            title="Reabrir" aria-label="Reabrir auditoría"
          >
            <RotateCcw className="size-4" />
          </Button>
        </>
      )}
      <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setDetailAudit(audit)} title="Ver detalle" aria-label="Ver detalle">
        <Eye className="size-4" />
      </Button>
      {canDeleteAudits && (audit.status === 'PENDING' || audit.status === 'OPEN' || audit.status === 'COMPLETED' || audit.status === 'CANCELLED') && (
        <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-destructive/10 hover:text-destructive" disabled={deletingId === audit.id} onClick={() => handleDelete(audit)} title="Eliminar" aria-label="Eliminar auditoría">
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );

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
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center" data-tour="inventory-audit-form-actions">
            <InventoryViewTutorial
              label="Cómo registrar una auditoría"
              targetPrefix="inventory-audit-form"
              stepKeys={['title', 'data', 'items', 'actions']}
              copy={{
                title: {
                  title: '1. Empieza la revisión',
                  description: 'Una auditoría es como hacer una lista para comprobar cuántas cosas hay en una bodega. Aquí revisarás los productos uno por uno.',
                },
                data: {
                  title: '2. Completa los datos',
                  description: 'Elige la fecha, la bodega y las personas que harán el conteo. También puedes subir el acta o escribir una nota para dejar una explicación.',
                },
                items: {
                  title: '3. Carga los productos',
                  description: 'Primero elige una bodega. Puedes agregar un producto por producto pulsando el botón Agregar producto, o buscar varios con Categorías y Existencia. Pulsa Agregar filtrados para agregar lo que ves, o Agregar todos para agregar toda la lista.',
                  tip: 'Cuando los productos estén abajo, escribe cuánto contaste de cada uno en Cantidad contada. El sistema comparará ese número con el que tenía guardado.',
                },
                actions: {
                  title: '4. Escribe y guarda',
                  description: 'Revisa los números. Si todo está listo, pulsa Registrar acta. El sistema guardará la revisión y calculará las diferencias automáticamente.',
                },
              }}
            />
            <Button variant="outline" onClick={closeCreateView} className="w-full rounded-xl text-xs font-bold sm:w-auto">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || bulkAdding || !canSave} className="w-full gap-2 rounded-xl bg-primary text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 sm:w-auto">
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
                <p className="text-xs text-muted-foreground">Completa los responsables, la bodega y las observaciones.</p>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Fecha y hora de la inspección</Label>
                <Input type="datetime-local" value={form.auditDate} onChange={(e) => updateForm({ auditDate: e.target.value })} className="h-10 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Bodega</Label>
                <Select value={form.warehouseId} onValueChange={handleWarehouseChange}>
                  <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Seleccionar bodega" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id} className="max-w-full text-xs">{warehouseLabel(w)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {selectedWarehouse && (
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    {selectedWarehouseFamilyIds.length > 1
                      ? <>Alcance compartido: <span className="font-semibold text-foreground">{selectedWarehouseFamilyNames.join(', ')}</span>. Se suman padre e hijos para esta inspección.</>
                      : 'Esta bodega no tiene bodegas padre o hijas relacionadas.'}
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
                <Button variant="outline" size="sm" disabled={!form.warehouseId || bulkAdding} className="h-8 gap-1 text-[10px]" onClick={addItem}>
                  <Plus className="size-3.5" /> Agregar producto
                </Button>
              </div>
            <div className="min-w-0 space-y-3 p-3">
                <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ListPlus className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[10px] font-black uppercase tracking-widest">Cargar desde Inventario</p>
                          <Badge variant="outline" className="border-primary/20 bg-background/60 text-[9px] text-primary">{filteredProductOptions.length} visibles</Badge>
                        </div>
                        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                          Primero elige una bodega. Luego busca un producto o usa los filtros para encontrarlo. Pulsa un botón de Agregar y después escribe cuánto contaste.
                        </p>
                      </div>
                    </div>

                    <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_10rem_10rem_auto]">
                      <div className="min-w-0 space-y-1">
                        <Label className="flex h-4 items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground"><Search className="size-3" /> Buscar producto</Label>
                        <Input
                          value={inventoryProductSearch}
                          onChange={(event) => setInventoryProductSearch(event.target.value)}
                          placeholder="Código o nombre..."
                          disabled={!form.warehouseId}
                          className="h-8 w-full rounded-md bg-background/80 text-xs"
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Label className="flex h-4 min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          <span className="shrink-0">Categorías</span>
                          <span className="truncate text-[8px] font-medium normal-case tracking-normal">(puedes elegir varias)</span>
                        </Label>
                        <MultiSelectFilter
                          options={productCategoryOptions.map((category) => ({ value: category.id, label: category.name }))}
                          selected={bulkCategoryIds}
                          onChange={setBulkCategoryIds}
                          label="Todas"
                          placeholder="Buscar categorías..."
                          searchable
                          className="h-8 w-full justify-between rounded-md bg-background/80 px-2 text-[10px]"
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Label className="flex h-4 items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground"><SlidersHorizontal className="size-3" /> Existencia</Label>
                        <Select value={inventoryStockFilter} onValueChange={(value: 'all' | 'available' | 'out') => setInventoryStockFilter(value)} disabled={!form.warehouseId}>
                          <SelectTrigger className="!h-8 min-w-0 rounded-md bg-background/80 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all" className="text-[10px]">Con y sin existencia</SelectItem>
                            <SelectItem value="available" className="text-[10px]">Con existencia</SelectItem>
                            <SelectItem value="out" className="text-[10px]">Sin existencia</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!form.warehouseId || (!inventoryProductSearch && bulkCategoryIds.length === 0 && inventoryStockFilter === 'all')}
                        className="h-8 gap-1.5 self-end text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => { setInventoryProductSearch(''); setBulkCategoryIds([]); setInventoryStockFilter('all'); }}
                      >
                        <RotateCcw className="size-3.5" /> Limpiar
                      </Button>
                    </div>

                    <div className="flex min-w-0 flex-col gap-2 border-t border-primary/10 pt-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 text-[10px] text-muted-foreground">
                        {form.warehouseId
                          ? <><span className="font-semibold text-foreground">{selectedWarehouse?.name || 'Bodega seleccionada'}</span><span className="mx-1.5">·</span>Mostrando {filteredProductOptions.length} de {productOptions.length} productos del Inventario.{bulkCategoryIds.length > 0 ? ` ${bulkCategoryIds.length} categorías seleccionadas.` : ''}</>
                          : 'Selecciona una bodega arriba para cargar sus productos.'}
                      </div>
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                        <Button type="button" variant="outline" size="sm" disabled={!form.warehouseId || bulkAdding || filteredProductOptions.length === 0} className="h-8 gap-1.5 text-[10px]" onClick={addFilteredProducts}>
                          <ListPlus className="size-3.5" /> {bulkAdding ? 'Agregando...' : `Agregar filtrados (${filteredProductOptions.length})`}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" disabled={!form.warehouseId || bulkAdding || productOptions.length === 0} className="h-8 gap-1.5 text-[10px]" onClick={addAllProducts}>
                          <ListPlus className="size-3.5" /> {bulkAdding ? 'Agregando...' : `Agregar todos (${productOptions.length})`}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                {isMobile ? (
                  <div className="max-h-[620px] overflow-auto" onScroll={mobileAuditRows.onScroll}>
                    <div style={{ height: mobileAuditRows.topSpacer }} aria-hidden="true" />
                    <div className="space-y-3">
                      {mobileAuditRows.rows.map(renderAuditMobileRow)}
                    </div>
                    <div style={{ height: mobileAuditRows.bottomSpacer }} aria-hidden="true" />
                    {items.length === 0 && <p className="py-6 text-center text-[10px] text-muted-foreground">Agrega productos al acta para registrar el conteo físico.</p>}
                  </div>
                ) : (
                  <div className="max-h-[620px] overflow-auto" onScroll={desktopAuditRows.onScroll}>
                    <Table containerClassName="overflow-x-auto" className="min-w-[680px]">
                    <TableHeader><TableRow><TableHead className="text-[9px] font-black uppercase tracking-widest">Producto</TableHead><TableHead className="text-right text-[9px] font-black uppercase tracking-widest">Stock sistema</TableHead><TableHead className="text-right text-[9px] font-black uppercase tracking-widest">Cantidad contada</TableHead><TableHead className="text-right text-[9px] font-black uppercase tracking-widest">Diferencia</TableHead><TableHead className="text-[9px] font-black uppercase tracking-widest">Motivo</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                      <TableBody>
                        <TableRow><TableCell colSpan={6} style={{ height: desktopAuditRows.topSpacer }} aria-hidden="true" /></TableRow>
                        {desktopAuditRows.rows.map(renderAuditDesktopRow)}
                        <TableRow><TableCell colSpan={6} style={{ height: desktopAuditRows.bottomSpacer }} aria-hidden="true" /></TableRow>
                        {items.length === 0 && <TableRow><TableCell colSpan={6} className="py-6 text-center text-[10px] text-muted-foreground">Agrega productos al acta para registrar el conteo físico.</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                )}
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
        <div className="erp-list-toolbar flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center" data-tour="inventory-audits-actions">
          <InventoryViewTutorial label="Cómo gestionar auditorías" targetPrefix="inventory-audits" copy={{ data: { description: 'Consulta las actas, inspecciones, responsables, bodegas y productos revisados.' }, actions: { description: 'Crea una nueva auditoría o abre el detalle de un acta existente.' } }} />
          {canCreateAudits && <Button onClick={() => setIsCreating(true)} data-toolbar-role="primary" className="h-10 w-full gap-2 rounded-xl border border-primary/20 bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 sm:w-auto">
            <Plus className="size-4" /> Nueva Auditoría
          </Button>}
        </div>
      </div>

      <Card className="rounded-2xl border-border/50" data-tour="inventory-audits-data">
        <CardContent className="p-0">
          <div className="space-y-3 p-3 lg:hidden">
            {audits.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">No hay actas de inspección registradas.</div>
            ) : audits.map((audit) => {
              const itemCount = normalizeAuditItems(audit.items).length;
              const warehouse = warehouses.find((w: any) => w.id === audit.warehouseId);
              return (
                <div key={audit.id} className="min-w-0 rounded-2xl border border-border/50 bg-card p-3 shadow-sm">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-bold">{audit.number}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {audit.auditDate ? new Date(audit.auditDate).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                      </p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-[9px] font-bold ${auditStatusBadgeClass(audit.status)}`}>
                      {auditStatusLabel(audit.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-xs">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Encargado</p>
                      <p className="mt-1 break-words font-medium">{auditParticipantNames(audit, 'supervisor') || '—'}</p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Usuario bodega</p>
                      <p className="mt-1 break-words font-medium">{auditParticipantNames(audit, 'stockKeeper') || '—'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Bodega</p>
                      <p className="mt-1 truncate font-medium">{warehouse?.name || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Productos</p>
                      <p className="mt-1 font-mono font-bold">{itemCount}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
                    {audit.actaUri ? (
                      <Button variant="outline" size="sm" className="h-8 max-w-full gap-1.5 rounded-lg text-[10px] text-primary" onClick={() => openActa(audit.actaUri)}>
                        <Paperclip className="size-3.5 shrink-0" /> <span className="max-w-[180px] truncate">{audit.actaFileName || 'Acta adjunta'}</span>
                      </Button>
                    ) : <span className="text-[10px] text-muted-foreground/50">Sin acta adjunta</span>}
                    {renderAuditActions(audit, true)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto lg:block">
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Acta</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha y hora</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Encargado</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Usuario Bodega</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Bodega</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Productos</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Acta adjunta</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audits.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-xs text-muted-foreground">No hay actas de inspección registradas.</TableCell></TableRow>
              ) : audits.map((audit) => {
                const itemCount = normalizeAuditItems(audit.items).length;
                const warehouse = warehouses.find((w: any) => w.id === audit.warehouseId);
                return (
                <TableRow key={audit.id}>
                  <TableCell>
                    <span className="font-mono text-xs font-bold">{audit.number}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[9px] font-bold border ${auditStatusBadgeClass(audit.status)}`}>
                      {auditStatusLabel(audit.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {audit.auditDate ? new Date(audit.auditDate).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                  </TableCell>
                  <TableCell className="max-w-[240px] text-xs" title={auditParticipantNames(audit, 'supervisor')}>{auditParticipantNames(audit, 'supervisor') || '—'}</TableCell>
                  <TableCell className="max-w-[240px] text-xs" title={auditParticipantNames(audit, 'stockKeeper')}>{auditParticipantNames(audit, 'stockKeeper') || '—'}</TableCell>
                  <TableCell className="text-xs">{warehouse?.name || audit.warehouseId ? (warehouse?.name || '—') : '—'}</TableCell>
                  <TableCell className="w-20 text-right text-xs tabular-nums">
                    <Badge variant="outline" className="text-[9px] font-bold">{itemCount}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[230px] text-right">
                    {audit.actaUri ? (
                      <Button variant="ghost" size="sm" className="h-7 max-w-[230px] gap-1.5 rounded-lg text-primary" onClick={() => openActa(audit.actaUri)}>
                        <Paperclip className="size-3.5 shrink-0" /> <span className="truncate">{audit.actaFileName || 'Acta'}</span>
                      </Button>
                    ) : <span className="text-[10px] text-muted-foreground/50">Sin adjunto</span>}
                  </TableCell>
                  <TableCell className="w-[110px] text-right">
                    {renderAuditActions(audit)}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
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

      <Dialog open={!!comparisonAudit} onOpenChange={(open) => { if (!open) closeComparisonDialog(); }}>
        <DialogContent className="w-[calc(100vw-2rem)] !max-w-4xl min-w-0 max-h-[min(88vh,calc(100dvh-3rem))] overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
              <AlertTriangle className="size-5 text-amber-500" />
              Revisar diferencias de {comparisonAudit?.number || 'auditoría'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Compara el stock teórico con el conteo físico antes de cerrar y aplicar cualquier ajuste.
            </DialogDescription>
          </DialogHeader>

          {loadingTheoretical ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" /> Calculando stock teórico...
            </div>
          ) : (
            <div className="min-w-0 space-y-4">
              <div className={cn(
                'flex min-w-0 gap-3 rounded-xl border p-3 text-xs',
                comparisonDifferences.length > 0
                  ? 'border-amber-300 bg-amber-50 text-amber-950'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-950',
              )}>
                {comparisonDifferences.length > 0 ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />}
                <div className="min-w-0">
                  <p className="font-bold">
                    {comparisonDifferences.length > 0
                      ? `Se detectaron ${comparisonDifferences.length} producto(s) con diferencia.`
                      : 'No hay diferencias entre el conteo físico y el stock teórico.'}
                  </p>
                  <p className="mt-1 leading-relaxed opacity-80">
                    {comparisonDifferences.length > 0
                      ? 'Al confirmar, los faltantes se restarán del stock y los sobrantes se sumarán. Cerrar sin aprobar no modifica existencias.'
                      : 'Puedes aprobar el acta para dejar constancia. No se generará ningún movimiento de ajuste.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Productos revisados</p>
                  <p className="mt-1 text-lg font-black tabular-nums">{comparisonItems.length}</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-red-700">Faltantes · se restan</p>
                  <p className="mt-1 text-lg font-black tabular-nums text-red-700">
                    {fmtQty(comparisonShortages.reduce((total, item) => total + Math.abs(item.difference), 0))}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Sobrantes · se suman</p>
                  <p className="mt-1 text-lg font-black tabular-nums text-emerald-700">
                    {fmtQty(comparisonSurpluses.reduce((total, item) => total + item.difference, 0))}
                  </p>
                </div>
              </div>

              <div className="min-w-0 overflow-x-auto rounded-xl border border-border/50">
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest">Producto</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase tracking-widest">Stock teórico</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase tracking-widest">Físico</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase tracking-widest">Diferencia</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest">Motivo del ajuste</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest">Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonItems.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">No hay productos para comparar.</TableCell></TableRow>
                    ) : comparisonItems.map((item: any, index: number) => (
                      <TableRow key={`${item.productId || item.code || 'item'}-${index}`}>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">{item.name || 'Producto sin nombre'}{(item.variantName || item.variantLabel) ? ` · ${item.variantName || item.variantLabel}` : ''}</p>
                            <p className="font-mono text-[10px] text-muted-foreground">{item.variantSku || item.code || '—'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{fmtQty(item.theoreticalStock)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{fmtQty(item.countedStock)}</TableCell>
                        <TableCell className={cn('text-right font-mono text-xs font-bold', item.difference < 0 ? 'text-red-600' : item.difference > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
                          {item.difference > 0 ? '+' : ''}{fmtQty(item.difference)}
                        </TableCell>
                        <TableCell>
                          <AuditReasonSelect
                            value={item.reason}
                            onChange={(value) => setComparisonReasons((current) => ({ ...current, [auditItemKey(item, index)]: value }))}
                            disabled={item.difference === 0}
                          />
                        </TableCell>
                        <TableCell>
                          {item.difference < 0 ? <Badge variant="outline" className="border-red-200 bg-red-50 text-[9px] font-bold text-red-700">Faltante · restar {fmtQty(Math.abs(item.difference))}</Badge>
                            : item.difference > 0 ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[9px] font-bold text-emerald-700">Sobrante · sumar {fmtQty(item.difference)}</Badge>
                              : <Badge variant="outline" className="text-[9px] font-bold text-muted-foreground">Sin diferencia</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-border/40 pt-4 sm:flex-row sm:items-center sm:justify-end">
                <Button variant="outline" onClick={closeWithoutApproval} disabled={Boolean(workflowLoading)} className="text-xs">
                  {comparisonTargetStatus === 'APPROVED' ? 'Volver' : 'Cerrar sin aprobar'}
                </Button>
                <Button onClick={confirmCloseAndApprove} disabled={Boolean(workflowLoading)} className="gap-2 bg-primary text-xs text-primary-foreground hover:bg-primary/90">
                  {workflowLoading ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                  {comparisonDifferences.length > 0
                    ? (comparisonTargetStatus === 'APPROVED' ? 'Aprobar y aplicar ajuste' : 'Cerrar y aplicar ajuste')
                    : 'Aprobar auditoría'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailAudit} onOpenChange={(open) => { if (!open) setDetailAudit(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] !max-w-3xl min-w-0 max-h-[min(88vh,calc(100dvh-3rem))] overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          <DialogHeader data-tour="inventory-audit-detail-title">
            <DialogTitle className="text-lg font-black uppercase tracking-tight">
              {detailAudit?.number} · Acta de Inspección
            </DialogTitle>
            <DialogDescription className="text-xs">
              {detailAudit?.auditDate ? new Date(detailAudit.auditDate).toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'short' }) : ''}
            </DialogDescription>
            <InventoryViewTutorial label="Cómo consultar auditoría" targetPrefix="inventory-audit-detail" stepKeys={['title', 'data']} copy={{ data: { description: 'Revisa responsables, bodega, respaldo, observaciones, stock del sistema y diferencias encontradas.' } }} />
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
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Bodega</p>
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
            {detailAuditApproved && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
                <p className="font-bold text-foreground">Trazabilidad del ajuste</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  El stock sistema, el conteo físico y la diferencia corresponden al momento de la auditoría. El stock final muestra el resultado después de aplicar el ajuste.
                </p>
                {detailAudit?.adjustmentId && <p className="mt-1 font-mono text-[10px] text-primary">Ajuste generado: {detailAudit.adjustmentId}</p>}
              </div>
            )}
            {detailAuditItems.length > 0 && (
              <div className="min-w-0 overflow-x-auto rounded-xl border border-border/40">
                <Table containerClassName="overflow-x-auto" className="min-w-[740px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest">Código</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest">Producto</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-right">Stock sistema original</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-right">Contado</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-right">Diferencia</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-right">Stock final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailAuditItems.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-[10px]">{item.code}</TableCell>
                        <TableCell className="text-xs">{item.name}{(item.variantName || item.variantLabel) ? <span className="block text-[10px] text-muted-foreground">{item.variantName || item.variantLabel}</span> : null}</TableCell>
                        <TableCell className="text-right font-mono text-[10px]">{fmtQty(item.systemStock)}</TableCell>
                        <TableCell className="text-right font-mono text-[10px]">{fmtQty(item.countedStock)}</TableCell>
                        <TableCell className={cn('text-right font-mono text-[10px] font-bold', Number(item.difference) < 0 ? 'text-red-600' : Number(item.difference) > 0 ? 'text-emerald-600' : '')}>
                          {Number(item.difference) > 0 ? '+' : ''}{fmtQty(item.difference)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[10px] font-bold text-primary">
                          {detailAuditApproved ? fmtQty(item.adjustedStock ?? item.countedStock) : '—'}
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
