# 05 — UI spec (Windows 11 desktop)

## 1. Principles
- One screen answers "how much do I get?" in < 3 seconds: big revenue input → ranked cards.
- Every number is explainable: click → waterfall line with formula.
- Swedish terms shown with English helper text (or vice versa, per language setting).
- Windows 11 look: Segoe UI Variable font, rounded corners (8 px), light/dark following system theme.

## 2. Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ LYVAN Payout                         [Tax year 2026 ▾] [sv|en] [⚙]        │
├───────────────┬──────────────────────────────────────────────────────────┤
│ REVENUE       │  Tabs: [Overview] [Compare] [Revenue sweep] [Saved]       │
│ 1 500 000 kr  │                                                          │
│ ○ annual ○ h  │  ┌ #1 Own AB ──────┐ ┌ #2 Sole trader ┐ ┌ #3 Umbrella ┐  │
│ [slider]      │  │ Net 784 879 kr  │ │ ...            │ │ ...         │  │
│               │  │ 52.3 % of rev.  │ │                │ │             │  │
│ Overhead      │  │ +48k pension    │ │                │ │             │  │
│ Municipality  │  │ ⚠ 1 warning     │ └────────────────┘ └─────────────┘  │
│ Birth year    │  └─────────────────┘ ┌ #4 Rev-share ┐ ┌ #5 Salaried ┐    │
│ Church ☐      │                      └──────────────┘ └─────────────┘    │
│ ▸ Scenario    │                                                          │
│   settings    │  Bottom: assumptions · "Rules 2026 not verified" banner   │
└───────────────┴──────────────────────────────────────────────────────────┘
```

- Left panel (320 px): common inputs; collapsible per-scenario settings (generated from each
  scenario's zod schema + labels).
- Card click → **Detail view** (right drawer or full page): waterfall table
  (Line · Amount · % of revenue · Receiver · Formula), stacked "where the krona goes" bar, warnings.

## 3. Views
| View | Content |
| --- | --- |
| Overview | 5 cards ranked by net cash; toggle metric: net cash / consultant value / LYVAN margin; annual ↔ monthly |
| Compare | Horizontal 100 % stacked bars per scenario, colour by party |
| Revenue sweep | Line chart net cash vs revenue 300k–3M, all scenarios; hover shows values; crossover markers |
| Own-AB optimizer | Net vs salary curve, marker at optimum, "Apply" button |
| Saved | List of named calculations (name, date, revenue, best scenario), load / duplicate / delete |
| Settings | Language, default tax year, default municipality, LYVAN default cuts, theme, about/disclaimer |

## 4. Party colours (consistent everywhere)
consultant net = accent green · pension = teal · state = grey · LYVAN/company = navy · provider = amber ·
retained = light blue.

## 5. Formatting
`Intl.NumberFormat('sv-SE')` → `1 500 000 kr`; percentages one decimal; negative values in parentheses
in tables. Inputs accept `1500000`, `1 500 000`, `1,5M`.

## 6. Acceptance checklist
- [x] Changing revenue recalculates all cards instantly, no jank (about 12 ms for all five scenarios; the sweep is deferred)
- [x] Each card shows net cash, % of revenue, pension, warnings count
- [x] Detail table lines sum to revenue (visible "Reconciled ✓"; a flagged result shows "shortfall" instead)
- [x] Keyboard: Tab order sensible, Enter on card opens detail, Esc closes (focus is trapped in the drawer and returns to the card)
- [ ] Works at 125 %/150 % Windows display scaling (**not verified** - needs a manual check of the installed app)
- [x] Dark mode follows system (plus an explicit light / dark choice in Settings)
- [x] Disclaimer visible in footer and on every export (CSV and print report)
