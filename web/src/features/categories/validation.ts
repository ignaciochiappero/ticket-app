import { z } from 'zod';

// Mirrors SaveCategoryDto in the API, limits included. The API trims and
// rejects too, so this only saves a round trip and gives a message sooner.
export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name')
    .max(50, 'Keep the name under 50 characters'),
});

export type CategoryValues = z.infer<typeof categorySchema>;
