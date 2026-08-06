import { z } from 'zod';
import { PASSWORD_POLICY } from '../../utils/accountValidation';

/**
 * Schema Zod para el formulario de registro de tenant (free trial).
 *
 * Validaciones:
 *  - companyName: 2-100 chars, requerido
 *  - userName: 2-100 chars, requerido
 *  - email: email válido
 *  - password: mín. 8 chars, al menos una mayúscula, un número y un carácter especial
 *  - acceptTerms: debe ser true
 */
export const registerTenantSchema = z.object({
  companyName: z
    .string()
    .min(2, 'El nombre de la empresa debe tener al menos 2 caracteres')
    .max(100, 'El nombre de la empresa no puede superar los 100 caracteres')
    .trim(),
  userName: z
    .string()
    .min(2, 'Tu nombre debe tener al menos 2 caracteres')
    .max(100)
    .trim(),
  email: z
    .string()
    .email('Email inválido')
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(PASSWORD_POLICY.minLength, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'La contraseña debe incluir al menos una mayúscula')
    .regex(/[0-9]/, 'La contraseña debe incluir al menos un número')
    .regex(/[^a-zA-Z0-9\s]/, 'La contraseña debe incluir al menos un carácter especial'),
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, { message: 'Debés aceptar los términos' }),
});

export type RegisterTenantFormValues = z.infer<typeof registerTenantSchema>;
