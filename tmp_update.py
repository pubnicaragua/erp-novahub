import os

# Update SalesReportTab.tsx
sales_path = "novahub-frontend/src/app/components/reportes/SalesReportTab.tsx"
with open(sales_path, "r", encoding="utf-8") as f:
    sales_content = f.read()

# Replace imports
sales_content = sales_content.replace(
    "import autoTable from 'jspdf-autotable';",
    "import html2canvas from 'html2canvas';"
)

utils_str = r"""  const getBase64Image = async (url: string) => {
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

  const sanitizeHtml2CanvasOklch = (_elementId: string, clonedDoc: Document, primaryHex: string) => {
    const styleTag = clonedDoc.createElement('style');
    styleTag.innerHTML = `
      :root, *, *::before, *::after {
        --background: #ffffff !important;
        --foreground: #333333 !important;
        --card: #ffffff !important;
        --card-foreground: #333333 !important;
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
      }
    `;
    clonedDoc.head.appendChild(styleTag);
    const hasUnsupported = (s: string | null | undefined) => s ? /oklch\(|oklab\(|color\(|lch\(|lab\(/i.test(s) : false;
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
          else if (cls.includes('text-emerald') || cls.includes('text-green')) safeColor = '#10b981';
          else if (cls.includes('text-rose') || cls.includes('text-red')) safeColor = '#f43f5e';
          else if (cls.includes('text-blue')) safeColor = '#3b82f6';
          else if (cls.includes('text-amber') || cls.includes('text-orange')) safeColor = '#f59e0b';
          else if (cls.includes('text-purple')) safeColor = '#a855f7';

          if (hasUnsupported(comp.color)) cloneEl.style.setProperty('color', safeColor, 'important');
          if (hasUnsupported(comp.backgroundColor)) {
            let bg = 'transparent';
            if (cls.includes('bg-primary')) bg = primaryHex;
            else if (cls.includes('bg-emerald')) bg = '#10b981';
            else if (cls.includes('bg-rose')) bg = '#f43f5e';
            else if (cls.includes('bg-blue')) bg = '#3b82f6';
            else if (cls.includes('bg-amber')) bg = '#f59e0b';
            else if (cls.includes('bg-purple')) bg = '#a855f7';
            else if (cls.includes('bg-muted')) bg = '#f3f4f6';
            else if (cls.includes('bg-card') || cls.includes('bg-background')) bg = '#ffffff';
            cloneEl.style.setProperty('background-color', bg, 'important');
          }
          if (hasUnsupported(comp.borderColor)) cloneEl.style.setProperty('border-color', '#e5e7eb', 'important');
          if (hasUnsupported(comp.backgroundImage)) cloneEl.style.setProperty('background-image', 'none', 'important');
          if (hasUnsupported(comp.boxShadow)) cloneEl.style.setProperty('box-shadow', 'none', 'important');
          
          const tagName = cloneEl.tagName?.toLowerCase?.() || '';
          if (tagName === 'svg' || cloneEl.closest?.('svg') || ['path','rect','circle','line','polygon','polyline','g','text','tspan'].includes(tagName)) {
            const fill = cloneEl.getAttribute('fill');
            const stroke = cloneEl.getAttribute('stroke');
            if (fill && (hasUnsupported(fill) || fill.includes('var('))) {
              if (!cls.includes('recharts-bar-rectangle') && !cls.includes('recharts-pie-sector')) {
                cloneEl.setAttribute('fill', '#9ca3af');
              }
            }
            if (stroke && (hasUnsupported(stroke) || stroke.includes('var('))) cloneEl.setAttribute('stroke', '#e5e7eb');
          }
        } catch (e) {}
      }
    };

    const ids = ['sales-report-kpis', 'sales-chart-trend', 'sales-chart-pie', 'sales-chart-bar'];
    ids.forEach(id => walkAndFix(document.getElementById(id), clonedDoc.getElementById(id)));
  };"""

