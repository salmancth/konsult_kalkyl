# Changelog

All notable changes to LYVAN Payout. Format: [Keep a Changelog](https://keepachangelog.com/), versions follow
[SemVer](https://semver.org/). Tax-rule changes are listed under the rule set they affect.

## [2.0.0] - 2026-11-23

Combines the planned 1.1 (accuracy) and 2.0 (offer tool) releases.

### Added
- **Municipality picker**: all 290 municipalities with their exact 2026 total municipal tax (kommun + region), and the
  county's average church and burial fee (data: Statistics Sweden, regenerate with
  `node scripts/fetch-localities.mjs <year>`). The municipality is also shown on the print report.
- **Offer tab**: enter the net pay you want per month and see what must be billed per year / month / hour in each of the
  five models, which model needs the least, and which model pays most at which revenue (boundaries to the krona).
  The target can count net cash, net cash + pension, or also money left in your own company.
- **Offer sheet**: one-page printout / PDF of the chosen model at the billing needed (annual and monthly amounts,
  full breakdown, assumptions, warnings, disclaimer).
- **Ages 66+**: förhöjt grundavdrag and the higher skattereduktion för arbetsinkomst (SKV 433 sections 6.2 and 7.5.2),
  with golden tests from the document.
- Engine API: `solveRevenueForTarget`, `leaderBands`, `metricValue`; `isSenior`, `grundavdrag(.., senior)`.
- `pnpm build:offline`: installers that embed the WebView2 runtime (for Windows 10 without internet).
- Translation tests: Swedish and English must define the same keys and the same `{{placeholders}}`.

### Changed
- National defaults verified against SCB: burial fee 0.26 % (was 0.292 %), church fee 1.06 % (was 0.96 %). The church
  fee now excludes the burial fee that SCB's figure includes.
- `AGE_NOT_SUPPORTED` warning replaced by the informational `AGE_66_PLUS`; new warning
  `EGENAVGIFTER_AGE_NOT_MODELLED` for sole traders born 1958 or earlier.
- The brytpunkt used for warnings and the own-AB salary target is higher for 66+.

### Fixed
- `vite` no longer watches `src-tauri/**`: the dev server crashed with EBUSY while the Rust shell was compiling.

### Not done
- Tax year 2027: Skatteverket's SKV 433 for 2027 is normally published in mid-December (decision 30).
- Still unverified: see `unverifiedItems` in `packages/rules/src/se/2026.ts`.

## [0.1.0] - 2026-11-22

First complete version: engine, rules for tax year 2026, and the Windows desktop app.

### Added
- **Engine** (`@lyvan/engine`): five payout scenarios (salaried, revenue share, umbrella, sole trader, own AB with
  3:12 dividends) producing a reconciled waterfall with an auditable formula on every line; own-AB salary
  optimizer; revenue sweep; `calculateAllSettled` (a scenario with invalid options no longer takes the others
  down); `EngineInputError` with machine-readable issues (`path`, `code`, `limit`).
- **Rules** (`@lyvan/rules`): `SE-2026`, including the `unverifiedItems` list the UI shows in the
  "rules not verified" banner.
- **Desktop app** (`@lyvan/desktop`, Tauri 2 + React 19): input panel (annual or hourly revenue, overhead,
  municipality, birth year, church), ranked scenario cards (net cash / consultant value / LYVAN margin,
  annual or monthly), detail drawer with waterfall, formulas, "where each krona goes" bar, warnings,
  assumptions and the scenario's own settings; compare chart; revenue sweep with crossover markers; own-AB
  optimizer with "use optimal salary"; saved calculations (rename, duplicate, delete with confirmation);
  settings (language, theme, tax year, default municipality, LYVAN default cuts, rule status);
  CSV export (locale-aware, injection-safe) and print / save-as-PDF report; Swedish and English UI;
  light / dark / follow-system theme; keyboard-accessible tabs and a modal drawer with focus trap.
- **Tests**: golden tests built from the worked examples printed in Skatteverket's SKV 433 (2026), exact to the
  krona (`fixtures/se-2026/skv433-examples.json`); property tests for reconciliation and monotonicity;
  UI-vs-engine bounds consistency tests; persistence migration tests.
- **Tooling**: ESLint rules that enforce engine purity (no Node / DOM / UI / Tauri imports or globals in
  `packages/engine` and `packages/rules`) and React hooks rules; GitHub Actions workflow (lint, typecheck,
  test, web build, optional Windows installer build); `.gitattributes` (LF).

### Tax rules (SE-2026) - verified against SKV 433 utgåva 36 (2025-12-10)
- Jobbskatteavdrag coefficients for persons under 66 confirmed (the earlier "placeholder" warning was outdated).
- **Fixed** public service fee maximum: 1 184 kr (1 % of 1.42 x IBB), previously 1 300 kr.
- **Added** skattereduktion för förvärvsinkomst (0.75 % of taxable income above 40 000 kr, max 1 500 kr).
- **Fixed** age handling: age is measured at the *start* of the year. Persons born 1959 no longer get the 67+
  employer-fee rate (born 1958 or earlier only); the youth reduction covers born 2003-2007.
- **Fixed** rounding to match Skatteverket (jobbskatteavdrag and credits floored to whole kronor, allmän
  pensionsavgift to the nearest 100 kr with .50 rounded down).
- **Changed** sole trader: egenavgifter are calculated on the whole surplus; the periodiseringsfond is a share
  of the income after egenavgifter and is capped at the statutory maximum from the rule set (to be verified).

### Fixed (compared with the pre-release prototype)
- `parseAmount("750 tkr")` returned `null`; `formatKr(-0.2)` returned `"-0"`; `fmtPct(0.5, 0)` returned `"5%"`.
- The "Reconciled" check was always true because the waterfall forces the lines to sum to revenue; it now also
  requires that the balancing line absorbed only rounding.
- UI fields allowed values (for example 100 %) that the engine rejected, which blanked the whole screen.
- The optimizer and sweep no longer build full waterfalls for every candidate salary (about 2x faster).
- Dev dependency advisories (vitest / tinypool / glob / minimatch): upgraded to vitest 4.1.

### Known limitations
- Ages 66 and above are not supported (a warning is shown).
- 3:12 is simplified: no interest on omkostnadsbelopp; steady-state dividend assumption.
- Rule items still unverified are listed in the app (Settings -> Tax rules) and in
  `packages/rules/src/se/2026.ts` (`unverifiedItems`).
- Windows installers (NSIS + MSI) need the Microsoft C++ Build Tools to build; see `docs/dev-setup.md`.
