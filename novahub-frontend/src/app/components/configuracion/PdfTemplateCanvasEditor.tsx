import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Barcode, BarChart3, Building2, Calculator, Copy, GripVertical, ImagePlus, Italic, Minus, Move, Palette, PanelBottom, PanelTop, Plus, Redo2, RotateCcw, RotateCw, Save, Settings2, Square, Strikethrough, Table2, Trash2, Type, Underline, Undo2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { FastColorInput } from '../ui/FastColorInput';
import { cn } from '../ui/utils';
import { getPdfTemplateTarget } from '../../services/pdf-document-catalog';
import { createPdfTemplateSampleData, getTemplateTokenSample, PDF_DEFAULT_FONT_SCALE, resolveTemplateToken, TEMPLATE_TOKENS, type PdfTemplateChart, type PdfTemplateColumn, type PdfTemplateData, type PdfTemplateDefinition, type PdfTemplateNode, type PdfTemplateNodeType, type PdfTemplateReportSection, type PdfTemplateReportSectionStyle } from '../../services/pdf-template-definition';

type CanvasSettings = {
  paperSize: string;
  orientation: 'portrait' | 'landscape';
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  lineColor?: string;
  backgroundColor?: string;
  headerLayout?: string;
  footerLayout?: string;
  tableLayout?: string;
  fontFamily?: string;
  fontSize?: number;
  logoUrl?: string;
  templateLogoUrl?: string;
  logoPosition?: 'left' | 'center' | 'right';
  logoSize?: number;
  showCompanyName?: boolean;
  companyName?: string;
  slogan?: string;
  fiscalInfo?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  bankInfo?: string;
  showQr?: boolean;
  showBarcode?: boolean;
  watermark?: string;
  watermarkOpacity?: number;
  footerText?: string;
  showPageNumber?: boolean;
  pageNumberFormat?: 'page-of' | 'number-only' | 'custom';
  pageNumberCustom?: string;
  legalText?: string;
  terms?: string;
  defaultNotes?: string;
  margins?: number;
  paletteMode?: 'corporate' | 'independent';
};

interface PdfTemplateCanvasEditorProps {
  definition: PdfTemplateDefinition;
  settings: CanvasSettings;
  targetKey: string;
  data?: PdfTemplateData;
  onChange: (definition: PdfTemplateDefinition) => void;
  onSettingsChange?: (changes: Partial<CanvasSettings>) => void;
  onUploadLogo?: (file: File) => void;
  onSave?: () => void;
  logo?: string | null;
  readOnly?: boolean;
}

type DragState = { id: string; mode: 'move' | 'resize' | 'rotate'; startX: number; startY: number; x: number; y: number; width: number; height: number; rect: DOMRect; centerX?: number; centerY?: number; startAngle?: number; initialRotation?: number };

