import { getPasswordError } from '../../utils/accountValidation.ts';

/** Create requires a password; edit permits leaving it unchanged. */
export function getSupportAgentPasswordError(value: unknown, editing: boolean) {
  return getPasswordError(value, !editing);
}
