import React, { useState } from 'react';
import { DollarSign } from 'lucide-react';
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
import { intlImportsService, type IntlImportExpense } from '../../../services/intl-imports.service';

interface AddExpenseModalProps {
  containerId: string | null;
  containerNumber?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (expense: IntlImportExpense) => void;
}

const EXPENSE_TYPES = [
  { value: 'FLETE_MARITIMO', label: 'Flete Marítimo / Transporte' },
  { value: 'DAI_ARANCEL', label: 'Impuesto DAI / Arancel Aduanal' },
  { value: 'MANEJO_PUERTO', label: 'Manejo Portuario / Naviera' },
  { value: 'ALMACENAJE', label: 'Almacenaje y Bodegaje Aduanero' },
  { value: 'AGENCIA_ADUANA', label: 'Honorarios Agencia Aduanera' },
  { value: 'OTROS', label: 'Otros Gastos de Nacionalización' },
];

export function AddExpenseModal({
  containerId,
  containerNumber,
  open,
  onOpenChange,
  onSuccess,
}: AddExpenseModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    expenseType: 'FLETE_MARITIMO',
    amount: 0,
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!containerId) return;
    if (form.amount <= 0) {
      toast.error('El monto del gasto debe ser mayor a 0');
      return;
    }

    try {
      setLoading(true);
      const created = await intlImportsService.addExpense(containerId, {
        expenseType: form.expenseType,
        amount: form.amount,
        description: form.description.trim() || undefined,
      });

      toast.success(`Gasto registrado por $${form.amount.toFixed(2)} USD`);
      onSuccess(created);
      onOpenChange(false);
      setForm({
        expenseType: 'FLETE_MARITIMO',
        amount: 0,
        description: '',
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al registrar el gasto'));
    } finally {
      setLoading(false);
    }
  };

  if (!containerId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold">
            <DollarSign className="size-5 text-emerald-600 dark:text-emerald-400" />
            <DialogTitle>Registrar Gasto - {containerNumber || 'Contenedor'}</DialogTitle>
          </div>
          <DialogDescription>
            Agrega un gasto de nacionalización para incluirlo en la liquidación proporcional por CBM.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Tipo de Gasto / Rubro *
            </label>
            <select
              className="w-full text-xs rounded-md border border-border bg-background p-2"
              value={form.expenseType}
              onChange={(e) => setForm((prev) => ({ ...prev, expenseType: e.target.value }))}
            >
              {EXPENSE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Monto en USD ($) *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={form.amount || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Observaciones / Referencia de Factura (Opcional)
            </label>
            <Input
              placeholder="Ej. Factura naviera #99281"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Registrar Gasto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
