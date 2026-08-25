# Story 06 — Design System & Shared Components (Story: SUPPORTOS-11)

## Prerequisites

- **Story 05 completed:** [05-story-i18n-rtl-foundation-SUPPORTOS-9.md](05-story-i18n-rtl-foundation-SUPPORTOS-9.md). Verified landed: `frontend/src/shared/i18n/` (`config.ts`, `index.ts`, `direction.ts`, `resources.ts`, `i18next.d.ts`), the `common`/`errors`/`health` namespaces, `shared/lib/format.ts`, `shared/hooks/useFormatters.ts`, `CONVENTIONS.md` § 18, and the anti-FOUC script at `frontend/index.html` lines 8–24. **This story consumes § 18's logical-property mapping (`CONVENTIONS.md` lines 306–320) as a hard constraint.**
- **Story 03 completed:** [../project-foundation-architecture/03-story-frontend-foundation-SUPPORTOS-4.md](../project-foundation-architecture/03-story-frontend-foundation-SUPPORTOS-4.md) — `src/shared/ui/`, the `QueryBoundary`/`Loading`/`Empty`/`ErrorState` set whose **props are the stable contract this story must not change**, the toast subsystem, and the API layer.
- **Story 04 completed:** [../project-foundation-architecture/04-story-codebase-conventions-SUPPORTOS-5.md](../project-foundation-architecture/04-story-codebase-conventions-SUPPORTOS-5.md) — `CONVENTIONS.md`, `frontend/.oxlintrc.json`, Prettier at `printWidth: 100` / `semi: false` / `singleQuote: true`, and the CI gates in `.github/workflows/lint.yml`.
- **`CONVENTIONS.md` § 7 (lines 98–106) currently reads "UI (Tailwind + shadcn/ui) is defined by UI-1, not yet planned."** This story makes that sentence false; task 10 replaces it. Do not leave it.
- Verified frontend baseline: **no Tailwind, no shadcn, no Radix, no `clsx`, no `tailwind-merge`, no icon library.** `frontend/package.json` dependencies are exactly `@tanstack/react-query`, `axios`, `i18next`, `i18next-browser-languagedetector`, `react`, `react-dom`, `react-i18next`, `react-router`.
- Verified toolchain: Node **v24.15.0**, npm **11.12.1**, Vite **8.2.2**, React **19.2.8**, TypeScript **~6.0.2**, oxlint **1.79.0**.
- Verified backend baseline: `REST_FRAMEWORK` (`backend/config/settings/base.py` lines 197–216) has **no `DEFAULT_FILTER_BACKENDS`**, so `?ordering=` is not honoured by anything today. Task 9 fixes that.
- This story is a dependency of **FORM-1** (`SupportOs backlog.MD` lines 203–213). Every props contract it sets is consumed immediately after.

---

## Story Goal

Give the app a token-driven, direction-aware, dark-mode-ready component library that every later feature composes instead of restyling.

1. Tailwind CSS v4 and shadcn/ui installed and wired into **this** repo's structure — no top-level `components/` or `lib/`, primitives under `src/shared/ui/primitives/`.
2. Design tokens (colour, radius, spacing, typography) as the single styling source, with a working light/dark theme.
3. The shadcn primitive set the intake names — Button, Input, Label, Select, Dialog, AlertDialog, DropdownMenu, Table, Tabs, Badge, Card, Skeleton — **made RTL-correct and i18n-correct**, which they are not as generated.
4. The existing `Loading` / `Empty` / `ErrorState` / `QueryBoundary` / `ToastProvider` / `LanguageSwitcher` restyled **without changing a single prop**, plus a new `Confirm` pattern in the same shape as the toast subsystem.
5. One `DataTable` pattern for every list screen: server-driven sorting and pagination, table-shaped loading/empty/error states.
6. A **machine-checked** logical-property gate, because nothing enforces § 18's central rule today.

### The three findings that shape this story

**1. Radix primitives are LTR-blind without a `DirectionProvider`.** Verified by reading the installed implementation (`@radix-ui/react-direction`, shipped inside `radix-ui@1.6.7`):

```js
function useDirection(localDir) {
  const globalDir = React.useContext(DirectionContext)
  return localDir || globalDir || 'ltr'
}
```

It reads a **React context** and falls back to the literal `'ltr'`. It never looks at `document.documentElement.dir`. So `<html dir="rtl">` — which story 05 correctly sets — buys Radix nothing: Select, DropdownMenu, and Tabs would keep LTR arrow-key semantics and LTR `side`/`align` flipping in Arabic, silently. Task 4 wires `Direction.DirectionProvider`. **This is the single most important task in the story and it produces no visible diff in English.**

**2. shadcn's generated code violates `CONVENTIONS.md` § 18.** Verified by fetching all twelve registry entries from `https://ui.shadcn.com/r/styles/new-york-v4/<name>.json` and grepping them. **9 of 12 ship physical direction classes**, 7 of 12 ship a pointless `"use client"`, and `dialog.tsx` ships two hardcoded English strings that will **fail `npm run lint`** under `react/jsx-no-literals`. Task 6 enumerates every hit by file and line. The intake's "prefer shadcn primitives over hand-built ones" therefore means *adopt then correct*, not *adopt as-is*.

**3. TanStack Table is the wrong tool here, and is not what the intake asked for.** The intake says the table is built on "the primitives + **TanStack Query** conventions" — it never names TanStack Table. Two verified facts settle it:

