import { useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, Image as ImageIcon, ReceiptText, Sparkles } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { PDF_DOWNLOAD_OPTIONS, type PdfDownloadFormat, type PdfExportScope } from '../../utils/pdfDownloadFormats';

export interface PdfDownloadExtraOptions {
  withImages?: boolean;
}

interface PdfDownloadButtonProps {
  onDownload: (format: PdfDownloadFormat, scope?: PdfExportScope, filter?: string, options?: PdfDownloadExtraOptions) => void;
  onExcel?: (scope?: PdfExportScope, filter?: string) => void;
  className?: string;
  disabled?: boolean;
  size?: 'default' | 'sm' | 'lg';
  includeRoll?: boolean;
  includePageSizes?: boolean;
  hasImages?: boolean;
  imagesCount?: number;
  label?: string;
  standardLabel?: string;
  standardDescription?: string;
  showStandardOptions?: boolean;
  showNovaHubFormat?: boolean;
  firstOption?: {
    label: string;
    description?: string;
    onSelect: () => void;
  };
  scopeSelector?: {
    defaultScope?: PdfExportScope;
    pageCount?: number;
    totalCount?: number;
  };
  filterSelector?: {
    label?: string;
    defaultValue?: string;
    options: Array<{ value: string; label: string; description?: string }>;
  };
}

