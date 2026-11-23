# Decisions log

Deviations from the planning documents and decisions taken during development.

| # | Date | Decision | Reason |
| --- | --- | --- | --- |
| 1 | 2026-11-21 | Repo moved to `D:\PROJECT\LYVAN_Payout` (ADR-008). | Required by handover. |
| 2 | 2026-11-21 | `exactOptionalPropertyTypes` not enabled in `tsconfig.base.json`. | Friction with zod-inferred optional fields; all other strict flags are on. |
| 3 | 2026-11-21 | Node 26 is installed locally; `.nvmrc`/engines say 22 (>=22). | Engine only uses ES2022 features; verified on Node 26. |
| 4 | 2026-11-21 | Own-AB optimiser uses coarse grid (10 000 kr) + repeated local grid refinement instead of golden-section. | Objective has kinks (gränsbelopp cap, brackets); grid refinement is more robust. |
| 5 | 2026-11-21 | Rounding residual is absorbed by `net_cash` for employee/sole-trader scenarios, by `retained_in_ab` for own-AB. | Keeps LYVAN's cut / fees exact; residual is <= a few kr (tested). |
| 6 | 2026-11-21 | 3:12 wage-based space uses `ibbPrevYear` (80 600) for the 8 IBB deduction, so for a 660 400 salary gränsbelopp = 330 200. | Matches the review of the original brief; flagged VERIFY in rules. |
| 7 | 2026-11-21 | Jobbskatteavdrag tiers kept as the older-year placeholders. | A web search only echoed the placeholders; the 2026 budget strengthened the credit, so the exact 2026 coefficients (SKV 433) must be entered. `verified: false` keeps the UI banner on. |
| 8 | 2026-11-21 | Added `external` party (third-party overhead) and `retained` kind. | Overhead is not paid to LYVAN or the state. |
| 9 | 2026-11-21 | `calculate(scenarioId, { common, options }, rules)`. | Scenario options are validated per scenario by zod. |
| 10 | 2026-11-21 | Own-AB default pension is ITP1-like; tests use `fixedCost` to reproduce the brief's 60 000 kr example exactly. | Reference example. |
| 11 | 2026-11-21 | `demo.ts` excluded from `tsc` (needs Node types) and run via `tsx`. | Keeps the engine free of Node typings. |
| 12 | 2026-11-22 | Jobbskatteavdrag coefficients (< 66) are now treated as verified; `2026.ts` comments updated. | They equal SKV 433 (2026) section 7.5.2 exactly; the engine reproduces the document's worked examples to the krona (`fixtures/se-2026/skv433-examples.json`). The "2026 strengthening" in the document concerns the 66+ column. |
| 13 | 2026-11-22 | Public service fee maximum is derived (`rate x maxIbbMultiple x IBB` = 1 184 kr), not stored as 1 300. | SKV 433 section 7.6. |
| 14 | 2026-11-22 | Added skattereduktion för förvärvsinkomst (`rules.earnedIncomeCredit`, new waterfall line `earned_income_credit`). | SKV 433 section 7.5.4; was missing (overstated tax by up to 1 500 kr/yr). |
| 15 | 2026-11-22 | `ageAtYearStart = taxYear - birthYear - 1`; youth ages are 18-22 (born 2003-2007); `seniorAge` moved into the rule set. | Skatteverket defines every age rule at the start of the year; born 1959 must not get the 67+ rate. Birth year only is an approximation (a birthday on 1 January is ignored). |
| 16 | 2026-11-22 | Sole trader: egenavgifter on the whole surplus; periodiseringsfond = share of income after egenavgifter; capped at `rules.periodiseringsfond.maxPct`. | The allocation does not reduce the contribution base. **Still to verify** (listed in `unverifiedItems`). |
| 17 | 2026-11-22 | Reconciliation: `assertReconciles` / `isReconciled` also bound the balancing-line residual (10 kr) unless the result has an `error` warning; the UI shows "reconciled", "shortfall" or "not reconciled". | The waterfall forces the lines to sum to revenue, so the sum alone proved nothing. |
| 18 | 2026-11-22 | Input validation errors are `EngineInputError` (issues with `path`, `code`, `limit`); `calculateAllSettled` isolates failing scenarios. | One invalid option used to blank the whole app. |
| 19 | 2026-11-22 | Own-AB optimiser and sweep use `computeOwnAb` (numbers only); `buildOwnAb` adds the waterfall. | About 2x faster; same results (tests). |
| 20 | 2026-11-22 | UI uses hand-written Tailwind primitives (`.card`, `.btn`, `.input`) - **not shadcn/ui or react-hook-form** as listed in `02-stack.md`. | Few form controls, all with custom number parsing and clamping; avoids pulling in a component framework. Revisit if the UI grows. |
| 21 | 2026-11-22 | The version has one source: the root `package.json` (Vite `define` for the UI, `tauri.conf.json` points to `../../../package.json`). | Avoids three drifting `0.1.0` strings. |
| 22 | 2026-11-22 | Print / PDF = `window.print()` with a print stylesheet and a hidden report component. Printing forces the light theme. | No native PDF dependency; WebView2 offers "Save as PDF". |
| 23 | 2026-11-22 | CSV export is locale-aware (sv: `;` and decimal comma, en: `,` and decimal point), UTF-8 BOM, formula-injection safe. | Swedish Excel misreads `12.34` and `,`-separated files. |
| 24 | 2026-11-22 | Tauri: strict CSP; capabilities limited to `core:default`, `store:default`, `dialog:allow-save`, `fs:allow-write-text-file` (empty fs scope; the dialog adds the chosen path); NSIS per-user install; WiX language `sv-SE`. | Offline-only rule (HANDOVER 7). |
| 25 | 2026-11-22 | Vitest upgraded to 4.1 (from 3.2); `eslint-plugin-react-hooks` 7 added; engine purity enforced by ESLint. | `pnpm audit` advisories (tinypool RCE gadget, @vitest/mocker); HANDOVER rule 1 was unenforced. |
| 26 | 2026-11-22 | The Windows installers were **not built in the first authoring environment**: Microsoft C++ Build Tools / Windows SDK were missing. | **Update 2026-11-23:** the Build Tools are installed; the Rust shell compiles and `pnpm build` produces both installers (version 2.0.0: NSIS 1.5 MiB, MSI 2.1 MiB). The release executable was started: the window opens, responds, writes `%APPDATA%\se.lyvan.payout\store.json` (migrating an old store) and closes cleanly. **Still not verified:** install / uninstall on a clean Windows 10 and 11 account, 125 % / 150 % display scaling, the native print dialog, and `pnpm build:offline`. |
| 27 | 2026-11-23 | Municipality picker: the 290 municipalities and 21 counties come from Statistics Sweden (SCB table OE0101) via `scripts/fetch-localities.mjs`, committed as `packages/rules/src/se/localities-2026.ts`. Church and burial fee are **county averages** (SCB publishes no per-municipality figure). | Exact kommun + region rate instead of one national average (range 28.93-35.65 %, tens of thousands of kronor per year). The exact parish fee is on the tax assessment notice. |
| 28 | 2026-11-23 | The church fee in the engine is SCB's "kyrkoavgift inkl. begravningsavgift" **minus** the burial fee; national defaults are now 0.26 % burial and 1.06 % church (were 0.292 % and 0.96 %). `municipalTaxAverage`, `burialFeeAverage` and `defaultChurchFeeRate` left `unverifiedItems`. | The engine charges the burial fee to everyone and the church fee on top for members; SCB's figure already contains the burial fee. |
| 29 | 2026-11-23 | Ages 66+ are modelled: förhöjt grundavdrag (SKV 433 section 6.2, added to the ordinary grundavdrag before rounding up) and the higher skattereduktion för arbetsinkomst (section 7.5.2, no grundavdrag, no municipal rate, credited against municipal tax only). The three worked examples of section 6.2 are golden tests. `AGE_NOT_SUPPORTED` became the info warning `AGE_66_PLUS`. | Removes the v1 limitation. The egenavgifter reduction for people born 1958 or earlier and pension plans for older employees are **not** modelled (warning `EGENAVGIFTER_AGE_NOT_MODELLED`). |
| 30 | 2026-11-23 | No `SE-2027` rule set yet. PBB (59 600) and IBB (86 600) for 2027 are published, but the skiktgräns, grundavdrag and jobbskatteavdrag tables come with SKV 433, which Skatteverket normally publishes in mid-December. | Tax numbers are never derived or guessed. `docs/adding-a-tax-year.md` lists the steps; `scripts/fetch-localities.mjs 2027` fetches the municipal rates when SCB publishes them. |
| 31 | 2026-11-23 | Offer tool in the engine: `solveRevenueForTarget` (smallest whole-krona revenue that reaches a target, by bisection) and `leaderBands` (which scenario leads at which revenue, boundaries refined to 1 kr). Target metrics: `netCash`, `consultantValue` (+ pension), `totalValue` (+ money left in the own company / periodiseringsfond). | On net cash alone the own AB looks worse than it is, because retained earnings are not counted; `totalValue` makes the comparison fair but overstates what can be spent (retained money is taxed later). |
| 32 | 2026-11-23 | The offer sheet and the offer table show monthly amounts as annual / 12. | Real monthly withholding follows Skatteverket's tax tables; the sheet says so. |
| 33 | 2026-11-23 | Vite ignores `src-tauri/**` in its file watcher. | While cargo built the Rust shell, the watcher hit a locked `build_script_build.exe` (EBUSY) and the dev server exited - `tauri dev` would have done the same. |
| 34 | 2026-11-23 | `pnpm build:offline` builds the installers with `webviewInstallMode: offlineInstaller` (`src-tauri/tauri.offline.conf.json`); `pnpm build` keeps the small download-bootstrapper default. | Windows 10 machines without WebView2 and without internet. Costs about 130 MB per installer. |

