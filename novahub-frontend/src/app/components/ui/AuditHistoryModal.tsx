import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { ScrollArea } from './scroll-area';
import { api } from '../../services/api';
import { History, User as UserIcon, Calendar, Info } from 'lucide-react';
import { Badge } from './badge';
import { cn } from './utils';
import { formatDateOnly, formatInstant } from '../../utils/dateFormat';
import { getAuditOperationMethodLabel } from './audit-operation-method';

interface AuditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: string;
  entityId: string;
  title?: string;
  presentation?: 'dialog' | 'inline';
  logs?: any[];
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  UPDATE: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  DELETE: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  ARCHIVE: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  STATUS_CHANGE: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  PAYMENT: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  INVENTORY_AUDIT: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  DUPLICATE_OVERRIDE: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

const actionLabels: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  ARCHIVE: 'Archivado',
  STATUS_CHANGE: 'Cambio de Estado',
  PAYMENT: 'Pago',
  INVENTORY_AUDIT: 'Auditoría de inventario',
  DUPLICATE_OVERRIDE: 'Continuación tras advertencia de duplicado',
  QUOTATION_CREATED: 'Cotización Creada',
  SUBQUOTATION_CREATED: 'Subcotización Creada',
  SUBQUOTATION_SUBMITTED: 'Subcotización Enviada',
  SUBQUOTATION_RECEIVED: 'Subcotización Recibida',
  SUBQUOTATION_OVERWRITTEN: 'Subcotización Sobrescrita',
  SUBQUOTATION_DISMISSED: 'Sobrescritura Descartada',
  SUBQUOTATION_REGENERATED: 'Enlace Regenerado',
  OFFER_SELECTED: 'Oferta Seleccionada',
  MANUAL_FILL: 'Llenado Manual',
  PUBLIC_LINK_CREATED: 'Enlace Público Creado',
  PUBLIC_LINK_REVOKED: 'Enlace Público Revocado',
  PROGRESS_CAPTURE_ADDED: 'Evidencia Registrada',
  TERMS_ACCEPTED: 'Términos Aceptados',
  TASK_CREATED: 'Tarea Creada',
  TASK_COMPLETED: 'Tarea Completada',
  MILESTONE_CREATED: 'Hito Creado',
  MILESTONE_COMPLETED: 'Hito Completado',
  STAGE_CREATED: 'Etapa Creada',
  STAGE_UPDATED: 'Etapa Actualizada',
  IMPORT: 'Importación',
  APPROVE: 'Aprobación',
  REJECT: 'Rechazo',
  SUBMIT: 'Envío',
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  STATUS_CHANGED: 'Cambio de estado',
  PRIORITY_CHANGED: 'Cambio de prioridad',
  ASSIGNED_CHANGED: 'Cambio de responsable',
  TICKET_CREATED: 'Ticket creado',
  UPLOAD: 'Archivo adjunto',
  DOWNLOAD: 'Descarga',
  COMMENT_ADDED: 'Comentario agregado',
  ATTACHMENT_ADDED: 'Archivo adjunto',
};

