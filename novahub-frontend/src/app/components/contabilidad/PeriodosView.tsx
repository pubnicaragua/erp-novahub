import { useState, useEffect } from 'react';
import {
  Calendar, Plus, Lock, Unlock, AlertTriangle
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../ui/select';
import { Label } from '../ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../ui/table';
import { contabilidadService } from '../../services/contabilidad.service';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

const statusStyles: Record<string, string> = {
  OPEN: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  LOCKED: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  CLOSED: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
};

const statusLabels: Record<string, string> = {
  OPEN: 'Abierto',
  LOCKED: 'Bloqueado',
  CLOSED: 'Cerrado',
};

const months = [
  { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' }, { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
];

export function PeriodosView() {
  const { canPerform } = useAuth();
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [closeConfirmId, setCloseConfirmId] = useState<string | null>(null);
  const [closeLoading, setCloseLoading] = useState(false);
  const [reopenConfirmId, setReopenConfirmId] = useState<string | null>(null);
  const [reopenLoading, setReopenLoading] = useState(false);
  const [form, setForm] = useState({ name: '', month: '', year: '' });

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const fetchPeriods = async () => {
    try {
      setLoading(true);
      const res = await contabilidadService.getPeriods();
      setPeriods(res || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al cargar períodos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  const handleCreate = async () => {
    if (!form.name || !form.month || !form.year) {
      toast.error('Completa todos los campos');
      return;
    }
    try {
      await contabilidadService.createPeriod({
        name: form.name,
        month: Number(form.month),
        year: Number(form.year),
        startDate: new Date(Number(form.year), Number(form.month) - 1, 1).toISOString(),
        endDate: new Date(Number(form.year), Number(form.month), 0).toISOString(),
      });
      toast.success('Período creado');
      setShowCreate(false);
      setForm({ name: '', month: '', year: '' });
      fetchPeriods();
    } catch (e: any) {
      toast.error(e?.message || 'Error al crear período');
    }
  };

  const handleClose = async () => {
    if (!closeConfirmId) return;
    try {
      setCloseLoading(true);
      await contabilidadService.closePeriod(closeConfirmId);
      toast.success('Período cerrado exitosamente');
      setCloseConfirmId(null);
      fetchPeriods();
    } catch (e: any) {
      toast.error(e?.message || 'Error al cerrar período');
    } finally {
      setCloseLoading(false);
    }
  };

  const handleReopen = async () => {
    if (!reopenConfirmId) return;
    try {
      setReopenLoading(true);
      await contabilidadService.reopenPeriod(reopenConfirmId);
      toast.success('Período reabierto');
      setReopenConfirmId(null);
      fetchPeriods();
    } catch (e: any) {
      toast.error(e?.message || 'Error al reabrir período');
    } finally {
      setReopenLoading(false);
    }
  };

  const isCurrentPeriod = (p: any) =>
    p.year === currentYear && p.month === currentMonth;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Períodos Contables</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">
            {periods.length} período(s) registrado(s)
          </p>
        </div>
        {canPerform('ACCOUNTING_PERIODS', 'create') && (
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20"
          >
            <Plus className="size-4" /> Nuevo Período
          </Button>
        )}
      </div>

      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Nombre</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Mes</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Año</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha Inicio</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha Fin</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground/50 italic py-12">Cargando...</TableCell></TableRow>
              ) : periods.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground/50 italic py-12">No hay períodos registrados</TableCell></TableRow>
              ) : periods.map((p) => (
                <TableRow key={p.id} className={cn(isCurrentPeriod(p) && 'bg-primary/[0.03]')}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black">{p.name}</span>
                      {isCurrentPeriod(p) && (
                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                          Actual
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{months.find((m) => m.value === String(p.month))?.label || p.month}</TableCell>
                  <TableCell className="text-xs font-mono">{p.year}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.startDate ? new Date(p.startDate).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.endDate ? new Date(p.endDate).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5', statusStyles[p.status || 'OPEN'])}>
                      {statusLabels[p.status || 'OPEN']}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {p.status === 'OPEN' && canPerform('ACCOUNTING_PERIODS', 'edit') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500"
                          onClick={() => setCloseConfirmId(p.id)}
                          title="Cerrar Período"
                        >
                          <Lock className="size-4" />
                        </Button>
                      )}
                      {p.status === 'CLOSED' && canPerform('ACCOUNTING_PERIODS', 'edit') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500"
                          onClick={() => setReopenConfirmId(p.id)}
                          title="Reabrir Período"
                        >
                          <Unlock className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Nuevo Período Contable</DialogTitle>
            <DialogDescription className="text-xs">Crea un nuevo período para el registro contable</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2 space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Julio 2026" className="h-9 text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mes</Label>
              <Select value={form.month} onValueChange={(v) => setForm({ ...form, month: v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Seleccionar mes" /></SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Año</Label>
              <Input type="number" min="2020" max="2100" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="Ej: 2026" className="h-9 text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-xl text-[10px] font-black uppercase tracking-widest">Cancelar</Button>
            <Button onClick={handleCreate} className="rounded-xl bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
              <Calendar className="size-3 mr-2" /> Crear Período
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closeConfirmId} onOpenChange={(o) => { if (!o) setCloseConfirmId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-full bg-amber-500/10"><AlertTriangle className="size-6 text-amber-500" /></div>
              <div>
                <DialogTitle className="text-lg font-black uppercase tracking-tight">Cerrar Período</DialogTitle>
                <DialogDescription className="text-xs">¿Estás seguro de cerrar este período? Se verificará que el balance de comprobación esté cuadrado.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCloseConfirmId(null)} className="rounded-xl text-[10px] font-black uppercase tracking-widest">Cancelar</Button>
            <Button onClick={handleClose} disabled={closeLoading} className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-[10px] tracking-widest">
              {closeLoading ? 'Cerrando...' : 'Cerrar Período'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reopenConfirmId} onOpenChange={(o) => { if (!o) setReopenConfirmId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-full bg-emerald-500/10"><Unlock className="size-6 text-emerald-500" /></div>
              <div>
                <DialogTitle className="text-lg font-black uppercase tracking-tight">Reabrir Período</DialogTitle>
                <DialogDescription className="text-xs">Esta acción requiere permisos de administrador. ¿Deseas reabrir este período cerrado?</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReopenConfirmId(null)} className="rounded-xl text-[10px] font-black uppercase tracking-widest">Cancelar</Button>
            <Button onClick={handleReopen} disabled={reopenLoading} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest">
              {reopenLoading ? 'Reabriendo...' : 'Reabrir Período'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
