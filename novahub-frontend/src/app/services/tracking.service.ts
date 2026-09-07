import { api } from './api';

export type TrackingStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'IN_TRANSIT'
  | 'CUSTOMS'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RETURNED'
  | 'ON_HOLD'
  | 'LOST'
  | 'CANCELLED';

export const TRACKING_STATUS_LABELS: Record<TrackingStatus, string> = {
  PENDING: 'Pendiente de recepción',
  RECEIVED: 'Recibido en agencia',
  IN_TRANSIT: 'En tránsito',
  CUSTOMS: 'En aduana',
  OUT_FOR_DELIVERY: 'En reparto',
  DELIVERED: 'Entregado',
  RETURNED: 'Devuelto',
  ON_HOLD: 'En retención',
  LOST: 'Extraviado',
  CANCELLED: 'Cancelado',
};

export interface TrackingEvent {
  id: string;
  status: TrackingStatus;
  label: string;
  description?: string;
  location?: string;
  occurredAt: string;
  source: string;
  provider?: string;
  externalEventId?: string;
  eventHash?: string;
}

export interface TrackingShipment {
  id: string;
  tenantId: string;
  ticketNumber: string;
  trackingCode: string;
  carrier: string;
  clientName?: string;
  clientPhone?: string;
  description?: string;
  origin?: string;
  destination?: string;
  status: TrackingStatus;
  estimatedAt?: string;
  deliveredAt?: string;
  lastSyncAt?: string;
  syncSource?: string;
  provider?: string;
  shipmentType?: string;
  providerWeight?: number;
  weightUnit?: string;
  providerReceivedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  events: TrackingEvent[];
}

/** Motivos de error explícitos devueltos por el backend. */
export type TrackLookupErrorReason =
  | 'EMPTY'
  | 'NOT_CONFIGURED'
  | 'NOT_FOUND'
  | 'HTTP_ERROR'
  | 'PARSE_ERROR'
  | 'SAVE_ERROR';

export type TrackLookupResult =
  | {
      tracked: true;
      provider: string;
      addedEvents: number;
      shipment: TrackingShipment;
    }
  | {
      tracked: false;
      reason: TrackLookupErrorReason;
      message: string;
    };

export const TRACK_LOOKUP_ERROR_LABELS: Record<TrackLookupErrorReason, string> = {
  EMPTY: 'Ingresa un código de tracking',
  NOT_CONFIGURED: 'Proveedor no configurado',
  NOT_FOUND: 'No se encontró el envío',
  HTTP_ERROR: 'El proveedor no respondió',
  PARSE_ERROR: 'Respuesta inválida del proveedor',
  SAVE_ERROR: 'No se pudo guardar el resultado',
};

export function trackingStatusTone(status: TrackingStatus): string {
  switch (status) {
    case 'DELIVERED': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30';
    case 'CUSTOMS': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30';
    case 'IN_TRANSIT':
    case 'OUT_FOR_DELIVERY': return 'bg-sky-500/15 text-sky-600 dark:text-sky-400 ring-sky-500/30';
    case 'LOST':
    case 'CANCELLED': return 'bg-red-500/15 text-red-600 dark:text-red-400 ring-red-500/30';
    case 'RETURNED':
    case 'ON_HOLD': return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-rose-500/30';
    default: return 'bg-muted text-muted-foreground ring-border';
  }
}

export const trackingService = {
  async list(params?: { search?: string; status?: string }) {
    return api.get('/tracking/shipments', { params }) as Promise<TrackingShipment[]>;
  },

  async findByCode(trackingCode: string) {
    return api.get(`/tracking/shipments/code/${encodeURIComponent(trackingCode)}`) as Promise<TrackingShipment>;
  },

  /** Consulta el código en los providers (AWBOX/CargoTrack) y guarda el resultado. */
  async lookup(trackingCode: string) {
    return api.post('/tracking/lookup', { trackingCode }) as Promise<TrackLookupResult>;
  },

  async create(input: Partial<TrackingShipment> & { trackingCode: string }) {
    return api.post('/tracking/shipments', input) as Promise<TrackingShipment>;
  },

  async addEvent(shipmentId: string, input: Partial<TrackingEvent> & { status: TrackingStatus }) {
    return api.post(`/tracking/shipments/${shipmentId}/events`, input) as Promise<TrackingEvent>;
  },

  async sync(trackingCode: string) {
    return api.post(`/tracking/shipments/code/${encodeURIComponent(trackingCode)}/sync`, {}) as Promise<{
      synced: boolean;
      addedEvents?: number;
      reason?: string;
      message?: string;
      shipment: TrackingShipment;
    }>;
  },

  async remove(shipmentId: string) {
    return api.delete(`/tracking/shipments/${shipmentId}`) as Promise<{ deleted: boolean }>;
  },
};