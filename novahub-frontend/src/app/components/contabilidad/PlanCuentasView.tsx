import { useState, useMemo } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import {
  Plus, Search, Upload, FileDown, Pencil,
  ChevronRight, ChevronDown, FolderTree,
  RefreshCw, X, Loader2, FileSpreadsheet, ChevronsDownUp, ChevronsUpDown,
  Info, Activity, ArrowDownLeft, ArrowUpRight,
  ArrowRightLeft,
  ChevronsLeft, ChevronsRight, Settings2, Check, Ban, CircleCheck, Trash2
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
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import type { Currency } from '../../types';
import type { AccountDetailType, AccountSubtype, AccountType, ChartAccountCsvRow } from '../../types/accounting';
import { downloadXlsx, templateRows } from '../../utils/chartOfAccountsCsv';
import { useAuth } from '../../contexts/AuthContext';
import { AccountImportPreview } from './AccountImportPreview';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Combobox } from '../ui/Combobox';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { parseSpreadsheetInWorker } from '../../utils/import-spreadsheet';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';

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

interface AccountTransaction {
  id: string;
  accountId: string;
  date: string;
  description?: string | null;
  reference?: string | null;
  debit: number | string;
  credit: number | string;
  createdAt?: string;
  transferDetails?: {
    id: string;
    number: string;
    origin: { branchName?: string | null; warehouseName: string };
    destination: { branchName?: string | null; warehouseName: string };
  };
}

function readableTransactionDescription(transaction: AccountTransaction): string {
  const description = String(transaction.description || 'Sin descripción');
  const isTransfer = Boolean(transaction.transferDetails)
    || /^Transferencia de inventario\b/i.test(description);
  if (!isTransfer) return description;
  // Compatibilidad con movimientos históricos que conservaron el UUID de la
  // variante/producto. El backend devuelve el nombre cuando puede resolverlo;
  // este filtro evita que el identificador técnico aparezca en el Plan de
  // Cuentas mientras se reparan esos registros.
  return description.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    'Producto',
  );
}

const ACCOUNT_COLUMN_DEFS = [
  { key: 'code', label: 'Código', width: 'minmax(48px,.7fr)' },
  { key: 'name', label: 'Nombre', width: 'minmax(90px,1.45fr)' },
  { key: 'type', label: 'Tipo', width: 'minmax(54px,.75fr)' },
  { key: 'subtype', label: 'Subtipo', width: 'minmax(78px,1fr)' },
  { key: 'detailType', label: 'Tipo detalle', width: 'minmax(78px,1fr)' },
  { key: 'manual', label: 'Manual', width: 'minmax(58px,.75fr)' },
  { key: 'balance', label: 'Saldo', width: 'minmax(82px,1fr)' },
  { key: 'currency', label: 'Mon', width: 'minmax(36px,.45fr)' },
  { key: 'status', label: 'Estado', width: 'minmax(55px,.75fr)' },
] as const;
type AccountColumnKey = (typeof ACCOUNT_COLUMN_DEFS)[number]['key'];
const DEFAULT_ACCOUNT_COLUMN_KEYS: AccountColumnKey[] = ACCOUNT_COLUMN_DEFS.map((column) => column.key);

