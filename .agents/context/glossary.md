# Glossary

The interface is in Spanish. Everything else — identifiers, comments, commit
messages, the API, its documentation — is in English.

That split is not cosmetic. Without this table an agent either translates an
identifier, which breaks the code, or writes English into a screen, which
breaks the product. Extend it when you add a screen.

## The rule

| Where                                                           | Language |
| --------------------------------------------------------------- | -------- |
| Anything a person reads on screen                               | Spanish  |
| Identifiers, types, file names                                  | English  |
| Comments and JSDoc                                              | English  |
| Commit messages, PR descriptions                                | English  |
| API routes, DTO fields, its errors                              | English  |
| Tests: names in English, assertions on the Spanish the UI shows | both     |

An API error message reaches the screen as-is — `ApiError.message` is rendered
— so those few strings are the one place English is visible to a user. Left
that way on purpose: the API is the single source of a rejection's wording,
and translating it in two places is how the two drift apart.

## Domain terms

| Code / API    | Interface           | Notes                       |
| ------------- | ------------------- | --------------------------- |
| ticket        | ticket              | Kept: it is what people say |
| requester     | solicitante         | The person who opened it    |
| agent         | agente              |                             |
| category      | categoría           |                             |
| history       | historial           |                             |
| comment       | comentario          |                             |
| board         | tablero             |                             |
| queue         | cola                |                             |
| code (`TCK-`) | código              |                             |
| assignee      | agente / asignado a | "Sin asignar" when null     |

## States

Two sets, because Spanish agrees in number: a column names many tickets and a
badge names one. `STATE_LABEL` is the plural, `STATE_NAME` the singular, both
in `web/src/features/tickets/states.ts`.

| State         | Column (plural) | One ticket (singular) |
| ------------- | --------------- | --------------------- |
| `open`        | Abiertos        | Abierto               |
| `in_progress` | En curso        | En curso              |
| `resolved`    | Resueltos       | Resuelto              |

## Actions

| Code      | Button             | History verb          |
| --------- | ------------------ | --------------------- |
| `create`  | Abrir ticket       | abrió el ticket       |
| `edit`    | Editar / Guardar   | editó el ticket       |
| `delete`  | Eliminar           | eliminó el ticket     |
| `take`    | Tomar              | tomó el ticket        |
| `release` | Devolver a la cola | lo devolvió a la cola |
| `resolve` | Resolver           | lo resolvió           |
| `comment` | Comentar           | comentó               |

The history reads as a sentence after the person's name: "Carla Ruiz tomó el
ticket". A new verb has to fit that shape.

## Interface furniture

| English        | Spanish                  |
| -------------- | ------------------------ |
| Sign in / out  | Ingresar / Cerrar sesión |
| Username       | Usuario                  |
| Password       | Contraseña               |
| Search         | Buscar                   |
| Apply / Clear  | Aplicar / Limpiar        |
| Refresh        | Actualizar               |
| Show more      | Ver más                  |
| Cancel         | Cancelar                 |
| Rename         | Renombrar                |
| Confirm delete | Confirmar borrado        |
| In use         | En uso                   |
| Unassigned     | Sin asignar              |
| Anyone         | Cualquiera               |
| Newest first   | Más nuevos primero       |
| Oldest first   | Más viejos primero       |
| Opened by      | Abierto por              |
| Nothing here   | Nada por acá             |
| Loading…       | Cargando…                |

## Dates

`web/src/helpers/datetime.ts`. Relative time is Spanish and plurals are not a
matter of adding an "s", so each unit carries both forms: `hace 1 día` /
`hace 2 días`, and `recién` under a minute. Absolute dates use `Intl` with
`es-AR`.

Days are never rolled up into a date. A ticket that has waited 45 days reads
`hace 45 días`, because "3 ago" or "5 de agosto" would hide exactly the thing
the board exists to expose.

## Two collisions already found

Both cost a failing test, so they are worth remembering:

- **A placeholder and an error message must not say the same thing.** The
  category field had "Elegí una categoría" as both, and a test legitimately
  found two identical elements. The placeholder invites ("Elegí una
  categoría"), the error explains ("El ticket necesita una categoría").
- **`'commented'` is an event type, not a word to translate.** A global
  replace turned a fixture's `type: 'commented'` into `'comentó'`, which the
  typecheck caught. Translate strings that are rendered, never values that are
  compared.
