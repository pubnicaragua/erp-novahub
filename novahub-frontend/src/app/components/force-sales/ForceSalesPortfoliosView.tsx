import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { ArrowLeftRight, Check, ChevronDown, Download, FileSpreadsheet, LocateFixed, MapPin, MoreHorizontal, Plus, RefreshCw, Route, Search, Upload, UserRound, X } from 'lucide-react';
import { forceSalesPortfoliosService, type AvailablePortfolioCustomer, type ForceSalesPortfolio, type ForceSalesPortfolioImportResult, type UnlinkedForceSalesProspect } from '../../services/force-sales-portfolios.service';
import { ForceSalesPortfolioImportPreview, type ForceSalesImportManager, type ForceSalesImportRow } from './ForceSalesPortfolioImportPreview';
import { toast } from '../../services/toast';
import { normalizeSearchText } from '../../utils/searchText';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const normalizeHeader = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    const value = error as { response?: { data?: { message?: unknown } }; message?: unknown };
    const message = value.response?.data?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.map(String).join(' · ');
    if (typeof value.message === 'string') return value.message;
  }
  return fallback;
}
function errorList(error: unknown) {
  if (!error || typeof error !== 'object') return [];
  const value = error as { response?: { data?: { errors?: unknown; message?: unknown } }; details?: unknown };
  const body = value.response?.data;
  if (Array.isArray(body?.errors)) return body.errors.map(String);
  if (Array.isArray(body?.message)) return body.message.map(String);
  if (Array.isArray(value.details)) return value.details.map(String);
  return [];
}
const getCell = (row: Record<string, unknown>, aliases: string[]) => {
  const keys = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
  for (const alias of aliases) if (keys.has(normalizeHeader(alias))) return keys.get(normalizeHeader(alias));
  return '';
};
const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const dateCell = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return raw;
};

