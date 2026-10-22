import { parsePdfHeaderContentSpacing, PDF_HEADER_CONTENT_SPACING_DEFAULT_MM } from './pdf-header-spacing';
import { PDF_TEMPLATE_TARGETS } from './pdf-document-catalog';

export const PDF_APPEARANCE_FONTS = [
  'Arial', 'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Nunito Sans', 'Source Sans 3',
  'Poppins', 'Raleway', 'Ubuntu', 'Fira Sans', 'PT Sans', 'Work Sans', 'DM Sans',
  'Archivo', 'Cabin', 'Manrope', 'Quicksand', 'Rubik', 'Oxygen', 'Oswald', 'Barlow', 'Karla', 'Urbanist', 'Mulish',
  'Merriweather', 'Lora', 'Playfair Display', 'Source Serif 4', 'PT Serif', 'DM Serif Display',
  'Libre Baskerville', 'Noto Serif', 'Crimson Text',
  'IBM Plex Mono', 'JetBrains Mono', 'Inconsolata', 'Fira Code', 'Source Code Pro', 'Space Mono',
  'Caveat', 'Dancing Script', 'Great Vibes', 'Lobster', 'Pacifico', 'Permanent Marker', 'Satisfy',
  'Sacramento', 'Kalam', 'Indie Flower', 'Shadows Into Light', 'Architects Daughter', 'Patrick Hand',
  'Kaushan Script', 'Yellowtail', 'Comic Neue', 'Courgette', 'Gloria Hallelujah', 'Handlee', 'Rock Salt',
  'Tangerine', 'Bad Script',
  'Abril Fatface', 'Anton', 'Bangers', 'Bungee', 'Cinzel Decorative', 'Creepster', 'Monoton', 'Righteous',
  'Teko', 'Black Ops One', 'Press Start 2P', 'Orbitron', 'Bebas Neue', 'Chewy', 'Alfa Slab One',
  'Special Elite', 'Audiowide',
] as const;

export type PdfAppearanceFontFamily = typeof PDF_APPEARANCE_FONTS[number];
const PDF_SYSTEM_FONT_FALLBACKS = new Set(['arial']);

