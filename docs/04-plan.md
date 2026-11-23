# 04 — Delivery plan

> Status 2026-11-22: M0–M5 done and verified (tests, lint, typecheck, web build, manual run in a browser).
> M6: configuration, icons, CI and docs are done; **the installers are not built or smoke-tested** (the C++ Build Tools are
> missing on the authoring machine).

Each milestone ends with: all tests green, `pnpm lint` clean, short entry in `CHANGELOG.md`, git tag.

## M0 — Repo & toolchain (½ day)
- [x] Move folder to `D:\PROJECT\LYVAN_Payout`, `git init`, `.gitignore`, `.editorconfig`, `.nvmrc` (22)
- [x] pnpm workspace: `apps/desktop`, `packages/engine`, `packages/rules`
- [x] Root `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- [x] ESLint flat config + Prettier; root scripts: `dev`, `build`, `test`, `lint`, `typecheck`
- [x] Verify prerequisites (Rust msvc, C++ build tools) — documented in `docs/dev-setup.md` (the authoring machine lacks the C++ Build Tools)
- **Done when:** `pnpm i && pnpm test && pnpm typecheck` pass on an empty skeleton.

## M1 — Rules + core + personal tax (1–2 days)
- [x] `RuleSet` type + `SE_2026` data with source comments, `verified: false`
- [x] `core/money.ts`, `core/solver.ts`, `core/waterfall.ts`, `core/invariants.ts` (+ tests)
- [x] `tax/personalIncomeTax.ts`, `tax/employerFees.ts`, `tax/pension.ts`, `tax/corporateTax.ts`,
      `tax/egenavgifter.ts`, `tax/threeTwelve.ts` — each with unit tests
- [x] `fixtures/se-2026/income-tax.json` (TODO_VERIFY placeholders allowed) + `skv433-examples.json` (official worked examples)
- **Done when:** ≥ 95 % line coverage on `tax/` and `core/`.

## M2 — Scenarios 1–5 + registry + API (2 days)
- [x] One folder per scenario: `schema.ts` (zod + defaults), `calculate.ts`, `calculate.test.ts`
- [x] `registry.ts`, `index.ts` (`calculate`, `calculateAll`, `sweep`, `optimize`, `getRuleSet`)
- [x] Property tests: reconciliation + monotonicity for all scenarios
- [x] Reference example test (domain spec §5.2) passes exactly
- [x] Tiny CLI `pnpm --filter engine run demo -- 1500000` printing a comparison table (dev aid)
- **Done when:** `calculateAll` for R = 1.5M returns 5 reconciled results; demo output reviewed.

## M3 — Desktop shell + calculator screen (2 days)
- [x] Tauri 2 + React + Vite + Tailwind v4 + shadcn/ui scaffold in `apps/desktop`
- [x] Window: title "LYVAN Payout", min 1100×720, app id `se.lyvan.payout`
- [x] Zustand store, revenue input (annual / hourly×hours), common assumptions panel
- [x] 5 scenario cards (net cash, % of revenue, pension, rank badge), live recalculation
- [x] sv-SE number formatting, i18n sv/en
- **Done when:** `pnpm tauri dev` runs on Windows 11; typing revenue updates cards < 50 ms.

## M4 — Detail, compare, sweep, optimizer views (2 days)
- [x] Detail drawer/page: waterfall table with formulas + party color, scenario-specific inputs
- [x] Compare: stacked bar per scenario (net cash / pension / state / company / provider / retained)
- [x] Sweep: net cash vs revenue (300k–3M) line chart, all scenarios; crossover markers
- [x] Scenario 5 optimizer chart (net vs salary) + "apply optimal salary"
- [x] Warnings & assumptions panel; "rules not verified" banner
- **Done when:** UI spec acceptance list (05-ui-spec §6) passes.

## M5 — Persistence, export, settings (1 day)
- [x] Save/load named calculations (plugin-store, schema version + migrations)
- [x] Export CSV (all lines, all scenarios) and Print/PDF view with LYVAN header + disclaimer
- [x] Settings: language, tax year, default municipality rate, default LYVAN cuts, brand
- **Done when:** restart app → saved calculations and settings persist.

## M6 — Packaging & release (½–1 day)
- [x] App icon set (placeholder "L" monogram until logo supplied), version from root `package.json`
- [x] `pnpm tauri build` → NSIS + MSI in `apps/desktop/src-tauri/target/release/bundle` (built 2026-11-23, version 2.0.0)
- [ ] Smoke test install/uninstall on Windows 10 and 11 (**pending**; the release exe starts, saves its store and closes cleanly)
- [x] (Optional) GitHub Actions workflow on `windows-latest` (`.github/workflows/ci.yml`)
- **Done when:** installer runs on a clean Windows 11 user account. (**Not yet verified** (see decisions log 26).)

## Backlog (post-v1)
Tax year 2027 rules · holding-AB scenario · löneväxling optimizer for scenario 2 · LYVAN portfolio P&L
(multiple consultants, utilization/bench) · offer letter PDF · web build · auto-update · code signing.

## Open decisions for LYVAN (defaults used until answered)
| Topic | Default in v1 |
| --- | --- |
| Firm retention, scenario 1 | 30 % |
| Firm cut, scenario 2 | 20 % (presets 30/20/15/10) |
| Broker fee, scenario 5 | 5 % |
| Holiday model in revenue-share pot | 12 % compensation included in pot |
| Pension in revenue-share | ITP1-equivalent |
| Default municipality | national average 32.38 % |
| UI language default | Swedish |
| Brand colours / logo | neutral navy `#1F2A44` + accent `#3BA7A0`, monogram placeholder |
