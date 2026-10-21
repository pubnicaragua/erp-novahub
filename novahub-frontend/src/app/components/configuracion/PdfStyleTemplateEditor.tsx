import { useMemo, useRef, useState } from 'react';
import { Check, Download, FileCode2, Palette, Type, Upload } from 'lucide-react';
import type { PdfStyleConfigV1, PdfStylePalette } from '../../services/pdf-document-style';
import { getPdfTableCellBorders, getPdfTableHeaderCellBorders, getPdfTablePresentation, normalizePdfFontFamily, parsePdfHtmlShell, PDF_STYLE_FONTS, PDF_STYLE_PRESETS, resolvePdfTableRowBackground, sanitizePdfHtmlFragment, sanitizePdfTemplateCss, type PdfStylePresetId } from '../../services/pdf-document-style';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { FastColorInput } from '../ui/FastColorInput';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../ui/utils';
import { createPdfTemplateSampleData, resolveTemplateToken, TEMPLATE_TOKENS } from '../../services/pdf-template-definition';

const HTML_SHELL_EXAMPLE = `<!doctype html>
<html><head><meta charset="utf-8"><style>
.pdf-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 2px solid #65536b; padding: 0 0 12px; }
.pdf-header .company-brand { display: flex; align-items: center; gap: 10px; }
.pdf-header .company-mark { width: 62px; max-width: 62px; }
.pdf-header .company-copy { font-size: 13px; font-weight: 700; }
.pdf-header .company-copy p { margin: 3px 0 0; font-size: 9px; font-weight: 400; }
.pdf-header .company-address { text-align: right; font-size: 9px; line-height: 1.4; }
.pdf-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px solid #d9dce1; padding-top: 8px; font-size: 9px; }
</style></head><body>
  <header data-novahub-zone="header" class="pdf-header">
    <div class="company-brand"><img class="company-mark" data-novahub-logo="true" alt="Logo de la empresa"><div class="company-copy">{{company.name}}<p>{{company.slogan}}</p></div></div>
    <div class="company-address"><strong>{{document.title}} · {{document.number}}</strong><p>{{company.address}} · {{company.phone}}</p></div>
  </header>
  <main data-novahub-content></main>
  <footer data-novahub-zone="footer" class="pdf-footer">
    <span>{{company.email}} · {{company.website}}</span><span>Página {{page.number}} de {{page.pages}}</span>
  </footer>
</body></html>`;

type Props = { value: PdfStyleConfigV1; enabled: boolean; canEdit: boolean; targetKey: string; onChange: (next: PdfStyleConfigV1) => void };

