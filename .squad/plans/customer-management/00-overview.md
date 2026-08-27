# customer-management — plan overview

Entry point for the **customer-management** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 10 | [10-story-customer-profiles-SUPPORTOS-28.md](10-story-customer-profiles-SUPPORTOS-28.md) | Customer Profiles | SUPPORTOS-28 | Stories 05–09 (`I18N`, `UI`, `FORM`, `AUTHZ`) |
| 11 | [11-story-contact-details-SUPPORTOS-29.md](11-story-contact-details-SUPPORTOS-29.md) | Contact Details | SUPPORTOS-29 | Story 10 |
| 20 | [20-story-interaction-history-SUPPORTOS-30.md](20-story-interaction-history-SUPPORTOS-30.md) | Interaction History | SUPPORTOS-30 | Story 10 (`CUST-1`), Story 12 (`TKT-1`), Stories 13–19 (`COMM-*`) |

## Dependency notes

This feature maps to **EPIC 3 — Customer Management** in `SupportOs backlog.MD` (lines 264–303). It depends on EPIC 0, 1, and 2 being complete, which they are — see [`../authentication-authorization/00-overview.md`](../authentication-authorization/00-overview.md).

`CUST-1` (story 10) → `CUST-2` (Contact Details) → `CUST-3` (Interaction History, story 20) → `CUST-4` (Notes & Attachments). CUST-3 additionally depended on TKT-1 and COMM-*, which is why it is story **20** rather than 12 — it waited for ticket-management and the whole of EPIC 5 to land first. `CUST-4` depends only on `CUST-1` and is the one story left in this feature.

**Story 10 is the first feature story in the project**, and the first consumer of four foundations that all shipped without one:

| Foundation | Shipped in | Consumers before story 10 |
|---|---|---|
| `BaseModelViewSet` + `permission_map` | 02 / 09 | **zero** |
| `DataTable` + `useServerTable` | 06 | **zero** |
| `useAppForm` + shared field components | 07 | one (`LoginPage`) |
| `can()` / `<Can>` / `RequirePermission` | 09 | **zero** |

That is the point of sequencing it here: the foundations get exercised together, against real data, before a second feature copies them.

**Scope boundaries inside EPIC 3.** Three sibling stories own most of what a customer record eventually holds, and story 10's model is deliberately the identity core only:

| Owned by | What |
|---|---|
| CUST-2 (line 280) | `ContactDetail` — channel-typed contacts (email / phone / WhatsApp) |
| CUST-3 (line 288) | The interaction timeline (aggregates tickets + messages) |
| CUST-4 (line 296) | `Note` and `Attachment`, plus file upload |

So story 10's `Customer` has **no** `notes` text field (it would be dead weight the moment CUST-4 lands) and **no** contact-channel modelling. It does carry a primary `email` and `phone`, because a list screen with no contact column is not useful and `email` is the dedup key behind the intake's *"each customer has one record"*.

**Open forward decision for CUST-2 — now resolved by story 11:** `ContactDetail` hangs **beside** story 10's primary `email`/`phone` fields as additional channels; it does not supersede them. `Customer.email`/`Customer.phone` are unchanged by story 11. See [`11-story-contact-details-SUPPORTOS-29.md`](11-story-contact-details-SUPPORTOS-29.md) `## Prerequisites`.

**Cross-story contracts set by story 10** (all documented in `CONVENTIONS.md` § 23, which this story appends):

- **A feature story grants its own permissions**, via a cross-app data migration in the *feature* app depending on `("accounts", "0003_seed_roles")`, using a **set union** so it never wipes another story's grants. The permission constants go into `apps/core/permissions.py` in the same change.
- **`ordering_fields` is the contract with `DataTable`.** A `ColumnDef.id` marked `sortable` must appear in the viewset's `ordering_fields`, or the header toggles and silently does nothing.
- **Every mutation invalidates its feature's whole key prefix** (`featureKey(...).all`), never an individual page key — a write reshuffles pagination and sort position.
- **Edits use PATCH, not PUT.**
- **`nullableString`/`nullableEmail` vs `optionalString`/`optionalEmail`** — the nullable pair transforms `''` → `null` for a nullable database column; the optional pair transforms to `undefined` for a genuinely absent field.
- **A unique nullable column needs blank→NULL normalisation in both the model's `clean()` and the serializer**, because DRF does not call model `clean()` and the admin does not go through the serializer.

