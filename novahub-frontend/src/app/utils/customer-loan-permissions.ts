export function getCustomerLoanMoraActions(canCreate: boolean, canEdit: boolean) {
  return {
    canOpenCatalog: canCreate || canEdit,
    canCreateType: canCreate,
    canEditTypes: canEdit,
  };
}
