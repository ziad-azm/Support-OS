# Story 102 — Management Dashboard: Chart Rendering & Surrounding Controls

## Prerequisites

- **Story 101 implemented:** [101-story-link-contrast-tokens.md](101-story-link-contrast-tokens.md). No hard dependency — this story touches no colour token — but 102 changes the same screens' visuals and should be reviewed after it.
- **Story 57/60 (`RPT-2`/`RPT-5`) implemented:** `GaugeChart` and `ChartFrame`. `GaugeChart`'s RTL coordinate mapping was *"verified algebraically"* in Story 57 `## Verification Steps` — whatever replaces it must hold the same guarantee.
- **Intake:** `.squad/stories/bugs/qa-report-1/intake.md`; **attachment:** `QA-REPORT-1.md` — F-7, F-11, F-12, F-13, F-14, F-19, and UI/UX observations 15-16.
- **Screenshot of the defect:** `docs/screenshots/management-dashboard.png`.
- **No backend change of any kind.** `git status --short backend/` must be empty at the end.

---

## What discovery changed

### 1. `GaugeChart` is the only chart with this class of bug

`LineChart` and `BarChart` were rebuilt on **recharts** and use `<ResponsiveContainer width="100%">` — they scale correctly. `WaffleChart` is a CSS grid of `<div>`s with `maxWidth: 240`. Only `GaugeChart` is hand-built SVG with a fixed `WIDTH = 600` viewBox. **Its two consumers are `ManagementDashboardPage` and `SlaReportsPage`** — both must be verified, not just the dashboard.

### 2. Uniform SVG scaling cannot fix this — the fix is to stop using SVG

The chart is `viewBox="0 0 600 {height}"` with `className="w-full"` and a **pixel** `style={{ height }}`. Under the default `preserveAspectRatio="xMidYMid meet"` the uniform scale is `min(1160/600, 132/132) = 1`, so the 600-unit chart draws at 1:1 centred in an ~1160px container — the ~280px of dead space on each side visible in the screenshot.

Every SVG-preserving option is wrong:

| Option | Why not |
|---|---|
| `preserveAspectRatio="none"` | Stretches the label and percentage text horizontally — 1.93× wide glyphs. |
| Let height be `auto` so it scales uniformly | Text scales too: a 12px label becomes 23px. |
| `ResizeObserver` to set `WIDTH` | Works, but adds a resize observer and re-render per chart to reproduce what CSS does for free. |

The requirement is "bars stretch, text does not", which is precisely what SVG cannot express without measuring. **These are horizontal bars with labels — HTML and CSS render them natively.** Rewriting as flex `<div>`s fixes F-7a, F-7b, F-7c and F-19 structurally rather than patching each, and makes the labels real selectable text that honours the user's font-size settings.

The RTL guarantee gets *simpler*, not weaker: CSS logical properties handle direction natively, and `npm run check:rtl` already fails the build on any physical-direction utility.

### 3. F-11 has a primitive built for it that `ChartFrame` is not using

`CardHeader` is a grid: `has-data-[slot=card-action]:grid-cols-[1fr_auto]` — it becomes two columns **only** when a child carries `data-slot="card-action"`. `card.tsx` exports `CardAction` (`col-start-2 row-span-2 row-start-1 self-start justify-self-end`) for exactly this. `ChartFrame:58` renders `action` as a bare child, so it lands as a third full-width grid row — the stretched Export CSV button. **The fix is to wrap it in `<CardAction>`**, not to add layout classes.

This fixes the button on **all five** report pages at once, not just the dashboard.

### 4. `DateRangePresets` is stateless and shared by six screens

It fires `onSelect` and keeps nothing, so it cannot show which preset is active. Six pages import it (`AgentReportsPage`, `CsatReportsPage`, `ManagementDashboardPage`, `SlaReportsPage`, `TicketReportsPage`). Active state must be **derived** from the `from`/`to` the parent already owns and passed in — adding local state would let the highlight drift out of sync with the dates actually applied.

---

## Story Goal

Make the management dashboard read as a finished screen.

1. The gauge chart fills its container, labels every bar, and keeps its values inside the plot.
2. The controls around it — export button, title, drill-down links, date presets — look and behave like controls.
3. `SlaReportsPage` and the three other report pages inherit the shared fixes without regressing.

