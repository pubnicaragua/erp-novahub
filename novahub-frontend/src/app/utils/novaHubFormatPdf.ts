import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getReadableForeground } from './color-contrast';
import { getBase64Image } from './export-utils';
import { getNovaHubLogoPng, NOVAHUB_LOGO_DATA_URL } from './novahubBrand';
import { brandingService } from '../services/branding.service';

export interface NovaHubFormatColumn<T = any> {
  header: string;
  value: (row: T) => unknown;
  align?: 'left' | 'center' | 'right';
}

export interface NovaHubFormatReportOptions<T = any> {
  title: string;
  subtitle?: string;
  tenantName: string;
  tenantLogo?: string | null;
  brandPrimaryColor?: string | null;
  dateFrom?: string;
  dateTo?: string;
  metaBadge?: string;
  columns: Array<NovaHubFormatColumn<T>>;
  rows: T[];
  totals?: Record<string, unknown>;
  tableSummary?: { label: string; value: unknown; columnIndex?: number };
  fileName: string;
  save?: boolean;
}

type Rgb = [number, number, number];

function parseColorToRgb(color: string | undefined | null, fallback: Rgb): Rgb {
  if (!color || typeof color !== 'string') return fallback;
  const hexMatch = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  const oklchMatch = color.trim().match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/i);
  if (oklchMatch) {
    const L = parseFloat(oklchMatch[1]);
    const C = parseFloat(oklchMatch[2]);
    const h = parseFloat(oklchMatch[3]);
    const hRad = (h * Math.PI) / 180;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);

    const l = L + 0.3963377774 * a + 0.2158037573 * b;
    const m = L - 0.1055613458 * a - 0.0638541728 * b;
    const s = L - 0.0894841775 * a - 1.291485548 * b;

    const l3 = l * l * l;
    const m3 = m * m * m;
    const s3 = s * s * s;

    let rr = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    let gg = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    let bb = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

    const delinearize = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055);
    rr = Math.round(Math.min(255, Math.max(0, delinearize(rr) * 255)));
    gg = Math.round(Math.min(255, Math.max(0, delinearize(gg) * 255)));
    bb = Math.round(Math.min(255, Math.max(0, delinearize(bb) * 255)));
    return [rr, gg, bb];
  }
  return fallback;
}

export function resolveActiveBrandColor(providedColor?: string | null): Rgb {
  if (providedColor) {
    return parseColorToRgb(providedColor, [16, 185, 129]);
  }
  if (typeof window !== 'undefined') {
    try {
      const computed = window.getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
      if (computed) {
        return parseColorToRgb(computed, [16, 185, 129]);
      }
    } catch {
      // Continue to next fallback
    }
    try {
      const stored = window.localStorage.getItem('nh-session-branding');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.primaryColor) {
          return parseColorToRgb(parsed.primaryColor, [16, 185, 129]);
        }
      }
    } catch {
      // Continue to fallback
    }
  }
  return [16, 185, 129]; // #10b981
}

async function resolveLogoCandidateToPng(candidate?: string | null): Promise<string | null> {
  const trimmed = typeof candidate === 'string' ? candidate.trim() : '';
  if (!trimmed || trimmed === NOVAHUB_LOGO_DATA_URL) return null;
  try {
    if (trimmed.startsWith('data:image/png')) return trimmed;
    const converted = await getBase64Image(trimmed);
    if (converted) return converted;
    if (trimmed.startsWith('data:image/')) return trimmed;
    return null;
  } catch {
    return trimmed.startsWith('data:image/') ? trimmed : null;
  }
}

/**
 * Resuelve el logotipo corporativo activo de la empresa (Marca y Tema / tenant / sesión)
 * antes de recurrir al isotipo de NovaHub como último recurso.
 */
