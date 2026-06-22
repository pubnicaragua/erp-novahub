import React, { useState } from 'react';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { LegalInvoice } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, FileText, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { legalInvoicesService } from '../../services/documentos.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';
import { useCurrency } from '../../contexts/CurrencyContext';

interface FacturasLegalesViewProps {
  data: LegalInvoice[];
  loading: boolean;
  onRefresh: () => void;
}

export const FacturasLegalesView: React.FC<FacturasLegalesViewProps> = ({ data, loading, onRefresh }) => {
  const { formatConvertedAmount, displayCurrency, baseCurrency, exchangeRate, convertAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');

  const statusOpts = [
    { value: 'PENDING', label: 'Pendiente', color: 'bg-amber-500/10 text-amber-500' },
    { value: 'PAID', label: 'Pagada', color: 'bg-emerald-500/10 text-emerald-500' },
    { value: 'OVERDUE', label: 'Vencida', color: 'bg-rose-500/10 text-rose-500' },
    { value: 'VOID', label: 'Anulada', color: 'bg-muted/20 text-muted-foreground' },
  ];

  const columns: ColumnDef<LegalInvoice>[] = [
    { key: 'number', header: 'Factura', width: '120px', editable: true },
    { key: 'type', header: 'Tipo', width: '20%', editable: true },
    { key: 'amount', header: 'Monto', width: '120px', editable: true, type: 'number', render: (val: any, row: LegalInvoice) => val ? formatConvertedAmount(Number(val), row.currency || baseCurrency, row.exchangeRate) : '-' },
    { key: 'issueDate', header: 'Emisión', width: '140px', editable: true, type: 'date', render: (val: any) => val ? format(new Date(val), 'MMM dd, yyyy') : '-' },
    { key: 'status', header: 'Estado', width: '120px', editable: true, type: 'select', options: statusOpts,
      render: (val: any) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<LegalInvoice>) => {
    try { await legalInvoicesService.update(id as string, updates); toast.success('Factura actualizada'); onRefresh(); }
    catch { toast.error('Error al actualizar'); }
  };

  const handleAdd = async () => {
    try {
      await legalInvoicesService.create({ number: `FAC-${Date.now().toString().slice(-5)}`, type: 'Servicios', amount: 0, currency: baseCurrency, exchangeRate, status: 'PENDING' as any, issueDate: new Date().toISOString() });
      toast.success('Factura creada'); onRefresh();
    } catch { toast.error('Error al crear'); }
  };

  const totalConverted = data.reduce(
    (sum, invoice) => sum + convertAmount(Number(invoice.amount || 0), invoice.currency || baseCurrency, invoice.exchangeRate),
    0,
  );
  const kpis = [
    { title: `Total Emitido (${displayCurrency})`, value: formatConvertedAmount(totalConverted, displayCurrency), icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Facturas',        value: data.length,                                                                    icon: FileText,      color: 'text-amber-500',  bg: 'bg-amber-500/10'   },
    { title: 'Pagadas',         value: data.filter(f => (f.status||'').toUpperCase() === 'PAID').length,               icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Vencidas',        value: data.filter(f => (f.status||'').toUpperCase() === 'OVERDUE').length,            icon: AlertTriangle, color: 'text-rose-500',   bg: 'bg-rose-500/10'    },
  ];

  const filtered = data.filter(f => f.number?.toLowerCase().includes(searchTerm.toLowerCase()) || f.type?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border-none bg-background/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl flex items-center justify-center", kpi.bg)}><kpi.icon className={cn("size-6", kpi.color)} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p><p className="text-2xl font-black tracking-tight">{kpi.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none bg-background/50 backdrop-blur-xl shadow-sm">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight">Facturas Legales</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">DTEs y documentos fiscales</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={handleAdd} className="bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Registrar Factura</Button>
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} onRowDelete={async (id) => { try { await legalInvoicesService.delete(id as string); toast.success('Eliminada'); onRefresh(); } catch { toast.error('Error al eliminar'); } }} />
      </Card>
    </div>
  );
};

