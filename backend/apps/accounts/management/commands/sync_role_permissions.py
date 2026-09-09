"""Report — and optionally repair — drift between `Role.permissions` and
`ALL_PERMISSIONS`.

The project's first management command, and it exists because of a defect
that no amount of manual testing could surface: `apps.core.permissions.
permissions_for` short-circuits to every permission for a superuser, so the
one account a developer usually drives the app with never sees the 403s that
a role-bearing account hits. Five grant migrations (`accounts/0006`,
`0008`-`0011`) reported as applied while granting nothing, because their
target slug did not exist in the database they ran against.

Three invariants, each objectively checkable, and between them they catch
every variant of that defect:

1. Every role's permissions are a subset of `ALL_PERMISSIONS` — catches a
   string left behind after a permission is renamed or removed.
2. The administrative role holds every permission — catches the silent
   no-op grant migration.
3. Every permission is held by at least one role — catches a permission that
   was added to the vocabulary and enforced by a viewset, but never granted
   to anybody (how `departments.*`/`branches.*` shipped in ORG-1/ORG-2).

See CONVENTIONS.md § 22 and Story 100.
"""

from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import Role
from apps.core.permissions import ALL_PERMISSIONS

# Mirrors `0015_repair_admin_role_grants.ADMIN_SLUGS`: a fresh database seeds
# `admin`, this project's own carries `super_admin`.
ADMIN_SLUGS = ("admin", "super_admin")


class Command(BaseCommand):
    help = "Report (and optionally fix) drift between Role.permissions and ALL_PERMISSIONS."

    def add_arguments(self, parser):
        parser.add_argument(
            "--check",
            action="store_true",
            help="Report only, and exit non-zero if any invariant fails. For CI.",
        )
        parser.add_argument(
            "--fix",
            action="store_true",
            help="Grant the administrative role the full permission catalogue.",
        )

    def handle(self, *args, **options):
        check = options["check"]
        fix = options["fix"]
        if check and fix:
            # They contradict: one asserts the world is already correct, the
            # other changes it. A run that repaired and then reported success
            # would make a CI gate meaningless.
            raise CommandError("--check and --fix cannot be combined.")

        roles = list(Role.objects.order_by("slug"))
        if not roles:
            raise CommandError("No roles in the database — this is not a valid deployment.")

        if fix:
            self._fix(roles)
            roles = list(Role.objects.order_by("slug"))

        self._print_matrix(roles)
        failures = self._report_invariants(roles)

        if failures and check:
            raise CommandError(f"{len(failures)} invariant(s) failed — see above.")
        if failures:
            # Exit 0 without --check: a read-only report must never fail a
            # shell that only asked to look.
            self.stdout.write(
                self.style.WARNING("\nDrift found. Re-run with --check in CI, or --fix to repair.")
            )
        else:
            self.stdout.write(self.style.SUCCESS("\nAll invariants pass."))

    # -- reporting ---------------------------------------------------------

    def _print_matrix(self, roles):
        slugs = [role.slug for role in roles]
        held = {role.slug: set(role.permissions) for role in roles}
        width = max(len(permission) for permission in ALL_PERMISSIONS) + 2

        self.stdout.write("")
        self.stdout.write("permission".ljust(width) + "  ".join(s.ljust(13) for s in slugs))
        for permission in sorted(ALL_PERMISSIONS):
            cells = "  ".join(
                ("yes" if permission in held[slug] else "-").ljust(13) for slug in slugs
            )
            self.stdout.write(permission.ljust(width) + cells)
        self.stdout.write("")
        for role in roles:
            count = len(set(role.permissions))
            self.stdout.write(f"  {role.slug:<13} {count}/{len(ALL_PERMISSIONS)}")

    def _report_invariants(self, roles):
        failures = []

        # 1 — no unknown strings anywhere.
        for role in roles:
            unknown = sorted(set(role.permissions) - ALL_PERMISSIONS)
            if unknown:
                failures.append("unknown")
                self.stdout.write(
                    self.style.ERROR(
                        f"\n[1] FAIL {role.slug} holds permission(s) no view can check: "
                        f"{', '.join(unknown)}"
                    )
                )
        if "unknown" not in failures:
            self.stdout.write(
                self.style.SUCCESS("\n[1] OK   every role's permissions are known strings")
            )

        # 2 — the administrative role holds everything.
        admins = [role for role in roles if role.slug in ADMIN_SLUGS]
        if not admins:
            failures.append("no-admin")
            self.stdout.write(
                self.style.ERROR(
                    f"[2] FAIL no administrative role found (looked for: {', '.join(ADMIN_SLUGS)})"
                )
            )
        else:
            incomplete = False
            for role in admins:
                missing = sorted(ALL_PERMISSIONS - set(role.permissions))
                if missing:
                    incomplete = True
                    failures.append("admin-incomplete")
                    self.stdout.write(
                        self.style.ERROR(
                            f"[2] FAIL {role.slug} is missing {len(missing)} permission(s): "
                            f"{', '.join(missing)}"
                        )
                    )
            if not incomplete:
                held_by = ", ".join(role.slug for role in admins)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"[2] OK   administrative role(s) hold the full catalogue: {held_by}"
                    )
                )

        # 3 — nothing is enforced-but-ungrantable.
        granted = set()
        for role in roles:
            granted |= set(role.permissions)
        ungranted = sorted(ALL_PERMISSIONS - granted)
        if ungranted:
            failures.append("ungranted")
            self.stdout.write(
                self.style.ERROR(
                    f"[3] FAIL {len(ungranted)} permission(s) are enforced by a view but held "
                    f"by NO role: {', '.join(ungranted)}"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS("[3] OK   every permission is held by at least one role")
            )

        return failures

    # -- repair ------------------------------------------------------------

    def _fix(self, roles):
        """Repairs invariant 2 only.

        Invariants 1 and 3 are reported and never auto-repaired on purpose.
        An unknown string may be a typo or a rename in flight, and an
        ungranted permission needs a human to decide WHICH role should hold
        it — guessing either is how the mapping drifted in the first place.
        """
        admins = [role for role in roles if role.slug in ADMIN_SLUGS]
        if not admins:
            # Never create one. A command that invents an administrative role
            # is a privilege-escalation primitive; seeding roles is
            # `accounts/0003_seed_roles`'s job.
            raise CommandError(
                f"No administrative role to fix (looked for: {', '.join(ADMIN_SLUGS)})."
            )
        for role in admins:
            missing = sorted(ALL_PERMISSIONS - set(role.permissions))
            if not missing:
                self.stdout.write(f"  {role.slug} already holds every permission.")
                continue
            role.permissions = sorted(ALL_PERMISSIONS)
            role.save(update_fields=["permissions"])
            self.stdout.write(
                self.style.SUCCESS(
                    f"  {role.slug} granted {len(missing)} missing permission(s): "
                    f"{', '.join(missing)}"
                )
            )
