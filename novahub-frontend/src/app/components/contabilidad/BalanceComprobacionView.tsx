import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  Search,
  Download,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Settings2,
} from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { useAccountingQuery } from '../../hooks/useAccountingQuery';
import { AccountMovementsDetail } from './AccountMovementsDetail';
import { AccountChecklistDialog } from './AccountChecklistDialog';
import { DateField } from '../ui/DateField';
import { generateTrialBalancePDF } from '../../utils/pdfGenerator';
import { buildDateFilteredDownloadFileName } from '../../utils/exportFileNames';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ASSET: 'ACTIVOS',
  LIABILITY: 'PASIVOS',
  EQUITY: 'PATRIMONIO',
  INCOME: 'INGRESOS',
  EXPENSE: 'GASTOS',
};

const ACCOUNT_TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

const accountTypeLabel = (tipo: string) => ACCOUNT_TYPE_LABELS[tipo] || tipo;

function normalizeAccountType(rawType: string): string {
  const t = String(rawType || '').toUpperCase().trim();
  if (t === 'REVENUE') return 'INCOME';
  if (t === 'COST') return 'EXPENSE';
  if (t === 'ACTIVO' || t === 'ACTIVOS') return 'ASSET';
  if (t === 'PASIVO' || t === 'PASIVOS') return 'LIABILITY';
  if (t === 'PATRIMONIO') return 'EQUITY';
  if (t === 'INGRESO' || t === 'INGRESOS') return 'INCOME';
  if (t === 'GASTO' || t === 'GASTOS' || t === 'COSTO' || t === 'COSTOS') return 'EXPENSE';
  return t || 'ASSET';
}

export interface TrialBalanceTreeNode {
  id: string;
  codigo: string;
  cuenta: string;
  tipo: string;
  parentId: string | null;
  level: number;
  isLeaf: boolean;
  debitos: number;
  creditos: number;
  saldo: number;
  children: TrialBalanceTreeNode[];
  hasActivity: boolean;
}

interface RawChartAccount {
  id?: string;
  code?: string;
  codigo?: string;
  name?: string;
  nombre?: string;
  cuenta?: string;
  type?: string;
  tipo?: string;
  parentId?: string | null;
  children?: RawChartAccount[];
}

interface RawTrialBalanceRow {
  accountId?: string;
  id?: string;
  accountCode?: string;
  code?: string;
  codigo?: string;
  accountName?: string;
  name?: string;
  cuenta?: string;
  accountType?: string;
  type?: string;
  tipo?: string;
  totalDebit?: number;
  debitos?: number;
  debit?: number;
  totalCredit?: number;
  creditos?: number;
  credit?: number;
  balance?: number;
  saldo?: number;
}

