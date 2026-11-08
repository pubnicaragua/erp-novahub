import type { CardData, CardDesign, CardEmployee } from '../../../services/employee-profile.service';

const escape = (value: string | null | undefined) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeUrl = (value: string | null | undefined) => (value && /^(https?:|data:image\/)/i.test(value) ? escape(value) : '');
const initials = (employee: CardEmployee) => `${employee.firstName[0] ?? ''}${employee.lastName[0] ?? ''}`.toUpperCase();

/** Familias tipográficas del carnet: fuentes que existen en cualquier equipo, para que se imprima igual en todos. */
export const CARD_FONT_STACKS: Record<string, string> = {
  SANS: "'Segoe UI',Arial,sans-serif",
  SERIF: "Georgia,'Times New Roman',serif",
  ROUNDED: "'Trebuchet MS','Verdana',sans-serif",
  MONO: "'Courier New',monospace",
  CONDENSED: "'Arial Narrow','Roboto Condensed',Arial,sans-serif",
};

export interface CardHtmlOptions { qrByEmployee: Record<string, string>; preview?: boolean }

function front(design: CardDesign, company: CardData['company'], employee: CardEmployee, qr: string | undefined) {
  const logo = safeUrl(company.logo);
  const photo = design.showPhoto ? (safeUrl(employee.photo) ? `<img class="photo" src="${safeUrl(employee.photo)}" alt="" />` : `<div class="photo initials">${escape(initials(employee))}</div>`) : '';
  const logoHtml = logo ? `<img class="logo" src="${logo}" alt="${escape(company.name)}" />` : `<span class="company">${escape(company.name)}</span>`;
  const qrHtml = design.showQr && qr ? `<img class="qr" src="${qr}" alt="Código QR" />` : '';
  const meta = `<p class="position">${escape(employee.position ?? '')}</p>${design.showDepartment && employee.department ? `<p class="dept">${escape(employee.department)}</p>` : ''}<p class="number">N.º ${escape(employee.number)}</p>`;
  const name = `<p class="name">${escape(employee.firstName)}<br /><strong>${escape(employee.lastName)}</strong></p>`;
  return `<section class="card ${design.layout.toLowerCase()} front"><header>${logoHtml}</header><div class="body">${photo}<div class="info">${name}${meta}</div>${design.layout !== 'VERTICAL' ? qrHtml : ''}</div>${design.layout === 'VERTICAL' && qrHtml ? `<div class="qrbox">${qrHtml}</div>` : ''}<footer>${escape(design.footerText ?? company.name)}</footer></section>`;
}

function back(design: CardDesign, company: CardData['company'], employee: CardEmployee, qr: string | undefined) {
  return `<section class="card ${design.layout.toLowerCase()} back"><div class="backbody"><p class="company">${escape(company.name)}</p><p class="backtext">${escape(design.backText ?? 'Este carnet es personal e intransferible. Si lo encuentras, devuélvelo a la empresa.')}</p>${design.showQr && qr ? `<img class="qr big" src="${qr}" alt="Código QR" />` : ''}<p class="small">N.º ${escape(employee.number)}${employee.active ? '' : ' · INACTIVO'}</p></div></section>`;
}

