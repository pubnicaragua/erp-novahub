import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { toast } from 'sonner';

interface MovimientoManualModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddMovement: (dto: any) => Promise<void>;
}

export function MovimientoManualModal({ open, onOpenChange, onAddMovement }: MovimientoManualModalProps) {
  const [type, setType] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [amountNIO, setAmountNIO] = useState('');
  const [amountUSD, setAmountUSD] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'CHECK' | 'CARD'>('CASH');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setType('ENTRY');
    setAmountNIO('');
    setAmountUSD('');
    setPaymentMethod('CASH');
    setDescription('');
    setReference('');
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('Debe ingresar una descripción');
      return;
    }
    const nio = parseFloat(amountNIO) || 0;
    const usd = parseFloat(amountUSD) || 0;
    if (nio === 0 && usd === 0) {
      toast.error('Debe ingresar al menos un monto');
      return;
    }

    try {
      setSubmitting(true);
      await onAddMovement({
        type,
        amountNIO: nio,
        amountUSD: usd,
        paymentMethod,
        description,
        reference
      });
      toast.success(type === 'ENTRY' ? 'Entrada registrada' : 'Salida registrada');
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al registrar movimiento');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if(!val) resetForm(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Movimiento de Caja</DialogTitle>
          <DialogDescription>Registre ingresos extra o salidas de dinero operativo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          
          <div className="flex bg-muted p-1 rounded-xl gap-1">
            <Button 
              variant={type === 'ENTRY' ? 'default' : 'ghost'}
              className={`flex-1 rounded-lg ${type === 'ENTRY' ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-primary/10'}`}
              onClick={() => setType('ENTRY')}
            >
              <ArrowDownToLine className="size-4 mr-2" /> Entrada
            </Button>
            <Button 
              variant={type === 'EXIT' ? 'destructive' : 'ghost'}
              className={`flex-1 rounded-lg ${type === 'EXIT' ? 'shadow-sm' : 'text-muted-foreground hover:bg-destructive/10'}`}
              onClick={() => setType('EXIT')}
            >
              <ArrowUpFromLine className="size-4 mr-2" /> Salida
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Monto Córdobas (C$)</Label>
              <Input type="number" min="0" step="0.01" value={amountNIO} onChange={e => setAmountNIO(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Monto Dólares ($)</Label>
              <Input type="number" min="0" step="0.01" value={amountUSD} onChange={e => setAmountUSD(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Forma de Pago</Label>
            <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Efectivo</SelectItem>
                <SelectItem value="TRANSFER">Transferencia / Depósito</SelectItem>
                <SelectItem value="CHECK">Cheque</SelectItem>
                <SelectItem value="CARD">Tarjeta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descripción / Motivo <span className="text-red-500">*</span></Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej. Pago de proveedor, Fondo extra..." />
          </div>

          <div className="space-y-2">
            <Label>Referencia (Opcional)</Label>
            <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="# Recibo, Factura..." />
          </div>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting} className={type === 'ENTRY' ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'}>
            Guardar {type === 'ENTRY' ? 'Entrada' : 'Salida'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