**Not in scope:** replacing the charting approach wholesale (that is `DSN-14`'s open "Re-evaluate reports/charts on a real charting library" task), and `DSN-17`'s systematic colour audit. This story fixes the named defects.

---

## Context — Read These Files First

1. `frontend/src/shared/ui/chart/GaugeChart.tsx` (full file, ~160 lines) — `WIDTH` (line 3), `height` (52), `xFor`/`zoneRect` (60-69), the `<svg>` (72), the clipped label `y={y - 4}` (86), `tabIndex={0}` (122), the overflowing value label x (137). Read the zone/threshold constants and their sourcing comment — they must survive unchanged.
2. `frontend/src/shared/ui/chart/ChartFrame.tsx` lines 51-60 — the `CardHeader` block.
3. `frontend/src/shared/ui/primitives/card.tsx` lines 19-30 (`CardHeader`, the grid) and 57-65 (`CardAction`).
4. `frontend/src/features/reports/components/ManagementDashboardPage.tsx` — `PageHeader` (55) and `ChartFrame title` (90) both render `t('dashboard.title')`; the ghost drill-down links (129); the two `type="date"` inputs (64, 76).
5. `frontend/src/features/reports/components/DateRangePresets.tsx` (full file) — stateless, three presets, `isoDaysAgo(N-1)` inclusive-range logic which must not change.
6. `frontend/src/features/reports/components/SlaReportsPage.tsx` around line 199 — the second `GaugeChart` consumer.
7. `frontend/src/features/reports/locales/{en,ar}.json` — every new string needs both.

---

## Frontend Tasks

### 1 — Rebuild `GaugeChart` on CSS, keeping its public API

**File: `frontend/src/shared/ui/chart/GaugeChart.tsx`**

`GaugeValue`, `GaugeChartProps`, `gauges` and `formatValue` **do not change** — both consumers must keep working untouched.

Structure per gauge: a label row, then a track containing the three zones and the performance bar, then the target marker.

- **Zones** — a flex row of three `<div>`s with `flex-basis` `10%` / `15%` / `75%` (`GOOD_THRESHOLD`, `WARN_THRESHOLD` and the remainder), each keeping its existing token colour at `ZONE_OPACITY`.
- **Performance bar** — absolutely positioned inside the track, `inline-size: {value*100}%`, using logical properties so RTL needs no branch.
- **Target marker** — absolutely positioned at `inset-inline-start: {GOOD_THRESHOLD*100}%`.
- **Labels** — real text above the track; the value beside or inside the bar.

Delete `WIDTH`, `xFor` and `zoneRect`. Keep `BAR_HEIGHT`/`GAP` as Tailwind sizing, and keep **every** threshold and colour constant with its sourcing comment intact.

**F-7a** — the label is a sibling element above the track; nothing can clip it.
**F-7b** — the container is `w-full`; no viewBox, no scaling.
**F-7c** — when `value > 0.9`, render the value **inside** the bar, end-aligned, so it can never sit outside the track.
**F-7d** — add a legend row naming the three zones and the target marker. New locale keys in `common` (the chart namespace `ChartFrame` already uses), in `en` **and** `ar`.
**F-19** — the focusable element is a real element with a visible `focus-visible` ring, per `DSN-2`. Keep `role="img"` + `aria-label` on each gauge so the accessible name is unchanged.

**RTL:** use logical properties only (`inline-size`, `inset-inline-start`, `text-start`). `npm run check:rtl` must stay clean — it is the gate that replaces Story 57's algebraic argument.

### 2 — `ChartFrame`: put the action in `CardAction`

**File: `frontend/src/shared/ui/chart/ChartFrame.tsx`**

```tsx
{query.isSuccess && !isEmpty?.(query.data) ? <CardAction>{action}</CardAction> : null}
```

Import `CardAction` from `../primitives/card`. Update the `action` prop's doc comment — it says *"Rendered next to the title"*, which only becomes true with this change.

### 3 — Dashboard page: title, drill-downs, date range

**File: `frontend/src/features/reports/components/ManagementDashboardPage.tsx`**

- **F-12** — the title renders twice. Keep `PageHeader`; give `ChartFrame` a distinct title (a new locale key describing the chart, e.g. "KPIs for the selected period") rather than deleting the card title, which would leave the card unlabelled for screen readers.
- **F-13** — drill-down links use `variant="ghost"`, which renders as plain text. Use `variant="outline"` so they read as controls. Keep `asChild` + `<Link>` so they stay real links.
- **F-14** — apply a default range on mount (**last 30 days**, matching the backend's own default per `DateRangePresets`' comment) so the dashboard never loads in an ambiguous state, and pass `from`/`to` down for active-state highlighting.

### 4 — `DateRangePresets`: show which range is active

**File: `frontend/src/features/reports/components/DateRangePresets.tsx`**

Accept optional `from` and `to`. A preset is active when both match its computed range. Render active as `variant="secondary"` (or `default`) and inactive as `outline`, and set `aria-pressed` so the state is not colour-only — `DSN-2`'s rule and the same standard `GaugeChart` already meets by printing its percentages.

**Do not change** `isoDaysAgo(N - 1)`; its inclusive-range comment records a bug already fixed once.

All six consumers keep working — the new props are optional, so pages that do not pass them simply show no active state.

---

## Backend Tasks

**No backend changes required.**

---

## Edge Cases & Failure Modes

- **A single gauge.** `SlaReportsPage` can render one. The layout must not depend on `gauges.length > 1`.
- **`value === 0`.** The performance bar is `inline-size: 0%` and invisible; the value text must still render and be readable — that is the difference between "0%" and "no data". `ManagementDashboardPage` filters `null` before passing, so 0 is a real measurement.
- **`value === 1`.** The bar fills the track; the value must render **inside** it (F-7c) with enough contrast against `--chart-1`.
- **`value > 1`.** The old `xFor` clamped to 1. The CSS version must clamp too — a rate above 100% is possible from a bad aggregate and must not paint outside the track or break the row.
- **A very long label** (`t('dashboard.kpis.agent_load')` in Arabic). It sits above the track and must wrap rather than overflow or truncate the value.
- **RTL.** Zones must tile from the inline-start edge in both directions with no gap or overlap — the guarantee Story 57 verified algebraically. Verify visually in Arabic **and** keep `check:rtl` clean.
- **Reduced motion.** Any transition added to the bar must honour `prefers-reduced-motion` via the existing `index.css` policy — do not add a bespoke media query.
- **`CardAction` on a card with no description.** `CardHeader`'s grid is `grid-rows-[auto_auto]`; a header with title + action but no description must not collapse oddly. Check `TicketReportsPage`, which is the plainest consumer.
- **The four other report pages.** `ChartFrame` and `DateRangePresets` are shared. Every change to them is a change to `Agent`, `Csat`, `Sla` and `Ticket` reports — verify all five, not just the dashboard.

---

## Test Plan

**This project does not author automated tests** — CONVENTIONS.md §16. **No test file is added, modified, or removed.** Verification is below.

---

## Migration / Rollback

**No backend, no migration, no persisted state.** Purely presentational.

`GaugeChart`'s public API is unchanged, so rollback is `git revert` of the commit with no consumer changes to unwind. The new locale keys disappear with it; because they are added to both `en` and `ar` in the same commit, a revert cannot leave parity broken.

---

## Verification Steps

1. **Backend untouched:** `git status --short backend/` is empty.
2. **Gates:** in `frontend/` — `npx tsc -b`, `npm run lint`, `npm run check:rtl`, `npm run format:check`, `npx vite build` all pass.
3. **Locale parity:** every new key exists in `en` **and** `ar`; a flattened set-difference of the two files is empty in both directions.
4. **F-7b — the chart fills its card.** At 1440px, 1024px and 768px the bars span the card's content width with no dead space. Compare against `docs/screenshots/management-dashboard.png`, which shows ~280px of dead space on each side.
5. **F-7a — every bar is labelled**, including the first. Each label is unambiguously attached to its own bar.
6. **F-7c — 100% stays inside.** With a gauge at exactly `1`, the value renders inside the bar and does not touch or cross the card edge. Also check `0`.
7. **F-7d — the legend explains the chart**: the three zones and the target marker are named.
8. **F-19 — keyboard.** Tab to a gauge: it takes focus **with a visible ring**, and a screen reader announces the same `"{label}: {value}"` as before.
9. **F-11 — the export button is right-aligned** in the card header on **all five** report pages, not full-width.
10. **F-12 — the dashboard title appears once**; the card still has an accessible name.
11. **F-13 — the four drill-down links read as buttons** and still navigate to `/reports/tickets`, `/reports/sla`, `/reports/csat`, `/reports/agents`.
12. **F-14 — a default range is applied on load** and its preset is visibly active; clicking another preset moves the highlight; typing a custom date clears it.
13. **The second consumer.** `/reports/sla` renders its gauge correctly at every breakpoint — this is the consumer most likely to be forgotten.
14. **RTL.** In Arabic, every gauge tiles from the inline-start edge with no gap or overlap, labels and values sit correctly, and the legend reads right-to-left.
15. **Both themes.** Zones, performance bar, target marker and legend are all legible in light **and** dark.

---

## Done Criteria

- [ ] `GaugeChart` fills its container at every breakpoint; no fixed `WIDTH`, no viewBox scaling.
- [ ] Every gauge is labelled, first row included; no label is clipped or ambiguous.
- [ ] A value of `1` renders inside the bar; `0` and `>1` render sanely.
- [ ] A legend names the three zones and the target marker, translated in `en` and `ar`.
- [ ] The gauge is keyboard-focusable **with a visible focus ring**, and its accessible name is unchanged.
- [ ] `GaugeChart`'s exported types and props are unchanged; **`SlaReportsPage` required no edit**.
- [ ] Every zone/threshold constant and its sourcing comment survives.
- [ ] `ChartFrame` wraps `action` in `CardAction`; the export button is right-aligned on all five report pages; its doc comment is now true.
- [ ] The dashboard title renders once and the chart card keeps an accessible name.
- [ ] Drill-down links read as controls and navigate correctly.
- [ ] A default range applies on load; the active preset is highlighted **and** carries `aria-pressed`.
- [ ] `isoDaysAgo(N - 1)` is unchanged.
- [ ] `tsc -b`, `lint`, `check:rtl`, `format:check`, `vite build` pass; en/ar parity holds.
- [ ] No test file was added, changed, or removed (CONVENTIONS.md §16).

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 103.**
