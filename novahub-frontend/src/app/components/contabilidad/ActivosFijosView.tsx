import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Plus, Search, RefreshCw, DollarSign, Package } from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';

interface FixedAsset {
  id: string;
  accountCode: string;
  accountName: string;
  acquisitionCost: number;
  currentBalance: number;
  transactions: number;
}

interface NewAssetForm {
  accountCode: string;
  accountName: string;
  acquisitionCost: number;
  description: string;
}

function emptyForm(): NewAssetForm {
  return { accountCode: '', accountName: '', acquisitionCost: 0, description: '' };
}

export function ActivosFijosView() {
  const { canPerform } = useAuth();
  const { baseCurrency, formatConvertedAmount } = useCurrency();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<NewAssetForm>(emptyForm());

  const assetsQuery = useAccountingQuery<FixedAsset[]>(['fixed-assets'], async (signal) => accountingList(await contabilidadService.getFixedAssets(signal)) as FixedAsset[]);
  const assets = assetsQuery.data || [];
  const loading = assetsQuery.isLoading || assetsQuery.isFetching;
  const loadAssets = () => assetsQuery.refetch();

  const filtered = assets.filter((a) =>
    !searchTerm ||
    a.accountCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.accountName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAcquisition = filtered.reduce((s, a) => s + a.acquisitionCost, 0);
  const totalCurrent = filtered.reduce((s, a) => s + a.currentBalance, 0);
  const formatCurrency = (value: number) => formatConvertedAmount(value, baseCurrency);

  function handleFormChange(field: keyof NewAssetForm, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm());
  }

  async function handleRegister() {
    if (!form.accountCode.trim() || !form.accountName.trim() || form.acquisitionCost <= 0) {
      toast.error('Complete todos los campos requeridos');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      await contabilidadService.registerFixedAsset(form);
      toast.success('Activo fijo registrado exitosamente');
      setCreateOpen(false);
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ['accounting'] });
    } catch (err: any) {
      toast.error(err.message || 'Error al registrar activo fijo');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase italic">
            Activos <span className="text-primary">Fijos</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Registro y control de activos fijos de la empresa
          </p>
        </div>
        {canPerform('ACCOUNTING_ASSETS', 'create') && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" />
                Nuevo Activo Fijo
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Activo Fijo</DialogTitle>
              <DialogDescription>
                Ingresa los datos del nuevo activo fijo
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="asset-code">Código de Cuenta</Label>
                <Input
                  id="asset-code"
                  placeholder="Ej: 1.5.01"
                  value={form.accountCode}
                  onChange={(e) => handleFormChange('accountCode', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-name">Nombre del Activo</Label>
                <Input
                  id="asset-name"
                  placeholder="Ej: Edificio Administrativo"
                  value={form.accountName}
                  onChange={(e) => handleFormChange('accountName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-cost">Costo de Adquisición</Label>
                <Input
                  id="asset-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.acquisitionCost || ''}
                  onChange={(e) => handleFormChange('acquisitionCost', e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-desc">Descripción</Label>
                <Input
                  id="asset-desc"
                  placeholder="Descripción opcional"
                  value={form.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button onClick={handleRegister} disabled={submitting}>
                {submitting ? 'Guardando...' : 'Registrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Package className="size-3.5" /> Total Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black">{assets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <DollarSign className="size-3.5" /> Costo Adquisición
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-emerald-600">{formatCurrency(totalAcquisition)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <DollarSign className="size-3.5" /> Saldo Actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-primary">{formatCurrency(totalCurrent)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-lg font-bold">
            <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
              <span>Activos Fijos Registrados</span>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 w-full pl-9 text-xs sm:w-[200px]"
                />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadAssets} disabled={loading} className="h-8">
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Search className="size-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No hay activos fijos</p>
              <p className="text-xs mt-1">Registra un nuevo activo para comenzar</p>
            </div>
          ) : (
            <div className="space-y-2">
            <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Código</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Nombre del Activo</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Costo Adquisición</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Saldo Actual</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Transacciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((asset) => (
                  <TableRow key={asset.id} className="hover:bg-muted/30 border-border/30">
                    <TableCell className="font-mono text-xs">{asset.accountCode}</TableCell>
                    <TableCell className="font-medium text-xs">{asset.accountName}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCurrency(asset.acquisitionCost)}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-emerald-600">{formatCurrency(asset.currentBalance)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="text-[10px] font-bold">{asset.transactions}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            <div className="space-y-2 p-3 md:hidden">
              {filtered.map((asset) => (
                <div key={asset.id} className="min-w-0 rounded-xl border border-border/30 bg-muted/20 p-3">
                  <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-mono text-muted-foreground">{asset.accountCode}</p><p className="break-words text-xs font-bold">{asset.accountName}</p></div><Badge variant="secondary" className="shrink-0 text-[10px]">{asset.transactions}</Badge></div>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/20 pt-2 text-[10px]"><div><span className="block text-muted-foreground">Costo adquisición</span><span className="font-mono">{formatCurrency(asset.acquisitionCost)}</span></div><div><span className="block text-muted-foreground">Saldo actual</span><span className="font-bold text-emerald-600">{formatCurrency(asset.currentBalance)}</span></div></div>
                </div>
              ))}
            </div>
            </div>
          )}
        </CardContent>
        {filtered.length > 0 && (
          <div className="px-6 py-3 flex items-center justify-between bg-muted/20 border-t border-border/50 rounded-b-2xl text-xs font-bold">
            <span className="uppercase tracking-wider text-muted-foreground">{filtered.length} activos</span>
            <div className="flex items-center gap-6">
              <span className="text-muted-foreground">Costo Total: <span className="text-foreground">{formatCurrency(totalAcquisition)}</span></span>
              <span className="text-muted-foreground">Saldo Total: <span className="text-emerald-600">{formatCurrency(totalCurrent)}</span></span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