- Pagination and sorting in this API are **server-side**. `backend/apps/core/pagination.py` is a `PageNumberPagination` returning `{count, page, page_size, num_pages, next, previous}` under `meta`, driven by `?page=` and `?page_size=`. `api.getPage` (`frontend/src/shared/lib/api/client.ts` lines 110–122) already models exactly that. TanStack Table's value is its client-side row models — precisely the part we must not use.
- `@tanstack/react-table@9.1.2` is the current release and it is a **rewrite**: `useTable` + `tableFeatures()` replacing `useReactTable`, explicit feature registration, and a new `@tanstack/react-store` runtime dependency (verified from the installed package's own `skills/migrate-v8-to-v9/SKILL.md` and `package.json`). Adopting a freshly-rewritten API to get a column model we would then bypass fails `CONVENTIONS.md` § 17 ("check whether an existing one already does the job").

So task 8 defines a ~40-line `ColumnDef<T>` of our own over the shadcn `Table` primitive. **Do not install `@tanstack/react-table`.**

### Explicitly out of scope

- **`sonner` and `next-themes`** — the two dependencies shadcn's `sonner` registry entry pulls in. The existing `ToastProvider` is load-bearing: `toastSink.ts` is how `createQueryClient`'s `onError` reaches a toast from outside React (`app/providers.tsx` lines 19–26). Swapping in sonner breaks that seam for a visual gain we get by restyling. Task 5 restyles it. Dark mode gets `src/shared/theme/`, a 60-line module mirroring `shared/i18n/` — see task 3.
- **shadcn's `pagination` registry entry.** Verified: it is anchor-based (`<a>` + `buttonVariants`), carries three hardcoded English strings (`Previous`, `Next`, `More pages`), uses `sm:pl-2.5`/`sm:pr-2.5`, and renders `ChevronLeftIcon`/`ChevronRightIcon` that do not mirror. Our pagination is button-and-state driven against `meta.pagination`. Task 8 builds `DataTablePagination` on `Button` instead.
- **`@tanstack/react-table`** — see above.
- **Client-side filtering, column resizing, row selection, virtualization, column visibility.** `ColumnDef<T>` leaves room for them; none is built.
- **Any feature UI.** `health` is the only feature and it stays the worked example.
- **Forms.** `Input`, `Label`, and `Select` ship as primitives; binding them to React Hook Form + Zod is **FORM-1**. Do not introduce a form abstraction here.
- **A component gallery / Storybook.** Not in the intake, and it would be the only test-shaped artifact in a repo that authors none.
- **Automated tests.** Standing project policy (`CONVENTIONS.md` § 16). See `## Test Plan`.
- **RTL icon mirroring as a blanket rule.** Only the four directional icons this story actually renders are handled (task 6). A general `[dir=rtl] svg { transform: scaleX(-1) }` would wrongly mirror checkmarks and spinners.

---

## Context — Read These Files First

1. `.squad/stories/internationalization-design-system/SUPPORTOS-11/intake.md` — the source story: four task blocks in the fenced **Description**, **no attachments, no acceptance criteria**. Done Criteria derive from the four **Outcome** lines.
2. `CONVENTIONS.md` — read § 2 (lines 36–47; the `PascalCase.tsx` rule that task 1 must carve an exemption from), § 3 (lines 50–66; `erasableSyntaxOnly` forbids `enum`, `verbatimModuleSyntax` needs `import type`), § 5 (lines 82–86; "`QueryBoundary` for every query result" — task 8 refines this), § 7 (lines 98–106; the placeholder task 10 replaces), § 14 (lines 199–214), § 17 (lines 241–248), and **all of § 18 (lines 251–357)**, especially the class-mapping table at lines 306–320.
3. `frontend/src/index.css` — all 36 lines. Line 1 literally says *"Minimal reset. UI-1 replaces this with Tailwind."* Lines 25–36 are story 05's direction rules, including the `html[lang='ar'] body` font swap at lines 34–36. **`shadcn init` overwrites this file — read it before running the CLI, not after.**
4. `frontend/index.html` — all 27 lines. Line 2 is `<html lang="en" dir="ltr">`; lines 8–24 are the anti-FOUC `<script>` that reads `supportos.language`. Task 3 extends that same script for the theme.
5. `frontend/src/shared/i18n/direction.ts` — all 20 lines. `applyDirection` (lines 6–10) is the **only** writer of `dir`/`lang`. Task 3's theme module must not touch those two attributes, and task 4 reads direction from here rather than adding a second source.
6. `frontend/src/shared/ui/` — read all six top-level components end to end. `Loading.tsx` (7–14), `Empty.tsx` (8–24), `ErrorState.tsx` (17–38), `QueryBoundary.tsx` (25–48), `AppErrorBoundary.tsx` (15–25 fallback, 32–49 class), `LanguageSwitcher.tsx` (16–33). Each carries a doc comment promising *"UI-1 replaces the internals … without changing this component's props."* **That promise is a contract; task 5 honours it.**
7. `frontend/src/shared/ui/toast/` — all five files. `ToastProvider.tsx` lines 52–70 is the markup task 5 restyles; `toastSink.ts` explains why sonner is out of scope.
8. `frontend/src/shared/lib/api/types.ts` — `ApiPagination` (lines 42–49) and `Page<T>` (lines 69–72). These are the exact shapes `DataTable` consumes.
9. `frontend/src/shared/lib/api/client.ts` — `api.getPage` (lines 110–122). Note it **throws `invalid_envelope`** when `meta.pagination` is missing; task 8's hook does not need to defend against a missing pagination block.
10. `frontend/.oxlintrc.json` — all 46 lines. `react/jsx-no-literals` is `"error"`; `react/only-export-components` is `["warn", { "allowConstantExport": true }]`; the `overrides` array has three entries. Task 7 adds a fourth.
11. `frontend/tsconfig.json` (3 lines: `files: []` + two references) and `frontend/tsconfig.app.json` (`paths` under the `/* Path alias */` comment, **no `baseUrl`**). Task 1 changes both — the shadcn CLI resolves aliases through `tsconfig.json`, which currently has no `compilerOptions` at all.
12. `backend/config/settings/base.py` lines 197–216 — `REST_FRAMEWORK`. Confirm `DEFAULT_FILTER_BACKENDS` is absent before task 9.
13. `backend/apps/core/pagination.py` — all 38 lines. `page_size_query_param = "page_size"` (line 20) and the `meta.pagination` block (lines 28–35) are the contract task 8's hook must emit and read.
14. `README.md` lines 313–334 (§ API conventions → Paginated) — the wire shape, and the note that `?page_size=` is **clamped, not rejected**, above `DRF_MAX_PAGE_SIZE`.
15. Before starting task 6, run the sweep grep yourself against the freshly generated files and compare with that task's table. If you find a physical class the table does not list, **add it** — the table was produced from the registry, and the registry moves.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Prefer shadcn primitives over hand-built ones.** | Intake, task 1 constraints | Twelve registry components adopted (task 6). The three deliberate exceptions — no `sonner`, no `pagination`, no `@tanstack/react-table` — each carry verified evidence in `## Story Goal` and are recorded in `CONVENTIONS.md` § 7. |
| **Tokens are the single styling source.** | Intake, task 1 constraints | `@theme inline` in `frontend/src/index.css` (task 2). No hex, `rgb()`, `oklch()`, or bare `px` literal in any component — Verification Step 5 greps. |
| **All primitives i18n- and RTL-aware.** | Intake, task 2 constraints | `Direction.DirectionProvider` (task 4) + the enumerated sweep (task 6) + `scripts/check-rtl.mjs` wired into CI (task 7). |
| **Reuse-first: features use these, not re-creations.** | Intake, task 2 constraints | `CONVENTIONS.md` § 7 + § 19 (task 10) and `frontend/src/README.md`. |
| **Features render loading/empty/error via shared components only.** | Intake, task 3 constraints | `QueryBoundary` for a single resource, `DataTable` for a list — both compose the *same* `Loading`/`Empty`/`ErrorState`. Task 8 states why `DataTable` cannot simply wrap `QueryBoundary`. |
| **All list screens use one table pattern; no bespoke tables.** | Intake, task 4 constraints | `shared/ui/data-table/` + `CONVENTIONS.md` § 19, with a copyable worked example. |
| **No hardcoded user-facing strings.** | Story 05, `CONVENTIONS.md` § 18 | Every new string lands in `common.json` for **both** `en` and `ar` (task 6's key table). |
| **Logical properties only.** | Story 05, `CONVENTIONS.md` lines 306–320 | `npm run check:rtl` (task 7), a real gate rather than a convention. |
| Config from `ENV`; no new secrets. | Story 01 `ENV` contract | **This story adds no environment variable.** Theme and language are per-browser choices, not deployment config. `.env.example` and the README env table are unchanged. |

---

## Frontend Tasks

### 1 — Tailwind v4, shadcn/ui, and wiring the CLI to *this* repo's structure

**Install.** From `frontend/`:

```powershell
npm install tailwindcss @tailwindcss/vite
npm install radix-ui class-variance-authority clsx tailwind-merge lucide-react
npm install -D tw-animate-css
```

Verified current versions: `tailwindcss` / `@tailwindcss/vite` **4.3.3** (peer `vite: ^5.2.0 || ^6 || ^7 || ^8` — our Vite 8.2.2 is in range), `radix-ui` **1.6.7** (peer `react: … || ^19.0`), `class-variance-authority` **0.7.1**, `tailwind-merge` **3.6.0**, `clsx` **2.1.1**, `lucide-react` **1.34.0** (peer `react: … || ^19.0.0`), `tw-animate-css` **1.4.0**.

**`radix-ui`, singular — not `@radix-ui/react-*`.** Verified from the registry: every primitive imports from the unified package, e.g. `button.tsx` does `import { Slot } from "radix-ui"` and `dialog.tsx` does `import { Dialog as DialogPrimitive } from "radix-ui"`. One dependency, not ten. Verified its only export path is `"."` — **there is no `radix-ui/direction` subpath**; task 4 needs `import { Direction } from 'radix-ui'`.

**No `tailwind.config.js`.** Tailwind v4 is CSS-first: configuration lives in `@theme` inside `src/index.css` (task 2). Do not create a JS config; a stray one is a second source of truth.

**File: `frontend/vite.config.ts`** — add the Tailwind plugin. Keep the existing `fileURLToPath`-based alias exactly as it is; do **not** swap it for the `path.resolve(__dirname, …)` form the shadcn docs show — this project is ESM (`"type": "module"`) and `__dirname` does not exist.

```ts
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

**File: `frontend/tsconfig.json`** — the shadcn CLI resolves `@/*` through the **solution** tsconfig, which currently has no `compilerOptions` at all. Without this the CLI writes unresolvable imports.

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**File: `frontend/tsconfig.app.json`** — add `"baseUrl": "."` to the `/* Path alias */` block, beside the existing `paths`. Leave every other option alone; in particular **do not relax `strict`, `noUnusedLocals`, `erasableSyntaxOnly`, or `verbatimModuleSyntax`** to make generated code compile. Verified against the registry output: none of the twelve components needs any of them relaxed (`skipLibCheck: true` is already on, which is what keeps Radix's own types out of the build).

**Back up `src/index.css` before initialising.** `shadcn init` overwrites it, and its 36 lines include story 05's direction rules:

```powershell
Copy-Item src\index.css src\index.css.bak
```

**Initialise.**

```powershell
npx shadcn@latest init
```

Answer: style **new-york**, base colour **slate**, CSS variables **yes**. Verified CLI version at time of writing: **4.19.0**.

**Create file: `frontend/components.json`** — if `init` did not produce exactly this, edit it until it does. **These aliases are the whole point of this task:** the CLI's defaults are `@/components/ui` and `@/lib/utils`, and `frontend/src/README.md` lines 6–10 forbid both ("There is no top-level `components/`, `utils/`, `services/`, or `helpers/`, and there never will be").

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/shared/ui",
    "ui": "@/shared/ui/primitives",
    "utils": "@/shared/lib/cn",
    "lib": "@/shared/lib",
    "hooks": "@/shared/hooks"
  }
}
```

`"tailwind.config": ""` is correct for v4 and is not an oversight.

**`aliases.utils` names a module, not a folder** — the CLI writes the `cn` helper to `frontend/src/shared/lib/cn.ts`:

```ts
import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes, last-wins on conflicts. Every primitive uses this. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

If the CLI emits `import { clsx, type ClassValue } from 'clsx'`, split it into the two-line form above — `verbatimModuleSyntax` accepts inline `type` specifiers, but `CONVENTIONS.md` § 3 and every existing module in `src/` use a separate `import type` line. Match the repo.

**`aliases.ui` points at `primitives/`, and that is deliberate.** `CONVENTIONS.md` § 2 line 43 requires `PascalCase.tsx` for React components; the shadcn registry names its files `button.tsx`, `dropdown-menu.tsx`. Renaming them breaks `shadcn add` and `shadcn diff` for good. So the naming rule becomes a **directory** rule instead of a fight:

- `src/shared/ui/primitives/` — CLI-managed, registry file names (lowercase-kebab). Ours to correct (task 6), not to rename.
- `src/shared/ui/` — everything we author, `PascalCase.tsx` as § 2 requires.

Task 10 writes this exemption into § 2. Without it, an executor either breaks the CLI or violates § 2 silently.

---

### 2 — Design tokens and the theme layer

**File: `frontend/src/index.css`** — the file `shadcn init` just rewrote. Final structure, top to bottom:

```css
@import 'tailwindcss';
@import 'tw-animate-css';

@custom-variant dark (&:is(.dark *));

/* --- Tokens: the single styling source. Nothing below hardcodes a colour,
   radius, or font stack. See CONVENTIONS.md §19. -------------------------- */

:root {
  /* …the oklch palette shadcn init wrote: --background, --foreground, --card,
     --card-foreground, --popover, --popover-foreground, --primary,
     --primary-foreground, --secondary, --secondary-foreground, --muted,
     --muted-foreground, --accent, --accent-foreground, --destructive,
     --border, --input, --ring, --chart-1…5, --sidebar*, and --radius.
     Keep them verbatim — do not retype them by hand. */

  /* Ours, added on top: */
  --font-sans:
    system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-arabic: 'Segoe UI', Tahoma, 'Noto Naskh Arabic', system-ui, sans-serif;
}

.dark {
  /* …the dark palette shadcn init wrote. */
}

@theme inline {
  /* …the --color-* / --radius-* mappings shadcn init wrote. */

  --font-sans: var(--font-sans);
  --font-arabic: var(--font-arabic);
}

/* --- Base layer ---------------------------------------------------------- */

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground font-sans;
    /* `dir` on <html> drives this; never set direction per component.
       See CONVENTIONS.md §18. */
    text-align: start;
  }

  /* Arabic glyphs need a font stack that has them. Preserved from story 05,
     now token-driven so tokens stay the single styling source. */
  html[lang='ar'] body {
    font-family: var(--font-arabic);
  }
}
```

Reinstate the two direction rules from `src/index.css.bak` — the `text-align: start` on `body` and the `html[lang='ar'] body` font swap — exactly as shown. **Then delete `src/index.css.bak`.** It must not be committed.

**Do not hand-retype the oklch palette.** Take whatever `shadcn init` wrote and add to it. Retyping 60 colour values by hand is how a token drifts from the upstream palette.

**Delete the reset that Tailwind's preflight now owns.** The `box-sizing` block (old lines 3–7) and `html, body { margin: 0 }` (old lines 9–12) are both in Tailwind's preflight. Keeping them is duplication, not safety.

**Two tokens, deliberately spelled `--font-arabic` and not `--font-ar`.** § 2 forbids abbreviations that are not domain vocabulary.

**File: `frontend/src/main.tsx`** — `import './index.css'` at line 13 stays. Do not move it above the i18n side-effect import; CSS import order does not matter to Vite, and i18n must still initialise first.

---

### 3 — Dark mode: `src/shared/theme/`

The intake asks for a "dark-mode-ready theme". `next-themes` (which shadcn's `sonner` entry pulls in) is not installed and is not needed — this is ~60 lines and it mirrors `shared/i18n/` exactly, so there is one pattern in the codebase for "a document-level preference persisted per browser", not two.

**The attribute split, stated once so nobody duplicates a writer.** `shared/i18n/direction.ts` owns `<html dir>` and `<html lang>`. `shared/theme/theme.ts` owns `<html class="dark">`. Different attributes, one writer each, no overlap. `CONVENTIONS.md` § 18's "direction.ts is the only place that writes `document.documentElement`" means *for `dir` and `lang`*; task 10 makes that explicit rather than leaving the apparent contradiction.

**Create file: `frontend/src/shared/theme/config.ts`**

```ts
/**
 * The theme contract. Everything else imports from here — no module hardcodes
 * a theme name or the storage key.
 */