function buildTrialBalanceTree(
  chartRaw: any,
  trialRowsRaw: any[],
  configuredAccountIds?: string[] | null
): {
  tree: TrialBalanceTreeNode[];
  leafAccounts: TrialBalanceTreeNode[];
} {
  const chartList: RawChartAccount[] = Array.isArray(chartRaw)
    ? chartRaw
    : Array.isArray(chartRaw?.data)
    ? chartRaw.data
    : [];

  const rawRows: RawTrialBalanceRow[] = Array.isArray(trialRowsRaw)
    ? trialRowsRaw
    : Array.isArray((trialRowsRaw as any)?.rows)
    ? (trialRowsRaw as any).rows
    : [];

  // 1. Aplanar catálogo completo de cuentas
  const catalogMap = new Map<string, { id: string; code: string; name: string; type: string; parentId: string | null }>();
  const codeToIdMap = new Map<string, string>();

  const walkChart = (nodes: RawChartAccount[], inheritedParentId: string | null = null) => {
    for (const item of nodes || []) {
      if (!item) continue;
      const id = String(item.id || item.code || item.codigo || '').trim();
      const code = String(item.code || item.codigo || '').trim();
      const name = String(item.name || item.nombre || item.cuenta || '').trim();
      const type = normalizeAccountType(item.type || item.tipo || '');
      const parentId = item.parentId ?? inheritedParentId ?? null;

      if (id) {
        catalogMap.set(id, { id, code, name, type, parentId });
        if (code) codeToIdMap.set(code, id);
      }
      if (Array.isArray(item.children) && item.children.length > 0) {
        walkChart(item.children, id);
      }
    }
  };
  walkChart(chartList);

  // 2. Mapear saldos de la balanza por accountId y por código
  const trialMap = new Map<string, { debitos: number; creditos: number; saldo: number }>();
  for (const r of rawRows) {
    const id = String(r.accountId || r.id || '').trim();
    const code = String(r.accountCode || r.code || r.codigo || '').trim();
    const name = String(r.accountName || r.name || r.cuenta || '').trim();
    const type = normalizeAccountType(r.accountType || r.type || r.tipo || '');
    const debitos = Number(r.totalDebit ?? r.debitos ?? r.debit ?? 0) || 0;
    const creditos = Number(r.totalCredit ?? r.creditos ?? r.credit ?? 0) || 0;
    const saldo = Number(r.balance ?? r.saldo ?? 0) || 0;

    const val = { debitos, creditos, saldo };
    if (id) trialMap.set(id, val);
    if (code) trialMap.set(code, val);

    // Si la cuenta de la balanza no estaba en el catálogo, registrarla
    const key = id || code;
    if (key && !catalogMap.has(key)) {
      catalogMap.set(key, { id: key, code, name, type, parentId: null });
      if (code) codeToIdMap.set(code, key);
    }
  }

  // 3. Inferir jerarquía por guiones si parentId viene nulo (ej. 1101-001 -> 1101)
  for (const [id, acc] of catalogMap.entries()) {
    if (!acc.parentId && acc.code.includes('-')) {
      const parentCode = acc.code.slice(0, acc.code.lastIndexOf('-')).trim();
      if (parentCode && codeToIdMap.has(parentCode)) {
        const inferredParentId = codeToIdMap.get(parentCode)!;
        if (inferredParentId !== id) {
          acc.parentId = inferredParentId;
        }
      }
    }
  }

  // 4. Crear los nodos iniciales del árbol
  const nodeMap = new Map<string, TrialBalanceTreeNode>();
  for (const [id, acc] of catalogMap.entries()) {
    const tbVal = trialMap.get(id) || (acc.code ? trialMap.get(acc.code) : undefined) || { debitos: 0, creditos: 0, saldo: 0 };
    const hasDirectActivity = tbVal.debitos !== 0 || tbVal.creditos !== 0 || tbVal.saldo !== 0;

    nodeMap.set(id, {
      id,
      codigo: acc.code || '—',
      cuenta: acc.name || 'Sin nombre',
      tipo: acc.type || 'ASSET',
      parentId: acc.parentId,
      level: 0,
      isLeaf: true,
      debitos: tbVal.debitos,
      creditos: tbVal.creditos,
      saldo: tbVal.saldo,
      children: [],
      hasActivity: hasDirectActivity,
    });
  }

  // 5. Vincular hijos a sus padres previniendo ciclos
  const roots: TrialBalanceTreeNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId) && node.parentId !== node.id) {
      let currId: string | null = node.parentId;
      let hasCycle = false;
      const visited = new Set<string>([node.id]);
      while (currId && nodeMap.has(currId)) {
        if (visited.has(currId)) {
          hasCycle = true;
          break;
        }
        visited.add(currId);
        currId = nodeMap.get(currId)!.parentId;
      }

      if (!hasCycle) {
        const parent = nodeMap.get(node.parentId)!;
        parent.children.push(node);
        parent.isLeaf = false;
        if (!node.tipo && parent.tipo) {
          node.tipo = parent.tipo;
        }
        continue;
      }
    }
    roots.push(node);
  }

  // 6. Ordenar por código y asignar niveles
  const sortAndLevel = (nodes: TrialBalanceTreeNode[], level: number) => {
    nodes.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true, sensitivity: 'base' }));
    for (const n of nodes) {
      n.level = level;
      if (n.children.length > 0) {
        sortAndLevel(n.children, level + 1);
      }
    }
  };
  sortAndLevel(roots, 0);

  // 7. Acumular recursivamente los saldos hacia los padres (Roll-up)
  const rollUp = (node: TrialBalanceTreeNode): { debitos: number; creditos: number; saldo: number; hasActivity: boolean } => {
    if (node.children.length > 0) {
      let sumDeb = 0;
      let sumCred = 0;
      let sumSaldo = 0;
      let anyChildActive = false;

      for (const child of node.children) {
        const cBal = rollUp(child);
        sumDeb += cBal.debitos;
        sumCred += cBal.creditos;
        sumSaldo += cBal.saldo;
        if (cBal.hasActivity) anyChildActive = true;
      }

      node.debitos = sumDeb + (node.debitos || 0);
      node.creditos = sumCred + (node.creditos || 0);
      node.saldo = sumSaldo + (node.saldo || 0);
      node.hasActivity = anyChildActive || node.hasActivity;
    }
    return { debitos: node.debitos, creditos: node.creditos, saldo: node.saldo, hasActivity: node.hasActivity };
  };

  for (const root of roots) {
    rollUp(root);
  }

  // 8. Filtrar únicamente nodos con actividad o configurados, preservando su ruta de ancestros
  const isConfigured = (id: string) => !configuredAccountIds || configuredAccountIds.length === 0 || configuredAccountIds.includes(id);

  const filterActive = (nodes: TrialBalanceTreeNode[]): TrialBalanceTreeNode[] => {
    const res: TrialBalanceTreeNode[] = [];
    for (const node of nodes) {
      const activeChildren = filterActive(node.children);
      const hasActiveDescendant = activeChildren.length > 0;
      const matchesConfig = isConfigured(node.id);

      if ((node.hasActivity && matchesConfig) || hasActiveDescendant) {
        res.push({
          ...node,
          children: activeChildren,
          isLeaf: activeChildren.length === 0,
        });
      }
    }
    return res;
  };

  const activeRoots = filterActive(roots);

  // 9. Extraer cuentas hoja del árbol activo para el cálculo exacto de totales globales
  const leaves: TrialBalanceTreeNode[] = [];
  const collectLeaves = (nodes: TrialBalanceTreeNode[]) => {
    for (const n of nodes) {
      if (n.children.length === 0) {
        leaves.push(n);
      } else {
        collectLeaves(n.children);
      }
    }
  };
  collectLeaves(activeRoots);

  return {
    tree: activeRoots,
    leafAccounts: leaves,
  };
}

