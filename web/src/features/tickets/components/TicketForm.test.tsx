import { ApiError } from '@/api/client';
import type { Category } from '@/api/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

async function fill(values: {
  title?: string;
  description?: string;
  categoryId?: string;
}) {
  if (values.title !== undefined) {
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: values.title },
    });
  }
  if (values.description !== undefined) {
    fireEvent.change(screen.getByLabelText('Descripción'), {
      target: { value: values.description },
    });
  }
  if (values.categoryId !== undefined) {
    await pickCategory(values.categoryId);
  }
}

/** The category trigger, which shows the chosen name rather than its id. */
function categoryField(): HTMLElement {
  return screen.getByLabelText('Categoría');
}

/**
 * The category is a dropdown the app draws, not a native select, so it is
 * driven the way a person drives it: open it, then choose the option by the
 * name on screen rather than by the id underneath. `userEvent` is required
 * here because it sends a whole pointer sequence; a single synthetic event
 * never opens it.
 */
async function pickCategory(id: string) {
  const name = CATEGORIES.find((category) => category.id === id)?.name;
  if (!name) {
    throw new Error(`the test has no category with id ${id}`);
  }
  await userEvent.click(categoryField());
  await userEvent.click(await screen.findByRole('option', { name }));
}

function submit() {
  fireEvent.click(
    screen.getByRole('button', { name: /abrir ticket|guardar/i }),
  );
}

describe('TicketForm', () => {
  beforeEach(() => {
    onSubmit.mockReset().mockResolvedValue(undefined);
  });

  it('blocks an empty submission and says which fields are missing', async () => {
    renderForm();

    submit();

    expect(await screen.findByText('Ponele un título al ticket')).toBeDefined();
    expect(screen.getByText('Describí el problema')).toBeDefined();
    expect(screen.getByText('El ticket necesita una categoría')).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks a title over the limit before it reaches the API', async () => {
    renderForm();

    await fill({ title: 'x'.repeat(121), description: 'ok', categoryId: 'c1' });
    submit();

    expect(
      await screen.findByText('El título no puede pasar de 120 caracteres'),
    ).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the values as typed, trimmed', async () => {
    renderForm();

    await fill({
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

  it('offers every category, used ones included', async () => {
    // A locked category cannot be renamed, but it can still be chosen:
    // the lock protects the audit history, not the requester's options.
    renderForm();

    await userEvent.click(categoryField());

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

    await fill({
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

    expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe(
      'Printer jammed',
    );
    // The trigger shows the name, which is the point of resolving the id: an
    // editor sees "Hardware", not "c2".
    expect(categoryField().textContent).toContain('Hardware');
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDefined();
  });
});
