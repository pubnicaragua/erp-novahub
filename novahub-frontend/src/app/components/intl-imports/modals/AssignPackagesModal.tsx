import { useEffect, useState, useMemo } from 'react';
import { PackageCheck, Search, CheckSquare, Square } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '@/app/services/api';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../ui/dialog';
import {
  intlImportsService,
  type IntlImportContainer,
  type IntlImportPackage,
} from '../../../services/intl-imports.service';

interface AssignPackagesModalProps {
  container: IntlImportContainer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AssignPackagesModal({
  container,
  open,
  onOpenChange,
  onSuccess,
}: AssignPackagesModalProps) {
  const [packages, setPackages] = useState<IntlImportPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    if (open && container) {
      const fetchAvailable = async () => {
        setLoading(true);
        try {
          // `unassignedOnly` es explicito: solo mercancia sin contenedor. El
        // status acota ademas a lo que sigue en bodega, de modo que un paquete
        // devuelto desde un contenedor vuelva a aparecer aqui.
        const res = await intlImportsService.listPackages({ unassignedOnly: true, status: 'RECEIVED_AT_WAREHOUSE', limit: 100 });
          if (active) {
            setPackages(res.data || []);
            setSelectedIds(new Set());
            setSearch('');
          }
        } catch (err) {
          if (active) toast.error(getApiErrorMessage(err, 'Error al cargar paquetes disponibles'));
        } finally {
          if (active) setLoading(false);
        }
      };
      void fetchAvailable();
    }
    return () => {
      active = false;
    };
  }, [open, container]);

  const filteredPackages = useMemo(() => {
    if (!search.trim()) return packages;
    const term = search.toLowerCase();
    return packages.filter(
      (p) =>
        p.trackingCode.toLowerCase().includes(term) ||
        (p.customerName || '').toLowerCase().includes(term) ||
        (p.originalTrackingNumber || '').toLowerCase().includes(term)
    );
  }, [packages, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPackages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPackages.map((p) => p.id)));
    }
  };

  const selectedCbm = useMemo(() => {
    return packages
      .filter((p) => selectedIds.has(p.id))
      .reduce((sum, p) => sum + (Number(p.billableCbm ?? p.volumeCbm) || 0), 0);
  }, [packages, selectedIds]);

  const selectedWeight = useMemo(() => {
    return packages
      .filter((p) => selectedIds.has(p.id))
      .reduce((sum, p) => sum + (Number(p.actualWeightKg) || 0), 0);
  }, [packages, selectedIds]);

  const containerMaxCbm = container?.capacityCbm || container?.maxCapacityCbm || 0;
  const containerMaxWeight = container?.maxWeightKg || 0;
  const currentCbm = container?.totalBillableCbm ?? container?.totalVolumeCbm ?? 0;
  const currentWeight = container?.totalActualWeightKg || 0;
  const projectedCbm = currentCbm + selectedCbm;
  const projectedWeight = currentWeight + selectedWeight;

  const exceedsCbm = containerMaxCbm > 0 && projectedCbm > containerMaxCbm;
  const exceedsWeight = containerMaxWeight > 0 && projectedWeight > containerMaxWeight;
  const hasCapacityError = exceedsCbm || exceedsWeight;

  const handleAssign = async () => {
    if (!container || selectedIds.size === 0 || hasCapacityError) return;
    try {
      setAssigning(true);
      const res = await intlImportsService.assignPackages(container.id, Array.from(selectedIds));
      toast.success(`${res.count || selectedIds.size} paquetes asignados a ${container.containerNumber}`);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al asignar paquetes al contenedor'));
    } finally {
      setAssigning(false);
    }
  };

  if (!container) return null;

  const allSelected = selectedIds.size === filteredPackages.length && filteredPackages.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold">
            <PackageCheck className="size-5 text-primary shrink-0" />
            <DialogTitle className="break-words">Asignar Paquetes a {container.containerNumber}</DialogTitle>
          </div>
          <DialogDescription>
            Selecciona los paquetes en Bodega Origen para consolidarlos en este contenedor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1 min-w-0">
          {/* Barra de búsqueda y resumen de capacidad */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
            <div className="flex items-center gap-2 w-full sm:w-64">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por CC o cliente..."
                  className="pl-8 h-9 text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {filteredPackages.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="sm:hidden h-9 px-2.5 text-[11px] shrink-0 gap-1.5"
                >
                  {allSelected ? (
                    <CheckSquare className="size-3.5 text-primary" />
                  ) : (
                    <Square className="size-3.5 text-muted-foreground" />
                  )}
                  Todos
                </Button>
              )}
            </div>

            <div className="text-xs bg-muted/40 px-3 py-1.5 rounded-md border border-border/60 flex items-center justify-between sm:justify-start gap-2 flex-wrap">
              <span className="font-bold text-foreground">{selectedIds.size} seleccionados</span>
              <span className="text-muted-foreground hidden sm:inline">|</span>
              <div className="flex items-center gap-2">
                <span className={`font-mono font-semibold ${exceedsCbm ? 'text-destructive font-bold' : 'text-primary'}`}>
                  {projectedCbm.toFixed(2)} / {containerMaxCbm || '∞'} CBM
                </span>
                <span className="text-muted-foreground">|</span>
                <span className={`font-mono font-semibold ${exceedsWeight ? 'text-destructive font-bold' : 'text-foreground'}`}>
                  {projectedWeight.toFixed(1)} / {containerMaxWeight || '∞'} kg
                </span>
              </div>
            </div>
          </div>

          {hasCapacityError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
              {exceedsCbm && (
                <p>
                  El volumen proyectado ({projectedCbm.toFixed(2)} CBM) supera la capacidad máxima del contenedor ({containerMaxCbm} CBM).
                </p>
              )}
              {exceedsWeight && (
                <p>
                  El peso proyectado ({projectedWeight.toFixed(1)} kg) supera la capacidad máxima de carga ({containerMaxWeight} kg).
                </p>
              )}
            </div>
          )}

          {/* Lista / Tabla de Selección con scroll contenido */}
          <div
            data-intl-scroll-list="true"
            data-keep-scroll="true"
            className="border border-border rounded-lg max-h-[42dvh] sm:max-h-72 overflow-y-auto overscroll-contain"
          >
            {loading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Cargando paquetes en bodega...</div>
            ) : filteredPackages.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No hay paquetes pendientes de consolidación en bodega.
              </div>
            ) : (
              <>
                {/* Vista móvil compacta (< 640px) */}
                <div className="divide-y divide-border/50 sm:hidden">
                  {filteredPackages.map((pkg) => {
                    const isSelected = selectedIds.has(pkg.id);
                    const pkgCbm = Number(pkg.billableCbm ?? pkg.volumeCbm) || 0;
                    return (
                      <div
                        key={pkg.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleSelect(pkg.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleSelect(pkg.id);
                          }
                        }}
                        className={`p-3 flex items-start gap-2.5 cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/10' : 'hover:bg-muted/40'
                        }`}
                      >
                        <div className="pt-0.5 shrink-0">
                          {isSelected ? (
                            <CheckSquare className="size-4 text-primary" />
                          ) : (
                            <Square className="size-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-xs text-primary truncate">
                              {pkg.trackingCode}
                            </span>
                            <span className="font-mono font-semibold text-xs text-foreground shrink-0">
                              {pkgCbm.toFixed(4)} CBM
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-foreground font-medium truncate">
                              {pkg.customer?.name || pkg.customerName || 'Cliente Genérico'}
                            </span>
                            <span className="font-mono text-muted-foreground shrink-0">
                              {pkg.actualWeightKg} kg
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Vista tabla (>= 640px) */}
                <table data-responsive-cards="false" className="hidden sm:table w-full text-xs text-left">
                  <thead className="bg-muted/60 border-b border-border text-muted-foreground font-semibold sticky top-0 bg-background z-10">
                    <tr>
                      <th className="p-2 w-10 text-center">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          aria-label="Seleccionar todos los paquetes"
                        >
                          {allSelected ? (
                            <CheckSquare className="size-4 text-primary" />
                          ) : (
                            <Square className="size-4 text-muted-foreground" />
                          )}
                        </button>
                      </th>
                      <th className="p-2">Código CC</th>
                      <th className="p-2">Cliente</th>
                      <th className="p-2 text-right">Peso Real</th>
                      <th className="p-2 text-right">Volumen / CBM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredPackages.map((pkg) => {
                      const isSelected = selectedIds.has(pkg.id);
                      const pkgCbm = Number(pkg.billableCbm ?? pkg.volumeCbm) || 0;
                      return (
                        <tr
                          key={pkg.id}
                          onClick={() => toggleSelect(pkg.id)}
                          className={`cursor-pointer hover:bg-muted/40 transition-colors ${
                            isSelected ? 'bg-primary/10' : ''
                          }`}
                        >
                          <td className="p-2 text-center">
                            {isSelected ? (
                              <CheckSquare className="size-4 text-primary inline" />
                            ) : (
                              <Square className="size-4 text-muted-foreground inline" />
                            )}
                          </td>
                          <td className="p-2 font-mono font-bold text-primary">
                            {pkg.trackingCode}
                          </td>
                          <td className="p-2 text-foreground font-medium">
                            {pkg.customer?.name || pkg.customerName || 'Cliente Genérico'}
                          </td>
                          <td className="p-2 text-right font-mono">{pkg.actualWeightKg} kg</td>
                          <td className="p-2 text-right font-mono font-semibold">{pkgCbm.toFixed(4)} CBM</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={assigning}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleAssign} disabled={assigning || selectedIds.size === 0 || hasCapacityError}>
            {assigning ? 'Asignando...' : `Consolidar ${selectedIds.size} Paquete(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
