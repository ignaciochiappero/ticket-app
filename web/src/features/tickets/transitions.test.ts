import type { TicketState, TicketSummary, User } from '@/api/types';
import { describe, expect, it } from 'vitest';
import { moveFor } from './transitions';

const CARLA: User = { id: 'agent-1', name: 'Carla Ruiz', role: 'agent' };
const DIEGO: User = { id: 'agent-2', name: 'Diego López', role: 'agent' };
const LUCIA: User = {
  id: 'requester-1',
  name: 'Lucía Fernández',
  role: 'requester',
};

function ticket(
  state: TicketState,
  assigneeId: string | null = null,
): TicketSummary {
  return {
    id: 't1',
    code: 'TCK-1',
    title: 'Printer jammed',
    categoryId: 'c1',
    state,
    requester: { id: 'requester-1', name: 'Lucía Fernández' },
    assignee: assigneeId ? { id: assigneeId, name: 'Someone' } : null,
    createdAt: '2026-09-15T15:00:00.000Z',
  };
}

describe('moveFor', () => {
  it('names the action a legal move stands for', () => {
    // The three moves the API allows, and what each one is really called.
    expect(moveFor(ticket('open'), 'in_progress', CARLA)).toBe('take');
    expect(moveFor(ticket('in_progress', CARLA.id), 'open', CARLA)).toBe(
      'release',
    );
    expect(moveFor(ticket('in_progress', CARLA.id), 'resolved', CARLA)).toBe(
      'resolve',
    );
  });

  it('refuses to skip a step', () => {
    // Resolving something nobody ever picked up would leave a ticket with no
    // assignee to answer for it.
    expect(moveFor(ticket('open'), 'resolved', CARLA)).toBe(null);
  });

  it('refuses to reopen a resolved ticket', () => {
    for (const target of ['open', 'in_progress'] as TicketState[]) {
      expect(moveFor(ticket('resolved', CARLA.id), target, CARLA)).toBe(null);
    }
  });

  it('lets only the assigned agent move a ticket that is in progress', () => {
    expect(moveFor(ticket('in_progress', CARLA.id), 'resolved', DIEGO)).toBe(
      null,
    );
    expect(moveFor(ticket('in_progress', CARLA.id), 'open', DIEGO)).toBe(null);
    // But an open ticket is anybody's to take.
    expect(moveFor(ticket('open'), 'in_progress', DIEGO)).toBe('take');
  });

  it('never lets a requester move anything', () => {
    expect(moveFor(ticket('open'), 'in_progress', LUCIA)).toBe(null);
    expect(moveFor(ticket('in_progress', CARLA.id), 'resolved', LUCIA)).toBe(
      null,
    );
  });

  it('treats a drop on the column it came from as nothing to do', () => {
    expect(moveFor(ticket('open'), 'open', CARLA)).toBe(null);
    expect(moveFor(ticket('in_progress', CARLA.id), 'in_progress', CARLA)).toBe(
      null,
    );
  });
});
