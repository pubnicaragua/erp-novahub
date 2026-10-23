import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import JsBarcode from 'jsbarcode';
import {
  Building2, Check, ChevronDown, Download, Eye, FileText, Folder, FolderPlus, ImagePlus, LayoutTemplate, Loader2,
  PanelBottom, Pencil, Plus, Trash2, Upload
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { cn } from '../ui/utils';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { toast } from '@/app/services/toast';
import { storageService } from '../../services/storage.service';
import { pdfDocumentDesignService as branchPdfDocumentDesignService, type PdfCompanyProfile, type PdfCuratedTemplatePreflight, type PdfCuratedTemplateRecord, type PdfCuratedTemplateRevision, type PdfCuratedTemplateScope, type PdfDocumentDesignFolder, type PdfDocumentDesignRecord, type PdfDocumentType } from '../../services/pdf-document-design.service';
import { canEditPdfTemplate, getPdfTemplateTarget, isPdfTemplateFixed, normalizePdfTemplateKey, PDF_TEMPLATE_MODULES, PDF_TEMPLATE_TARGETS } from '../../services/pdf-document-catalog';
import { applyStandardPdfLayoutSettings, createDefaultTemplateDefinition, createPdfTemplateSampleData, createSystemDefaultPdfSettings, ensureDashboardChartNodes, hasCurrentStandardPdfLayout, isPurchasePdfLayoutTarget, isSalesPdfLayoutTarget, normalizePdfCompanySettings, normalizePdfPaperSettings, PURCHASE_PDF_LAYOUT_VERSION, salesPdfLayoutVersionForTarget, sanitizeTemplateDefinition, type PdfHeaderComposition, type PdfHeaderContentSpacing, type PdfTemplateDefinition, type PdfTemplateNode } from '../../services/pdf-template-definition';
import { normalizePdfFrameGeometry } from '../../services/pdf-document-style';
import { PDF_STYLE_PRESETS } from '../../services/pdf-document-style';
import { clearPdfDesignCache, resolveCuratedPaperFormat } from '../../utils/pdfGenerator';
import { renderPdfTemplateToPdf } from '../../utils/pdf-template-renderer';
import { PdfLivePreview } from './PdfLivePreview';
import { PdfAppearanceSettingsPanel } from './PdfAppearanceSettingsPanel';
import { clearPdfAppearanceFallback, PDF_CURATED_TEMPLATE_TARGETS, PDF_DEFAULT_TEMPLATE_ID, PDF_DOCUMENT_TEMPLATES, resetPdfAppearanceOverride, resolveCuratedTemplateAppearanceOverrides, resolvePdfDesignAppearance, updatePdfAppearanceDraft, type PdfAppearanceDraftKey, type PdfAppearanceDraftScope, type PdfAppearanceOverrides, type PdfAppearanceProfile, type PdfAppearanceProfilePatch, type PdfCuratedTemplateSelection } from '../../services/pdf-appearance';
import { getBase64Image } from '../../utils/export-utils';

const DOCUMENTS = PDF_TEMPLATE_TARGETS.filter(target => target.branchCustomizable !== false);

type CuratedPreviewSelection = {
  templateId: string;
  revisionId: string;
  targetKey: string;
  scope: PdfCuratedTemplateScope;
  overrides: PdfCuratedTemplateSelection['overrides'];
};

type PendingCuratedPackage = {
  file: File;
  templateId?: string;
  preflight: PdfCuratedTemplatePreflight;
};

type PdfSettings = {
  paperSize: 'LETTER' | 'A4' | 'OFICIO' | 'LEGAL' | 'LABEL' | 'ROLL-80'; orientation: 'portrait' | 'landscape';
  headerLayout: 'classic' | 'split' | 'banner' | 'compact' | 'ribbon' | 'topline' | 'sidebar' | 'centered' | 'boxed' | 'corner' | 'editorial' | 'double-band' | 'fluid' | 'aurora' | 'diagonal' | 'portal' | 'steps' | 'ink' | 'grid' | 'ticket';
  headerComposition: PdfHeaderComposition;
  headerContentSpacing: PdfHeaderContentSpacing;
  pdfDocumentTemplateId?: string;
  footerLayout: 'line' | 'minimal' | 'band' | 'wave' | 'boxed' | 'split' | 'layers' | 'notch' | 'dots';
  tableLayout: 'standard' | 'striped' | 'boxed' | 'minimal' | 'compact' | 'accent' | 'ledger' | 'cards';
  logoPosition: 'left' | 'center' | 'right'; logoSize: number; logoUrl?: string; templateLogoUrl?: string; templateLogoUri?: string; templateLogoTarget?: string; showCompanyName: boolean; companyName: string;
  slogan: string; fiscalInfo: string; address: string; phone: string; email: string; website: string; bankInfo: string;
  showQr: boolean; showBarcode: boolean; watermark: string; watermarkOpacity: number; footerText: string;
  showPageNumber: boolean; pageNumberFormat: 'page-of' | 'number-only' | 'custom'; pageNumberCustom: string;
  legalText: string; terms: string; defaultNotes: string; margins: number; fontFamily: string;
  fontSize: number; primaryColor: string; secondaryColor: string; textColor: string; lineColor: string; backgroundColor: string; separator: 'solid' | 'dashed' | 'none';
  paletteMode: 'corporate' | 'independent';
  curatedTemplateSelection?: PdfCuratedTemplateSelection;
};

const DEFAULT_SETTINGS: PdfSettings = { ...createSystemDefaultPdfSettings(), headerComposition: 'company-left-logo-right' } as PdfSettings;

function createDefaultPdfCompanyProfile(name = '', logo = ''): PdfCompanyProfile {
  return { name, slogan: '', fiscalInfo: '', address: '', phone: '', email: '', website: '', logo };
}

function ensureLogoNode(definition: PdfTemplateDefinition) {
  const hasLogoNode = definition.nodes.some(node => node.id === 'company-logo');
  if (hasLogoNode) return { ...definition, nodes: definition.nodes.map(node => node.id === 'company-logo' ? { ...node, enabled: true } : node) };
  const logoNode: PdfTemplateNode = { id: 'company-logo', type: 'image', label: 'Logotipo', x: 8, y: 7, width: 16, height: 8, enabled: true, borderStyle: 'none', backgroundColor: 'transparent' };
  return { ...definition, nodes: [logoNode, ...definition.nodes] };
}

function createEditorDefaultDefinition(targetKey: PdfDocumentType, settings: Record<string, unknown>, corporateLogo?: string | null) {
  return createDefaultTemplateDefinition(targetKey, applyStandardPdfLayoutSettings(targetKey, {
    ...settings,
    // El logo corporativo es el fallback visual. El override persistido vive
    // en templateLogoUrl y pertenece únicamente a esta plantilla.
    logoUrl: settings.templateLogoUrl || corporateLogo || undefined,
  }));
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

function documentLabel(id: PdfDocumentType) { return getPdfTemplateTarget(id).label; }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0 space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function ToggleRow({ label, description, checked, onChange, disabled }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/50 p-3">
    <div className="min-w-0"><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{description}</p></div>
    <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
  </div>;
}

const PDF_DESIGN_TOUR_STEPS: GuidedTourStep[] = [
  { target: '[data-tour="pdf-designs"]', title: 'Diseños guardados', description: 'Selecciona un diseño existente o crea uno nuevo para el documento que quieras configurar.', placement: 'right' },
  { target: '[data-tour="pdf-assignment"]', title: 'Asignación', description: 'Elige el módulo y la vista PDF donde se guardará este diseño.', placement: 'bottom' },
  { target: '[data-tour="pdf-company-identity"]', title: 'Identidad de empresa', description: 'El nombre, logotipo y contacto se comparten entre los PDF del alcance actual. La composición del encabezado se elige por documento.', placement: 'bottom' },
  { target: '[data-tour="pdf-footer-settings"]', title: 'Texto del pie', description: 'Define el texto y la numeración del documento.', placement: 'bottom' },
  { target: '[data-tour="pdf-fields"]', title: 'Datos del ERP', description: 'Activa o desactiva la información dinámica que se imprime, sin cambiar su orden ni su estructura.', placement: 'left' },
  { target: '[data-tour="pdf-save"]', title: 'Guardar', description: 'Guarda el diseño de este PDF o confirma los cambios de apariencia para todo el alcance actual.', placement: 'bottom' },
];

const CURATED_TARGET_SET = new Set<string>(PDF_CURATED_TEMPLATE_TARGETS);
const PDF_FOOTER_APPEARANCE_KEYS = ['footerText', 'showPageNumber', 'pageNumberFormat', 'pageNumberCustom'] as const;
const PDF_FOOTER_APPEARANCE_KEY_SET = new Set<string>(PDF_FOOTER_APPEARANCE_KEYS);
const CURATED_PREVIEW_TARGET_PRIORITY = ['ventas.invoice', 'compras.supplier-invoice', 'ventas.estimate', 'ventas.order', 'compras.purchase-order', 'compras.purchase-record'];

function preferredCuratedPreviewTarget(supportedTargets: string[]) {
  return CURATED_PREVIEW_TARGET_PRIORITY.find(target => supportedTargets.includes(target)) || supportedTargets[0] || '';
}

function curatedTargetsForRevision(revision: PdfCuratedTemplateRevision | null | undefined) {
  if (!revision) return [];
  if (Array.isArray(revision.compatibleTargets)) {
    return revision.compatibleTargets.map(target => target.targetKey).filter(target => CURATED_TARGET_SET.has(target));
  }
  return revision.manifest.documentTypes.filter(target => CURATED_TARGET_SET.has(target));
}

function curatedTargetLabel(targetKey: string, includeModule = false) {
  const target = getPdfTemplateTarget(targetKey);
  return includeModule ? `${target.moduleLabel} · ${target.label}` : target.label;
}

function curatedFormatForTarget(targetKey: string, configuredPaperSize: unknown) {
  const target = getPdfTemplateTarget(targetKey);
  if (target.family === 'label') return 'label' as const;
  if (target.family === 'cash-ticket') return 'roll-80' as const;
  return resolveCuratedPaperFormat('configured', configuredPaperSize);
}

function groupCuratedTargetsByModule(targetKeys: string[]) {
  const groups = new Map<string, string[]>();
  for (const targetKey of targetKeys) {
    const target = getPdfTemplateTarget(targetKey);
    groups.set(target.moduleLabel, [...(groups.get(target.moduleLabel) || []), target.label]);
  }
  return [...groups.entries()];
}

const PREPARED_PDF_PACKAGES = [
  { id: 'blue-waves', name: 'Ondas azules', description: 'Curvas azules arriba y abajo.', primary: '#164b91', secondary: '#347cb4' },
  { id: 'dental-curve', name: 'Curva clínica', description: 'Cabecera azul curva para servicios.', primary: '#1d4d91', secondary: '#327ab8' },
  { id: 'lavender-editorial', name: 'Editorial lavanda', description: 'Fondo cálido con marcos lavanda.', primary: '#8587c5', secondary: '#b8b9df' },
  { id: 'indigo-sides', name: 'Bordes índigo', description: 'Acentos redondeados en los laterales.', primary: '#29336f', secondary: '#aeb4df' },
  { id: 'teal-clinic', name: 'Clínica turquesa', description: 'Cabecera ondulada y tabla turquesa.', primary: '#2e70a2', secondary: '#b8e0d8' },
  { id: 'green-ribbons', name: 'Cintas verdes', description: 'Bandas laterales translúcidas.', primary: '#2e658f', secondary: '#c5e2dc' },
] as const;

async function toCuratedPreviewData(data: Record<string, any>) {
  const imageData = async (value: unknown) => {
    const source = typeof value === 'string' ? value.trim() : '';
    if (!source) return '';
    if (/^data:image\/(?:png|jpeg|webp);base64,/i.test(source)) return source;
    return await getBase64Image(source) || '';
  };
  const company = data.company && typeof data.company === 'object' ? data.company : {};
  const logo = await imageData(company.logo || data.logo);
  const product = data.product && typeof data.product === 'object' ? data.product as Record<string, any> : null;
  const barcode = String(product?.barcode || product?.code || '').trim();
  const barcodeImages: Record<string, string> = {};
  if (product && barcode) {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, barcode, { format: 'CODE128', displayValue: false, height: 36, width: 1.5, margin: 2, background: '#ffffff' });
      barcodeImages[barcode] = canvas.toDataURL('image/png');
    } catch {
      // La muestra conserva el código legible aunque el dato no forme un código de barras válido.
    }
  }
  return { ...data, logo, company: { ...company, logo }, ...(product ? { product, barcodeImages } : {}) };
}

function createCuratedPreviewData(targetKey: string, companyProfile: PdfCompanyProfile, footerText: string, logo: string) {
  const sample = createPdfTemplateSampleData(targetKey);
  return {
    ...sample,
    company: { ...sample.company, ...companyProfile, footerText, logo },
    pdfCompanyProfile: companyProfile,
    logo,
  };
}

