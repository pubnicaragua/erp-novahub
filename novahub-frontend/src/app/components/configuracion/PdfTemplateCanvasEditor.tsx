import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Barcode, Building2, Calculator, Copy, GripVertical, ImagePlus, Italic, Minus, Move, Palette, PanelBottom, PanelTop, Plus, Redo2, RotateCcw, RotateCw, Save, Settings2, Square, Strikethrough, Table2, Trash2, Type, Underline, Undo2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { FastColorInput } from '../ui/FastColorInput';
import { cn } from '../ui/utils';
import { getPdfTemplateTarget } from '../../services/pdf-document-catalog';
import { createPdfTemplateSampleData, getTemplateTokenSample, PDF_DEFAULT_FONT_SCALE, resolveTemplateToken, TEMPLATE_TOKENS, type PdfTemplateData, type PdfTemplateDefinition, type PdfTemplateNode, type PdfTemplateNodeType } from '../../services/pdf-template-definition';

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
}

type DragState = { id: string; mode: 'move' | 'resize' | 'rotate'; startX: number; startY: number; x: number; y: number; width: number; height: number; rect: DOMRect; centerX?: number; centerY?: number; startAngle?: number; initialRotation?: number };

const CANVAS_FONT_OPTIONS = [
  { value: 'helvetica', label: 'Helvetica (PDF)' }, { value: 'Arial', label: 'Arial' }, { value: 'Helvetica', label: 'Helvetica' }, { value: 'Verdana', label: 'Verdana' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS' }, { value: 'Georgia', label: 'Georgia' }, { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'times', label: 'Times New Roman (PDF)' }, { value: 'Garamond', label: 'Garamond' }, { value: 'Courier New', label: 'Courier New' }, { value: 'courier', label: 'Courier New (PDF)' }, { value: 'Consolas', label: 'Consolas' }, { value: 'Impact', label: 'Impact' },
];

function pageAspect(settings: CanvasSettings) {
  const dimensions = settings.paperSize === 'A4' ? [210, 297] : settings.paperSize === 'OFICIO' ? [216, 330] : settings.paperSize === 'LEGAL' ? [216, 356] : settings.paperSize === 'LABEL' ? [70, 38] : [216, 279];
  return settings.orientation === 'landscape' ? `${dimensions[1]} / ${dimensions[0]}` : `${dimensions[0]} / ${dimensions[1]}`;
}

function nodeText(node: PdfTemplateNode, data: PdfTemplateData) {
  if (node.type === 'field' || node.type === 'barcode') {
    const value = resolveTemplateToken(node.token, data, node.sample || getTemplateTokenSample(node.token));
    return node.type === 'field' && node.id.startsWith('party-') ? `${node.label}\n${value}` : value;
  }
  return node.text || node.sample || node.label;
}

function LogoPreview({ src, companyName, className }: { src?: string | null; companyName?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const initials = String(companyName || 'NovaHub').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'NH';
  if (!src || failed) return <div className={cn('flex items-center justify-center rounded-[22%] bg-gradient-to-br from-emerald-500 to-sky-900 text-[11px] font-black tracking-wide text-white', className)} aria-label="Identificador de empresa">{initials}</div>;
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
  const borderStyle = node.borderStyle || (node.type === 'table' || node.type === 'divider' ? 'solid' : 'none');
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
  return type === 'table' || type === 'divider' ? 'solid' : 'none';
}

function updateNode(definition: PdfTemplateDefinition, id: string, patch: Partial<PdfTemplateNode>) {
  return { ...definition, nodes: definition.nodes.map(node => node.id === id ? { ...node, ...patch } : node) };
}

type DocumentPanelId = 'brand' | 'header' | 'content' | 'footer' | 'page';

const SELECT_CLASS = 'h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white outline-none transition focus:border-emerald-400';
const INPUT_CLASS = 'h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white outline-none transition focus:border-emerald-400';

function CanvasDocumentControls({ settings, target, logo, onChange, onUploadLogo }: { settings: CanvasSettings; target: ReturnType<typeof getPdfTemplateTarget>; logo?: string | null; onChange: (changes: Partial<CanvasSettings>) => void; onUploadLogo?: (file: File) => void }) {
  const [activePanel, setActivePanel] = useState<DocumentPanelId>('header');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const update = <K extends keyof CanvasSettings>(key: K, value: CanvasSettings[K]) => onChange({ [key]: value } as Partial<CanvasSettings>);
  const color = settings.primaryColor || '#10b981';
  const visibleLogo = settings.logoUrl || logo;
  const panels: Array<{ id: DocumentPanelId; label: string; icon: typeof Building2 }> = [
    { id: 'brand', label: 'Marca', icon: Building2 },
    { id: 'header', label: 'Header', icon: PanelTop },
    { id: 'content', label: 'Contenido', icon: Table2 },
    { id: 'footer', label: 'Footer', icon: PanelBottom },
    { id: 'page', label: 'Estilo', icon: Palette },
  ];

  return <div className="border-b border-slate-800 bg-[#0d1726]" data-testid="pdf-canvas-document-controls">
    <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800 px-3 py-2">
      <div className="mr-1 flex shrink-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300"><Settings2 size={13} /> Documento</div>
      {panels.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={activePanel === id} onClick={() => setActivePanel(id)} className={cn('flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition', activePanel === id ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-200' : 'border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-white')}><Icon size={12} />{label}</button>)}
      <span className="ml-auto hidden shrink-0 text-[10px] text-slate-500 md:inline">{target.moduleLabel} · {target.label}</span>
    </div>
    <div className="max-h-[300px] overflow-y-auto px-3 py-3 sm:px-4">
      {activePanel === 'brand' && <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-2 md:w-52"><div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10"><LogoPreview src={visibleLogo} companyName={settings.companyName || target.moduleLabel} className="h-full w-full" /></div><div className="min-w-0"><p className="truncate text-[11px] font-semibold text-white">{visibleLogo ? 'Logo agregado' : 'Identificador de empresa'}</p><button type="button" className="mt-1 text-[10px] font-semibold text-emerald-300 hover:text-emerald-200" onClick={() => logoInputRef.current?.click()} disabled={!onUploadLogo}>Agregar o reemplazar</button><input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) onUploadLogo?.(file); event.currentTarget.value = ''; }} /></div></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><label className="space-y-1 text-[10px] text-slate-400">Empresa<input className={INPUT_CLASS} value={settings.companyName || ''} onChange={event => update('companyName', event.target.value)} placeholder="Nombre de la empresa" /></label><label className="space-y-1 text-[10px] text-slate-400">Eslogan<input className={INPUT_CLASS} value={settings.slogan || ''} onChange={event => update('slogan', event.target.value)} /></label><label className="space-y-1 text-[10px] text-slate-400">Teléfono<input className={INPUT_CLASS} value={settings.phone || ''} onChange={event => update('phone', event.target.value)} /></label><label className="space-y-1 text-[10px] text-slate-400">Correo<input className={INPUT_CLASS} value={settings.email || ''} onChange={event => update('email', event.target.value)} /></label><label className="space-y-1 text-[10px] text-slate-400 sm:col-span-2 lg:col-span-4">Dirección<input className={INPUT_CLASS} value={settings.address || ''} onChange={event => update('address', event.target.value)} /></label></div>
      </div>}
      {activePanel === 'header' && <div className="grid gap-3 md:grid-cols-4"><label className="space-y-1 text-[10px] text-slate-400 md:col-span-2">Patrón del encabezado<select className={SELECT_CLASS} value={settings.headerLayout || 'split'} onChange={event => onChange({ headerLayout: event.target.value })}><option value="classic">Clásico</option><option value="split">Empresa + documento</option><option value="banner">Banda corporativa</option><option value="compact">Compacto</option><option value="ribbon">Cinta lateral</option><option value="topline">Línea superior</option><option value="sidebar">Acento lateral</option><option value="centered">Centrado</option><option value="boxed">Recuadro</option><option value="corner">Acento de esquina</option><option value="editorial">Editorial</option><option value="double-band">Doble banda</option><optgroup label="Patrones creativos"><option value="fluid">Fluido orgánico</option><option value="aurora">Aurora</option><option value="diagonal">Diagonal</option><option value="portal">Portal</option><option value="steps">Escalonado</option><option value="ink">Tinta</option><option value="grid">Retícula</option><option value="ticket">Talón</option></optgroup></select></label><div className="space-y-1 text-[10px] text-slate-400">Posición del logo<div className="grid grid-cols-3 gap-1">{(['left', 'center', 'right'] as const).map(position => <button key={position} type="button" aria-pressed={settings.logoPosition === position} onClick={() => update('logoPosition', position)} className={cn('h-8 rounded-md border text-[10px] transition', settings.logoPosition === position ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200' : 'border-slate-700 text-slate-400 hover:border-slate-500')}>{position === 'left' ? 'Izq.' : position === 'center' ? 'Centro' : 'Der.'}</button>)}</div></div><label className="space-y-1 text-[10px] text-slate-400">Tamaño del logo <span className="text-slate-500">{settings.logoSize || 34}px</span><input type="range" min="18" max="70" value={settings.logoSize || 34} onChange={event => update('logoSize', Number(event.target.value))} className="mt-2 w-full accent-emerald-400" /></label><label className="flex items-center gap-2 self-end rounded-md border border-slate-700 px-2 py-2 text-[10px] text-slate-300"><input type="checkbox" checked={settings.showCompanyName !== false} onChange={event => update('showCompanyName', event.target.checked)} className="accent-emerald-400" />Mostrar empresa</label></div>}
      {activePanel === 'content' && <div className="grid gap-3 md:grid-cols-4"><label className="space-y-1 text-[10px] text-slate-400 md:col-span-2">Tabla<select className={SELECT_CLASS} value={settings.tableLayout || 'standard'} onChange={event => onChange({ tableLayout: event.target.value })}><option value="standard">Estándar</option><option value="striped">Filas alternas</option><option value="boxed">Recuadros</option><option value="minimal">Minimalista</option><option value="compact">Compacta</option><option value="accent">Acento en totales</option><option value="ledger">Libro contable</option><option value="cards">Tarjetas</option></select></label><label className="space-y-1 text-[10px] text-slate-400 md:col-span-2">Información bancaria<input className={INPUT_CLASS} value={settings.bankInfo || ''} onChange={event => update('bankInfo', event.target.value)} placeholder="Banco, cuenta y beneficiario" /></label><label className="flex items-center gap-2 rounded-md border border-slate-700 px-2 py-2 text-[10px] text-slate-300"><input type="checkbox" checked={Boolean(settings.showQr)} onChange={event => update('showQr', event.target.checked)} className="accent-emerald-400" />Código QR</label><label className="flex items-center gap-2 rounded-md border border-slate-700 px-2 py-2 text-[10px] text-slate-300"><input type="checkbox" checked={Boolean(settings.showBarcode)} onChange={event => update('showBarcode', event.target.checked)} className="accent-emerald-400" />Código de barras</label><label className="space-y-1 text-[10px] text-slate-400 md:col-span-2">Marca de agua<input className={INPUT_CLASS} value={settings.watermark || ''} onChange={event => update('watermark', event.target.value)} placeholder="BORRADOR" /></label></div>}
      {activePanel === 'footer' && <div className="grid gap-3 md:grid-cols-4"><label className="space-y-1 text-[10px] text-slate-400 md:col-span-2">Patrón del pie<select className={SELECT_CLASS} value={settings.footerLayout || 'line'} onChange={event => onChange({ footerLayout: event.target.value })}><option value="line">Línea sobria</option><option value="minimal">Minimalista</option><option value="band">Banda corporativa</option><option value="wave">Ola / doble banda</option><option value="boxed">Recuadro</option><option value="split">Pie dividido</option><option value="layers">Capas orgánicas</option><option value="notch">Muesca dentada</option><option value="dots">Puntos</option></select></label><label className="space-y-1 text-[10px] text-slate-400 md:col-span-2">Texto del pie<input className={INPUT_CLASS} value={settings.footerText || ''} onChange={event => update('footerText', event.target.value)} /></label><label className="flex items-center gap-2 rounded-md border border-slate-700 px-2 py-2 text-[10px] text-slate-300"><input type="checkbox" checked={settings.showPageNumber !== false} onChange={event => update('showPageNumber', event.target.checked)} className="accent-emerald-400" />Numeración</label><label className="space-y-1 text-[10px] text-slate-400">Formato<select className={SELECT_CLASS} value={settings.pageNumberFormat || 'page-of'} onChange={event => update('pageNumberFormat', event.target.value as CanvasSettings['pageNumberFormat'])}><option value="page-of">Página X de Y</option><option value="number-only">Solo número</option><option value="custom">Personalizado</option></select></label><label className="space-y-1 text-[10px] text-slate-400 md:col-span-2">Texto legal<input className={INPUT_CLASS} value={settings.legalText || ''} onChange={event => update('legalText', event.target.value)} placeholder="Condiciones legales" /></label><label className="space-y-1 text-[10px] text-slate-400 md:col-span-2">Términos<input className={INPUT_CLASS} value={settings.terms || ''} onChange={event => update('terms', event.target.value)} placeholder="Términos y condiciones" /></label></div>}
      {activePanel === 'page' && <div className="grid gap-3 md:grid-cols-6"><label className="space-y-1 text-[10px] text-slate-400">Papel<select className={SELECT_CLASS} value={settings.paperSize} onChange={event => update('paperSize', event.target.value)}><option value="LETTER">Carta</option><option value="A4">A4</option><option value="OFICIO">Oficio</option><option value="LEGAL">Legal</option><option value="LABEL">Etiqueta 70 × 38 mm</option></select></label><label className="space-y-1 text-[10px] text-slate-400">Orientación<select className={SELECT_CLASS} value={settings.orientation} onChange={event => update('orientation', event.target.value as CanvasSettings['orientation'])}><option value="portrait">Vertical</option><option value="landscape">Horizontal</option></select></label><label className="space-y-1 text-[10px] text-slate-400 md:col-span-2">Tipografía<select className={SELECT_CLASS} value={settings.fontFamily || 'helvetica'} onChange={event => update('fontFamily', event.target.value)}>{CANVAS_FONT_OPTIONS.map(font => <option key={font.value} value={font.value}>{font.label}</option>)}</select></label><label className="space-y-1 text-[10px] text-slate-400">Márgenes <span className="text-slate-500">{settings.margins || 14} mm</span><input type="range" min="2" max="28" value={settings.margins || 14} onChange={event => update('margins', Number(event.target.value))} className="mt-2 w-full accent-emerald-400" /></label><label className="flex items-center gap-2 self-end rounded-md border border-slate-700 px-2 py-2 text-[10px] text-slate-300"><input type="checkbox" checked={settings.paletteMode !== 'independent'} onChange={event => update('paletteMode', event.target.checked ? 'corporate' : 'independent')} className="accent-emerald-400" />Paleta corporativa</label><label className="space-y-1 text-[10px] text-slate-400">Principal<FastColorInput value={color} onChange={value => update('primaryColor', value)} className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1" /></label><label className="space-y-1 text-[10px] text-slate-400">Secundario<FastColorInput value={settings.secondaryColor || '#0f3b65'} onChange={value => update('secondaryColor', value)} className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1" /></label><label className="space-y-1 text-[10px] text-slate-400">Texto<FastColorInput value={settings.textColor || '#334155'} onChange={value => update('textColor', value)} className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1" /></label><label className="space-y-1 text-[10px] text-slate-400">Líneas<FastColorInput value={settings.lineColor || '#e2e8f0'} onChange={value => update('lineColor', value)} className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1" /></label><label className="space-y-1 text-[10px] text-slate-400 md:col-span-2">Fondo<FastColorInput value={settings.backgroundColor || '#ffffff'} onChange={value => update('backgroundColor', value)} className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1" /></label></div>}
    </div>
  </div>;
}

export function PdfTemplateCanvasEditor({ definition, settings, targetKey, data, onChange, onSettingsChange, onUploadLogo, onSave, logo }: PdfTemplateCanvasEditorProps) {
  const [selectedId, setSelectedId] = useState(definition.nodes.find(node => node.enabled !== false)?.id || null);
  const [zoom, setZoom] = useState(72);
  const [history, setHistory] = useState<PdfTemplateDefinition[]>([]);
  const [future, setFuture] = useState<PdfTemplateDefinition[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const target = getPdfTemplateTarget(targetKey);
  const sampleData = useMemo(() => {
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
      items: data?.items || data?.rows || data?.history || contextual.items || [],
    };
  }, [data, logo, targetKey]);
  const selectedNode = definition.nodes.find(node => node.id === selectedId) || null;
  const selected = selectedNode ? { ...selectedNode, borderStyle: selectedNode.borderStyle || defaultCanvasBorderStyle(selectedNode.type) } : null;
  const activeNodes = useMemo(() => definition.nodes.filter(node => node.enabled !== false && (node.page || 1) === 1), [definition.nodes]);

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

  const patchSettings = (patch: Partial<CanvasSettings>) => onSettingsChange?.(patch);
  const previewLogo = typeof sampleData.logo === 'string' ? sampleData.logo : typeof sampleData.company?.logo === 'string' ? sampleData.company.logo : logo;

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
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#101827] text-slate-100 shadow-2xl" data-testid="pdf-template-canvas-editor">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-[#0b1220] px-3 py-2">
        <div className="mr-2 flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300"><Move size={15} /></div>
          <div className="min-w-0"><p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Canvas de plantilla</p><p className="truncate text-[10px] text-slate-500">{target.label} · arrastra y redimensiona</p></div>
          <Badge className="hidden shrink-0 border-emerald-400/30 bg-emerald-400/10 text-[9px] text-emerald-200 sm:inline-flex">{settings.headerLayout || 'split'} · {settings.footerLayout || 'line'}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-1 border-l border-slate-800 pl-2">
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => addNode('field')}><Plus size={14} /> Campo</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => addNode('text')}><Type size={14} /> Texto</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => addNode('section')}><PanelTop size={14} /> Sección</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => addNode('table')}><Table2 size={14} /> Tabla</Button>
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
      <CanvasDocumentControls settings={settings} target={target} logo={logo} onChange={patchSettings} onUploadLogo={onUploadLogo} />
      <div className="grid min-h-[580px] grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_245px]">
        <div className="relative overflow-auto bg-[radial-gradient(#243247_1px,transparent_1px)] [background-size:16px_16px] p-7 sm:p-10" onKeyDown={handleKeyDown} tabIndex={0}>
          <div className="mx-auto transition-transform duration-200" style={{ width: `${zoom}%`, maxWidth: 850, minWidth: 340 }}>
            <div ref={canvasRef} className="relative w-full overflow-hidden rounded-sm bg-white shadow-[0_22px_70px_rgba(0,0,0,0.45)]" style={{ aspectRatio: pageAspect(settings), backgroundColor: settings.backgroundColor || definition.page.background || '#fff' }} onPointerDown={() => setSelectedId(null)}>
              {activeNodes.map(node => {
                const isSelected = selectedId === node.id;
                const isContainer = node.type === 'section' || node.type === 'spacer';
                return <div key={node.id} data-template-node={node.id} className={cn('group absolute overflow-visible border transition-shadow', node.type === 'divider' ? 'border-t-2 border-x-0 border-b-0' : 'border-transparent', isContainer ? 'z-0' : isSelected ? 'z-20 shadow-[0_0_0_2px_#34d399,0_8px_20px_rgba(16,185,129,0.20)]' : 'z-10 hover:shadow-[0_0_0_1px_#93c5fd]', isSelected && isContainer && 'shadow-[0_0_0_2px_#34d399]')} style={nodeStyle(node, settings)} onPointerDown={event => beginDrag(event, node, 'move')} onClick={event => { event.stopPropagation(); setSelectedId(node.id); }}>
                  {node.type === 'image' ? <LogoPreview src={previewLogo} companyName={String(sampleData.company?.name || settings.companyName || target.moduleLabel)} className="h-full w-full" /> : node.type === 'table' ? <div className="h-full overflow-hidden rounded-[inherit] border" style={{ borderColor: node.borderColor }}><div className="flex border-b px-2 py-1 font-bold uppercase tracking-wide" style={{ fontSize: canvasFontSize(Math.max(7, (Number(node.fontSize || settings.fontSize || 9) || 9) - 1.5)), backgroundColor: ['minimal', 'ledger'].includes(settings.tableLayout || '') ? '#ffffff' : settings.primaryColor || '#10b981', color: ['minimal', 'ledger'].includes(settings.tableLayout || '') ? settings.textColor || '#334155' : '#ffffff' }}>{(node.columns || []).map(column => <span key={column.id} style={{ width: `${column.width || 25}%`, textAlign: column.align || 'left' }}>{column.label}</span>)}</div>{(sampleData.items || sampleData.rows || [{ description: 'Fila de muestra', quantity: '1', unitPrice: 'C$ 0.00', total: 'C$ 0.00' }]).slice(0, 4).map((row, index) => <div key={index} className="flex border-b px-2 py-1 text-slate-600 last:border-0" style={{ fontSize: canvasFontSize(Math.max(7, (Number(node.fontSize || settings.fontSize || 9) || 9) - 1)), backgroundColor: index % 2 && ['standard', 'striped', 'accent'].includes(settings.tableLayout || '') ? '#f8fafc' : 'transparent' }}>{(node.columns || []).map(column => <span key={column.id} className="truncate" style={{ width: `${column.width || 25}%`, textAlign: column.align || 'left' }}>{String(row[column.token] ?? row[column.id] ?? '')}</span>)}</div>)}</div> : node.type === 'totals' ? <div className="space-y-1" style={{ fontSize: canvasFontSize(Math.max(8, (Number(node.fontSize || settings.fontSize || 9) || 9) - 0.5)) }}><p className="mb-1 font-bold uppercase tracking-wider opacity-60" style={{ fontSize: canvasFontSize(7) }}>Totales</p>{['subtotal', 'tax', 'discount', 'total'].map(key => <div key={key} className={cn('flex justify-between gap-2', key === 'total' && 'border-t pt-1 font-bold')}><span>{key === 'subtotal' ? 'Subtotal' : key === 'tax' ? 'Impuestos' : key === 'discount' ? 'Descuento' : 'Total'}</span><span>{resolveTemplateToken(`totals.${key}`, sampleData)}</span></div>)}</div> : node.type === 'field' && node.id.startsWith('party-') ? <span className="flex w-full flex-col justify-center gap-px whitespace-pre-line leading-tight"><small className="font-bold uppercase tracking-wide text-slate-400" style={{ fontSize: canvasFontSize(7) }}>{node.label}</small><span className="w-full text-current">{resolveTemplateToken(node.token, sampleData, getTemplateTokenSample(node.token))}</span></span> : <span className="block w-full truncate leading-tight">{node.type === 'section' && /^(header|footer)(-|$)/i.test(node.id) ? '' : nodeText(node, sampleData)}</span>}
                  {isSelected && <><button type="button" aria-label="Girar elemento" title="Arrastra para girar" className="absolute left-1/2 -top-9 flex h-7 w-7 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-[#101827] bg-emerald-400 text-[#101827] shadow-lg active:cursor-grabbing" onPointerDown={event => beginRotate(event, node)}><RotateCw size={13} /></button><span className="pointer-events-none absolute left-1/2 -top-5 h-5 w-px -translate-x-1/2 bg-emerald-400" /><span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full border-2 border-[#101827] bg-emerald-400" /><span className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full border-2 border-[#101827] bg-emerald-400" /><span className="absolute -bottom-1.5 -left-1.5 h-3 w-3 rounded-full border-2 border-[#101827] bg-emerald-400" /><button type="button" aria-label="Redimensionar elemento" className="absolute -bottom-2 -right-2 flex h-4 w-4 cursor-nwse-resize items-center justify-center rounded-full border-2 border-[#101827] bg-emerald-400 text-[#101827]" onPointerDown={event => beginDrag(event, node, 'resize')}><GripVertical size={8} /></button></>}
                </div>;
              })}
              {!activeNodes.length && <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Agrega un elemento desde la barra de herramientas</div>}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-500"><Square size={11} /> Papel {settings.paperSize} · {settings.orientation === 'portrait' ? 'Vertical' : 'Horizontal'} · Usa las flechas para precisión</div>
        </div>
        <aside className="border-t border-slate-800 bg-[#0d1726] p-4 xl:border-l xl:border-t-0">
          {selected ? <div className="space-y-4" key={selected.id}>
            <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">Elemento seleccionado</p><p className="mt-1 text-sm font-semibold text-white">{selected.label}</p></div><Badge className="border-slate-700 bg-slate-800 text-[10px] text-slate-300">{selected.type}</Badge></div>
            <div className="grid grid-cols-2 gap-2"><div><Label className="text-[10px] text-slate-400">X</Label><Input type="number" value={selected.x} onChange={event => selectedPatch({ x: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div><div><Label className="text-[10px] text-slate-400">Y</Label><Input type="number" value={selected.y} onChange={event => selectedPatch({ y: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div><div><Label className="text-[10px] text-slate-400">Ancho</Label><Input type="number" value={selected.width} onChange={event => selectedPatch({ width: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div><div><Label className="text-[10px] text-slate-400">Alto</Label><Input type="number" value={selected.height} onChange={event => selectedPatch({ height: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div></div>
            {selected.type === 'field' && <div><Label className="text-[10px] text-slate-400">Campo de datos</Label><select value={selected.token || ''} onChange={event => selectedPatch({ token: event.target.value, label: TEMPLATE_TOKENS.find(item => item.token === event.target.value)?.label || selected.label })} className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white"><option value="">Selecciona un campo</option>{TEMPLATE_TOKENS.map(item => <option key={item.token} value={item.token}>{item.label}</option>)}</select><p className="mt-1 text-[10px] text-slate-500">Vista previa: {getTemplateTokenSample(selected.token)}</p></div>}
            {(selected.type === 'text' || selected.type === 'section') && <div><Label className="text-[10px] text-slate-400">Contenido</Label><Input value={selected.text || ''} onChange={event => selectedPatch({ text: event.target.value })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div>}
            <div><Label className="text-[10px] text-slate-400">Tipografía del componente</Label><select value={selected.fontFamily || settings.fontFamily || 'Arial'} onChange={event => selectedPatch({ fontFamily: event.target.value })} className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">{CANVAS_FONT_OPTIONS.map(font => <option key={font.value} value={font.value}>{font.label}</option>)}</select></div>
            <div className="grid grid-cols-3 gap-2"><div><Label className="text-[10px] text-slate-400">Tamaño</Label><Input type="number" min={5} max={72} value={selected.fontSize || 9} onChange={event => selectedPatch({ fontSize: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div><div><Label className="text-[10px] text-slate-400">Peso</Label><select value={selected.fontWeight || (selected.bold ? 700 : 400)} onChange={event => selectedPatch({ fontWeight: Number(event.target.value) as PdfTemplateNode['fontWeight'], bold: Number(event.target.value) >= 700 })} className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-1 text-xs text-white"><option value="400">Normal</option><option value="500">Medio</option><option value="600">Semibold</option><option value="700">Negrita</option><option value="800">Fuerte</option></select></div><div><Label className="text-[10px] text-slate-400">Radio</Label><Input type="number" min={0} max={999} value={selected.borderRadius || 0} onChange={event => selectedPatch({ borderRadius: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div></div><div className="grid grid-cols-2 gap-2"><div><Label className="text-[10px] text-slate-400">Forma del componente</Label><select value={selected.shape || 'rectangle'} onChange={event => selectedPatch({ shape: event.target.value as PdfTemplateNode['shape'] })} className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white"><option value="rectangle">Rectangular</option><option value="pill">Píldora</option><option value="wave">Ola superior</option><option value="wave-bottom">Ola inferior</option><option value="circle">Circular</option><option value="angled">Angular</option><option value="blob">Orgánica</option><option value="arc">Arco</option></select></div><div><Label className="text-[10px] text-slate-400">Tipo de borde</Label><select value={selected.borderStyle || 'solid'} onChange={event => selectedPatch({ borderStyle: event.target.value as PdfTemplateNode['borderStyle'] })} className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white"><option value="solid">Continuo</option><option value="dashed">Segmentado</option><option value="dotted">Punteado</option><option value="double">Doble</option><option value="none">Sin borde</option></select></div></div><div className="grid grid-cols-2 gap-2"><div><Label className="text-[10px] text-slate-400">Giro</Label><Input type="number" min={-180} max={180} value={selected.rotation || 0} onChange={event => selectedPatch({ rotation: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div><div><Label className="text-[10px] text-slate-400">Opacidad <span className="text-slate-500">{Math.round((selected.opacity ?? 1) * 100)}%</span></Label><input type="range" min="0" max="100" value={Math.round((selected.opacity ?? 1) * 100)} onChange={event => selectedPatch({ opacity: Number(event.target.value) / 100 })} className="mt-3 w-full accent-emerald-400" /></div></div>
            <div className="flex flex-wrap items-center gap-1"><Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-slate-400', selected.align === 'left' && 'bg-slate-700 text-white')} aria-label="Alinear a la izquierda" onClick={() => selectedPatch({ align: 'left' })}><AlignLeft size={14} /></Button><Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-slate-400', selected.align === 'center' && 'bg-slate-700 text-white')} aria-label="Centrar" onClick={() => selectedPatch({ align: 'center' })}><AlignCenter size={14} /></Button><Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-slate-400', selected.align === 'right' && 'bg-slate-700 text-white')} aria-label="Alinear a la derecha" onClick={() => selectedPatch({ align: 'right' })}><AlignRight size={14} /></Button><Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-slate-400', selected.bold && 'bg-slate-700 text-white')} aria-label="Negrita" onClick={() => selectedPatch({ bold: !selected.bold, fontWeight: selected.bold ? 400 : 700 })}><strong>B</strong></Button><Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-slate-400', selected.italic && 'bg-slate-700 text-white')} aria-label="Cursiva" onClick={() => selectedPatch({ italic: !selected.italic })}><Italic size={14} /></Button><Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-slate-400', selected.underline && 'bg-slate-700 text-white')} aria-label="Subrayado" onClick={() => selectedPatch({ underline: !selected.underline })}><Underline size={14} /></Button><Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-slate-400', selected.strikethrough && 'bg-slate-700 text-white')} aria-label="Tachado" onClick={() => selectedPatch({ strikethrough: !selected.strikethrough })}><Strikethrough size={14} /></Button></div>
            <div className="grid grid-cols-2 gap-2"><div><Label className="text-[10px] text-slate-400">Interlineado</Label><Input type="number" min={0.8} max={3} step={0.05} value={selected.lineHeight || 1.25} onChange={event => selectedPatch({ lineHeight: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div><div><Label className="text-[10px] text-slate-400">Espaciado</Label><Input type="number" min={-2} max={10} step={0.25} value={selected.letterSpacing || 0} onChange={event => selectedPatch({ letterSpacing: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div></div>
            <div><Label className="text-[10px] text-slate-400">Transformación</Label><select value={selected.textTransform || 'none'} onChange={event => selectedPatch({ textTransform: event.target.value as PdfTemplateNode['textTransform'] })} className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white"><option value="none">Normal</option><option value="uppercase">MAYÚSCULAS</option><option value="lowercase">minúsculas</option><option value="capitalize">Capitalizar</option></select></div>
            <div className="grid grid-cols-3 gap-2"><div><Label className="text-[10px] text-slate-400">Color</Label><FastColorInput value={selected.color || '#334155'} onChange={value => selectedPatch({ color: value })} className="mt-1 h-8 w-full cursor-pointer border-slate-700 bg-slate-900 p-1" /></div><div><Label className="text-[10px] text-slate-400">Fondo</Label><FastColorInput value={selected.backgroundColor && selected.backgroundColor !== 'transparent' ? selected.backgroundColor : '#ffffff'} onChange={value => selectedPatch({ backgroundColor: value })} className="mt-1 h-8 w-full cursor-pointer border-slate-700 bg-slate-900 p-1" /></div><div><Label className="text-[10px] text-slate-400">Borde</Label><FastColorInput value={selected.borderColor || '#e2e8f0'} onChange={value => selectedPatch({ borderColor: value })} className="mt-1 h-8 w-full cursor-pointer border-slate-700 bg-slate-900 p-1" /></div></div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div className="flex items-center justify-between gap-2"><div><Label className="text-[10px] uppercase tracking-[0.12em] text-emerald-300">Giro en eje Z</Label><p className="mt-1 text-[10px] text-slate-500">Rota el componente sobre su centro</p></div><span className="rounded-md bg-emerald-400/10 px-2 py-1 font-mono text-xs font-bold text-emerald-200">{Math.round(selected.rotation || 0)}°</span></div><div className="mt-3 flex items-center justify-between gap-1"><Button type="button" variant="ghost" size="icon" title="Girar -90 grados" aria-label="Girar -90 grados" className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => rotateSelectedBy(-90)}><RotateCcw size={14} /></Button><Button type="button" variant="ghost" size="sm" title="Girar -15 grados" className="h-8 px-2 text-[10px] text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => rotateSelectedBy(-15)}>-15°</Button><Button type="button" variant="ghost" size="sm" title="Restablecer giro" className="h-8 px-2 text-[10px] text-emerald-200 hover:bg-emerald-400/10 hover:text-emerald-100" onClick={() => selectedPatch({ rotation: 0 })}>0°</Button><Button type="button" variant="ghost" size="sm" title="Girar +15 grados" className="h-8 px-2 text-[10px] text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => rotateSelectedBy(15)}>+15°</Button><Button type="button" variant="ghost" size="icon" title="Girar +90 grados" aria-label="Girar +90 grados" className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => rotateSelectedBy(90)}><RotateCw size={14} /></Button></div><input aria-label="Giro en eje Z" type="range" min="-180" max="180" value={selected.rotation || 0} onPointerDown={beginContinuousPatch} onChange={event => previewSelectedPatch({ rotation: Number(event.target.value) })} className="mt-3 w-full cursor-ew-resize accent-emerald-400" /><div className="mt-1 flex justify-between font-mono text-[9px] text-slate-600"><span>-180°</span><span>0°</span><span>180°</span></div><p className="mt-2 text-[10px] text-slate-500">También puedes usar [ y ] para girar 5°; con Shift, 15°.</p></div>
            <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-3"><Button type="button" variant="outline" size="sm" className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white" onClick={duplicateSelected}><Copy size={13} /> Duplicar</Button><Button type="button" variant="outline" size="sm" className="border-rose-900/60 bg-transparent text-rose-300 hover:bg-rose-950/60 hover:text-rose-200" onClick={removeSelected}><Trash2 size={13} /> Eliminar</Button></div>
          </div> : <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-center"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-slate-500"><GripVertical size={20} /></div><p className="text-sm font-medium text-slate-300">Selecciona un elemento</p><p className="mt-1 max-w-[180px] text-[11px] leading-relaxed text-slate-500">Cada bloque es independiente. Puedes moverlo, cambiar su tamaño y conectar campos reales.</p></div>}
          <div className="mt-5 border-t border-slate-800 pt-4"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">Capas y componentes</p><span className="text-[10px] text-slate-500">{activeNodes.length}</span></div><div className="max-h-44 space-y-1 overflow-y-auto pr-1">{[...activeNodes].reverse().map(node => <button key={node.id} type="button" onClick={() => setSelectedId(node.id)} className={cn('flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition', selectedId === node.id ? 'border-emerald-400/70 bg-emerald-400/10 text-emerald-200' : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200')}><span className="min-w-0 truncate">{node.label}</span><Badge className="shrink-0 border-slate-700 bg-slate-900 px-1.5 text-[9px] text-slate-500">{node.type}</Badge></button>)}</div></div>
        </aside>
      </div>
    </div>
  );
}
