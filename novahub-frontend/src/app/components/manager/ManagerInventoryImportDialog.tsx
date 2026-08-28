import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { Worksheet } from 'exceljs';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Download, FileSpreadsheet, ImageIcon, Info, Loader2, PackagePlus, Plus, RefreshCw, Upload, Warehouse } from 'lucide-react';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import {
  enterpriseGroupsService,
  type ManagerInventoryImportPreview,
  type ManagerInventoryImportLocation,
  type ManagerInventoryImportOptions,
} from '../../services/enterprise-groups.service';
import { storageService } from '../../services/storage.service';
import { extractProductImageArchive, productImageKey, PRODUCT_IMAGE_ARCHIVE_EXTENSIONS } from '../../utils/product-image-archive';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { VirtualizedImportList } from '../ui/VirtualizedImportList';
import { parseSpreadsheetInWorker } from '../../utils/import-spreadsheet';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';

type Currency = 'NIO' | 'USD';
type StockMode = 'SET' | 'ADD';
type BusinessUnitOption = { id: string; name: string; isActive?: boolean };

type Props = {
  onBack: () => void;
  groupId: string;
  businessUnitId?: string;
  businessUnits: BusinessUnitOption[];
  onImported: () => void;
};

const numberFormat = new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 });
const formatNumber = (value: unknown) => numberFormat.format(Number(value || 0));
const statusLabels: Record<string, string> = {
  NUEVO_PRODUCTO: 'Producto nuevo',
  CREAR_ESPEJO: 'Crear espejo',
  PRODUCTO_EXISTENTE: 'Producto existente',
};

const rowCode = (row: Record<string, unknown>) => String(row['Código / SKU'] ?? row.Código ?? row.Codigo ?? row.code ?? row.codigo ?? row.SKU ?? row.sku ?? '').trim();

const safeFileNamePart = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'rubro';

const displayLocationLabel = (location: ManagerInventoryImportLocation) =>
  location.selectionLabel || (location.type === 'BODEGA' ? `${location.name} · ${location.branchName}` : `${location.name} · Corporativo`);

const normalizeImportKey = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase();

const readImportValue = (row: Record<string, unknown>, aliases: string[]) => {
  const keys = Object.keys(row);
  return aliases
    .map((alias) => row[alias] ?? row[keys.find((key) => normalizeImportKey(key) === normalizeImportKey(alias)) || ''])
    .find((value) => value !== undefined && value !== '');
};

const parseImportNumber = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const normalized = String(value).trim().replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const findHeaderRow = (matrix: unknown[][]) => {
  const headerIndex = matrix.findIndex((row) => {
    const keys = row.map(normalizeImportKey);
    return keys.some((key) => key === 'codigosku' || key === 'sku' || key === 'codigo')
      && keys.some((key) => key === 'nombre' || key === 'producto' || key === 'name');
  });
  return headerIndex >= 0 ? headerIndex : 0;
};

async function readSpreadsheetRows(file: File, onProgress?: (progress: number) => void) {
    const parsed = await parseSpreadsheetInWorker(file, undefined, true, onProgress);
    const sheets = parsed.sheets || { [parsed.sheetName || 'Hoja 1']: parsed.rows };
    const normalizeSheetName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const sheetHeaderRows = new Map<string, number>();
    const readSheet = (name?: string) => {
      if (!name) return [];
      const matrix = sheets[name] || [];
      const headerRow = findHeaderRow(matrix);
      sheetHeaderRows.set(name, headerRow);
      const headers = (matrix[headerRow] || []).map((header) => String(header ?? '').trim());
      return matrix.slice(headerRow + 1)
        .filter((row) => row.some((cell) => String(cell ?? '').trim().length > 0))
        .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])) as Record<string, unknown>);
    };
    const sheetNames = Object.keys(sheets);
    const productSheetName = sheetNames.find((name) => normalizeSheetName(name) === 'productos');
    const distributionSheetName = sheetNames.find((name) => ['distribucion', 'asignaciones', 'ubicaciones'].includes(normalizeSheetName(name)));
    const products = readSheet(productSheetName);
    const distributions = readSheet(distributionSheetName);
    const productByCode = new Map<string, Record<string, unknown>>();
    products.forEach((product) => {
      const code = String(readImportValue(product, ['Código / SKU', 'Código', 'Codigo', 'SKU', 'code']) ?? '').trim();
      if (code) productByCode.set(normalizeImportKey(code), product);
    });
    if (productSheetName && distributionSheetName) {
      const distributionHeaderRow = sheetHeaderRows.get(distributionSheetName) || 0;
      const rows = distributions.map((distribution, index) => {
        const code = String(readImportValue(distribution, ['Código / SKU', 'Código', 'Codigo', 'SKU', 'code']) ?? '').trim();
        const product = productByCode.get(normalizeImportKey(code)) || {};
        const productCode = String(readImportValue(product, ['Código / SKU', 'Código', 'Codigo', 'SKU', 'code']) ?? code).trim() || code;
        return {
          __importRowNumber: distributionHeaderRow + index + 2,
          code: productCode,
          name: String(readImportValue(product, ['Nombre', 'Producto', 'Producto / servicio', 'name']) ?? '').trim(),
          category: String(readImportValue(product, ['Categoría', 'Categoria', 'category']) ?? '').trim(),
          unit: String(readImportValue(product, ['Unidad', 'unit']) ?? 'unidad').trim() || 'unidad',
          costPrice: parseImportNumber(readImportValue(product, ['Costo', 'Precio al costo', 'costPrice'])),
          warehouseSelection: String(readImportValue(distribution, ['Ubicación destino', 'Destino', 'warehouseSelection', 'Bodega', 'Almacén', 'Ubicación']) ?? '').trim(),
          stock: parseImportNumber(readImportValue(distribution, ['Stock inicial', 'Stock', 'Cantidad', 'quantity'])) ?? 0,
          minStock: parseImportNumber(readImportValue(distribution, ['Stock mínimo', 'Stock minimo', 'Mínimo', 'minStock'])) ?? 0,
          registerCatalog: String(readImportValue(distribution, ['Registrar catálogo', 'Registrar catalogo', 'registerCatalog']) ?? 'SI').trim() || 'SI',
        };
      });
      return { rows, productRows: products.length, distributionRows: distributions.length, format: 'two-sheet' as const };
    }
    const firstSheet = sheetNames[0];
    const legacyRows = readSheet(firstSheet).map((row, index) => ({
      __importRowNumber: (sheetHeaderRows.get(firstSheet) || 0) + index + 2,
      code: String(readImportValue(row, ['Código / SKU', 'Código', 'Codigo', 'SKU', 'code']) ?? '').trim(),
      name: String(readImportValue(row, ['Nombre', 'Producto', 'Producto / servicio', 'name']) ?? '').trim(),
      category: String(readImportValue(row, ['Categoría', 'Categoria', 'category']) ?? '').trim(),
      unit: String(readImportValue(row, ['Unidad', 'unit']) ?? 'unidad').trim() || 'unidad',
      costPrice: parseImportNumber(readImportValue(row, ['Costo', 'Precio al costo', 'costPrice'])),
      warehouseSelection: String(readImportValue(row, ['Ubicación destino', 'Destino', 'warehouseSelection', 'Bodega', 'Almacén', 'Ubicación']) ?? '').trim(),
      stock: parseImportNumber(readImportValue(row, ['Stock inicial', 'Stock', 'Cantidad', 'quantity'])) ?? 0,
      minStock: parseImportNumber(readImportValue(row, ['Stock mínimo', 'Stock minimo', 'Mínimo', 'minStock'])) ?? 0,
      registerCatalog: String(readImportValue(row, ['Registrar catálogo', 'Registrar catalogo', 'registerCatalog']) ?? 'SI').trim() || 'SI',
    }));
    return { rows: legacyRows, productRows: 0, distributionRows: 0, format: 'legacy' as const };
}

