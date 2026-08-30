export const getBase64Image = async (url: string): Promise<string | null> => {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e: any) {
    return null;
  }
};

export const sanitizeHtml2CanvasOklch = (elementId: string | string[], clonedDoc: Document, primaryHex: string) => {
  const elementIds = Array.isArray(elementId) ? elementId : [elementId];
  const safePrimary = /^#[0-9a-f]{6}$/i.test(primaryHex.trim()) ? primaryHex.trim() : '#10b981';
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
      --primary-foreground: #ffffff !important;
      --secondary: #f1f5f9 !important;
      --secondary-foreground: #334155 !important;
      --muted: #f1f5f9 !important;
      --muted-foreground: #64748b !important;
      --accent: #ecfdf5 !important;
      --accent-foreground: #065f46 !important;
      --destructive: #ef4444 !important;
      --destructive-foreground: #ffffff !important;
      --border: #e5e7eb !important;
      --input: #e5e7eb !important;
      --ring: ${safePrimary} !important;
      --sidebar: #ffffff !important;
      --sidebar-foreground: #333333 !important;
      --sidebar-primary: ${safePrimary} !important;
      --sidebar-primary-foreground: #ffffff !important;
      --sidebar-accent: #ecfdf5 !important;
      --sidebar-accent-foreground: #065f46 !important;
      --sidebar-border: #e5e7eb !important;
      --chart-1: ${safePrimary} !important;
      --chart-2: #2563eb !important;
      --chart-3: #f59e0b !important;
      --chart-4: #8b5cf6 !important;
      --chart-5: #ef4444 !important;
    }
  `;
  clonedDoc.head.appendChild(styleTag);

  const hasUnsupported = (s: string | null | undefined) => s ? /(?:oklch|oklab|color(?:-mix)?|lch|lab)\(/i.test(s) : false;
  const selectorIds = elementIds.map(id => `#${id.replace(/[^a-zA-Z0-9_-]/g, '\\\\$&')}`);
  const targetSelector = selectorIds.join(', ');
  if (targetSelector) {
    const pseudoStyle = clonedDoc.createElement('style');
    pseudoStyle.innerHTML = `${targetSelector} *::before, ${targetSelector} *::after { color: #333333 !important; background-color: transparent !important; background-image: none !important; border-color: #e5e7eb !important; box-shadow: none !important; text-shadow: none !important; }`;
    clonedDoc.head.appendChild(pseudoStyle);
  }

  const colorFallback = (node: HTMLElement, kind: 'text' | 'background' | 'line') => {
    const cls = node.className?.toString?.() || '';
    if (kind === 'text') {
      if (cls.includes('text-primary')) return safePrimary;
      if (cls.includes('text-emerald')) return '#10b981';
      if (cls.includes('text-rose')) return '#f43f5e';
      if (cls.includes('text-purple')) return '#a855f7';
      if (cls.includes('text-green')) return '#22c55e';
      if (cls.includes('text-red')) return '#ef4444';
    }
    if (kind === 'background') {
      if (cls.includes('bg-primary')) return safePrimary;
      if (cls.includes('bg-emerald')) return '#10b981';
      if (cls.includes('bg-muted')) return '#f3f4f6';
      if (cls.includes('bg-card') || cls.includes('bg-background')) return '#ffffff';
      return 'transparent';
    }
    return '#e5e7eb';
  };

  elementIds.forEach(id => {
    const originalEl = document.getElementById(id);
    const clonedEl = clonedDoc.getElementById(id);
    if (!originalEl || !clonedEl) return;

    const origList = [originalEl, ...Array.from(originalEl.querySelectorAll('*'))];
    const clonedList = [clonedEl, ...Array.from(clonedEl.querySelectorAll('*'))];

    for (let i = 0; i < Math.min(origList.length, clonedList.length); i++) {
      const origNode = origList[i] as HTMLElement;
      const cloneNode = clonedList[i] as HTMLElement;
      if (!origNode || !cloneNode) continue;

      try {
        const comp = window.getComputedStyle(origNode);
        const text = colorFallback(origNode, 'text');
        const background = colorFallback(origNode, 'background');
        const line = colorFallback(origNode, 'line');

        if (hasUnsupported(comp.color)) cloneNode.style.setProperty('color', text, 'important');
        if (hasUnsupported(comp.backgroundColor)) cloneNode.style.setProperty('background-color', background, 'important');
        if (hasUnsupported(comp.borderColor)) cloneNode.style.setProperty('border-color', line, 'important');
        ['borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor', 'textDecorationColor', 'columnRuleColor', '-webkit-text-stroke-color'].forEach(property => {
          if (hasUnsupported(comp.getPropertyValue(property))) cloneNode.style.setProperty(property, line, 'important');
        });
        if (hasUnsupported(comp.backgroundImage)) cloneNode.style.setProperty('background-image', 'none', 'important');
        if (hasUnsupported(comp.boxShadow)) cloneNode.style.setProperty('box-shadow', 'none', 'important');
        if (hasUnsupported(comp.textShadow)) cloneNode.style.setProperty('text-shadow', 'none', 'important');
        if (hasUnsupported(comp.getPropertyValue('filter'))) cloneNode.style.setProperty('filter', 'none', 'important');

        const tagName = cloneNode.tagName?.toLowerCase?.() || '';
        if (['svg','path','rect','circle','line','polygon','polyline','g'].includes(tagName)) {
          const fill = cloneNode.getAttribute('fill');
          const stroke = cloneNode.getAttribute('stroke');
          if (fill && (hasUnsupported(fill) || fill.includes('var('))) {
            cloneNode.setAttribute('fill', text);
          }
          if (stroke && (hasUnsupported(stroke) || stroke.includes('var('))) {
            cloneNode.setAttribute('stroke', line);
          }
        }
      } catch (e: any) {}
      }
    });
};

export const safeHtml2CanvasColor = (value: unknown, fallback = '#ffffff') => {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const color = value.trim();
  return /(?:var|oklch|oklab|color(?:-mix)?|lch|lab)\(/i.test(color) ? fallback : color;
};
