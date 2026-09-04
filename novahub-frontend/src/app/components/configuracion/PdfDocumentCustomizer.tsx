import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, Barcode, ChevronDown, ChevronLeft,
  ChevronRight, FileCog, FileText, Folder, FolderPlus, ImagePlus, LayoutTemplate, Loader2, Maximize2, Palette, PanelBottom, PanelTop, Pencil, Plus, QrCode, Save, Trash2, Upload, WandSparkles, ZoomIn, ZoomOut
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { cn } from '../ui/utils';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { FastColorInput } from '../ui/FastColorInput';
import { toast } from 'sonner';
import { storageService } from '../../services/storage.service';
import { pdfDocumentDesignService, type PdfDocumentDesignFolder, type PdfDocumentDesignRecord, type PdfDocumentType } from '../../services/pdf-document-design.service';
import { getPdfTemplateTarget, normalizePdfTemplateKey, PDF_TEMPLATE_MODULES, PDF_TEMPLATE_TARGETS, type PdfTemplateTarget } from '../../services/pdf-document-catalog';
import { createDefaultTemplateDefinition, createSystemDefaultPdfSettings, definitionFromExtractedPdf, sanitizeTemplateDefinition, type PdfTemplateDefinition, type PdfTemplateNode } from '../../services/pdf-template-definition';
import { importDocxTemplate, importHtmlTemplate } from '../../services/pdf-template-importer';
import { PdfTemplateCanvasEditor } from './PdfTemplateCanvasEditor';

const DOCUMENTS = PDF_TEMPLATE_TARGETS;

type PdfSettings = {
  paperSize: 'LETTER' | 'A4' | 'OFICIO' | 'LEGAL' | 'LABEL'; orientation: 'portrait' | 'landscape';
  headerLayout: 'classic' | 'split' | 'banner' | 'compact' | 'ribbon' | 'topline' | 'sidebar' | 'centered' | 'boxed' | 'corner' | 'editorial' | 'double-band' | 'fluid' | 'aurora' | 'diagonal' | 'portal' | 'steps' | 'ink' | 'grid' | 'ticket';
  footerLayout: 'line' | 'minimal' | 'band' | 'wave' | 'boxed' | 'split' | 'layers' | 'notch' | 'dots';
  tableLayout: 'standard' | 'striped' | 'boxed' | 'minimal' | 'compact' | 'accent' | 'ledger' | 'cards';
  logoPosition: 'left' | 'center' | 'right'; logoSize: number; logoUrl?: string; showCompanyName: boolean; companyName: string;
  slogan: string; fiscalInfo: string; address: string; phone: string; email: string; website: string; bankInfo: string;
  showQr: boolean; showBarcode: boolean; watermark: string; watermarkOpacity: number; footerText: string;
  showPageNumber: boolean; pageNumberFormat: 'page-of' | 'number-only' | 'custom'; pageNumberCustom: string;
  legalText: string; terms: string; defaultNotes: string; margins: number; fontFamily: string;
  fontSize: number; primaryColor: string; secondaryColor: string; textColor: string; lineColor: string; backgroundColor: string; separator: 'solid' | 'dashed' | 'none';
  paletteMode: 'corporate' | 'independent';
};

const DEFAULT_SETTINGS: PdfSettings = createSystemDefaultPdfSettings() as PdfSettings;

function getPdfPreviewAspectRatio(settings: Pick<PdfSettings, 'paperSize' | 'orientation'>) {
  const dimensions = settings.paperSize === 'A4'
    ? { width: 210, height: 297 }
    : settings.paperSize === 'OFICIO'
      ? { width: 216, height: 330 }
      : settings.paperSize === 'LEGAL'
        ? { width: 216, height: 356 }
        : settings.paperSize === 'LABEL'
          ? { width: 70, height: 38 }
          : { width: 216, height: 279 };
  return settings.orientation === 'landscape'
    ? `${dimensions.height} / ${dimensions.width}`
    : `${dimensions.width} / ${dimensions.height}`;
}

function updateDefinitionForSettings(definition: PdfTemplateDefinition, previous: PdfSettings, next: PdfSettings) {
  const colorPairs = [
    [previous.primaryColor, next.primaryColor],
    [previous.secondaryColor, next.secondaryColor],
    [previous.textColor, next.textColor],
    [previous.lineColor, next.lineColor],
  ].filter(([from, to]) => from && to && from.toLowerCase() !== to.toLowerCase()) as Array<[string, string]>;
  const recolor = (value?: string) => {
    if (!value) return value;
    return colorPairs.find(([from]) => from.toLowerCase() === value.toLowerCase())?.[1] || value;
  };
  return {
    ...definition,
    page: {
      ...definition.page,
      paperSize: next.paperSize,
      orientation: next.orientation,
      background: next.backgroundColor || definition.page.background,
    },
    nodes: definition.nodes.map(node => ({
      ...node,
      backgroundColor: recolor(node.backgroundColor),
      borderColor: recolor(node.borderColor),
      color: recolor(node.color),
    })),
  };
}

function ensureLogoNode(definition: PdfTemplateDefinition) {
  const hasLogoNode = definition.nodes.some(node => node.id === 'company-logo');
  if (hasLogoNode) return { ...definition, nodes: definition.nodes.map(node => node.id === 'company-logo' ? { ...node, enabled: true } : node) };
  const logoNode: PdfTemplateNode = { id: 'company-logo', type: 'image', label: 'Logotipo', x: 8, y: 7, width: 16, height: 8, enabled: true, borderStyle: 'none', backgroundColor: 'transparent' };
  return { ...definition, nodes: [logoNode, ...definition.nodes] };
}

const TEMPLATE_LIBRARY = [
  { key: 'classic', name: 'Clásico', description: 'Jerarquía tradicional y sobria', color: '#0f766e', settings: { headerLayout: 'classic', tableLayout: 'standard', separator: 'solid', primaryColor: '#0f766e', secondaryColor: '#115e59', textColor: '#334155', lineColor: '#cbd5e1', paletteMode: 'independent' } },
  { key: 'modern', name: 'Moderno', description: 'Banda sólida y alto contraste', color: '#2563eb', settings: { headerLayout: 'banner', tableLayout: 'striped', separator: 'none', primaryColor: '#2563eb', secondaryColor: '#1e40af', textColor: '#172554', lineColor: '#bfdbfe', paletteMode: 'independent' } },
  { key: 'minimal', name: 'Minimalista', description: 'Mucho aire, máxima legibilidad', color: '#64748b', settings: { headerLayout: 'compact', tableLayout: 'minimal', separator: 'none', primaryColor: '#64748b', secondaryColor: '#94a3b8', textColor: '#475569', lineColor: '#e2e8f0', paletteMode: 'independent' } },
  { key: 'corporate', name: 'Corporativo', description: 'Ordenado para procesos empresariales', color: '#7c3aed', settings: { headerLayout: 'split', tableLayout: 'boxed', separator: 'solid', primaryColor: '#7c3aed', secondaryColor: '#4c1d95', textColor: '#312e81', lineColor: '#ddd6fe', paletteMode: 'independent' } },
  { key: 'elegant', name: 'Elegante', description: 'Detalle editorial y refinado', color: '#be7b35', settings: { headerLayout: 'editorial', tableLayout: 'minimal', separator: 'dashed', primaryColor: '#be7b35', secondaryColor: '#7c2d12', textColor: '#4b3621', lineColor: '#ead7bd', paletteMode: 'independent' } },
  { key: 'industrial', name: 'Industrial', description: 'Fuerte, directo y operativo', color: '#475569', settings: { headerLayout: 'ribbon', tableLayout: 'ledger', separator: 'solid', primaryColor: '#475569', secondaryColor: '#1e293b', textColor: '#1e293b', lineColor: '#94a3b8', paletteMode: 'independent' } },
  { key: 'ocean', name: 'Oceánico', description: 'Franja azul con datos equilibrados', color: '#0369a1', settings: { headerLayout: 'double-band', tableLayout: 'striped', primaryColor: '#0369a1', secondaryColor: '#0c4a6e', textColor: '#0c4a6e', lineColor: '#bae6fd', paletteMode: 'independent' } },
  { key: 'forest', name: 'Bosque', description: 'Verde profundo y tabla natural', color: '#166534', settings: { headerLayout: 'topline', tableLayout: 'accent', primaryColor: '#166534', secondaryColor: '#14532d', textColor: '#14532d', lineColor: '#bbf7d0', paletteMode: 'independent' } },
  { key: 'sunset', name: 'Atardecer', description: 'Naranja cálido y bloques suaves', color: '#ea580c', settings: { headerLayout: 'corner', tableLayout: 'cards', primaryColor: '#ea580c', secondaryColor: '#9a3412', textColor: '#431407', lineColor: '#fed7aa', paletteMode: 'independent' } },
  { key: 'lavender', name: 'Lavanda', description: 'Suave, creativo y contemporáneo', color: '#9333ea', settings: { headerLayout: 'centered', tableLayout: 'minimal', primaryColor: '#9333ea', secondaryColor: '#7e22ce', textColor: '#581c87', lineColor: '#e9d5ff', paletteMode: 'independent' } },
  { key: 'graphite', name: 'Grafito', description: 'Monocromo con acentos precisos', color: '#374151', settings: { headerLayout: 'boxed', tableLayout: 'boxed', primaryColor: '#374151', secondaryColor: '#111827', textColor: '#111827', lineColor: '#d1d5db', paletteMode: 'independent' } },
  { key: 'aqua', name: 'Aqua', description: 'Ligero, fresco y tecnológico', color: '#0891b2', settings: { headerLayout: 'sidebar', tableLayout: 'striped', primaryColor: '#0891b2', secondaryColor: '#155e75', textColor: '#164e63', lineColor: '#a5f3fc', paletteMode: 'independent' } },
  { key: 'wine', name: 'Vino', description: 'Serio, elegante y con carácter', color: '#9f1239', settings: { headerLayout: 'banner', tableLayout: 'compact', primaryColor: '#9f1239', secondaryColor: '#881337', textColor: '#4c0519', lineColor: '#fecdd3', paletteMode: 'independent' } },
  { key: 'slate', name: 'Pizarra', description: 'Equilibrio visual para operaciones', color: '#334155', settings: { headerLayout: 'topline', tableLayout: 'ledger', primaryColor: '#334155', secondaryColor: '#0f172a', textColor: '#1e293b', lineColor: '#cbd5e1', paletteMode: 'independent' } },
  { key: 'paper', name: 'Papel', description: 'Editorial, claro y muy limpio', color: '#78716c', settings: { headerLayout: 'editorial', tableLayout: 'minimal', primaryColor: '#78716c', secondaryColor: '#57534e', textColor: '#44403c', lineColor: '#d6d3d1', paletteMode: 'independent' } },
  { key: 'neon', name: 'Neón', description: 'Acentos vivos para documentos digitales', color: '#16a34a', settings: { headerLayout: 'sidebar', tableLayout: 'accent', primaryColor: '#16a34a', secondaryColor: '#166534', textColor: '#14532d', lineColor: '#bbf7d0', paletteMode: 'independent' } },
  { key: 'horizon', name: 'Horizonte', description: 'Cabecera amplia y datos alineados', color: '#1d4ed8', settings: { headerLayout: 'double-band', tableLayout: 'boxed', primaryColor: '#1d4ed8', secondaryColor: '#1e40af', textColor: '#1e3a8a', lineColor: '#bfdbfe', paletteMode: 'independent' } },
  { key: 'fluid', name: 'Fluido', description: 'Ondas orgánicas superpuestas y ligeras', color: '#0d9488', settings: { headerLayout: 'fluid', tableLayout: 'cards', primaryColor: '#0d9488', secondaryColor: '#115e59', textColor: '#134e4a', lineColor: '#99f6e4', paletteMode: 'independent' } },
  { key: 'frames', name: 'Recuadros', description: 'Módulos delimitados para cada sección', color: '#b45309', settings: { headerLayout: 'boxed', tableLayout: 'cards', primaryColor: '#b45309', secondaryColor: '#78350f', textColor: '#451a03', lineColor: '#fde68a', paletteMode: 'independent' } },
  { key: 'wave', name: 'Ola', description: 'Banda dinámica y tabla destacada', color: '#4f46e5', settings: { headerLayout: 'corner', tableLayout: 'accent', primaryColor: '#4f46e5', secondaryColor: '#312e81', textColor: '#312e81', lineColor: '#c7d2fe', paletteMode: 'independent' } },
  { key: 'aurora', name: 'Aurora', description: 'Capas luminosas con profundidad', color: '#7c3aed', settings: { headerLayout: 'aurora', tableLayout: 'striped', primaryColor: '#7c3aed', secondaryColor: '#4f46e5', textColor: '#312e81', lineColor: '#ddd6fe', paletteMode: 'independent' } },
  { key: 'diagonal', name: 'Diagonal', description: 'Planos inclinados y contraste editorial', color: '#2563eb', settings: { headerLayout: 'diagonal', tableLayout: 'boxed', primaryColor: '#2563eb', secondaryColor: '#1e3a8a', textColor: '#172554', lineColor: '#bfdbfe', paletteMode: 'independent' } },
  { key: 'portal', name: 'Portal', description: 'Marca circular y marco abierto', color: '#0f766e', settings: { headerLayout: 'portal', tableLayout: 'minimal', primaryColor: '#0f766e', secondaryColor: '#115e59', textColor: '#134e4a', lineColor: '#99f6e4', paletteMode: 'independent' } },
  { key: 'steps', name: 'Escalonado', description: 'Ritmo progresivo para datos operativos', color: '#d97706', settings: { headerLayout: 'steps', tableLayout: 'ledger', primaryColor: '#d97706', secondaryColor: '#b45309', textColor: '#78350f', lineColor: '#fed7aa', paletteMode: 'independent' } },
  { key: 'ink', name: 'Tinta', description: 'Manchas asimétricas con carácter', color: '#111827', settings: { headerLayout: 'ink', tableLayout: 'accent', primaryColor: '#111827', secondaryColor: '#374151', textColor: '#1f2937', lineColor: '#d1d5db', paletteMode: 'independent' } },
  { key: 'grid', name: 'Retícula', description: 'Geometría modular y precisión', color: '#0369a1', settings: { headerLayout: 'grid', tableLayout: 'boxed', primaryColor: '#0369a1', secondaryColor: '#075985', textColor: '#0c4a6e', lineColor: '#bae6fd', paletteMode: 'independent' } },
  { key: 'ticket', name: 'Talón', description: 'Corte dentado para comprobantes', color: '#be123c', settings: { headerLayout: 'ticket', tableLayout: 'compact', primaryColor: '#be123c', secondaryColor: '#9f1239', textColor: '#4c0519', lineColor: '#fecdd3', paletteMode: 'independent' } },
] as const;

const DEFAULT_LIBRARY_TEMPLATE_KEY = 'classic';

function getDefaultLibraryTemplate() {
  return TEMPLATE_LIBRARY.find(template => template.key === DEFAULT_LIBRARY_TEMPLATE_KEY) || TEMPLATE_LIBRARY[0];
}