export function ManagerInventoryImportView({ onBack, groupId, businessUnitId, businessUnits, onImported }: Props) {
  const importBusinessUnitId = businessUnitId || '';
  const [currency, setCurrency] = useState<Currency>('NIO');
  const [stockMode, setStockMode] = useState<StockMode>('SET');
  const [exchangeRate, setExchangeRate] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState('');
  const [sheetSummary, setSheetSummary] = useState<{ productRows: number; distributionRows: number; format: 'two-sheet' | 'legacy' } | null>(null);
  const [preview, setPreview] = useState<ManagerInventoryImportPreview | null>(null);
  const [previewDirty, setPreviewDirty] = useState(false);
  const [preparedCategoryNames, setPreparedCategoryNames] = useState<string[]>([]);
  const [imageArchiveFileName, setImageArchiveFileName] = useState('');
  const [imageArchiveEntries, setImageArchiveEntries] = useState<Map<string, File>>(new Map());
  const [imageArchiveProcessing, setImageArchiveProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [readingFile, setReadingFile] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);

  const optionsQuery = useTenantQuery(
    ['manager-inventory-import-options', groupId, importBusinessUnitId || ''],
    (signal) => enterpriseGroupsService.getSharedInventoryImportOptions(groupId, importBusinessUnitId || '', signal),
    { enabled: Boolean(groupId && importBusinessUnitId) },
  );
  const options = optionsQuery.data as ManagerInventoryImportOptions | undefined;

  useEffect(() => {
    setRows([]);
    setFileName('');
    setSheetSummary(null);
    setPreview(null);
    setPreviewDirty(false);
    setPreparedCategoryNames([]);
    setExchangeRate('');
    setImageArchiveFileName('');
    setImageArchiveEntries(new Map());
  }, [importBusinessUnitId]);

  const bodegasByBranch = useMemo(() => {
    const result = new Map<string, string[]>();
    (options?.locations || []).filter((location) => location.type === 'BODEGA' && location.branchId).forEach((location) => {
      const branchId = location.branchId as string;
      const current = result.get(branchId) || [];
      const label = location.name.trim();
      if (label && !current.includes(label)) current.push(label);
      result.set(branchId, current);
    });
    result.forEach((names) => names.sort((left, right) => left.localeCompare(right, 'es')));
    return result;
  }, [options?.locations]);

  const branchesWithoutActiveBodega = useMemo(
    () => (options?.branches || []).filter((branch) => !(bodegasByBranch.get(branch.id)?.length)),
    [bodegasByBranch, options?.branches],
  );

  const activeLocationSummary = useMemo(() => {
    const physicalLocations = new Map((options?.locations || []).map((location) => [location.warehouseId, location]));
    const uniqueLocations = [...physicalLocations.values()];
    return {
      bodegaCount: uniqueLocations.filter((location) => location.type === 'BODEGA').length,
      warehouseCount: uniqueLocations.filter((location) => location.type === 'ALMACEN').length,
    };
  }, [options?.locations]);

  const targetBaseCurrencies = useMemo(() => [...new Set((options?.branches || []).map((branch) => String(branch.baseCurrency || 'NIO').trim().toUpperCase()))], [options?.branches]);
  const requiresManualExchangeRate = targetBaseCurrencies.some((baseCurrency) => baseCurrency !== currency);
  const parsedExchangeRate = Number(exchangeRate.replace(',', '.'));
  const hasValidExchangeRate = !requiresManualExchangeRate || (Number.isFinite(parsedExchangeRate) && parsedExchangeRate > 0);
  const targetBaseCurrencyLabel = targetBaseCurrencies.length ? targetBaseCurrencies.join(' / ') : 'la moneda base de las sucursales';

  const requestBody = useMemo(() => ({
    businessUnitId: importBusinessUnitId,
    currency,
    stockMode,
    exchangeRate: Number.isFinite(parsedExchangeRate) && parsedExchangeRate > 0 ? parsedExchangeRate : undefined,
    rows,
  }), [importBusinessUnitId, currency, stockMode, parsedExchangeRate, rows]);

  const previewMutation = useMutation({
    mutationFn: () => enterpriseGroupsService.previewSharedInventory(groupId, requestBody),
    onSuccess: (result) => {
      setPreview(result);
      setPreviewDirty(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      setImportProgress(8);
      if (!imageArchiveEntries.size) {
        const result = await enterpriseGroupsService.importSharedInventory(groupId, requestBody);
        setImportProgress(100);
        return { result, imageUpload: null };
      }
      const imageUrlByCode = new Map<string, string>();
      const importedCodes = new Set(rows.map((row) => productImageKey(rowCode(row))).filter(Boolean));
      const matchedEntries = [...imageArchiveEntries.entries()].filter(([code]) => importedCodes.has(code));
      if (!matchedEntries.length) {
        throw new Error('Ninguna imagen del archivo coincide con el SKU de la hoja Productos. Revisa los nombres del ZIP/RAR antes de confirmar.');
      }
      const uploadFailures: Array<{ code: string; message: string }> = [];
      let completedUploads = 0;
      let nextEntry = 0;
      const uploadNext = async () => {
        while (nextEntry < matchedEntries.length) {
          const entryIndex = nextEntry;
          nextEntry += 1;
          const [code, imageFile] = matchedEntries[entryIndex];
          try {
            const uploaded = await storageService.uploadFile('product-image', imageFile, {
              // Una sola imagen por SKU dentro del grupo; los espejos de las
              // sucursales reciben la misma URL pública de Supabase.
              folder: 'products',
              scopeId: groupId,
              dedupeKey: code,
            });
            imageUrlByCode.set(code, uploaded.url);
          } catch (error) {
            uploadFailures.push({
              code,
              message: error instanceof Error ? error.message : 'Error desconocido del almacenamiento',
            });
          } finally {
            completedUploads += 1;
            setImportProgress(8 + Math.round((completedUploads / matchedEntries.length) * 70));
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, matchedEntries.length) }, () => uploadNext()));
      if (uploadFailures.length) {
        const detail = uploadFailures.slice(0, 2).map(({ code, message }) => `${code}: ${message}`).join(' · ');
        throw new Error(`${uploadFailures.length} imagen(es) no pudieron cargarse. No se aplicó la importación para evitar productos sin imagen. ${detail}`);
      }
      const rowsWithImages = rows.map((row) => {
        const imageUrl = imageUrlByCode.get(productImageKey(rowCode(row)));
        return imageUrl ? { ...row, imageUrl } : row;
      });
      setImportProgress(90);
      const result = await enterpriseGroupsService.importSharedInventory(groupId, { ...requestBody, rows: rowsWithImages });
      setImportProgress(100);
      return { result, imageUpload: { attempted: matchedEntries.length, uploaded: imageUrlByCode.size } };
    },
    onSuccess: ({ result, imageUpload }) => {
      const imageMessage = imageUpload ? ` Imágenes vinculadas por SKU: ${result.imagesLinked ?? imageUpload.uploaded}/${imageUpload.attempted}.` : '';
      toast.success(`Importación aplicada: ${result.stockUpdated || 0} ubicación(es), ${result.productsCreated || 0} espejo(s) y ${result.locationsCreated || 0} registro(s) de stock.${imageMessage}`);
      onBack();
      onImported();
    },
    onError: (error: Error) => { setImportProgress(0); toast.error(`Importación detenida; no se aplicaron cambios. ${error.message}`); },
  });

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setReadingFile(true);
    setReadingProgress(3);
    try {
      const parsed = await readSpreadsheetRows(file, (progress) => {
        setReadingProgress(Math.min(84, Math.max(3, progress)));
      });
      setReadingProgress(90);
      if (!parsed.rows.length) {
        toast.error(parsed.format === 'two-sheet' ? 'La hoja Distribución no contiene filas para importar' : 'El archivo no contiene filas para importar');
        return;
      }
      setRows(parsed.rows);
      setFileName(file.name);
      setSheetSummary(parsed);
      setPreview(null);
      setPreviewDirty(false);
      setPreparedCategoryNames([]);
      setReadingProgress(100);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo leer la plantilla');
    } finally {
      setReadingFile(false);
      setReadingProgress(0);
      event.target.value = '';
    }
  };

  const updateDraftRow = (previewRow: ManagerInventoryImportPreview['rows'][number], field: string, value: unknown) => {
    const draftIndex = rows.findIndex((row) => Number(row.__importRowNumber || 0) === Number(previewRow.rowNumber));
    if (draftIndex < 0) return;
    const productFields = new Set(['code', 'name', 'category', 'unit', 'costPrice']);
    const currentCode = rowCode(rows[draftIndex]) || previewRow.code;
    setRows((current) => current.map((row, index) => {
      const sameProduct = productFields.has(field) && currentCode && rowCode(row).toLowerCase() === currentCode.toLowerCase();
      if (index !== draftIndex && !sameProduct) return row;
      return { ...row, [field]: value };
    }));
    setPreviewDirty(true);
  };

  const prepareCategory = (name: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) return;
    setPreparedCategoryNames((current) => current.some((item) => item.toLowerCase() === normalizedName.toLowerCase()) ? current : [...current, normalizedName]);
    toast.success(`Categoría "${normalizedName}" preparada; se creará al confirmar la importación.`);
  };

  const onImageArchive = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!PRODUCT_IMAGE_ARCHIVE_EXTENSIONS.test(file.name)) {
      toast.error('Selecciona un archivo ZIP o RAR válido');
      event.target.value = '';
      return;
    }
    setImageArchiveProcessing(true);
    try {
      const entries = await extractProductImageArchive(file);
      setImageArchiveEntries(entries);
      setImageArchiveFileName(file.name);
      setPreview(null);
       toast.success(`${entries.size} imagen(es) encontradas; se asociarán al SKU de la hoja Productos.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo leer el archivo de imágenes');
    } finally {
      setImageArchiveProcessing(false);
      event.target.value = '';
    }
  };

  const downloadTemplate = async () => {
    const activeLocations = options?.locations || [];
    if (!activeLocations.length) {
      toast.error('No hay ubicaciones activas disponibles para generar la plantilla');
      return;
    }

    try {
      const { Workbook } = (await import('exceljs')).default;
      const workbook = new Workbook();
      workbook.creator = 'NovaHub ERP';
      workbook.created = new Date();

      const uniquePhysicalLocations = Array.from(new Map(activeLocations.map((location) => [location.warehouseId, location])).values());
      const uniqueLocationLabels = [...new Set(uniquePhysicalLocations.map(displayLocationLabel).filter(Boolean))];

      const products = workbook.addWorksheet('Productos');
      products.columns = [
        { header: 'Código / SKU', key: 'code', width: 20 },
        { header: 'Nombre', key: 'name', width: 30 },
        { header: 'Categoría', key: 'category', width: 24 },
        { header: 'Unidad', key: 'unit', width: 14 },
        { header: 'Costo', key: 'cost', width: 16 },
      ];
      products.addRow({ code: '', name: '', category: '', unit: 'unidad', cost: '' });

      const distribution = workbook.addWorksheet('Distribución');
      distribution.columns = [
        { header: 'Código / SKU', key: 'code', width: 20 },
        { header: 'Ubicación destino', key: 'location', width: 48 },
        { header: 'Stock inicial', key: 'stock', width: 16 },
        { header: 'Stock mínimo', key: 'minStock', width: 16 },
        { header: 'Registrar catálogo', key: 'registerCatalog', width: 20 },
      ];
      uniquePhysicalLocations.forEach((location) => {
        distribution.addRow({
          code: '',
          location: displayLocationLabel(location),
          stock: 0,
          minStock: 0,
          registerCatalog: 'SI',
        });
      });

      const locationRows = uniquePhysicalLocations.map((location) => {
        const isCorporate = Boolean(location.isCorporate || location.scopeType === 'BUSINESS_UNIT');
        return {
          Tipo: isCorporate ? 'Almacén corporativo' : 'Bodega de sucursal',
          Sucursal: isCorporate ? '—' : location.branchName,
          Ubicación: location.name,
          Destino: displayLocationLabel(location),
          Dirección: location.location || '',
          Alcance: isCorporate ? 'Fuera de las sucursales · pertenece al rubro' : 'Dentro de la sucursal',
          Activa: location.active ? 'SI' : 'NO',
        };
      });
      const locationsSheet = workbook.addWorksheet('Ubicaciones activas');
      locationsSheet.columns = [
        { header: 'Tipo', key: 'type', width: 25 },
        { header: 'Ubicación destino', key: 'location', width: 48 },
        { header: 'Sucursal (solo bodega)', key: 'branch', width: 28 },
        { header: 'Dirección', key: 'address', width: 24 },
        { header: 'Alcance', key: 'scope', width: 42 },
        { header: 'Activa', key: 'active', width: 12 },
      ];
      locationRows.forEach((row) => locationsSheet.addRow({
        type: row.Tipo,
        location: row.Destino,
        branch: row.Sucursal,
        address: row.Dirección,
        scope: row.Alcance,
        active: row.Activa,
      }));

      const guide = workbook.addWorksheet('Guía de llenado');
      [
        ['GUÍA DE LLENADO · IMPORTACIÓN POR RUBRO'],
        ['Productos contiene cada SKU una sola vez. Distribución repite únicamente el SKU para asignar stock a varias ubicaciones.'],
        ['Los nombres de bodega y almacén son únicos dentro del rubro, por eso normalmente basta seleccionar “Bodega 1” o “Almacén central”. Si existe un registro histórico duplicado, el sistema agrega la sucursal como contexto.'],
        ['Campo', 'Hoja', 'Regla'],
        ['Código / SKU', 'Productos y Distribución', 'Obligatorio. Relaciona ambas hojas; no escribas IDs.'],
        ['Nombre', 'Productos', 'Obligatorio cuando el producto todavía no existe en el rubro.'],
        ['Costo', 'Productos', 'Obligatorio y único para el mismo SKU en todas sus ubicaciones.'],
        ['Ubicación destino', 'Distribución', 'Selecciona una opción del dropdown. Una bodega ya incluye su sucursal; un almacén corporativo no pertenece a ninguna sucursal y el sistema aplica su configuración de abastecimiento.'],
        ['Stock inicial', 'Distribución', 'Cantidad final o cantidad a sumar según el modo seleccionado. Puede ser 0.'],
        ['Stock mínimo', 'Distribución', 'Nivel mínimo de inventario para esa relación de stock.'],
        ['Registrar catálogo', 'Distribución', 'SI/NO. Permite crear el registro de catálogo y stock aunque la cantidad sea 0.'],
        ['Almacén corporativo', 'Ubicaciones activas', 'Se muestra una sola vez, fuera de sucursales. Las sucursales que puede abastecer ya están configuradas en el sistema y no se repiten en la plantilla.'],
        ['Imágenes', 'Importación', 'Opcional. Carga un ZIP o RAR con JPG/PNG nombrados exactamente como el SKU; la asociación se revisa por nombre antes de confirmar.'],
      ].forEach((row) => guide.addRow(row));
      guide.getColumn(1).width = 34;
      guide.getColumn(2).width = 28;
      guide.getColumn(3).width = 105;

      const catalogs = workbook.addWorksheet('Catálogos');
      catalogs.state = 'veryHidden';
      catalogs.getCell('A1').value = 'Ubicaciones activas';
      uniqueLocationLabels.forEach((label, index) => { catalogs.getCell(index + 2, 1).value = label; });
      workbook.definedNames.add('UbicacionesActivas', `'Catálogos'!$A$2:$A$${Math.max(uniqueLocationLabels.length + 1, 2)}`);

      const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF087F5B' } },
        alignment: { vertical: 'middle' as const, wrapText: true },
      };
      const styleHeader = (sheet: Worksheet) => {
        sheet.getRow(1).height = 30;
        sheet.getRow(1).eachCell((cell) => { cell.style = headerStyle; });
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
        sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + sheet.columnCount)}${Math.max(sheet.rowCount, 2)}` };
      };
      [products, distribution, locationsSheet].forEach(styleHeader);
      guide.getRow(1).font = { bold: true, color: { argb: 'FF087F5B' } };
      guide.getRow(1).height = 28;
      guide.views = [{ state: 'frozen', ySplit: 3 }];

      for (let rowNumber = 2; rowNumber <= Math.max(distribution.rowCount, 2); rowNumber += 1) {
        distribution.getCell(rowNumber, 2).dataValidation = { type: 'list', allowBlank: false, formulae: ['=UbicacionesActivas'], showErrorMessage: true, errorTitle: 'Ubicación no válida', error: 'Selecciona una ubicación activa del listado.' };
        distribution.getCell(rowNumber, 3).dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: false, formulae: [0], showErrorMessage: true, errorTitle: 'Cantidad no válida', error: 'Ingresa un número mayor o igual que cero.' };
        distribution.getCell(rowNumber, 4).dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: false, formulae: [0], showErrorMessage: true, errorTitle: 'Mínimo no válido', error: 'Ingresa un número mayor o igual que cero.' };
        distribution.getCell(rowNumber, 5).dataValidation = { type: 'list', allowBlank: false, formulae: ['"SI,NO"'], showErrorMessage: true, errorTitle: 'Opción no válida', error: 'Selecciona SI o NO.' };
      }
      products.getCell(2, 5).dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [0], showErrorMessage: true, errorTitle: 'Costo no válido', error: 'Ingresa un costo mayor o igual que cero.' };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `plantilla-importacion-${safeFileNamePart(selectedBusinessUnitName)}.xlsx`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo generar la plantilla Excel');
    }
  };

  const hasLinkableImage = !imageArchiveEntries.size || rows.some((row) => imageArchiveEntries.has(productImageKey(rowCode(row))));
  const validForImport = Boolean(preview && !previewDirty && preview.summary.errorRows === 0 && preview.summary.validRows === preview.summary.totalRows && preview.summary.validRows > 0 && hasLinkableImage);
  const importBlockReason = previewDirty
    ? 'Valida nuevamente los cambios de la previsualización antes de confirmar.'
    : preview && preview.summary.errorRows > 0
      ? `Corrige las ${preview.summary.errorRows} fila(s) con error antes de confirmar.`
      : preview && preview.summary.validRows === 0
        ? 'No hay filas válidas para importar.'
        : imageArchiveEntries.size > 0 && !hasLinkableImage
          ? 'El ZIP/RAR no contiene ninguna imagen cuyo nombre coincida con un SKU de la importación.'
        : !preview
          ? 'Previsualiza el archivo para habilitar la confirmación.'
          : '';
  const selectedBusinessUnitName = businessUnits.find((unit) => unit.id === importBusinessUnitId)?.name || '—';

  return <section className="min-w-0 space-y-4">
    <div className="flex min-w-0 flex-col gap-3 rounded-[24px] border border-border/60 bg-card p-4 shadow-sm sm:p-5 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><PackagePlus className="size-5" /></div>
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-primary">Productos · carga masiva</p>
          <h1 className="mt-0.5 text-xl font-black uppercase italic tracking-tight sm:text-2xl">Importar inventario</h1>
          <p className="mt-1 text-xs text-muted-foreground">Distribuye productos entre ubicaciones activas del rubro.</p>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" className="w-full shrink-0 rounded-xl md:w-auto" onClick={onBack}><ArrowLeft className="mr-2 size-4" />Volver a productos</Button>
    </div>

    <div className="overflow-hidden rounded-[24px] border border-border/60 bg-card shadow-sm">
      <div className="p-4 sm:p-5 md:p-6">
      <div className="mb-5 flex min-w-0 items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="min-w-0"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Configuración</p><p className="mt-1 text-xs text-muted-foreground">Moneda, stock y archivos de la importación.</p></div>
        <Popover>
          <PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 rounded-full text-muted-foreground" aria-label="Ver reglas de la importación"><Info className="size-4" /></Button></PopoverTrigger>
          <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-4 text-xs leading-5">
            <p className="font-black text-foreground">Reglas de esta importación</p>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
              <li><span className="font-semibold text-foreground">Bodegas:</span> pertenecen a una sucursal.</li>
              <li><span className="font-semibold text-foreground">Almacenes:</span> son corporativos, están fuera de las sucursales y conservan stock independiente.</li>
              <li>Solo se aceptan ubicaciones activas y autorizadas del rubro.</li>
              <li>El SKU se define una vez en <span className="font-semibold text-foreground">Productos</span> y se distribuye en <span className="font-semibold text-foreground">Distribución</span>.</li>
              <li>El costo es único por SKU; IVA e IR no forman parte de esta plantilla.</li>
            </ul>
          </PopoverContent>
        </Popover>
      </div>

      {!importBusinessUnitId && <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">Selecciona el rubro de importación para cargar sus ubicaciones activas.</div>}
      {importBusinessUnitId && <div className="space-y-5">
        <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-3">
          <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground"><span>Moneda del archivo</span><select value={currency} onChange={(event) => { setCurrency(event.target.value as Currency); setExchangeRate(''); setPreview(null); }} className="h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground"><option value="NIO">Córdobas (NIO)</option><option value="USD">Dólares (USD)</option></select></label>
          <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground"><span>Modo de stock</span><select value={stockMode} onChange={(event) => { setStockMode(event.target.value as StockMode); setPreview(null); }} className="h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground"><option value="SET">Establecer stock final</option><option value="ADD">Sumar al stock actual</option></select></label>
          <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground"><span className="flex flex-wrap items-center gap-1.5">Tasa manual de conversión <Badge variant={requiresManualExchangeRate ? 'destructive' : 'outline'} className="rounded-full px-1.5 py-0 text-[9px]">{requiresManualExchangeRate ? 'Requerida' : 'No necesaria'}</Badge></span><Input value={exchangeRate} onChange={(event) => { setExchangeRate(event.target.value); setPreview(null); }} inputMode="decimal" min="0" step="0.0001" type="number" required={requiresManualExchangeRate} disabled={!requiresManualExchangeRate} aria-invalid={requiresManualExchangeRate && !hasValidExchangeRate} placeholder={requiresManualExchangeRate ? 'Ej. 36.80' : 'Misma moneda'} /></label>
        </div>

        <div className="flex min-w-0 items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" /><p className="min-w-0 leading-5">El Manager no tiene una tasa fija propia. {requiresManualExchangeRate ? <>Ingresa la tasa vigente para convertir <span className="font-bold text-foreground">{currency}</span> a <span className="font-bold text-foreground">{targetBaseCurrencyLabel}</span>; la importación no usará una tasa automática.</> : <>El archivo ya está expresado en la moneda base detectada ({targetBaseCurrencyLabel}) y no requiere conversión.</>}</p></div>
        {requiresManualExchangeRate && !hasValidExchangeRate && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">Ingresa una tasa mayor que cero antes de previsualizar o confirmar la importación.</div>}

        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Card className="min-w-0 rounded-2xl border-primary/20 bg-primary/[0.04] shadow-none"><CardContent className="space-y-2.5 p-3.5"><div className="flex items-center gap-2.5"><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileSpreadsheet className="size-4.5" /></div><div className="min-w-0"><p className="text-sm font-black">1. Plantilla activa</p><p className="text-[11px] text-muted-foreground">Productos + Distribución</p></div></div><Button type="button" variant="outline" size="sm" className="w-full rounded-xl" onClick={downloadTemplate} disabled={optionsQuery.isLoading || !options?.locations.length}><Download className="mr-2 size-4" />Descargar Excel</Button></CardContent></Card>
          <Card className="min-w-0 rounded-2xl border-primary/20 bg-primary/[0.04] shadow-none"><CardContent className="space-y-2.5 p-3.5"><div className="flex items-center gap-2.5"><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Upload className="size-4.5" /></div><div className="min-w-0"><p className="text-sm font-black">2. Archivo</p><p className="truncate text-[11px] text-muted-foreground">{fileName || 'XLSX/XLS · dos hojas'}</p></div></div><label className="flex h-9 cursor-pointer items-center justify-center rounded-xl border border-dashed border-primary/40 bg-background px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/5"><input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="sr-only" />{fileName ? 'Reemplazar archivo' : 'Seleccionar archivo'}</label></CardContent></Card>
          <Card className="min-w-0 rounded-2xl border-primary/20 bg-primary/[0.04] shadow-none"><CardContent className="space-y-2.5 p-3.5"><div className="flex items-center gap-2.5"><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ImageIcon className="size-4.5" /></div><div className="min-w-0"><p className="text-sm font-black">3. Imágenes</p><p className="truncate text-[11px] text-muted-foreground">{imageArchiveFileName ? `${imageArchiveFileName} · ${imageArchiveEntries.size} SKU indexado(s)` : 'Opcional · ZIP/RAR'}</p></div></div><label className="flex h-9 cursor-pointer items-center justify-center rounded-xl border border-dashed border-primary/40 bg-background px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/5"><input type="file" accept=".zip,.rar,application/zip,application/vnd.rar,application/x-rar-compressed" onChange={onImageArchive} className="sr-only" disabled={imageArchiveProcessing} />{imageArchiveProcessing ? 'Leyendo imágenes…' : imageArchiveFileName ? 'Reemplazar ZIP/RAR' : 'Seleccionar ZIP/RAR'}</label></CardContent></Card>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2.5 text-xs"><div className="flex min-w-0 items-center gap-2"><Info className="size-4 shrink-0 text-sky-600" /><span className="truncate text-muted-foreground">Rubro: <span className="font-bold text-foreground">{selectedBusinessUnitName}</span></span></div><div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-muted-foreground"><Badge variant="outline" className="rounded-full">{options?.branches.length || 0} sucursales</Badge><Badge variant="outline" className="rounded-full">{activeLocationSummary.bodegaCount} bodegas</Badge><Badge variant="outline" className="rounded-full">{activeLocationSummary.warehouseCount} almacenes</Badge><Popover><PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" className="size-7 rounded-full text-sky-700 dark:text-sky-300" aria-label="Ver instrucciones del archivo"><Info className="size-3.5" /></Button></PopoverTrigger><PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] rounded-2xl p-4 text-xs leading-5"><p className="font-black text-foreground">Cómo llenar el Excel</p><p className="mt-2 text-muted-foreground">En <span className="font-semibold text-foreground">Productos</span> escribe cada SKU una sola vez. En <span className="font-semibold text-foreground">Distribución</span> repítelo para repartir stock entre destinos. Selecciona el nombre visible de la ubicación; no uses IDs. El costo debe ser igual para todas las filas del SKU. Stock 0 crea el registro sin movimiento.</p><p className="mt-2 text-muted-foreground">Las bodegas muestran su sucursal. Los almacenes corporativos aparecen una sola vez; sus autorizaciones solo indican a qué sucursales pueden transferir.</p></PopoverContent></Popover></div></div>

        {optionsQuery.isLoading && <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Cargando ubicaciones activas…</div>}
        {optionsQuery.isError && <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">No se pudieron cargar las ubicaciones activas. {optionsQuery.error.message}</div>}
        {options?.branches.length === 0 && <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">No hay sucursales activas para este rubro. La importación queda bloqueada.</div>}
        {branchesWithoutActiveBodega.length > 0 && <div role="alert" className="flex min-w-0 items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/[0.07] px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" /><p className="min-w-0 leading-5"><span className="font-bold">Sin bodega activa:</span> {branchesWithoutActiveBodega.map((branch) => branch.name).join(', ')}. Revisa Bodegas o utiliza un almacén corporativo autorizado para esas sucursales.</p></div>}
        {options && options.branches.length > 0 && <div className="space-y-2"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cobertura por sucursal</p><span className="text-[11px] text-muted-foreground">Solo bodegas activas</span></div><div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{options.branches.map((branch) => { const bodegas = bodegasByBranch.get(branch.id) || []; const hasNoBodega = bodegas.length === 0; return <div key={branch.id} className={`min-w-0 rounded-xl border px-3 py-2.5 ${hasNoBodega ? 'border-amber-500/40 bg-amber-500/[0.06]' : 'border-border/60 bg-muted/20'}`}><div className="flex min-w-0 items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><Warehouse className={`size-3.5 shrink-0 ${hasNoBodega ? 'text-amber-600' : 'text-primary'}`} /><span className="min-w-0 truncate text-sm font-semibold">{branch.name}</span></div><Badge variant={hasNoBodega ? 'destructive' : 'outline'} className="shrink-0 rounded-full text-[10px]">{hasNoBodega ? 'Sin bodega activa' : `${bodegas.length} ${bodegas.length === 1 ? 'bodega' : 'bodegas'}`}</Badge></div>{hasNoBodega ? <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">No puede recibir stock directamente en una bodega. Revisa Bodegas o usa un almacén corporativo autorizado.</p> : <p className="mt-1.5 break-words text-xs text-foreground">{bodegas.join(' · ')}</p>}</div>; })}</div></div>}

        {rows.length > 0 && <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Archivo cargado</p><p className="truncate text-xs font-semibold">{sheetSummary?.format === 'two-sheet' ? `${sheetSummary.productRows} producto(s) · ${sheetSummary.distributionRows} distribución(es)` : `${rows.length} fila(s)`} · {fileName}</p></div><Button type="button" size="sm" className="shrink-0 rounded-xl" onClick={() => previewMutation.mutate()} disabled={!importBusinessUnitId || !hasValidExchangeRate || previewMutation.isPending || optionsQuery.isLoading || imageArchiveProcessing}><PackagePlus className="mr-2 size-4" />{previewMutation.isPending ? 'Validando…' : 'Previsualizar importación'}</Button></div>}

        {preview && <PreviewPanel
          preview={preview}
          draftRows={rows}
          imageArchiveEntries={imageArchiveEntries}
          categories={options?.categories || []}
          preparedCategoryNames={preparedCategoryNames}
          onRowUpdate={updateDraftRow}
          onPrepareCategory={prepareCategory}
          onRevalidate={() => previewMutation.mutate()}
          isDirty={previewDirty}
          isRevalidating={previewMutation.isPending}
        />}
      </div>}
      </div>
      <div className="flex flex-col gap-3 border-t border-border/60 bg-muted/10 px-4 py-5 sm:px-8"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-left text-xs leading-5 text-muted-foreground sm:max-w-xl">Se conserva el precio al costo del archivo, convertido a la moneda base de cada sucursal cuando corresponda. La operación confirmada es atómica.</p><div className="flex w-full gap-2 sm:w-auto"><Button type="button" variant="outline" className="flex-1 rounded-xl sm:flex-none" onClick={onBack}>Volver</Button><Button type="button" className="flex-1 rounded-xl sm:flex-none" disabled={!validForImport || !hasValidExchangeRate || importMutation.isPending} title={!validForImport ? importBlockReason : undefined} onClick={() => importMutation.mutate()}>{importMutation.isPending ? <><Loader2 className="mr-2 size-4 animate-spin" />Aplicando…</> : <><CheckCircle2 className="mr-2 size-4" />Confirmar importación</>}</Button></div></div>{importBlockReason && <p role="status" className={`text-xs ${preview?.summary.errorRows ? 'text-destructive' : 'text-muted-foreground'}`}>{importBlockReason}</p>}</div>
    </div>
      <ImportProgressOverlay open={readingFile || importMutation.isPending} progress={readingFile ? readingProgress : importProgress} title={readingFile ? 'Preparando inventario compartido' : 'Aplicando importación de inventario'} description={readingFile ? 'Leyendo las hojas y preparando todas las filas para revisión.' : 'Cargando imágenes y registrando los productos en las ubicaciones seleccionadas.'} />
  </section>;
}

function PreviewPanel({
  preview,
  draftRows,
  imageArchiveEntries,
  categories,
  preparedCategoryNames,
  onRowUpdate,
  onPrepareCategory,
  onRevalidate,
  isDirty,
  isRevalidating,
}: {
  preview: ManagerInventoryImportPreview;
  draftRows: Record<string, unknown>[];
  imageArchiveEntries: Map<string, File>;
  categories: Array<{ id: string; name: string }>;
  preparedCategoryNames: string[];
  onRowUpdate: (row: ManagerInventoryImportPreview['rows'][number], field: string, value: unknown) => void;
  onPrepareCategory: (name: string) => void;
  onRevalidate: () => void;
  isDirty: boolean;
  isRevalidating: boolean;
}) {
  const tableScrollerRef = useRef<HTMLDivElement>(null);
  const [tableScroll, setTableScroll] = useState({ canScrollLeft: false, canScrollRight: false });
  const hasErrors = preview.errors.length > 0;
  const locationOptions = Array.from(new Map(preview.locations.map((location) => {
    const label = displayLocationLabel(location);
    return [`${location.warehouseId}:${label}`, { value: label, type: location.type }];
  })).values());
  const categoryOptions = Array.from(new Map(categories.map((category) => [category.name.trim().toLowerCase(), category])).values());
  const draftFor = (row: ManagerInventoryImportPreview['rows'][number]) => draftRows.find((draft) => Number(draft.__importRowNumber || 0) === Number(row.rowNumber));
  const valueFor = (row: ManagerInventoryImportPreview['rows'][number], field: string, fallback: unknown = '') => {
    const value = draftFor(row)?.[field];
    return value === undefined || value === null ? fallback : value;
  };
  const imageCodesInPreview = new Set(
    preview.rows
      .map((row) => productImageKey(String(valueFor(row, 'code', row.code) || '')))
      .filter(Boolean),
  );
  const matchedImageCodes = new Set(
    [...imageArchiveEntries.keys()].filter((code) => imageCodesInPreview.has(code)),
  );
  const unmatchedImageCount = [...imageArchiveEntries.keys()].filter((code) => !imageCodesInPreview.has(code)).length;
  const imageLinkSummary = !imageArchiveEntries.size
    ? { label: 'Sin archivo de imágenes', detail: 'La importación no tiene imágenes para vincular.', className: 'text-muted-foreground' }
    : matchedImageCodes.size === imageArchiveEntries.size
      ? { label: 'Listas para vincular', detail: `${matchedImageCodes.size} imagen(es) coinciden con un SKU de la importación y se vincularán al confirmar.`, className: 'text-emerald-700 dark:text-emerald-300' }
      : matchedImageCodes.size > 0
        ? { label: 'Vinculación parcial', detail: `${matchedImageCodes.size} de ${imageArchiveEntries.size} imagen(es) coinciden con un SKU; ${unmatchedImageCount} se omitirá(n) por no tener coincidencia.`, className: 'text-amber-700 dark:text-amber-300' }
        : { label: 'No se puede vincular', detail: 'Ninguna imagen coincide con los SKU de la importación. Corrige los nombres del ZIP/RAR antes de confirmar.', className: 'text-destructive' };

  useEffect(() => {
    const scroller = tableScrollerRef.current;
    if (!scroller) return undefined;
    const syncTableScroll = () => {
      const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      setTableScroll({
        canScrollLeft: scroller.scrollLeft > 2,
        canScrollRight: maxScrollLeft - scroller.scrollLeft > 2,
      });
    };
    syncTableScroll();
    scroller.addEventListener('scroll', syncTableScroll, { passive: true });
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncTableScroll) : null;
    resizeObserver?.observe(scroller);
    return () => {
      scroller.removeEventListener('scroll', syncTableScroll);
      resizeObserver?.disconnect();
    };
  }, [preview.rows.length, imageArchiveEntries.size]);

  const scrollPreviewTable = (direction: -1 | 1) => {
    const scroller = tableScrollerRef.current;
    if (!scroller) return;
    const amount = Math.max(320, Math.round(scroller.clientWidth * 0.72));
    scroller.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };
  const imageStatusFor = (row: ManagerInventoryImportPreview['rows'][number]) => {
    if (!imageArchiveEntries.size) return { label: 'Sin ZIP/RAR', detail: 'No se cargó un archivo de imágenes', variant: 'outline' as const };
    const code = productImageKey(String(valueFor(row, 'code', row.code) || ''));
    const file = imageArchiveEntries.get(code);
    return file
      ? { label: 'Imagen vinculada', detail: `${file.name} · se puede vincular al confirmar`, variant: 'default' as const }
      : { label: 'Sin coincidencia', detail: 'No hay imagen con este SKU', variant: 'destructive' as const };
  };
  const renderImageStatus = (row: ManagerInventoryImportPreview['rows'][number]) => {
    const status = imageStatusFor(row);
    return <div className="w-full min-w-0 space-y-1"><Badge variant={status.variant} className="whitespace-nowrap">{status.label}</Badge><p className={`break-words whitespace-normal text-[10px] leading-4 ${status.variant === 'destructive' ? 'text-destructive' : 'text-muted-foreground'}`}>{status.detail}</p></div>;
  };
  const inputClass = 'h-9 w-full min-w-0 rounded-lg border-border/70 bg-background/70 text-xs';
  const currentLocationOptions = (row: ManagerInventoryImportPreview['rows'][number]) => {
    const current = String(valueFor(row, 'warehouseSelection', row.locationLabel || '') || '');
    return current && !locationOptions.some((option) => normalizeImportKey(option.value) === normalizeImportKey(current))
      ? [{ value: current, type: 'INVALID' }, ...locationOptions]
      : locationOptions;
  };
  const selectedLocationValue = (row: ManagerInventoryImportPreview['rows'][number]) => {
    const current = String(valueFor(row, 'warehouseSelection', row.locationLabel || '') || '');
    return locationOptions.find((option) => normalizeImportKey(option.value) === normalizeImportKey(current))?.value || current;
  };
  const locationContext = (row: ManagerInventoryImportPreview['rows'][number]) => row.locationType === 'ALMACEN'
    ? 'Stock independiente del almacén corporativo'
    : undefined;
  const categoryIsNew = (row: ManagerInventoryImportPreview['rows'][number]) => {
    const category = String(valueFor(row, 'category', '') || '').trim();
    return Boolean(category) && !categoryOptions.some((option) => option.name.trim().toLowerCase() === category.toLowerCase());
  };
  const categoryIsPrepared = (row: ManagerInventoryImportPreview['rows'][number]) => {
    const category = String(valueFor(row, 'category', '') || '').trim().toLowerCase();
    return Boolean(category) && preparedCategoryNames.some((name) => name.toLowerCase() === category);
  };
  const locationIssue = (row: ManagerInventoryImportPreview['rows'][number]) => row.issues.find((issue) => /ubicación|sucursal/i.test(issue));
  const renderStatus = (row: ManagerInventoryImportPreview['rows'][number]) => (
    <Badge variant={row.issues.length ? 'destructive' : 'outline'} className="whitespace-nowrap">
      {row.issues.length ? 'Error' : statusLabels[row.status] || row.status}
    </Badge>
  );
  const renderDesktopRow = (index: number) => {
    const row = preview.rows[index];
    const category = String(valueFor(row, 'category', '') || '');
    return <div className="grid min-w-[2240px] grid-cols-[3.5rem_8rem_14rem_11rem_7rem_8rem_14rem_7rem_7rem_8rem_7rem_7rem_15rem_20rem] items-start border-t border-border/50 align-top text-xs">
      <div className="px-2 py-2 text-muted-foreground">{row.rowNumber}</div>
      <div className="p-1"><Input value={String(valueFor(row, 'code', row.code) || '')} onChange={(event) => onRowUpdate(row, 'code', event.target.value)} className={`${inputClass} font-mono`} /></div>
      <div className="p-1"><Input value={String(valueFor(row, 'name', row.name) || '')} onChange={(event) => onRowUpdate(row, 'name', event.target.value)} className={inputClass} /></div>
      <div className="p-1"><div className="flex min-w-0 items-center gap-1"><Input list="manager-import-categories" value={category} onChange={(event) => onRowUpdate(row, 'category', event.target.value)} className={`${inputClass} ${categoryIsNew(row) ? 'border-amber-500/60' : ''}`} />{categoryIsNew(row) && <Button type="button" variant="ghost" size="icon" className={`size-8 shrink-0 rounded-lg ${categoryIsPrepared(row) ? 'text-emerald-600' : 'text-amber-600'}`} onClick={() => onPrepareCategory(category)} aria-label={categoryIsPrepared(row) ? `Categoría ${category} preparada` : `Agregar categoría ${category}`} title={categoryIsPrepared(row) ? 'Categoría preparada para crear al confirmar' : 'Agregar categoría al importador'}>{categoryIsPrepared(row) ? <CheckCircle2 className="size-4" /> : <Plus className="size-4" />}</Button>}</div></div>
      <div className="p-1"><Input value={String(valueFor(row, 'unit', 'unidad') || '')} onChange={(event) => onRowUpdate(row, 'unit', event.target.value)} className={inputClass} /></div>
      <div className="p-1"><Input type="number" min={0} value={String(valueFor(row, 'costPrice', row.costPrice ?? '') ?? '')} onChange={(event) => onRowUpdate(row, 'costPrice', parseImportNumber(event.target.value))} className={`${inputClass} text-right`} /></div>
      <div className="p-1"><select value={selectedLocationValue(row)} onChange={(event) => onRowUpdate(row, 'warehouseSelection', event.target.value)} className={`${inputClass} ${locationIssue(row) ? 'border-destructive/60 text-destructive' : ''}`}><option value="">Seleccionar ubicación activa</option>{currentLocationOptions(row).map((option) => <option key={`${option.value}-${option.type}`} value={option.value}>{option.value}{option.type === 'INVALID' ? ' · no disponible' : ''}</option>)}</select>{locationContext(row) && <p className="max-w-56 px-1 pt-1 text-[10px] leading-4 text-muted-foreground">{locationContext(row)}</p>}{locationIssue(row) && <p className="max-w-56 px-1 pt-1 text-[10px] leading-4 text-destructive">{locationIssue(row)}</p>}</div>
      <div className="p-1"><Input type="number" min={0} value={String(valueFor(row, 'stock', row.stock) ?? 0)} onChange={(event) => onRowUpdate(row, 'stock', parseImportNumber(event.target.value) ?? 0)} className={`${inputClass} text-right`} /></div>
      <div className="p-1"><Input type="number" min={0} value={String(valueFor(row, 'minStock', 0) ?? 0)} onChange={(event) => onRowUpdate(row, 'minStock', parseImportNumber(event.target.value) ?? 0)} className={`${inputClass} text-right`} /></div>
      <div className="p-1"><select value={String(valueFor(row, 'registerCatalog', 'SI') || 'SI').toUpperCase()} onChange={(event) => onRowUpdate(row, 'registerCatalog', event.target.value)} className={inputClass}><option value="SI">SI</option><option value="NO">NO</option></select></div>
      <div className="px-2 py-2 font-bold">{formatNumber(row.currentQty)}</div>
      <div className="px-2 py-2 font-black text-primary">{formatNumber(row.resultingQty)}</div>
      <div className="px-2 py-2">{renderImageStatus(row)}</div>
      <div className="w-80 px-2 py-2"><div className="min-w-0">{renderStatus(row)}</div><p className={`mt-1 break-words whitespace-normal ${row.issues.length ? 'text-destructive' : 'text-muted-foreground'}`}>{row.issues.join(' · ') || 'Sin observaciones'}</p></div>
    </div>;
  };
  const renderMobileRow = (index: number) => {
    const row = preview.rows[index];
    const category = String(valueFor(row, 'category', '') || '');
    return <div className={`rounded-2xl border bg-card p-3 shadow-sm ${row.issues.length ? 'border-destructive/40 bg-destructive/[0.03]' : 'border-border/60'}`}>
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-sm font-black">{String(valueFor(row, 'code', row.code) || 'Sin SKU')}</p><p className="text-xs text-muted-foreground">Fila {row.rowNumber} · {row.locationLabel || 'Destino por resolver'}</p></div>{renderStatus(row)}</div>
      <div className="mt-2">{renderImageStatus(row)}</div>
      <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Nombre</span><Input value={String(valueFor(row, 'name', row.name) || '')} onChange={(event) => onRowUpdate(row, 'name', event.target.value)} className={inputClass} /></label>
        <label className="space-y-1 sm:col-span-2"><span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Categoría {categoryIsNew(row) && <>{categoryIsPrepared(row) ? <span className="font-normal text-emerald-600">· preparada</span> : <span className="font-normal text-amber-600">· pulsa + para agregar</span>}<Button type="button" variant="ghost" size="icon" className={`size-6 rounded-md ${categoryIsPrepared(row) ? 'text-emerald-600' : 'text-amber-600'}`} onClick={() => onPrepareCategory(category)} aria-label={categoryIsPrepared(row) ? `Categoría ${category} preparada` : `Agregar categoría ${category}`} title={categoryIsPrepared(row) ? 'Categoría preparada para crear al confirmar' : 'Agregar categoría al importador'}>{categoryIsPrepared(row) ? <CheckCircle2 className="size-3.5" /> : <Plus className="size-3.5" />}</Button></>}</span><Input list="manager-import-categories" value={category} onChange={(event) => onRowUpdate(row, 'category', event.target.value)} className={inputClass} /></label>
        <label className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Unidad</span><Input value={String(valueFor(row, 'unit', 'unidad') || '')} onChange={(event) => onRowUpdate(row, 'unit', event.target.value)} className={inputClass} /></label>
        <label className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Costo</span><Input type="number" min={0} value={String(valueFor(row, 'costPrice', row.costPrice ?? '') ?? '')} onChange={(event) => onRowUpdate(row, 'costPrice', parseImportNumber(event.target.value))} className={`${inputClass} text-right`} /></label>
        <label className="space-y-1 sm:col-span-2"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Ubicación destino</span><select value={selectedLocationValue(row)} onChange={(event) => onRowUpdate(row, 'warehouseSelection', event.target.value)} className={`${inputClass} ${locationIssue(row) ? 'border-destructive/60 text-destructive' : ''}`}><option value="">Seleccionar ubicación activa</option>{currentLocationOptions(row).map((option) => <option key={`${option.value}-${option.type}`} value={option.value}>{option.value}{option.type === 'INVALID' ? ' · no disponible' : ''}</option>)}</select>{locationContext(row) && <p className="text-[10px] leading-4 text-muted-foreground">{locationContext(row)}</p>}{locationIssue(row) && <p className="text-[10px] leading-4 text-destructive">{locationIssue(row)}</p>}</label>
        <label className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Stock inicial</span><Input type="number" min={0} value={String(valueFor(row, 'stock', row.stock) ?? 0)} onChange={(event) => onRowUpdate(row, 'stock', parseImportNumber(event.target.value) ?? 0)} className={`${inputClass} text-right`} /></label>
        <label className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Stock mínimo</span><Input type="number" min={0} value={String(valueFor(row, 'minStock', 0) ?? 0)} onChange={(event) => onRowUpdate(row, 'minStock', parseImportNumber(event.target.value) ?? 0)} className={`${inputClass} text-right`} /></label>
        <label className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Registrar catálogo</span><select value={String(valueFor(row, 'registerCatalog', 'SI') || 'SI').toUpperCase()} onChange={(event) => onRowUpdate(row, 'registerCatalog', event.target.value)} className={inputClass}><option value="SI">SI</option><option value="NO">NO</option></select></label>
        <div className="rounded-lg bg-muted/30 p-2 text-xs"><span className="text-muted-foreground">Actual / resultado</span><p className="mt-1 font-black">{formatNumber(row.currentQty)} / <span className="text-primary">{formatNumber(row.resultingQty)}</span></p></div>
      </div>
      <p className={`mt-3 text-xs ${row.issues.length ? 'text-destructive' : 'text-muted-foreground'}`}>{row.issues.join(' · ') || 'Sin observaciones'}</p>
    </div>;
  };

  return <div className="space-y-4 rounded-2xl border border-border/60 p-3 sm:p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">3. Previsualización y normalización</p>
        <p className="mt-1 text-sm text-muted-foreground">{isDirty ? 'Hay cambios editados que todavía deben validarse nuevamente.' : hasErrors ? 'Corrige los campos marcados antes de confirmar.' : 'Todas las filas son válidas y apuntan a ubicaciones activas.'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {isDirty && <Button type="button" variant="outline" size="sm" className="rounded-xl border-amber-500/40 text-amber-700 dark:text-amber-300" onClick={onRevalidate} disabled={isRevalidating}><RefreshCw className={`mr-2 size-3.5 ${isRevalidating ? 'animate-spin' : ''}`} />{isRevalidating ? 'Validando…' : 'Validar cambios'}</Button>}
        <Badge variant={hasErrors ? 'destructive' : 'default'} className="rounded-full">{isDirty ? 'Revisión pendiente' : hasErrors ? `${preview.summary.errorRows} con error` : 'Lista para confirmar'}</Badge>
      </div>
    </div>

    <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
      <Summary label="Filas" value={preview.summary.totalRows} />
      <Summary label="Válidas" value={preview.summary.validRows} />
      <Summary label="Productos" value={preview.summary.products} />
      <Summary label="Ubicaciones" value={preview.summary.locations} />
      <Summary label="Unidades" value={preview.summary.importedUnits} />
      <Summary label="Resultado" value={preview.summary.resultingUnits} />
      <Summary label={`Valor ${preview.currency}`} value={preview.summary.value} />
    </div>

    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.05] p-3 text-xs">
      <ImageIcon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black text-foreground">Vínculo de imágenes por SKU</p>
          <Badge variant={matchedImageCodes.size > 0 ? 'default' : imageArchiveEntries.size ? 'destructive' : 'outline'} className="rounded-full">{imageLinkSummary.label}</Badge>
        </div>
        <p className={`mt-1 ${imageLinkSummary.className}`}>{imageLinkSummary.detail}</p>
      </div>
    </div>

    {isDirty && <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-3 text-xs text-amber-800 dark:text-amber-200"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p>Edita directamente los campos de la tabla. Para una categoría nueva, escríbela y pulsa su botón <span className="font-bold">+</span>; quedará preparada y se creará al confirmar. Luego pulsa <span className="font-bold">Validar cambios</span>. Las bodegas y almacenes no se crean desde esta importación: si falta una ubicación, créala o actívala desde su módulo y vuelve a descargar la plantilla.</p></div>}

    {hasErrors && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">{preview.errors.slice(0, 50).map((error, index) => <p key={`${error}-${index}`} className="flex gap-2 py-0.5"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{error}</p>)}{preview.errors.length > 50 && <p className="pt-1 font-bold">Se muestran los primeros 50 errores.</p>}</div>}

    <div className="hidden items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 lg:flex">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Desplazamiento de la previsualización</p>
        <p className="mt-1 text-xs text-muted-foreground">Usa las flechas para recorrer las columnas sin bajar hasta la tabla.</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => scrollPreviewTable(-1)} disabled={!tableScroll.canScrollLeft} aria-controls="manager-inventory-import-preview-table" aria-label="Desplazar la previsualización hacia la izquierda" title="Desplazar hacia la izquierda">
          <ArrowLeft className="size-4" /><span className="sr-only">Anterior</span>
        </Button>
        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => scrollPreviewTable(1)} disabled={!tableScroll.canScrollRight} aria-controls="manager-inventory-import-preview-table" aria-label="Desplazar la previsualización hacia la derecha" title="Desplazar hacia la derecha">
          <ArrowRight className="size-4" /><span className="sr-only">Siguiente</span>
        </Button>
      </div>
    </div>

    <div ref={tableScrollerRef} id="manager-inventory-import-preview-table" className="hidden min-w-0 max-w-full overflow-x-auto overflow-y-hidden rounded-xl border border-border/60 scrollbar-overlay lg:block">
      <table className="w-full min-w-[2240px] table-fixed text-left text-xs">
        <thead className="bg-muted/40 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <tr><th className="w-14 px-2 py-2">Fila</th><th className="w-32 px-2 py-2">SKU</th><th className="w-56 px-2 py-2">Nombre</th><th className="w-44 px-2 py-2">Categoría</th><th className="w-28 px-2 py-2">Unidad</th><th className="w-32 px-2 py-2">Costo</th><th className="w-56 px-2 py-2">Ubicación destino</th><th className="w-28 px-2 py-2">Stock</th><th className="w-28 px-2 py-2">Mínimo</th><th className="w-32 px-2 py-2">Catálogo</th><th className="w-28 px-2 py-2">Actual</th><th className="w-28 px-2 py-2">Resultado</th><th className="w-60 px-2 py-2">Imagen por SKU</th><th className="w-80 px-2 py-2">Estado / observación</th></tr>
        </thead>
        <tbody>
          {preview.rows.slice(0, 0).map((row) => {
            const category = String(valueFor(row, 'category', '') || '');
            return <tr key={`${row.rowNumber}-${row.code}-${row.warehouseId}`} className="border-t border-border/50 align-top">
              <td className="px-2 py-2 text-muted-foreground">{row.rowNumber}</td>
              <td className="p-1"><Input value={String(valueFor(row, 'code', row.code) || '')} onChange={(event) => onRowUpdate(row, 'code', event.target.value)} className={`${inputClass} font-mono`} /></td>
              <td className="p-1"><Input value={String(valueFor(row, 'name', row.name) || '')} onChange={(event) => onRowUpdate(row, 'name', event.target.value)} className={inputClass} /></td>
              <td className="p-1"><div className="flex min-w-0 items-center gap-1"><Input list="manager-import-categories" value={category} onChange={(event) => onRowUpdate(row, 'category', event.target.value)} className={`${inputClass} ${categoryIsNew(row) ? 'border-amber-500/60' : ''}`} />{categoryIsNew(row) && <Button type="button" variant="ghost" size="icon" className={`size-8 shrink-0 rounded-lg ${categoryIsPrepared(row) ? 'text-emerald-600' : 'text-amber-600'}`} onClick={() => onPrepareCategory(category)} aria-label={categoryIsPrepared(row) ? `Categoría ${category} preparada` : `Agregar categoría ${category}`} title={categoryIsPrepared(row) ? 'Categoría preparada para crear al confirmar' : 'Agregar categoría al importador'}>{categoryIsPrepared(row) ? <CheckCircle2 className="size-4" /> : <Plus className="size-4" />}</Button>}</div></td>
              <td className="p-1"><Input value={String(valueFor(row, 'unit', 'unidad') || '')} onChange={(event) => onRowUpdate(row, 'unit', event.target.value)} className={inputClass} /></td>
              <td className="p-1"><Input type="number" min={0} value={String(valueFor(row, 'costPrice', row.costPrice ?? '') ?? '')} onChange={(event) => onRowUpdate(row, 'costPrice', parseImportNumber(event.target.value))} className={`${inputClass} text-right`} /></td>
              <td className="p-1"><select value={selectedLocationValue(row)} onChange={(event) => onRowUpdate(row, 'warehouseSelection', event.target.value)} className={`${inputClass} ${locationIssue(row) ? 'border-destructive/60 text-destructive' : ''}`}><option value="">Seleccionar ubicación activa</option>{currentLocationOptions(row).map((option) => <option key={`${option.value}-${option.type}`} value={option.value}>{option.value}{option.type === 'INVALID' ? ' · no disponible' : ''}</option>)}</select>{locationContext(row) && <p className="max-w-56 px-1 pt-1 text-[10px] leading-4 text-muted-foreground">{locationContext(row)}</p>}{locationIssue(row) && <p className="max-w-56 px-1 pt-1 text-[10px] leading-4 text-destructive">{locationIssue(row)}</p>}</td>
              <td className="p-1"><Input type="number" min={0} value={String(valueFor(row, 'stock', row.stock) ?? 0)} onChange={(event) => onRowUpdate(row, 'stock', parseImportNumber(event.target.value) ?? 0)} className={`${inputClass} text-right`} /></td>
              <td className="p-1"><Input type="number" min={0} value={String(valueFor(row, 'minStock', 0) ?? 0)} onChange={(event) => onRowUpdate(row, 'minStock', parseImportNumber(event.target.value) ?? 0)} className={`${inputClass} text-right`} /></td>
              <td className="p-1"><select value={String(valueFor(row, 'registerCatalog', 'SI') || 'SI').toUpperCase()} onChange={(event) => onRowUpdate(row, 'registerCatalog', event.target.value)} className={inputClass}><option value="SI">SI</option><option value="NO">NO</option></select></td>
              <td className="px-2 py-2 font-bold">{formatNumber(row.currentQty)}</td>
              <td className="px-2 py-2 font-black text-primary">{formatNumber(row.resultingQty)}</td>
              <td className="px-2 py-2">{renderImageStatus(row)}</td>
              <td className="w-80 px-2 py-2"><div className="min-w-0">{renderStatus(row)}</div><p className={`mt-1 break-words whitespace-normal ${row.issues.length ? 'text-destructive' : 'text-muted-foreground'}`}>{row.issues.join(' · ') || 'Sin observaciones'}</p></td>
            </tr>;
          })}
        </tbody>
      </table>
      <VirtualizedImportList count={preview.rows.length} estimateSize={86} className="h-[min(60vh,42rem)] min-w-[2240px]" renderItem={renderDesktopRow} />
      <p className="px-3 py-2 text-xs text-muted-foreground">Mostrando las {preview.rows.length} filas; solo se dibujan las visibles para mantener fluida la previsualización.</p>
    </div>

    <div className="space-y-3 lg:hidden">
      {preview.rows.slice(0, 0).map((row) => {
        const category = String(valueFor(row, 'category', '') || '');
        return <div key={`${row.rowNumber}-${row.code}-${row.warehouseId}`} className={`rounded-2xl border bg-card p-3 shadow-sm ${row.issues.length ? 'border-destructive/40 bg-destructive/[0.03]' : 'border-border/60'}`}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-sm font-black">{String(valueFor(row, 'code', row.code) || 'Sin SKU')}</p><p className="text-xs text-muted-foreground">Fila {row.rowNumber} · {row.locationLabel || 'Destino por resolver'}</p></div>{renderStatus(row)}</div>
          <div className="mt-2">{renderImageStatus(row)}</div>
          <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Nombre</span><Input value={String(valueFor(row, 'name', row.name) || '')} onChange={(event) => onRowUpdate(row, 'name', event.target.value)} className={inputClass} /></label>
            <label className="space-y-1 sm:col-span-2"><span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Categoría {categoryIsNew(row) && <>{categoryIsPrepared(row) ? <span className="font-normal text-emerald-600">· preparada</span> : <span className="font-normal text-amber-600">· pulsa + para agregar</span>}<Button type="button" variant="ghost" size="icon" className={`size-6 rounded-md ${categoryIsPrepared(row) ? 'text-emerald-600' : 'text-amber-600'}`} onClick={() => onPrepareCategory(category)} aria-label={categoryIsPrepared(row) ? `Categoría ${category} preparada` : `Agregar categoría ${category}`} title={categoryIsPrepared(row) ? 'Categoría preparada para crear al confirmar' : 'Agregar categoría al importador'}>{categoryIsPrepared(row) ? <CheckCircle2 className="size-3.5" /> : <Plus className="size-3.5" />}</Button></>}</span><Input list="manager-import-categories" value={category} onChange={(event) => onRowUpdate(row, 'category', event.target.value)} className={inputClass} /></label>
            <label className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Unidad</span><Input value={String(valueFor(row, 'unit', 'unidad') || '')} onChange={(event) => onRowUpdate(row, 'unit', event.target.value)} className={inputClass} /></label>
            <label className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Costo</span><Input type="number" min={0} value={String(valueFor(row, 'costPrice', row.costPrice ?? '') ?? '')} onChange={(event) => onRowUpdate(row, 'costPrice', parseImportNumber(event.target.value))} className={`${inputClass} text-right`} /></label>
            <label className="space-y-1 sm:col-span-2"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Ubicación destino</span><select value={selectedLocationValue(row)} onChange={(event) => onRowUpdate(row, 'warehouseSelection', event.target.value)} className={`${inputClass} ${locationIssue(row) ? 'border-destructive/60 text-destructive' : ''}`}><option value="">Seleccionar ubicación activa</option>{currentLocationOptions(row).map((option) => <option key={`${option.value}-${option.type}`} value={option.value}>{option.value}{option.type === 'INVALID' ? ' · no disponible' : ''}</option>)}</select>{locationContext(row) && <p className="text-[10px] leading-4 text-muted-foreground">{locationContext(row)}</p>}{locationIssue(row) && <p className="text-[10px] leading-4 text-destructive">{locationIssue(row)}</p>}</label>
            <label className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Stock inicial</span><Input type="number" min={0} value={String(valueFor(row, 'stock', row.stock) ?? 0)} onChange={(event) => onRowUpdate(row, 'stock', parseImportNumber(event.target.value) ?? 0)} className={`${inputClass} text-right`} /></label>
            <label className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Stock mínimo</span><Input type="number" min={0} value={String(valueFor(row, 'minStock', 0) ?? 0)} onChange={(event) => onRowUpdate(row, 'minStock', parseImportNumber(event.target.value) ?? 0)} className={`${inputClass} text-right`} /></label>
            <label className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Registrar catálogo</span><select value={String(valueFor(row, 'registerCatalog', 'SI') || 'SI').toUpperCase()} onChange={(event) => onRowUpdate(row, 'registerCatalog', event.target.value)} className={inputClass}><option value="SI">SI</option><option value="NO">NO</option></select></label>
            <div className="rounded-lg bg-muted/30 p-2 text-xs"><span className="text-muted-foreground">Actual / resultado</span><p className="mt-1 font-black">{formatNumber(row.currentQty)} / <span className="text-primary">{formatNumber(row.resultingQty)}</span></p></div>
          </div>
          <p className={`mt-3 text-xs ${row.issues.length ? 'text-destructive' : 'text-muted-foreground'}`}>{row.issues.join(' · ') || 'Sin observaciones'}</p>
        </div>;
      })}
    </div>
    <datalist id="manager-import-categories">{categoryOptions.map((category) => <option key={category.id} value={category.name} />)}</datalist>
    <div className="min-w-0 max-w-full lg:hidden">
      <VirtualizedImportList count={preview.rows.length} estimateSize={430} className="h-[min(70vh,48rem)] min-w-0 max-w-full space-y-3" renderItem={renderMobileRow} />
      <p className="text-xs text-muted-foreground">Mostrando las {preview.rows.length} filas; solo se dibujan las visibles para mantener fluida la previsualización.</p>
    </div>
  </div>;
}

function Summary({ label, value }: { label: string; value: unknown }) {
  return <div className="min-w-0 rounded-xl bg-muted/30 p-2.5"><p className="truncate text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-black tabular-nums">{formatNumber(value)}</p></div>;
}
