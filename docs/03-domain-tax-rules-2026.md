# 03 — Domain spec: Swedish payout rules (tax year 2026)

> **Status of values: `verified: false` (partly verified).** Verification status as of 2026-11-22:
>
> - **Verified against Skatteverket** (SKV 433 utgåva 36, 2025-12-10, and "Belopp och procent 2026"): PBB, IBB,
>   skiktgräns / brytpunkt, grundavdrag, jobbskatteavdrag (< 66), skattereduktion för förvärvsinkomst, public
>   service-avgift, allmän pensionsavgift, employer fees (standard, 67+, youth), egenavgifter incl. nedsättning,
>   3:12 grundbelopp and the 8 × IBB deduction. The engine reproduces the document's worked examples exactly
>   (`fixtures/se-2026/skv433-examples.json`).
> - **Still unverified** (marked ⚠ below and listed in `unverifiedItems` of the rule set): average municipal /
>   burial / church rates, SLP, ITP 1 rates, agreement holiday supplement, 3:12 wage-based rate (50 %) and
>   takbelopp, salary-exchange uplift, and that the periodiseringsfond does not reduce the egenavgifter base.
>
> The engine must treat all numbers below as **RuleSet data**, never hard-coded.

## 1. Rule values (`packages/rules/src/se/2026.ts`)

| Key | Value | Note |
| --- | --- | --- |
| `pbb` (prisbasbelopp 2026) | 59 200 ⚠ | used for grundavdrag, jobbskatteavdrag |
| `ibb` (inkomstbasbelopp 2026) | 83 400 ⚠ | ITP1 threshold 7.5 IBB/12 = 52 125/month (consistent) |
| `ibbPrevYear` (IBB 2025) | 80 600 | 3:12 grundbelopp |
| `employerFees.standard` | 0.3142 | no cap |
| `employerFees.reduced` (born 1938–1958 = 67+ **at the start of the year**) | 0.1021 | only ålderspensionsavgift (verified) |
| `employerFees.youth` | 0.2081 on ≤ 25 000/month, born 2003–2007 (age 18–22 at the start of the year), 2026-04-01 → 2027-09-30 | temporary reduction (verified) |
| `egenavgifter.standard` | 0.2897 | |
| `egenavgifter.reduction` | 7.5 % of base, max 15 000 kr (base ≤ 200 000) | *nedsättning* (SFS 2023:754; verified; the 40 000 kr minimum surplus is not modelled) |
| `slp` (särskild löneskatt på pensionskostnader) | 0.2426 | |
| `corporateTax` | 0.206 | |
| `municipalTaxAverage` | 0.3238 ⚠ | user-editable per municipality |
| `burialFeeAverage` | 0.00292 ⚠ | begravningsavgift (Stockholm/Tranås differ) |
| `stateTax.rate` | 0.20 | |
| `stateTax.skiktgrans` (taxable income) | 643 000 ⚠ | brytpunkt ≈ 660 400 gross (< 66 y) — derive, don't store |
| `publicPensionFee.rate` | 0.07, income cap 8.07 IBB | fully offset by tax reduction → net 0; show informational |
| `publicServiceFee` | 1 % of taxable income, max 1.42 × IBB × 1 % = **1 184 kr** | verified (SKV 433 §7.6) |
| `earnedIncomeCredit` (skattereduktion för förvärvsinkomst) | 0.75 % × (taxable income − 40 000), max **1 500 kr** | against municipal tax, after jobbskatteavdrag (SKV 433 §7.5.4) |
| `periodiseringsfond.maxPct` | 0.30 | sole trader |
| `seniorAge` | 66 (at the start of the year) | 66+ uses `grundavdragSenior` and `jsaSenior` (SKV 433 sections 6.2 and 7.5.2; verified) |
| `itp1` | 4.5 % ≤ 7.5 IBB/12 per month; 30 % above | default pension for salaried |
| `semester.days` | 25 | Semesterlagen |
| `semester.supplementPerDay` | 0.0043 of monthly salary (legal min); 0.008 common in agreements | monthly-salaried |
| `semester.compensationPct` | 0.12 | hourly / umbrella / pot models |
| `threeTwelve.dividendTaxRate` | 0.20 | within gränsbelopp (2/3 × 30 %) |
| `threeTwelve.grundbeloppIbbMultiple` | 4 × `ibbPrevYear` = 322 400, **per company**, split by ownership ⚠ | 2026 reform |
| `threeTwelve.wageBased` | 50 % × (company cash wages − 8 × IBB) ⚠ | which IBB year → verify; no individual salary requirement (2026 reform) |
| `threeTwelve.excess` | taxed as employment income (tjänst) up to cap, then capital 30 % ⚠ | verify cap (historically 90 IBB over 5 years) |
| `sgiCap` | 10 PBB = 592 000 | info: salary below → lower sickness/parental benefits |
| `pgiCap` | 7.5 IBB = 625 500 | info: pensionable income cap |