/** Documento HTML con los carnets (frente y reverso) de cada empleado, listo para imprimir en tamaño tarjeta (85.6 × 54 mm). */
export function buildCardsHtml(data: CardData, options: CardHtmlOptions): string {
  const { design, company, employees } = data;
  const vertical = design.layout === 'VERTICAL';
  const font = CARD_FONT_STACKS[design.fontFamily] ?? CARD_FONT_STACKS.SANS;
  const [w, h] = vertical ? ['54mm', '85.6mm'] : ['85.6mm', '54mm'];
  const preview = Boolean(options.preview);
  const css = `
    :root{--p:${design.primaryColor};--a:${design.accentColor};--t:${design.textColor};--w:${w};--h:${h}}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:${font};background:${preview ? '#e2e8f0' : '#fff'};color:var(--t);${preview ? 'padding:12px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start' : ''}}
    @page{size:${w} ${h};margin:0}
    .card{width:var(--w);height:var(--h);overflow:hidden;position:relative;background:#fff;display:flex;flex-direction:column;${preview ? 'border-radius:3mm;box-shadow:0 1px 6px #0003' : 'page-break-after:always;break-after:page'}}
    header{background:var(--p);padding:2.2mm 3mm;display:flex;align-items:center;min-height:11mm}
    .logo{max-height:8mm;max-width:40mm;object-fit:contain;background:#fff;border-radius:1mm;padding:.6mm}
    .company{color:#fff;font-weight:700;font-size:9pt;letter-spacing:.2px}
    .body{flex:1;display:flex;align-items:center;gap:3mm;padding:2.5mm 3mm;position:relative}
    .photo{width:20mm;height:24mm;object-fit:cover;border-radius:1.5mm;border:.6mm solid var(--a);flex:none}
    .initials{display:flex;align-items:center;justify-content:center;background:var(--a);color:#fff;font-size:16pt;font-weight:700}
    .info{min-width:0;flex:1}
    .name{font-size:10.5pt;line-height:1.15;color:var(--t)}
    .name strong{font-size:12pt}
    .position{font-size:7.5pt;font-weight:600;color:var(--p);margin-top:1.2mm}
    .dept,.number{font-size:6.5pt;color:#475569;margin-top:.5mm}
    .qr{width:14mm;height:14mm;flex:none}
    footer{background:var(--a);color:#fff;font-size:5.5pt;text-align:center;padding:1mm 2mm;letter-spacing:.2px}
    .modern header{background:#fff;border-bottom:1mm solid var(--a)}
    .modern .company{color:var(--p)}
    .modern .body{background:linear-gradient(90deg,var(--p) 0,var(--p) 28mm,#fff 28mm)}
    .modern .photo{border-color:#fff}
    .modern .name,.modern .position{}
    .vertical header{justify-content:center;min-height:15mm}
    .vertical .body{flex-direction:column;justify-content:center;text-align:center;gap:2mm;padding:3mm}
    .vertical .photo{width:26mm;height:32mm}
    .vertical .qrbox{display:flex;justify-content:center;padding-bottom:2mm}
    .back{align-items:center;justify-content:center;text-align:center;background:var(--p);color:#fff}
    .backbody{padding:4mm;display:flex;flex-direction:column;align-items:center;gap:2mm}
    .back .company{font-size:10pt}
    .backtext{font-size:6.5pt;line-height:1.35;opacity:.95}
    .back .qr.big{width:20mm;height:20mm;background:#fff;padding:1mm;border-radius:1mm}
    .small{font-size:6pt;opacity:.85}
    .bold header{background:#fff;border-bottom:1.2mm solid var(--a)}
    .bold .company{color:var(--p)}
    .bold .body{background:var(--p);color:#fff}
    .bold .name,.bold .position,.bold .dept,.bold .number{color:#fff}
    .bold .photo{border-color:#fff}
    .bold footer{background:var(--p);color:#fff}
    .minimal header{background:#fff;border-bottom:.3mm solid #cbd5e1}
    .minimal .company{color:var(--p)}
    .minimal .photo{border-radius:50%;border:.4mm solid var(--p)}
    .minimal .position{color:var(--a)}
    .minimal footer{background:#fff;color:#64748b;border-top:.3mm solid #cbd5e1}
    .corporate header{background:#fff;border-left:2.2mm solid var(--p);padding-left:2.5mm}
    .corporate .company{color:var(--p)}
    .corporate .body{background:#f1f5f9}
    .corporate .photo{border-radius:50%;border:.8mm solid var(--p)}
    .corporate footer{background:var(--p)}`;
  const cards = employees.map((employee) => {
    const qr = options.qrByEmployee[employee.id];
    return front(design, company, employee, qr) + back(design, company, employee, qr);
  }).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Carnets</title><style>${css}</style></head><body>${cards}</body></html>`;
}
