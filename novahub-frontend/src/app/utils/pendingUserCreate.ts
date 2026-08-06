export const pendingUserCreate: {
  returnToUserModal?: boolean;
  returnToEmployeeId?: string;
  returnEmployee?: { name: string; email: string };
} = {};

export const clearPendingUserCreate = () => {
  delete pendingUserCreate.returnToUserModal;
  delete pendingUserCreate.returnToEmployeeId;
  delete pendingUserCreate.returnEmployee;
};