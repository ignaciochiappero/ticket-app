import { ApiError } from '@/api/client';
import type { Category, TicketInput } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
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
    control,
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
            : 'Algo salió mal. Intentá de nuevo.',
      });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="ticket-title">Título</Label>
        <Input
          id="ticket-title"
          placeholder="La impresora del piso 3 se traba"
          aria-invalid={Boolean(errors.title)}
          {...register('title')}
        />
        <FieldError message={errors.title?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticket-description">Descripción</Label>
        <Textarea
          id="ticket-description"
          rows={5}
          placeholder="Qué pasa, desde cuándo, y qué probaste."
          aria-invalid={Boolean(errors.description)}
          {...register('description')}
        />
        <FieldError message={errors.description?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticket-category">Categoría</Label>
        {/*
          A Controller rather than `register`, because this is not a native
          input: Radix reports its value through a callback, so react-hook-form
          has to be handed it instead of reading it off the DOM. The dropdown
          is drawn by the app, which a native `select` cannot be — the list it
          opens is operating system chrome.
        */}
        <Controller
          name="categoryId"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id="ticket-category"
                className="w-full"
                aria-invalid={Boolean(errors.categoryId)}
              >
                <SelectValue placeholder="Elegí una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
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
          {initial ? 'Guardar' : 'Abrir ticket'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}