const CANVAS_FONT_OPTIONS = [
  { value: 'helvetica', label: 'Helvetica (PDF)' }, { value: 'Arial', label: 'Arial' }, { value: 'Helvetica', label: 'Helvetica' }, { value: 'Verdana', label: 'Verdana' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS' }, { value: 'Georgia', label: 'Georgia' }, { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'times', label: 'Times New Roman (PDF)' }, { value: 'Garamond', label: 'Garamond' }, { value: 'Courier New', label: 'Courier New' }, { value: 'courier', label: 'Courier New (PDF)' }, { value: 'Consolas', label: 'Consolas' }, { value: 'Impact', label: 'Impact' },
];

function pageAspect(settings: CanvasSettings) {
  const dimensions = settings.paperSize === 'A4' ? [210, 297] : settings.paperSize === 'OFICIO' ? [216, 330] : settings.paperSize === 'LEGAL' ? [216, 356] : settings.paperSize === 'LABEL' ? [70, 38] : settings.paperSize === 'ROLL-80' ? [80, 200] : [216, 279];
  return settings.orientation === 'landscape' ? `${dimensions[1]} / ${dimensions[0]}` : `${dimensions[0]} / ${dimensions[1]}`;
}

function nodeText(node: PdfTemplateNode, data: PdfTemplateData) {
  if (node.type === 'field' || node.type === 'barcode') {
    if (!node.token) return node.text || node.sample || '';
    const fallback = node.token.startsWith('company.') ? '' : node.sample || getTemplateTokenSample(node.token);
    const value = resolveTemplateToken(node.token, data, fallback);
    return node.type === 'field' && node.id.startsWith('party-') ? `${node.label}\n${value}` : value;
  }
  if (node.type === 'text') return node.text || node.sample || node.label;
  if (node.type === 'section') return node.text || node.sample || '';
  return '';
}

const COMPANY_TOKEN_SETTINGS: Record<string, keyof CanvasSettings> = {
  'company.name': 'companyName',
  'company.slogan': 'slogan',
  'company.fiscalInfo': 'fiscalInfo',
  'company.address': 'address',
  'company.phone': 'phone',
  'company.email': 'email',
  'company.website': 'website',
};

function isInlineTextEditable(node: PdfTemplateNode) {
  return node.type === 'text'
    || (node.type === 'section' && Boolean(node.text || node.sample))
    || (node.type === 'field' && !node.token && Boolean(node.text || node.sample))
    || (node.type === 'field' && Boolean(node.token && COMPANY_TOKEN_SETTINGS[node.token]));
}

function inlineTextValue(node: PdfTemplateNode, data: PdfTemplateData = {}) {
  if (node.type === 'field' && node.token && COMPANY_TOKEN_SETTINGS[node.token]) return nodeText(node, data);
  return node.type === 'text' ? node.text || node.sample || node.label : node.text || node.sample || '';
}

function LogoPreview({ src, companyName, className, primaryColor, secondaryColor }: { src?: string | null; companyName?: string; className?: string; primaryColor?: string; secondaryColor?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const initials = String(companyName || 'NovaHub').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'NH';
  if (!src || failed) return <div className={cn('flex items-center justify-center rounded-[22%] text-[11px] font-black tracking-wide text-white', className)} style={{ background: `linear-gradient(135deg, ${primaryColor || '#10b981'}, ${secondaryColor || '#0f3b65'})` }} aria-label="Identificador de empresa">{initials}</div>;
  return <img src={src} alt="Logotipo de la empresa" className={cn('object-contain', className)} onError={() => setFailed(true)} />;
}

function canvasFontFamily(value?: string) {
  const normalized = String(value || 'helvetica').trim().toLowerCase();
  if (['times', 'times new roman', 'georgia', 'garamond', 'cambria', 'palatino linotype', 'bookman'].includes(normalized)) return 'Georgia, "Times New Roman", serif';
  if (['courier', 'courier new', 'consolas', 'monaco'].includes(normalized)) return '"Courier New", Courier, monospace';
  return 'Arial, Helvetica, sans-serif';
}

function canvasFontSize(value: number, minimum = 6) {
  return `${Math.max(minimum, value * 1.333 * PDF_DEFAULT_FONT_SCALE)}px`;
}

function nodeStyle(node: PdfTemplateNode, settings: CanvasSettings) {
  const borderRadius = node.shape === 'pill' ? '999px' : node.shape === 'circle' ? '50%' : node.shape === 'blob' ? '42% 58% 62% 38% / 45% 35% 65% 55%' : node.shape === 'arc' ? '50% 50% 0 0 / 60% 60% 0 0' : node.shape === 'wave' ? '50% 50% 0 0 / 42% 42% 0 0' : node.shape === 'wave-bottom' ? '0 0 50% 50% / 0 0 42% 42%' : `${node.borderRadius || 0}px`;
  const clipPath = node.clipPath || (node.shape === 'angled' ? 'polygon(0 0,100% 0,88% 100%,0 100%)' : 'none');
  const padding = Math.max(0, Number(node.padding ?? 1.5) || 0);
  const borderStyle = node.borderStyle || (node.type === 'table' || node.type === 'report-sections' || node.type === 'divider' ? 'solid' : 'none');
  return {
    left: `${node.x}%`, top: `${node.y}%`, width: `${node.width}%`, height: `${node.height}%`,
    color: node.color || settings.textColor || '#334155', backgroundColor: node.backgroundColor || 'transparent',
    borderColor: node.borderColor || settings.lineColor || '#e2e8f0', borderStyle, borderRadius,
    clipPath, opacity: node.opacity ?? 1,
    transform: node.rotation ? `rotateZ(${node.rotation}deg)` : undefined, transformOrigin: 'center center',
    fontSize: canvasFontSize(Number(node.fontSize || settings.fontSize || 9) || 9), fontFamily: canvasFontFamily(node.fontFamily || settings.fontFamily),
    textAlign: node.align || 'left', padding: `${Math.min(1.25, padding * 0.45)}% ${Math.min(2.2, padding)}%`, fontWeight: node.fontWeight || (node.bold ? 700 : 400), fontStyle: node.italic ? 'italic' : 'normal',
    textDecorationLine: [node.underline ? 'underline' : '', node.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
    lineHeight: node.lineHeight || 1.25, letterSpacing: `${node.letterSpacing || 0}px`, textTransform: node.textTransform || 'none',
    display: ['text', 'field', 'section'].includes(node.type) ? 'flex' : 'block', alignItems: node.type === 'section' && node.id === 'party-section' ? 'flex-start' : 'center',
    WebkitFontSmoothing: 'antialiased', textRendering: 'geometricPrecision', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
  } as const;
}

function defaultCanvasBorderStyle(type: PdfTemplateNodeType): PdfTemplateNode['borderStyle'] {
  return type === 'table' || type === 'report-sections' || type === 'divider' ? 'solid' : 'none';
}

function TablePreview({ node, settings, data, reportSection }: { node: PdfTemplateNode; settings: CanvasSettings; data: PdfTemplateData; reportSection?: PdfTemplateReportSection }) {
  const columns: PdfTemplateColumn[] = reportSection?.columns?.length ? reportSection.columns : node.columns || [];
  const rows = reportSection?.rows?.length
    ? reportSection.rows
    : data.items || data.rows || [{ description: 'Fila de muestra', quantity: '1', unitPrice: 'C$ 0.00', total: 'C$ 0.00' }];
  const compactTable = ['minimal', 'ledger'].includes(settings.tableLayout || '');
  const defaultHeaderBackground = node.tableHeaderColor || (compactTable ? '#ffffff' : settings.primaryColor || '#10b981');
  const defaultHeaderColor = node.tableHeaderTextColor || (compactTable ? settings.textColor || '#334155' : '#ffffff');
  const stripeColor = node.tableStripeColor || '#f8fafc';

  return <div className="h-full overflow-hidden rounded-[inherit] border" style={{ borderColor: node.borderColor }}>
    {reportSection && <div className="truncate border-b px-2 py-1 font-semibold text-slate-500" title={reportSection.title} style={{ fontSize: canvasFontSize(7.5) }}>{reportSection.title}</div>}
    <div className="flex border-b px-2 py-1 font-bold uppercase tracking-wide" style={{ fontSize: canvasFontSize(Math.max(7, (Number(node.fontSize || settings.fontSize || 9) || 9) - 1.5)) }}>
      {columns.map(column => <span key={column.id} className="min-w-0 break-words" style={{ width: `${column.width || 25}%`, textAlign: column.align || 'left', backgroundColor: column.backgroundColor || defaultHeaderBackground, color: column.color || defaultHeaderColor }}>{column.label}</span>)}
    </div>
    {rows.slice(0, 4).map((row, index) => <div key={index} className="flex border-b px-2 py-1 text-slate-600 last:border-0" style={{ fontSize: canvasFontSize(Math.max(7, (Number(node.fontSize || settings.fontSize || 9) || 9) - 1)), backgroundColor: node.tableRowColor || (index % 2 && ['standard', 'striped', 'accent'].includes(settings.tableLayout || '') ? stripeColor : 'transparent') }}>
      {columns.map(column => <span key={column.id} className="min-w-0 break-words whitespace-pre-wrap" style={{ width: `${column.width || 25}%`, textAlign: column.align || 'left' }}>{String(row[column.token] ?? row[column.id] ?? '')}</span>)}
    </div>)}
    {reportSection && <div className="px-2 py-1 text-[8px] italic text-slate-400">Las demás secciones se generan en páginas consecutivas.</div>}
  </div>;
}

function ReportSectionsPreview({ node, settings, data, selectedSectionIndex, onSelectSection }: { node: PdfTemplateNode; settings: CanvasSettings; data: PdfTemplateData; selectedSectionIndex?: number | null; onSelectSection?: (sectionIndex: number) => void }) {
  const sections = data.reportSections || [];
  const compactTable = ['minimal', 'ledger'].includes(settings.tableLayout || '');
  const defaultHeaderBackground = node.tableHeaderColor || (compactTable ? '#ffffff' : settings.primaryColor || '#10b981');
  const defaultHeaderColor = node.tableHeaderTextColor || (compactTable ? settings.textColor || '#334155' : '#ffffff');
  const stripeColor = node.tableStripeColor || '#f8fafc';
  const visibleSections = sections.map((section, sectionIndex) => ({ section, sectionIndex })).filter(({ sectionIndex }) => node.reportSectionVisibility?.[String(sectionIndex)] !== false);
  return <div className="h-full overflow-hidden rounded-[inherit] border" style={{ borderColor: node.borderColor }}>
    <div className="h-full overflow-y-auto px-2 py-1.5">
    {visibleSections.map(({ section, sectionIndex }, visibleIndex) => {
      const sectionStyle = node.reportSectionStyles?.[String(sectionIndex)] || {};
      const sectionHeaderBackground = sectionStyle.headerColor || defaultHeaderBackground;
      const sectionHeaderColor = sectionStyle.headerTextColor || defaultHeaderColor;
      const sectionRowColor = sectionStyle.rowColor || node.tableRowColor;
      const sectionStripeColor = sectionStyle.stripeColor || stripeColor;
      return <div key={section.id} className={cn('min-w-0 cursor-pointer rounded-md p-1 transition', visibleIndex > 0 && 'mt-2', selectedSectionIndex === sectionIndex && 'bg-emerald-50/40 ring-2 ring-emerald-400')} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onSelectSection?.(sectionIndex); }}>
      <div className="mb-1 truncate font-bold text-slate-700" title={section.title} style={{ fontSize: canvasFontSize(8.5) }}>{section.title}</div>
      <div className="overflow-hidden rounded-[2px] border" style={{ borderColor: node.borderColor }}>
        <div className="flex border-b px-1.5 py-1 font-bold uppercase tracking-wide" style={{ fontSize: canvasFontSize(6.5), backgroundColor: sectionHeaderBackground, color: sectionHeaderColor }}>
          {section.columns.map((column, columnIndex) => <span key={column.id} className="min-w-0 break-words" style={{ width: `${column.width || 25}%`, textAlign: column.align || 'left', backgroundColor: column.backgroundColor || sectionStyle.columnColors?.[String(columnIndex)] || node.columns?.[columnIndex]?.backgroundColor || 'transparent', color: column.color || sectionStyle.columnTextColors?.[String(columnIndex)] || node.columns?.[columnIndex]?.color || 'inherit' }}>{column.label}</span>)}
        </div>
        {section.rows.slice(0, 3).map((row, rowIndex) => <div key={rowIndex} className="flex border-b px-1.5 py-1 text-slate-600 last:border-0" style={{ fontSize: canvasFontSize(6.7), backgroundColor: sectionRowColor || (rowIndex % 2 && !compactTable ? sectionStripeColor : 'transparent') }}>
          {section.columns.map(column => <span key={column.id} className="min-w-0 break-words whitespace-pre-wrap" style={{ width: `${column.width || 25}%`, textAlign: column.align || 'left' }}>{String(row[column.token] ?? row[column.id] ?? '')}</span>)}
        </div>)}
      </div>
    </div>;
    })}
    {!visibleSections.length && <span className="text-xs text-slate-400">No hay tablas seleccionadas</span>}
    </div>
  </div>;
}

function ChartPreview({ chart, node }: { chart?: PdfTemplateChart; node: PdfTemplateNode }) {
  if (!chart) return <div className="flex h-full items-center justify-center text-[8px] text-slate-400">Gráfica sin datos de muestra</div>;
  const colors = chart.colors?.length ? chart.colors : ['#10b981', '#2563eb', '#f59e0b', '#8b5cf6'];
  const values = chart.values || chart.series?.[0]?.values || [];
  const maxValue = Math.max(1, ...values.map(value => Number(value) || 0), ...(chart.series || []).flatMap(series => series.values.map(value => Number(value) || 0)));
  const type = node.chartType || chart.type;
  return <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit] bg-white/95 p-1.5 text-slate-700">
    <p className="shrink-0 truncate text-[7px] font-bold leading-tight" title={chart.title}>{chart.title}</p>
    {type === 'donut' ? <div className="flex min-h-0 flex-1 items-center gap-2 overflow-hidden">
      <div className="relative aspect-square h-full max-h-full shrink-0 rounded-full" style={{ background: `conic-gradient(${values.map((_, index) => `${colors[index % colors.length]} ${values.slice(0, index).reduce((sum, item) => sum + Math.max(0, item), 0) / Math.max(1, values.reduce((sum, item) => sum + Math.max(0, item), 0)) * 360}deg ${(values.slice(0, index + 1).reduce((sum, item) => sum + Math.max(0, item), 0) / Math.max(1, values.reduce((sum, item) => sum + Math.max(0, item), 0))) * 360}deg`).join(',')}` }}><div className="absolute inset-[28%] flex items-center justify-center rounded-full bg-white text-[7px] font-bold">{values.reduce((sum, item) => sum + Math.max(0, item), 0)}</div></div>
      <div className="min-w-0 flex-1 space-y-0.5">{chart.labels.slice(0, 4).map((label, index) => <div key={label} className="flex min-w-0 items-center gap-1 text-[6px]"><span className="size-1.5 shrink-0 rounded-sm" style={{ backgroundColor: colors[index % colors.length] }} /><span className="min-w-0 flex-1 truncate">{label}</span><strong className="shrink-0">{values[index] ?? 0}</strong></div>)}</div>
    </div> : type === 'bar' ? <div className="min-h-0 flex-1 space-y-1 overflow-hidden pt-1">{chart.labels.slice(0, 4).map((label, index) => <div key={label} className="grid grid-cols-[minmax(0,34%)_minmax(0,1fr)_auto] items-center gap-1 text-[6px]"><span className="truncate" title={label}>{label}</span><span className="h-1.5 overflow-hidden rounded-full bg-slate-100"><i className="block h-full rounded-full" style={{ width: `${Math.max(2, (Number(values[index] || 0) / maxValue) * 100)}%`, backgroundColor: colors[index % colors.length] }} /></span><strong className="truncate">{Number(values[index] || 0).toLocaleString('es-NI', { maximumFractionDigits: 0 })}</strong></div>)}</div> : <div className="min-h-0 flex-1 overflow-hidden pt-1">
      <svg viewBox="0 0 300 70" className="h-full w-full" preserveAspectRatio="none"><path d="M5 58 H295" stroke="#cbd5e1" strokeWidth="1" />{(chart.series?.length ? chart.series : [{ label: chart.title, values, color: colors[0] }]).slice(0, 3).map((series, seriesIndex) => { const source = series.values.slice(0, chart.labels.length); const maximum = Math.max(1, ...source.map(value => Number(value) || 0)); const points = source.map((value, index) => `${8 + index * 284 / Math.max(source.length - 1, 1)},${52 - (Number(value) / maximum) * 38}`).join(' '); return <polyline key={series.label} points={points} fill="none" stroke={series.color || colors[seriesIndex % colors.length]} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />; })}</svg>
      <div className="flex justify-between text-[5px] text-slate-500"><span>{chart.labels[0]}</span><span>{chart.labels[chart.labels.length - 1]}</span></div>
      <div className="flex flex-wrap gap-x-2 text-[5px] text-slate-500">{(chart.series || []).slice(0, 3).map((series, index) => <span key={series.label}><i className="mr-0.5 inline-block size-1 rounded-full" style={{ backgroundColor: series.color || colors[index % colors.length] }} />{series.label}</span>)}</div>
    </div>}
  </div>;
}