/** True when a catalog family is provided by the browser/OS instead of a bundled @font-face. */
export function pdfFontUsesSystemFallback(family: string) {
  const normalized = String(family || '').replace(/^['"]|['"]$/g, '').trim().toLowerCase();
  return PDF_SYSTEM_FONT_FALLBACKS.has(normalized);
}

export const PDF_APPEARANCE_FONT_SIZE_MIN = 2;
export const PDF_APPEARANCE_FONT_SIZE_MAX = 20;
export type PdfHeaderComposition = 'company-left-logo-right' | 'logo-left-company-right' | 'centered-stack';
export type PdfAppearancePreset = 'light' | 'boxed' | 'bold' | 'striped' | 'bubble' | 'wave' | 'folder';
export const PDF_DOCUMENT_TEMPLATES = [
  { id: 'default-v1', name: 'Predeterminada', description: 'Empresa a la izquierda, logotipo a la derecha y líneas verdes.', headerLayout: 'classic', footerLayout: 'line' },
  { id: 'invoice-wave-v1', name: 'Ondas corporativas', description: 'Cabecera fluida y pie con capas curvas.', headerLayout: 'fluid', footerLayout: 'layers' },
  { id: 'invoice-ribbon-v1', name: 'Cinta moderna', description: 'Franja de marca en la cabecera y banda inferior.', headerLayout: 'ribbon', footerLayout: 'band' },
  { id: 'invoice-diagonal-v1', name: 'Diagonal dinámica', description: 'Composición diagonal con remate geométrico.', headerLayout: 'diagonal', footerLayout: 'notch' },
  { id: 'invoice-editorial-v1', name: 'Editorial limpia', description: 'Jerarquía tipográfica con reglas y pie dividido.', headerLayout: 'editorial', footerLayout: 'split' },
  { id: 'invoice-sidebar-v1', name: 'Acento lateral', description: 'Detalle vertical discreto y pie minimalista.', headerLayout: 'sidebar', footerLayout: 'minimal' },
] as const;
export type PdfDocumentTemplateId = typeof PDF_DOCUMENT_TEMPLATES[number]['id'];

export const PDF_APPEARANCE_PALETTE_KEYS = [
  'primary', 'secondary', 'text', 'line', 'tableHeader', 'tableHeaderText', 'tableRow', 'tableStripe', 'tableBorder',
] as const;

export type PdfAppearancePaletteKey = typeof PDF_APPEARANCE_PALETTE_KEYS[number];
export type PdfAppearancePalette = Partial<Record<PdfAppearancePaletteKey, string>>;
export const PDF_DEFAULT_TEMPLATE_ID = 'default-v1' as const;

export interface PdfCuratedTemplateSelection {
  templateId: string;
  revisionId: string;
  version: number;
  overrides?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    fontSize?: number;
    contentOffsetMm?: number;
    headerComposition?: PdfHeaderComposition;
    headerContentSpacing?: number;
    palette?: PdfAppearancePalette;
  };
}

export interface PdfCuratedTemplateSelections {
  branch: Record<string, PdfCuratedTemplateSelection>;
  document: Record<string, PdfCuratedTemplateSelection>;
}

/** Salidas de sucursal admitidas por el adaptador; las físicas conservan su geometría. */
export const PDF_CURATED_TEMPLATE_TARGETS = PDF_TEMPLATE_TARGETS
  .filter(target => target.branchCustomizable !== false)
  .map(target => target.key);

export interface PdfAppearanceProfile {
  templateId?: typeof PDF_DEFAULT_TEMPLATE_ID;
  templateVersion?: 1;
  documentTemplateId?: PdfDocumentTemplateId;
  headerComposition?: PdfHeaderComposition;
  headerContentSpacing?: number;
  fontFamily?: PdfAppearanceFontFamily;
  fontSize?: number;
  presetId?: PdfAppearancePreset;
  tableStyle?: PdfAppearancePreset;
  palette?: PdfAppearancePalette;
  footerText?: string;
  showPageNumber?: boolean;
  pageNumberFormat?: 'page-of' | 'number-only' | 'custom';
  pageNumberCustom?: string;
  curatedTemplates?: PdfCuratedTemplateSelections;
}

/** Legacy string values remain representable until the user resets an old design. */
export type PdfAppearanceOverrides = Omit<PdfAppearanceProfile, 'fontFamily'> & { fontFamily?: string };
export type PdfAppearanceProperty = keyof PdfAppearanceProfile;
export type PdfAppearanceDraftProperty = Exclude<PdfAppearanceProperty, 'palette' | 'templateId' | 'templateVersion' | 'curatedTemplates'>;
export type PdfAppearanceProfilePatch = Omit<Partial<PdfAppearanceProfile>, 'palette' | 'templateId' | 'templateVersion' | 'curatedTemplates'> & {
  palette?: Partial<Record<PdfAppearancePaletteKey, string | null>> | null;
};
export type PdfAppearanceDraftKey = PdfAppearanceDraftProperty | `palette.${PdfAppearancePaletteKey}`;
export type PdfAppearanceDraftScope = 'branch' | 'document';
export interface PdfAppearanceDraftState {
  profile: Partial<PdfAppearanceProfile>;
  overrides: Partial<PdfAppearanceOverrides>;
}

export const PDF_APPEARANCE_FONT_GROUPS: Array<{ label: string; families: readonly PdfAppearanceFontFamily[] }> = [
  { label: 'Sans serif', families: ['Arial', 'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Nunito Sans', 'Source Sans 3', 'Poppins', 'Raleway', 'Ubuntu', 'Fira Sans', 'PT Sans', 'Work Sans', 'DM Sans', 'Archivo', 'Cabin', 'Manrope', 'Quicksand', 'Rubik', 'Oxygen', 'Oswald', 'Barlow', 'Karla', 'Urbanist', 'Mulish'] },
  { label: 'Serif', families: ['Merriweather', 'Lora', 'Playfair Display', 'Source Serif 4', 'PT Serif', 'DM Serif Display', 'Libre Baskerville', 'Noto Serif', 'Crimson Text'] },
  { label: 'Monoespaciadas', families: ['IBM Plex Mono', 'JetBrains Mono', 'Inconsolata', 'Fira Code', 'Source Code Pro', 'Space Mono'] },
  { label: 'Cursivas y manuscritas', families: ['Caveat', 'Dancing Script', 'Great Vibes', 'Lobster', 'Pacifico', 'Permanent Marker', 'Satisfy', 'Sacramento', 'Kalam', 'Indie Flower', 'Shadows Into Light', 'Architects Daughter', 'Patrick Hand', 'Kaushan Script', 'Yellowtail', 'Comic Neue', 'Courgette', 'Gloria Hallelujah', 'Handlee', 'Rock Salt', 'Tangerine', 'Bad Script'] },
  { label: 'Decorativas', families: ['Abril Fatface', 'Anton', 'Bangers', 'Bungee', 'Cinzel Decorative', 'Creepster', 'Monoton', 'Righteous', 'Teko', 'Black Ops One', 'Press Start 2P', 'Orbitron', 'Bebas Neue', 'Chewy', 'Alfa Slab One', 'Special Elite', 'Audiowide'] },
];

/** Checks whether the loaded @font-face declarations contain a real face for a weight. */
export function pdfFontFacesSupportWeight(faceWeights: readonly string[], requestedWeight: number) {
  return faceWeights.some(value => {
    const descriptor = String(value || 'normal').trim().toLowerCase();
    if (descriptor === 'normal') return requestedWeight === 400;
    if (descriptor === 'bold') return requestedWeight === 700;
    const weights = descriptor.split(/\s+/).map(Number);
    if (!weights.length || weights.some(weight => !Number.isFinite(weight) || weight < 1 || weight > 1000)) return false;
    if (weights.length === 1) return weights[0] === requestedWeight;
    return weights.length === 2 && requestedWeight >= weights[0] && requestedWeight <= weights[1];
  });
}

const HEADER_COMPOSITIONS: readonly PdfHeaderComposition[] = ['company-left-logo-right', 'logo-left-company-right', 'centered-stack'];
const PRESETS: readonly PdfAppearancePreset[] = ['light', 'boxed', 'bold', 'striped', 'bubble', 'wave', 'folder'];
const DEFAULT_STYLE_PALETTE: Record<PdfAppearancePaletteKey, string> = {
  primary: '#01422c', secondary: '#01422c', text: '#334155', line: '#01422c',
  tableHeader: '#01422c', tableHeaderText: '#ffffff', tableRow: '#ffffff', tableStripe: '#f8fafc', tableBorder: '#d7dee7',
};
const APPEARANCE_KEYS: readonly (PdfAppearanceDraftProperty | 'palette')[] = [
  'documentTemplateId', 'headerComposition', 'headerContentSpacing', 'fontFamily', 'fontSize', 'presetId', 'tableStyle',
  'footerText', 'showPageNumber', 'pageNumberFormat', 'pageNumberCustom', 'palette',
];

/** Discards values from an outdated/corrupt profile; API validation remains authoritative. */
export function normalizePdfAppearanceProfile(value: unknown): PdfAppearanceProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const profile: PdfAppearanceProfile = {};
  if (PDF_DOCUMENT_TEMPLATES.some(item => item.id === source.documentTemplateId)) profile.documentTemplateId = source.documentTemplateId as PdfDocumentTemplateId;
  if (HEADER_COMPOSITIONS.includes(source.headerComposition as PdfHeaderComposition)) profile.headerComposition = source.headerComposition as PdfHeaderComposition;
  const headerContentSpacing = parsePdfHeaderContentSpacing(source.headerContentSpacing);
  if (headerContentSpacing !== null) profile.headerContentSpacing = headerContentSpacing;
  if (PDF_APPEARANCE_FONTS.includes(source.fontFamily as PdfAppearanceFontFamily)) profile.fontFamily = source.fontFamily as PdfAppearanceFontFamily;
  const fontSize = source.fontSize;
  if (typeof fontSize === 'number' && Number.isFinite(fontSize) && fontSize >= PDF_APPEARANCE_FONT_SIZE_MIN && fontSize <= PDF_APPEARANCE_FONT_SIZE_MAX) profile.fontSize = fontSize;
  if (PRESETS.includes(source.presetId as PdfAppearancePreset)) profile.presetId = source.presetId as PdfAppearancePreset;
  if (PRESETS.includes(source.tableStyle as PdfAppearancePreset)) profile.tableStyle = source.tableStyle as PdfAppearancePreset;
  if (typeof source.footerText === 'string') profile.footerText = source.footerText.slice(0, 500);
  if (typeof source.showPageNumber === 'boolean') profile.showPageNumber = source.showPageNumber;
  if (['page-of', 'number-only', 'custom'].includes(String(source.pageNumberFormat))) {
    profile.pageNumberFormat = source.pageNumberFormat as PdfAppearanceProfile['pageNumberFormat'];
  }
  if (typeof source.pageNumberCustom === 'string') profile.pageNumberCustom = source.pageNumberCustom.slice(0, 120);
  if (source.templateId === PDF_DEFAULT_TEMPLATE_ID) profile.templateId = PDF_DEFAULT_TEMPLATE_ID;
  if (source.templateVersion === 1) profile.templateVersion = 1;
  if (source.curatedTemplates && typeof source.curatedTemplates === 'object' && !Array.isArray(source.curatedTemplates)) {
    const rawSelections = source.curatedTemplates as Record<string, unknown>;
    const normalizeScope = (scope: unknown): Record<string, PdfCuratedTemplateSelection> => {
      const records = scope && typeof scope === 'object' && !Array.isArray(scope) ? scope as Record<string, unknown> : {};
      const normalized: Record<string, PdfCuratedTemplateSelection> = {};
      for (const [targetKey, rawSelection] of Object.entries(records)) {
        if (!PDF_CURATED_TEMPLATE_TARGETS.includes(targetKey) || !rawSelection || typeof rawSelection !== 'object' || Array.isArray(rawSelection)) continue;
        const selection = rawSelection as Record<string, unknown>;
        if (typeof selection.templateId !== 'string' || !selection.templateId.trim() || typeof selection.revisionId !== 'string' || !selection.revisionId.trim()) continue;
        const version = Number(selection.version);
        if (!Number.isInteger(version) || version < 1) continue;
        const rawOverrides = selection.overrides && typeof selection.overrides === 'object' && !Array.isArray(selection.overrides)
          ? selection.overrides as Record<string, unknown>
          : {};
        const overrides: PdfCuratedTemplateSelection['overrides'] = {};
        for (const key of ['primaryColor', 'secondaryColor'] as const) {
          const color = rawOverrides[key];
          if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) overrides[key] = color;
        }
        if (typeof rawOverrides.fontFamily === 'string' && rawOverrides.fontFamily.length <= 80) overrides.fontFamily = rawOverrides.fontFamily;
        if (typeof rawOverrides.fontSize === 'number' && Number.isFinite(rawOverrides.fontSize) && rawOverrides.fontSize >= 6 && rawOverrides.fontSize <= 16) overrides.fontSize = rawOverrides.fontSize;
        if (typeof rawOverrides.contentOffsetMm === 'number' && Number.isFinite(rawOverrides.contentOffsetMm) && rawOverrides.contentOffsetMm >= 0 && rawOverrides.contentOffsetMm <= 50) overrides.contentOffsetMm = rawOverrides.contentOffsetMm;
        if (HEADER_COMPOSITIONS.includes(rawOverrides.headerComposition as PdfHeaderComposition)) overrides.headerComposition = rawOverrides.headerComposition as PdfHeaderComposition;
        const headerContentSpacing = parsePdfHeaderContentSpacing(rawOverrides.headerContentSpacing);
        if (headerContentSpacing !== null) overrides.headerContentSpacing = headerContentSpacing;
        if (rawOverrides.palette && typeof rawOverrides.palette === 'object' && !Array.isArray(rawOverrides.palette)) {
          const palette: PdfAppearancePalette = {};
          for (const key of PDF_APPEARANCE_PALETTE_KEYS) {
            const color = (rawOverrides.palette as Record<string, unknown>)[key];
            if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) palette[key] = color;
          }
          if (Object.keys(palette).length) overrides.palette = palette;
        }
        normalized[targetKey] = { templateId: selection.templateId, revisionId: selection.revisionId, version, overrides };
      }
      return normalized;
    };
    profile.curatedTemplates = { branch: normalizeScope(rawSelections.branch), document: normalizeScope(rawSelections.document) };
  }
  if (source.palette && typeof source.palette === 'object' && !Array.isArray(source.palette)) {
    const paletteSource = source.palette as Record<string, unknown>;
    const palette: PdfAppearancePalette = {};
    for (const key of PDF_APPEARANCE_PALETTE_KEYS) {
      const color = paletteSource[key];
      if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) palette[key] = color;
    }
    if (Object.keys(palette).length) profile.palette = palette;
  }
  return profile;
}

