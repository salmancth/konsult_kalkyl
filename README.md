# LYVAN Payout

Payout calculator for **LYVAN** (Swedish consulting AB). Enter billed revenue (ex. VAT) and see exactly
where every krona goes - company, state, pension, consultant's pocket - across all payout models.
Offline Windows 11 desktop app (Tauri 2 + React) on top of a pure TypeScript calculation engine.

> Status: **v2.0.0** - engine, tax rules 2026, the desktop app and the offer tool (target pay -> required billing)
> are complete; tax year 2027 follows when Skatteverket publishes SKV 433 (mid-December). Rule set `SE-2026` is
> verified against Skatteverket's SKV 433 for the personal-tax core; the remaining unverified items are listed in
> the app (Settings -> Tax rules) and in `packages/rules/src/se/2026.ts`. See [CHANGELOG.md](CHANGELOG.md).
> **Estimates only. Not tax advice.**

## The 5 scenarios

1. Traditional salaried employee (*Anställd*)
2. Revenue-share employee (*70/30, 80/20, egen pott*)
3. Umbrella company (*Egenanställning*)
4. Sole trader (*Enskild firma*, F-skatt)
5. Own AB / partner AB (*Eget aktiebolag*, salary + 3:12 dividends, with a salary optimizer)

## Install (users)

Download the installer from the release page and run it:

- `LYVAN Payout_<version>_x64-setup.exe` (NSIS, per-user, no admin rights needed), or
- `LYVAN Payout_<version>_x64_sv-SE.msi` (per-machine).

On Windows 10 without WebView2 and without internet use the installers from `pnpm build:offline` (they embed the
WebView2 runtime, about 130 MB larger).

Data (settings, saved calculations) lives in `%APPDATA%\se.lyvan.payout\store.json`. The app never connects to the
network.

## Develop

Prerequisites: Node 22+, pnpm (`corepack enable`). The desktop shell additionally needs Rust (MSVC) and the
Microsoft C++ Build Tools - see [docs/dev-setup.md](docs/dev-setup.md).

```powershell
pnpm install
pnpm check          # typecheck + lint + test
pnpm dev:web        # the UI in a browser at http://localhost:1420 (no Rust needed; data in localStorage)
pnpm dev            # the desktop app (Tauri)
pnpm build          # installers (NSIS + MSI) in apps/desktop/src-tauri/target/release/bundle
pnpm demo 1500000   # print a comparison table in the terminal
```

## Layout

| Path | Purpose |
| --- | --- |
| `packages/engine` | Pure TypeScript engine (no UI / Node / Tauri dependencies; enforced by ESLint) |
| `packages/rules` | Versioned tax-year rule sets (data only) |
| `apps/desktop` | React UI (`src`) and the minimal Tauri shell (`src-tauri`) |
| `fixtures` | Golden test data, copied from Skatteverket's published examples |
| `docs` | Architecture, stack ADRs, domain spec, plan, UI spec, decisions log |

## Extending

- New tax year: [docs/adding-a-tax-year.md](docs/adding-a-tax-year.md)
- New payout scenario: [docs/adding-a-scenario.md](docs/adding-a-scenario.md)

## Documents

| File | Purpose |
| --- | --- |
| [docs/01-architecture.md](docs/01-architecture.md) | System architecture, module boundaries, data model |
| [docs/02-stack.md](docs/02-stack.md) | Technology stack + Architecture Decision Records |
| [docs/03-domain-tax-rules-2026.md](docs/03-domain-tax-rules-2026.md) | Swedish tax/payout rules and formulas (the spec) |
| [docs/04-plan.md](docs/04-plan.md) | Milestones and acceptance criteria |
| [docs/05-ui-spec.md](docs/05-ui-spec.md) | Screens and UI acceptance checklist |
| [docs/decisions-log.md](docs/decisions-log.md) | Deviations and decisions taken during development |

## Disclaimer

Estimates only. Not tax advice. All rule values are versioned per tax year and must be verified
against Skatteverket before each release.
