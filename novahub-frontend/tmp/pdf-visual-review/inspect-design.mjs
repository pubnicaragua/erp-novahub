async (page) => await page.evaluate(async () => {
  const m = await import('/src/app/utils/pdfGenerator.ts');
  const d = await m.getPdfDesign('inventario.products');
  return {name:d?.name, sourceType:d?.sourceType, engine:d?.engine, meta:d?.layoutZones?.definition?.metadata, nodes:d?.layoutZones?.definition?.nodes?.filter(n=>n.id.includes('logo')||n.id.includes('company')||n.id.includes('document-title')||n.type==='report-sections').map(n=>({id:n.id,type:n.type,x:n.x,y:n.y,width:n.width,height:n.height,enabled:n.enabled,firstPageOnly:n.firstPageOnly,page:n.page,token:n.token})), keys:Object.keys(d||{})};
})
