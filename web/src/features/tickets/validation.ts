import { z } from 'zod';

// Mirrors CreateTicketDto in the API, limits included. Duplicated by hand on
// purpose (see the design's "Validation library per side"); the API is still
// the one that decides, this only answers sooner.
export const ticketSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give the ticket a title')
    .max(120, 'Keep the title under 120 characters'),
  description: z
    .string()
    .trim()
    .min(1, 'Describe the problem')
    .max(5000, 'Keep the description under 5000 characters'),
  categoryId: z.string().min(1, 'The ticket needs a category'),
});

export type TicketValues = z.infer<typeof ticketSchema>;
