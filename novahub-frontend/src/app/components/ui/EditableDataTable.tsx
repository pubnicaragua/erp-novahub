import { cloneElement, isValidElement, useState, useEffect, useRef, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';
import { Input } from './input';
import { cn } from './utils';
import { Pencil, Trash2, Ban, Copy, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ConfirmDialog } from './ConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog';
import { Skeleton as BoneyardSkeleton } from 'boneyard-js/react';
import type { SalesPaginationControls } from '../../types';
import { useCardsOnlyBelowTableBreakpoint } from './ViewLayoutSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

const EMPTY_SELECT_VALUE = '__erp_empty_select_value__';
const toRadixSelectValue = (value: unknown) => value === '' || value === null || value === undefined ? EMPTY_SELECT_VALUE : String(value);
const fromRadixSelectValue = (value: string) => value === EMPTY_SELECT_VALUE ? '' : value;

export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  editable?: boolean;
  type?: 'text' | 'number' | 'select' | 'date' | 'datetime-local' | 'badge';
  options?: { label: string; value: string; color?: string }[];
  render?: (value: any, row: T) => React.ReactNode;
  headerExtra?: React.ReactNode;
}

interface EditableDataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  onRowUpdate?: (id: string | number, updates: Partial<T>) => Promise<void>;
  onRowDelete?: (id: string | number) => Promise<void>;
  onBulkDelete?: (ids: (string | number)[]) => Promise<void>;
  /** Use cancel semantics for transactional records that must never be deleted. */
  bulkAction?: 'delete' | 'cancel' | 'reject';
  /** Disable selection for rows whose workflow is already approved/applied. */
  isRowSelectable?: (row: T) => boolean;
  onBulkDuplicate?: (ids: (string | number)[]) => Promise<void>;
  onBulkUpdate?: (ids: (string | number)[], updates: Partial<T>) => Promise<void>;
  idField?: keyof T;
  isLoading?: boolean;
  actions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  highlightedRowId?: string | number | null;
  editOnPencilOnly?: boolean;
  showSelection?: boolean;
  bulkActions?: (selectedIds: (string | number)[]) => React.ReactNode;
  showClearSelection?: boolean;
  onAddRow?: () => void;
  pagination?: SalesPaginationControls;
  actionsWidth?: string;
  fitContent?: boolean;
  layoutMode?: 'table' | 'cards' | 'responsive';
  showHorizontalControls?: boolean;
  /** Explicit UI permission. Defaults to whether an update handler exists. */
  canEdit?: boolean;
}

