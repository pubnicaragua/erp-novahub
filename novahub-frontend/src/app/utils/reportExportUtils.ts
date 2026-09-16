import { getReadableForeground } from './color-contrast';
import { storageService } from '../services/storage.service';

const imageCache = new Map<string, { promise: Promise<string | null>; expiresAt: number }>();
const IMAGE_CACHE_TTL_MS = 30_000;
const MAX_EMBEDDED_IMAGE_EDGE = 1200;
const IMAGE_LOAD_TIMEOUT_MS = 1_200;
const EXCEL_IMAGE_MAX_WIDTH = 600;
const EXCEL_IMAGE_MAX_HEIGHT = 420;

async function imageBlobAsPng(blob: Blob) {
  if (blob.type && !/^image\//i.test(blob.type)) return '';
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return new Promise<string>((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        if (!sourceWidth || !sourceHeight) {
          resolve(dataUrl);
          return;
        }
        const scale = Math.min(1, MAX_EMBEDDED_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));
        if (blob.type === 'image/png' && scale === 1) {
          resolve(dataUrl);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(sourceWidth * scale));
        canvas.height = Math.max(1, Math.round(sourceHeight * scale));
        canvas.getContext('2d')?.drawImage(image, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

export async function getBase64Image(url: string) {
  const key = url?.trim();
  if (!key) return null;
  const cached = imageCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  imageCache.delete(key);
  const promise = (async () => {
    try {
      const resolvedUrl = await storageService.resolveUrl(key);
      const resp = await fetch(resolvedUrl);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return await imageBlobAsPng(blob);
    } catch {
      return null;
    }
  })();
  imageCache.set(key, { promise, expiresAt: Date.now() + IMAGE_CACHE_TTL_MS });
  const result = await Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), IMAGE_LOAD_TIMEOUT_MS)),
  ]);
  if (!result) imageCache.delete(key);
  return result;
}

