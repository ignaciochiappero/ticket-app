import { ApiError } from '@/api/client';
import type { Category, TicketInput } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ticketSchema, type TicketValues } from '../validation';

interface Props {
  categories: Category[];
  /** The ticket being edited, or nothing when opening a new one. */
  initial?: TicketInput;
  onSubmit: (values: TicketInput) => Promise<void>;
  onCancel: () => void;
}

/**
 * Opening and editing a ticket are the same three fields with the same limits,
 * so they are one form. A native select rather than the Radix one: it is
 * accessible by default, a label finds it, and a test can drive it with a
 * plain change event.
 */
export function TicketForm({ categories, initial, onSubmit, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TicketValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: initial ?? { title: '', description: '', categoryId: '' },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      // The API owns the rules this form cannot know: a category deleted a
      // moment ago, or a ticket that stopped being editable meanwhile.
      setError('root.server', {
        message:
          error instanceof ApiError
            ? error.message
            : 'Something went wrong. Try again.',
      });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="ticket-title">Title</Label>
        <Input
          id="ticket-title"
          placeholder="Printer on floor 3 is jammed"
          aria-invalid={Boolean(errors.title)}
          {...register('title')}
        />
        <FieldError message={errors.title?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticket-description">Description</Label>
        <Textarea
          id="ticket-description"
          rows={5}
          placeholder="What happens, since when, and what you already tried."
          aria-invalid={Boolean(errors.description)}
          {...register('description')}
        />
        <FieldError message={errors.description?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticket-category">Category</Label>
        <NativeSelect
          id="ticket-category"
          className="w-full"
          aria-invalid={Boolean(errors.categoryId)}
          {...register('categoryId')}
        >
          <NativeSelectOption value="">Select a category</NativeSelectOption>
          {categories.map((category) => (
            <NativeSelectOption key={category.id} value={category.id}>
              {category.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError message={errors.categoryId?.message} />
      </div>

      {errors.root?.server && (
        <p
          role="alert"
          className="rounded-tile bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errors.root.server.message}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {initial ? 'Save' : 'Open ticket'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}