/** Resolves sparse values independently: document override, branch profile, then current defaults. */
export function resolvePdfAppearance(
  fallback: Partial<PdfAppearanceOverrides> = {},
  profile: Partial<PdfAppearanceProfile> | null | undefined = {},
  overrides: Partial<PdfAppearanceOverrides> | null | undefined = {},
): PdfAppearanceOverrides {
  const branch = normalizePdfAppearanceProfile(profile);
  const local = overrides && typeof overrides === 'object' ? overrides : {};
  const fallbackRecord = fallback as Record<string, unknown>;
  const branchRecord = branch as Record<string, unknown>;
  const localRecord = local as Record<string, unknown>;
  const resolved: Record<string, unknown> = {};

  for (const key of APPEARANCE_KEYS) {
    if (key === 'palette') continue;
    const value = key === 'headerContentSpacing'
      ? parsePdfHeaderContentSpacing(localRecord[key])
        ?? parsePdfHeaderContentSpacing(branchRecord[key])
        ?? parsePdfHeaderContentSpacing(fallbackRecord[key])
      : localRecord[key] ?? branchRecord[key] ?? fallbackRecord[key];
    if (value !== undefined && value !== null) resolved[key] = value;
  }

  const palette: Record<string, string> = {};
  for (const key of PDF_APPEARANCE_PALETTE_KEYS) {
    const value = (localRecord.palette as Record<string, unknown> | undefined)?.[key]
      ?? (branchRecord.palette as Record<string, unknown> | undefined)?.[key]
      ?? (fallbackRecord.palette as Record<string, unknown> | undefined)?.[key];
    if (typeof value === 'string' && value.trim()) palette[key] = value;
  }
  if (Object.keys(palette).length) resolved.palette = palette;
  return resolved as PdfAppearanceOverrides;
}