export const THEMES = ['light', 'dark', 'system'] as const

export type Theme = (typeof THEMES)[number]

export const FALLBACK_THEME: Theme = 'system'

/** Also read by the inline anti-FOUC script in index.html — keep in sync. */
export const THEME_STORAGE_KEY = 'supportos.theme'

/** The class `@custom-variant dark` in index.css matches on. */
export const DARK_CLASS = 'dark'

export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

export function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value)
}
```

`as const` plus indexed access, **not** `enum` — `erasableSyntaxOnly` forbids `enum` (`CONVENTIONS.md` § 3).

**Create file: `frontend/src/shared/theme/theme.ts`**

A module-level store read through `useSyncExternalStore`, not React state — the theme must be settable from outside the tree and must survive any component unmounting, exactly like `direction.ts`.

```ts
import { DARK_CLASS, DARK_MEDIA_QUERY, FALLBACK_THEME, THEME_STORAGE_KEY, isTheme } from './config'
import type { Theme } from './config'

const listeners = new Set<() => void>()

function read(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored && isTheme(stored) ? stored : FALLBACK_THEME
  } catch {
    // Private mode, or storage disabled. Fall back rather than crash at boot.
    return FALLBACK_THEME
  }
}

let current: Theme = read()

function prefersDark(): boolean {
  return window.matchMedia(DARK_MEDIA_QUERY).matches
}

/** The only place the `dark` class is written. direction.ts owns dir/lang. */
function apply(theme: Theme): void {
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark())
  document.documentElement.classList.toggle(DARK_CLASS, isDark)
}

export function getTheme(): Theme {
  return current
}

export function setTheme(next: Theme): void {
  current = next
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // Nothing to do — the theme still applies for this session.
  }
  apply(next)
  listeners.forEach((listener) => listener())
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function initTheme(): void {
  apply(current)
  // Follow the OS only while the user has chosen 'system'.
  window.matchMedia(DARK_MEDIA_QUERY).addEventListener('change', () => {
    if (current === 'system') apply(current)
  })
}
```

`getTheme` returns a string, so `useSyncExternalStore`'s snapshot is referentially stable with no memoisation.

**Create file: `frontend/src/shared/theme/useTheme.ts`**

```ts
import { useSyncExternalStore } from 'react'

import { getTheme, setTheme, subscribeTheme } from './theme'
import type { Theme } from './config'

export function useTheme(): { theme: Theme; setTheme: (next: Theme) => void } {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getTheme)
  return { theme, setTheme }
}
```

The third argument (server snapshot) is passed so the signature is complete; this app never server-renders.

**Create file: `frontend/src/shared/theme/index.ts`**

```ts
import { initTheme } from './theme'

initTheme()

export { getTheme, setTheme, subscribeTheme } from './theme'
export { useTheme } from './useTheme'
export { THEMES } from './config'
export type { Theme } from './config'
```

**File: `frontend/src/main.tsx`** — add `import './shared/theme'` directly below the existing `import './shared/i18n'` at line 7, under the same comment block. Both are side-effect imports that must run before the first render.

**File: `frontend/index.html`** — extend the existing anti-FOUC script (lines 8–24). Without this, a dark-mode user gets a white flash on every load, for the same reason an Arabic user got an LTR flash: the bundle runs after first paint. Add inside the existing `try` block, after the language branch:

```html
        var theme = window.localStorage.getItem('supportos.theme')
        if (theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark')
        }
```

The condition mirrors `apply()` in `theme.ts` — including treating a missing value as `system`. **Two copies of this logic now exist, in two languages.** Both are commented as needing to stay in sync; that is the price of no flash, and it is the same trade story 05 already made for `dir`.

**Create file: `frontend/src/shared/ui/ThemeToggle.tsx`**

A `DropdownMenu` with one item per `THEMES` entry, labelled from `common:theme.<value>`, trigger a `Button variant="ghost" size="icon"` showing `SunIcon` / `MoonIcon` / `MonitorIcon` from `lucide-react` for the active theme. `aria-label` from `common:theme.label`. No `localStorage` and no `document` access in this component — it calls `setTheme` and nothing else. Two writers of one piece of state is how they drift.

---

### 4 — The Radix direction bridge

**Nothing in tasks 5–8 is RTL-correct without this task, and it produces no visible change in English.** Verified above: `useDirection()` reads a React context and defaults to the literal `'ltr'`.

**Create file: `frontend/src/shared/i18n/useDirection.ts`**

Direction as React state, derived from the one existing source of truth. It does not write `dir`; `direction.ts` still does that.

```ts
import { useSyncExternalStore } from 'react'

import i18next from 'i18next'

import { FALLBACK_LANGUAGE, isRtl } from './config'

function subscribe(onChange: () => void): () => void {
  i18next.on('languageChanged', onChange)
  return () => {
    i18next.off('languageChanged', onChange)
  }
}

function snapshot(): 'ltr' | 'rtl' {
  return isRtl(i18next.resolvedLanguage ?? i18next.language ?? FALLBACK_LANGUAGE) ? 'rtl' : 'ltr'
}

/**
 * The active direction, for the handful of consumers that need it in React:
 * Radix's DirectionProvider, and the two directional icons in the data table.
 *
 * Subscribes to the same i18next event `direction.ts` uses, so there is one
 * source of truth and no chance of the two disagreeing. Reading
 * `document.documentElement.dir` instead would work but would make the DOM the
 * state store, which nothing else in this codebase does.
 */
