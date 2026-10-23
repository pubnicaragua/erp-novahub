async (page) => await page.evaluate(async () => {
  const { generateSessionSummaryPDF } = await import('/src/app/utils/pdfGenerator.ts');
  const logs = Array.from({ length: 35 }, (_, index) => ({ id: `cash-${index + 1}`, type: index % 4 === 0 ? 'SALE' : index % 4 === 1 ? 'ENTRY' : index % 4 === 2 ? 'EXIT' : 'SALE', reference: `REF-${String(index + 1).padStart(4, '0')}`, description: index % 3 === 0 ? `Movimiento de prueba ${index + 1} con descripción suficientemente larga para comprobar que el texto no se corta al cambiar de página` : `Movimiento de prueba ${index + 1}`, createdAt: new Date(2026, 9, 19, 8 + (index % 10), index % 60).toISOString(), amountNIO: 250 + index * 10, amountUSD: 0 }));
  const doc = await generateSessionSummaryPDF({ session: { register: { code: 'CJ-01', name: 'Caja principal' }, openedAt: '2026-10-19T08:00:00', status: 'CLOSED', user: { name: 'Gabriel Tinoco' } }, logs, tenantName: 'NOVA ERP', displayCurrency: 'NIO', isUSD: false, sessionRate: 36.5, totals: { fondoInicial: 5000, ventas: 25000, gastos: 1200, esperado: 28800, contado: 28800, diferencia: 0 } });
  return { pages: doc?.getNumberOfPages?.() ?? null };
})
