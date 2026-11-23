# 02 — Stack & Architecture Decision Records

## Stack summary

| Layer | Choice | Version policy |
| --- | --- | --- |
| Runtime / tooling | Node.js **22 LTS**, **pnpm** workspaces | pin via `packageManager` + `.nvmrc` |
| Language | **TypeScript** (strict, `noUncheckedIndexedAccess`) | latest 5.x |
| Engine tests | **Vitest** + **fast-check** (property tests) | latest |
| Validation | **zod** | latest (v4 if stable) |
| Desktop shell | **Tauri 2** (Rust stable, MSVC toolchain, WebView2) | latest 2.x |
| UI | **React 19** + **Vite** | latest |
| Styling | **Tailwind CSS v4** + **shadcn/ui** (Radix primitives) | latest |
| Charts | **Recharts** | latest |
| State | **Zustand** | latest |
| Forms | **react-hook-form** + zod resolver | latest |
| i18n | **i18next** + react-i18next (sv default, en) | latest |
| Persistence | `@tauri-apps/plugin-store` (JSON) | 2.x |
| Dialogs / files | `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs` (export) | 2.x |
| Lint/format | ESLint (flat config, typescript-eslint) + Prettier | latest |
| Packaging | Tauri bundler → **NSIS .exe** and **MSI** for Windows 11 x64 | — |
| CI (later) | GitHub Actions `windows-latest`: lint, test, build installer | — |

### Windows 11 developer prerequisites
1. Microsoft C++ Build Tools ("Desktop development with C++" workload)
2. Rust via `rustup` (stable, `x86_64-pc-windows-msvc`)
3. WebView2 runtime (pre-installed on Windows 11)
4. Node 22 LTS + `corepack enable` (pnpm)

---

## ADR-001: Tauri 2 over Electron / .NET (WPF/WinUI)

- **Context:** Windows 11 desktop first, but "open for future development" incl. web.
- **Decision:** Tauri 2 with a React webview UI.
- **Why:** ~5–10 MB installer vs ~100 MB Electron; uses Win11's built-in WebView2; UI code + TS engine
  are 100% reusable for a future web app (a .NET UI would not be); strong security model (capabilities).
- **Trade-off:** Rust toolchain needed to build. Mitigation: no business logic in Rust.

## ADR-002: Calculation engine is a pure TypeScript package

- **Decision:** `packages/engine` has no dependency on React, Tauri, DOM, or Node APIs (only zod).
- **Why:** testable in isolation, reusable by desktop/web/CLI/API, deterministic.

## ADR-003: Tax rules as versioned data, separate package

- **Decision:** `packages/rules/src/se/<year>.ts`, typed `RuleSet`, each value with a source comment
  and `verified` flag.
- **Why:** Swedish rules change every 1 January (PBB, IBB, skiktgräns, jobbskatteavdrag, 3:12).
  Yearly update should be a data change + fixtures, not a code change.

## ADR-004: Waterfall output with reconciliation invariant

- **Decision:** every scenario returns ordered `Line[]` tagged by receiving party; sum must equal revenue.
- **Why:** trust & auditability ("where did my money go?"), and catches modelling bugs automatically.

## ADR-005: Scenario plugin registry

- **Decision:** each scenario implements `ScenarioDefinition` and is registered; UI iterates registry.
- **Why:** adding a 6th/7th payout model must not require UI rewrites.

## ADR-006: Number handling

- **Decision:** JS `number` in SEK; round only at defined points (taxable income floored to 100 kr,
  grundavdrag ceiled to 100 kr, final amounts to whole kr). No decimal library.
- **Why:** magnitudes ≤ 10^8, precision of doubles is ample; simplicity. Revisit if öre-precision payroll is added.

## ADR-007: Offline, local-only storage

- **Decision:** JSON store in `%APPDATA%`; no network, no telemetry in v1.
- **Why:** salary data is sensitive; zero-backend keeps v1 simple. Tauri capabilities must not enable HTTP.

## ADR-008: Standalone repository

- **Decision:** LYVAN Payout lives in its own repo (`D:\PROJECT\LYVAN_Payout`), not inside JobSearch_system.
- **Why:** different product, different toolchain (Rust/Tauri); avoids the Next.js tsconfig/eslint
  picking up the code. A future web version can consume `@lyvan/engine` as a package.