export function useDirection(): 'ltr' | 'rtl' {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
```

`snapshot` returns one of two string literals, so the snapshot is referentially stable.

**File: `frontend/src/app/providers.tsx`** — wrap the tree. `Direction.DirectionProvider` must sit **inside** `AppErrorBoundary` (so a crash in it is caught) and **outside** `QueryClientProvider` (so every rendered primitive is covered). Replace the return block at lines 28–37:

```tsx
  const dir = useDirection()

  return (
    <AppErrorBoundary>
      {/*
        Radix reads direction from THIS context, not from <html dir>. Verified:
        useDirection() in @radix-ui/react-direction falls back to the literal
        'ltr' and never inspects the DOM. Without this provider every Select,
        DropdownMenu, and Tabs keeps LTR arrow-key and side/align behaviour in
        Arabic — silently. See CONVENTIONS.md §19.
      */}
      <Direction.DirectionProvider dir={dir}>
        <ToastProvider>
          <QueryClientProvider client={queryClient}>
            {children}
            {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
          </QueryClientProvider>
        </ToastProvider>
      </Direction.DirectionProvider>
    </AppErrorBoundary>
  )
```

Import as `import { Direction } from 'radix-ui'` — verified the package exposes only the `"."` entry point, so `radix-ui/direction` does not resolve.

---

### 5 — Restyle the existing shared components; add the Confirm pattern

**The props of every component in this task are frozen.** Each carries a doc comment promising UI-1 would not change them. A prop change here breaks story 03's contract and is a defect, not a refactor.

**File: `frontend/src/shared/ui/Loading.tsx`** — keep the `{ label }: { label?: string }` signature, the `role="status"`, and the `aria-live="polite"`. Add a `Loader2Icon` from `lucide-react` with `animate-spin`, muted text, `gap-2`, and `inline-flex items-center`. A spinner's rotation is not directional semantics — **do not** mirror it in RTL.

**File: `frontend/src/shared/ui/Empty.tsx`** — keep `{ title?, description?, action? }` and `role="status"`. Render inside a `Card`: centred, `text-muted-foreground` description, `action` in the footer. Use `text-center` (symmetric, so direction-neutral), never `text-left`.

**File: `frontend/src/shared/ui/ErrorState.tsx`** — keep `{ error, onRetry? }`, `role="alert"`, the `t('errors:' + error.code, { defaultValue: error.message })` lookup at line 19, and the `error.debug ?` guard at line 29. Render via the `Alert` primitive tone `destructive`; `onRetry` becomes `<Button variant="outline" size="sm">`; the `<details>` block keeps its `<pre>` but gains `overflow-x-auto text-xs`. **`<pre>` content must be `dir="ltr"`** — a stack trace is code, and bidi reordering makes it unreadable in an RTL document. This is `CONVENTIONS.md` § 18's "wrap the Latin run in an element with `dir=\"ltr\"`" rule, and it is the first real instance of it.

`Alert` is a thirteenth registry component; add it with `npx shadcn@latest add alert` alongside task 6's batch.

**File: `frontend/src/shared/ui/QueryBoundary.tsx`** — **no change**, other than confirming it still compiles. Its three branches (lines 34–47) now render restyled children for free. That is the payoff for freezing the props.

**File: `frontend/src/shared/ui/toast/ToastProvider.tsx`** — restyle the markup at lines 52–70 only. Keep `AUTO_DISMISS_MS`, the `timers` ref, the `dismiss`/`toast` callbacks, the `setToastSink` effect at lines 47–50, and the `ToastContext.Provider` value shape. Concretely:

- The container becomes a fixed stack: `fixed z-50 bottom-4 end-4 flex flex-col gap-2 w-full max-w-sm` — `end-4`, **never** `right-4`, so it lands bottom-left in Arabic.
- Each toast becomes a `Card`-like surface with `data-tone` driving the colour via `data-[tone=error]:border-destructive` and friends. Keep `data-tone` — it is the styling hook and it is already there.
- The dismiss button becomes `<Button variant="ghost" size="icon-sm">` with `<XIcon />`, keeping `aria-label={t('actions.dismiss')}` from line 62. Replace the literal `×` at line 64 with the icon: a bare `×` is a text child that `react/jsx-no-literals` flags, and it is also a worse screen-reader experience than an icon plus the existing `aria-label`.
- Keep `role="status" aria-live="polite" aria-atomic="true"` on the container exactly as at line 55.

**File: `frontend/src/shared/ui/LanguageSwitcher.tsx`** — replace the native `<select>` (lines 22–31) with the shadcn `Select` primitive, keeping the zero-prop signature, the `common:language.label` label, one option per `SUPPORTED_LANGUAGES`, the `t('language.' + code)` labels, and the `void i18n.changeLanguage(...)` call. It must still touch neither `localStorage` nor `document.documentElement` (lines 10–14 explain why).

`Select` is not a native form control — when FORM-1 lands it integrates through React Hook Form's `Controller`, not a `register()` ref. Note that in the component's doc comment so FORM-1 does not discover it the hard way.

**File: `frontend/src/app/RootLayout.tsx`** — replace the bare `<main>` (lines 8–13) with a real shell: a `<header>` holding `t('app.name')` plus `<LanguageSwitcher />` and `<ThemeToggle />` in an `ms-auto` group, then `<main>` with `<Outlet />`. Use `container mx-auto px-4`, `border-b`, `bg-background`. **`ms-auto`, never `ml-auto`.** Update the doc comment at lines 5–6 — it says "UI-1 owns layout", and UI-1 is now this story.

**Create `frontend/src/shared/ui/confirm/`** — four files, mirroring `shared/ui/toast/` file-for-file, because that shape is already the precedent in this codebase for "a provider plus an imperative hook":

- **`types.ts`**
  ```ts
  export type ConfirmOptions = {
    /** Already translated by the caller — this module never guesses copy. */
    title: string
    description?: string
    /** Label for the confirming action. Defaults to common:actions.confirm. */
    confirmLabel?: string
    /** Label for the cancelling action. Defaults to common:actions.cancel. */
    cancelLabel?: string
    /** Render the confirm button as destructive. Default: false. */
    destructive?: boolean
  }
  ```
- **`ConfirmContext.ts`** — `createContext<ConfirmContextValue | null>(null)`, where `ConfirmContextValue = { confirm: (options: ConfirmOptions) => Promise<boolean> }`.
- **`ConfirmProvider.tsx`** — holds one pending `{ options, resolve }` in state and renders a single `AlertDialog`. `confirm()` returns a promise that resolves `true` on the action and `false` on cancel, on `Escape`, and on overlay dismiss. `AlertDialogAction`/`AlertDialogCancel` carry the labels, falling back to `t('actions.confirm')` / `t('actions.cancel')`.
- **`useConfirm.ts`** — copy `useToast.ts` lines 6–12 exactly, including throwing `'useConfirm() must be used within a <ConfirmProvider>.'` **in English** — a programmer error, per `CONVENTIONS.md` § 18's "what stays in English".

**One resolve, exactly once.** Cancel, `Escape`, and overlay-click all funnel through `AlertDialog`'s `onOpenChange(false)`. Resolve there and clear the pending state in the same update, or a rejected confirm can resolve twice and a caller's `await` fires its side effect on a dialog the user dismissed.

**File: `frontend/src/app/providers.tsx`** — add `<ConfirmProvider>` immediately inside `<ToastProvider>`. A confirm dialog's own action may raise a toast, so toast must be the outer of the two.

---

### 6 — The primitive set, and the RTL/i18n sweep that makes it honest

**Add the components.** From `frontend/`:

```powershell
npx shadcn@latest add button input label select dialog alert-dialog dropdown-menu table tabs badge card skeleton alert
```

Thirteen files land in `frontend/src/shared/ui/primitives/`. Do **not** add `sonner` or `pagination` — see `## Story Goal`.

**Then run the sweep. Every row below was verified against the live registry, not inferred.**

#### 6a — Physical direction classes

| File | Generated | Replace with |
|---|---|---|
| `table.tsx` `TableHead` | `text-left` | `text-start` |
| `table.tsx` `TableHead`, `TableCell` | `[&:has([role=checkbox])]:pr-0` (both) | `[&:has([role=checkbox])]:pe-0` |
| `dialog.tsx` `DialogContent` close button | `absolute top-4 right-4` | `absolute top-4 end-4` |
| `dialog.tsx` `DialogHeader` | `sm:text-left` | `sm:text-start` |
| `alert-dialog.tsx` `AlertDialogHeader` | `sm:group-data-[size=default]/alert-dialog-content:text-left` | `…:text-start` |
| `dropdown-menu.tsx` `DropdownMenuItem` | `data-[inset]:pl-8` | `data-[inset]:ps-8` |
| `dropdown-menu.tsx` `CheckboxItem`, `RadioItem` | `py-1.5 pr-2 pl-8` (both) | `py-1.5 pe-2 ps-8` |
| `dropdown-menu.tsx` `CheckboxItem`, `RadioItem` indicators | `absolute left-2` (both) | `absolute start-2` |
| `dropdown-menu.tsx` `DropdownMenuLabel` | `data-[inset]:pl-8` | `data-[inset]:ps-8` |
| `dropdown-menu.tsx` `DropdownMenuShortcut` | `ml-auto` | `ms-auto` |
| `dropdown-menu.tsx` `SubTrigger` | `data-[inset]:pl-8` | `data-[inset]:ps-8` |
| `dropdown-menu.tsx` `SubTrigger` chevron | `<ChevronRightIcon className="ml-auto size-4" />` | `className="ms-auto size-4 rtl:rotate-180"` |
| `select.tsx` `SelectItem` | `py-1.5 pr-8 pl-2` | `py-1.5 pe-8 ps-2` |
| `select.tsx` `SelectItem` indicator | `absolute right-2` | `absolute end-2` |
| `tabs.tsx` `TabsTrigger` | `group-data-[orientation=vertical]/tabs:after:-right-1` | `…:after:-end-1` |

**The one sanctioned physical exception.** `dialog.tsx` `DialogContent` and `alert-dialog.tsx` `AlertDialogContent` centre with `fixed top-[50%] left-[50%] … translate-x-[-50%] translate-y-[-50%]`. **Leave these as generated.** `left` + a fixed `translate-x` is symmetric and therefore direction-neutral; switching to `start-[50%]` would *break* RTL, because `start` flips with direction while `translate-x` does not — the dialog would land off-screen in Arabic. Task 7's check script allowlists exactly this idiom.

`rtl:` is a first-class Tailwind v4 variant; no plugin is needed for `rtl:rotate-180`.

#### 6b — Hardcoded English

Verified: `dialog.tsx` is the only generated file with user-facing text, at two sites — and **both are direct JSX text children, so `react/jsx-no-literals` (`"error"`) fails the build until they are fixed.**

| File | Site | Generated | Becomes |
|---|---|---|---|
| `dialog.tsx` | `DialogContent` close button | `<span className="sr-only">Close</span>` | `t('actions.close')` |
| `dialog.tsx` | `DialogFooter` `showCloseButton` branch | `<Button variant="outline">Close</Button>` | `t('actions.close')` |

Add `import { useTranslation } from 'react-i18next'` and call it in `DialogContent` and `DialogFooter`. This permanently marks `dialog.tsx` as modified in `shadcn diff` — **that is the accepted cost**, and the file gets a header comment saying so:

```tsx
// Modified from the shadcn registry: physical direction classes replaced with
// logical ones, "use client" removed, and the two "Close" literals routed
// through i18next. `shadcn diff dialog` will always report this file as
// changed. See CONVENTIONS.md §19 before re-running `shadcn add dialog`.
```

Put an equivalent header on every file task 6a touched.

#### 6c — `"use client"`

Verified present in **seven** files: `alert-dialog.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `label.tsx`, `select.tsx`, `table.tsx`, `tabs.tsx`. Delete the directive and the blank line after it. This is a Vite SPA — there is no server component boundary, and the string is dead weight that reads as if there were one.

#### 6d — New translation keys

**File: `frontend/src/shared/i18n/locales/en/common.json`** — extend the existing 16 lines. `actions` and `states` already exist; merge into them rather than adding a second block.

```json
{
  "actions": {
    "close": "Close",
    "confirm": "Confirm",
    "cancel": "Cancel"
  },
  "theme": {
    "label": "Theme",
    "light": "Light",
    "dark": "Dark",
    "system": "System"
  },
  "table": {
    "sortAscending": "Sort ascending",
    "sortDescending": "Sort descending",
    "clearSort": "Clear sorting",
    "noResults": "No results.",
    "previousPage": "Previous page",
    "nextPage": "Next page",
    "pageOf": "Page {{page}} of {{total}}",
    "rowCount": "{{count}} result",
    "rowCount_other": "{{count}} results"
  }
}
```

`rowCount` / `rowCount_other` is i18next's own plural suffix convention — do not hand-roll a count branch in a component.

**Create the `ar` counterparts in `frontend/src/shared/i18n/locales/ar/common.json`.** Arabic has six plural categories; i18next expects `rowCount_zero`, `_one`, `_two`, `_few`, `_many`, `_other` for `ar`. **Supply all six.** A missing category falls back to English silently — the exact failure `CONVENTIONS.md` § 18 warns about. Verification Step 4 compares key sets, and it will catch a missing category only if you list them; the honest check is to render the table with 0, 1, 2, 3, 11, and 100 rows in Arabic.

**No `resources.ts` change.** These keys go into the existing `common` namespace; the registry at lines 17–20 is untouched. Types flow automatically through `AppResources`.

---

### 7 — Lint config and the logical-property gate

**File: `frontend/.oxlintrc.json`** — add a fourth entry to the existing `overrides` array. Keep the three that are there.

```jsonc
    {
      "files": ["**/shared/ui/primitives/**"],
      "rules": {
        "react/only-export-components": "off"
      }
    }
```

Every registry component co-exports a `cva` result beside its component — verified `button.tsx` ends `export { Button, buttonVariants }` and `badge.tsx` does the same. `allowConstantExport: true` should already permit a `const`, but this directory is CLI-managed and we do not get to restructure its exports, so the rule is turned off for it explicitly rather than left to depend on how oxlint classifies a `cva()` call. **Do not turn off `react/jsx-no-literals` here** — task 6b's two `Close` literals are exactly the kind of thing this rule must keep catching in generated code.

**Create file: `frontend/scripts/check-rtl.mjs`**

`CONVENTIONS.md` § 18's logical-property rule is the central constraint of this story and **nothing enforces it.** Story 05 could verify it with a one-off grep because `index.css` was 36 lines; this story adds thirteen generated files and will add more on every future `shadcn add`. A gate, not a convention.

```js
// Fails the build on physical (direction-dependent) CSS in src/.
// The rule this enforces is CONVENTIONS.md §18; the reason it is a script and
// not a lint rule is that oxlint cannot see inside a className string.
//
// This is a tripwire, not a proof: it reads text, so a class assembled at
// runtime slips through. Grep by hand when you touch layout.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

const ROOT = 'src'
const EXTENSIONS = new Set(['.ts', '.tsx', '.css'])

const PATTERNS = [
  // Tailwind physical spacing / borders / radii, e.g. `pl-8`, `-mr-1`.
  /(?<![\w-])-?(?:pl|pr|ml|mr|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br)-/g,
  // The same utilities with no scale suffix, e.g. `border-l`.
  /(?<![\w-])(?:border-[lr]|rounded-[lr])(?![\w-])/g,
  // Physical inset utilities, e.g. `right-4`.
  /(?<![\w-])-?(?:left|right)-/g,
  // Physical text alignment, both Tailwind and raw CSS.
  /(?<![\w-])text-(?:left|right)(?![\w-])/g,
  /text-align:\s*(?:left|right)/g,
  // Raw CSS physical box properties.
  /(?:margin|padding|border|inset)-(?:left|right)\b/g,
]

/**
 * The one sanctioned physical idiom: centring a fixed overlay with
 * `left-[50%]` plus `translate-x-[-50%]` is symmetric, so it is
 * direction-neutral by construction. A logical `start-[50%]` would be WRONG —
 * `start` flips with direction, `translate-x` does not. Skips the whole line,
 * which is acceptable because the idiom only ever appears inside a fixed
 * overlay's className. See Story 06 task 6a.
 */
const CENTERING = /left-(?:1\/2|\[50%\]).*translate-x-(?:\[-50%\]|1\/2|-1\/2)/

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) yield* walk(path)
    else if (EXTENSIONS.has(extname(path))) yield path
  }
}

