---
name: ticket-app-web
description: How to add or change a screen in this repository's React app — folder layout, where state lives, forms, shadcn dropdowns, Spanish copy and the board's loading strategy. Use when touching anything under web/.
metadata:
  author: ticket-app
  scope: web/
---

Standards for this web app. Read
[`.agents/context/glossary.md`](../../context/glossary.md) before writing a
single string somebody will read.

## The interface is Spanish, the code is English

Identifiers, comments and file names in English; every rendered string in
Spanish. The glossary has the vocabulary and the two collisions already found
the hard way. Translate what is **rendered**, never a value that is
**compared** — a global replace once turned `type: 'commented'` into
`'comentó'` in a fixture.

## Where a feature goes

```
web/src/features/<feature>/
  <Feature>Page.tsx        the screen
  api.ts                   one typed function per endpoint
  validation.ts            the zod schema its forms use
  states.ts                its constants and labels
  transitions.ts           pure rules, if it has any
  components/              pieces only this feature uses
```

Add the route in `routes.tsx`. Anything two features share moves up to
`web/src/components/` or `web/src/helpers/`. Icons are declared **once** in
`web/src/components/icons.ts` and used as `<icon.refresh />` — never imported
from `lucide-react` in a screen.

## Where state lives

**Board state lives in the URL.** Filters, search, sorting: `useSearchParams`,
not `useState`. A filtered board is then a link somebody can send, and the
back button undoes a filter like any other navigation.

**The API does the filtering.** The web never narrows a list it already holds,
and never queries while somebody is typing — a form with an Apply button, not
a keystroke listener. On a board of thousands, a request per letter is not a
feature.

**Fetch state that loads together is one piece of state.** The board keeps
`{ active, resolved }` in a single object, so one null check narrows both. A
separate boolean next to two nullable values does not narrow anything, and
TypeScript will tell you so.

## Mirroring API rules

Where the interface decides what to offer, put the rule in a pure module and
test it without rendering — `features/tickets/transitions.ts` is the example.

The API still refuses independently. This only decides **what to offer**, so
nobody is handed a button that is going to fail.

## The board loads once per column

One paginated list cannot serve three columns: a page of twenty could be spent
entirely on `open` and leave "En curso" looking empty while tickets sit in it.
So the board asks per column, and the terminal column — the only one that
grows without bound — starts at ten and grows on demand.

"Ver más" **raises that column's limit** rather than stitching pages together:
one press is one request, and the expanded count survives the reload after a
drag. Cap it at the API's maximum; asking past it answers 400 and would blank
the board for somebody who only pressed a button.

**A truncated list says so.** "Se muestran 100 de 137 tickets activos" beats
silently dropping 37. A total nobody can reach is the same lie as a missing
row.

## Forms

`react-hook-form` with a zod schema in the feature's `validation.ts`, mirroring
the API's limits. The API still decides; this only answers sooner.

A native input uses `register`. **A Radix component needs a `Controller`**,
because it reports its value through a callback rather than on the DOM:

```tsx
<Controller
  name="categoryId"
  control={control}
  render={({ field }) => (
    <Select value={field.value} onValueChange={field.onChange}>
      ...
    </Select>
  )}
/>
```

Catch `ApiError` in the submit handler and show `error.message`: the API owns
the rules the form cannot know.

## Dropdowns: use the Select component, not a native one

A native `<select>` is styleable only while closed — the list it opens is
operating system chrome, and it arrives white and blue in the middle of a dark
board. Use `components/ui/select`.

Two things that bite:

**Radix has no value for "nothing selected".** An empty string is not a
selectable item, so model the cleared state as the placeholder and map a
sentinel back to `''`:

```tsx
<Select value={value || NO_FILTER} onValueChange={(v) => onChange(v === NO_FILTER ? '' : v)}>
```

**Radix renders a hidden native select beside its trigger.** So a wrapper has
three children, not two, and `space-y-*` — which spaces *every child after the
first* — puts six phantom pixels under the dropdown and breaks a row's
alignment. Put the gap on the label instead:

```tsx
<div className="flex flex-col">
  <Label className="mb-1.5 ...">{label}</Label>
  {children}
</div>
```

That one cost two wrong diagnoses before anybody measured it in a browser. If
a row looks misaligned, **measure `getBoundingClientRect()`** rather than
reading class names: the heights were identical the whole time.

## Styling

Tailwind utilities and shadcn/ui components, which the CLI copies into
`web/src/components/ui/` and which are ours from then on. No CSS files.

Colours come from the tokens in `index.css` — `bg-surface`, `bg-raised`,
`text-ink-muted`, `rounded-panel`. The elevation ladder is luminance, not
borders: ground → surface → raised → tile. Reach for a token before a literal
colour.

## Tests

See the `ticket-app-testing` skill. The two that will cost you an hour
otherwise: use Testing Library's `waitFor`, never `vi.waitFor`; and drive a
Radix dropdown with `user-event`, never `fireEvent`.
