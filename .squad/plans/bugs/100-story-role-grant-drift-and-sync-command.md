# Story 100 — Role-Grant Drift & the `sync_role_permissions` Command

## Prerequisites

- **Story 99 implemented:** [99-story-portal-task-idor-and-fail-open-default.md](99-story-portal-task-idor-and-fail-open-default.md). Same feature folder, same defect report; ship after it so the two authorization diffs are reviewed separately.
- **Story 48/49 (`SEC-1`/`SEC-2`) implemented:** `Role`, `RoleAdminSerializer`, and the permissions-editing UI — the surface through which this drift was almost certainly introduced. See [../security-administration/49-story-permissions-management-SUPPORTOS-73.md](../security-administration/49-story-permissions-management-SUPPORTOS-73.md).
- **Story 87/89 (`ORG-1`/`ORG-2`) implemented:** they added `departments.*` / `branches.*` to `Permissions` **without any grant migration** — see `## What discovery changed` item 2.
- **Intake:** `.squad/stories/bugs/qa-report-1/intake.md`; **attachment:** `.squad/stories/bugs/qa-report-1/attachments/QA-REPORT-1.md` (F-2).
- **No frontend change of any kind.** `git status --short frontend/` must be empty at the end of this story.

---

## What discovery changed

Four things were verified against the live database and every grant migration before this plan was written. All four change what gets built — the intake's "Super Admin is missing 8 permissions" is the symptom, not the defect.

### 1. Six permissions are held by **zero** roles, not eight by one role

Full matrix, read from the live database:

| Permission | agent | customer | manager | super_admin |
|---|:--:|:--:|:--:|:--:|
| `api_keys.manage` | · | · | · | **·** |
| `communications.manage` | · | · | · | **·** |
| `integrations.manage` | · | · | · | **·** |
| `webhooks.manage` | · | · | · | **·** |
| `departments.manage` | · | · | · | **·** |
| `branches.manage` | · | · | · | **·** |
| `departments.view` | · | · | ✔ | **·** |
| `branches.view` | · | · | ✔ | **·** |
| *(the other 13)* | — | — | — | ✔ |

**Six permissions exist in `ALL_PERMISSIONS`, are enforced by real viewsets, and no role in the system grants them.** The endpoints they gate — API keys, webhooks, ERP/integrations, channel settings, and department/branch *management* — are unreachable by every non-superuser account in the product.

Note also that `manager` holds `departments.view`/`branches.view` while `super_admin` does not. That inversion cannot come from any migration; it is hand-editing through `SEC-2`'s roles UI. **The "intended" state is therefore not recoverable from the migration history**, which is why task 1 states a rule rather than replaying grants.

### 2. Two of the six were never granted by any migration, to anyone

Every grant migration was read. Their full `GRANTS` targets:

| Migration | Grants | To |
|---|---|---|
| `accounts/0003_seed_roles` | `users.view`, `users.manage`, `roles.manage` | creates slug **`admin`** |
| `customers/0002_grant_customer_permissions` | `customers.view`, `customers.manage` | `admin`, `manager`, `agent` |
| `accounts/0006` | `audit_log.view` | `admin` |
| `accounts/0008` | `api_keys.manage` | `admin` |
| `accounts/0009` | `integrations.manage` | `admin` |
| `accounts/0010` | `communications.manage` | `admin` |
| `accounts/0011` | `webhooks.manage` | `admin` |

`departments.*` and `branches.*` appear in **no** grant migration at all. `ORG-1`/`ORG-2` added the permission strings and the viewsets that enforce them, and never granted them. So this is two defects wearing one hat:

- **0008–0011 no-op'd** because slug `admin` does not exist here (four permissions).
- **ORG-1/ORG-2 never wrote a grant migration** at all (two permissions) — that would be unreachable even on a perfectly-migrated database.

The second is invisible to any fix that only replays the skipped migrations.

### 3. A fresh database and this one produce **different role slugs**

