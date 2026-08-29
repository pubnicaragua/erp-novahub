import JSZip from 'jszip';
import { definitionFromHtml, type PdfTemplateDefinition } from './pdf-template-definition';

export type PdfImportKind = 'html' | 'docx' | 'pdf';

export interface ImportedPdfTemplate {
  kind: PdfImportKind;
  definition: PdfTemplateDefinition;
  sanitizedHtml?: string;
  warnings: string[];
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] || character);
}

export function sanitizeImportedHtml(html: string) {
  if (typeof DOMParser === 'undefined') return '';
  const document = new DOMParser().parseFromString(html, 'text/html');
  document.querySelectorAll('script,iframe,object,embed,form,link[rel="import"]').forEach(element => element.remove());
  document.querySelectorAll('*').forEach(element => {
    Array.from(element.attributes).forEach(attribute => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc' || value.startsWith('javascript:') || value.startsWith('vbscript:')) element.removeAttribute(attribute.name);
      if ((name === 'src' || name === 'href') && !/^(https?:|data:image\/|#|\/)/i.test(attribute.value)) element.removeAttribute(attribute.name);
    });
  });
  document.querySelectorAll('style').forEach(style => {
    style.textContent = (style.textContent || '').replace(/@import[^;]+;?/gi, '').replace(/url\(\s*["']?javascript:[^)]*\)?/gi, '');
  });
  return document.documentElement.outerHTML;
}

function xmlText(element: Element) {
  return Array.from(element.getElementsByTagName('*'))
    .filter(child => child.localName === 't' || child.tagName === 'w:t')
    .map(child => child.textContent || '')
    .join('');
}

function hasLocalName(element: Element, localName: string) {
  return element.localName === localName || element.tagName === `w:${localName}`;
}

export async function docxToHtml(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) throw new Error('El DOCX no contiene word/document.xml.');
  const xml = await documentFile.async('text');
  if (typeof DOMParser === 'undefined') throw new Error('El navegador no permite analizar el documento Word.');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const body = Array.from(document.getElementsByTagName('*')).find(element => hasLocalName(element, 'body'));
  if (!body) throw new Error('No se encontró el cuerpo del documento Word.');
  const blocks: string[] = [];
  Array.from(body.children).forEach(block => {
    if (hasLocalName(block, 'p')) {
      const text = xmlText(block).trim();
      if (!text) return;
      const style = Array.from(block.getElementsByTagName('*')).find(element => hasLocalName(element, 'pStyle'))?.getAttribute('w:val') || '';
      const heading = /heading|title/i.test(style) ? (style.match(/\d+/)?.[0] || '2') : '';
      blocks.push(heading ? `<h${Math.min(6, Number(heading))}>${escapeHtml(text)}</h${Math.min(6, Number(heading))}>` : `<p>${escapeHtml(text)}</p>`);
      return;
    }
    if (hasLocalName(block, 'tbl')) {
      const rows = Array.from(block.children).filter(child => hasLocalName(child, 'tr')).map(row => {
        const cells = Array.from(row.children).filter(child => hasLocalName(child, 'tc')).map(cell => `<td>${escapeHtml(xmlText(cell).trim())}</td>`).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      if (rows) blocks.push(`<table><tbody>${rows}</tbody></table>`);
    }
  });
  if (!blocks.length) throw new Error('El documento Word no contiene texto o tablas utilizables.');
  return `<html><head><meta charset="utf-8"></head><body>${blocks.join('')}</body></html>`;
}

export async function importHtmlTemplate(file: File, targetKey: string, settings?: Record<string, unknown>): Promise<ImportedPdfTemplate> {
  const html = sanitizeImportedHtml(await file.text());
  if (!html) throw new Error('No se pudo sanitizar el HTML importado.');
  const definition = definitionFromHtml(html, targetKey, settings, 'html');
  return { kind: 'html', definition, sanitizedHtml: html, warnings: definition.metadata?.importWarnings || [] };
}

export async function importDocxTemplate(file: File, targetKey: string, settings?: Record<string, unknown>): Promise<ImportedPdfTemplate> {
  const html = sanitizeImportedHtml(await docxToHtml(file));
  const definition = definitionFromHtml(html, targetKey, settings, 'docx');
  return { kind: 'docx', definition, sanitizedHtml: html, warnings: definition.metadata?.importWarnings || [] };
}
