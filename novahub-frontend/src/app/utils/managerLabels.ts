const MANAGER_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abierto', IN_PROGRESS: 'En proceso', IN_PROCESS: 'En proceso', RESOLVED: 'Resuelto', CLOSED: 'Cerrado',
  PENDING: 'Pendiente', PENDING_REVIEW: 'Pendiente de revisión', PENDING_APPROVAL: 'Pendiente de aprobación',
  PENDING_CONFIRMATION: 'Pendiente de confirmación', CANCELLED: 'Cancelado', COMPLETED: 'Completado',
  DRAFT: 'Borrador', PLANNED: 'Planificado', PAUSED: 'En pausa', SCHEDULED: 'Programado',
  WAITING_DOCS: 'Esperando documentos', APPROVED: 'Aprobado', REJECTED: 'Rechazado', DISBURSED: 'Desembolsado',
  IN_REVIEW: 'En revisión', CONFIRMED: 'Confirmado', SENT_TO_KITCHEN: 'Enviado a cocina', IN_PREPARATION: 'En preparación',
  READY: 'Listo', SERVED: 'Servido', PARTIALLY_PAID: 'Pago parcial', PAID: 'Pagado', PARTIAL: 'Parcial',
  AVAILABLE: 'Disponible', OCCUPIED: 'Ocupada', RESERVED: 'Reservada', CLEANING: 'Limpieza', INACTIVE: 'Inactiva', ACTIVE: 'Activo',
  RECEIVED: 'Recibido', IN_TRANSIT: 'En tránsito', CUSTOMS: 'Aduana', OUT_FOR_DELIVERY: 'En reparto', DELIVERED: 'Entregado',
  RETURNED: 'Devuelto', ON_HOLD: 'En espera', LOST: 'Extraviado', NONE: 'Pendiente', PURCHASED: 'Conciliado',
  AVAILABLE_FOR_BILLING: 'Disponible para facturar', BILLED: 'Facturado', PUBLISHED: 'Publicado', ARCHIVED: 'Archivado',
  COMMITTED: 'Comprometido', EXECUTED: 'Ejecutado', NO_PAYMENT: 'Sin cobro', COUNTING: 'En conteo', ISSUED: 'Emitido',
  REVERSED: 'Revertido', REFACTURED: 'Refacturado', CREDIT_NOTE: 'Nota de crédito', POSTED: 'Contabilizado', VOIDED: 'Anulado',
  SENT: 'Enviado', SHIPPED: 'Enviado', REOPENED: 'Reabierto', EARNED: 'Generado', ON_LEAVE: 'En permiso',
  DEPRECIATED: 'Depreciado', DISPOSED: 'Dado de baja', LOCKED: 'Bloqueado', FINAL: 'Finalizado', SUBMITTED: 'Enviado',
  SUSPENDED: 'Suspendido', PREVIEW: 'Vista previa', OVERDUE: 'Vencido', PROCESSED: 'Procesado', EXPIRED: 'Vencido',
  PRESENT: 'Presente', ABSENT: 'Ausente', LATE: 'Tardanza', REMOTE: 'Remoto', HALF_DAY: 'Medio día',
  RETURNED_FOR_CORRECTION: 'Devuelto para corrección', CONVERTED_TO_ORDER: 'Convertido a orden', IN_QUOTATION: 'En cotización',
  IN: 'Entrada', OUT: 'Salida', TRANSFER_IN: 'Transferencia de entrada', TRANSFER_OUT: 'Transferencia de salida', ADJUSTMENT: 'Ajuste', DEBIT: 'Débito', CREDIT: 'Crédito',
  CASH: 'Efectivo', TRANSFER: 'Transferencia', BANK: 'Banco', BANK_TRANSFER: 'Transferencia bancaria', CHECK: 'Cheque', CARD: 'Tarjeta',
  CREDIT_CARD: 'Tarjeta de crédito', DEBIT_CARD: 'Tarjeta de débito', OTHER: 'Otro', REFUNDED: 'Reembolsado',
  APPLIED: 'Aplicado', WITH_INCIDENTS: 'Recibido con incidencias',
  SUCCESS: 'Exitoso', FAILED: 'Fallido', SKIPPED: 'Omitido', CLOSING: 'En cierre',
  COMPANY: 'Empresa', INDIVIDUAL: 'Particular', INVENTORY: 'Inventario', ASSET: 'Activo fijo', SERVICE: 'Servicio', ADMIN: 'Administrativo',
  NORMAL: 'Normal', URGENT: 'Urgente', CRITICAL: 'Crítico', CUSTOM: 'Personalizada',
  DAILY: 'Diaria', WEEKLY: 'Semanal', BIWEEKLY: 'Quincenal', MONTHLY: 'Mensual', QUARTERLY: 'Trimestral', SEMIANNUAL: 'Semestral', YEARLY: 'Anual', ANNUAL: 'Anual',
  FINANCIAL_INCOME: 'Ingreso financiero', FINANCIAL_EXPENSE: 'Gasto financiero', ACCOUNT_TRANSFER: 'Transferencia de cuenta',
  INVENTORY_ADJUSTMENT: 'Ajuste de inventario', INVENTORY_TRANSFER: 'Transferencia de inventario',
};

const MANAGER_STATUS_WORDS: Record<string, string> = {
  WAITING: 'En espera', FOR: 'para', DOCS: 'documentos', APPROVAL: 'aprobación', REVIEW: 'revisión',
  PROCESS: 'proceso', TRANSIT: 'tránsito', DELIVERY: 'reparto', PREPARATION: 'preparación', PAYMENT: 'pago',
};

/** Convierte los códigos de estado del backend a etiquetas consistentes en español. */
export function managerStatusLabel(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const normalized = raw.toUpperCase();
  if (MANAGER_STATUS_LABELS[normalized]) return MANAGER_STATUS_LABELS[normalized];
  const words = normalized.split('_').map((word) => MANAGER_STATUS_WORDS[word] || word.toLocaleLowerCase('es-NI'));
  return words.join(' ').replace(/^./, (character) => character.toUpperCase());
}
