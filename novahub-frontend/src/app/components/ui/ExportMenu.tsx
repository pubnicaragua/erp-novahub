import { useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, Sparkles } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './dropdown-menu';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';

export interface ExportMenuProps {
  onPdf?: (format?: PdfDownloadFormat) => void;
  onExcel?: () => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  size?: 'default' | 'sm' | 'lg';
  pdfLabel?: string;
  excelLabel?: string;
  pdfDescription?: string;
  excelDescription?: string;
  showNovaHubFormat?: boolean;
}

/** Menú común para salidas lógicas de una vista. Los botones especializados
 * de tickets/rollos siguen usando su renderer físico separado. */
export function ExportMenu({ onPdf, onExcel, disabled = false, className, label = 'Exportar', size = 'sm', pdfLabel = 'Exportar PDF', excelLabel = 'Exportar Excel', pdfDescription = 'Reporte con la estructura de esta vista', excelDescription = 'Todos los registros filtrados', showNovaHubFormat = true }: ExportMenuProps) {
  const [useNovaHubFormat, setUseNovaHubFormat] = useState(false);
  const hasPdf = Boolean(onPdf);
  const hasExcel = Boolean(onExcel);
  if (!hasPdf && !hasExcel) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size={size} disabled={disabled} className={cn('gap-1.5 rounded-xl', className)} aria-label={`${label} PDF o Excel`}>
          <Download className="size-4 shrink-0 text-primary" />
          <span>{label}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-1rem)] rounded-2xl p-1.5">
        {hasPdf && showNovaHubFormat && (
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
        {hasPdf && (
          <DropdownMenuItem onClick={() => onPdf?.(useNovaHubFormat ? 'novahub-format' : 'configured')} className="gap-2 rounded-xl py-2.5">
            <FileText className="size-4 text-rose-600" />
            <span className="min-w-0 flex-1">
              <span className="block font-bold">
                {useNovaHubFormat ? 'Exportar PDF · NovaHubFormat' : pdfLabel}
              </span>
              <span className="block text-[10px] text-popover-foreground/75">
                {useNovaHubFormat ? 'Formato empresarial sólido e independiente' : pdfDescription}
              </span>
            </span>
          </DropdownMenuItem>
        )}
        {hasPdf && hasExcel && <DropdownMenuSeparator />}
        {hasExcel && <DropdownMenuItem onClick={onExcel} className="gap-2 rounded-xl py-2.5">
          <FileSpreadsheet className="size-4 text-emerald-600" />
          <span className="min-w-0 flex-1"><span className="block font-bold">{excelLabel}</span><span className="block text-[10px] text-popover-foreground/75">{excelDescription}</span></span>
        </DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

