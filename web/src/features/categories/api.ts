import { apiFetch } from '@/api/client';
import type { Category, Page } from '@/api/types';

// The back office shows every category at once, the way the ticket form's
// dropdown will: the product keeps them under a hundred, which is the API's
// maximum page size. Past that this needs a pager rather than a bigger limit.
export function listCategories(): Promise<Page<Category>> {
  return apiFetch('/categories?limit=100');
}

export function createCategory(name: string): Promise<Category> {
  return apiFetch('/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function renameCategory(id: string, name: string): Promise<Category> {
  return apiFetch(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function deleteCategory(id: string): Promise<void> {
  return apiFetch(`/categories/${id}`, { method: 'DELETE' });
}
