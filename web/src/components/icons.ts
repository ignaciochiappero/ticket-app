import {
  ChevronDown,
  SlidersHorizontal,
  ArrowLeft,
  Check,
  Clock,
  FolderCog,
  GripVertical,
  Hand,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Tag,
  Ticket,
  Trash2,
  Undo2,
  User,
  X,
} from 'lucide-react';

/**
 * Every icon the app uses, named for what it means rather than what it draws.
 * One place to look, one place to swap: renaming `icon.resolve` from a check
 * to something else touches this file and nothing else, and a screen never
 * imports from `lucide-react` directly.
 *
 * Used as a component through the member expression: `<icon.back />`. JSX
 * treats a dotted name as a component whatever its case.
 */
export const icon = {
  // Navigation and chrome
  back: ArrowLeft,
  refresh: RefreshCw,
  signOut: LogOut,
  close: X,
  tickets: Ticket,
  categories: FolderCog,

  // Ticket actions
  add: Plus,
  edit: Pencil,
  delete: Trash2,
  take: Hand,
  release: Undo2,
  resolve: Check,
  drag: GripVertical,
  more: ChevronDown,
  filter: SlidersHorizontal,

  // Ticket facts
  person: User,
  category: Tag,
  age: Clock,
} as const;

export type IconName = keyof typeof icon;
