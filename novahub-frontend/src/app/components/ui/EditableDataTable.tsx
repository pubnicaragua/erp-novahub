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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './dialog';
import { Label } from './label';
import { Search, Edit3, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

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
  
  // Mobile Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [itemBeingEdited, setItemBeingEdited] = useState<T | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 50];

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

  const handleModalSave = async () => {
    if (!itemBeingEdited) return;
    try {
      setEditLoading(true);
      const rowId = itemBeingEdited[idField];
      const original = initialData.find(r => r[idField] === rowId);
      if (!original) return;

      const updates: Partial<T> = {};
      columns.forEach(col => {
        const key = col.key as keyof T;
        if (col.editable && itemBeingEdited[key] !== original[key]) {
          updates[key] = itemBeingEdited[key];
        }
      });

      if (Object.keys(updates).length > 0) {
        if (onRowUpdate) {
            await onRowUpdate(rowId, updates);
            toast.success('Registro actualizado exitosamente');
        }
      }
      setIsEditModalOpen(false);
      setItemBeingEdited(null);
    } catch {
      toast.error('Error al actualizar registro');
    } finally {
      setEditLoading(false);
    }
  };

  const filteredData = data.filter(item => {
    return Object.values(item).some(val => 
        String(val || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Reset to first page on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="w-full space-y-4" onPaste={handlePaste}>
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
          <Input 
            placeholder="Buscar en tabla..." 
            className="pl-9 h-10 bg-muted/20 border-border/50 rounded-xl text-xs font-bold uppercase tracking-widest"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {allowAddRow && (
           <Button 
              variant="outline" 
              className="h-10 text-[10px] font-black uppercase tracking-widest text-primary border-primary/20 hover:bg-primary/5 rounded-xl px-6 w-full sm:w-auto"
              onClick={handleAddNewRow}
           >
              <Plus className="size-4 mr-2" /> Agregar Nueva Fila
           </Button>
         )}
      </div>

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
        {/* Desktop View */}
        <div className="hidden md:block">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-none">
              {showSelection && (
                <TableHead className="w-12 text-center h-12">
                  <Checkbox 
                    checked={selectedIds.size === paginatedData.length && paginatedData.length > 0} 
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
            {paginatedData.map((row) => {
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
            {paginatedData.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={columns.length + (showSelection ? 2 : 1)} className="h-32 text-center text-muted-foreground/50 italic text-sm">
                   No hay registros para la búsqueda.
                </TableCell>
              </TableRow>
            )}

            {/* Loading skeleton placeholder could go here */}
          </TableBody>
        </Table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden block space-y-4 p-4 bg-muted/10">
          {isLoading ? (
            <div className="h-32 flex items-center justify-center text-sm font-black uppercase tracking-widest text-muted-foreground/40 italic">Cargando...</div>
          ) : paginatedData.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-sm font-black uppercase tracking-widest text-muted-foreground/40 italic">No hay registros</div>
          ) : paginatedData.map((row) => {
            const rowId = row[idField];
            const isSelected = selectedIds.has(rowId);
            const isDraft = draftRows.has(rowId);

            return (
              <div 
                key={rowId} 
                className={cn(
                  "relative overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-background to-muted/20 p-5 shadow-sm transition-all active:scale-[0.98]",
                  isSelected ? "border-primary ring-2 ring-primary/20" : "border-border/50"
                )}
              >
                {/* Header of Card */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50 gap-4">
                  <div className="flex items-center gap-3">
                    {showSelection && (
                       <Checkbox 
                        checked={isSelected} 
                        onCheckedChange={() => toggleSelectRow(rowId)}
                      />
                    )}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1">Registro</p>
                        <p className="text-sm font-black text-foreground truncate max-w-[140px] xs:max-w-none">
                            {String(row.name || row.number || row.id || 'N/A')}
                        </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm p-1 rounded-xl border border-border/50 shadow-inner">
                    {actions ? actions(row) : (
                        onRowDelete && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="size-8 text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/5 rounded-lg"
                                onClick={() => setConfirmDeleteId(rowId)}
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        )
                    )}
                  </div>
                </div>

                {/* Data of Card */}
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-x-6 gap-y-4">
                  {columns.map((col) => {
                    const value = row[col.key as string];
                    return (
                        <div key={col.key as string} className="space-y-1">
                            <p className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-wider font-mono">{col.header}</p>
                            <div className="text-[12px] font-bold text-foreground">
                                {col.render ? col.render(value, row) : value || '-'}
                            </div>
                        </div>
                    );
                  })}
                </div>

                {isDraft && (
                    <div className="mt-4 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-primary bg-primary/5 py-1 px-3 rounded-full w-fit">
                        <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                        Cambios sin guardar
                    </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-border/20 px-2 pb-8">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-xs text-muted-foreground font-medium w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span>Mostrar</span>
            <select 
              value={pageSize} 
              onChange={e => setPageSize(Number(e.target.value))} 
              className="h-8 rounded-lg border bg-background px-2 font-bold text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer"
            >
              {PAGE_SIZE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <span>filas por página</span>
          </div>
          <div className="h-4 w-px bg-border/40 hidden sm:block" />
          <p className="bg-primary/5 px-4 py-1.5 rounded-full border border-primary/10 text-xs text-muted-foreground whitespace-nowrap">
            Mostrando <span className="text-foreground font-black">{(currentPage-1)*pageSize + 1} - {Math.min(currentPage*pageSize, filteredData.length)}</span> de <span className="text-primary font-black">{filteredData.length}</span> registros totales
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setCurrentPage(1)} 
            disabled={currentPage === 1} 
            className="size-9 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all shadow-sm"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
            disabled={currentPage === 1} 
            className="size-9 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all shadow-sm"
          >
            <ChevronLeft className="size-4" />
          </Button>
          
          <div className="flex items-center px-4 h-9 min-w-[100px] justify-center rounded-lg border bg-muted/30 font-black text-xs shadow-inner">
             Pág. {currentPage} / {Math.max(1, totalPages)}
          </div>

          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
            disabled={currentPage === totalPages || totalPages === 0} 
            className="size-9 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all shadow-sm"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setCurrentPage(totalPages)} 
            disabled={currentPage === totalPages || totalPages === 0} 
            className="size-9 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all shadow-sm"
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Edit Modal (Mainly for Mobile) */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-tight">
              <Edit3 className="size-5 text-primary" /> Editar Registro
            </DialogTitle>
            <DialogDescription className="text-xs font-medium uppercase tracking-widest text-muted-foreground/50">
              Modifica los detalles del registro seleccionado.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-5 py-4 max-h-[60vh] overflow-y-auto px-1">
            {itemBeingEdited && columns.filter(c => c.editable).map(col => (
              <div key={col.key as string} className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{col.header}</Label>
                {col.type === 'select' ? (
                  <select 
                    className="flex h-10 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={itemBeingEdited[col.key as keyof T] || ''}
                    onChange={e => setItemBeingEdited({...itemBeingEdited, [col.key as keyof T]: e.target.value as any})}
                  >
                    <option value="">Seleccione...</option>
                    {(col.options || []).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                ) : (
                  <Input 
                    type={col.type === 'number' ? 'number' : col.type?.includes('date') ? col.type : 'text'}
                    value={itemBeingEdited[col.key as keyof T] || ''}
                    onChange={e => {
                        const val = col.type === 'number' ? Number(e.target.value) : e.target.value;
                        setItemBeingEdited({...itemBeingEdited, [col.key as keyof T]: val as any});
                    }}
                    className="h-10 rounded-xl bg-background/50 font-bold"
                  />
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4 border-t border-border/50 pt-4">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="rounded-xl grow sm:grow-0 font-black uppercase text-[10px] tracking-widest">Cancelar</Button>
            <Button 
              onClick={handleModalSave} 
              disabled={editLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl grow sm:grow-0 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20"
            >
              {editLoading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
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
    </div>
  );
}