export function EditableDataTable<T extends { [key: string]: any }>({
  data: initialData,
  columns,
  onRowUpdate,
  onRowDelete,
  onBulkDelete,
  bulkAction = 'delete',
  isRowSelectable,
  onBulkDuplicate,
  idField = 'id' as keyof T,
  isLoading,
  actions,
  onRowClick,
  onRowDoubleClick,
  highlightedRowId,
  editOnPencilOnly = false,
  showSelection = true,
  bulkActions,
  pagination,
  actionsWidth = 'w-32',
  fitContent = false,
  layoutMode = 'responsive',
  showHorizontalControls = false,
  canEdit,
}: EditableDataTableProps<T>) {
  const isBulkCancel = bulkAction === 'cancel';
  const isBulkReject = bulkAction === 'reject';
  const bulkActionLabel = isBulkCancel ? 'Cancelar' : isBulkReject ? 'Rechazar' : 'Eliminar';
  const isEditingAllowed = canEdit ?? Boolean(onRowUpdate);
  const isCompactTableViewport = useCardsOnlyBelowTableBreakpoint();
  const effectiveLayoutMode = isCompactTableViewport ? 'cards' : layoutMode;
  const [data, setData] = useState<T[]>(initialData);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowId: string | number; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [draftRows, setDraftRows] = useState<Set<string | number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmBulkDeleteIds, setConfirmBulkDeleteIds] = useState<(string | number)[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [bulkDuplicateLoading, setBulkDuplicateLoading] = useState(false);
  const [mobileActionsRow, setMobileActionsRow] = useState<T | null>(null);
  const rowClickTimerRef = useRef<number | null>(null);
  const openingRowTimerRef = useRef<number | null>(null);
  const [openingRowId, setOpeningRowId] = useState<string | number | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const pointerInsideTable = useRef(false);
  const scrollAnimationRef = useRef<number | null>(null);
  const [focusedCell, setFocusedCell] = useState({ rowIndex: 0, colIndex: 0 });
  const [horizontalScroll, setHorizontalScroll] = useState({ left: false, right: false });
  const actionColumnWidth = (() => {
    const match = /^w-(\d+)$/.exec(actionsWidth);
    return match ? Number(match[1]) * 4 : 128;
  })();
  const selectableRows = data.filter((row) => isRowSelectable?.(row) ?? true);
  const selectableIds = selectableRows.map((row) => row[idField]);
  const allSelectableRowsSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    const selectableIdSet = new Set(selectableIds);
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => selectableIdSet.has(id)));
      if (next.size === current.size && [...next].every((id) => current.has(id))) return current;
      return next;
    });
  }, [data, idField, isRowSelectable]);
  const markRowOpening = useCallback((row: T) => {
    const rowId = row[idField];
    setOpeningRowId(rowId);
    if (openingRowTimerRef.current !== null) window.clearTimeout(openingRowTimerRef.current);
    openingRowTimerRef.current = window.setTimeout(() => {
      setOpeningRowId((current) => String(current) === String(rowId) ? null : current);
      openingRowTimerRef.current = null;
    }, 900);
  }, [idField]);

  const openRowDetail = useCallback((row: T) => {
    markRowOpening(row);
    onRowClick?.(row);
  }, [markRowOpening, onRowClick]);

  const handleRowInteraction = useCallback((event: React.MouseEvent, row: T, doubleClick = false) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, select, textarea')) return;
    if (!doubleClick && target.closest('[data-row-click-exempt="true"]')) return;

    if (doubleClick) {
      if (rowClickTimerRef.current !== null) window.clearTimeout(rowClickTimerRef.current);
      rowClickTimerRef.current = null;
      onRowDoubleClick?.(row);
      return;
    }

    if (onRowDoubleClick) {
      if (rowClickTimerRef.current !== null) window.clearTimeout(rowClickTimerRef.current);
      rowClickTimerRef.current = window.setTimeout(() => {
        rowClickTimerRef.current = null;
        openRowDetail(row);
      }, 160);
      return;
    }

    openRowDetail(row);
  }, [onRowDoubleClick, openRowDetail]);

  useEffect(() => () => {
    if (rowClickTimerRef.current !== null) window.clearTimeout(rowClickTimerRef.current);
    if (openingRowTimerRef.current !== null) window.clearTimeout(openingRowTimerRef.current);
  }, []);
  const tableMinWidth = fitContent
    ? columns.reduce((total, column) => total + (Number.parseInt(String(column.width || ''), 10) || 140), 0) + (showSelection ? 48 : 0) + actionColumnWidth
    : undefined;

  const getColumnScrollTargets = useCallback(() => {
    const element = tableScrollRef.current;
    if (!element) return [0];

    let offset = showSelection ? 48 : 0;
    const boundaries = [0];
    columns.forEach((column) => {
      offset += Number.parseFloat(String(column.width || '140')) || 140;
      boundaries.push(offset);
    });

    const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
    boundaries.push(maxScroll);
    return [...new Set(boundaries)].sort((a, b) => a - b);
  }, [columns, showSelection]);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (!showHorizontalControls || effectiveLayoutMode === 'cards') return;
    const element = tableScrollRef.current;
    if (!element) return;
    const scrollStateRef = { current: horizontalScroll };
    const updateScrollState = () => {
      const nextState = {
        left: element.scrollLeft > 4,
        right: element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
      };
      if (nextState.left === scrollStateRef.current.left && nextState.right === scrollStateRef.current.right) return;
      scrollStateRef.current = nextState;
      setHorizontalScroll(nextState);
    };
    updateScrollState();
    element.addEventListener('scroll', updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(element);
    window.addEventListener('resize', updateScrollState);
    return () => {
      element.removeEventListener('scroll', updateScrollState);
      observer.disconnect();
      window.removeEventListener('resize', updateScrollState);
    };
  }, [columns.length, data.length, horizontalScroll, effectiveLayoutMode, showHorizontalControls, tableMinWidth]);

  const scrollTable = (direction: 'left' | 'right') => {
    const element = tableScrollRef.current;
    if (!element) return;
    const targets = getColumnScrollTargets();
    const currentPosition = element.scrollLeft;
    const nextPosition = direction === 'right'
      ? targets.find((target) => target > currentPosition + 4) ?? targets[targets.length - 1]
      : [...targets].reverse().find((target) => target < currentPosition - 4) ?? targets[0];
    if (scrollAnimationRef.current !== null) cancelAnimationFrame(scrollAnimationRef.current);
    const startPosition = element.scrollLeft;
    const distance = nextPosition - startPosition;
    if (Math.abs(distance) < 1) return;
    const startTime = performance.now();
    const duration = 170;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.scrollLeft = startPosition + distance * eased;
      if (progress < 1) {
        scrollAnimationRef.current = requestAnimationFrame(animate);
      } else {
        scrollAnimationRef.current = null;
      }
    };
    scrollAnimationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => () => {
    if (scrollAnimationRef.current !== null) cancelAnimationFrame(scrollAnimationRef.current);
  }, []);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleCellClick = (rowId: string | number, colKey: string, value: any, editable?: boolean) => {
    if (!editable || !isEditingAllowed) return;
    setEditingCell({ rowId, colKey });
    // Empty nullable fields must still mount as controlled inputs.
    setEditValue(value ?? '');
  };

  const focusGridCell = useCallback((rowIndex: number, colIndex: number) => {
    if (!data.length || !columns.length) return;
    const nextRow = Math.max(0, Math.min(rowIndex, data.length - 1));
    const nextCol = Math.max(0, Math.min(colIndex, columns.length - 1));
    setFocusedCell({ rowIndex: nextRow, colIndex: nextCol });
    requestAnimationFrame(() => {
      const cell = tableScrollRef.current?.querySelector<HTMLElement>(`[data-grid-row-index="${nextRow}"][data-grid-col-index="${nextCol}"]`);
      cell?.focus({ preventScroll: true });
      cell?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
    });
  }, [columns.length, data.length]);

  const moveGridFocus = useCallback((key: string) => {
    if (!data.length || !columns.length) return;
    let { rowIndex, colIndex } = focusedCell;
    if (key === 'ArrowLeft') colIndex = Math.max(0, colIndex - 1);
    if (key === 'ArrowRight') colIndex = Math.min(columns.length - 1, colIndex + 1);
    if (key === 'ArrowUp') rowIndex = Math.max(0, rowIndex - 1);
    if (key === 'ArrowDown') rowIndex = Math.min(data.length - 1, rowIndex + 1);
    focusGridCell(rowIndex, colIndex);
  }, [columns.length, data.length, focusedCell, focusGridCell]);

  const handleTableKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName) || target.isContentEditable) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      moveGridFocus(event.key);
    }
  };

  const handleSave = async (rowId: string | number, colKey: string, valueToSave?: any) => {
    if (!isEditingAllowed || !onRowUpdate) return;
    if (!editingCell && valueToSave === undefined) return;
    
    const column = columns.find((item) => String(item.key) === colKey);
    const rawValue = valueToSave !== undefined ? valueToSave : editValue;
    const value = column?.type === 'number' && rawValue !== '' && rawValue !== null
      ? Number(rawValue)
      : rawValue;
    const originalRow = data.find(r => r[idField] === rowId);
    
    if (!originalRow || originalRow[colKey] === value) {
      setEditingCell(null);
      return;
    }
 
    // Optimistic Update
    const newData = data.map(r => r[idField] === rowId ? { ...r, [colKey]: value } : r);
    setData(newData);
    setDraftRows(prev => new Set(prev).add(rowId));
    setEditingCell(null);
 
    try {
      await onRowUpdate(rowId, { [colKey]: value } as Partial<T>);
      setDraftRows(prev => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
    } catch (error) {
      console.error('Failed to update row:', error);
      setData(initialData); // Rollback
      setDraftRows(prev => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowId: string | number, colKey: string) => {
    if (e.key === 'Enter') {
      handleSave(rowId, colKey);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      // Logic for Tab to move to next cell could go here
    }
  };

  const toggleSelectAll = () => {
    if (allSelectableRowsSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  };

  const toggleSelectRow = (id: string | number) => {
    const row = data.find((candidate) => candidate[idField] === id);
    if (row && !(isRowSelectable?.(row) ?? true)) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (!isEditingAllowed || !onRowUpdate) return;
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const rows = text.split(/\r?\n/).filter(line => line.trim() !== '').map(row => row.split('\t'));
    if (rows.length === 0) return;
    
    const newData = [...data];
    let updatedCount = 0;
    const editableColumns = columns.filter(col => col.editable);

    rows.forEach((rowValues, rowIndex) => {
      if (rowIndex < newData.length) {
        const itemUpdates: Partial<T> = {};
        rowValues.forEach((val, colIndex) => {
          if (colIndex < editableColumns.length) {
            const col = editableColumns[colIndex];
            itemUpdates[col.key as keyof T] = val as any;
          }
        });
        newData[rowIndex] = { ...newData[rowIndex], ...itemUpdates };
        updatedCount++;
        if (onRowUpdate) onRowUpdate(newData[rowIndex][idField], itemUpdates);
      }
    });
    setData(newData);
    toast.success(`Sincronizadas ${updatedCount} filas desde Excel`);
  }, [data, columns, onRowUpdate, idField, isEditingAllowed]);

  const handleBulkDuplicate = async () => {
    if (!onBulkDuplicate || selectedIds.size === 0) return;
    try {
      setBulkDuplicateLoading(true);
      await onBulkDuplicate(Array.from(selectedIds));
      setSelectedIds(new Set());
    } finally {
      setBulkDuplicateLoading(false);
    }
  };

  return (
    <BoneyardSkeleton
      name="sales-data-table"
      loading={Boolean(isLoading)}
      select="viewport"
      animate="shimmer"
      transition={180}
      fallback={(
        <div className="w-full space-y-3 rounded-2xl border border-border/50 bg-card/30 p-4" aria-label="Cargando tabla">
          <div className="h-10 w-full animate-pulse rounded-xl bg-muted/40" />
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-14 w-full animate-pulse rounded-xl bg-muted/30" />
          ))}
        </div>
      )}
    >
    <div className="sales-data-table w-full min-w-0 max-w-full space-y-4" data-tour="sales-data-table" onPaste={handlePaste}>
      {/* Bulk Actions Toolbar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-wrap items-center justify-between gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl mb-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-xs font-black uppercase tracking-widest text-primary/60">
                {selectedIds.size} Seleccionados
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
               {bulkActions && bulkActions(Array.from(selectedIds))}
               {onBulkDuplicate && (
                 <Button
                   variant="outline"
                   size="sm"
                   className="h-8 text-[10px] font-black uppercase tracking-wider"
                   onClick={handleBulkDuplicate}
                   disabled={bulkDuplicateLoading}
                 >
                    <Copy className="size-3 mr-2" /> {bulkDuplicateLoading ? 'Duplicando...' : 'Duplicar'}
                 </Button>
               )}
               {onBulkDelete && (
                 <Button
                   variant="destructive"
                   size="sm"
                   className="h-8 text-[10px] font-black uppercase tracking-wider"
                   onClick={() => setConfirmBulkDeleteIds(Array.from(selectedIds))}
                 >
                    {isBulkCancel || isBulkReject ? <Ban className="mr-2 size-3.5" /> : <Trash2 className="mr-2 size-3" />}
                    {bulkActionLabel}
                 </Button>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          effectiveLayoutMode === 'cards' ? 'hidden' : effectiveLayoutMode === 'responsive' ? 'hidden xl:block' : 'block',
          'w-full min-w-0 max-w-full rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm'
        )}
        onMouseEnter={() => { pointerInsideTable.current = true; }}
        onMouseLeave={() => { pointerInsideTable.current = false; }}
      >
        {showHorizontalControls && effectiveLayoutMode !== 'cards' && (
          <div className="flex items-center justify-between gap-3 border-b border-border/40 bg-muted/10 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Desplazamiento horizontal</span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="icon" className="size-8 rounded-lg" onClick={() => scrollTable('left')} disabled={!horizontalScroll.left} aria-label="Desplazar tabla a la izquierda"><ChevronLeft className="size-4" /></Button>
              <Button type="button" variant="outline" size="icon" className="size-8 rounded-lg" onClick={() => scrollTable('right')} disabled={!horizontalScroll.right} aria-label="Desplazar tabla a la derecha"><ChevronRight className="size-4" /></Button>
            </div>
          </div>
        )}
        <div
          ref={tableScrollRef}
          tabIndex={0}
          onKeyDownCapture={handleTableKeyDown}
          onMouseDown={() => tableScrollRef.current?.focus({ preventScroll: true })}
          aria-label="Tabla navegable. Usa las flechas para moverte entre filas y columnas."
          className="w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
        <Table
          containerClassName={fitContent ? 'w-full min-w-0 max-w-none overflow-visible' : undefined}
          containerStyle={tableMinWidth ? { width: `max(100%, ${tableMinWidth}px)`, maxWidth: 'none' } : undefined}
          style={tableMinWidth ? { width: '100%', minWidth: `${tableMinWidth}px`, maxWidth: 'none' } : undefined}
          className={cn(fitContent ? 'w-full min-w-full' : 'w-full min-w-max', 'table-fixed')}
        >
          <colgroup>
            {showSelection && <col style={{ width: '48px' }} />}
            {columns.map((column) => <col key={column.key as string} style={{ width: column.width || '140px' }} />)}
            <col style={{ width: `${actionColumnWidth}px` }} />
          </colgroup>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-none">
              {showSelection && (
                <TableHead className="w-12 text-center h-12">
                  <Checkbox 
                    checked={allSelectableRowsSelected ? true : selectedIds.size > 0 ? 'indeterminate' : false}
                    disabled={selectableIds.length === 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead 
                  key={col.key as string} 
                  style={{ width: col.width }}
                  className="h-12 whitespace-nowrap align-middle text-[10px] font-black uppercase tracking-widest text-muted-foreground/60"
                >
                  <span className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap">
                    <span className="min-w-0 truncate">{col.header}</span>
                    {isValidElement(col.headerExtra)
                      ? cloneElement(col.headerExtra as React.ReactElement<{ compact?: boolean }>, { compact: true })
                      : col.headerExtra}
                  </span>
                </TableHead>
              ))}
              <TableHead data-actions-column="true" className={cn('h-12 whitespace-nowrap pr-3 text-right align-middle text-[10px] font-black uppercase tracking-widest text-muted-foreground/60', actionsWidth)}>
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, rowIndex) => {
              const rowId = row[idField];
              const isDraft = draftRows.has(rowId);
              const isSelected = selectedIds.has(rowId);
              const isRowSelectableValue = isRowSelectable?.(row) ?? true;
              const isHighlighted = highlightedRowId != null && String(highlightedRowId) === String(rowId);
              const isOpening = openingRowId != null && String(openingRowId) === String(rowId);

              return (
                <TableRow 
                  key={rowId} 
                  onClick={(event) => handleRowInteraction(event, row)}
                  onDoubleClick={(event) => handleRowInteraction(event, row, true)}
                  className={cn(
                    "group/row h-14 transition-all duration-300",
                    (onRowClick || onRowDoubleClick) && !editOnPencilOnly && "cursor-pointer",
                    isHighlighted
                      ? "bg-primary/10 hover:bg-primary/15 border-l-2 border-l-primary ring-1 ring-inset ring-primary/50"
                      : isSelected ? "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/20"
                  )}
                  aria-busy={isOpening || undefined}
                  data-detail-opening={isOpening ? 'true' : undefined}
                >
                  {showSelection && (
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={isSelected} 
                        disabled={!isRowSelectableValue}
                        aria-label={isRowSelectableValue ? `Seleccionar fila ${String(rowId)}` : 'Registro protegido; no se puede seleccionar'}
                        title={isRowSelectableValue ? undefined : 'Registro aprobado o aplicado; no se puede seleccionar'}
                        onCheckedChange={() => toggleSelectRow(rowId)}
                      />
                    </TableCell>
                  )}
                  {columns.map((col, colIndex) => {
                    const colKey = col.key as string;
                    const value = row[colKey];
                    const isEditing = editingCell?.rowId === rowId && editingCell?.colKey === colKey;

                    return (
                      <TableCell 
                        key={colKey}
                        data-row-click-exempt={col.editable && isEditingAllowed && !editOnPencilOnly ? 'true' : undefined}
                        tabIndex={focusedCell.rowIndex === rowIndex && focusedCell.colIndex === colIndex ? 0 : -1}
                        data-grid-row-index={rowIndex}
                        data-grid-col-index={colIndex}
                        onFocus={() => setFocusedCell({ rowIndex, colIndex })}
                        onClick={() => {
                          focusGridCell(rowIndex, colIndex);
                          if (!editOnPencilOnly) handleCellClick(rowId, colKey, value, col.editable);
                        }}
                        className={cn(
                          "relative group/cell h-14 min-w-0",
                          editOnPencilOnly ? "cursor-default" : "cursor-cell",
                          col.editable && isEditingAllowed && "hover:bg-primary/5 transition-colors",
                          isEditing && "p-0",
                          focusedCell.rowIndex === rowIndex && focusedCell.colIndex === colIndex && !isEditing && "ring-1 ring-inset ring-primary/50"
                        )}
                      >
                        {isEditing ? (
                          <div
                            className="absolute inset-0 z-10 flex items-center bg-background border-2 border-primary p-1 shadow-xl"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {col.type === 'select' ? (
                              <Select
                                value={toRadixSelectValue(editValue)}
                                onValueChange={(nextValue) => {
                                  const newVal = fromRadixSelectValue(nextValue);
                                  setEditValue(newVal);
                                  // For select, we often want to save immediately
                                  handleSave(rowId, colKey, newVal);
                                }}
                              >
                                <SelectTrigger size="sm" onBlur={() => handleSave(rowId, colKey)} className="h-full w-full rounded-none border-none bg-transparent px-2 text-[13px] font-medium shadow-none focus-visible:ring-0">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {col.options?.map(opt => (
                                    <SelectItem key={opt.value} value={toRadixSelectValue(opt.value)}>{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                ref={inputRef}
                                type={col.type === 'datetime-local' ? 'datetime-local' : col.type === 'date' ? 'date' : col.type === 'number' ? 'number' : 'text'}
                                value={editValue ?? ''}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleSave(rowId, colKey)}
                                onKeyDown={(e) => handleKeyDown(e, rowId, colKey)}
                                className="h-full w-full border-none focus-visible:ring-0 text-[13px] font-medium px-2"
                              />
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center h-full px-2">
                            {col.render ? col.render(value, row) : (
                              <span className={cn(
                                "text-[13px] transition-all",
                                isDraft ? "text-primary italic flex items-center gap-1.5" : "text-foreground font-medium"
                              )}>
                                {isDraft && <span title="Borrador">📝</span>}
                                {value}
                              </span>
                            )}
                            {col.editable && isEditingAllowed && (
                              editOnPencilOnly ? (
                                <button
                                  type="button"
                                  title="Editar campo"
                                  aria-label={`Editar ${col.header}`}
                                  className="pointer-events-none ml-auto inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-primary opacity-0 transition-opacity group-hover/row:pointer-events-auto group-hover/row:opacity-100 hover:bg-primary/10"
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleCellClick(rowId, colKey, value, col.editable);
                                  }}
                                >
                                  <Pencil className="size-3" />
                                </button>
                              ) : (
                                <Pencil className="ml-auto size-3 opacity-0 transition-opacity group-hover:opacity-30 text-primary" />
                              )
                            )}
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell data-actions-column="true" className={cn('h-14 min-w-0 max-w-full overflow-hidden whitespace-nowrap pr-2 text-right align-middle transition-colors pointer-events-auto', actionsWidth)}>
                    <div data-action-group="true" className="relative z-30 flex min-w-max flex-nowrap items-center justify-end gap-1 overflow-visible whitespace-nowrap transition-all pointer-events-auto">
                      {isOpening && <span role="status" className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-primary" title="Abriendo detalle">
                        <Loader2 className="size-3 animate-spin" /> <span className="hidden 2xl:inline">Abriendo…</span>
                      </span>}
                      {actions ? actions(row) : (
                        onRowDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                            onClick={() => setConfirmDeleteId(rowId)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            
            {/* Empty State */}
            {data.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={columns.length + (showSelection ? 2 : 1)} className="h-32 text-center text-muted-foreground/50 italic text-sm">
                   No hay registros disponibles.
                </TableCell>
              </TableRow>
            )}

            {/* Loading skeleton placeholder could go here */}
          </TableBody>
        </Table>
        </div>
      </div>

      <div className={cn(effectiveLayoutMode === 'table' ? 'hidden' : 'grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]', effectiveLayoutMode === 'responsive' && 'xl:hidden')}>
        {data.map((row) => {
          const rowId = row[idField];
          const isSelected = selectedIds.has(rowId);
          const isRowSelectableValue = isRowSelectable?.(row) ?? true;
          const isHighlighted = highlightedRowId != null && String(highlightedRowId) === String(rowId);
          const isOpening = openingRowId != null && String(openingRowId) === String(rowId);
          return (
            <motion.article
              key={rowId}
              layout
              onClick={(event) => handleRowInteraction(event, row)}
              onDoubleClick={(event) => handleRowInteraction(event, row, true)}
              className={cn(
                'overflow-hidden rounded-2xl border border-border/50 bg-card/70 shadow-sm',
                (onRowClick || onRowDoubleClick) && !editOnPencilOnly && 'cursor-pointer',
                isHighlighted ? 'border-primary bg-primary/10 ring-2 ring-primary/40' : isSelected && 'border-primary/50 bg-primary/5'
              )}
              aria-busy={isOpening || undefined}
              data-detail-opening={isOpening ? 'true' : undefined}
            >
              <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border/40 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  {showSelection && (
                    <Checkbox
                      className="mt-0.5 shrink-0"
                      checked={isSelected}
                      disabled={!isRowSelectableValue}
                      aria-label={isRowSelectableValue ? `Seleccionar registro ${String(rowId)}` : 'Registro protegido; no se puede seleccionar'}
                      title={isRowSelectableValue ? undefined : 'Registro aprobado o aplicado; no se puede seleccionar'}
                      onCheckedChange={() => toggleSelectRow(rowId)}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-foreground">
                      {String(row.name || row.title || row.number || row.code || rowId)}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                      {String(row.code || row.number || rowId)}
                    </p>
                  </div>
                  {isOpening && <span role="status" className="inline-flex max-w-full shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-primary">
                    <Loader2 className="size-3 animate-spin" /> Abriendo…
                  </span>}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 p-4 sm:grid-cols-2">
                {columns.map((col) => {
                  const colKey = col.key as string;
                  const value = row[col.key as string];
                  const isEditing = editingCell?.rowId === rowId && editingCell?.colKey === colKey;
                  return (
                    <div
                      key={colKey}
                      className={cn('min-w-0 rounded-xl', col.editable && isEditingAllowed && 'transition-colors hover:bg-primary/5')}
                      onClick={(event) => {
                        if (!col.editable || editOnPencilOnly) return;
                        event.stopPropagation();
                        handleCellClick(rowId, colKey, value, col.editable);
                      }}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="min-w-0 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                          {col.header}
                        </p>
                        {col.editable && isEditingAllowed && !isEditing && (
                          <button
                            type="button"
                            title={`Editar ${col.header}`}
                            aria-label={`Editar ${col.header}`}
                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-primary hover:bg-primary/10"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleCellClick(rowId, colKey, value, col.editable);
                            }}
                          >
                            <Pencil className="size-3" />
                          </button>
                        )}
                      </div>
                      {isEditing ? (
                        col.type === 'select' ? (
                          <Select
                            value={toRadixSelectValue(editValue)}
                            onValueChange={(nextValue) => {
                              const newValue = fromRadixSelectValue(nextValue);
                              setEditValue(newValue);
                              void handleSave(rowId, colKey, newValue);
                            }}
                          >
                            <SelectTrigger size="sm" onBlur={() => void handleSave(rowId, colKey)} onClick={(event) => event.stopPropagation()} className="h-9 w-full rounded-lg border-primary bg-background px-2 text-sm font-medium text-foreground">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {col.options?.map((option) => (
                                <SelectItem key={option.value} value={toRadixSelectValue(option.value)}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            ref={inputRef}
                            type={col.type === 'datetime-local' ? 'datetime-local' : col.type === 'date' ? 'date' : col.type === 'number' ? 'number' : 'text'}
                            value={editValue ?? ''}
                            onChange={(event) => setEditValue(event.target.value)}
                            onBlur={() => void handleSave(rowId, colKey)}
                            onKeyDown={(event) => handleKeyDown(event, rowId, colKey)}
                            onClick={(event) => event.stopPropagation()}
                            className="h-9 w-full min-w-0 rounded-lg border-primary text-sm font-medium"
                          />
                        )
                      ) : (
                        <div className="min-w-0 break-words text-sm font-medium text-foreground">
                          {col.render ? col.render(value, row) : String(value ?? '—')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {(actions || onRowDelete) && (
                <div data-action-group="true" className="flex min-w-0 flex-wrap items-center justify-end gap-2 border-t border-border/40 bg-muted/10 p-3">
                  {actions ? actions(row) : (
                    <Button
                      type="button"
                      variant="destructive"
                      className="h-10 rounded-xl px-4 text-xs font-black uppercase tracking-widest"
                      onClick={() => setConfirmDeleteId(rowId)}
                    >
                      <Trash2 className="mr-2 size-4" /> Eliminar
                    </Button>
                  )}
                </div>
              )}
            </motion.article>
          );
        })}
        {data.length === 0 && !isLoading && (
          <div className="rounded-2xl border border-dashed border-border/50 px-4 py-12 text-center text-sm italic text-muted-foreground">
            No hay registros disponibles.
          </div>
        )}
      </div>

      {pagination && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3 text-xs text-muted-foreground" data-tour="sales-list-pagination">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span>Mostrar</span>
            <Select value={String(pagination.pageSize)} onValueChange={(nextValue) => pagination.onPageSizeChange(Number(nextValue) as SalesPaginationControls['pageSize'])}>
              <SelectTrigger size="sm" className="h-8 w-auto rounded-lg border-border/50 bg-background px-2 font-bold text-foreground" aria-label="Registros por página">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {[50, 100, 200].map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
              </SelectContent>
            </Select>
            <span>por página</span>
            <span className="ml-2 rounded-lg border border-border/40 px-2 py-1">
              {pagination.total === 0 ? 0 : `${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, pagination.total)}`} de {pagination.total}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="rounded-lg border border-border/50 p-2 disabled:opacity-30" onClick={() => pagination.onPageChange(1)} disabled={pagination.page <= 1} aria-label="Primera página"><ChevronsLeft className="size-4" /></button>
            <button type="button" className="rounded-lg border border-border/50 p-2 disabled:opacity-30" onClick={() => pagination.onPageChange(pagination.page - 1)} disabled={pagination.page <= 1} aria-label="Página anterior"><ChevronLeft className="size-4" /></button>
            <span className="min-w-24 text-center font-bold text-foreground">Pág. {pagination.page} / {Math.max(1, pagination.totalPages)}</span>
            <button type="button" className="rounded-lg border border-border/50 p-2 disabled:opacity-30" onClick={() => pagination.onPageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} aria-label="Página siguiente"><ChevronRight className="size-4" /></button>
            <button type="button" className="rounded-lg border border-border/50 p-2 disabled:opacity-30" onClick={() => pagination.onPageChange(pagination.totalPages)} disabled={pagination.page >= pagination.totalPages} aria-label="Última página"><ChevronsRight className="size-4" /></button>
          </div>
        </div>
      )}

      <Dialog open={mobileActionsRow !== null} onOpenChange={(open) => !open && setMobileActionsRow(null)}>
        <DialogContent className="w-[calc(100%-2rem)] !max-w-sm rounded-3xl p-0">
          <DialogHeader className="border-b border-border/40 px-5 py-4">
            <DialogTitle className="text-base font-black">Acciones del registro</DialogTitle>
            <DialogDescription className="sr-only">Acciones disponibles para el registro seleccionado</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 p-4" onClick={() => setMobileActionsRow(null)}>
            {mobileActionsRow && actions?.(mobileActionsRow)}
            {mobileActionsRow && !actions && onRowDelete && (
              <Button
                type="button"
                variant="destructive"
                className="h-11 w-full justify-start rounded-xl"
                onClick={() => setConfirmDeleteId(mobileActionsRow[idField])}
              >
                <Trash2 className="mr-2 size-4" /> Eliminar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
        title="¿Eliminar registro?"
        description="¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={async () => {
          if (confirmDeleteId === null || !onRowDelete) return;
          try {
            setDeleteLoading(true);
            await onRowDelete(confirmDeleteId);
          } finally {
            setDeleteLoading(false);
            setConfirmDeleteId(null);
          }
        }}
      />
      <ConfirmDialog
        open={confirmBulkDeleteIds.length > 0}
        onOpenChange={(open) => { if (!open) setConfirmBulkDeleteIds([]); }}
        title={isBulkCancel || isBulkReject ? `¿${bulkActionLabel} registros seleccionados?` : '¿Eliminar registros seleccionados?'}
        description={isBulkCancel || isBulkReject
          ? `${confirmBulkDeleteIds.length} registros quedarán ${isBulkReject ? 'rechazados' : 'cancelados'}. No se borrará ningún dato y esta acción no se puede deshacer.`
          : `Se eliminarán ${confirmBulkDeleteIds.length} registros. Esta acción no se puede deshacer.`}
        confirmLabel={bulkActionLabel}
        variant="destructive"
        loading={bulkDeleteLoading}
        onConfirm={async () => {
          if (!onBulkDelete || confirmBulkDeleteIds.length === 0) return;
          try {
            setBulkDeleteLoading(true);
            await onBulkDelete(confirmBulkDeleteIds);
            setSelectedIds(new Set());
            setConfirmBulkDeleteIds([]);
          } finally {
            setBulkDeleteLoading(false);
          }
        }}
      />
    </div>
    </BoneyardSkeleton>
  );
}