## 2. Shared tax functions

### 2.1 Personal income tax (`incomeTax`)

Input: `earnedIncome` FI (salary + holiday pay, or sole-trader surplus after egenavgifter), `person`, rules.
Age < 66 at start of year uses `grundavdrag` and `jsa`. From 66 (born 1959 or earlier in 2026) the förhöjt grundavdrag
is added to the ordinary one before rounding up, and `jsaSenior` replaces the jobbskatteavdrag (a reduction in kronor,
no grundavdrag, no municipal rate, still credited against municipal tax only). The info warning `AGE_66_PLUS` is shown.

1. **Grundavdrag (GA)** — in PBB, result **rounded up to nearest 100 kr**, never > FI:
   | FI range | GA |
   | --- | --- |
   | ≤ 0.99 PBB | 0.423 PBB |
   | 0.99 – 2.72 PBB | 0.423 PBB + 0.20 × (FI − 0.99 PBB) |
   | 2.72 – 3.11 PBB | 0.77 PBB |
   | 3.11 – 7.88 PBB | 0.77 PBB − 0.10 × (FI − 3.11 PBB) |
   | > 7.88 PBB | 0.293 PBB |
2. **Taxable income** `TI = floor100(FI − GA)`.
3. **Municipal tax** `= TI × municipalTaxRate`; **burial** `= TI × burialFeeRate`; **church** optional.
4. **State tax** `= 20 % × max(0, TI − skiktgrans)`.
5. **Jobbskatteavdrag (JSA)** — piecewise on arbetsinkomst AI (= FI for salary/active business, floored to
   100 kr), `KI` = municipal rate. Credited against municipal tax only; the result is floored to whole kronor.
   **Coefficients change yearly — take them from SKV 433.** The 2026 values below were verified (< 66 years).
   Structure:
   | AI range | JSA |
   | --- | --- |
   | ≤ a1·PBB | (AI − GA) × KI |
   | a1 – a2 PBB | (a1·PBB + c1 × (AI − a1·PBB) − GA) × KI |
   | a2 – a3 PBB | (b2·PBB + c2 × (AI − a2·PBB) − GA) × KI |
   | > a3 PBB | (b3·PBB − GA) × KI |
   2026 (SKV 433 §7.5.2): a1 0.91, a2 3.24, a3 8.08, c1 0.3874, b2 1.813, c2 0.251, b3 3.027. JSA capped at
   municipal tax. Stored as a data table in RuleSet (`jsa.tiers`) so 2027 needs no code change. There is no
   phase-out for high incomes in 2026.
6. **Public pension fee** 7 % × min(FI, 8.07 IBB), rounded to the nearest 100 (…50 rounds down) → offset by equal tax
   reduction → net 0.
7. **Public service fee** 1 % of taxable income, max 1.42 × IBB × 1 % (1 184 kr in 2026).
8. **Skattereduktion för förvärvsinkomst** 0.75 % × (TI − 40 000), max 1 500 kr, against remaining municipal tax.
9. **Net tax** = municipal + state + burial + church + public service − JSA − förvärvsinkomst credit (each credit
   limited to the municipal tax). Output every component (UI shows them in detail view).

