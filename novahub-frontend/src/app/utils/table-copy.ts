import * as React from 'react';

export function normalizeCopyText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  const trimmed = text.trim();
  if (!trimmed || /^[-–—]$/.test(trimmed)) return null;
  return text;
}

const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'option', 'select', 'textarea']);
const INTERACTIVE_COMPONENTS = new Set([
  'Button', 'Checkbox', 'CommandItem', 'DialogTrigger', 'DropdownMenuItem', 'DropdownMenuTrigger',
  'Input', 'Link', 'NavLink', 'PopoverTrigger', 'RadioGroupItem', 'Select', 'SelectTrigger',
  'Switch', 'TooltipTrigger',
]);

function isInteractiveNode(node: React.ReactNode): boolean {
  if (!React.isValidElement(node)) return false;
  const element = node as React.ReactElement<Record<string, unknown>>;
  const type = element.type as { displayName?: string; name?: string } | string;
  const typeName = typeof type === 'string' ? type.toLowerCase() : type.displayName || type.name || '';
  const props = element.props;

  if (
    (typeof typeName === 'string' && (INTERACTIVE_TAGS.has(typeName) || INTERACTIVE_COMPONENTS.has(typeName)))
    || props.role === 'button'
    || props.role === 'checkbox'
    || props.role === 'switch'
    || typeof props.onClick === 'function'
    || typeof props.onChange === 'function'
    || typeof props.onCheckedChange === 'function'
    || typeof props.onPointerDown === 'function'
    || typeof props.onKeyDown === 'function'
    || typeof props.onSelect === 'function'
    || typeof props.onValueChange === 'function'
    || props.contentEditable === true
  ) return true;

  return React.Children.toArray(props.children as React.ReactNode).some(isInteractiveNode);
}

function collectText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(' ');
  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
    return collectText(element.props.children);
  }
  return '';
}

export function getCopyTextFromNode(node: React.ReactNode): string | null {
  if (isInteractiveNode(node)) return null;
  return normalizeCopyText(collectText(node).replace(/\s+/g, ' '));
}