/** Classifies old saved visual values without mutating the legacy design. */
export function inferLegacyPdfAppearanceOverrides(
  _targetKey: string,
  settings: Record<string, unknown> | null | undefined,
  definition: Record<string, any> | null | undefined,
): PdfAppearanceOverrides {
  const source = settings && typeof settings === 'object' ? settings : {};
  const styleCandidate = definition?.metadata?.pdfStyleConfig;
  const style = styleCandidate && typeof styleCandidate === 'object' && !Array.isArray(styleCandidate)
    ? styleCandidate as Record<string, unknown>
    : {};
  const defaults: Record<string, unknown> = {
    documentTemplateId: 'default-v1',
    headerComposition: 'company-left-logo-right',
    headerContentSpacing: PDF_HEADER_CONTENT_SPACING_DEFAULT_MM,
    fontFamily: 'Arial',
    fontSize: 9,
    presetId: 'light',
    tableStyle: 'light',
    palette: DEFAULT_STYLE_PALETTE,
  };
  const overrides: Record<string, unknown> = {};

  const directProperties: PdfAppearanceDraftProperty[] = [
    'documentTemplateId', 'headerComposition', 'headerContentSpacing', 'fontFamily', 'fontSize', 'presetId', 'tableStyle',
  ];
  for (const property of directProperties) {
    const rawValue = style[property] !== undefined ? style[property] : source[property];
    const raw = property === 'headerContentSpacing' ? parsePdfHeaderContentSpacing(rawValue) : rawValue;
    if (!hasLegacyValue(raw)) continue;
    if (property === 'fontFamily') {
      if (normalizeLegacyFontForComparison(raw) === normalizeLegacyFontForComparison(defaults.fontFamily)) continue;
    } else if (sameLegacyValue(raw, defaults[property])) {
      continue;
    }
    overrides[property] = raw;
  }

  const rawPalette = style.palette !== undefined ? style.palette : source.palette;
  if (rawPalette && typeof rawPalette === 'object' && !Array.isArray(rawPalette)) {
    const paletteOverrides: Record<string, string> = {};
    for (const key of PDF_APPEARANCE_PALETTE_KEYS) {
      const rawColor = (rawPalette as Record<string, unknown>)[key];
      if (!hasLegacyValue(rawColor) || sameLegacyValue(rawColor, (defaults.palette as Record<string, unknown>)[key])) continue;
      paletteOverrides[key] = String(rawColor);
    }
    if (Object.keys(paletteOverrides).length) overrides.palette = paletteOverrides;
  }

  return overrides as PdfAppearanceOverrides;
}

