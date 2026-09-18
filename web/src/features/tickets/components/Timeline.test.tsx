import type { Category, HistoryEvent } from '@/api/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Timeline } from './Timeline';

const CATEGORIES: Category[] = [
  { id: 'c1', name: 'Hardware', used: true },
  { id: 'c2', name: 'Access', used: true },
];

const NOW = new Date('2026-09-17T15:00:00.000Z');
const LUCIA = { id: 'requester-1', name: 'Lucía Fernández' };
const CARLA = { id: 'agent-1', name: 'Carla Ruiz' };

const HISTORY: HistoryEvent[] = [
  { type: 'created', actor: LUCIA, at: '2026-09-15T15:00:00.000Z' },
  {
    type: 'edited',
    actor: LUCIA,
    at: '2026-09-16T15:00:00.000Z',
    changes: [
      {
        field: 'title',
        from: 'Printer jammed',
        to: 'Printer on floor 3 jammed',
      },
      { field: 'categoryId', from: 'c1', to: 'c2' },
    ],
  },
  { type: 'taken', actor: CARLA, at: '2026-09-17T12:00:00.000Z' },
  {
    type: 'commented',
    actor: CARLA,
    at: '2026-09-17T13:00:00.000Z',
    body: 'Ordered a replacement drum.',
  },
  { type: 'resolved', actor: CARLA, at: '2026-09-17T14:00:00.000Z' },
];

function renderTimeline(history = HISTORY) {
  return render(
    <Timeline history={history} categories={CATEGORIES} now={NOW} />,
  );
}

describe('Timeline', () => {
  it('lists every event in order, saying who did what', () => {
    renderTimeline();

    const items = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(items).toHaveLength(5);
    // Oldest first, as it happened; each entry names the person, not an id.
    expect(items[0]).toMatch(/Lucía Fernández.*opened/);
    expect(items[2]).toMatch(/Carla Ruiz.*took/);
    expect(items[4]).toMatch(/Carla Ruiz.*resolved/);
    expect(screen.queryByText(/agent-1|requester-1/)).toBe(null);
  });

  it('shows what an edit changed, with category names instead of ids', () => {
    renderTimeline();

    const edit = screen.getAllByRole('listitem')[1].textContent ?? '';
    expect(edit).toContain('Printer jammed');
    expect(edit).toContain('Printer on floor 3 jammed');
    // The history stores ids; the reader gets names.
    expect(edit).toContain('Hardware');
    expect(edit).toContain('Access');
    expect(edit).not.toContain('c1');
  });

  it("shows a comment's text", () => {
    renderTimeline();

    expect(screen.getByText('Ordered a replacement drum.')).toBeDefined();
  });

  it('gives each event a relative time and the exact instant on hover', () => {
    renderTimeline();

    const first = screen.getAllByRole('listitem')[0];
    expect(first.textContent).toContain('2 days ago');
    // The exact time lives in a title, so hovering answers "when, precisely?".
    expect(first.querySelector('time')?.getAttribute('title')).toMatch(/2026/);
  });

  it('says so when there is nothing yet', () => {
    renderTimeline([]);

    expect(screen.getByText(/nothing has happened/i)).toBeDefined();
  });
});
