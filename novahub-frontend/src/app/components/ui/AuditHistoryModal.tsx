import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { ScrollArea } from './scroll-area';
import { api } from '../../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { History, User as UserIcon, Calendar, Info } from 'lucide-react';
import { Badge } from './badge';
import { cn } from './utils';

interface AuditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: string;
  entityId: string;
  title?: string;
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  UPDATE: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  DELETE: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  STATUS_CHANGE: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  PAYMENT: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  DUPLICATE_OVERRIDE: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

const actionLabels: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  STATUS_CHANGE: 'Cambio de Estado',
  PAYMENT: 'Pago',
  DUPLICATE_OVERRIDE: 'Continuación tras advertencia de duplicado',
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
  address: 'Dirección',
  taxId: 'Identificación fiscal',
  ruc: 'RUC',
  fiscalRegime: 'Régimen fiscal',
  creditLimit: 'Límite de crédito',
  previousStatus: 'Estado anterior',
  newStatus: 'Estado nuevo',
  source: 'Origen',
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
  confirmedCandidateIds: 'Ventas similares confirmadas',
  similarSales: 'Ventas similares detectadas',
  matchedCriteria: 'Criterios coincidentes',
  candidateIds: 'Ventas similares',
};

const detailValueLabels: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  PENDING: 'Pendiente',
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
};

export function AuditHistoryModal({ isOpen, onClose, entity, entityId, title = 'Historial de Cambios' }: AuditHistoryModalProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && entity && entityId) {
      fetchLogs();
    }
  }, [isOpen, entity, entityId]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get<any[]>(`/audit/entity/${entity}/${entityId}`);
      setLogs(Array.isArray(res) ? res : []);
    } catch (e: any) {
      console.error('Error fetching audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  const parseDetails = (details: string | null) => {
    if (!details) return null;
    try {
      return JSON.parse(details);
    } catch {
      return details;
    }
  };

  const translateKey = (key: string) => detailKeyLabels[key] || detailValueLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());

  const translateValue = (value: unknown, contextKey?: string): string => {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return value.map((item) => translateValue(item, contextKey)).join(', ');
    if (typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>)
        .map(([key, nestedValue]) => `${translateKey(key)}: ${translateValue(nestedValue, key)}`)
        .join(' · ');
    }
    const stringValue = String(value);
    if (contextKey === 'fields_updated' || contextKey === 'fieldsUpdated') {
      return stringValue.split(',').map((field) => translateKey(field.trim())).join(', ');
    }
    return detailValueLabels[stringValue] || detailKeyLabels[stringValue] || stringValue;
  };

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

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border/50 rounded-2xl bg-muted/10">
              <History className="size-8 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-xs font-bold text-muted-foreground">No hay registros de auditoría para este elemento.</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {logs.map((log) => {
                  const detailsObj = parseDetails(log.details);
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
                              {actionLabels[log.action] || log.action}
                            </Badge>
                            
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                              <Calendar className="size-3" />
                              {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                              <UserIcon className="size-3.5 text-muted-foreground" />
                              {log.user ? log.user.name : 'Sistema automático'}
                            </div>
                            {log.user?.email && (
                              <p className="text-[10px] text-muted-foreground pl-5">{log.user.email}</p>
                            )}
                          </div>

                          {detailsObj && (
                            <div className="bg-muted/20 p-3 rounded-xl border border-border/30 mt-1">
                              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                                <Info className="size-3" /> Detalles:
                              </div>
                              <div className="text-xs font-mono text-muted-foreground">
                                {typeof detailsObj === 'object' ? (
                                  <ul className="list-disc list-inside space-y-1">
                                    {Object.entries(detailsObj).map(([key, value]) => (
                                        <li key={key}>
                                          <span className="font-bold text-foreground">{translateKey(key)}:</span> {translateValue(value, key)}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p>{detailsObj}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
