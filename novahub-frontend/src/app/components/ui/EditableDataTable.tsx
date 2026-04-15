import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Pencil, Trash2, Copy, Eraser, Plus } from 'lucide-react';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ConfirmDialog } from './ConfirmDialog';

export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  editable?: boolean;
  type?: 'text' | 'number' | 'select' | 'date' | 'datetime-local' | 'badge';
  options?: { label: string; value: string; color?: string }[];
  render?: (value: any, row: T) => React.ReactNode;
}

interface EditableDataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  onRowUpdate?: (id: string | number, updates: Partial<T>) => Promise<void>;
  onRowDelete?: (id: string | number) => Promise<void>;
  onBulkDelete?: (ids: (string | number)[]) => Promise<void>;
  onBulkUpdate?: (ids: (string | number)[], updates: Partial<T>) => Promise<void>;
  idField?: keyof T;
  isLoading?: boolean;
  actions?: (row: T) => React.ReactNode;
  showSelection?: boolean;
  bulkActions?: (selectedIds: (string | number)[]) => React.ReactNode;
  onAddRow?: () => void;
  allowAddRow?: boolean;
}

export function EditableDataTable<T extends { [key: string]: any }>({
  data: initialData,
  columns,
  onRowUpdate,
  onRowDelete,
  onBulkDelete,
  idField = 'id' as keyof T,
  isLoading,
  actions,
  showSelection = true,
  bulkActions,
  onAddRow,
  allowAddRow = true,
}: EditableDataTableProps<T>) {
  const [data, setData] = useState<T[]>(initialData);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowId: string | number; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [draftRows, setDraftRows] = useState<Set<string | number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleCellClick = (rowId: string | number, colKey: string, value: any, editable?: boolean) => {
    if (!editable) return;
    setEditingCell({ rowId, colKey });
    setEditValue(value);
  };

  const handleSave = async (rowId: string | number, colKey: string, valueToSave?: any) => {
    if (!editingCell && valueToSave === undefined) return;
    
    const value = valueToSave !== undefined ? valueToSave : editValue;
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
 
    if (onRowUpdate) {
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
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map(r => r[idField])));
    }
  };

  const toggleSelectRow = (id: string | number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
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
  }, [data, columns, onRowUpdate, idField]);

  const handleAddNewRow = () => {
    if (onAddRow) {
      onAddRow();
    } else {
      const newId = `new-${Math.random().toString(36).substr(2, 9)}`;
      const newRow = { [idField]: newId } as any;
      // Initialize with empty strings for all keys in columns
      columns.forEach(col => {
        newRow[col.key as string] = '';
      });
      setData(prev => [...prev, newRow as T]);
      setDraftRows(prev => new Set(prev).add(newId));
      
      // Auto-focus first editable cell of new row
      const firstEditable = columns.find(c => c.editable);
      if (firstEditable) {
        setEditingCell({ rowId: newId, colKey: firstEditable.key as string });
        setEditValue('');
      }
    }
  };

  return (
    <div className="w-full space-y-4" onPaste={handlePaste}>
      {/* Bulk Actions Toolbar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl mb-4"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-black uppercase tracking-widest text-primary/60">
                {selectedIds.size} Seleccionados
              </span>
              <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase tracking-wider" onClick={() => setSelectedIds(new Set())}>
                <Eraser className="size-3 mr-2" /> Despejar
              </Button>
            </div>
            <div className="flex items-center gap-2">
               {bulkActions && bulkActions(Array.from(selectedIds))}
               <Button variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase tracking-wider">
                  <Copy className="size-3 mr-2" /> Duplicar
               </Button>
               <Button variant="destructive" size="sm" className="h-8 text-[10px] font-black uppercase tracking-wider" onClick={() => onBulkDelete && onBulkDelete(Array.from(selectedIds))}>
                  <Trash2 className="size-3 mr-2" /> Eliminar
               </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-none">
              {showSelection && (
                <TableHead className="w-12 text-center h-12">
                  <Checkbox 
                    checked={selectedIds.size === data.length && data.length > 0} 
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead 
                  key={col.key as string} 
                  style={{ width: col.width }}
                  className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 h-12"
                >
                  {col.header}
                </TableHead>
              ))}
              <TableHead className="w-20 text-right pr-6 h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const rowId = row[idField];
              const isDraft = draftRows.has(rowId);
              const isSelected = selectedIds.has(rowId);

              return (
                <TableRow 
                  key={rowId} 
                  className={cn(
                    "group h-14 transition-all duration-300", 
                    isSelected ? "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/20"
                  )}
                >
                  {showSelection && (
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={isSelected} 
                        onCheckedChange={() => toggleSelectRow(rowId)}
                      />
                    </TableCell>
                  )}
                  {columns.map((col) => {
                    const colKey = col.key as string;
                    const value = row[colKey];
                    const isEditing = editingCell?.rowId === rowId && editingCell?.colKey === colKey;

                    return (
                      <TableCell 
                        key={colKey}
                        onClick={() => handleCellClick(rowId, colKey, value, col.editable)}
                        className={cn(
                          "relative cursor-cell group flex-1 h-14 min-w-[120px]",
                          col.editable && "hover:bg-primary/5 transition-colors",
                          isEditing && "p-0"
                        )}
                      >
                        {isEditing ? (
                          <div className="absolute inset-0 z-10 p-1 flex items-center bg-background border-2 border-primary shadow-xl">
                            {col.type === 'select' ? (
                              <select
                                value={editValue}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  setEditValue(newVal);
                                  // For select, we often want to save immediately
                                  handleSave(rowId, colKey, newVal);
                                }}
                                onBlur={() => handleSave(rowId, colKey)}
                                className="h-full w-full bg-transparent border-none focus:ring-0 text-[13px] font-medium px-2 outline-none cursor-pointer"
                              >
                                {col.options?.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            ) : (
                              <Input
                                ref={inputRef}
                                type={col.type === 'datetime-local' ? 'datetime-local' : col.type === 'date' ? 'date' : col.type === 'number' ? 'number' : 'text'}
                                value={editValue}
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
                            {col.editable && (
                              <Pencil className="size-3 ml-auto opacity-0 group-hover:opacity-30 transition-opacity text-primary" />
                            )}
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right pr-6 h-14">
                    <div className="flex justify-end items-center gap-1 transition-all">
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

      <div className="flex items-center justify-between px-2">
         <p className="text-[11px] font-medium text-muted-foreground/50 italic">
            Tip: Usa Tab para moverte entre celdas y Enter para guardar. O pega desde Excel.
         </p>
         {allowAddRow && (
           <Button 
              variant="ghost" 
              className="h-8 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10"
              onClick={handleAddNewRow}
           >
              <Plus className="size-3 mr-2" /> Agregar Nueva Fila
           </Button>
         )}
      </div>

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
    </div>
  );
}