const detailKeyLabels: Record<string, string> = {
  id: 'Identificador',
  number: 'Número',
  customerId: 'Cliente',
  customerName: 'Nombre del cliente',
  customerEmail: 'Correo del cliente',
  customerPhone: 'Teléfono del cliente',
  warehouseId: 'Almacén',
  warehouseName: 'Nombre del almacén',
  supplierId: 'Proveedor',
  purchaseOrderId: 'Orden de compra',
  salesOrderId: 'Orden de venta',
  estimateId: 'Cotización',
  invoiceId: 'Factura',
  creditNoteId: 'Nota de crédito',
  paymentId: 'Pago',
  productId: 'Producto',
  itemId: 'Artículo',
  employeeId: 'Empleado',
  sellerEmployeeId: 'Vendedor',
  sellerName: 'Nombre del vendedor',
  accountId: 'Cuenta contable',
  clientTenantId: 'Empresa',
  registerId: 'Caja',
  sessionId: 'Sesión',
  date: 'Fecha',
  dueDate: 'Fecha de vencimiento',
  expectedDelivery: 'Entrega esperada',
  invoicedAt: 'Fecha de facturación',
  createdAt: 'Fecha de creación',
  updatedAt: 'Fecha de actualización',
  createdById: 'Creado por',
  updatedById: 'Actualizado por',
  inventoryProcessedAt: 'Fecha de procesamiento de inventario',
  subtotal: 'Subtotal',
  taxAmount: 'Impuesto',
  discountAmount: 'Descuento',
  total: 'Total',
  baseTotal: 'Total base',
  amountPaid: 'Monto pagado',
  balance: 'Saldo',
  currency: 'Moneda',
  exchangeRate: 'Tasa de cambio',
  notes: 'Notas',
  items: 'Artículos',
  itemCount: 'Cantidad de artículos',
  priceListId: 'Lista de precios',
  commission: 'Comisión',
  commissionRate: 'Tasa de comisión',
  commissionType: 'Tipo de comisión',
  commissionAmount: 'Monto de comisión',
  seller: 'Vendedor',
  customer: 'Cliente',
  warehouse: 'Almacén',
  code: 'Código',
  type: 'Tipo',
  email: 'Correo electrónico',
  phone: 'Teléfono',
  contactPhone: 'Teléfono de contacto',
  phoneNumber: 'Número de teléfono',
  phoneCountryCode: 'Código de país del teléfono',
  countryCode: 'Código de país',
  country: 'País',
  city: 'Ciudad',
  state: 'Departamento o estado',
  postalCode: 'Código postal',
  firstName: 'Nombre',
  lastName: 'Apellido',
  companyName: 'Nombre de la empresa',
  businessName: 'Nombre comercial',
  legalName: 'Razón social',
  contactName: 'Persona de contacto',
  contactEmail: 'Correo de contacto',
  mobile: 'Teléfono móvil',
  website: 'Sitio web',
  websiteUrl: 'Sitio web',
  delivery: 'Delivery',
  deliveryType: 'Tipo de delivery',
  deliveryMethod: 'Método de delivery',
  deliveryAddress: 'Dirección de entrega',
  deliveryDate: 'Fecha de entrega',
  deliveryInstructions: 'Instrucciones de entrega',
  address: 'Dirección',
  taxId: 'Identificación fiscal',
  ruc: 'RUC',
  fiscalRegime: 'Régimen fiscal',
  creditLimit: 'Límite de crédito',
  creditDays: 'Días de crédito',
  creditTerms: 'Condiciones de crédito',
  paymentTerms: 'Condiciones de pago',
  previousStatus: 'Estado anterior',
  newStatus: 'Estado nuevo',
  source: 'Origen',
  origin: 'Origen',
  flow: 'Flujo',
  from: 'Estado anterior',
  to: 'Estado nuevo',
  price_list: 'Lista de precios',
  commercial_changes: 'Cambios comerciales',
  bulk_import: 'Importación masiva',
  fieldsUpdated: 'Campos actualizados',
  fromOrder: 'Orden de venta de origen',
  fromEstimate: 'Cotización de origen',
  status: 'Estado',
  reason: 'Motivo',
  amount: 'Monto',
  name: 'Nombre',
  fields_updated: 'Campos actualizados',
  warehouses: 'Bodegas',
  warehouseCount: 'Cantidad de bodegas',
  initialStock: 'Stock inicial',
  copiedFrom: 'Producto original',
  sourceCode: 'Código original',
  auditId: 'Auditoría',
  auditNumber: 'Número de acta',
  auditDate: 'Fecha de auditoría',
  systemStock: 'Stock del sistema',
  countedStock: 'Stock contado',
  difference: 'Diferencia',
  confirmedCandidateIds: 'Ventas similares confirmadas',
  similarSales: 'Ventas similares detectadas',
  matchedCriteria: 'Criterios coincidentes',
  candidateIds: 'Ventas similares',
  paymentMethod: 'Forma de pago',
  paymentDetails: 'Detalles del pago',
  irRate: 'IR (%)',
  irTaxId: 'IR Identificación fiscal',
  irAmount: 'IR Monto',
  customCustomerName: 'Nombre personalizado del cliente',
  customCustomerEmail: 'Correo personalizado del cliente',
  customCustomerPhone: 'Teléfono personalizado del cliente',
  sourceType: 'Tipo de origen',
  sourceLabel: 'Etiqueta de origen',
  salesReturnId: 'Nota de crédito',
  appliedToInvoice: 'Aplicado a factura',
  costPrice: 'Precio de costo',
  salePrice: 'Precio de venta',
  description: 'Descripción',
  quantity: 'Cantidad',
  unitPrice: 'Precio unitario',
  taxRate: 'Tasa de impuesto',
  discount: 'Descuento',
  customerType: 'Tipo de cliente',
  identificationType: 'Tipo de identificación',
  nationalId: 'Identificación nacional',
  documentType: 'Tipo de documento',
  operationMethod: 'Método de operación',
  branchId: 'Sucursal',
  branchName: 'Nombre de la sucursal',
  companyId: 'Empresa',
  categoryId: 'Categoría',
  categoryName: 'Nombre de la categoría',
  isActive: 'Activo',
  isEnabled: 'Habilitado',
  startDate: 'Fecha de inicio',
  endDate: 'Fecha de finalización',
  effectiveDate: 'Fecha de vigencia',
  expirationDate: 'Fecha de vencimiento',
  validUntil: 'Válido hasta',
  paymentDate: 'Fecha de pago',
  reference: 'Referencia',
  referenceNumber: 'Número de referencia',
  bankAccountId: 'Cuenta bancaria',
  branch: 'Sucursal',
  countryIsoCode: 'Código de país',
};