Also export `marginalTaxRate(FI)` via finite difference (+100 kr) for UI hints.

### 2.2 Employer fees
`employerFees(gross, person, rules)` → standard 31.42 % unless age rules apply.

### 2.3 Pension
- `itp1Annual(annualGross)`: monthly m = gross/12; `12 × (0.045 × min(m, T) + 0.30 × max(0, m − T))`, T = 7.5 IBB / 12.
- `customPension(pct | fixed)`; `loneVaxling(amount)` (salary exchange: reduces gross, premium += amount × (1 + uplift), uplift default 0.058 ⚠ common practice to offset fee/SLP difference — configurable).
- `slp(premium) = premium × 0.2426`.

### 2.4 Employer cost solver
For scenarios 1, 2, 3: given a **budget B** (money available for the person), find gross salary S with
`cost(S) = S + H(S) + fees(S + H(S)) + P(S) × (1 + slp) = B` where H = holiday pay, P = pension.
`cost` is strictly increasing → bisection on S ∈ [0, B].

## 3. Scenarios

Common: `revenue` R (ex VAT), `overhead` O, `person`.
All results must satisfy the reconciliation invariant (see architecture §3.4).

### Scenario 1 — `salaried` (Traditional salaried employee)
Inputs: `firmRetentionPct` (default 0.30 — LYVAN keeps for sales, bench, profit; overhead is paid from it),
`pensionModel` ('itp1' default | pct | none), `holidayModel` ('supplement' default, rate 0.0043/0.008).
- Budget `B = R × (1 − firmRetentionPct)`; company line = `R × firmRetentionPct` (party company).
- Solve S. Lines: gross salary, holiday supplement, employer fees, pension premium, SLP, income tax
  components, **net cash**.
- Info: bench risk covered by firm; paid sick/vacation.

### Scenario 2 — `revenue-share` (70/30, 80/20, egen pott)
Inputs: `firmCutPct` (presets 0.30 / 0.20 / 0.15 / 0.10; default 0.20), `overheadFromPot` (bool, default
false), `pensionModel` (default 'itp1'; allow 'pct', 'none', + `loneVaxling`), `holidayModel`
(default 'compensation-12pct' since pot models usually include it ⚠ confirm LYVAN policy).
- `B = R × (1 − firmCutPct) − (overheadFromPot ? O : 0)`; solve S as in 1.
- Warning `ABOVE_BRYTPUNKT` when salary > brytpunkt with hint "consider löneväxling".

### Scenario 3 — `umbrella` (Egenanställning)
Inputs: `providerFeePct` (default 0.05, range 0.02–0.08), `expenses` (= O, deducted before salary),
`pensionPct` (default 0), holiday = 12 % compensation.
- Provider fee line (party provider) `= R × providerFeePct`; `B = R − fee − O`; solve S.
- Note: no unemployment-insurance continuity issues modelled.

### Scenario 4 — `sole-trader` (Enskild firma)
Inputs: `periodiseringsfondPct` (0 – `periodiseringsfond.maxPct`, default 0; larger values are capped with a
warning), `privatePension` (v1: 0, future).
- `S = R − O` (surplus).
- Egenavgifter on the **whole** surplus: find EA with `EA = 0.2897 × base − min(0.075 × min(base, 200 000), 15 000)`
  where `base = S − EA` (fixed-point / bisection). Use 25 % schablonavdrag only as an explanation — the
  steady-state result is the exact fixed point. ⚠ An allocation to a periodiseringsfond is assumed not to reduce
  the contribution base (to be verified).
- Income after egenavgifter `I = S − EA`; allocation = `pct × I` (party consultant, kind 'retained', flagged
  "taxed later").
- Taxable earned income `FI = I − allocation` → `incomeTax` (counts as arbetsinkomst for JSA).
- Net cash = FI − netTax.
- Info: no employer pension; owner bears all risk; personal liability.

