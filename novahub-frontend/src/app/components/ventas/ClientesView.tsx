import { useEffect, useRef, useState } from 'react';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import * as XLSX from 'xlsx';
import { 
  Users, UserPlus, Search, CreditCard, CheckCircle2, Eye, Pencil, Upload, Download, Ban, CircleX, Settings2, Check, CircleHelp
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { customersService } from '../../services/ventas.service';
import { priceListsService, type PriceList } from '../../services/price-lists.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { SalesKpiCard } from './SalesKpiCard';
import { useAuth } from '../../contexts/AuthContext';
import type { Customer, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { useCurrency } from '../../contexts/CurrencyContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { CustomerDetailDrawer } from './CustomerDetailDrawer';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { CustomerImportPreview, type CustomerImportResult, type CustomerImportRow } from './CustomerImportPreview';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { SalesViewTutorial } from './SalesViewTutorial';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { getCustomerDebtAmount, getCustomerFavorAmount } from '../../utils/customerBalance';
import { parseSpreadsheetInWorker } from '../../utils/import-spreadsheet';
import { normalizeCurrency, summarizeAmountsByCurrency, type SupportedCurrency } from '../../utils/currency';

interface ClientesViewProps {
  data: Customer[];
  loading: boolean;
  onRefresh: () => void;
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  isSidebarCollapsed?: boolean;
}

type CustomerDraft = {
  name: string;
  type: 'individual' | 'company';
  fiscalRegime: string;
  priceListId: string;
  taxId: string;
  ruc: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  department: string;
  country: string;
  creditLimit: string;
  creditLimitCurrency: SupportedCurrency;
  creditDays: string;
  notes: string;
  status: 'ACTIVE' | 'INACTIVE';
};

const emptyCustomerDraft = (creditLimitCurrency: SupportedCurrency = 'NIO'): CustomerDraft => ({
  name: '', type: 'individual', fiscalRegime: '', priceListId: '',
  taxId: '', ruc: '', email: '', phone: '', address: '', city: '', department: '',
  country: 'Nicaragua', creditLimit: '', creditLimitCurrency, creditDays: '', notes: '', status: 'ACTIVE',
});

const DEFAULT_CUSTOMER_COLUMN_KEYS = ['code', 'name', 'taxId', 'ruc', 'type', 'fiscalRegime', 'priceListId', 'email', 'phone', 'department', 'creditLimit', 'creditDays', 'balance', 'status'];

const compareCustomerNames = (left: Customer, right: Customer) =>
  String(left.name || '').trim().localeCompare(String(right.name || '').trim(), 'es', { sensitivity: 'base' }) ||
  String(left.id).localeCompare(String(right.id));

const customerCodeNumber = (customer: Customer) => {
  const match = String(customer.code || '').match(/(\d+)(?!.*\d)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

const customerToDraft = (customer: Customer, fallbackCurrency: SupportedCurrency = 'NIO'): CustomerDraft => ({
  name: customer.name || '',
  type: String(customer.type || '').toUpperCase() === 'COMPANY' ? 'company' : 'individual',
  fiscalRegime: customer.fiscalRegime || '',
  priceListId: customer.priceListId || customer.priceList?.id || '',
  taxId: customer.taxId || '',
  ruc: customer.ruc || '',
  email: customer.email || '',
  phone: customer.phone || '',
  address: customer.address || '',
  city: customer.city || '',
  department: customer.department || '',
  country: customer.country || 'Nicaragua',
  creditLimit: customer.creditLimit === undefined || customer.creditLimit === null ? '' : String(customer.creditLimit),
  creditLimitCurrency: normalizeCurrency(customer.creditLimitCurrency, fallbackCurrency),
  creditDays: customer.creditDays === undefined || customer.creditDays === null ? '' : String(customer.creditDays),
  notes: customer.notes || '',
  status: String(customer.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
});

const FISCAL_REGIMES = ['Régimen Simplificado (Cuota Fija)', 'Régimen General'];

const CUSTOMERS_TOUR_STEPS: GuidedTourStep[] = [
  { target: '[data-tour="customers-title"]', title: 'Directorio de Clientes', description: 'Aquí administras los clientes, sus datos fiscales, ubicación, crédito, estado y lista de precios asignada.', placement: 'bottom' },
  { target: '[data-tour="sales-list-kpis"]', title: 'KPIs de clientes', description: 'Total Clientes, Particulares y Empresas son filtros rápidos. Saldo es un indicador monetario para priorizar la cobranza; la tarjeta activa se refleja en la lista.', placement: 'bottom' },
  { target: '[data-tour="sales-list-actions"]', title: 'Búsqueda y filtros', description: 'Busca por nombre, identificación o contacto y combina el texto con Activos, Inactivos o Todos. Cambiar el filtro reinicia la paginación.', placement: 'bottom' },
  { target: '[data-tour="customers-columns"]', title: 'Configurar columnas', description: 'Elige qué campos se muestran en la tabla. La vista se ajusta automáticamente a las columnas seleccionadas.', placement: 'bottom' },
  { target: '[data-tour="customers-layout"]', title: 'Lista o tarjetas', description: 'Cambia entre una tabla para revisar muchos registros y tarjetas para consultar cada cliente de forma más visual.', placement: 'bottom' },
  { target: '[data-tour="customers-import"]', title: 'Importar clientes', description: 'Descarga la plantilla, completa los datos sin código de cliente y carga el archivo. La numeración la genera automáticamente el sistema.', tip: 'La importación de clientes puede repetirse. Primero se prepara el archivo y luego puedes abrir una previsualización editable.', placement: 'bottom' },
  { target: '[data-tour="customers-new"]', title: 'Crear clientes', description: 'Agrega uno o varios clientes desde el formulario. Para empresas el RUC es obligatorio; la cédula y el RUC pueden registrarse juntos.', placement: 'bottom' },
  { target: '[data-tour="customers-table"]', title: 'Consultar y gestionar', description: 'Abre el detalle desde Ver, edita los campos permitidos y cambia el estado con confirmación. Los clientes inactivos no se pueden usar en nuevas operaciones.', placement: 'top' },
  { target: '[data-tour="sales-list-pagination"]', title: 'Paginación', description: 'Elige 50, 100 o 200 clientes por página. El rango muestra qué registros estás viendo del total y las flechas permiten ir al inicio, anterior, siguiente o final.', placement: 'top' },
];

export function ClientesView({ data, loading, onRefresh, pagination, onSearchChange, isSidebarCollapsed = true }: ClientesViewProps) {
  const { baseCurrency, displayCurrency, displayMode, formatConvertedAmount, formatCurrentAmount, formatExplicitAmount } = useCurrency();
  const { canPerform, user } = useAuth();
  const tenantKey = user?.tenantId || 'anonymous';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<Customer | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'ALL' | 'INDIVIDUAL' | 'COMPANY'>('ALL');
  const [pendingStatusChange, setPendingStatusChange] = useState<Customer | null>(null);
  const [statusChanging, setStatusChanging] = useState(false);
  const [pendingBulkDeactivateIds, setPendingBulkDeactivateIds] = useState<(string | number)[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<CustomerImportRow[]>([]);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [importResult, setImportResult] = useState<CustomerImportResult | null>(null);
  const importValidationTimerRef = useRef<number | null>(null);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editCustomer, setEditCustomer] = useState<CustomerDraft>(() => emptyCustomerDraft(displayCurrency));
  const [savingEdit, setSavingEdit] = useState(false);
  const [columnConfigOpen, setColumnConfigOpen] = useState(false);
  const [visibleColumnKeys, setVisibleColumnKeys] = useLocalStorageState<string[]>(`sales-clients-columns-${tenantKey}`, DEFAULT_CUSTOMER_COLUMN_KEYS, 24 * 365);
  const [creating, setCreating] = useState(false);
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('sales-clients-layout', 'table', 24 * 365);
  const [newCustomer, setNewCustomer] = useState<CustomerDraft>(() => emptyCustomerDraft(displayCurrency));
  const [pendingCustomers, setPendingCustomers] = useState<Array<CustomerDraft & { id: string }>>([]);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => () => {
    if (importValidationTimerRef.current !== null) window.clearTimeout(importValidationTimerRef.current);
  }, []);

  useEffect(() => {
    priceListsService.getAll().then((response: any) => setPriceLists(Array.isArray(response) ? response : (response?.data || []))).catch(() => setPriceLists([]));
  }, []);

  const normalizeHeader = (value: unknown) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_/-]+/g, '');
  const getCell = (row: Record<string, any>, aliases: string[]) => {
    const match = aliases.map(normalizeHeader).find((alias) => Object.prototype.hasOwnProperty.call(row, alias));
    return match ? row[match] : '';
  };

  const emptyImportRow = (): CustomerImportRow => ({ name: '', type: 'INDIVIDUAL', fiscalRegime: '', priceListCode: '', taxId: '', ruc: '', email: '', phone: '', address: '', city: '', department: '', country: 'Nicaragua', creditLimit: '', creditLimitCurrency: displayCurrency, status: 'ACTIVE', notes: '' });

  const validateImportRows = (rows: CustomerImportRow[]) => {
    const existingTaxIds = new Set(data.flatMap((customer) => [customer.taxId, customer.ruc]).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean));
    const seenTaxIds = new Set<string>();
    return rows.map((row) => {
      const next: CustomerImportRow = { ...row, error: undefined, warning: undefined };
      const identifiers = [row.taxId, row.ruc].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
      const priceListMatch = row.priceListCode && priceLists.some((list) => list.code.toLowerCase() === row.priceListCode.trim().toLowerCase() || list.name.toLowerCase() === row.priceListCode.trim().toLowerCase());
      if (!row.name.trim()) next.error = 'Nombre obligatorio';
      else if (identifiers.some((identifier) => existingTaxIds.has(identifier) || seenTaxIds.has(identifier))) next.error = 'Cédula o RUC duplicado';
      else if (row.type === 'COMPANY' && !row.ruc.trim()) next.error = 'RUC obligatorio para empresas';
      else if (row.creditLimit !== '' && (!Number.isFinite(Number(row.creditLimit)) || Number(row.creditLimit) < 0)) next.error = 'Límite de crédito inválido';
      else if (row.creditLimitCurrencyError || !['NIO', 'USD'].includes(row.creditLimitCurrency)) next.error = 'Moneda del límite inválida';
      if (!next.error && row.priceListCode && !priceListMatch) next.warning = 'Lista no encontrada; se importará sin lista';
      identifiers.forEach((identifier) => { seenTaxIds.add(identifier); existingTaxIds.add(identifier); });
      return next;
    });
  };

  const downloadTemplate = async () => {
    let availablePriceLists = priceLists;
    try {
      const response: any = await priceListsService.getAll();
      availablePriceLists = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : priceLists);
      setPriceLists(availablePriceLists);
    } catch {
      // La plantilla todavía puede generarse con el último catálogo cargado.
    }
    const importablePriceLists = availablePriceLists.filter((list) => list.isActive !== false);
    const headers = ['Nombre', 'Tipo', 'Cédula', 'RUC', 'Correo', 'Teléfono', 'Dirección', 'Ciudad', 'Departamento', 'País', 'Régimen fiscal', 'Límite de crédito', 'Moneda límite de crédito', 'Lista de precios', 'Estado', 'Notas'];
    const example = ['Cliente Ejemplo', 'PARTICULAR', '001-010190-1000A', '', 'cliente@correo.com', '8888-8888', 'Del parque central 2 cuadras al sur', 'Managua', 'Managua', 'Nicaragua', 'Régimen general', 0, displayCurrency, importablePriceLists[0]?.code || '', 'ACTIVO', ''];
    const sheet = XLSX.utils.aoa_to_sheet([headers, example]);
    sheet['!cols'] = headers.map((header) => ({ wch: Math.max(16, Math.min(30, header.length + 4)) }));
    const guideRows: any[][] = [
      ['GUÍA DE LLENADO · IMPORTACIÓN DE CLIENTES'],
      ['La importación puede ejecutarse varias veces. Cada cliente válido recibirá un número automático del sistema. No agregues código o número de cliente.'],
      ['Campo', 'Regla'],
      ['Nombre', 'Obligatorio. Identifica a la persona natural o jurídica.'],
      ['Tipo', 'Usa PARTICULAR para una persona o EMPRESA para una empresa. Si eliges empresa, el RUC es obligatorio.'],
      ['Cédula y RUC', 'La Cédula identifica a un particular. El RUC es obligatorio para una empresa.'],
      ['Contacto y ubicación', 'Completa correo, teléfono, dirección, ciudad, departamento y país cuando aplique.'],
      ['Régimen fiscal', 'Opcional. Ejemplo: Régimen general, cuota fija o exento.'],
      ['Lista de precios', 'Opcional. Usa el código o nombre de una lista existente. Si no existe, se mostrará un aviso y se importará sin asignación.'],
      ['Límite de crédito', 'Opcional. Usa un número mayor o igual a cero. El importe se guarda en la moneda indicada en la columna Moneda límite de crédito.'],
      ['Moneda límite de crédito', `Obligatoria si capturas un límite. Usa NIO o USD. Si el archivo no trae esta columna, se usará ${displayCurrency}, la moneda seleccionada arriba al preparar la importación.`],
      ['Estado', 'Usa ACTIVO o INACTIVO. Los clientes inactivos no podrán utilizarse en nuevas operaciones.'],
      ['Previsualización', 'Después de cargar el archivo, abre la previsualización para corregir datos. Los errores se omiten; los avisos no bloquean la importación.'],
      [],
      ['LISTAS DE PRECIOS DISPONIBLES', 'Estas son las listas activas al momento de descargar esta plantilla. Puedes usar el código o el nombre en la columna Lista de precios.'],
      ['Código', 'Nombre'],
      ...(importablePriceLists.length ? importablePriceLists.map((list) => [list.code, list.name]) : [['—', 'No hay listas de precios activas registradas.']]),
    ];
    const guide = XLSX.utils.aoa_to_sheet(guideRows);
    guide['!cols'] = [{ wch: 28 }, { wch: 110 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Clientes');
    XLSX.utils.book_append_sheet(workbook, guide, 'Guía de llenado');
    XLSX.writeFile(workbook, 'plantilla_clientes.xlsx');
    toast.success('Plantilla descargada');
  };

  const readImportFile = async (file: File) => {
    setPreviewLoading(true);
    setPreviewProgress(3);
    try {
      if (!/\.(xlsx|xls)$/i.test(file.name)) {
        throw new Error('Solo se permiten archivos Excel (.xlsx o .xls)');
      }
      const { rows: raw } = await parseSpreadsheetInWorker(file, 'clientes', false, (progress) => {
        setPreviewProgress(Math.min(84, Math.max(3, progress)));
      });
      setPreviewProgress(88);
      if (raw.length < 2) throw new Error('El archivo no contiene filas para importar');
      const headers = (raw[0] || []).map(normalizeHeader);
      const parsed = raw.slice(1).filter((row: any[]) => row.some((cell) => String(cell ?? '').trim())).map((values: any[]) => {
        const source: Record<string, any> = {};
        headers.forEach((header: string, index: number) => { source[header] = values[index] ?? ''; });
        const row = emptyImportRow();
        row.name = String(getCell(source, ['nombre', 'name', 'cliente']) || '').trim();
        const type = normalizeHeader(getCell(source, ['tipo', 'type']) || 'particular');
        row.type = type.includes('company') || type.includes('empresa') || type.includes('juridica') ? 'COMPANY' : 'INDIVIDUAL';
        row.fiscalRegime = String(getCell(source, ['regimenfiscal', 'regimen', 'fiscalregime']) || '').trim();
        const priceListValue = String(getCell(source, ['listadeprecios', 'lista', 'priceList', 'priceListCode']) || '').trim();
        row.priceListCode = priceLists.find((list) => list.code.toLowerCase() === priceListValue.toLowerCase() || list.name.toLowerCase() === priceListValue.toLowerCase())?.code || priceListValue;
        row.taxId = String(getCell(source, ['cedula', 'identificacionfiscal', 'identificacion', 'taxid']) || '').trim();
        row.ruc = String(getCell(source, ['ruc']) || '').trim();
        row.email = String(getCell(source, ['correo', 'email']) || '').trim();
        row.phone = String(getCell(source, ['telefono', 'phone']) || '').trim();
        row.address = String(getCell(source, ['direccion', 'address']) || '').trim();
        row.city = String(getCell(source, ['ciudad', 'city']) || '').trim();
        row.department = String(getCell(source, ['departamento', 'department']) || '').trim();
        row.country = String(getCell(source, ['pais', 'country']) || 'Nicaragua').trim();
        const creditLimit = getCell(source, ['limitedecredito', 'creditlimit', 'limite']);
        row.creditLimit = creditLimit === '' || creditLimit === undefined ? '' : Number(creditLimit);
        const creditLimitCurrency = String(getCell(source, ['monedalimitedecredito', 'creditlimitcurrency', 'monedalimite', 'monedalimit']))
          .trim().toUpperCase();
        if (creditLimitCurrency) {
          const acceptedCreditLimitCurrencies = ['NIO', 'USD', 'US$', '$', 'C$', 'CORDOBA', 'CORDOBAS'];
          row.creditLimitCurrency = creditLimitCurrency === 'USD' || creditLimitCurrency === 'US$' || creditLimitCurrency === '$' ? 'USD' : creditLimitCurrency === 'NIO' || creditLimitCurrency === 'C$' || creditLimitCurrency === 'CORDOBA' || creditLimitCurrency === 'CORDOBAS' ? 'NIO' : displayCurrency;
          if (!acceptedCreditLimitCurrencies.includes(creditLimitCurrency)) row.creditLimitCurrencyError = true;
        }
        const status = normalizeHeader(getCell(source, ['estado', 'status']) || 'activo');
        row.status = status.includes('inactiv') ? 'INACTIVE' : 'ACTIVE';
        row.notes = String(getCell(source, ['notas', 'notes', 'observaciones']) || '').trim();
        return row;
      });
      setPreviewProgress(94);
      setImportFile(file);
      setImportRows(validateImportRows(parsed));
      setPreviewProgress(100);
      setImportResult(null);
      toast.success(`${parsed.length} clientes listos para previsualizar`);
    } catch (error: any) {
      setImportFile(null);
      setImportRows([]);
      toast.error(error?.message || 'No se pudo leer el archivo');
    } finally {
      setPreviewLoading(false);
      setPreviewProgress(0);
    }
  };

  const handleOpenImportPreview = () => {
    if (!importFile || !importRows.length || previewLoading) return;
    setImportOpen(false);
    setImportPreviewOpen(true);
  };

  const updateImportRow = (index: number, field: keyof CustomerImportRow, value: string) => {
    setImportRows((current) => current.map((row, rowIndex) => rowIndex === index ? {
      ...row,
      [field]: field === 'creditLimit' ? (value === '' ? '' : Number(value)) : value,
      ...(field === 'creditLimitCurrency' ? { creditLimitCurrencyError: undefined } : {}),
    } : row));
    if (importValidationTimerRef.current !== null) window.clearTimeout(importValidationTimerRef.current);
    importValidationTimerRef.current = window.setTimeout(() => {
      setImportRows((current) => validateImportRows(current));
      importValidationTimerRef.current = null;
    }, 260);
  };

  const executeImport = async () => {
    const validRows = importRows.filter((row) => !row.error);
    if (!validRows.length) return;
    setImporting(true);
    setImportProgress(10);
    setImportResult(null);
    try {
      const result = await customersService.importMassive({
        rows: validRows.map(({ error: _error, warning: _warning, creditLimitCurrencyError: _currencyError, ...row }) => ({
          ...row,
          type: row.type === 'COMPANY' ? 'company' : 'individual',
          creditLimit: row.creditLimit === '' ? undefined : row.creditLimit,
          creditLimitCurrency: row.creditLimitCurrency,
        })),
      });
      setImportProgress(90);
      setImportResult(result);
      // No mantengas bloqueada la previsualización esperando el refresco de
      // todo el módulo; la consulta puede terminar en segundo plano.
      void onRefresh();
      setImportProgress(100);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo importar clientes');
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const finishImport = () => {
    setImportResult(null);
    setImportPreviewOpen(false);
    setImportRows([]);
    setImportFile(null);
  };

  const filtered = data.filter(c => {
    const search = searchTerm.toLowerCase();
    const customerStatus = String(c.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (statusFilter !== 'ALL' && customerStatus !== statusFilter) return false;
    if (customerTypeFilter !== 'ALL' && String(c.type || '').toUpperCase() !== customerTypeFilter) return false;
    return (
      String(c.name || '').toLowerCase().includes(search) || 
      (c.email || '').toLowerCase().includes(search) ||
      (c.code || '').toLowerCase().includes(search) ||
      (c.phone || '').toLowerCase().includes(search)
    );
  });

  const colFilters = useColumnFilters();
  const filteredAndSorted = [...filtered].sort(compareCustomerNames);
  const filterGetters = {
    code: (row: Customer) => customerCodeNumber(row),
    name: (row: Customer) => {
      return row.name || '';
    },
    type: (row: Customer) => String(row.type || '').toUpperCase(),
  };
  const filteredData = colFilters.applyTo(filteredAndSorted, filterGetters);
  const typeOptions = [
    { value: 'INDIVIDUAL', label: 'Particular', count: filtered.filter((c) => String(c.type || '').toUpperCase() === 'INDIVIDUAL').length },
    { value: 'COMPANY', label: 'Empresa', count: filtered.filter((c) => String(c.type || '').toUpperCase() === 'COMPANY').length },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Customer>) => {
    try {
      const effectiveUpdates = updates.creditLimit !== undefined && updates.creditLimitCurrency === undefined
        ? { ...updates, creditLimitCurrency: displayCurrency }
        : updates;
      if (updates.email !== undefined && String(updates.email || '').trim() && !/^\S+@\S+\.\S+$/.test(String(updates.email).trim())) {
        throw new Error('El correo no es válido (ej. cliente@correo.com)');
      }
      if (updates.phone !== undefined && String(updates.phone || '').trim() && !/^[+\d][\d\s()-]{6,}$/.test(String(updates.phone).trim())) {
        throw new Error('El teléfono debe contener al menos 7 dígitos (ej. 8888-8888)');
      }
      if (updates.creditLimit !== undefined) {
        const limit = Number(updates.creditLimit);
        if (!Number.isFinite(limit) || limit < 0) throw new Error('El límite de crédito debe ser un número mayor o igual a cero');
      }
      if (effectiveUpdates.creditLimitCurrency !== undefined && !['NIO', 'USD'].includes(String(effectiveUpdates.creditLimitCurrency).toUpperCase())) {
        throw new Error('La moneda del límite de crédito debe ser NIO o USD');
      }
      if (updates.creditDays !== undefined) {
        const days = Number(updates.creditDays);
        if (!Number.isFinite(days) || days < 0 || !Number.isInteger(days)) throw new Error('El plazo de crédito debe ser un número entero de días (0 = contado)');
      }
      if (updates.taxId !== undefined && String(updates.taxId || '').trim() && !/^[A-Za-z0-9-]{8,}$/.test(String(updates.taxId).trim())) {
        throw new Error('La cédula debe contener entre 8 y 16 caracteres alfanuméricos (ej. 001-010190-1000A)');
      }
      const currentCustomer = data.find((customer) => String(customer.id) === String(id));
      const nextType = String(updates.type ?? currentCustomer?.type ?? '').toUpperCase();
      const nextRuc = String(updates.ruc ?? currentCustomer?.ruc ?? '').trim();
      const nextIdentifiers = [updates.taxId ?? currentCustomer?.taxId, updates.ruc ?? currentCustomer?.ruc]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean);
      const duplicateCustomer = data.find((customer) => {
        if (String(customer.id) === String(id)) return false;
        const customerIdentifiers = [customer.taxId, customer.ruc]
          .map((value) => String(value || '').trim().toLowerCase())
          .filter(Boolean);
        return nextIdentifiers.some((identifier) => customerIdentifiers.includes(identifier));
      });
      if (duplicateCustomer) {
        throw new Error(`La cédula o el RUC ya está registrado en el cliente ${duplicateCustomer.name}.`);
      }
      if (nextType === 'COMPANY' && !nextRuc) {
        throw new Error('El RUC es obligatorio para una empresa');
      }
      await customersService.update(id.toString(), effectiveUpdates);
      toast.success('Cliente actualizado correctamente');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar cliente');
      throw e;
    }
  };

  const buildCustomerPayload = (draft: CustomerDraft): Partial<Customer> => ({
    name: draft.name.trim(),
    type: draft.type,
    fiscalRegime: draft.fiscalRegime.trim() || undefined,
    priceListId: draft.priceListId || undefined,
    taxId: draft.taxId.trim() || undefined,
    ruc: draft.ruc.trim() || undefined,
    email: draft.email.trim() || undefined,
    phone: draft.phone.trim() || undefined,
    address: draft.address.trim() || undefined,
    city: draft.city.trim() || undefined,
    department: draft.department.trim() || undefined,
    country: draft.country.trim() || undefined,
    creditLimit: draft.creditLimit === '' ? undefined : Number(draft.creditLimit),
    creditLimitCurrency: draft.creditLimitCurrency,
    creditDays: draft.creditDays === '' ? undefined : Number(draft.creditDays),
    notes: draft.notes.trim() || undefined,
    status: draft.status,
  });

  const validateCustomerDraft = (draft: CustomerDraft, excludeCustomerId?: string) => {
    if (!draft.name.trim()) {
      toast.error('El nombre del cliente es obligatorio');
      return false;
    }
    if (draft.email.trim() && !/^\S+@\S+\.\S+$/.test(draft.email.trim())) {
      toast.error('El correo del cliente no es válido');
      return false;
    }
    if (draft.type === 'company' && !draft.ruc.trim()) {
      toast.error('El RUC es obligatorio para una empresa');
      return false;
    }
    const identifiers = [draft.taxId, draft.ruc].map((value) => value.trim().toLowerCase()).filter(Boolean);
    const duplicateCustomer = data.find((customer) => {
      if (excludeCustomerId && String(customer.id) === String(excludeCustomerId)) return false;
      const customerIdentifiers = [customer.taxId, customer.ruc]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean);
      return identifiers.some((identifier) => customerIdentifiers.includes(identifier));
    });
    if (duplicateCustomer) {
      toast.error(`La cédula o el RUC ya está registrado en el cliente ${duplicateCustomer.name}.`);
      return false;
    }
    if (draft.creditLimit !== '' && (!Number.isFinite(Number(draft.creditLimit)) || Number(draft.creditLimit) < 0)) {
      toast.error('El límite de crédito debe ser un número mayor o igual a cero');
      return false;
    }
    if (!['NIO', 'USD'].includes(draft.creditLimitCurrency)) {
      toast.error('La moneda del límite de crédito debe ser NIO o USD');
      return false;
    }
    if (draft.creditDays !== '' && (!Number.isFinite(Number(draft.creditDays)) || Number(draft.creditDays) < 0 || !Number.isInteger(Number(draft.creditDays)))) {
      toast.error('El plazo de crédito debe ser un número entero de días (0 = contado)');
      return false;
    }
    return true;
  };

  const openEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditCustomer(customerToDraft(customer, displayCurrency));
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingCustomer || !validateCustomerDraft(editCustomer, editingCustomer.id)) return;
    setSavingEdit(true);
    try {
      await handleUpdate(editingCustomer.id, buildCustomerPayload(editCustomer));
      setEditOpen(false);
      setEditingCustomer(null);
    } catch {
      // handleUpdate already displays the server or validation error.
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddPendingCustomer = () => {
    if (!validateCustomerDraft(newCustomer)) return;
    setPendingCustomers((current) => [...current, { ...newCustomer, id: `draft-${Date.now()}-${current.length}` }]);
    setNewCustomer(emptyCustomerDraft(displayCurrency));
    toast.success('Cliente agregado a la lista de espera');
  };

  const handleCreateClient = async () => {
    if (!validateCustomerDraft(newCustomer)) return;
    setCreating(true);
    try {
      await customersService.create(buildCustomerPayload(newCustomer));
      toast.success('Nuevo cliente creado');
      setNewCustomer(emptyCustomerDraft(displayCurrency));
      if (pendingCustomers.length === 0) setCreateOpen(false);
      onRefresh();
    } catch (e: any) {
      console.error('Error creating customer:', e);
      toast.error(e?.response?.data?.message || e?.message || 'Error al crear cliente');
    } finally {
      setCreating(false);
    }
  };

  const handleSavePendingCustomers = async () => {
    if (!pendingCustomers.length) return;
    setCreating(true);
    try {
      const result = await Promise.allSettled(pendingCustomers.map(({ id: _id, ...draft }) => customersService.create(buildCustomerPayload(draft))));
      const created = result.filter((item) => item.status === 'fulfilled').length;
      const failed = result.length - created;
      if (failed) toast.warning(`${created} clientes guardados y ${failed} no se pudieron guardar`);
      else toast.success(`${created} clientes guardados correctamente`);
      setPendingCustomers([]);
      setNewCustomer(emptyCustomerDraft(displayCurrency));
      setCreateOpen(false);
      onRefresh();
    } finally {
      setCreating(false);
    }
  };

  if (importPreviewOpen) {
    return <CustomerImportPreview rows={importRows} fileName={importFile?.name || ''} priceLists={priceLists} defaultCreditLimitCurrency={displayCurrency} isSidebarCollapsed={isSidebarCollapsed} importing={importing} progress={importProgress} result={importResult} onRowUpdate={updateImportRow} onBack={() => { setImportPreviewOpen(false); setImportOpen(true); }} onConfirm={executeImport} onDone={finishImport} />;
  }

  const renderCustomerAmount = (
    breakdown: Array<{ currency: string; amount: number }> | undefined,
    fallback: number,
  ) => {
    if (displayMode === 'ORIGINAL' && breakdown?.length) {
      return breakdown.map((item) => (
        <span key={item.currency} className="ml-2 inline-block">
          {formatExplicitAmount(Number(item.amount || 0), normalizeCurrency(item.currency, baseCurrency) as SupportedCurrency)}
        </span>
      ));
    }
    return formatConvertedAmount(fallback, baseCurrency);
  };

  const columns: ColumnDef<Customer>[] = [
    { 
      key: 'code', 
      header: 'ID / Código',
      width: '110px',
      headerExtra: <ColumnFilterMenu label="Código" sort={colFilters.state.code?.sort || null} onSort={(sort) => colFilters.setSort('code', sort)} sortType="number" />,
      render: (val, row) => <span className="text-[11px] font-black font-mono text-muted-foreground/60">{val || row.id.slice(0, 8)}</span>
    },
    { 
      key: 'name', 
      header: 'Nombre del Cliente', 
      width: '220px',
      editable: canPerform('SALES_CLIENTS', 'edit'),
      headerExtra: <ColumnFilterMenu label="Nombre" options={[{ value: '__empty__', label: 'Sin nombre' }]} selected={colFilters.state.name?.values || []} onSelect={(values) => colFilters.setValues('name', values)} sort={colFilters.state.name?.sort || null} onSort={(sort) => colFilters.setSort('name', sort)} sortOptions={[{ value: 'asc', label: 'A → Z (alfabético)' }, { value: 'desc', label: 'Z → A (alfabético inverso)' }]} />,
      render: (val) => <span className="text-[13px] font-bold text-foreground">{val || 'Sin nombre'}</span>
    },
    { 
      key: 'type', 
      header: 'Tipo', 
      width: '110px',
      editable: canPerform('SALES_CLIENTS', 'edit'),
      type: 'select',
      headerExtra: <ColumnFilterMenu label="Tipo" options={typeOptions} selected={colFilters.state.type?.values || []} onSelect={(values) => colFilters.setValues('type', values)} sort={colFilters.state.type?.sort || null} onSort={(sort) => colFilters.setSort('type', sort)} />,
      options: [
        { label: 'Particular', value: 'INDIVIDUAL', color: 'bg-primary/10 text-primary' },
        { label: 'Empresa', value: 'COMPANY', color: 'bg-primary/10 text-primary' }
      ],
      render: (val) => (
        <Badge variant="outline" className={cn(
          "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none",
          'bg-primary/10 text-primary'
        )}>
          {(val || '').toUpperCase() === 'COMPANY' ? 'Empresa' : 'Particular'}
        </Badge>
      )
    },
    {
      key: 'taxId',
      header: 'Cédula',
      width: '130px',
      editable: canPerform('SALES_CLIENTS', 'edit'),
      render: (val) => <span className="font-mono text-xs text-muted-foreground">{val || '—'}</span>,
    },
    {
      key: 'ruc',
      header: 'RUC',
      width: '130px',
      editable: canPerform('SALES_CLIENTS', 'edit'),
      render: (val) => <span className="font-mono text-xs text-muted-foreground">{val || '—'}</span>,
    },
    {
      key: 'fiscalRegime',
      header: 'Régimen fiscal',
      width: '150px',
      editable: canPerform('SALES_CLIENTS', 'edit'),
      render: (val) => <span className="text-xs text-muted-foreground">{val || '—'}</span>,
    },
    {
      key: 'priceListId',
      header: 'Lista de precios',
      width: '165px',
      editable: canPerform('SALES_CLIENTS', 'edit'),
      type: 'select',
      options: [
        { label: 'Sin lista asignada', value: '' },
        ...priceLists
          .filter((list) => list.isActive !== false)
          .map((list) => ({ label: list.name, value: list.id })),
      ],
      render: (_val, row) => <span className="text-xs font-bold text-primary">{row.priceList?.name || 'Sin asignar'}</span>,
    },
    { key: 'email', header: 'Correo', width: '185px', editable: canPerform('SALES_CLIENTS', 'edit') },
    { key: 'phone', header: 'Teléfono', width: '130px', editable: canPerform('SALES_CLIENTS', 'edit') },
    { key: 'department', header: 'Departamento', width: '150px', editable: canPerform('SALES_CLIENTS', 'edit') },
    { key: 'creditLimit', header: 'Límite de crédito', width: '160px', editable: canPerform('SALES_CLIENTS', 'edit'), type: 'number', render: (val, row) => <span className="text-xs font-bold tabular-nums">{formatCurrentAmount(Number(val || 0), normalizeCurrency(row.creditLimitCurrency, baseCurrency))} <span className="text-[9px] font-black text-muted-foreground">({normalizeCurrency(row.creditLimitCurrency, baseCurrency)})</span></span> },
    { key: 'creditDays', header: 'Plazo crédito', width: '110px', editable: canPerform('SALES_CLIENTS', 'edit'), type: 'number', render: (val) => <span className="cell-nowrap text-xs font-bold tabular-nums">{(val ?? 0) === 0 || val == null ? 'Contado' : `${val} días`}</span> },
    {
      key: 'balance',
      header: 'Saldos del cliente',
      width: '200px',
      render: (_val, row) => {
        const debt = getCustomerDebtAmount(row);
        const favor = getCustomerFavorAmount(row);
        if (debt <= 0.005 && favor <= 0.005) {
          return <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Saldo al día</span>;
        }
        return (
          <div className="min-w-[11rem] space-y-1 leading-tight">
            {debt > 0.005 && <div className="flex items-center justify-between gap-3"><span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Pendiente</span><span className="text-[12px] font-black tabular-nums text-rose-600 dark:text-rose-400">{renderCustomerAmount(row.balanceDueOriginalCurrencyBreakdown, debt)}</span></div>}
            {favor > 0.005 && <div className="flex items-center justify-between gap-3"><span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">A favor</span><span className="text-[12px] font-black tabular-nums text-emerald-600 dark:text-emerald-400">{renderCustomerAmount(row.balanceFavorOriginalCurrencyBreakdown, favor)}</span></div>}
          </div>
        );
      },
    },
    { 
      key: 'status', 
      header: 'Estado', 
      width: '110px',
      editable: canPerform('SALES_CLIENTS', 'edit'),
      type: 'select',
      options: [
        { label: 'Activo', value: 'ACTIVE', color: 'bg-emerald-500/10 text-emerald-500' },
        { label: 'Inactivo', value: 'INACTIVE', color: 'bg-primary/10 text-primary' }
      ],
      render: (val) => (
        <Badge variant="outline" className={cn(
          "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none",
          (val || '').toUpperCase() === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'
        )}>
          {(val || '').toUpperCase() === 'ACTIVE' ? 'Activo' : 'Inactivo'}
        </Badge>
      )
    }
  ];

  const visibleColumns = columns.filter((column) => visibleColumnKeys.includes(String(column.key)));
  const totalDue = data.reduce((acc, customer) => acc + getCustomerDebtAmount(customer), 0);
  const totalDueBreakdown = summarizeAmountsByCurrency(
    data.flatMap((customer) => customer.balanceDueOriginalCurrencyBreakdown || []),
    (item) => Number(item.amount || 0),
    (item) => item.currency,
  );
  const dueBreakdown = totalDueBreakdown.length
    ? totalDueBreakdown
    : [{ currency: baseCurrency as SupportedCurrency, amount: totalDue, count: 0 }];
  const dueKpis = displayMode === 'ORIGINAL'
    ? dueBreakdown.map((item) => ({
      title: `Cartera pendiente (${item.currency})`,
      value: formatExplicitAmount(item.amount, normalizeCurrency(item.currency, baseCurrency) as SupportedCurrency),
    }))
    : [{ title: 'Cartera pendiente', value: formatConvertedAmount(totalDue, baseCurrency) }];
  const columnOptions = [
    { key: 'code', label: 'Código' },
    { key: 'name', label: 'Nombre' },
    { key: 'taxId', label: 'Cédula' },
    { key: 'ruc', label: 'RUC' },
    { key: 'type', label: 'Tipo' },
    { key: 'fiscalRegime', label: 'Régimen fiscal' },
    { key: 'priceListId', label: 'Lista de precios' },
    { key: 'email', label: 'Correo' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'department', label: 'Departamento' },
    { key: 'creditLimit', label: 'Límite de crédito' },
    { key: 'creditDays', label: 'Plazo crédito' },
    { key: 'balance', label: 'Saldos del cliente' },
    { key: 'status', label: 'Estado' },
  ];
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* KPIs Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="sales-list-kpis">
        <SalesKpiCard title="Total Clientes" value={data.length} icon={Users} color="text-primary" bg="bg-primary/10" kind="filter" active={customerTypeFilter === 'ALL' && statusFilter === 'ALL'} onClick={() => { setCustomerTypeFilter('ALL'); setStatusFilter('ALL'); }} />
        <SalesKpiCard title="Particulares" value={data.filter(c => (c.type || '').toUpperCase() === 'INDIVIDUAL').length} icon={Users} color="text-primary" bg="bg-primary/10" active={customerTypeFilter === 'INDIVIDUAL'} onClick={() => setCustomerTypeFilter(customerTypeFilter === 'INDIVIDUAL' ? 'ALL' : 'INDIVIDUAL')} />
        <SalesKpiCard title="Empresas" value={data.filter(c => (c.type || '').toUpperCase() === 'COMPANY').length} icon={CheckCircle2} color="text-primary" bg="bg-primary/10" active={customerTypeFilter === 'COMPANY'} onClick={() => setCustomerTypeFilter(customerTypeFilter === 'COMPANY' ? 'ALL' : 'COMPANY')} />
        {dueKpis.map((kpi) => <SalesKpiCard key={kpi.title} title={kpi.title} value={kpi.value} icon={CreditCard} color="text-rose-500" bg="bg-rose-500/10" />)}
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-3 py-2 lg:flex-row lg:items-center lg:justify-between" data-tour="sales-list-actions">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black uppercase tracking-tight text-foreground" data-tour="customers-title">Directorio de Clientes</h2>
          </div>
          <div className="erp-list-toolbar flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input 
                placeholder="Buscar cliente..." 
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold tracking-widest"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }}
              />
            </div>
            <Select value={statusFilter} onValueChange={(nextValue) => setStatusFilter(nextValue as 'ALL' | 'ACTIVE' | 'INACTIVE')}>
              <SelectTrigger aria-label="Filtrar clientes por estado" className="erp-filter-select h-10 min-w-[7.5rem] rounded-xl border border-border/50 bg-background/50 px-3 text-xs font-bold uppercase tracking-widest outline-none focus:border-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="ACTIVE">Activos</SelectItem>
                <SelectItem value="INACTIVE">Inactivos</SelectItem>
                <SelectItem value="ALL">Todos</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setShowTutorial(true)}
              className="h-10 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest"
            >
              <CircleHelp className="mr-2 size-4" /> Cómo gestionar clientes
            </Button>
            <Button
              variant="outline"
              onClick={() => setColumnConfigOpen(true)}
              data-tour="customers-columns"
              className="h-10 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest"
            >
              <Settings2 className="mr-2 size-4" /> Columnas <span className="ml-1 text-muted-foreground">{visibleColumns.length}</span>
            </Button>
            <ViewLayoutSelect value={layoutMode} onChange={(value) => setLayoutMode(value === 'kanban' ? 'table' : value)} ariaLabel="Elegir distribución" dataTour="customers-layout" />
            {canPerform('SALES_CLIENTS', 'create') && (
              <Button
                variant="outline"
                onClick={() => { setImportOpen(true); setImportResult(null); }}
                data-tour="customers-import"
                className="font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"
              >
                <Upload className="size-4" /> Importar
              </Button>
            )}
            {canPerform('SALES_CLIENTS', 'create') && (
              <Button 
                onClick={() => { setNewCustomer(emptyCustomerDraft(displayCurrency)); setCreateOpen(true); }}
                data-toolbar-role="primary"
                data-tour="customers-new"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20"
              >
                <UserPlus className="size-4" /> Nuevo Cliente
              </Button>
            )}
          </div>
        </div>

        <Card className="min-w-0 overflow-hidden rounded-2xl border-border/50 bg-card/40 shadow-sm" data-tour="customers-table">
          <CardContent className="min-w-0 p-1.5 sm:p-3">
            <EditableDataTable
              data={filteredData}
              columns={visibleColumns}
              onRowUpdate={handleUpdate}
              onRowClick={(row) => setSelectedCustomerDetail(row)}
              onRowDoubleClick={(row) => openEditCustomer(row)}
              editOnPencilOnly
              isLoading={loading}
              pagination={pagination}
              showClearSelection={false}
              actionsWidth="w-28"
              fitContent
              layoutMode={layoutMode}
              showHorizontalControls
              actions={(row) => (
                <div className="flex items-center gap-1">
                   <Button variant="ghost" size="icon" title="Ver detalle" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setSelectedCustomerDetail(row)}><Eye className="size-4" /></Button>
                   {canPerform('SALES_CLIENTS', 'edit') && (
                     <Button variant="ghost" size="icon" title="Editar cliente" aria-label="Editar cliente" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => openEditCustomer(row)}><Pencil className="size-4" /></Button>
                   )}
                   {canPerform('SALES_CLIENTS', 'edit') && (
                   <Button variant="ghost" size="icon" title={String(row.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'Activar cliente' : 'Inactivar cliente'} className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setPendingStatusChange(row)}><Ban className="size-4" /></Button>
                   )}
                </div>
              )}
              bulkActions={(selectedIds) => (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-[10px] font-black uppercase tracking-wider text-primary hover:bg-primary/10"
                  onClick={() => setPendingBulkDeactivateIds(selectedIds)}
                >
                  <Ban className="mr-2 size-3" /> Desactivar clientes
                </Button>
              )}
            />
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={pendingStatusChange !== null}
        onOpenChange={(open) => { if (!open && !statusChanging) setPendingStatusChange(null); }}
        title={pendingStatusChange && String(pendingStatusChange.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? '¿Activar cliente?' : '¿Inactivar cliente?'}
        description={pendingStatusChange && String(pendingStatusChange.status || 'ACTIVE').toUpperCase() === 'INACTIVE'
          ? `El cliente ${pendingStatusChange.name || ''} volverá a estar disponible en las operaciones.`
          : `El cliente ${pendingStatusChange?.name || ''} quedará inactivo y no estará disponible para nuevas operaciones.`}
        confirmLabel={pendingStatusChange && String(pendingStatusChange.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'Activar cliente' : 'Inactivar cliente'}
        variant={pendingStatusChange && String(pendingStatusChange.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'default' : 'destructive'}
        loading={statusChanging}
        onConfirm={async () => {
          if (!pendingStatusChange) return;
          const nextStatus = String(pendingStatusChange.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
          try {
            setStatusChanging(true);
            await handleUpdate(pendingStatusChange.id, { status: nextStatus } as Partial<Customer>);
            setPendingStatusChange(null);
          } finally {
            setStatusChanging(false);
          }
        }}
      />

      <ConfirmDialog
        open={pendingBulkDeactivateIds.length > 0}
        onOpenChange={(open) => { if (!open && !statusChanging) setPendingBulkDeactivateIds([]); }}
        title="¿Desactivar clientes seleccionados?"
        description={`Se desactivarán ${pendingBulkDeactivateIds.length} clientes y no estarán disponibles para nuevas operaciones.`}
        confirmLabel="Desactivar clientes"
        variant="destructive"
        loading={statusChanging}
        onConfirm={async () => {
          if (pendingBulkDeactivateIds.length === 0) return;
          try {
            setStatusChanging(true);
            await Promise.all(pendingBulkDeactivateIds.map((id) => handleUpdate(id, { status: 'INACTIVE' } as Partial<Customer>)));
            setPendingBulkDeactivateIds([]);
          } finally {
            setStatusChanging(false);
          }
        }}
      />

      <CustomerDetailDrawer
        customerId={selectedCustomerDetail?.id ?? null}
        onOpenChange={(open) => !open && setSelectedCustomerDetail(null)}
        customerSnapshot={selectedCustomerDetail}
      />

      <Dialog open={columnConfigOpen} onOpenChange={setColumnConfigOpen}>
        <DialogContent className="w-[calc(100%-2rem)] !max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings2 className="size-5 text-primary" /> Configurar columnas</DialogTitle>
            <DialogDescription>Elige qué información quieres ver. La tabla se ajustará automáticamente al espacio disponible y actualizará la vista al instante.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {columnOptions.map((option) => {
              const active = visibleColumnKeys.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setVisibleColumnKeys((current) => active ? (current.length > 1 ? current.filter((key) => key !== option.key) : current) : [...current, option.key])}
                  className={cn('flex min-h-11 items-center justify-between rounded-xl border px-3 text-left text-xs font-bold transition-colors', active ? 'border-primary bg-primary/10 text-foreground' : 'border-border/60 bg-muted/10 text-muted-foreground hover:border-primary/50')}
                >
                  <span>{option.label}</span>
                  {active && <Check className="size-4 text-primary" />}
                </button>
              );
            })}
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setVisibleColumnKeys(columnOptions.map((option) => option.key))}>Mostrar todas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={(open) => { if (!open && !creating) setCreateOpen(false); }}>
        <DialogContent className="!flex !max-h-[92vh] w-[calc(100vw-1rem)] !max-w-[min(94vw,1400px)] !flex-col overflow-hidden rounded-3xl p-0">
          <DialogHeader className="border-b border-border/40 px-5 py-5 sm:px-7" data-tour="sales-form-title">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Nuevo cliente</DialogTitle>
          <DialogDescription>Completa los datos del cliente y usa “Agregar a la lista” para preparar varios registros antes de guardarlos juntos.</DialogDescription>
            <SalesViewTutorial view="customers" context="form" />
          </DialogHeader>
          <div className="min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 sm:p-7" data-tour="sales-form-data">
            <div className="min-w-0 space-y-6">
              <section className="space-y-3">
                <div><h3 className="text-sm font-black uppercase tracking-widest">Identificación</h3><p className="text-xs text-muted-foreground">El número de cliente se genera automáticamente.</p></div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-2 xl:col-span-2"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre *</label><Input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder="Nombre del particular o empresa" className="h-11 rounded-xl" autoFocus /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo *</label><Select value={newCustomer.type} onValueChange={(value) => setNewCustomer({ ...newCustomer, type: value as CustomerDraft['type'] })}><SelectTrigger className="h-11 w-full rounded-xl border-border bg-background px-3 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="individual">Particular</SelectItem><SelectItem value="company">Empresa</SelectItem></SelectContent></Select></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cédula</label><Input value={newCustomer.taxId} onChange={(e) => setNewCustomer({ ...newCustomer, taxId: e.target.value })} placeholder="001-010190-1000A" className="h-11 rounded-xl" /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">RUC {String(newCustomer.type).toUpperCase() === 'COMPANY' && <span className="text-destructive">*</span>}</label><Input value={newCustomer.ruc} onChange={(e) => setNewCustomer({ ...newCustomer, ruc: e.target.value })} placeholder="J0310000000000" className="h-11 rounded-xl" /></div>
                </div>
              </section>
              <section className="space-y-3 border-t border-border/40 pt-5" data-tour="sales-form-summary">
                <div><h3 className="text-sm font-black uppercase tracking-widest">Contacto y ubicación</h3><p className="text-xs text-muted-foreground">Completa la información esencial del cliente.</p></div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Correo</label><Input type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} placeholder="correo@ejemplo.com" className="h-11 rounded-xl" /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Teléfono</label><Input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="8888-8888" className="h-11 rounded-xl" /></div>
                  <div className="space-y-1.5 xl:col-span-1"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dirección</label><Input value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} placeholder="Calle, número y referencias" className="h-11 rounded-xl" /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ciudad</label><Input value={newCustomer.city} onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })} placeholder="Ciudad" className="h-11 rounded-xl" /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Departamento</label><Input value={newCustomer.department} onChange={(e) => setNewCustomer({ ...newCustomer, department: e.target.value })} placeholder="Departamento" className="h-11 rounded-xl" /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">País</label><Input value={newCustomer.country} onChange={(e) => setNewCustomer({ ...newCustomer, country: e.target.value })} placeholder="País" className="h-11 rounded-xl" /></div>
                  <div className="space-y-1.5 xl:col-span-3"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notas</label><textarea value={newCustomer.notes} onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })} placeholder="Observaciones opcionales" className="min-h-20 w-full resize-y rounded-xl border border-foreground/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></div>
                </div>
              </section>
              <section className="space-y-3 border-t border-border/40 pt-5">
                <div><h3 className="text-sm font-black uppercase tracking-widest">Condiciones comerciales</h3><p className="text-xs text-muted-foreground">Estos cambios quedan registrados en el historial del cliente.</p></div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-1"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Régimen fiscal</label><Select value={newCustomer.fiscalRegime} onValueChange={(v) => setNewCustomer({ ...newCustomer, fiscalRegime: v })}><SelectTrigger className="h-11 rounded-xl text-sm"><SelectValue placeholder="Seleccionar régimen" /></SelectTrigger><SelectContent>{FISCAL_REGIMES.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5 sm:col-span-1"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Límite de crédito ({newCustomer.creditLimitCurrency})</label><Input type="number" min="0" value={newCustomer.creditLimit} onChange={(e) => setNewCustomer({ ...newCustomer, creditLimit: e.target.value })} placeholder="0.00" className="h-11 rounded-xl" /><p className="text-[10px] text-muted-foreground">Se guarda en la moneda seleccionada arriba.</p></div>
                  <div className="space-y-1.5 sm:col-span-1"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Plazo de crédito (días)</label><Input type="number" min="0" value={newCustomer.creditDays} onChange={(e) => setNewCustomer({ ...newCustomer, creditDays: e.target.value })} placeholder="0 = contado" className="h-11 rounded-xl" /></div>
                  <div className="space-y-1.5 sm:col-span-1"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lista de precios</label><Select value={newCustomer.priceListId || '__no_price_list__'} onValueChange={(value) => setNewCustomer({ ...newCustomer, priceListId: value === '__no_price_list__' ? '' : value })}><SelectTrigger className="h-11 w-full rounded-xl border-border bg-background px-3 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__no_price_list__">Sin lista asignada</SelectItem>{priceLists.map((list) => <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
              </section>
            </div>
            {pendingCustomers.length > 0 && (
              <aside className="min-w-0 rounded-2xl border border-border/50 bg-muted/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest">Clientes en lista de ingreso múltiple</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Registros preparados para guardarse juntos.</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{pendingCustomers.length}</Badge>
                </div>
                <div className="mt-4 max-h-[42vh] space-y-2 overflow-y-auto pr-1">
                  {pendingCustomers.map((customer, index) => <div key={customer.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-background/50 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{index + 1}. {customer.name}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{customer.taxId || customer.ruc || 'Sin identificación'} · {priceLists.find((list) => list.id === customer.priceListId)?.name || 'Sin lista asignada'} · Límite {customer.creditLimitCurrency}</p></div><Button variant="ghost" size="icon" title="Quitar de la lista" className="size-8 shrink-0 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => setPendingCustomers((current) => current.filter((item) => item.id !== customer.id))}><CircleX className="size-4" /></Button></div>)}
                </div>
              </aside>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 border-t border-border/40 px-5 py-4 sm:flex-row sm:flex-wrap sm:justify-between sm:px-7" data-tour="sales-form-actions">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating} className="w-full rounded-xl sm:w-auto">Cerrar</Button>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button variant="outline" onClick={handleAddPendingCustomer} disabled={creating || !newCustomer.name.trim()} className="w-full rounded-xl sm:w-auto">Agregar a la lista</Button>
              <Button variant="outline" onClick={handleCreateClient} disabled={creating || !newCustomer.name.trim()} className="w-full rounded-xl sm:w-auto">{creating ? 'Guardando...' : 'Guardar'}</Button>
              {pendingCustomers.length > 0 && <Button onClick={handleSavePendingCustomers} disabled={creating} className="w-full rounded-xl font-bold sm:w-auto">{creating ? 'Guardando...' : `Guardar ${pendingCustomers.length} clientes`}</Button>}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => { if (!open && !savingEdit) { setEditOpen(false); setEditingCustomer(null); } }}>
        <DialogContent className="!flex !max-h-[92vh] w-[calc(100vw-1rem)] !max-w-[min(94vw,1200px)] !flex-col overflow-hidden rounded-3xl p-0">
          <DialogHeader className="border-b border-border/40 px-5 py-5 sm:px-7">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Editar cliente</DialogTitle>
            <DialogDescription>Actualiza la información del cliente. La cédula y el RUC deben ser únicos en el sistema.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 sm:p-7">
            <section className="space-y-3">
              <div><h3 className="text-sm font-black uppercase tracking-widest">Identificación</h3><p className="text-xs text-muted-foreground">El código del cliente no se puede modificar.</p></div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre *</label><Input value={editCustomer.name} onChange={(e) => setEditCustomer({ ...editCustomer, name: e.target.value })} placeholder="Nombre del particular o empresa" className="h-11 rounded-xl" autoFocus /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo *</label><Select value={editCustomer.type} onValueChange={(value) => setEditCustomer({ ...editCustomer, type: value as CustomerDraft['type'] })}><SelectTrigger className="h-11 w-full rounded-xl border-border bg-background px-3 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="individual">Particular</SelectItem><SelectItem value="company">Empresa</SelectItem></SelectContent></Select></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cédula</label><Input value={editCustomer.taxId} onChange={(e) => setEditCustomer({ ...editCustomer, taxId: e.target.value })} placeholder="001-010190-1000A" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">RUC {String(editCustomer.type).toUpperCase() === 'COMPANY' && <span className="text-destructive">*</span>}</label><Input value={editCustomer.ruc} onChange={(e) => setEditCustomer({ ...editCustomer, ruc: e.target.value })} placeholder="J0310000000000" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</label><Select value={editCustomer.status} onValueChange={(value) => setEditCustomer({ ...editCustomer, status: value as CustomerDraft['status'] })}><SelectTrigger className="h-11 w-full rounded-xl border-border bg-background px-3 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Activo</SelectItem><SelectItem value="INACTIVE">Inactivo</SelectItem></SelectContent></Select></div>
              </div>
            </section>
            <section className="space-y-3 border-t border-border/40 pt-5">
              <div><h3 className="text-sm font-black uppercase tracking-widest">Contacto y ubicación</h3><p className="text-xs text-muted-foreground">Mantén actualizados los datos de contacto del cliente.</p></div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Correo</label><Input type="email" value={editCustomer.email} onChange={(e) => setEditCustomer({ ...editCustomer, email: e.target.value })} placeholder="correo@ejemplo.com" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Teléfono</label><Input value={editCustomer.phone} onChange={(e) => setEditCustomer({ ...editCustomer, phone: e.target.value })} placeholder="8888-8888" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dirección</label><Input value={editCustomer.address} onChange={(e) => setEditCustomer({ ...editCustomer, address: e.target.value })} placeholder="Calle, número y referencias" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ciudad</label><Input value={editCustomer.city} onChange={(e) => setEditCustomer({ ...editCustomer, city: e.target.value })} placeholder="Ciudad" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Departamento</label><Input value={editCustomer.department} onChange={(e) => setEditCustomer({ ...editCustomer, department: e.target.value })} placeholder="Departamento" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">País</label><Input value={editCustomer.country} onChange={(e) => setEditCustomer({ ...editCustomer, country: e.target.value })} placeholder="País" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5 sm:col-span-2 xl:col-span-3"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notas</label><textarea value={editCustomer.notes} onChange={(e) => setEditCustomer({ ...editCustomer, notes: e.target.value })} placeholder="Observaciones opcionales" className="min-h-20 w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></div>
              </div>
            </section>
            <section className="space-y-3 border-t border-border/40 pt-5">
              <div><h3 className="text-sm font-black uppercase tracking-widest">Condiciones comerciales</h3><p className="text-xs text-muted-foreground">Estos cambios quedan registrados en el historial del cliente.</p></div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Régimen fiscal</label><Select value={editCustomer.fiscalRegime} onValueChange={(v) => setEditCustomer({ ...editCustomer, fiscalRegime: v })}><SelectTrigger className="h-11 rounded-xl text-sm"><SelectValue placeholder="Seleccionar régimen" /></SelectTrigger><SelectContent>{FISCAL_REGIMES.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Límite de crédito ({editCustomer.creditLimitCurrency})</label><Input type="number" min="0" value={editCustomer.creditLimit} onChange={(e) => setEditCustomer({ ...editCustomer, creditLimit: e.target.value })} placeholder="0.00" className="h-11 rounded-xl" /><p className="text-[10px] text-muted-foreground">Moneda guardada para este cliente.</p></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Plazo de crédito (días)</label><Input type="number" min="0" value={editCustomer.creditDays} onChange={(e) => setEditCustomer({ ...editCustomer, creditDays: e.target.value })} placeholder="0 = contado" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lista de precios</label><Select value={editCustomer.priceListId || '__no_price_list__'} onValueChange={(value) => setEditCustomer({ ...editCustomer, priceListId: value === '__no_price_list__' ? '' : value })}><SelectTrigger className="h-11 w-full rounded-xl border-border bg-background px-3 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__no_price_list__">Sin lista asignada</SelectItem>{priceLists.map((list) => <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
            </section>
          </div>
          <DialogFooter className="flex-wrap gap-2 border-t border-border/40 px-5 py-4 sm:px-7">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={savingEdit} className="w-full rounded-xl sm:w-auto">Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit} className="w-full rounded-xl font-bold sm:w-auto">{savingEdit ? 'Guardando...' : 'Guardar cambios'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(open) => { if (!open && !importing) { setImportRows([]); setImportFile(null); } setImportOpen(open); }}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] !max-w-[min(92vw,720px)] overflow-y-auto rounded-3xl p-5 sm:p-6">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="size-4" /> Importar clientes</DialogTitle><DialogDescription>Carga una plantilla Excel. Luego abre la previsualización completa para corregir los datos antes de crear los clientes.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground"><p className="font-black uppercase tracking-widest text-foreground">Antes de cargar</p><p className="mt-2">El número de cliente lo asigna automáticamente el sistema. La importación puede repetirse; las cédulas o RUC duplicados se marcarán como errores. Los avisos, como una lista de precios inexistente, no bloquean las filas.</p><Button variant="outline" size="sm" className="mt-3 gap-2" onClick={downloadTemplate}><Download className="size-4" /> Descargar plantilla Excel</Button></div>
            <div className="space-y-2"><label className="text-xs font-bold text-muted-foreground">Archivo Excel de clientes</label><Input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(event) => { const file = event.target.files?.[0]; if (file) readImportFile(file); }} />{importFile && <p className="break-words text-xs text-muted-foreground">Archivo cargado: <b>{importFile.name}</b> · {importRows.length} filas detectadas</p>}</div>
            <div className="rounded-xl border p-4 text-xs text-muted-foreground"><p className="font-bold text-foreground">Flujo de trabajo</p><ol className="mt-2 list-decimal space-y-1 pl-5"><li>Descarga la plantilla y completa los datos del cliente, sin código.</li><li>Carga el archivo; el sistema lo prepara sin mostrar cambios todavía.</li><li>Presiona “Previsualizar clientes” para editar y revisar errores.</li><li>Confirma escribiendo IMPORTAR; los clientes válidos recibirán su número automático.</li></ol></div>
          </div>
          <DialogFooter className="flex-wrap"><Button variant="outline" onClick={() => setImportOpen(false)} disabled={previewLoading}>Cerrar</Button>{importFile && <Button onClick={handleOpenImportPreview} disabled={previewLoading}>Previsualizar clientes</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>
      <ImportProgressOverlay open={previewLoading} progress={previewProgress} title="Preparando previsualización" description="Leyendo el archivo, validando columnas y preparando los clientes para revisión." />
      {showTutorial && <GuidedTour steps={CUSTOMERS_TOUR_STEPS} onClose={() => setShowTutorial(false)} title="Clientes" allowTargetInteraction />}
    </div>
  );
}
