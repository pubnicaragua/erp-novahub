"use client";

import * as React from "react";

import { ChevronLeft, ChevronRight, Copy } from "lucide-react";

import { cn } from "./utils";
import { Button } from "./button";
import { toast } from "@/app/services/toast";
import { getCopyTextFromNode, normalizeCopyText } from "../../utils/table-copy";

/** Lo provee DataTableViewport: dentro de él las flechas de desplazamiento ya existen y no se duplican. */
export const TableViewportContext = React.createContext(false);
/** Permite que un módulo muestre navegación de columnas de forma consistente en todas sus tablas. */
export const TableNavigationContext = React.createContext(false);

export function TableNavigationProvider({ children }: { children: React.ReactNode }) {
  return <TableNavigationContext.Provider value>{children}</TableNavigationContext.Provider>;
}

/**
 * Flechas de desplazamiento horizontal estándar: aparecen cuando la tabla necesita desplazamiento
 * o cuando su módulo activa navegación consistente para todas sus tablas.
 */
function useHorizontalOverflow(ref: React.RefObject<HTMLDivElement | null>) {
  const [state, setState] = React.useState({ overflow: false, left: false, right: false });
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    let frame: number | null = null;
    const measure = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const overflow = element.scrollWidth > element.clientWidth + 4;
        const left = element.scrollLeft > 4;
        const right = element.scrollLeft + element.clientWidth < element.scrollWidth - 4;
        setState((current) => (current.overflow === overflow && current.left === left && current.right === right ? current : { overflow, left, right }));
      });
    };
    measure();
    element.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => {
      element.removeEventListener("scroll", measure);
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [ref]);
  return state;
}

function textFromNode(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join(" ");
  if (React.isValidElement(node)) return textFromNode(node.props.children);
  return "";
}

function getResponsiveHeaderLabels(children: React.ReactNode): string[] {
  const labels: string[] = [];

  const visit = (nodes: React.ReactNode, insideHeader = false) => {
    React.Children.forEach(nodes, (node) => {
      if (!React.isValidElement(node)) return;
      if (node.type === TableHeader) {
        visit(node.props.children, true);
        return;
      }
      if (insideHeader && node.type === TableRow) {
        React.Children.forEach(node.props.children, (cell) => {
          if (React.isValidElement(cell) && cell.type === TableHead) {
            labels.push(textFromNode(cell.props.children).replace(/\s+/g, " ").trim());
          }
        });
        return;
      }
      if (insideHeader) visit(node.props.children, true);
    });
  };

  visit(children);
  return labels;
}

function addResponsiveCellLabels(children: React.ReactNode, labels: string[]): React.ReactNode {
  return React.Children.map(children, (node) => {
    if (!React.isValidElement(node)) return node;
    if (node.type === TableRow) {
      let cellIndex = 0;
      const rowChildren = React.Children.map(node.props.children, (cell) => {
        if (!React.isValidElement(cell) || cell.type !== TableCell) return cell;
        const label = cell.props["data-label"] ?? labels[cellIndex] ?? "";
        cellIndex += 1;
        return React.cloneElement(cell, { "data-label": label });
      });
      return React.cloneElement(node, { children: rowChildren });
    }
    if (node.type === TableBody || node.type === TableFooter || node.type === React.Fragment) {
      return React.cloneElement(node, { children: addResponsiveCellLabels(node.props.children, labels) });
    }
    return node;
  });
}

function addCopyValuesToTableCells(children: React.ReactNode, labels: string[]): React.ReactNode {
  return React.Children.map(children, (node) => {
    if (!React.isValidElement(node)) return node;

    if (node.type === TableRow) {
      let cellIndex = 0;
      const rowChildren = React.Children.map(node.props.children, (cell) => {
        if (!React.isValidElement(cell) || cell.type !== TableCell) return cell;
        const label = cell.props["data-copy-label"] ?? cell.props["data-label"] ?? labels[cellIndex] ?? "";
        cellIndex += 1;

        if (
          cell.props["data-copyable"] === false
          || cell.props["data-copyable"] === "false"
          || cell.props["data-actions-column"] === true
          || cell.props["data-actions-column"] === "true"
          || cell.props.colSpan
        ) return cell;

        const explicitValue = cell.props["data-copy-value"];
        const copyValue = explicitValue !== undefined
          ? normalizeCopyText(explicitValue)
          : getCopyTextFromNode(cell.props.children);
        if (copyValue === null) return cell;

        return React.cloneElement(cell, {
          "data-copy-value": copyValue,
          "data-copy-label": label || "dato",
        });
      });
      return React.cloneElement(node, { children: rowChildren });
    }

    if (node.type === TableBody || node.type === TableFooter || node.type === React.Fragment) {
      return React.cloneElement(node, { children: addCopyValuesToTableCells(node.props.children, labels) });
    }
    return node;
  });
}

type TableProps = React.ComponentProps<"table"> & {
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
  responsiveCards?: boolean;
  viewport?: boolean;
  copyableCells?: boolean;
};

