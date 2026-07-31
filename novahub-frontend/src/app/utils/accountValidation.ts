export const PASSWORD_POLICY = {
  minLength: 8,
  requiresUppercase: true,
  requiresNumber: true,
  requiresSpecial: true,
} as const;

export const passwordRules = [
  { label: 'Mínimo 8 caracteres', test: (value: string) => value.length >= PASSWORD_POLICY.minLength },
  { label: '1 mayúscula', test: (value: string) => /[A-Z]/.test(value) },
  { label: '1 número', test: (value: string) => /[0-9]/.test(value) },
  { label: '1 carácter especial', test: (value: string) => /[^a-zA-Z0-9\s]/.test(value) },
];

export function getPasswordError(value: string, required = true): string | null {
  if (!value) return required ? 'La contraseña es obligatoria' : null;
  const failed = passwordRules.find(rule => !rule.test(value));
  return failed ? `La contraseña debe incluir: ${failed.label.toLowerCase()}` : null;
}

export function isValidPassword(value: string, required = true) {
  return getPasswordError(value, required) === null;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}