const FONT_OPTIONS = [
  { value: 'helvetica', label: 'Helvetica', group: 'Sans serif' },
  { value: 'Arial', label: 'Arial', group: 'Sans serif' },
  { value: 'Arial Narrow', label: 'Arial Narrow', group: 'Sans serif' },
  { value: 'Calibri', label: 'Calibri', group: 'Sans serif' },
  { value: 'Candara', label: 'Candara', group: 'Sans serif' },
  { value: 'Century Gothic', label: 'Century Gothic', group: 'Sans serif' },
  { value: 'Futura', label: 'Futura', group: 'Sans serif' },
  { value: 'Gill Sans', label: 'Gill Sans', group: 'Sans serif' },
  { value: 'Lucida Sans', label: 'Lucida Sans', group: 'Sans serif' },
  { value: 'Segoe UI', label: 'Segoe UI', group: 'Sans serif' },
  { value: 'Tahoma', label: 'Tahoma', group: 'Sans serif' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS', group: 'Sans serif' },
  { value: 'Verdana', label: 'Verdana', group: 'Sans serif' },
  { value: 'times', label: 'Times New Roman', group: 'Serif' },
  { value: 'Georgia', label: 'Georgia', group: 'Serif' },
  { value: 'Garamond', label: 'Garamond', group: 'Serif' },
  { value: 'Cambria', label: 'Cambria', group: 'Serif' },
  { value: 'Palatino Linotype', label: 'Palatino Linotype', group: 'Serif' },
  { value: 'Bookman', label: 'Bookman', group: 'Serif' },
  { value: 'courier', label: 'Courier New', group: 'Monoespaciada' },
  { value: 'Consolas', label: 'Consolas', group: 'Monoespaciada' },
  { value: 'Monaco', label: 'Monaco', group: 'Monoespaciada' },
  { value: 'Impact', label: 'Impact', group: 'Display' },
];

const TEMPLATE_FOOTER_LAYOUTS: Record<string, PdfSettings['footerLayout']> = {
  classic: 'line', modern: 'band', minimal: 'minimal', corporate: 'boxed', elegant: 'minimal', industrial: 'split', ocean: 'wave', forest: 'line', sunset: 'wave', lavender: 'minimal', graphite: 'boxed', aqua: 'split', wine: 'band', slate: 'line', paper: 'minimal', neon: 'band', horizon: 'wave', fluid: 'layers', frames: 'boxed', wave: 'wave', aurora: 'layers', diagonal: 'notch', portal: 'dots', steps: 'notch', ink: 'dots', grid: 'dots', ticket: 'notch',
};

function footerLayoutForTemplate(key: string): PdfSettings['footerLayout'] {
  return TEMPLATE_FOOTER_LAYOUTS[key] || 'line';
}

type PdfTemplateField = {
  id: string;
  label: string;
  token: string;
  sample: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
  enabled: boolean;
};

function createTemplateFields(companyName: string): PdfTemplateField[] {
  return [
    { id: 'company', label: 'Nombre de empresa', token: '{{empresa.nombre}}', sample: companyName || 'Mi Empresa', x: 8, y: 8, width: 38, height: 8, page: 1, enabled: true },
    { id: 'slogan', label: 'Eslogan', token: '{{empresa.eslogan}}', sample: 'Soluciones simples para crecer', x: 8, y: 17, width: 42, height: 5, page: 1, enabled: true },
    { id: 'fiscal', label: 'Información fiscal', token: '{{empresa.fiscal}}', sample: 'RUC / Identificación fiscal', x: 8, y: 22, width: 42, height: 5, page: 1, enabled: true },
    { id: 'documentTitle', label: 'Título del documento', token: '{{documento.titulo}}', sample: 'COTIZACIÓN', x: 68, y: 8, width: 25, height: 7, page: 1, enabled: true },
    { id: 'documentNumber', label: 'Número', token: '{{documento.numero}}', sample: 'COT-0001', x: 72, y: 14, width: 20, height: 6, page: 1, enabled: true },
    { id: 'date', label: 'Fecha', token: '{{documento.fecha}}', sample: '31/07/2026', x: 72, y: 20, width: 20, height: 6, page: 1, enabled: true },
    { id: 'customer', label: 'Cliente', token: '{{cliente.nombre}}', sample: 'Cliente de ejemplo', x: 8, y: 29, width: 42, height: 8, page: 1, enabled: true },
    { id: 'address', label: 'Dirección', token: '{{empresa.direccion}}', sample: 'Dirección fiscal de la empresa', x: 55, y: 29, width: 38, height: 5, page: 1, enabled: true },
    { id: 'phone', label: 'Teléfono', token: '{{empresa.telefono}}', sample: '+505 0000-0000', x: 55, y: 34, width: 38, height: 5, page: 1, enabled: true },
    { id: 'email', label: 'Correo', token: '{{empresa.correo}}', sample: 'contacto@empresa.com', x: 55, y: 39, width: 38, height: 5, page: 1, enabled: true },
    { id: 'items', label: 'Tabla de productos', token: '{{documento.items}}', sample: 'Descripción · Cant. · Precio · Total', x: 8, y: 46, width: 84, height: 15, page: 1, enabled: true },
    { id: 'totals', label: 'Totales', token: '{{documento.totales}}', sample: 'Subtotal · Impuesto · TOTAL', x: 58, y: 74, width: 34, height: 10, page: 1, enabled: true },
    { id: 'legal', label: 'Textos legales', token: '{{documento.legal}}', sample: 'Texto legal del documento', x: 8, y: 85, width: 84, height: 5, page: 1, enabled: false },
    { id: 'terms', label: 'Términos y condiciones', token: '{{documento.terminos}}', sample: 'Términos y condiciones', x: 8, y: 89, width: 84, height: 5, page: 1, enabled: false },
    { id: 'notes', label: 'Observaciones', token: '{{documento.observaciones}}', sample: 'Observaciones predeterminadas', x: 8, y: 93, width: 84, height: 5, page: 1, enabled: false },
    { id: 'footer', label: 'Pie de página', token: '{{documento.footer}}', sample: 'Gracias por confiar en nosotros.', x: 8, y: 97, width: 62, height: 3, page: 1, enabled: true },
  ];
}

function normalizeTemplateFields(stored: any, companyName: string) {
  const defaults = createTemplateFields(companyName);
  if (!Array.isArray(stored)) return defaults;
  const storedById = new Map(stored.map(field => [field.id, field]));
  return defaults.map(defaultField => ({ ...defaultField, ...(storedById.get(defaultField.id) || {}), height: storedById.get(defaultField.id)?.height || defaultField.height, page: storedById.get(defaultField.id)?.page || defaultField.page }));
}

const TEMPLATE_FIELD_SETTINGS: Partial<Record<string, keyof PdfSettings>> = {
  company: 'companyName', slogan: 'slogan', fiscal: 'fiscalInfo', address: 'address',
  phone: 'phone', email: 'email', legal: 'legalText', terms: 'terms', notes: 'defaultNotes', footer: 'footerText',
};

async function extractPdfLayout(file: File) {
  const loadingTask = pdfjsLib.getDocument({ data: await file.arrayBuffer() });
  const pdf = await loadingTask.promise;
  const pages: any[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const textItems = (content.items as any[]).filter(item => typeof item.str === 'string' && item.str.trim()).slice(0, 800).map(item => ({
        text: item.str.trim(),
        x: Number(item.transform?.[4] || 0),
        y: Number(viewport.height - (item.transform?.[5] || 0)),
        width: Number(item.width || 0),
        height: Number(item.height || Math.abs(item.transform?.[3] || 10)),
        fontName: item.fontName || null,
      }));
      pages.push({ page: pageNumber, width: viewport.width, height: viewport.height, textItems });
    }
  } finally {
    await pdf.destroy();
  }
  return {
    pageCount: pages.length,
    pages,
    suggestedZones: [
      { key: 'header', x: 0, y: 0, width: 100, height: 25 },
      { key: 'body', x: 0, y: 25, width: 100, height: 60 },
      { key: 'footer', x: 0, y: 85, width: 100, height: 15 },
    ],
  };
}

function documentLabel(id: PdfDocumentType) { return getPdfTemplateTarget(id).label; }

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type PdfPageEditorProps = {
  source: File | string | null;
  fields: PdfTemplateField[];
  selectedFieldId: string;
  onSelectField?: (id: string) => void;
  onUpdateField?: (id: string, changes: Partial<PdfTemplateField>) => void;
  fieldValue?: (field: PdfTemplateField) => string;
  readOnly?: boolean;
};

