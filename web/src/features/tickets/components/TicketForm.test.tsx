import { ApiError } from '@/api/client';
import type { Category } from '@/api/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketForm } from './TicketForm';

const CATEGORIES: Category[] = [
  { id: 'c1', name: 'Access', used: false },
  { id: 'c2', name: 'Hardware', used: true },
];

const onSubmit = vi.fn();

function renderForm(initial?: {
  title: string;
  description: string;
  categoryId: string;
}) {
  return render(
    <TicketForm
      categories={CATEGORIES}
      initial={initial}
      onSubmit={onSubmit}
      onCancel={() => {}}
    />,
  );
}

function fill(values: {
  title?: string;
  description?: string;
  categoryId?: string;
}) {
  if (values.title !== undefined) {
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: values.title },
    });
  }
  if (values.description !== undefined) {
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: values.description },
    });
  }
  if (values.categoryId !== undefined) {
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: values.categoryId },
    });
  }
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /open ticket|save/i }));
}

describe('TicketForm', () => {
  beforeEach(() => {
    onSubmit.mockReset().mockResolvedValue(undefined);
  });

  it('blocks an empty submission and says which fields are missing', async () => {
    renderForm();

    submit();

    expect(await screen.findByText('Give the ticket a title')).toBeDefined();
    expect(screen.getByText('Describe the problem')).toBeDefined();
    expect(screen.getByText('The ticket needs a category')).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks a title over the limit before it reaches the API', async () => {
    renderForm();

    fill({ title: 'x'.repeat(121), description: 'ok', categoryId: 'c1' });
    submit();

    expect(
      await screen.findByText('Keep the title under 120 characters'),
    ).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the values as typed, trimmed', async () => {
    renderForm();

    fill({
      title: '  Printer jammed  ',
      description: 'On floor 3',
      categoryId: 'c1',
    });
    submit();

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Printer jammed',
        description: 'On floor 3',
        categoryId: 'c1',
      }),
    );
  });

  it('offers every category, used ones included', () => {
    // A locked category cannot be renamed, but it can still be chosen:
    // the lock protects the audit history, not the requester's options.
    renderForm();

    const options = screen
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toContain('Access');
    expect(options).toContain('Hardware');
  });

  it('shows what the API said when the submission is rejected', async () => {
    onSubmit.mockRejectedValue(
      new ApiError(400, 'This category does not exist'),
    );
    renderForm();

    fill({
      title: 'Printer jammed',
      description: 'On floor 3',
      categoryId: 'c1',
    });
    submit();

    expect(
      await screen.findByText('This category does not exist'),
    ).toBeDefined();
  });

  it('starts from the ticket being edited', () => {
    renderForm({
      title: 'Printer jammed',
      description: 'On floor 3',
      categoryId: 'c2',
    });

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe(
      'Printer jammed',
    );
    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe(
      'c2',
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined();
  });
});
