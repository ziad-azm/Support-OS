# design-intelligence-ui-ux-system — plan overview

Entry point for the **design-intelligence-ui-ux-system** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 35 | [35-story-design-intelligence-foundation-SUPPORTOS-67.md](35-story-design-intelligence-foundation-SUPPORTOS-67.md) | Design Intelligence Foundation | SUPPORTOS-67 | `UI`/`I18N` (Story 06), Agent Workspace (existing built screens) |

## Dependency notes

This feature maps to **EPIC 8 — Design Intelligence & UI/UX System** in `SupportOs backlog.MD` (lines 496-524). It depends on `internationalization-design-system` (`UI`, `I18N`) per the epic's own `Depends on` line — see [`../internationalization-design-system/00-overview.md`](../internationalization-design-system/00-overview.md).

**Story 35 (`DSN-0`, Design Intelligence Foundation) is complete.** It is a tooling + documentation story, not app code — it installed the `ui-ux-pro-max` Claude Code skill into this repo (`.claude/skills/ui-ux-pro-max/`), ran its design-system generator once against SupportOS's real product description, persisted the result to `design-system/supportos/MASTER.md` (the skill nests persisted output under `design-system/<project-slug>/`, not the flat `design-system/MASTER.md` the plan assumed), and codified the reusable `DSN` shared spec as a new `CONVENTIONS.md` § 25 — including a token-by-token reconciliation against the existing `UI` tokens in `frontend/src/index.css`, resolving a naming quirk where MASTER.md's color table labels the neutral slate "Primary" while its own component CSS uses the vivid blue labeled "Accent/CTA" as the actual button color. It made **no** code change to `frontend/src/index.css` or any component; that is deliberately deferred to `DSN-1`.

**`DSN-1` (Design System Refresh Across Built Screens), `DSN-2` (UX Guidelines & Accessibility Audit), and `DSN-3` (Dashboard Chart Design Guidance)** (`SupportOs backlog.MD:508-524`) all declare `Dependencies: DSN-0` and are not yet planned — each needs its own intake before a plan can be written. `DSN-3`'s output is also a named prerequisite of `RPT-0` (Reporting Foundation, `EPIC 11`, `SupportOs backlog.MD:797` Foundation Map) once that feature is planned.

**`EPIC 9 — Knowledge Base`** (renumbered from `EPIC 8` when this epic was inserted ahead of it) now lists Design Intelligence (`DSN`) as an explicit dependency (`SupportOs backlog.MD:531-532`) — plan it after this feature, not before.
