import { IntlPackageModal } from './IntlPackageModal';
import { type IntlImportPackage } from '../../../services/intl-imports.service';

export interface EditIntlPackageModalProps {
  packageData: IntlImportPackage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updated: IntlImportPackage) => void;
}

export function EditIntlPackageModal({
  packageData,
  open,
  onOpenChange,
  onSuccess,
}: EditIntlPackageModalProps) {
  return (
    <IntlPackageModal
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      packageToEdit={packageData}
    />
  );
}
