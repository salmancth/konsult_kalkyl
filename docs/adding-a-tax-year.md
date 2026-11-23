# Adding a tax year

1. Copy `packages/rules/src/se/2026.ts` to `packages/rules/src/se/2027.ts`; rename the export (`SE_2027`), set
   `id: 'SE-2027'`, `year: 2027`, `verified: false`.
2. Update every value from Skatteverket - the yearly **SKV 433** ("Teknisk beskrivning skattetabeller") and
   "Belopp och procent": PBB, IBB (and `ibbPrevYear`), employer fees (standard / 67+ / youth, with the *age at the
   start of the year*), skiktgräns, grundavdrag tiers, jobbskatteavdrag tiers (SKV 433 section "Skattereduktion för
   arbetsinkomst"), `earnedIncomeCredit`, public service fee (`maxIbbMultiple`), egenavgifter, 3:12 values, the
   periodiseringsfond maximum, etc. Keep a `// source:` comment per value and a `// VERIFY:` comment for anything you
   could not confirm.
3. List every value you could not verify in `unverifiedItems` (the UI shows them in the banner and in Settings;
   add a label under `ruleItem` in `apps/desktop/src/i18n/{sv,en}.json`). Leave `verified: false` until the list is
   empty.
4. Register it in `packages/rules/src/index.ts` (import + add to `registry`). The UI offers every registered year.
   Also generate the municipal rates once SCB publishes them: `node scripts/fetch-localities.mjs 2027` writes
   `packages/rules/src/se/localities-2027.ts`; import it and add it to `localityRegistry` in the same file. The national
   averages in the rule set (`municipalTaxAverage`, `burialFeeAverage`, `defaultChurchFeeRate`) must equal SCB's
   national figures (`localities.test.ts` checks this for 2026).
5. Add golden fixtures: copy `fixtures/se-2026/skv433-examples.json` to `fixtures/se-2027/` and replace the figures
   with the worked examples printed in the new SKV 433, then copy `packages/engine/src/tax/skv433.test.ts` and point
   it at the new file (and `SE_2027`). The expected values must come from the official document - never from the
   engine's own output.
6. Run `pnpm check`. Engine code should not need changes unless the law changed structurally (for example a new
   tier or a new tax reduction: then extend `RuleSet` and `personalIncomeTax.ts` and add a fixture for it).
7. Set `verified: true` only after every item in `unverifiedItems` has been checked.
