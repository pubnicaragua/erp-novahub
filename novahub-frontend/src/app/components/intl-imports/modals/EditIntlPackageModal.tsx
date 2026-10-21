import { IntlPackageModal } from './IntlPackageModal';
import { type IntlImportPackage } from '../../../services/intl-imports.service';

export interface EditIntlPackageModalProps {
  packageData: IntlImportPackage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updated: IntlImportPackage) => void;
  canEdit?: boolean;
}

export function EditIntlPackageModal({
  packageData,
  open,
  onOpenChange,
  onSuccess,
  canEdit = false,
}: EditIntlPackageModalProps) {
  return (
    <IntlPackageModal
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      packageToEdit={packageData}
      canEdit={canEdit}
    />
  );
}