### Scenario 5 — `own-ab` (Eget aktiebolag / partner AB, salary + 3:12)
Inputs:
- `brokerFeePct` (LYVAN fee if subcontracted via LYVAN, default 0.05; 0 = direct client)
- `salaryStrategy`: `'brytpunkt'` (default: salary so FI = brytpunkt) | `'custom'` (amount) | `'optimize'`
- `pensionModel` (default pct/ITP1-like on salary), `ownershipPct` (default 1.0), `ownersInCompany`
  (info), `savedDividendSpace` (sparat utdelningsutrymme, default 0), `capDividendAtGransbelopp`
  (default **true**; remainder retained in AB).
- Calculation (steady-state single year; dividend assumed paid next spring from this year's profit,
  gränsbelopp computed with **this RuleSet** and this year's wages — documented simplification):
  1. broker fee = R × brokerFeePct (party company=LYVAN)
  2. salary S per strategy; employer fees; pension + SLP; overhead O
  3. profit `P = R − fee − O − S − fees − pension − SLP`; if P < 0 → error `NEGATIVE_PROFIT`
  4. corporate tax `= 0.206 × P` (floor100 profit ⚠ verify rounding); distributable `D = P − tax`
  5. gränsbelopp `G = grundbelopp × ownershipPct + wageBased + saved`
  6. dividend `Div = cap ? min(D, G) : D`; retained = D − Div (party company/own AB, kind 'retained')
  7. dividend tax: `0.20 × min(Div, G)`; excess `Div − G` taxed as employment income
     (marginal: incomeTax(S + excess) − incomeTax(S)) → warning `DIVIDEND_EXCEEDS_GRANSBELOPP`
  8. net cash = net salary + Div − dividend taxes
- **Optimizer**: grid (step 10 000 kr) + golden-section refine over S ∈ [0, max], maximize
  `netCash + w × pensionValue + v × retained` (defaults w = 0.6, v = 0.7 ⚠ user-tunable "value of a
  krona in pension / left in AB"). Return best S plus curve for chart.
- Warnings: `SALARY_BELOW_SGI_CAP`, `SALARY_BELOW_PGI_CAP` (benefit/pension impact), `PARTNER_SHARES_GRUNDBELOPP`
  when ownershipPct < 1.

## 4. Totals & KPI definitions
- `netCash` — cash to consultant after all personal taxes (excl. pension, excl. retained).
- `pensionValue` — pension premiums (excl. SLP).
- `consultantValue` — netCash + pensionValue (+ retained in own AB shown separately).
- `effectiveTaxRate` — (all taxes + fees to state) / (R − O − company/provider cut).
- `netPctOfRevenue` — netCash / R.

## 5. Golden tests (`fixtures/se-2026/*.json`)
1. **Income tax**: ≥ 8 salary points (240k, 360k, 480k, 600k, 660.4k, 720k, 900k, 1.2M) at 32.38 % —
   expected net from Skatteverket's calculator "Räkna ut din skatt" / tables. Tolerance ± 200 kr/yr.
   *If expected values are not yet available: create the fixture file with `"expected": null` and
   `"status": "TODO_VERIFY"`, and skip those tests (do not invent numbers).*
2. **Reference example** (from LYVAN brief): Scenario 5, R = 1 500 000, O = 100 000, S = 660 400,
   pension+SLP = 60 000, brokerFee 0 → profit 472 102, corp tax 97 253, D = 374 849 (exact).
   With cap: G ≈ 322 400 + 50 % × (660 400 − 8 IBB) — assert warning raised / retained > 0.
3. **Invariant property tests** (fast-check): for R ∈ [100 000, 5 000 000] and random valid inputs,
   every scenario reconciles to R and `netCash` is non-decreasing in R.
4. **Ceilings**: Scenario 2 with firmCut 0, pension none, holiday none → S = R / 1.3142 ± 1 kr.
