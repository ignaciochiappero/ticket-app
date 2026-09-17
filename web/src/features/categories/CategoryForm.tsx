import { ApiError } from '@/api/client';
import type { Category } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { categorySchema, type CategoryValues } from './validation';

interface Props {
  /** The category being renamed, or null when creating a new one. */
  editing: Category | null;
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * One form for both jobs. Creating and renaming validate the same way and fail
 * the same way, so a second form would only be two places to keep in step.
 */
export function CategoryForm({ editing, onSave, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '' },
  });

  // Switching rows refills the field, so the form always shows what it will save.
  useEffect(() => {
    reset({ name: editing?.name ?? '' });
  }, [editing, reset]);

  const onSubmit = handleSubmit(async ({ name }) => {
    try {
      await onSave(name);
      reset({ name: '' });
    } catch (error) {
      // The API owns the rules this cannot know: a duplicate name, or a
      // category a ticket used between loading the page and pressing save.
      setError('root.server', {
        message:
          error instanceof ApiError
            ? error.message
            : 'Something went wrong. Try again.',
      });
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-panel bg-surface p-6"
    >
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-2">
          <Label htmlFor="category-name">Category name</Label>
          <Input
            id="category-name"
            aria-invalid={Boolean(errors.name)}
            placeholder="Printers"
            {...register('name')}
          />
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {editing ? 'Save' : 'Add category'}
        </Button>
        {editing && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
      {errors.name && (
        <p className="mt-3 text-sm text-destructive">{errors.name.message}</p>
      )}
      {errors.root?.server && (
        <p
          role="alert"
          className="mt-3 rounded-tile bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errors.root.server.message}
        </p>
      )}
    </form>
  );
}