`0003_seed_roles` creates `slug="admin"`. This database has `super_admin` and **no `admin` row**. So a freshly-migrated environment (a new developer, CI, or production) gets `admin` with 10 permissions and no `super_admin`, while this database has `super_admin` with 13 and no `admin`.

The repair therefore cannot key on one slug. It must handle: only `admin` (fresh), only `super_admin` (here), or — if someone re-runs the seed — both.

### 4. The superuser bypass is why nobody noticed

`ziad@email.com` is `is_superuser=True` with **`role = None`**. `apps.core.permissions.permissions_for` short-circuits to `ALL_PERMISSIONS` for any superuser before it ever reads `role`. The one human driving the app therefore sees every screen work, while every role-bearing account gets 403s on six areas.

This is the reason the story needs a **check command**, not just a data fix: no amount of manual clicking by the project owner can surface this class of bug.

---

## Story Goal

Make the role→permission mapping correct, and make it impossible for the same drift to pass unnoticed again.

1. Every permission in `ALL_PERMISSIONS` is granted to at least one role — no permission is enforced-but-ungrantable.
2. The top administrative role holds the full catalogue, on a fresh database and on this one alike.
3. A `manage.py sync_role_permissions --check` command reports drift and exits non-zero, so CI can gate on it.
4. The rule that produced this — a grant migration that skips silently — is recorded in CONVENTIONS.md §22 so the next one fails loudly instead.

**Not in scope:** changing `manager`, `agent` or `customer` grants. Their migrations targeted slugs that exist and applied correctly; their current sets are product decisions, not drift. The one exception is noted in task 1 and is additive only.

---

## Context — Read These Files First