export async function resolveActiveBrandLogo(providedLogo?: string | null): Promise<string | null> {
  const candidates: string[] = [];
  if (typeof providedLogo === 'string' && providedLogo.trim() && providedLogo.trim() !== NOVAHUB_LOGO_DATA_URL) {
    candidates.push(providedLogo.trim());
  }

  if (typeof window !== 'undefined') {
    try {
      const impersonation = JSON.parse(window.localStorage.getItem('nh-impersonation-state') || 'null');
      if (typeof impersonation?.branch?.logo === 'string' && impersonation.branch.logo.trim()) {
        candidates.push(impersonation.branch.logo.trim());
      }
    } catch {
      // Continue
    }
    try {
      const sessionBranding = JSON.parse(window.localStorage.getItem('nh-session-branding') || 'null');
      if (typeof sessionBranding?.logo === 'string' && sessionBranding.logo.trim()) {
        candidates.push(sessionBranding.logo.trim());
      }
    } catch {
      // Continue
    }
  }

  const uniqueCandidates = [...new Set(candidates)];
  for (const candidate of uniqueCandidates) {
    const resolved = await resolveLogoCandidateToPng(candidate);
    if (resolved) return resolved;
  }

  // Si no había logo en memoria/localStorage o si una URL firmada expiró,
  // consultar el endpoint de branding actual de la empresa activa.
  if (typeof window !== 'undefined' && window.localStorage.getItem('nh-auth-token')) {
    try {
      const currentBranding = await brandingService.getCurrent();
      if (currentBranding?.logo) {
        try {
          const existingSession = JSON.parse(window.localStorage.getItem('nh-session-branding') || 'null') || {};
          window.localStorage.setItem('nh-session-branding', JSON.stringify({
            ...existingSession,
            logo: currentBranding.logo,
            name: currentBranding.companyName || existingSession.name || 'NovaHub ERP',
          }));
        } catch {
          // Ignore storage write error
        }
        const resolvedServerLogo = await resolveLogoCandidateToPng(currentBranding.logo);
        if (resolvedServerLogo) return resolvedServerLogo;
      }
    } catch {
      // Continue to NovaHub fallback
    }
  }

  try {
    return await getNovaHubLogoPng();
  } catch {
    return null;
  }
}

/**
 * Genera un PDF estructurado, con diseño corporativo impecable,
 * totalmente independiente del configurador de documentos, adaptado a la identidad
 * de marca (color primario y logo).
 */
