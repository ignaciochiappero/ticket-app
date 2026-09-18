import { z } from 'zod';

// Mirrors CreateTicketDto in the API, limits included. Duplicated by hand on
// purpose (see the design's "Validation library per side"); the API is still
// the one that decides, this only answers sooner.
export const ticketSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Ponele un título al ticket')
    .max(120, 'El título no puede pasar de 120 caracteres'),
  description: z
    .string()
    .trim()
    .min(1, 'Describí el problema')
    .max(5000, 'La descripción no puede pasar de 5000 caracteres'),
  categoryId: z.string().min(1, 'El ticket necesita una categoría'),
});

export type TicketValues = z.infer<typeof ticketSchema>;
