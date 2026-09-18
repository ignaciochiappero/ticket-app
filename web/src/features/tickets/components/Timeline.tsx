import type { Category, FieldChange, HistoryEvent } from '@/api/types';
import { formatDateTime, timeAgo } from '@/helpers/datetime';

interface Props {
  history: HistoryEvent[];
  /** To show "Hardware → Access" where the history stores two ids. */
  categories: Category[];
  /** Injectable for tests; the clock otherwise. */
  now?: Date;
}

// What each event reads as, after the person's name.
const VERB: Record<HistoryEvent['type'], string> = {
  created: 'opened the ticket',
  edited: 'edited the ticket',
  deleted: 'deleted the ticket',
  taken: 'took the ticket',
  released: 'released it back to the queue',
  resolved: 'resolved it',
  commented: 'commented',
};

const FIELD_LABEL: Record<FieldChange['field'], string> = {
  title: 'Title',
  description: 'Description',
  categoryId: 'Category',
};

/** The audit trail as people read it: who did what, when, and what changed. */
export function Timeline({ history, categories, now }: Props) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-ink-dim">
        Nothing has happened to this ticket yet.
      </p>
    );
  }

  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? id;

  return (
    <ol className="space-y-4">
      {history.map((event, index) => (
        <li key={index} className="flex gap-3 text-sm">
          {/* The rail: a dot per event, joined by the list's own spacing. */}
          <span
            aria-hidden="true"
            className="mt-1.5 size-2 shrink-0 rounded-full bg-tile"
          />
          <div className="min-w-0 flex-1">
            <p>
              <span className="font-medium text-ink">{event.actor.name}</span>{' '}
              <span className="text-ink-muted">{VERB[event.type]}</span>{' '}
              <time
                dateTime={event.at}
                title={formatDateTime(event.at)}
                className="text-ink-dim"
              >
                {timeAgo(event.at, now)}
              </time>
            </p>

            {/* A definition list, not a nested list: each change is a
                field and what happened to it, and the timeline's own items
                stay the only list items on the page. */}
            {event.changes && (
              <dl className="mt-2 space-y-1 text-ink-muted">
                {event.changes.map((change) => (
                  <div key={change.field} className="flex gap-1">
                    <dt className="text-ink-dim">
                      {FIELD_LABEL[change.field]}:
                    </dt>
                    <dd>
                      <Change change={change} resolve={categoryName} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {event.body !== undefined && (
              <p className="mt-2 rounded-tile bg-raised px-3 py-2 whitespace-pre-wrap text-ink">
                {event.body}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Change({
  change,
  resolve,
}: {
  change: FieldChange;
  resolve: (id: string) => string;
}) {
  const [from, to] =
    change.field === 'categoryId'
      ? [resolve(change.from), resolve(change.to)]
      : [change.from, change.to];
  return (
    <>
      <span className="line-through decoration-ink-dim">{from}</span>
      {' → '}
      <span className="text-ink">{to}</span>
    </>
  );
}