function Table({ className, containerClassName, containerStyle, responsiveCards = true, viewport = false, copyableCells = true, ...props }: TableProps) {
  const insideViewport = React.useContext(TableViewportContext);
  const alwaysShowNavigation = React.useContext(TableNavigationContext);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollState = useHorizontalOverflow(containerRef);
  const showControls = !insideViewport && (alwaysShowNavigation || scrollState.overflow);
  const scrollBy = (direction: "left" | "right") => {
    const element = containerRef.current;
    if (!element) return;
    const table = element.querySelector<HTMLTableElement>('[data-slot="table"]');
    const headerCells = table?.tHead?.rows[0]?.cells;
    const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
    const viewportLeft = element.getBoundingClientRect().left;
    const boundaries = [...new Set([
      0,
      ...Array.from(headerCells ?? []).map((cell) => Math.min(maxScroll, Math.max(0, cell.getBoundingClientRect().right - viewportLeft + element.scrollLeft))),
      maxScroll,
    ])].sort((a, b) => a - b);
    const nextPosition = direction === "right"
      ? boundaries.find((position) => position > element.scrollLeft + 4) ?? maxScroll
      : [...boundaries].reverse().find((position) => position < element.scrollLeft - 4) ?? 0;
    if (Math.abs(nextPosition - element.scrollLeft) > 1) {
      element.scrollTo({ left: nextPosition, behavior: "smooth" });
      return;
    }
    element.scrollBy({ left: (direction === "right" ? 1 : -1) * Math.max(240, Math.floor(element.clientWidth * 0.78)), behavior: "smooth" });
  };
  const headerLabels = getResponsiveHeaderLabels(props.children);
  const responsiveChildren = responsiveCards
    ? addResponsiveCellLabels(props.children, headerLabels)
    : props.children;
  const tableChildren = copyableCells ? addCopyValuesToTableCells(responsiveChildren, headerLabels) : responsiveChildren;

  const container = (
    <div
      ref={containerRef}
      data-slot="table-container"
      data-responsive-cards-container={responsiveCards ? "true" : undefined}
      data-table-viewport-scroll={viewport ? "true" : undefined}
      style={viewport
        ? { ...containerStyle, minHeight: containerStyle?.minHeight ?? "36rem", maxHeight: containerStyle?.maxHeight ?? "44rem", overscrollBehaviorY: "auto" }
        : containerStyle}
      className={cn(
        "relative w-full max-w-full overflow-x-auto overflow-y-clip",
        containerClassName,
        viewport && "min-h-[36rem] max-h-[44rem] overflow-y-auto overscroll-y-auto scrollbar-overlay",
      )}
    >
      <table
        data-slot="table"
        data-responsive-cards={responsiveCards ? "true" : undefined}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
       >{tableChildren}</table>
    </div>
  );

  if (insideViewport) return container;
  return (
    <div className="w-full min-w-0 max-w-full">
      {showControls && (
        <div className="mb-1 flex items-center justify-between gap-2" data-table-scroll-controls="true">
          <span className="text-[10px] font-medium text-muted-foreground/70">Navegar columnas</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => scrollBy("left")} disabled={!scrollState.left} aria-label="Desplazar una columna a la izquierda" className="inline-flex size-7 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"><ChevronLeft className="size-4" /></button>
            <button type="button" onClick={() => scrollBy("right")} disabled={!scrollState.right} aria-label="Desplazar una columna a la derecha" className="inline-flex size-7 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"><ChevronRight className="size-4" /></button>
          </div>
        </div>
      )}
      {container}
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      data-sticky-table-header="true"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

const TableRow = React.forwardRef<HTMLTableRowElement, React.ComponentProps<"tr">>(function TableRow({ className, ...props }, ref) {
  return (
    <tr
      ref={ref}
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className,
      )}
      {...props}
    />
  );
});
TableRow.displayName = "TableRow";

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle text-xs font-semibold whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, children, ...props }: React.ComponentProps<"td">) {
  const { ["data-copy-value"]: copyValueProp, ["data-copy-label"]: copyLabelProp, ...cellProps } = props as React.ComponentProps<"td"> & {
    "data-copy-value"?: string;
    "data-copy-label"?: string;
  };
  const copyValue = normalizeCopyText(copyValueProp);
  const copyLabel = normalizeCopyText(copyLabelProp) || "dato";

  const copyCellValue = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!copyValue) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(copyValue);
      toast.success(`${copyLabel} copiado`);
    } catch {
      toast.error("No se pudo copiar el dato. Comprueba los permisos del navegador.");
    }
  };

  return (
    <td
      data-slot="table-cell"
      data-table-cell-copyable={copyValue ? "true" : undefined}
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
        copyValue && "group/table-cell relative",
      )}
      {...cellProps}
    >
      {children}
      {copyValue && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-table-cell-copy="true"
          title={`Copiar ${copyLabel}`}
          aria-label={`Copiar ${copyLabel}`}
          className="table-cell-copy-action absolute right-1 top-1/2 z-10 size-7 -translate-y-1/2 rounded-md bg-background/90 text-muted-foreground shadow-sm hover:bg-primary/10 hover:text-primary"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => void copyCellValue(event)}
        >
          <Copy className="size-3.5" />
        </Button>
      )}
    </td>
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