/** Resolves an existing document without rewriting its stored definition. */
export function resolvePdfDesignAppearance(
  settingsValue: Record<string, unknown> | null | undefined,
  definition: Record<string, any> | null | undefined,
  branchProfile: Partial<PdfAppearanceProfile> | null | undefined,
) {
  const settings = settingsValue && typeof settingsValue === 'object' ? settingsValue : {};
  const styleCandidate = definition?.metadata?.pdfStyleConfig;
  const style = styleCandidate && typeof styleCandidate === 'object' && !Array.isArray(styleCandidate)
    ? styleCandidate as Record<string, any>
    : {};
  const hasExplicitOverrides = Object.prototype.hasOwnProperty.call(settings, 'appearanceOverrides');
  const explicitOverrides = settings.appearanceOverrides && typeof settings.appearanceOverrides === 'object'
    ? settings.appearanceOverrides as PdfAppearanceOverrides
    : {};
  // An explicit empty object means the user reset local values and wants to
  // inherit. Legacy inference must not silently reintroduce a reset value.
  const overrides = hasExplicitOverrides
    ? explicitOverrides
    : inferLegacyPdfAppearanceOverrides('', settings, definition);
  const legacyPalette = style.palette && typeof style.palette === 'object' ? style.palette : {};
  const configuredFontFamily = String(style.fontFamily || settings.fontFamily || 'Arial');
  const fallback: PdfAppearanceOverrides = {
    documentTemplateId: (PDF_DOCUMENT_TEMPLATES.some(item => item.id === settings.pdfDocumentTemplateId)
      ? settings.pdfDocumentTemplateId
      : 'default-v1') as PdfDocumentTemplateId,
    headerComposition: settings.headerComposition as PdfHeaderComposition || 'company-left-logo-right',
    headerContentSpacing: parsePdfHeaderContentSpacing(settings.headerContentSpacing) ?? PDF_HEADER_CONTENT_SPACING_DEFAULT_MM,
    fontFamily: normalizeLegacyFontForComparison(configuredFontFamily) === 'arial' ? 'Arial' : configuredFontFamily,
    fontSize: Number(style.fontSize || settings.fontSize) || 9,
    presetId: String(style.presetId || settings.pdfStylePreset || 'light') as PdfAppearancePreset,
    tableStyle: String(style.tableStyle || settings.pdfTableStyle || 'light') as PdfAppearancePreset,
    footerText: typeof settings.footerText === 'string' ? settings.footerText : '',
    ...(typeof settings.showPageNumber === 'boolean' ? { showPageNumber: settings.showPageNumber } : {}),
    ...(typeof settings.pageNumberFormat === 'string' ? { pageNumberFormat: settings.pageNumberFormat as PdfAppearanceProfile['pageNumberFormat'] } : {}),
    ...(typeof settings.pageNumberCustom === 'string' ? { pageNumberCustom: settings.pageNumberCustom } : {}),
    palette: {
      primary: String(legacyPalette.primary || settings.primaryColor || DEFAULT_STYLE_PALETTE.primary),
      secondary: String(legacyPalette.secondary || settings.secondaryColor || DEFAULT_STYLE_PALETTE.secondary),
      text: String(legacyPalette.text || settings.textColor || DEFAULT_STYLE_PALETTE.text),
      line: String(legacyPalette.line || settings.lineColor || DEFAULT_STYLE_PALETTE.line),
      tableHeader: String(legacyPalette.tableHeader || settings.tableHeaderColor || DEFAULT_STYLE_PALETTE.tableHeader),
      tableHeaderText: String(legacyPalette.tableHeaderText || settings.tableHeaderTextColor || DEFAULT_STYLE_PALETTE.tableHeaderText),
      tableRow: String(legacyPalette.tableRow || settings.tableRowColor || DEFAULT_STYLE_PALETTE.tableRow),
      tableStripe: String(legacyPalette.tableStripe || settings.tableStripeColor || DEFAULT_STYLE_PALETTE.tableStripe),
      tableBorder: String(legacyPalette.tableBorder || settings.tableBorderColor || DEFAULT_STYLE_PALETTE.tableBorder),
    },
  };
  const effective = resolvePdfAppearance(fallback, branchProfile, overrides);
  const tableLayout: Record<PdfAppearancePreset, string> = {
    light: 'minimal', boxed: 'boxed', bold: 'boxed', striped: 'striped', bubble: 'cards', wave: 'accent', folder: 'ledger',
  };
  const palette = effective.palette || {};
  return {
    effective,
    overrides,
    settings: {
      ...settings,
      ...effective,
      pdfDocumentTemplateId: effective.documentTemplateId || 'default-v1',
      appearanceOverrides: overrides,
      pdfAppearancePalette: effective.palette,
      pdfStylePreset: effective.presetId,
      pdfTableStyle: effective.tableStyle,
      tableLayout: tableLayout[effective.tableStyle as PdfAppearancePreset] || settings.tableLayout,
      ...(palette.primary ? { primaryColor: palette.primary } : {}),
      ...(palette.secondary ? { secondaryColor: palette.secondary } : {}),
      ...(palette.text ? { textColor: palette.text } : {}),
      ...(palette.line ? { lineColor: palette.line } : {}),
      ...(palette.tableHeader ? { tableHeaderColor: palette.tableHeader } : {}),
      ...(palette.tableHeaderText ? { tableHeaderTextColor: palette.tableHeaderText } : {}),
      ...(palette.tableRow ? { tableRowColor: palette.tableRow } : {}),
      ...(palette.tableStripe ? { tableStripeColor: palette.tableStripe } : {}),
      ...(palette.tableBorder ? { tableBorderColor: palette.tableBorder } : {}),
    },
  };
}

