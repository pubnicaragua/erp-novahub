export const PDF_APPEARANCE_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Nunito Sans',
  'Merriweather', 'Lora', 'Playfair Display', 'IBM Plex Mono', 'JetBrains Mono',
] as const;

export type PdfAppearanceFontFamily = typeof PDF_APPEARANCE_FONTS[number];
export type PdfHeaderComposition = 'company-left-logo-right' | 'logo-left-company-right' | 'centered-stack';
export type PdfHeaderContentSpacing = 'small' | 'medium' | 'large';
export type PdfAppearancePreset = 'light' | 'boxed' | 'bold' | 'striped' | 'bubble' | 'wave' | 'folder';

export const PDF_APPEARANCE_PALETTE_KEYS = [
  'primary', 'secondary', 'text', 'line', 'tableHeader', 'tableHeaderText', 'tableRow', 'tableStripe', 'tableBorder',
] as const;

export type PdfAppearancePaletteKey = typeof PDF_APPEARANCE_PALETTE_KEYS[number];
export type PdfAppearancePalette = Partial<Record<PdfAppearancePaletteKey, string>>;

export interface PdfAppearanceProfile {
  headerComposition?: PdfHeaderComposition;
  headerContentSpacing?: PdfHeaderContentSpacing;
  fontFamily?: PdfAppearanceFontFamily;
  fontSize?: number;
  presetId?: PdfAppearancePreset;
  tableStyle?: PdfAppearancePreset;
  palette?: PdfAppearancePalette;
}

/** Legacy string values remain representable until the user resets an old design. */
export type PdfAppearanceOverrides = Omit<PdfAppearanceProfile, 'fontFamily'> & { fontFamily?: string };
export type PdfAppearanceProperty = keyof PdfAppearanceProfile;
export type PdfAppearanceProfilePatch = Omit<Partial<PdfAppearanceProfile>, 'palette'> & {
  palette?: Partial<Record<PdfAppearancePaletteKey, string | null>> | null;
};

export const PDF_APPEARANCE_FONT_GROUPS: Array<{ label: string; families: readonly PdfAppearanceFontFamily[] }> = [
  { label: 'Sans serif', families: ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Nunito Sans'] },
  { label: 'Serif', families: ['Merriweather', 'Lora', 'Playfair Display'] },
  { label: 'Monoespaciadas', families: ['IBM Plex Mono', 'JetBrains Mono'] },
];

const HEADER_COMPOSITIONS: readonly PdfHeaderComposition[] = ['company-left-logo-right', 'logo-left-company-right', 'centered-stack'];
const HEADER_SPACINGS: readonly PdfHeaderContentSpacing[] = ['small', 'medium', 'large'];
const PRESETS: readonly PdfAppearancePreset[] = ['light', 'boxed', 'bold', 'striped', 'bubble', 'wave', 'folder'];
const DEFAULT_STYLE_PALETTE: Record<PdfAppearancePaletteKey, string> = {
  primary: '#65536b', secondary: '#8b7c91', text: '#29313c', line: '#d9dce1',
  tableHeader: '#ffffff', tableHeaderText: '#303541', tableRow: '#ffffff', tableStripe: '#f7f6f8', tableBorder: '#d9dce1',
};
const APPEARANCE_KEYS: readonly PdfAppearanceProperty[] = [
  'headerComposition', 'headerContentSpacing', 'fontFamily', 'fontSize', 'presetId', 'tableStyle', 'palette',
];

/** Discards values from an outdated/corrupt profile; API validation remains authoritative. */
export function normalizePdfAppearanceProfile(value: unknown): PdfAppearanceProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const profile: PdfAppearanceProfile = {};
  if (HEADER_COMPOSITIONS.includes(source.headerComposition as PdfHeaderComposition)) profile.headerComposition = source.headerComposition as PdfHeaderComposition;
  if (HEADER_SPACINGS.includes(source.headerContentSpacing as PdfHeaderContentSpacing)) profile.headerContentSpacing = source.headerContentSpacing as PdfHeaderContentSpacing;
  if (PDF_APPEARANCE_FONTS.includes(source.fontFamily as PdfAppearanceFontFamily)) profile.fontFamily = source.fontFamily as PdfAppearanceFontFamily;
  const fontSize = source.fontSize;
  if (typeof fontSize === 'number' && Number.isFinite(fontSize) && fontSize >= 7 && fontSize <= 16) profile.fontSize = fontSize;
  if (PRESETS.includes(source.presetId as PdfAppearancePreset)) profile.presetId = source.presetId as PdfAppearancePreset;
  if (PRESETS.includes(source.tableStyle as PdfAppearancePreset)) profile.tableStyle = source.tableStyle as PdfAppearancePreset;
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
    const value = localRecord[key] ?? branchRecord[key] ?? fallbackRecord[key];
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
    headerComposition: 'company-left-logo-right',
    headerContentSpacing: 'small',
    fontFamily: 'Arial',
    fontSize: 9,
    presetId: 'light',
    tableStyle: 'light',
    palette: DEFAULT_STYLE_PALETTE,
  };
  const overrides: Record<string, unknown> = {};

  const directProperties: Exclude<PdfAppearanceProperty, 'palette'>[] = [
    'headerComposition', 'headerContentSpacing', 'fontFamily', 'fontSize', 'presetId', 'tableStyle',
  ];
  for (const property of directProperties) {
    const raw = style[property] !== undefined ? style[property] : source[property];
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

export function resetPdfAppearanceOverride(overrides: PdfAppearanceOverrides, key: PdfAppearanceProperty): PdfAppearanceOverrides {
  const next = { ...overrides };
  delete next[key];
  return next;
}
