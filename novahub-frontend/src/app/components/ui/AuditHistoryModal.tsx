import React, { useEffect, useState } from 'react';
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
};

const actionLabels: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  STATUS_CHANGE: 'Cambio de Estado',
};

const keyTranslations: Record<string, string> = {
  status: 'Estado',
  total: 'Total',
  subtotal: 'Subtotal',
  taxAmount: 'IVA',
  discountAmount: 'Descuento',
  customerId: 'Cliente',
  date: 'Fecha',
  dueDate: 'Vencimiento',
  notes: 'Notas',
  number: 'Número',
  currency: 'Moneda',
  exchangeRate: 'Tasa de Cambio',
  items: 'Productos/Items',
  expectedDelivery: 'Entrega Esperada',
  expiryDate: 'Expira el',
  reference: 'Referencia',
  warehouseId: 'Bodega/Almacén',
};

const valueTranslations: Record<string, string> = {
  DRAFT: 'BORRADOR',
  PENDING: 'PENDIENTE',
  PAID: 'PAGADA',
  CANCELLED: 'CANCELADA',
  OVERDUE: 'VENCIDA',
  PARTIAL: 'PARCIAL',
  SENT: 'ENVIADA',
  ACCEPTED: 'ACEPTADA',
  REJECTED: 'RECHAZADA',
  SHIPPED: 'FACTURADA', // En ERP-NovaHub, SHIPPED es Facturada
  DELIVERED: 'ENTREGADA',
  COMPLETED: 'COMPLETADA',
  ACTIVE: 'ACTIVO',
  INACTIVE: 'INACTIVO',
  CASH: 'EFECTIVO',
  TRANSFER: 'TRANSFERENCIA',
};

const translateKey = (key: string) => keyTranslations[key] || key;
const translateValue = (val: any) => {
  if (typeof val !== 'string') return String(val);
  return valueTranslations[val] || val;
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
    } catch (e) {
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
                                        <span className="font-bold text-foreground">{translateKey(key)}:</span> {translateValue(value)}
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
