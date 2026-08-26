export type SalesExtraChargeLine = {
  id: string;
  description: string;
  amount: number;
};

export const normalizeSalesExtraCharges = (doc: any): SalesExtraChargeLine[] => {
  if (Array.isArray(doc?.extraCharges) && doc.extraCharges.length > 0) {
    return doc.extraCharges.map((charge: any, index: number) => ({
      id: String(charge?.id || `extra-${index}`),
      description: String(charge?.description || ''),
      amount: Math.max(0, Number(charge?.amount || 0)),
    }));
  }

  const amount = Math.max(0, Number(doc?.extraCostAmount || 0));
  const description = String(doc?.extraCostDescription || '').trim();
  return amount > 0 || description
    ? [{ id: 'legacy-extra-0', description, amount }]
    : [];
};

export const getSalesExtraChargesPayload = (doc: any): Array<{ description: string; amount: number }> => (
  normalizeSalesExtraCharges(doc)
    .map(({ description, amount }) => ({
      description: description.trim(),
      amount: Math.max(0, Number(amount || 0)),
    }))
    .filter((charge) => charge.amount > 0 || charge.description)
);

export const getSalesExtraChargesAmount = (doc: any): number => (
  getSalesExtraChargesPayload(doc).reduce((sum, charge) => sum + Number(charge.amount || 0), 0)
);

export const getSalesAdditionalCharges = (doc: any): SalesExtraChargeLine[] => {
  const charges = normalizeSalesExtraCharges(doc)
    .filter((charge) => charge.amount > 0)
    .map((charge, index) => ({
      ...charge,
      description: charge.description || `Coste extra ${index + 1}`,
    }));
  const deliveryAmount = Math.max(0, Number(doc?.deliveryAmount || 0));
  if (deliveryAmount > 0) {
    charges.push({
      id: 'delivery',
      description: String(doc?.deliveryDescription || '').trim() || 'Delivery',
      amount: deliveryAmount,
    });
  }
  return charges;
};

export const getLegacySalesExtraCostFields = (charges: Array<{ description: string; amount: number }>) => ({
  extraCostDescription: charges.length === 1
    ? charges[0].description || null
    : charges.length > 1 ? 'Varios costes extra' : null,
  extraCostAmount: charges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0),
});
