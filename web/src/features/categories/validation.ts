import { z } from 'zod';

// Mirrors SaveCategoryDto in the API, limits included. The API trims and
// rejects too, so this only saves a round trip and gives a message sooner.
export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Ingresá un nombre')
    .max(50, 'El nombre no puede pasar de 50 caracteres'),
});

export type CategoryValues = z.infer<typeof categorySchema>;
