import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Search, Upload, FileDown, Pencil, Trash2,
  ChevronRight, ChevronDown, FolderTree, Building2,
  RefreshCw, X, Loader2, FileSpreadsheet,
  AlertTriangle, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import type { Currency } from '../../types';
import type { AccountDetailType, AccountSubtype, AccountType, ChartAccountCsvRow } from '../../types/accounting';
import { downloadCsv, parseCsvText, templateRows } from '../../utils/chartOfAccountsCsv';
import { useAuth } from '../../contexts/AuthContext';

interface AccountNode {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  balance: number;
  currency: Currency;
  isActive: boolean;
  subtype: AccountSubtype;
  detailType: AccountDetailType;
  allowManualEntry: boolean;
  acceptsPostings?: boolean;
  notes?: string | null;
  children: AccountNode[];
  level: number;
  _count?: { children: number; transactions: number };
}

const ACCOUNT_TYPES: { value: AccountType; label: string; color: string }[] = [
  { value: 'ASSET', label: 'Activo', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'LIABILITY', label: 'Pasivo', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'EQUITY', label: 'Capital', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'INCOME', label: 'Ingreso', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'EXPENSE', label: 'Gasto', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
];

const TYPE_COLOR_MAP: Record<AccountType, string> = {
  ASSET: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  LIABILITY: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  EQUITY: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
  INCOME: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  EXPENSE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
};

const CURRENCIES: Currency[] = ['USD', 'NIO', 'EUR', 'GTQ', 'HNL', 'CRC', 'PAB'];
const ACCOUNT_SUBTYPES: { value: AccountSubtype; label: string }[] = [
  { value: 'MAIN_GROUP', label: 'Grupo principal' },
  { value: 'GROUP', label: 'Grupo' },
  { value: 'DETAIL_ACCOUNT', label: 'Cuenta de detalle' },
  { value: 'SUBACCOUNT', label: 'Subcuenta' },
];
const ACCOUNT_DETAIL_TYPES: { value: AccountDetailType; label: string }[] = [
  { value: 'BALANCE_SHEET', label: 'Balance General' },
  { value: 'INCOME_STATEMENT', label: 'Estado de Resultados' },
];

const INDUSTRIES = [
  { value: 'General', label: 'General' },
  { value: 'Retail', label: 'Comercio Minorista' },
  { value: 'Manufacturing', label: 'Manufactura' },
  { value: 'Services', label: 'Servicios' },
  { value: 'Construction', label: 'Construcción' },
  { value: 'Agriculture', label: 'Agricultura' },
  { value: 'Technology', label: 'Tecnología' },
  { value: 'Healthcare', label: 'Salud' },
  { value: 'Education', label: 'Educación' },
  { value: 'Hospitality', label: 'Hostelería' },
  { value: 'RealEstate', label: 'Bienes Raíces' },
  { value: 'Transportation', label: 'Transporte' },
];

function buildTree(accounts: AccountNode[]): AccountNode[] {
  const map = new Map<string, AccountNode>();
  const roots: AccountNode[] = [];

  for (const acc of accounts) {
    map.set(acc.id, { ...acc, children: [], level: 0 });
  }

  for (const acc of accounts) {
    const node = map.get(acc.id)!;
    if (acc.parentId && map.has(acc.parentId)) {
      map.get(acc.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function assignLevel(nodes: AccountNode[], level: number) {
    for (const n of nodes) {
      n.level = level;
      assignLevel(n.children, level + 1);
    }
  }
  assignLevel(roots, 0);

  return roots;
}

function flattenTree(nodes: AccountNode[]): AccountNode[] {
  const result: AccountNode[] = [];
  for (const n of nodes) {
    result.push(n);
    if (n.children.length > 0) {
      result.push(...flattenTree(n.children));
    }
  }
  return result;
}

export function PlanCuentasView() {
  const { canPerform } = useAuth();
  const { formatConvertedAmount } = useCurrency();

  const [accounts, setAccounts] = useState<AccountNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<AccountNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountNode | null>(null);
  const [formData, setFormData] = useState({
    code: '', name: '', type: 'ASSET' as AccountType,
    parentId: '' as string | undefined, currency: 'USD' as Currency,
    subtype: 'DETAIL_ACCOUNT' as AccountSubtype,
    detailType: 'BALANCE_SHEET' as AccountDetailType,
    allowManualEntry: true, isActive: true, notes: '',
  });
  const [saving, setSaving] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [industry, setIndustry] = useState('');
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [replaceAccounts, setReplaceAccounts] = useState(false);

  const fetchAccounts = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const raw = await contabilidadService.getChartOfAccounts(refresh);
      const tree = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.data) ? (raw as any).data : [];
      const flatten = (items: any[]): any[] => {
        const result: any[] = [];
        for (const item of items) {
          const { children, ...rest } = item;
          result.push(rest);
          if (Array.isArray(children) && children.length > 0) result.push(...flatten(children));
        }
        return result;
      };
      const list = flatten(tree);
      const nodes = list.map((a: any) => ({
        id: a.id, code: a.code ?? '', name: a.name ?? '',
        type: (a.type ?? 'ASSET').toUpperCase() as AccountType,
        parentId: a.parentId ?? null, balance: Number(a.balance ?? 0),
        currency: a.currency ?? 'USD', isActive: a.isActive !== false,
        subtype: a.subtype ?? 'DETAIL_ACCOUNT',
        detailType: a.detailType ?? ((a.type === 'INCOME' || a.type === 'EXPENSE') ? 'INCOME_STATEMENT' : 'BALANCE_SHEET'),
        allowManualEntry: a.allowManualEntry !== false && a.acceptsPostings !== false,
        acceptsPostings: a.acceptsPostings !== false,
        notes: a.notes ?? null,
        children: [], level: 0,
        _count: a._count ?? { children: 0, transactions: 0 },
      }));
      setAccounts(buildTree(nodes));
    } catch (e: any) {
      toast.error(e?.message || 'Error al cargar plan de cuentas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const flatList = useMemo(() => flattenTree(accounts), [accounts]);

  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return flatList;
    const q = searchTerm.toLowerCase();
    const matched = new Set<string>();
    const byNameOrCode = flatList.filter(a =>
      a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)
    );
    for (const a of byNameOrCode) {
      matched.add(a.id);
      let parent = flatList.find(p => p.id === a.parentId);
      while (parent) { matched.add(parent.id); parent = flatList.find(p => p.id === parent!.parentId); }
    }
    const addChildren = (id: string) => {
      const children = flatList.filter(c => c.parentId === id);
      for (const c of children) { matched.add(c.id); addChildren(c.id); }
    };
    for (const a of byNameOrCode) addChildren(a.id);
    return flatList.filter(a => matched.has(a.id));
  }, [flatList, searchTerm]);

  const getTypeLabel = (t: AccountType) => ACCOUNT_TYPES.find(at => at.value === t)?.label ?? t;
  const getSubtypeLabel = (subtype: AccountSubtype) => ACCOUNT_SUBTYPES.find(item => item.value === subtype)?.label ?? subtype;
  const getDetailTypeLabel = (detailType: AccountDetailType) => ACCOUNT_DETAIL_TYPES.find(item => item.value === detailType)?.label ?? detailType;

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getParentOptions = (excludeId?: string): { id: string; label: string; level: number }[] => {
    const buildOptions = (nodes: AccountNode[], prefix: string): { id: string; label: string; level: number }[] => {
      const opts: { id: string; label: string; level: number }[] = [];
      for (const n of nodes) {
        if (n.id === excludeId) continue;
        opts.push({ id: n.id, label: `${prefix}${n.code} - ${n.name}`, level: n.level });
        if (n.children.length > 0) opts.push(...buildOptions(n.children, prefix + '  '));
      }
      return opts;
    };
    return buildOptions(accounts, '');
  };

  const generateCode = async (type: AccountType, parentId?: string) => {
    const typePrefix: Record<AccountType, string> = {
      ASSET: '1', LIABILITY: '2', EQUITY: '3', INCOME: '4', EXPENSE: '5',
    };
    const base = typePrefix[type] || '1';
    if (!parentId) return base + '00001';
    const parent = flatList.find(a => a.id === parentId);
    if (!parent) return base + '00001';
    const siblings = flatList.filter(a => a.parentId === parentId);
    const nextNum = siblings.length + 1;
    return parent.code + String(nextNum).padStart(3, '0');
  };

  const openAddDialog = async (parentId?: string) => {
    setEditingAccount(null);
    const type = 'ASSET';
    const code = await generateCode(type, parentId);
    setFormData({
      code, name: '', type, parentId, currency: 'USD',
      subtype: parentId ? 'SUBACCOUNT' : 'DETAIL_ACCOUNT',
      detailType: 'BALANCE_SHEET', allowManualEntry: true, isActive: true, notes: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (account: AccountNode) => {
    setEditingAccount(account);
    setFormData({
      code: account.code, name: account.name, type: account.type,
      parentId: account.parentId ?? undefined, currency: account.currency,
      subtype: account.subtype, detailType: account.detailType,
      allowManualEntry: account.allowManualEntry, isActive: account.isActive,
      notes: account.notes ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const payload = {
        code: formData.code, name: formData.name.trim(),
        type: formData.type, parentId: formData.parentId || null,
        currency: formData.currency, subtype: formData.subtype,
        detailType: formData.detailType, allowManualEntry: formData.allowManualEntry,
        acceptsPostings: formData.allowManualEntry,
        isActive: formData.isActive, notes: formData.notes.trim() || undefined,
      };
      if (editingAccount) {
        await contabilidadService.updateAccount(editingAccount.id, payload);
        toast.success('Cuenta actualizada');
      } else {
        await contabilidadService.createAccount(payload);
        toast.success('Cuenta creada');
      }
      setDialogOpen(false);
      fetchAccounts(true);
    } catch (e: any) {
      toast.error(e?.message || 'Error al guardar cuenta');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await contabilidadService.deleteAccount(deleteConfirmId);
      toast.success('Cuenta eliminada');
      setDeleteConfirmId(null);
      if (selectedAccount?.id === deleteConfirmId) setSelectedAccount(null);
      fetchAccounts(true);
    } catch (e: any) {
      toast.error(e?.message || 'Error al eliminar cuenta');
    } finally {
      setDeleting(false);
    }
  };

  const loadDefaults = async () => {
    if (!industry) { toast.error('Selecciona una industria'); return; }
    setLoadingDefaults(true);
    try {
      const res = await contabilidadService.importDefaultsWithHierarchy(industry);
      toast.success(res?.message || 'Catálogo importado exitosamente');
      fetchAccounts(true);
    } catch (e: any) {
      toast.error(e?.message || 'Error al cargar cuentas predeterminadas');
    } finally {
      setLoadingDefaults(false);
    }
  };

  const handleExport = async () => {
    try {
      const raw = await contabilidadService.exportAccounts();
      const rows = Array.isArray(raw) ? raw : (raw as any)?.data;
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('El servidor no devolvió cuentas para exportar');
      downloadCsv('plan_cuentas.csv', rows);
      toast.success('Plan de cuentas exportado');
    } catch (e: any) {
      toast.error(e?.message || 'Error al exportar');
    }
  };

  const handleImport = async () => {
    if (!importFile) { toast.error('Selecciona un archivo CSV o Excel'); return; }
    setImporting(true);
    try {
      let csvRows: string[][];
      const fileName = importFile.name.toLowerCase();

      if (fileName.endsWith('.csv')) {
        const text = await importFile.text();
        csvRows = parseCsvText(text);
      } else {
        const buffer = await importFile.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' });
        csvRows = jsonRows.map((row: any) => (Array.isArray(row) ? row : [String(row)]).map(String));
      }

      const nonEmpty = csvRows.filter(row => row.some(cell => String(cell ?? '').trim().length > 0));
      if (nonEmpty.length < 2) { toast.error('El archivo no contiene datos'); return; }
      const headers = (nonEmpty[0] ?? []).map(header => String(header).trim().toLowerCase());
      const rows = nonEmpty.slice(1).map(cols => {
        const row: Record<string, string> = {};
        headers.forEach((header, index) => { row[header] = String(cols[index] ?? '').trim(); });
        return row;
      });

      const valid: ChartAccountCsvRow[] = [];
      const errors: string[] = [];

      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx];
        const rowNum = idx + 2;
        const nombre = r.nombre || r.name || '';
        const codigo = r.codigo || r.code || '';
        const tipoCuenta = r.tipo_cuenta || r.type || r.tipo || 'ASSET';
        const permiteManual = r.permite_manual ?? r.allowmanualentry ?? '1';
        const activa = r.activa ?? r.isactive ?? '1';
        if (!nombre || !codigo) { errors.push(`Fila ${rowNum}: nombre y código son obligatorios`); continue; }
        valid.push({
          codigo, nombre, tipo_cuenta: tipoCuenta,
          subtipo: r.subtipo || r.subtype || 'Cuenta de detalle',
          tipo_detalle: r.tipo_detalle || r.detailtype || '',
          moneda: (r.moneda || r.currency || 'NIO').toUpperCase(),
          codigo_padre: r.codigo_padre || r.parentcode || '',
          permite_manual: permiteManual,
          activa,
          notas: r.notas || r.notes || '',
        });
      }

      if (valid.length > 0) {
        const res: any = await contabilidadService.importAccounts(valid, replaceAccounts);
        const msg = replaceAccounts
          ? `${res?.imported ?? valid.length} importadas, ${res?.removed ?? 0} reemplazadas`
          : `${res?.imported ?? valid.length} cuentas importadas${errors.length > 0 ? ` (${errors.length} errores)` : ''}`;
        toast.success(msg);
        setAccounts([]);
        await fetchAccounts(true);
      } else {
        toast.error('No se encontraron cuentas válidas para importar');
      }
      setImportOpen(false);
      setImportFile(null);
    } catch (e: any) {
      toast.error(e?.message || 'Error al importar');
    } finally {
      setImporting(false);
    }
  };

  const renderTreeRow = (account: AccountNode) => {
    const hasChildren = account.children.length > 0;
    const isExpanded = expandedIds.has(account.id);
    const isSelected = selectedAccount?.id === account.id;

    return (
      <div key={account.id}>
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md transition-colors hover:bg-muted/50',
            isSelected && 'bg-muted ring-1 ring-border',
            !account.isActive && 'opacity-60'
          )}
          style={{ paddingLeft: `${account.level * 24 + 8}px` }}
          onClick={() => setSelectedAccount(account)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); toggleExpand(account.id); }}
            className={cn(
              'flex items-center justify-center w-5 h-5 rounded',
              hasChildren ? 'visible hover:bg-muted' : 'invisible'
            )}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          <span className="font-mono text-xs text-muted-foreground min-w-[90px]">{account.code}</span>
          <span className={cn('flex-1 text-sm truncate', !account.isActive && 'line-through')}>{account.name}</span>
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 font-medium', TYPE_COLOR_MAP[account.type])}>
            {getTypeLabel(account.type)}
          </Badge>
          <span className="text-[10px] text-muted-foreground min-w-[110px] truncate" title={getSubtypeLabel(account.subtype)}>
            {getSubtypeLabel(account.subtype)}
          </span>
          <span className="text-[10px] text-muted-foreground min-w-[110px] truncate" title={getDetailTypeLabel(account.detailType)}>
            {getDetailTypeLabel(account.detailType)}
          </span>
          <Badge variant={account.allowManualEntry ? 'outline' : 'secondary'} className="text-[10px] min-w-[70px] justify-center">
            {account.allowManualEntry ? 'Manual' : 'No manual'}
          </Badge>
          <span className="text-sm font-medium tabular-nums min-w-[100px] text-right">
            {formatConvertedAmount(account.balance, account.currency)}
          </span>
          <Badge variant="outline" className="text-[10px] text-muted-foreground min-w-[40px] justify-center">
            {account.currency}
          </Badge>
          <Badge variant={account.isActive ? 'default' : 'secondary'} className="text-[10px] min-w-[50px] justify-center">
            {account.isActive ? 'Activo' : 'Inactivo'}
          </Badge>

          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {canPerform('ACCOUNTING_CHARTS', 'edit') && (
              <>
                <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEditDialog(account)} title="Editar">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive"
                  onClick={() => setDeleteConfirmId(account.id)}
                  title="Eliminar"
                  disabled={hasChildren || (account._count?.transactions ?? 0) > 0}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
        {hasChildren && isExpanded && account.children.map(child => renderTreeRow(child))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plan de Cuentas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Catálogo de cuentas contables del sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <FileDown className="w-4 h-4 mr-1" /> Exportar
          </Button>
          {canPerform('ACCOUNTING_CHARTS', 'create') && (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-1" /> Importar
            </Button>
          )}
          {canPerform('ACCOUNTING_CHARTS', 'create') && (
            <Button variant="outline" size="sm" onClick={loadDefaults} disabled={loadingDefaults || !industry}>
              {loadingDefaults ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Building2 className="w-4 h-4 mr-1" />}
              Cargar Defaults
            </Button>
          )}
          {canPerform('ACCOUNTING_CHARTS', 'create') && (
            <Button size="sm" onClick={() => openAddDialog()}>
              <Plus className="w-4 h-4 mr-1" /> Nueva Cuenta
            </Button>
          )}
        </div>
      </div>

      {/* Filters & Industry */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger className="w-[220px] h-9">
            <SelectValue placeholder="Industria..." />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map(ind => (
              <SelectItem key={ind.value} value={ind.value}>{ind.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="w-9 h-9" onClick={() => fetchAccounts(true)} title="Recargar">
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Badge variant="secondary" className="ml-auto text-xs">
          {filteredList.length} cuentas
        </Badge>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Tree Table */}
        <div className="xl:col-span-2">
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Jerarquía de Cuentas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FolderTree className="w-10 h-10 mb-2 opacity-40" />
                  <p className="text-sm">{searchTerm ? 'Sin resultados de búsqueda' : 'No hay cuentas registradas'}</p>
                  {!searchTerm && (
                    <Button variant="link" size="sm" onClick={() => openAddDialog()}>
                      Crear primera cuenta
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {/* Header row */}
                  <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
                    <span className="w-5" />
                    <span className="min-w-[90px]">Código</span>
                    <span className="flex-1">Nombre</span>
                    <span className="min-w-[80px]">Tipo</span>
                    <span className="min-w-[110px]">Subtipo</span>
                    <span className="min-w-[110px]">Tipo detalle</span>
                    <span className="min-w-[70px] text-center">Manual</span>
                    <span className="min-w-[100px] text-right">Saldo</span>
                    <span className="min-w-[40px] text-center">Mon</span>
                    <span className="min-w-[50px] text-center">Estado</span>
                    <span className="w-[60px]" />
                  </div>
                  <div className="max-h-[600px] overflow-y-auto">
                    {accounts.map(acc => renderTreeRow(acc))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detail Panel */}
        <div className="xl:col-span-1">
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Detalle de Cuenta</CardTitle>
                </div>
                {selectedAccount && (
                  <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setSelectedAccount(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <Separator />
            {selectedAccount ? (
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Código</p>
                  <p className="text-sm font-mono font-medium">{selectedAccount.code}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Nombre</p>
                  <p className="text-sm font-medium">{selectedAccount.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <Badge variant="outline" className={cn(TYPE_COLOR_MAP[selectedAccount.type])}>
                    {getTypeLabel(selectedAccount.type)}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Subtipo</p>
                  <p className="text-sm">{getSubtypeLabel(selectedAccount.subtype)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Tipo de detalle</p>
                  <p className="text-sm">{getDetailTypeLabel(selectedAccount.detailType)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Moneda</p>
                  <p className="text-sm">{selectedAccount.currency}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <Badge variant={selectedAccount.isActive ? 'default' : 'secondary'}>
                    {selectedAccount.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Captura manual</p>
                  <Badge variant={selectedAccount.allowManualEntry ? 'default' : 'secondary'}>
                    {selectedAccount.allowManualEntry ? 'Permitida' : 'No permitida'}
                  </Badge>
                </div>
                {selectedAccount.notes && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Notas</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedAccount.notes}</p>
                  </div>
                )}
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Saldo Actual</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {formatConvertedAmount(selectedAccount.balance, selectedAccount.currency)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Hijos</p>
                    <p className="text-lg font-bold">{selectedAccount._count?.children ?? selectedAccount.children.length}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Transacciones</p>
                    <p className="text-lg font-bold">{selectedAccount._count?.transactions ?? 0}</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  {canPerform('ACCOUNTING_CHARTS', 'edit') && (
                    <>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(selectedAccount)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                      </Button>
                      <Button
                        variant="outline" size="sm" className="flex-1 text-destructive"
                        onClick={() => setDeleteConfirmId(selectedAccount.id)}
                        disabled={selectedAccount.children.length > 0 || (selectedAccount._count?.transactions ?? 0) > 0}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            ) : (
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Info className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">Selecciona una cuenta</p>
                <p className="text-xs">para ver sus detalles</p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}</DialogTitle>
            <DialogDescription>
              {editingAccount ? 'Modifica los datos de la cuenta contable' : 'Registra una nueva cuenta en el plan de cuentas'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código</Label>
                <Input
                  id="code" value={formData.code}
                  onChange={(e) => setFormData(p => ({ ...p, code: e.target.value }))}
                  placeholder="100001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v: AccountType) => setFormData(p => ({ ...p, type: v }))}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name" value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="Caja General"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parentId">Cuenta Padre</Label>
                <Select
                  value={formData.parentId ?? 'NONE'}
                  onValueChange={(v) => setFormData(p => ({ ...p, parentId: v === 'NONE' ? undefined : v }))}
                >
                  <SelectTrigger id="parentId">
                    <SelectValue placeholder="Ninguna (Raíz)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="NONE">Ninguna (Raíz)</SelectItem>
                    {getParentOptions(editingAccount?.id).map(opt => (
                      <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Moneda</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(v: Currency) => setFormData(p => ({ ...p, currency: v }))}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subtype">Subtipo</Label>
                <Select value={formData.subtype} onValueChange={(value: AccountSubtype) => setFormData(previous => ({ ...previous, subtype: value }))}>
                  <SelectTrigger id="subtype"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_SUBTYPES.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="detailType">Tipo de detalle</Label>
                <Select value={formData.detailType} onValueChange={(value: AccountDetailType) => setFormData(previous => ({ ...previous, detailType: value }))}>
                  <SelectTrigger id="detailType"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_DETAIL_TYPES.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="allowManualEntry">Permite captura manual</Label>
                <p className="text-xs text-muted-foreground">Habilita esta cuenta para asientos manuales.</p>
              </div>
              <Switch id="allowManualEntry" checked={formData.allowManualEntry} onCheckedChange={(checked) => setFormData(previous => ({ ...previous, allowManualEntry: checked }))} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="isActive">Cuenta activa</Label>
                <p className="text-xs text-muted-foreground">Las cuentas inactivas no se pueden usar en nuevos movimientos.</p>
              </div>
              <Switch id="isActive" checked={formData.isActive} onCheckedChange={(checked) => setFormData(previous => ({ ...previous, isActive: checked }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(event) => setFormData(previous => ({ ...previous, notes: event.target.value }))}
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Observaciones de la cuenta"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingAccount ? 'Guardar Cambios' : 'Crear Cuenta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirmar Eliminación
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar esta cuenta? Esta acción no se puede deshacer.
              {deleteConfirmId && (() => {
                const acc = flatList.find(a => a.id === deleteConfirmId);
                return acc ? ` Cuenta: ${acc.code} - ${acc.name}.` : '';
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Importar Cuentas
            </DialogTitle>
            <DialogDescription>
              Descarga la plantilla, completa el archivo CSV (UTF-8) y súbelo. El sistema crea o actualiza por código.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-medium text-foreground">Columnas requeridas</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { key: 'codigo', label: 'Código de la cuenta' },
                  { key: 'nombre', label: 'Nombre' },
                  { key: 'tipo_cuenta', label: 'Activos, Pasivos, Patrimonio…' },
                  { key: 'subtipo', label: 'Grupo, detalle, subcuenta…' },
                  { key: 'tipo_detalle', label: 'Balance General / Resultados' },
                  { key: 'moneda', label: 'Ej. NIO, USD' },
                  { key: 'codigo_padre', label: 'Código del padre (opcional)' },
                  { key: 'permite_manual', label: '1 = sí, 0 = no' },
                  { key: 'activa', label: '1 = activa, 0 = inactiva' },
                  { key: 'notas', label: 'Observaciones (opcional)' },
                ].map((col) => (
                  <div key={col.key} className="rounded-md border bg-background px-2.5 py-2">
                    <p className="font-mono text-[11px] font-semibold text-foreground">{col.key}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">{col.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tip: <span className="font-medium text-foreground">permite_manual</span> y{' '}
                <span className="font-medium text-foreground">activa</span> usan solo <span className="font-mono">1</span> o{' '}
                <span className="font-mono">0</span>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-file">Archivo CSV</Label>
              <Input
                id="import-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <label className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                checked={replaceAccounts}
                onChange={(e) => setReplaceAccounts(e.target.checked)}
                className="rounded border-input size-4"
              />
              <div>
                <p className="text-sm font-medium">Reemplazar cuentas existentes</p>
                <p className="text-xs text-muted-foreground">Elimina cuentas que no están en el archivo importado (solo si no tienen movimientos)</p>
              </div>
            </label>

            <Button variant="outline" size="sm" className="w-full" onClick={() => {
              downloadCsv('plantilla_cuentas.csv', templateRows());
            }}>
              <FileSpreadsheet className="w-4 h-4 mr-1" /> Descargar Plantilla
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportFile(null); }} disabled={importing}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={!importFile || importing}>
              {importing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
