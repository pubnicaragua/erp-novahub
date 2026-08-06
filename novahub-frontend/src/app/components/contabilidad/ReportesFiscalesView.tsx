import { useState, useEffect } from 'react';
import {
  FileBarChart, FileText, Receipt, Users, Building2, Eye, ChevronDown, ChevronUp, Download
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
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
import * as XLSX from 'xlsx';

const statusStyles: Record<string, string> = {
  DRAFT: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  FINAL: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  SUBMITTED: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  FINAL: 'Final',
  SUBMITTED: 'Presentado',
};

const reportTypeInfo: Record<string, { label: string; icon: any; desc: string }> = {
  IVA: { label: 'Declaración IVA', icon: Receipt, desc: 'Genera la declaración mensual del Impuesto al Valor Agregado (IVA). Requiere mes y año.' },
  IR: { label: 'Declaración IR', icon: FileText, desc: 'Genera la declaración anual del Impuesto sobre la Renta (IR). Requiere el año fiscal.' },
  INSS: { label: 'Planilla INSS', icon: Users, desc: 'Genera la planilla mensual del Instituto Nicaragüense de Seguridad Social (INSS).' },
  INATEC: { label: 'Planilla INATEC', icon: Building2, desc: 'Genera la planilla mensual del Instituto Nacional Tecnológico (INATEC).' },
};

export function ReportesFiscalesView() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGenerate, setExpandedGenerate] = useState(true);
  const [showMeta, setShowMeta] = useState<any>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  // Generation forms
  const [ivaForm, setIvaForm] = useState({ month: '1', year: String(new Date().getFullYear()) });
  const [irForm, setIrForm] = useState({ year: String(new Date().getFullYear()) });
  const [inssForm, setInssForm] = useState({ month: '1', year: String(new Date().getFullYear()) });
  const [inatecForm, setInatecForm] = useState({ month: '1', year: String(new Date().getFullYear()) });

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await contabilidadService.getFiscalReports();
      setReports(res || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al cargar reportes fiscales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(fetchReports);
  }, []);

  const handleGenerate = async (type: string, promise: Promise<any>) => {
    try {
      setGenerating(type);
      await promise;
      toast.success(`${reportTypeInfo[type]?.label || type} generado exitosamente`);
      fetchReports();
    } catch (e: any) {
      toast.error(e?.message || `Error al generar ${type}`);
    } finally {
      setGenerating(null);
    }
  };

  const months = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' }, { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
  ];

  const formatReportType = (type: string) => reportTypeInfo[type]?.label || type;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Reportes Fiscales</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">
            {reports.length} reporte(s) generado(s)
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setExpandedGenerate(!expandedGenerate)}
          className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2"
        >
          {expandedGenerate ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          Generar Reporte
        </Button>
      </div>

      {expandedGenerate && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
                  <Receipt className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Declaración IVA</p>
                  <p className="text-[9px] text-muted-foreground/60">Impuesto al Valor Agregado</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{reportTypeInfo.IVA.desc}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Mes</Label>
                  <Select value={ivaForm.month} onValueChange={(v) => setIvaForm({ ...ivaForm, month: v })}>
                    <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {months.map((m) => <SelectItem key={m.value} value={m.value} className="text-[10px]">{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Año</Label>
                  <Input type="number" value={ivaForm.year} onChange={(e) => setIvaForm({ ...ivaForm, year: e.target.value })} className="h-8 text-[10px]" />
                </div>
              </div>
              <Button
                className="w-full h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[9px] tracking-widest shadow-lg shadow-blue-500/20"
                onClick={() => handleGenerate('IVA', contabilidadService.generateIvaDeclaration(Number(ivaForm.month), Number(ivaForm.year)))}
                disabled={generating === 'IVA'}
              >
                {generating === 'IVA' ? 'Generando...' : 'Generar IVA'}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <FileText className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Declaración IR</p>
                  <p className="text-[9px] text-muted-foreground/60">Impuesto sobre la Renta</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{reportTypeInfo.IR.desc}</p>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Año Fiscal</Label>
                <Input type="number" value={irForm.year} onChange={(e) => setIrForm({ year: e.target.value })} className="h-8 text-[10px]" />
              </div>
              <Button
                className="w-full h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[9px] tracking-widest shadow-lg shadow-emerald-500/20"
                onClick={() => handleGenerate('IR', contabilidadService.generateIrDeclaration(Number(irForm.year)))}
                disabled={generating === 'IR'}
              >
                {generating === 'IR' ? 'Generando...' : 'Generar IR'}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                  <Users className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Planilla INSS</p>
                  <p className="text-[9px] text-muted-foreground/60">Seguridad Social</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{reportTypeInfo.INSS.desc}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Mes</Label>
                  <Select value={inssForm.month} onValueChange={(v) => setInssForm({ ...inssForm, month: v })}>
                    <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {months.map((m) => <SelectItem key={m.value} value={m.value} className="text-[10px]">{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Año</Label>
                  <Input type="number" value={inssForm.year} onChange={(e) => setInssForm({ ...inssForm, year: e.target.value })} className="h-8 text-[10px]" />
                </div>
              </div>
              <Button
                className="w-full h-8 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-[9px] tracking-widest shadow-lg shadow-amber-500/20"
                onClick={() => handleGenerate('INSS', contabilidadService.generateInssPayroll(Number(inssForm.month), Number(inssForm.year)))}
                disabled={generating === 'INSS'}
              >
                {generating === 'INSS' ? 'Generando...' : 'Generar INSS'}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Planilla INATEC</p>
                  <p className="text-[9px] text-muted-foreground/60">Formación Técnica</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{reportTypeInfo.INATEC.desc}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Mes</Label>
                  <Select value={inatecForm.month} onValueChange={(v) => setInatecForm({ ...inatecForm, month: v })}>
                    <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {months.map((m) => <SelectItem key={m.value} value={m.value} className="text-[10px]">{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Año</Label>
                  <Input type="number" value={inatecForm.year} onChange={(e) => setInatecForm({ ...inatecForm, year: e.target.value })} className="h-8 text-[10px]" />
                </div>
              </div>
              <Button
                className="w-full h-8 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-[9px] tracking-widest shadow-lg shadow-purple-500/20"
                onClick={() => handleGenerate('INATEC', contabilidadService.generateInatecPayroll(Number(inatecForm.month), Number(inatecForm.year)))}
                disabled={generating === 'INATEC'}
              >
                {generating === 'INATEC' ? 'Generando...' : 'Generar INATEC'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Tipo</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Período</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Año</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Mes</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Monto Total</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Impuesto</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Generado</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-xs text-muted-foreground/50 italic py-12">Cargando...</TableCell></TableRow>
              ) : reports.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-xs text-muted-foreground/50 italic py-12">No hay reportes fiscales generados. Usa las tarjetas de arriba para generar uno.</TableCell></TableRow>
              ) : reports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const info = reportTypeInfo[r.type as string];
                        const Icon = info?.icon || FileBarChart;
                        return <Icon className="size-4 text-muted-foreground" />;
                      })()}
                      <span className="text-xs font-bold">{formatReportType(r.type)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{r.period || 'N/A'}</TableCell>
                  <TableCell className="text-xs font-mono">{r.year || 'N/A'}</TableCell>
                  <TableCell className="text-xs">{['IR'].includes(r.type) ? 'Anual' : r.month ? months.find((m) => m.value === String(r.month))?.label || r.month : 'N/A'}</TableCell>
                  <TableCell className="text-xs tabular-nums text-right">C$ {Number(r.totalAmount || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-xs tabular-nums text-right">C$ {Number(r.taxAmount || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5', statusStyles[r.status || 'DRAFT'])}>
                      {statusLabels[r.status || 'DRAFT']}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                        onClick={() => setShowMeta(r)}
                        title="Ver detalle"
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500"
                        onClick={() => {
                          const rows = [[
                            'Tipo', 'Período', 'Monto Total', 'Impuesto', 'Estado',
                            ...Object.keys(r.metadata || {}).filter(k => !['period','month','year'].includes(k))
                          ]];
                          const dataRow = [
                            r.type, r.period, r.totalAmount, r.taxAmount, r.status,
                            ...Object.keys(r.metadata || {}).filter(k => !['period','month','year'].includes(k)).map(k => r.metadata[k])
                          ];
                          rows.push(dataRow);
                          const ws = XLSX.utils.aoa_to_sheet(rows);
                          const wb = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
                          XLSX.writeFile(wb, `reporte-${r.type}-${r.period}.xlsx`);
                          toast.success('Reporte exportado');
                        }}
                        title="Exportar Excel"
                      >
                        <Download className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!showMeta} onOpenChange={(o) => { if (!o) setShowMeta(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">
              {showMeta?.type ? formatReportType(showMeta.type) : ''} · {showMeta?.period || ''}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Reporte en estado <strong>{statusLabels[showMeta?.status] || showMeta?.status}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-muted/30 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Período</p>
                <p className="text-sm font-bold">{showMeta?.period || 'N/A'}</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</p>
                <p className="text-sm font-bold">{statusLabels[showMeta?.status] || showMeta?.status}</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monto Total</p>
                <p className="text-sm font-bold tabular-nums">C$ {Number(showMeta?.totalAmount || 0).toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Impuesto</p>
                <p className="text-sm font-bold tabular-nums">C$ {Number(showMeta?.taxAmount || 0).toLocaleString()}</p>
              </div>
            </div>
            {showMeta?.metadata && (
              <div className="rounded-xl border border-border/30">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4 pt-3 pb-2">Detalles del cálculo</p>
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/20">
                    <tr>
                      <th className="text-left px-4 py-2 font-bold text-muted-foreground">Campo</th>
                      <th className="text-right px-4 py-2 font-bold text-muted-foreground">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(showMeta.metadata).filter(([k]) => !['period','month'].includes(k)).map(([key, val]: [string, any]) => (
                      <tr key={key} className="border-t border-border/10">
                        <td className="px-4 py-1.5 font-medium">{{
                          year: 'Año', netProfit: 'Utilidad Neta', irRate: 'Tasa IR',
                          irAmount: 'IR Calculado', totalIngresos: 'Total Ingresos',
                          totalGastos: 'Total Gastos', totalGross: 'Total Bruto',
                          inssLaboral: 'INSS Laboral', inssPatronal: 'INSS Patronal',
                          employerRate: 'Tasa Patronal', employeeRate: 'Tasa Laboral',
                          totalAmount: 'Monto Total', taxAmount: 'Impuesto'
                        }[key] || key}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums font-mono">
                          {typeof val === 'number' ? (key === 'year' ? String(val) : key.includes('Rate') ? `${(val * 100).toFixed(1)}%` : `C$ ${val.toLocaleString()}`) : String(val)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