export function fitExcelImageDimensions(sourceWidth: number, sourceHeight: number, maxWidth = EXCEL_IMAGE_MAX_WIDTH, maxHeight = EXCEL_IMAGE_MAX_HEIGHT) {
  const width = Math.max(1, Number(sourceWidth) || 1);
  const height = Math.max(1, Number(sourceHeight) || 1);
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function excelImageRowSpan(imageHeight: number, rowHeight = 18, gap = 2) {
  return Math.max(1, Math.ceil((Number(imageHeight) || 1) / rowHeight) + gap);
}

export function addExcelCanvasImage(
  workbook: import('exceljs').Workbook,
  worksheet: import('exceljs').Worksheet,
  image: { base64: string; width: number; height: number },
  targetRow: number,
) {
  const imageId = workbook.addImage({ base64: image.base64, extension: 'png' });
  worksheet.addImage(imageId, { tl: { col: 0, row: targetRow }, ext: { width: image.width, height: image.height } });
  return targetRow + excelImageRowSpan(image.height);
}

export function prepareExcelKpiColumns(worksheet: import('exceljs').Worksheet, count: number, minWidth = 18) {
  for (let index = 1; index <= count; index += 1) {
    const column = worksheet.getColumn(index);
    column.width = Math.max(Number(column.width) || 0, minWidth);
  }
}

export function finalizeExcelKpiRows(worksheet: import('exceljs').Worksheet, count: number, nextRow: number) {
  const labelRow = worksheet.getRow(Math.max(1, nextRow - 4));
  const valueRow = worksheet.getRow(Math.max(1, nextRow - 3));
  const detailRow = worksheet.getRow(Math.max(1, nextRow - 2));
  labelRow.height = Math.max(Number(labelRow.height) || 0, 30);
  valueRow.height = Math.max(Number(valueRow.height) || 0, 28);
  detailRow.height = Math.max(Number(detailRow.height) || 0, 22);
  for (let index = 1; index <= count; index += 1) {
    [labelRow, valueRow, detailRow].forEach((row) => {
      const cell = row.getCell(index);
      cell.alignment = { ...(cell.alignment || {}), wrapText: true };
    });
  }
}

export function prepareExcelCanvasClone(elementIds: string[], clonedDoc: Document) {
  elementIds.forEach((elementId) => {
    const root = clonedDoc.getElementById(elementId);
    if (!root) return;
    root.style.setProperty('overflow', 'visible', 'important');
    root.querySelectorAll<HTMLElement>('.truncate').forEach((element) => {
      element.style.setProperty('overflow', 'visible', 'important');
      element.style.setProperty('text-overflow', 'clip', 'important');
      element.style.setProperty('white-space', 'normal', 'important');
      element.style.setProperty('overflow-wrap', 'anywhere', 'important');
    });
    root.querySelectorAll<HTMLElement>('[data-report-export-text]').forEach((element) => {
      const fullText = element.getAttribute('data-report-export-text');
      if (!fullText) return;
      element.textContent = fullText;
      element.style.setProperty('white-space', 'normal', 'important');
      element.style.setProperty('overflow-wrap', 'anywhere', 'important');
    });
  });
}

export function shouldIgnoreExcelCanvasElement(element: Element, target: Element) {
  if (element === target || element.contains(target) || target.contains(element)) return false;
  const tagName = element.tagName.toLowerCase();
  return !['html', 'head', 'body', 'style', 'link', 'meta', 'title'].includes(tagName);
}

function hasUnsupportedColor(s: string | null | undefined) {
  return s ? /oklch\(|oklab\(|color\(|lch\(|lab\(/i.test(s) : false;
}

export function sanitizeHtml2CanvasOklch(elementIds: string[], clonedDoc: Document, primaryHex: string, rewriteStyleSheets = true) {
  const safePrimary = /^#[0-9a-f]{6}$/i.test(primaryHex.trim()) ? primaryHex.trim() : '#10b981';
  const primaryForeground = getReadableForeground(safePrimary);
  const styleTag = clonedDoc.createElement('style');
  styleTag.innerHTML = `
      :root, *, *::before, *::after {
        --background: #ffffff !important;
        --foreground: #333333 !important;
        --card: #ffffff !important;
        --card-foreground: #333333 !important;
        --popover: #ffffff !important;
        --popover-foreground: #333333 !important;
        --primary: ${safePrimary} !important;
        --primary-foreground: ${primaryForeground} !important;
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
        --ring: ${safePrimary} !important;
        --chart-1: #10b981 !important;
        --chart-2: #ef4444 !important;
        --chart-3: #6366f1 !important;
        --chart-4: #f59e0b !important;
        --chart-5: #ec4899 !important;
        --sidebar-background: #ffffff !important;
        --sidebar-foreground: #333333 !important;
        --sidebar-primary: ${safePrimary} !important;
        --sidebar-primary-foreground: ${primaryForeground} !important;
        --sidebar-accent: #f3f4f6 !important;
        --sidebar-accent-foreground: #333333 !important;
        --sidebar-border: #e5e7eb !important;
        --sidebar-ring: ${safePrimary} !important;
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
            if (!cls.includes('recharts-bar-rectangle') && !cls.includes('recharts-pie-sector')) {
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
        // Un nodo aislado no debe impedir la captura del resto del reporte.
      }
    }
  };

  elementIds.forEach((id) => {
    walkAndFix(document.getElementById(id), clonedDoc.getElementById(id));
  });

  if (!rewriteStyleSheets) return;

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
              // Una regla incompatible se omite; html2canvas continúa con las demás.
            }
          }
        }
      } catch {
        // Las hojas externas pueden bloquear el acceso a cssRules.
      }
    }
  } catch {
    // La captura puede continuar aunque una hoja de estilos no sea accesible.
  }
}

export async function downloadExcelWorkbook(wb: import('exceljs').Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer({
    zip: {
      compression: 'DEFLATE',
      compressionOptions: { level: 1 },
    },
  });
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
