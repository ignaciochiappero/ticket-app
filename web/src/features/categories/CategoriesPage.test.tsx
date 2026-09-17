import { ApiError } from '@/api/client';
import type { Category, Page } from '@/api/types';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoriesPage } from './CategoriesPage';

const { listCategories, createCategory, renameCategory, deleteCategory } =
  vi.hoisted(() => ({
    listCategories: vi.fn(),
    createCategory: vi.fn(),
    renameCategory: vi.fn(),
    deleteCategory: vi.fn(),
  }));

vi.mock('./api', () => ({
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory,
}));

function page(items: Category[]): Page<Category> {
  return { items, total: items.length, page: 1, limit: 20 };
}

const STARTERS: Category[] = [
  { id: '1', name: 'Access', used: false },
  { id: '2', name: 'Hardware', used: true },
];

function nameField() {
  return screen.getByLabelText('Category name');
}

function rowFor(name: string) {
  return screen.getByRole('row', { name: new RegExp(name) });
}

describe('CategoriesPage', () => {
  beforeEach(() => {
    listCategories.mockReset().mockResolvedValue(page(STARTERS));
    createCategory.mockReset().mockResolvedValue(undefined);
    renameCategory.mockReset().mockResolvedValue(undefined);
    deleteCategory.mockReset().mockResolvedValue(undefined);
  });

  it('lists the categories and marks the ones a ticket has used', async () => {
    render(<CategoriesPage />);

    expect(await screen.findByText('Access')).toBeDefined();
    expect(screen.getByText('Hardware')).toBeDefined();
    // The lock is the reason a row cannot be touched, so the row has to say so.
    expect(rowFor('Hardware').textContent).toContain('In use');
    expect(rowFor('Access').textContent).not.toContain('In use');
  });

  it('blocks rename and delete on a category a ticket has used', async () => {
    render(<CategoriesPage />);
    await screen.findByText('Hardware');

    const locked = within(rowFor('Hardware'));
    for (const action of ['Rename', 'Delete']) {
      expect(
        locked.getByRole('button', { name: action }).hasAttribute('disabled'),
      ).toBe(true);
    }

    // The unused one stays editable.
    const open = within(rowFor('Access'));
    expect(
      open.getByRole('button', { name: 'Rename' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('asks for a name before calling the API', async () => {
    render(<CategoriesPage />);
    await screen.findByText('Access');

    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByText('Enter a name')).toBeDefined();
    expect(createCategory).not.toHaveBeenCalled();
  });

  it('creates a category and reloads the list', async () => {
    render(<CategoriesPage />);
    await screen.findByText('Access');

    fireEvent.change(nameField(), { target: { value: '  Printers  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));

    await vi.waitFor(() =>
      expect(createCategory).toHaveBeenCalledWith('Printers'),
    );
    expect(listCategories).toHaveBeenCalledTimes(2);
  });

  it('shows what the API said when the name already exists', async () => {
    createCategory.mockRejectedValue(
      new ApiError(409, 'A category with this name already exists'),
    );
    render(<CategoriesPage />);
    await screen.findByText('Access');

    fireEvent.change(nameField(), { target: { value: 'Hardware' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));

    expect(
      await screen.findByText('A category with this name already exists'),
    ).toBeDefined();
  });

  it('renames a category from its row', async () => {
    render(<CategoriesPage />);
    await screen.findByText('Access');

    fireEvent.click(
      within(rowFor('Access')).getByRole('button', { name: 'Rename' }),
    );
    // The form switches to editing that row, prefilled: no second form to keep in step.
    expect((nameField() as HTMLInputElement).value).toBe('Access');

    fireEvent.change(nameField(), { target: { value: 'Accounts' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() =>
      expect(renameCategory).toHaveBeenCalledWith('1', 'Accounts'),
    );
  });

  it('deletes a category only after the click is confirmed', async () => {
    render(<CategoriesPage />);
    await screen.findByText('Access');

    const row = within(rowFor('Access'));
    fireEvent.click(row.getByRole('button', { name: 'Delete' }));

    expect(deleteCategory).not.toHaveBeenCalled();
    fireEvent.click(row.getByRole('button', { name: 'Confirm delete' }));

    await vi.waitFor(() => expect(deleteCategory).toHaveBeenCalledWith('1'));
  });
});