const detailValueLabels: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  ARCHIVE: 'Archivado',
  PENDING: 'Pendiente',
  READY: 'Listo',
  WITH_INCIDENTS: 'Recibida con incidencias',
  PAID: 'Pagada',
  PARTIAL: 'Parcial',
  CANCELLED: 'Anulada',
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmada',
  SHIPPED: 'Enviada',
  OVERDUE: 'Vencida',
  EARNED: 'Devengada',
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  PENDING_REVIEW: 'Pendiente de revisión',
  IN_PROGRESS: 'En proceso',
  DELIVERED: 'Entregada',
  SENT: 'Enviada',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  PROCESSED: 'Procesada',
  ISSUED: 'Emitida',
  APPLIED: 'Aplicada',
  VOIDED: 'Anulada',
  PAUSED: 'Pausada',
  EXPIRED: 'Finalizada',
  COMPLETED: 'Completada',
  PURCHASE_ORDER: 'Orden de compra',
  PURCHASE_REQUEST_APPROVAL: 'Aprobación de solicitud de compra',
  PURCHASE_RECEIPT: 'Recepción de compra',
  DIRECT: 'Registro directo',
  OPEN: 'Abierto',
  RESOLVED: 'Resuelto',
  IN_REVIEW: 'En revisión',
  DISBURSED: 'Desembolsado',
  RECEIVED: 'Recibida',
  REFUNDED: 'Reembolsada',
  AVAILABLE: 'Disponible',
  IN_STOCK: 'En existencia',
  PRODUCT: 'Producto',
  SERVICE: 'Servicio',
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  CHECK: 'Cheque',
  PERCENTAGE: 'Porcentaje',
  FIXED: 'Monto fijo',
  true: 'Sí',
  false: 'No',
  BULK_IMPORT: 'Importación masiva',
  MANUAL: 'Manual',
  IMPORT: 'Importación',
  SYSTEM: 'Sistema',
  WEB: 'Web',
  POS: 'POS',
  DELIVERY: 'Delivery',
  NO_PAYMENT: 'Sin cobro',
  USD: 'USD',
  NIO: 'NIO',
  ENABLED: 'Habilitado',
  DISABLED: 'Deshabilitado',
  COMPANY: 'Empresa',
  INDIVIDUAL: 'Particular',
  MANAGER: 'Gerente',
  ADMIN: 'Administrador',
  FULL_TIME: 'Tiempo completo',
  PART_TIME: 'Medio tiempo',
  CONTRACTOR: 'Contratista',
  INTERN: 'Pasante',
  TEMPORARY: 'Temporal',
  MONTHLY: 'Mensual',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quincenal',
  DAILY: 'Diario',
  HOURLY: 'Por hora',
  MALE: 'Masculino',
  FEMALE: 'Femenino',
  OTHER: 'Otro',
  SUCCESS: 'Correcto',
  FAILURE: 'Fallido',
};

