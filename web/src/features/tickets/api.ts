import { apiFetch } from '@/api/client';
import type { Page, Ticket, TicketInput, TicketSummary } from '@/api/types';

export function listTickets(query = ''): Promise<Page<TicketSummary>> {
  return apiFetch(`/tickets${query}`);
}

export function getTicket(id: string): Promise<Ticket> {
  return apiFetch(`/tickets/${id}`);
}

export function createTicket(input: TicketInput): Promise<Ticket> {
  return apiFetch('/tickets', { method: 'POST', body: JSON.stringify(input) });
}

export function updateTicket(
  id: string,
  input: Partial<TicketInput>,
): Promise<Ticket> {
  return apiFetch(`/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTicket(id: string): Promise<void> {
  return apiFetch(`/tickets/${id}`, { method: 'DELETE' });
}

// The three transitions share one shape: POST, no body, the ticket back.
function transition(action: 'take' | 'release' | 'resolve') {
  return (id: string): Promise<Ticket> =>
    apiFetch(`/tickets/${id}/${action}`, { method: 'POST' });
}

export const takeTicket = transition('take');
export const releaseTicket = transition('release');
export const resolveTicket = transition('resolve');
