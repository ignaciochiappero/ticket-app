import type { Category } from '@/api/types';
import { icon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCallback, useEffect, useState } from 'react';
import {
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
} from './api';
import { CategoryForm } from './CategoryForm';

const LOCK_REASON =
  'A ticket has used this category, so it can no longer change';

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { items } = await listCategories();
      setCategories(items);
      setLoadError(null);
    } catch {
      setLoadError('No se pudieron cargar las categorías.');
    }
  }, []);

  // Fetching is exactly what an effect is for: synchronising with something
  // outside React. The lint rule below sees `void load()` and assumes a
  // synchronous setState, but load() awaits the request first, so the state
  // lands in a later microtask and nothing re-renders in cascade.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  const save = async (name: string) => {
    if (editing) {
      await renameCategory(editing.id, name);
      setEditing(null);
    } else {
      await createCategory(name);
    }
    await load();
  };

  const remove = async (id: string) => {
    setConfirming(null);
    await deleteCategory(id);
    await load();
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Categorías</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Los solicitantes eligen una de estas al abrir un ticket. Una categoría
          deja de ser editable cuando algún ticket la usó, así los nombres del
          historial siguen significando lo mismo que en ese momento.
        </p>
      </div>

      <CategoryForm
        editing={editing}
        onSave={save}
        onCancel={() => setEditing(null)}
      />

      <div className="rounded-panel bg-surface p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-56 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>
                  <span className="text-ink">{category.name}</span>
                  {category.used && (
                    <Badge variant="secondary" className="ml-3">
                      En uso
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={category.used}
                    title={category.used ? LOCK_REASON : undefined}
                    onClick={() => {
                      setConfirming(null);
                      setEditing(category);
                    }}
                  >
                    <icon.edit aria-hidden="true" />
                    Renombrar
                  </Button>
                  {confirming === category.id ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void remove(category.id)}
                    >
                      <icon.delete aria-hidden="true" />
                      Confirmar borrado
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={category.used}
                      title={category.used ? LOCK_REASON : undefined}
                      onClick={() => setConfirming(category.id)}
                    >
                      <icon.delete aria-hidden="true" />
                      Eliminar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {loadError && (
          <p role="alert" className="p-4 text-sm text-destructive">
            {loadError}
          </p>
        )}
      </div>
    </section>
  );
}
