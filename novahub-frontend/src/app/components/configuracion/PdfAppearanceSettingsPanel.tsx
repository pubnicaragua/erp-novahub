import React from 'react';
import { Check, ChevronDown, RotateCcw, SwatchBook, Type } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../ui/utils';
import {
  PDF_APPEARANCE_FONT_GROUPS,
  PDF_APPEARANCE_FONT_SIZE_MAX,
  PDF_APPEARANCE_FONT_SIZE_MIN,
  type PdfAppearanceDraftKey,
  type PdfAppearanceDraftScope,
  type PdfAppearanceOverrides,
  type PdfAppearancePaletteKey,
  type PdfAppearanceProfile,
} from '../../services/pdf-appearance';
import {
  normalizePdfHeaderContentSpacing,
  parsePdfHeaderContentSpacing,
  PDF_HEADER_CONTENT_SPACING_MAX_MM,
  PDF_HEADER_CONTENT_SPACING_MIN_MM,
  type PdfHeaderContentSpacing,
} from '../../services/pdf-header-spacing';

const COMPOSITIONS = [
  { value: 'company-left-logo-right', label: 'Datos izq. · logo der.' },
  { value: 'logo-left-company-right', label: 'Logo izq. · datos der.' },
  { value: 'centered-stack', label: 'Centrado' },
] as const;
const PROPERTY_LABELS: Partial<Record<PdfAppearanceDraftKey, string>> = {
  headerComposition: 'Composición del encabezado', headerContentSpacing: 'Espacio después del encabezado',
  fontFamily: 'Fuente del documento', fontSize: 'Tamaño base',
  'palette.primary': 'Color principal',
  'palette.secondary': 'Color secundario',
  'palette.text': 'Texto del documento',
  'palette.line': 'Líneas y separadores',
  'palette.tableHeader': 'Fondo del encabezado de tabla',
  'palette.tableHeaderText': 'Texto del encabezado de tabla',
  'palette.tableRow': 'Fondo de las filas',
  'palette.tableStripe': 'Fondo de filas alternas',
  'palette.tableBorder': 'Bordes de tablas',
};

const PALETTE_GROUPS: Array<{ label: string; keys: PdfAppearancePaletteKey[] }> = [
  { label: 'Encabezado y pie', keys: ['primary', 'secondary', 'text', 'line'] },
  { label: 'Tablas', keys: ['tableHeader', 'tableHeaderText', 'tableRow', 'tableStripe', 'tableBorder'] },
];

function hasLocalOverride(overrides: PdfAppearanceOverrides, key: PdfAppearanceDraftKey) {
  if (key.startsWith('palette.')) return overrides.palette?.[key.slice(8) as PdfAppearancePaletteKey] !== undefined;
  return (overrides as Record<string, unknown>)[key] !== undefined;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0 space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}

function PdfHeaderSpacingInput({ value, disabled, onChange }: { value: PdfHeaderContentSpacing; disabled: boolean; onChange: (spacing: number) => void }) {
  const normalizedValue = normalizePdfHeaderContentSpacing(value);
  const [draftState, setDraftState] = React.useState({ value: normalizedValue, text: String(normalizedValue) });
  const draft = draftState.value === normalizedValue ? draftState.text : String(normalizedValue);

  const commit = () => {
    const spacing = parsePdfHeaderContentSpacing(draft);
    if (spacing === null) {
      setDraftState({ value: normalizedValue, text: String(normalizedValue) });
      return;
    }
    onChange(spacing);
    setDraftState({ value: spacing, text: String(spacing) });
  };

  return <div>
    <div className="flex items-center gap-2">
      <Input
        aria-label="Espacio después del encabezado PDF en milímetros"
        type="number"
        min={PDF_HEADER_CONTENT_SPACING_MIN_MM}
        max={PDF_HEADER_CONTENT_SPACING_MAX_MM}
        step={0.5}
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        onChange={event => {
          const next = event.target.value;
          if (!next.trim() || next.endsWith('.')) {
            setDraftState({ value: normalizedValue, text: next });
            return;
          }
          const spacing = Number(next);
          if (Number.isFinite(spacing) && spacing >= PDF_HEADER_CONTENT_SPACING_MIN_MM && spacing <= PDF_HEADER_CONTENT_SPACING_MAX_MM) {
            setDraftState({ value: spacing, text: next });
            onChange(spacing);
          } else {
            setDraftState({ value: normalizedValue, text: next });
          }
        }}
        onBlur={commit}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
        className="h-9 min-w-0 text-xs"
      />
      <span className="shrink-0 text-xs text-muted-foreground">mm</span>
    </div>
    <p className="pt-1 text-[10px] text-muted-foreground">De 0 a 50 mm; admite medios milímetros.</p>
  </div>;
}

