import { useState, useEffect } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../ui/table';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { 
  Plus, Trash2, Search, Filter, Download, 
  MoreHorizontal, CheckCircle2, Edit3
} from 'lucide-react';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from '../ui/dropdown-menu';
import { useCurrency } from '../../contexts/CurrencyContext';
import { cn } from '../ui/utils';
import { toast } from 'sonner';

interface Column {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'currency';
  options?: { value: string; label: string }[];
  editable?: boolean;
}

interface FinanceTableViewProps {
  data: any[];
  columns: Column[];
  onUpdate: (id: string, updates: any) => Promise<void>;
  onAdd: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  title: string;
  loading?: boolean;
}

export function FinanceTableView({ 
  data, 
  columns, 
  onUpdate, 
  onAdd, 
  onDelete, 
  title,
  loading 
}: FinanceTableViewProps) {
  const { formatConvertedAmount } = useCurrency();
  const [localData, setLocalData] = useState<any[]>(data);
  const [editingCell, setEditingCell] = useState<{ id: string; key: string } | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setLocalData(data);
  }, [data]);

  const handleCellEdit = (id: string, key: string, value: any) => {
    const newData = localData.map(item => {
      if (item.id === id) {
        return { ...item, [key]: value, isDraft: true };
      }
      return item;
    });
    setLocalData(newData);
  };

  const handleBlur = async (id: string, key: string, originalValue: any, newValue: any) => {
    setEditingCell(null);
    if (originalValue === newValue) return;

    try {
      setSavingIds(prev => new Set(prev).add(id));
      await onUpdate(id, { [key]: newValue });
      toast.success('Cambio guardado automáticamente');
      // Update local item status
      setLocalData(prev => prev.map(item => item.id === id ? { ...item, isDraft: false } : item));
    } catch (error) {
      toast.error('Error al guardar cambio');
      // Revert if needed or keep draft
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const filteredData = (localData || []).filter(item => 
    item && Object.values(item).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const renderCellContent = (item: any, col: Column) => {
    const value = item[col.key];
    
    if (col.type === 'currency') {
      const numValue = Number(value || 0);
      return (
        <span className={numValue >= 0 ? "text-emerald-500" : "text-rose-500"}>
          {formatConvertedAmount(numValue, item.currency, item.exchangeRate)}
        </span>
      );
    }
    
    if (col.type === 'date') {
      if (!value) return '-';
      const date = new Date(value);
      return isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
    }
    
    if (col.type === 'select') {
      return (
        <Badge variant="secondary" className="font-semibold uppercase text-[10px]">
          {value || '-'}
        </Badge>
      );
    }
    
    return value || '-';
  };

  return (
    <div className="space-y-4">
      {/* ... rest of the component ... */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold">{title}</h3>
          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-[#05602b]/30 text-[#05602b]">
            LIVE SYNC
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Buscar..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 w-[200px] lg:w-[300px]" 
            />
          </div>
          <button className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted">
            <Filter className="size-4" /> Filtros
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted">
            <Download className="size-4" /> Exportar
          </button>
          <button 
            onClick={onAdd}
            className="flex items-center gap-2 rounded-lg bg-[#05602b] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#044d22] transition-colors"
          >
            <Plus className="size-4" /> Nuevo Registro
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="w-[40px]"></TableHead>
                {columns.map(col => (
                  <TableHead key={col.key} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {col.label}
                  </TableHead>
                ))}
                <TableHead className="w-[80px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={columns.length + 2} className="h-24 text-center">Cargando datos...</TableCell></TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow><TableCell colSpan={columns.length + 2} className="h-24 text-center">No hay registros</TableCell></TableRow>
              ) : filteredData.map((item) => (
                <TableRow key={item.id} className="group hover:bg-muted/30 border-border/30 transition-colors">
                  <TableCell>
                    {savingIds.has(item.id) ? (
                      <div className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    ) : item.isDraft ? (
                      <span title="Borrador / Cambios pendientes">
                        <Edit3 className="size-4 text-orange-400" />
                      </span>
                    ) : (
                      <CheckCircle2 className="size-4 text-green-500/50" />
                    )}
                  </TableCell>
                  {columns.map(col => (
                    <TableCell 
                      key={col.key} 
                      className={cn(
                        "p-1.5 transition-all",
                        editingCell?.id === item.id && editingCell?.key === col.key ? "bg-primary/5 ring-1 ring-inset ring-primary" : ""
                      )}
                      onDoubleClick={() => col.editable && setEditingCell({ id: item.id, key: col.key })}
                    >
                      {editingCell?.id === item.id && editingCell?.key === col.key ? (
                        <input
                          autoFocus
                          type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                          className="w-full bg-transparent border-none outline-none text-sm px-1 font-medium"
                          value={item[col.key]}
                          onChange={(e) => handleCellEdit(item.id, col.key, col.type === 'number' ? Number(e.target.value) : e.target.value)}
                          onBlur={(e) => handleBlur(item.id, col.key, data.find(d => d.id === item.id)?.[col.key], e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                        />
                      ) : (
                        <div 
                          className={cn(
                            "px-1 py-1 text-sm cursor-pointer hover:bg-muted/50 rounded transition-colors",
                            col.type === 'currency' ? "font-bold" : "font-medium"
                          )}
                          onClick={() => col.editable && setEditingCell({ id: item.id, key: col.key })}
                        >
                          {renderCellContent(item, col)}
                        </div>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-2 hover:bg-muted rounded-lg transition-colors overflow-hidden">
                          <MoreHorizontal className="size-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem 
                          className="gap-2 text-destructive focus:text-destructive"
                          onClick={() => onDelete(item.id)}
                        >
                          <Trash2 className="size-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
        <p>Mostrando {filteredData.length} de {localData.length} registros</p>
        <p className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-green-500" /> Sistema sincronizado en tiempo real
        </p>
      </div>
    </div>
  );
}