function ReportSectionInspector({ node, data, selectedSectionIndex, onSelectSection, onSetVisibility, onPatchStyle }: { node: PdfTemplateNode; data: PdfTemplateData; selectedSectionIndex: number | null; onSelectSection: (sectionIndex: number) => void; onSetVisibility: (sectionIndex: number, visible: boolean) => void; onPatchStyle: (patch: Partial<PdfTemplateReportSectionStyle>) => void }) {
  if (node.type !== 'report-sections') return null;
  const sections = data.reportSections || [];
  const selectedSection = selectedSectionIndex === null ? undefined : sections[selectedSectionIndex];
  const selectedStyle = selectedSectionIndex === null ? undefined : node.reportSectionStyles?.[String(selectedSectionIndex)];
  return <>
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <div><p className="text-[10px] uppercase tracking-[0.12em] text-emerald-300">Tablas del reporte</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">Selecciona una tabla para editarla o desactiva las que no deseas incluir en el PDF.</p></div>
      <div className="mt-3 max-h-48 space-y-1 overflow-y-auto pr-1">
        {sections.map((section, index) => {
          const visible = node.reportSectionVisibility?.[String(index)] !== false;
          return <div key={section.id} className={cn('flex items-center gap-1 rounded-md border px-1.5 py-1', selectedSectionIndex === index ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-transparent')}>
            <input type="checkbox" checked={visible} aria-label={`Incluir ${section.title}`} onChange={event => { onSelectSection(index); onSetVisibility(index, event.target.checked); }} className="accent-emerald-400" />
            <button type="button" className="min-w-0 flex-1 truncate text-left text-[10px] text-slate-300 hover:text-white" onClick={() => onSelectSection(index)}>{section.title}</button>
          </div>;
        })}
      </div>
    </div>
    {selectedSection && selectedSectionIndex !== null && <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-300">Tabla seleccionada</p>
      <p className="mt-1 truncate text-xs font-semibold text-white" title={selectedSection.title}>{selectedSection.title}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div><Label className="text-[10px] text-slate-400">Fondo del encabezado</Label><FastColorInput value={selectedStyle?.headerColor || node.tableHeaderColor || '#10b981'} onChange={value => onPatchStyle({ headerColor: value })} className="mt-1 h-8 w-full cursor-pointer border-slate-700 bg-slate-900 p-1" /></div>
        <div><Label className="text-[10px] text-slate-400">Texto del encabezado</Label><FastColorInput value={selectedStyle?.headerTextColor || node.tableHeaderTextColor || '#ffffff'} onChange={value => onPatchStyle({ headerTextColor: value })} className="mt-1 h-8 w-full cursor-pointer border-slate-700 bg-slate-900 p-1" /></div>
        <div><Label className="text-[10px] text-slate-400">Filas</Label><FastColorInput value={selectedStyle?.rowColor || node.tableRowColor || '#ffffff'} onChange={value => onPatchStyle({ rowColor: value })} className="mt-1 h-8 w-full cursor-pointer border-slate-700 bg-slate-900 p-1" /></div>
        <div><Label className="text-[10px] text-slate-400">Filas alternas</Label><FastColorInput value={selectedStyle?.stripeColor || node.tableStripeColor || '#f8fafc'} onChange={value => onPatchStyle({ stripeColor: value })} className="mt-1 h-8 w-full cursor-pointer border-slate-700 bg-slate-900 p-1" /></div>
      </div>
      <div className="mt-3 space-y-2 border-t border-slate-800 pt-3"><p className="text-[10px] font-medium text-slate-400">Color por columna</p>{selectedSection.columns.map((column, columnIndex) => <div key={column.id} className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-[10px] text-slate-500">{column.label}</span><FastColorInput aria-label={`Color de ${column.label}`} value={selectedStyle?.columnColors?.[String(columnIndex)] || column.backgroundColor || selectedStyle?.headerColor || node.tableHeaderColor || '#10b981'} onChange={value => onPatchStyle({ columnColors: { ...(selectedStyle?.columnColors || {}), [String(columnIndex)]: value } })} className="h-7 w-12 shrink-0 cursor-pointer rounded border border-slate-700 bg-slate-900 p-1" /></div>)}</div>
    </div>}
  </>;
}

function updateNode(definition: PdfTemplateDefinition, id: string, patch: Partial<PdfTemplateNode>) {
  return { ...definition, nodes: definition.nodes.map(node => node.id === id ? { ...node, ...patch } : node) };
}

type DocumentPanelId = 'header' | 'content' | 'page';

const SELECT_CLASS = 'h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white outline-none transition focus:border-emerald-400';
const INPUT_CLASS = 'h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white outline-none transition focus:border-emerald-400';

function CanvasDocumentControls({ settings, target, onChange }: { settings: CanvasSettings; target: ReturnType<typeof getPdfTemplateTarget>; onChange: (changes: Partial<CanvasSettings>) => void }) {
  const [activePanel, setActivePanel] = useState<DocumentPanelId>('header');
  const update = <K extends keyof CanvasSettings>(key: K, value: CanvasSettings[K]) => onChange({ [key]: value } as Partial<CanvasSettings>);
  const color = settings.primaryColor || '#10b981';
  const tableLayouts = [
    { value: 'standard', label: 'Estándar' }, { value: 'striped', label: 'Alternas' },
    { value: 'boxed', label: 'Recuadros' }, { value: 'minimal', label: 'Minimalista' },
    { value: 'compact', label: 'Compacta' }, { value: 'accent', label: 'Acentos' },
    { value: 'ledger', label: 'Contable' }, { value: 'cards', label: 'Tarjetas' },
  ];
  const panels: Array<{ id: DocumentPanelId; label: string; icon: typeof PanelTop }> = [
    { id: 'header', label: 'Encabezado', icon: PanelTop },
    { id: 'content', label: 'Contenido', icon: Table2 },
    { id: 'page', label: 'Estilo', icon: Palette },
  ];

  return <div className="border-b border-slate-800 bg-[#0d1726]" data-testid="pdf-canvas-document-controls">
    <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800 px-3 py-2">
      <div className="mr-1 flex shrink-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300"><Settings2 size={13} /> Documento</div>
      {panels.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={activePanel === id} onClick={() => setActivePanel(id)} className={cn('flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition', activePanel === id ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-200' : 'border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-white')}><Icon size={12} />{label}</button>)}
      <span className="ml-auto hidden shrink-0 text-[10px] text-slate-500 md:inline">{target.moduleLabel} · {target.label}</span>
    </div>
    <div className="max-h-[300px] overflow-y-auto px-3 py-3 sm:px-4">
      {activePanel === 'header' && <div className="grid items-center gap-3 md:grid-cols-2">
        <p className="text-[11px] leading-relaxed text-slate-400">Selecciona el logo en la hoja para moverlo o usa sus tiradores para cambiar su tamaño. La composición del encabezado se edita directamente en el canvas.</p>
        <label className="flex items-center gap-2 rounded-md border border-slate-700 px-2 py-2 text-[10px] text-slate-300"><input type="checkbox" checked={settings.showCompanyName !== false} onChange={event => update('showCompanyName', event.target.checked)} className="accent-emerald-400" />Mostrar nombre de empresa</label>
      </div>}
      {activePanel === 'content' && <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
        <fieldset className="min-w-0">
          <legend className="mb-2 text-[10px] text-slate-400">Diseño de tablas</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">{tableLayouts.map(layout => <button key={layout.value} type="button" aria-pressed={(settings.tableLayout || 'standard') === layout.value} onClick={() => update('tableLayout', layout.value)} className={cn('min-h-8 rounded-md border px-2 py-1 text-[10px] transition', (settings.tableLayout || 'standard') === layout.value ? 'border-emerald-400 bg-emerald-400/10 font-semibold text-emerald-200' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white')}>{layout.label}</button>)}</div>
        </fieldset>
        <label className="space-y-1 text-[10px] text-slate-400">Marca de agua<input className={INPUT_CLASS} value={settings.watermark || ''} onChange={event => update('watermark', event.target.value)} placeholder="BORRADOR" /></label>
        <p className="text-[10px] leading-relaxed text-slate-500 md:col-span-2">Los textos, el pie y otros elementos se editan al seleccionarlos directamente en el canvas.</p>
      </div>}
      {activePanel === 'page' && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-[10px] text-slate-400">Papel<select className={SELECT_CLASS} value={settings.paperSize} onChange={event => update('paperSize', event.target.value)}><option value="LETTER">Carta</option><option value="A4">A4</option><option value="OFICIO">Oficio</option><option value="LEGAL">Legal</option><option value="LABEL">Etiqueta 70 × 38 mm</option><option value="ROLL-80">Rollo térmico 80 mm</option></select></label>
        <label className="space-y-1 text-[10px] text-slate-400">Orientación<select className={SELECT_CLASS} value={settings.orientation} onChange={event => update('orientation', event.target.value as CanvasSettings['orientation'])}><option value="portrait">Vertical</option><option value="landscape">Horizontal</option></select></label>
        <label className="space-y-1 text-[10px] text-slate-400">Tipografía predeterminada<select className={SELECT_CLASS} value={settings.fontFamily || 'helvetica'} onChange={event => update('fontFamily', event.target.value)}>{CANVAS_FONT_OPTIONS.map(font => <option key={font.value} value={font.value}>{font.label}</option>)}</select></label>
        <label className="space-y-1 text-[10px] text-slate-400">Color principal<FastColorInput value={color} onChange={value => update('primaryColor', value)} className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1" /></label>
        <label className="space-y-1 text-[10px] text-slate-400">Color secundario<FastColorInput value={settings.secondaryColor || '#0f3b65'} onChange={value => update('secondaryColor', value)} className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1" /></label>
        <label className="space-y-1 text-[10px] text-slate-400">Color del texto<FastColorInput value={settings.textColor || '#334155'} onChange={value => update('textColor', value)} className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1" /></label>
        <label className="space-y-1 text-[10px] text-slate-400">Color de líneas<FastColorInput value={settings.lineColor || '#e2e8f0'} onChange={value => update('lineColor', value)} className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1" /></label>
        <label className="space-y-1 text-[10px] text-slate-400">Fondo de página<FastColorInput value={settings.backgroundColor || '#ffffff'} onChange={value => update('backgroundColor', value)} className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1" /></label>
      </div>}
    </div>
  </div>;
}

export function PdfTemplateCanvasEditor({ definition, settings, targetKey, data, onChange, onSettingsChange, onUploadLogo, onSave, logo, readOnly = false }: PdfTemplateCanvasEditorProps) {
  const [selectedId, setSelectedId] = useState(definition.nodes.find(node => node.enabled !== false)?.id || null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [selectedReportSection, setSelectedReportSection] = useState<{ nodeId: string; index: number } | null>(null);
  const [zoom, setZoom] = useState(72);
  const [history, setHistory] = useState<PdfTemplateDefinition[]>([]);
  const [future, setFuture] = useState<PdfTemplateDefinition[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const inlineTextEditorRef = useRef<HTMLDivElement>(null);
  const inlineTextInitialValueRef = useRef('');
  const cancelInlineTextEditRef = useRef(false);
  const editorRootRef = useRef<HTMLDivElement>(null);
  const target = getPdfTemplateTarget(targetKey);
  const sampleData = useMemo<PdfTemplateData>(() => {
    const contextual = createPdfTemplateSampleData(targetKey);
    return {
      ...contextual,
      ...data,
      logo: data?.logo || data?.company?.logo || logo || contextual.logo,
      company: { ...(contextual.company || {}), ...(data?.company || {}), logo: data?.company?.logo || data?.logo || logo || contextual.company?.logo },
      document: { ...(contextual.document || {}), ...(data?.document || {}) },
      customer: { ...(contextual.customer || {}), ...(data?.customer || {}) },
      supplier: { ...(contextual.supplier || {}), ...(data?.supplier || {}) },
      party: { ...(contextual.party || {}), ...(data?.party || {}) },
      totals: { ...(contextual.totals || {}), ...(data?.totals || {}) },
      reportKpis: data?.reportKpis || contextual.reportKpis || [],
      reportSections: data?.reportSections || contextual.reportSections,
      dashboardCharts: data?.dashboardCharts || contextual.dashboardCharts,
      dashboardPreferences: data?.dashboardPreferences || contextual.dashboardPreferences,
      items: data?.items || data?.rows || data?.history || contextual.items || [],
    };
  }, [data, logo, targetKey]);
  useEffect(() => {
    const root = editorRootRef.current;
    if (!root) return;
    root.toggleAttribute('inert', readOnly);
  }, [readOnly]);
  useEffect(() => {
    const editor = inlineTextEditorRef.current;
    if (!editor || !editingTextId) return;
    editor.textContent = inlineTextInitialValueRef.current;
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }, [editingTextId]);
  const selectedNode = definition.nodes.find(node => node.id === selectedId) || null;
  const selected = selectedNode ? { ...selectedNode, borderStyle: selectedNode.borderStyle || defaultCanvasBorderStyle(selectedNode.type) } : null;
  const activeNodes = useMemo(() => definition.nodes.filter(node => node.enabled !== false && (node.page || 1) === 1 && !(node.id === 'company-name' && settings.showCompanyName === false)), [definition.nodes, settings.showCompanyName]);

  useEffect(() => {
    if (selectedId && !definition.nodes.some(node => node.id === selectedId)) setSelectedId(definition.nodes.find(node => node.enabled !== false)?.id || null);
  }, [definition.nodes, selectedId]);

  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent) => {
      if (drag.mode === 'rotate') {
        const currentAngle = Math.atan2(event.clientY - (drag.centerY || 0), event.clientX - (drag.centerX || 0)) * (180 / Math.PI);
        const nextRotation = Math.max(-180, Math.min(180, Math.round((drag.initialRotation || 0) + currentAngle - (drag.startAngle || 0))));
        onChange(updateNode(definition, drag.id, { rotation: nextRotation }));
        return;
      }
      const dx = ((event.clientX - drag.startX) / drag.rect.width) * 100;
      const dy = ((event.clientY - drag.startY) / drag.rect.height) * 100;
      const next = drag.mode === 'resize'
        ? { width: Math.max(4, Math.min(100 - drag.x, drag.width + dx)), height: Math.max(2, Math.min(100 - drag.y, drag.height + dy)) }
        : { x: Math.max(0, Math.min(100 - drag.width, drag.x + dx)), y: Math.max(0, Math.min(100 - drag.height, drag.y + dy)) };
      onChange(updateNode(definition, drag.id, next));
    };
    const stop = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
  }, [definition, drag, onChange]);

  const commit = (next: PdfTemplateDefinition) => {
    setHistory(items => [...items.slice(-19), definition]);
    setFuture([]);
    onChange(next);
  };

  const addNode = (type: PdfTemplateNodeType) => {
    const id = `${type}-${Date.now()}`;
    const defaults: Record<PdfTemplateNodeType, Partial<PdfTemplateNode>> = {
      section: { label: 'Sección extra', text: 'Sección extra', backgroundColor: '#f8fafc', borderColor: settings.lineColor || '#e2e8f0', borderStyle: 'none', width: 40, height: 10, borderRadius: 8, shape: 'rectangle' },
      text: { label: 'Texto', text: 'Nuevo texto', borderStyle: 'none', width: 34, height: 6 },
      field: { label: 'Campo', token: 'document.number', borderStyle: 'none', width: 34, height: 5 },
      barcode: { label: 'Código de barras', token: 'product.barcode', width: 42, height: 16, borderStyle: 'none', align: 'center' },
      table: { label: 'Tabla', width: 60, height: 18, columns: [{ id: 'description', label: 'Descripción', token: 'description', width: 70 }, { id: 'total', label: 'Total', token: 'total', width: 30, align: 'right' }] },
      'report-sections': { label: 'Secciones del reporte', width: 90, height: 45, columns: [] },
      chart: { label: 'Gráfica', token: 'dashboard.trend', chartType: 'area', width: 48, height: 20, borderStyle: 'solid', backgroundColor: '#ffffff' },
      totals: { label: 'Totales', borderStyle: 'none', width: 35, height: 12, backgroundColor: '#f8fafc' },
      image: { label: 'Logo', borderStyle: 'none', width: 22, height: 12 },
      divider: { label: 'Separador', width: 60, height: 1, borderColor: settings.lineColor || '#e2e8f0' },
      spacer: { label: 'Espacio', borderStyle: 'none', width: 20, height: 5 },
    };
    const nextNode = { id, type, x: 10, y: 18 + (definition.nodes.length % 5) * 8, enabled: true, fontSize: settings.fontSize || 9, color: settings.textColor || '#334155', padding: 1.5, ...defaults[type] } as PdfTemplateNode;
    setSelectedId(id);
    commit({ ...definition, nodes: [...definition.nodes, nextNode] });
  };

  const removeSelected = () => {
    if (!selected) return;
    commit({ ...definition, nodes: definition.nodes.filter(node => node.id !== selected.id) });
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy = { ...selected, id: `${selected.type}-${Date.now()}`, x: Math.min(90 - selected.width, selected.x + 3), y: Math.min(95 - selected.height, selected.y + 3), label: `${selected.label} copia` };
    setSelectedId(copy.id);
    commit({ ...definition, nodes: [...definition.nodes, copy] });
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory(items => items.slice(0, -1));
    setFuture(items => [...items, definition]);
    onChange(previous);
  };

  const redo = () => {
    const next = future[future.length - 1];
    if (!next) return;
    setFuture(items => items.slice(0, -1));
    setHistory(items => [...items, definition]);
    onChange(next);
  };

  const beginDrag = (event: ReactPointerEvent, node: PdfTemplateNode, mode: 'move' | 'resize') => {
    event.stopPropagation();
    event.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelectedId(node.id);
    setSelectedReportSection(null);
    setDrag({ id: node.id, mode, startX: event.clientX, startY: event.clientY, x: node.x, y: node.y, width: node.width, height: node.height, rect });
  };

  const beginRotate = (event: ReactPointerEvent, node: PdfTemplateNode) => {
    event.stopPropagation();
    event.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + ((node.x + node.width / 2) / 100) * rect.width;
    const centerY = rect.top + ((node.y + node.height / 2) / 100) * rect.height;
    const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);
    setSelectedId(node.id);
    setHistory(items => [...items.slice(-19), definition]);
    setFuture([]);
    setDrag({ id: node.id, mode: 'rotate', startX: event.clientX, startY: event.clientY, x: node.x, y: node.y, width: node.width, height: node.height, rect, centerX, centerY, startAngle, initialRotation: node.rotation || 0 });
  };

  const selectedPatch = (patch: Partial<PdfTemplateNode>) => {
    if (!selected) return;
    commit(updateNode(definition, selected.id, patch));
  };

  const previewSelectedPatch = (patch: Partial<PdfTemplateNode>) => {
    if (!selected) return;
    onChange(updateNode(definition, selected.id, patch));
  };

  const beginContinuousPatch = () => {
    if (!selected) return;
    setHistory(items => [...items.slice(-19), definition]);
    setFuture([]);
  };

  const rotateSelectedBy = (degrees: number) => {
    if (!selected) return;
    const nextRotation = Math.max(-180, Math.min(180, (selected.rotation || 0) + degrees));
    selectedPatch({ rotation: nextRotation });
  };

  const startInlineTextEdit = (node: PdfTemplateNode) => {
    if (readOnly || !isInlineTextEditable(node)) return;
    setSelectedId(node.id);
    setSelectedReportSection(null);
    cancelInlineTextEditRef.current = false;
    inlineTextInitialValueRef.current = inlineTextValue(node, sampleData);
    setEditingTextId(node.id);
  };

  const finishInlineTextEdit = (node: PdfTemplateNode, value: string) => {
    if (cancelInlineTextEditRef.current) {
      cancelInlineTextEditRef.current = false;
      setEditingTextId(null);
      return;
    }
    const text = value.replace(/\r\n?/g, '\n');
    const companySetting = node.type === 'field' && node.token ? COMPANY_TOKEN_SETTINGS[node.token] : undefined;
    if (companySetting) {
      if (text !== inlineTextValue(node, sampleData)) onSettingsChange?.({ [companySetting]: text } as Partial<CanvasSettings>);
      setEditingTextId(null);
      return;
    }
    if (text !== inlineTextValue(node, sampleData)) {
      const label = text.trim().split('\n')[0]?.slice(0, 80) || node.label;
      commit(updateNode(definition, node.id, { text, label }));
    }
    setEditingTextId(null);
  };

  const patchSettings = (patch: Partial<CanvasSettings>) => onSettingsChange?.(patch);
  const previewLogo = logo || (typeof sampleData.logo === 'string' ? sampleData.logo : typeof sampleData.company?.logo === 'string' ? sampleData.company.logo : undefined);
  const previewReportSection = target.module === 'reportes' ? sampleData.reportSections?.[0] : undefined;
  const tableColorColumns = selected?.type === 'report-sections'
    ? Array.from({ length: Math.max(selected.columns?.length || 0, ...(sampleData.reportSections || []).map(section => section.columns.length)) }, (_, columnIndex) => {
      const sampleColumn = sampleData.reportSections?.find(section => section.columns[columnIndex])?.columns[columnIndex];
      return { ...(sampleColumn || {}), ...(selected.columns?.[columnIndex] || {}), id: selected.columns?.[columnIndex]?.id || sampleColumn?.id || `column-${columnIndex}`, label: selected.columns?.[columnIndex]?.label || sampleColumn?.label || `Columna ${columnIndex + 1}`, token: selected.columns?.[columnIndex]?.token || sampleColumn?.token || `column-${columnIndex}` } as PdfTemplateColumn;
    })
    : selected?.columns || [];
  const selectedReportSectionIndex = selected?.type === 'report-sections' && selectedReportSection?.nodeId === selected.id ? selectedReportSection.index : null;
  const activeReportSection = selectedReportSectionIndex === null ? undefined : sampleData.reportSections?.[selectedReportSectionIndex];
  const patchReportSectionStyle = (patch: Partial<PdfTemplateReportSectionStyle>) => {
    if (!selected || selected.type !== 'report-sections' || selectedReportSectionIndex === null) return;
    const key = String(selectedReportSectionIndex);
    selectedPatch({ reportSectionStyles: { ...(selected.reportSectionStyles || {}), [key]: { ...(selected.reportSectionStyles?.[key] || {}), ...patch } } });
  };
  const setReportSectionVisibility = (index: number, visible: boolean) => {
    if (!selected || selected.type !== 'report-sections') return;
    selectedPatch({ reportSectionVisibility: { ...(selected.reportSectionVisibility || {}), [String(index)]: visible } });
  };
  const selectReportSection = (nodeId: string, index: number) => {
    setSelectedId(nodeId);
    setSelectedReportSection({ nodeId, index });
  };

  const handleKeyDown = (event: ReactKeyboardEvent) => {
    if (!selected) return;
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelected(); return; }
    if (event.key === '[' || event.key === ']') { event.preventDefault(); rotateSelectedBy((event.key === '[' ? -1 : 1) * (event.shiftKey ? 15 : 5)); return; }
    const delta = event.shiftKey ? 2 : 0.5;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      selectedPatch({ x: selected.x + (event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0), y: selected.y + (event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0) });
    }
  };

  return (
    <div ref={editorRootRef} className="overflow-hidden rounded-2xl border border-slate-800 bg-[#101827] text-slate-100 shadow-2xl" data-testid="pdf-template-canvas-editor" aria-disabled={readOnly || undefined}>
      {readOnly && <div className="border-b border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs text-amber-200">Vista de solo lectura: tu permiso permite revisar esta plantilla, pero no modificarla.</div>}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-[#0b1220] px-3 py-2">
        <div className="mr-2 flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300"><Move size={15} /></div>
          <div className="min-w-0"><p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Canvas de plantilla</p><p className="truncate text-[10px] text-slate-500">{target.label} · arrastra; doble clic para editar texto</p></div>

        </div>
        <div className="flex flex-wrap items-center gap-1 border-l border-slate-800 pl-2">
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => addNode('field')}><Plus size={14} /> Campo</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => addNode('text')}><Type size={14} /> Texto</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => addNode('section')}><PanelTop size={14} /> Sección</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => addNode('table')}><Table2 size={14} /> Tabla</Button>
          {target.structure === 'dashboard' && <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => addNode('chart')}><BarChart3 size={14} /> Gráfica</Button>}
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => addNode('totals')}><Calculator size={14} /> Totales</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => addNode('image')}><ImagePlus size={14} /> Imagen</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => addNode('barcode')}><Barcode size={14} /> Barras</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-emerald-300 hover:bg-emerald-400/10 hover:text-emerald-200" onClick={onSave} disabled={!onSave}><Save size={14} /> Guardar</Button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Deshacer" disabled={!history.length} onClick={undo}><Undo2 size={15} /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Rehacer" disabled={!future.length} onClick={redo}><Redo2 size={15} /></Button>
          <span className="mx-1 h-5 w-px bg-slate-800" />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Alejar" onClick={() => setZoom(value => Math.max(45, value - 8))}><Minus size={15} /></Button>
          <span className="w-10 text-center text-[11px] text-slate-400">{zoom}%</span>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Acercar" onClick={() => setZoom(value => Math.min(120, value + 8))}><Plus size={15} /></Button>
        </div>
      </div>
      <CanvasDocumentControls settings={settings} target={target} onChange={patchSettings} />
      <div className="grid min-h-[580px] grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_245px]">
        <div className="relative overflow-auto bg-[radial-gradient(#243247_1px,transparent_1px)] [background-size:16px_16px] p-7 sm:p-10" onKeyDown={handleKeyDown} tabIndex={0}>
          <div className="mx-auto transition-transform duration-200" style={{ width: `${zoom}%`, maxWidth: 850, minWidth: 340 }}>
            <div ref={canvasRef} className="relative w-full overflow-hidden rounded-sm bg-white shadow-[0_22px_70px_rgba(0,0,0,0.45)]" style={{ aspectRatio: pageAspect(settings), backgroundColor: settings.backgroundColor || definition.page.background || '#fff' }} onPointerDown={() => setSelectedId(null)}>
              {settings.watermark?.trim() && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[38%] z-[15] select-none overflow-hidden text-center text-[42px] font-extrabold tracking-wide" style={{ color: settings.primaryColor || '#10b981', opacity: (Number(settings.watermarkOpacity) || 12) / 100, transform: 'rotate(-28deg)' }}>{settings.watermark}</div>}
              {activeNodes.map(node => {
                const isSelected = selectedId === node.id;
                const isEditingText = editingTextId === node.id;
                const canInlineEditText = !readOnly && isInlineTextEditable(node);
                const isInnerReportSectionSelected = node.type === 'report-sections' && selectedReportSectionIndex !== null && selectedReportSection?.nodeId === node.id;
                const showNodeSelection = isSelected && !isInnerReportSectionSelected;
                const isContainer = node.type === 'section' || node.type === 'report-sections' || node.type === 'spacer';
                return <div key={node.id} data-template-node={node.id} title={canInlineEditText ? 'Doble clic para editar este texto' : undefined} className={cn('group absolute overflow-visible border transition-shadow', canInlineEditText && 'cursor-text', node.type === 'divider' ? 'border-t-2 border-x-0 border-b-0' : 'border-transparent', isContainer ? 'z-0' : showNodeSelection ? 'z-20 shadow-[0_0_0_2px_#34d399,0_8px_20px_rgba(16,185,129,0.20)]' : 'z-10 hover:shadow-[0_0_0_1px_#93c5fd]', showNodeSelection && isContainer && 'shadow-[0_0_0_2px_#34d399]')} style={nodeStyle(node, settings)} onPointerDown={event => { if (isEditingText) { event.stopPropagation(); return; } beginDrag(event, node, 'move'); }} onClick={event => { event.stopPropagation(); setSelectedId(node.id); setSelectedReportSection(null); }} onDoubleClick={event => { if (!canInlineEditText) return; event.stopPropagation(); startInlineTextEdit(node); }}>
                  {isEditingText ? <div ref={inlineTextEditorRef} data-inline-text-editor="true" contentEditable suppressContentEditableWarning role="textbox" aria-label={`Editar texto: ${node.label}`} aria-multiline="true" className="absolute inset-0 z-30 min-h-[36px] min-w-[140px] max-w-[260px] overflow-auto rounded border border-emerald-400 bg-white/95 p-1 text-left text-slate-900 shadow-xl outline-none" style={{ fontFamily: canvasFontFamily(node.fontFamily || settings.fontFamily), fontSize: canvasFontSize(Number(node.fontSize || settings.fontSize || 9) || 9), fontWeight: node.fontWeight || (node.bold ? 700 : 400), color: node.color || '#334155', textAlign: node.align || 'left', lineHeight: node.lineHeight || 1.25, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onBlur={event => finishInlineTextEdit(node, event.currentTarget.innerText)} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); cancelInlineTextEditRef.current = true; event.currentTarget.blur(); } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.blur(); } }}>{inlineTextValue(node)}</div> : node.type === 'image' ? <LogoPreview src={previewLogo} companyName={String(sampleData.company?.name || settings.companyName || target.moduleLabel)} primaryColor={settings.primaryColor} secondaryColor={settings.secondaryColor} className="h-full w-full" /> : node.type === 'table' ? <TablePreview node={node} settings={settings} data={sampleData} reportSection={previewReportSection} /> : node.type === 'report-sections' ? <ReportSectionsPreview node={node} settings={settings} data={sampleData} selectedSectionIndex={selectedReportSectionIndex} onSelectSection={index => selectReportSection(node.id, index)} /> : node.type === 'chart' ? <ChartPreview chart={sampleData.dashboardCharts?.find(chart => chart.id === node.token)} node={node} /> : node.type === 'totals' ? <div className="space-y-0.5" style={{ fontSize: canvasFontSize(Math.max(8, (Number(node.fontSize || settings.fontSize || 9) || 9) - 0.5)) }}><p className="mb-1 font-bold uppercase tracking-wider opacity-60" style={{ fontSize: canvasFontSize(7) }}>Totales</p>{['subtotal', 'tax', 'discount', 'total'].map(key => <div key={key} className={cn('flex justify-between gap-2', key === 'total' && 'border-t pt-0.5 font-bold')}><span>{key === 'subtotal' ? 'Subtotal' : key === 'tax' ? 'Impuestos' : key === 'discount' ? 'Descuento' : 'Total'}</span><span>{resolveTemplateToken(`totals.${key}`, sampleData)}</span></div>)}</div> : node.type === 'field' && node.id.startsWith('party-') ? <span className="flex w-full flex-col justify-center gap-px whitespace-pre-line leading-tight"><small className="font-bold uppercase tracking-wide text-slate-400" style={{ fontSize: canvasFontSize(7) }}>{node.label}</small><span className="w-full text-current">{resolveTemplateToken(node.token, sampleData, node.token?.startsWith('company.') ? '' : getTemplateTokenSample(node.token))}</span></span> : <span className="block w-full break-words whitespace-pre-wrap leading-tight">{node.type === 'section' && /^(header|footer)(-|$)/i.test(node.id) ? '' : nodeText(node, sampleData)}</span>}
                  {showNodeSelection && <><button type="button" aria-label="Girar elemento" title="Arrastra para girar" className="absolute left-1/2 -top-9 flex h-7 w-7 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-[#101827] bg-emerald-400 text-[#101827] shadow-lg active:cursor-grabbing" onPointerDown={event => beginRotate(event, node)}><RotateCw size={13} /></button><span className="pointer-events-none absolute left-1/2 -top-5 h-5 w-px -translate-x-1/2 bg-emerald-400" /><span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full border-2 border-[#101827] bg-emerald-400" /><span className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full border-2 border-[#101827] bg-emerald-400" /><span className="absolute -bottom-1.5 -left-1.5 h-3 w-3 rounded-full border-2 border-[#101827] bg-emerald-400" /><button type="button" aria-label="Redimensionar elemento" className="absolute -bottom-2 -right-2 flex h-4 w-4 cursor-nwse-resize items-center justify-center rounded-full border-2 border-[#101827] bg-emerald-400 text-[#101827]" onPointerDown={event => beginDrag(event, node, 'resize')}><GripVertical size={8} /></button></>}
                </div>;
              })}
              {!activeNodes.length && <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Agrega un elemento desde la barra de herramientas</div>}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-500"><Square size={11} /> Papel {settings.paperSize} · {settings.orientation === 'portrait' ? 'Vertical' : 'Horizontal'} · Usa las flechas para precisión</div>
        </div>
        <aside className="border-t border-slate-800 bg-[#0d1726] p-4 xl:border-l xl:border-t-0">
          {selected ? <div className="space-y-4" key={selected.id}>
            <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">{activeReportSection ? 'Tabla seleccionada' : 'Elemento seleccionado'}</p><p className="mt-1 text-sm font-semibold text-white">{activeReportSection?.title || selected.label}</p></div><Badge className="border-slate-700 bg-slate-800 text-[10px] text-slate-300">{activeReportSection ? 'tabla' : selected.type}</Badge></div>
            <ReportSectionInspector node={selected} data={sampleData} selectedSectionIndex={selectedReportSectionIndex} onSelectSection={index => selectReportSection(selected.id, index)} onSetVisibility={setReportSectionVisibility} onPatchStyle={patchReportSectionStyle} />
            {selected.type === 'chart' && <div><Label className="text-[10px] text-slate-400">Tipo de gráfica</Label><select value={selected.chartType || 'area'} onChange={event => selectedPatch({ chartType: event.target.value as PdfTemplateChart['type'] })} className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white"><option value="area">Área</option><option value="bar">Barras</option><option value="donut">Dona</option></select><p className="mt-1 text-[10px] text-slate-500">La serie y sus etiquetas provienen del dashboard seleccionado.</p></div>}
            <div className="grid grid-cols-2 gap-2"><div><Label className="text-[10px] text-slate-400">X</Label><Input type="number" value={selected.x} onChange={event => selectedPatch({ x: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div><div><Label className="text-[10px] text-slate-400">Y</Label><Input type="number" value={selected.y} onChange={event => selectedPatch({ y: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div><div><Label className="text-[10px] text-slate-400">Ancho</Label><Input type="number" value={selected.width} onChange={event => selectedPatch({ width: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div><div><Label className="text-[10px] text-slate-400">Alto</Label><Input type="number" value={selected.height} onChange={event => selectedPatch({ height: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div></div>
            {selected.type === 'field' && <div><Label className="text-[10px] text-slate-400">Campo de datos</Label><select value={selected.token || ''} onChange={event => selectedPatch({ token: event.target.value, label: TEMPLATE_TOKENS.find(item => item.token === event.target.value)?.label || selected.label })} className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white"><option value="">Selecciona un campo</option>{TEMPLATE_TOKENS.map(item => <option key={item.token} value={item.token}>{item.label}</option>)}</select><p className="mt-1 text-[10px] text-slate-500">Vista previa: {selected.token?.startsWith('company.') ? resolveTemplateToken(selected.token, sampleData, '') || 'Sin datos de empresa configurados' : getTemplateTokenSample(selected.token)}</p></div>}
            {selected.type === 'field' && selected.token?.startsWith('company.') && <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-2 text-[10px] leading-relaxed text-slate-400">{selected.token === 'company.summary' ? 'Este bloque combina los datos de la empresa. Cambia cada dato con doble clic sobre su texto o en la sección ' : 'Este campo se alimenta de la empresa. Puedes cambiarlo con doble clic aquí o en la sección '}<span className="font-semibold text-emerald-200">Datos de empresa en este PDF</span> que está debajo del canvas. Si el valor queda vacío, el PDF usa el dato que entregue la sucursal.</div>}
            {(selected.type === 'text' || selected.type === 'section') && <div><Label className="text-[10px] text-slate-400">Contenido</Label><Input value={selected.text || ''} onChange={event => selectedPatch({ text: event.target.value })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div>}
            <div><Label className="text-[10px] text-slate-400">Tipografía del componente</Label><select value={selected.fontFamily || settings.fontFamily || 'Arial'} onChange={event => selectedPatch({ fontFamily: event.target.value })} className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">{CANVAS_FONT_OPTIONS.map(font => <option key={font.value} value={font.value}>{font.label}</option>)}</select></div>
            <div className="grid grid-cols-3 gap-2"><div><Label className="text-[10px] text-slate-400">Tamaño</Label><Input type="number" min={5} max={72} value={selected.fontSize || 9} onChange={event => selectedPatch({ fontSize: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div><div><Label className="text-[10px] text-slate-400">Peso</Label><select value={selected.fontWeight || (selected.bold ? 700 : 400)} onChange={event => selectedPatch({ fontWeight: Number(event.target.value) as PdfTemplateNode['fontWeight'], bold: Number(event.target.value) >= 700 })} className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-1 text-xs text-white"><option value="400">Normal</option><option value="500">Medio</option><option value="600">Semibold</option><option value="700">Negrita</option><option value="800">Fuerte</option></select></div><div><Label className="text-[10px] text-slate-400">Radio</Label><Input type="number" min={0} max={999} value={selected.borderRadius || 0} onChange={event => selectedPatch({ borderRadius: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div></div><div className="grid grid-cols-2 gap-2"><div><Label className="text-[10px] text-slate-400">Forma del componente</Label><select value={selected.shape || 'rectangle'} onChange={event => selectedPatch({ shape: event.target.value as PdfTemplateNode['shape'] })} className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white"><option value="rectangle">Rectangular</option><option value="pill">Píldora</option><option value="wave">Ola superior</option><option value="wave-bottom">Ola inferior</option><option value="circle">Circular</option><option value="angled">Angular</option><option value="blob">Orgánica</option><option value="arc">Arco</option></select></div><div><Label className="text-[10px] text-slate-400">Tipo de borde</Label><select value={selected.borderStyle || 'solid'} onChange={event => selectedPatch({ borderStyle: event.target.value as PdfTemplateNode['borderStyle'] })} className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white"><option value="solid">Continuo</option><option value="dashed">Segmentado</option><option value="dotted">Punteado</option><option value="double">Doble</option><option value="none">Sin borde</option></select></div></div><div className="grid grid-cols-2 gap-2"><div><Label className="text-[10px] text-slate-400">Giro</Label><Input type="number" min={-180} max={180} value={selected.rotation || 0} onChange={event => selectedPatch({ rotation: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div><div><Label className="text-[10px] text-slate-400">Opacidad <span className="text-slate-500">{Math.round((selected.opacity ?? 1) * 100)}%</span></Label><input type="range" min="0" max="100" value={Math.round((selected.opacity ?? 1) * 100)} onChange={event => selectedPatch({ opacity: Number(event.target.value) / 100 })} className="mt-3 w-full accent-emerald-400" /></div></div>
            <div className="flex flex-wrap items-center gap-1"><Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-slate-400', selected.align === 'left' && 'bg-slate-700 text-white')} aria-label="Alinear a la izquierda" onClick={() => selectedPatch({ align: 'left' })}><AlignLeft size={14} /></Button><Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-slate-400', selected.align === 'center' && 'bg-slate-700 text-white')} aria-label="Centrar" onClick={() => selectedPatch({ align: 'center' })}><AlignCenter size={14} /></Button><Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-slate-400', selected.align === 'right' && 'bg-slate-700 text-white')} aria-label="Alinear a la derecha" onClick={() => selectedPatch({ align: 'right' })}><AlignRight size={14} /></Button><Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-slate-400', selected.bold && 'bg-slate-700 text-white')} aria-label="Negrita" onClick={() => selectedPatch({ bold: !selected.bold, fontWeight: selected.bold ? 400 : 700 })}><strong>B</strong></Button><Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-slate-400', selected.italic && 'bg-slate-700 text-white')} aria-label="Cursiva" onClick={() => selectedPatch({ italic: !selected.italic })}><Italic size={14} /></Button><Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-slate-400', selected.underline && 'bg-slate-700 text-white')} aria-label="Subrayado" onClick={() => selectedPatch({ underline: !selected.underline })}><Underline size={14} /></Button><Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-slate-400', selected.strikethrough && 'bg-slate-700 text-white')} aria-label="Tachado" onClick={() => selectedPatch({ strikethrough: !selected.strikethrough })}><Strikethrough size={14} /></Button></div>
            <div className="grid grid-cols-2 gap-2"><div><Label className="text-[10px] text-slate-400">Interlineado</Label><Input type="number" min={0.8} max={3} step={0.05} value={selected.lineHeight || 1.25} onChange={event => selectedPatch({ lineHeight: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div><div><Label className="text-[10px] text-slate-400">Espaciado</Label><Input type="number" min={-2} max={10} step={0.25} value={selected.letterSpacing || 0} onChange={event => selectedPatch({ letterSpacing: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div></div>
            <div><Label className="text-[10px] text-slate-400">Transformación</Label><select value={selected.textTransform || 'none'} onChange={event => selectedPatch({ textTransform: event.target.value as PdfTemplateNode['textTransform'] })} className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white"><option value="none">Normal</option><option value="uppercase">MAYÚSCULAS</option><option value="lowercase">minúsculas</option><option value="capitalize">Capitalizar</option></select></div>
            {!(selected.type === 'report-sections' && selectedReportSectionIndex !== null) && <div className="grid grid-cols-3 gap-2"><div><Label className="text-[10px] text-slate-400">Color</Label><FastColorInput value={selected.color || '#334155'} onChange={value => selectedPatch({ color: value })} className="mt-1 h-8 w-full cursor-pointer border-slate-700 bg-slate-900 p-1" /></div><div><Label className="text-[10px] text-slate-400">Fondo</Label><FastColorInput value={selected.backgroundColor && selected.backgroundColor !== 'transparent' ? selected.backgroundColor : '#ffffff'} onChange={value => selectedPatch({ backgroundColor: value })} className="mt-1 h-8 w-full cursor-pointer border-slate-700 bg-slate-900 p-1" /></div><div><Label className="text-[10px] text-slate-400">Borde</Label><FastColorInput value={selected.borderColor || '#e2e8f0'} onChange={value => selectedPatch({ borderColor: value })} className="mt-1 h-8 w-full cursor-pointer border-slate-700 bg-slate-900 p-1" /></div></div>}
            {(selected.type === 'table' || (selected.type === 'report-sections' && selectedReportSectionIndex === null)) && <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div><p className="text-[10px] uppercase tracking-[0.12em] text-emerald-300">Colores de la tabla</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">Edita el encabezado, texto y filas. Los colores por columna tienen prioridad sobre el encabezado general.</p></div><div className="mt-3 grid grid-cols-2 gap-2"><div><Label className="text-[10px] text-slate-400">Encabezado de columnas</Label><FastColorInput value={selected.tableHeaderColor || settings.primaryColor || '#10b981'} onChange={value => selectedPatch({ tableHeaderColor: value })} className="mt-1 h-8 w-full cursor-pointer border-slate-700 bg-slate-900 p-1" /></div><div><Label className="text-[10px] text-slate-400">Texto del encabezado</Label><FastColorInput value={selected.tableHeaderTextColor || '#ffffff'} onChange={value => selectedPatch({ tableHeaderTextColor: value })} className="mt-1 h-8 w-full cursor-pointer border-slate-700 bg-slate-900 p-1" /></div><div><Label className="text-[10px] text-slate-400">Filas</Label><FastColorInput value={selected.tableRowColor || '#ffffff'} onChange={value => selectedPatch({ tableRowColor: value })} className="mt-1 h-8 w-full cursor-pointer border-slate-700 bg-slate-900 p-1" /></div><div><Label className="text-[10px] text-slate-400">Filas alternas</Label><FastColorInput value={selected.tableStripeColor || '#f8fafc'} onChange={value => selectedPatch({ tableStripeColor: value })} className="mt-1 h-8 w-full cursor-pointer border-slate-700 bg-slate-900 p-1" /></div></div><div className="mt-3 space-y-2 border-t border-slate-800 pt-3"><p className="text-[10px] font-medium text-slate-400">Color por columna</p>{tableColorColumns.map((column, columnIndex) => <div key={column.id || columnIndex} className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-[10px] text-slate-500">{column.label || `Columna ${columnIndex + 1}`}</span><FastColorInput aria-label={`Color de ${column.label || `columna ${columnIndex + 1}`}`} value={column.backgroundColor || selected.tableHeaderColor || settings.primaryColor || '#10b981'} onChange={value => { const columns = [...(selected.columns || [])]; columns[columnIndex] = { ...(columns[columnIndex] || column), backgroundColor: value }; selectedPatch({ columns }); }} className="h-7 w-12 shrink-0 cursor-pointer rounded border border-slate-700 bg-slate-900 p-1" /></div>)}</div></div>}
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div className="flex items-center justify-between gap-2"><div><Label className="text-[10px] uppercase tracking-[0.12em] text-emerald-300">Giro en eje Z</Label><p className="mt-1 text-[10px] text-slate-500">Rota el componente sobre su centro</p></div><span className="rounded-md bg-emerald-400/10 px-2 py-1 font-mono text-xs font-bold text-emerald-200">{Math.round(selected.rotation || 0)}°</span></div><div className="mt-3 flex items-center justify-between gap-1"><Button type="button" variant="ghost" size="icon" title="Girar -90 grados" aria-label="Girar -90 grados" className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => rotateSelectedBy(-90)}><RotateCcw size={14} /></Button><Button type="button" variant="ghost" size="sm" title="Girar -15 grados" className="h-8 px-2 text-[10px] text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => rotateSelectedBy(-15)}>-15°</Button><Button type="button" variant="ghost" size="sm" title="Restablecer giro" className="h-8 px-2 text-[10px] text-emerald-200 hover:bg-emerald-400/10 hover:text-emerald-100" onClick={() => selectedPatch({ rotation: 0 })}>0°</Button><Button type="button" variant="ghost" size="sm" title="Girar +15 grados" className="h-8 px-2 text-[10px] text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => rotateSelectedBy(15)}>+15°</Button><Button type="button" variant="ghost" size="icon" title="Girar +90 grados" aria-label="Girar +90 grados" className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => rotateSelectedBy(90)}><RotateCw size={14} /></Button></div><input aria-label="Giro en eje Z" type="range" min="-180" max="180" value={selected.rotation || 0} onPointerDown={beginContinuousPatch} onChange={event => previewSelectedPatch({ rotation: Number(event.target.value) })} className="mt-3 w-full cursor-ew-resize accent-emerald-400" /><div className="mt-1 flex justify-between font-mono text-[9px] text-slate-600"><span>-180°</span><span>0°</span><span>180°</span></div><p className="mt-2 text-[10px] text-slate-500">También puedes usar [ y ] para girar 5°; con Shift, 15°.</p></div>
            <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-3"><Button type="button" variant="outline" size="sm" className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white" onClick={duplicateSelected}><Copy size={13} /> Duplicar</Button><Button type="button" variant="outline" size="sm" className="border-rose-900/60 bg-transparent text-rose-300 hover:bg-rose-950/60 hover:text-rose-200" onClick={removeSelected}><Trash2 size={13} /> Eliminar</Button></div>
          </div> : <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-center"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-slate-500"><GripVertical size={20} /></div><p className="text-sm font-medium text-slate-300">Selecciona un elemento</p><p className="mt-1 max-w-[180px] text-[11px] leading-relaxed text-slate-500">Cada bloque es independiente. Puedes moverlo, cambiar su tamaño y conectar campos reales.</p></div>}
          <div className="mt-5 border-t border-slate-800 pt-4"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">Capas y componentes</p><span className="text-[10px] text-slate-500">{activeNodes.length}</span></div><div className="max-h-44 space-y-1 overflow-y-auto pr-1">{[...activeNodes].reverse().map(node => <button key={node.id} type="button" onClick={() => { setSelectedId(node.id); setSelectedReportSection(null); }} className={cn('flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition', selectedId === node.id ? 'border-emerald-400/70 bg-emerald-400/10 text-emerald-200' : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200')}><span className="min-w-0 truncate">{node.label}</span><Badge className="shrink-0 border-slate-700 bg-slate-900 px-1.5 text-[9px] text-slate-500">{node.type}</Badge></button>)}</div></div>
        </aside>
      </div>
      <section className="border-t border-slate-800 bg-[#0d1726] p-4 sm:p-5" data-testid="pdf-company-data-section" aria-labelledby="pdf-company-data-title">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 id="pdf-company-data-title" className="flex items-center gap-2 text-sm font-semibold text-white"><Building2 size={15} className="text-emerald-300" />Datos de empresa en este PDF</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Configura el encabezado para «{target.label}». Los campos vacíos usan los datos disponibles de la cuenta o sucursal.</p>
          </div>
          <Badge className="border-emerald-400/30 bg-emerald-400/10 text-[9px] text-emerald-200">{target.moduleLabel} · {target.label}</Badge>
        </div>
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10"><LogoPreview src={logo || settings.templateLogoUrl || settings.logoUrl} companyName={settings.companyName || target.moduleLabel} primaryColor={settings.primaryColor} secondaryColor={settings.secondaryColor} className="h-full w-full" /></div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-white">{logo || settings.templateLogoUrl || settings.logoUrl ? 'Logo del documento' : 'Identificador de empresa'}</p>
              <label className={cn('mt-1 inline-flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-emerald-300 hover:text-emerald-200', (readOnly || !onUploadLogo) && 'cursor-not-allowed opacity-50')}>
                <ImagePlus size={12} />Agregar o reemplazar
                <input type="file" accept="image/*" aria-label="Cargar logo del documento" className="sr-only" disabled={readOnly || !onUploadLogo} onChange={event => { const file = event.target.files?.[0]; if (file) onUploadLogo?.(file); event.currentTarget.value = ''; }} />
              </label>
            </div>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <label className="min-w-0 space-y-1 text-[10px] text-slate-400">Empresa<input className={INPUT_CLASS} disabled={readOnly || !onSettingsChange} value={settings.companyName || ''} onChange={event => patchSettings({ companyName: event.target.value })} placeholder="Usar nombre de la cuenta" /></label>
            <label className="min-w-0 space-y-1 text-[10px] text-slate-400">Eslogan<input className={INPUT_CLASS} disabled={readOnly || !onSettingsChange} value={settings.slogan || ''} onChange={event => patchSettings({ slogan: event.target.value })} placeholder="Eslogan" /></label>
            <label className="min-w-0 space-y-1 text-[10px] text-slate-400">Teléfono<input className={INPUT_CLASS} disabled={readOnly || !onSettingsChange} value={settings.phone || ''} onChange={event => patchSettings({ phone: event.target.value })} placeholder="Teléfono de la empresa" /></label>
            <label className="min-w-0 space-y-1 text-[10px] text-slate-400">Correo<input className={INPUT_CLASS} disabled={readOnly || !onSettingsChange} value={settings.email || ''} onChange={event => patchSettings({ email: event.target.value })} placeholder="Correo de la empresa" /></label>
            <label className="min-w-0 space-y-1 text-[10px] text-slate-400 sm:col-span-2 xl:col-span-3">Dirección<input className={INPUT_CLASS} disabled={readOnly || !onSettingsChange} value={settings.address || ''} onChange={event => patchSettings({ address: event.target.value })} placeholder="Dirección fiscal o comercial" /></label>
            <label className="min-w-0 space-y-1 text-[10px] text-slate-400">Identificación fiscal<input className={INPUT_CLASS} disabled={readOnly || !onSettingsChange} value={settings.fiscalInfo || ''} onChange={event => patchSettings({ fiscalInfo: event.target.value })} placeholder="RUC / identificación fiscal" /></label>
            <label className="min-w-0 space-y-1 text-[10px] text-slate-400">Sitio web<input className={INPUT_CLASS} disabled={readOnly || !onSettingsChange} value={settings.website || ''} onChange={event => patchSettings({ website: event.target.value })} placeholder="Sitio web" /></label>
          </div>
        </div>
      </section>
    </div>
  );
}
