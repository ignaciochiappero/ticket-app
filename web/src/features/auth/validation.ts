import { z } from 'zod';

// Mirrors LoginDto in the API. The limits are duplicated by hand on purpose
// (see the design's "Validation library per side" decision); the API still
// rejects anything that gets past this.
export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Ingresá tu usuario')
    .max(50, 'El usuario es demasiado largo'),
  password: z
    .string()
    .min(1, 'Ingresá tu contraseña')
    .max(100, 'La contraseña es demasiado larga'),
});

export type LoginValues = z.infer<typeof loginSchema>;
