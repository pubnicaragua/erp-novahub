"use client";

import * as React from "react";

import { cn } from "./utils";

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

function Table({ className, containerClassName, containerStyle, responsiveCards = true, ...props }: React.ComponentProps<"table"> & { containerClassName?: string; containerStyle?: React.CSSProperties; responsiveCards?: boolean }) {
  const responsiveChildren = responsiveCards
    ? addResponsiveCellLabels(props.children, getResponsiveHeaderLabels(props.children))
    : props.children;

  return (
    <div
      data-slot="table-container"
      data-responsive-cards-container={responsiveCards ? "true" : undefined}
      style={containerStyle}
      className={cn("relative w-full max-w-full overflow-x-auto", containerClassName)}
    >
      <table
        data-slot="table"
        data-responsive-cards={responsiveCards ? "true" : undefined}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
       >{responsiveChildren}</table>
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
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
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
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