/** Applies explicitly changed PDF appearance values to an imported template at render time.
 * The untouched ERP defaults stay out of the merge so a package keeps its own palette and layout.
 */
export function resolveCuratedTemplateAppearanceOverrides(
  templateOverrides: PdfCuratedTemplateSelection['overrides'] = {},
  profile: Partial<PdfAppearanceProfile> | null | undefined = {},
  documentOverrides: Partial<PdfAppearanceOverrides> | null | undefined = {},
): NonNullable<PdfCuratedTemplateSelection['overrides']> {
  const branch = normalizePdfAppearanceProfile(profile);
  const local = documentOverrides && typeof documentOverrides === 'object' ? documentOverrides : {};
  const result: NonNullable<PdfCuratedTemplateSelection['overrides']> = { ...(templateOverrides || {}) };
  const headerComposition = local.headerComposition
    ?? (branch.headerComposition && !sameLegacyValue(branch.headerComposition, 'company-left-logo-right') ? branch.headerComposition : undefined);
  if (headerComposition) result.headerComposition = headerComposition;
  const headerContentSpacing = local.headerContentSpacing
    ?? (branch.headerContentSpacing !== undefined && !sameLegacyValue(branch.headerContentSpacing, PDF_HEADER_CONTENT_SPACING_DEFAULT_MM) ? branch.headerContentSpacing : undefined);
  if (typeof headerContentSpacing === 'number') result.headerContentSpacing = headerContentSpacing;
  const fontFamily = local.fontFamily
    ?? (branch.fontFamily && !sameLegacyValue(branch.fontFamily, 'Arial') ? branch.fontFamily : undefined);
  if (fontFamily) result.fontFamily = fontFamily;
  const fontSize = local.fontSize
    ?? (branch.fontSize !== undefined && !sameLegacyValue(branch.fontSize, 9) ? branch.fontSize : undefined);
  if (typeof fontSize === 'number') result.fontSize = fontSize;

  const palette: PdfAppearancePalette = { ...(templateOverrides?.palette || {}) };
  const localPalette = local.palette || {};
  const branchPalette = branch.palette || {};
  for (const key of PDF_APPEARANCE_PALETTE_KEYS) {
    const localColor = localPalette[key];
    const branchColor = branchPalette[key];
    const color = localColor ?? (branchColor && !sameLegacyValue(branchColor, DEFAULT_STYLE_PALETTE[key]) ? branchColor : undefined);
    if (typeof color === 'string') palette[key] = color;
  }
  if (Object.keys(palette).length) result.palette = palette;
  if (palette.primary) result.primaryColor = palette.primary;
  if (palette.secondary) result.secondaryColor = palette.secondary;
  return result;
}