function PdfColorPicker({ value, disabled, label, onChange }: { value: string; disabled: boolean; label: string; onChange: (color: string) => void }) {
  const [draftState, setDraftState] = React.useState({ value, text: value });
  const draft = draftState.value === value ? draftState.text : value;
  const isHexColor = (color: string) => /^#[0-9a-f]{6}$/i.test(color);

  return <div className="flex min-w-0 items-center gap-2">
    <Input
      aria-label={`Selector de ${label}`}
      type="color"
      value={isHexColor(value) ? value : '#000000'}
      disabled={disabled}
      onChange={event => {
        const color = event.target.value.toUpperCase();
        setDraftState({ value: color, text: color });
        onChange(color);
      }}
      className="h-9 w-12 shrink-0 cursor-pointer p-1"
    />
    <Input
      aria-label={`Código hexadecimal de ${label}`}
      value={draft}
      maxLength={7}
      disabled={disabled}
      placeholder="#1A2B3C"
      onChange={event => {
        const color = event.target.value.toUpperCase();
        setDraftState({ value, text: color });
        if (isHexColor(color)) onChange(color);
      }}
      onBlur={() => { setDraftState({ value, text: isHexColor(draft) ? draft : value }); }}
      className="h-9 min-w-0 font-mono text-xs uppercase"
    />
  </div>;
}