let failures = 0
for (const path of walk(ROOT)) {
  const lines = readFileSync(path, 'utf8').split('\n')
  lines.forEach((line, index) => {
    if (CENTERING.test(line)) return
    for (const pattern of PATTERNS) {
      for (const match of line.matchAll(pattern)) {
        process.stdout.write(`${path}:${index + 1}  ${match[0]}\n`)
        failures += 1
      }
    }
  })
}

if (failures > 0) {
  process.stdout.write(
    `\n${failures} physical direction ${failures === 1 ? 'utility' : 'utilities'} found. ` +
      'Use the logical equivalent — see CONVENTIONS.md §18.\n',
  )
  process.exit(1)
}
process.stdout.write('check:rtl — no physical direction utilities in src/.\n')
```

Uses `process.stdout.write`, not `console.log`: `no-console` is `"error"` in `.oxlintrc.json` and the only override is for `shared/lib/logger.ts`. Do not add a fifth override for a build script.

**File: `frontend/package.json`** — add the script beside `lint`:

```json
    "check:rtl": "node scripts/check-rtl.mjs",
```

**File: `.github/workflows/lint.yml`** — add a step to the `frontend` job, between `prettier --check` and `build`:

```yaml
      - name: check:rtl (logical CSS properties)
        run: npm run check:rtl
```

Placed before `build` so the cheap check fails first. **Do not add it to `.githooks/pre-commit`** — that hook is documented as running only `--check-only` style gates, and a third frontend command there slows every commit for a rule CI already enforces.

**Run it against the tree before task 6's sweep and after.** Before: it must report every row in task 6a's table. After: zero. That before/after is the proof both the sweep and the script are real.

---

### 8 — `DataTable`: one pattern for every list screen

Server-driven throughout, because the backend is (`backend/apps/core/pagination.py` lines 20–35). No client-side row model, and no `@tanstack/react-table` — see `## Story Goal`.

**Create file: `frontend/src/shared/ui/data-table/types.ts`**

```ts
import type { ReactNode } from 'react'

export type SortDirection = 'asc' | 'desc'

/** `null` means "server default order". */
export type SortState = { field: string; direction: SortDirection } | null

export type ColumnDef<T> = {
  /**
   * Stable identity. When `sortable` is true this is also the field name sent
   * as `?ordering=`, so it must match the backend serializer field exactly.
   */
  id: string
  /** Header copy, already translated by the caller. */
  header: string
  cell: (row: T) => ReactNode
  /** Opt into server-side sorting. Default: false. */
  sortable?: boolean
  /**
   * Logical alignment. `'end'` for numeric columns. Rendered as
   * `text-start`/`text-end` — never `text-left`/`text-right`.
   */
  align?: 'start' | 'end'
}
```

`ColumnDef<T>` deliberately has no `accessorKey`. A `cell: (row) => ReactNode` covers the accessor case in one line (`(row) => row.name`) and covers the formatted case — which is most of them, since every date and number must go through `useFormatters()` per `CONVENTIONS.md` § 18 — without a second mechanism.

**Create file: `frontend/src/shared/ui/data-table/useServerTable.ts`**

```ts
import { useCallback, useMemo, useState } from 'react'

import type { SortState } from './types'

/** Query params for a paginated list endpoint. Wire keys are snake_case. */
export type ServerTableParams = {
  page: number
  page_size?: number
  ordering?: string
}

/**
 * Pagination and sort state for a list screen, plus the params object to feed
 * a query key and `api.getPage`.
 *
 * Sorting is server-side: `ordering` follows DRF's OrderingFilter convention
 * (`field` ascending, `-field` descending). See CONVENTIONS.md §19.
 */
export function useServerTable(options?: { pageSize?: number; initialSort?: SortState }) {
  const [page, setPage] = useState(1)
  const [sort, setSortState] = useState<SortState>(options?.initialSort ?? null)

  // Changing the sort re-orders the whole result set, so page 2 of the old
  // order is meaningless. Reset, or the user lands on an unrelated page.
  const setSort = useCallback((next: SortState) => {
    setSortState(next)
    setPage(1)
  }, [])

  const params = useMemo<ServerTableParams>(
    () => ({
      page,
      ...(options?.pageSize ? { page_size: options.pageSize } : {}),
      ...(sort ? { ordering: `${sort.direction === 'desc' ? '-' : ''}${sort.field}` } : {}),
    }),
    [page, sort, options?.pageSize],
  )

  return { page, sort, params, setPage, setSort }
}
```

**Create file: `frontend/src/shared/ui/data-table/DataTablePagination.tsx`**

Props: `{ pagination: ApiPagination; onPageChange: (page: number) => void }`. `ApiPagination` comes from `@/shared/lib/api/types` (lines 42–49) — do not redeclare it.

- Two `<Button variant="outline" size="icon">`, disabled from `previous === null` / `next === null`. **Drive `disabled` off the `previous`/`next` links, not off arithmetic on `page`** — the backend already computed them, and duplicating that logic is how the two disagree at the boundary.
- **Icons flip with direction.** `const dir = useDirection()`, then previous is `dir === 'rtl' ? ChevronRightIcon : ChevronLeftIcon` and next is the other. A chevron is directional semantics, unlike a spinner. `rtl:rotate-180` would work too; pick the icon swap so the two buttons stay symmetric and note the choice in a comment.
- `aria-label` from `common:table.previousPage` / `common:table.nextPage`.
- Between them, `t('table.pageOf', { page: pagination.page, total: pagination.num_pages })`.
- The row count as `t('table.rowCount', { count: pagination.count })` — i18next selects the plural form.
- **Format `count`, `page`, and `num_pages` through `useFormatters().number`.** They are numbers rendered to a user; `CONVENTIONS.md` § 18 forbids inline `Intl` and bare interpolation of a raw number is the same mistake in a thinner disguise.
- Layout `flex items-center justify-between gap-2`, buttons in a `flex gap-1` group. No `ml-*`/`mr-*`.

**Create file: `frontend/src/shared/ui/data-table/DataTable.tsx`**

```tsx
type DataTableProps<T> = {
  columns: readonly ColumnDef<T>[]
  query: UseQueryResult<Page<T>, unknown>
  rowKey: (row: T) => string
  sort: SortState
  onSortChange: (next: SortState) => void
  onPageChange: (page: number) => void
  /** Visually-hidden <caption>. Required for a screen reader to name the table. */
  caption: string
  empty?: ReactNode
}
```

Behaviour:

- The `<Table>`, `<TableHeader>`, and `<caption className="sr-only">` render in **every** state. A table whose headers vanish while loading reflows the page on every fetch.
- **`<TableBody>` holds exactly one of four things**, and each is a real `<TableRow>`:
  - pending → three `<TableRow>`s of `<Skeleton className="h-4 w-full" />` cells, one per column;
  - error → one `<TableRow><TableCell colSpan={columns.length}>` containing `<ErrorState error={…} onRetry={() => void query.refetch()} />`;
  - empty (`query.data.items.length === 0`) → one full-width cell containing `empty ?? <Empty title={t('table.noResults')} />`;
  - otherwise → the rows.
- Error normalisation copies `QueryBoundary.tsx` lines 37–40 exactly: `query.error instanceof ApiRequestError ? query.error : new ApiRequestError({ code: 'unknown_error', message: t('states.error.generic') })`.
- A `sortable` column's `<TableHead>` renders a `<Button variant="ghost" size="sm">` cycling `asc → desc → null`, with `aria-sort` set to `ascending`/`descending`/`none` and the button's `aria-label` from `common:table.sortAscending` / `sortDescending` / `clearSort`. Indicator icons: `ChevronUpIcon` / `ChevronDownIcon` — vertical, so no mirroring.
- `align: 'end'` renders `text-end`. `align` defaults to `'start'`.
- `<DataTablePagination>` renders below the table whenever `query.data` exists.

**Why `DataTable` does not wrap `QueryBoundary`, and what that means for `CONVENTIONS.md` § 5.** § 5 says "use `QueryBoundary` for every query result". `QueryBoundary` returns `<div role="alert">` / `<div role="status">` for its non-success branches (lines 34–41), and a `<div>` is not a permitted child of `<tbody>` — the browser hoists it out of the table, which breaks both the layout and the accessibility tree. So `DataTable` is the **list-shaped sibling** of `QueryBoundary`: it renders the same `Loading`/`Empty`/`ErrorState` components, inside a `<TableCell colSpan>` where a `<div>` is valid. Task 10 amends § 5 to say this in one sentence. **A feature still never hand-rolls an `isPending`/`isError` branch** — that rule is unchanged; there are now two sanctioned components implementing it instead of one.

**Verification has no production consumer, and that is a real gap — here is how to close it honestly.** No paginated endpoint exists; `/api/health/` is the only route and returns a bare object. So:

1. Create `frontend/src/features/health/components/ScratchDataTable.tsx` with a hand-built `UseQueryResult<Page<Row>>`-shaped object and a `Row = { id: string; name: string; opened: string; amount: number }` fixture of ~30 rows, `amount` and `opened` rendered through `useFormatters()`.
2. Render it temporarily from `HealthPage` and walk Verification Steps 7–9 against it in both languages and both themes.
3. **Delete the file and the `HealthPage` edit before committing.** `git status` must be clean of it. It is a harness, not a deliverable — and a committed fixture with no consumer is the "dumping ground" `frontend/src/README.md` lines 30–33 exists to prevent.