## Open items for the user

- **Smoke-test the installers** on a clean Windows 10 and Windows 11 account (install, change a value, save, close and reopen,
  CSV export, print to PDF, uninstall); try `pnpm build:offline` on a Windows 10 machine without WebView2.
- **2027 rules** as soon as Skatteverket publishes SKV 433 for 2027 (mid-December 2026): follow
  `docs/adding-a-tax-year.md`. Until then the app is correct for income year 2026 only.
- Verify the items still in `unverifiedItems` of `packages/rules/src/se/2026.ts` (SLP, ITP 1 rates, agreement holiday
  supplement, 3:12 wage-based rate and takbelopp, salary-exchange uplift, and whether the periodiseringsfond reduces
  the egenavgifter base), then set `verified: true`.
- `fixtures/se-2026/income-tax.json` (full-year net tax at 8 incomes) still needs values from Skatteverket's tax
  calculator; those 8 tests stay skipped (never invent numbers). The SKV 433 worked examples are covered exactly.
- Confirm LYVAN's business defaults (cuts, fees, holiday policy) - they are editable in Settings.
- Logo: the app and icons use a placeholder "L" monogram. Code signing certificate (installers are unsigned).
- Not built (candidates for 2.x): holding-AB scenario with full 3:12, löneväxling optimizer, ITP 2 and pension plan
  choice, benefits (friskvård, company car, per diem), multi-year what-if (needs 2027), LYVAN firm view (consultant
  roster, margin, utilisation), egenavgifter for people born 1958 or earlier.
