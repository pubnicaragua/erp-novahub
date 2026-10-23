import { enterpriseGroupsService } from '../services/enterprise-groups.service';
import { resolvePdfDesignAppearance } from '../services/pdf-appearance';
import { createSystemDefaultPdfDesign } from '../services/pdf-template-definition';

/** Loads only the group-owned render configuration. This path never consults branch PDF services. */
export async function resolveManagerPdfRender(groupId: string, targetKey: string) {
  const config = await enterpriseGroupsService.getManagerPdfRenderConfig(groupId, targetKey);
  const systemDesign = createSystemDefaultPdfDesign(targetKey);
  const activeDesign = config.design || null;
  const baseDesign = activeDesign || systemDesign;
  const baseSettings = (baseDesign?.settings && typeof baseDesign.settings === 'object' ? baseDesign.settings : {}) as Record<string, unknown>;
  const definition = (baseDesign?.layoutZones as any)?.definition || (systemDesign?.layoutZones as any)?.definition;
  const resolvedAppearance = resolvePdfDesignAppearance(baseSettings, definition, config.appearanceProfile || {});
  const identity = config.companyProfile || {};
  const curatedSelections = (config.appearanceProfile as any)?.curatedTemplates || {};
  const curatedSelection = curatedSelections.document?.[targetKey] || curatedSelections.branch?.[targetKey];
  const tenantName = String(identity.name || '');
  const tenantLogo = String(identity.logo || '') || null;
  const settings = {
    ...resolvedAppearance.settings,
    companyName: tenantName,
    slogan: String(identity.slogan || ''),
    fiscalInfo: String(identity.fiscalInfo || ''),
    address: String(identity.address || ''),
    phone: String(identity.phone || ''),
    email: String(identity.email || ''),
    website: String(identity.website || ''),
    logoUrl: tenantLogo || undefined,
    managerGroupId: groupId,
    ...(curatedSelection ? { curatedTemplateSelection: curatedSelection } : {}),
  };

  return {
    targetKey,
    tenantName,
    tenantLogo,
    appearanceProfile: config.appearanceProfile || {},
    activeDesign,
    design: {
      ...(systemDesign || {}),
      ...(activeDesign || {}),
      settings,
      layoutZones: activeDesign?.layoutZones || systemDesign?.layoutZones,
    },
  };
}
