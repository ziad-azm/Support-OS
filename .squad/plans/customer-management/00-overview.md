# customer-management — plan overview

Entry point for the **customer-management** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 10 | [10-story-customer-profiles-SUPPORTOS-28.md](10-story-customer-profiles-SUPPORTOS-28.md) | Customer Profiles | SUPPORTOS-28 | Stories 05–09 (`I18N`, `UI`, `FORM`, `AUTHZ`) |

## Dependency notes

This feature maps to **EPIC 3 — Customer Management** in `SupportOs backlog.MD` (lines 264–303). It depends on EPIC 0, 1, and 2 being complete, which they are — see [`../authentication-authorization/00-overview.md`](../authentication-authorization/00-overview.md).

`CUST-1` (story 10) → `CUST-2` (Contact Details) → `CUST-3` (Interaction History) → `CUST-4` (Notes & Attachments). CUST-3 additionally depends on TKT-1 and COMM-*, so it is not next in line simply because of its number.

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

**Open forward decision for CUST-2:** whether `ContactDetail` supersedes story 10's primary `email`/`phone` fields or hangs beside them as additional channels. Story 10 deliberately does not pre-empt that choice; it only guarantees that `Customer.email` is unique-when-present today.

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

**Note on testing:** per standing project policy this project authors no automated tests. Story 10 adds none. Its checks are the backend's `manage.py check`/`test`/`ruff`, the frontend's `lint`/`format:check`/`check:rtl`/`build`, an `en`/`ar` key-set comparison, real HTTP across all four verbs × three permission states (including `DELETE`, which an unmapped action would have left open), and a bilingual RTL walkthrough of the list, profile, and form.