function PdfFontFamilyPicker({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (family: string) => void }) {
  const [query, setQuery] = React.useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const groups = PDF_APPEARANCE_FONT_GROUPS.map(group => ({
    ...group,
    families: group.families.filter(family => !normalizedQuery || family.toLocaleLowerCase().includes(normalizedQuery)),
  })).filter(group => group.families.length > 0);
  const fallbackFor = (label: string) => label === 'Serif' ? 'serif'
    : label === 'Monoespaciadas' ? 'monospace'
      : label === 'Cursivas y manuscritas' ? 'cursive'
        : label === 'Decorativas' ? 'fantasy' : 'sans-serif';
  const selectedGroup = PDF_APPEARANCE_FONT_GROUPS.find(group => group.families.some(family => family === value));

  return <details data-font-family-picker className={`group min-w-0 rounded-md border border-input bg-background ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
    <summary aria-label={`Elegir fuente del documento; actual: ${value}`} aria-disabled={disabled} tabIndex={disabled ? -1 : 0} className="flex h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 text-xs [&::-webkit-details-marker]:hidden">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium">{value}</span>
        <span aria-hidden="true" className="truncate text-base text-muted-foreground" style={{ fontFamily: `"${value}", ${fallbackFor(selectedGroup?.label || '')}` }}>Aa Bb 123</span>
      </span>
      <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
    </summary>
    <div className="border-t border-border/60 p-2">
      <Input aria-label="Buscar tipografía" placeholder="Buscar tipografía…" value={query} disabled={disabled} onChange={event => setQuery(event.target.value)} className="mb-2 h-9 text-xs" />
      <ScrollArea type="always" className="pdf-font-family-scrollarea h-[18rem] w-full rounded-md border border-border/60" aria-label="Familias de fuente disponibles">
        <div className="pdf-font-family-list min-w-0">
        {groups.length ? groups.map(group => <section key={group.label} aria-label={group.label}>
          <div className="sticky top-0 z-[1] bg-muted/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</div>
          {group.families.map(family => {
            const selected = family === value;
            return <button
              key={family}
              type="button"
              aria-pressed={selected}
              data-font-family-option={family}
              disabled={disabled}
              onClick={event => {
                onChange(family);
                event.currentTarget.closest('details')?.removeAttribute('open');
                setQuery('');
              }}
              className="flex min-h-11 w-full items-center justify-between gap-2 border-b border-border/40 px-2.5 py-1.5 text-left last:border-b-0 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 truncate text-xs font-medium">{family}</span>
              <span className="shrink-0 text-lg leading-none text-foreground/90" style={{ fontFamily: `"${family}", ${fallbackFor(group.label)}` }}>Aa Bb Cc 123</span>
              {selected && <Check aria-hidden="true" className="size-3.5 shrink-0 text-primary" />}
            </button>;
          })}
        </section>) : <p className="px-3 py-5 text-center text-xs text-muted-foreground">No hay fuentes que coincidan con «{query}».</p>}
        </div>
      </ScrollArea>
      <p className="pt-2 text-[10px] text-muted-foreground">La selección se aplica a todo el documento y actualiza la vista previa.</p>
    </div>
  </details>;
}

export interface PdfAppearanceSettingsPanelProps {
  scope: PdfAppearanceDraftScope;
  profile: Partial<PdfAppearanceProfile>;
  overrides: Partial<PdfAppearanceOverrides>;
  effective: Record<string, any>;
  canEditBranch: boolean;
  canEditDocument: boolean;
  hasImportedHtmlHeader?: boolean;
  onScopeChange: (scope: PdfAppearanceDraftScope) => void;
  onChange: (key: PdfAppearanceDraftKey, value: unknown) => void;
  onReset: (key: PdfAppearanceDraftKey) => void;
  onResetAll: () => void;
}

export function PdfAppearanceSettingsPanel({
  scope, profile, overrides, effective, canEditBranch, canEditDocument,
  hasImportedHtmlHeader = false, onScopeChange, onChange, onReset, onResetAll,
}: PdfAppearanceSettingsPanelProps) {
  const branchScope = scope === 'branch';
  const disabled = branchScope ? !canEditBranch : !canEditDocument;
  const configuredGlobalProperties = Object.keys(profile).length;
  const property = (key: PdfAppearanceDraftKey, value: unknown, control: React.ReactNode) => (
    <div className="space-y-1.5 rounded-lg border border-border/50 bg-background p-2.5" key={key}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{PROPERTY_LABELS[key] || key}</Label>
        <div className="flex items-center gap-1">
          <span className={cn('text-[9px] font-medium', !branchScope && hasLocalOverride(overrides as PdfAppearanceOverrides, key) ? 'text-primary' : 'text-muted-foreground')}>
            {branchScope ? 'Global' : hasLocalOverride(overrides as PdfAppearanceOverrides, key) ? 'Solo este PDF' : 'Heredado'}
          </span>
          {!branchScope && hasLocalOverride(overrides as PdfAppearanceOverrides, key) && <button type="button" onClick={() => onReset(key)} disabled={disabled} className="inline-flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Restablecer ${PROPERTY_LABELS[key] || key} a la apariencia global`} title="Heredar valor global"><RotateCcw className="size-3" /></button>}
        </div>
      </div>
      {control}
      {branchScope && value !== undefined && <span className="sr-only">Valor compartido entre los PDF de la sucursal activa</span>}
    </div>
  );

  return <details data-tour="pdf-appearance" className="group rounded-lg border bg-card text-card-foreground shadow-none">
    <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-6 pb-3 pt-6 [&::-webkit-details-marker]:hidden">
      <div className="space-y-1.5"><h3 className="flex items-center gap-2 text-sm font-semibold"><SwatchBook className="size-4 text-primary" />Apariencia del PDF</h3><p className="text-xs text-muted-foreground">Define la presentación compartida o solo de este diseño.</p></div>
      <span aria-hidden="true" className="mt-0.5 text-muted-foreground transition-transform group-open:rotate-180">⌄</span>
    </summary>
    <div className="space-y-3 px-6 pb-5 pt-0">
      <Field label="Alcance de esta configuración">
        <select aria-label="Alcance de la apariencia PDF" value={scope} disabled={(!canEditBranch && !canEditDocument)} onChange={event => onScopeChange(event.target.value as PdfAppearanceDraftScope)} className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60">
          <option value="branch" disabled={!canEditBranch}>Todos los PDF de esta sucursal</option>
          <option value="document" disabled={!canEditDocument}>Solo este PDF</option>
        </select>
      </Field>
      <p className="rounded-md border border-primary/15 bg-primary/5 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
        {branchScope ? `Los cambios guardados se aplicarán a los PDF editables de esta sucursal que hereden cada propiedad.${configuredGlobalProperties ? ` Hay ${configuredGlobalProperties} propiedades globales configuradas.` : ' Aún no hay propiedades globales guardadas.'}` : 'Los cambios se guardan únicamente en el diseño abierto. Las propiedades sin override siguen heredando la configuración global.'}
      </p>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold"><Type className="size-3.5 text-primary" />Encabezado y tipografía</div>
        {property('headerComposition', effective.headerComposition, <select aria-label="Composición del encabezado PDF" value={effective.headerComposition || 'company-left-logo-right'} disabled={disabled || hasImportedHtmlHeader} onChange={event => onChange('headerComposition', event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs disabled:cursor-not-allowed disabled:opacity-60">{COMPOSITIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>)}
        {hasImportedHtmlHeader && <p className="text-[10px] text-muted-foreground">El encabezado HTML importado conserva su propia composición.</p>}
        {property('headerContentSpacing', effective.headerContentSpacing, <PdfHeaderSpacingInput value={normalizePdfHeaderContentSpacing(effective.headerContentSpacing)} disabled={disabled} onChange={spacing => onChange('headerContentSpacing', spacing)} />)}
        {property('fontFamily', effective.fontFamily, <PdfFontFamilyPicker value={effective.fontFamily || 'Inter'} disabled={disabled} onChange={font => onChange('fontFamily', font)} />)}
        {property('fontSize', effective.fontSize, <div className="flex items-center gap-2"><Input aria-label="Tamaño base de fuente PDF" type="number" min={PDF_APPEARANCE_FONT_SIZE_MIN} max={PDF_APPEARANCE_FONT_SIZE_MAX} step={0.5} value={effective.fontSize || 9} disabled={disabled} onChange={event => onChange('fontSize', Number(event.target.value))} className="h-9 text-xs" /><span className="text-xs text-muted-foreground">pt</span></div>)}
      </div>
      <div className="space-y-2 border-t border-border/50 pt-3">
        <div className="flex items-center gap-2 text-xs font-semibold"><SwatchBook className="size-3.5 text-primary" />Colores del PDF</div>
        <p className="text-[10px] leading-relaxed text-muted-foreground">Estos colores pertenecen al PDF y se conservan aunque cambies el tema de la aplicación. Elige si aplicarlos a todos los PDF de la sucursal o solo a este diseño.</p>
        {PALETTE_GROUPS.map(group => <section key={group.label} className="space-y-2" aria-label={group.label}>
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.keys.map(paletteKey => {
              const key = `palette.${paletteKey}` as const;
              const value = String(effective.palette?.[paletteKey] || '#000000');
              return property(key, value, <PdfColorPicker value={value} disabled={disabled} label={PROPERTY_LABELS[key] || paletteKey} onChange={color => onChange(key, color)} />);
            })}
          </div>
        </section>)}
      </div>
      {!branchScope && <div className="space-y-2 border-t border-border/50 pt-3"><Button type="button" variant="outline" className="w-full gap-2" onClick={onResetAll} disabled={!canEditDocument || !Object.keys(overrides).length}><RotateCcw className="size-3.5" />Restablecer a apariencia global</Button><p className="text-[10px] text-muted-foreground">Guarda con el botón del previsualizador para conservar los cambios en este PDF.</p></div>}
    </div>
  </details>;
}
