import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, FileText, MapPinned, RefreshCw, Route, Search, Users, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { api, getApiErrorMessage } from '../../services/api';
import { storageService } from '../../services/storage.service';
import { toast } from '../../services/toast';
import { buildDateFilteredDownloadFileName, buildDateFilteredPdfFileName } from '../../utils/exportFileNames';
import { createReportWorkbook } from '../../utils/reportWorkbook';
import { generateConfiguredReportSectionsPDF } from '../../utils/pdfGenerator';
import type { PdfPaperFormat } from '../../utils/pdfDownloadFormats';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ExportMenu } from '../ui/ExportMenu';
import { Input } from '../ui/input';

type ReportUser = { id: string | null; name?: string | null; email?: string | null; avatar?: string | null; role?: string | null } | null;
type ReportRoute = { id: string; name: string; status: string; scheduledFor: string | null; scheduledForLocal?: string | null; gestor: ReportUser; createdBy?: ReportUser; totalStops: number; completedStops: number; completedInPeriod: number };
type ReportRow = {
  id: string;
  activityType: string;
  occurredAt: string;
  occurredAtLocal: string | null;
  gestor: ReportUser;
  registeredBy: ReportUser;
  route: { id: string; name: string; status: string; scheduledFor: string | null } | null;
  prospect: { id: string; sourceKey: string; name: string; phone: string | null; address: string | null; zone: string | null; category: string | null };
  status: string;
  location: { lat: number | null; lng: number | null; address: string | null; googleMapsUrl: string | null };
  evidence: { name: string | null; type: string | null; uri: string; url?: string } | null;
  notes: string | null;
};
type ForceSalesReport = {
  generatedAt: string;
  timezone: string;
  filters: { from: string; to: string; hourFrom: string | null; hourTo: string | null; assignedToId: string | null; routeId: string | null };
  summary: { activities: number; registeredProspects: number; completedVisits: number; routes: number; evidence: number; managers: number };
  managers: Array<{ manager: ReportUser; activities: number; visits: number; registered: number; routes: number; evidence: number }>;
  routes: ReportRoute[];
  rows: ReportRow[];
};

const TIME_ZONE = 'America/Managua';
const emptyReport: ForceSalesReport = { generatedAt: '', timezone: TIME_ZONE, filters: { from: '', to: '', hourFrom: null, hourTo: null, assignedToId: null, routeId: null }, summary: { activities: 0, registeredProspects: 0, completedVisits: 0, routes: 0, evidence: 0, managers: 0 }, managers: [], routes: [], rows: [] };

function todayInNicaragua() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
}

function displayDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-NI', { timeZone: TIME_ZONE, dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(value));
}

function personName(person: ReportUser) {
  return person?.name || person?.email || 'Sin asignar';
}

function statusLabel(value: string) {
  const labels: Record<string, string> = { NEW: 'Nuevo', CONTACTED: 'Contactado', VISITED: 'Visitado', INTERESTED: 'Interesado', DEMO: 'Demostración', NEGOTIATION: 'Negociación', CLIENT: 'Cliente', DISCARDED: 'Descartado', PLANNED: 'Planificada', IN_PROGRESS: 'En curso', COMPLETED: 'Completada', CANCELLED: 'Cancelada', PENDING: 'Pendiente', SKIPPED: 'Omitida' };
  return labels[value] || value || '—';
}

function reportRows(report: ForceSalesReport) {
  return report.rows.map((row) => [
    row.occurredAtLocal || displayDate(row.occurredAt),
    row.activityType,
    personName(row.gestor),
    row.route?.name || 'Sin ruta',
    row.prospect.name,
    row.prospect.phone || '',
    row.prospect.address || row.prospect.zone || '',
    row.location.address || '',
    row.location.lat == null || row.location.lng == null ? '' : `${row.location.lat}, ${row.location.lng}`,
    row.location.googleMapsUrl || '',
    statusLabel(row.status),
    row.evidence?.url || row.evidence?.uri || '',
    row.evidence?.name || '',
    row.notes || '',
  ]);
}

