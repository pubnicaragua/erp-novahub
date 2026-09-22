import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './dropdown-menu';

export interface ExportMenuProps {
  onPdf?: () => void;
  onExcel?: () => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  size?: 'default' | 'sm' | 'lg';
  pdfLabel?: string;
  excelLabel?: string;
  pdfDescription?: string;
  excelDescription?: string;
}

/** Menú común para salidas lógicas de una vista. Los botones especializados
 * de tickets/rollos siguen usando su renderer físico separado. */
export function ExportMenu({ onPdf, onExcel, disabled = false, className, label = 'Exportar', size = 'sm', pdfLabel = 'Exportar PDF', excelLabel = 'Exportar Excel', pdfDescription = 'Reporte con la estructura de esta vista', excelDescription = 'Todos los registros filtrados' }: ExportMenuProps) {
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
        {hasPdf && <DropdownMenuItem onClick={onPdf} className="gap-2 rounded-xl py-2.5">
          <FileText className="size-4 text-rose-600" />
          <span className="min-w-0 flex-1"><span className="block font-bold">{pdfLabel}</span><span className="block text-[10px] text-popover-foreground/75">{pdfDescription}</span></span>
        </DropdownMenuItem>}
        {hasPdf && hasExcel && <DropdownMenuSeparator />}
        {hasExcel && <DropdownMenuItem onClick={onExcel} className="gap-2 rounded-xl py-2.5">
          <FileSpreadsheet className="size-4 text-emerald-600" />
          <span className="min-w-0 flex-1"><span className="block font-bold">{excelLabel}</span><span className="block text-[10px] text-popover-foreground/75">{excelDescription}</span></span>
        </DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

