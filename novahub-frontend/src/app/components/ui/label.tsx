"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "./utils";

type LabelProps = React.ComponentProps<typeof LabelPrimitive.Root> & {
  required?: boolean;
};

const CONTROL_SELECTOR = [
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"])',
  'textarea',
  'select',
  '[role="combobox"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="radiogroup"]',
  '[role="group"][aria-required="true"]',
  '[role="switch"]',
  '[role="spinbutton"]',
  '[role="textbox"]',
  '[role="slider"]',
  '[contenteditable="true"]',
].join(",");

function isVisibleControl(control: HTMLElement): boolean {
  if (control.hasAttribute("hidden") || control.getAttribute("aria-hidden") === "true") return false;
  const style = window.getComputedStyle(control);
  return style.display !== "none" && style.visibility !== "hidden" && control.getClientRects().length > 0;
}

function findLabelControl(label: HTMLLabelElement | null, htmlFor?: string): HTMLElement | null {
  if (htmlFor) return document.getElementById(htmlFor);
  if (!label) return null;

  const nestedControl = label.control as HTMLElement | null;
  if (nestedControl) return nestedControl;

  let scope = label.parentElement;
  while (scope && scope !== document.body) {
    const controls = Array.from(scope.querySelectorAll<HTMLElement>(CONTROL_SELECTOR))
      .filter(isVisibleControl)
      .filter((control) => !(
        control.getAttribute("role") === "radio"
        && control.closest('[role="radiogroup"]')
      ));

    if (controls.length === 1) return controls[0];
    if (controls.length > 1) return null;
    scope = scope.parentElement;
  }

  return null;
}

function colorizeTrailingAsterisk(node: React.ReactNode): [React.ReactNode, boolean] {
  if (typeof node === "string") {
    const match = node.match(/^(.*?)(\s*)\*(\s*)$/s);
    if (!match) return [node, false];
    return [
      <>
        {match[1]}{match[2]}<span className="ml-[-0.375rem] text-destructive" aria-hidden="true">*</span>{match[3]}
      </>,
      true,
    ];
  }

  if (Array.isArray(node)) {
    const children = [...node];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const [child, found] = colorizeTrailingAsterisk(children[index]);
      if (found) {
        children[index] = child;
        return [children, true];
      }
      if (children[index] !== null && children[index] !== undefined && children[index] !== "") break;
    }
    return [children, false];
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(node) && node.props.children !== undefined) {
    const [children, found] = colorizeTrailingAsterisk(node.props.children);
    return found ? [React.cloneElement(node, { children }), true] : [node, false];
  }

  return [node, false];
}

function Label({
  className,
  children,
  htmlFor,
  required,
  ...props
}: LabelProps) {
  const labelRef = React.useRef<HTMLLabelElement>(null);
  const [detectedRequired, setDetectedRequired] = React.useState(false);
  const [detectedInvalid, setDetectedInvalid] = React.useState(false);

  React.useLayoutEffect(() => {
    const label = labelRef.current;
    const control = findLabelControl(label, htmlFor);
    if (!control) {
      setDetectedRequired(false);
      setDetectedInvalid(false);
      return;
    }

    let interacted = false;
    const refresh = () => {
      const isRequired = required ?? (
        ("required" in control && Boolean((control as HTMLInputElement).required))
        || control.getAttribute("aria-required") === "true"
      );
      const nativeInvalid = interacted
        && "validity" in control
        && !(control as HTMLInputElement).validity.valid;
      setDetectedRequired(isRequired);
      setDetectedInvalid(control.getAttribute("aria-invalid") === "true" || nativeInvalid);
    };
    const interact = () => {
      interacted = true;
      refresh();
    };

    refresh();
    control.addEventListener("blur", interact);
    control.addEventListener("input", interact);
    control.addEventListener("change", interact);
    control.addEventListener("invalid", interact, true);
    const observer = new MutationObserver(refresh);
    observer.observe(control, { attributes: true, attributeFilter: ["required", "aria-required", "aria-invalid"] });

    return () => {
      control.removeEventListener("blur", interact);
      control.removeEventListener("input", interact);
      control.removeEventListener("change", interact);
      control.removeEventListener("invalid", interact, true);
      observer.disconnect();
    };
  }, [htmlFor, required]);

  const isRequired = required ?? detectedRequired;
  const isInvalid = detectedInvalid || props["aria-invalid"] === true;
  const [coloredChildren, hasAsterisk] = colorizeTrailingAsterisk(children);
  const indicatesRequired = required === false ? isRequired : isRequired || hasAsterisk;

  return (
    <LabelPrimitive.Root
      ref={labelRef}
      htmlFor={htmlFor}
      data-slot="label"
      data-required={indicatesRequired || undefined}
      data-error={isInvalid || undefined}
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
        isInvalid && "text-destructive",
      )}
      {...props}
    >
      {indicatesRequired && hasAsterisk ? coloredChildren : children}
      {indicatesRequired && !hasAsterisk && <span className="ml-[-0.375rem] text-destructive" aria-hidden="true">*</span>}
    </LabelPrimitive.Root>
  );
}

export { Label };
