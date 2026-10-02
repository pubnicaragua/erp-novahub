import { IntlPackageModal, type IntlPackageModalProps } from './IntlPackageModal';

export type NewIntlPackageModalProps = IntlPackageModalProps;

export function NewIntlPackageModal(props: NewIntlPackageModalProps) {
  return <IntlPackageModal {...props} />;
}