export_block = r"""useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      try {
        toast.info("Generando PDF de Ventas, por favor espere...");
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const companyName = themeConfig.tenantName || 'Mi Empresa';
        const logoUrl = themeConfig.logo || '';
        const primaryColor = themeConfig.colors.primary || '#10b981';
        const primaryHex = primaryColor.startsWith('#') ? primaryColor : '#10b981';
        const rgbPrimary = primaryHex.startsWith('#') ? [parseInt(primaryHex.slice(1,3), 16), parseInt(primaryHex.slice(3,5), 16), parseInt(primaryHex.slice(5,7), 16)] : [16, 185, 129];
        const marginX = 14;
        const contentWidth = pageWidth - marginX * 2;
        let currentY = 15;

        const checkPage = (needed: number) => { if (currentY + needed > pageHeight - 15) { doc.addPage(); currentY = 20; } };

        if (logoUrl) {
          const logoBase64 = await getBase64Image(logoUrl);
          if (logoBase64) { doc.addImage(logoBase64, 'PNG', (pageWidth - 30) / 2, currentY, 30, 30, undefined, 'FAST'); currentY += 35; }
        }

        doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(rgbPrimary[0], rgbPrimary[1], rgbPrimary[2]);
        doc.text(companyName, pageWidth / 2, currentY, { align: 'center' }); currentY += 8;
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 60);
        doc.text(`Reporte de Ventas`, pageWidth / 2, currentY, { align: 'center' }); currentY += 6;
        
        const now = new Date();
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
        const currencyLabel = displayCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)';
        doc.text(`Generado: ${now.toLocaleDateString('es-NI')} ${now.toLocaleTimeString('es-NI')}  |  Moneda: ${currencyLabel}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;

        doc.setDrawColor(rgbPrimary[0], rgbPrimary[1], rgbPrimary[2]); doc.setLineWidth(0.8);
        doc.line(marginX, currentY, pageWidth - marginX, currentY); currentY += 10;

        const kpis = [
          { label: 'FACTURACIÓN', value: formatConvertedAmount(totalBilled, 'NIO'), detail: `${fInv.length} facturas`, color: [16, 185, 129] },
          { label: 'COBRANZA', value: formatConvertedAmount(totalPaid, 'NIO'), detail: `${((totalPaid / Math.max(totalBilled, 1)) * 100).toFixed(1)}% del facturado`, color: [59, 130, 246] },
          { label: 'MARGEN BRUTO', value: `${grossMargin.toFixed(1)}%`, detail: 'Basado en costos', color: [168, 85, 247] },
          { label: 'TICKET PROM.', value: formatConvertedAmount(avgTicket, 'NIO'), detail: 'Valor medio', color: [245, 158, 11] },
        ];

        const cols = 4; const boxW = (contentWidth - (cols - 1) * 4) / cols; const boxH = 22;
        checkPage(boxH + 5);
        kpis.forEach((kpi, idx) => {
          const x = marginX + idx * (boxW + 4);
          doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
          doc.roundedRect(x, currentY, boxW, boxH, 3, 3, 'F');
          doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
          doc.text(kpi.label, x + boxW / 2, currentY + 6, { align: 'center' });
          doc.setFontSize(12); doc.text(kpi.value, x + boxW / 2, currentY + 13, { align: 'center' });
          doc.setFontSize(7); doc.setFont('helvetica', 'normal');
          doc.text(kpi.detail, x + boxW / 2, currentY + 18.5, { align: 'center' });
        });
        currentY += boxH + 10;

        const charts = ['sales-chart-bar', 'sales-chart-trend'];
        for (const chartId of charts) {
          const el = document.getElementById(chartId);
          if (el) {
            checkPage(95);
            try {
              const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', onclone: (clonedDoc) => sanitizeHtml2CanvasOklch(chartId, clonedDoc, primaryHex) });
              doc.addImage(canvas.toDataURL('image/png'), 'PNG', marginX, currentY, contentWidth, 80, undefined, 'FAST');
              currentY += 85;
            } catch (imgErr) { console.warn(`${chartId} failed`, imgErr); }
          }
        }

        const renderTop = (title: string, data: any[], colorRGB: number[]) => {
          checkPage(40);
          doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 60);
          doc.text(title, marginX, currentY); currentY += 7;
          doc.setFillColor(colorRGB[0], colorRGB[1], colorRGB[2]);
          doc.roundedRect(marginX, currentY, contentWidth, 8, 1, 1, 'F');
          doc.setFontSize(8); doc.setTextColor(255, 255, 255);
          doc.text('Nombre / Concepto', marginX + 3, currentY + 5.5);
          doc.text('Valor', marginX + 130, currentY + 5.5);
          currentY += 10;
          data.forEach((item, i) => {
            checkPage(8);
            if (i % 2 === 0) { doc.setFillColor(248, 249, 250); doc.rect(marginX, currentY - 1, contentWidth, 7, 'F'); }
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
            doc.text((item.name || '').substring(0, 50), marginX + 3, currentY + 4);
            doc.setFont('helvetica', 'bold'); doc.setTextColor(colorRGB[0], colorRGB[1], colorRGB[2]);
            const valStr = item.value !== undefined ? formatConvertedAmount(Number(item.value), 'NIO') : formatConvertedAmount(Number(item.margin), 'NIO');
            doc.text(valStr, marginX + 130, currentY + 4);
            currentY += 7;
          });
          currentY += 10;
        };

        renderTop('Top 5 Clientes', topCustomers, [59, 130, 246]);
        renderTop('Top 5 Productos (Por Margen)', topProducts, [168, 85, 247]);

        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150);
          doc.text(`${companyName} - Reporte de Ventas - Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
        }

        doc.save(`Reporte_Ventas_${now.toISOString().split('T')[0]}.pdf`);
        toast.success("PDF generado exitosamente");
      } catch (e) { console.error(e); toast.error("Error al generar PDF"); }
    },
    exportExcel: async () => {
      try {
        toast.info("Generando Excel de Ventas...");
        const wb = new ExcelJS.Workbook();
        const companyName = themeConfig.tenantName || 'Mi Empresa';
        const logoUrl = themeConfig.logo || '';
        const primaryHex = (themeConfig.colors.primary || '#10b981').replace('#', '');
        const currencyLabel = displayCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)';
        const thinBorder = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };

        const ws = wb.addWorksheet('Reporte de Ventas');
        ws.getColumn(1).width = 8; ws.getColumn(2).width = 35; ws.getColumn(3).width = 25; ws.getColumn(4).width = 25;

        let currentRow = 1;

        if (logoUrl) {
          const base64Logo = await getBase64Image(logoUrl);
          if (base64Logo) {
            const logoId = wb.addImage({ base64: base64Logo, extension: 'png' });
            ws.addImage(logoId, { tl: { col: 1.5, row: 0 }, ext: { width: 100, height: 100 } });
            currentRow = 6;
          }
        }

        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const cellName = ws.getCell(`A${currentRow}`); cellName.value = companyName;
        cellName.font = { size: 18, bold: true, color: { argb: `FF${primaryHex}` } }; cellName.alignment = { horizontal: 'center' }; currentRow++;

        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const cellTitle = ws.getCell(`A${currentRow}`); cellTitle.value = 'Reporte de Ventas';
        cellTitle.font = { size: 13, bold: true }; cellTitle.alignment = { horizontal: 'center' }; currentRow++;

        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const cellCurrency = ws.getCell(`A${currentRow}`);
        cellCurrency.value = `Moneda: ${currencyLabel} (${currencySymbol})  |  ${new Date().toLocaleDateString('es-NI')}`;
        cellCurrency.font = { size: 10, italic: true, color: { argb: 'FF888888' } }; cellCurrency.alignment = { horizontal: 'center' }; currentRow += 2;

        const kpis = [
          { label: 'FACTURACIÓN', value: formatConvertedAmount(totalBilled, 'NIO'), detail: `${fInv.length} facturas`, bgColor: 'FF10B981' },
          { label: 'COBRANZA', value: formatConvertedAmount(totalPaid, 'NIO'), detail: `${((totalPaid / Math.max(totalBilled, 1)) * 100).toFixed(1)}%`, bgColor: 'FF3B82F6' },
          { label: 'MARGEN BRUTO', value: `${grossMargin.toFixed(1)}%`, detail: 'Costos est.', bgColor: 'FFA855F7' },
          { label: 'TICKET PROM.', value: formatConvertedAmount(avgTicket, 'NIO'), detail: 'Medio', bgColor: 'FFF59E0B' },
        ];

        ws.getRow(currentRow).height = 18;
        kpis.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.label; cell.font = { size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } }; cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }); currentRow++;
        ws.getRow(currentRow).height = 28;
        kpis.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.value; cell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } }; cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }); currentRow++;
        ws.getRow(currentRow).height = 16;
        kpis.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.detail; cell.font = { size: 8, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } }; cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }); currentRow += 2;

        const captureAndEmbed = async (elementId: string) => {
          const el = document.getElementById(elementId); if (!el) return;
          try {
            const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', onclone: (clonedDoc) => sanitizeHtml2CanvasOklch(elementId, clonedDoc, `#${primaryHex}`) });
            const imgId = wb.addImage({ base64: canvas.toDataURL('image/png'), extension: 'png' });
            const width = 600; const height = (canvas.height * width) / canvas.width;
            ws.addImage(imgId, { tl: { col: 0, row: currentRow }, ext: { width, height } });
            currentRow += Math.ceil(height / 18) + 2;
          } catch (e) { console.warn(e); }
        };

        await captureAndEmbed('sales-chart-bar');
        await captureAndEmbed('sales-chart-trend');

        while (ws.rowCount < currentRow) ws.addRow([]); ws.addRow([]);

        const renderTopTable = (title: string, data: any[], colorHex: string, isMargin: boolean) => {
          const titleRow = ws.addRow([title, '', '', '']); ws.mergeCells(`A${ws.rowCount}:D${ws.rowCount}`);
          titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: colorHex } }; titleRow.getCell(1).alignment = { horizontal: 'center' }; ws.addRow([]);
          const header = ws.addRow(['#', 'Nombre', 'Monto', '']);
          header.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorHex } }; c.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder }; });
          data.forEach((item, idx) => {
            const r = ws.addRow([idx + 1, item.name, isMargin ? Number(item.margin) : Number(item.value), '']);
            r.getCell(1).font = { bold: true }; r.getCell(1).alignment = { horizontal: 'center' };
            r.getCell(3).numFmt = `"${currencySymbol}" #,##0.00`; r.getCell(3).font = { bold: true }; r.getCell(3).alignment = { horizontal: 'right' };
            r.eachCell(c => { c.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder }; });
          });
          ws.addRow([]); ws.addRow([]);
        };

        renderTopTable('Top 5 Clientes', topCustomers, 'FF3B82F6', false);
        renderTopTable('Top 5 Productos (Márgenes)', topProducts, 'FFA855F7', true);

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `Ventas_${new Date().toISOString().split('T')[0]}.xlsx`; link.click();
        toast.success("Excel generado exitosamente");
      } catch (e) { console.error(e); toast.error("Error al generar Excel"); }
    }
  }));"""

# Replace the block
start_idx = sales_content.find("useImperativeHandle(ref, () => ({")
end_idx = sales_content.find("}));", start_idx) + 4
sales_content = sales_content[:start_idx] + utils_str + "\n\n  " + export_block + sales_content[end_idx:]

# Add IDs to the sales DOM
sales_content = sales_content.replace(
    '<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">',
    '<div id="sales-report-kpis" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">'
)
sales_content = sales_content.replace(
    '<div className="h-[320px] w-full pt-2">',
    '<div id="sales-chart-bar" className="h-[320px] w-full pt-2">', 1  # First is bar
)
sales_content = sales_content.replace(
    '<div className="h-[320px] w-full">',
    '<div id="sales-chart-pie" className="h-[320px] w-full">'
)
sales_content = sales_content.replace(
    '<div className="h-[200px] w-full">',
    '<div id="sales-chart-trend" className="h-[200px] w-full">'
)

with open(sales_path, "w", encoding="utf-8") as f:
    f.write(sales_content)
