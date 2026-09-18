import type { User } from '@/api/types';
import { icon } from '@/components/icons';
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
import { useEffect, useState } from 'react';

export interface BoardFilterValues {
  q: string;
  requester: string;
  assignee: string;
  order: string;
}

interface Props {
  /** What the board is showing right now, read from the URL. */
  applied: BoardFilterValues;
  /** Everyone who can appear in a dropdown. Empty for a requester. */
  people: User[];
  /** A requester only ever sees their own tickets, so the who filters are an agent's. */
  showPeople: boolean;
  onApply: (values: BoardFilterValues) => void;
  onClear: () => void;
}

const EMPTY: BoardFilterValues = {
  q: '',
  requester: '',
  assignee: '',
  order: '',
};

/**
 * The filters, as a form. Nothing is queried while somebody is typing or
 * picking: Apply is what asks, because filtering is the API's job and a
 * request per keystroke would not survive a real board.
 *
 * What is on screen is draft state; what the board is showing lives in the
 * URL. They only meet on Apply, which is why a filtered board is a link.
 */
export function BoardFilters({
  applied,
  people,
  showPeople,
  onApply,
  onClear,
}: Props) {
  const [draft, setDraft] = useState(applied);

  // The URL can change without this form: the back button, or a link somebody
  // sent. The draft follows it so the controls never contradict the board.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setDraft(applied);
  }, [applied]);

  const set = (field: keyof BoardFilterValues) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const dirty = Object.values(applied).some(Boolean);
  const requesters = people.filter((person) => person.role === 'requester');
  const agents = people.filter((person) => person.role === 'agent');

  return (
    <form
      role="search"
      className="flex flex-wrap items-end gap-3 rounded-panel bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft);
      }}
    >
      <Field id="filter-q" label="Buscar">
        <Input
          id="filter-q"
          type="search"
          placeholder="Código o título"
          className="w-52"
          value={draft.q}
          onChange={(event) => set('q')(event.target.value)}
        />
      </Field>

      {showPeople && (
        <>
          <Field id="filter-requester" label="Abierto por">
            <Picker
              id="filter-requester"
              value={draft.requester}
              onChange={set('requester')}
              anyLabel="Cualquiera"
              options={requesters.map((person) => ({
                value: person.id,
                label: person.name,
              }))}
            />
          </Field>

          <Field id="filter-assignee" label="Agente">
            <Picker
              id="filter-assignee"
              value={draft.assignee}
              onChange={set('assignee')}
              anyLabel="Cualquiera"
              options={[
                // The question an agent actually asks: what has nobody taken?
                { value: 'unassigned', label: 'Sin asignar' },
                ...agents.map((person) => ({
                  value: person.id,
                  label: person.name,
                })),
              ]}
            />
          </Field>
        </>
      )}

      <Field id="filter-order" label="Apertura">
        <Picker
          id="filter-order"
          value={draft.order}
          onChange={set('order')}
          anyLabel="Más nuevos primero"
          options={[{ value: 'asc', label: 'Más viejos primero' }]}
        />
      </Field>

      <div className="flex items-center gap-2">
        <Button type="submit">
          <icon.filter aria-hidden="true" />
          Aplicar
        </Button>
        {dirty && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraft(EMPTY);
              onClear();
            }}
          >
            <icon.close aria-hidden="true" />
            Limpiar
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * A dropdown drawn by the app rather than by the browser. A native `select` is
 * styleable only while it is closed: the list it opens is operating system
 * chrome, so it arrives white and blue in the middle of a dark board.
 *
 * Radix has no value for "no filter" — an empty string is not a selectable
 * item — so the cleared state is modelled as the placeholder, and choosing the
 * reset entry sends an empty value back up.
 */
const NO_FILTER = '__any';

function Picker({
  id,
  value,
  onChange,
  anyLabel,
  options,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  anyLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select
      value={value || NO_FILTER}
      onValueChange={(next) => onChange(next === NO_FILTER ? '' : next)}
    >
      <SelectTrigger id={id} className="w-44">
        <SelectValue placeholder={anyLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_FILTER}>{anyLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    // The gap is a margin on the label, not `space-y` on the wrapper. Radix
    // renders a hidden native select beside its trigger, so a rule that spaces
    // "every child after the first" spaces that one too and leaves six phantom
    // pixels under the dropdown, which is enough to break a row's alignment.
    <div className="flex flex-col">
      <Label htmlFor={id} className="mb-1.5 text-xs text-ink-muted">
        {label}
      </Label>
      {children}
    </div>
  );
}
