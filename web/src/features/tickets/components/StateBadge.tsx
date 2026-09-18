import type { TicketState } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATE_NAME } from '../states';

// One tint per state, low alpha so it reads on both themes. Open takes the
// accent: it is the state that asks somebody to do something.
const STATE_CLASS: Record<TicketState, string> = {
  open: 'bg-accent-500/15 text-accent-300',
  in_progress: 'bg-sky-500/15 text-sky-300',
  resolved: 'bg-emerald-500/15 text-emerald-300',
};

export function StateBadge({ state }: { state: TicketState }) {
  return (
    <Badge variant="secondary" className={cn('border-0', STATE_CLASS[state])}>
      {STATE_NAME[state]}
    </Badge>
  );
}