function downloadPortfolioTemplate() {
  const headers = [
    'Nombre', 'Fecha de ingreso', 'Tipo', 'Nombre de empresa', 'Identificación fiscal', 'RUC', 'Correo', 'Teléfono', 'Teléfono contacto', 'Dirección', 'Ciudad', 'Departamento', 'País', 'Código país', 'Régimen fiscal', 'Límite de crédito', 'Moneda límite de crédito', 'Lista de precios', 'Tipo saldo inicial', 'Saldo inicial', 'Moneda saldo inicial', 'Estado', 'Notas', 'Gestor/Usuario',
  ];
  const example = [
    'Cliente Ejemplo', '', 'PARTICULAR', '', '', '', '', '', '', 'Dirección del cliente', '', '', 'Nicaragua', 'NI', '', 0, 'NIO', '', '', -500, '', 'ACTIVO', '', 'Nombre del gestor',
  ];
  const guide = XLSX.utils.aoa_to_sheet([
    ['GUÍA DE LLENADO · CARTERAS COMERCIALES'],
    ['La importación crea clientes nuevos en Ventas y una cartera por cada gestor seleccionado. El código de cliente lo genera NovaHub.'],
    ['Campo', 'Regla'],
    ['Nombre', 'Obligatorio. Cédula y RUC pueden quedar vacíos.'],
    ['Gestor/Usuario', 'Obligatorio. Escribe el nombre de un usuario con acceso activo a Fuerza Comercial; podrás corregir la asignación antes de importar.'],
    ['Saldo inicial', 'Usa valores negativos para deuda pendiente, positivos para saldo a favor y cero o celda vacía cuando no hay saldo.'],
    ['Moneda y fecha de corte', 'Se seleccionan una sola vez para toda la carga. Las columnas Tipo saldo inicial y Moneda saldo inicial se conservan por compatibilidad con la plantilla de Ventas; en Carteras prevalecen el signo y los datos de la carga.'],
    ['Datos duplicados', 'La importación no sobrescribe clientes existentes. Revisa los avisos por nombre repetido antes de confirmar.'],
    ['Ubicación', 'Después de importar, cada gestor puede registrar GPS, escoger un punto sin cliente o marcar una posición en el mapa. Marcar la ubicación no registra una visita.'],
  ]);
  guide['!cols'] = [{ wch: 30 }, { wch: 105 }];
  const sheet = XLSX.utils.aoa_to_sheet([headers, example]);
  sheet['!cols'] = headers.map((header) => ({ wch: Math.max(16, Math.min(32, header.length + 5)) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Clientes');
  XLSX.utils.book_append_sheet(workbook, guide, 'Guía de llenado');
  XLSX.writeFile(workbook, 'plantilla_clientes_carteras.xlsx');
}

function parseImportRows(rawRows: Array<Record<string, unknown>>, managers: ForceSalesImportManager[]): ForceSalesImportRow[] {
  return rawRows.map((source, index) => {
    const managerValue = String(getCell(source, ['Gestor/Usuario', 'Gestor', 'Gestores', 'Usuario', 'Responsable', 'Assigned To', 'Manager']) || '').trim();
    const managerKey = normalizeHeader(managerValue);
    const managerMatches = managers.filter((manager) => normalizeHeader(manager.name) === managerKey || manager.id === managerValue);
    const name = String(getCell(source, ['Nombre', 'name', 'Cliente', 'customer']) || '').trim();
    const signedBalance = getCell(source, ['Saldo inicial', 'Saldo inicial (+favor/-deuda)', 'openingBalanceAmount', 'importe apertura', 'saldo apertura']);
    const normalizedType = normalizeHeader(getCell(source, ['Tipo', 'type']) || 'particular');
    const type = normalizedType.includes('empresa') || normalizedType.includes('company') || normalizedType.includes('juridica') ? 'COMPANY' : 'INDIVIDUAL';
    const country = String(getCell(source, ['País', 'country']) || 'Nicaragua').trim();
    const countryCode = String(getCell(source, ['Código país', 'countryCode', 'ISO']) || 'NI').trim().toUpperCase();
    return {
      _rowNumber: index + 2,
      _managerId: managerMatches.length === 1 ? managerMatches[0].id : '',
      _name: name,
      _signedBalance: signedBalance === undefined || signedBalance === null ? '' : String(signedBalance).trim(),
      name,
      type,
      companyName: String(getCell(source, ['Nombre de empresa', 'companyName', 'nombre empresa']) || '').trim(),
      fiscalRegime: String(getCell(source, ['Régimen fiscal', 'fiscalRegime']) || '').trim(),
      taxId: String(getCell(source, ['Cédula', 'Identificación fiscal', 'Identificación', 'taxId']) || '').trim(),
      ruc: String(getCell(source, ['RUC']) || '').trim(),
      email: String(getCell(source, ['Correo', 'Email']) || '').trim(),
      phone: String(getCell(source, ['Teléfono', 'phone']) || '').trim(),
      contactPhone: String(getCell(source, ['Teléfono contacto', 'contactPhone']) || '').trim(),
      address: String(getCell(source, ['Dirección', 'address']) || '').trim(),
      city: String(getCell(source, ['Ciudad', 'city']) || '').trim(),
      department: String(getCell(source, ['Departamento', 'department']) || '').trim(),
      country,
      countryCode,
      createdAt: dateCell(getCell(source, ['Fecha de ingreso', 'fecha ingreso', 'createdAt'])),
      creditLimit: getCell(source, ['Límite de crédito', 'creditLimit']) === '' ? 0 : Number(getCell(source, ['Límite de crédito', 'creditLimit'])),
      creditLimitCurrency: String(getCell(source, ['Moneda límite de crédito', 'creditLimitCurrency']) || 'NIO').toUpperCase(),
      priceListCode: String(getCell(source, ['Lista de precios', 'priceListCode']) || '').trim(),
      openingBalanceAmount: signedBalance === '' || signedBalance === undefined ? 0 : Number(signedBalance),
      notes: String(getCell(source, ['Notas', 'notes', 'observaciones']) || '').trim(),
      status: normalizeHeader(getCell(source, ['Estado', 'status']) || 'activo').includes('inactiv') ? 'INACTIVE' : 'ACTIVE',
    };
  }).filter((row) => row._name || row._managerId || row._signedBalance);
}

function getDefaultPortfolioNames(rows: ForceSalesImportRow[], managers: ForceSalesImportManager[]) {
  const managerIds = [...new Set(rows.map((row) => row._managerId).filter(Boolean))];
  return Object.fromEntries(managerIds.map((managerId) => [
    managerId,
    managers.find((manager) => manager.id === managerId)?.name || '',
  ]));
}

export function ForceSalesPortfoliosView({
  canImport,
  canManage,
  canTransfer,
  canLocate,
  canCreateRoute,
  onBuildRoute,
  onPickLocation,
  isSidebarCollapsed = false,
}: {
  canImport: boolean;
  canManage: boolean;
  canTransfer: boolean;
  canLocate: boolean;
  canCreateRoute: boolean;
  onBuildRoute: (request: { portfolioName: string; assignedToId: string | null; prospectIds: string[] }) => void;
  onPickLocation: (portfolioId: string, customerId: string, customerName: string) => void;
  isSidebarCollapsed?: boolean;
}) {
  const [portfolios, setPortfolios] = useState<ForceSalesPortfolio[]>([]);
  const [managers, setManagers] = useState<ForceSalesImportManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ForceSalesImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [portfolioNamesByAssignee, setPortfolioNamesByAssignee] = useState<Record<string, string>>({});
  const [openingBalanceDate, setOpeningBalanceDate] = useState(localDate);
  const [openingBalanceCurrency, setOpeningBalanceCurrency] = useState<'NIO' | 'USD'>('NIO');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ForceSalesPortfolioImportResult | null>(null);
  const [batchId, setBatchId] = useState('');
  const [locating, setLocating] = useState<{ portfolioId: string; customerId: string; customerName: string } | null>(null);
  const [unlinkedProspects, setUnlinkedProspects] = useState<UnlinkedForceSalesProspect[]>([]);
  const [unlinkedProspectsLoading, setUnlinkedProspectsLoading] = useState(false);
  const [unlinkedProspectsError, setUnlinkedProspectsError] = useState('');
  const [selectedProspect, setSelectedProspect] = useState('');
  const [pointPickerOpen, setPointPickerOpen] = useState(false);
  const [pointSearch, setPointSearch] = useState('');
  const [transferTarget, setTransferTarget] = useState<Record<string, string>>({});
  const [expandedPortfolio, setExpandedPortfolio] = useState<string | null>(null);
  const [portfolioSearch, setPortfolioSearch] = useState('');
  const [createPortfolioOpen, setCreatePortfolioOpen] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioAssignee, setNewPortfolioAssignee] = useState('');
  const [availableCustomerSearch, setAvailableCustomerSearch] = useState('');
  const [availableCustomers, setAvailableCustomers] = useState<AvailablePortfolioCustomer[]>([]);
  const [availableCustomerCache, setAvailableCustomerCache] = useState<Record<string, AvailablePortfolioCustomer>>({});
  const [availableCustomerTotal, setAvailableCustomerTotal] = useState(0);
  const [availableCustomersLoading, setAvailableCustomersLoading] = useState(false);
  const [availableCustomersLoadingMore, setAvailableCustomersLoadingMore] = useState(false);
  const [selectedNewCustomerIds, setSelectedNewCustomerIds] = useState<string[]>([]);
  const [creatingPortfolio, setCreatingPortfolio] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [portfolioResult, managerResult] = await Promise.all([
        forceSalesPortfoliosService.list(true),
        canImport || canTransfer || canManage ? forceSalesPortfoliosService.assignees() : Promise.resolve([]),
      ]);
      setPortfolios(Array.isArray(portfolioResult) ? portfolioResult : []);
      setManagers(Array.isArray(managerResult) ? managerResult : []);
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'No se pudieron cargar las carteras.'));
    } finally { setLoading(false); }
  }, [canImport, canManage, canTransfer]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [portfolioResult, managerResult] = await Promise.all([
          forceSalesPortfoliosService.list(true),
          canImport || canTransfer || canManage ? forceSalesPortfoliosService.assignees() : Promise.resolve([]),
        ]);
        if (!cancelled) {
          setPortfolios(Array.isArray(portfolioResult) ? portfolioResult : []);
          setManagers(Array.isArray(managerResult) ? managerResult : []);
        }
      } catch (error: unknown) {
        if (!cancelled) toast.error(errorMessage(error, 'No se pudieron cargar las carteras.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [canImport, canManage, canTransfer]);

  useEffect(() => {
    if (!createPortfolioOpen) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setAvailableCustomersLoading(true);
      setAvailableCustomers([]);
      void forceSalesPortfoliosService.availableCustomers(availableCustomerSearch, 0, 50)
        .then((page) => {
          if (cancelled) return;
          const items = Array.isArray(page?.items) ? page.items : [];
          setAvailableCustomers(items);
          setAvailableCustomerTotal(Number(page?.total) || 0);
          setAvailableCustomerCache((current) => ({ ...current, ...Object.fromEntries(items.map((item) => [item.id, item])) }));
        })
        .catch((error: unknown) => {
          if (!cancelled) toast.error(errorMessage(error, 'No se pudieron cargar los clientes disponibles.'));
        })
        .finally(() => { if (!cancelled) setAvailableCustomersLoading(false); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [availableCustomerSearch, createPortfolioOpen]);

  const activePortfolios = useMemo(() => portfolios.filter((portfolio) => portfolio.status === 'ACTIVE'), [portfolios]);
  const activeCustomers = useMemo(() => portfolios.reduce((count, portfolio) => count + portfolio.customers.filter((row) => row.assignmentStatus === 'ACTIVE').length, 0), [portfolios]);
  const filteredPortfolios = useMemo(() => {
    const query = normalizeSearchText(portfolioSearch);
    return portfolios.map((portfolio) => ({
      portfolio,
      customers: query ? portfolio.customers.filter((row) => normalizeSearchText([
        row.customer.name, row.customer.code, row.customer.address, row.customer.city, row.customer.department, row.customer.phone,
      ].filter(Boolean).join(' ')).includes(query)) : portfolio.customers,
    })).filter((item) => !query || item.customers.length > 0);
  }, [portfolioSearch, portfolios]);
  const matchedPortfolioCustomerCount = useMemo(() => filteredPortfolios.reduce((count, item) => count + item.customers.length, 0), [filteredPortfolios]);
  const usedPortfolioManagerCount = useMemo(() => new Set(rows.map((row) => row._managerId).filter(Boolean)).size, [rows]);
  const selectedProspectRecord = useMemo(() => unlinkedProspects.find((prospect) => prospect.id === selectedProspect) || null, [selectedProspect, unlinkedProspects]);
  const filteredUnlinkedProspects = useMemo(() => {
    const query = normalizeSearchText(pointSearch);
    if (!query) return unlinkedProspects;
    return unlinkedProspects.filter((prospect) => normalizeSearchText([
      prospect.name,
      prospect.address,
      `${prospect.lat}, ${prospect.lng}`,
    ].filter(Boolean).join(' ')).includes(query));
  }, [pointSearch, unlinkedProspects]);
  const openCreatePortfolio = () => {
    setNewPortfolioName('');
    setNewPortfolioAssignee('');
    setAvailableCustomerSearch('');
    setAvailableCustomers([]);
    setAvailableCustomerCache({});
    setAvailableCustomerTotal(0);
    setSelectedNewCustomerIds([]);
    setCreatePortfolioOpen(true);
  };

  const loadMoreAvailableCustomers = async () => {
    if (availableCustomersLoadingMore || availableCustomersLoading || availableCustomers.length >= availableCustomerTotal) return;
    setAvailableCustomersLoadingMore(true);
    try {
      const page = await forceSalesPortfoliosService.availableCustomers(availableCustomerSearch, availableCustomers.length, 50);
      const items = Array.isArray(page?.items) ? page.items : [];
      setAvailableCustomers((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...items.filter((item) => !seen.has(item.id))];
      });
      setAvailableCustomerCache((current) => ({ ...current, ...Object.fromEntries(items.map((item) => [item.id, item])) }));
      setAvailableCustomerTotal(Number(page?.total) || 0);
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'No se pudieron cargar más clientes.'));
    } finally { setAvailableCustomersLoadingMore(false); }
  };

  const createManualPortfolio = async () => {
    const name = newPortfolioName.trim();
    if (!name || !newPortfolioAssignee || !selectedNewCustomerIds.length) return;
    setCreatingPortfolio(true);
    try {
      const result = await forceSalesPortfoliosService.create({ name, assignedToId: newPortfolioAssignee, customerIds: selectedNewCustomerIds });
      toast.success(`Cartera “${result.name}” creada con ${result.memberCount} clientes.`);
      setCreatePortfolioOpen(false);
      await reload();
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'No se pudo crear la cartera. Actualiza los clientes seleccionados e inténtalo de nuevo.'));
    } finally { setCreatingPortfolio(false); }
  };
  const openImport = () => {
    setFileName(''); setRows([]); setImportErrors([]); setImportResult(null); setImportPreviewOpen(false);
    setPortfolioNamesByAssignee({}); setOpeningBalanceDate(localDate()); setOpeningBalanceCurrency('NIO'); setBatchId(crypto.randomUUID());
    setImportOpen(true);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'xlsx' && extension !== 'xls') {
      setRows([]);
      setFileName('');
      toast.error('Selecciona un archivo Excel en formato .xlsx o .xls.');
      return;
    }
    setImportErrors([]); setImportResult(null); setFileName(file.name); setBatchId(crypto.randomUUID());
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames.find((name) => normalizeHeader(name) === 'clientes') || workbook.SheetNames[0];
      const source = sheetName ? XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' }) : [];
      const parsedRows = parseImportRows(source, managers);
      if (!parsedRows.length) throw new Error('No se encontraron filas de clientes en la hoja seleccionada.');
      if (parsedRows.length > 5000) throw new Error('El archivo supera el límite de 5,000 clientes por carga. Divídelo en varios archivos.');
      setRows(parsedRows);
      setPortfolioNamesByAssignee(getDefaultPortfolioNames(parsedRows, managers));
    } catch (error: unknown) {
      setRows([]);
      setPortfolioNamesByAssignee({});
      toast.error(errorMessage(error, 'No se pudo leer el archivo Excel. Usa formato .xlsx o .xls.'));
    }
  };

  const updateRowManager = (index: number, managerId: string) => {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, _managerId: managerId } : row));
    if (managerId) setPortfolioNamesByAssignee((current) => (
      Object.prototype.hasOwnProperty.call(current, managerId)
        ? current
        : { ...current, [managerId]: managers.find((manager) => manager.id === managerId)?.name || '' }
    ));
  };
  const rowErrors = useMemo(() => rows.flatMap((row) => {
    const result: string[] = [];
    if (!row._name) result.push(`Fila ${row._rowNumber}: falta el nombre.`);
    if (!row._managerId) result.push(`Fila ${row._rowNumber}: asigna un gestor activo.`);
    if (row._signedBalance && !Number.isFinite(Number(row._signedBalance))) result.push(`Fila ${row._rowNumber}: el saldo inicial no es un número válido.`);
    return result;
  }), [rows]);

  const confirmImport = async () => {
    const assignedManagerIds = [...new Set(rows.map((row) => row._managerId).filter(Boolean))];
    const namesForImport = Object.fromEntries(assignedManagerIds.map((managerId) => [
      managerId,
      (portfolioNamesByAssignee[managerId] ?? managers.find((manager) => manager.id === managerId)?.name ?? '').trim(),
    ]));
    if (!rows.length || rowErrors.length || Object.values(namesForImport).some((name) => !name) || !openingBalanceDate) return;
    setImporting(true); setImportErrors([]); setImportResult(null);
    try {
      const response = await forceSalesPortfoliosService.import({
        batchId,
        sourceFileName: fileName,
        portfolioName: 'Carteras por gestor',
        portfolioNamesByAssignee: namesForImport,
        openingBalanceCurrency,
        openingBalanceDate,
        rows: rows.map((row) => {
          const { _rowNumber: _row, _managerId: managerId, _name: _name, _signedBalance: _balance, ...customer } = row;
          return {
            ...customer,
            forceSalesAssignedToId: managerId,
            type: customer.type === 'COMPANY' ? 'company' : 'individual',
            openingBalanceAmount: row._signedBalance === '' ? undefined : Number(row._signedBalance),
            openingBalanceCurrency,
          };
        }),
      });
      setImportResult(response);
      await reload();
      toast.success(response.idempotentReplay ? 'Se recuperó el resultado de la carga anterior.' : `Se crearon ${response.created} clientes en ${response.portfolios?.length || 0} carteras.`);
    } catch (error: unknown) {
      const messages = errorList(error);
      const message = errorMessage(error, 'No se pudo importar el archivo.');
      setImportErrors(messages.length ? messages : [message]);
    } finally { setImporting(false); }
  };

  const openImportPreview = () => {
    if (!rows.length) return;
    setImportOpen(false);
    setImportPreviewOpen(true);
  };

  const backToImport = () => {
    if (importing) return;
    setImportPreviewOpen(false);
    setImportOpen(true);
  };

  const finishImport = () => {
    setImportPreviewOpen(false);
    setImportOpen(false);
    setFileName('');
    setRows([]);
    setImportErrors([]);
    setImportResult(null);
  };

  const closePortfolio = async (portfolio: ForceSalesPortfolio) => {
    if (!window.confirm(`¿Cerrar “${portfolio.name}”? Sus clientes conservarán el historial y dejarán de estar asignados activamente.`)) return;
    try { await forceSalesPortfoliosService.close(portfolio.id); toast.success('Cartera cerrada.'); await reload(); }
    catch (error: unknown) { toast.error(errorMessage(error, 'No se pudo cerrar la cartera.')); }
  };

  const transferCustomer = async (portfolio: ForceSalesPortfolio, customerId: string, customerName: string) => {
    const targetId = transferTarget[customerId];
    if (!targetId) { toast.error('Selecciona la cartera destino.'); return; }
    const target = activePortfolios.find((item) => item.id === targetId);
    if (!target || !window.confirm(`¿Transferir “${customerName}” desde “${portfolio.name}” a “${target.name}”? Se conservará la asignación anterior en el historial.`)) return;
    try { await forceSalesPortfoliosService.transfer(customerId, targetId); toast.success('Cliente transferido.'); await reload(); }
    catch (error: unknown) { toast.error(errorMessage(error, 'No se pudo transferir el cliente.')); }
  };

  const loadUnlinkedProspects = async () => {
    setUnlinkedProspectsLoading(true);
    setUnlinkedProspectsError('');
    try {
      const result = await forceSalesPortfoliosService.unlinkedProspects();
      setUnlinkedProspects(Array.isArray(result) ? result : []);
    } catch (error: unknown) {
      const message = errorMessage(error, 'No se pudieron cargar los puntos sin cliente.');
      setUnlinkedProspects([]);
      setUnlinkedProspectsError(message);
      toast.error(message);
    } finally {
      setUnlinkedProspectsLoading(false);
    }
  };

  const openLocateDialog = async (portfolio: ForceSalesPortfolio, customerId: string, customerName: string) => {
    setLocating({ portfolioId: portfolio.id, customerId, customerName });
    setSelectedProspect('');
    setPointSearch('');
    setPointPickerOpen(false);
    await loadUnlinkedProspects();
  };

  const saveCurrentGps = () => {
    if (!locating) return;
    if (!navigator.geolocation) { toast.error('Este dispositivo no permite obtener ubicación GPS.'); return; }
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        await forceSalesPortfoliosService.saveLocation(locating.portfolioId, locating.customerId, position.coords.latitude, position.coords.longitude);
        toast.success(`Punto guardado y vinculado a ${locating.customerName}. No se registró una visita.`); setLocating(null); await reload();
      } catch (error: unknown) { toast.error(errorMessage(error, 'No se pudo guardar la ubicación.')); }
    }, (error) => toast.error(error.message || 'No se pudo obtener la ubicación del dispositivo.'), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const linkExistingPoint = async () => {
    if (!locating || !selectedProspect) return;
    try {
      await forceSalesPortfoliosService.linkToProspect(locating.portfolioId, locating.customerId, selectedProspect);
      toast.success('Cliente vinculado al punto comercial.'); setLocating(null); await reload();
    } catch (error: unknown) { toast.error(errorMessage(error, 'No se pudo vincular el punto.')); }
  };

  const formatBalance = (value: number | string | undefined) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '—';
    return `${new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} · moneda base`;
  };

  if (importPreviewOpen) return <ForceSalesPortfolioImportPreview
    rows={rows}
    managers={managers}
    fileName={fileName}
    portfolioNamesByAssignee={portfolioNamesByAssignee}
    isSidebarCollapsed={isSidebarCollapsed}
    importing={importing}
    errors={importErrors}
    result={importResult}
    onRowManagerChange={updateRowManager}
    onPortfolioNameChange={(managerId, name) => setPortfolioNamesByAssignee((current) => ({ ...current, [managerId]: name }))}
    onBack={backToImport}
    onConfirm={() => void confirmImport()}
    onDone={finishImport}
  />;

  return (
    <div className="min-w-0 flex-1 overflow-y-auto bg-background px-4 py-5 sm:px-6 md:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Fuerza Comercial</p>
            <h1 className="nh-module-title mt-1">Carteras de clientes</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Listados asignados por gestor. Después de ubicar un cliente, el punto aparece en el mapa para registrar visitas.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" onClick={() => void reload()} disabled={loading} aria-label="Actualizar carteras"><RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</Button>
            {canManage && canTransfer && <Button variant="outline" onClick={openCreatePortfolio}><Plus className="mr-2 size-4" />Nueva cartera</Button>}
            {canImport && <Button onClick={openImport}><Plus className="mr-2 size-4" />Importar cartera</Button>}
          </div>
        </header>

        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={portfolioSearch} onChange={(event) => setPortfolioSearch(event.target.value)} className="h-11 pl-10 pr-10" placeholder="Buscar clientes por nombre, código, dirección o teléfono…" aria-label="Buscar clientes dentro de las carteras" />
            {portfolioSearch && <button type="button" onClick={() => setPortfolioSearch('')} className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Limpiar búsqueda"><X className="size-4" /></button>}
          </label>
          {portfolioSearch && <p className="mt-2 text-xs text-muted-foreground">{matchedPortfolioCustomerCount} clientes coinciden en {filteredPortfolios.length} carteras.</p>}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Carteras activas</p><p className="mt-2 text-2xl font-black text-foreground">{activePortfolios.length}</p></div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Clientes asignados</p><p className="mt-2 text-2xl font-black text-foreground">{activeCustomers}</p></div>
        </div>

        {loading && <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Cargando carteras…</div>}
        {!loading && !portfolios.length && <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><FileSpreadsheet className="mx-auto size-9 text-muted-foreground" /><h2 className="mt-3 font-bold text-foreground">Todavía no hay carteras</h2><p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">Importa el Excel de clientes con el gestor indicado en cada fila. Los clientes se crearán en Ventas y quedarán agrupados por gestor.</p>{canImport && <Button className="mt-4" onClick={openImport}><Upload className="mr-2 size-4" />Importar primer listado</Button>}</div>}

        {!loading && filteredPortfolios.map(({ portfolio, customers: visibleCustomers }) => {
          const isExpanded = expandedPortfolio === portfolio.id;
          const activeRows = portfolio.customers.filter((row) => row.assignmentStatus === 'ACTIVE');
          const locatedRows = activeRows.filter((row) => row.hasMapLocation && row.mapPointId);
          const pendingLocations = Math.max(0, activeRows.length - locatedRows.length);
          const canBuildRoute = canCreateRoute && portfolio.status === 'ACTIVE' && activeRows.length > 0 && pendingLocations === 0;
          const routeReadinessMessage = !activeRows.length
            ? 'Esta cartera no tiene clientes activos.'
            : pendingLocations
              ? `Ubica los ${pendingLocations} pendientes para habilitar el armado.`
              : 'Se cargarán todos los puntos al planificador para revisar el orden, la fecha y el responsable antes de guardar.';
          return (
            <article key={portfolio.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex min-w-0 items-start gap-2 p-4 sm:items-center sm:p-5">
              <button type="button" onClick={() => setExpandedPortfolio(isExpanded ? null : portfolio.id)} className="flex min-w-0 flex-1 flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between" aria-expanded={isExpanded}>
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary"><UserRound className="size-5" /></span>
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="nh-section-title break-words text-foreground">{portfolio.name}</h2><Badge variant={portfolio.status === 'ACTIVE' ? 'default' : 'secondary'}>{portfolio.status === 'ACTIVE' ? 'Activa' : 'Cerrada'}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Gestor: <span className="font-semibold text-foreground">{portfolio.assignedTo?.name || 'Sin usuario'}</span> · {activeRows.length} clientes activos · carga {new Date(portfolio.createdAt).toLocaleDateString('es-NI')}</p></div>
                </div>
                <div className="flex shrink-0 items-center gap-2"><ChevronDown className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} /></div>
              </button>
              {canManage && portfolio.status === 'ACTIVE' && <DropdownMenu>
                <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={`Acciones de la cartera ${portfolio.name}`}><MoreHorizontal className="size-5" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onSelect={() => void closePortfolio(portfolio)}><X className="size-4" />Cerrar cartera</DropdownMenuItem></DropdownMenuContent>
              </DropdownMenu>}
              </div>
              {isExpanded && <div className="border-t border-border p-3 sm:p-5">
                {portfolio.status === 'ACTIVE' && canCreateRoute && <div className="mb-4 flex min-w-0 flex-col gap-3 rounded-xl border border-primary/20 bg-primary/[0.035] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground">Preparar ruta desde esta cartera</p>
                    <p className="mt-1 text-xs text-muted-foreground">{locatedRows.length} de {activeRows.length} clientes activos tienen ubicación. {routeReadinessMessage}</p>
                  </div>
                  <Button className="shrink-0" onClick={() => onBuildRoute({
                    portfolioName: portfolio.name,
                    assignedToId: portfolio.assignedTo?.id || null,
                    prospectIds: locatedRows.map((row) => String(row.mapPointId)),
                  })} disabled={!canBuildRoute} title={pendingLocations ? `Faltan ${pendingLocations} ubicaciones` : !activeRows.length ? 'La cartera no tiene clientes activos' : undefined}>
                    <Route className="mr-2 size-4" />Armar ruta
                  </Button>
                </div>}
                {!visibleCustomers.length ? <p className="rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">No hay clientes que coincidan en esta cartera.</p> : <Table responsiveCards={false} copyableCells={false} containerClassName="max-h-[min(58vh,34rem)] overflow-auto overscroll-contain" className="min-w-[720px]">
                  <TableHeader className="sticky top-0 z-20 bg-card shadow-sm">
                    <TableRow className="hover:bg-card">
                      <TableHead>Cliente</TableHead><TableHead>Dirección</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {visibleCustomers.map((row) => {
                    const customer = row.customer;
                    const active = row.assignmentStatus === 'ACTIVE' && portfolio.status === 'ACTIVE';
                    const canOfferLocate = canLocate && active;
                    const targets = activePortfolios.filter((target) => target.id !== portfolio.id);
                    return <TableRow key={row.assignmentId}>
                      <TableCell className="max-w-[260px] whitespace-normal"><p className="break-words font-bold text-foreground">{customer.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{customer.code || 'Sin código'}{customer.balance !== undefined ? ` · Saldo ${formatBalance(customer.balance)}` : ''}</p></TableCell>
                      <TableCell className="max-w-[250px] whitespace-normal text-xs text-muted-foreground">{[customer.address, customer.city, customer.department].filter(Boolean).join(' · ') || 'Sin dirección'}{customer.phone ? ` · ${customer.phone}` : ''}</TableCell>
                      <TableCell>{active && <Badge variant={row.hasMapLocation ? 'default' : 'secondary'}>{row.hasMapLocation ? 'Ubicado' : row.mapPointId ? 'Vinculado · pendiente' : 'Pendiente de vincular'}</Badge>}{!active && <Badge variant="secondary">Histórico</Badge>}</TableCell>
                      <TableCell className="text-right"><div className="flex justify-end gap-2">
                        {canOfferLocate && <Button size="sm" variant="outline" onClick={() => void openLocateDialog(portfolio, customer.id, customer.name)}><MapPin className="mr-1.5 size-4" />Ubicar</Button>}
                        {canTransfer && active && targets.length > 0 && <div className="flex max-w-full items-center gap-1.5"><select aria-label={`Cartera destino para ${customer.name}`} className="h-9 max-w-[190px] rounded-lg border border-input bg-background px-2 text-xs text-foreground" value={transferTarget[customer.id] || ''} onChange={(event) => setTransferTarget((current) => ({ ...current, [customer.id]: event.target.value }))}><option value="">Mover a…</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.assignedTo?.name} · {target.name}</option>)}</select><Button size="sm" variant="outline" aria-label={`Transferir ${customer.name}`} onClick={() => void transferCustomer(portfolio, customer.id, customer.name)}><ArrowLeftRight className="size-4" /></Button></div>}
                      </div></TableCell>
                    </TableRow>;
                  })}
                  </TableBody>
                </Table>}
              </div>}
            </article>
          );
        })}
        {!loading && portfolios.length > 0 && !filteredPortfolios.length && <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No encontramos clientes que coincidan con “{portfolioSearch}”.</div>}
      </div>

      <Dialog open={createPortfolioOpen} onOpenChange={(open) => { if (!creatingPortfolio) setCreatePortfolioOpen(open); }}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="nh-section-title flex items-center gap-2"><Plus className="size-5" />Crear cartera</DialogTitle>
            <DialogDescription>Elige un nombre, el usuario responsable y clientes activos que todavía no pertenezcan a otra cartera activa.</DialogDescription>
          </DialogHeader>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground">Nombre de la cartera
              <Input value={newPortfolioName} onChange={(event) => setNewPortfolioName(event.target.value)} maxLength={180} placeholder="Ej. Ruta 5" autoFocus />
            </label>
            <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground">Usuario responsable
              <Select value={newPortfolioAssignee} onValueChange={setNewPortfolioAssignee}>
                <SelectTrigger aria-label="Usuario responsable de la cartera"><SelectValue placeholder="Selecciona un usuario" /></SelectTrigger>
                <SelectContent>{managers.map((manager) => <SelectItem key={manager.id} value={manager.id}>{manager.name}</SelectItem>)}</SelectContent>
              </Select>
            </label>
          </div>
          <div className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-sm font-bold text-foreground">Clientes disponibles</p><p className="text-xs text-muted-foreground">Los clientes ya asignados a una cartera activa no aparecen aquí.</p></div>
              <Badge variant="secondary">{selectedNewCustomerIds.length} / 500 seleccionados</Badge>
            </div>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={availableCustomerSearch} onChange={(event) => setAvailableCustomerSearch(event.target.value)} className="pl-10" placeholder="Buscar por nombre, código o RUC…" aria-label="Buscar clientes disponibles" />
            </label>
            <div className="max-h-[min(38vh,24rem)] overflow-y-auto overscroll-contain rounded-lg border border-border/70" aria-label="Lista de clientes disponibles">
              {availableCustomersLoading && <p className="p-5 text-center text-sm text-muted-foreground">Buscando clientes…</p>}
              {!availableCustomersLoading && availableCustomers.map((customer) => {
                const selected = selectedNewCustomerIds.includes(customer.id);
                return <label key={customer.id} className="flex cursor-pointer items-start gap-3 border-b border-border/60 p-3 last:border-0 hover:bg-muted/30">
                  <input type="checkbox" checked={selected} disabled={!selected && selectedNewCustomerIds.length >= 500} onChange={(event) => setSelectedNewCustomerIds((current) => event.target.checked ? [...current, customer.id] : current.filter((id) => id !== customer.id))} className="mt-1 size-4 shrink-0 accent-primary" />
                  <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold text-foreground">{customer.name}{customer.companyName ? ` · ${customer.companyName}` : ''}</span><span className="mt-0.5 block break-words text-xs text-muted-foreground">{customer.code}{customer.taxId || customer.ruc ? ` · ${customer.taxId || customer.ruc}` : ''}{customer.address || customer.city ? ` · ${[customer.address, customer.city].filter(Boolean).join(', ')}` : ''}</span></span>
                </label>;
              })}
              {!availableCustomersLoading && !availableCustomers.length && <p className="p-5 text-center text-sm text-muted-foreground">No hay clientes disponibles que coincidan con la búsqueda.</p>}
            </div>
            {availableCustomers.length < availableCustomerTotal && <div className="flex justify-center"><Button type="button" variant="outline" size="sm" onClick={() => void loadMoreAvailableCustomers()} disabled={availableCustomersLoadingMore}><ChevronDown className={`mr-2 size-4 ${availableCustomersLoadingMore ? 'animate-bounce' : ''}`} />{availableCustomersLoadingMore ? 'Cargando…' : `Cargar más (${availableCustomers.length} de ${availableCustomerTotal})`}</Button></div>}
          </div>
          {!!selectedNewCustomerIds.length && <div className="rounded-xl border border-primary/20 bg-primary/[0.035] p-3">
            <p className="mb-2 text-xs font-bold text-foreground">Selección ({selectedNewCustomerIds.length})</p>
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
              {selectedNewCustomerIds.map((id) => <button key={id} type="button" onClick={() => setSelectedNewCustomerIds((current) => current.filter((item) => item !== id))} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:border-destructive/40 hover:text-destructive" title="Quitar de la selección"><span className="max-w-[220px] truncate">{availableCustomerCache[id]?.name || 'Cliente seleccionado'}</span><X className="size-3 shrink-0" /></button>)}
            </div>
          </div>}
          <DialogFooter className="flex-wrap">
            <Button type="button" variant="outline" onClick={() => setCreatePortfolioOpen(false)} disabled={creatingPortfolio}>Cancelar</Button>
            <Button type="button" onClick={() => void createManualPortfolio()} disabled={creatingPortfolio || !newPortfolioName.trim() || !newPortfolioAssignee || !selectedNewCustomerIds.length}><Plus className="mr-2 size-4" />{creatingPortfolio ? 'Creando cartera…' : 'Crear cartera'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(open) => { if (!importing) setImportOpen(open); }}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle className="nh-section-title flex items-center gap-2"><FileSpreadsheet className="size-5" />Importar cartera comercial</DialogTitle><DialogDescription>Usa la plantilla normal de clientes con la columna Gestor/Usuario. Se crearán clientes nuevos en Ventas y una cartera por gestor.</DialogDescription></DialogHeader>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(200px,1.1fr)]">
            <label className="min-w-0 space-y-1 text-xs font-bold text-muted-foreground">Fecha de corte<Input type="date" value={openingBalanceDate} onChange={(event) => setOpeningBalanceDate(event.target.value)} className="min-w-0 max-w-full" /></label>
            <label className="min-w-0 space-y-1 text-xs font-bold text-muted-foreground">Moneda de saldos<Select value={openingBalanceCurrency} onValueChange={(value) => setOpeningBalanceCurrency(value as 'NIO' | 'USD')}><SelectTrigger className="min-w-0 max-w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NIO">NIO · Córdoba</SelectItem><SelectItem value="USD">USD · Dólar</SelectItem></SelectContent></Select></label>
            <div className="min-w-0 space-y-1"><span className="text-xs font-bold text-muted-foreground">Archivo Excel</span><input ref={fileInput} type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" aria-label="Archivo Excel de cartera" tabIndex={-1} className="sr-only" onChange={(event) => { void onFile(event.target.files?.[0]); event.target.value = ''; }} /><Button type="button" variant="outline" className="w-full min-w-0 justify-start overflow-hidden" onClick={() => fileInput.current?.click()}><Upload className="mr-2 size-4 shrink-0" /><span className="min-w-0 truncate">Elegir archivo Excel</span></Button><p className="min-w-0 truncate text-[11px] text-muted-foreground" title={fileName}>{fileName || 'Solo formatos .xlsx y .xls'}</p></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/15 bg-primary/[0.035] p-3 text-xs text-muted-foreground"><span>Saldo negativo = deuda pendiente · positivo = saldo a favor · cero = sin saldo. El saldo y los datos del cliente no se actualizan si existe un homónimo; revisa los avisos.</span><Button type="button" variant="ghost" size="sm" onClick={downloadPortfolioTemplate}><Download className="mr-1.5 size-4" />Descargar plantilla</Button></div>
          {!!rows.length && <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 p-3 text-xs"><Badge variant="secondary">{rows.length} filas</Badge><Badge variant="secondary">{usedPortfolioManagerCount} gestores</Badge><span className="min-w-0 flex-1 truncate text-muted-foreground">El nombre de cada cartera inicia con el nombre de su gestor y puedes editarlo en la vista previa.</span><Button type="button" onClick={openImportPreview} className="w-full sm:ml-auto sm:w-auto">Previsualizar clientes</Button></div>}
          <DialogFooter className="flex-wrap"><Button type="button" variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>Cerrar</Button>{!rows.length && <span className="text-xs text-muted-foreground">Carga un archivo Excel para habilitar la previsualización.</span>}</DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(locating)} onOpenChange={(open) => { if (!open) { setPointPickerOpen(false); setPointSearch(''); setLocating(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="nh-section-title flex items-center gap-2"><LocateFixed className="size-5" />Ubicar cliente en el mapa</DialogTitle><DialogDescription>{locating?.customerName}. Puedes guardar tu GPS actual o elegir el punto en el mapa. El punto quedará vinculado directamente a este cliente y no registrará una visita.</DialogDescription></DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" onClick={saveCurrentGps}><LocateFixed className="mr-2 size-4" />Usar ubicación GPS</Button><Button variant="outline" onClick={() => { if (locating) onPickLocation(locating.portfolioId, locating.customerId, locating.customerName); setLocating(null); }}><MapPin className="mr-2 size-4" />Crear punto y vincular</Button></div>
          <div className="space-y-2 rounded-xl border border-border p-3">
            <p className="text-sm font-bold text-foreground">Vincular punto existente</p>
            <p className="text-xs text-muted-foreground">Busca un punto con ubicación que todavía no esté vinculado a un cliente.</p>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full min-w-0 justify-between gap-2 text-left font-normal"
              onClick={() => { setPointSearch(''); setPointPickerOpen(true); }}
              disabled={unlinkedProspectsLoading || Boolean(unlinkedProspectsError) || !unlinkedProspects.length}
              aria-haspopup="dialog"
              aria-expanded={pointPickerOpen}
              aria-label={selectedProspectRecord ? `Cambiar punto seleccionado: ${selectedProspectRecord.name}` : 'Buscar punto comercial'}
            >
              <span className="min-w-0 truncate">
                {unlinkedProspectsLoading
                  ? 'Cargando puntos…'
                  : selectedProspectRecord
                    ? `${selectedProspectRecord.name}${selectedProspectRecord.address ? ` · ${selectedProspectRecord.address}` : ''}`
                    : unlinkedProspectsError ? 'No se pudieron cargar los puntos' : unlinkedProspects.length ? 'Buscar punto por nombre o dirección' : 'No hay puntos disponibles'}
              </span>
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Button>
            {unlinkedProspectsError && <div className="flex flex-wrap items-center justify-between gap-2"><p role="alert" className="min-w-0 text-xs text-destructive">{unlinkedProspectsError}</p><Button type="button" variant="outline" size="sm" onClick={() => void loadUnlinkedProspects()}>Reintentar</Button></div>}
            <Button type="button" className="w-full" onClick={() => void linkExistingPoint()} disabled={!selectedProspect || unlinkedProspectsLoading}>Vincular cliente al punto</Button>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setLocating(null)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(locating) && pointPickerOpen}
        onOpenChange={(open) => { setPointPickerOpen(open); if (!open) setPointSearch(''); }}
      >
        <DialogContent className="!z-[61] w-[calc(100%-1rem)] max-w-2xl gap-3 p-4 sm:p-6" overlayClassName="!z-[60]">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="nh-section-title">Buscar punto comercial</DialogTitle>
            <DialogDescription>Busca por nombre, dirección o coordenadas y selecciona el punto que corresponde a este cliente.</DialogDescription>
          </DialogHeader>
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              autoFocus
              type="search"
              value={pointSearch}
              onChange={(event) => setPointSearch(event.target.value)}
              placeholder="Buscar nombre, dirección o coordenadas…"
              className="pl-9"
              aria-label="Buscar punto comercial por nombre, dirección o coordenadas"
            />
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {unlinkedProspectsLoading ? 'Cargando puntos…' : `${filteredUnlinkedProspects.length} de ${unlinkedProspects.length} puntos disponibles`}
          </p>
          <div role="listbox" aria-label="Puntos comerciales sin cliente" className="max-h-[min(56vh,calc(100dvh-17rem))] min-w-0 space-y-2 overflow-y-auto overscroll-contain rounded-xl border border-border/60 bg-muted/10 p-2">
            {unlinkedProspectsLoading
              ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando puntos comerciales…</p>
              : unlinkedProspectsError
                ? <p role="alert" className="py-10 text-center text-sm text-destructive">{unlinkedProspectsError}</p>
                : filteredUnlinkedProspects.length
                  ? filteredUnlinkedProspects.map((prospect) => {
                    const selected = selectedProspect === prospect.id;
                    return (
                      <button
                        key={prospect.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => { setSelectedProspect(prospect.id); setPointPickerOpen(false); setPointSearch(''); }}
                        className={`flex min-w-0 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-card'}`}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><MapPin className="size-4" aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-semibold text-foreground">{prospect.name}</span>
                          <span className="mt-0.5 block break-words text-xs text-muted-foreground">{prospect.address || `${prospect.lat}, ${prospect.lng}`}</span>
                        </span>
                        <Check className={`size-4 shrink-0 text-primary ${selected ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
                      </button>
                    );
                  })
                  : <p className="py-10 text-center text-sm text-muted-foreground">{unlinkedProspects.length ? 'No se encontraron puntos con esa búsqueda.' : 'No hay puntos con ubicación pendientes de vincular.'}</p>}
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setPointPickerOpen(false)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