export function PdfStyleTemplateEditor({ value, enabled, canEdit, targetKey, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [copiedToken, setCopiedToken] = useState('');
  const availableTokens = useMemo(() => {
    const sample = createPdfTemplateSampleData(targetKey);
    return [
      ...TEMPLATE_TOKENS.filter(item => item.token !== 'page.number' && resolveTemplateToken(item.token, sample, '__unavailable__') !== '__unavailable__'),
      { token: 'page.number', label: 'Página actual', sample: '1' },
      { token: 'page.pages', label: 'Total de páginas', sample: '3' },
    ];
  }, [targetKey]);
  const update = (patch: Partial<PdfStyleConfigV1>) => {
    const next = { ...value, ...patch };
    if (patch.fontFamily && next.htmlTemplate) {
      next.htmlTemplate = {
        ...next.htmlTemplate,
        headerHtml: sanitizePdfHtmlFragment(next.htmlTemplate.headerHtml, 'header', next.fontFamily),
        footerHtml: sanitizePdfHtmlFragment(next.htmlTemplate.footerHtml, 'footer', next.fontFamily),
        css: sanitizePdfTemplateCss(next.htmlTemplate.css, next.fontFamily),
      };
    }
    onChange(next);
  };
  const updatePalette = (key: keyof PdfStylePalette, color: string) => update({ palette: { ...value.palette, [key]: color } });
  const selectPreset = (id: PdfStylePresetId) => {
    const preset = PDF_STYLE_PRESETS.find(item => item.id === id);
    if (!preset) return;
    update({ presetId: id, tableStyle: preset.tableStyle, palette: { ...preset.palette } });
  };
  const importHtml = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      const shell = parsePdfHtmlShell(await file.text());
      update({ fontFamily: shell.fontFamily || normalizePdfFontFamily(value.fontFamily), htmlTemplate: { ...shell, sourceName: file.name } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo importar el marco HTML.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };
  const downloadExample = () => {
    const url = URL.createObjectURL(new Blob([HTML_SHELL_EXAMPLE], { type: 'text/html;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'marco-pdf-novahub.html';
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const tablePresentation = getPdfTablePresentation(value.tableStyle);

  return <section className="space-y-5" aria-labelledby="pdf-style-editor-title">
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <h3 id="pdf-style-editor-title" className="flex items-center gap-2 text-base font-black"><Palette className="size-4 text-primary" />Tipografía, tabla y colores</h3>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Las tarjetas aplican el estilo de tabla; los controles de abajo ajustan fuente y tonos. La forma del encabezado y el pie se selecciona arriba, sin alterar el contenido ni el orden de las columnas.</p>
      </div>
      <Badge variant="outline" className={cn('shrink-0', enabled ? 'border-primary/40 text-primary' : 'text-muted-foreground')}>{enabled ? 'Estilo activo' : 'Plantilla anterior'}</Badge>
    </div>

    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7" role="group" aria-label="Estilos de tabla">
      {PDF_STYLE_PRESETS.map(preset => {
        const miniatureTable = getPdfTablePresentation(preset.tableStyle);
        return <button key={preset.id} type="button" disabled={!canEdit} aria-pressed={enabled && value.presetId === preset.id} onClick={() => selectPreset(preset.id)} className={cn('min-w-0 rounded-xl border p-2 text-left transition hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60', enabled && value.presetId === preset.id ? 'border-primary bg-primary/10 shadow-sm' : 'border-border/60 bg-card')}>
          <span className="relative mx-auto block aspect-[0.78] w-full max-w-24 overflow-hidden rounded-md border border-border/60 bg-white p-1.5 shadow-sm">
          <span className="mb-1 flex h-[15%] items-center gap-1 border-b border-slate-200 bg-slate-50 px-1"><i className="block size-2 rounded-sm bg-slate-400" /><i className="block h-1 w-8 rounded-full bg-slate-700/70" /><i className="ml-auto block h-1 w-4 rounded-full bg-slate-400/70" /></span>
          <span className="mb-1 block h-[5%] w-[60%] rounded-sm bg-slate-200" />
          <span className="mb-1 grid grid-cols-3 overflow-hidden" style={{ border: miniatureTable.outerBorder ? `${miniatureTable.outerBorderWidth}px solid ${miniatureTable.outerBorderTone === 'accent' ? preset.palette.primary : preset.palette.tableBorder}` : '0', borderRadius: miniatureTable.roundedRows ? 3 : 0 }}>
            {[0, 1, 2].map(column => <i key={`head-${column}`} className="h-2" style={{ background: preset.palette.tableHeader, borderBottom: `${miniatureTable.headerRuleWidth}px solid ${miniatureTable.headerRuleTone === 'accent' ? preset.palette.primary : preset.palette.tableBorder}`, ...(miniatureTable.cellBorders === 'grid' ? { borderLeft: '1px solid #d9dce1', borderRight: '1px solid #d9dce1' } : {}), ...(miniatureTable.rowAccentWidth && column === 0 ? { borderLeft: '2px solid ' + preset.palette.primary } : {}) }} />)}
            {[0, 1, 2].map(row => <span key={row} className="col-span-3 grid grid-cols-3" style={{ marginTop: miniatureTable.rowGap ? '2px' : undefined, background: resolvePdfTableRowBackground(preset.tableStyle, preset.palette, row) }}>{[0, 1, 2].map(column => <i key={column} className="h-1.5" style={{ border: ['grid', 'cards'].includes(miniatureTable.cellBorders) ? `1px solid ${preset.palette.tableBorder}` : undefined, borderBottom: miniatureTable.cellBorders === 'horizontal' ? `1px solid ${preset.palette.tableBorder}` : undefined, borderRadius: miniatureTable.roundedRows && column === 0 ? '3px 0 0 3px' : miniatureTable.roundedRows && column === 2 ? '0 3px 3px 0' : undefined, ...(miniatureTable.rowAccentWidth && column === 0 ? { borderLeft: '2px solid ' + preset.palette.primary } : {}) }} />)}</span>)}
          </span>
          <span className="absolute inset-x-1.5 bottom-1.5 block h-px" style={{ background: preset.palette.secondary }} />
        </span>
        <span className="mt-2 flex items-center justify-between gap-1 text-xs font-bold">{preset.name}{enabled && value.presetId === preset.id && <Check className="size-3.5 text-primary" />}</span>
        <span className="mt-0.5 hidden text-[10px] leading-snug text-muted-foreground sm:block">{preset.description}</span>
      </button>;
      })}
    </div>

    <div className="grid gap-4 rounded-2xl border border-border/50 bg-muted/10 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.75fr)]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label className="flex items-center gap-1.5 text-xs"><Type className="size-3.5" />Familia tipográfica</Label><select disabled={!canEdit} value={value.fontFamily} onChange={event => update({ fontFamily: normalizePdfFontFamily(event.target.value) })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{PDF_STYLE_FONTS.map(font => <option key={font} value={font}>{font}</option>)}</select><p className="text-[10px] text-muted-foreground">Las fuentes importadas se asignan a esta lista; no se suben archivos de fuentes.</p></div>
          <div className="space-y-1.5"><Label htmlFor="pdf-style-font-size" className="text-xs">Tamaño base de fuente · {value.fontSize} pt</Label><Input id="pdf-style-font-size" type="range" min="2" max="20" step="0.5" disabled={!canEdit} value={value.fontSize} onChange={event => update({ fontSize: Number(event.target.value) })} className="h-9 cursor-pointer accent-primary" /><p className="text-[10px] text-muted-foreground">Puede cambiar el ajuste de línea y la cantidad de páginas. Revísalo en la vista previa.</p></div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {([['primary', 'Acento'], ['secondary', 'Acento secundario'], ['text', 'Texto'], ['line', 'Líneas'], ['tableHeader', 'Cabecera tabla'], ['tableHeaderText', 'Texto cabecera'], ['tableRow', 'Filas'], ['tableStripe', 'Filas alternas'], ['tableBorder', 'Bordes tabla']] as Array<[keyof PdfStylePalette, string]>).map(([key, label]) => <label key={key} className="space-y-1 text-[10px] font-bold text-muted-foreground"><span>{label}</span><FastColorInput aria-label={label} value={value.palette[key]} disabled={!canEdit} onChange={color => updatePalette(key, color)} className="h-9 w-full cursor-pointer rounded border border-border/50 p-1" /></label>)}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
          <input ref={inputRef} type="file" accept=".html,.htm,text/html" className="hidden" onChange={event => void importHtml(event.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" disabled={!canEdit} onClick={() => inputRef.current?.click()} className="gap-2"><Upload className="size-3.5" />{value.htmlTemplate ? 'Reemplazar marco HTML' : 'Cargar marco HTML'}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={downloadExample} className="gap-1.5"><Download className="size-3.5" />Descargar ejemplo</Button>
          {value.htmlTemplate && <Badge variant="secondary" className="max-w-full gap-1 truncate"><FileCode2 className="size-3 shrink-0" />{value.htmlTemplate.sourceName || 'Marco propio'}</Badge>}
          {value.htmlTemplate && <Button type="button" variant="ghost" size="sm" disabled={!canEdit} onClick={() => update({ htmlTemplate: undefined })}>Quitar HTML</Button>}
        </div>
        <details className="rounded-lg border border-border/50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold">Campos dinámicos disponibles para esta vista</summary>
          <p className="my-2 text-[10px] text-muted-foreground">Usa estos marcadores en texto del encabezado o pie. Los valores se insertan como texto seguro al generar el PDF.</p>
          <div className="grid max-h-44 gap-1 overflow-y-auto sm:grid-cols-2">
            {availableTokens.map(item => <button key={item.token} type="button" className="flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1 text-left hover:bg-muted" onClick={() => { void navigator.clipboard?.writeText(`{{${item.token}}}`).then(() => setCopiedToken(item.token)).catch(() => setCopiedToken('')); }}>
              <span className="min-w-0"><span className="block truncate text-[10px] font-semibold">{item.label}</span><code className="text-[9px] text-muted-foreground">{`{{${item.token}}}`}</code></span>
              <span className="shrink-0 text-[9px] text-primary">{copiedToken === item.token ? 'Copiado' : 'Copiar'}</span>
            </button>)}
          </div>
        </details>
        <p className="text-[10px] leading-relaxed text-muted-foreground">El archivo debe contener <code>data-novahub-zone="header"</code>, una zona vacía <code>data-novahub-content</code> y <code>data-novahub-zone="footer"</code>. Solo se admite formato seguro en esas zonas; scripts, fuentes y recursos remotos se rechazan.</p>
        {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}
      </div>
      <div className="min-w-0 rounded-xl border border-border/50 bg-background p-3">
        <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Muestra de tabla</p>
        <div className="overflow-hidden" style={{ border: tablePresentation.outerBorder ? `${tablePresentation.outerBorderWidth}px solid ${tablePresentation.outerBorderTone === 'accent' ? value.palette.primary : value.palette.tableBorder}` : '0', borderRadius: tablePresentation.roundedRows ? 8 : 0, fontFamily: value.fontFamily, fontSize: `${Math.min(value.fontSize * 1.333, 16)}px`, color: value.palette.text }}>
          <div className="flex px-2 py-1.5 font-bold" style={{ background: value.palette.tableHeader, color: value.palette.tableHeaderText, textTransform: tablePresentation.headerTextTransform, borderBottom: `${tablePresentation.headerRuleWidth}px solid ${tablePresentation.headerRuleTone === 'accent' ? value.palette.primary : value.palette.tableBorder}` }}>{[['Descripción', 60, 'left'], ['Cant.', 17, 'right'], ['Total', 23, 'right']].map(([label, width, align], columnIndex) => <span key={String(label)} className="min-w-0" style={{ width: `${width}%`, textAlign: align as CSSProperties['textAlign'], boxSizing: 'border-box', ...getPdfTableHeaderCellBorders(value.tableStyle, columnIndex, 3, value.palette.tableBorder, value.palette.primary) }}>{label}</span>)}</div>
          {['Servicio de ejemplo', 'Producto de prueba', 'Traslado local'].map((item, index) => <div key={item} className="flex px-2 py-1.5" style={{ background: resolvePdfTableRowBackground(value.tableStyle, value.palette, index), marginTop: tablePresentation.rowGap || undefined }}>{[[item, 60, 'left'], ['2', 17, 'right'], ['C$ 250.00', 23, 'right']].map(([text, width, align], columnIndex) => <span key={columnIndex} className="min-w-0" style={{ width: `${width}%`, textAlign: align as CSSProperties['textAlign'], boxSizing: 'border-box', ...getPdfTableCellBorders(value.tableStyle, columnIndex, 3, value.palette.tableBorder, value.palette.primary) }}>{text}</span>)}</div>)}
          <div className="flex px-2 py-1.5 font-bold" style={{ borderTop: `${tablePresentation.summaryTone === 'plain' ? 1 : 2}px solid ${tablePresentation.summaryTone === 'plain' ? value.palette.tableBorder : value.palette.primary}`, color: tablePresentation.summaryTone === 'accent' ? value.palette.tableHeaderText : value.palette.primary, background: tablePresentation.summaryTone === 'accent' ? value.palette.primary : tablePresentation.summaryTone === 'header' ? value.palette.tableHeader : tablePresentation.summaryTone === 'stripe' ? value.palette.tableStripe : 'transparent' }}><span className="flex-1">Total</span><span>C$ 750.00</span></div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t pt-2 text-[10px] text-muted-foreground" style={{ borderColor: value.palette.line, fontFamily: value.fontFamily }}><span>Encabezado y contenido conservados</span><span>Página 1</span></div>
      </div>
    </div>
  </section>;
}
