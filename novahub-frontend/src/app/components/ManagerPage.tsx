import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { ArrowRight, ArrowUpRight, BarChart3, Building2, Boxes, Cloud, Download, FileStack, KeyRound, Landmark, MapPin, Package, Pencil, Plus, ShieldCheck, Sparkles, Trash2, Users, UserCheck, UserX, Warehouse, RefreshCw, Tags, ArrowRightLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useTenantQuery } from '../hooks/useTenantQuery';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { enterpriseGroupsService, type ManagerInventoryModuleResponse, type ManagerOverview } from '../services/enterprise-groups.service';
import { MANAGER_SECTIONS, ManagerShell, type ManagerSection } from './ManagerShell';
import { ManagerInventoryModule } from './manager/ManagerInventoryModule';
import { SharedInventoryImportCard, type SharedInventoryImportRow } from './manager/SharedInventoryImportCard';
import type { ManagerInventoryView } from './manager/manager-inventory.types';
import { ManagerSalesModule } from './manager/ManagerSalesModule';
import type { ManagerSalesView } from './manager/manager-sales.types';
import { ManagerPurchasesModule } from './manager/ManagerPurchasesModule';
import type { ManagerPurchasesView } from './manager/manager-purchases.types';
import { ManagerFinanceModule } from './manager/ManagerFinanceModule';
import type { ManagerFinanceView } from './manager/manager-finance.types';
import { ManagerAccountingModule } from './manager/ManagerAccountingModule';
import type { ManagerAccountingView } from './manager/manager-accounting.types';
import { ManagerReportsModule } from './manager/ManagerReportsModule';
import type { ManagerReportsView } from './manager/manager-reports.types';
import { ManagerHRModule } from './manager/ManagerHRModule';
import type { ManagerHrView } from './manager/manager-hr.types';
import { ManagerUserEditorDialog } from './manager/ManagerUserEditorDialog';
import { BrandLogo } from './BrandLogo';
import { InventoryDetailPanel } from './inventory/InventoryDetailPanel';
import { emptyManagerPermissionState, MANAGER_PERMISSION_OPTIONS, managerPermissionsToState, managerStateToPermissions, type ManagerPermissionLevel, type ManagerPermissionState } from '../constants/managerPermissions';
import { getBusinessTypeLabel } from '../constants/businessTypes';