/** Menú único para previsualizar una transacción sin ofrecer reportes de la tabla. */
export function PdfDownloadButton({ onDownload, onExcel, className, disabled = false, size = 'sm', includeRoll = false, includePageSizes = false, hasImages = false, imagesCount = 0, label = 'Descargar', standardLabel = 'PDF normal', standardDescription = 'Diseño asignado o global', showStandardOptions = true, showNovaHubFormat = true, firstOption, scopeSelector, filterSelector }: PdfDownloadButtonProps) {
  const [scope, setScope] = useState<PdfExportScope>(scopeSelector?.defaultScope || 'page');
  const [filter, setFilter] = useState(filterSelector?.defaultValue || filterSelector?.options[0]?.value || '');
  const [includeAttachedImages, setIncludeAttachedImages] = useState(true);
  const [useNovaHubFormat, setUseNovaHubFormat] = useState(false);
  const rollOptions = includeRoll ? PDF_DOWNLOAD_OPTIONS.filter((option) => option.group === 'roll') : [];
  const pageSizeOptions = includePageSizes ? PDF_DOWNLOAD_OPTIONS.filter((option) => option.group === 'standard') : [];

  const triggerDownload = (format: PdfDownloadFormat) => {
    onDownload(
      format,
      scopeSelector ? scope : undefined,
      filterSelector ? filter : undefined,
      hasImages || imagesCount > 0 ? { withImages: includeAttachedImages } : undefined,
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size={size} disabled={disabled} className={cn('group gap-1.5 rounded-xl', className)}>
          <Download className="size-4 shrink-0 text-primary transition-colors group-hover:text-foreground" />
          {Boolean(label) && <span>{label}</span>}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[min(80vh,34rem)] w-64 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl p-1.5">
        {(hasImages || imagesCount > 0) && (
          <>
            <DropdownMenuLabel className="flex items-center gap-1.5 px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-popover-foreground/75">
              <ImageIcon className="size-3.5 text-primary" /> Renders / Imágenes
            </DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={includeAttachedImages}
              onCheckedChange={setIncludeAttachedImages}
              className="py-2"
              onSelect={(event) => event.preventDefault()}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Incluir imágenes adjuntas</span>
                <span className="block text-[10px] text-popover-foreground/75">
                  {imagesCount > 0 ? `${imagesCount} imagen(es) en anexo visual` : 'Anexo de renders y fotos'}
                </span>
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
          </>
        )}
        {firstOption && <DropdownMenuItem onClick={firstOption.onSelect} className="gap-2 rounded-xl py-2.5 [&_svg]:text-foreground/80 data-[highlighted]:[&_svg]:!text-primary-foreground">
          <Download className="size-4" />
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{firstOption.label}</span>
            {firstOption.description && <span className="block text-[10px] text-popover-foreground/75">{firstOption.description}</span>}
          </span>
        </DropdownMenuItem>}
        {firstOption && showStandardOptions && <DropdownMenuSeparator />}
        {scopeSelector && <>
          <DropdownMenuLabel className="px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-popover-foreground/75">Alcance del reporte</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={scope} onValueChange={(value) => setScope(value as PdfExportScope)}>
            <DropdownMenuRadioItem value="page" className="py-2" onSelect={(event) => event.preventDefault()}>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Solo esta página</span>
                <span className="block text-[10px] text-popover-foreground/75">{scopeSelector.pageCount ?? 0} registro(s) visibles</span>
              </span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="all" className="py-2" onSelect={(event) => event.preventDefault()}>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Todos los registros</span>
                <span className="block text-[10px] text-popover-foreground/75">{scopeSelector.totalCount ?? 0} registro(s) filtrados</span>
              </span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
        </>}
        {filterSelector && <>
          <DropdownMenuLabel className="px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-popover-foreground/75">{filterSelector.label || 'Filtro del reporte'}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={filter} onValueChange={setFilter}>
            {filterSelector.options.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value} className="py-2" onSelect={(event) => event.preventDefault()}>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{option.label}</span>
                  {option.description && <span className="block text-[10px] text-popover-foreground/75">{option.description}</span>}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
        </>}
        {onExcel && <>
          <DropdownMenuItem onClick={() => onExcel(scopeSelector ? scope : undefined, filterSelector ? filter : undefined)} className="gap-2 rounded-xl py-2.5 [&_svg]:text-emerald-600 data-[highlighted]:[&_svg]:!text-primary-foreground">
            <FileSpreadsheet className="size-4" />
            <span className="min-w-0 flex-1"><span className="block font-bold">Exportar Excel</span><span className="block text-[10px] text-popover-foreground/75">Todos los registros filtrados</span></span>
          </DropdownMenuItem>
          {(showStandardOptions || includeRoll) && <DropdownMenuSeparator />}
        </>}
        {showStandardOptions && (
          <>
            {showNovaHubFormat && (
              <>
                <DropdownMenuCheckboxItem
                  checked={useNovaHubFormat}
                  onCheckedChange={setUseNovaHubFormat}
                  className="py-2 text-primary"
                  onSelect={(event) => event.preventDefault()}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Sparkles className="size-3.5 text-primary" /> Exportar con NovaHubFormat
                    </span>
                    <span className="block text-[10px] text-popover-foreground/75">
                      Diseño empresarial independiente con color de marca
                    </span>
                  </span>
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => triggerDownload(useNovaHubFormat ? 'novahub-format' : 'configured')} className="gap-2 rounded-xl py-2.5 [&_svg]:text-foreground/80 data-[highlighted]:[&_svg]:!text-primary-foreground">
              <Download className="size-4" />
              <span className="min-w-0 flex-1">
                <span className="block font-bold">
                  {useNovaHubFormat
                    ? 'Exportar PDF · NovaHubFormat'
                    : includePageSizes && standardLabel === 'PDF normal'
                      ? 'Exportar PDF · Diseño asignado'
                      : standardLabel === 'PDF normal'
                        ? 'Exportar PDF · Carta'
                        : standardLabel}
                </span>
                <span className="block text-[10px] text-popover-foreground/75">
                  {useNovaHubFormat
                    ? 'Formato empresarial sólido e independiente'
                    : includePageSizes
                      ? 'Usa el papel y diseño configurados'
                      : `Carta vertical · ${standardDescription}`}
                </span>
              </span>
            </DropdownMenuItem>
          </>
        )}
        {pageSizeOptions.length > 0 && <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-popover-foreground/75">Tamaño de página</DropdownMenuLabel>
          {pageSizeOptions.map((option) => (
            <DropdownMenuItem key={option.value} onClick={() => triggerDownload(option.value)} className="gap-2 rounded-xl py-2 [&_svg]:text-primary data-[highlighted]:[&_svg]:!text-primary-foreground">
              <Download className="size-3.5" />
              <span className="min-w-0 flex-1 font-medium">{option.label}</span>
              <span className="text-right text-[10px] leading-tight text-popover-foreground/75">{option.description}</span>
            </DropdownMenuItem>
          ))}
        </>}
        {rollOptions.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-1.5 px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-popover-foreground/75">
              <ReceiptText className="size-3.5" /> Rollos / Voucher
            </DropdownMenuLabel>
            {rollOptions.map((option) => (
              <DropdownMenuItem key={option.value} onClick={() => triggerDownload(option.value)} className="gap-2 rounded-xl py-2 [&_svg]:text-primary data-[highlighted]:[&_svg]:!text-primary-foreground">
                <ReceiptText className="size-3.5" />
                <span className="min-w-0 flex-1 font-medium">{option.label}</span>
                <span className="text-right text-[10px] leading-tight text-popover-foreground/75">{option.description}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
