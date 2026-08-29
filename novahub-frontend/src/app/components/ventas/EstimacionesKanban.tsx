import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GripVertical, Plus, Settings2, Trash2, Pencil, X, Check, Eye, Clock, FileText } from 'lucide-react';
import { cn } from '../ui/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import type { Estimate } from '../../types';
import { useCurrency } from '../../contexts/CurrencyContext';
import { formatDateEs } from '../../utils/dateFormat';

export interface KanbanColumn {
  id: string;
  label: string;
  value: string;
  color: string;
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'draft', label: 'Borrador', value: 'DRAFT', color: '#f59e0b' },
  { id: 'sent', label: 'Enviada', value: 'SENT', color: '#3b82f6' },
  { id: 'in_progress', label: 'En proceso', value: 'IN_PROGRESS', color: '#3b82f6' },
  { id: 'approved', label: 'Aprobada', value: 'APPROVED', color: '#10b981' },
  { id: 'rejected', label: 'Rechazada', value: 'REJECTED', color: '#ef4444' },
];

const COLUMN_STORAGE_KEY = 'erp-kanban-columns-v2';

function loadColumns(): KanbanColumn[] {
  try {
    const stored = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_COLUMNS;
}

function saveColumns(columns: KanbanColumn[]) {
  localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(columns));
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ── Drag Ghost Builder ─────────────────────────────────── */
function buildDragGhost(estimate: Estimate, column: KanbanColumn, formatConvertedAmount: (a: number, c?: string, e?: number) => string): HTMLElement {
  const ghost = document.createElement('div');
  ghost.style.cssText = `
    position: fixed; top: -9999px; left: -9999px; width: 280px; padding: 14px;
    border-radius: 14px; border: 1px solid rgba(255,255,255,0.45);
    background: rgba(255,255,255,0.82); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
    font-family: system-ui, -apple-system, sans-serif; pointer-events: none; z-index: 99999;
  `;
  const borderColor = hexToRgba(column.color, 0.25);
  ghost.style.borderLeft = `3px solid ${column.color}`;
  ghost.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <span style="font-size:10px;font-weight:900;font-family:monospace;color:${column.color};">${estimate.number || ''}</span>
    </div>
    <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
      ${estimate.customer?.name || 'Varios'}
    </div>
    <div style="font-size:10px;color:#64748b;margin-bottom:8px;">
      ${formatConvertedAmount(Number(estimate.total || 0), estimate.currency, estimate.exchangeRate)}
    </div>
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="width:8px;height:8px;border-radius:50%;background:${column.color};display:inline-block;"></span>
      <span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:${column.color};">${column.label}</span>
    </div>
  `;
  document.body.appendChild(ghost);
  return ghost;
}

interface EstimacionesKanbanProps {
  data: Estimate[];
  onRefresh: () => Promise<void> | void;
  onStatusChange: (estimateId: string, newStatus: string, estimate: Estimate) => Promise<void>;
  onViewDetail: (estimate: Estimate) => void;
  canEdit: boolean;
}

export function EstimacionesKanban({ data, onRefresh, onStatusChange, onViewDetail, canEdit }: EstimacionesKanbanProps) {
  const { formatConvertedAmount } = useCurrency();
  const [columns, setColumns] = useState<KanbanColumn[]>(loadColumns);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [newColumnLabel, setNewColumnLabel] = useState('');
  const [newColumnColor, setNewColumnColor] = useState('#6366f1');
  const dragCounter = useRef<Record<string, number>>({});

  const handleDragStart = useCallback((e: React.DragEvent, estimateId: string, estimate: Estimate, column: KanbanColumn) => {
    e.dataTransfer.setData('text/plain', estimateId);
    e.dataTransfer.effectAllowed = 'move';
    const ghost = buildDragGhost(estimate, column, formatConvertedAmount);
    e.dataTransfer.setDragImage(ghost, 140, 30);
    requestAnimationFrame(() => { document.body.removeChild(ghost); });
    setDraggedItem(estimateId);
  }, [formatConvertedAmount]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverColumn(null);
    dragCounter.current = {};
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    dragCounter.current[columnId] = (dragCounter.current[columnId] || 0) + 1;
    setDragOverColumn(columnId);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    dragCounter.current[columnId] = (dragCounter.current[columnId] || 0) - 1;
    if (dragCounter.current[columnId] <= 0) {
      dragCounter.current[columnId] = 0;
      setDragOverColumn((prev) => prev === columnId ? null : prev);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetColumn: KanbanColumn) => {
    e.preventDefault();
    const estimateId = e.dataTransfer.getData('text/plain');
    if (!estimateId) return;
    const estimate = data.find((item) => item.id === estimateId);
    if (!estimate) return;
    const currentStatus = String(estimate.status || '').toUpperCase();
    if (currentStatus === targetColumn.value) return;
    setDraggedItem(null);
    setDragOverColumn(null);
    dragCounter.current = {};
    await onStatusChange(estimateId, targetColumn.value, estimate);
  }, [data, onStatusChange]);

  const columnEstimates = useMemo(() => {
    const grouped: Record<string, Estimate[]> = {};
    columns.forEach((col) => { grouped[col.value] = []; });
    grouped['CANCELLED'] = grouped['CANCELLED'] || [];
    data.forEach((estimate) => {
      const status = String(estimate.status || '').toUpperCase();
      if (grouped[status]) {
        grouped[status].push(estimate);
      } else {
        grouped['DRAFT'] = grouped['DRAFT'] || [];
        grouped['DRAFT'].push(estimate);
      }
    });
    return grouped;
  }, [data, columns]);

  const handleAddColumn = () => {
    if (!newColumnLabel.trim()) return;
    const id = `custom_${Date.now()}`;
    const newCol: KanbanColumn = {
      id,
      label: newColumnLabel.trim(),
      value: newColumnLabel.trim().toUpperCase().replace(/\s+/g, '_'),
      color: newColumnColor,
    };
    const updated = [...columns, newCol];
    setColumns(updated);
    saveColumns(updated);
    setNewColumnLabel('');
  };

  const handleDeleteColumn = (colId: string) => {
    const updated = columns.filter((col) => col.id !== colId);
    setColumns(updated);
    saveColumns(updated);
  };

  const handleSaveEdit = (colId: string) => {
    const updated = columns.map((col) => {
      if (col.id !== colId) return col;
      return { ...col, label: editLabel || col.label, color: editColor || col.color };
    });
    setColumns(updated);
    saveColumns(updated);
    setEditingColumn(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Tablero Kanban</h3>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">{data.length} cotizaciones</span>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">
              <Settings2 className="size-3.5" /> Columnas
            </Button>
          )}
        </div>
      </div>

      {/* Column Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card className="rounded-2xl border-border/60 bg-card/95 backdrop-blur-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Configurar Columnas</p>
                  <Button variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" title="Cerrar configuración" aria-label="Cerrar configuración de columnas" onClick={() => setShowSettings(false)}><X className="size-3.5" /></Button>
                </div>
                <div className="space-y-2">
                  {columns.map((col) => (
                    <div key={col.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/80 p-2">
                      {editingColumn === col.id ? (
                        <>
                          <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="size-6 cursor-pointer rounded border-0" />
                          <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="h-7 flex-1 text-xs" autoFocus />
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => handleSaveEdit(col.id)}><Check className="size-3.5 text-emerald-500" /></Button>
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditingColumn(null)}><X className="size-3.5 text-red-500" /></Button>
                        </>
                      ) : (
                        <>
                          <div className="size-4 rounded-full" style={{ backgroundColor: col.color }} />
                          <span className="flex-1 text-xs font-bold">{col.label}</span>
                          <span className="text-[9px] text-muted-foreground">{col.value}</span>
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => { setEditingColumn(col.id); setEditLabel(col.label); setEditColor(col.color); }}><Pencil className="size-3" /></Button>
                          <Button size="icon" variant="ghost" className="size-7 hover:text-red-500" onClick={() => handleDeleteColumn(col.id)}><Trash2 className="size-3" /></Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-border/60 bg-card/70 p-2">
                  <input type="color" value={newColumnColor} onChange={(e) => { setNewColumnColor(e.target.value); }} className="size-6 cursor-pointer rounded border-0" />
                  <Input value={newColumnLabel} onChange={(e) => setNewColumnLabel(e.target.value)} placeholder="Nueva columna..." className="h-7 flex-1 text-xs" onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()} />
                  <Button size="icon" variant="ghost" className="size-7" onClick={handleAddColumn} disabled={!newColumnLabel.trim()}><Plus className="size-3.5 text-primary" /></Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 280px)' }}>
        {columns.map((col) => {
          const estimates = columnEstimates[col.value] || [];
          const isOver = dragOverColumn === col.value;
          return (
            <div
              key={col.id}
              className={cn(
                'flex flex-col min-w-[300px] max-w-[320px] flex-1 rounded-2xl transition-all duration-200',
                isOver ? 'ring-2 ring-offset-2' : '',
              )}
              style={{
                background: isOver ? hexToRgba(col.color, 0.06) : 'hsl(var(--card) / 0.82)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: `1px solid ${isOver ? hexToRgba(col.color, 0.3) : 'hsl(var(--border) / 0.7)'}`,
                boxShadow: isOver
                  ? `0 8px 32px ${hexToRgba(col.color, 0.12)}, 0 2px 8px rgba(0,0,0,0.04)`
                  : '0 1px 8px hsl(var(--foreground) / 0.06)',
                ringColor: col.color,
              }}
              onDragEnter={(e) => handleDragEnter(e, col.value)}
              onDragLeave={(e) => handleDragLeave(e, col.value)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, col)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                  <h4 className="text-xs font-black uppercase tracking-widest" style={{ color: col.color }}>{col.label}</h4>
                  <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black" style={{ backgroundColor: hexToRgba(col.color, 0.1), color: col.color }}>
                    {estimates.length}
                  </span>
                </div>
              </div>

              {/* Cards Container */}
              <div className="flex-1 space-y-2.5 overflow-y-auto px-3 pb-3" style={{ maxHeight: 'calc(100vh - 380px)' }}>
                <AnimatePresence mode="popLayout">
                  {estimates.map((estimate) => (
                    <KanbanCard
                      key={estimate.id}
                      estimate={estimate}
                      column={col}
                      formatConvertedAmount={formatConvertedAmount}
                      onViewDetail={onViewDetail}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedItem === estimate.id}
                      canEdit={canEdit}
                    />
                  ))}
                </AnimatePresence>
                {estimates.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8 text-center" style={{ borderColor: hexToRgba(col.color, 0.2) }}>
                    <FileText className="mb-2 size-6" style={{ color: hexToRgba(col.color, 0.3) }} />
                    <p className="text-[10px] font-medium" style={{ color: hexToRgba(col.color, 0.5) }}>Sin cotizaciones</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Kanban Card ────────────────────────────────────────── */

interface KanbanCardProps {
  estimate: Estimate;
  column: KanbanColumn;
  formatConvertedAmount: (amount: number, currency?: string, exchangeRate?: number) => string;
  onViewDetail: (estimate: Estimate) => void;
  onDragStart: (e: React.DragEvent, id: string, estimate: Estimate, column: KanbanColumn) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  canEdit: boolean;
}

function KanbanCard({ estimate, column, formatConvertedAmount, onViewDetail, onDragStart, onDragEnd, isDragging, canEdit }: KanbanCardProps) {
  const expiryDate = estimate.expiryDate ? new Date(estimate.expiryDate) : null;
  const now = new Date();
  const isExpiringSoon = expiryDate && expiryDate.getTime() - now.getTime() < 7 * 86400000 && expiryDate > now;
  const isExpired = expiryDate && expiryDate < now;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: isDragging ? 0.4 : 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      draggable={canEdit}
      onDragStart={(e) => onDragStart(e as any, estimate.id, estimate, column)}
      onDragEnd={onDragEnd}
      className={cn(
        'group cursor-grab active:cursor-grabbing rounded-xl p-3.5 transition-all duration-150',
        'hover:shadow-lg hover:-translate-y-0.5',
        isDragging && 'opacity-40 scale-[0.97]',
      )}
      style={{
        background: 'hsl(var(--card) / 0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid hsl(var(--border) / 0.7)',
        boxShadow: '0 4px 20px hsl(var(--foreground) / 0.08), 0 1px 4px hsl(var(--foreground) / 0.04)',
      }}
      onClick={() => onViewDetail(estimate)}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <GripVertical className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
          <span className="text-[11px] font-black font-mono tracking-tight" style={{ color: column.color }}>
            {estimate.number}
          </span>
        </div>
        {canEdit && (
          <Button variant="ghost" size="icon" className="size-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onViewDetail(estimate); }}>
            <Eye className="size-3 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Client */}
      <p className="text-[13px] font-bold text-foreground mb-1 truncate">
        {estimate.customer?.name || 'Varios'}
      </p>

      {/* Date & Expiry */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2.5">
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {formatDateEs(estimate.date)}
        </span>
        {expiryDate && (
          <span className={cn(
            'flex items-center gap-1',
            isExpired && 'text-red-500 font-bold',
            isExpiringSoon && 'text-amber-500 font-bold',
          )}>
            · {isExpired ? 'Vencida' : `Vence ${formatDateEs(estimate.expiryDate)}`}
          </span>
        )}
      </div>

      {/* Items Preview */}
      {estimate.items && estimate.items.length > 0 && (
        <div className="mb-2.5 space-y-0.5">
          {estimate.items.slice(0, 2).map((item, i) => (
            <p key={i} className="text-[10px] text-muted-foreground/70 truncate">
              {item.description || 'Sin descripcion'}
              {item.quantity > 1 && ` x${item.quantity}`}
            </p>
          ))}
          {estimate.items.length > 2 && (
            <p className="text-[9px] text-muted-foreground/50">+{estimate.items.length - 2} mas</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-end justify-between border-t border-border/60 pt-2.5">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Total</p>
          <p className="text-sm font-black tabular-nums" style={{ color: column.color }}>
            {formatConvertedAmount(Number(estimate.total || 0), estimate.currency, estimate.exchangeRate)}
          </p>
        </div>
        <Badge
          variant="outline"
          className="text-[8px] font-black uppercase tracking-wider border-none px-1.5 py-0.5"
          style={{ backgroundColor: hexToRgba(column.color, 0.08), color: column.color }}
        >
          {estimate.currency || 'NIO'}
        </Badge>
      </div>
    </motion.div>
  );
}
