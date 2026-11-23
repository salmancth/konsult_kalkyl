# Developer setup (Windows 11)

## Prerequisites

1. Node.js 22+ (`node -v`) and pnpm (`corepack enable`, then `pnpm -v`)
2. For the desktop shell and installers only:
   - **Microsoft C++ Build Tools** ("Desktop development with C++" workload, includes the Windows SDK).
     Without it `rustc` cannot link and `pnpm tauri dev|build` fails. Install (needs admin rights):

     ```powershell
     winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
     ```

     (or download "Build Tools for Visual Studio 2022" from <https://visualstudio.microsoft.com/downloads/> and tick
     "Desktop development with C++").
   - Rust via `rustup` (stable, host `x86_64-pc-windows-msvc`): `rustc -vV` must print `host: x86_64-pc-windows-msvc`.
   - WebView2 runtime (pre-installed on Windows 11).

Check: `where cl` should find `cl.exe` from a "Developer PowerShell for VS" session, and
`%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe` must exist.

## Commands

```powershell
pnpm install
pnpm check             # typecheck + lint + test (what CI runs)
pnpm test              # engine + rules + desktop tests
pnpm test:coverage     # engine coverage (>= 95 % on core/ and tax/)
pnpm typecheck
pnpm lint
pnpm demo 1500000      # print a comparison table for a revenue
pnpm dev:web           # UI only, in a browser (Vite, http://localhost:1420, data in localStorage)
pnpm dev               # desktop app (Tauri) - needs the C++ Build Tools
pnpm build             # NSIS + MSI installers - needs the C++ Build Tools
pnpm build:offline       # same, with the WebView2 runtime embedded (about 130 MB larger; unverified)
```

The engine (`packages/engine`) needs only Node. The calculator UI can be developed in a browser with
`pnpm dev:web` (no Rust). `localStorage` stands in for the Tauri store there (`src/lib/platform.ts`).

## Installers

`pnpm build` runs `tauri build`: it builds the web UI (`pnpm build:web`), compiles the Rust shell in release mode
and bundles **NSIS** (`bundle/nsis/*.exe`, per-user install) and **MSI** (`bundle/msi/*.msi`). The first run
downloads the NSIS and WiX tooling. The version comes from the root `package.json`.

Smoke test before releasing: install on a clean Windows 11 user account, start the app, change a value, save a
calculation, close and reopen (data must persist), export a CSV, print to PDF, uninstall.

## Release checklist

1. `pnpm check` is green and `pnpm audit` reports no high/critical advisories.
2. Verify every item in `unverifiedItems` of the rule set against Skatteverket, then set `verified: true`.
3. Bump the version in the root `package.json`, update `CHANGELOG.md`, tag `vX.Y.Z` (the CI builds the installers).
