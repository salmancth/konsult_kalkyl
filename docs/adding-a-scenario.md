# Adding a scenario

1. Create `packages/engine/src/scenarios/<id>/` with:
   - `schema.ts` - zod schema for the scenario options (every field with a default and **explicit bounds**).
   - `calculate.ts` - `calculate<Name>(common, options, rules): ScenarioResult` plus a `ScenarioDefinition` export.
   - Put the pure number crunching in a function that does not build the waterfall if the scenario will be
     optimised or swept (see `own-ab/compute.ts`: `computeOwnAb` is cheap, `buildOwnAb` adds the waterfall).
2. Build the result with `Waterfall` + `makeResult` (see `scenarios/shared`). Allocation lines must sum to revenue;
   choose a `balanceKey` that absorbs **only rounding** - the reconciliation check fails if the balancing line absorbs
   more than `MAX_BALANCE_ADJUSTMENT` (10 kr) unless the result carries an `error` warning. Every line needs a
   `formula`. Take every rate and threshold from the `RuleSet`; if a number is missing, add it to the rule set.
3. Add the new id to `ScenarioId` in `packages/engine/src/types.ts`.
4. Register the definition in `packages/engine/src/registry.ts`.
5. Tests in `packages/engine/src/scenarios.test.ts`: a `describe` block for the scenario, the id in the `ids` list
   (property tests: reconciliation and monotonicity), and a case for invalid options (`EngineInputError`).
6. UI:
   - `apps/desktop/src/features/calculator/scenarioFields.ts`: one `FieldDef` per option, with `min` / `max` equal to
     the zod bounds. `scenarioFields.test.ts` fails if the UI allows a value the engine rejects.
   - `apps/desktop/src/lib/colors.ts`: a colour in `SCENARIO_COLORS`.
   - `apps/desktop/src/i18n/{sv,en}.json`: `scenario.<id>.label/description`, `opt.*` labels, `line.*` labels,
     `warning.*` and `assumption.*` for every code/key the scenario emits. Unit tests do not check translations; run
     the app and open the detail drawer in both languages.
7. If the scenario has LYVAN defaults (a cut or fee), add them to `LyvanDefaults` in `state/model.ts`, the settings
   view and `LYVAN_DEFAULT_TARGETS`.

The UI iterates the registry, so cards, the compare chart, the sweep, the detail drawer, CSV export and the print
report pick the new scenario up automatically.