const normalizeAuditToken = (value: string) => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
const normalizedDetailKeyLabels = new Map(Object.entries(detailKeyLabels).map(([key, label]) => [normalizeAuditToken(key), label]));
const normalizedDetailValueLabels = new Map(Object.entries(detailValueLabels).map(([key, label]) => [normalizeAuditToken(key), label]));

const isInternalDetail = (key: string, value?: unknown) => {
  const normalizedKey = String(key || '');
  if (normalizedKey === 'operationMethod') return true;
  // Los identificadores internos sirven para trazabilidad técnica, pero no
  // deben llenar la auditoría visible con UUID largos.
  if (normalizedKey === 'id' || normalizedKey === 'clientTenantId' || /(?:Id|ID)$/.test(normalizedKey)) return true;
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

const isDateDetail = (key?: string) => Boolean(key && /(?:date|at)$/i.test(key));
const isStatusDetail = (key?: string) => Boolean(key && /(?:status|state|estado|^from$|^to$)/i.test(key));

/** Traduce claves de auditoría; las claves técnicas desconocidas se ocultan como dato actualizado. */
export function translateAuditDetailKey(key: string): string {
  const readableKey = String(key || '').trim();
  const normalized = normalizeAuditToken(key);
  return normalizedDetailKeyLabels.get(normalized)
    || normalizedDetailValueLabels.get(normalized)
    || (/^[a-z][a-z0-9_.-]*$/i.test(readableKey) ? 'Campo actualizado' : readableKey || 'Campo actualizado');
}

/** Convierte listas de campos cambiados en etiquetas legibles y separadas. */
export function formatAuditChangedFields(value: unknown): string {
  const fields = Array.isArray(value)
    ? value.map((field) => String(field || '').trim()).filter(Boolean)
    : typeof value === 'string'
      ? value.split(/[,|;\n]+/).map((field) => field.trim()).filter(Boolean)
      : [];
  if (!fields.length) return '';
  if (fields.length === 1 && fields[0] === value && translateAuditDetailKey(fields[0]) === 'Campo actualizado') return 'Campos actualizados';
  return [...new Set(fields.map(translateAuditDetailKey))].join(', ');
}

/** Traduce valores de auditoría y evita exponer enums desconocidos de la base de datos. */
export function translateAuditDetailValue(value: unknown, contextKey?: string, timeZone = 'UTC'): string {
  if (value === null || value === undefined || value === '') return '—';
  if (contextKey && /^(?:fieldsUpdated|fields_updated|changedFields|updatedFields)$/i.test(contextKey)) {
    return formatAuditChangedFields(value) || 'Campos actualizados';
  }
  if (Array.isArray(value)) return value.map((item) => translateAuditDetailValue(item, contextKey, timeZone)).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key, nestedValue]) => !isInternalDetail(key, nestedValue))
      .map(([key, nestedValue]) => `${translateAuditDetailKey(key)}: ${translateAuditDetailValue(nestedValue, key, timeZone)}`)
      .join(' · ');
  }
  const stringValue = String(value);
  if (isDateDetail(contextKey) && !Number.isNaN(new Date(stringValue).getTime())) {
    return /At$/i.test(String(contextKey || ''))
      ? formatInstant(stringValue, timeZone)
      : formatDateOnly(stringValue);
  }
  const normalizedValue = normalizeAuditToken(stringValue);
  const translated = normalizedDetailValueLabels.get(normalizedValue) || normalizedDetailKeyLabels.get(normalizedValue);
  if (translated) return translated;
  if (isStatusDetail(contextKey)) return 'Estado registrado';
  if (/^[A-Z][A-Z0-9_]*$/.test(stringValue)) return 'Valor registrado';
  return stringValue;
}

export const translateAuditAction = (action?: string): string => {
  if (!action) return 'Actividad registrada';
  const normalizedAction = String(action).trim().toUpperCase();
  return actionLabels[normalizedAction] || 'Actividad registrada';
};

