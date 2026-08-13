import { Fragment, useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { RefreshCw, GitBranch, Search, ChevronDown, ArrowRight, Layers } from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { toast } from 'sonner';
import { useAccountingQuery } from '../../hooks/useAccountingQuery';

interface ActivityLine {
  accountId: string | null;
  accountCode: string;
  accountName: string;
  accountType: string | null;
  debit: number;
  credit: number;
  description: string | null;
}

interface ActivityItem {
  id: string;
  number: string;
  date: string;
  description: string;
  status: string;
  referenceType: string;
  referenceId: string | null;
  module: string;
  typeLabel: string;
  documentLabel: string | null;
  debitTotal: number;
  creditTotal: number;
  lines: ActivityLine[];
}

const MODULE_COLORS: Record<string, string> = {
  Ventas: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  Compras: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  Caja: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  Gastos: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  Finanzas: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  RRHH: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  Inventario: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  'Activos fijos': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'Diferencias cambiarias': 'bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20',
  Manual: 'bg-muted text-muted-foreground border-border/30',
};

const fmt = (n: number) => n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ActividadModulosView() {
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const query = useAccountingQuery<{ items: ActivityItem[] } | null>(
    ['module-activity'],
    async (signal) => {
      const raw: any = await contabilidadService.getModuleActivity(100, signal);
      return Array.isArray(raw) ? { items: raw } : raw;
    },
  );
  const loading = query.isLoading || query.isFetching;
  useEffect(() => {
    if (query.error) toast.error(query.error.message || 'Error al cargar la actividad por módulo');
  }, [query.error]);

  const items = useMemo(() => {
    if (!query.data?.items) return [];
    const term = search.trim().toLowerCase();
    return query.data.items.filter(item => {
      if (moduleFilter !== 'todos' && item.module !== moduleFilter) return false;
      if (!term) return true;
      return (
        item.description.toLowerCase().includes(term) ||
        item.typeLabel.toLowerCase().includes(term) ||
        item.number.toLowerCase().includes(term) ||
        (item.documentLabel || '').toLowerCase().includes(term) ||
        item.lines.some(l => l.accountName.toLowerCase().includes(term) || l.accountCode.toLowerCase().includes(term))
      );
    });
  }, [query.data, search, moduleFilter]);

  const modules = useMemo(() => {
    const set = new Set<string>();
    query.data?.items?.forEach(i => set.add(i.module));
    return ['todos', ...Array.from(set).sort()];
  }, [query.data]);

  const flowSteps = (item: ActivityItem) => [
    `${item.typeLabel}${item.documentLabel ? ` · ${item.documentLabel}` : ''}`,
    `Asiento ${item.number}`,
    'Transacciones por cuenta',
    'Libro Diario → Balance General / Comprobación / Resultados',
  ];

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-5 bg-muted/30 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-[0.2em] bg-background/50 px-3 py-1.5 rounded-lg border border-border/30 shrink-0">
          <GitBranch className="size-3.5" /> Conexión de módulos
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-4">
          <div className="relative min-w-0 sm:col-span-2 lg:flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por documento, cuenta, asiento..."
              className="h-9 pl-9"
            />
          </div>
          <select
            value={moduleFilter}
            onChange={e => setModuleFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {modules.map(m => (
              <option key={m} value={m}>{m === 'todos' ? 'Todos los módulos' : m}</option>
            ))}
          </select>
        </div>
        <div className="lg:ml-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-border/20">
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={loading} className="h-9">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Actualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Layers className="size-5 text-primary" /> Actividad por Módulo
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Cómo cada módulo alimenta la contabilidad: el documento origen genera el asiento y sus líneas alimentan los reportes.
          </p>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Cargando...</div>
          ) : items.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Sin movimientos contables recientes</div>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-[110px]">Módulo</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Documento</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Fecha</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Descripción</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Debe</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Haber</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center w-[70px]">Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(item => {
                      const expanded = expandedId === item.id;
                      return (
                        <Fragment key={item.id}>
                          <TableRow
                            className={cn("border-b border-muted/30 cursor-pointer hover:bg-muted/10", expanded && "bg-muted/20")}
                            onClick={() => setExpandedId(expanded ? null : item.id)}
                          >
                            <TableCell className="py-2 px-2">
                              <Badge className={cn("text-[10px] border", MODULE_COLORS[item.module] || MODULE_COLORS['Manual'])}>
                                {item.module}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 px-2">
                              <p className="text-sm font-semibold leading-tight">{item.typeLabel}</p>
                              {item.documentLabel && <p className="text-[10px] text-muted-foreground">{item.documentLabel}</p>}
                            </TableCell>
                            <TableCell className="py-2 px-2 hidden md:table-cell text-xs whitespace-nowrap">
                              {new Date(item.date).toLocaleDateString('es')}
                            </TableCell>
                            <TableCell className="py-2 px-2 hidden lg:table-cell text-xs text-muted-foreground max-w-[280px] truncate" title={item.description}>
                              {item.description}
                            </TableCell>
                            <TableCell className="py-2 px-2 text-right font-mono text-xs">{fmt(item.debitTotal)}</TableCell>
                            <TableCell className="py-2 px-2 text-right font-mono text-xs">{fmt(item.creditTotal)}</TableCell>
                            <TableCell className="py-2 px-2 text-center">
                              <ChevronDown className={cn("size-4 mx-auto text-muted-foreground transition-transform", expanded && "rotate-180")} />
                            </TableCell>
                          </TableRow>
                          {expanded && (
                            <TableRow className="border-b border-border/20 bg-muted/10 hover:bg-muted/10">
                              <TableCell colSpan={7} className="p-0">
                                <div className="p-4 space-y-4">
                                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                                    {flowSteps(item).map((step, i, arr) => (
                                      <Fragment key={step}>
                                        <span className={cn(
                                          "px-2.5 py-1 rounded-lg border border-border/40 bg-card",
                                          i === arr.length - 1 && "text-primary border-primary/30 bg-primary/5"
                                        )}>{step}</span>
                                        {i < arr.length - 1 && <ArrowRight className="size-3 text-muted-foreground" />}
                                      </Fragment>
                                    ))}
                                  </div>
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="hover:bg-transparent border-border/40">
                                        <TableHead className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground w-[110px]">Cuenta</TableHead>
                                        <TableHead className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Nombre</TableHead>
                                        <TableHead className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Concepto</TableHead>
                                        <TableHead className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground text-right">Debe</TableHead>
                                        <TableHead className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground text-right">Haber</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {item.lines.map((line, i) => (
                                        <TableRow key={i} className="hover:bg-muted/20 border-border/30">
                                          <TableCell className="py-1.5 px-2 font-mono text-[11px]">{line.accountCode}</TableCell>
                                          <TableCell className="py-1.5 px-2 text-xs">{line.accountName}</TableCell>
                                          <TableCell className="py-1.5 px-2 hidden sm:table-cell text-[11px] text-muted-foreground">{line.description || ''}</TableCell>
                                          <TableCell className="py-1.5 px-2 text-right font-mono text-[11px]">{line.debit ? fmt(line.debit) : ''}</TableCell>
                                          <TableCell className="py-1.5 px-2 text-right font-mono text-[11px]">{line.credit ? fmt(line.credit) : ''}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
