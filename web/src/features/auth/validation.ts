import { z } from 'zod';

// Mirrors LoginDto in the API. The limits are duplicated by hand on purpose
// (see the design's "Validation library per side" decision); the API still
// rejects anything that gets past this.
export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Enter your username')
    .max(50, 'Username is too long'),
  password: z
    .string()
    .min(1, 'Enter your password')
    .max(100, 'Password is too long'),
});

export type LoginValues = z.infer<typeof loginSchema>;
