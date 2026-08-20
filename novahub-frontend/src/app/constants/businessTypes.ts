export type BusinessTypeOption = {
  key: string;
  label: string;
  industry: string;
  subIndustry: string;
};

/**
 * The database keeps the broad IndustryType for module recommendations and
 * compatibility. subIndustry preserves the more precise business scenario
 * selected by the platform administrator.
 */
export const BUSINESS_TYPE_OPTIONS: BusinessTypeOption[] = [
  { key: 'RETAIL_COMMERCE', label: 'Comercio general / Retail', industry: 'RETAIL', subIndustry: 'COMMERCE' },
  { key: 'TECHNOLOGY', label: 'Tecnología y electrónica', industry: 'TECHNOLOGY', subIndustry: 'TECHNOLOGY' },
  { key: 'PHARMACY', label: 'Farmacia', industry: 'HEALTHCARE', subIndustry: 'PHARMACY' },
  { key: 'CLINIC', label: 'Clínica y consultorio', industry: 'HEALTHCARE', subIndustry: 'CLINIC' },
  { key: 'HEALTHCARE_SERVICES', label: 'Salud y servicios médicos', industry: 'HEALTHCARE', subIndustry: 'HEALTHCARE_SERVICES' },
  { key: 'TEXTILE', label: 'Textil y confección', industry: 'MANUFACTURING', subIndustry: 'TEXTILE' },
  { key: 'METALLURGY', label: 'Metalurgia y metalmecánica', industry: 'MANUFACTURING', subIndustry: 'METALLURGY' },
  { key: 'MANUFACTURING', label: 'Manufactura y producción', industry: 'MANUFACTURING', subIndustry: 'MANUFACTURING' },
  { key: 'WORKSHOP', label: 'Taller y servicios técnicos', industry: 'SERVICES', subIndustry: 'WORKSHOP' },
  { key: 'PROFESSIONAL_SERVICES', label: 'Servicios profesionales', industry: 'SERVICES', subIndustry: 'PROFESSIONAL_SERVICES' },
  { key: 'CONSTRUCTION', label: 'Construcción y contratistas', industry: 'CONSTRUCTION', subIndustry: 'CONSTRUCTION' },
  { key: 'ARCHITECTURE', label: 'Arquitectura y diseño', industry: 'ARCHITECTURE', subIndustry: 'ARCHITECTURE' },
  { key: 'RESTAURANT', label: 'Restaurante y alimentos', industry: 'RESTAURANT', subIndustry: 'RESTAURANT' },
  { key: 'EDUCATION', label: 'Educación y capacitación', industry: 'EDUCATION', subIndustry: 'EDUCATION' },
  { key: 'LOGISTICS', label: 'Transporte y logística', industry: 'SERVICES', subIndustry: 'LOGISTICS' },
  { key: 'AGRICULTURE', label: 'Agropecuario y agroindustria', industry: 'MANUFACTURING', subIndustry: 'AGRICULTURE' },
  { key: 'OTHER', label: 'Otro giro de negocio', industry: 'OTHER', subIndustry: 'OTHER' },
];

export function getBusinessTypeOption(key?: string, industry?: string, subIndustry?: string) {
  if (key) {
    const byKey = BUSINESS_TYPE_OPTIONS.find((option) => option.key === key);
    if (byKey) return byKey;
  }
  const normalizedIndustry = industry === 'PHARMACY' || industry === 'CLINIC' ? 'HEALTHCARE' : industry;
  const normalizedSubIndustry = subIndustry || (industry === 'PHARMACY' ? 'PHARMACY' : industry === 'CLINIC' ? 'CLINIC' : undefined);
  if (!normalizedSubIndustry) {
    const broadKey: Record<string, string> = {
      HEALTHCARE: 'HEALTHCARE_SERVICES',
      MANUFACTURING: 'MANUFACTURING',
      SERVICES: 'PROFESSIONAL_SERVICES',
    };
    const broad = BUSINESS_TYPE_OPTIONS.find((option) => option.key === broadKey[normalizedIndustry || '']);
    if (broad) return broad;
  }
  return BUSINESS_TYPE_OPTIONS.find(
    (option) => option.industry === normalizedIndustry && option.subIndustry === normalizedSubIndustry,
  )
    || BUSINESS_TYPE_OPTIONS.find((option) => option.industry === normalizedIndustry)
    || BUSINESS_TYPE_OPTIONS[BUSINESS_TYPE_OPTIONS.length - 1];
}

export function getBusinessTypeLabel(industry?: string, subIndustry?: string) {
  return getBusinessTypeOption(undefined, industry, subIndustry).label;
}
