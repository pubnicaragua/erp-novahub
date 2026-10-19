export const PDF_APPEARANCE_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Nunito Sans', 'Source Sans 3',
  'Poppins', 'Raleway', 'Ubuntu', 'Fira Sans', 'PT Sans', 'Work Sans', 'DM Sans',
  'Archivo', 'Cabin', 'Manrope', 'Quicksand', 'Rubik', 'Oxygen', 'Oswald', 'Barlow', 'Karla', 'Urbanist', 'Mulish',
  'Merriweather', 'Lora', 'Playfair Display', 'Source Serif 4', 'PT Serif', 'DM Serif Display',
  'Libre Baskerville', 'Noto Serif', 'Crimson Text',
  'IBM Plex Mono', 'JetBrains Mono', 'Inconsolata', 'Fira Code', 'Source Code Pro', 'Space Mono',
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
export type PdfAppearanceDraftKey = PdfAppearanceProperty | `palette.${PdfAppearancePaletteKey}`;
export type PdfAppearanceDraftScope = 'branch' | 'document';
export interface PdfAppearanceDraftState {
  profile: Partial<PdfAppearanceProfile>;
  overrides: Partial<PdfAppearanceOverrides>;
}

export const PDF_APPEARANCE_FONT_GROUPS: Array<{ label: string; families: readonly PdfAppearanceFontFamily[] }> = [
  { label: 'Sans serif', families: ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Nunito Sans', 'Source Sans 3', 'Poppins', 'Raleway', 'Ubuntu', 'Fira Sans', 'PT Sans', 'Work Sans', 'DM Sans', 'Archivo', 'Cabin', 'Manrope', 'Quicksand', 'Rubik', 'Oxygen', 'Oswald', 'Barlow', 'Karla', 'Urbanist', 'Mulish'] },
  { label: 'Serif', families: ['Merriweather', 'Lora', 'Playfair Display', 'Source Serif 4', 'PT Serif', 'DM Serif Display', 'Libre Baskerville', 'Noto Serif', 'Crimson Text'] },
  { label: 'Monoespaciadas', families: ['IBM Plex Mono', 'JetBrains Mono', 'Inconsolata', 'Fira Code', 'Source Code Pro', 'Space Mono'] },
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
    headerComposition: settings.headerComposition as PdfHeaderComposition || 'company-left-logo-right',
    headerContentSpacing: settings.headerContentSpacing as PdfHeaderContentSpacing || 'small',
    fontFamily: normalizeLegacyFontForComparison(configuredFontFamily) === 'arial' ? 'Arial' : configuredFontFamily,
    fontSize: Number(style.fontSize || settings.fontSize) || 9,
    presetId: String(style.presetId || settings.pdfStylePreset || 'light') as PdfAppearancePreset,
    tableStyle: String(style.tableStyle || settings.pdfTableStyle || 'light') as PdfAppearancePreset,
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
  const settingKeys: Record<Exclude<PdfAppearanceProperty, 'palette'>, string[]> = {
    headerComposition: ['headerComposition'],
    headerContentSpacing: ['headerContentSpacing'],
    fontFamily: ['fontFamily'],
    fontSize: ['fontSize'],
    presetId: ['pdfStylePreset'],
    tableStyle: ['pdfTableStyle', 'tableLayout'],
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
    const property = item as Exclude<PdfAppearanceProperty, 'palette'>;
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
