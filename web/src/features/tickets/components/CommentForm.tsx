import { ApiError } from '@/api/client';
import { icon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

interface Props {
  onSubmit: (body: string) => Promise<void>;
}

/**
 * Adding to the record. A comment cannot be edited or taken back, because the
 * history is append-only, so the button says what it does rather than "Save".
 */
export function CommentForm({ onSubmit }: Props) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) {
      return;
    }
    setSending(true);
    setError(null);
    try {
      await onSubmit(body.trim());
      setBody('');
    } catch (caught) {
      // The API owns what this form cannot know: the ticket was resolved a
      // moment ago, or it stopped being yours.
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'The comment could not be added. Try again.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="comment-body" className="sr-only">
        Comment
      </label>
      <Textarea
        id="comment-body"
        rows={3}
        placeholder="Add something to the record: what you tried, what changed."
        value={body}
        onChange={(event) => setBody(event.target.value)}
        aria-invalid={Boolean(error)}
      />
      {error && (
        <p
          role="alert"
          className="rounded-tile bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="sm" disabled={sending || !body.trim()}>
        <icon.comment aria-hidden="true" />
        Comment
      </Button>
    </form>
  );
}