export async function generateNovaHubFormatReport<T = any>({
  title,
  subtitle,
  tenantName,
  tenantLogo,
  brandPrimaryColor,
  dateFrom,
  dateTo,
  metaBadge,
  columns,
  rows,
  totals,
  tableSummary,
  fileName,
  save = true,
}: NovaHubFormatReportOptions<T>): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter', // 215.9 x 279.4 mm
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const primaryRgb = resolveActiveBrandColor(brandPrimaryColor);
  const primaryHex = `#${primaryRgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  const isLightForeground = getReadableForeground(primaryHex) === '#ffffff';
  const primaryFgRgb: Rgb = isLightForeground ? [255, 255, 255] : [15, 23, 42];

  // Cargar logotipo de la empresa o isotipo de NovaHub como último recurso
  const resolvedLogoData = await resolveActiveBrandLogo(tenantLogo);

  // Encabezado corporativo
  let headerY = margin;

  // 1. Barra de acento superior sutil (marca)
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.rect(margin, headerY, contentWidth, 3, 'F');
  headerY += 6;

  // 2. Logotipo e Información de Empresa
  const logoHeight = 14;
  const logoWidth = 14;
  let logoOffset = 0;

  if (resolvedLogoData) {
    try {
      doc.addImage(resolvedLogoData, 'PNG', margin, headerY, logoWidth, logoHeight, undefined, 'FAST');
      logoOffset = logoWidth + 4;
    } catch {
      logoOffset = 0;
    }
  }

  // Nombre de la empresa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(tenantName || 'NovaHub ERP', margin + logoOffset, headerY + 5.5);

  // Insignia del formato independiente
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  const badgeText = 'FORMATO EMPRESARIAL NOVAHUB';
  const badgeWidth = doc.getTextWidth(badgeText) + 6;
  doc.roundedRect(pageWidth - margin - badgeWidth, headerY + 1, badgeWidth, 5.5, 1.2, 1.2, 'F');
  doc.setTextColor(primaryFgRgb[0], primaryFgRgb[1], primaryFgRgb[2]);
  doc.text(badgeText, pageWidth - margin - badgeWidth + 3, headerY + 4.7);

  // Subtítulo de la empresa o software
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('Sistema de Gestión Empresarial · Reporte Oficial', margin + logoOffset, headerY + 10.5);

  headerY += Math.max(logoHeight, 13) + 4;

  // 3. Tarjeta destacada con el Título del Reporte y Filtros / Período
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.3);
  const cardY = headerY;
  const cardHeight = 18;
  doc.roundedRect(margin, cardY, contentWidth, cardHeight, 2, 2, 'FD');

  // Barra vertical izquierda con color de marca dentro de la tarjeta
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.roundedRect(margin, cardY, 2.5, cardHeight, 1, 1, 'F');

  // Título del reporte
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(title.toUpperCase(), margin + 6, cardY + 7);

  // Subtítulo / Metadatos / Período
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // slate-600

  const periodParts: string[] = [];
  if (dateFrom || dateTo) {
    periodParts.push(`Período: ${dateFrom || 'Inicio'} al ${dateTo || 'Actual'}`);
  }
  if (subtitle) {
    periodParts.push(subtitle);
  }
  if (metaBadge) {
    periodParts.push(metaBadge);
  }
  if (periodParts.length === 0) {
    periodParts.push('Todos los movimientos registrados');
  }
  doc.text(periodParts.join('  ·  '), margin + 6, cardY + 13.5);

  // Fecha de generación a la derecha
  const genDateText = `Generado: ${new Date().toLocaleString('es-NI')}`;
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(genDateText, pageWidth - margin - 5, cardY + 10.5, { align: 'right' });

  headerY = cardY + cardHeight + 6;

  // 4. Transformar filas para autoTable
  const tableHeaders = columns.map((c) => c.header);
  const tableBody = rows.length > 0
    ? rows.map((row) => columns.map((col) => {
        const val = col.value(row);
        return val !== null && val !== undefined && val !== '' ? String(val) : '—';
      }))
    : [[ 'Sin registros para el alcance seleccionado', ...Array(Math.max(0, columns.length - 1)).fill('') ]];

  // Configuración de anchos y alineación de columnas
  const columnStyles: Record<number, any> = {};
  columns.forEach((col, idx) => {
    columnStyles[idx] = {
      halign: col.align || 'left',
    };
  });

  // Generar tabla profesional con jspdf-autotable
  autoTable(doc, {
    startY: headerY,
    margin: { left: margin, right: margin, bottom: 20 },
    head: [tableHeaders],
    body: tableBody,
    theme: 'plain',
    tableWidth: contentWidth,
    headStyles: {
      fillColor: [primaryRgb[0], primaryRgb[1], primaryRgb[2]],
      textColor: [primaryFgRgb[0], primaryFgRgb[1], primaryFgRgb[2]],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 3 },
      halign: 'left',
    },
    bodyStyles: {
      textColor: [51, 65, 85], // slate-700
      fontSize: 7.5,
      cellPadding: { top: 2.8, bottom: 2.8, left: 3, right: 3 },
      lineColor: [241, 245, 249], // slate-100
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    columnStyles,
    didDrawCell: (data) => {
      // Línea inferior sutil en las cabeceras
      if (data.section === 'head') {
        doc.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
        doc.setLineWidth(0.3);
      }
    },
    didDrawPage: (data) => {
      // Pie de página profesional en cada página
      const currentPage = data.pageNumber;
      const totalPages = (doc.internal as any).getNumberOfPages ? (doc.internal as any).getNumberOfPages() : currentPage;
      
      const footerY = pageHeight - 10;
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `${tenantName || 'NovaHub ERP'}  ·  Documento Oficial  ·  NovaHubFormat`,
        margin,
        footerY + 1.5,
      );

      doc.text(
        `Página ${currentPage} de ${totalPages}`,
        pageWidth - margin,
        footerY + 1.5,
        { align: 'right' },
      );
    },
  });

  let finalY = (doc as any).lastAutoTable?.finalY || headerY + 40;

  // 5. Bloque de Totales / Resumen si existen
  if (totals && Object.keys(totals).length > 0) {
    if (finalY + 30 > pageHeight - 20) {
      doc.addPage('letter', 'portrait');
      finalY = margin + 10;
    } else {
      finalY += 6;
    }

    const totalsWidth = Math.min(105, contentWidth);
    const totalsX = pageWidth - margin - totalsWidth;
    const entries = Object.entries(totals);
    const boxHeight = entries.length * 5.5 + 8;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(totalsX, finalY, totalsWidth, boxHeight, 1.5, 1.5, 'FD');

    // Borde izquierdo de marca en el cuadro de totales
    doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.roundedRect(totalsX, finalY, 2, boxHeight, 0.8, 0.8, 'F');

    let totalRowY = finalY + 5.5;
    entries.forEach(([key, val], idx) => {
      const isLast = idx === entries.length - 1;
      const formattedKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
      doc.setFont('helvetica', isLast ? 'bold' : 'normal');
      doc.setFontSize(isLast ? 8.5 : 8);
      doc.setTextColor(isLast ? 15 : 71, isLast ? 23 : 85, isLast ? 42 : 105);
      doc.text(`${formattedKey}:`, totalsX + 5, totalRowY);
      doc.text(String(val ?? '—'), totalsX + totalsWidth - 4, totalRowY, { align: 'right' });
      totalRowY += 5.5;
    });

    finalY += boxHeight;
  }

  // 6. Resumen de tabla si existe
  if (tableSummary && tableSummary.label) {
    if (finalY + 12 <= pageHeight - 20) {
      finalY += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(`${tableSummary.label}: ${tableSummary.value ?? '—'}`, margin, finalY);
    }
  }

  // 7. Descargar el archivo generado si aplica
  if (save) {
    doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  }
  return doc;
}