**Verified findings that shaped story 10:**

- **A unique nullable column collides on blank strings, not on NULLs.** Run against this project's Postgres 17: three `NULL`s insert fine into a unique column, while a second `''` fails with `duplicate key value violates unique constraint`. So the *second* customer saved without an email would be an IntegrityError — a 500, not a validation message — unless blank is normalised to `NULL`. This is why the normalisation appears in two places.
- **An absent optional field cannot clear a value.** Verified with DRF's own serializer: a `PUT` with `email` absent yields `validated_data == {'name': 'A'}` — the key is gone, so the instance keeps its old value. Combined with `JSON.stringify` dropping `undefined` keys, story 07's `optionalEmail()` (which transforms `''` → `undefined`) would make a cleared email silently fail to clear. Hence PATCH for edits and the new `null`-transforming schema helpers.
- **A blank string arrives as `''`, not `None`.** Same verification run: `PUT` with `email: ''` yields `{'email': ''}`. DRF does not coerce blank to null, which is the other half of why `validate_email` must normalise.
- **`SearchFilter` is DRF core** — importable on the installed version with `search_param = "search"`. Search needs **no new dependency**; `django-filter` stays uninstalled.
- **`DataTable` must not be wrapped in `QueryBoundary`** — its own docstring records why (`QueryBoundary`'s branches return a `<div>`, which the browser hoists out of `<tbody>`). It renders loading/empty/error as table rows itself.
- **`DefaultRouter` adds an API-root view.** Registered at `path("")`, that root lands on `/api/`, where the catch-all previously returned an enveloped 404. Harmless but a real behaviour change, so story 10 checks it explicitly rather than assuming, with `SimpleRouter` as the documented alternative.

**Story 20 (CUST-3, Interaction History) closes the "is COMM-* satisfied?" question story 13 left open** — by the time it was planned, all six COMM stories (13–17, 19) had shipped, so the timeline aggregates `Message` rows channel-agnostically and the question never needed a product call. It introduces three patterns this project had not used before:

- **The project's first DRF `@action`** (`grep` confirmed zero prior uses). `GET /api/customers/<id>/timeline/` is router-generated from the decorator with **no `urls.py` edit**, and is gated by a `permission_map` entry keyed on the action's own method name (`"timeline"`) — verified against the installed DRF (`routers.py:130-135`, `viewsets.py:158`). The trap worth knowing: a missing `permission_map` entry for a custom action does **not** deny, it falls through to authenticated-only.
- **An aggregate read that deliberately imports across apps in the reverse direction.** `apps/customers/timeline.py` reads `Ticket` and `Message` because `backend/apps/README.md`'s app-purpose table assigns "interaction history" to `customers`. Safe because no *model* imports across apps — Django loads every model before any view/helper module; `apps/tickets/admin.py` (Story 13) is the existing precedent for the same against-the-grain direction.
- **A second, explicit permission check layered on top of `permission_map`.** The payload is ticket and message data, so `customers.view` alone would leak what `tickets.view` gates elsewhere — the action also requires `TICKETS_VIEW` via `permissions_for()`, the same closing move Story 16's `TicketChatConsumer` made. No seeded role exercises the branch (every role with `customers.view` also has `tickets.view`), so its verification creates a throwaway role to prove it.

It is also the first heterogeneous list in the project: a `<ul>`, explicitly **not** a `DataTable` (§ 19's rule is about homogeneous, server-sortable, paginated rows), with React keys combining the `kind` discriminator and the id, because a ticket and a message can share the same numeric id.

**Note on testing:** per standing project policy this project authors no automated tests. Story 10 adds none. Its checks are the backend's `manage.py check`/`test`/`ruff`, the frontend's `lint`/`format:check`/`check:rtl`/`build`, an `en`/`ar` key-set comparison, real HTTP across all four verbs × three permission states (including `DELETE`, which an unmapped action would have left open), and a bilingual RTL walkthrough of the list, profile, and form. Story 20's checks add the router-generated route confirmed against an empty `urls.py` diff, both entry kinds interleaving newest-first (not grouped by kind), the three permission states including a purpose-built `customers.view`-only role, a `404` for an unknown customer, and an empty array for a customer with no history.