function workbookRows(headers: string[], rows: Array<Array<string | number>>) {
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

export function ForceSalesReportsView() {
  const { user, canPerform } = useAuth();
  const { themeConfig } = useTheme();
  const [from, setFrom] = useState(todayInNicaragua());
  const [to, setTo] = useState(todayInNicaragua());
  const [hourFrom, setHourFrom] = useState('');
  const [hourTo, setHourTo] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [report, setReport] = useState<ForceSalesReport>(emptyReport);
  const [loading, setLoading] = useState(false);
  const canExport = canPerform('FORCE_SALES', 'export');

  const loadReport = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const data = await api.get<ForceSalesReport>('/force-sales/reports', { params: { from, to, hourFrom: hourFrom || '00:00', hourTo: hourTo || '23:59', assignedToId: assignedToId || undefined, routeId: routeId || undefined } });
      const rows = await Promise.all((data.rows || []).map(async (row) => {
        if (!row.evidence?.uri) return row;
        try {
          const url = await storageService.resolveUrl(row.evidence.uri);
          return { ...row, evidence: { ...row.evidence, url } };
        } catch {
          return row;
        }
      }));
      setReport({ ...data, rows });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo generar el reporte de gestores.'));
    } finally {
      setLoading(false);
    }
  }, [assignedToId, from, hourFrom, hourTo, routeId, to]);

  useEffect(() => { void loadReport(); }, []);

  const managerOptions = useMemo(() => report.managers.map((item) => item.manager).filter((manager): manager is NonNullable<ReportUser> => Boolean(manager?.id)), [report.managers]);
  const headers = ['Fecha y hora', 'Actividad', 'Gestor', 'Ruta', 'Cliente', 'Teléfono', 'Dirección', 'Ubicación', 'Coordenadas', 'Abrir mapa', 'Estado', 'Evidencia', 'Archivo', 'Notas'];
  const summaryHeaders = ['Indicador', 'Valor'];
  const summaryRows: Array<Array<string | number>> = [
    ['Actividades', report.summary.activities],
    ['Clientes registrados', report.summary.registeredProspects],
    ['Visitas completadas', report.summary.completedVisits],
    ['Rutas', report.summary.routes],
    ['Evidencias', report.summary.evidence],
  ];
  const managerHeaders = ['Gestor', 'Actividades', 'Visitas completadas', 'Clientes registrados', 'Rutas', 'Evidencias'];
  const managerRows: Array<Array<string | number>> = report.managers.map((item) => [personName(item.manager), item.activities, item.visits, item.registered, item.routes, item.evidence]);
  const routeHeaders = ['Ruta', 'Gestor', 'Fecha', 'Estado', 'Paradas', 'Completadas', 'Completadas en período'];
  const routeRows: Array<Array<string | number>> = report.routes.map((route) => [route.name, personName(route.gestor), route.scheduledForLocal || displayDate(route.scheduledFor), statusLabel(route.status), route.totalStops, route.completedStops, route.completedInPeriod]);
  const detailRows = reportRows(report);
  const filtersLabel = `Del ${from} al ${to} · ${hourFrom || hourTo ? `${hourFrom || '00:00'}–${hourTo || '23:59'}` : 'todo el día (00:00–23:59)'}`;

  const exportExcel = () => {
    if (!canExport || !report) return;
    createReportWorkbook({
      fileName: buildDateFilteredDownloadFileName(['reporte_gestores_cobro'], 'xlsx', from, to),
      filters: { Periodo: filtersLabel, 'Zona horaria': TIME_ZONE, Gestor: assignedToId ? personName(managerOptions.find((manager) => manager.id === assignedToId) || null) : 'Todos', Ruta: routeId ? report.routes.find((route) => route.id === routeId)?.name || routeId : 'Todas' },
      sheets: [
        { name: 'Resumen', rows: workbookRows(summaryHeaders, summaryRows) },
        { name: 'Por gestor', rows: workbookRows(managerHeaders, managerRows) },
        { name: 'Rutas', rows: workbookRows(routeHeaders, routeRows) },
        { name: 'Detalle', rows: [headers, ...detailRows] },
      ],
    });
    toast.success('Reporte Excel descargado.');
  };

  const exportPdf = async (format: PdfPaperFormat) => {
    if (!canExport || !report) return;
    try {
      await generateConfiguredReportSectionsPDF({
        targetKey: 'reports.force-sales',
        title: 'Reporte de gestores de cobro',
        tenantName: themeConfig.tenantName || user?.clientTenant?.name || 'Mi Empresa',
        tenantLogo: themeConfig.logo || user?.clientTenant?.logo || null,
        periodLabel: filtersLabel,
        format,
        fileName: buildDateFilteredPdfFileName(['reporte_gestores_cobro'], format, from, to),
        sections: [
          { id: 'summary', title: 'Resumen operativo', headers: summaryHeaders, rows: summaryRows },
          { id: 'managers', title: 'Actividad por gestor', headers: managerHeaders, rows: managerRows },
          { id: 'routes', title: 'Rutas del período', headers: routeHeaders, rows: routeRows },
          { id: 'detail-activity', title: 'Detalle de actividades', headers: [headers[0], headers[1], headers[2], headers[3], headers[4], headers[5], headers[10]], rows: detailRows.map((row) => [row[0], row[1], row[2], row[3], row[4], row[5], row[10]]) },
          { id: 'detail-location', title: 'Dirección y ubicación', headers: [headers[0], headers[4], headers[6], headers[7], headers[8]], rows: detailRows.map((row) => [row[0], row[4], row[6], row[7], row[8]]) },
          { id: 'detail-evidence', title: 'Mapas, evidencias y notas', headers: [headers[0], headers[4], headers[9], headers[11], headers[12], headers[13]], rows: detailRows.map((row) => [row[0], row[4], row[9], row[11], row[12], row[13]]) },
        ],
      });
      toast.success('PDF descargado.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo generar el PDF.'));
    }
  };

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-background px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1700px] space-y-5">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary"><Route className="size-3.5" /> Fuerza Comercial</div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Reportes de gestores de cobro</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Consulta la actividad de campo por día, semana o rango personalizado: gestores, rutas, clientes, visitas, ubicaciones y evidencias.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => void loadReport()} disabled={loading}><RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} /> Actualizar reporte</Button>
            {canExport && <ExportMenu onPdf={(format) => void exportPdf(format)} onExcel={exportExcel} disabled={loading || !report.rows.length} showRollFormats={false} excelDescription="Resumen, gestores, rutas y detalle" />}
          </div>
        </div>

        <Card className="rounded-3xl border-border/60 shadow-sm">
          <CardHeader className="border-b border-border/50 pb-4"><CardTitle className="flex items-center gap-2 text-base font-black"><CalendarDays className="size-5 text-primary" /> Filtros del reporte</CardTitle></CardHeader>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <label className="space-y-1.5 text-xs font-bold"><span>Desde</span><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-xl" /></label>
            <label className="space-y-1.5 text-xs font-bold"><span>Hasta</span><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-xl" /></label>
            <label className="space-y-1.5 text-xs font-bold"><span>Hora desde</span><Input type="time" value={hourFrom} onChange={(event) => setHourFrom(event.target.value)} className="rounded-xl" /></label>
            <label className="space-y-1.5 text-xs font-bold"><span>Hora hasta</span><Input type="time" value={hourTo} onChange={(event) => setHourTo(event.target.value)} className="rounded-xl" /></label>
            <label className="space-y-1.5 text-xs font-bold"><span>Gestor</span><select value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)} className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="">Todos los gestores</option>{managerOptions.map((manager) => <option key={manager.id} value={manager.id || ''}>{personName(manager)}</option>)}</select></label>
            <label className="space-y-1.5 text-xs font-bold"><span>Ruta</span><select value={routeId} onChange={(event) => setRouteId(event.target.value)} className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="">Todas las rutas</option>{report.routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</select></label>
            <div className="flex items-end sm:col-span-2 lg:col-span-3 xl:col-span-6"><Button onClick={() => void loadReport()} className="w-full rounded-xl sm:w-auto"><Search className="size-4" /> Generar reporte</Button></div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            ['Actividades', report.summary.activities, Clock3], ['Clientes registrados', report.summary.registeredProspects, Users], ['Visitas completadas', report.summary.completedVisits, CheckCircle2], ['Rutas', report.summary.routes, Route], ['Evidencias', report.summary.evidence, FileText], ['Gestores', report.summary.managers, MapPinned],
          ].map(([label, value, Icon]) => <Card key={String(label)} className="rounded-2xl border-border/60"><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="size-5" /></div><div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className="text-2xl font-black tabular-nums">{loading ? '…' : value}</p></div></CardContent></Card>)}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm"><span><span className="font-black">Período:</span> {filtersLabel} · hora local de Nicaragua</span>{!canExport && <Badge variant="outline">Exportación no habilitada para este rol</Badge>}</div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="min-w-0 rounded-3xl border-border/60 shadow-sm"><CardHeader className="border-b border-border/50 pb-4"><CardTitle className="flex items-center gap-2 text-base font-black"><FileText className="size-5 text-primary" /> Detalle de actividades <Badge variant="secondary" className="ml-auto">{report.rows.length} registros</Badge></CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr>{['Fecha y hora', 'Actividad', 'Gestor', 'Ruta', 'Cliente', 'Ubicación', 'Estado', 'Evidencia'].map((header) => <th key={header} className="px-4 py-3 font-black">{header}</th>)}</tr></thead><tbody className="divide-y divide-border/60">{loading ? <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">Generando reporte…</td></tr> : report.rows.length ? report.rows.map((row) => <tr key={row.id} className="align-top hover:bg-muted/20"><td className="whitespace-nowrap px-4 py-3 font-semibold">{row.occurredAtLocal || displayDate(row.occurredAt)}</td><td className="px-4 py-3"><Badge variant={row.activityType === 'Visita completada' ? 'default' : 'secondary'}>{row.activityType}</Badge></td><td className="px-4 py-3 font-semibold">{personName(row.gestor)}</td><td className="px-4 py-3">{row.route?.name || 'Sin ruta'}</td><td className="px-4 py-3"><p className="font-bold">{row.prospect.name}</p><p className="text-muted-foreground">{row.prospect.phone || row.prospect.category || '—'}</p></td><td className="max-w-[260px] px-4 py-3">{row.location.googleMapsUrl ? <a href={row.location.googleMapsUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary underline-offset-2 hover:underline">{row.location.address || 'Abrir en Google Maps'}</a> : row.location.address || 'Sin ubicación'}</td><td className="px-4 py-3">{statusLabel(row.status)}</td><td className="px-4 py-3">{row.evidence?.url ? <a href={row.evidence.url} target="_blank" rel="noreferrer" className="font-semibold text-primary underline-offset-2 hover:underline">{row.evidence.name || 'Abrir evidencia'}</a> : <span className="text-muted-foreground">Sin evidencia</span>}</td></tr>) : <tr><td colSpan={8} className="p-12 text-center"><XCircle className="mx-auto mb-2 size-6 text-muted-foreground" /><p className="font-semibold">No hay actividad para los filtros seleccionados.</p><p className="mt-1 text-muted-foreground">Amplía el rango o revisa el gestor y la ruta.</p></td></tr>}</tbody></table></div></CardContent></Card>
          <div className="space-y-5"><Card className="rounded-3xl border-border/60"><CardHeader className="border-b border-border/50 pb-4"><CardTitle className="text-base font-black">Actividad por gestor</CardTitle></CardHeader><CardContent className="space-y-3 p-4">{report.managers.length ? report.managers.map((item) => <div key={item.manager?.id || 'unassigned'} className="rounded-2xl border border-border/60 bg-muted/20 p-3"><div className="flex items-start justify-between gap-2"><p className="font-bold">{personName(item.manager)}</p><Badge variant="outline">{item.activities} act.</Badge></div><p className="mt-2 text-xs text-muted-foreground">{item.visits} visitas · {item.registered} clientes · {item.routes} rutas · {item.evidence} evidencias</p></div>) : <p className="text-sm text-muted-foreground">Sin gestores en el período.</p>}</CardContent></Card><Card className="rounded-3xl border-border/60"><CardHeader className="border-b border-border/50 pb-4"><CardTitle className="text-base font-black">Rutas incluidas</CardTitle></CardHeader><CardContent className="space-y-3 p-4">{report.routes.length ? report.routes.map((route) => <div key={route.id} className="rounded-2xl border border-border/60 p-3"><div className="flex items-start justify-between gap-2"><p className="font-bold">{route.name}</p><Badge variant="outline">{statusLabel(route.status)}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{personName(route.gestor)} · {route.totalStops} paradas · {route.completedInPeriod} completadas en período</p></div>) : <p className="text-sm text-muted-foreground">Sin rutas en el período.</p>}</CardContent></Card></div>
        </div>
      </div>
    </div>
  );
}

export default ForceSalesReportsView;