export function PdfDocumentCustomizer({ tenantId, branchName = '', companyName = '', corporateColor = '#10b981', logo, canEdit = true, canCreate = true, canImport = false, canDelete = true, managerScope = false, designService }: { tenantId?: string; branchName?: string; companyName?: string; corporateColor?: string; logo?: string | null; canEdit?: boolean; canCreate?: boolean; canImport?: boolean; canDelete?: boolean; managerScope?: boolean; designService?: typeof branchPdfDocumentDesignService }) {
  const pdfDocumentDesignService = designService || branchPdfDocumentDesignService;
  const documentTargets = managerScope ? PDF_TEMPLATE_TARGETS.filter(target => target.module === 'manager') : DOCUMENTS;
  const documentModules = managerScope ? PDF_TEMPLATE_MODULES.filter(module => module.id === 'manager') : PDF_TEMPLATE_MODULES;
  const defaultDocumentType = managerScope ? 'manager.overview.overview.pdf' : 'ventas.estimate';
  const scopeKind = managerScope ? 'manager-group' : 'branch';
  const documentViewStorageKey = `novahub.pdf-customizer.view.${scopeKind}.${tenantId || 'current'}.${branchName || 'default'}`;
  const [designs, setDesigns] = useState<PdfDocumentDesignRecord[]>([]);
  const [curatedTemplates, setCuratedTemplates] = useState<PdfCuratedTemplateRecord[]>([]);
  const [curatedBusy, setCuratedBusy] = useState(false);
  const [previewedCuratedRevisions, setPreviewedCuratedRevisions] = useState<Record<string, boolean>>({});
  const [curatedPreviewTargets, setCuratedPreviewTargets] = useState<Record<string, string>>({});
  const [previewedCuratedSelection, setPreviewedCuratedSelection] = useState<CuratedPreviewSelection | null>(null);
  const [pendingCuratedSave, setPendingCuratedSave] = useState<CuratedPreviewSelection | null>(null);
  const [pendingCuratedPackage, setPendingCuratedPackage] = useState<PendingCuratedPackage | null>(null);
  const [isCuratedPackagePreflightOpen, setIsCuratedPackagePreflightOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');
  const [curatedOverridesDraft, setCuratedOverridesDraft] = useState<PdfCuratedTemplateSelection['overrides']>({});
  const curatedPackageInputRef = useRef<HTMLInputElement>(null);
  const curatedImportTargetIdRef = useRef<string | undefined>(undefined);
  const [folders, setFolders] = useState<PdfDocumentDesignFolder[]>([]);
  const [activeId, setActiveId] = useState('draft');
  const [documentType, setDocumentType] = useState<PdfDocumentType>(() => {
    try {
      const stored = window.localStorage.getItem(documentViewStorageKey);
      return stored && documentTargets.some(target => target.key === stored) ? stored as PdfDocumentType : defaultDocumentType;
    } catch {
      return defaultDocumentType;
    }
  });
  const [selectedModule, setSelectedModule] = useState(managerScope ? 'manager' : PDF_TEMPLATE_MODULES[0]?.id || 'ventas');
  const [settings, setSettings] = useState<PdfSettings>({ ...DEFAULT_SETTINGS, companyName, primaryColor: corporateColor });
  const [appearanceProfile, setAppearanceProfile] = useState<Partial<PdfAppearanceProfile>>({});
  const appearanceProfileRef = useRef<Partial<PdfAppearanceProfile>>({});
  const savedAppearanceProfileRef = useRef<Partial<PdfAppearanceProfile>>({});
  const [appearanceOverrides, setAppearanceOverrides] = useState<Partial<PdfAppearanceOverrides>>({});
  const [appearanceOverridesExplicit, setAppearanceOverridesExplicit] = useState(false);
  const [appearanceScope, setAppearanceScope] = useState<PdfAppearanceDraftScope>('document');
  const [activatingDesignId, setActivatingDesignId] = useState<string | null>(null);
  const [isRestoringDefault, setIsRestoringDefault] = useState(false);
  const [isSavingAppearance, setIsSavingAppearance] = useState(false);
  const [isSavingFooterProfile, setIsSavingFooterProfile] = useState(false);
  const [globalSaveKind, setGlobalSaveKind] = useState<'appearance' | 'footer' | 'curated' | null>(null);
  const [companyProfile, setCompanyProfile] = useState<PdfCompanyProfile>(() => createDefaultPdfCompanyProfile(companyName, logo || ''));
  const [hasSavedCompanyProfile, setHasSavedCompanyProfile] = useState(false);
  const [isSavingCompanyProfile, setIsSavingCompanyProfile] = useState(false);
  const [name, setName] = useState('Nuevo diseño · Cotizaciones');
  const [description, setDescription] = useState('Datos y asignación para Cotizaciones.');
  const [assignedDocuments, setAssignedDocuments] = useState<PdfDocumentType[]>(() => {
    try {
      const stored = window.localStorage.getItem(documentViewStorageKey);
      return stored && documentTargets.some(target => target.key === stored) ? [stored as PdfDocumentType] : [defaultDocumentType];
    } catch {
      return [defaultDocumentType];
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [templateFields, setTemplateFields] = useState<PdfTemplateField[]>(() => createTemplateFields(companyName));
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'design'; record: PdfDocumentDesignRecord } | { kind: 'folder'; record: PdfDocumentDesignFolder } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const [templateDefinition, setTemplateDefinition] = useState<PdfTemplateDefinition>(() => {
    let initialType: PdfDocumentType = defaultDocumentType;
    try {
      const stored = window.localStorage.getItem(documentViewStorageKey);
      if (stored && documentTargets.some(target => target.key === stored)) initialType = stored as PdfDocumentType;
    } catch { /* almacenamiento no disponible */ }
    return createEditorDefaultDefinition(initialType, { ...DEFAULT_SETTINGS, companyName }, logo);
  });
  const [resolvedTemplateLogo, setResolvedTemplateLogo] = useState<{ source: string; url: string }>({ source: '', url: '' });
  const [resolvedCompanyLogo, setResolvedCompanyLogo] = useState<{ source: string; url: string }>({ source: '', url: '' });
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPreviewRendering, setIsPreviewRendering] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [activeMobilePanel, setActiveMobilePanel] = useState<'assignment' | 'preview' | 'settings'>('preview');
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const previewObjectUrlRef = useRef<string | null>(null);
  const [sourceMetadata, setSourceMetadata] = useState<{ sourceType: string; sourceFileUrl?: string; sourceFileName?: string; analysisStatus?: string; layoutZones?: Record<string, any> } | null>(null);

  useEffect(() => {
    try { window.localStorage.setItem(documentViewStorageKey, documentType); } catch { /* almacenamiento no disponible */ }
  }, [documentType, documentViewStorageKey]);

  useEffect(() => {
    const target = getPdfTemplateTarget(documentType);
    setSelectedModule(target.module);
  }, [documentType]);

  useEffect(() => {
    const source = String(settings.templateLogoUri || settings.templateLogoUrl || '').trim();
    if (!source) return;
    let cancelled = false;
    void storageService.resolveUrl(source)
      .then(url => { if (!cancelled) setResolvedTemplateLogo({ source, url: url || (source.startsWith('storage://') ? '' : source) }); })
      .catch(() => { if (!cancelled) setResolvedTemplateLogo({ source, url: source.startsWith('storage://') ? '' : source }); });
    return () => { cancelled = true; };
  }, [settings.templateLogoUri, settings.templateLogoUrl]);

  useEffect(() => {
    const source = String(companyProfile.logo || '').trim();
    if (!source) {
      setResolvedCompanyLogo({ source: '', url: '' });
      return;
    }
    let cancelled = false;
    void storageService.resolveUrl(source)
      .then(url => { if (!cancelled) setResolvedCompanyLogo({ source, url: url || (source.startsWith('storage://') ? '' : source) }); })
      .catch(() => { if (!cancelled) setResolvedCompanyLogo({ source, url: source.startsWith('storage://') ? '' : source }); });
    return () => { cancelled = true; };
  }, [companyProfile.logo]);

  const hasActiveBranchScope = Boolean(String(tenantId || '').trim());
  const canEditCompanyProfile = hasActiveBranchScope && canEdit;
  const activeBranchLabel = managerScope ? companyName || 'Grupo empresarial' : branchName || companyName || 'Sucursal actual';
  const pdfSharedScope = managerScope ? 'grupo empresarial' : 'sucursal';
  const pdfSharedScopePhrase = managerScope ? 'este grupo empresarial' : 'esta sucursal';
  const branchScopeRef = useRef<string | null>(null);
  const resetDraftForScope = useCallback((preferredDocumentType?: PdfDocumentType) => {
    let storedDocumentType: PdfDocumentType | undefined;
    try {
      const stored = window.localStorage.getItem(documentViewStorageKey);
      if (stored && documentTargets.some(target => target.key === stored)) storedDocumentType = stored as PdfDocumentType;
    } catch { /* almacenamiento no disponible */ }
    const target = getPdfTemplateTarget(preferredDocumentType || storedDocumentType || defaultDocumentType);
    const nextSettings = {
      ...DEFAULT_SETTINGS,
      companyName,
      primaryColor: corporateColor || DEFAULT_SETTINGS.primaryColor,
    };
    const normalizedSettings = normalizePdfPaperSettings(target.key, nextSettings) as typeof nextSettings;
    setActiveId('draft');
    setSelectedFolderId(null);
    setName(`Nuevo diseño · ${target.label}`);
    setDescription(`Datos y asignación para ${target.label}; editable para ${managerScope ? 'el grupo empresarial' : 'esta sucursal'}.`);
    setAssignedDocuments([target.key]);
    setDocumentType(target.key);
    setSelectedModule(target.module);
    setAppearanceOverrides({});
    setAppearanceOverridesExplicit(false);
    setSettings(normalizedSettings);
    setTemplateFields(createTemplateFields(companyName));
    setTemplateDefinition(createEditorDefaultDefinition(target.key, normalizedSettings, logo));
    setSourceMetadata(null);
  }, [companyName, corporateColor, defaultDocumentType, documentViewStorageKey, logo, managerScope]);
  const loadDesign = useCallback((record: PdfDocumentDesignRecord, profile = appearanceProfileRef.current) => {
    if (record.clientTenantId && record.clientTenantId !== tenantId) return;
    const storedFields = (record.layoutZones as any)?.fields;
    const assignedDocument = normalizePdfTemplateKey(record.documentTypes?.[0] || defaultDocumentType);
    const target = getPdfTemplateTarget(assignedDocument);
    const storedDefinition = (record.layoutZones as any)?.definition;
    const isLegacyStandardDesign = (isSalesPdfLayoutTarget(target.key) || isPurchasePdfLayoutTarget(target.key)) && !hasCurrentStandardPdfLayout(target.key, storedDefinition);
    const storedSettings = normalizePdfCompanySettings((record.settings || {}) as Record<string, unknown>) as Partial<PdfSettings>;
    setAppearanceOverridesExplicit(Object.prototype.hasOwnProperty.call(record.settings || {}, 'appearanceOverrides'));
    const resolvedAppearance = resolvePdfDesignAppearance(
      storedSettings as Record<string, unknown>,
      storedDefinition,
      profile,
    );
    setAppearanceOverrides(resolvedAppearance.overrides);
    const storedLogoTarget = String(storedSettings.templateLogoTarget || '').trim();
    const templateLogoTarget = storedLogoTarget ? normalizePdfTemplateKey(storedLogoTarget) : undefined;
    const templateLogoOverride = !isLegacyStandardDesign && templateLogoTarget === assignedDocument
      ? String(storedSettings.templateLogoUrl || '').trim() || undefined
      : undefined;
    const templateLogoUri = !isLegacyStandardDesign && templateLogoTarget === assignedDocument
      ? String(storedSettings.templateLogoUri || '').trim() || undefined
      : undefined;
    const mergedSettings = applyStandardPdfLayoutSettings(assignedDocument, normalizePdfPaperSettings(assignedDocument, {
      ...DEFAULT_SETTINGS,
      companyName,
      primaryColor: corporateColor || DEFAULT_SETTINGS.primaryColor,
      ...(!isLegacyStandardDesign ? storedSettings : {}),
      // logoUrl fue usado por versiones anteriores para mezclar el logo
      // corporativo con el diseño. Se ignora para que esas plantillas vuelvan
      // al logo corporativo; los nuevos overrides quedan aislados por diseño.
      logoUrl: undefined,
      templateLogoUrl: templateLogoOverride,
      templateLogoUri,
      templateLogoTarget: templateLogoOverride || templateLogoUri ? templateLogoTarget : undefined,
    }) as Partial<PdfSettings> & PdfSettings);
    setActiveId(record.id); setSelectedFolderId(record.folderId || null);
    setName(isLegacyStandardDesign ? `Predeterminado del ERP · ${target.label}` : record.name);
    setDescription(isLegacyStandardDesign ? 'Estructura estándar de NovaHub; lista para personalizar y guardar.' : record.description || '');
    setAssignedDocuments([assignedDocument]); setDocumentType(assignedDocument); setSelectedModule(target.module); setSettings(mergedSettings);
    setTemplateFields(isLegacyStandardDesign ? createTemplateFields(companyName) : normalizeTemplateFields(storedFields, companyName));
    const loadedDefinition = isLegacyStandardDesign
      ? createEditorDefaultDefinition(assignedDocument, mergedSettings as Record<string, unknown>, logo)
      : sanitizeTemplateDefinition(storedDefinition, assignedDocument, mergedSettings);
    const definition = normalizePdfFrameGeometry(ensureDashboardChartNodes(loadedDefinition, assignedDocument, mergedSettings));
    setTemplateDefinition(mergedSettings.templateLogoUrl || logo ? ensureLogoNode(definition) : definition);
    setSourceMetadata(isLegacyStandardDesign ? null : { sourceType: record.sourceType, sourceFileUrl: record.sourceFileUrl || undefined, sourceFileName: record.sourceFileName || undefined, analysisStatus: record.analysisStatus, layoutZones: record.layoutZones || undefined });
  }, [companyName, corporateColor, defaultDocumentType, logo, tenantId]);

  useEffect(() => {
    const nextScope = String(tenantId || '').trim();
    if (branchScopeRef.current === nextScope) return;
    branchScopeRef.current = nextScope;
    setDesigns([]);
    setFolders([]);
    setCuratedTemplates([]);
    appearanceProfileRef.current = {};
    setAppearanceProfile({});
    setAppearanceOverrides({});
    setAppearanceOverridesExplicit(false);
    setAppearanceScope('document');
    savedAppearanceProfileRef.current = {};
    setCompanyProfile(createDefaultPdfCompanyProfile(companyName, logo || ''));
    setHasSavedCompanyProfile(false);
    resetDraftForScope();
  }, [companyName, logo, resetDraftForScope, tenantId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    if (!hasActiveBranchScope) {
      setDesigns([]);
      setFolders([]);
      setCuratedTemplates([]);
      resetDraftForScope();
      setIsLoading(false);
      return () => { cancelled = true; };
    }
    const load = async () => {
      let savedAppearanceProfile = await pdfDocumentDesignService.getAppearanceProfile().catch(() => null);
      if (cancelled) return;
      if (savedAppearanceProfile && canEditCompanyProfile && savedAppearanceProfile.templateId !== PDF_DEFAULT_TEMPLATE_ID) {
        try {
          await pdfDocumentDesignService.applyTemplate(PDF_DEFAULT_TEMPLATE_ID);
          clearPdfDesignCache();
          savedAppearanceProfile = await pdfDocumentDesignService.getAppearanceProfile().catch(() => savedAppearanceProfile);
        } catch (error: any) {
          toast.error(error?.message || `No se pudo activar la plantilla Predeterminada para ${managerScope ? 'el grupo empresarial' : 'esta sucursal'}`);
        }
      }
      const [records, folderRecords, savedCompanyProfile, curatedRecords] = await Promise.all([
        pdfDocumentDesignService.list(),
        pdfDocumentDesignService.listFolders(),
        pdfDocumentDesignService.getCompanyProfile().catch(() => null),
        pdfDocumentDesignService.listCuratedTemplates().catch(() => []),
      ]);
      if (cancelled) return;
      const normalizedAppearanceProfile = savedAppearanceProfile && typeof savedAppearanceProfile === 'object' ? savedAppearanceProfile : {};
      appearanceProfileRef.current = normalizedAppearanceProfile;
      savedAppearanceProfileRef.current = normalizedAppearanceProfile;
      setAppearanceProfile(normalizedAppearanceProfile);
      setAppearanceOverrides({});
      setAppearanceOverridesExplicit(false);
      setHasSavedCompanyProfile(Boolean(savedCompanyProfile));
      setCompanyProfile(savedCompanyProfile || createDefaultPdfCompanyProfile(companyName, logo || ''));
      const editableRecords = (records || []).filter(record => !(record.documentTypes || []).some(type => getPdfTemplateTarget(type).branchCustomizable === false && !(managerScope && getPdfTemplateTarget(type).module === 'manager')));
      setDesigns(editableRecords);
      setFolders(folderRecords || []);
      setCuratedTemplates(curatedRecords || []);
      let storedDocumentType: PdfDocumentType | undefined;
      try {
        const stored = window.localStorage.getItem(documentViewStorageKey);
        if (stored && documentTargets.some(target => target.key === stored)) storedDocumentType = stored as PdfDocumentType;
      } catch { /* almacenamiento no disponible */ }
      const recordsForPreferredTarget = storedDocumentType
        ? editableRecords.filter(record => normalizePdfTemplateKey(record.documentTypes?.[0] || '') === storedDocumentType)
        : [];
      const preferredRecord = recordsForPreferredTarget.find(record => record.isActive) || recordsForPreferredTarget[0];
      if (preferredRecord) loadDesign(preferredRecord, normalizedAppearanceProfile);
      else if (storedDocumentType) {
        resetDraftForScope(storedDocumentType);
        setAppearanceOverrides({});
        setAppearanceOverridesExplicit(false);
      }
      else if (editableRecords.length) loadDesign(editableRecords.find(record => record.isActive) || editableRecords[0], normalizedAppearanceProfile);
      else {
        resetDraftForScope();
        setAppearanceOverrides({});
        setAppearanceOverridesExplicit(false);
      }
    };
    void load().catch(() => {}).finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [canEditCompanyProfile, companyName, documentTargets, documentViewStorageKey, hasActiveBranchScope, loadDesign, logo, managerScope, resetDraftForScope, tenantId]);
  useEffect(() => {
    if (settings.paletteMode !== 'corporate' || !corporateColor || activeId !== 'draft') return;
    const timer = setTimeout(() => { setSettings(prev => ({ ...prev, primaryColor: corporateColor })); }, 0);
    return () => clearTimeout(timer);
  }, [corporateColor, activeId, settings.paletteMode]);
  useEffect(() => {
    const corporateLogo = String(logo || '').trim();
    if (activeId !== 'draft' || !corporateLogo) return;
    const timer = setTimeout(() => setTemplateDefinition(previous => ensureLogoNode(previous)), 0);
    return () => clearTimeout(timer);
  }, [activeId, logo]);
  const previewDocument = useMemo(() => assignedDocuments.includes(documentType) ? documentType : assignedDocuments[0] || 'ventas.estimate', [assignedDocuments, documentType]);
  const activeDesign = designs.find(record => record.id === activeId);
  const resolvedEditorAppearance = useMemo(() => resolvePdfDesignAppearance(
    { ...(settings as unknown as Record<string, unknown>), appearanceOverrides },
    templateDefinition as unknown as Record<string, any>,
    appearanceProfile,
  ), [appearanceOverrides, appearanceProfile, settings, templateDefinition]);
  const effectiveSettings = resolvedEditorAppearance.settings as unknown as PdfSettings;
  const appearancePanelValues = useMemo(() => appearanceScope === 'branch'
    ? resolvePdfDesignAppearance(
      { ...(settings as unknown as Record<string, unknown>), appearanceOverrides: {} },
      templateDefinition as unknown as Record<string, any>,
      appearanceProfile,
    ).effective
    : resolvedEditorAppearance.effective,
  [appearanceScope, appearanceProfile, resolvedEditorAppearance.effective, settings, templateDefinition]);
  const templateLogoSource = String(settings.templateLogoUri || settings.templateLogoUrl || '').trim();
  const globalLogoSource = String(companyProfile.logo || '').trim();
  const globalCompanyLogo = globalLogoSource && resolvedCompanyLogo.source === globalLogoSource
    ? resolvedCompanyLogo.url
    : globalLogoSource.startsWith('storage://') ? '' : globalLogoSource;
  const legacyTemplateLogo = templateLogoSource && resolvedTemplateLogo.source === templateLogoSource
    ? (resolvedTemplateLogo.url || logo)
    : logo;
  const canvasLogo = hasSavedCompanyProfile ? globalCompanyLogo : globalCompanyLogo || legacyTemplateLogo;
  const previewData = useMemo(() => {
    return createCuratedPreviewData(previewDocument, companyProfile, effectiveSettings.footerText, canvasLogo);
  }, [previewDocument, companyProfile, effectiveSettings.footerText, canvasLogo]);
  const attachedCuratedSelection = activeDesign?.settings?.curatedTemplateSelection as PdfCuratedTemplateSelection | undefined;
  const designCuratedSelection = activeId !== 'draft' && appearanceScope === 'document'
    && activeDesign?.documentTypes?.some(type => normalizePdfTemplateKey(type) === normalizePdfTemplateKey(previewDocument))
    && attachedCuratedSelection?.templateId && attachedCuratedSelection?.revisionId
    ? attachedCuratedSelection
    : undefined;
  const scopedCuratedSelection = designCuratedSelection || appearanceProfile.curatedTemplates?.[appearanceScope]?.[previewDocument];
  const scopedCuratedTemplate = scopedCuratedSelection
    ? curatedTemplates.find(template => template.id === scopedCuratedSelection.templateId) || null
    : null;
  const scopedCuratedRevision = scopedCuratedTemplate?.revisions.find(revision => revision.id === scopedCuratedSelection?.revisionId) || null;
  const activeCuratedSelectionScope: PdfCuratedTemplateScope | null = designCuratedSelection
    ? 'document'
    : appearanceProfile.curatedTemplates?.document?.[previewDocument]
      ? 'document'
      : appearanceProfile.curatedTemplates?.branch?.[previewDocument] ? 'branch' : null;
  const activeCuratedSelection = activeCuratedSelectionScope
    ? designCuratedSelection || appearanceProfile.curatedTemplates?.[activeCuratedSelectionScope]?.[previewDocument] || null
    : null;
  const activeCuratedTemplate = activeCuratedSelection
    ? curatedTemplates.find(template => template.id === activeCuratedSelection.templateId) || null
    : null;
  const activeCuratedRevision = activeCuratedTemplate?.revisions.find(revision => revision.id === activeCuratedSelection?.revisionId) || null;
  const activeCuratedSelectionTemplateId = activeCuratedSelection?.templateId || '';
  const activeCuratedSelectionRevisionId = activeCuratedSelection?.revisionId || '';
  const activeCuratedTemplateId = activeCuratedTemplate?.id || '';
  const activeCuratedRevisionId = activeCuratedRevision?.id || '';
  const activeCuratedOverrides = activeCuratedSelection?.overrides;
  const getCuratedPreviewOverrides = useCallback((
    templateOverrides: PdfCuratedTemplateSelection['overrides'],
    targetKey: string,
    scope: PdfCuratedTemplateScope,
  ) => resolveCuratedTemplateAppearanceOverrides(
    templateOverrides,
    appearanceProfile,
    scope === 'document' && normalizePdfTemplateKey(targetKey) === normalizePdfTemplateKey(previewDocument)
      ? appearanceOverrides
      : {},
  ), [appearanceOverrides, appearanceProfile, previewDocument]);
  useEffect(() => {
    setCuratedOverridesDraft(scopedCuratedSelection?.overrides ? { ...scopedCuratedSelection.overrides } : {});
  }, [previewDocument, appearanceScope, scopedCuratedSelection?.templateId, scopedCuratedSelection?.revisionId]);
  useEffect(() => {
    let cancelled = false;
    setPreviewedCuratedSelection(null);
    const timer = window.setTimeout(() => {
      setIsPreviewRendering(true);
      setPreviewError('');
      setPreviewTitle('');
      const renderPreview = async () => {
        if (activeCuratedSelectionTemplateId && CURATED_TARGET_SET.has(previewDocument)) {
          if (!activeCuratedTemplateId || !activeCuratedRevisionId || !activeCuratedSelectionScope) throw new Error(`No se pudo cargar la revisión de plantilla seleccionada en ${pdfSharedScopePhrase}.`);
          const data = await toCuratedPreviewData(previewData as Record<string, any>);
          return pdfDocumentDesignService.previewCuratedTemplate(activeCuratedTemplateId, {
            revisionId: activeCuratedRevisionId,
            targetKey: previewDocument,
            scope: activeCuratedSelectionScope,
            overrides: getCuratedPreviewOverrides(activeCuratedSelectionScope === appearanceScope ? curatedOverridesDraft : activeCuratedOverrides, previewDocument, activeCuratedSelectionScope),
            data,
            format: curatedFormatForTarget(previewDocument, effectiveSettings.paperSize),
          });
        }
        const { blob } = await renderPdfTemplateToPdf({
          definition: sanitizeTemplateDefinition(templateDefinition, previewDocument, effectiveSettings as unknown as Record<string, unknown>),
          settings: effectiveSettings,
          targetKey: previewDocument,
          data: previewData,
          fileName: 'vista-previa.pdf',
          save: false,
        });
        return blob;
      };
      void renderPreview().then(blob => {
        if (cancelled) return;
        const nextUrl = URL.createObjectURL(blob);
        if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = nextUrl;
        setPreviewUrl(nextUrl);
        if (activeCuratedSelectionTemplateId && activeCuratedSelectionRevisionId && activeCuratedSelectionScope) {
          setPreviewedCuratedSelection({
            templateId: activeCuratedSelectionTemplateId,
            revisionId: activeCuratedSelectionRevisionId,
            targetKey: previewDocument,
            scope: appearanceScope,
            overrides: activeCuratedSelectionScope === appearanceScope ? curatedOverridesDraft : activeCuratedOverrides || {},
          });
        }
      }).catch((error: unknown) => {
        if (!cancelled) setPreviewError(error instanceof Error ? error.message : 'No se pudo generar la vista previa.');
      }).finally(() => {
        if (!cancelled) setIsPreviewRendering(false);
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [templateDefinition, effectiveSettings, previewDocument, previewData, activeCuratedSelectionTemplateId, activeCuratedSelectionRevisionId, activeCuratedOverrides, activeCuratedSelectionScope, activeCuratedTemplateId, activeCuratedRevisionId, appearanceScope, curatedOverridesDraft, getCuratedPreviewOverrides, pdfSharedScopePhrase]);
  useEffect(() => () => {
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
  }, []);
  const selectedTarget = getPdfTemplateTarget(previewDocument);
  const selectedTargetEditable = canEditPdfTemplate(selectedTarget);
  const hasImportedHtmlHeader = Boolean(String((templateDefinition.metadata?.pdfStyleConfig as { htmlTemplate?: { headerHtml?: string } } | undefined)?.htmlTemplate?.headerHtml || '').trim());
  const canModifyActive = hasActiveBranchScope && selectedTargetEditable && (activeId === 'draft' ? canCreate : canEdit);
  const canManageCuratedForTarget = hasActiveBranchScope && (selectedTargetEditable ? (activeId === 'draft' ? canCreate : canEdit) : canEditCompanyProfile);
  const canSaveCurrentCuratedPreview = Boolean(previewedCuratedSelection
    && previewedCuratedSelection.targetKey === previewDocument
    && previewedCuratedSelection.scope === appearanceScope);
  const savePreviewDisabled = !hasActiveBranchScope || isPreviewRendering || curatedBusy
    || (isPdfTemplateFixed(selectedTarget)
      ? !canManageCuratedForTarget || !canSaveCurrentCuratedPreview
      : appearanceScope === 'branch' ? !canEditCompanyProfile : !canModifyActive);
  const footerAppearanceValues = appearanceScope === 'branch'
    ? appearancePanelValues
    : resolvedEditorAppearance.effective;
  const canEditFooter = appearanceScope === 'branch' ? canEditCompanyProfile : canModifyActive;
  const savedDocumentTemplateId = (activeDesign?.settings?.appearanceOverrides as Partial<PdfAppearanceOverrides> | undefined)?.documentTemplateId;
  const selectedAppearanceTemplateId = appearanceScope === 'branch'
    ? appearanceProfile.documentTemplateId || 'default-v1'
    : resolvedEditorAppearance.effective.documentTemplateId || 'default-v1';
  const isAppearanceTemplateSelectionPending = appearanceScope === 'branch'
    ? selectedAppearanceTemplateId !== (savedAppearanceProfileRef.current.documentTemplateId || 'default-v1')
    : appearanceOverrides.documentTemplateId !== savedDocumentTemplateId;
  const update = <K extends keyof PdfSettings>(key: K, value: PdfSettings[K]) => { if (canModifyActive) setSettings(prev => ({ ...prev, [key]: value })); };
  const updateAppearance = (key: PdfAppearanceDraftKey, value: unknown) => {
    const canChange = appearanceScope === 'branch' ? canEditCompanyProfile : canModifyActive;
    if (!canChange) return;
    let next = updatePdfAppearanceDraft(appearanceScope, appearanceProfile, appearanceOverrides, key, value);
    if (key === 'presetId') {
      const preset = PDF_STYLE_PRESETS.find(item => item.id === value);
      if (preset) {
        next = updatePdfAppearanceDraft(appearanceScope, next.profile, next.overrides, 'tableStyle', preset.tableStyle);
        next = updatePdfAppearanceDraft(appearanceScope, next.profile, next.overrides, 'palette', preset.palette);
      }
    }
    setAppearanceProfile(next.profile);
    appearanceProfileRef.current = next.profile;
    setAppearanceOverrides(next.overrides);
    if (appearanceScope === 'document') setAppearanceOverridesExplicit(true);
  };
  const changeAppearanceScope = (scope: PdfAppearanceDraftScope) => {
    setAppearanceScope(scope);
  };
  const resetAppearanceOverride = (key: PdfAppearanceDraftKey) => {
    if (!canModifyActive) return;
    const nextOverrides = resetPdfAppearanceOverride(appearanceOverrides as PdfAppearanceOverrides, key);
    const clearedFallback = clearPdfAppearanceFallback(
      settings as unknown as Record<string, unknown>,
      templateDefinition as unknown as Record<string, any>,
      key,
    );
    setAppearanceOverrides(nextOverrides);
    setAppearanceOverridesExplicit(true);
    setSettings(clearedFallback.settings as unknown as PdfSettings);
    setTemplateDefinition(clearedFallback.definition as unknown as PdfTemplateDefinition);
  };
  const resetAllAppearanceOverrides = () => {
    if (!canModifyActive) return;
    const nextOverrides: Partial<PdfAppearanceOverrides> = {};
    const clearedFallback = clearPdfAppearanceFallback(
      settings as unknown as Record<string, unknown>,
      templateDefinition as unknown as Record<string, any>,
    );
    setAppearanceOverrides(nextOverrides);
    setAppearanceOverridesExplicit(true);
    setSettings(clearedFallback.settings as unknown as PdfSettings);
    setTemplateDefinition(clearedFallback.definition as unknown as PdfTemplateDefinition);
  };
  const updateCompanyProfile = <K extends keyof PdfCompanyProfile>(key: K, value: PdfCompanyProfile[K]) => {
    if (canEditCompanyProfile) setCompanyProfile(previous => ({ ...previous, [key]: value }));
  };
  const reservedDocumentDesign = (id: PdfDocumentType, excludeId = activeId) => designs.find(record => record.isActive && record.id !== excludeId && normalizePdfTemplateKey(record.documentTypes?.[0]) === normalizePdfTemplateKey(id));
  const saveCompanyProfile = async () => {
    if (!canEditCompanyProfile || isSavingCompanyProfile) return;
    setIsSavingCompanyProfile(true);
    try {
      const savedProfile = await pdfDocumentDesignService.updateCompanyProfile(companyProfile);
      setCompanyProfile(savedProfile);
      setHasSavedCompanyProfile(true);
      toast.success(`Datos de empresa guardados para todos los PDF de ${managerScope ? 'este grupo empresarial' : 'esta sucursal'}`);
    } catch (error: any) {
      toast.error(error?.message || 'No se pudieron guardar los datos globales de empresa');
    } finally {
      setIsSavingCompanyProfile(false);
    }
  };

  const saveAppearanceProfile = async () => {
    if (!canEditCompanyProfile || isSavingAppearance) return false;
    setIsSavingAppearance(true);
    try {
      const footerDraft = Object.fromEntries(PDF_FOOTER_APPEARANCE_KEYS
        .filter(key => appearanceProfile[key] !== undefined)
        .map(key => [key, appearanceProfile[key]]));
      const editableProfile = Object.fromEntries(
        Object.entries(appearanceProfile).filter(([key]) => !['templateId', 'templateVersion', 'curatedTemplates'].includes(key) && !PDF_FOOTER_APPEARANCE_KEY_SET.has(key)),
      ) as PdfAppearanceProfilePatch;
      const savedProfile = await pdfDocumentDesignService.updateAppearanceProfile(editableProfile);
      savedAppearanceProfileRef.current = savedProfile;
      const nextDraft = { ...savedProfile, ...footerDraft };
      appearanceProfileRef.current = nextDraft;
      setAppearanceProfile(nextDraft);
      clearPdfDesignCache();
      toast.success(`Apariencia global guardada para los PDF de ${managerScope ? 'este grupo empresarial' : 'esta sucursal'}`);
      return true;
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo guardar la apariencia global');
      return false;
    } finally {
      setIsSavingAppearance(false);
    }
  };

  const saveGlobalFooter = async () => {
    if (!canEditCompanyProfile || isSavingFooterProfile) return false;
    setIsSavingFooterProfile(true);
    try {
      const footerPatch: PdfAppearanceProfilePatch = {
        footerText: String(appearancePanelValues.footerText ?? ''),
        showPageNumber: Boolean(appearancePanelValues.showPageNumber),
        pageNumberFormat: (appearancePanelValues.pageNumberFormat || 'page-of') as PdfAppearanceProfilePatch['pageNumberFormat'],
        pageNumberCustom: String(appearancePanelValues.pageNumberCustom ?? ''),
      };
      const savedProfile = await pdfDocumentDesignService.updateAppearanceProfile(footerPatch);
      const generalDraft = Object.fromEntries(Object.entries(appearanceProfile)
        .filter(([key]) => !PDF_FOOTER_APPEARANCE_KEY_SET.has(key)));
      const nextDraft = { ...savedProfile, ...generalDraft };
      savedAppearanceProfileRef.current = savedProfile;
      appearanceProfileRef.current = nextDraft;
      setAppearanceProfile(nextDraft);
      clearPdfDesignCache();
      toast.success(`Datos globales del pie de página guardados para los PDF de ${managerScope ? 'este grupo empresarial' : 'esta sucursal'}`);
      return true;
    } catch (error: any) {
      toast.error(error?.message || 'No se pudieron guardar los datos globales del pie de página');
      return false;
    } finally {
      setIsSavingFooterProfile(false);
    }
  };

  const confirmGlobalSave = async () => {
    if (!globalSaveKind) return;
    if (globalSaveKind === 'curated') {
      const pending = pendingCuratedSave;
      const template = pending && curatedTemplates.find(item => item.id === pending.templateId);
      const revision = template?.revisions.find(item => item.id === pending?.revisionId);
      if (!pending || !template || !revision) {
        toast.error('No se encontró la revisión de plantilla que estaba en la vista previa.');
        return;
      }
      const saved = await saveCuratedTemplateSelection(template, revision, pending.scope, pending.overrides, pending.targetKey);
      if (saved) {
        setPendingCuratedSave(null);
        setGlobalSaveKind(null);
      }
      return;
    }
    const saved = globalSaveKind === 'footer' ? await saveGlobalFooter() : await saveAppearanceProfile();
    if (saved) setGlobalSaveKind(null);
  };

  const showPdfPreviewBlob = (blob: Blob, title?: string) => {
    const nextUrl = URL.createObjectURL(blob);
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
    previewObjectUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
    setPreviewTitle(title || '');
  };

  const renderCuratedRevisionPreview = async (
    template: PdfCuratedTemplateRecord,
    revision: PdfCuratedTemplateRevision,
    scope: PdfCuratedTemplateScope,
    overrides: PdfCuratedTemplateSelection['overrides'] = {},
    requestedTarget = previewDocument,
  ) => {
    const supportedTargets = curatedTargetsForRevision(revision);
    const targetKey = supportedTargets.includes(requestedTarget) ? requestedTarget : preferredCuratedPreviewTarget(supportedTargets);
    if (!targetKey) {
      setPreviewError('El paquete no declara ni tiene una composición que NovaHub pueda adaptar a una salida PDF editable.');
      setActiveMobilePanel('preview');
      return;
    }
    setIsPreviewRendering(true);
    setPreviewError('');
    try {
      const sampleData = targetKey === previewDocument
        ? previewData as Record<string, any>
        : createCuratedPreviewData(targetKey, companyProfile, effectiveSettings.footerText, canvasLogo) as Record<string, any>;
      const data = await toCuratedPreviewData(sampleData);
      const blob = await pdfDocumentDesignService.previewCuratedTemplate(template.id, {
        revisionId: revision.id,
        targetKey,
        scope,
        overrides: getCuratedPreviewOverrides(overrides, targetKey, scope),
        data,
        format: curatedFormatForTarget(targetKey, effectiveSettings.paperSize),
      });
      showPdfPreviewBlob(blob, getPdfTemplateTarget(targetKey).label);
      setPreviewedCuratedSelection({ templateId: template.id, revisionId: revision.id, targetKey, scope, overrides });
      setCuratedPreviewTargets(previous => ({ ...previous, [revision.id]: targetKey }));
      setPreviewedCuratedRevisions(previous => ({ ...previous, [`${revision.id}:${targetKey}`]: true }));
      setActiveMobilePanel('preview');
    } catch (error: any) {
      setPreviewError(error?.message || 'No se pudo generar la vista previa de la plantilla.');
    } finally {
      setIsPreviewRendering(false);
    }
  };

  const saveCuratedTemplateSelection = async (template: PdfCuratedTemplateRecord, revision: PdfCuratedTemplateRevision, scope: PdfCuratedTemplateScope, overrides: PdfCuratedTemplateSelection['overrides'] = {}, targetKey = previewDocument): Promise<boolean> => {
    const mayEditScope = scope === 'branch' ? canEditCompanyProfile : canManageCuratedForTarget;
    if (!hasActiveBranchScope || !mayEditScope) return false;
    const targetKeys = scope === 'branch'
      ? [...new Set(curatedTargetsForRevision(revision))]
      : [targetKey];
    const compatibleTargets = new Set(curatedTargetsForRevision(revision));
    if (!targetKeys.length || targetKeys.some(candidate => !CURATED_TARGET_SET.has(candidate) || !compatibleTargets.has(candidate))) {
      toast.error(scope === 'branch'
        ? `La plantilla no tiene salidas PDF de ${managerScope ? 'Manager' : 'sucursal'} que pueda declarar o adaptar.`
        : 'La plantilla no tiene una composición que pueda adaptarse al tipo de PDF seleccionado.');
      return false;
    }
    setCuratedBusy(true);
    try {
      let publishedRevision = revision;
      if (revision.status !== 'PUBLISHED') {
        await pdfDocumentDesignService.publishCuratedRevision(template.id, revision.id);
        publishedRevision = { ...revision, status: 'PUBLISHED', publishedAt: new Date().toISOString() };
        setCuratedTemplates(previous => previous.map(item => item.id === template.id
          ? { ...item, revisions: item.revisions.map(version => version.id === revision.id ? publishedRevision : version) }
          : item));
      }
      await pdfDocumentDesignService.selectCuratedTemplate({ templateId: template.id, revisionId: revision.id, targetKeys, scope, overrides });
      const savedProfile = await pdfDocumentDesignService.getAppearanceProfile();
      appearanceProfileRef.current = savedProfile;
      savedAppearanceProfileRef.current = savedProfile;
      setAppearanceProfile(savedProfile);
      setCuratedOverridesDraft(overrides || {});
      clearPdfDesignCache();
      toast.success(scope === 'branch'
        ? `«${template.name}» quedó aplicada a ${targetKeys.length} ${targetKeys.length === 1 ? 'documento compatible' : 'documentos compatibles'} de ${pdfSharedScopePhrase}.`
        : `«${template.name}» quedó seleccionada para este PDF.`);
      if (targetKeys.includes(previewDocument)) await renderCuratedRevisionPreview(template, publishedRevision, scope, overrides, previewDocument);
      return true;
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo activar la plantilla preparada.');
      return false;
    } finally {
      setCuratedBusy(false);
    }
  };

  const requestCuratedTemplateSave = (template: PdfCuratedTemplateRecord, revision: PdfCuratedTemplateRevision, scope: PdfCuratedTemplateScope, overrides: PdfCuratedTemplateSelection['overrides'] = {}, targetKey = previewDocument) => {
    if (scope === 'branch') {
      setPendingCuratedSave({ templateId: template.id, revisionId: revision.id, targetKey, scope, overrides });
      setGlobalSaveKind('curated');
      return;
    }
    void saveCuratedTemplateSelection(template, revision, scope, overrides, targetKey);
  };

  const installCuratedPackage = async (file: File, templateId?: string) => {
    if (!hasActiveBranchScope || !canImport) return;
    if (!/\.zip$/i.test(file.name) || file.size > 10 * 1024 * 1024) {
      toast.error('Selecciona un paquete ZIP de hasta 10 MB.');
      return;
    }
    setCuratedBusy(true);
    try {
      const preflight = await pdfDocumentDesignService.inspectCuratedTemplatePackage(file);
      setPendingCuratedPackage({ file, templateId, preflight });
      setIsCuratedPackagePreflightOpen(true);
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo revisar el paquete ZIP.');
    } finally {
      setCuratedBusy(false);
    }
  };

  const confirmCuratedPackageInstall = async () => {
    if (!pendingCuratedPackage || !hasActiveBranchScope || !canImport) return;
    const { file, templateId, preflight } = pendingCuratedPackage;
    setCuratedBusy(true);
    try {
      const installed = await pdfDocumentDesignService.importCuratedTemplate(file, templateId);
      setCuratedTemplates(previous => {
        const existing = previous.find(item => item.id === installed.id);
        const revisions = [
          ...installed.revisions,
          ...(existing?.revisions || []).filter(oldRevision => !installed.revisions.some(newRevision => newRevision.id === oldRevision.id)),
        ];
        return [{ ...existing, ...installed, revisions }, ...previous.filter(item => item.id !== installed.id)];
      });
      setPendingCuratedPackage(null);
      setIsCuratedPackagePreflightOpen(false);
      const revision = installed.revisions[0];
      const supportedTargets = curatedTargetsForRevision(revision);
      const targetKey = supportedTargets.includes(previewDocument) ? previewDocument : preferredCuratedPreviewTarget(supportedTargets);
      toast.success(`«${installed.name}» se instaló como borrador de ${pdfSharedScopePhrase}. Se abrirá una muestra de un documento compatible.`);
      if (revision && targetKey) {
        setCuratedPreviewTargets(previous => ({ ...previous, [revision.id]: targetKey }));
        await renderCuratedRevisionPreview(installed, revision, appearanceScope, {}, targetKey);
      } else {
        setPreviewError(`El paquete se instaló, pero no hay un destino de muestra compatible para ${preflight.name}.`);
        setActiveMobilePanel('preview');
      }
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo instalar el paquete de plantilla.');
    } finally {
      setCuratedBusy(false);
    }
  };

  const installPreparedPackage = async (packageId: string) => {
    if (!hasActiveBranchScope || !canImport) return;
    setCuratedBusy(true);
    try {
      const zip = new JSZip();
      let packageManifest: { name?: string; description?: string } = {};
      const paths = [
        ['manifest.json', `/pdf-template-packages/${packageId}/manifest.json`],
        ['template.html', '/pdf-template-packages/common/template.html'],
        ['styles.css', `/pdf-template-packages/${packageId}/styles.css`],
      ] as const;
      await Promise.all(paths.map(async ([fileName, url]) => {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error('No se pudo cargar uno de los recursos de la plantilla preparada.');
        const content = await response.arrayBuffer();
        zip.file(fileName, content);
        if (fileName === 'manifest.json') packageManifest = JSON.parse(new TextDecoder().decode(content));
      }));
      if (managerScope) {
        const managerTarget = previewDocument;
        const managerManifest = packageManifest as Record<string, any>;
        if (Array.isArray(managerManifest.layouts)) throw new Error('Este paquete preparado usa composiciones versionadas y no puede adaptarse a Manager como ZIP plano.');
        managerManifest.documentTypes = [managerTarget];
        zip.file('manifest.json', JSON.stringify(managerManifest));
      }
      const archive = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const existingTemplate = curatedTemplates.find(item => item.name.trim().toLocaleLowerCase() === String(packageManifest.name || '').trim().toLocaleLowerCase()
        && (item.description || '') === (packageManifest.description || ''));
      await installCuratedPackage(new File([archive], `${packageId}.zip`, { type: 'application/zip' }), existingTemplate?.id);
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo preparar el paquete de ejemplo.');
    } finally {
      setCuratedBusy(false);
    }
  };

  const clearCuratedTemplateSelection = async () => {
    if (!hasActiveBranchScope || (appearanceScope === 'branch' ? !canEditCompanyProfile : !canManageCuratedForTarget)) return;
    setCuratedBusy(true);
    try {
      if (appearanceScope === 'document' && activeDesign?.settings?.curatedTemplateSelection) {
        setSettings(previous => {
          const next = { ...previous };
          delete next.curatedTemplateSelection;
          return next;
        });
        setDesigns(previous => previous.map(record => record.id === activeDesign.id
          ? { ...record, settings: Object.fromEntries(Object.entries(record.settings || {}).filter(([key]) => key !== 'curatedTemplateSelection')) }
          : record));
      }
      await pdfDocumentDesignService.clearCuratedSelection(appearanceScope, previewDocument);
      const savedProfile = await pdfDocumentDesignService.getAppearanceProfile();
      appearanceProfileRef.current = savedProfile;
      savedAppearanceProfileRef.current = savedProfile;
      setAppearanceProfile(savedProfile);
      setCuratedOverridesDraft({});
      clearPdfDesignCache();
      toast.success('Se restableció la plantilla anterior para este alcance.');
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo restablecer la selección.');
    } finally {
      setCuratedBusy(false);
    }
  };

  const saveCuratedTemplateToDesign = async (template: PdfCuratedTemplateRecord, revision: PdfCuratedTemplateRevision, overrides: PdfCuratedTemplateSelection['overrides'] = {}) => {
    if (!canModifyActive || !curatedTargetsForRevision(revision).includes(previewDocument)) {
      toast.error('Selecciona una vista que NovaHub pueda adaptar antes de guardar esta plantilla en el diseño.');
      return;
    }
    setCuratedBusy(true);
    try {
      let publishedRevision = revision;
      if (revision.status !== 'PUBLISHED') {
        await pdfDocumentDesignService.publishCuratedRevision(template.id, revision.id);
        publishedRevision = { ...revision, status: 'PUBLISHED', publishedAt: new Date().toISOString() };
        setCuratedTemplates(previous => previous.map(item => item.id === template.id
          ? { ...item, revisions: item.revisions.map(version => version.id === revision.id ? publishedRevision : version) }
          : item));
      }
      const selection: PdfCuratedTemplateSelection = {
        templateId: template.id,
        revisionId: revision.id,
        version: revision.version,
        overrides: overrides || {},
      };
      const saved = await saveDesign({
        curatedTemplateSelection: selection,
        successMessage: `Diseño guardado con «${template.name}»; actívalo cuando quieras usarlo en las exportaciones.`,
      });
      if (saved) {
        setSettings(previous => ({ ...previous, curatedTemplateSelection: selection }));
        setPreviewedCuratedSelection({ templateId: template.id, revisionId: revision.id, targetKey: previewDocument, scope: 'document', overrides: overrides || {} });
      }
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo guardar la plantilla dentro del diseño.');
    } finally {
      setCuratedBusy(false);
    }
  };

  const saveDesign = async (options: {
    appearanceOverrides?: Partial<PdfAppearanceOverrides>;
    appearanceOverridesExplicit?: boolean;
    curatedTemplateSelection?: PdfCuratedTemplateSelection | null;
    successMessage?: string;
  } = {}): Promise<boolean> => {
    if (!canEditPdfTemplate(previewDocument)) {
      toast.error(isPdfTemplateFixed(previewDocument)
        ? 'Este formato físico se genera con un renderer fijo y no admite diseños editables.'
        : 'Este destino PDF no admite diseños editables.');
      return false;
    }
    if (activeId === 'draft' ? !canCreate : !canEdit) return false;
    if (!hasActiveBranchScope) { toast.error(`Selecciona o abre ${managerScope ? 'un grupo empresarial' : 'una sucursal activa'} antes de guardar el diseño.`); return false; }
    if (!name.trim() || !assignedDocuments.length) { toast.error('Agrega un nombre y al menos un tipo de documento'); return false; }
    setIsSaving(true);
    try {
      const sourceType: PdfDocumentDesignRecord['sourceType'] = sourceMetadata?.sourceType === 'UPLOADED_PDF' || sourceMetadata?.sourceType === 'UPLOADED_HTML' || sourceMetadata?.sourceType === 'AI_ANALYZED' ? sourceMetadata.sourceType : 'SYSTEM';
      const savedDocumentType = normalizePdfTemplateKey(assignedDocuments[0] || previewDocument);
      const persistedSettings = applyStandardPdfLayoutSettings(savedDocumentType, { ...settings } as Record<string, unknown>);
      if (options.curatedTemplateSelection !== undefined) {
        if (options.curatedTemplateSelection) persistedSettings.curatedTemplateSelection = options.curatedTemplateSelection;
        else delete persistedSettings.curatedTemplateSelection;
      }
      const persistedAppearanceOverrides = options.appearanceOverrides ?? appearanceOverrides;
      const persistAppearanceOverrides = options.appearanceOverridesExplicit ?? appearanceOverridesExplicit;
      if (persistAppearanceOverrides) persistedSettings.appearanceOverrides = persistedAppearanceOverrides;
      else delete persistedSettings.appearanceOverrides;
      delete persistedSettings.logoUrl;
      if ((typeof persistedSettings.templateLogoUri === 'string' && persistedSettings.templateLogoUri.trim())
        || (typeof persistedSettings.templateLogoUrl === 'string' && persistedSettings.templateLogoUrl.trim())) {
        persistedSettings.templateLogoTarget = savedDocumentType;
      } else {
        delete persistedSettings.templateLogoUrl;
        delete persistedSettings.templateLogoUri;
        delete persistedSettings.templateLogoTarget;
      }
      const savedDefinition: PdfTemplateDefinition = {
        ...templateDefinition,
        metadata: {
          ...(templateDefinition.metadata || {}),
      ...(isSalesPdfLayoutTarget(savedDocumentType) ? { preset: 'sales-custom', salesLayoutVersion: salesPdfLayoutVersionForTarget(savedDocumentType) } : {}),
          ...(isPurchasePdfLayoutTarget(savedDocumentType) ? { preset: 'purchase-custom', purchaseLayoutVersion: PURCHASE_PDF_LAYOUT_VERSION } : {}),
        },
      };
      const existingTemplateKey = designs.find(record => record.id === activeId)?.templateKey;
      const createAsNew = activeId === 'draft' || existingTemplateKey === 'erp-default';
      const savedTemplateKey = createAsNew ? 'custom' : existingTemplateKey || 'custom';
      const isActive = createAsNew ? false : Boolean(designs.find(record => record.id === activeId)?.isActive);
      const payload = { name: name.trim(), description, documentTypes: [savedDocumentType], folderId: selectedFolderId, settings: persistedSettings, templateKey: savedTemplateKey, sourceType, sourceFileUrl: sourceMetadata?.sourceFileUrl, sourceFileName: sourceMetadata?.sourceFileName, analysisStatus: sourceMetadata?.analysisStatus || 'NOT_APPLICABLE', layoutZones: { ...(sourceMetadata?.layoutZones || {}), definition: savedDefinition, fields: templateFields }, engine: 'HTML_TEMPLATE', isActive };
      const saved = createAsNew ? await pdfDocumentDesignService.create(payload) : await pdfDocumentDesignService.update(activeId, payload);
      clearPdfDesignCache();
      const savedForState = { ...saved, documentTypes: [savedDocumentType], settings: { ...(saved.settings || {}), ...persistedSettings } };
      setDesigns(previous => createAsNew ? [savedForState, ...previous] : previous.map(item => item.id === saved.id ? savedForState : item));
      setActiveId(saved.id); setTemplateDefinition(savedDefinition); setName(saved.name);
      if (options.curatedTemplateSelection !== undefined) setSettings(previous => ({ ...previous, curatedTemplateSelection: options.curatedTemplateSelection || undefined }));
      toast.success(options.successMessage || (saved.name !== name.trim() ? `Diseño guardado como «${saved.name}»` : 'Diseño PDF guardado'));
      return true;
    } catch (error: any) { toast.error(error?.message || 'No se pudo guardar el diseño'); return false; } finally { setIsSaving(false); }
  };

  const savePreviewedDesign = () => {
    if (previewedCuratedSelection) {
      const applyingBranchPackage = appearanceScope === 'branch' && previewedCuratedSelection.scope === 'branch';
      if ((!applyingBranchPackage && previewedCuratedSelection.targetKey !== previewDocument) || previewedCuratedSelection.scope !== appearanceScope) {
        toast.info('Espera a que termine la vista previa actual antes de guardar.');
        return;
      }
      const template = curatedTemplates.find(item => item.id === previewedCuratedSelection.templateId);
      const revision = template?.revisions.find(item => item.id === previewedCuratedSelection.revisionId);
      if (!template || !revision) {
        toast.error('No se encontró la plantilla que aparece en la vista previa.');
        return;
      }
      if (appearanceScope === 'branch') {
        requestCuratedTemplateSave(template, revision, appearanceScope, previewedCuratedSelection.overrides, previewedCuratedSelection.targetKey);
        return;
      }
      if (isPdfTemplateFixed(previewDocument)) {
        requestCuratedTemplateSave(template, revision, 'document', previewedCuratedSelection.overrides, previewDocument);
        return;
      }
      void saveCuratedTemplateToDesign(template, revision, previewedCuratedSelection.overrides);
      return;
    }
    if (appearanceScope === 'branch') setGlobalSaveKind('appearance');
    else void saveDesign();
  };
  const activateDesign = async (record: PdfDocumentDesignRecord) => {
    if (!hasActiveBranchScope || !canEdit || record.isActive || activatingDesignId) return;
    const target = normalizePdfTemplateKey(record.documentTypes?.[0] || 'ventas.estimate');
    if (!canEditPdfTemplate(target)) return;
    setActivatingDesignId(record.id);
    try {
      const activated = await pdfDocumentDesignService.activate(record.id);
      setDesigns(previous => previous.map(item => normalizePdfTemplateKey(item.documentTypes?.[0] || '') === target
        ? { ...item, isActive: item.id === activated.id, updatedAt: activated.updatedAt || item.updatedAt }
        : item));
      loadDesign(activated);
      clearPdfDesignCache(target);
      setActiveMobilePanel('preview');
      toast.success(`«${record.name}» quedó aplicado a ${documentLabel(target)}.`);
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo aplicar este diseño a la vista.');
    } finally {
      setActivatingDesignId(null);
    }
  };
  const restoreCurrentTargetDefault = async () => {
    if (!hasActiveBranchScope || !canEdit || isRestoringDefault || !selectedTargetEditable) return;
    setIsRestoringDefault(true);
    try {
      const result = await pdfDocumentDesignService.resetActiveTarget(previewDocument);
      const savedProfile = await pdfDocumentDesignService.getAppearanceProfile().catch(() => appearanceProfileRef.current);
      appearanceProfileRef.current = savedProfile;
      savedAppearanceProfileRef.current = savedProfile;
      setAppearanceProfile(savedProfile);
      const target = getPdfTemplateTarget(previewDocument);
      setDesigns(previous => {
        const next = previous.map(record => normalizePdfTemplateKey(record.documentTypes?.[0] || '') === target.key
          ? { ...record, isActive: false }
          : record);
        const existingIndex = next.findIndex(record => record.id === result.defaultDesign.id);
        if (existingIndex >= 0) next[existingIndex] = result.defaultDesign;
        else next.unshift(result.defaultDesign);
        return next;
      });
      setPreviewedCuratedSelection(null);
      setCuratedOverridesDraft({});
      clearPdfDesignCache(target.key);
      loadDesign(result.defaultDesign);
      toast.success(`Se aplicó el predeterminado del ERP a ${target.label}. Los diseños guardados siguen disponibles.`);
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo volver al diseño predeterminado.');
    } finally {
      setIsRestoringDefault(false);
    }
  };
  const createDesign = () => {
    if (!hasActiveBranchScope || !canCreate) return;
    const nextDocumentType = documentType;
    const target = getPdfTemplateTarget(nextDocumentType);
    if (!canEditPdfTemplate(target)) return;
    const nextSettings = applyStandardPdfLayoutSettings(nextDocumentType, { ...DEFAULT_SETTINGS, companyName, primaryColor: corporateColor || DEFAULT_SETTINGS.primaryColor });
    const nextDefinition = createEditorDefaultDefinition(nextDocumentType, nextSettings, logo);
    setActiveId('draft'); setSelectedFolderId(null); setPreviewedCuratedSelection(null); setCuratedOverridesDraft({}); setName(`Nuevo diseño · ${target.label}`); setDescription(`Datos y asignación para ${target.label}; editable para ${pdfSharedScopePhrase}.`); setAssignedDocuments([nextDocumentType]); setDocumentType(nextDocumentType); setSelectedModule(target.module); setSourceMetadata(null); setTemplateFields(createTemplateFields(companyName)); setTemplateDefinition(nextDefinition); setAppearanceOverrides({}); setAppearanceOverridesExplicit(false); setSettings(nextSettings);
  };
  const deleteDesignRecord = (record: PdfDocumentDesignRecord) => { if (canDelete) setDeleteTarget({ kind: 'design', record }); };
  const updateTemplateField = (id: string, changes: Partial<PdfTemplateField>) => { if (canModifyActive) setTemplateFields(fields => fields.map(field => field.id === id ? { ...field, ...changes } : field)); };
  const moduleTargets = useMemo(() => documentTargets.filter(target => target.module === selectedModule), [documentTargets, selectedModule]);
  const selectTarget = (targetKey: string) => {
    const target = getPdfTemplateTarget(targetKey);
    const isSameTarget = normalizePdfTemplateKey(previewDocument) === target.key;
    const nextSettings: PdfSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      headerLayout: DEFAULT_SETTINGS.headerLayout,
      footerLayout: DEFAULT_SETTINGS.footerLayout,
      tableLayout: DEFAULT_SETTINGS.tableLayout,
      fontFamily: DEFAULT_SETTINGS.fontFamily,
      fontSize: DEFAULT_SETTINGS.fontSize,
      primaryColor: corporateColor || DEFAULT_SETTINGS.primaryColor,
      secondaryColor: DEFAULT_SETTINGS.secondaryColor,
      textColor: DEFAULT_SETTINGS.textColor,
      lineColor: DEFAULT_SETTINGS.lineColor,
      backgroundColor: DEFAULT_SETTINGS.backgroundColor,
      ...(!isSameTarget ? { paperSize: 'LETTER', orientation: 'portrait' } : {}),
      ...(target.family === 'cash-ticket' ? { paperSize: 'ROLL-80', orientation: 'portrait' } : {}),
      ...(target.family === 'cash-ticket' ? { primaryColor: '#000000', secondaryColor: '#000000', textColor: '#000000', lineColor: '#000000', paletteMode: 'independent' as const } : {}),
      ...(target.family === 'label' ? { paperSize: 'LABEL', orientation: 'landscape' } : {}),
      ...(isSameTarget ? {} : { logoUrl: undefined, templateLogoUrl: undefined, templateLogoUri: undefined, templateLogoTarget: undefined }),
    };
    const normalizedSettings = normalizePdfPaperSettings(target.key, applyStandardPdfLayoutSettings(target.key, nextSettings)) as PdfSettings;
    setActiveId('draft');
    setSelectedFolderId(null);
    setPreviewedCuratedSelection(null);
    setCuratedOverridesDraft({});
    setSelectedModule(target.module);
    setDocumentType(target.key);
    setAssignedDocuments([target.key]);
    const nextDefinition = createEditorDefaultDefinition(target.key, normalizedSettings, logo);
    setAppearanceOverrides({});
    setAppearanceOverridesExplicit(false);
    setSettings(normalizedSettings);
    setTemplateDefinition(nextDefinition);
    setName(`${isPdfTemplateFixed(target) ? 'Vista previa' : 'Nuevo diseño'} · ${target.label}`);
    setDescription(isPdfTemplateFixed(target)
      ? `Previsualización de ${target.label}; conserva sus medidas físicas y permite asignar una plantilla ${managerScope ? 'del Manager' : 'de sucursal'}.`
      : `Datos y asignación para ${target.label}; editable para ${pdfSharedScopePhrase}.`);
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
        clearPdfDesignCache();
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
  const uploadLogo = async (file: File) => { if (!canEditCompanyProfile) return; if (!file.type.startsWith('image/')) { toast.error('Selecciona una imagen para el logotipo'); return; } try { const uploaded = await storageService.uploadFile(managerScope ? 'manager-pdf-branding' : 'tenant-branding', file, { folder: 'pdf-company-profile', scopeId: tenantId }); const logoSource = managerScope ? (uploaded.url || uploaded.uri) : (uploaded.uri || uploaded.url); setCompanyProfile(previous => ({ ...previous, logo: logoSource })); setResolvedCompanyLogo({ source: logoSource, url: uploaded.url || logoSource }); setTemplateDefinition(previous => ensureLogoNode(previous)); toast.success(`Logotipo listo; guarda los datos globales para aplicarlo a todos los PDF ${managerScope ? 'del grupo' : 'de la sucursal'}`); } catch (error: any) { toast.error(error?.message || 'No se pudo cargar el logotipo'); } };
  const renderDesign = (record: PdfDocumentDesignRecord) => <div key={record.id} className={cn('space-y-2 rounded-xl border p-3 transition-colors', activeId === record.id ? 'border-primary bg-primary/10' : 'border-border/40 hover:border-primary/40')}>
    <button type="button" onClick={() => loadDesign(record)} className="block w-full min-w-0 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <span className="flex min-w-0 items-start justify-between gap-2"><span className="min-w-0"><span className="block break-words text-xs font-bold">{record.name}</span><span className="mt-1 block text-[10px] text-muted-foreground">{documentLabel(record.documentTypes?.[0] || 'estimate')}</span></span><Badge variant={record.isActive ? 'default' : 'outline'} className="shrink-0 text-[9px]">{record.isActive ? 'En uso' : 'Guardado'}</Badge></span>
      {record.description && <span className="mt-1.5 block line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{record.description}</span>}
    </button>
    <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-border/40 pt-2">
      <Button type="button" size="sm" variant="ghost" className="h-7 cursor-pointer px-2 text-[10px]" onClick={() => { loadDesign(record); setActiveMobilePanel('preview'); }}><Eye className="mr-1 size-3" />Previsualizar</Button>
      {!record.isActive && <Button type="button" size="sm" className="h-7 cursor-pointer px-2 text-[10px]" onClick={() => void activateDesign(record)} disabled={!hasActiveBranchScope || !canEdit || activatingDesignId !== null}><Check className="mr-1 size-3" />{activatingDesignId === record.id ? 'Aplicando…' : 'Aplicar'}</Button>}
      {canDelete && <Button type="button" variant="ghost" size="icon" title="Eliminar diseño" aria-label={`Eliminar diseño ${record.name}`} className="size-7 cursor-pointer text-destructive hover:text-destructive" onClick={() => deleteDesignRecord(record)}><Trash2 className="size-3.5" /></Button>}
    </div>
  </div>;
  const visibleDesigns = designs.filter(record => record.templateKey !== 'erp-default');
  const ungroupedDesigns = visibleDesigns.filter(record => !record.folderId);
  const selectedFolderDesigns = selectedFolderId ? visibleDesigns.filter(record => record.folderId === selectedFolderId) : [];
  const pendingCuratedTemplate = pendingCuratedSave && curatedTemplates.find(item => item.id === pendingCuratedSave.templateId);
  const pendingCuratedRevision = pendingCuratedTemplate?.revisions.find(item => item.id === pendingCuratedSave?.revisionId);
  const pendingCuratedTargets = curatedTargetsForRevision(pendingCuratedRevision);
  const pendingCuratedModuleSummary = groupCuratedTargetsByModule(pendingCuratedTargets).map(([module, labels]) => `${module} (${labels.length})`).join(', ');
  const pendingPreflightAdaptedTargets = pendingCuratedPackage?.preflight.compatibleTargets?.filter(target => target.relation === 'adaptable') || [];
  const pendingPreflightModuleSummary = groupCuratedTargetsByModule(pendingPreflightAdaptedTargets.map(target => target.targetKey)).map(([module, labels]) => `${module} (${labels.length})`).join(' · ');
  return <div className="flex min-w-0 flex-col gap-3 xl:min-h-[calc(100vh-11rem)]">
    <div className={cn('grid grid-cols-3 gap-1 rounded-xl border border-border/60 bg-muted/30 p-1 xl:hidden', isPreviewExpanded && 'hidden')} role="group" aria-label="Panel del editor PDF">
      <Button type="button" size="sm" variant={activeMobilePanel === 'assignment' ? 'default' : 'ghost'} className="cursor-pointer" aria-pressed={activeMobilePanel === 'assignment'} onClick={() => setActiveMobilePanel('assignment')}>Asignación</Button>
      <Button type="button" size="sm" variant={activeMobilePanel === 'preview' ? 'default' : 'ghost'} className="cursor-pointer" aria-pressed={activeMobilePanel === 'preview'} onClick={() => setActiveMobilePanel('preview')}>Vista previa</Button>
      <Button type="button" size="sm" variant={activeMobilePanel === 'settings' ? 'default' : 'ghost'} className="cursor-pointer" aria-pressed={activeMobilePanel === 'settings'} onClick={() => setActiveMobilePanel('settings')}>Datos</Button>
    </div>

    <div className="grid min-h-[520px] gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(210px,245px)_minmax(0,1fr)_minmax(280px,320px)]">
      <aside className={cn('min-w-0 flex-col gap-3 xl:flex', isPreviewExpanded ? 'hidden xl:hidden' : activeMobilePanel === 'assignment' ? 'flex' : 'hidden')}>
        <details data-tour="pdf-assignment" className="group rounded-lg border bg-card text-card-foreground shadow-none">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-6 pb-3 pt-6 [&::-webkit-details-marker]:hidden">
            <div className="space-y-1.5"><CardTitle className="text-sm">Asignación</CardTitle><CardDescription className="text-xs">Elige la vista y el alcance propietario de este diseño.</CardDescription></div>
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <CardContent className="space-y-3 pt-0">
            <Field label="Nombre del diseño"><Input value={name} onChange={event => setName(event.target.value)} disabled={!canModifyActive} placeholder="Ej. Cotización comercial" /></Field>
            <Field label="Módulo"><select aria-label="Módulo del documento" value={selectedModule} onChange={event => { const moduleId = event.target.value as typeof selectedModule; const first = documentTargets.find(target => target.module === moduleId && !isPdfTemplateFixed(target)); if (!first) return; const reservedBy = reservedDocumentDesign(first.key); if (reservedBy && activeId !== 'draft') { loadDesign(reservedBy); return; } selectTarget(first.key); }} disabled={!canModifyActive && !(isPdfTemplateFixed(previewDocument) && canEditCompanyProfile)} className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecciona un módulo</option>{documentModules.map(module => <option key={module.id} value={module.id}>{module.label}</option>)}</select></Field>
            <Field label="Vista / acción PDF"><select aria-label="Vista o acción del documento" value={previewDocument} onChange={event => { const selectedType = event.target.value; const reservedBy = reservedDocumentDesign(selectedType); if (reservedBy && activeId !== 'draft') { loadDesign(reservedBy); toast.info(`Se abrió el diseño «${reservedBy.name}» para esta vista.`); return; } selectTarget(selectedType); }} className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm">{moduleTargets.map(item => { const reservedBy = reservedDocumentDesign(item.key); return <option key={item.key} value={item.key}>{item.label}{reservedBy ? ` · tiene activo «${reservedBy.name}»` : ''}</option>; })}</select></Field>
            <Field label="Carpeta"><div className="flex gap-2"><select aria-label="Carpeta del diseño" value={selectedFolderId || ''} onChange={event => setSelectedFolderId(event.target.value || null)} disabled={!canModifyActive} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"><option value="">Sin carpeta</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><Button type="button" variant="outline" size="icon" title="Nueva carpeta" className="size-9 shrink-0 cursor-pointer" onClick={openNewFolder} disabled={!canModifyActive}><FolderPlus className="size-4" /></Button></div></Field>
            <Field label="Descripción"><Textarea value={description} onChange={event => setDescription(event.target.value)} disabled={!canModifyActive} placeholder="Describe cuándo debe utilizarse" rows={2} /></Field>
            <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground"><span className="font-semibold text-primary">{selectedTarget.moduleLabel} · {selectedTarget.label}</span><br />{selectedTargetEditable ? `Este diseño se guarda para esta vista y ${managerScope ? 'grupo empresarial' : 'sucursal'}.` : isPdfTemplateFixed(selectedTarget) ? 'Formato físico fijo; admite plantillas adaptadas a sus medidas.' : 'Este destino usa el formato predeterminado del ERP.'}</div>
          </CardContent>
        </details>

        <details data-tour="pdf-templates" className="group rounded-lg border bg-card text-card-foreground shadow-none">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-6 pb-3 pt-6 [&::-webkit-details-marker]:hidden">
            <div className="space-y-1.5"><CardTitle className="text-sm">Plantillas</CardTitle><CardDescription className="text-xs">Base compartida para los PDF {managerScope ? 'del grupo empresarial' : 'de esta sucursal'}.</CardDescription></div>
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <CardContent className="pt-0">
            <p className="mb-2 text-[10px] leading-relaxed text-muted-foreground">La plantilla predeterminada define la base visual del ERP. Los ajustes de fuente, composición, tamaño y color se controlan en Apariencia del PDF.</p>
            {appearanceScope === 'branch' && appearanceOverrides.documentTemplateId && appearanceOverrides.documentTemplateId !== (appearanceProfile.documentTemplateId || 'default-v1') && <p className="mb-2 rounded-md border border-border/50 bg-muted/40 px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">Este PDF conserva una plantilla propia; prevalecerá sobre la del {pdfSharedScope} hasta que se restablezca en el alcance “Solo este PDF”.</p>}
            <div className="space-y-2">
              {PDF_DOCUMENT_TEMPLATES.filter(template => template.id === PDF_DEFAULT_TEMPLATE_ID).map(template => {
                const selected = selectedAppearanceTemplateId === template.id;
                const accent = String(appearancePanelValues.palette?.primary || '#01422c');
                const decoration: React.CSSProperties = template.id === 'default-v1'
                  ? { borderTop: `1px solid ${accent}`, borderBottom: `1px solid ${accent}` }
                  : template.id === 'invoice-wave-v1'
                    ? { background: accent, clipPath: 'ellipse(95% 100% at 50% 0%)' }
                    : template.id === 'invoice-ribbon-v1'
                      ? { background: accent, clipPath: 'polygon(0 0,100% 0,88% 100%,0 100%)' }
                      : template.id === 'invoice-diagonal-v1'
                        ? { background: `linear-gradient(135deg, ${accent} 0 65%, transparent 65%)` }
                        : template.id === 'invoice-editorial-v1'
                          ? { borderTop: `2px solid ${accent}`, borderBottom: `1px solid ${accent}` }
                          : { borderLeft: `3px solid ${accent}` };
                return <button
                  key={template.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => updateAppearance('documentTemplateId', template.id)}
                  disabled={(appearanceScope === 'branch' ? !canEditCompanyProfile : !canManageCuratedForTarget) || isSavingAppearance || isSaving}
                  className={cn('w-full rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60', selected ? 'border-primary/60 bg-primary/5' : 'border-border/50 hover:border-primary/40')}
                >
                  <div className="flex items-center gap-2.5">
                    <span aria-hidden="true" className="flex h-9 w-12 shrink-0 flex-col justify-between rounded-sm border border-border/60 bg-background p-1">
                      <span className="h-2.5 w-full rounded-[1px]" style={decoration} />
                      <span className="mx-auto h-1 w-8/12 rounded-[1px] bg-muted-foreground/20" />
                      <span className="h-1.5 w-full rounded-[1px]" style={decoration} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold">{template.name}</span>
                        {selected && <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[9px]">{isAppearanceTemplateSelectionPending ? 'Vista previa' : appearanceScope === 'document' && !appearanceOverrides.documentTemplateId ? 'Heredada' : 'Guardada'}</Badge>}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">{template.description}</span>
                    </span>
                  </div>
                </button>;
              })}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Para recuperar esta base en la vista actual, usa “Volver al predeterminado” en el previsualizador.</p>
          </CardContent>
        </details>

        <details data-tour="pdf-importations" className="group rounded-lg border bg-card text-card-foreground shadow-none">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-6 pb-3 pt-6 [&::-webkit-details-marker]:hidden">
            <div className="space-y-1.5"><CardTitle className="text-sm">Importaciones</CardTitle><CardDescription className="text-xs">Paquetes de diseño propios de {pdfSharedScopePhrase}.</CardDescription></div>
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <CardContent className="pt-0">
            <section className="mt-4 space-y-3 border-t border-border/50 pt-4" aria-labelledby="pdf-curated-templates-heading">
              <div className="space-y-2">
                <div className="min-w-0"><h3 id="pdf-curated-templates-heading" className="text-xs font-semibold">Paquetes de diseño</h3><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Instala un ZIP y revisa su muestra. NovaHub detecta otros PDF editables que puede adaptar entre módulos. En “Todos los PDF {managerScope ? 'del grupo empresarial' : 'de esta sucursal'}” se aplica a los destinos declarados o adaptables; las asignaciones propias conservan prioridad.</p></div>
                <input ref={curatedPackageInputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={event => { const file = event.target.files?.[0]; const templateId = curatedImportTargetIdRef.current; curatedImportTargetIdRef.current = undefined; if (file) void installCuratedPackage(file, templateId); event.currentTarget.value = ''; }} />
                <Button type="button" size="sm" variant="outline" className="h-8 w-full cursor-pointer justify-center gap-1.5 px-2 text-[10px]" onClick={() => curatedPackageInputRef.current?.click()} disabled={!hasActiveBranchScope || !canImport || curatedBusy}><Upload className="size-3.5" />Instalar ZIP</Button>
              </div>
              {appearanceScope === 'branch' && appearanceProfile.curatedTemplates?.document?.[previewDocument] && <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">Este PDF tiene una selección propia; prevalece sobre la selección de {pdfSharedScope}.</p>}
              {!CURATED_TARGET_SET.has(previewDocument) && <p className="rounded-md border border-dashed border-border/60 px-2 py-2 text-[10px] leading-relaxed text-muted-foreground">Las plantillas de alta fidelidad se pueden adaptar a salidas PDF editables. Los tickets y etiquetas reciben el estilo seleccionado sin cambiar sus medidas físicas.</p>}
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground">{CURATED_TARGET_SET.has(previewDocument)
                  ? 'Opciones preparadas para instalar; revisa la vista previa antes de publicar.'
                  : 'El PDF actual no usa el adaptador de plantillas. Puedes instalar el ZIP y revisar los destinos compatibles antes de aplicarlo.'}</p>
                {PREPARED_PDF_PACKAGES.map(item => <div key={item.id} className="space-y-2 rounded-lg border border-border/50 p-3 text-left">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span aria-hidden="true" className="mt-0.5 h-9 w-10 shrink-0 rounded-md border border-border/40" style={{ background: `linear-gradient(150deg, ${item.primary} 0 40%, ${item.secondary} 41% 62%, white 63%)` }} />
                    <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold">{item.name}</span><span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">{item.description}</span></span>
                  </div>
                  <div className="flex justify-end border-t border-border/40 pt-2"><Button type="button" size="sm" variant="outline" className="h-7 cursor-pointer px-2 text-[10px]" onClick={() => void installPreparedPackage(item.id)} disabled={!hasActiveBranchScope || !canImport || curatedBusy}><Download className="mr-1 size-3" />Preparar</Button></div>
                </div>)}
              </div>
              {curatedTemplates.length > 0 && <div className="space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground">Biblioteca privada · {managerScope ? companyName || 'grupo empresarial' : branchName || 'sucursal activa'}</p>
                {curatedTemplates.map(template => <details key={template.id} className="group rounded-lg border border-border/50 bg-background/50">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-2.5 [&::-webkit-details-marker]:hidden"><span className="min-w-0"><span className="block truncate text-[11px] font-semibold">{template.name}</span><span className="block truncate text-[9px] text-muted-foreground">{template.description || `Paquete privado de ${pdfSharedScopePhrase}`}</span></span><Badge variant="outline" className="shrink-0 text-[9px]">{template.revisions.length} rev.</Badge></summary>
                  <div className="space-y-2 border-t border-border/40 p-2">
                    <Button type="button" size="sm" variant="outline" className="h-7 cursor-pointer px-2 text-[10px]" onClick={() => { curatedImportTargetIdRef.current = template.id; curatedPackageInputRef.current?.click(); }} disabled={!hasActiveBranchScope || !canImport || curatedBusy}><Upload className="mr-1 size-3" />Instalar nueva versión</Button>
                    {template.revisions.map(revision => {
                      const isScopedActive = scopedCuratedSelection?.templateId === template.id && scopedCuratedSelection.revisionId === revision.id;
                      const supportedTargets = curatedTargetsForRevision(revision);
                      const declaredTargets = revision.manifest.documentTypes.filter(target => CURATED_TARGET_SET.has(target));
                      const adaptedTargets = (revision.compatibleTargets || []).filter(target => target.relation === 'adaptable').map(target => target.targetKey);
                      const supportsTarget = supportedTargets.includes(previewDocument);
                      const storedPreviewTarget = curatedPreviewTargets[revision.id];
                      const selectedPreviewTarget = supportsTarget
                        ? previewDocument
                        : supportedTargets.includes(storedPreviewTarget || '') ? storedPreviewTarget || '' : preferredCuratedPreviewTarget(supportedTargets);
                      const previewed = Boolean(previewedCuratedRevisions[`${revision.id}:${selectedPreviewTarget}`]);
                      return <div key={revision.id} className="space-y-2 rounded-md bg-muted/20 p-2">
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5"><Badge variant={revision.status === 'PUBLISHED' ? 'secondary' : 'outline'} className="text-[9px]">v{revision.version} · {revision.status === 'PUBLISHED' ? 'Publicada' : 'Borrador'}</Badge>{isScopedActive && <Badge className="text-[9px]"><Check className="mr-1 size-3" />Activa</Badge>}</span>
                        <p className="text-[9px] leading-relaxed text-muted-foreground">Declarados en el ZIP: {declaredTargets.map(target => curatedTargetLabel(target, true)).join(', ') || 'ninguno'}.</p>
                        {adaptedTargets.length > 0 && <details className="rounded-md border border-border/40 px-2 py-1.5 text-[9px]"><summary className="cursor-pointer font-medium">Destinos detectados y adaptables por NovaHub ({adaptedTargets.length})</summary><div className="mt-1 space-y-1 leading-relaxed text-muted-foreground">{groupCuratedTargetsByModule(adaptedTargets).map(([module, labels]) => <p key={module}><strong>{module}:</strong> {labels.join(', ')}</p>)}</div></details>}
                        {revision.manifest.fontFamilies?.length ? <p className="text-[9px] leading-relaxed text-muted-foreground">Fuentes incluidas: {revision.manifest.fontFamilies.join(', ')}.</p> : <p className="text-[9px] leading-relaxed text-muted-foreground">Sin fuentes incluidas; se usa la familia declarada por la plantilla y su alternativa local.</p>}
                        {!supportsTarget && supportedTargets.length > 0 && <label className="block space-y-1 text-[9px] text-muted-foreground"><span>Documento para la muestra</span><select aria-label={`Documento de muestra para ${template.name}, versión ${revision.version}`} value={selectedPreviewTarget} onChange={event => setCuratedPreviewTargets(previous => ({ ...previous, [revision.id]: event.target.value }))} className="h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-[10px] text-foreground">{supportedTargets.map(target => <option key={target} value={target}>{getPdfTemplateTarget(target).label}</option>)}</select></label>}
                        {supportsTarget && !declaredTargets.includes(previewDocument) && <p className="text-[9px] leading-relaxed text-muted-foreground">El PDF seleccionado no está declarado en el ZIP. NovaHub adapta su estructura al diseño de «{getPdfTemplateTarget(previewDocument).moduleLabel}» con el adaptador disponible.</p>}
                        {!supportsTarget && <p className="text-[9px] leading-relaxed text-muted-foreground">El PDF actual no se encuentra entre los destinos declarados o adaptables. La muestra usa uno de los PDF que NovaHub detectó para esta plantilla.</p>}
                        <div className="flex justify-end border-t border-border/40 pt-2"><Button type="button" size="sm" variant="outline" className="h-7 cursor-pointer px-2 text-[10px]" onClick={() => void renderCuratedRevisionPreview(template, revision, appearanceScope, isScopedActive ? curatedOverridesDraft : {}, selectedPreviewTarget)} disabled={!selectedPreviewTarget || curatedBusy}><Eye className="mr-1 size-3" />{previewed ? 'Actualizar vista previa' : 'Previsualizar'}</Button></div>
                      </div>;
                    })}
                  </div>
                </details>)}
              </div>}
              {scopedCuratedSelection && scopedCuratedTemplate && scopedCuratedRevision && <div className="flex items-start justify-between gap-2 rounded-lg border border-primary/25 bg-primary/5 p-2.5">
                <span className="min-w-0"><span className="block text-[10px] font-semibold">{scopedCuratedTemplate.name}</span><span className="mt-0.5 block text-[9px] text-muted-foreground">v{scopedCuratedRevision.version} · {appearanceScope === 'document' ? 'Guardada en el diseño abierto' : `Guardada para ${pdfSharedScopePhrase}`}</span></span>
                <Button type="button" variant="ghost" size="sm" className="h-6 shrink-0 cursor-pointer px-1.5 text-[9px]" onClick={() => void clearCuratedTemplateSelection()} disabled={curatedBusy || (appearanceScope === 'branch' ? !canEditCompanyProfile : !canManageCuratedForTarget)}>Quitar</Button>
              </div>}
            </section>
          </CardContent>
        </details>

        <details data-tour="pdf-designs" className="group rounded-lg border bg-card text-card-foreground shadow-none">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-6 pb-3 pt-6 [&::-webkit-details-marker]:hidden">
            <div className="space-y-1.5"><CardTitle className="text-sm">Mis diseños</CardTitle><CardDescription className="text-xs">Diseños y carpetas de {pdfSharedScopePhrase}.</CardDescription></div>
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <CardContent className="space-y-3 pt-0">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><Button type="button" variant="outline" size="sm" className="cursor-pointer justify-start gap-2" onClick={openNewFolder} disabled={!hasActiveBranchScope || !canCreate}><FolderPlus className="size-4" />Crear carpeta</Button><Button type="button" size="sm" className="cursor-pointer justify-start gap-2" onClick={createDesign} disabled={!hasActiveBranchScope || !canCreate || !selectedTargetEditable}><Plus className="size-4" />Nuevo diseño · {selectedTarget.label}</Button></div>
            <button type="button" onClick={() => setSelectedFolderId(null)} className={cn('flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-bold transition', selectedFolderId === null ? 'border-primary bg-primary/10 text-primary' : 'border-border/40 hover:border-primary/40')}><span className="flex items-center gap-2"><LayoutTemplate className="size-4" />Todos los diseños</span><span className="text-[10px] text-muted-foreground">{visibleDesigns.length}</span></button>
            {isLoading ? <Loader2 className="mx-auto size-5 animate-spin text-primary" /> : <>{folders.map(folder => <div key={folder.id} className="space-y-2"><div className={cn('flex items-center gap-1 rounded-lg border px-2 py-1.5', selectedFolderId === folder.id ? 'border-primary/60 bg-primary/5' : 'border-border/40')}><button type="button" onClick={() => setSelectedFolderId(selectedFolderId === folder.id ? null : folder.id)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"><Folder className="size-4 shrink-0 text-primary" /><span className="truncate text-xs font-bold">{folder.name}</span><span className="text-[10px] text-muted-foreground">{visibleDesigns.filter(record => record.folderId === folder.id).length}</span></button><Button variant="ghost" size="icon" title="Renombrar carpeta" className="size-7 cursor-pointer" onClick={() => openEditFolder(folder)}><Pencil className="size-3" /></Button><Button variant="ghost" size="icon" title="Eliminar carpeta" className="size-7 cursor-pointer text-destructive" onClick={() => deleteFolder(folder)}><Trash2 className="size-3" /></Button></div>{selectedFolderId === folder.id && <div className="space-y-2 pl-3">{selectedFolderDesigns.map(renderDesign)}{!selectedFolderDesigns.length && <p className="rounded-lg border border-dashed border-border/50 p-3 text-center text-[11px] text-muted-foreground">Carpeta vacía.</p>}</div>}</div>)}{selectedFolderId === null && ungroupedDesigns.map(renderDesign)}{activeId === 'draft' && <div className="rounded-xl border border-primary/50 bg-primary/5 p-3 text-sm font-bold">{name}<p className="text-[11px] font-normal text-muted-foreground">Borrador sin guardar</p></div>}{selectedFolderId === null && !ungroupedDesigns.length && !folders.length && activeId !== 'draft' && <p className="py-4 text-center text-xs text-muted-foreground">Aún no tienes diseños guardados.</p>}</>}
          </CardContent>
        </details>
      </aside>

      <main className={cn('min-w-0', activeMobilePanel === 'preview' ? 'block' : 'hidden', isPreviewExpanded && 'xl:col-span-3')}>
        <Card className={cn('flex min-w-0 flex-col overflow-hidden', isPreviewExpanded ? 'min-h-[640px] xl:min-h-[min(90vh,1400px)]' : 'min-h-[580px] xl:min-h-[min(82vh,1100px)]')}>
          <CardHeader className="shrink-0 border-b border-border/50 py-3"><div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><CardTitle className="flex min-w-0 items-center gap-2 truncate text-sm"><FileText className="size-4 shrink-0 text-primary" /><span className="truncate">Diseño PDF · {selectedTarget.label}</span></CardTitle><CardDescription className="truncate text-xs">{name || 'Diseño sin nombre'} · {selectedTarget.moduleLabel} · {hasActiveBranchScope ? activeBranchLabel : 'Selecciona una sucursal para guardar'}</CardDescription></div><div className="flex shrink-0 items-center gap-1.5"><Badge variant={activeId !== 'draft' && activeDesign?.isActive ? 'default' : 'outline'} className="text-[10px]">{activeId === 'draft' ? 'Borrador' : activeDesign?.isActive ? 'Aplicado a exportaciones' : 'Guardado · inactivo'}</Badge><Badge variant="outline" className="text-[10px]">{settings.paperSize} · {settings.orientation === 'portrait' ? 'Vertical' : 'Horizontal'}</Badge></div></div></CardHeader>
          <CardContent className="relative flex min-h-0 flex-1 flex-col p-2">
            <PdfLivePreview sourceUrl={previewUrl} title={previewTitle || selectedTarget.label} isGenerating={isPreviewRendering} error={previewError} isExpanded={isPreviewExpanded} onToggleExpanded={() => { setActiveMobilePanel('preview'); setIsPreviewExpanded(value => !value); }} onHelp={() => setShowTutorial(true)} onRestoreDefault={restoreCurrentTargetDefault} restoreDefaultDisabled={!hasActiveBranchScope || !canEdit || !selectedTargetEditable} isRestoringDefault={isRestoringDefault} onSave={savePreviewedDesign} saveLabel={appearanceScope === 'branch' ? previewedCuratedSelection?.scope === 'branch' ? 'Aplicar a todos los compatibles' : 'Guardar estos cambios' : 'Guardar diseño'} saveDisabled={savePreviewDisabled} isSaving={isSavingAppearance || isSavingFooterProfile || isSaving || curatedBusy} />
          </CardContent>
        </Card>
      </main>

      <aside className={cn('min-w-0 flex-col gap-3 xl:flex', isPreviewExpanded ? 'hidden xl:hidden' : activeMobilePanel === 'settings' ? 'flex' : 'hidden')}>
        {selectedTargetEditable && <PdfAppearanceSettingsPanel
          scope={appearanceScope}
          sharedScopeLabel={pdfSharedScope}
          profile={appearanceProfile}
          overrides={appearanceOverrides}
          effective={appearancePanelValues as Record<string, any>}
          canEditBranch={canEditCompanyProfile}
          canEditDocument={canModifyActive}
          hasImportedHtmlHeader={hasImportedHtmlHeader}
          packagedFontFamilies={activeCuratedRevision?.manifest.fontFamilies || []}
          onScopeChange={changeAppearanceScope}
          onChange={updateAppearance}
          onReset={resetAppearanceOverride}
          onResetAll={resetAllAppearanceOverrides}
        />}
        <details data-tour="pdf-company-identity" className="group rounded-lg border bg-card text-card-foreground shadow-none">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-6 pb-3 pt-6 [&::-webkit-details-marker]:hidden">
            <div className="space-y-1.5"><CardTitle className="flex items-center gap-2 text-sm"><Building2 className="size-4 text-primary" />Identidad global de empresa</CardTitle><CardDescription className="text-xs">Se comparte con todos los documentos PDF {managerScope ? 'del grupo empresarial' : 'de esta sucursal'}.</CardDescription></div>
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/10 p-3"><div className="flex h-16 min-w-20 flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background p-2">{canvasLogo ? <img src={canvasLogo} alt="Logotipo global de empresa" className="max-h-12 max-w-full object-contain" /> : <div className="flex flex-col items-center gap-1 text-muted-foreground"><Building2 className="size-5" /><span className="text-[10px]">Sin logotipo</span></div>}</div><input ref={companyLogoInputRef} type="file" accept="image/*" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadLogo(file); event.currentTarget.value = ''; }} /><Button type="button" variant="outline" size="sm" className="shrink-0 cursor-pointer gap-2" onClick={() => companyLogoInputRef.current?.click()} disabled={!canEditCompanyProfile}><ImagePlus className="size-4" />Subir logo</Button></div>
            <ToggleRow label="Mostrar nombre en este documento" description="Activa u oculta el nombre global en esta plantilla" checked={settings.showCompanyName} onChange={value => update('showCompanyName', value)} disabled={!canModifyActive} />
            <Field label="Nombre"><Input value={companyProfile.name} placeholder={companyName || 'Nombre de empresa'} onChange={event => updateCompanyProfile('name', event.target.value)} disabled={!canEditCompanyProfile} /></Field>
            <Field label="Eslogan"><Input value={companyProfile.slogan} onChange={event => updateCompanyProfile('slogan', event.target.value)} disabled={!canEditCompanyProfile} /></Field>
            <Field label="Dirección"><Input value={companyProfile.address} onChange={event => updateCompanyProfile('address', event.target.value)} disabled={!canEditCompanyProfile} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Identificación fiscal"><Input value={companyProfile.fiscalInfo} onChange={event => updateCompanyProfile('fiscalInfo', event.target.value)} disabled={!canEditCompanyProfile} /></Field><Field label="Teléfono"><Input value={companyProfile.phone} onChange={event => updateCompanyProfile('phone', event.target.value)} disabled={!canEditCompanyProfile} /></Field></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Correo"><Input type="email" value={companyProfile.email} onChange={event => updateCompanyProfile('email', event.target.value)} disabled={!canEditCompanyProfile} /></Field><Field label="Sitio web"><Input value={companyProfile.website} onChange={event => updateCompanyProfile('website', event.target.value)} disabled={!canEditCompanyProfile} /></Field></div>
            <div className="border-t border-border/50 pt-3"><Button type="button" className="w-full gap-2" onClick={() => void saveCompanyProfile()} disabled={!canEditCompanyProfile || isSavingCompanyProfile}>{isSavingCompanyProfile ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />}{isSavingCompanyProfile ? 'Guardando identidad…' : 'Guardar datos globales'}</Button><p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">El logo, nombre, eslogan y contacto se aplicarán a las plantillas PDF {managerScope ? 'del grupo' : 'de la sucursal'}, actuales y nuevas.</p></div>
          </CardContent>
        </details>

        <details data-tour="pdf-footer-settings" className="group rounded-lg border bg-card text-card-foreground shadow-none">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-6 pb-3 pt-6 [&::-webkit-details-marker]:hidden">
            <div className="space-y-1.5"><CardTitle className="flex items-center gap-2 text-sm"><PanelBottom className="size-4 text-primary" />Pie de página</CardTitle><CardDescription className="text-xs">Texto y numeración al pie del PDF.</CardDescription></div>
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <CardContent className="space-y-3 pt-0">
            <Field label="Texto del pie"><Textarea value={String(footerAppearanceValues.footerText ?? '')} onChange={event => updateAppearance('footerText', event.target.value)} disabled={!canEditFooter} placeholder="Gracias por confiar en nosotros." rows={2} /></Field>
            <ToggleRow label="Numeración" description="Muestra la página actual y el total" checked={Boolean(footerAppearanceValues.showPageNumber)} onChange={value => updateAppearance('showPageNumber', value)} disabled={!canEditFooter} />
            <Field label="Formato de página"><select value={String(footerAppearanceValues.pageNumberFormat || 'page-of')} onChange={event => updateAppearance('pageNumberFormat', event.target.value as PdfSettings['pageNumberFormat'])} disabled={!canEditFooter} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="page-of">Página X de Y</option><option value="number-only">Solo número</option><option value="custom">Personalizado</option></select></Field>
            {footerAppearanceValues.pageNumberFormat === 'custom' && <Field label="Formato personalizado"><Input value={String(footerAppearanceValues.pageNumberCustom ?? '')} onChange={event => updateAppearance('pageNumberCustom', event.target.value)} disabled={!canEditFooter} placeholder="Página {page} de {pages}" /></Field>}
            {appearanceScope === 'branch'
              ? <div className="space-y-2 border-t border-border/50 pt-3"><Button type="button" className="w-full gap-2" onClick={() => setGlobalSaveKind('footer')} disabled={!canEditCompanyProfile || isSavingFooterProfile || isSavingAppearance}><PanelBottom className="size-4" />Guardar datos globales del pie de página</Button><p className="text-[10px] leading-relaxed text-muted-foreground">Se aplicará a los PDF de {pdfSharedScopePhrase} que hereden esta configuración, después de confirmar.</p></div>
              : <p className="border-t border-border/50 pt-3 text-[10px] leading-relaxed text-muted-foreground">Los cambios de este pie se guardan únicamente en el PDF con “Guardar diseño”.</p>}
          </CardContent>
        </details>

        <details data-tour="pdf-fields" className="group rounded-xl border border-border/60 bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold [&::-webkit-details-marker]:hidden"><span className="flex items-center gap-2"><FileText className="size-4 text-primary" />Datos que aporta el ERP</span><span className="flex items-center gap-2 text-xs text-muted-foreground">{templateFields.filter(field => field.enabled).length} activos<ChevronDown className="size-4 transition-transform group-open:rotate-180" /></span></summary>
          <div className="space-y-2 border-t border-border/50 p-3">
            <p className="pb-1 text-xs text-muted-foreground">Activa o desactiva datos opcionales. La estructura del documento se conserva.</p>
            {templateFields.map(field => <label key={field.id} className={cn('flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors', field.enabled ? 'border-primary/30 bg-primary/5' : 'border-border/50 bg-background', !canModifyActive && 'cursor-not-allowed opacity-60')}><input type="checkbox" checked={field.enabled} disabled={!canModifyActive} onChange={() => updateTemplateField(field.id, { enabled: !field.enabled })} className="mt-0.5 size-4 shrink-0 accent-primary" /><span className="min-w-0"><span className="block text-xs font-semibold text-foreground">{field.label}</span><span className="mt-0.5 block truncate font-mono text-[10px] text-primary/80">{field.token}</span><span className="mt-1 block truncate text-[10px] text-muted-foreground">Ejemplo: {field.sample}</span></span></label>)}
          </div>
        </details>
      </aside>

    </div>

      <Dialog open={folderDialogOpen} onOpenChange={open => { if (!isSavingFolder) setFolderDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Folder className="size-5 text-primary" />{editingFolderId ? 'Renombrar carpeta' : 'Nueva carpeta de diseños'}</DialogTitle><DialogDescription>Organiza varias plantillas PDF en un mismo espacio para encontrarlas y reutilizarlas.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label htmlFor="pdf-folder-name">Nombre de la carpeta</Label><Input id="pdf-folder-name" value={folderName} onChange={event => setFolderName(event.target.value)} placeholder="Ej. Documentos comerciales" autoFocus onKeyDown={event => { if (event.key === 'Enter') void saveFolder(); }} /></div>
          <DialogFooter><Button type="button" variant="outline" className="cursor-pointer" onClick={() => setFolderDialogOpen(false)} disabled={isSavingFolder}>Cancelar</Button><Button type="button" className="cursor-pointer gap-2" onClick={saveFolder} disabled={!folderName.trim() || isSavingFolder}>{isSavingFolder ? <Loader2 className="size-4 animate-spin" /> : <FolderPlus className="size-4" />}{editingFolderId ? 'Guardar cambios' : 'Crear carpeta'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCuratedPackagePreflightOpen} onOpenChange={open => {
        if (curatedBusy) return;
        setIsCuratedPackagePreflightOpen(open);
        if (!open) setPendingCuratedPackage(null);
      }}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisión del paquete PDF</DialogTitle>
            <DialogDescription>Revisa qué destinos declara el ZIP y cuáles detecta NovaHub que puede adaptar antes de instalarlo como borrador para {pdfSharedScopePhrase}.</DialogDescription>
          </DialogHeader>
          {pendingCuratedPackage && <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
              <p className="font-semibold">{pendingCuratedPackage.preflight.name}</p>
              {pendingCuratedPackage.preflight.description && <p className="mt-1 text-xs text-muted-foreground">{pendingCuratedPackage.preflight.description}</p>}
              <p className="mt-1 text-[10px] text-muted-foreground">Formato del paquete v{pendingCuratedPackage.preflight.schemaVersion} · Carta como base · se adapta a Carta, Oficio, A4, Legal y rollos de 80/58 mm.</p>
            </div>
            <section className="space-y-1.5" aria-label="Compatibilidad detectada por NovaHub">
              <h3 className="text-xs font-semibold">Declarados en el ZIP ({pendingCuratedPackage.preflight.documentTypes.length})</h3>
              <p className="text-[10px] leading-relaxed text-muted-foreground">Estos tipos aparecen explícitamente en <code>manifest.json</code> y tienen composición validada.</p>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {pendingCuratedPackage.preflight.documentTypes.map(target => <li key={target} className="rounded-md border border-border/40 px-2 py-1.5 text-xs">{curatedTargetLabel(target, true)}</li>)}
              </ul>
            </section>
            <section className="space-y-1.5" aria-label="Destinos adaptables en otros módulos">
              <details className="rounded-md border border-border/40 px-2 py-1.5 text-[10px]">
                <summary className="cursor-pointer font-medium">Detectados y adaptables por NovaHub ({pendingPreflightAdaptedTargets.length}) · {pendingPreflightModuleSummary || 'sin destinos adicionales'}</summary>
                <p className="mt-1 leading-relaxed text-muted-foreground">La detección no depende de que dos PDF estén en el mismo módulo: NovaHub mapea los datos del adaptador de cada salida a las regiones dinámicas del ZIP. Si no hay una composición específica, usa una composición de referencia del paquete para generar una muestra. Los datos del ERP se conservan; la vista previa permite revisar el resultado antes de activarlo. Tickets y etiquetas físicos siguen excluidos.</p>
                <div className="mt-1 space-y-1 rounded-md bg-muted/20 p-2">
                  {groupCuratedTargetsByModule(pendingPreflightAdaptedTargets.map(target => target.targetKey)).map(([module, labels]) => <p key={module} className="leading-relaxed"><strong>{module}:</strong> <span className="text-muted-foreground">{labels.join(', ')}</span></p>)}
                </div>
              </details>
            </section>
            <section className="space-y-1.5" aria-label="Composiciones del paquete">
              <h3 className="text-xs font-semibold">Composiciones ({pendingCuratedPackage.preflight.layouts.length})</h3>
              <ul className="space-y-1">
                {pendingCuratedPackage.preflight.layouts.map(layout => <li key={layout.id} className="rounded-md border border-border/40 px-2 py-1.5 text-[10px]"><span className="font-medium">{layout.id}</span><span className="text-muted-foreground"> · {layout.documentTypes.map(target => getPdfTemplateTarget(target).label).join(', ')}</span></li>)}
              </ul>
            </section>
            <section className="space-y-1.5" aria-label="Fuentes locales incluidas">
              <h3 className="text-xs font-semibold">Fuentes incluidas</h3>
              <p className="rounded-md border border-border/40 px-2 py-1.5 text-xs text-muted-foreground">{pendingCuratedPackage.preflight.fontFamilies.length ? pendingCuratedPackage.preflight.fontFamilies.join(', ') : 'El paquete no incluye archivos tipográficos; se aplicará la fuente local indicada por su CSS.'}</p>
            </section>
          </div>}
          <DialogFooter>
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => { setIsCuratedPackagePreflightOpen(false); setPendingCuratedPackage(null); }} disabled={curatedBusy}>Cancelar</Button>
            <Button type="button" className="cursor-pointer gap-2" onClick={() => void confirmCuratedPackageInstall()} disabled={!pendingCuratedPackage || curatedBusy || !canImport}>{curatedBusy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{curatedBusy ? 'Instalando…' : 'Instalar como borrador'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(globalSaveKind)}
        onOpenChange={open => { if (!open && !isSavingAppearance && !isSavingFooterProfile && !curatedBusy) { setGlobalSaveKind(null); setPendingCuratedSave(null); } }}
        title={globalSaveKind === 'footer' ? `¿Guardar el pie para ${pdfSharedScopePhrase}?` : globalSaveKind === 'curated' ? '¿Aplicar la plantilla a todos sus PDF compatibles?' : `¿Guardar cambios para ${pdfSharedScopePhrase}?`}
        description={globalSaveKind === 'footer'
          ? `El texto y la numeración se aplicarán a todos los PDF de ${pdfSharedScopePhrase} que hereden la configuración del pie.`
          : globalSaveKind === 'curated'
            ? `La revisión se publicará y quedará seleccionada para ${pendingCuratedTargets.length ? `${pendingCuratedTargets.length} salidas PDF de ${pendingCuratedModuleSummary}` : 'las salidas que NovaHub detecte como compatibles'} de ${pdfSharedScopePhrase}. Esto incluye destinos declarados y adaptables; las selecciones propias de cada PDF seguirán teniendo prioridad.`
            : `La plantilla visual, composición, espaciado, tipografía y colores se aplicarán a los PDF de ${pdfSharedScopePhrase} que hereden esos valores.`}
        confirmLabel={globalSaveKind === 'curated' ? `Publicar y aplicar a ${pendingCuratedTargets.length || 'todos los'} PDF compatibles` : `Guardar para ${pdfSharedScopePhrase}`}
        cancelLabel="Cancelar"
        variant="warning"
        loading={isSavingAppearance || isSavingFooterProfile || curatedBusy}
        closeOnConfirm={false}
        onConfirm={confirmGlobalSave}
      />
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open && !isDeleting) setDeleteTarget(null); }} title={deleteTarget?.kind === 'design' ? '¿Eliminar plantilla?' : '¿Eliminar carpeta?'} description={deleteTarget?.kind === 'design' ? `La plantilla «${deleteTarget.record.name}» y sus archivos asociados se eliminarán. Esta acción no se puede deshacer.` : `La carpeta «${deleteTarget?.record.name || ''}» se eliminará; sus plantillas quedarán sin carpeta.`} confirmLabel="Eliminar" cancelLabel="Cancelar" variant="destructive" loading={isDeleting} onConfirm={confirmDeletion} />
      {showTutorial && <GuidedTour steps={PDF_DESIGN_TOUR_STEPS} onClose={() => setShowTutorial(false)} title="Documentos PDF" allowTargetInteraction />}
  </div>;
}