export function BalanceComprobacionView() {
  const { user, canPerform } = useAuth();
  const canExportTrialBalance = canPerform('ACCOUNTING_TRIAL_BALANCE', 'export');
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(`${today.getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(today.toISOString().slice(0, 10));
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  // undefined = la config aún no se carga; null = sin config (modo automático).
  const [configuredAccountIds, setConfiguredAccountIds] = useState<string[] | null | undefined>(undefined);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg: any = await contabilidadService.getConfig();
        if (mounted) {
          const saved = cfg?.config?.trialBalanceAccountIds;
          setConfiguredAccountIds(Array.isArray(saved) ? saved : null);
        }
      } catch {
        if (mounted) setConfiguredAccountIds(null);
      } finally {
        if (mounted) setConfigLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const accountIdsForQuery = configLoaded && configuredAccountIds && configuredAccountIds.length > 0 ? configuredAccountIds : undefined;

  const query = useAccountingQuery<{ tree: TrialBalanceTreeNode[]; leafAccounts: TrialBalanceTreeNode[] }>(
    ['trial-balance-hierarchy', dateFrom, dateTo, configLoaded ? (configuredAccountIds ? configuredAccountIds.join(',') : 'all') : 'loading'],
    async (signal) => {
      const params: { dateFrom?: string; dateTo?: string; accountIds?: string[] } = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (accountIdsForQuery) params.accountIds = accountIdsForQuery;

      const [tbRaw, chartRaw] = await Promise.all([
        contabilidadService.getTrialBalance(params, signal),
        contabilidadService.getChartOfAccounts(false, signal).catch(() => []),
      ]);

      return buildTrialBalanceTree(chartRaw, tbRaw, configuredAccountIds);
    },
    { enabled: Boolean(dateFrom || dateTo) },
  );

  const treeData = useMemo(() => query.data || { tree: [], leafAccounts: [] }, [query.data]);
  const loading = query.isLoading || query.isFetching;

  useEffect(() => {
    if (query.error) toast.error(query.error.message || 'Error al cargar balance de comprobación');
  }, [query.error]);

  // Filtro de búsqueda que mantiene las cuentas y sus subárboles coincidentes
  const filteredTree = useMemo(() => {
    if (!searchTerm.trim()) {
      return treeData.tree;
    }
    const q = searchTerm.toLowerCase().trim();

    const filterNodes = (nodes: TrialBalanceTreeNode[]): TrialBalanceTreeNode[] => {
      const res: TrialBalanceTreeNode[] = [];
      for (const node of nodes) {
        const matchSelf = node.codigo.toLowerCase().includes(q) || node.cuenta.toLowerCase().includes(q);
        const matchedChildren = filterNodes(node.children);

        if (matchSelf || matchedChildren.length > 0) {
          res.push({
            ...node,
            children: matchedChildren.length > 0 ? matchedChildren : (matchSelf ? node.children : []),
          });
        }
      }
      return res;
    };

    return filterNodes(treeData.tree);
  }, [treeData.tree, searchTerm]);

  const toggleNodeExpansion = (id: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const allParentIds = new Set<string>();
    const collect = (nodes: TrialBalanceTreeNode[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) {
          allParentIds.add(n.id);
          collect(n.children);
        }
      }
    };
    collect(treeData.tree);
    setExpandedNodeIds(allParentIds);
  };

  const handleCollapseAll = () => {
    setExpandedNodeIds(new Set());
  };

  const toggleAccountMovements = (accountId: string) => {
    setExpandedAccountId((current) => (current === accountId ? null : accountId));
  };

  // Aplanar filas visibles respetando el estado de expansión de cada nivel (opcional/manual)
  const getVisibleRowsForType = (
    typeRoots: TrialBalanceTreeNode[],
    expandedIds: Set<string>
  ): TrialBalanceTreeNode[] => {
    const result: TrialBalanceTreeNode[] = [];
    const walkVisible = (nodes: TrialBalanceTreeNode[]) => {
      for (const n of nodes) {
        result.push(n);
        const isExpanded = expandedIds.has(n.id);
        if (!n.isLeaf && isExpanded) {
          walkVisible(n.children);
        }
      }
    };
    walkVisible(typeRoots);
    return result;
  };

  const grouped = useMemo(() => {
    return ACCOUNT_TYPE_ORDER.map((type) => {
      const typeRoots = filteredTree.filter((r) => r.tipo === type);
      const visibleRows = getVisibleRowsForType(typeRoots, expandedNodeIds);

      let leafCount = 0;
      const countLeaves = (nodes: TrialBalanceTreeNode[]) => {
        for (const n of nodes) {
          if (n.children.length === 0) leafCount++;
          else countLeaves(n.children);
        }
      };
      countLeaves(typeRoots);

      return {
        type,
        label: ACCOUNT_TYPE_LABELS[type] || type,
        roots: typeRoots,
        visibleRows,
        leafCount,
      };
    }).filter((g) => g.roots.length > 0);
  }, [filteredTree, expandedNodeIds]);

  // Totales globales: calculados estrictamente sobre las cuentas hoja para evitar doble conteo
  const totalDebitos = useMemo(() => {
    return treeData.leafAccounts.reduce((sum, r) => sum + r.debitos, 0);
  }, [treeData.leafAccounts]);

  const totalCreditos = useMemo(() => {
    return treeData.leafAccounts.reduce((sum, r) => sum + r.creditos, 0);
  }, [treeData.leafAccounts]);

  const isBalanced = Math.abs(totalDebitos - totalCreditos) < 0.01;
  const difference = totalDebitos - totalCreditos;
  const differenceAbs = Math.abs(difference);
  const higherSide = difference > 0 ? 'los débitos superan a los créditos' : 'los créditos superan a los débitos';

  const fmt = (n: number) => n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const balanceStatusLabel = isBalanced
    ? '✓ BALANCEADO — Débitos = Créditos'
    : `✗ NO BALANCEADO — Diferencia de C$ ${fmt(differenceAbs)} (${higherSide})`;

  const handlePrint = async () => {
    if (!canExportTrialBalance) return;
    const flattenForPdf = (nodes: TrialBalanceTreeNode[]): any[] => {
      const out: any[] = [];
      for (const n of nodes) {
        out.push({
          codigo: n.codigo,
          cuenta: '   '.repeat(n.level) + n.cuenta,
          tipo: n.tipo,
          debitos: n.debitos,
          creditos: n.creditos,
          saldo: n.saldo,
        });
        if (n.children.length > 0) {
          out.push(...flattenForPdf(n.children));
        }
      }
      return out;
    };
    const exportRows = grouped.flatMap((group) => flattenForPdf(group.roots));
    try {
      await generateTrialBalancePDF({
        rows: exportRows,
        tenantName: user?.sessionBranding?.name || user?.clientTenant?.name || user?.tenantName || 'NovaHub',
        tenantLogo: user?.sessionBranding?.logo || user?.clientTenant?.logo || undefined,
        dateFrom,
        dateTo,
        totals: {
          debitos: fmt(totalDebitos),
          creditos: fmt(totalCreditos),
        },
      });
      toast.success('Balance de comprobación generado con la plantilla de esta vista');
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo generar el balance de comprobación');
    }
  };

  const handleExportExcel = () => {
    if (!canExportTrialBalance) return;
    const flattenForExcel = (nodes: TrialBalanceTreeNode[]): any[] => {
      const out: any[] = [];
      for (const n of nodes) {
        out.push({
          Código: n.codigo,
          Cuenta: '   '.repeat(n.level) + n.cuenta,
          Tipo: accountTypeLabel(n.tipo),
          Nivel: n.level + 1,
          'Tipo de cuenta': n.isLeaf ? 'Detalle' : 'Agrupadora',
          Débitos: n.debitos,
          Créditos: n.creditos,
          Saldo: n.saldo,
        });
        if (n.children.length > 0) {
          out.push(...flattenForExcel(n.children));
        }
      }
      return out;
    };
    const rows = grouped.flatMap((group) => flattenForExcel(group.roots));
    const workbook = XLSX.utils.book_new();
    const detailSheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Mensaje: 'Sin registros para el alcance seleccionado' }]);
    detailSheet['!cols'] = [{ wch: 16 }, { wch: 42 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(workbook, detailSheet, 'Balanza');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['Reporte', 'Balance de comprobación'],
      ['Desde', dateFrom || ''],
      ['Hasta', dateTo || ''],
      ['Total débitos', totalDebitos],
      ['Total créditos', totalCreditos],
      ['Diferencia', difference],
      ['Estado', isBalanced ? 'Balanceado' : 'No balanceado'],
    ]), 'Resumen');
    XLSX.writeFile(workbook, buildDateFilteredDownloadFileName(['balance_comprobacion'], 'xlsx', dateFrom, dateTo));
    toast.success(`Balance exportado con ${rows.length} cuenta(s)`);
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/30 p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
            <span className="flex items-center gap-2 rounded-lg border border-border/30 bg-background/50 px-3 py-1.5 text-foreground">
              <Filter className="size-3.5" /> Filtros
            </span>
            <span className="hidden text-[10px] font-medium normal-case tracking-normal text-muted-foreground/70 sm:inline">
              Filtra y personaliza el balance de comprobación
            </span>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          {/* Buscar cuenta o código */}
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2 lg:col-span-6">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              Buscar cuenta o código
            </label>
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre de cuenta o código..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-9 w-full pl-9"
              />
            </div>
          </div>

          {/* Fecha Desde */}
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-1 lg:col-span-3">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              Desde
            </label>
            <DateField
              value={dateFrom}
              onChange={(val) => {
                if (dateTo && val && val > dateTo) {
                  toast.error('No se puede filtrar a una fecha anterior a la fecha inicial');
                  setDateTo(val);
                }
                setDateFrom(val);
              }}
              maxDate={dateTo || undefined}
              placeholder="Fecha inicial"
              className="w-full"
            />
          </div>

          {/* Fecha Hasta */}
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-1 lg:col-span-3">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              Hasta
            </label>
            <DateField
              value={dateTo}
              onChange={(val) => {
                if (dateFrom && val && val < dateFrom) {
                  toast.error('No se puede filtrar a una fecha anterior a la fecha inicial');
                  return;
                }
                setDateTo(val);
              }}
              minDate={dateFrom || undefined}
              placeholder="Fecha final"
              className="w-full"
            />
          </div>
        </div>

        {/* Barra de acciones inferior */}
        <div className="flex min-w-0 flex-col gap-3 border-t border-border/30 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {/* Grupo 1: Árbol (Expandir / Colapsar) */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExpandAll}
              className="h-9 w-full sm:w-auto gap-1 text-xs"
              title="Expandir todas las subcuentas"
            >
              <ChevronDown className="size-3.5" /> Expandir
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCollapseAll}
              className="h-9 w-full sm:w-auto gap-1 text-xs"
              title="Colapsar a nivel principal"
            >
              <ChevronRight className="size-3.5" /> Colapsar
            </Button>
          </div>

          {/* Grupo 2: Exportaciones y Configuración */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {canExportTrialBalance && (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-9 w-full sm:w-auto text-xs">
                  <Download className="size-4" /> Exportar Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} className="h-9 w-full sm:w-auto text-xs">
                  <Download className="size-4" /> Exportar PDF
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="h-9 w-full sm:w-auto gap-1.5 text-xs">
                <Settings2 className="size-4" /> Configuración
              </Button>

              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="flex h-9 w-full sm:w-auto items-center justify-center gap-1.5 rounded-md border border-dashed border-border/60 px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-rose-500/5 hover:text-rose-500 hover:border-rose-500/40"
                >
                  <X className="size-3.5" /> Limpiar
                </button>
              )}
            </div>

            {configuredAccountIds && configuredAccountIds.length > 0 && (
              <button
                onClick={() => {
                  setConfiguredAccountIds(null);
                  void contabilidadService.updateConfig({ trialBalanceAccountIds: [] }).then(() => toast.success('Mostrando todas las cuentas')).catch(() => undefined);
                }}
                title="Se está mostrando solo un subconjunto de cuentas. Haz clic para volver a mostrar todas."
                className="inline-flex h-9 w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10"
              >
                <X className="size-3.5" /> Filtro ({configuredAccountIds.length})
              </button>
            )}
          </div>
        </div>
      </div>

      <AccountChecklistDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        viewLabel="Balance de Comprobación"
        description="Cuentas contables que alimentan el balance. Solo se muestran cuentas de detalle: las agrupadoras se omiten para no repetir movimientos. Marca con checks las cuentas que quieres ver y operar; las que dejes sin marcar se ocultan del reporte."
        configKey="trialBalanceAccountIds"
        onSaved={() => {
          void (async () => {
            try {
              const cfg: any = await contabilidadService.getConfig();
              const saved = cfg?.config?.trialBalanceAccountIds;
              setConfiguredAccountIds(Array.isArray(saved) ? saved : null);
            } catch { /* noop */ }
          })();
        }}
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/30 px-5 pb-4 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Scale className="size-5 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-xl font-black uppercase italic tracking-tight">Balance de Comprobación</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Estructura jerárquica con subtotales consolidados. Haz clic en una cuenta de detalle para consultar sus movimientos.</p>
              </div>
            </div>
            <Badge variant={isBalanced ? "default" : "destructive"} className={cn("gap-1 text-[10px] font-black uppercase tracking-widest", isBalanced && "bg-emerald-600")} title={balanceStatusLabel}>
              {isBalanced ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
              {isBalanced ? 'Balanceado' : `No balanceado · C$ ${fmt(differenceAbs)}`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="w-[180px] text-[10px] font-black uppercase tracking-widest text-foreground">Código</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground">Cuenta</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-black uppercase tracking-widest text-foreground">Tipo</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-black uppercase tracking-widest text-foreground text-right">Débitos</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-black uppercase tracking-widest text-foreground text-right">Créditos</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-black uppercase tracking-widest text-foreground text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Cargando balance...</TableCell></TableRow>
                ) : grouped.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No hay datos para el rango seleccionado</TableCell></TableRow>
                ) : grouped.flatMap((group, gi) => [
                  <TableRow key={`group-${gi}`} className="bg-primary/5 hover:bg-primary/10 border-b-2 border-primary/20">
                    <TableCell colSpan={6} className="py-2.5">
                      <span className="text-xs font-black uppercase tracking-widest text-primary">{group.label}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground">({group.leafCount} {group.leafCount === 1 ? 'cuenta' : 'cuentas'})</span>
                    </TableCell>
                  </TableRow>,
                  ...group.visibleRows.flatMap((row) => {
                    const isMovementExpanded = expandedAccountId === row.id;
                    const isNodeExpanded = expandedNodeIds.has(row.id);
                    const isParent = !row.isLeaf;

                    return [
                      <TableRow
                        key={`row-${row.id}`}
                        className={cn(
                          "border-border/30 hover:bg-muted/30 transition-colors",
                          isParent && "bg-muted/15 font-semibold text-foreground"
                        )}
                      >
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {row.codigo}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div
                            className="flex items-center gap-1.5"
                            style={{ paddingLeft: `${row.level * 1.5}rem` }}
                          >
                            {isParent ? (
                              <button
                                type="button"
                                onClick={() => toggleNodeExpansion(row.id)}
                                className="p-1 -ml-1 rounded hover:bg-muted/60 text-foreground/80 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                                title={isNodeExpanded ? 'Colapsar subcuentas' : 'Expandir subcuentas'}
                                aria-expanded={isNodeExpanded}
                              >
                                {isNodeExpanded ? (
                                  <ChevronDown className="size-3.5 shrink-0 text-primary" />
                                ) : (
                                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                                )}
                              </button>
                            ) : (
                              <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                                <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                              </span>
                            )}

                            {isParent ? (
                              <button
                                type="button"
                                onClick={() => toggleNodeExpansion(row.id)}
                                className="text-left font-bold hover:text-primary focus-visible:outline-none transition-colors"
                              >
                                <span className="break-words">{row.cuenta}</span>
                                <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                                  ({row.children.length} {row.children.length === 1 ? 'subcuenta' : 'subcuentas'})
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleAccountMovements(row.id)}
                                aria-expanded={isMovementExpanded}
                                className="flex min-w-0 items-center gap-1.5 text-left font-medium hover:text-primary focus-visible:outline-none transition-colors"
                                title="Ver detalle de movimientos"
                              >
                                {isMovementExpanded ? (
                                  <ChevronUp className="size-3 shrink-0 text-primary" />
                                ) : (
                                  <ChevronDown className="size-3 shrink-0 text-muted-foreground/60" />
                                )}
                                <span className="break-words">{row.cuenta}</span>
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={isParent ? "secondary" : "outline"}
                            className="text-[9px] font-bold uppercase tracking-wider"
                          >
                            {accountTypeLabel(row.tipo)}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn("text-right font-mono text-xs", row.debitos > 0 && "text-emerald-600", isParent && "font-bold")}>
                          {fmt(row.debitos)}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono text-xs", row.creditos > 0 && "text-emerald-600", isParent && "font-bold")}>
                          {fmt(row.creditos)}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono text-xs font-bold", row.saldo >= 0 ? "text-emerald-600" : "text-red-600")}>
                          {fmt(row.saldo)}
                        </TableCell>
                      </TableRow>,
                      ...(isMovementExpanded && !isParent ? [
                        <TableRow key={`detail-${row.id}`} className="hover:bg-transparent">
                          <TableCell colSpan={6} className="p-0 bg-muted/10">
                            <AccountMovementsDetail
                              accountId={row.id}
                              codigo={row.codigo}
                              cuenta={row.cuenta}
                              tipo={row.tipo}
                              dateFrom={dateFrom}
                              dateTo={dateTo}
                            />
                          </TableCell>
                        </TableRow>,
                      ] : []),
                    ];
                  }),
                ])}
              </TableBody>
            </Table>
          </div>

          <div className="p-3 md:hidden">
            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Cargando balance...</div>
            ) : grouped.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No hay datos</div>
            ) : grouped.map((group) => (
              <div key={group.type} className="space-y-2 mb-4">
                <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">{group.label}</span>
                  <span className="text-[10px] text-muted-foreground">{group.leafCount} {group.leafCount === 1 ? 'cuenta' : 'cuentas'}</span>
                </div>
                {group.visibleRows.map((row) => {
                  const isMovementExpanded = expandedAccountId === row.id;
                  const isNodeExpanded = expandedNodeIds.has(row.id);
                  const isParent = !row.isLeaf;

                  return (
                    <div
                      key={`m-${row.id}`}
                      style={{ marginLeft: `${Math.min(row.level * 12, 36)}px` }}
                      className={cn(
                        "rounded-xl border border-border/60 bg-card/60 shadow-sm transition-all",
                        isParent && "bg-muted/20 border-primary/20"
                      )}
                    >
                      <div className="flex w-full min-w-0 items-start justify-between gap-2 p-3 text-left">
                        <button
                          type="button"
                          onClick={() => isParent ? toggleNodeExpansion(row.id) : toggleAccountMovements(row.id)}
                          className="flex min-w-0 flex-1 items-start gap-2 text-left focus-visible:outline-none"
                        >
                          {isParent ? (
                            isNodeExpanded ? <ChevronDown className="mt-0.5 size-4 shrink-0 text-primary" /> : <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          ) : (
                            isMovementExpanded ? <ChevronUp className="mt-0.5 size-4 shrink-0 text-primary" /> : <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] text-muted-foreground">{row.codigo}</span>
                              {isParent && (
                                <Badge variant="secondary" className="h-4 px-1 text-[8px] font-bold">
                                  {row.children.length} sub
                                </Badge>
                              )}
                            </div>
                            <p className={cn("mt-0.5 text-sm", isParent ? "font-black text-foreground" : "font-semibold text-foreground/90")}>
                              {row.cuenta}
                            </p>
                          </div>
                        </button>
                        <Badge variant={isParent ? "secondary" : "outline"} className="shrink-0 text-[9px] font-bold uppercase tracking-wider">
                          {accountTypeLabel(row.tipo)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 border-t border-border/50 px-3 py-2.5 bg-background/30">
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Débitos</p>
                          <p className={cn("mt-0.5 truncate font-mono text-xs", row.debitos > 0 && "text-emerald-600", isParent && "font-bold")}>{fmt(row.debitos)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Créditos</p>
                          <p className={cn("mt-0.5 truncate font-mono text-xs", row.creditos > 0 && "text-emerald-600", isParent && "font-bold")}>{fmt(row.creditos)}</p>
                        </div>
                        <div className="min-w-0 text-right">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Saldo</p>
                          <p className={cn("mt-0.5 truncate font-mono text-xs font-bold", row.saldo >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt(row.saldo)}</p>
                        </div>
                      </div>

                      {isMovementExpanded && !isParent && (
                        <div className="border-t border-border/50 p-2">
                          <AccountMovementsDetail
                            accountId={row.id}
                            codigo={row.codigo}
                            cuenta={row.cuenta}
                            tipo={row.tipo}
                            dateFrom={dateFrom}
                            dateTo={dateTo}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <Separator />
          <div className={cn("flex flex-col gap-3 px-3 py-4 font-bold sm:flex-row sm:items-center sm:justify-between sm:px-6", isBalanced ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20")}>
            <span className="text-sm uppercase tracking-wider">Totales de Balanza</span>
            <div className="grid min-w-0 grid-cols-2 gap-2 text-sm sm:flex sm:items-center sm:gap-8">
              <span className={cn("min-w-0 rounded-lg bg-background/40 px-2 py-1.5 sm:bg-transparent sm:p-0", totalDebitos > 0 && "text-emerald-600")}>
                <span className="mr-1 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:hidden">Débitos</span>
                {fmt(totalDebitos)}
              </span>
              <span className={cn("min-w-0 rounded-lg bg-background/40 px-2 py-1.5 sm:bg-transparent sm:p-0", totalCreditos > 0 && "text-emerald-600")}>
                <span className="mr-1 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:hidden">Créditos</span>
                {fmt(totalCreditos)}
              </span>
              <span className={cn("col-span-2 min-w-0 text-left text-[11px] font-black uppercase tracking-wider sm:col-span-1 sm:text-sm", isBalanced ? "text-emerald-600" : "text-red-600")}>
                {isBalanced ? '✓ BALANCEADO' : '✗ NO BALANCEADO'}
              </span>
            </div>
            {!isBalanced && (
              <div className="min-w-0 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-[10px] leading-relaxed text-red-600">
                <span className="block font-black uppercase tracking-wider">
                  Diferencia: C$ {fmt(differenceAbs)}
                </span>
                <span className="block font-medium normal-case">
                  {difference > 0
                    ? 'Los débitos superan a los créditos: falta registrar créditos o hay débitos de más.'
                    : 'Los créditos superan a los débitos: falta registrar débitos o hay créditos de más.'}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
