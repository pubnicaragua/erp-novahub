import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Loader2, Landmark } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';

const ACCOUNT_TYPES = [
  { value: 'CHECKING', label: 'Monetaria' },
  { value: 'SAVINGS', label: 'Ahorro' },
  { value: 'LOAN', label: 'Préstamo' },
  { value: 'CREDIT_CARD', label: 'Tarjeta de Crédito' },
];

const CURRENCIES = ['NIO', 'USD'];

export function BankAccountsView() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ bankName: '', accountNumber: '', accountType: 'CHECKING', currency: 'NIO', notes: '', accountId: '' });

  const fetch = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/bank-accounts');
      setAccounts(Array.isArray(res) ? res : (res?.data || []));
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al cargar cuentas bancarias'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { Promise.resolve().then(fetch); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ bankName: '', accountNumber: '', accountType: 'CHECKING', currency: 'NIO', notes: '', accountId: '' });
    setFormOpen(true);
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setForm({ bankName: a.bankName, accountNumber: a.accountNumber, accountType: a.accountType, currency: a.currency, notes: a.notes || '', accountId: a.accountId || '' });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.bankName || !form.accountNumber) { toast.error('Banco y número de cuenta son requeridos'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/bank-accounts/${editing.id}`, form);
        toast.success('Cuenta bancaria actualizada');
      } else {
        await api.post('/bank-accounts', form);
        toast.success('Cuenta bancaria creada');
      }
      setFormOpen(false);
      fetch();
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/bank-accounts/${id}`);
      toast.success('Cuenta bancaria eliminada');
      fetch();
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al eliminar'));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 px-5 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="size-4 text-primary" />
            <CardTitle className="text-sm font-black uppercase tracking-tight">Cuentas Bancarias</CardTitle>
          </div>
          <Button size="sm" onClick={openCreate} className="rounded-xl gap-1 font-bold text-xs uppercase tracking-widest h-8">
            <Plus className="size-3.5" /> Agregar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <div className="overflow-x-auto rounded-xl border border-border/30">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="text-[10px] font-bold">Banco</TableHead>
                <TableHead className="text-[10px] font-bold">Número de Cuenta</TableHead>
                <TableHead className="text-[10px] font-bold">Tipo</TableHead>
                <TableHead className="text-[10px] font-bold">Moneda</TableHead>
                <TableHead className="text-[10px] font-bold">Estado</TableHead>
                <TableHead className="text-[10px] font-bold text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="size-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : accounts.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">Sin cuentas bancarias registradas</TableCell></TableRow>
              ) : accounts.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs font-medium">{a.bankName}</TableCell>
                  <TableCell className="text-xs font-mono">{a.accountNumber}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[9px]">{ACCOUNT_TYPES.find(t => t.value === a.accountType)?.label || a.accountType}</Badge></TableCell>
                  <TableCell className="text-xs">{a.currency}</TableCell>
                  <TableCell><Badge variant={a.isActive ? 'default' : 'secondary'} className="text-[9px]">{a.isActive ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(a)}><Edit2 className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="size-7 text-red-500" onClick={() => handleDelete(a.id)}><Trash2 className="size-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar' : 'Nueva'} Cuenta Bancaria</DialogTitle>
            <DialogDescription>Registra una cuenta bancaria de la empresa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Banco</label>
                <Input value={form.bankName} onChange={e => setForm({...form, bankName: e.target.value})} placeholder="BAC, Lafise, etc." />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Número de Cuenta</label>
                <Input value={form.accountNumber} onChange={e => setForm({...form, accountNumber: e.target.value})} placeholder="000-000-000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Tipo</label>
                <Select value={form.accountType} onValueChange={v => setForm({...form, accountType: v})}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Moneda</label>
                <Select value={form.currency} onValueChange={v => setForm({...form, currency: v})}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold">Notas</label>
              <textarea className="w-full min-h-[50px] rounded-lg border border-input bg-background p-2 text-sm" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="size-3.5 mr-1 animate-spin" />}Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
