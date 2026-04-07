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
  } catch (e) {
    return null;
  }
};

export const sanitizeHtml2CanvasOklch = (elementId: string, clonedDoc: Document, primaryHex: string) => {
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
      --border: #e5e7eb !important;
      --input: #e5e7eb !important;
      --ring: ${primaryHex} !important;
    }
  `;
  clonedDoc.head.appendChild(styleTag);

  const hasUnsupported = (s: string | null | undefined) => s ? /oklch|oklab|color\\(|lch\\(|lab\\(/i.test(s) : false;

  const originalEl = document.getElementById(elementId);
  const clonedEl = clonedDoc.getElementById(elementId);
  if (!originalEl || !clonedEl) return;

  const origList = [originalEl, ...Array.from(originalEl.querySelectorAll('*'))];
  const clonedList = [clonedEl, ...Array.from(clonedEl.querySelectorAll('*'))];

  for (let i = 0; i < Math.min(origList.length, clonedList.length); i++) {
    const origNode = origList[i] as HTMLElement;
    const cloneNode = clonedList[i] as HTMLElement;
    if (!origNode || !cloneNode) continue;

    try {
      const comp = window.getComputedStyle(origNode);
      let safeColor = '#333333';
      const cls = origNode.className?.toString?.() || '';
      if (cls.includes('text-primary')) safeColor = primaryHex;
      else if (cls.includes('text-emerald')) safeColor = '#10b981';
      else if (cls.includes('text-rose')) safeColor = '#f43f5e';
      else if (cls.includes('text-purple')) safeColor = '#a855f7';
      else if (cls.includes('text-green')) safeColor = '#22c55e';
      else if (cls.includes('text-red')) safeColor = '#ef4444';

      if (hasUnsupported(comp.color)) cloneNode.style.setProperty('color', safeColor, 'important');
      if (hasUnsupported(comp.backgroundColor)) {
        let bg = 'transparent';
        if (cls.includes('bg-primary')) bg = primaryHex;
        else if (cls.includes('bg-emerald')) bg = '#10b981';
        else if (cls.includes('bg-muted')) bg = '#f3f4f6';
        else if (cls.includes('bg-card') || cls.includes('bg-background')) bg = '#ffffff';
        cloneNode.style.setProperty('background-color', bg, 'important');
      }
      if (hasUnsupported(comp.borderColor)) cloneNode.style.setProperty('border-color', '#e5e7eb', 'important');
      if (hasUnsupported(comp.backgroundImage)) cloneNode.style.setProperty('background-image', 'none', 'important');

      const tagName = cloneNode.tagName?.toLowerCase?.() || '';
      if (['svg','path','rect','circle','line','polygon','polyline','g'].includes(tagName)) {
        const fill = cloneNode.getAttribute('fill');
        const stroke = cloneNode.getAttribute('stroke');
        if (fill && (hasUnsupported(fill) || fill.includes('var('))) {
          if (!cls.includes('recharts-bar-rectangle') && !cls.includes('recharts-pie-sector')) {
            cloneNode.setAttribute('fill', '#9ca3af');
          }
        }
        if (stroke && (hasUnsupported(stroke) || stroke.includes('var('))) {
          cloneNode.setAttribute('stroke', '#e5e7eb');
        }
      }
    } catch (e) {}
  }
};