function PdfPageEditor({ source, fields, selectedFieldId, onSelectField = () => {}, onUpdateField = () => {}, fieldValue = field => field.sample, readOnly = false }: PdfPageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thumbnailRef = useRef<HTMLCanvasElement>(null);
  const pageFrameRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<any>(null);
  const interactionRef = useRef<{ id: string; mode: 'move' | 'resize'; startX: number; startY: number; x: number; y: number; width: number; height: number } | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [zoom, setZoom] = useState(82);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [renderVersion, setRenderVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: any;
    let loadedPdf: any;
    const timer = setTimeout(() => {
      pdfRef.current = null;
      setPageNumber(1);
      setPageCount(1);
      setPageSize({ width: 0, height: 0 });
      setError(null);
      if (!source) return;
      setIsLoading(true);
      const sourceData = source instanceof File ? source.arrayBuffer() : storageService.resolveUrl(source).then(url => fetch(url)).then(response => {
        if (!response.ok) throw new Error('No se pudo obtener la plantilla');
        return response.arrayBuffer();
      });
      void sourceData.then(data => {
        if (cancelled) return null;
        loadingTask = pdfjsLib.getDocument({ data });
        return loadingTask.promise;
      }).then(pdf => {
        if (cancelled || !pdf) return;
        loadedPdf = pdf;
        pdfRef.current = pdf;
        setPageCount(pdf.numPages);
        setRenderVersion(version => version + 1);
      }).catch(() => {
        if (!cancelled) setError('No se pudo preparar la página PDF para editarla.');
      }).finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    }, 0);
    return () => {
      clearTimeout(timer);
      cancelled = true;
      pdfRef.current = null;
      if (loadingTask) void loadingTask.destroy();
      if (loadedPdf) void loadedPdf.destroy();
    };
  }, [source]);

  useEffect(() => {
    let cancelled = false;
    const renderPage = async () => {
      const pdf = pdfRef.current;
      const canvas = canvasRef.current;
      const thumbnail = thumbnailRef.current;
      if (!pdf || !canvas || !thumbnail) return;
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: zoom / 100 });
        const context = canvas.getContext('2d');
        if (!context) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setPageSize({ width: viewport.width, height: viewport.height });
        await page.render({ canvasContext: context, viewport }).promise;
        const thumbnailViewport = page.getViewport({ scale: Math.min(0.18, 116 / page.getViewport({ scale: 1 }).width) });
        const thumbnailContext = thumbnail.getContext('2d');
        if (!thumbnailContext || cancelled) return;
        thumbnail.width = thumbnailViewport.width;
        thumbnail.height = thumbnailViewport.height;
        await page.render({ canvasContext: thumbnailContext, viewport: thumbnailViewport }).promise;
      } catch {
        if (!cancelled) setError('No se pudo renderizar esta página.');
      }
    };
    void renderPage();
    return () => { cancelled = true; };
  }, [pageNumber, zoom, renderVersion]);

  const startInteraction = (event: React.PointerEvent, field: PdfTemplateField, mode: 'move' | 'resize') => {
    event.preventDefault();
    event.stopPropagation();
    onSelectField(field.id);
    interactionRef.current = { id: field.id, mode, startX: event.clientX, startY: event.clientY, x: field.x, y: field.y, width: field.width, height: field.height };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const interaction = interactionRef.current;
    const frame = pageFrameRef.current;
    if (!interaction || !frame) return;
    const bounds = frame.getBoundingClientRect();
    const deltaX = ((event.clientX - interaction.startX) / bounds.width) * 100;
    const deltaY = ((event.clientY - interaction.startY) / bounds.height) * 100;
    if (interaction.mode === 'resize') {
      onUpdateField(interaction.id, { width: Math.max(8, Math.min(94 - interaction.x, interaction.width + deltaX)), height: Math.max(4, Math.min(94 - interaction.y, interaction.height + deltaY)) });
    } else {
      onUpdateField(interaction.id, { x: Math.max(0, Math.min(100 - interaction.width, interaction.x + deltaX)), y: Math.max(0, Math.min(100 - interaction.height, interaction.y + deltaY)) });
    }
  };

  const endInteraction = () => { interactionRef.current = null; };
  const pageFields = fields.filter(field => field.enabled && (field.page || 1) === pageNumber && (!readOnly || fieldValue(field).trim()));

  return <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-[#202124] shadow-inner">
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-white/10 bg-[#303134] px-3 py-2 text-white">
      {readOnly && <span className="px-2 text-xs font-bold text-white/75">Plantilla importada · vista final</span>}
      {!readOnly && <>
      <Button type="button" variant="ghost" size="icon" className="size-8 cursor-pointer text-white hover:bg-white/10 hover:text-white" title="Página anterior" onClick={() => setPageNumber(page => Math.max(1, page - 1))} disabled={pageNumber <= 1}><ChevronLeft className="size-4" /></Button>
      <span className="min-w-[56px] text-center text-xs font-semibold">{pageNumber} / {pageCount}</span>
      <Button type="button" variant="ghost" size="icon" className="size-8 cursor-pointer text-white hover:bg-white/10 hover:text-white" title="Página siguiente" onClick={() => setPageNumber(page => Math.min(pageCount, page + 1))} disabled={pageNumber >= pageCount}><ChevronRight className="size-4" /></Button>
      <Separator orientation="vertical" className="mx-2 h-6 bg-white/15" />
      <Button type="button" variant="ghost" size="icon" className="size-8 cursor-pointer text-white hover:bg-white/10 hover:text-white" title="Alejar" onClick={() => setZoom(value => Math.max(55, value - 10))}><ZoomOut className="size-4" /></Button>
      <span className="min-w-[48px] text-center text-xs font-semibold">{zoom}%</span>
      <Button type="button" variant="ghost" size="icon" className="size-8 cursor-pointer text-white hover:bg-white/10 hover:text-white" title="Acercar" onClick={() => setZoom(value => Math.min(140, value + 10))}><ZoomIn className="size-4" /></Button>
      <Button type="button" variant="ghost" size="icon" className="ml-1 size-8 cursor-pointer text-white hover:bg-white/10 hover:text-white" title="Restablecer zoom" onClick={() => setZoom(82)}><Maximize2 className="size-4" /></Button>
      <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-white/60 sm:flex"><span className="size-2 rounded-full bg-cyan-300" />Arrastra para mover · esquina para ajustar</span>
      </>}
    </div>
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className={cn('hidden w-[150px] shrink-0 flex-col gap-3 border-r border-white/10 bg-[#252526] p-3 lg:flex', readOnly && 'lg:hidden')}>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Páginas</p>
        <button type="button" className={cn('cursor-pointer rounded-lg border p-2 transition', 'border-cyan-300 bg-cyan-300/10')} onClick={() => setPageNumber(1)}>
          <div className="flex min-h-[150px] items-center justify-center rounded bg-white/10"><canvas ref={thumbnailRef} className="max-h-[140px] max-w-full bg-white shadow-lg" /></div>
          <span className="mt-2 block text-center text-[11px] font-bold text-white">Página {pageNumber}</span>
        </button>
        {pageCount > 1 && <p className="text-[10px] leading-4 text-white/45">Puedes recorrer las páginas con los controles superiores.</p>}
      </aside>
      <div className="relative min-w-0 flex-1 overflow-auto bg-[#2b2b2b] p-5 md:p-8" onPointerMove={readOnly ? undefined : handlePointerMove} onPointerUp={readOnly ? undefined : endInteraction} onPointerCancel={readOnly ? undefined : endInteraction}>
        {error ? <div className="flex min-h-[520px] items-center justify-center text-sm text-red-200">{error}</div> : <div className="mx-auto flex min-h-full min-w-fit items-start justify-center">
          <div ref={pageFrameRef} className="relative shrink-0 bg-white shadow-2xl" style={{ width: pageSize.width || 600, height: pageSize.height || 780 }}>
            <canvas ref={canvasRef} className="block" />
            {pageFields.map(field => <button key={field.id} type="button" className={cn('absolute z-10 overflow-visible rounded-md border px-2 py-1 text-left text-[10px] shadow-lg transition', readOnly ? 'bg-white/75 text-slate-900 backdrop-blur-[1px]' : 'bg-slate-950/80 text-white', selectedFieldId === field.id ? 'border-cyan-300 ring-2 ring-cyan-200/60' : readOnly ? 'border-emerald-500/75 hover:border-cyan-400' : 'border-emerald-400/80 hover:border-cyan-200', selectedFieldId === field.id && readOnly && 'bg-cyan-100/90')} style={{ left: `${field.x}%`, top: `${field.y}%`, width: `${field.width}%`, height: `${field.height}%` }} onPointerDown={readOnly ? undefined : event => startInteraction(event, field, 'move')} onClick={() => onSelectField(field.id)}>
              <span className="block truncate text-[8px] font-black uppercase opacity-70">{field.label}</span><span className="block truncate font-bold">{fieldValue(field)}</span>
              {!readOnly && selectedFieldId === field.id && <span className="absolute -bottom-1.5 -right-1.5 z-20 block size-3 cursor-se-resize rounded-sm border border-slate-950 bg-cyan-300 shadow" onPointerDown={event => startInteraction(event, field, 'resize')} />}
            </button>)}
          </div>
        </div>}
        {isLoading && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold text-white/70">Preparando página…</div>}
      </div>
    </div>
  </div>;
}

function Pdf2HtmlPreview({ htmlUri, fields, selectedFieldId, onSelectField, pageSize }: { htmlUri: string; fields: PdfTemplateField[]; selectedFieldId: string; onSelectField: (id: string) => void; pageSize?: { width?: number; height?: number } }) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setHtml('');
      setError(null);
      void storageService.resolveUrl(htmlUri).then(url => fetch(url)).then(response => {
        if (!response.ok) throw new Error('No se pudo recuperar el HTML convertido');
        return response.text();
      }).then(value => {
        if (!cancelled) {
          const viewerCss = '<style id="novahub-viewer-css">html,body{margin:0!important;background:#fff!important;}#page-container{margin:0 auto!important;box-shadow:none!important;}#sidebar,#loading-indicator{display:none!important;}</style>';
          setHtml(value.includes('</head>') ? value.replace('</head>', `${viewerCss}</head>`) : `${viewerCss}${value}`);
        }
      }).catch(() => { if (!cancelled) setError('No se pudo cargar la plantilla HTML convertida.'); });
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [htmlUri]);

  const ratio = pageSize?.width && pageSize?.height ? `${pageSize.width} / ${pageSize.height}` : '8.5 / 11';
  return <div className="relative w-full max-w-[760px] overflow-hidden rounded-md bg-white shadow-2xl" style={{ aspectRatio: ratio }}>
    {html ? <iframe title="Vista HTML de la plantilla" srcDoc={html} className="absolute inset-0 size-full border-0 bg-white" sandbox="allow-same-origin" /> : <div className="flex size-full items-center justify-center bg-white text-xs text-slate-500">{error || 'Preparando HTML real…'}</div>}
    <div className="pointer-events-none absolute inset-0">
      {fields.filter(field => field.enabled).map(field => <button key={field.id} type="button" className={cn('pointer-events-auto absolute rounded border bg-slate-950/10 text-left transition hover:border-cyan-300', selectedFieldId === field.id ? 'z-20 border-cyan-300 bg-cyan-100/20 ring-2 ring-cyan-300/60' : 'border-emerald-400/50')} style={{ left: `${field.x}%`, top: `${field.y}%`, width: `${field.width}%`, height: `${field.height}%` }} onClick={() => onSelectField(field.id)} aria-label={`Editar ${field.label}`}><span className="sr-only">{field.label}</span>{selectedFieldId === field.id && <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-cyan-500 px-1.5 py-0.5 text-[8px] font-bold text-white">{field.label}</span>}</button>)}
    </div>
  </div>;
}

function HtmlFilePreview({ source, fields, selectedFieldId, onSelectField }: { source: File; fields: PdfTemplateField[]; selectedFieldId: string; onSelectField: (id: string) => void }) {
  const [html, setHtml] = useState('');
  useEffect(() => { let cancelled = false; void source.text().then(value => { if (!cancelled) { const css = '<style>html,body{margin:0!important;background:#fff!important;}#sidebar,#loading-indicator{display:none!important;}#page-container{left:0!important;right:0!important;}</style>'; setHtml(value.includes('</head>') ? value.replace('</head>', `${css}</head>`) : `${css}${value}`); } }); return () => { cancelled = true; }; }, [source]);
  return <div className="relative w-full max-w-[760px] overflow-hidden rounded-md bg-white shadow-2xl" style={{ aspectRatio: '8.5 / 11' }}><iframe title="Vista HTML de la plantilla" srcDoc={html} className="absolute inset-0 size-full border-0 bg-white" sandbox="allow-same-origin" /><div className="pointer-events-none absolute inset-0">{fields.filter(field => field.enabled).map(field => <button key={field.id} type="button" className={cn('pointer-events-auto absolute rounded border bg-slate-950/10 text-left transition hover:border-cyan-300', selectedFieldId === field.id ? 'z-20 border-cyan-300 bg-cyan-100/20 ring-2 ring-cyan-300/60' : 'border-emerald-400/50')} style={{ left: `${field.x}%`, top: `${field.y}%`, width: `${field.width}%`, height: `${field.height}%` }} onClick={() => onSelectField(field.id)} aria-label={`Editar ${field.label}`}><span className="sr-only">{field.label}</span>{selectedFieldId === field.id && <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-cyan-500 px-1.5 py-0.5 text-[8px] font-bold text-white">{field.label}</span>}</button>)}</div></div>;
}

function UploadedTemplatePreview({ source, htmlUri, htmlPageSize, fields, selectedFieldId, onSelectField = () => {}, onUpdateField, fieldValue, readOnly = false }: PdfPageEditorProps & { htmlUri?: string; htmlPageSize?: { width?: number; height?: number } }) {
  if (htmlUri) return <Pdf2HtmlPreview htmlUri={htmlUri} fields={fields} selectedFieldId={selectedFieldId} onSelectField={onSelectField} pageSize={htmlPageSize} />;
  return <PdfPageEditor source={source} fields={fields} selectedFieldId={selectedFieldId} onSelectField={onSelectField} onUpdateField={onUpdateField} fieldValue={fieldValue} readOnly={readOnly} />;
}

const PDF_DESIGN_TOUR_STEPS: GuidedTourStep[] = [
  { target: '[data-tour="pdf-designs"]', title: 'Mis diseños', description: 'Aquí administras las distintas versiones visuales de tus documentos. Puedes crear un diseño para facturas, otro para cotizaciones y otro para notas de crédito.', placement: 'right' },
  { target: '[data-tour="pdf-assignment"]', title: 'Vincular y guardar diseño', description: 'Aquí defines el nombre, módulo, vista o acción PDF y carpeta del diseño. El indicador de sucursal muestra dónde se guardará.', placement: 'bottom' },
  { target: '[data-tour="pdf-library"]', title: 'Biblioteca de plantillas', description: `Explora ${TEMPLATE_LIBRARY.length} patrones visuales con encabezados, pies, tablas y paletas distintas. Al seleccionar una, su composición pasa al canvas; la tipografía se configura aparte.`, placement: 'right' },
  { target: '[data-tour="pdf-upload"]', title: 'Importación de plantillas', description: 'Esta función está marcada como En desarrollo. Próximamente permitirá importar diseños PDF/HTML cuando el motor de conversión editable esté listo.', placement: 'right' },
  { target: '[data-tour="pdf-preview"]', title: 'Canvas y vista previa en vivo', description: 'Esta hoja representa el documento final. Los controles del documento y del componente viven dentro del canvas y se reflejan inmediatamente aquí.', placement: 'left' },
  { target: '[data-tour="pdf-document-selector"]', title: 'Vista asignada', description: 'Aquí se muestra únicamente la vista a la que pertenece esta plantilla. Cada vista utiliza una sola plantilla activa.', placement: 'bottom' },
  { target: '[data-tour="pdf-template-canvas-editor"]', title: 'Editor del diseño', description: 'El documento se edita dentro del canvas: agrega componentes, cambia su forma, borde, posición, tipografía, colores, encabezado y pie de página desde la misma superficie.', placement: 'left' },
  { target: '[data-tour="pdf-save"]', title: 'Guardar el diseño', description: 'Cuando termines de configurar los campos y estilos, guarda desde este footer fijo. Así el diseño queda disponible para las exportaciones PDF.', placement: 'left' },
];

function PaperPreview({ settings, documentType, companyName, logo }: { settings: PdfSettings; documentType: PdfDocumentType; companyName: string; logo?: string | null }) {
  const pageClass = '';
  const align = settings.logoPosition === 'center' ? 'items-center text-center' : settings.logoPosition === 'right' ? 'items-end text-right' : 'items-start text-left';
  const primary = settings.paletteMode === 'corporate' ? settings.primaryColor : settings.primaryColor;
  const bannerHeader = ['banner', 'ribbon', 'corner', 'double-band'].includes(settings.headerLayout);
  const centeredHeader = ['centered', 'editorial'].includes(settings.headerLayout);
  const boxedHeader = settings.headerLayout === 'boxed';
  const stripedRows = ['striped', 'ledger', 'accent'].includes(settings.tableLayout);
  const compactTable = settings.tableLayout === 'compact';
  const cardsTable = settings.tableLayout === 'cards';
  return <div className={cn('mx-auto w-full max-w-[520px] overflow-hidden rounded-md border bg-white text-slate-700 shadow-2xl', pageClass)} style={{ aspectRatio: getPdfPreviewAspectRatio(settings), fontFamily: settings.fontFamily, fontSize: `${settings.fontSize}px` }}>
    {settings.watermark && <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-10"><span className="rotate-[-25deg] text-6xl font-black text-slate-500">{settings.watermark}</span></div>}
    <div className="h-full p-[5%]" style={{ paddingLeft: `${Math.max(3, settings.margins / 2)}%`, paddingRight: `${Math.max(3, settings.margins / 2)}%` }}>
      <div className={cn('flex min-w-0 flex-nowrap min-h-[16%] gap-4 border-b pb-3', centeredHeader ? 'flex-col items-center text-center' : 'justify-between', bannerHeader && 'rounded-md border-0 p-3 text-white', settings.headerLayout === 'ribbon' && 'rounded-br-[3rem]', settings.headerLayout === 'corner' && 'rounded-bl-[3rem]', settings.headerLayout === 'compact' && 'min-h-0', settings.headerLayout === 'topline' && 'border-t-4 pt-2', settings.headerLayout === 'sidebar' && 'border-l-4 pl-3', boxedHeader && 'rounded-lg border p-3', align)} style={{ borderColor: settings.lineColor, background: bannerHeader ? primary : undefined }}>
        <div className={cn('flex min-w-0 flex-col gap-1', align)}>
          {logo ? <img src={logo} alt="Logo" className="mb-1 object-contain" style={{ width: `${Math.min(settings.logoSize, 60)}px`, height: 'auto', maxHeight: '32px' }} /> : <div className="flex size-8 items-center justify-center rounded bg-slate-100"><ImagePlus className="size-4 text-slate-400" /></div>}
          {settings.showCompanyName && <strong className="text-sm" style={{ color: bannerHeader ? '#fff' : primary }}>{settings.companyName || companyName || 'Mi Empresa'}</strong>}
          {settings.slogan && <span className="text-[.78em] opacity-70">{settings.slogan}</span>}
          <span className="max-w-[180px] whitespace-pre-line text-[.72em] opacity-70">{settings.fiscalInfo}</span>
        </div>
        <div className={cn('shrink-0 text-right', centeredHeader && 'text-center')}>
          <strong className="block whitespace-nowrap text-[1.2em]" style={{ color: bannerHeader ? '#fff' : settings.textColor }}>{documentLabel(documentType).toUpperCase()}</strong>
          <span className="opacity-70">Nº: DEMO-0001</span><br /><span className="opacity-70">Fecha: 31/07/2026</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 py-4"><div><strong className="block text-[.85em]" style={{ color: primary }}>PREPARADO PARA</strong><span>Cliente de ejemplo</span><br /><span className="opacity-60">cliente@ejemplo.com</span></div><div className="text-right text-[.9em] opacity-70"><span>{settings.address}</span><br /><span>{settings.phone}</span><br /><span>{settings.website}</span></div></div>
      <div className={cn('overflow-hidden border', cardsTable ? 'space-y-1 border-0 bg-transparent' : 'rounded')} style={{ borderColor: settings.lineColor }}><div className={cn('grid grid-cols-[1fr_45px_70px_70px] gap-2 px-2 py-2 font-bold', settings.tableLayout === 'minimal' ? 'bg-transparent text-slate-700' : 'text-white', compactTable && 'py-1 text-[.9em]')} style={{ background: settings.tableLayout === 'minimal' ? '#f8fafc' : primary }}><span>Descripción</span><span>Cant.</span><span>Precio</span><span>Total</span></div>{['Servicio principal', 'Producto adicional', 'Soporte mensual'].map((item, index) => <div key={item} className={cn('grid grid-cols-[1fr_45px_70px_70px] gap-2 border-t px-2 py-2', cardsTable && 'rounded border', compactTable && 'py-1')} style={{ borderColor: settings.lineColor, background: stripedRows && index % 2 ? '#f8fafc' : '#fff' }}><span>{item}</span><span>1</span><span>$ 100.00</span><strong style={{ color: settings.tableLayout === 'accent' ? primary : undefined }}>$ 100.00</strong></div>)}</div>
      <div className="ml-auto mt-5 w-[48%] space-y-2 text-right"><div className="flex justify-between"><span>Subtotal</span><span>$ 300.00</span></div><div className="flex justify-between"><span>Impuesto</span><span>$ 45.00</span></div><div className="flex justify-between border-t pt-2 text-[1.15em] font-bold" style={{ borderColor: settings.lineColor, color: primary }}><span>TOTAL</span><span>$ 345.00</span></div></div>
      {(settings.defaultNotes || settings.terms) && <div className="mt-5 border-t pt-3 text-[.78em] opacity-70" style={{ borderColor: settings.lineColor }}>{settings.defaultNotes || 'Observaciones predeterminadas del documento.'}<br />{settings.terms && <span>{settings.terms}</span>}</div>}
      <div className="mt-5 flex items-end justify-between border-t pt-2 text-[.7em] opacity-60" style={{ borderColor: settings.lineColor }}><span>{settings.footerText}</span>{settings.showPageNumber && <span>{settings.pageNumberFormat === 'number-only' ? '1' : settings.pageNumberFormat === 'custom' ? settings.pageNumberCustom.replace('{page}', '1').replace('{pages}', '1') : 'Página 1 de 1'}</span>}</div>
      {(settings.showQr || settings.showBarcode) && <div className="mt-3 flex justify-end gap-2 opacity-70">{settings.showQr && <div className="flex size-9 items-center justify-center border"><QrCode className="size-7" /></div>}{settings.showBarcode && <div className="flex h-9 w-20 items-center justify-center border"><Barcode className="size-16" /></div>}</div>}
    </div>
  </div>;
}

export function StructuredDocumentPreview({ target, settings, companyName, logo }: { target: PdfTemplateTarget; settings: PdfSettings; companyName: string; logo?: string | null }) {
  if (target.structure === 'transaction') return <PaperPreview settings={settings} documentType={target.key} companyName={companyName} logo={logo} />;
  const primary = settings.primaryColor;
  const title = target.label.toUpperCase();
  const pageClass = '';
  const rows = target.structure === 'report'
    ? ['Indicador principal', 'Resumen del período', 'Detalle agrupado', 'Totales y observaciones']
    : target.structure === 'history'
      ? ['Fecha', 'Documento', 'Descripción', 'Monto', 'Estado']
      : ['Concepto', 'Referencia', 'Fecha', 'Importe'];
  return <div className={cn('mx-auto w-full max-w-[520px] overflow-hidden rounded-md border bg-white text-slate-700 shadow-2xl', pageClass)} style={{ aspectRatio: getPdfPreviewAspectRatio(settings), fontFamily: settings.fontFamily, fontSize: `${settings.fontSize}px` }}>
    <div className="h-full p-[7%]" style={{ paddingLeft: `${Math.max(3, settings.margins / 2)}%`, paddingRight: `${Math.max(3, settings.margins / 2)}%` }}>
      <div className="flex min-w-0 flex-nowrap items-start justify-between gap-4 border-b pb-4" style={{ borderColor: settings.lineColor }}>
        <div className="min-w-0">{logo ? <img src={logo} alt="Logo" className="mb-2 object-contain" style={{ width: `${Math.min(settings.logoSize, 60)}px`, height: 'auto', maxHeight: '32px' }} /> : <div className="mb-2 flex size-8 items-center justify-center rounded bg-slate-100"><ImagePlus className="size-4 text-slate-400" /></div>}{settings.showCompanyName && <strong className="block text-sm" style={{ color: primary }}>{settings.companyName || companyName || 'Mi Empresa'}</strong>}<span className="text-[.75em] opacity-60">{settings.fiscalInfo}</span></div>
        <div className="shrink-0 text-right"><strong className="whitespace-nowrap text-[1.2em]" style={{ color: settings.textColor }}>{title}</strong><div className="mt-1 text-[.75em] opacity-60">31/07/2026 · DEMO-0001</div></div>
      </div>
      <div className="mt-5 rounded-lg border p-3" style={{ borderColor: settings.lineColor }}><strong style={{ color: primary }}>{target.structure === 'report' ? 'Resumen y filtros aplicados' : target.structure === 'history' ? 'Ficha y registros relacionados' : 'Comprobante compacto'}</strong><p className="mt-1 text-[.8em] opacity-70">La estructura de este documento se adapta a {target.label.toLowerCase()}, no reutiliza la tabla de cotizaciones.</p></div>
      <div className="mt-5 overflow-hidden rounded border" style={{ borderColor: settings.lineColor }}><div className="grid grid-cols-2 gap-2 px-3 py-2 font-bold text-white" style={{ background: primary }}><span>Sección</span><span>Valor</span></div>{rows.map((row, index) => <div key={row} className="grid grid-cols-2 gap-2 border-t px-3 py-3" style={{ borderColor: settings.lineColor, background: index % 2 ? '#f8fafc' : '#fff' }}><span>{row}</span><span className="text-right opacity-70">Información de ejemplo</span></div>)}</div>
      <div className="mt-6 border-t pt-3 text-[.75em] opacity-60" style={{ borderColor: settings.lineColor }}>{settings.footerText}{settings.showPageNumber && <span className="float-right">{settings.pageNumberFormat === 'number-only' ? '1' : 'Página 1 de 1'}</span>}</div>
    </div>
  </div>;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) { return <div className="space-y-1.5"><Label className="text-xs font-bold text-muted-foreground">{label}</Label>{children}{hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}</div>; }
function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) { return <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/15 p-3"><div><p className="text-sm font-semibold">{label}</p><p className="text-[11px] text-muted-foreground">{description}</p></div><Switch checked={checked} onCheckedChange={onChange} /></div>; }

function TemplatePatternPreview({ template }: { template: typeof TEMPLATE_LIBRARY[number] }) {
  const color = template.color;
  const secondary = template.settings.secondaryColor || '#0f3b65';
  const header = template.settings.headerLayout;
  const footer = footerLayoutForTemplate(template.key);
  const filledHeader = ['banner', 'ribbon', 'double-band', 'fluid', 'aurora', 'diagonal', 'ink', 'ticket', 'steps'].includes(header);
  return <div className="relative h-[112px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner dark:border-slate-700 dark:bg-slate-950">
    <div className="absolute inset-x-3 top-2 bottom-2 overflow-hidden rounded-[4px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {header === 'double-band' && <><span className="absolute inset-x-0 top-0 h-3" style={{ backgroundColor: color }} /><span className="absolute inset-x-0 top-6 h-2" style={{ backgroundColor: color }} /></>}
      {header === 'banner' && <span className="absolute inset-x-0 top-0 h-9" style={{ backgroundColor: color }} />}
      {header === 'split' && <span className="absolute inset-x-0 top-0 h-9 border-b-2" style={{ backgroundColor: `${color}12`, borderColor: color }} />}
      {header === 'boxed' && <span className="absolute inset-x-1 top-1 h-9 rounded border" style={{ borderColor: color }} />}
      {header === 'ribbon' && <><span className="absolute left-0 top-0 h-9 w-[34%]" style={{ backgroundColor: color, clipPath: 'polygon(0 0,100% 0,86% 100%,0 100%)' }} /><span className="absolute left-[28%] top-0 h-9 w-[20%]" style={{ backgroundColor: secondary, clipPath: 'polygon(38% 0,100% 0,62% 100%,0 100%)', opacity: 0.42 }} /><span className="absolute right-0 top-0 h-9 w-[63%] bg-slate-50 dark:bg-slate-800" /></>}
      {header === 'sidebar' && <><span className="absolute bottom-0 left-0 top-0 w-2 rounded-r-[50%]" style={{ backgroundColor: color }} /><span className="absolute bottom-1 left-1 top-1 w-2 rounded-r-[50%]" style={{ backgroundColor: secondary, opacity: 0.3 }} /></>}
      {header === 'corner' && <span className="absolute right-0 top-0 h-11 w-[34%] rounded-bl-[100%]" style={{ backgroundColor: color }} />}
      {header === 'centered' && <span className="absolute left-[34%] right-[34%] top-1 h-2 rounded-full" style={{ backgroundColor: color }} />}
      {['classic', 'topline', 'editorial', 'compact'].includes(header) && <span className="absolute inset-x-0 top-1 h-1" style={{ backgroundColor: color }} />}
      {header === 'fluid' && <><span className="absolute -left-[8%] top-0 h-12 w-[116%] rounded-[0_0_50%_50%]" style={{ backgroundColor: color }} /><span className="absolute -left-[5%] top-3 h-10 w-[110%] rounded-[0_0_50%_50%]" style={{ backgroundColor: secondary, opacity: 0.35 }} /><span className="absolute left-4 top-2 h-1 w-8 rounded-full bg-white/80" /></>}
      {header === 'aurora' && <><span className="absolute -left-[4%] top-0 h-12 w-[108%] rounded-[0_0_50%_50%]" style={{ backgroundColor: color }} /><span className="absolute left-[26%] top-1 h-11 w-[92%] rounded-[0_0_50%_50%]" style={{ backgroundColor: secondary, opacity: 0.3 }} /><span className="absolute right-5 top-2 size-7 rounded-full bg-white/20 blur-[1px]" /></>}
      {header === 'diagonal' && <><span className="absolute inset-x-0 top-0 h-10" style={{ backgroundColor: color, clipPath: 'polygon(0 0,100% 0,78% 100%,0 100%)' }} /><span className="absolute inset-x-0 top-0 h-10" style={{ backgroundColor: secondary, clipPath: 'polygon(25% 0,100% 0,100% 100%,0 100%)', opacity: 0.25 }} /></>}
      {header === 'portal' && <><span className="absolute left-0 top-0 size-10 rounded-full" style={{ backgroundColor: `${color}25`, border: `2px solid ${color}` }} /><span className="absolute left-8 right-0 top-1 h-8 rounded border" style={{ borderColor: color }} /></>}
      {header === 'steps' && <><span className="absolute left-0 top-1 h-2 w-[53%] rounded-md" style={{ backgroundColor: color }} /><span className="absolute left-[18%] top-3 h-2 w-[77%] rounded-md opacity-75" style={{ backgroundColor: color }} /><span className="absolute left-[35%] top-5 h-2 w-[60%] rounded-md opacity-45" style={{ backgroundColor: color }} /></>}
      {header === 'ink' && <><span className="absolute -left-[8%] top-0 h-11 w-[95%] rounded-[50%]" style={{ backgroundColor: color, transform: 'rotate(-3deg)' }} /><span className="absolute right-[-12%] top-2 h-9 w-[68%] rounded-[50%]" style={{ backgroundColor: secondary, opacity: 0.3 }} /></>}
      {header === 'grid' && <><span className="absolute inset-x-0 top-0 h-10 rounded border" style={{ borderColor: color, backgroundColor: `${color}08` }} /><span className="absolute bottom-0 left-[34%] top-0 w-px opacity-40" style={{ backgroundColor: color }} /><span className="absolute bottom-0 left-[67%] top-0 w-px opacity-40" style={{ backgroundColor: color }} /><span className="absolute inset-x-0 top-5 h-px opacity-30" style={{ backgroundColor: color }} /></>}
      {header === 'ticket' && <span className="absolute inset-x-0 top-0 h-10" style={{ backgroundColor: color, clipPath: 'polygon(0 0,100% 0,100% 88%,96% 100%,92% 88%,88% 100%,84% 88%,80% 100%,76% 88%,72% 100%,68% 88%,64% 100%,60% 88%,56% 100%,52% 88%,48% 100%,44% 88%,40% 100%,36% 88%,32% 100%,28% 88%,24% 100%,20% 88%,16% 100%,12% 88%,8% 100%,4% 88%,0 100%)' }} />}
      <span className="absolute left-3 top-4 h-1.5 w-[31%] rounded-full" style={{ backgroundColor: filledHeader ? '#ffffff' : '#334155' }} />
      <span className="absolute right-3 top-4 h-1.5 w-[26%] rounded-full" style={{ backgroundColor: filledHeader ? '#ffffff' : color }} />
      <span className="absolute right-3 top-7 h-1 w-[18%] rounded-full" style={{ backgroundColor: filledHeader ? '#bfdbfe' : '#cbd5e1' }} />
      <span className="absolute left-3 right-3 top-[43%] h-7 rounded border border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/60" />
      <span className="absolute left-4 top-[49%] h-1 w-[25%] rounded-full bg-slate-400/70" />
      <span className="absolute left-4 right-4 top-[59%] h-px bg-slate-200 dark:bg-slate-700" />
      <span className="absolute left-4 right-4 top-[66%] h-px bg-slate-200 dark:bg-slate-700" />
      <span className="absolute left-4 right-4 top-[73%] h-px bg-slate-200 dark:bg-slate-700" />
      {footer === 'band' && <span className="absolute inset-x-0 bottom-0 h-4" style={{ backgroundColor: color }} />}
      {footer === 'wave' && <><span className="absolute -bottom-2 inset-x-0 h-7 rounded-[50%]" style={{ backgroundColor: color }} /><span className="absolute -bottom-3 inset-x-0 h-3 rounded-[50%]" style={{ backgroundColor: secondary }} /></>}
      {footer === 'layers' && <><span className="absolute -bottom-2 inset-x-0 h-7 rounded-[50%]" style={{ backgroundColor: color }} /><span className="absolute -bottom-3 left-[12%] h-4 w-[115%] rounded-[50%]" style={{ backgroundColor: secondary, opacity: 0.5 }} /><span className="absolute bottom-3 left-4 h-1 w-7 rounded-full bg-white/80" /></>}
      {footer === 'notch' && <span className="absolute inset-x-0 bottom-0 h-4" style={{ backgroundColor: color, clipPath: 'polygon(0 0,100% 0,100% 72%,96% 100%,92% 72%,88% 100%,84% 72%,80% 100%,76% 72%,72% 100%,68% 72%,64% 100%,60% 72%,56% 100%,52% 72%,48% 100%,44% 72%,40% 100%,36% 72%,32% 100%,28% 72%,24% 100%,20% 72%,16% 100%,12% 72%,8% 100%,4% 72%,0 100%)' }} />}
      {footer === 'dots' && <><span className="absolute inset-x-3 bottom-4 h-px" style={{ backgroundColor: color }} /><span className="absolute bottom-3 left-4 size-1.5 rounded-full" style={{ backgroundColor: color }} /><span className="absolute bottom-3 left-6 size-1.5 rounded-full" style={{ backgroundColor: color }} /><span className="absolute bottom-3 left-8 size-1.5 rounded-full" style={{ backgroundColor: color }} /></>}
      {footer === 'boxed' && <span className="absolute inset-x-1 bottom-1 h-4 rounded border" style={{ borderColor: color }} />}
      {footer === 'split' && <><span className="absolute bottom-0 left-0 h-4 w-[34%]" style={{ backgroundColor: color }} /><span className="absolute bottom-0 right-0 h-4 w-[62%] bg-slate-50 dark:bg-slate-800" /></>}
      {footer === 'line' && <span className="absolute inset-x-3 bottom-4 h-px" style={{ backgroundColor: color }} />}
       <span className="absolute bottom-1.5 left-3 h-1 w-[28%] rounded-full" style={{ backgroundColor: ['band', 'wave', 'layers', 'notch'].includes(footer) ? '#ffffff' : '#94a3b8' }} />
       <span className="absolute bottom-1.5 right-3 h-1 w-[15%] rounded-full" style={{ backgroundColor: ['band', 'wave', 'layers', 'notch'].includes(footer) ? '#dbeafe' : '#94a3b8' }} />
    </div>
  </div>;
}

export function PdfDocumentCustomizer({ tenantId, branchName = '', companyName = '', corporateColor = '#10b981', logo, canEdit = true, canCreate = true, canDelete = true }: { tenantId?: string; branchName?: string; companyName?: string; corporateColor?: string; logo?: string | null; canEdit?: boolean; canCreate?: boolean; canDelete?: boolean }) {
  const [designs, setDesigns] = useState<PdfDocumentDesignRecord[]>([]);
  const [folders, setFolders] = useState<PdfDocumentDesignFolder[]>([]);
  const [activeId, setActiveId] = useState('draft');
  const [documentType, setDocumentType] = useState<PdfDocumentType>('ventas.estimate');
  const [selectedModule, setSelectedModule] = useState(PDF_TEMPLATE_MODULES[0]?.id || 'ventas');
  const [settings, setSettings] = useState<PdfSettings>({ ...DEFAULT_SETTINGS, companyName, primaryColor: corporateColor, logoUrl: logo || undefined });
  const [name, setName] = useState('Clásico · Cotizaciones');
  const [description, setDescription] = useState('Diseño base de la biblioteca para comenzar a personalizar esta sucursal');
  const [assignedDocuments, setAssignedDocuments] = useState<PdfDocumentType[]>(['ventas.estimate']);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [openSection, setOpenSection] = useState('header');
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [pendingTemplateFile, setPendingTemplateFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [pendingTemplateDocumentType, setPendingTemplateDocumentType] = useState<PdfDocumentType | null>(null);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [templateFields, setTemplateFields] = useState<PdfTemplateField[]>(() => createTemplateFields(companyName));
  const [selectedTemplateFieldId, setSelectedTemplateFieldId] = useState('company');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'design'; record: PdfDocumentDesignRecord } | { kind: 'folder'; record: PdfDocumentDesignFolder } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const [templateDefinition, setTemplateDefinition] = useState<PdfTemplateDefinition>(() => createDefaultTemplateDefinition('ventas.estimate', { ...DEFAULT_SETTINGS, companyName, logoUrl: logo || undefined }));
  const [templateImportError, setTemplateImportError] = useState<string | null>(null);
  const [templateImportWarnings, setTemplateImportWarnings] = useState<string[]>([]);
  const [htmlSource, setHtmlSource] = useState('');
  const [sourceMetadata, setSourceMetadata] = useState<{ sourceType: string; sourceFileUrl?: string; sourceFileName?: string; analysisStatus?: string; layoutZones?: Record<string, any> } | null>(null);
  const isUploadedSource = sourceMetadata?.sourceType === 'UPLOADED_PDF' || sourceMetadata?.sourceType === 'UPLOADED_HTML';

  const hasActiveBranchScope = Boolean(String(tenantId || '').trim());
  const activeBranchLabel = branchName || companyName || 'Sucursal actual';
  const branchScopeRef = useRef<string | null>(null);
  const resetDraftForScope = useCallback(() => {
    const target = getPdfTemplateTarget('ventas.estimate');
    const defaultTemplate = getDefaultLibraryTemplate();
    const nextSettings = { ...DEFAULT_SETTINGS, companyName, logoUrl: logo || undefined, ...defaultTemplate.settings, footerLayout: footerLayoutForTemplate(defaultTemplate.key) };
    setActiveId('draft');
    setSelectedFolderId(null);
    setSelectedTemplateKey(defaultTemplate.key);
    setName(`${defaultTemplate.name} · ${target.label}`);
    setDescription(`Diseño base de biblioteca para ${target.label}; editable para esta sucursal.`);
    setAssignedDocuments([target.key]);
    setDocumentType(target.key);
    setSelectedModule(target.module);
    setSettings(nextSettings);
    setTemplateFields(createTemplateFields(companyName));
    setTemplateDefinition({ ...createDefaultTemplateDefinition(target.key, nextSettings), metadata: { preset: defaultTemplate.key } });
    setSelectedTemplateFieldId('company');
    setSourceMetadata(null);
  }, [companyName, corporateColor, logo]);
  const loadDesign = useCallback((record: PdfDocumentDesignRecord) => {
    if (record.clientTenantId && record.clientTenantId !== tenantId) return;
    const storedFields = (record.layoutZones as any)?.fields;
    const assignedDocument = normalizePdfTemplateKey(record.documentTypes?.[0] || 'ventas.estimate');
    const target = getPdfTemplateTarget(assignedDocument);
    const mergedSettings = { ...DEFAULT_SETTINGS, companyName, primaryColor: corporateColor, logoUrl: logo || undefined, ...(TEMPLATE_LIBRARY.find(template => template.key === record.templateKey)?.settings || {}), ...(record.settings as Partial<PdfSettings>) };
    setActiveId(record.id); setSelectedFolderId(record.folderId || null); setSelectedTemplateKey(TEMPLATE_LIBRARY.find(template => template.key === record.templateKey)?.key || '');
    setName(record.name); setDescription(record.description || ''); setAssignedDocuments([assignedDocument]); setDocumentType(assignedDocument); setSelectedModule(target.module); setSettings(mergedSettings);
    setTemplateFields(normalizeTemplateFields(storedFields, companyName));
    const storedDefinition = (record.layoutZones as any)?.definition;
    const storedPreset = storedDefinition?.metadata?.preset;
    // Las primeras versiones guardaban el templateKey pero no el preset en la
    // definición. En ese caso reconstruimos solo las plantillas de biblioteca;
    // si ya existe un preset, se conserva el canvas personalizado del usuario.
    const libraryPreset = TEMPLATE_LIBRARY.find(template => template.key === record.templateKey);
    const definition = libraryPreset && !storedPreset
      ? { ...createDefaultTemplateDefinition(assignedDocument, mergedSettings), metadata: { preset: libraryPreset.key } }
      : sanitizeTemplateDefinition(storedDefinition, assignedDocument, mergedSettings);
    setTemplateDefinition(mergedSettings.logoUrl ? ensureLogoNode(definition) : definition);
    setSourceMetadata({ sourceType: record.sourceType, sourceFileUrl: record.sourceFileUrl || undefined, sourceFileName: record.sourceFileName || undefined, analysisStatus: record.analysisStatus, layoutZones: record.layoutZones || undefined });
    if (canEdit && record.sourceType === 'UPLOADED_PDF' && !['HTML_CONVERTED', 'PDF_VIEWER_FALLBACK'].includes(record.analysisStatus)) {
      void pdfDocumentDesignService.convertToHtml(record.id).then(converted => {
        if (converted.clientTenantId && converted.clientTenantId !== tenantId) return;
        setDesigns(prev => prev.map(item => item.id === converted.id ? converted : item));
        setSourceMetadata({ sourceType: converted.sourceType, sourceFileUrl: converted.sourceFileUrl || undefined, sourceFileName: converted.sourceFileName || undefined, analysisStatus: converted.analysisStatus, layoutZones: converted.layoutZones || undefined });
      }).catch(() => {});
    }
  }, [canEdit, companyName, corporateColor, logo, tenantId]);

  useEffect(() => {
    const nextScope = String(tenantId || '').trim();
    if (branchScopeRef.current === nextScope) return;
    branchScopeRef.current = nextScope;
    setDesigns([]);
    setFolders([]);
    resetDraftForScope();
  }, [resetDraftForScope, tenantId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    if (!hasActiveBranchScope) {
      setDesigns([]);
      setFolders([]);
      resetDraftForScope();
      setIsLoading(false);
      return () => { cancelled = true; };
    }
    Promise.all([pdfDocumentDesignService.list(), pdfDocumentDesignService.listFolders()])
      .then(([records, folderRecords]) => {
        if (cancelled) return;
        setDesigns(records || []);
        setFolders(folderRecords || []);
        if (records?.length) loadDesign(records[0]);
        else resetDraftForScope();
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [hasActiveBranchScope, loadDesign, resetDraftForScope, tenantId]);
  useEffect(() => {
    if (settings.paletteMode !== 'corporate' || !corporateColor || activeId !== 'draft') return;
    const timer = setTimeout(() => { setSettings(prev => ({ ...prev, primaryColor: corporateColor })); }, 0);
    return () => clearTimeout(timer);
  }, [corporateColor, activeId, settings.paletteMode]);
  const canModifyActive = hasActiveBranchScope && (activeId === 'draft' ? canCreate : canEdit);
  const update = <K extends keyof PdfSettings>(key: K, value: PdfSettings[K]) => { if (canModifyActive) setSettings(prev => ({ ...prev, [key]: value })); };
  const reservedDocumentDesign = (id: PdfDocumentType, excludeId = activeId) => designs.find(record => record.isActive && record.id !== excludeId && normalizePdfTemplateKey(record.documentTypes?.[0]) === normalizePdfTemplateKey(id));
  const availableDocumentTypes = DOCUMENTS.filter(item => !reservedDocumentDesign(item.key));
  const firstAvailableDocumentType = (preferred: PdfDocumentType, excludeId = activeId) => {
    const available = DOCUMENTS.filter(item => !reservedDocumentDesign(item.key, excludeId));
    return available.some(item => item.key === preferred) ? preferred : available[0]?.key || preferred;
  };

  const saveDesign = async () => {
    if (activeId === 'draft' ? !canCreate : !canEdit) return;
    if (!hasActiveBranchScope) { toast.error('Selecciona o abre una sucursal activa antes de guardar el diseño.'); return; }
    if (!name.trim() || !assignedDocuments.length) { toast.error('Agrega un nombre y al menos un tipo de documento'); return; }
    setIsSaving(true);
    try {
      const sourceType: PdfDocumentDesignRecord['sourceType'] = sourceMetadata?.sourceType === 'UPLOADED_PDF' || sourceMetadata?.sourceType === 'UPLOADED_HTML' || sourceMetadata?.sourceType === 'AI_ANALYZED' ? sourceMetadata.sourceType : 'SYSTEM';
      const payload = { name: name.trim(), description, documentTypes: assignedDocuments, folderId: selectedFolderId, settings, templateKey: selectedTemplateKey || 'custom', sourceType, sourceFileUrl: sourceMetadata?.sourceFileUrl, sourceFileName: sourceMetadata?.sourceFileName, analysisStatus: sourceMetadata?.analysisStatus || 'NOT_APPLICABLE', layoutZones: { ...(sourceMetadata?.layoutZones || {}), definition: templateDefinition, fields: templateFields }, engine: 'HTML_TEMPLATE', isActive: true };
      const saved = activeId === 'draft' ? await pdfDocumentDesignService.create(payload) : await pdfDocumentDesignService.update(activeId, payload);
      setDesigns(prev => activeId === 'draft' ? [saved, ...prev] : prev.map(item => item.id === saved.id ? saved : item)); setActiveId(saved.id); setName(saved.name); toast.success(saved.name !== name.trim() ? `Diseño guardado como «${saved.name}»` : 'Diseño PDF guardado');
    } catch (error: any) { toast.error(error?.message || 'No se pudo guardar el diseño'); } finally { setIsSaving(false); }
  };
  const createDesign = () => { if (!hasActiveBranchScope || !canCreate) return; const nextDocumentType = firstAvailableDocumentType(documentType, 'draft'); const target = getPdfTemplateTarget(nextDocumentType); const defaultTemplate = getDefaultLibraryTemplate(); const nextSettings = { ...DEFAULT_SETTINGS, companyName, logoUrl: logo || undefined, ...defaultTemplate.settings, footerLayout: footerLayoutForTemplate(defaultTemplate.key) }; setActiveId('draft'); setSelectedTemplateKey(defaultTemplate.key); setName(`${defaultTemplate.name} · ${target.label}`); setDescription(`Diseño iniciado desde ${defaultTemplate.name} para ${target.label}; editable para esta sucursal.`); setAssignedDocuments([nextDocumentType]); setDocumentType(nextDocumentType); setSelectedModule(target.module); setSourceMetadata(null); setTemplateFields(createTemplateFields(companyName)); setTemplateDefinition({ ...createDefaultTemplateDefinition(nextDocumentType, nextSettings), metadata: { preset: defaultTemplate.key } }); setSelectedTemplateFieldId('company'); setSettings(nextSettings); };
  const deleteDesignRecord = (record: PdfDocumentDesignRecord) => { if (canDelete) setDeleteTarget({ kind: 'design', record }); };
  const deleteDesign = async () => { if (!canDelete || activeId === 'draft') return; const record = designs.find(item => item.id === activeId); if (record) deleteDesignRecord(record); };
  const applyTemplate = (template: typeof TEMPLATE_LIBRARY[number]) => {
    if (!canModifyActive) return;
    const nextSettings = { ...settings, ...template.settings, footerLayout: footerLayoutForTemplate(template.key) };
    setSelectedTemplateKey(template.key);
    setSettings(nextSettings);
    setTemplateDefinition({ ...createDefaultTemplateDefinition(previewDocument, nextSettings), metadata: { preset: template.key } });
    toast.success(`Patrón ${template.name} aplicado al canvas`);
  };
  const updateTemplateField = (id: string, changes: Partial<PdfTemplateField>) => { if (canModifyActive) setTemplateFields(fields => fields.map(field => field.id === id ? { ...field, ...changes } : field)); };
  const previewDocument = useMemo(() => assignedDocuments.includes(documentType) ? documentType : assignedDocuments[0] || 'ventas.estimate', [assignedDocuments, documentType]);
  const handleCanvasSettingsChange = (changes: Partial<PdfSettings>) => {
    if (!canModifyActive) return;
    const nextSettings = { ...settings, ...changes } as PdfSettings;
    setSettings(nextSettings);
    const structuralChange = ['headerLayout', 'footerLayout', 'tableLayout'].some(key => key in changes);
    if (structuralChange) {
      setSelectedTemplateKey('');
      setTemplateDefinition({ ...createDefaultTemplateDefinition(previewDocument, nextSettings), metadata: { preset: `${nextSettings.headerLayout}-${nextSettings.footerLayout}` } });
      return;
    }
     if (['primaryColor', 'secondaryColor', 'textColor', 'lineColor', 'backgroundColor', 'paperSize', 'orientation'].some(key => key in changes)) {
      setTemplateDefinition(previous => updateDefinitionForSettings(previous, settings, nextSettings));
    }
  };
  const updateLayout = <K extends keyof PdfSettings>(key: K, value: PdfSettings[K]) => handleCanvasSettingsChange({ [key]: value } as Partial<PdfSettings>);
  const moduleTargets = useMemo(() => DOCUMENTS.filter(target => target.module === selectedModule), [selectedModule]);
  const selectTarget = (targetKey: string) => { const target = getPdfTemplateTarget(targetKey); const defaultTemplate = getDefaultLibraryTemplate(); const nextSettings = { ...settings, ...defaultTemplate.settings, footerLayout: footerLayoutForTemplate(defaultTemplate.key) }; setSelectedModule(target.module); setDocumentType(target.key); setAssignedDocuments([target.key]); setSettings(nextSettings); setTemplateDefinition({ ...createDefaultTemplateDefinition(target.key, nextSettings), metadata: { preset: defaultTemplate.key } }); setSelectedTemplateKey(defaultTemplate.key); };
  const selectedTemplateField = templateFields.find(field => field.id === selectedTemplateFieldId) || templateFields[0];
  const selectedTemplateFieldValue = selectedTemplateField ? TEMPLATE_FIELD_SETTINGS[selectedTemplateField.id] : undefined;
  const templateFieldValue = useCallback((field: PdfTemplateField) => {
    const settingKey = TEMPLATE_FIELD_SETTINGS[field.id];
    if (settingKey) {
      const value = String(settings[settingKey] || '').trim();
      if (value) return value;
      if (field.id === 'company') return settings.companyName || companyName || field.sample;
      if (['legal', 'terms', 'notes'].includes(field.id)) return '';
      return field.sample;
    }
    switch (field.id) {
      case 'documentTitle': return documentLabel(previewDocument).toUpperCase();
      case 'documentNumber': return 'DEMO-0001';
      case 'date': return new Date().toLocaleDateString('es-NI');
      case 'customer': return 'Cliente de ejemplo';
      case 'items': return 'Descripción · Cant. · Precio · Total';
      case 'totals': return '$ 345.00';
      default: return field.sample;
    }
  }, [settings, previewDocument, companyName]);
  const updateSelectedFieldValue = (value: string) => {
    if (!selectedTemplateField) return;
    const settingKey = TEMPLATE_FIELD_SETTINGS[selectedTemplateField.id];
    if (settingKey) update(settingKey, value as never);
  };
  const uploadCustomTemplate = async () => {
    if (!hasActiveBranchScope || !canCreate || !pendingTemplateFile || !templateName.trim()) { if (hasActiveBranchScope && canCreate) toast.error('Ingresa un nombre para la plantilla'); return; }
    const uploadDocumentType = pendingTemplateDocumentType || firstAvailableDocumentType(documentType, 'draft');
    const occupiedBy = reservedDocumentDesign(uploadDocumentType, 'draft');
    if (occupiedBy) { toast.error(`«${documentLabel(uploadDocumentType)}» ya está asignado a «${occupiedBy.name}»`); return; }
    setIsUploadingTemplate(true); setTemplateImportError(null);
    try {
      const isHtml = pendingTemplateFile.type === 'text/html' || /\.html?$/i.test(pendingTemplateFile.name);
      const isDocx = pendingTemplateFile.type.includes('wordprocessingml') || /\.docx$/i.test(pendingTemplateFile.name);
      let imported;
      if (isDocx) imported = await importDocxTemplate(pendingTemplateFile, uploadDocumentType, settings);
      else if (isHtml) imported = await importHtmlTemplate(pendingTemplateFile, uploadDocumentType, settings);
      else {
        const extractedLayout = await extractPdfLayout(pendingTemplateFile);
        const definition = definitionFromExtractedPdf(extractedLayout, uploadDocumentType, settings);
        imported = { kind: 'pdf' as const, definition, warnings: definition.metadata?.importWarnings || [] };
      }
      const importedSettings = {
        ...settings,
        ...(imported.definition.page.paperSize ? { paperSize: imported.definition.page.paperSize as PdfSettings['paperSize'] } : {}),
        ...(imported.definition.page.orientation ? { orientation: imported.definition.page.orientation } : {}),
      };
      setSettings(importedSettings);
      setTemplateDefinition(imported.definition); setTemplateImportWarnings(imported.warnings);
      const fileToUpload = imported.sanitizedHtml ? new File([imported.sanitizedHtml], pendingTemplateFile.name.replace(/\.docx$/i, '.html'), { type: 'text/html' }) : pendingTemplateFile;
      const uploaded = await storageService.uploadFile('documents', fileToUpload, { folder: 'pdf-templates', scopeId: tenantId });
      const isPdf = imported.kind === 'pdf';
      const payload = { name: templateName.trim(), description: `Plantilla editable importada desde: ${pendingTemplateFile.name}`, documentTypes: [uploadDocumentType], folderId: selectedFolderId, settings: importedSettings, templateKey: 'custom', sourceType: isPdf ? 'UPLOADED_PDF' as const : 'UPLOADED_HTML' as const, sourceFileUrl: uploaded.uri, sourceFileName: pendingTemplateFile.name, analysisStatus: isPdf ? 'LAYOUT_EXTRACTED' : 'HTML_CONVERTED', layoutZones: { status: isPdf ? 'extracted' : 'semantic-import', expectedZones: ['header', 'body', 'table', 'footer'], definition: imported.definition, ...(imported.sanitizedHtml ? { htmlTemplate: { version: 3, kind: imported.kind, uri: uploaded.uri, provider: 'semantic-import' } } : {}), fields: templateFields }, engine: 'HTML_TEMPLATE', isActive: true };
      const created = await pdfDocumentDesignService.create(payload);
      setDesigns(prev => [created, ...prev]); setActiveId(created.id); setAssignedDocuments([uploadDocumentType]); setDocumentType(uploadDocumentType); setPendingTemplateDocumentType(null); setName(created.name); setDescription(created.description || ''); setSourceMetadata({ sourceType: created.sourceType, sourceFileUrl: created.sourceFileUrl || undefined, sourceFileName: created.sourceFileName || undefined, analysisStatus: created.analysisStatus, layoutZones: created.layoutZones || undefined }); setTemplateModalOpen(false);
      toast.success(`${isPdf ? 'PDF' : isDocx ? 'Word' : 'HTML'} importado como plantilla editable`);
    } catch (error: any) { setTemplateImportError(error?.message || 'No se pudo analizar o cargar la plantilla'); toast.error(error?.message || 'No se pudo analizar o cargar la plantilla'); } finally { setIsUploadingTemplate(false); }
  };
  const openNewFolder = () => { if (!hasActiveBranchScope || !canCreate) return; setEditingFolderId(null); setFolderName(''); setFolderDialogOpen(true); };
  const openEditFolder = (folder: PdfDocumentDesignFolder) => { if (!canEdit) return; setEditingFolderId(folder.id); setFolderName(folder.name); setFolderDialogOpen(true); };
  const saveFolder = async () => { if (!hasActiveBranchScope || (editingFolderId ? !canEdit : !canCreate)) return; if (!folderName.trim()) { toast.error('Escribe un nombre para la carpeta'); return; } setIsSavingFolder(true); try { const folder = editingFolderId ? await pdfDocumentDesignService.updateFolder(editingFolderId, { name: folderName.trim() }) : await pdfDocumentDesignService.createFolder({ name: folderName.trim() }); setFolders(prev => editingFolderId ? prev.map(item => item.id === folder.id ? folder : item) : [...prev, folder].sort((a, b) => a.name.localeCompare(b.name))); setSelectedFolderId(folder.id); setFolderDialogOpen(false); toast.success(editingFolderId ? 'Carpeta actualizada' : 'Carpeta creada'); } catch (error: any) { toast.error(error?.message || 'No se pudo guardar la carpeta'); } finally { setIsSavingFolder(false); } };
  const deleteFolder = (folder: PdfDocumentDesignFolder) => { if (canDelete) setDeleteTarget({ kind: 'folder', record: folder }); };
  const confirmDeletion = async () => {
    if (!deleteTarget || (deleteTarget.kind === 'design' ? !canDelete : !canDelete)) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.kind === 'design') {
        const record = deleteTarget.record;
        await pdfDocumentDesignService.remove(record.id);
        setDesigns(prev => prev.filter(item => item.id !== record.id));
        if (activeId === record.id) createDesign();
        toast.success('Plantilla eliminada');
      } else {
        const folder = deleteTarget.record;
        await pdfDocumentDesignService.removeFolder(folder.id);
        setFolders(prev => prev.filter(item => item.id !== folder.id));
        setDesigns(prev => prev.map(design => design.folderId === folder.id ? { ...design, folderId: null, folder: null } : design));
        if (selectedFolderId === folder.id) setSelectedFolderId(null);
        toast.success('Carpeta eliminada');
      }
      setDeleteTarget(null);
    } catch (error: any) {
      toast.error(error?.message || (deleteTarget.kind === 'design' ? 'No se pudo eliminar la plantilla' : 'No se pudo eliminar la carpeta'));
    } finally { setIsDeleting(false); }
  };
  const uploadLogo = async (file: File) => { if (!canModifyActive) return; if (!file.type.startsWith('image/')) { toast.error('Selecciona una imagen para el logotipo'); return; } try { const uploaded = await storageService.uploadFile('tenant-branding', file, { folder: 'pdf-logos', scopeId: tenantId }); update('logoUrl', uploaded.url); setTemplateDefinition(previous => ensureLogoNode(previous)); toast.success('Logotipo agregado al diseño'); } catch (error: any) { toast.error(error?.message || 'No se pudo cargar el logotipo'); } };
  const chooseTemplateFile = (file: File) => {
    const accepted = file.type === 'application/pdf' || file.type === 'text/html' || file.type.includes('wordprocessingml') || /\.(pdf|html?|docx)$/i.test(file.name);
    if (!accepted) { toast.error('Selecciona un archivo PDF, HTML o Word (.docx)'); return; }
    setPendingTemplateFile(file); setTemplateName(file.name.replace(/\.(pdf|html?|docx)$/i, '').replace(/[-_]+/g, ' ') || 'Nueva plantilla'); setPendingTemplateDocumentType(firstAvailableDocumentType(documentType, 'draft')); setTemplateImportError(null); setTemplateImportWarnings([]); setTemplateModalOpen(true);
  };
  const chooseHtmlSource = () => {
    if (!htmlSource.trim()) { toast.error('Pega primero el código HTML de la plantilla'); return; }
    chooseTemplateFile(new File([htmlSource], 'plantilla-html.html', { type: 'text/html' }));
  };

  const section = (id: string, title: string, icon: React.ElementType, content: React.ReactNode) => { const Icon = icon; return <div className="border-b border-border/40 last:border-b-0"><button type="button" onClick={() => setOpenSection(openSection === id ? '' : id)} className="flex w-full cursor-pointer items-center justify-between gap-3 py-4 text-left"><span className="flex items-center gap-2 text-sm font-black"><Icon className="size-4 text-primary" />{title}</span><ChevronDown className={cn('size-4 text-muted-foreground transition-transform', openSection === id && 'rotate-180')} /></button>{openSection === id && <div className="space-y-4 pb-4">{content}</div>}</div>; };
  const renderDesign = (record: PdfDocumentDesignRecord) => <div key={record.id} className={cn('flex items-center gap-2 rounded-xl border p-2 transition-colors', activeId === record.id ? 'border-primary bg-primary/10' : 'border-border/40 hover:border-primary/40')}><button type="button" onClick={() => loadDesign(record)} className="min-w-0 flex-1 cursor-pointer p-1 text-left"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold">{record.name}</span>{record.isActive && <span className="size-2 shrink-0 rounded-full bg-primary" />}</div><p className="mt-1 truncate text-[11px] text-muted-foreground">{documentLabel(record.documentTypes?.[0] || 'estimate')}</p></button>{canDelete && <Button type="button" variant="ghost" size="icon" title="Eliminar plantilla" className="size-8 shrink-0 cursor-pointer text-destructive hover:text-destructive" onClick={() => deleteDesignRecord(record)}><Trash2 className="size-3.5" /></Button>}</div>;
  const ungroupedDesigns = designs.filter(record => !record.folderId);
  const selectedFolderDesigns = selectedFolderId ? designs.filter(record => record.folderId === selectedFolderId) : [];
  const selectedTarget = getPdfTemplateTarget(previewDocument);
  const selectedFolder = folders.find(folder => folder.id === selectedFolderId);

  return <div className="space-y-6">
    <Card data-tour="pdf-assignment" className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary"><FileCog className="size-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black">Vincular y guardar diseño</h2><Badge variant="outline" className="text-[10px]">{activeId === 'draft' ? 'Borrador' : 'Guardado'}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Define dónde se utiliza este diseño y edita su contenido directamente en el canvas.</p></div></div>
          <div className="flex flex-wrap items-center gap-2 text-[10px]"><Badge variant="outline" className={cn('gap-1.5', hasActiveBranchScope ? 'border-emerald-400/40 text-emerald-600 dark:text-emerald-300' : 'border-amber-400/50 text-amber-700 dark:text-amber-300')}><span className={cn('size-1.5 rounded-full', hasActiveBranchScope ? 'bg-emerald-500' : 'bg-amber-500')} />Sucursal: {hasActiveBranchScope ? activeBranchLabel : 'sin sucursal activa'}</Badge>{selectedFolder && <Badge variant="outline" className="gap-1.5"><Folder className="size-3" />{selectedFolder.name}</Badge>}<Button variant="outline" size="sm" className="h-8 cursor-pointer gap-2" onClick={() => setShowTutorial(true)}><WandSparkles className="size-3.5" />Tutorial</Button></div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Nombre del diseño"><Input value={name} onChange={event => setName(event.target.value)} disabled={!canModifyActive} placeholder="Ej. Factura corporativa" /></Field>
          <Field label="Módulo"><select aria-label="Módulo del documento" value={selectedModule} onChange={event => { const moduleId = event.target.value as typeof selectedModule; setSelectedModule(moduleId); const first = DOCUMENTS.find(target => target.module === moduleId && !reservedDocumentDesign(target.key)); if (first) selectTarget(first.key); }} className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecciona un módulo</option>{PDF_TEMPLATE_MODULES.map(module => <option key={module.id} value={module.id}>{module.label}</option>)}</select></Field>
          <Field label="Vista / acción PDF"><select aria-label="Vista o acción del documento" value={previewDocument} onChange={event => selectTarget(event.target.value)} className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm">{moduleTargets.map(item => { const reservedBy = reservedDocumentDesign(item.key); const isSelected = previewDocument === item.key; return <option key={item.key} value={item.key} disabled={Boolean(reservedBy) && !isSelected}>{item.label}{reservedBy && !isSelected ? ` · En uso por ${reservedBy.name}` : ''}</option>; })}</select></Field>
          <Field label="Carpeta"><div className="flex gap-2"><select aria-label="Carpeta del diseño" value={selectedFolderId || ''} onChange={event => setSelectedFolderId(event.target.value || null)} disabled={!canModifyActive} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"><option value="">Sin carpeta</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><Button type="button" variant="outline" size="icon" title="Nueva carpeta" className="size-9 shrink-0 cursor-pointer" onClick={openNewFolder} disabled={!canModifyActive}><FolderPlus className="size-4" /></Button></div></Field>
        </div>
        <div className="flex flex-col gap-3 border-t border-border/40 pt-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1"><Field label="Descripción"><Input value={description} onChange={event => setDescription(event.target.value)} disabled={!canModifyActive} placeholder="Describe cuándo debe utilizarse" /></Field></div>
          <div className="flex flex-wrap gap-2"><Button type="button" className="cursor-pointer gap-2" onClick={saveDesign} disabled={!hasActiveBranchScope || !canModifyActive || isSaving}>{isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Guardar diseño</Button></div>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-primary/15 bg-background/50 px-3 py-2 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span><span className="font-bold text-primary">{selectedTarget.moduleLabel} · {selectedTarget.label}</span> · {selectedTarget.structure} · {selectedTarget.source}</span><span>La plantilla se guarda vinculada a esta vista y sucursal.</span></div>
      </CardContent>
    </Card>
    <div className="grid gap-5 xl:grid-cols-[270px_minmax(0,1fr)] [&_[data-tour=pdf-editor]]:hidden">
      <div className="space-y-5">
        <Card data-tour="pdf-designs"><CardHeader className="pb-3"><div className="flex items-center justify-between gap-2"><CardTitle className="text-base">Mis diseños</CardTitle><div className="flex items-center gap-1"><Button variant="ghost" size="icon" title="Nueva carpeta" className="size-8 cursor-pointer" onClick={openNewFolder}><FolderPlus className="size-4" /></Button><Button variant="ghost" size="icon" title="Nuevo diseño" className="size-8 cursor-pointer" onClick={createDesign}><Plus className="size-4" /></Button></div></div><CardDescription>Organiza múltiples versiones en carpetas y selecciona el diseño que quieras editar.</CardDescription></CardHeader><CardContent className="space-y-3"><button type="button" onClick={() => setSelectedFolderId(null)} className={cn('flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-bold transition', selectedFolderId === null ? 'border-primary bg-primary/10 text-primary' : 'border-border/40 hover:border-primary/40')}><span className="flex items-center gap-2"><LayoutTemplate className="size-4" />Todos los diseños</span><span className="text-[10px] text-muted-foreground">{designs.length}</span></button>{isLoading ? <Loader2 className="mx-auto size-5 animate-spin text-primary" /> : <>{folders.map(folder => <div key={folder.id} className="space-y-2"><div className={cn('flex items-center gap-1 rounded-lg border px-2 py-1.5', selectedFolderId === folder.id ? 'border-primary/60 bg-primary/5' : 'border-border/40')}><button type="button" onClick={() => setSelectedFolderId(selectedFolderId === folder.id ? null : folder.id)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"><Folder className="size-4 shrink-0 text-primary" /><span className="truncate text-xs font-bold">{folder.name}</span><span className="text-[10px] text-muted-foreground">{designs.filter(record => record.folderId === folder.id).length}</span></button><Button variant="ghost" size="icon" title="Renombrar carpeta" className="size-7 cursor-pointer" onClick={() => openEditFolder(folder)}><Pencil className="size-3" /></Button><Button variant="ghost" size="icon" title="Eliminar carpeta" className="size-7 cursor-pointer text-destructive" onClick={() => deleteFolder(folder)}><Trash2 className="size-3" /></Button></div>{selectedFolderId === folder.id && <div className="space-y-2 pl-3">{selectedFolderDesigns.map(renderDesign)}{!selectedFolderDesigns.length && <p className="rounded-lg border border-dashed border-border/50 p-3 text-center text-[11px] text-muted-foreground">Carpeta vacía. Crea o carga un diseño y asígnalo desde el editor.</p>}</div>}</div>)}{selectedFolderId === null && ungroupedDesigns.map(renderDesign)}{activeId === 'draft' && <div className="rounded-xl border border-primary/50 bg-primary/5 p-3 text-sm font-bold">{name}<p className="text-[11px] font-normal text-muted-foreground">Borrador sin guardar</p></div>}{selectedFolderId === null && !ungroupedDesigns.length && !folders.length && activeId !== 'draft' && <p className="py-4 text-center text-xs text-muted-foreground">Aún no tienes diseños guardados.</p>}</>}</CardContent></Card>
        <Card data-tour="pdf-library" className="overflow-hidden"><button type="button" onClick={() => setLibraryOpen(open => !open)} className="flex w-full cursor-pointer items-center justify-between px-4 py-4 text-left"><span className="flex items-center gap-2 text-base font-black"><LayoutTemplate className="size-4 text-primary" />Biblioteca <Badge variant="outline" className="text-[10px]">{TEMPLATE_LIBRARY.length} patrones</Badge></span><ChevronDown className={cn('size-4 text-muted-foreground transition-transform', libraryOpen && 'rotate-180')} /></button>{libraryOpen && <><CardHeader className="border-t border-border/40 pb-3 pt-3"><CardDescription>Elige una composición visual completa de header, footer, tabla y paleta. La tipografía se mantiene independiente y se ajusta en Estilo o por componente.</CardDescription></CardHeader><CardContent className="space-y-3 pt-0"><div className="grid grid-cols-2 gap-2">{TEMPLATE_LIBRARY.map(template => <button key={template.key} type="button" aria-pressed={selectedTemplateKey === template.key} onClick={() => applyTemplate(template)} className={cn('group rounded-xl border p-1.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md', selectedTemplateKey === template.key ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary))]' : 'border-border/50 bg-background/60')}><TemplatePatternPreview template={template} /><span className="mt-1.5 block truncate px-1 text-[11px] font-black">{template.name}{template.key === DEFAULT_LIBRARY_TEMPLATE_KEY && <span className="text-primary"> · Predeterminado</span>}</span><span className="block truncate px-1 pb-1 text-[10px] text-muted-foreground">{template.description}</span></button>)}</div>{selectedTemplateKey && (() => { const selected = TEMPLATE_LIBRARY.find(template => template.key === selectedTemplateKey); return selected ? <div className="rounded-xl border border-primary/40 bg-primary/5 p-3"><p className="text-sm font-bold text-primary">{selected.name} aplicado</p><p className="mt-1 text-[10px] text-muted-foreground">Haz clic en cualquier componente del canvas para ajustar el detalle. La fuente no cambia al elegir este patrón.</p><div className="mt-2 flex flex-wrap gap-1.5"><Badge variant="outline" className="text-[9px]">Header: {selected.settings.headerLayout}</Badge><Badge variant="outline" className="text-[9px]">Footer: {footerLayoutForTemplate(selected.key)}</Badge><Badge variant="outline" className="text-[9px]">Tabla: {selected.settings.tableLayout}</Badge></div></div> : null; })()}</CardContent></>}</Card>
       <Card data-tour="pdf-upload" className="border-dashed"><CardContent className="space-y-3 p-4"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Upload className="size-4 text-primary" /><p className="text-sm font-bold">Importar plantilla</p></div><Badge variant="outline" className="text-emerald-500">Disponible</Badge></div><p className="text-[11px] text-muted-foreground">Carga un HTML, Word o PDF. El sistema extrae la estructura y la convierte en componentes editables dentro del canvas.</p><input ref={templateInputRef} type="file" accept=".pdf,.html,.htm,.docx,application/pdf,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) chooseTemplateFile(file); event.currentTarget.value = ''; }} /><Button variant="outline" className="w-full cursor-pointer gap-2" onClick={() => templateInputRef.current?.click()} disabled={!canCreate}><Upload className="size-4" />Cargar PDF, HTML o Word</Button><div className="space-y-2 border-t border-border/40 pt-3"><Label htmlFor="pdf-template-html-source" className="text-[11px]">O pega código HTML</Label><Textarea id="pdf-template-html-source" value={htmlSource} onChange={event => setHtmlSource(event.target.value)} placeholder="<html><body><h1>{{document.title}}</h1>...</body></html>" className="min-h-[78px] font-mono text-[10px]" disabled={!canCreate} /><Button variant="ghost" size="sm" className="w-full cursor-pointer gap-2 text-xs" onClick={chooseHtmlSource} disabled={!canCreate || !htmlSource.trim()}><FileText className="size-3.5" />Usar este HTML</Button></div></CardContent></Card>
        <Card data-tour="pdf-assignment-legacy" aria-hidden="true" className="hidden border-primary/20 bg-primary/[0.03]"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><FileCog className="size-4 text-primary" />Asignación y datos</CardTitle><CardDescription className="text-xs">Define la sucursal y la vista a la que pertenece este diseño.</CardDescription></CardHeader><CardContent className="space-y-3 pt-0"><Field label="Nombre"><Input value={name} onChange={event => setName(event.target.value)} /></Field><Field label="Descripción"><Textarea value={description} onChange={event => setDescription(event.target.value)} /></Field><Field label="Carpeta"><select value={selectedFolderId || ''} onChange={event => setSelectedFolderId(event.target.value || null)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Sin carpeta</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></Field><div className="space-y-2"><Label className="text-xs">Vista del documento</Label><select aria-label="Módulo del documento" value={selectedModule} onChange={event => { const moduleId = event.target.value as typeof selectedModule; setSelectedModule(moduleId); const first = DOCUMENTS.find(target => target.module === moduleId && !reservedDocumentDesign(target.key)); if (first) selectTarget(first.key); }} className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm">{PDF_TEMPLATE_MODULES.map(module => <option key={module.id} value={module.id}>{module.label}</option>)}</select><select aria-label="Subvista o tipo de documento" value={previewDocument} onChange={event => selectTarget(event.target.value)} className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm">{moduleTargets.map(item => { const reservedBy = reservedDocumentDesign(item.key); const isSelected = previewDocument === item.key; return <option key={item.key} value={item.key} disabled={Boolean(reservedBy) && !isSelected}>{item.label}{reservedBy && !isSelected ? ` · En uso por ${reservedBy.name}` : ''}</option>; })}</select></div><div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[10px] text-muted-foreground"><span className="font-semibold text-primary">{activeBranchLabel}</span><br />{getPdfTemplateTarget(previewDocument).structure} · {getPdfTemplateTarget(previewDocument).source}</div></CardContent></Card>
       </div>

       <Card data-tour="pdf-preview" className="min-w-0 overflow-hidden bg-muted/10"><CardHeader className="gap-3 border-b border-border/40 pb-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><FileText className="size-4 text-primary" />Canvas y vista previa en vivo</CardTitle><CardDescription>La plantilla se edita por componentes. Los cambios se reflejan al instante y se guardan como definición semántica.</CardDescription></div><Badge variant="outline" className="w-fit gap-1.5"><span className="size-1.5 rounded-full bg-primary" />{sourceMetadata?.analysisStatus === 'HTML_CONVERTED' ? 'HTML / Word importado' : sourceMetadata?.sourceType === 'UPLOADED_PDF' ? 'PDF convertido' : 'Plantilla editable'}</Badge></div><div data-tour="pdf-document-selector" className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Vista asignada</span><span className="text-xs font-bold text-primary">{getPdfTemplateTarget(previewDocument).moduleLabel} · {documentLabel(previewDocument)}</span></div></CardHeader><CardContent className="min-w-0 p-4 md:p-6">{templateImportError && <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-xs text-rose-700 dark:text-rose-300"><p className="font-bold">No se pudo importar completamente</p><p className="mt-1">{templateImportError}</p></div>}{templateImportWarnings.length > 0 && <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-700 dark:text-amber-300"><p className="font-bold">Observaciones de importación</p>{templateImportWarnings.map(warning => <p key={warning} className="mt-1">{warning}</p>)}</div>}<PdfTemplateCanvasEditor definition={templateDefinition} settings={settings} targetKey={previewDocument} logo={settings.logoUrl || logo} data={{ company: { name: settings.companyName || companyName || 'NovaHub', slogan: settings.slogan, fiscalInfo: settings.fiscalInfo, address: settings.address, phone: settings.phone, email: settings.email, website: settings.website, logo: settings.logoUrl || logo }, logo: settings.logoUrl || logo }} onSettingsChange={changes => handleCanvasSettingsChange(changes as Partial<PdfSettings>)} onUploadLogo={uploadLogo} onSave={() => void saveDesign()} onChange={next => { if (canModifyActive) setTemplateDefinition(next); }} /></CardContent></Card>

      <Card data-tour="pdf-editor" aria-hidden="true" className="hidden flex min-h-0 max-h-[850px] min-w-0 flex-col"><CardHeader className="shrink-0 border-b border-border/40 pb-4"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">Configuración del documento</CardTitle><CardDescription>Asigna la vista y define valores globales. El detalle del componente se edita en el inspector del canvas.</CardDescription></div><Button size="icon" variant="outline" className="size-8 cursor-pointer" onClick={saveDesign} disabled={isSaving}>{isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}</Button></div></CardHeader><CardContent className="min-h-0 flex-1 overflow-y-auto pr-3">
        {isUploadedSource && selectedTemplateField && <div className="mb-3 rounded-xl border border-cyan-400/35 bg-cyan-400/5 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-cyan-300">Componente seleccionado</p><p className="mt-1 text-sm font-bold">{selectedTemplateField.label}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{selectedTemplateField.token}</p></div><Badge variant="outline" className="shrink-0">{selectedTemplateFieldValue ? 'Editable' : 'Dato dinámico'}</Badge></div>{selectedTemplateFieldValue ? <div className="mt-3 space-y-2"><Label>Valor vinculado</Label>{['legalText', 'terms', 'defaultNotes'].includes(selectedTemplateFieldValue) ? <Textarea value={templateFieldValue(selectedTemplateField)} onChange={event => updateSelectedFieldValue(event.target.value)} /> : <Input value={templateFieldValue(selectedTemplateField)} onChange={event => updateSelectedFieldValue(event.target.value)} />}</div> : <p className="mt-3 text-[11px] text-muted-foreground">Este valor proviene del documento que se esté generando. Aquí puedes ajustar su posición y tamaño; al exportar se sustituirá con los datos reales.</p>}<p className="mt-3 text-[10px] text-muted-foreground">También puedes seleccionar otra zona directamente sobre la hoja.</p></div>}
        {section('general', 'Identidad y asignación', FileCog, <><Field label="Nombre"><Input value={name} onChange={e => setName(e.target.value)} /></Field><Field label="Descripción"><Textarea value={description} onChange={e => setDescription(e.target.value)} /></Field><Field label="Carpeta"><select value={selectedFolderId || ''} onChange={e => setSelectedFolderId(e.target.value || null)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Sin carpeta</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><p className="text-[10px] text-muted-foreground">Agrupa este diseño junto con otras plantillas.</p></Field><Field label="Vista del documento"><p className="mb-2 text-[10px] text-muted-foreground">Cada plantilla se aplica a un único módulo y subvista real. Si la subvista ya está ocupada, queda bloqueada.</p><div data-tour="pdf-assignment" className="space-y-2"><select aria-label="Módulo del documento" value={selectedModule} onChange={event => { const moduleId = event.target.value as typeof selectedModule; setSelectedModule(moduleId); const first = DOCUMENTS.find(target => target.module === moduleId && !reservedDocumentDesign(target.key)); if (first) selectTarget(first.key); }} className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm">{PDF_TEMPLATE_MODULES.map(module => <option key={module.id} value={module.id}>{module.label}</option>)}</select><select aria-label="Subvista o tipo de documento" value={previewDocument} onChange={event => selectTarget(event.target.value)} className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm">{moduleTargets.map(item => { const reservedBy = reservedDocumentDesign(item.key); const isSelected = previewDocument === item.key; return <option key={item.key} value={item.key} disabled={Boolean(reservedBy) && !isSelected}>{item.label}{reservedBy && !isSelected ? ` · En uso por ${reservedBy.name}` : ''}</option>; })}</select><div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[10px] text-muted-foreground"><span className="font-semibold text-primary">{getPdfTemplateTarget(previewDocument).structure}</span> · {getPdfTemplateTarget(previewDocument).source}</div></div>{!availableDocumentTypes.length && <p className="mt-2 text-[10px] text-amber-500">Todas las vistas ya tienen una plantilla asignada. Elimina o desactiva una para crear otra.</p>}</Field></>)}
        {section('header', 'Encabezado y empresa', PanelTop, <><Field label="Patrón visual del encabezado"><select value={settings.headerLayout} onChange={e => updateLayout('headerLayout', e.target.value as PdfSettings['headerLayout'])} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="classic">Clásico</option><option value="split">Empresa + documento</option><option value="banner">Banda corporativa</option><option value="compact">Compacto</option><option value="ribbon">Cinta lateral</option><option value="topline">Línea superior</option><option value="sidebar">Acento lateral</option><option value="centered">Centrado</option><option value="boxed">Recuadro</option><option value="corner">Acento de esquina</option><option value="editorial">Editorial</option><option value="double-band">Doble banda</option><optgroup label="Patrones creativos"><option value="fluid">Fluido orgánico</option><option value="aurora">Aurora</option><option value="diagonal">Diagonal</option><option value="portal">Portal</option><option value="steps">Escalonado</option><option value="ink">Tinta</option><option value="grid">Retícula</option><option value="ticket">Talón</option></optgroup></select><p className="text-[10px] text-muted-foreground">Al cambiarlo se actualiza la composición completa del canvas.</p></Field><Field label="Posición del logo"><div className="grid grid-cols-3 gap-2">{([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([value, Icon]) => <button key={value} type="button" onClick={() => update('logoPosition', value)} className={cn('flex cursor-pointer items-center justify-center rounded-lg border p-2', settings.logoPosition === value ? 'border-primary bg-primary/10 text-primary' : 'border-border/40')}><Icon className="size-4" /></button>)}</div></Field><Field label="Tamaño del logo" hint={`${settings.logoSize}px`}><input type="range" min="18" max="70" value={settings.logoSize} onChange={e => update('logoSize', Number(e.target.value))} className="w-full accent-primary" /></Field><input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) uploadLogo(file); event.currentTarget.value = ''; }} /><Button type="button" variant="outline" className="w-full cursor-pointer gap-2" onClick={() => logoInputRef.current?.click()}><ImagePlus className="size-4" />Agregar o reemplazar logo</Button><ToggleRow label="Nombre de empresa" description="Muestra el nombre en el encabezado" checked={settings.showCompanyName} onChange={value => update('showCompanyName', value)} /><Field label="Nombre mostrado"><Input value={settings.companyName} placeholder={companyName} onChange={e => update('companyName', e.target.value)} /></Field><Field label="Eslogan"><Input value={settings.slogan} onChange={e => update('slogan', e.target.value)} /></Field><Field label="Información fiscal"><Textarea value={settings.fiscalInfo} onChange={e => update('fiscalInfo', e.target.value)} /></Field><Field label="Dirección"><Input value={settings.address} onChange={e => update('address', e.target.value)} /></Field><div className="grid grid-cols-2 gap-2"><Field label="Teléfono"><Input value={settings.phone} onChange={e => update('phone', e.target.value)} /></Field><Field label="Correo"><Input value={settings.email} onChange={e => update('email', e.target.value)} /></Field></div><Field label="Sitio web"><Input value={settings.website} onChange={e => update('website', e.target.value)} /></Field></>)}
        {section('body', 'Contenido y elementos', FileText, <><Field label="Patrón de tabla de productos"><select value={settings.tableLayout} onChange={e => updateLayout('tableLayout', e.target.value as PdfSettings['tableLayout'])} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="standard">Estándar</option><option value="striped">Filas alternas</option><option value="boxed">Recuadros</option><option value="minimal">Minimalista</option><option value="compact">Compacta</option><option value="accent">Acento en totales</option><option value="ledger">Libro contable</option><option value="cards">Tarjetas</option></select><p className="text-[10px] text-muted-foreground">La tabla del canvas también cambia su cabecera, líneas y filas.</p></Field><Field label="Información bancaria"><Textarea value={settings.bankInfo} placeholder="Banco, cuenta y beneficiario" onChange={e => update('bankInfo', e.target.value)} /></Field><ToggleRow label="Código QR" description="Reserva espacio para el QR" checked={settings.showQr} onChange={value => update('showQr', value)} /><ToggleRow label="Código de barras" description="Reserva espacio para el código" checked={settings.showBarcode} onChange={value => update('showBarcode', value)} /><Field label="Marca de agua"><Input value={settings.watermark} placeholder="BORRADOR" onChange={e => update('watermark', e.target.value)} /></Field></>)}
        {section('footer', 'Pie y textos legales', PanelBottom, <><Field label="Patrón visual del pie"><select value={settings.footerLayout} onChange={e => update('footerLayout', e.target.value as PdfSettings['footerLayout'])} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="line">Línea sobria</option><option value="minimal">Minimalista</option><option value="band">Banda corporativa</option><option value="wave">Ola / doble banda</option><option value="boxed">Recuadro</option><option value="split">Pie dividido</option><optgroup label="Patrones creativos"><option value="layers">Capas orgánicas</option><option value="notch">Muesca dentada</option><option value="dots">Puntos</option></optgroup></select><p className="text-[10px] text-muted-foreground">Este patrón se refleja en el canvas y en el PDF final.</p></Field><Field label="Texto del pie"><Textarea value={settings.footerText} onChange={e => update('footerText', e.target.value)} /></Field><ToggleRow label="Numeración de páginas" description="Página X de Y o formato personalizado" checked={settings.showPageNumber} onChange={value => update('showPageNumber', value)} /><Field label="Formato"><select value={settings.pageNumberFormat} onChange={e => update('pageNumberFormat', e.target.value as PdfSettings['pageNumberFormat'])} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="page-of">Página X de Y</option><option value="number-only">Solo número</option><option value="custom">Personalizado</option></select></Field><Field label="Textos legales"><Textarea value={settings.legalText} onChange={e => update('legalText', e.target.value)} /></Field><Field label="Términos y condiciones"><Textarea value={settings.terms} onChange={e => update('terms', e.target.value)} /></Field><Field label="Observaciones predeterminadas"><Textarea value={settings.defaultNotes} onChange={e => update('defaultNotes', e.target.value)} /></Field></>)}
        {section('style', 'Página, tipografía y color', Palette, <><div className="grid grid-cols-2 gap-2"><Field label="Papel"><select value={settings.paperSize} onChange={e => update('paperSize', e.target.value as PdfSettings['paperSize'])} className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="LETTER">Carta</option><option value="A4">A4</option><option value="OFICIO">Oficio</option><option value="LEGAL">Legal</option><option value="LABEL">Etiqueta 70 × 38 mm</option></select></Field><Field label="Orientación"><select value={settings.orientation} onChange={e => update('orientation', e.target.value as PdfSettings['orientation'])} className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="portrait">Vertical</option><option value="landscape">Horizontal</option></select></Field></div><Field label="Márgenes" hint={`${settings.margins} mm`}><input type="range" min="2" max="28" value={settings.margins} onChange={e => update('margins', Number(e.target.value))} className="w-full accent-primary" /></Field><Field label="Tipografía" hint={`${FONT_OPTIONS.length} familias disponibles`}><select value={settings.fontFamily} onChange={e => update('fontFamily', e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{['Sans serif', 'Serif', 'Monoespaciada', 'Display'].map(group => <optgroup key={group} label={group}>{FONT_OPTIONS.filter(font => font.group === group).map(font => <option key={font.value} value={font.value}>{font.label}</option>)}</optgroup>)}</select></Field><Field label="Paleta"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => update('paletteMode', 'corporate')} className={cn('cursor-pointer rounded-lg border p-2 text-xs font-bold', settings.paletteMode === 'corporate' ? 'border-primary bg-primary/10 text-primary' : 'border-border/40')}>Corporativa</button><button type="button" onClick={() => update('paletteMode', 'independent')} className={cn('cursor-pointer rounded-lg border p-2 text-xs font-bold', settings.paletteMode === 'independent' ? 'border-primary bg-primary/10 text-primary' : 'border-border/40')}>Independiente</button></div></Field><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{([['primaryColor', 'Principal'], ['secondaryColor', 'Secundario'], ['textColor', 'Texto'], ['lineColor', 'Líneas']] as const).map(([key, label]) => <label key={key} className="space-y-1 text-[10px] font-bold text-muted-foreground"><span>{label}</span><FastColorInput value={settings[key]} onChange={value => update(key, value)} className="h-9 w-full cursor-pointer rounded border border-border/50 p-1" /></label>)}</div></>)}
      </CardContent><div data-tour="pdf-save" className="flex shrink-0 gap-2 border-t border-border/40 bg-card px-4 py-3"><Button className="flex-1 cursor-pointer gap-2" onClick={saveDesign} disabled={isSaving}>{isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Guardar diseño</Button>{activeId !== 'draft' && <Button variant="outline" size="icon" className="cursor-pointer text-destructive" onClick={deleteDesign}><Trash2 className="size-4" /></Button>}</div></Card>

      <Dialog open={folderDialogOpen} onOpenChange={open => { if (!isSavingFolder) setFolderDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Folder className="size-5 text-primary" />{editingFolderId ? 'Renombrar carpeta' : 'Nueva carpeta de diseños'}</DialogTitle><DialogDescription>Organiza varias plantillas PDF en un mismo espacio para encontrarlas y reutilizarlas.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label htmlFor="pdf-folder-name">Nombre de la carpeta</Label><Input id="pdf-folder-name" value={folderName} onChange={event => setFolderName(event.target.value)} placeholder="Ej. Documentos comerciales" autoFocus onKeyDown={event => { if (event.key === 'Enter') void saveFolder(); }} /></div>
          <DialogFooter><Button type="button" variant="outline" className="cursor-pointer" onClick={() => setFolderDialogOpen(false)} disabled={isSavingFolder}>Cancelar</Button><Button type="button" className="cursor-pointer gap-2" onClick={saveFolder} disabled={!folderName.trim() || isSavingFolder}>{isSavingFolder ? <Loader2 className="size-4 animate-spin" /> : <FolderPlus className="size-4" />}{editingFolderId ? 'Guardar cambios' : 'Crear carpeta'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templateModalOpen} onOpenChange={open => { if (!isUploadingTemplate) setTemplateModalOpen(open); }}>
        <DialogContent className="flex h-[94vh] max-h-[94vh] !w-[calc(100vw-2rem)] !max-w-[1600px] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border/40 px-6 py-5 pr-14">
            <DialogTitle className="flex items-center gap-2"><FileText className="size-5 text-primary" />Previsualizar plantilla PDF</DialogTitle>
            <DialogDescription>Revisa el diseño original antes de cargarlo y define el nombre con el que aparecerá en tu biblioteca.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-6"><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Composición real</p><p className="text-xs text-muted-foreground">La plantilla queda como fondo y los campos activos se muestran encima.</p></div><Badge variant="outline" className="gap-1.5"><span className="size-1.5 rounded-full bg-primary" />Campos dinámicos</Badge></div>
              <div className="rounded-2xl border border-border/50 bg-muted/10 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Vista del diseño original</p><p className="text-xs text-muted-foreground">Aquí ves el archivo que se va a procesar. El resultado editable se guardará como componentes del canvas.</p></div><Badge variant="outline">Importación editable</Badge></div><div className="flex min-h-[620px] items-start justify-center overflow-auto rounded-xl bg-[#2b2b2b] p-5">{pendingTemplateFile && (pendingTemplateFile.type === 'text/html' || /\.html?$/i.test(pendingTemplateFile.name) ? <HtmlFilePreview source={pendingTemplateFile} fields={templateFields} selectedFieldId={selectedTemplateFieldId} onSelectField={setSelectedTemplateFieldId} /> : /\.docx$/i.test(pendingTemplateFile.name) ? <div className="flex max-w-md flex-col items-center justify-center self-stretch rounded-xl border border-dashed border-slate-600 bg-slate-900/70 p-8 text-center text-slate-300"><FileText className="mb-3 size-10 text-primary" /><p className="text-sm font-bold">Documento Word listo para convertir</p><p className="mt-2 text-xs leading-relaxed text-slate-400">Se leerán sus párrafos y tablas y se convertirán en componentes editables. La vista detallada aparecerá en el canvas después de confirmar la carga.</p></div> : <UploadedTemplatePreview source={pendingTemplateFile} fields={templateFields} selectedFieldId={selectedTemplateFieldId} onSelectField={setSelectedTemplateFieldId} onUpdateField={updateTemplateField} fieldValue={templateFieldValue} />)}</div></div>
            </div>
            <div className="min-w-0 space-y-4">
              <div className="rounded-xl border border-border/40 bg-muted/10 p-4"><p className="text-xs font-black uppercase tracking-widest text-primary">Archivo seleccionado</p><p className="mt-2 break-words text-sm font-semibold">{pendingTemplateFile?.name || 'Sin archivo'}</p><p className="mt-1 text-xs text-muted-foreground">{pendingTemplateFile ? `${(pendingTemplateFile.size / 1024 / 1024).toFixed(2)} MB` : ''}</p><div className="mt-4 space-y-2"><Label htmlFor="pdf-template-name">Nombre de la plantilla</Label><Input id="pdf-template-name" value={templateName} onChange={event => setTemplateName(event.target.value)} placeholder="Ej. Factura corporativa 2026" autoFocus /></div><div className="mt-4 space-y-2"><Label htmlFor="pdf-template-document">Vista del documento</Label><select id="pdf-template-document" value={pendingTemplateDocumentType || ''} onChange={event => setPendingTemplateDocumentType(event.target.value as PdfDocumentType)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{DOCUMENTS.map(item => { const reservedBy = reservedDocumentDesign(item.key, 'draft'); return <option key={item.key} value={item.key} disabled={Boolean(reservedBy)}>{item.label}{reservedBy ? ` · En uso por ${reservedBy.name}` : ''}</option>; })}</select><p className="text-[10px] text-muted-foreground">Solo puedes asignar una vista libre. Las vistas ocupadas no se pueden seleccionar.</p></div><div className="mt-4 space-y-2"><Label htmlFor="pdf-template-folder">Carpeta destino</Label><select id="pdf-template-folder" value={selectedFolderId || ''} onChange={event => setSelectedFolderId(event.target.value || null)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Sin carpeta</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></div></div>
              <div className="rounded-xl border border-border/40 bg-muted/10 p-4"><div className="flex items-center justify-between gap-2"><div><p className="text-sm font-black">Campos del ERP</p><p className="text-[11px] text-muted-foreground">Activa los campos que realmente se imprimirán.</p></div><Badge variant="outline">{templateFields.filter(field => field.enabled).length}/{templateFields.length}</Badge></div><div className="mt-3 max-h-[330px] space-y-2 overflow-y-auto pr-1">{templateFields.map(field => <button type="button" key={field.id} onClick={() => { setSelectedTemplateFieldId(field.id); updateTemplateField(field.id, { enabled: !field.enabled }); }} className={cn('flex w-full cursor-pointer items-start gap-2 rounded-lg border p-2 text-left transition', field.enabled ? 'border-primary/40 bg-primary/5' : 'border-border/40 opacity-60')}><span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border text-[10px]', field.enabled ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40')}>{field.enabled ? '✓' : ''}</span><span className="min-w-0"><span className="block truncate text-xs font-bold">{field.label}</span><span className="block truncate font-mono text-[10px] text-primary/80">{field.token}</span><span className="block truncate text-[10px] text-muted-foreground">Ejemplo: {field.sample}</span></span></button>)}</div></div>
              {selectedTemplateField && <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-4"><p className="text-xs font-black uppercase tracking-widest text-cyan-300">Propiedades del campo</p><p className="mt-1 text-sm font-bold">{selectedTemplateField.label}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{selectedTemplateField.token}</p><p className="mt-2 text-[11px] text-muted-foreground">Arrástralo directamente sobre la hoja o ajusta sus medidas aquí.</p><div className="mt-4 grid grid-cols-2 gap-3"><Field label="Horizontal"><input type="range" min="0" max={100 - selectedTemplateField.width} value={selectedTemplateField.x} onChange={event => updateTemplateField(selectedTemplateField.id, { x: Number(event.target.value) })} className="w-full accent-primary" /><span className="text-[10px] text-muted-foreground">{selectedTemplateField.x}%</span></Field><Field label="Vertical"><input type="range" min="0" max={100 - selectedTemplateField.height} value={selectedTemplateField.y} onChange={event => updateTemplateField(selectedTemplateField.id, { y: Number(event.target.value) })} className="w-full accent-primary" /><span className="text-[10px] text-muted-foreground">{selectedTemplateField.y}%</span></Field><Field label="Ancho"><input type="range" min="8" max={100 - selectedTemplateField.x} value={selectedTemplateField.width} onChange={event => updateTemplateField(selectedTemplateField.id, { width: Number(event.target.value) })} className="w-full accent-primary" /><span className="text-[10px] text-muted-foreground">{selectedTemplateField.width}%</span></Field><Field label="Alto"><input type="range" min="4" max={100 - selectedTemplateField.y} value={selectedTemplateField.height} onChange={event => updateTemplateField(selectedTemplateField.id, { height: Number(event.target.value) })} className="w-full accent-primary" /><span className="text-[10px] text-muted-foreground">{selectedTemplateField.height}%</span></Field></div></div>}
            </div>
          </div></div>
          <DialogFooter className="border-t border-border/40 bg-card px-6 py-4"><div className="flex w-full items-center justify-between gap-3"><p className="hidden text-xs text-muted-foreground md:block">Los campos se guardan como zonas editables de la plantilla.</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setTemplateModalOpen(false)} disabled={isUploadingTemplate}>Cancelar</Button><Button type="button" onClick={uploadCustomTemplate} disabled={!pendingTemplateFile || !templateName.trim() || isUploadingTemplate} className="gap-2">{isUploadingTemplate ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}Confirmar carga</Button></div></div></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open && !isDeleting) setDeleteTarget(null); }} title={deleteTarget?.kind === 'design' ? '¿Eliminar plantilla?' : '¿Eliminar carpeta?'} description={deleteTarget?.kind === 'design' ? `La plantilla «${deleteTarget.record.name}» y sus archivos asociados se eliminarán. Esta acción no se puede deshacer.` : `La carpeta «${deleteTarget?.record.name || ''}» se eliminará; sus plantillas quedarán sin carpeta.`} confirmLabel="Eliminar" cancelLabel="Cancelar" variant="destructive" loading={isDeleting} onConfirm={confirmDeletion} />
      {showTutorial && <GuidedTour steps={PDF_DESIGN_TOUR_STEPS} onClose={() => setShowTutorial(false)} title="Documentos PDF" allowTargetInteraction />}
    </div>
  </div>;
}