function hasLegacyValue(value: unknown): boolean {
  return value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');
}

function normalizeLegacyFontForComparison(value: unknown): string {
  const normalized = String(value || '').replace(/^['"]|['"]$/g, '').trim().toLowerCase();
  return normalized === 'helvetica' ? 'arial' : normalized;
}

function sameLegacyValue(value: unknown, defaultValue: unknown): boolean {
  if (typeof value === 'string' && typeof defaultValue === 'string') return value.trim().toLowerCase() === defaultValue.trim().toLowerCase();
  return Object.is(value, defaultValue);
}

function setAppearanceDraftValue<T extends Record<string, any>>(source: T, key: PdfAppearanceDraftKey, value: unknown): T {
  if (key.startsWith('palette.')) {
    const paletteKey = key.slice('palette.'.length) as PdfAppearancePaletteKey;
    return { ...source, palette: { ...((source.palette as Record<string, unknown> | undefined) || {}), [paletteKey]: value } };
  }
  return { ...source, [key]: value };
}

export function updatePdfAppearanceDraft(
  scope: PdfAppearanceDraftScope,
  profile: Partial<PdfAppearanceProfile>,
  overrides: Partial<PdfAppearanceOverrides>,
  key: PdfAppearanceDraftKey,
  value: unknown,
): PdfAppearanceDraftState {
  return scope === 'branch'
    ? { profile: setAppearanceDraftValue(profile as Record<string, any>, key, value), overrides }
    : { profile, overrides: setAppearanceDraftValue(overrides as Record<string, any>, key, value) };
}

export function resetPdfAppearanceOverride(overrides: PdfAppearanceOverrides, key: PdfAppearanceDraftKey): PdfAppearanceOverrides {
  const next = { ...overrides };
  if (key.startsWith('palette.')) {
    const paletteKey = key.slice('palette.'.length) as PdfAppearancePaletteKey;
    const palette = { ...(next.palette || {}) };
    delete palette[paletteKey];
    if (Object.keys(palette).length) next.palette = palette;
    else delete next.palette;
  } else {
    delete next[key as PdfAppearanceProperty];
  }
  return next;
}

/** Removes a reset property's stale rendered value while leaving content and paper settings intact. */
export function clearPdfAppearanceFallback(
  settingsValue: Record<string, unknown>,
  definitionValue: Record<string, any>,
  key?: PdfAppearanceDraftKey,
) {
  const settings = { ...settingsValue };
  const metadata = definitionValue?.metadata && typeof definitionValue.metadata === 'object'
    ? definitionValue.metadata as Record<string, any>
    : {};
  const sourceStyle = metadata.pdfStyleConfig && typeof metadata.pdfStyleConfig === 'object'
    ? metadata.pdfStyleConfig as Record<string, any>
    : {};
  const style = { ...sourceStyle };
  const stylePalette = { ...(sourceStyle.palette || {}) };
  const settingKeys: Record<PdfAppearanceDraftProperty, string[]> = {
    documentTemplateId: ['pdfDocumentTemplateId'],
    headerComposition: ['headerComposition'],
    headerContentSpacing: ['headerContentSpacing'],
    fontFamily: ['fontFamily'],
    fontSize: ['fontSize'],
    presetId: ['pdfStylePreset'],
    tableStyle: ['pdfTableStyle', 'tableLayout'],
    footerText: ['footerText'],
    showPageNumber: ['showPageNumber'],
    pageNumberFormat: ['pageNumberFormat'],
    pageNumberCustom: ['pageNumberCustom'],
  };
  const paletteSettingKeys: Record<PdfAppearancePaletteKey, string> = {
    primary: 'primaryColor', secondary: 'secondaryColor', text: 'textColor', line: 'lineColor',
    tableHeader: 'tableHeaderColor', tableHeaderText: 'tableHeaderTextColor', tableRow: 'tableRowColor',
    tableStripe: 'tableStripeColor', tableBorder: 'tableBorderColor',
  };
  const clearKey = (item: PdfAppearanceDraftKey) => {
    if (item.startsWith('palette.')) {
      const paletteKey = item.slice('palette.'.length) as PdfAppearancePaletteKey;
      delete settings[paletteSettingKeys[paletteKey]];
      const renderedPalette = { ...((settings.pdfAppearancePalette as Record<string, unknown> | undefined) || {}) };
      delete renderedPalette[paletteKey];
      if (Object.keys(renderedPalette).length) settings.pdfAppearancePalette = renderedPalette;
      else delete settings.pdfAppearancePalette;
      delete stylePalette[paletteKey];
      return;
    }
    const property = item as PdfAppearanceDraftProperty;
    for (const settingKey of settingKeys[property]) delete settings[settingKey];
    delete style[property];
  };

  if (key) clearKey(key);
  else {
    for (const property of APPEARANCE_KEYS) {
      if (property === 'palette') {
        for (const paletteKey of PDF_APPEARANCE_PALETTE_KEYS) clearKey(`palette.${paletteKey}`);
        delete settings.pdfAppearancePalette;
      } else clearKey(property);
    }
  }
  if (Object.keys(stylePalette).length) style.palette = stylePalette;
  else delete style.palette;
  const definition = {
    ...definitionValue,
    metadata: { ...metadata, pdfStyleConfig: style },
  };
  return { settings, definition };
}