const numberFormat = new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 });
const formatNumber = (value: unknown) => numberFormat.format(Number(value || 0));
const formatStorage = (value: unknown) => {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = bytes;
  let unitIndex = -1;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  return `${amount.toFixed(amount >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

function downloadCsv(name: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return toast.info('No hay datos para exportar');
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(';'), ...rows.map((row) => keys.map((key) => JSON.stringify(row[key] ?? '')).join(';'))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

async function readSpreadsheet(file: File) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }) : [];
}

export function ManagerPage() {
  const [section, setSection] = useState<ManagerSection>('overview');
  const [inventoryView, setInventoryView] = useState<ManagerInventoryView>('overview');
  const [salesView, setSalesView] = useState<ManagerSalesView>('overview');
  const [purchasesView, setPurchasesView] = useState<ManagerPurchasesView>('overview');
  const [financeView, setFinanceView] = useState<ManagerFinanceView>('overview');
  const [accountingView, setAccountingView] = useState<ManagerAccountingView>('overview');
  const [reportView, setReportView] = useState<ManagerReportsView>('overview');
  const [hrView, setHrView] = useState<ManagerHrView>('overview');
  const [transferToApprove, setTransferToApprove] = useState<any | null>(null);
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [managerReportCurrency, setManagerReportCurrency] = useState('');
  const [warehouseName, setWarehouseName] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [warehouseBusinessUnitId, setWarehouseBusinessUnitId] = useState('');
  const [warehouseBranchIds, setWarehouseBranchIds] = useState<string[]>([]);
  const [editingManagerId, setEditingManagerId] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [managerBranchIds, setManagerBranchIds] = useState<string[]>([]);
  const [managerCanManageManagers, setManagerCanManageManagers] = useState(false);
  const [managerCanEdit, setManagerCanEdit] = useState(false);
  const [managerPermissionState, setManagerPermissionState] = useState<ManagerPermissionState>(defaultManagerPermissionState);
  const [editingBranchUser, setEditingBranchUser] = useState<any | null>(null);
  const [catalogSourceBranchId, setCatalogSourceBranchId] = useState('');
  const [catalogProductIds, setCatalogProductIds] = useState<string[]>([]);
  const [catalogTargetBranchIds, setCatalogTargetBranchIds] = useState<string[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryImportSourceBranchId, setInventoryImportSourceBranchId] = useState('');
  const [inventoryImportBranchIds, setInventoryImportBranchIds] = useState<string[]>([]);
  const [inventoryImportRows, setInventoryImportRows] = useState<any[]>([]);
  const [inventoryImportFileName, setInventoryImportFileName] = useState('');
  const [inventoryImportPriceMode, setInventoryImportPriceMode] = useState<'SAME' | 'BY_BRANCH'>('SAME');
  const [inventoryPricesByBranch, setInventoryPricesByBranch] = useState<Record<string, Record<string, string>>>({});
  const [inventoryWarehouseByBranch, setInventoryWarehouseByBranch] = useState<Record<string, string>>({});
  const [accountingImportUnitId, setAccountingImportUnitId] = useState('');
  const [accountingImportBranchIds, setAccountingImportBranchIds] = useState<string[]>([]);
  const [accountingImportRows, setAccountingImportRows] = useState<any[]>([]);
  const [accountingImportFileName, setAccountingImportFileName] = useState('');
  const { enterBranch } = useImpersonation();

  const groupsQuery = useTenantQuery(['manager-groups'], (signal) => enterpriseGroupsService.getManagerGroups(signal));
  const groups = groupsQuery.data || [];
  const groupId = groups[0]?.id || '';
  const group = groups[0];
  const businessUnits = group?.businessUnits || [];
  const branchOptions = useMemo(
    () => (group?.branches || []).filter((branch) => !selectedBusinessUnitId || branch.businessUnitId === selectedBusinessUnitId),
    [group?.branches, selectedBusinessUnitId],
  );
  const allowedSections = useMemo(() => getAllowedManagerSections(group?.managerAccess), [group?.managerAccess]);
  const canEnterBranch = useMemo(() => Boolean(group?.managerAccess?.canEdit) || managerAccessAllows(group?.managerAccess, 'BRANCH_OPERATIONS') || managerAccessAllows(group?.managerAccess, 'MANAGER_SALES'), [group?.managerAccess]);
  const canEditBranchUsers = useMemo(() => managerAccessAllowsAction(group?.managerAccess, 'MANAGER_USERS', 'edit'), [group?.managerAccess]);
  const canManageManagersFromUsers = useMemo(() => managerAccessAllowsAction(group?.managerAccess, 'MANAGER_MANAGERS', 'manage'), [group?.managerAccess]);

  useEffect(() => {
    if (selectedBusinessUnitId && !businessUnits.some((unit) => unit.id === selectedBusinessUnitId && unit.isActive !== false)) setSelectedBusinessUnitId('');
    if ((section === 'inventory' || section === 'finances' || section === 'accounting') && !selectedBusinessUnitId) {
      const firstActiveUnit = businessUnits.find((unit) => unit.isActive !== false);
      if (firstActiveUnit) setSelectedBusinessUnitId(firstActiveUnit.id);
    }
    if (selectedBranchId && !branchOptions.some((branch) => branch.id === selectedBranchId)) setSelectedBranchId('');
    if (!allowedSections.includes(section) && allowedSections[0]) setSection(allowedSections[0]);
  }, [groupId, selectedBusinessUnitId, selectedBranchId, businessUnits, branchOptions, allowedSections, section]);

  useEffect(() => {
    setManagerReportCurrency('');
  }, [groupId]);

  const overviewQuery = useTenantQuery(
    ['manager-overview', groupId, selectedBranchId || 'all'],
    (signal) => enterpriseGroupsService.getOverview(groupId, selectedBranchId || undefined, signal),
    // El módulo de inventario también necesita el catálogo de almacenes
    // corporativos creado desde la configuración del grupo empresarial.
    { enabled: Boolean(groupId) && allowedSections.includes('overview') && (section === 'overview' || section === 'inventory') },
  );
  const inventoryQuery = useTenantQuery(
    ['manager-inventory', groupId, selectedBusinessUnitId || 'all', selectedBranchId || 'all'],
    (signal) => enterpriseGroupsService.getInventory(groupId, selectedBranchId || undefined, selectedBusinessUnitId || undefined, signal),
    // El módulo nuevo consulta cada subvista con su propio alcance y paginación.
    { enabled: false },
  );
  const inventoryWarehousesQuery = useTenantQuery(
    ['manager-inventory-warehouses', groupId, selectedBusinessUnitId || 'all', selectedBranchId || 'all'],
    (signal) => enterpriseGroupsService.getInventoryModule(groupId, { view: 'warehouses', businessUnitId: selectedBusinessUnitId || undefined, branchId: selectedBranchId || undefined, report: true, page: 1, pageSize: 5000 }, signal),
    { enabled: Boolean(groupId) && section === 'inventory' },
  );
  const accountingQuery = useTenantQuery(
    ['manager-accounting', groupId, selectedBranchId || 'all'],
    (signal) => enterpriseGroupsService.getAccounting(groupId, selectedBranchId || undefined, signal),
    { enabled: false },
  );
  const usersQuery = useTenantQuery(
    ['manager-users', groupId, selectedBranchId || 'all'],
    (signal) => enterpriseGroupsService.getUsers(groupId, selectedBranchId || undefined, signal),
    { enabled: Boolean(groupId) && section === 'users' },
  );
  const managersQuery = useTenantQuery(
    ['manager-assignments', groupId],
    (signal) => enterpriseGroupsService.getManagers(groupId, signal),
    { enabled: Boolean(groupId) && section === 'managers' },
  );
  const sharedCatalogQuery = useTenantQuery(
    ['manager-catalog', groupId],
    (signal) => enterpriseGroupsService.listSharedCatalog(groupId, undefined, signal),
    { enabled: Boolean(groupId) && section === 'catalog' },
  );
  const branchProductsQuery = useTenantQuery(
    ['manager-branch-products', groupId, catalogSourceBranchId, catalogSearch],
    (signal) => enterpriseGroupsService.getBranchProducts(groupId, catalogSourceBranchId, catalogSearch || undefined, signal),
    { enabled: Boolean(groupId) && section === 'catalog' && Boolean(catalogSourceBranchId) },
  );

  const warehouseMutation = useMutation({
    mutationFn: () => enterpriseGroupsService.createWarehouse(groupId, { name: warehouseName, location: warehouseLocation, businessUnitId: warehouseBusinessUnitId, scopeType: 'BUSINESS_UNIT', authorizedBranchIds: warehouseBranchIds }),
    onSuccess: () => { setWarehouseName(''); setWarehouseLocation(''); setWarehouseBusinessUnitId(''); setWarehouseBranchIds([]); void overviewQuery.refetch(); void inventoryWarehousesQuery.refetch(); toast.success('Almacén agregado'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const syncWarehouseCatalogMutation = useMutation({
    mutationFn: (warehouseId: string) => enterpriseGroupsService.syncCorporateWarehouseCatalog(groupId, warehouseId),
    onSuccess: (result: any) => { void overviewQuery.refetch(); void inventoryWarehousesQuery.refetch(); toast.success(`Catálogo preparado: ${result.productsLinked || 0} producto(s), ${result.stockLevelsCreated || 0} registro(s) en cero`); },
    onError: (error: Error) => toast.error(error.message),
  });
  const managerPayload = () => ({ name: managerName.trim(), email: managerEmail.trim(), ...(managerPassword ? { password: managerPassword } : {}), branchIds: managerBranchIds, permissions: managerStateToPermissions(managerPermissionState), canEdit: managerCanEdit, canManageManagers: managerCanManageManagers });
  const resetManagerForm = () => { setEditingManagerId(''); setManagerName(''); setManagerEmail(''); setManagerPassword(''); setManagerBranchIds([]); setManagerCanManageManagers(false); setManagerCanEdit(false); setManagerPermissionState(defaultManagerPermissionState()); };
  const managerMutation = useMutation({
    mutationFn: () => editingManagerId
      ? enterpriseGroupsService.updateManager(groupId, editingManagerId, managerPayload())
      : enterpriseGroupsService.createManager(groupId, { ...managerPayload(), password: managerPassword }),
    onSuccess: () => { const wasEditing = Boolean(editingManagerId); resetManagerForm(); managersQuery.refetch(); toast.success(wasEditing ? 'Manager actualizado' : 'Manager creado'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const managerPasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) => enterpriseGroupsService.updateManagerPassword(groupId, userId, password),
    onSuccess: () => toast.success('Contraseña de Manager actualizada'),
    onError: (error: Error) => toast.error(error.message),
  });
  const revokeManagerMutation = useMutation({
    mutationFn: (userId: string) => enterpriseGroupsService.revokeManager(groupId, userId),
    onSuccess: () => { managersQuery.refetch(); toast.success('Acceso Manager revocado'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const branchUserMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: { name?: string; email?: string; password?: string; isActive?: boolean } }) => enterpriseGroupsService.updateBranchUser(groupId, userId, payload),
    onSuccess: () => {
      setEditingBranchUser(null);
      void usersQuery.refetch();
      void overviewQuery.refetch();
      toast.success('Usuario de sucursal actualizado');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const shareCatalogMutation = useMutation({
    mutationFn: () => enterpriseGroupsService.shareCatalog(groupId, { productIds: catalogProductIds, branchIds: catalogTargetBranchIds }),
    onSuccess: () => { setCatalogProductIds([]); setCatalogTargetBranchIds([]); sharedCatalogQuery.refetch(); toast.success('Catálogo compartido con las sucursales seleccionadas'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const unshareMutation = useMutation({
    mutationFn: (mirrorIds: string[]) => enterpriseGroupsService.unshareCatalog(groupId, { mirrorIds }),
    onSuccess: () => { sharedCatalogQuery.refetch(); toast.success('Producto retirado del catálogo compartido'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const syncMutation = useMutation({
    mutationFn: (productId: string) => enterpriseGroupsService.syncFromMaster(groupId, { productId }),
    onSuccess: (result: any) => { sharedCatalogQuery.refetch(); toast.success(`Espejos sincronizados: ${result.synced}`); },
    onError: (error: Error) => toast.error(error.message),
  });
  const inventoryImportMutation = useMutation({
    mutationFn: () => enterpriseGroupsService.importSharedInventory(groupId, {
      sourceBranchId: inventoryImportSourceBranchId,
      branchIds: inventoryImportBranchIds,
      warehouseByBranch: inventoryWarehouseByBranch,
      priceMode: inventoryImportPriceMode,
      pricesByBranch: inventoryPricesByBranch,
      rows: inventoryImportRows.map((row) => ({
        code: row.code ?? row.codigo ?? row.Código ?? row.SKU ?? row.sku,
        stock: row.stock ?? row.cantidad ?? row.Stock ?? row.Cantidad,
        salePrice: row.salePrice ?? row.precio ?? row.precio_venta ?? row.Precio ?? row['Precio de venta'],
        costPrice: row.costPrice ?? row.costo ?? row.costo_unitario ?? row.Costo,
      })),
    }),
    onSuccess: (result: any) => {
      setInventoryImportSourceBranchId('');
      setInventoryImportBranchIds([]);
      setInventoryImportRows([]);
      setInventoryImportFileName('');
      setInventoryImportPriceMode('SAME');
      setInventoryPricesByBranch({});
      void inventoryQuery.refetch();
      void overviewQuery.refetch();
      void sharedCatalogQuery.refetch();
      toast.success(`Inventario aplicado a ${result.stockUpdated || 0} ubicación(es) y ${result.productsCreated || 0} espejo(s) creado(s)`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const accountingImportMutation = useMutation({
    mutationFn: () => enterpriseGroupsService.importSharedAccounts(groupId, { businessUnitId: accountingImportUnitId, branchIds: accountingImportBranchIds, rows: accountingImportRows }),
    onSuccess: (result: any) => { setAccountingImportRows([]); setAccountingImportFileName(''); accountingQuery.refetch(); toast.success(`Plan de cuentas propagado a ${result.branches?.length || 0} sucursal(es)`); },
    onError: (error: Error) => toast.error(error.message),
  });

  const [consDateFrom, setConsDateFrom] = useState('');
  const [consDateTo, setConsDateTo] = useState('');
  const consolidatedTrialBalance = useTenantQuery(
    ['consolidated-trial-balance', groupId, consDateFrom, consDateTo],
    (signal) => enterpriseGroupsService.getConsolidatedTrialBalance(groupId, consDateFrom || undefined, consDateTo || undefined, signal),
    { enabled: Boolean(groupId) && section === 'consolidated' },
  );
  const consolidatedProfitLoss = useTenantQuery(
    ['consolidated-profit-loss', groupId, consDateFrom, consDateTo],
    (signal) => enterpriseGroupsService.getConsolidatedProfitLoss(groupId, consDateFrom || undefined, consDateTo || undefined, signal),
    { enabled: Boolean(groupId) && section === 'consolidated' },
  );
  const consolidatedBalanceSheet = useTenantQuery(
    ['consolidated-balance-sheet', groupId],
    (signal) => enterpriseGroupsService.getConsolidatedBalanceSheet(groupId, signal),
    { enabled: Boolean(groupId) && section === 'consolidated' },
  );
  const consolidatedBranchComparison = useTenantQuery(
    ['consolidated-branch-comparison', groupId, consDateFrom, consDateTo],
    (signal) => enterpriseGroupsService.getConsolidatedBranchComparison(groupId, consDateFrom || undefined, consDateTo || undefined, signal),
    { enabled: Boolean(groupId) && section === 'consolidated' },
  );
  const transfersQuery = useTenantQuery(
    ['manager-transfers', groupId],
    (signal) => enterpriseGroupsService.getTransfers(groupId, undefined, signal),
    { enabled: Boolean(groupId) && section === 'transfers' },
  );
  const approveTransferMutation = useMutation({
    mutationFn: (transferId: string) => enterpriseGroupsService.updateTransferStatus(groupId, transferId, 'COMPLETED'),
    onSuccess: () => {
      const isRepair = String(transferToApprove?.status || '').toUpperCase() === 'COMPLETED';
      toast.success(isRepair ? 'Contabilidad de la transferencia sincronizada' : 'Transferencia aprobada y ejecutada');
      void transfersQuery.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const overview = overviewQuery.data as ManagerOverview | undefined;
  const scopedWarehouses = useMemo(() => (overview?.warehouses || []).filter((warehouse) => {
    const ownerBranch = group?.branches.find((branch) => branch.id === warehouse.clientTenantId);
    const warehouseBusinessUnitId = warehouse.businessUnitId || ownerBranch?.businessUnitId;
    const matchesBusinessUnit = !selectedBusinessUnitId || warehouseBusinessUnitId === selectedBusinessUnitId;
    const matchesBranch = !selectedBranchId
      || warehouse.clientTenantId === selectedBranchId
      || warehouse.authorizedBranchIds?.includes(selectedBranchId);
    return matchesBusinessUnit && matchesBranch;
  }), [overview?.warehouses, group?.branches, selectedBusinessUnitId, selectedBranchId]);
  const catalogProducts = branchProductsQuery.data || [];
  const activeTitle = MANAGER_SECTIONS.find((item) => item.id === section)?.label;
  const loading = groupsQuery.isLoading || (section === 'overview' && overviewQuery.isLoading);

  return (
    <ManagerShell
      section={section}
      onSectionChange={setSection}
      group={group}
      branches={branchOptions}
      businessUnits={businessUnits}
      selectedBusinessUnitId={selectedBusinessUnitId}
      onBusinessUnitChange={(businessUnitId) => { setSelectedBusinessUnitId(businessUnitId); setSelectedBranchId(''); }}
      inventoryView={inventoryView}
      onInventoryViewChange={setInventoryView}
      salesView={salesView}
      onSalesViewChange={setSalesView}
      purchasesView={purchasesView}
      onPurchasesViewChange={setPurchasesView}
      financeView={financeView}
      onFinanceViewChange={setFinanceView}
      accountingView={accountingView}
      onAccountingViewChange={setAccountingView}
      reportView={reportView}
      onReportViewChange={setReportView}
      hrView={hrView}
      onHrViewChange={setHrView}
      allowedSections={allowedSections}
      selectedBranchId={selectedBranchId}
      onBranchChange={setSelectedBranchId}
      reportCurrency={managerReportCurrency || group?.consolidationCurrency || 'NIO'}
      onReportCurrencyChange={setManagerReportCurrency}
    >
      <div className="min-w-0 space-y-6">
        {section !== 'inventory' && section !== 'sales' && section !== 'purchases' && section !== 'finances' && section !== 'accounting' && section !== 'reports' && section !== 'hr' && <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0"><h2 className="truncate text-3xl font-black uppercase italic leading-none tracking-tighter sm:text-4xl">{activeTitle}</h2></div>
          <Button variant="outline" className="w-fit shrink-0 rounded-xl" onClick={() => downloadCsv(`manager-${section}.csv`, (overview?.branches || []).map((branch) => ({ sucursal: branch.name, usuarios: branch._count.users, productos: branch._count.products, almacenes: branch._count.warehouses })))}><Download className="mr-2 size-4" /> Exportar Excel/CSV</Button>
        </div>}

        {loading && <div className="flex min-h-[240px] items-center justify-center text-muted-foreground"><RefreshCw className="mr-2 size-5 animate-spin" /> Cargando consolidado...</div>}
        {!loading && !groupId && <Card className="rounded-3xl border-dashed"><CardContent className="p-10 text-center text-muted-foreground">SuperAdmin todavía no ha asignado este usuario a un grupo empresarial.</CardContent></Card>}

        {!loading && groupId && !allowedSections.includes(section) && <Card className="rounded-3xl border-dashed"><CardContent className="p-10 text-center text-muted-foreground">Este acceso Manager no tiene permisos para esta vista.</CardContent></Card>}
        {!loading && groupId && section === 'overview' && allowedSections.includes('overview') && <OverviewContent overview={overview} groupId={groupId} onEnterBranch={enterBranch} canEnterBranch={canEnterBranch} />}
        {section === 'inventory' && allowedSections.includes('inventory') && <ManagerInventoryModule view={inventoryView} onViewChange={setInventoryView} groupId={groupId} businessUnitId={selectedBusinessUnitId || undefined} branchId={selectedBranchId || undefined} branches={branchOptions} warehouses={scopedWarehouses} canCreateTransfers={managerAccessAllowsAction(group?.managerAccess, 'MANAGER_TRANSFERS', 'create')} corporateWarehouseContent={<WarehouseContent overview={overview} units={group?.businessUnits || []} name={warehouseName} location={warehouseLocation} businessUnitId={warehouseBusinessUnitId} branchIds={warehouseBranchIds} setName={setWarehouseName} setLocation={setWarehouseLocation} setBusinessUnitId={(value) => { setWarehouseBusinessUnitId(value); setWarehouseBranchIds([]); }} setBranchIds={setWarehouseBranchIds} onCreate={() => warehouseMutation.mutate()} creating={warehouseMutation.isPending} onSyncCatalog={(warehouseId) => syncWarehouseCatalogMutation.mutate(warehouseId)} syncingCatalogId={syncWarehouseCatalogMutation.isPending ? String(syncWarehouseCatalogMutation.variables || '') : ''} />} />}
        {section === 'sales' && allowedSections.includes('sales') && <ManagerSalesModule view={salesView} onViewChange={setSalesView} groupId={groupId} businessUnitId={selectedBusinessUnitId || undefined} branchId={selectedBranchId || undefined} branches={branchOptions} reportCurrency={managerReportCurrency} onEnterBranch={enterBranch} canEnterBranch={canEnterBranch} />}
        {section === 'purchases' && allowedSections.includes('purchases') && <ManagerPurchasesModule view={purchasesView} onViewChange={setPurchasesView} groupId={groupId} businessUnitId={selectedBusinessUnitId || undefined} branchId={selectedBranchId || undefined} branches={branchOptions} reportCurrency={managerReportCurrency} onEnterBranch={enterBranch} canEnterBranch={canEnterBranch} />}
        {section === 'finances' && allowedSections.includes('finances') && <ManagerFinanceModule view={financeView} onViewChange={setFinanceView} groupId={groupId} businessUnitId={selectedBusinessUnitId || undefined} branchId={selectedBranchId || undefined} branches={branchOptions} reportCurrency={managerReportCurrency} />}
        {section === 'accounting' && allowedSections.includes('accounting') && <ManagerAccountingModule view={accountingView} onViewChange={setAccountingView} groupId={groupId} businessUnitId={selectedBusinessUnitId || undefined} branchId={selectedBranchId || undefined} branches={branchOptions} />}
        {section === 'reports' && allowedSections.includes('reports') && <ManagerReportsModule view={reportView} onViewChange={setReportView} groupId={groupId} businessUnitId={selectedBusinessUnitId || undefined} branchId={selectedBranchId || undefined} branches={branchOptions} />}
        {section === 'hr' && allowedSections.includes('hr') && <ManagerHRModule view={hrView} onViewChange={setHrView} groupId={groupId} businessUnitId={selectedBusinessUnitId || undefined} branchId={selectedBranchId || undefined} branches={branchOptions} />}
        {section === 'users' && <UsersContent data={usersQuery.data || []} loading={usersQuery.isLoading} error={usersQuery.error} canEditUsers={canEditBranchUsers} canManageManagers={canManageManagersFromUsers} onEditUser={setEditingBranchUser} onToggleUser={(user) => { if (window.confirm(`${user.isActive ? '¿Inhabilitar' : '¿Habilitar'} a ${user.name || 'este usuario'}?`)) branchUserMutation.mutate({ userId: user.id, payload: { isActive: !user.isActive } }); }} togglingUserId={branchUserMutation.isPending ? String((branchUserMutation.variables as any)?.userId || '') : ''} onCreateManager={() => { resetManagerForm(); setSection('managers'); toast.info('Formulario de acceso Manager listo para configurar'); }} />}
        {section === 'catalog' && <CatalogContent data={sharedCatalogQuery.data || []} loading={sharedCatalogQuery.isLoading} branchOptions={branchOptions} sourceBranchId={catalogSourceBranchId} setSourceBranchId={setCatalogSourceBranchId} search={catalogSearch} setSearch={setCatalogSearch} products={catalogProducts} productsLoading={branchProductsQuery.isLoading} selectedProductIds={catalogProductIds} setSelectedProductIds={setCatalogProductIds} targetBranchIds={catalogTargetBranchIds} setTargetBranchIds={setCatalogTargetBranchIds} onShare={() => shareCatalogMutation.mutate()} sharing={shareCatalogMutation.isPending} onUnshare={unshareMutation.mutate} unsharing={unshareMutation.isPending} onSync={syncMutation.mutate} syncing={syncMutation.isPending} inventoryImportSourceBranchId={inventoryImportSourceBranchId} setInventoryImportSourceBranchId={setInventoryImportSourceBranchId} inventoryImportBranchIds={inventoryImportBranchIds} setInventoryImportBranchIds={setInventoryImportBranchIds} inventoryImportRows={inventoryImportRows} setInventoryImportRows={setInventoryImportRows} inventoryImportFileName={inventoryImportFileName} setInventoryImportFileName={setInventoryImportFileName} inventoryImportPriceMode={inventoryImportPriceMode} setInventoryImportPriceMode={setInventoryImportPriceMode} inventoryPricesByBranch={inventoryPricesByBranch} setInventoryPricesByBranch={setInventoryPricesByBranch} onInventoryImport={() => inventoryImportMutation.mutate()} inventoryImporting={inventoryImportMutation.isPending} />}
        {section === 'consolidated' && <ConsolidatedContent trialBalance={consolidatedTrialBalance.data} profitLoss={consolidatedProfitLoss.data} balanceSheet={consolidatedBalanceSheet.data} branchComparison={consolidatedBranchComparison.data} loading={consolidatedTrialBalance.isLoading || consolidatedProfitLoss.isLoading} dateFrom={consDateFrom} setDateFrom={setConsDateFrom} dateTo={consDateTo} setDateTo={setConsDateTo} />}
        {section === 'transfers' && <TransfersContent data={transfersQuery.data || []} loading={transfersQuery.isLoading} canApprove={managerAccessAllowsAction(group?.managerAccess, 'MANAGER_TRANSFERS', 'create')} approvingId={approveTransferMutation.isPending ? String(approveTransferMutation.variables || '') : ''} onApprove={setTransferToApprove} />}
        {section === 'managers' && <ManagersContent data={managersQuery.data || []} branches={branchOptions} canEditOwner={Boolean(!group?.managerAccess || group.managerAccess.isOwner)} editingManagerId={editingManagerId} name={managerName} email={managerEmail} password={managerPassword} branchIds={managerBranchIds} canManageManagers={managerCanManageManagers} canEdit={managerCanEdit} permissionState={managerPermissionState} setEditingManagerId={setEditingManagerId} setName={setManagerName} setEmail={setManagerEmail} setPassword={setManagerPassword} setBranchIds={setManagerBranchIds} setCanManageManagers={setManagerCanManageManagers} setCanEdit={setManagerCanEdit} setPermissionState={setManagerPermissionState} onReset={resetManagerForm} onSave={() => managerMutation.mutate()} saving={managerMutation.isPending} onPassword={(userId, password) => managerPasswordMutation.mutate({ userId, password })} resettingPassword={managerPasswordMutation.isPending} onRevoke={(userId) => revokeManagerMutation.mutate(userId)} revoking={revokeManagerMutation.isPending} />}
      </div>
      <ManagerUserEditorDialog user={editingBranchUser} open={Boolean(editingBranchUser)} saving={branchUserMutation.isPending} onOpenChange={(open) => { if (!open) setEditingBranchUser(null); }} onSave={(payload) => { if (editingBranchUser?.id) branchUserMutation.mutate({ userId: editingBranchUser.id, payload }); }} />
      <ConfirmDialog
        open={Boolean(transferToApprove)}
        onOpenChange={(open) => { if (!open) setTransferToApprove(null); }}
        title={String(transferToApprove?.status || '').toUpperCase() === 'COMPLETED' ? '¿Deseas sincronizar la contabilidad?' : '¿Deseas aprobar esta transferencia?'}
        description={transferToApprove
          ? String(transferToApprove.status || '').toUpperCase() === 'COMPLETED'
            ? `Se revisará el asiento de la transferencia ${transferToApprove.number || ''} y se hará visible el movimiento en las cuentas de origen y destino. El inventario no se moverá otra vez.`
            : `Se aprobará la transferencia ${transferToApprove.number || ''} y se ejecutará el movimiento de inventario de ${transferToApprove.from?.name || 'el origen'} hacia ${transferToApprove.to?.name || 'el destino'}.`
          : ''}
        confirmLabel={String(transferToApprove?.status || '').toUpperCase() === 'COMPLETED' ? 'Sí, sincronizar' : 'Sí, aprobar transferencia'}
        cancelLabel="Cancelar"
        variant="warning"
        loading={approveTransferMutation.isPending}
        onConfirm={async () => {
          if (!transferToApprove?.id) return;
          await approveTransferMutation.mutateAsync(transferToApprove.id);
          setTransferToApprove(null);
        }}
      />
    </ManagerShell>
  );
}

function defaultManagerPermissionState(): ManagerPermissionState {
  const state = emptyManagerPermissionState();
  ['MANAGER_OVERVIEW', 'MANAGER_SALES', 'MANAGER_PURCHASES', 'MANAGER_INVENTORY', 'MANAGER_FINANCE', 'MANAGER_ACCOUNTING', 'MANAGER_REPORTS', 'MANAGER_HR', 'MANAGER_CONSOLIDATED', 'MANAGER_TRANSFERS', 'MANAGER_CATALOG', 'MANAGER_USERS', 'MANAGER_WAREHOUSES'].forEach((module) => { state[module] = 'READ'; });
  return state;
}

const MANAGER_SECTION_MODULES: Partial<Record<ManagerSection, string>> = {
  overview: 'MANAGER_OVERVIEW',
  inventory: 'MANAGER_INVENTORY',
  sales: 'MANAGER_SALES',
  purchases: 'MANAGER_PURCHASES',
  finances: 'MANAGER_FINANCE',
  accounting: 'MANAGER_ACCOUNTING',
  reports: 'MANAGER_REPORTS',
  hr: 'MANAGER_HR',
  consolidated: 'MANAGER_CONSOLIDATED',
  transfers: 'MANAGER_TRANSFERS',
  catalog: 'MANAGER_CATALOG',
  users: 'MANAGER_USERS',
  managers: 'MANAGER_MANAGERS',
};

function getAllowedManagerSections(access?: ManagerOverview['group']['managerAccess']): ManagerSection[] {
  if (!access || access.isOwner) return MANAGER_SECTIONS.map((item) => item.id);
  const permissions = Array.isArray(access.permissions) ? access.permissions as Array<Record<string, unknown>> : [];
  return MANAGER_SECTIONS.filter((item) => {
    if (item.id === 'settings') return true;
    // Los Managers creados antes de separar Finanzas y Contabilidad pueden
    // conservar el permiso legado. Se mantiene visible Finanzas para no
    // romper su navegación; el backend también acepta ese permiso heredado.
    if (item.id === 'finances') {
      return ['MANAGER_FINANCE', 'MANAGER_ACCOUNTING', 'MANAGER_CONSOLIDATED'].some((module) => managerPermissionGranted(permissions, module));
    }
    if (item.id === 'accounting') {
      return ['MANAGER_ACCOUNTING', 'MANAGER_CONSOLIDATED'].some((module) => managerPermissionGranted(permissions, module));
    }
    const module = MANAGER_SECTION_MODULES[item.id];
    return managerPermissionGranted(permissions, module);
  }).map((item) => item.id);
}

function managerPermissionGranted(permissions: Array<Record<string, unknown>>, module?: string) {
  if (!module) return false;
  const permission = permissions.find((candidate) => String(candidate.module || '').toUpperCase() === module);
  return Boolean(permission && (permission.read === true || permission.create === true || permission.edit === true || permission.delete === true || permission.manage === true));
}

function managerAccessAllows(access: ManagerOverview['group']['managerAccess'], module: string) {
  if (!access || access.isOwner) return true;
  const permissions = Array.isArray(access.permissions) ? access.permissions as Array<Record<string, unknown>> : [];
  const permission = permissions.find((candidate) => String(candidate.module || '').toUpperCase() === module);
  return Boolean(permission && (permission.read === true || permission.create === true || permission.edit === true || permission.delete === true || permission.manage === true));
}

function managerAccessAllowsAction(access: ManagerOverview['group']['managerAccess'], module: string, action: string) {
  if (!access || access.isOwner) return true;
  const permissions = Array.isArray(access.permissions) ? access.permissions as Array<Record<string, unknown>> : [];
  const permission = permissions.find((candidate) => String(candidate.module || '').toUpperCase() === module);
  return Boolean(permission && (permission[action] === true || permission.manage === true));
}

function OverviewContent({ overview, groupId, onEnterBranch, canEnterBranch = true }: { overview?: ManagerOverview; groupId?: string; onEnterBranch?: (groupId: string, branchId: string) => Promise<void>; canEnterBranch?: boolean }) {
  const metrics = overview?.metrics;
  const cards = [
    { label: 'Sucursales visibles', value: metrics?.branches, icon: Building2, tone: 'text-primary bg-primary/10' },
    { label: 'Usuarios generales', value: metrics?.users, icon: Users, tone: 'text-primary bg-primary/10' },
    { label: 'Usuarios activos', value: metrics?.activeUsers, icon: ShieldCheck, tone: 'text-primary bg-primary/10' },
    { label: 'Unidades en inventario', value: metrics?.inventoryUnits, icon: Package, tone: 'text-primary bg-primary/10' },
    { label: 'Archivos almacenados', value: formatStorage(metrics?.storageBytes), icon: Cloud, tone: 'text-primary bg-primary/10' },
    { label: 'Objetos registrados', value: metrics?.storageObjects, icon: FileStack, tone: 'text-primary bg-primary/10' },
  ];
  return <>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{cards.map((card, index) => { const Icon = card.icon; return <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}><Card className="h-full rounded-3xl border-border/60 bg-card/50"><CardContent className="p-5"><div className={`mb-4 flex size-11 items-center justify-center rounded-2xl ${card.tone}`}><Icon className="size-5" /></div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{card.label}</p><p className="mt-1 text-3xl font-black tracking-tight">{typeof card.value === 'string' ? card.value : formatNumber(card.value)}</p></CardContent></Card></motion.div>; })}</div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <Card className="overflow-hidden rounded-3xl border-border/60 xl:col-span-2">
        <CardHeader className="border-b border-border/50 bg-muted/10 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div><CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight"><Building2 className="size-5 text-primary" /> Sucursales del grupo</CardTitle><p className="mt-1 text-sm text-muted-foreground">Consulta rápidamente el estado de cada operación y entra a trabajar cuando necesites operar dentro de ella.</p></div>
            <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">{formatNumber(overview?.branches?.length)} visibles</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
            {(overview?.branches || []).map((branch, index) => {
              const businessType = getBusinessTypeLabel(branch.industry, branch.subIndustry || undefined);
              const isActive = branch.isActive !== false;
              return <motion.article key={branch.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="group relative min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/80 via-primary/30 to-transparent opacity-70" />
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <BrandLogo src={branch.logo} alt={`Logo de ${branch.name}`} kind="branch" className="size-11 rounded-2xl" imageClassName="rounded-2xl" />
                    <div className="min-w-0"><h3 className="truncate text-base font-black tracking-tight">{branch.name}</h3><p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground"><Sparkles className="size-3 shrink-0 text-primary" />{businessType}</p></div>
                  </div>
                  <Badge variant={isActive ? 'default' : 'secondary'} className="shrink-0 rounded-full text-[10px]">{isActive ? 'Activa' : 'Inactiva'}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-muted/30 p-2.5">
                  <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Usuarios</p><p className="mt-1 text-sm font-black tabular-nums">{formatNumber(branch._count.users)}</p></div>
                  <div className="min-w-0 border-l border-border/60 pl-2"><p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Productos</p><p className="mt-1 text-sm font-black tabular-nums">{formatNumber(branch._count.products)}</p></div>
                  <div className="min-w-0 border-l border-border/60 pl-2"><p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Bodegas</p><p className="mt-1 text-sm font-black tabular-nums">{formatNumber(branch._count.warehouses)}</p></div>
                </div>
                <div className="mt-3 flex min-w-0 items-center justify-between gap-3"><p className="flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground"><MapPin className="size-3.5 shrink-0" />{branch.slug || 'Sucursal operativa'}</p>{onEnterBranch && canEnterBranch && groupId && isActive ? <Button variant="ghost" size="sm" className="h-8 shrink-0 gap-1 rounded-lg px-2.5 text-xs font-bold text-primary hover:bg-primary/10 hover:text-primary" onClick={() => onEnterBranch(groupId, branch.id)}><span>Ir a sucursal</span><ArrowUpRight className="size-3.5" /></Button> : <span className="shrink-0 text-[11px] text-muted-foreground">{isActive ? 'Solo consulta' : 'No disponible'}</span>}</div>
              </motion.article>;
            })}
          </div>
          {!overview?.branches?.length && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No hay sucursales en el alcance seleccionado.</p>}
        </CardContent>
      </Card>
      <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight"><Landmark className="size-5 text-primary" /> Cuentas emparejadas</CardTitle></CardHeader><CardContent className="space-y-3">{(overview?.accounts || []).slice(0, 8).map((account) => <div key={account.code} className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3"><div><p className="font-mono text-xs text-primary">{account.code}</p><p className="text-sm font-semibold">{account.name}</p></div><p className="font-black tabular-nums">{formatNumber(account.totalBalance)}</p></div>)}{!overview?.accounts?.length && <p className="text-sm text-muted-foreground">Aún no hay cuentas contables para consolidar.</p>}</CardContent></Card>
    </div>
  </>;
}

function InventoryContent({ data, loading, branches, warehouses, search, setSearch, importSourceBranchId, setImportSourceBranchId, importBranchIds, setImportBranchIds, importRows, setImportRows, importFileName, setImportFileName, priceMode, setPriceMode, pricesByBranch, setPricesByBranch, warehouseByBranch, setWarehouseByBranch, onImport, importing }: {
  data: any[]; loading: boolean; branches: Array<{ id: string; name: string; businessUnitId?: string | null }>;
  warehouses: Array<{ id: string; name: string; clientTenantId: string | null; businessUnitId?: string | null; authorizedBranchIds?: string[] }>;
  search: string; setSearch: (value: string) => void; importSourceBranchId: string; setImportSourceBranchId: (value: string) => void;
  importBranchIds: string[]; setImportBranchIds: (value: string[]) => void; importRows: any[]; setImportRows: (value: any[]) => void;
  importFileName: string; setImportFileName: (value: string) => void; priceMode: 'SAME' | 'BY_BRANCH'; setPriceMode: (value: 'SAME' | 'BY_BRANCH') => void; pricesByBranch: Record<string, Record<string, string>>; setPricesByBranch: (value: Record<string, Record<string, string>>) => void;
  warehouseByBranch: Record<string, string>; setWarehouseByBranch: (value: Record<string, string>) => void; onImport: () => void; importing: boolean;
}) {
  const term = search.trim().toLowerCase();
  const filtered = data.filter((row) => !term || [row.product?.name, row.product?.code, row.clientTenant?.name, row.warehouse?.name].some((value) => String(value || '').toLowerCase().includes(term)));
  const grouped = Array.from(filtered.reduce((map, row) => {
    const key = row.product?.id || row.product?.code || row.id;
    const current = map.get(key) || { key, product: row.product, total: 0, reserved: 0, locations: [] as any[] };
    current.total += Number(row.quantity || 0); current.reserved += Number(row.reserved || 0); current.locations.push(row); map.set(key, current); return map;
  }, new Map<string, any>()).values());
  const source = branches.find((branch) => branch.id === importSourceBranchId);
  const targetBranches = branches.filter((branch) => branch.businessUnitId === source?.businessUnitId);
  const toggleBranch = (id: string) => setImportBranchIds(importBranchIds.includes(id) ? importBranchIds.filter((value) => value !== id) : [...importBranchIds, id]);
  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try { setImportRows(await readSpreadsheet(file)); setImportFileName(file.name); } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo leer el archivo'); }
  };
  const rowCode = (row: any) => String(row.code ?? row.codigo ?? row.Código ?? row.SKU ?? row.sku ?? '').trim();
  const updateBranchPrice = (branchId: string, code: string, value: string) => setPricesByBranch({ ...pricesByBranch, [branchId]: { ...(pricesByBranch[branchId] || {}), [code]: value } });
  return <div className="space-y-6">
    <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight"><Boxes className="size-5 text-primary" /> Existencias por producto y bodega</CardTitle><p className="text-sm text-muted-foreground">Consulta el total y abre el desglose por sucursal, bodega y cantidad reservada.</p></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-muted/30 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Productos</p><p className="mt-1 text-2xl font-black">{formatNumber(grouped.length)}</p></div><div className="rounded-2xl bg-muted/30 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Unidades</p><p className="mt-1 text-2xl font-black">{formatNumber(grouped.reduce((sum, row) => sum + row.total, 0))}</p></div><div className="rounded-2xl bg-muted/30 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ubicaciones</p><p className="mt-1 text-2xl font-black">{formatNumber(filtered.length)}</p></div></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto, SKU, sucursal o bodega..." className="h-11 w-full max-w-full rounded-xl border border-border bg-background px-3 text-sm" />{loading ? <div className="p-8 text-center text-muted-foreground">Cargando inventario...</div> : !grouped.length ? <p className="py-8 text-center text-sm text-muted-foreground">No hay existencias para este filtro.</p> : <div className="space-y-3">{grouped.map((row) => <div key={row.key} className="rounded-2xl border border-border/60 bg-muted/10 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate font-bold">{row.product?.name || 'Producto sin nombre'}</p><p className="font-mono text-xs text-muted-foreground">{row.product?.code || 'Sin código'}</p></div><div className="flex shrink-0 gap-4 text-right text-sm"><span><span className="block text-[10px] font-black uppercase text-muted-foreground">Total</span><b>{formatNumber(row.total)}</b></span><span><span className="block text-[10px] font-black uppercase text-muted-foreground">Reservado</span><b>{formatNumber(row.reserved)}</b></span></div></div><div className="mt-3 grid gap-2 md:grid-cols-2">{row.locations.map((location: any) => <div key={location.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/50 bg-background p-3 text-sm"><div className="min-w-0"><p className="truncate font-semibold">{location.clientTenant?.name || 'Sucursal'}</p><p className="truncate text-xs text-muted-foreground">{location.warehouse?.name || 'Bodega'} · {location.warehouse?.scopeType === 'BUSINESS_UNIT' ? 'Almacén corporativo' : 'Bodega'}</p></div><span className="shrink-0 font-black tabular-nums">{formatNumber(location.quantity)}</span></div>)}</div></div>)}</div>}</CardContent></Card>
    <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight"><Download className="size-5 text-primary" /> Importar stock por rubro</CardTitle><p className="text-sm text-muted-foreground">La importación usa el catálogo de una sucursal y lo replica únicamente en sucursales del mismo rubro.</p></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-1 gap-3 md:grid-cols-3"><select value={importSourceBranchId} onChange={(event) => setImportSourceBranchId(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="">Sucursal de origen</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><select value={priceMode} onChange={(event) => setPriceMode(event.target.value as 'SAME' | 'BY_BRANCH')} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="SAME">Usar el precio del catálogo</option><option value="BY_BRANCH">Precio indicado por sucursal</option></select><label className="flex h-10 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border px-3 text-sm font-semibold hover:bg-muted/40"><input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="sr-only" />{importFileName || 'Seleccionar Excel/CSV'}</label></div><div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-border/60 p-3"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sucursales destino del rubro</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{targetBranches.map((branch) => <label key={branch.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-border/50 p-2 text-sm"><input type="checkbox" checked={importBranchIds.includes(branch.id)} onChange={() => toggleBranch(branch.id)} className="size-4 shrink-0 accent-primary" /><span className="min-w-0 truncate">{branch.name}</span></label>)}{!source && <p className="text-xs text-muted-foreground">Selecciona una sucursal de origen.</p>}</div></div><div className="rounded-2xl border border-border/60 p-3"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Bodega receptora</p><div className="mt-2 space-y-2">{targetBranches.filter((branch) => importBranchIds.includes(branch.id)).map((branch) => { const options = warehouses.filter((warehouse) => warehouse.clientTenantId === branch.id); return <label key={branch.id} className="flex min-w-0 items-center gap-2 text-sm"><span className="w-28 shrink-0 truncate font-semibold">{branch.name}</span><select value={warehouseByBranch[branch.id] || ''} onChange={(event) => setWarehouseByBranch({ ...warehouseByBranch, [branch.id]: event.target.value })} className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-background px-2 text-xs"><option value="">Automático</option>{options.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>; })}</div></div></div>{importRows.length > 0 && <div className="overflow-x-auto rounded-2xl border border-border/60"><Table><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Stock</TableHead><TableHead>Precio</TableHead><TableHead>Costo</TableHead></TableRow></TableHeader><TableBody>{importRows.slice(0, 8).map((row, index) => <TableRow key={index}><TableCell className="font-mono">{String(row.code ?? row.codigo ?? row.Código ?? row.SKU ?? row.sku ?? '-')}</TableCell><TableCell>{String(row.stock ?? row.cantidad ?? row.Stock ?? row.Cantidad ?? '-')}</TableCell><TableCell>{String(row.salePrice ?? row.precio ?? row.precio_venta ?? row.Precio ?? '-')}</TableCell><TableCell>{String(row.costPrice ?? row.costo ?? row.costo_unitario ?? row.Costo ?? '-')}</TableCell></TableRow>)}</TableBody></Table><p className="px-3 py-2 text-xs text-muted-foreground">Vista previa: {importRows.length} fila(s). Se aplicará todo en una sola transacción.</p></div>}{priceMode === 'BY_BRANCH' && importRows.length > 0 && <div className="overflow-x-auto rounded-2xl border border-border/60 p-3"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Precios por sucursal (opcional)</p><div className="mt-2 min-w-[620px] space-y-2">{importRows.slice(0, 50).map((row, index) => <div key={rowCode(row) || index} className="grid grid-cols-[minmax(150px,1fr)_repeat(auto-fit,minmax(150px,1fr))] items-center gap-2 text-xs"><span className="truncate font-mono">{rowCode(row) || 'Sin código'}</span>{targetBranches.filter((branch) => importBranchIds.includes(branch.id)).map((branch) => <input key={branch.id} type="number" min="0" step="0.01" value={pricesByBranch[branch.id]?.[rowCode(row)] || ''} onChange={(event) => updateBranchPrice(branch.id, rowCode(row), event.target.value)} placeholder={branch.name} className="h-9 min-w-0 rounded-xl border border-border bg-background px-2" />)}</div>)}</div></div>}<Button className="w-full rounded-xl" disabled={!importSourceBranchId || !importBranchIds.length || !importRows.length || importing} onClick={onImport}>{importing ? 'Aplicando importación...' : 'Importar stock seleccionado'}</Button></CardContent></Card>
  </div>;
}

function AccountingContent({ data, loading, units, branches, importUnitId, setImportUnitId, importBranchIds, setImportBranchIds, importRows, setImportRows, importFileName, setImportFileName, onImport, importing }: { data?: { accounts: any[]; transactions: any[] }; loading: boolean; units: Array<{ id: string; name: string; isActive?: boolean }>; branches: Array<{ id: string; name: string; businessUnitId?: string | null }>; importUnitId: string; setImportUnitId: (value: string) => void; importBranchIds: string[]; setImportBranchIds: (value: string[]) => void; importRows: any[]; setImportRows: (value: any[]) => void; importFileName: string; setImportFileName: (value: string) => void; onImport: () => void; importing: boolean }) {
  const targetBranches = branches.filter((branch) => branch.businessUnitId === importUnitId);
  const toggleBranch = (id: string) => setImportBranchIds(importBranchIds.includes(id) ? importBranchIds.filter((value) => value !== id) : [...importBranchIds, id]);
  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; try { setImportRows(await readSpreadsheet(file)); setImportFileName(file.name); } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo leer el archivo'); } };
  return <div className="space-y-6"><Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight"><Landmark className="size-5 text-primary" /> Propagar plan de cuentas por rubro</CardTitle><p className="text-sm text-muted-foreground">Los códigos se emparejan en cada sucursal; los saldos y cuentas adicionales existentes se conservan.</p></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><select value={importUnitId} onChange={(event) => { setImportUnitId(event.target.value); setImportBranchIds([]); }} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="">Seleccionar rubro</option>{units.filter((unit) => unit.isActive !== false).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select><label className="flex h-10 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border px-3 text-sm font-semibold hover:bg-muted/40"><input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="sr-only" />{importFileName || 'Seleccionar Excel/CSV'}</label></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{targetBranches.map((branch) => <label key={branch.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-border/60 p-3 text-sm"><input type="checkbox" checked={importBranchIds.includes(branch.id)} onChange={() => toggleBranch(branch.id)} className="size-4 shrink-0 accent-primary" /><span className="min-w-0 truncate">{branch.name}</span></label>)}{!importUnitId && <p className="text-xs text-muted-foreground">Selecciona un rubro para listar sus sucursales.</p>}</div>{importRows.length > 0 && <div className="overflow-x-auto rounded-2xl border border-border/60"><Table><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Tipo</TableHead><TableHead>Padre</TableHead></TableRow></TableHeader><TableBody>{importRows.slice(0, 8).map((row, index) => <TableRow key={index}><TableCell className="font-mono">{String(row.codigo ?? row.code ?? '-')}</TableCell><TableCell>{String(row.nombre ?? row.name ?? '-')}</TableCell><TableCell>{String(row.tipo_cuenta ?? row.type ?? '-')}</TableCell><TableCell>{String(row.codigo_padre ?? row.parentCode ?? '-')}</TableCell></TableRow>)}</TableBody></Table><p className="px-3 py-2 text-xs text-muted-foreground">Vista previa: {importRows.length} cuenta(s). La propagación es atómica.</p></div>}<Button className="w-full rounded-xl" disabled={!importUnitId || !importBranchIds.length || !importRows.length || importing} onClick={onImport}>{importing ? 'Propagando plan...' : 'Propagar plan a sucursales seleccionadas'}</Button></CardContent></Card><div className="grid grid-cols-1 gap-6 xl:grid-cols-2"><Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight"><Landmark className="size-5 text-primary" /> Catálogo contable consolidado</CardTitle></CardHeader><CardContent>{loading ? <div className="p-8 text-center text-muted-foreground">Cargando contabilidad...</div> : <Table containerClassName="overflow-x-auto"><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Cuenta</TableHead><TableHead>Sucursal</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader><TableBody>{(data?.accounts || []).map((account, index) => <TableRow key={`${account.clientTenantId}-${account.code}-${index}`}><TableCell className="font-mono text-primary">{account.code}</TableCell><TableCell>{account.name}</TableCell><TableCell>{account.clientTenant?.name || account.clientTenantId}</TableCell><TableCell className="text-right font-bold">{formatNumber(account.balance)}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card><Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="text-lg font-black uppercase italic tracking-tight">Últimos movimientos</CardTitle></CardHeader><CardContent><div className="space-y-2">{(data?.transactions || []).slice(0, 12).map((transaction) => <div key={transaction.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{transaction.description}</p><p className="text-xs text-muted-foreground">{transaction.clientTenant?.name} · {transaction.account?.code}</p></div><div className="shrink-0 text-right text-xs tabular-nums"><p className="text-emerald-500">D {formatNumber(transaction.debit)}</p><p className="text-rose-500">C {formatNumber(transaction.credit)}</p></div></div>)}</div></CardContent></Card></div></div>;
}

function UsersContent({ data, loading, error, canEditUsers, canManageManagers, onEditUser, onToggleUser, togglingUserId, onCreateManager }: {
  data: any[];
  loading: boolean;
  error?: Error | null;
  canEditUsers: boolean;
  canManageManagers: boolean;
  onEditUser: (user: any) => void;
  onToggleUser: (user: any) => void;
  togglingUserId: string;
  onCreateManager: () => void;
}) {
  return <Card className="rounded-3xl border-border/60">
    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight"><Users className="size-5 text-primary" /> Recuento general de usuarios</CardTitle>
        <p className="text-sm text-muted-foreground">Incluye usuarios operativos de sucursales y Managers globales del grupo.</p>
      </div>
      {canManageManagers && <Button type="button" className="w-full shrink-0 rounded-xl sm:w-auto" onClick={onCreateManager}><ShieldCheck className="mr-2 size-4" /> Agregar acceso Manager</Button>}
    </CardHeader>
    <CardContent>
      {loading ? <div className="p-8 text-center text-muted-foreground">Cargando usuarios...</div> : error ? <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive"><p className="font-bold">No se pudo cargar el recuento de usuarios.</p><p className="mt-1 break-words">{error.message}</p></div> : !data.length ? <p className="py-8 text-center text-sm text-muted-foreground">No hay usuarios en el alcance seleccionado.</p> : <Table containerClassName="overflow-x-auto"><TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Rol</TableHead><TableHead>Sucursal / grupo</TableHead><TableHead>RR. HH.</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{data.map((user) => {
        const isManager = Boolean(user.managerGroup);
        const isToggling = togglingUserId === user.id;
        return <TableRow key={`${user.id}-${user.managerGroup?.id || user.clientTenant?.id || 'user'}`}>
          <TableCell><p className="font-semibold">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></TableCell>
          <TableCell><Badge variant={isManager ? 'default' : 'outline'}>{isManager ? (user.managerOwner ? 'Manager propietario' : 'Manager') : user.role}</Badge></TableCell>
          <TableCell>{isManager ? <span className="font-semibold">Grupo empresarial</span> : user.clientTenant?.name || 'Sin sucursal'}</TableCell>
          <TableCell>{user.employee ? 'Vinculado' : 'Usuario independiente'}</TableCell>
          <TableCell><Badge variant={user.isActive ? 'default' : 'secondary'}>{user.isActive ? 'Activo' : 'Inactivo'}</Badge></TableCell>
          <TableCell className="text-right">{!isManager && canEditUsers ? <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => onEditUser(user)}><Pencil className="size-3.5" /> Editar</Button><Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-xl" disabled={isToggling || user.role === 'ADMIN'} title={user.role === 'ADMIN' ? 'El administrador principal está protegido' : undefined} onClick={() => onToggleUser(user)}>{user.isActive ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}<span className="hidden sm:inline">{isToggling ? 'Guardando…' : user.isActive ? 'Inhabilitar' : 'Habilitar'}</span></Button></div> : <span className="text-xs text-muted-foreground">Solo consulta</span>}</TableCell>
        </TableRow>;
      })}</TableBody></Table>}
    </CardContent>
  </Card>;
}

function WarehouseContent({ overview, inventoryWarehouses, warehousesLoading, branches, units, name, location, businessUnitId, branchIds, setName, setLocation, setBusinessUnitId, setBranchIds, onCreate, creating, onSyncCatalog, syncingCatalogId }: { overview?: ManagerOverview; inventoryWarehouses: any[]; warehousesLoading: boolean; branches: Array<{ id: string; name: string; businessUnitId?: string | null }>; units: Array<{ id: string; name: string }>; name: string; location: string; businessUnitId: string; branchIds: string[]; setName: (value: string) => void; setLocation: (value: string) => void; setBusinessUnitId: (value: string) => void; setBranchIds: (value: string[]) => void; onCreate: () => void; creating: boolean; onSyncCatalog: (warehouseId: string) => void; syncingCatalogId: string }) {
  const visibleBranches = branches.length ? branches : (overview?.branches || []);
  const visibleWarehouses = inventoryWarehouses.length
    ? inventoryWarehouses.map((warehouse: any) => ({ ...warehouse, authorizedBranchIds: warehouse.authorizedBranchIds || warehouse.branchIds || (warehouse.branches || []).map((branch: any) => branch.id) }))
    : (overview?.warehouses || []);
  const destinationBranches = visibleBranches.filter((branch) => branch.businessUnitId === businessUnitId);
  const toggleBranch = (id: string) => setBranchIds(branchIds.includes(id) ? branchIds.filter((value) => value !== id) : [...branchIds, id]);
  return <div className="space-y-6">
    <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight"><Warehouse className="size-5 text-primary" /> Almacenes corporativos</CardTitle></CardHeader><CardContent>
      {warehousesLoading && !visibleWarehouses.length && <p className="py-6 text-center text-sm text-muted-foreground">Cargando almacenes corporativos...</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleWarehouses.map((warehouse: any) => <div key={warehouse.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{warehouse.name}</p><p className="text-xs text-muted-foreground">{warehouse.location || 'Sin ubicación registrada'}</p></div><Badge variant="outline">Por rubro</Badge></div><p className="mt-4 text-xs text-muted-foreground">Rubro: {units.find((unit) => unit.id === warehouse.businessUnitId)?.name || warehouse.businessUnitName || 'Pendiente de normalizar'}</p><p className="mt-2 text-xs text-muted-foreground">Abastece: {warehouse.authorizedBranchIds?.map((id: string) => visibleBranches.find((branch) => branch.id === id)?.name).filter(Boolean).join(', ') || 'Sin autorización registrada'}</p><Button type="button" variant="outline" size="sm" className="mt-4 w-full rounded-xl" disabled={Boolean(syncingCatalogId)} onClick={() => onSyncCatalog(warehouse.id)}>{syncingCatalogId === warehouse.id ? 'Preparando catálogo...' : 'Preparar catálogo en cero'}</Button></div>)}</div>
      {!warehousesLoading && !visibleWarehouses.length && <p className="py-6 text-center text-sm text-muted-foreground">No hay almacenes visibles.</p>}
    </CardContent></Card>
    <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight"><Plus className="size-5 text-primary" /> Nuevo almacén corporativo</CardTitle></CardHeader><CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del almacén" className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm" /><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Ubicación (opcional)" className="h-10 min-w-0 rounded-xl border border-border bg-background px-3 text-sm" /><select value={businessUnitId} onChange={(event) => setBusinessUnitId(event.target.value)} className="h-10 min-w-0 rounded-xl border border-border bg-background px-3 text-sm" disabled={!units.length}><option value="">{units.length ? 'Selecciona un rubro' : 'Crea primero un rubro'}</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select><div className="rounded-2xl border border-border/60 bg-muted/20 p-3 sm:col-span-3"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sucursales que puede abastecer</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{destinationBranches.map((branch) => <label key={branch.id} className="flex items-center gap-2 rounded-xl border border-border/60 p-2 text-sm"><input type="checkbox" checked={branchIds.includes(branch.id)} onChange={() => toggleBranch(branch.id)} className="size-4 accent-primary" />{branch.name}</label>)}{!destinationBranches.length && <p className="text-xs text-muted-foreground">Selecciona un rubro con sucursales.</p>}</div></div><Button className="h-10 rounded-xl sm:col-span-3" disabled={!name.trim() || !businessUnitId || !branchIds.length || creating} onClick={onCreate}>{creating ? 'Guardando...' : 'Agregar almacén'}</Button></CardContent></Card>
  </div>;
}

function TransfersContent({ data, loading, canApprove, approvingId, onApprove }: { data: any[]; loading: boolean; canApprove: boolean; approvingId: string; onApprove: (transfer: any) => void }) {
  const [selectedTransfer, setSelectedTransfer] = useState<any | null>(null);
  const statusBadge = (status: string) => {
    const styles: Record<string, string> = { PENDING: 'bg-amber-500/10 text-amber-600', COMPLETED: 'bg-emerald-500/10 text-emerald-600', CANCELLED: 'bg-rose-500/10 text-rose-600' };
    return <Badge variant="outline" className={styles[status] || ''}>{status}</Badge>;
  };
  return <div className={`grid min-w-0 grid-cols-1 gap-6 ${selectedTransfer ? 'lg:grid-cols-[13fr_7fr]' : 'lg:grid-cols-1'}`}>
    <Card className="min-w-0 rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight"><ArrowRightLeft className="size-5 text-primary" /> Transferencias entre sucursales del grupo</CardTitle></CardHeader><CardContent>
      {loading ? <div className="p-8 text-center text-muted-foreground">Cargando transferencias...</div> : <>
        {!data.length && <p className="py-6 text-center text-sm text-muted-foreground">No hay transferencias registradas en el grupo.</p>}
        <Table containerClassName="overflow-x-auto"><TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Fecha</TableHead><TableHead>Origen</TableHead><TableHead>Destino</TableHead><TableHead>Estado</TableHead><TableHead>Items</TableHead><TableHead>Acción</TableHead></TableRow></TableHeader><TableBody>{data.map((t) => {
          const transferStatus = String(t.status || '').toUpperCase();
          const isPending = transferStatus === 'PENDING';
          const isCompleted = transferStatus === 'COMPLETED';
          return <TableRow key={t.id} className={`cursor-pointer ${selectedTransfer?.id === t.id ? 'bg-primary/5' : ''}`} onClick={() => setSelectedTransfer(t)}><TableCell className="font-mono font-bold">{t.number}</TableCell><TableCell>{new Date(t.date).toLocaleDateString('es-NI')}</TableCell><TableCell>{t.from?.name || '-'}</TableCell><TableCell>{t.to?.name || '-'}</TableCell><TableCell>{statusBadge(t.status)}</TableCell><TableCell>{(t.items || []).length} producto(s)</TableCell><TableCell className="text-right">{canApprove && (isPending || isCompleted) && <Button type="button" size="sm" variant={isCompleted ? 'outline' : 'default'} className="rounded-xl" disabled={Boolean(approvingId)} onClick={(event) => { event.stopPropagation(); onApprove(t); }}>{approvingId === t.id ? (isCompleted ? 'Sincronizando…' : 'Aprobando…') : (isCompleted ? 'Sincronizar' : 'Aprobar')}</Button>}</TableCell></TableRow>;
        })}</TableBody></Table>
      </>}
    </CardContent></Card>
    {selectedTransfer && <InventoryDetailPanel kind="transfer" data={selectedTransfer} onClose={() => setSelectedTransfer(null)} />}
  </div>;
}

function ConsolidatedContent({ trialBalance, profitLoss, balanceSheet, branchComparison, loading, dateFrom, setDateFrom, dateTo, setDateTo }: {
  trialBalance?: any; profitLoss?: any; balanceSheet?: any; branchComparison?: any; loading: boolean;
  dateFrom: string; setDateFrom: (v: string) => void; dateTo: string; setDateTo: (v: string) => void;
}) {
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Filtros:</p>
      <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 rounded-xl border border-border/60 bg-card px-3 text-xs font-bold" />
      <span className="text-[10px] font-bold text-foreground/70">a</span>
      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-xl border border-border/60 bg-card px-3 text-xs font-bold" />
    </div>
    {loading ? <div className="flex min-h-[200px] items-center justify-center text-muted-foreground"><RefreshCw className="mr-2 size-4 animate-spin" /> Cargando estados financieros...</div> : <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="text-lg font-black uppercase italic tracking-tight">Estado de Resultados</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="rounded-xl bg-emerald-500/5 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Ingresos</p><p className="mt-1 text-2xl font-black text-emerald-600">{formatNumber(profitLoss?.totalIngresos || 0)}</p></div>
          {(profitLoss?.ingresos || []).slice(0, 5).map((item: any) => <div key={item.code} className="flex justify-between text-sm"><span className="text-muted-foreground">{item.code} {item.name}</span><span className="font-bold">{formatNumber(item.balance)}</span></div>)}
          <div className="rounded-xl bg-rose-500/5 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-rose-600">Gastos</p><p className="mt-1 text-2xl font-black text-rose-600">{formatNumber(profitLoss?.totalGastos || 0)}</p></div>
          {(profitLoss?.gastos || []).slice(0, 5).map((item: any) => <div key={item.code} className="flex justify-between text-sm"><span className="text-muted-foreground">{item.code} {item.name}</span><span className="font-bold">{formatNumber(item.balance)}</span></div>)}
          <div className="border-t pt-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Utilidad Neta</p><p className="text-2xl font-black text-primary">{formatNumber(profitLoss?.utilidadNeta || 0)}</p></div>
        </CardContent></Card>
        <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="text-lg font-black uppercase italic tracking-tight">Balance General</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="rounded-xl bg-blue-500/5 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Activos</p><p className="mt-1 text-2xl font-black text-blue-600">{formatNumber(balanceSheet?.totalActivos || 0)}</p></div>
          {(balanceSheet?.activos || []).slice(0, 4).map((item: any) => <div key={item.code} className="flex justify-between text-sm"><span className="text-muted-foreground">{item.code} {item.name}</span><span className="font-bold">{formatNumber(item.balance)}</span></div>)}
          <div className="rounded-xl bg-amber-500/5 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Pasivos</p><p className="mt-1 text-2xl font-black text-amber-600">{formatNumber(balanceSheet?.totalPasivos || 0)}</p></div>
          <div className="rounded-xl bg-violet-500/5 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-violet-600">Patrimonio</p><p className="mt-1 text-2xl font-black text-violet-600">{formatNumber(balanceSheet?.totalPatrimonio || 0)}</p></div>
        </CardContent></Card>
      </div>
      <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight"><BarChart3 className="size-5 text-primary" /> Comparación por Sucursal</CardTitle></CardHeader><CardContent><Table containerClassName="overflow-x-auto"><TableHeader><TableRow><TableHead>Sucursal</TableHead><TableHead className="text-right">Ingresos</TableHead><TableHead className="text-right">Gastos</TableHead><TableHead className="text-right">Utilidad</TableHead><TableHead className="text-right">Movimientos</TableHead></TableRow></TableHeader><TableBody>{(branchComparison?.branches || []).map((b: any) => <TableRow key={b.branchId}><TableCell className="font-semibold">{b.branchName}</TableCell><TableCell className="text-right text-emerald-600 font-bold">{formatNumber(b.ingresos)}</TableCell><TableCell className="text-right text-rose-600 font-bold">{formatNumber(b.gastos)}</TableCell><TableCell className={`text-right font-black ${b.utilidad >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatNumber(b.utilidad)}</TableCell><TableCell className="text-right">{formatNumber(b.movimientos)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      {trialBalance && <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="text-lg font-black uppercase italic tracking-tight">Balance de Comprobación</CardTitle></CardHeader><CardContent><Table containerClassName="overflow-x-auto"><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Cuenta</TableHead><TableHead className="text-right">Débito</TableHead><TableHead className="text-right">Crédito</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="text-right">Sucursales</TableHead></TableRow></TableHeader><TableBody>{(trialBalance?.rows || []).slice(0, 30).map((row: any, i: number) => <TableRow key={i}><TableCell className="font-mono text-primary">{row.code}</TableCell><TableCell>{row.name}</TableCell><TableCell className="text-right">{formatNumber(row.debit)}</TableCell><TableCell className="text-right">{formatNumber(row.credit)}</TableCell><TableCell className={`text-right font-bold ${row.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatNumber(row.balance)}</TableCell><TableCell className="text-right">{row.branchCount}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}
    </>}
  </div>;
}

function CatalogContent({ data, loading, branchOptions, sourceBranchId, setSourceBranchId, search, setSearch, products, productsLoading, selectedProductIds, setSelectedProductIds, targetBranchIds, setTargetBranchIds, onShare, sharing, onUnshare, unsharing, onSync, syncing, inventoryImportSourceBranchId, setInventoryImportSourceBranchId, inventoryImportBranchIds, setInventoryImportBranchIds, inventoryImportRows, setInventoryImportRows, inventoryImportFileName, setInventoryImportFileName, inventoryImportPriceMode, setInventoryImportPriceMode, inventoryPricesByBranch, setInventoryPricesByBranch, onInventoryImport, inventoryImporting }: {
  data: any[]; loading: boolean; branchOptions: Array<{ id: string; name: string; businessUnitId?: string | null }>;
  sourceBranchId: string; setSourceBranchId: (value: string) => void; search: string; setSearch: (value: string) => void;
  products: any[]; productsLoading: boolean; selectedProductIds: string[]; setSelectedProductIds: (value: string[]) => void;
  targetBranchIds: string[]; setTargetBranchIds: (value: string[]) => void; onShare: () => void; sharing: boolean;
  onUnshare: (mirrorIds: string[]) => void; unsharing: boolean; onSync: (productId: string) => void; syncing: boolean;
  inventoryImportSourceBranchId: string; setInventoryImportSourceBranchId: (value: string) => void;
  inventoryImportBranchIds: string[]; setInventoryImportBranchIds: (value: string[]) => void;
  inventoryImportRows: SharedInventoryImportRow[]; setInventoryImportRows: (value: SharedInventoryImportRow[]) => void;
  inventoryImportFileName: string; setInventoryImportFileName: (value: string) => void;
  inventoryImportPriceMode: 'SAME' | 'BY_BRANCH'; setInventoryImportPriceMode: (value: 'SAME' | 'BY_BRANCH') => void;
  inventoryPricesByBranch: Record<string, Record<string, string>>; setInventoryPricesByBranch: (value: Record<string, Record<string, string>>) => void;
  onInventoryImport: () => void; inventoryImporting: boolean;
}) {
  const toggleProduct = (id: string) => setSelectedProductIds(selectedProductIds.includes(id) ? selectedProductIds.filter((value) => value !== id) : [...selectedProductIds, id]);
  const toggleTarget = (id: string) => setTargetBranchIds(targetBranchIds.includes(id) ? targetBranchIds.filter((value) => value !== id) : [...targetBranchIds, id]);
  return <div className="space-y-6">
    <Card className="rounded-3xl border-border/60">
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight"><Tags className="size-5 text-primary" /> Compartir productos entre sucursales</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sucursal de origen (catálogo maestro)</p>
            <select aria-label="Sucursal de origen" value={sourceBranchId} onChange={(event) => { setSourceBranchId(event.target.value); setSelectedProductIds([]); }} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
              <option value="">Seleccionar sucursal</option>
              {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto por código o nombre..." className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" />
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
              {productsLoading && <p className="p-3 text-center text-xs text-muted-foreground">Cargando productos...</p>}
              {!productsLoading && !products.length && <p className="p-3 text-center text-xs text-muted-foreground">Selecciona una sucursal para ver su catálogo.</p>}
              {products.map((product) => { const checked = selectedProductIds.includes(product.id); return <label key={product.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60"><input type="checkbox" checked={checked} onChange={() => toggleProduct(product.id)} /><span className="min-w-0 flex-1 truncate"><span className="font-semibold">{product.name}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{product.code}</span></span><span className="shrink-0 text-xs font-bold tabular-nums">{formatNumber(product.salePrice)}</span></label>; })}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sucursales destino</p>
            <div className="space-y-1 rounded-xl border border-border/60 p-2">
              {branchOptions.map((branch) => { const checked = targetBranchIds.includes(branch.id); const isSource = branch.id === sourceBranchId; return <label key={branch.id} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60 ${isSource ? 'opacity-40' : ''}`}><input type="checkbox" disabled={isSource} checked={checked} onChange={() => toggleTarget(branch.id)} /><span className="min-w-0 flex-1 truncate font-semibold">{branch.name}</span>{isSource && <span className="shrink-0 text-[10px] font-black uppercase text-muted-foreground">Origen</span>}</label>; })}
            </div>
            <Button className="h-10 w-full rounded-xl" disabled={!selectedProductIds.length || !targetBranchIds.length || sharing} onClick={onShare}>{sharing ? 'Compartiendo...' : 'Compartir seleccionados'}</Button>
            <p className="text-xs text-muted-foreground">Los productos seleccionados se replican en cada sucursal destino con su propio precio (editable). Los cambios de nombre, descripción o impuesto del maestro se propagan con "Sincronizar".</p>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card className="rounded-3xl border-border/60">
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight"><Tags className="size-5 text-primary" /> Productos compartidos ({data.length})</CardTitle></CardHeader>
      <CardContent>
        {loading ? <div className="p-8 text-center text-muted-foreground">Cargando catálogo compartido...</div> : <div className="space-y-4">
          {!data.length && <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay productos compartidos en el grupo.</p>}
          {data.map((master) => <div key={master.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0"><p className="font-bold">{master.name}</p><p className="font-mono text-xs text-muted-foreground">{master.code} · {master.clientTenant?.name} · {formatNumber(master.salePrice)}</p></div>
              <div className="flex items-center gap-2"><Badge variant="outline">{master.sharedCount} espejo(s)</Badge><Button variant="outline" size="sm" disabled={syncing} onClick={() => onSync(master.id)}><RefreshCw className="mr-1.5 size-3.5" /> Sincronizar</Button></div>
            </div>
            {master.mirrors?.length > 0 && <Table containerClassName="mt-3 overflow-x-auto"><TableHeader><TableRow><TableHead>Sucursal espejo</TableHead><TableHead>Precio</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{master.mirrors.map((mirror: any) => <TableRow key={mirror.id}><TableCell className="font-semibold">{mirror.clientTenant?.name}</TableCell><TableCell>{formatNumber(mirror.salePrice)}</TableCell><TableCell><Badge variant={mirror.isActive ? 'default' : 'secondary'}>{mirror.isActive ? 'Activo' : 'Inactivo'}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" className="text-destructive" disabled={unsharing} onClick={() => onUnshare([mirror.id])}>Quitar</Button></TableCell></TableRow>)}</TableBody></Table>}
          </div>)}
        </div>}
      </CardContent>
    </Card>

    <SharedInventoryImportCard
      branches={branchOptions}
      sourceBranchId={inventoryImportSourceBranchId}
      setSourceBranchId={setInventoryImportSourceBranchId}
      branchIds={inventoryImportBranchIds}
      setBranchIds={setInventoryImportBranchIds}
      rows={inventoryImportRows}
      setRows={setInventoryImportRows}
      fileName={inventoryImportFileName}
      setFileName={setInventoryImportFileName}
      priceMode={inventoryImportPriceMode}
      setPriceMode={setInventoryImportPriceMode}
      pricesByBranch={inventoryPricesByBranch}
      setPricesByBranch={setInventoryPricesByBranch}
      onImport={onInventoryImport}
      importing={inventoryImporting}
    />
  </div>;
}

type ManagersContentProps = {
  data: any[];
  branches: Array<{ id: string; name: string }>;
  canEditOwner: boolean;
  editingManagerId: string;
  name: string;
  email: string;
  password: string;
  branchIds: string[];
  canManageManagers: boolean;
  canEdit: boolean;
  permissionState: ManagerPermissionState;
  setEditingManagerId: (value: string) => void;
  setName: (value: string) => void;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setBranchIds: (value: string[]) => void;
  setCanManageManagers: (value: boolean) => void;
  setCanEdit: (value: boolean) => void;
  setPermissionState: (value: ManagerPermissionState) => void;
  onReset: () => void;
  onSave: () => void;
  saving: boolean;
  onPassword: (userId: string, password: string) => void;
  resettingPassword: boolean;
  onRevoke: (userId: string) => void;
  revoking: boolean;
};

function ManagersContent({
  data,
  branches,
  canEditOwner,
  editingManagerId,
  name,
  email,
  password,
  branchIds,
  canManageManagers,
  canEdit,
  permissionState,
  setEditingManagerId,
  setName,
  setEmail,
  setPassword,
  setBranchIds,
  setCanManageManagers,
  setCanEdit,
  setPermissionState,
  onReset,
  onSave,
  saving,
  onPassword,
  resettingPassword,
  onRevoke,
  revoking,
}: ManagersContentProps) {
  const [passwordTargetId, setPasswordTargetId] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const isEditing = Boolean(editingManagerId);
  const toggleBranch = (id: string) => setBranchIds(branchIds.includes(id) ? branchIds.filter((value) => value !== id) : [...branchIds, id]);
  const updatePermission = (module: string, level: ManagerPermissionLevel) => setPermissionState({ ...permissionState, [module]: level });
  const startEditing = (assignment: any) => {
    setEditingManagerId(assignment.user?.id || '');
    setName(assignment.user?.name || '');
    setEmail(assignment.user?.email || '');
    setPassword('');
    setBranchIds(assignment.branchIds || []);
    setCanManageManagers(Boolean(assignment.canManageManagers));
    setCanEdit(Boolean(assignment.canEdit));
    setPermissionState(assignment.isOwner ? defaultManagerPermissionState() : managerPermissionsToState(assignment.permissions));
  };
  const submitPassword = (userId: string) => {
    if (!passwordDraft.trim()) return;
    onPassword(userId, passwordDraft);
    setPasswordTargetId('');
    setPasswordDraft('');
  };

  return <div className="space-y-6">
    <Card className="rounded-3xl border-border/60">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight"><ShieldCheck className="size-5 text-primary" /> {isEditing ? 'Editar acceso Manager' : 'Nuevo usuario Manager'}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">El Manager es global al grupo y no se registra como usuario de una sucursal.</p>
        </div>
        {isEditing && <Button type="button" variant="outline" className="w-fit rounded-xl" onClick={onReset}>Cancelar edición</Button>}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
          <label className="min-w-0 space-y-2 text-sm font-semibold"><span>Nombre completo</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del Manager" className="h-10 w-full max-w-full rounded-xl border border-border bg-background px-3 text-sm font-normal" /></label>
          <label className="min-w-0 space-y-2 text-sm font-semibold"><span>Correo de acceso</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="manager@empresa.com" className="h-10 w-full max-w-full rounded-xl border border-border bg-background px-3 text-sm font-normal" /></label>
          <label className="min-w-0 space-y-2 text-sm font-semibold md:col-span-2"><span>{isEditing ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isEditing ? 'Déjala vacía para conservarla' : 'Contraseña segura'} className="h-10 w-full max-w-full rounded-xl border border-border bg-background px-3 text-sm font-normal" /></label>
        </div>

        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sucursales con acceso</p><span className="text-xs text-muted-foreground">{branchIds.length} seleccionada(s)</span></div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{branches.map((branch) => <label key={branch.id} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-border/60 bg-background p-3 text-sm"><input type="checkbox" checked={branchIds.includes(branch.id)} onChange={() => toggleBranch(branch.id)} className="size-4 shrink-0 accent-primary" /><span className="min-w-0 truncate">{branch.name}</span></label>)}{!branches.length && <p className="text-sm text-muted-foreground">Este grupo todavía no tiene sucursales.</p>}</div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/60 p-4"><input type="checkbox" checked={canEdit} onChange={(event) => setCanEdit(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" /><span><span className="block text-sm font-bold">Puede realizar cambios operativos</span><span className="mt-1 block text-xs text-muted-foreground">Permite operar dentro de las sucursales asignadas y deja trazabilidad del Manager.</span></span></label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/60 p-4"><input type="checkbox" checked={canManageManagers} onChange={(event) => setCanManageManagers(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" /><span><span className="block text-sm font-bold">Puede administrar Managers</span><span className="mt-1 block text-xs text-muted-foreground">Puede crear, editar, restablecer y revocar Managers delegados.</span></span></label>
        </div>

        <div className="rounded-2xl border border-border/60 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Permisos de la vista Manager</p><p className="mt-1 text-xs text-muted-foreground">Define el nivel de cada módulo. Los permisos de sucursal se controlan aparte.</p></div><Badge variant="outline">{Object.values(permissionState).filter((value) => value !== 'NONE').length} módulo(s)</Badge></div>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">{MANAGER_PERMISSION_OPTIONS.map((option) => <div key={option.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-bold">{option.label}</p><p className="text-xs text-muted-foreground">{option.description}</p></div><select aria-label={`Nivel de ${option.label}`} value={permissionState[option.id] || 'NONE'} onChange={(event) => updatePermission(option.id, event.target.value as ManagerPermissionLevel)} className="h-9 w-full shrink-0 rounded-xl border border-border bg-background px-2 text-xs font-bold sm:w-32"><option value="NONE">Sin acceso</option><option value="READ">Lectura</option><option value="EDIT">Editar</option><option value="FULL">Total</option></select></div>)}</div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="rounded-xl" onClick={onReset} disabled={saving}>Limpiar</Button><Button type="button" className="rounded-xl" disabled={saving || !name.trim() || !email.trim() || (!isEditing && !password.trim())} onClick={onSave}>{saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear Manager'}</Button></div>
      </CardContent>
    </Card>

    <Card className="rounded-3xl border-border/60">
      <CardHeader><CardTitle className="text-lg font-black uppercase italic tracking-tight">Managers configurados</CardTitle></CardHeader>
      <CardContent><div className="space-y-3">{data.map((assignment) => <div key={assignment.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{assignment.user?.name}</p><Badge variant={assignment.isOwner ? 'default' : 'outline'}>{assignment.isOwner ? 'Propietario' : 'Delegado'}</Badge><Badge variant="outline">{assignment.branchIds?.length ? `${assignment.branchIds.length} sucursal(es)` : "Todas las sucursales"}</Badge></div><p className="truncate text-xs text-muted-foreground">{assignment.user?.email}</p><p className="mt-1 text-xs text-muted-foreground">{assignment.isOwner ? 'Acceso completo al grupo.' : `${(assignment.permissions || []).filter((permission: any) => permission.read || permission.create || permission.edit || permission.manage).length} módulo(s) configurado(s).`}</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-xl" disabled={assignment.isOwner && !canEditOwner} onClick={() => startEditing(assignment)}><Pencil className="size-3.5" /> Editar</Button><Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-xl" disabled={assignment.isOwner && !canEditOwner} onClick={() => { setPasswordTargetId(passwordTargetId === assignment.user?.id ? '' : assignment.user?.id || ''); setPasswordDraft(''); }}><KeyRound className="size-3.5" /> Contraseña</Button>{!assignment.isOwner && <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-xl text-destructive hover:text-destructive" disabled={revoking} onClick={() => { if (window.confirm(`¿Revocar el acceso de ${assignment.user?.name || 'este Manager'}?`)) onRevoke(assignment.user.id); }}><Trash2 className="size-3.5" /> Revocar</Button>}</div></div>{passwordTargetId === assignment.user?.id && <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row"><input type="password" value={passwordDraft} onChange={(event) => setPasswordDraft(event.target.value)} placeholder="Nueva contraseña" className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm" /><Button type="button" className="h-10 rounded-xl" disabled={!passwordDraft.trim() || resettingPassword} onClick={() => submitPassword(assignment.user.id)}>{resettingPassword ? 'Actualizando...' : 'Actualizar contraseña'}</Button></div>}</div>)}{!data.length && <p className="py-6 text-center text-sm text-muted-foreground">No hay accesos Manager explícitos todavía.</p>}</div></CardContent>
    </Card>
  </div>;
}
