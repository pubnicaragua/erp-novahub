import type { LeadInput, LeadSource } from '../../../services/business-leads.service';

/** Mensaje legible de un error de la API para mostrar en un aviso. */
export const failure = (error: unknown): string => {
  const data = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return (Array.isArray(data) ? String(data[0]) : data?.toString?.()) || (error as Error)?.message || 'No se pudo completar la acción.';
};

/** Minúsculas y sin acentos, para reconocer encabezados escritos de varias formas. */
const plain = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

const HEADER_FIELDS: Record<string, keyof LeadInput> = {
  empresa: 'company', prospecto: 'company', cliente: 'company', negocio: 'company', compania: 'company',
  contacto: 'contactName', nombre: 'contactName', 'nombre del contacto': 'contactName', cargo: 'contactRole', puesto: 'contactRole',
  telefono: 'phone', celular: 'phone', whatsapp: 'phone', tel: 'phone',
  correo: 'email', email: 'email', 'correo electronico': 'email',
  pais: 'country', linea: 'businessLine', 'linea de negocio': 'businessLine', servicio: 'businessLine',
  sitio: 'website', web: 'website', 'sitio web': 'website', pagina: 'website', 'red social': 'website', instagram: 'website', facebook: 'website', linkedin: 'website',
  valor: 'estimatedValue', 'valor estimado': 'estimatedValue', monto: 'estimatedValue', moneda: 'currency',
  origen: 'source', fuente: 'source', 'siguiente paso': 'nextAction', 'proximo paso': 'nextAction', estrategia: 'strategy',
};

const SOURCE_WORDS: Record<string, LeadSource> = {
  referido: 'REFERRAL', referencia: 'REFERRAL', recomendado: 'REFERRAL', redes: 'SOCIAL', 'redes sociales': 'SOCIAL', social: 'SOCIAL', instagram: 'SOCIAL', facebook: 'SOCIAL', linkedin: 'SOCIAL',
  evento: 'EVENT', feria: 'EVENT', visita: 'WALK_IN', 'en frio': 'COLD', frio: 'COLD', 'contacto en frio': 'COLD', web: 'WEB', 'sitio web': 'WEB', otro: 'OTHER',
};

/** Orden de columnas cuando lo pegado no trae encabezados. */
const DEFAULT_ORDER: Array<keyof LeadInput> = ['company', 'contactName', 'phone', 'email', 'country', 'businessLine', 'estimatedValue'];

const parseMoney = (raw: string): { amount: number | null; currency?: string } => {
  const text = raw.trim();
  if (!text) return { amount: null };
  const currency = /c\$|nio|c[oó]rdoba/i.test(text) ? 'NIO' : /usd|\$|d[oó]lar/i.test(text) ? 'USD' : undefined;
  const amount = Number(text.replace(/[^0-9.,-]/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return { amount: Number.isFinite(amount) ? amount : null, ...(currency ? { currency } : {}) };
};

/**
 * Convierte lo pegado desde Excel o Google Sheets (columnas separadas por tabulación o punto y coma) en leads.
 * Si la primera fila trae encabezados conocidos se usan; si no, se asume: empresa, contacto, teléfono, correo, país, línea, valor.
 */
export function parsePastedLeads(raw: string): { leads: LeadInput[]; skipped: number } {
  const lines = raw.split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.trim());
  if (lines.length === 0) return { leads: [], skipped: 0 };
  const separator = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const split = (line: string) => line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ''));
  const firstRow = split(lines[0]);
  const mapped = firstRow.map((cell) => HEADER_FIELDS[plain(cell)]);
  const hasHeader = mapped.filter(Boolean).length >= 2 || (mapped.includes('company') && lines.length > 1);
  const fields = hasHeader ? mapped : DEFAULT_ORDER;
  const leads: LeadInput[] = [];
  let skipped = 0;
  for (const line of hasHeader ? lines.slice(1) : lines) {
    const cells = split(line);
    const lead: Record<string, unknown> = {};
    fields.forEach((field, index) => {
      const cell = cells[index];
      if (!field || !cell) return;
      if (field === 'estimatedValue') {
        const money = parseMoney(cell);
        if (money.amount !== null) lead.estimatedValue = money.amount;
        if (money.currency && !lead.currency) lead.currency = money.currency;
      } else if (field === 'source') lead.source = SOURCE_WORDS[plain(cell)] ?? 'OTHER';
      else if (field === 'currency') lead.currency = cell.toUpperCase().replace('C$', 'NIO').replace('$', 'USD').slice(0, 3);
      else lead[field] = cell;
    });
    if (typeof lead.company === 'string' && lead.company.trim()) leads.push(lead as LeadInput);
    else skipped += 1;
  }
  return { leads, skipped };
}