`npm run build` still proves the generic contract compiles, and `CONVENTIONS.md` § 19 carries the copyable worked example the first real list feature starts from. **Say plainly in the story report that `DataTable` ships unconsumed.** The first list feature is where it earns its keep, and it will need adjustment there.

---

## Backend Tasks

### 9 — Make `?ordering=` a real contract

Verified: `REST_FRAMEWORK` (`backend/config/settings/base.py` lines 197–216) has **no `DEFAULT_FILTER_BACKENDS`**, so the `ordering` param task 8 emits is silently ignored today. Shipping a sort UI against a param nothing reads is worse than shipping no sort UI.

**File: `backend/config/settings/base.py`** — add one key inside `REST_FRAMEWORK`, directly after `"DEFAULT_PARSER_CLASSES"`:

```python
    # OrderingFilter is what makes the frontend's `?ordering=field` /
    # `?ordering=-field` contract real — see CONVENTIONS.md §19 and
    # frontend/src/shared/ui/data-table/useServerTable.ts. Inert until a list
    # view exists: a view must declare `ordering_fields` (or the filter falls
    # back to its serializer's fields) before any column becomes sortable.
    "DEFAULT_FILTER_BACKENDS": [
        "rest_framework.filters.OrderingFilter",
    ],
```

**`rest_framework.filters.OrderingFilter`, not `django-filter`.** Ordering is all this story needs, `OrderingFilter` ships with DRF, and adding `django-filter` to `requirements.txt` for a capability nothing consumes yet fails § 17. Field filtering arrives with the first feature that needs it.

**No migration, no new dependency, no new environment variable.** There is no list view in the repo, so this key changes no response today. Verify with `python manage.py check` and confirm `python manage.py test` still reports **54 passing**.

---

### 10 — Documentation

**File: `CONVENTIONS.md`** — three edits. **Never renumber**: `frontend/.oxlintrc.json` cites "CONVENTIONS.md §15" and `shared/ui/*` cites "§18" in five places.

1. **§ 2 (lines 36–47)** — extend the **Files** bullet with the scoped exemption from task 1:

   > **Files:** React components `PascalCase.tsx`; everything else `camelCase.ts`. Hooks start with `use`. Backend modules `snake_case.py`. **One scoped exception:** files under `frontend/src/shared/ui/primitives/` keep the shadcn registry's own lowercase-kebab names (`dropdown-menu.tsx`), because renaming them breaks `shadcn add` and `shadcn diff`. Everything we author — including everything else in `shared/ui/` — is `PascalCase.tsx`.

2. **§ 5 (lines 82–86)** — add the `DataTable` sibling and the reason:

   > `QueryBoundary` for a single-resource query; `DataTable` (`shared/ui/data-table/`) for a paginated list. `DataTable` does not wrap `QueryBoundary` because `QueryBoundary`'s branches return a `<div>`, which is not a valid child of `<tbody>` — it renders the same `Loading`/`Empty`/`ErrorState` inside a `<TableCell colSpan>` instead. Either way, **never hand-roll an `isPending`/`isError` branch in a feature.**

3. **§ 7 (lines 98–106)** — replace the placeholder body. Lines 100–106 currently say UI-1 is "not yet planned"; that is now false. Point at § 19 and keep the promise that made § 7 useful:

   > `UI` is Tailwind CSS v4 + shadcn/ui, established by story 06 and specified in § 19. `frontend/src/shared/ui/` is the reuse-first home: `primitives/` is the CLI-managed shadcn set, everything above it is ours. Features compose these; they never restyle a primitive or hand-build a button, dialog, or table. The props of `Loading`, `Empty`, `ErrorState`, and `QueryBoundary` are a **stable contract** — story 06 restyled all four without changing one.

**Append `## 19. Design system, theming & data tables`.** It must cover:

1. **Tailwind v4 is CSS-first.** Tokens live in `@theme inline` in `frontend/src/index.css`; there is no `tailwind.config.js` and adding one creates a second source of truth. Every colour, radius, and font stack comes from a token — no hex, `rgb()`, `oklch()`, or bare `px` in a component.
2. **Where a component goes:** `shared/ui/primitives/` is CLI-managed (`npx shadcn@latest add <name>`), lowercase-kebab, and locally patched — see item 3. `shared/ui/` is ours, `PascalCase.tsx`. `components.json` redirects the CLI's `@/components/ui` and `@/lib/utils` defaults; **do not** let a `shadcn add` recreate a top-level `components/` or `lib/`.
3. **Registry output is not RTL-clean, and every patched file says so in a header comment.** Verified against the live registry: 9 of 12 components shipped physical direction classes, 7 shipped `"use client"`, and `dialog.tsx` shipped two hardcoded English strings. **After every `shadcn add`, run `npm run check:rtl` and re-read the new file for JSX literals.** `shadcn diff` will always report the patched files as changed.
4. **The one sanctioned physical idiom:** `left-[50%]` + `translate-x-[-50%]` overlay centring, because it is symmetric. `start-[50%]` would break it — `start` flips with direction, `translate-x` does not. `scripts/check-rtl.mjs` allowlists exactly this, and nothing else.
5. **Radix reads direction from a React context, never from `<html dir>`.** Verified: `useDirection()` in `@radix-ui/react-direction` falls back to the literal `'ltr'`. `Direction.DirectionProvider` in `app/providers.tsx`, fed by `shared/i18n/useDirection.ts`, is what makes Select/DropdownMenu/Tabs behave in Arabic. **Remove it and every primitive silently reverts to LTR keyboard and placement behaviour with no error and no visual clue in English.**
6. **Directional icons mirror; non-directional icons do not.** Chevrons and arrows flip (`rtl:rotate-180`, or swap the icon). Checkmarks, spinners, and X's do not. There is no blanket `[dir=rtl] svg { transform: scaleX(-1) }` and there must not be.
7. **Two document-level writers, one attribute each.** `shared/i18n/direction.ts` owns `<html dir>` and `<html lang>`. `shared/theme/theme.ts` owns `<html class="dark">`. No component writes either. Both are mirrored by the inline anti-FOUC script in `index.html`, and **all four copies of the two storage keys are commented as needing to stay in sync**.
8. **Toast stays ours, and why.** `sonner` is not installed: `shared/ui/toast/toastSink.ts` is how `createQueryClient`'s `onError` reaches a toast from outside React, and it has no sonner equivalent. `useToast()` and `pushToast()` are the API; the renderer behind them may change.
9. **`useConfirm()`** returns `Promise<boolean>` and resolves `false` on cancel, `Escape`, and overlay dismiss. Copy is passed in already translated — the module never guesses. Same Context/Provider/hook/types shape as `shared/ui/toast/`.
10. **`DataTable` is the only table pattern.** Sorting and pagination are **server-side**: `?page=`, `?page_size=`, and `?ordering=field` / `-field` (DRF's `OrderingFilter`, enabled in `REST_FRAMEWORK.DEFAULT_FILTER_BACKENDS`). A `ColumnDef<T>`'s `id` doubles as the ordering field name and must match the serializer field. `@tanstack/react-table` is **not** installed and must not be added to get client-side models we would bypass — record the two reasons (server-side contract; v9 is a rewrite). Include a ~25-line worked example: `useServerTable` → `useQuery` with `params` in the key → `api.getPage` → `<DataTable>`.
11. **Changing the sort resets to page 1.** Page 2 of a re-ordered result set is a different set of rows.
12. **A stack trace or any Latin-only code run inside an RTL document needs `dir="ltr"`** on its element. `ErrorState`'s `<pre>` is the worked example, and it is the first real instance of § 18's bidi rule.
13. **Cross-reference forward:** `Select`, `Input`, and `Label` ship as primitives here. FORM-1 binds them to React Hook Form + Zod; **`Select` is not a native form control** and integrates through `Controller`, not `register()`.

**File: `frontend/src/README.md`** — five edits:

- **§ Reserved directories (lines 40–44):** `src/shared/ui/` is no longer reserved. Replace with the `primitives/`-vs-ours split and the note that the four story-03 components kept their props through the restyle, exactly as promised.
- Add **§ Design system** pointing at `CONVENTIONS.md` § 19, naming `shared/ui/primitives/` (CLI-managed), `shared/ui/data-table/`, `shared/ui/confirm/`, and `shared/theme/`.
- Add `lib/cn.ts` to the § The API layer module list (it is the only new `shared/lib/` module).
- Note `shared/hooks/` still has one occupant, `useFormatters.ts`: `useServerTable` lives beside `DataTable` and `useConfirm` beside `ConfirmProvider`, following the `shared/ui/toast/useToast.ts` precedent that a module owns its own hook.
- Update § Internationalization to mention `shared/i18n/useDirection.ts` and what reads it.

**File: `README.md`** — add a short **§ Design system** under the frontend material: Tailwind v4 + shadcn/ui, `npx shadcn@latest add <name>` as the way to add a primitive, `npm run check:rtl` as a required gate, the light/dark/system toggle, and a pointer to `CONVENTIONS.md` § 19. **Do not touch § Environment variables** — this story adds no variable.

---

## Edge Cases & Failure Modes

- **`shadcn init` overwrites `frontend/src/index.css`.** It destroys story 05's `text-align: start` and `html[lang='ar'] body` rules (current lines 25–36). Copy the file first (task 1) and reinstate both (task 2). The loss is invisible in English and shows up as left-aligned Arabic body text — which reads as a Tailwind bug, not a lost file.
- **Missing `Direction.DirectionProvider` is a silent RTL failure.** Verified: `useDirection()` returns the literal `'ltr'` with no provider and never reads the DOM. Select, DropdownMenu, and Tabs keep LTR arrow-key semantics and LTR `side`/`align` in Arabic, with no error and no difference in English. Verification Step 8 exercises keyboard navigation in Arabic specifically because nothing else catches this.
- **`start-[50%]` in place of `left-[50%]` moves every dialog off-screen in Arabic.** `start` flips with direction; `translate-x-[-50%]` does not. The generated centring is symmetric and must stay physical. This is the one exemption in `scripts/check-rtl.mjs`, and it is why that script allowlists an idiom instead of a file.
- **`react/jsx-no-literals` fails the build the moment `dialog.tsx` lands.** Verified two direct JSX text children (`<span className="sr-only">Close</span>`, `<Button variant="outline">Close</Button>`). `npm run lint` is red between task 6's `add` and task 6b's fix. Do them in one sitting.
- **`react/jsx-no-literals` still misses conditional JSX** — `CONVENTIONS.md` § 18's verified table, 1 of 4 patterns. Most generated primitive text sits behind a `showCloseButton &&` guard, so the linter is not the reason task 6b's table is complete; reading the files is.
- **`check-rtl.mjs` reads text, so a runtime-assembled class slips through.** `cn('p' + side + '-2')` is invisible to it. Same honest framing as story 05 gave `jsx-no-literals`: a tripwire, not a proof. Never build a direction class by concatenation.
- **`check-rtl.mjs` false negatives on paired side variants.** `data-[side=right]:slide-in-from-left-2` does not match, because the lookbehind rejects `from-left-`. That is correct — those pairs are already side-conditional and generated correctly — but it means the script cannot tell a correct pair from a missing one. Read the variants when you touch a popover's animation.
- **The shadcn CLI cannot resolve `@/*` without `compilerOptions` in `tsconfig.json`.** The current file is `{ files: [], references: [...] }` — no `baseUrl`, no `paths`. The CLI does not fail loudly; it writes imports that then fail `tsc -b`, after the files are already on disk.
- **Prettier will reformat every generated file.** The registry emits double quotes and 2-space indent at a wider print width; the project is `singleQuote: true`, `semi: false`, `printWidth: 100`. `npm run format` fixes it, and `npm run format:check` (pre-commit hook and CI) fails until you run it. Run `npm run format` immediately after every `shadcn add`.
- **Arabic plurals have six categories.** i18next expects `rowCount_zero|_one|_two|_few|_many|_other` for `ar`. A missing category falls back to English silently — the § 18 failure mode. Verification Step 4's key-set comparison catches a missing *key*; only rendering 0/1/2/3/11/100 rows in Arabic catches a missing *category*.
- **`useSyncExternalStore` needs a referentially stable snapshot.** Both new stores return string literals (`getTheme` → `Theme`, `snapshot` → `'ltr' | 'rtl'`), so they are stable by construction. Returning a fresh object from either would cause an infinite re-render loop that only shows up under `StrictMode` in dev — which `main.tsx` line 18 enables.
- **`localStorage` throws in private mode and when site data is blocked.** `theme.ts`'s `read()` and `setTheme()` both wrap it in `try`/`catch`. The inline `index.html` script is already inside a `try` — keep the theme branch inside it, not after it.
- **The anti-FOUC script and `theme.ts` must agree on the `system` default.** Both treat "no stored value" as `system` and resolve it against `prefers-color-scheme`. If they diverge, a dark-mode user gets exactly one wrong frame — the bug is invisible on a light-mode developer's machine.
- **`system` theme and an OS change mid-session.** `initTheme` subscribes to `matchMedia('(prefers-color-scheme: dark)')` and re-applies **only** while the choice is `system`. Without the guard, an explicit `light` choice gets stomped when the OS goes dark.
- **A `<div>` inside `<tbody>` is hoisted by the browser.** This is the whole reason `DataTable` does not wrap `QueryBoundary`. Every non-success branch must be a `<TableRow><TableCell colSpan={columns.length}>`. Getting it wrong produces a table that renders its error message *above* itself.
- **`ColumnDef.id` is a wire contract.** For a `sortable` column it is sent verbatim as `?ordering=<id>`. A rename that does not match the serializer field yields a **200 with unchanged order** — DRF's `OrderingFilter` ignores an unknown field rather than erroring. A sort that silently does nothing.
- **Sort changes must reset the page.** `useServerTable.setSort` does it. Without it the user sits on page 4 of a result set that no longer has the rows they were looking at.
- **`api.getPage` throws `invalid_envelope` when `meta.pagination` is absent** (`client.ts` lines 115–120). So a non-paginated endpoint wired to `DataTable` surfaces as an error state, not an empty table. That is the right failure, and it means `useServerTable` needs no defensive check.
- **Query keys must include `params`.** `useServerTable` returns a memoised `params` object; a key of `healthKeys.resource('list')` without it caches page 1 forever and paging appears to do nothing. § 18's forward constraint still applies on top: the moment a payload carries prose, `language` joins the key too.
- **`DataTable` ships with no consumer.** No paginated endpoint exists. `npm run build` proves the generic contract typechecks; the scratch harness in task 8 proves it renders. Neither proves it fits a real endpoint. **Expect to adjust it in the first list feature** — say so in the story report rather than reporting it as done-and-proven.
- **Two `radix-ui` versions would break context.** The unified `radix-ui` package and a stray `@radix-ui/react-*` install ship separate `DirectionContext` instances, so a provider from one is invisible to a consumer from the other. Never `npm install @radix-ui/react-anything`; the registry already imports from `radix-ui`.
- **`radix-ui` has one export path.** Verified: only `"."`. `import { DirectionProvider } from 'radix-ui/direction'` does not resolve; it is `import { Direction } from 'radix-ui'` then `Direction.DirectionProvider`.
- **`ConfirmProvider` can resolve twice.** Cancel, `Escape`, and overlay-click all funnel through `onOpenChange(false)`. Resolve and clear the pending state in one update, or an `await confirm()` can proceed on a dialog the user dismissed — a destructive action firing after "Cancel".
- **`AppErrorBoundary`'s fallback renders outside `DirectionProvider`.** It sits above it in `providers.tsx`, so any Radix primitive in the crash fallback would be LTR. Its fallback (lines 15–25) uses only a `<div>`, `<p>`, and `<button>`. **Keep it that way** — do not "improve" it with a `Dialog`.
- **`@tailwindcss/vite` needs Vite ≥ 5.2.** Verified peer range `^5.2.0 || ^6 || ^7 || ^8` against our Vite 8.2.2. If the frontend is ever pinned back, this breaks at build, not at install.
- **The `dark` variant needs `.dark` on an *ancestor*.** `@custom-variant dark (&:is(.dark *))` matches descendants only, so `<html class="dark">` styles everything under it but not `<html>` itself. Colour `body`, never `html`.
- **`no-console` is `"error"` with one override.** `scripts/check-rtl.mjs` uses `process.stdout.write` for that reason. Do not add a second override to use `console.log` in a build script.
- **Deleting the scratch table is part of task 8.** A committed `ScratchDataTable.tsx` with no consumer is precisely the `shared`-as-dumping-ground failure `frontend/src/README.md` lines 30–33 exists to prevent. `git status` must be clean of it before the story is reported done.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is created, no test runner is added, and no test step goes into CI. This section records that as a decision rather than an omission.

The mechanical checks that stand in for it:

1. `npm run build` — `tsc -b` typechecks every generated primitive against `strict`, `noUnusedLocals`, `erasableSyntaxOnly`, and `verbatimModuleSyntax`, and typechecks every new `t()` key through `CustomTypeOptions`.
2. `npm run lint` — catches the two `Close` literals in `dialog.tsx` and any other direct JSX text child in generated code.
3. `npm run check:rtl` — **new in this story**, and the only machine check of § 18's central rule. It is a CI gate (task 7), not a convention.
4. `npm run format:check` — proves the generated files were reformatted to the repo's Prettier settings.
5. The `en`/`ar` key-set comparison in Verification Step 4.
6. Manual bilingual, bi-directional, bi-theme walkthroughs — Verification Steps 6–9.

**Constraint on the existing suite:** `python manage.py test` must still report **54 passing**. Task 9 adds one `REST_FRAMEWORK` key and there is no list view in the repo, so no response changes. **If the count moves, the filter backend broke something** — investigate it rather than editing the test.

---

## Migration / Rollback

**No schema, no data migration.** This story adds frontend modules and one DRF settings key.

**Rollback:** revert the commits, then re-run `npm install` in `frontend/`. `package.json` and `package-lock.json` change together, and a reverted lockfile against a stale `node_modules` produces `Cannot find module 'tailwindcss'` at dev-server start — or, worse, a dev server that boots and renders every component unstyled.

**Two pieces of state outlive a rollback:** `localStorage['supportos.theme']` (new) and `localStorage['supportos.language']` (story 05) persist in every browser that used the toggles. Harmless — nothing reads `supportos.theme` after a revert — but a returning user's browser keeps it until cleared.

**Half-applied states to avoid:**

- **Task 6 before task 6b** → `npm run lint` fails on `dialog.tsx`'s two `Close` literals. Add and patch in one sitting.
- **Task 6 before task 6a** → everything renders, and it renders **wrong in Arabic only**. This is the most likely way this story ships broken: an English-speaking reviewer sees nothing amiss. Run `npm run check:rtl` before and after the sweep.
- **Tasks 5–8 before task 4** → primitives are LTR in Arabic with no error and no visual clue in English. Do task 4 first; it is fifteen lines.
- **Task 1 before backing up `src/index.css`** → story 05's direction rules are gone and there is nothing to reinstate. `git checkout frontend/src/index.css` recovers them; know that before you run the CLI, not after.
- **Task 2 without `baseUrl` in `tsconfig.json`** (task 1) → the CLI writes `@/shared/ui/primitives/...` imports that `tsc -b` cannot resolve. `npm run dev` transpiles without typechecking and looks healthy while `npm run build` is red.
- **Task 7's `check:rtl` in CI before task 6a's sweep** → CI is red on the fifteen known rows. Order: 6a, then 7.
- **Task 8 before task 6** → `DataTable` imports `Table`, `Button`, and `Skeleton` from `shared/ui/primitives/`, which do not exist yet.
- **Task 3's `index.html` edit without the `theme.ts` module** → the inline script adds `.dark` and nothing ever removes it. The app is stuck dark with no toggle. Ship the module and the script together.

---

## Verification Steps

1. **Frontend builds:** from `frontend/` — `npm run build` — exits 0. This is the real check on the typed `t()`: every new `common.table.*` and `common.theme.*` key is compile-checked through `CustomTypeOptions`, and a generated primitive that violates `strict` or `erasableSyntaxOnly` fails here.
2. **Lint, format, and RTL gates clean:** from `frontend/` — `npm run lint`, `npm run format:check`, and `npm run check:rtl` — all three exit 0. `check:rtl` printing `no physical direction utilities in src/` is the proof task 6a's sweep was complete.
3. **The gate actually fails when it should.** Temporarily add `className="ml-4"` to `RootLayout.tsx`, run `npm run check:rtl`, confirm it exits non-zero and names the file and line, then revert. A gate nobody has seen fail is not a verified gate.
4. **`en` and `ar` key sets match** for the `common` namespace (the only one this story changes). From `frontend/`:

   ```powershell
   node -e "const a=require('./src/shared/i18n/locales/en/common.json'),b=require('./src/shared/i18n/locales/ar/common.json');const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'&&v?f(v,p+k+'.'):[p+k]);const A=f(a).sort(),B=f(b).sort();console.log('missing in ar:',A.filter(k=>!B.includes(k)));console.log('extra in ar:',B.filter(k=>!A.includes(k)))"
   ```

   `missing in ar` must be empty. `extra in ar` will list the five extra Arabic plural categories for `table.rowCount` (`_zero`, `_two`, `_few`, `_many`, and `_other` beyond the `en` pair) — **those are expected**; anything else in that array is a typo.
5. **Tokens are the single styling source.** From `frontend/` — grep `src` for `#[0-9a-fA-F]{3,6}`, `rgb(`, `oklch(`, and `hsl(`. The **only** hits are inside the `:root` and `.dark` blocks of `src/index.css`. A colour literal in a component means a token is missing.
6. **Light and dark both work, and there is no flash.** `npm run dev` with the backend up, open <http://localhost:5173/>. Cycle the theme toggle through light → dark → system; the palette changes and `document.documentElement.className` shows `dark` exactly when expected. Then **hard-reload with dark active**: the first painted frame is dark, with no white flash. Then set the OS to light while the app is on `system` and confirm the app follows; set the app to `dark` explicitly and confirm the OS no longer moves it.
7. **English renders, then Arabic renders, in both themes.** Switch the language. Every visible string flips, `document.documentElement` shows `lang="ar" dir="rtl"`, the header's controls move to the left edge, and toasts stack bottom-left instead of bottom-right. Fire the health page's test toast to confirm.
8. **Radix behaves in RTL — the check nothing else covers.** With Arabic active, using the **keyboard only**:
   - Open the language `Select` with `Enter`, walk it with `↑`/`↓`, close with `Escape`. The check indicator sits on the **right** of each item (`end-2` in an RTL document).
   - Open the theme `DropdownMenu`; `←`/`→` move *outward/inward* correctly for RTL rather than being reversed.
   - Open a `Dialog`: it is **horizontally centred**, not pushed off-screen — this is the `left-[50%]` exemption working.
   - Then **comment out `Direction.DirectionProvider` in `providers.tsx` and repeat.** The arrow-key and placement behaviour must visibly regress. Restore it. If nothing changes, the provider is not wired where you think it is.
9. **`DataTable` renders in all four states, both directions** — using the scratch harness from task 8. Confirm: headers stay visible while pending; three skeleton rows; sortable headers cycle asc → desc → none with `aria-sort` tracking in the inspector; changing the sort resets the page to 1; numeric columns are `text-end`; the previous/next chevrons **swap** between English and Arabic; `page X of Y` and the row count read correctly. Force an error (stop the backend or throw in the fixture) and confirm the error row renders **inside** `<tbody>` in the inspector — not hoisted above the `<table>`.
10. **Arabic plural forms.** With Arabic active, render the pagination row with counts of **0, 1, 2, 3, 11, and 100**. All six must read as Arabic. An English string appearing is a missing plural category, not a missing key — Verification Step 4 cannot see it.
11. **The Confirm pattern resolves exactly once.** Wire a temporary button to `useConfirm()` and log the resolved value via `logger.info`. Confirm → `true`. Cancel → `false`. `Escape` → `false`. Overlay click → `false`. **One log line per interaction**, never two. Remove the temporary button.
12. **`ErrorState`'s debug block is readable in Arabic.** With the backend on `DEBUG=True`, trigger an API error in Arabic and expand **Debug details**. The traceback reads left-to-right with sane punctuation — that is the `dir="ltr"` wrapper. Without it, the lines reorder and become unreadable.
13. **The scratch harness is gone.** `git status` from the repo root shows no `ScratchDataTable.tsx`, no `src/index.css.bak`, and no uncommitted `HealthPage.tsx` edit.
14. **Backend regression:** from `backend/` with the venv active — `python manage.py check` clean, `python manage.py test` reports **54 passing**, `ruff format --check .` and `ruff check .` both exit 0.
15. **The full gate set, as CI runs it:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0, in that order.

---

## Done Criteria

- [ ] `tailwindcss`, `@tailwindcss/vite`, `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` are in `frontend/package.json` dependencies; `tw-animate-css` is a devDependency.
- [ ] **`@tanstack/react-table`, `sonner`, `next-themes`, and every `@radix-ui/react-*` package are absent** from `package.json`, and `CONVENTIONS.md` § 19 records why for each.
- [ ] No `tailwind.config.js` anywhere. Tokens live in `@theme inline` in `frontend/src/index.css`.
- [ ] `frontend/components.json` aliases `ui` → `@/shared/ui/primitives`, `components` → `@/shared/ui`, `utils` → `@/shared/lib/cn`, `lib` → `@/shared/lib`, `hooks` → `@/shared/hooks`. **No top-level `src/components/` or `src/lib/` exists.**
- [ ] `frontend/tsconfig.json` and `tsconfig.app.json` both carry `baseUrl`; `strict`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, and `verbatimModuleSyntax` are all still on and unmodified.
- [ ] Story 05's `text-align: start` and `html[lang='ar'] body` rules survive in `src/index.css`, the font stack now via a `--font-arabic` token; `src/index.css.bak` is deleted.
- [ ] Thirteen primitives exist under `src/shared/ui/primitives/`: `button`, `input`, `label`, `select`, `dialog`, `alert-dialog`, `dropdown-menu`, `table`, `tabs`, `badge`, `card`, `skeleton`, `alert`.
- [ ] **Every row of task 6a's fifteen-row table is applied**, `"use client"` is gone from all seven files that shipped it, and each patched file carries a header comment naming what changed and warning about `shadcn diff`.
- [ ] `dialog.tsx`'s two `Close` literals go through `t('actions.close')`; `npm run lint` exits 0.
- [ ] The `left-[50%]`/`translate-x-[-50%]` centring in `dialog.tsx` and `alert-dialog.tsx` is **unchanged**, and `scripts/check-rtl.mjs` allowlists exactly that idiom.
- [ ] `src/shared/theme/` contains `config.ts`, `theme.ts`, `useTheme.ts`, `index.ts`; `main.tsx` side-effect-imports it; `ThemeToggle` offers light/dark/system and touches neither `localStorage` nor `document` itself.
- [ ] `index.html`'s inline script sets `.dark` before first paint, inside the existing `try`, and a hard reload in dark mode shows **no** light flash.
- [ ] `<html dir>`/`<html lang>` are still written **only** by `shared/i18n/direction.ts`, and `<html class="dark">` **only** by `shared/theme/theme.ts`.
- [ ] `Direction.DirectionProvider` wraps the tree in `app/providers.tsx`, inside `AppErrorBoundary` and outside `QueryClientProvider`, fed by `shared/i18n/useDirection.ts`. **Commenting it out visibly regresses Arabic keyboard navigation** (Verification Step 8).
- [ ] `Loading`, `Empty`, `ErrorState`, and `QueryBoundary` are restyled with **byte-identical prop types**; `QueryBoundary.tsx`'s logic is unchanged.
- [ ] `ToastProvider` keeps `AUTO_DISMISS_MS`, the timers ref, the `setToastSink` effect, the context value shape, and `role="status" aria-live="polite" aria-atomic="true"`; its container uses `end-4`, not `right-4`; the `×` literal is replaced by an icon with the existing `aria-label`.
- [ ] `LanguageSwitcher` uses the `Select` primitive, keeps its zero-prop signature, and still touches neither `localStorage` nor `document.documentElement`.
- [ ] `RootLayout` has a real header with `LanguageSwitcher` and `ThemeToggle` positioned with `ms-auto`; its "UI-1 owns layout" comment is updated.
- [ ] `src/shared/ui/confirm/` has `types.ts`, `ConfirmContext.ts`, `ConfirmProvider.tsx`, `useConfirm.ts`; `useConfirm()` returns `Promise<boolean>`, resolves `false` on cancel/`Escape`/overlay, and resolves **exactly once** (Verification Step 11).
- [ ] `src/shared/ui/data-table/` has `types.ts`, `useServerTable.ts`, `DataTable.tsx`, `DataTablePagination.tsx`.
- [ ] `DataTable` renders headers in every state, puts loading/empty/error inside `<TableRow><TableCell colSpan>`, sets `aria-sort`, uses `text-start`/`text-end`, and never wraps `QueryBoundary`.
- [ ] `useServerTable` emits `page` / `page_size` / `ordering` matching `backend/apps/core/pagination.py`, uses DRF's `-field` descending convention, and **resets to page 1 on a sort change**.
- [ ] `DataTablePagination` derives `disabled` from `pagination.previous`/`pagination.next`, swaps its chevrons by direction, and formats every number through `useFormatters()`.
- [ ] `common.json` gains `actions.close/confirm/cancel`, `theme.*`, and `table.*` in **both** `en` and `ar`, with all six Arabic plural categories for `table.rowCount` (Verification Step 10).
- [ ] `frontend/scripts/check-rtl.mjs` exists, `npm run check:rtl` is a script, `.github/workflows/lint.yml` runs it before `build`, and it exits 0 on the tree — **and non-zero on a deliberately planted `ml-4`** (Verification Step 3).
- [ ] `.oxlintrc.json` has a fourth override turning `react/only-export-components` off for `**/shared/ui/primitives/**`, with the other three untouched and `react/jsx-no-literals` still `"error"` everywhere.
- [ ] `REST_FRAMEWORK.DEFAULT_FILTER_BACKENDS` contains `rest_framework.filters.OrderingFilter`; no new backend dependency, no migration, no new environment variable.
- [ ] `CONVENTIONS.md` § 2, § 5, and § 7 are amended in place and `## 19. Design system, theming & data tables` is **appended, with §0–§18 unrenumbered**. § 7 no longer says UI-1 is "not yet planned". § 19 covers all thirteen points in task 10, including the Radix-direction finding and the `@tanstack/react-table` decision.
- [ ] `frontend/src/README.md` no longer lists `src/shared/ui/` as reserved and documents the `primitives/`-vs-ours split; root `README.md` has a § Design system; **§ Environment variables is unchanged**.
- [ ] No colour literal outside `src/index.css`'s `:root`/`.dark` blocks (Verification Step 5).
- [ ] `ScratchDataTable.tsx`, `src/index.css.bak`, and every temporary verification edit are deleted; `git status` is clean of them.
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`, `ruff format --check .`, and `ruff check .` all exit 0; `python manage.py test` still reports **54 passing**.
- [ ] `00-overview.md` for this feature updated with this story.
- [ ] **The story report states plainly that `DataTable` ships with no production consumer** and that the first list feature will likely need to adjust it.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 07 (FORM-1 — Forms & Validation Foundation), which depends on this story's `Input`, `Label`, and `Select` primitives and on the `Select`-is-not-a-native-control note.**
