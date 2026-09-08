import { useState } from 'react';
import { ChevronDown, Download, ReceiptText } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { PDF_DOWNLOAD_OPTIONS, type PdfDownloadFormat, type PdfExportScope } from '../../utils/pdfDownloadFormats';

interface PdfDownloadButtonProps {
  onDownload: (format: PdfDownloadFormat, scope?: PdfExportScope) => void;
  className?: string;
  disabled?: boolean;
  size?: 'default' | 'sm' | 'lg';
  includeRoll?: boolean;
  label?: string;
  standardLabel?: string;
  standardDescription?: string;
  showStandardOptions?: boolean;
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
}

/** Menú único para previsualizar una transacción sin ofrecer reportes de la tabla. */
export function PdfDownloadButton({ onDownload, className, disabled = false, size = 'sm', includeRoll = true, label = 'Descargar', standardLabel = 'PDF normal', standardDescription = 'Diseño asignado o global', showStandardOptions = true, firstOption, scopeSelector }: PdfDownloadButtonProps) {
  const [scope, setScope] = useState<PdfExportScope>(scopeSelector?.defaultScope || 'page');
  const standardOptions = showStandardOptions ? PDF_DOWNLOAD_OPTIONS.filter((option) => option.group === 'standard') : [];
  const rollOptions = includeRoll ? PDF_DOWNLOAD_OPTIONS.filter((option) => option.group === 'roll') : [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size={size} disabled={disabled} className={cn('group gap-1.5 rounded-xl', className)}>
          <Download className="size-4 shrink-0 text-primary transition-colors group-hover:text-foreground" />
          <span>{label}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-2xl p-1.5">
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
        {showStandardOptions && <DropdownMenuItem onClick={() => onDownload('configured', scopeSelector ? scope : undefined)} className="gap-2 rounded-xl py-2.5 [&_svg]:text-foreground/80 data-[highlighted]:[&_svg]:!text-primary-foreground">
          <Download className="size-4" />
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{standardLabel}</span>
            <span className="block text-[10px] text-popover-foreground/75">{standardDescription}</span>
          </span>
        </DropdownMenuItem>}
        {showStandardOptions && <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-popover-foreground/75">Tamaños de página</DropdownMenuLabel>
          {standardOptions.map((option) => (
            <DropdownMenuItem key={option.value} onClick={() => onDownload(option.value, scopeSelector ? scope : undefined)} className="gap-2 rounded-xl py-2 [&_svg]:text-foreground/70 data-[highlighted]:[&_svg]:!text-primary-foreground">
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
              <DropdownMenuItem key={option.value} onClick={() => onDownload(option.value, scopeSelector ? scope : undefined)} className="gap-2 rounded-xl py-2 [&_svg]:text-primary data-[highlighted]:[&_svg]:!text-primary-foreground">
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
