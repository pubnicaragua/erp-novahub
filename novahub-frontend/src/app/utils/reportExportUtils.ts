export async function getBase64Image(url: string) {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function hasUnsupportedColor(s: string | null | undefined) {
  return s ? /oklch\(|oklab\(|color\(|lch\(|lab\(/i.test(s) : false;
}

export function sanitizeHtml2CanvasOklch(elementIds: string[], clonedDoc: Document, primaryHex: string) {
  const styleTag = clonedDoc.createElement('style');
  styleTag.innerHTML = `
      :root, *, *::before, *::after {
        --background: #ffffff !important;
        --foreground: #333333 !important;
        --card: #ffffff !important;
        --card-foreground: #333333 !important;
        --popover: #ffffff !important;
        --popover-foreground: #333333 !important;
        --primary: ${primaryHex} !important;
        --primary-foreground: #ffffff !important;
        --secondary: #f3f4f6 !important;
        --secondary-foreground: #333333 !important;
        --muted: #f3f4f6 !important;
        --muted-foreground: #6b7280 !important;
        --accent: #f3f4f6 !important;
        --accent-foreground: #333333 !important;
        --destructive: #ef4444 !important;
        --destructive-foreground: #ffffff !important;
        --border: #e5e7eb !important;
        --input: #e5e7eb !important;
        --ring: ${primaryHex} !important;
        --chart-1: #10b981 !important;
        --chart-2: #ef4444 !important;
        --chart-3: #6366f1 !important;
        --chart-4: #f59e0b !important;
        --chart-5: #ec4899 !important;
        --sidebar-background: #ffffff !important;
        --sidebar-foreground: #333333 !important;
        --sidebar-primary: ${primaryHex} !important;
        --sidebar-primary-foreground: #ffffff !important;
        --sidebar-accent: #f3f4f6 !important;
        --sidebar-accent-foreground: #333333 !important;
        --sidebar-border: #e5e7eb !important;
        --sidebar-ring: ${primaryHex} !important;
      }
    `;
  clonedDoc.head.appendChild(styleTag);

  const walkAndFix = (origRoot: Element | null, clonedRoot: Element | null) => {
    if (!origRoot || !clonedRoot) return;
    const origList = [origRoot, ...Array.from(origRoot.querySelectorAll('*'))];
    const clonedList = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll('*'))];

    for (let i = 0; i < Math.min(origList.length, clonedList.length); i++) {
      const origEl = origList[i] as HTMLElement;
      const cloneEl = clonedList[i] as HTMLElement;
      if (!origEl || !cloneEl) continue;

      try {
        const comp = window.getComputedStyle(origEl);

        let safeColor = '#333333';
        const cls = origEl.className?.toString?.() || '';
        if (cls.includes('text-primary')) safeColor = primaryHex;
        else if (cls.includes('text-emerald')) safeColor = '#10b981';
        else if (cls.includes('text-rose')) safeColor = '#f43f5e';
        else if (cls.includes('text-purple')) safeColor = '#a855f7';
        else if (cls.includes('text-green')) safeColor = '#22c55e';
        else if (cls.includes('text-red')) safeColor = '#ef4444';
        else if (cls.includes('text-blue')) safeColor = '#3b82f6';
        else if (cls.includes('text-amber') || cls.includes('text-orange')) safeColor = '#f59e0b';

        if (hasUnsupportedColor(comp.color)) {
          cloneEl.style.setProperty('color', safeColor, 'important');
        }
        if (hasUnsupportedColor(comp.backgroundColor)) {
          let bg = 'transparent';
          if (cls.includes('bg-primary')) bg = primaryHex;
          else if (cls.includes('bg-emerald')) bg = '#10b981';
          else if (cls.includes('bg-rose')) bg = '#f43f5e';
          else if (cls.includes('bg-muted')) bg = '#f3f4f6';
          else if (cls.includes('bg-card') || cls.includes('bg-background')) bg = '#ffffff';
          else if (cls.includes('bg-secondary') || cls.includes('bg-accent')) bg = '#f3f4f6';
          cloneEl.style.setProperty('background-color', bg, 'important');
        }
        if (hasUnsupportedColor(comp.borderColor)) {
          cloneEl.style.setProperty('border-color', '#e5e7eb', 'important');
        }
        if (hasUnsupportedColor(comp.outlineColor)) {
          cloneEl.style.setProperty('outline-color', '#e5e7eb', 'important');
        }
        if (hasUnsupportedColor(comp.backgroundImage)) {
          cloneEl.style.setProperty('background-image', 'none', 'important');
        }
        if (hasUnsupportedColor(comp.boxShadow)) {
          cloneEl.style.setProperty('box-shadow', 'none', 'important');
        }
        if (hasUnsupportedColor((comp as any).textDecorationColor)) {
          cloneEl.style.setProperty('text-decoration-color', safeColor, 'important');
        }

        const tagName = cloneEl.tagName?.toLowerCase?.() || '';
        if (tagName === 'svg' || cloneEl.closest?.('svg') || ['path', 'rect', 'circle', 'line', 'polygon', 'polyline', 'g', 'text', 'tspan'].includes(tagName)) {
          const fill = cloneEl.getAttribute('fill');
          const stroke = cloneEl.getAttribute('stroke');
          const stopColor = cloneEl.getAttribute('stop-color');

          if (fill && (hasUnsupportedColor(fill) || fill.includes('var('))) {
            if (cls.includes('recharts-bar-rectangle') || cls.includes('recharts-pie-sector')) {
            } else {
              cloneEl.setAttribute('fill', '#9ca3af');
            }
          }
          if (stroke && (hasUnsupportedColor(stroke) || stroke.includes('var('))) {
            cloneEl.setAttribute('stroke', '#e5e7eb');
          }
          if (stopColor && (hasUnsupportedColor(stopColor) || stopColor.includes('var('))) {
            cloneEl.setAttribute('stop-color', primaryHex);
          }
        }

        if (cloneEl.style) {
          for (let j = 0; j < cloneEl.style.length; j++) {
            const prop = cloneEl.style[j];
            const val = cloneEl.style.getPropertyValue(prop);
            if (hasUnsupportedColor(val)) {
              if (prop.includes('color') || prop === 'fill' || prop === 'stroke') {
                cloneEl.style.setProperty(prop, safeColor, 'important');
              } else if (prop.includes('background')) {
                cloneEl.style.setProperty(prop, '#ffffff', 'important');
              } else if (prop.includes('border') || prop.includes('outline')) {
                cloneEl.style.setProperty(prop, '#e5e7eb', 'important');
              } else if (prop.includes('shadow')) {
                cloneEl.style.setProperty(prop, 'none', 'important');
              }
            }
          }
        }
      } catch {
      }
    }
  };

  elementIds.forEach((id) => {
    walkAndFix(document.getElementById(id), clonedDoc.getElementById(id));
  });

  try {
    const sheets = clonedDoc.styleSheets;
    for (let s = 0; s < sheets.length; s++) {
      try {
        const rules = sheets[s].cssRules;
        for (let r = 0; r < rules.length; r++) {
          const rule = rules[r] as CSSStyleRule;
          if (rule.cssText && hasUnsupportedColor(rule.cssText)) {
            const newCss = rule.cssText
              .replace(/oklch\([^)]*\)/gi, '#9ca3af')
              .replace(/oklab\([^)]*\)/gi, '#9ca3af');
            try {
              sheets[s].deleteRule(r);
              sheets[s].insertRule(newCss, r);
            } catch {
            }
          }
        }
      } catch {
      }
    }
  } catch {
  }
}

export async function downloadExcelWorkbook(wb: import('exceljs').Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