1. `backend/apps/accounts/migrations/0003_seed_roles.py` — `SEEDED_ROLES` at lines 9-32; note `"slug": "admin"` at line 11 and `update_or_create(slug=...)` at lines 37-40.
2. `backend/apps/accounts/migrations/0011_grant_webhooks_permission.py` — the shape all five grant migrations share. Lines 15-21 are `grant()`; **line 17-18 is the `if role is None: continue` that swallowed four grants.**
3. `backend/apps/core/permissions.py` — `Permissions` (the 21 strings), `ALL_PERMISSIONS` (lines 49-53, built by reflection over the class), and `permissions_for` — **note the superuser short-circuit**, which is why this went unseen.
4. `backend/apps/accounts/models.py` lines 41-86 — `Role`: `slug` (unique), `permissions` (JSONField), `is_system`, and `clean()` which rejects any string outside `ALL_PERMISSIONS`. `clean()` runs from `full_clean()` only, so a migration write bypasses it.
5. `backend/apps/accounts/serializers.py` — `RoleAdminSerializer.validate_slug` (a system role's slug is immutable through the API) and `validate_permissions`. Confirms the API could not have produced the `admin`→`super_admin` rename; it happened outside the API.
6. `CONVENTIONS.md` §22 (from line 815) — "Authorization (roles & permissions)", the vocabulary-is-code / mapping-is-data table. Task 4 appends to this section.
7. Django's docs pattern for a management command: `BaseCommand`, `add_arguments`, `handle`. **There is no `management/` package anywhere in this backend yet** — `find backend/apps -type d -name management` returns nothing. Task 3 creates the first.

---

## Backend Tasks

### 1 — Repair migration: grant the full catalogue to the administrative role

**Create file: `backend/apps/accounts/migrations/0015_repair_admin_role_grants.py`**

Confirm the next number first — `0014_user_branch` is the current head (`python manage.py showmigrations accounts`).

The rule, stated rather than replayed: **the administrative role holds every permission in `ALL_PERMISSIONS`.** This is a decision, not a restoration — discovery item 1 shows the intended state is not recoverable from history, and two of the six permissions were never granted to anyone.

```python
from django.db import migrations

from apps.core.permissions import ALL_PERMISSIONS

# Both slugs, because a fresh database seeds `admin` (0003) while this
# project's own database carries `super_admin` — see Story 100
# `## What discovery changed` item 3. Whichever exist are repaired.
ADMIN_SLUGS = ("admin", "super_admin")


def repair(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    roles = list(Role.objects.filter(slug__in=ADMIN_SLUGS))
    if not roles:
        # Loud, not silent. A no-op permission migration is
        # indistinguishable from a successful one, which is exactly how
        # 0008-0011 granted nothing for five releases.
        raise RuntimeError(
            "No administrative role found (looked for slugs %s). Refusing to "
            "no-op: see Story 100." % (", ".join(ADMIN_SLUGS),)
        )
    for role in roles:
        role.permissions = sorted(ALL_PERMISSIONS)
        role.save(update_fields=["permissions"])


def unrepair(apps, schema_editor):
    """Deliberately a no-op.

    There is no correct earlier state to restore to: this database's
    `super_admin` was hand-edited (`manager` holds `departments.view` while
    `super_admin` does not — no migration produces that), so reversing would
    have to invent a set. Reversing this migration leaves the grants in
    place; that is safe, because the whole defect was too FEW grants.
    """


class Migration(migrations.Migration):
    dependencies = [("accounts", "0014_user_branch")]

    operations = [migrations.RunPython(repair, unrepair)]
```

**Do not touch `manager`, `agent` or `customer`.** Their grants applied correctly.

### 2 — Grant `departments.*` / `branches.*` to `manager`

**Same migration file, same `repair()` function.**

Discovery item 1 found `manager` already holds `departments.view` and `branches.view` (hand-added), but not the `.manage` pair. Since `ORG-1`/`ORG-2` never wrote a grant migration, a fresh database gives `manager` neither. Make the two environments agree:

```python
# ORG-1/ORG-2 added these permission strings and the viewsets that enforce
# them, but never a grant migration — so on a FRESH database no role holds
# them at all. `manager` already carries the two `.view` grants here by
# hand; this makes that intentional and reproducible.
MANAGER_GRANTS = [
    "departments.view",
    "branches.view",
]
```

Grant them additively (`sorted(set(role.permissions) | set(MANAGER_GRANTS))`), never by assignment — `manager`'s other 10 grants must survive untouched.

**Do not** give `manager` the `.manage` pair. Creating and deleting departments/branches is org administration; `super_admin` covers it via task 1. Record that reasoning in a comment.

### 3 — `sync_role_permissions` management command

**Create files:**
- `backend/apps/accounts/management/__init__.py` (empty)
- `backend/apps/accounts/management/commands/__init__.py` (empty)
- `backend/apps/accounts/management/commands/sync_role_permissions.py`

This is the project's first management command. Three invariants — each one objectively checkable, and between them they catch every variant of this defect:

| # | Invariant | Catches |
|---|---|---|
| 1 | Every role's permissions ⊆ `ALL_PERMISSIONS` | a stale string left behind after a permission is renamed or removed |
| 2 | The administrative role == `ALL_PERMISSIONS` | the 0008–0011 silent-no-op class |
| 3 | Every permission in `ALL_PERMISSIONS` is held by ≥ 1 role | the ORG-1/ORG-2 never-granted class |

```python
class Command(BaseCommand):
    help = "Report (and optionally fix) drift between Role.permissions and ALL_PERMISSIONS."

    def add_arguments(self, parser):
        parser.add_argument(
            "--check",
            action="store_true",
            help="Report only and exit non-zero on drift. For CI.",
        )
        parser.add_argument(
            "--fix",
            action="store_true",
            help="Grant the administrative role the full catalogue.",
        )
```

Behaviour:

- **Default (no flags)** — print the per-role table and the three invariant results. Exit **0** regardless. A read-only report must never fail a shell.
- **`--check`** — same report, then `raise CommandError` (exit 1) if any invariant fails. This is the CI gate.
- **`--fix`** — repair invariant 2 only (grant the admin role the full catalogue), print what changed, exit 0. Invariants 1 and 3 are **reported, never auto-fixed**: an unknown permission string might be a typo or a rename in flight, and an ungranted permission needs a human to decide *which* role should hold it. Guessing either is how the mapping drifts in the first place.
- `--check --fix` together → `CommandError`; they contradict.

Use `self.stdout.write` with `self.style.SUCCESS` / `.WARNING` / `.ERROR`, never bare `print` — that is what makes output testable and respects `--no-color`.

### 4 — Record the rule in CONVENTIONS.md §22

**File: `CONVENTIONS.md`**

Append a subsection to §22 covering:

- **A grant migration must fail loudly when its target role is absent.** `if role is None: continue` is banned; the pattern is `raise`. Cite 0008–0011 as the precedent — five releases, five applied migrations, zero permissions granted.
- **A story that adds a permission string must add its grant migration in the same change.** `ORG-1`/`ORG-2` added `departments.*`/`branches.*` and shipped no grant, leaving them enforced-but-ungrantable.
- **`python manage.py sync_role_permissions --check` is the gate**, and the three invariants it asserts.
- **A superuser bypasses all of this** (`permissions_for` short-circuits), so manual testing as a superuser proves nothing about role correctness.

---

## Frontend Tasks

**No frontend changes required.** The sidebar already gates each link with `<Can permission="…">`; those six areas simply start appearing for the admin role once the grants exist. Verified by inspection — no component knows about specific role slugs.

---

## Edge Cases & Failure Modes

- **Both `admin` and `super_admin` exist.** `filter(slug__in=...)` returns both and repairs both. Harmless: two administrative roles both holding everything is consistent, and no user is reassigned.
- **Neither exists.** `repair()` raises `RuntimeError` and the migration aborts in its transaction. This is the intended behaviour and the entire point of the story — an operator sees a failed migrate instead of a silent success.
- **A permission is later removed from `Permissions`.** The admin role then holds a string not in `ALL_PERMISSIONS`; `Role.clean()` would reject it on any form save, and invariant 1 reports it. This is why invariant 1 exists and why `--fix` does not touch it.
- **`ALL_PERMISSIONS` is imported into a migration.** `0003`, `0006`, `0008`–`0011` all already import from `apps.core.permissions`, and that module imports no models — so there is no circular-import or historical-model violation. The documented trade-off (`0003_seed_roles` lines 4-8) is that a renamed constant breaks the migration loudly, which is the desired direction.
- **`role.save(update_fields=["permissions"])` on a historical model.** `Role` inherits `TimeStampedModel`, whose `updated_at` is `auto_now`. `update_fields` excludes it, so `updated_at` will **not** advance. That matches how `0006`–`0011` already write, so behaviour stays consistent; do not "improve" it here.
- **Running `--fix` on a database with no admin role.** Must print an error and exit non-zero, not create a role. Creating roles is `0003`'s job; a command that invents an administrative role is a privilege-escalation primitive.
- **`--check` in CI against an empty database.** No roles at all means invariants 2 and 3 fail and CI goes red. Correct: a database with no roles is not a valid deployment.

---

## Test Plan

**This project does not author automated tests** — CONVENTIONS.md §16: *"Changes are verified by running the commands in `README.md` and driving the app directly. The 54 backend tests … predate this policy and are kept, but they are not extended and no new test file is added anywhere in the repo."*

**No test file is added, modified, or removed.** Verification is `## Verification Steps` below.

Note the irony worth recording: `sync_role_permissions --check` is, functionally, the role-integrity test the attachment's F-3 asks for — delivered as a command rather than a test file, so it satisfies §16 while still being CI-gateable.

---

## Migration / Rollback

**One new migration, data-only.** No schema change, so `makemigrations --check` must still report "No changes detected" *after* the file is added (a `RunPython`-only migration introduces no model state).

**Deploy ordering is unconstrained.** No wire-format change; the frontend is untouched.

**Rollback:** `migrate accounts 0014` runs `unrepair`, which is deliberately a no-op — the grants stay. That is the correct direction: the defect was too few grants, so reversing must not re-break the product. To truly revert, `git revert` the commit and edit the role in the `SEC-2` UI.

**Half-applied state:** none possible. `RunPython` runs inside the migration transaction; either every listed role is repaired or none is.

---

## Verification Steps

1. **Frontend untouched:** `git status --short frontend/` is empty.
2. **No schema drift:** in `backend/`, `python manage.py makemigrations --check --dry-run` reports **"No changes detected"**.
3. **Backend gates:** `python -m ruff check .` passes and `python -m ruff format --check .` reports all files formatted (the count rises by 3 — the command plus two `__init__.py`).
4. **System checks:** `python manage.py check` → 0 issues; `DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py check --deploy` → **0 security warnings** and no more than the 38 pre-existing `drf_spectacular` warnings.
5. **The migration applies:** `python manage.py migrate` succeeds and `showmigrations accounts` shows `[X] 0015_repair_admin_role_grants`.
6. **The headline check — every permission is now reachable.** `python manage.py sync_role_permissions` prints the matrix; **all three invariants pass**; and no permission column is empty.
7. **The CI gate works in both directions.** `sync_role_permissions --check` exits **0** on the repaired database. Then temporarily remove one permission from the admin role (`SEC-2` UI or shell), re-run, and confirm it exits **1** and names the missing permission. Restore it.
8. **The loud-failure path.** In a shell, rename the admin role's slug to something else, run `migrate accounts 0014 && migrate accounts 0015`, and confirm it **raises** rather than succeeding silently. Restore the slug. *(If a full down/up migrate is impractical, call `repair()` directly against a stubbed `apps` registry — the requirement is that the raise is demonstrated, not assumed.)*
9. **The 403s are gone.** Sign in as `admin@supportos.local` (Super Admin role, **not** a Django superuser) and confirm `GET /api/departments/`, `/api/branches/`, `/api/api-keys/`, `/api/webhooks/subscriptions/`, `/api/erp/connection/` and the channel-settings endpoint all return **200**, where they returned **403** before this story.
10. **The sidebar links now work.** As the same account, the Departments, Branches, ERP Sync and Channels sidebar entries open their screens instead of erroring.
11. **No role was widened by accident.** `agent` still holds exactly 5 permissions and `customer` exactly 2 — unchanged. `manager` rises from 10 to 10 or 12 depending on whether it already held the two `.view` grants (12 on a fresh database, 10 here since it already had them) and must **not** hold `departments.manage` or `branches.manage`.
12. **Portal boundary regression.** Re-run Story 99's Verification step 11 sweep with a portal-customer JWT: all eight admin endpoints still **403**, `/notifications/` and `/tasks/` still **200**. Widening the admin role must not widen anyone else.

---

## Done Criteria

- [ ] Every permission in `ALL_PERMISSIONS` is held by at least one role — verified by `sync_role_permissions`, no empty column.
- [ ] The administrative role holds all 21 permissions, on this database (`super_admin`) and on a freshly-migrated one (`admin`).
- [ ] `manager` gains `departments.view`/`branches.view` reproducibly via migration, and does **not** gain the `.manage` pair.
- [ ] `agent` and `customer` are byte-identical to before.
- [ ] The repair migration **raises** when no administrative role is found — demonstrated, not asserted.
- [ ] `python manage.py sync_role_permissions` reports the matrix and three invariants, exits 0.
- [ ] `--check` exits non-zero on drift and 0 on a healthy database; `--fix` repairs invariant 2 only; `--check --fix` is rejected.
- [ ] The command lives at `apps/accounts/management/commands/`, the first in the project, with both `__init__.py` files.
- [ ] CONVENTIONS.md §22 records: grant migrations must raise not `continue`; a permission-adding story ships its grant migration; `--check` is the gate; superuser bypass invalidates manual verification.
- [ ] `admin@supportos.local` gets **200** on departments, branches, api-keys, webhooks, ERP and channel settings, and the four sidebar links open.
- [ ] `ruff check`, `ruff format --check`, `manage.py check`, `makemigrations --check` all pass; `check --deploy` still 0 security warnings.
- [ ] `git status --short frontend/` is empty.
- [ ] No test file was added, changed, or removed (CONVENTIONS.md §16).

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 101.**