export function AuditHistoryModal({ isOpen, onClose, entity, entityId, title = 'Historial de Cambios', presentation = 'dialog', logs: providedLogs }: AuditHistoryModalProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get<any[]>(`/audit/entity/${entity}/${entityId}`);
      const nextLogs = Array.isArray(res) ? res : [];
      setLogs([...nextLogs].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()));
    } catch (e: any) {
      console.error('Error fetching audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (providedLogs !== undefined) {
      setLoading(false);
      return;
    }
    if (isOpen && entity && entityId) {
      const load = async () => {
        setLoading(true);
        await fetchLogs();
      };
      load();
    }
  }, [isOpen, entity, entityId, providedLogs]);

  const parseDetails = (details: string | null) => {
    if (!details) return null;
    try {
      return JSON.parse(details);
    } catch {
      return details;
    }
  };

  const translateKey = translateAuditDetailKey;
  const translateValue = translateAuditDetailValue;

  const historyEntries = (
    <div className="space-y-4">
      {(providedLogs ?? logs).map((log) => {
        const timeZone = log.timeZone || 'UTC';
        const detailsObj = parseDetails(log.details);
        const visibleDetailEntries = detailsObj && typeof detailsObj === 'object' && !Array.isArray(detailsObj)
          ? Object.entries(detailsObj).filter(([key, value]) => !isInternalDetail(key, value))
          : [];
        return (
          <div key={log.id} className="relative pl-6 pb-4 border-l-2 border-primary/20 last:border-transparent last:pb-0">
            <div className="absolute left-[-5px] top-0 size-2.5 rounded-full bg-primary ring-4 ring-background" />
            <div className="-mt-1.5 p-4 rounded-2xl bg-card border border-border/40 shadow-sm relative overflow-hidden group">
              <div className="relative z-10 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline" className={cn(
                    "text-[9px] font-black uppercase tracking-widest border",
                    actionColors[log.action] || 'bg-muted/20 text-muted-foreground'
                  )}>
                    {translateAuditAction(log.action)}
                  </Badge>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                    <Calendar className="size-3" />
                    {formatInstant(log.createdAt, timeZone)} ({timeZone})
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <UserIcon className="size-3.5 text-muted-foreground" />
                    {log.user?.name || (log.userId ? 'Usuario no disponible' : 'Sistema automático')}
                  </div>
                  {log.user?.email && <p className="text-[10px] text-muted-foreground pl-5">{log.user.email}</p>}
                  <p className="mt-1 pl-5 text-[10px] font-semibold text-muted-foreground">Vía: {getAuditOperationMethodLabel(log)}</p>
                </div>
                {detailsObj && (typeof detailsObj !== 'object' || visibleDetailEntries.length > 0) && (
                  <div className="bg-muted/20 p-3 rounded-xl border border-border/30 mt-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                      <Info className="size-3" /> Detalles:
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      {typeof detailsObj === 'object' ? (
                        <ul className="list-disc list-inside space-y-1">
                          {visibleDetailEntries.map(([key, value]) => (
                            <li key={key}>
                              <span className="font-bold text-foreground">{translateKey(key)}:</span> {translateValue(value, key, timeZone)}
                            </li>
                          ))}
                        </ul>
                      ) : <p>{detailsObj}</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const historyBody = (
    <div className="mt-4">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (providedLogs ?? logs).length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border/50 rounded-2xl bg-muted/10">
          <History className="size-8 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-xs font-bold text-muted-foreground">No hay registros de auditoría para este elemento.</p>
        </div>
      ) : (
        presentation === 'inline' ? historyEntries : <ScrollArea className="h-[400px] pr-4">{historyEntries}</ScrollArea>
      )}
    </div>
  );

  if (presentation === 'inline') return historyBody;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] border-border/50 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
            <History className="size-5 text-primary" />
            {title}
          </DialogTitle>
          <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/60">
            Registro de actividades y modificaciones
          </p>
        </DialogHeader>

        {historyBody}
      </DialogContent>
    </Dialog>
  );
}
