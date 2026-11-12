"use client";

import * as React from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "./utils";

/** Lo provee DataTableViewport: dentro de él las flechas de desplazamiento ya existen y no se duplican. */
export const TableViewportContext = React.createContext(false);

/**
 * Flechas de desplazamiento horizontal estándar para toda tabla ancha: aparecen solo cuando la tabla
 * no cabe en pantalla y se comportan igual en todo el sistema (mismo botón, mismo paso, misma ubicación).
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

function Table({ className, containerClassName, containerStyle, responsiveCards = true, viewport = false, ...props }: React.ComponentProps<"table"> & { containerClassName?: string; containerStyle?: React.CSSProperties; responsiveCards?: boolean; viewport?: boolean }) {
  const insideViewport = React.useContext(TableViewportContext);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollState = useHorizontalOverflow(containerRef);
  const showControls = !insideViewport && scrollState.overflow;
  const scrollBy = (direction: "left" | "right") => {
    const element = containerRef.current;
    if (!element) return;
    element.scrollBy({ left: (direction === "right" ? 1 : -1) * Math.max(240, Math.floor(element.clientWidth * 0.78)), behavior: "smooth" });
  };
  const responsiveChildren = responsiveCards
    ? addResponsiveCellLabels(props.children, getResponsiveHeaderLabels(props.children))
    : props.children;

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
       >{responsiveChildren}</table>
    </div>
  );

  if (insideViewport) return container;
  return (
    <div className="w-full min-w-0 max-w-full">
      {showControls && (
        <div className="mb-1 flex items-center justify-end gap-1" data-table-scroll-controls="true">
          <button type="button" onClick={() => scrollBy("left")} disabled={!scrollState.left} aria-label="Desplazar una columna a la izquierda" className="inline-flex size-7 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"><ChevronLeft className="size-4" /></button>
          <button type="button" onClick={() => scrollBy("right")} disabled={!scrollState.right} aria-label="Desplazar una columna a la derecha" className="inline-flex size-7 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"><ChevronRight className="size-4" /></button>
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

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
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