function accountGridTemplate(visibleKeys: AccountColumnKey[]) {
  const columns = ACCOUNT_COLUMN_DEFS
    .filter((column) => visibleKeys.includes(column.key))
    .map((column) => column.width);
  return ['56px', ...columns, '64px'].join(' ');
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

interface PlanCuentasViewProps {
  isSidebarCollapsed?: boolean;
}

export function PlanCuentasView({ isSidebarCollapsed = true }: PlanCuentasViewProps) {
  const { canPerform, user } = useAuth();
  const { baseCurrency, formatConvertedAmount } = useCurrency();
  const tenantKey = user?.tenantId || user?.clientTenantId || 'anonymous';

  const accountsQuery = useAccountingQuery<any[]>(['accounts'], async (signal) => accountingList(await contabilidadService.getChartOfAccounts(true, signal)), {
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const loading = accountsQuery.isLoading || accountsQuery.isFetching;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [selectedAccount, setSelectedAccount] = useState<AccountNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsPageSize, setTransactionsPageSize] = useState(50);
  const [selectedTransaction, setSelectedTransaction] = useState<AccountTransaction | null>(null);
  const [visibleAccountColumnKeys, setVisibleAccountColumnKeys] = useLocalStorageState<AccountColumnKey[]>(`accounting-accounts-columns-${tenantKey}`, DEFAULT_ACCOUNT_COLUMN_KEYS, 24 * 365);
  const [columnConfigOpen, setColumnConfigOpen] = useState(false);

  const accountTransactionsQuery = useAccountingQuery<any>(
    ['account-transactions', selectedAccount?.id ?? null, transactionsPage, transactionsPageSize],
    async (signal) => selectedAccount
      ? contabilidadService.getAccountTransactions(selectedAccount.id, { page: transactionsPage, pageSize: transactionsPageSize }, signal)
      : { data: [], meta: { total: 0, page: 1, pageSize: transactionsPageSize, totalPages: 1 } },
    {
      enabled: Boolean(selectedAccount),
      placeholderData: keepPreviousData,
      staleTime: 30_000,
      refetchInterval: selectedAccount ? 30_000 : false,
    },
  );

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

  const [pendingStatusAccount, setPendingStatusAccount] = useState<AccountNode | null>(null);
  const [statusChanging, setStatusChanging] = useState(false);
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState<AccountNode | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [mergeSource, setMergeSource] = useState<AccountNode | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeDeleteSource, setMergeDeleteSource] = useState(false);
  const [merging, setMerging] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [replaceAccounts, setReplaceAccounts] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState<ChartAccountCsvRow[]>([]);
  const [importPreviewErrors, setImportPreviewErrors] = useState<string[]>([]);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);

  const accounts = useMemo(() => {
      const raw = accountsQuery.data || [];
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
      return buildTree(nodes);
  }, [accountsQuery.data]);
  const fetchAccounts = (_refresh = false) => accountsQuery.refetch();
  const accountGridColumns = useMemo(() => accountGridTemplate(visibleAccountColumnKeys), [visibleAccountColumnKeys]);

  const selectAccount = (account: AccountNode) => {
    setSelectedAccount(account);
    setSelectedTransaction(null);
    setTransactionsPage(1);
  };

  const toggleAccountStatus = async () => {
    if (!pendingStatusAccount) return;
    const account = pendingStatusAccount;
    const nextIsActive = !account.isActive;
    setStatusChanging(true);
    try {
      await contabilidadService.updateAccount(account.id, { isActive: nextIsActive });
      setSelectedAccount((current) => current?.id === account.id ? { ...current, isActive: nextIsActive } : current);
      setPendingStatusAccount(null);
      await fetchAccounts(true);
      toast.success(nextIsActive ? 'Cuenta habilitada' : 'Cuenta inhabilitada');
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo actualizar el estado de la cuenta');
    } finally {
      setStatusChanging(false);
    }
  };

  const handleMergeAccount = async () => {
    if (!mergeSource || !mergeTargetId) return;
    const source = mergeSource;
    const target = flatList.find(a => a.id === mergeTargetId);
    setMerging(true);
    try {
      const res = await contabilidadService.mergeAccount(source.id, mergeTargetId, mergeDeleteSource);
      await fetchAccounts(true);
      setSelectedAccount((current) => current?.id === source.id ? null : current);
      setSelectedTransaction(null);
      setMergeSource(null);
      setMergeTargetId('');
      setMergeDeleteSource(false);
      if (res?.sourceDeleted) {
        toast.success(`Cuenta eliminada. Se transfirieron ${res?.transferredRecords ?? 0} registros a ${target ? `${target.code} · ${target.name}` : 'la cuenta destino'}.`);
      } else {
        toast.success(`Transferencia completada. ${res?.transferredRecords ?? 0} registros movidos a ${target ? `${target.code} · ${target.name}` : 'la cuenta destino'}. La cuenta ${source.code} quedó inhabilitada y vacía.`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo transferir la cuenta');
    } finally {
      setMerging(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!pendingDeleteAccount) return;
    const account = pendingDeleteAccount;
    setDeletingAccount(true);
    try {
      await contabilidadService.deleteAccount(account.id);
      setSelectedAccount((current) => current?.id === account.id ? null : current);
      setPendingDeleteAccount(null);
      await fetchAccounts(true);
      toast.success(`Cuenta ${account.code} eliminada`);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo eliminar la cuenta');
    } finally {
      setDeletingAccount(false);
    }
  };

  const accountTransactionsResponse = accountTransactionsQuery.data;
  const accountTransactions: AccountTransaction[] = Array.isArray(accountTransactionsResponse)
    ? accountTransactionsResponse
    : Array.isArray(accountTransactionsResponse?.data) ? accountTransactionsResponse.data : [];
  const accountTransactionsMeta = accountTransactionsResponse?.meta ?? {
    total: selectedAccount?._count?.transactions ?? 0,
    page: transactionsPage,
    pageSize: transactionsPageSize,
    totalPages: Math.max(1, Math.ceil((selectedAccount?._count?.transactions ?? 0) / transactionsPageSize)),
  };

  const flatList = useMemo(() => flattenTree(accounts), [accounts]);

  const colFilters = useColumnFilters();
  const typeOptionsForFilter = ACCOUNT_TYPES.map((t) => ({ value: t.value, label: t.label, count: flatList.filter((a) => a.type === t.value).length }));
  const subtypeOptionsForFilter = ACCOUNT_SUBTYPES.map((s) => ({ value: s.value, label: s.label, count: flatList.filter((a) => a.subtype === s.value).length }));
  const statusOptionsForFilter = [
    { value: 'ACTIVE', label: 'Activas', count: flatList.filter((a) => a.isActive).length },
    { value: 'INACTIVE', label: 'Inactivas', count: flatList.filter((a) => !a.isActive).length },
  ];

  const filteredList = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const selectedTypes = colFilters.state.type?.values || [];
    const selectedSubtypes = colFilters.state.subtype?.values || [];
    const selectedStatuses = colFilters.state.status?.values || [];
    const matchesStatus = (account: AccountNode) => (
      statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? account.isActive : !account.isActive)
    );
    const matchesColumns = (account: AccountNode) => {
      if (selectedTypes.length > 0 && !selectedTypes.includes(account.type)) return false;
      if (selectedSubtypes.length > 0 && !selectedSubtypes.includes(account.subtype)) return false;
      if (selectedStatuses.length > 0) {
        const effective = account.isActive ? 'ACTIVE' : 'INACTIVE';
        if (!selectedStatuses.includes(effective)) return false;
      }
      return true;
    };
    const statusFiltered = flatList.filter(a => matchesStatus(a) && matchesColumns(a));
    const matched = new Set<string>();
    const byNameOrCode = q
      ? statusFiltered.filter(a => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q))
      : statusFiltered;
    for (const a of byNameOrCode) {
      matched.add(a.id);
      let parent = flatList.find(p => p.id === a.parentId);
      while (parent) { matched.add(parent.id); parent = flatList.find(p => p.id === parent!.parentId); }
    }
    const addChildren = (id: string) => {
      const children = flatList.filter(c => c.parentId === id && matchesStatus(c) && matchesColumns(c));
      for (const c of children) { matched.add(c.id); addChildren(c.id); }
    };
    for (const a of byNameOrCode) addChildren(a.id);
    return flatList.filter(a => matched.has(a.id));
  }, [flatList, searchTerm, statusFilter, colFilters.state]);

  const filteredTree = useMemo(() => buildTree(filteredList), [filteredList]);

  const mergeCandidates = useMemo(() => {
    if (!mergeSource) return [];
    const sourceId = mergeSource.id;
    return flatList.filter(a => a.id !== sourceId && a.type === mergeSource.type);
  }, [mergeSource, flatList]);

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

  const handleExport = async () => {
    try {
      const raw = await contabilidadService.exportAccounts();
      const rows = Array.isArray(raw) ? raw : (raw as any)?.data;
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('El servidor no devolvió cuentas para exportar');
      downloadXlsx('plan_cuentas.xlsx', rows);
      toast.success('Plan de cuentas exportado en Excel (.xlsx)');
    } catch (e: any) {
      toast.error(e?.message || 'Error al exportar');
    }
  };

  const parseImportFile = async () => {
    if (!importFile) { toast.error('Selecciona un archivo Excel'); return null; }
    setPreviewLoading(true);
    setPreviewProgress(5);
    try {
      const fileName = importFile.name.toLowerCase();

      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) { toast.error('El archivo debe ser Excel (.xlsx o .xls)'); return null; }
      const parsedFile = await parseSpreadsheetInWorker(importFile, undefined, true, (progress) => {
        setPreviewProgress(Math.min(84, Math.max(3, progress)));
      });
      setPreviewProgress(88);
      const availableSheets = parsedFile.sheets || { [parsedFile.sheetName || 'Hoja 1']: parsedFile.rows };
      const sheetCandidates = Object.entries(availableSheets).map(([sheetName, jsonRows]) => {
        const rows = jsonRows.map((row: any) => (Array.isArray(row) ? row : [String(row)]).map(String));
        const nonEmpty = rows.filter(row => row.some(cell => String(cell ?? '').trim().length > 0));
        const headers = (nonEmpty[0] ?? []).map(header => String(header).trim().toLowerCase().replace(/^\uFEFF/, ''));
        return {
          sheetName,
          nonEmpty,
          hasAccountHeaders: headers.includes('codigo') && headers.includes('nombre'),
        };
      });
      const selectedSheet = sheetCandidates.find(candidate => candidate.nonEmpty.length >= 2 && candidate.hasAccountHeaders);
      if (!selectedSheet) {
        toast.error('El archivo no contiene una hoja con encabezados de cuentas (codigo y nombre)');
        return null;
      }
      const headers = (selectedSheet.nonEmpty[0] ?? []).map(header => String(header).trim().toLowerCase().replace(/^\uFEFF/, ''));
      const rows = selectedSheet.nonEmpty.slice(1).map(cols => {
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

      setPreviewProgress(96);
      setPreviewProgress(100);
      return { valid, errors, fileName: `${importFile.name} · Hoja: ${selectedSheet.sheetName}` };
    } catch (e: any) {
      toast.error(e?.message || 'Error al leer el archivo');
      return null;
    } finally {
      setPreviewLoading(false);
      setPreviewProgress(0);
    }
  };

  const handlePreviewImport = async () => {
    const result = await parseImportFile();
    if (!result) return;
    setImportPreviewRows(result.valid);
    setImportPreviewErrors(result.errors);
    setImportFileName(result.fileName);
    setImportPreviewOpen(true);
  };

  const handleConfirmImport = async () => {
    if (importPreviewRows.length === 0) { toast.error('No hay cuentas válidas para importar'); return; }
    setImporting(true);
    setImportProgress(5);
    try {
      setImportProgress(25);
      const res: any = await contabilidadService.importAccounts(importPreviewRows, replaceAccounts);
      setImportProgress(90);
      await fetchAccounts(true);
      setImportProgress(100);
      
      const msg = replaceAccounts
        ? `${res?.imported ?? importPreviewRows.length} importadas, ${res?.removed ?? 0} reemplazadas`
        : `${res?.imported ?? importPreviewRows.length} cuentas importadas${importPreviewErrors.length > 0 ? ` (${importPreviewErrors.length} errores)` : ''}`;
      toast.success(msg);
      setImportPreviewOpen(false);
      setImportOpen(false);
      setImportFile(null);
      setImportFileName('');
      setImportPreviewRows([]);
      setImportPreviewErrors([]);
    } catch (e: any) {
      toast.error(e?.message || 'Error al importar');
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const collapseAll = () => setExpandedIds(new Set());
  const expandAll = () => setExpandedIds(new Set(flatList.filter((account) => account.children.length > 0).map((account) => account.id)));

  const handleImport = handlePreviewImport;

  const updateImportRow = (index: number, field: keyof ChartAccountCsvRow, value: string) => {
    setImportPreviewRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };

  const renderTreeRow = (account: AccountNode) => {
    const hasChildren = account.children.length > 0;
    const isExpanded = expandedIds.has(account.id);
    const isSelected = selectedAccount?.id === account.id;

    return (
      <div key={account.id}>
        <div
          className={cn(
            'flex items-start gap-2 px-3 py-2.5 cursor-pointer rounded-md transition-colors hover:bg-muted/50 sm:hidden',
            isSelected && 'bg-muted ring-1 ring-border',
            !account.isActive && 'opacity-60'
          )}
          style={{ paddingLeft: `${Math.min(account.level * 12 + 8, 32)}px` }}
          onClick={() => selectAccount(account)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); toggleExpand(account.id); }}
            className={cn(
              'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded',
              hasChildren ? 'visible hover:bg-muted' : 'invisible'
            )}
            aria-label={isExpanded ? `Contraer ${account.name}` : `Expandir ${account.name}`}
          >
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{account.code}</span>
              <Badge variant="outline" className={cn('shrink-0 px-1.5 py-0 text-[9px] font-medium', TYPE_COLOR_MAP[account.type])}>
                {getTypeLabel(account.type)}
              </Badge>
            </div>
            <p className={cn('mt-0.5 truncate text-sm font-medium', !account.isActive && 'line-through')} title={account.name}>
              {account.name}
            </p>
            <p className="mt-1 truncate text-[10px] text-muted-foreground">
              {getSubtypeLabel(account.subtype)} · {getDetailTypeLabel(account.detailType)} · {account.currency}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="max-w-[96px] truncate text-right text-xs font-semibold tabular-nums">
              {formatConvertedAmount(account.balance, baseCurrency)}
            </span>
            <Badge variant={account.isActive ? 'default' : 'secondary'} className="px-1.5 py-0 text-[9px]">
              {account.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              {canPerform('ACCOUNTING_CHART', 'edit') && (
                <>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditDialog(account)} title="Editar">
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="size-7"
                    onClick={() => setPendingStatusAccount(account)}
                    title={account.isActive ? 'Inhabilitar cuenta' : 'Habilitar cuenta'}
                  >
                    {account.isActive ? <Ban className="size-3.5" /> : <CircleCheck className="size-3.5 text-emerald-500" />}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div
          className={cn(
            'hidden min-w-0 items-center gap-0 px-3 py-2 transition-colors hover:bg-muted/50 sm:grid',
            isSelected && 'bg-muted ring-1 ring-border',
            !account.isActive && 'opacity-60'
          )}
          style={{ gridTemplateColumns: accountGridColumns }}
          onClick={() => selectAccount(account)}
        >
          <div className="flex min-w-0 items-center" style={{ paddingLeft: `${Math.min(account.level * 16, 32)}px` }}>
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(account.id); }}
              className={cn('flex size-5 shrink-0 items-center justify-center rounded', hasChildren ? 'visible hover:bg-muted' : 'invisible')}
              aria-label={isExpanded ? `Contraer ${account.name}` : `Expandir ${account.name}`}
            >
              {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          </div>
          {visibleAccountColumnKeys.includes('code') && <span className="min-w-0 truncate px-2 font-mono text-xs text-muted-foreground">{account.code}</span>}
          {visibleAccountColumnKeys.includes('name') && <span className={cn('min-w-0 truncate px-2 text-xs', !account.isActive && 'line-through')}>{account.name}</span>}
          {visibleAccountColumnKeys.includes('type') && <Badge variant="outline" className={cn('mx-2 max-w-full justify-center truncate px-1.5 py-0 text-[10px] font-medium', TYPE_COLOR_MAP[account.type])}>{getTypeLabel(account.type)}</Badge>}
          {visibleAccountColumnKeys.includes('subtype') && <span className="min-w-0 truncate px-2 text-[10px] text-muted-foreground" title={getSubtypeLabel(account.subtype)}>{getSubtypeLabel(account.subtype)}</span>}
          {visibleAccountColumnKeys.includes('detailType') && <span className="min-w-0 truncate px-2 text-[10px] text-muted-foreground" title={getDetailTypeLabel(account.detailType)}>{getDetailTypeLabel(account.detailType)}</span>}
          {visibleAccountColumnKeys.includes('manual') && <Badge variant={account.allowManualEntry ? 'outline' : 'secondary'} className="mx-2 max-w-full justify-center truncate text-[10px]">{account.allowManualEntry ? 'Manual' : 'No manual'}</Badge>}
          {visibleAccountColumnKeys.includes('balance') && <span className="min-w-0 truncate px-2 text-right text-sm font-medium tabular-nums">{formatConvertedAmount(account.balance, baseCurrency)}</span>}
          {visibleAccountColumnKeys.includes('currency') && <Badge variant="outline" className="mx-2 max-w-full justify-center truncate text-[10px] text-muted-foreground">{account.currency}</Badge>}
          {visibleAccountColumnKeys.includes('status') && <Badge variant={account.isActive ? 'default' : 'secondary'} className="mx-2 max-w-full justify-center truncate text-[10px]">{account.isActive ? 'Activo' : 'Inactivo'}</Badge>}
          <div className="flex shrink-0 items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {canPerform('ACCOUNTING_CHART', 'edit') && (
              <>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditDialog(account)} title="Editar cuenta" aria-label="Editar cuenta">
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setPendingStatusAccount(account)} title={account.isActive ? 'Inhabilitar cuenta' : 'Habilitar cuenta'} aria-label={account.isActive ? 'Inhabilitar cuenta' : 'Habilitar cuenta'}>
                  {account.isActive ? <Ban className="size-3.5" /> : <CircleCheck className="size-3.5 text-emerald-500" />}
                </Button>
              </>
            )}
          </div>
        </div>
        {hasChildren && isExpanded && account.children.map(child => renderTreeRow(child))}
      </div>
    );
  };

  if (importPreviewOpen) {
    return (
      <AccountImportPreview
        rows={importPreviewRows}
        errors={importPreviewErrors}
        existingAccountCodes={flatList.map((account) => account.code)}
        fileName={importFileName}
        isSidebarCollapsed={isSidebarCollapsed}
        importing={importing}
        progress={importProgress}
        onRowUpdate={updateImportRow}
        onBack={() => { setImportPreviewOpen(false); setImportOpen(true); }}
        onConfirm={handleConfirmImport}
      />
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <ImportProgressOverlay open={previewLoading} progress={previewProgress} title="Preparando previsualización" description="Leyendo las hojas, validando la jerarquía y preparando las cuentas para revisión." />
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Plan de Cuentas</h1>
        </div>
        <div className="erp-toolbar-primary-group flex w-full flex-wrap gap-2 sm:w-auto">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <FileDown className="w-4 h-4 mr-1" /> Exportar
          </Button>
          {canPerform('ACCOUNTING_CHART', 'create') && (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-1" /> Importar
            </Button>
          )}
          {canPerform('ACCOUNTING_CHART', 'create') && (
            <Button size="sm" data-toolbar-role="primary" onClick={() => openAddDialog()}>
              <Plus className="w-4 h-4 mr-1" /> Nueva Cuenta
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="erp-list-toolbar flex min-w-0 flex-wrap items-center gap-2">
        <div className="relative min-w-[min(100%,16rem)] max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
        >
          <SelectTrigger className="h-9 w-full sm:w-[160px]" aria-label="Filtrar cuentas por estado">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las cuentas</SelectItem>
            <SelectItem value="ACTIVE">Solo activas</SelectItem>
            <SelectItem value="INACTIVE">Solo inactivas</SelectItem>
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
      <div className={cn(
        'grid min-w-0 grid-cols-1 gap-6',
        selectedAccount ? 'lg:grid-cols-[13fr_7fr]' : 'lg:grid-cols-1'
      )}>
        {/* Tree Table */}
        <div className="min-w-0">
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Jerarquía de Cuentas</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setColumnConfigOpen(true)} title="Elegir columnas visibles">
                    <Settings2 className="size-3.5" /> <span className="hidden sm:inline">Columnas</span><span className="text-muted-foreground">{visibleAccountColumnKeys.length}</span>
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={collapseAll} title="Contraer todas las cuentas y grupos">
                    <ChevronsDownUp className="size-3.5" /> Contraer todo
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={expandAll} title="Expandir todas las cuentas y grupos">
                    <ChevronsUpDown className="size-3.5" /> Expandir todo
                  </Button>
                </div>
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
                  <p className="text-sm">
                    {searchTerm
                      ? 'Sin resultados de búsqueda'
                      : (colFilters.state.type?.values?.length || colFilters.state.status?.values?.length)
                        ? 'Sin cuentas que coincidan con los filtros de columna'
                        : statusFilter === 'ACTIVE'
                          ? 'No hay cuentas activas'
                          : statusFilter === 'INACTIVE'
                            ? 'No hay cuentas inactivas'
                            : 'No hay cuentas registradas'}
                  </p>
                  {!searchTerm && statusFilter === 'ALL' && !(colFilters.state.type?.values?.length || colFilters.state.status?.values?.length) && (
                    <Button variant="link" size="sm" onClick={() => openAddDialog()}>
                      Crear primera cuenta
                    </Button>
                  )}
                </div>
              ) : (
                <div className="max-h-[600px] overflow-auto">
                  <div className="min-w-0 sm:min-w-[720px] divide-y divide-border">
                    {/* Header row */}
                    <div className="sticky top-0 z-20 hidden min-w-0 items-center gap-0 border-b border-border/60 bg-card/95 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground backdrop-blur sm:grid" style={{ gridTemplateColumns: accountGridColumns }}>
                      <span className="px-2" aria-hidden="true" />
                      {ACCOUNT_COLUMN_DEFS.filter((column) => visibleAccountColumnKeys.includes(column.key)).map((column) => (
                        <span key={column.key} className={cn('min-w-0 truncate px-2', column.key === 'balance' && 'text-right', (column.key === 'manual' || column.key === 'currency' || column.key === 'status') && 'text-center')}>
                          <span className="inline-flex items-center gap-1">
                            {column.label}
                            {column.key === 'type' && <ColumnFilterMenu label="Tipo" hideLabel options={typeOptionsForFilter} selected={colFilters.state.type?.values || []} onSelect={(values) => colFilters.setValues('type', values)} sort={colFilters.state.type?.sort || null} onSort={(sort) => colFilters.setSort('type', sort)} />}
                            {column.key === 'subtype' && <ColumnFilterMenu label="Subtipo" hideLabel options={subtypeOptionsForFilter} selected={colFilters.state.subtype?.values || []} onSelect={(values) => colFilters.setValues('subtype', values)} sort={colFilters.state.subtype?.sort || null} onSort={(sort) => colFilters.setSort('subtype', sort)} />}
                            {column.key === 'status' && <ColumnFilterMenu label="Estado" hideLabel options={statusOptionsForFilter} selected={colFilters.state.status?.values || []} onSelect={(values) => colFilters.setValues('status', values)} sort={colFilters.state.status?.sort || null} onSort={(sort) => colFilters.setSort('status', sort)} />}
                          </span>
                        </span>
                      ))}
                      <span className="px-2 text-right">Acciones</span>
                    </div>
                    <div className="border-b border-border bg-muted/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 sm:hidden">
                      Cuentas contables
                    </div>
                    {filteredTree.map(acc => renderTreeRow(acc))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detail Panel */}
        {selectedAccount && <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start">
          <Card className="overflow-hidden">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Detalle de Cuenta</CardTitle>
                </div>
                {selectedAccount && (
                  <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => { setSelectedAccount(null); setSelectedTransaction(null); }}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="max-h-[calc(100vh-6rem)] space-y-5 overflow-y-auto p-4 sm:p-5">
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Cuenta seleccionada · {selectedAccount.code}</p>
                      <h3 className="mt-1 truncate text-lg font-black tracking-tight" title={selectedAccount.name}>{selectedAccount.name}</h3>
                    </div>
                    <Badge variant={selectedAccount.isActive ? 'default' : 'secondary'} className="shrink-0">
                      {selectedAccount.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Saldo actual</p>
                      <p className="mt-1 text-2xl font-black tabular-nums tracking-tight">{formatConvertedAmount(selectedAccount.balance, baseCurrency)}</p>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0', TYPE_COLOR_MAP[selectedAccount.type])}>
                      {getTypeLabel(selectedAccount.type)}
                    </Badge>
                  </div>
                </div>

                <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 2xl:grid-cols-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subtipo</p>
                    <p className="truncate text-sm font-semibold" title={getSubtypeLabel(selectedAccount.subtype)}>{getSubtypeLabel(selectedAccount.subtype)}</p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tipo de detalle</p>
                    <p className="truncate text-sm font-semibold" title={getDetailTypeLabel(selectedAccount.detailType)}>{getDetailTypeLabel(selectedAccount.detailType)}</p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Moneda</p>
                    <p className="text-sm font-semibold">{selectedAccount.currency}</p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Captura manual</p>
                    <Badge variant={selectedAccount.allowManualEntry ? 'default' : 'secondary'} className="max-w-full truncate">
                      {selectedAccount.allowManualEntry ? 'Permitida' : 'No permitida'}
                    </Badge>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hijos</p>
                    <p className="text-sm font-semibold tabular-nums">{selectedAccount._count?.children ?? selectedAccount.children.length}</p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Movimientos</p>
                    <p className="text-sm font-semibold tabular-nums">{accountTransactionsMeta.total ?? selectedAccount._count?.transactions ?? 0}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {canPerform('ACCOUNTING_CHART', 'edit') && (
                    <>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(selectedAccount)}>
                        <Pencil className="mr-1 size-3.5" /> Editar
                      </Button>
                      <Button
                        variant="outline" size="sm" className="flex-1"
                        onClick={() => setPendingStatusAccount(selectedAccount)}
                      >
                        {selectedAccount.isActive ? <Ban className="mr-1 size-3.5" /> : <CircleCheck className="mr-1 size-3.5 text-emerald-500" />} {selectedAccount.isActive ? 'Inhabilitar' : 'Habilitar'}
                      </Button>
                      {(selectedAccount.children?.length ?? 0) === 0 && (
                        <Button variant="outline" size="sm" className="flex-1 text-primary hover:text-primary" onClick={() => { setMergeSource(selectedAccount); setMergeTargetId(''); setMergeDeleteSource(false); }} title="Mueve los movimientos de esta cuenta a otra. La cuenta queda inhabilitada pero NO se elimina (marca la opción en el diálogo si también quieres eliminarla).">
                          <ArrowDownLeft className="mr-1 size-3.5" /> Transferir
                        </Button>
                      )}
                      <Button
                        variant="outline" size="sm" className="flex-1 text-red-600 hover:text-red-700"
                        onClick={() => setPendingDeleteAccount(selectedAccount)}
                      >
                        <Trash2 className="mr-1 size-3.5" /> Eliminar
                      </Button>
                    </>
                  )}
                </div>

                <Separator />

                <section aria-labelledby="account-transactions-title" className="min-w-0">
                  <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Activity className="size-4 text-primary" />
                        <h3 id="account-transactions-title" className="truncate text-sm font-black uppercase tracking-tight">Transacciones de la cuenta</h3>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">Últimos movimientos registrados, actualizados automáticamente.</p>
                    </div>
                    {accountTransactionsQuery.isFetching && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-label="Actualizando transacciones" />}
                  </div>

                  {accountTransactionsQuery.isLoading ? (
                    <div className="flex items-center justify-center rounded-xl border border-dashed border-border/60 py-10">
                      <Loader2 className="size-5 animate-spin text-primary" />
                    </div>
                  ) : accountTransactions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center">
                      <Activity className="mx-auto size-8 text-muted-foreground/40" />
                      <p className="mt-2 text-sm font-semibold">Sin transacciones</p>
                      <p className="mt-1 text-xs text-muted-foreground">Esta cuenta todavía no tiene movimientos.</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-border/60">
                      <div className="divide-y divide-border/60">
                        {accountTransactions.map((transaction) => {
                          const debit = Number(transaction.debit ?? 0);
                          const credit = Number(transaction.credit ?? 0);
                          const readableDescription = readableTransactionDescription(transaction);
                          return (
                            <div
                              key={transaction.id}
                              role="button"
                              tabIndex={0}
                              aria-label={`Ver detalles de la transacción ${transaction.reference || transaction.id}`}
                              onClick={() => setSelectedTransaction(transaction)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  setSelectedTransaction(transaction);
                                }
                              }}
                              className="grid min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-3 py-3 transition-colors hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                            >
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                                {debit > 0 ? <ArrowDownLeft className="size-3.5 text-emerald-600" /> : <ArrowUpRight className="size-3.5 text-rose-500" />}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold" title={readableDescription}>{readableDescription}</p>
                                <p className="mt-1 truncate text-[10px] text-muted-foreground">
                                  {new Date(transaction.date).toLocaleDateString('es-NI')} · {transaction.reference || 'Sin referencia'}
                                </p>
                              </div>
                              <div className="shrink-0 text-right font-mono text-[11px] font-bold tabular-nums">
                                {debit > 0 && <p className="text-emerald-600">+{formatConvertedAmount(debit, baseCurrency)}</p>}
                                {credit > 0 && <p className="text-rose-500">-{formatConvertedAmount(credit, baseCurrency)}</p>}
                                {debit === 0 && credit === 0 && <p className="text-muted-foreground">â€”</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-col gap-3 border-t border-border/40 pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span>Mostrar</span>
                      <select
                        value={transactionsPageSize}
                        onChange={(event) => { setTransactionsPageSize(Number(event.target.value)); setTransactionsPage(1); }}
                        className="h-8 rounded-lg border border-border/50 bg-background px-2 font-bold text-foreground outline-none"
                        aria-label="Transacciones por página"
                      >
                        {[50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}
                      </select>
                      <span>por página · {accountTransactionsMeta.total ?? 0} total</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 sm:justify-end">
                      <Button variant="outline" size="icon" className="size-7" onClick={() => setTransactionsPage(1)} disabled={transactionsPage <= 1} aria-label="Primera página de transacciones"><ChevronsLeft className="size-3.5" /></Button>
                      <Button variant="outline" size="icon" className="size-7" onClick={() => setTransactionsPage((page) => Math.max(1, page - 1))} disabled={transactionsPage <= 1} aria-label="Página anterior de transacciones"><ChevronRight className="size-3.5 rotate-180" /></Button>
                      <span className="min-w-20 text-center font-bold text-foreground">Pág. {transactionsPage} / {Math.max(1, accountTransactionsMeta.totalPages ?? 1)}</span>
                      <Button variant="outline" size="icon" className="size-7" onClick={() => setTransactionsPage((page) => Math.min(accountTransactionsMeta.totalPages ?? 1, page + 1))} disabled={transactionsPage >= (accountTransactionsMeta.totalPages ?? 1)} aria-label="Página siguiente de transacciones"><ChevronRight className="size-3.5" /></Button>
                      <Button variant="outline" size="icon" className="size-7" onClick={() => setTransactionsPage(accountTransactionsMeta.totalPages ?? 1)} disabled={transactionsPage >= (accountTransactionsMeta.totalPages ?? 1)} aria-label="Última página de transacciones"><ChevronsRight className="size-3.5" /></Button>
                    </div>
                  </div>
                </section>
            </CardContent>
          </Card>
        </div>}
      </div>

      <Dialog open={selectedTransaction !== null} onOpenChange={(open) => { if (!open) setSelectedTransaction(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] !max-w-xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <Activity className="size-5 text-primary" />
              Detalle de transacción
            </DialogTitle>
            <DialogDescription>
              Información general del movimiento registrado en la cuenta seleccionada.
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (() => {
            const debit = Number(selectedTransaction.debit ?? 0);
            const credit = Number(selectedTransaction.credit ?? 0);
            const movement = debit - credit;
            const transferDetails = selectedTransaction.transferDetails;
            const readableDescription = readableTransactionDescription(selectedTransaction);

            return (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Movimiento seleccionado</p>
                  <p className="mt-2 break-words text-base font-black text-foreground">{readableDescription}</p>
                </div>

                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Fecha</p>
                    <p className="mt-1 text-sm font-semibold">{new Date(selectedTransaction.date).toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'short' })}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Referencia</p>
                    <p className="mt-1 break-words text-sm font-semibold">{selectedTransaction.reference || 'Sin referencia'}</p>
                  </div>
                </div>

                {transferDetails && (
                  <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-primary">
                      <ArrowRightLeft className="size-3.5" />
                      Procedencia de la transferencia
                    </div>
                    <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                      <div className="min-w-0 rounded-lg border border-border/50 bg-background/70 p-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Origen</p>
                        <p className="mt-1 truncate text-sm font-bold" title={transferDetails.origin.warehouseName}>{transferDetails.origin.warehouseName}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground" title={transferDetails.origin.branchName || undefined}>Sucursal: {transferDetails.origin.branchName || 'Almacén corporativo'}</p>
                      </div>
                      <div className="min-w-0 rounded-lg border border-border/50 bg-background/70 p-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Destino</p>
                        <p className="mt-1 truncate text-sm font-bold" title={transferDetails.destination.warehouseName}>{transferDetails.destination.warehouseName}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground" title={transferDetails.destination.branchName || undefined}>Sucursal: {transferDetails.destination.branchName || 'Almacén corporativo'}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Débito</p>
                    <p className="mt-1 break-words font-mono text-sm font-bold text-emerald-600">{formatConvertedAmount(debit, baseCurrency)}</p>
                  </div>
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Crédito</p>
                    <p className="mt-1 break-words font-mono text-sm font-bold text-rose-500">{formatConvertedAmount(credit, baseCurrency)}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Movimiento neto</p>
                    <p className={cn('mt-1 break-words font-mono text-sm font-bold', movement >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                      {movement >= 0 ? '+' : '-'}{formatConvertedAmount(Math.abs(movement), baseCurrency)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 px-4 py-3 text-xs text-muted-foreground">
                  Cuenta: <span className="font-semibold text-foreground">{selectedAccount?.code} · {selectedAccount?.name}</span>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={columnConfigOpen} onOpenChange={setColumnConfigOpen}>
        <DialogContent className="w-[calc(100%-2rem)] !max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings2 className="size-5 text-primary" /> Configurar columnas</DialogTitle>
            <DialogDescription>Selecciona las columnas que quieres mantener visibles en la jerarquía de cuentas. Los cambios se reflejan inmediatamente.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ACCOUNT_COLUMN_DEFS.map((column) => {
              const active = visibleAccountColumnKeys.includes(column.key);
              return (
                <button
                  key={column.key}
                  type="button"
                  onClick={() => setVisibleAccountColumnKeys((current) => active
                    ? (current.length > 1 ? current.filter((key) => key !== column.key) : current)
                    : [...current, column.key])}
                  className={cn('flex min-h-11 items-center justify-between rounded-xl border px-3 text-left text-xs font-bold transition-colors', active ? 'border-primary bg-primary/10 text-foreground' : 'border-border/60 bg-muted/10 text-muted-foreground hover:border-primary/50')}
                >
                  <span>{column.label}</span>
                  {active && <Check className="size-4 text-primary" />}
                </button>
              );
            })}
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setVisibleAccountColumnKeys(DEFAULT_ACCOUNT_COLUMN_KEYS)}>Mostrar todas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingStatusAccount !== null}
        onOpenChange={(open) => { if (!open && !statusChanging) setPendingStatusAccount(null); }}
        title={pendingStatusAccount?.isActive ? '¿Inhabilitar cuenta?' : '¿Habilitar cuenta?'}
        description={pendingStatusAccount
          ? `${pendingStatusAccount.code} · ${pendingStatusAccount.name}. ${pendingStatusAccount.isActive ? 'La cuenta no estará disponible para nuevos movimientos, pero conservará su historial.' : 'La cuenta volverá a estar disponible para nuevos movimientos.'}`
          : ''}
        confirmLabel={pendingStatusAccount?.isActive ? 'Inhabilitar cuenta' : 'Habilitar cuenta'}
        variant={pendingStatusAccount?.isActive ? 'warning' : 'default'}
        loading={statusChanging}
        onConfirm={toggleAccountStatus}
      />

      <Dialog open={mergeSource !== null} onOpenChange={(open) => { if (!open && !merging) { setMergeSource(null); setMergeTargetId(''); setMergeDeleteSource(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{mergeDeleteSource ? 'Transferir y eliminar cuenta' : 'Transferir cuenta'}</DialogTitle>
            <DialogDescription>
              {mergeSource
                ? `Se moverán ${mergeSource.code} · ${mergeSource.name} y TODOS sus datos (saldos, transacciones, asientos, facturas, almacenes, conciliaciones, presupuestos) a la cuenta destino. Por defecto la cuenta origen NO se elimina: queda inhabilitada y vacía, conservando su código en el plan de cuentas.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs text-foreground">
                <strong>Transferir sin eliminar:</strong> la cuenta origen se queda en el plan de cuentas, inhabilitada y sin saldo. Puedes habilitarla después si la necesitas.
              </p>
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border/60 bg-card/50 p-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-rose-600"
                checked={mergeDeleteSource}
                onChange={(e) => setMergeDeleteSource(e.target.checked)}
              />
              <span className="min-w-0 text-xs leading-relaxed text-muted-foreground">
                <strong className="text-rose-600">Eliminar la cuenta origen después de transferir.</strong>{' '}
                Si lo marcas, la cuenta se eliminará de forma permanente junto con su código. Esta acción no se puede deshacer.
              </span>
            </label>
            <div className="space-y-2">
              <Label>Cuenta destino (mismo tipo: {mergeSource ? getTypeLabel(mergeSource.type) : ''})</Label>
              <Combobox
                value={mergeTargetId}
                onChange={setMergeTargetId}
                options={mergeCandidates.map(a => ({ value: a.id, label: `${a.code} · ${a.name}` }))}
                placeholder="Buscar cuenta destino..."
                emptyMessage="No hay cuentas del mismo tipo disponibles"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setMergeSource(null); setMergeTargetId(''); setMergeDeleteSource(false); }} disabled={merging}>
              Cancelar
            </Button>
            <Button variant={mergeDeleteSource ? 'destructive' : 'default'} onClick={handleMergeAccount} disabled={!mergeTargetId || merging}>
              {merging ? <Loader2 className="size-4 animate-spin mr-1" /> : null} {mergeDeleteSource ? 'Transferir y eliminar' : 'Transferir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDeleteAccount !== null}
        onOpenChange={(open) => { if (!open && !deletingAccount) setPendingDeleteAccount(null); }}
        title="¿Eliminar cuenta?"
        description={pendingDeleteAccount
          ? `${pendingDeleteAccount.code} · ${pendingDeleteAccount.name}. Esta acción es definitiva y no se puede deshacer. Solo se eliminan cuentas sin hijos ni movimientos.`
          : ''}
        confirmLabel="Eliminar cuenta"
        variant="destructive"
        loading={deletingAccount}
        onConfirm={handleDeleteAccount}
      />

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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="parentId">Cuenta Padre</Label>
                <Combobox
                  options={[
                    { label: 'Ninguna (Raíz)', value: 'NONE' },
                    ...getParentOptions(editingAccount?.id).map(opt => ({ label: opt.label, value: opt.id })),
                  ]}
                  value={formData.parentId ?? 'NONE'}
                  onChange={(v) => setFormData(p => ({ ...p, parentId: v === 'NONE' ? undefined : v }))}
                  placeholder="Ninguna (Raíz)"
                  searchPlaceholder="Buscar por nombre o código..."
                  emptyMessage="Sin cuentas coincidentes"
                  className="h-8"
                />
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      {/* Import Dialog */}
      <Dialog open={importOpen && !importing} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Importar Cuentas desde Excel
            </DialogTitle>
            <DialogDescription>
              Descarga la plantilla Excel y súbela. El sistema crea o actualiza las cuentas por código dentro de esta empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-medium text-foreground">Columnas requeridas</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { key: 'codigo', label: 'Código de la cuenta' },
                  { key: 'nombre', label: 'Nombre' },
                  { key: 'tipo_cuenta', label: 'Activos, Pasivos, Patrimonioâ€¦' },
                  { key: 'subtipo', label: 'Grupo, detalle, subcuentaâ€¦' },
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
              <Label htmlFor="import-file">Archivo Excel (.xlsx, .xls)</Label>
              <Input
                id="import-file"
                type="file"
                accept=".xlsx,.xls"
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
              downloadXlsx('plantilla_cuentas.xlsx', templateRows());
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
              Previsualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
