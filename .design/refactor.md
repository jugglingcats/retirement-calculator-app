# Refactor: `calculations.ts`, `yearlyExport.ts`, `yearlyExcelExport.ts` and `RetirementProjection`

## 1. Goals

The current code path that produces a year-by-year retirement projection mixes
three concerns into one big function (`calculateProjection` in
`lib/calculations.ts`):

1. **Simulating** the retirement year (growth, one-offs, shocks, drawdown,
   tax, CGT) on per-person asset *pools*.
2. **Summarising** the result of that year as a flat per-household record
   (`YearlyDatapoint` with `cash`, `stocks`, `isa`, `pension`,
   `pensionCrystallised`, `property`, `assets`, …).
3. **Re-attaching** a per-pool view (`byPool`, `withdrawalsByPool`) for the
   table / Excel export.

That has produced three real problems:

- **Two parallel "shapes" for the same numbers**: the flat summary on
  `YearlyDatapoint` and the structured `byPool`/`withdrawalsByPool` are
  computed in the same loop and must stay consistent. They drift very
  easily.
- **Per-pool data is collapsed into `combinedAssets` only to be split
  again** in `yearlyExport.ts`. The "me + spouse" split is preserved in
  `byPool`, but is also re-summed into the flat fields, and the "totals"
  in `withdrawalsByPool.totals` are recomputed yet again from
  `withdrawalsByPool[0]/[1]`.
- **Duplicated helpers / display config**: `createEmptyAssetBalances`,
  `emptyAssetMap`, `sumAssets`, `sumAssetMap`, `sumNumbers`,
  `ASSET_DISPLAY_ORDER`, `ASSET_LABELS`, etc. exist in two or three
  places (`lib/utils.ts`, `lib/calculations.ts`, `lib/yearlyExport.ts`,
  `components/RetirementProjection.tsx`).

This document describes the target shape, the migration path, and what
each touched piece of code (calculation, display, table export, Excel
export, tests) ends up looking like.

## 2. Guiding principle: keep pools separate until display

`calculateProjection` keeps `assetPools: [primary, spouse]` for the
entire year. The moment we currently leave that representation is at
the very end of the loop:

```ts
const combinedAssets = combineAssets(assetPools)
// …
yearlyData.push({
    year, age,
    assets: ...,
    cash: combinedAssets.cash,
    stocks: combinedAssets.stocks,
    isa: combinedAssets.isa,
    pension: combinedAssets.pension,
    pensionCrystallised: combinedAssets.pensionCrystallised,
    property: combinedAssets.property,
    // …plus byPool, plus withdrawalsByPool which duplicates byPool[*].withdrawals
})
```

The refactor proposes:

- The simulator emits a **single, per-pool, structured year record**.
- A small **selector layer** computes the household-level numbers
  (`assets`, flat asset totals, `assetWithdrawals`, etc.) from that
  per-pool record on demand.
- Both the chart and the breakdown table read from that selector layer;
  no one reads "raw" arrays of pools directly.

This means the *only* place that knows how to fold primary + spouse
into a household total is the selector, and the per-pool breakdown is
the source of truth.

## 3. Target data model

### 3.1 `YearlyDatapoint` becomes per-pool first, household second

In `lib/types.ts`:

```ts
// Single per-person view of one simulated year.
export interface PoolYear {
    // Balances after start-of-year carry-over, bed&ISA, growth, one-offs and market
    // shocks have been applied — i.e. the position the drawdown strategy sees.
    // End-of-year balances are *not* stored: they are derived as
    //   endPosition[t] = initialPosition[t] - withdrawals[t]
    // since tax and CGT are paid out of cash and are already reflected in `withdrawals.cash`.
    initialPosition: AssetPool
    income: {
        statePension: number
        otherIncome:  number       // non-state pension income (e.g. DB pensions, salary), previously called retirementIncome
    }
    withdrawals:    AssetPool    // positive reductions only (includes cash spent on income tax and CGT)
    tax:            number       // income tax payable by this person
    cgtPayable:     number       // CGT payable by this person
}

// Derived end-of-year balances. Lives in `lib/yearlyView.ts`:
//   export const endPosition = (p: PoolYear): AssetPool =>
//       Object.fromEntries(
//           Object.values(AssetType).map(t =>
//               [t, (p.initialPosition[t] || 0) - (p.withdrawals[t] || 0)]),
//       ) as AssetPool

export interface YearlyDatapoint {
    year: number
    age: number                       // primary's age
    spouseAge?: number
    inflationMultiplier: number       // useful for the table

    // Source of truth: per-pool simulated values.
    // Index 0 is the primary ("me"); index 1 is the spouse and is always present
    // (an "empty" PoolYear when no spouse is configured).
    pools: [PoolYear, PoolYear]

    // Household-level scalars that aren't a sum of the two pools and so must be stored.
    expenditure: number               // household target spending (after inflation)
    shortfall:   number               // unmet expenditure for the year
}
```

What we drop from `YearlyDatapoint`:

- `assets`, `cash`, `stocks`, `isa`, `pension`, `pensionCrystallised`,
  `property` — derived.
- `income`, `statePension`, `otherIncome`, `taxPayable`,
  `cgtPayable`, `assetWithdrawals` — derived.
- `withdrawalsByPool` — fully replaced by `pools[i].withdrawals` plus the
  household selector.

### 3.2 A single small "household view" selector

`lib/yearlyView.ts` (new):

```ts
import { AssetPool, AssetType, YearlyDatapoint } from "@/lib/types"

export const ASSET_TYPES_IN_ORDER: AssetType[] = [
    AssetType.Cash,
    AssetType.ISA,
    AssetType.StocksAndShares,
    AssetType.Bonds,
    AssetType.PensionCrystallised,
    AssetType.Pension,
    AssetType.Property,
]

export const ASSET_LABELS: Record<AssetType, string> = { /* moved from yearlyExport.ts */ }

export const emptyAssetPool = (): AssetPool =>
    Object.fromEntries(Object.values(AssetType).map(t => [t, 0])) as AssetPool

export const sumPool = (p: AssetPool): number =>
    Object.values(p).reduce((a, b) => a + (b || 0), 0)

export const addPools = (a: AssetPool, b: AssetPool): AssetPool => {
    const out = emptyAssetPool()
    for (const t of Object.values(AssetType)) out[t] = (a[t] || 0) + (b[t] || 0)
    return out
}

// End-of-year balances for one pool, derived from `initialPosition - withdrawals`.
// `withdrawals.cash` already accounts for cash spent on income tax and CGT.
export const endPosition = (p: PoolYear): AssetPool => {
    const out = emptyAssetPool()
    for (const t of Object.values(AssetType))
        out[t] = (p.initialPosition[t] || 0) - (p.withdrawals[t] || 0)
    return out
}

// "Flat" household snapshot for charts/tooltips/tests.
export interface HouseholdYearly {
    year: number
    age: number
    // Combined end-of-year balances:
    cash: number; stocks: number; isa: number; bonds: number
    pension: number; pensionCrystallised: number; property: number
    assets: number               // total of the seven above
    // Combined income:
    statePension: number
    otherIncome: number
    income: number               // statePension + otherIncome
    // Combined outflows:
    assetWithdrawals: number
    taxPayable: number
    cgtPayable: number
    // Carried through from YearlyDatapoint:
    expenditure: number
    shortfall: number
}

export function householdYearly(yd: YearlyDatapoint): HouseholdYearly { /* sums pools */ }
export function householdYearlySeries(yds: YearlyDatapoint[]): HouseholdYearly[]
```

Why a selector and not stored fields?

- Single source of truth (the per-pool record).
- Trivial to test in isolation.
- Removes the need to keep flat fields in sync inside the simulation
  loop.

## 4. `lib/calculations.ts` simplifications

Concrete clean-ups, in the order they should be applied:

1. **Promote pools to first-class structures.** Keep the array tuple
   shape `[primary, spouse]` but bundle `balances` and `baseCosts`
   together so we don't carry two parallel length-2 arrays:

   ```ts
   interface PoolState {
       balances:  AssetPool
       baseCosts: BaseCostPool
   }
   // Index 0 = primary ("me"), index 1 = spouse. Always length 2.
   const state: [PoolState, PoolState] = [primaryState, spouseState]
   ```

   The `applyBedAndISA`, `applyGrowth`, `applyOneOffs`,
   `applyMarketShock` helpers, and `createDrawdownStrategy(...).execute`
   already iterate a length-2 array; they keep doing so against
   `state[0]` / `state[1]` directly.

2. **Keep the existing `AssetPoolType.PRIMARY/SPOUSE` numeric indexing.**
   The simulator continues to address pools by numeric index (`state[0]`,
   `state[1]`); `AssetPoolType` remains a small `enum { PRIMARY = 0,
   SPOUSE = 1 }` so call sites like
   `acc[AssetPoolType.SPOUSE] += amount` keep reading naturally and
   `pools` on `YearlyDatapoint` is a `[PoolYear, PoolYear]` tuple end to
   end.

3. **Delete `combineAssets` and `combinedAssets` from this file.** The
   loop only needs *per-pool* data plus the household scalars
   `expenditure` and `shortfall`. The combined view is computed by
   `householdYearly` in `lib/yearlyView.ts`.

4. **Compute `runsOutAt` from the household selector**, not from a
   stored `currentTotalAssets`:

   ```ts
   // `state[i].balances` here is the live working copy at end-of-year, i.e. after
   // drawdown and tax/CGT settlement — the same value `endPosition(pools[i])` would
   // produce after the year is recorded.
   const totalAssets = state.reduce((sum, p) => sum + sumPool(p.balances), 0)
   if (totalAssets <= 0 && !runsOutAt && age >= retirementAge) runsOutAt = year
   ```

   (Same value, but the simulator no longer fabricates a flat record.)

5. **Drop helpers that are now in `lib/yearlyView.ts`**:
   `createEmptyAssetBalances`, the `BaseCostPool` builder helpers stay,
   but `combineAssets` is gone. `assetTypes` / `growthRateFor` / etc.
   continue to live in `lib/utils.ts`.

6. **Encapsulate per-year side-effects into named steps** so the loop
   reads as a pipeline:

   ```ts
   for (let age = currentAge; age <= maxAge; age++) {
       runStartOfYear(state, ages, assumptions)          // bed&ISA
       runMarketEffects(state, year, age, ...)           // growth, oneOffs, shocks
       const initial = snapshotPools(state)              // post-growth, pre-drawdown snapshot — this is `PoolYear.initialPosition`
       const income = computeIncome(year, ages, ...)     // [primary, spouse] state pension + otherIncome
       const taxPos = computeInitialTax(income, ...)
       runDrawdown(state, age, retirementAge, ...)
       const tax    = settleIncomeTax(state, taxPos, initial)  // [taxPrimary, taxSpouse]
       const cgt    = settleCGT(state, initial, baseCosts, ...) // [cgtPrimary, cgtSpouse]
       // `withdrawals[i] = initial[i] - state[i].balances` per asset type, so end-of-year
       // balances are recoverable as `initialPosition - withdrawals` and don't need to be stored.
       yearlyData.push(buildYear(year, age, initial, state, income, tax, cgt, expenditure, shortfall))
   }
   ```

   No new functionality — just extracting the inline blocks that are
   already separated by comments today. `buildYear` is the only place
   that constructs `YearlyDatapoint`.

After this, `calculateProjection` is roughly half its current size and
no longer mentions `combinedAssets`, `withdrawalsDetailPerPool`,
`totalWithdrawals`, `taxableWithdrawals`, `cgtWithdrawalsPerPool`,
`cgtResults` as four parallel arrays — they live in their step
functions.

## 5. `lib/yearlyExport.ts` simplifications

Today this file:

- Owns `ASSET_DISPLAY_ORDER` and `ASSET_LABELS`.
- Re-implements `emptyAssetMap` and `sumAssetMap`.
- Re-implements a defensive `poolBreakdown` because `byPool` is
  optional on `YearlyDatapoint`.
- Reconstructs the household income total from `yd.byPool` because
  `yd.income` is the *taxable* income and not what the table wants.

After the refactor:

```ts
import { ASSET_LABELS, ASSET_TYPES_IN_ORDER, sumPool, householdYearly } from "@/lib/yearlyView"
import { YearlyExportRow, YearlyExportTable } from "./yearlyExport.types"
import { AssetPoolType } from "@/lib/types"   // enum { PRIMARY = 0, SPOUSE = 1 }

export function buildYearlyExportTable(
    data: RetirementData,
    projection: ProjectionResult,
): YearlyExportTable {
    const hasSpouse = !!data.personal.spouseDateOfBirth
    const rows: YearlyExportRow[] = []

    for (const yd of projection.yearlyData) {
        const hh = householdYearly(yd)
        for (let poolIndex = 0; poolIndex < yd.pools.length; poolIndex++) {
            const p = yd.pools[poolIndex]
            const isSpouse = poolIndex === AssetPoolType.SPOUSE
            if (isSpouse && !hasSpouse && isEmptyPool(p)) continue
            rows.push(buildRow(yd, hh, poolIndex, p))
        }
    }
    return { rows, visibleAssetTypes: visibleColumns(rows), hasSpouse }
}
```

Where `buildRow`:

- Receives `poolIndex: 0 | 1` (i.e. `AssetPoolType`) — rows are tagged by
  the same numeric index used everywhere else in the simulator. The row
  type carries `poolIndex` (not a `"primary" | "spouse"` key).
- Takes `initial` directly from `p.initialPosition` (no copying, no
  `?:` defaults — `pools` is no longer optional).
- Takes `withdrawals` directly from `p.withdrawals`.
- Puts household-level expenditure/tax/cgt only on the primary row
  (`poolIndex === AssetPoolType.PRIMARY`), as today, but now reads them
  from `hh` (the selector), so primary and spouse rows can never
  disagree.
- `netIncomeExpenditure` is just `hh.income − (hh.expenditure +
  hh.taxPayable + hh.cgtPayable)`, on the primary row.

Other clean-ups:

- Move `ASSET_DISPLAY_ORDER` → `ASSET_TYPES_IN_ORDER` and `ASSET_LABELS`
  into `lib/yearlyView.ts`. `yearlyExport.ts` imports them.
- Delete the local `emptyAssetMap` and `sumAssetMap` helpers.
- Split the file: keep types
  (`YearlyExportRow`/`YearlyExportTable`) in
  `lib/yearlyExport.types.ts` so that
  `RetirementProjection.tsx` can import the row/types without bringing
  in the full builder. Rows carry `poolIndex: AssetPoolType` rather
  than a string `PoolKey`, matching the `[primary, spouse]` indexing
  used by the simulator.

## 6. `lib/yearlyExcelExport.ts` simplifications

Largely unaffected. Concrete tweaks:

- It no longer needs to import `ASSET_LABELS` from `yearlyExport.ts`;
  it uses `lib/yearlyView.ts`.
- `buildColumns` already builds dynamic groups from
  `table.visibleAssetTypes`. Two small wins:
  - Replace the four near-identical `cols.push(...)` blocks for income
    / expenditure / withdrawals / initial with a tiny helper:

    ```ts
    const currency = (
        header: string, group: ColumnSpec["group"], width: number,
        value: (r: YearlyExportRow) => number,
    ): ColumnSpec => ({ header, group, width, currency: true, value })
    ```

  - Generate the per-asset columns through one shared loop:

    ```ts
    const assetCols = (group: "initial" | "withdrawals", pick: (r, t) => number) =>
        table.visibleAssetTypes.map(t =>
            currency(`${group === "initial" ? "Initial" : "Withdraw"}: ${ASSET_LABELS[t]}`,
                     group, 18, r => pick(r, t)))
    ```

That's it — the styling, banding, group merging and auto-filter logic
all stay.

## 7. `components/RetirementProjection.tsx` clean-ups

The component currently:

- Re-defines `assetDisplayOrder` and `assetLabels` (lines 148–166),
  duplicating `yearlyExport.ts`.
- Reads flat fields from `yearlyData` (`cash`, `stocks`, `isa`,
  `pensionCrystallised`, `pension`, `property`, `assets`,
  `assetWithdrawals`, `expenditure`, `taxPayable`, `cgtPayable`,
  `statePension`, `otherIncome`, `shortfall`) for the AreaChart,
  the AssetTooltip, and the ComposedChart "Income vs Expenditure".

Steps:

1. **Use `householdYearlySeries`.** Replace
   `const { yearlyData } = projections[strategy]` with:

   ```ts
   const yearlyData     = projections[strategy].yearlyData          // per-pool source of truth
   const householdSeries = useMemo(() => householdYearlySeries(yearlyData), [yearlyData])
   ```

   `<AreaChart data={householdSeries}>` and
   `<ComposedChart data={householdSeries}>` keep all of their existing
   `dataKey="cash"`, `dataKey="assetWithdrawals"`, etc. — those keys
   exist on `HouseholdYearly` exactly as before.

2. **Remove the local `assetDisplayOrder` / `assetLabels` constants.**
   Import `ASSET_TYPES_IN_ORDER` and `ASSET_LABELS` from
   `lib/yearlyView.ts`.

3. **Tooltip cleanup.** `AssetTooltip` already iterates Recharts'
   `payload` and reads `curr[key]` / `prev[key]`. Because
   `HouseholdYearly` is *typed*, drop the `as any` casts.

4. **`fixedYAxisMax`.** Currently scans `yearlyData.map(d => d.assets)`
   for each strategy. Switch to:

   ```ts
   const maxFrom = (yds: YearlyDatapoint[]) =>
       yds.length
           ? Math.max(...yds.map(yd =>
               yd.pools.reduce((sum, p) => sum + sumPool(endPosition(p)), 0)))
           : 0
   ```

   (Or just `householdYearlySeries(yds).map(h => h.assets)`.)

5. The per-person `primaryHasPension` / `spouseHasPension` memos are
   already pool-aware on `data.assets`; they don't change.

Net effect: the component no longer knows about flat per-asset fields
on `YearlyDatapoint`. It only knows about `HouseholdYearly` (chart) and
`YearlyExportTable` (breakdown table) — both are derived from the same
per-pool simulation output.

## 8. Tests

There are three test files that touch the projection's flat fields:
`tests/calculations.test.ts`, `tests/bedAndISA.test.ts`, and
`tests/drawdown.test.ts`. None of them touch `byPool` or
`withdrawalsByPool` today.

Two strategies are possible. The recommended one keeps tests readable
and asserts the household-level invariants explicitly:

1. **Add a `toHousehold(yd: YearlyDatapoint): HouseholdYearly` helper
   exported from `lib/yearlyView.ts` (it's just `householdYearly`)** and
   replace assertions like:

   ```ts
   expect(firstYear.pension + firstYear.pensionCrystallised).toBe(80_000)
   expect(firstYear.isa).toBe(20_000)
   ```

   with:

   ```ts
   const h = householdYearly(firstYear)
   expect(h.pension + h.pensionCrystallised).toBe(80_000)
   expect(h.isa).toBe(20_000)
   ```

   This is mechanical and the test diffs are tiny.

2. **Alternative (no test churn):** export `householdYearlySeries` and
   call `calculateProjection` from a thin wrapper in tests
   (`runProjection(...)` returns `{ yearlyData, household, runsOutAt
   }`). Then existing tests use `household[0]` instead of
   `result.yearlyData[0]`. Slightly more typing change but no per-line
   refactor.

Both keep the existing assertions verbatim. There is no functional
change in numbers — `householdYearly` is exactly what
`combineAssets` + the flat field assignments did before.

New, small tests to add (cheap insurance):

- `lib/yearlyView.test.ts`:
  - `householdYearly` sums `pools[0]` (primary) and `pools[1]` (spouse)
    for every asset type.
  - For a primary-only scenario, `pools[1]` contributes 0.
  - `assets === sum of the seven asset fields`.
  - `assetWithdrawals === sum of `pools[i].withdrawals` over all asset
    types and both pools`.
  - `otherIncome === pools[0].income.otherIncome + pools[1].income.otherIncome`.

These guard the invariant that today is buried inside the simulation
loop.

## 9. File-by-file impact

| File | Change |
| --- | --- |
| `lib/types.ts` | Replace flat `YearlyDatapoint` fields with `pools: [PoolYear, PoolYear]` (numeric-indexed tuple, non-optional). Drop `withdrawalsByPool`. `PoolYear` carries only `initialPosition` (post-growth, pre-drawdown) — no `endPosition`, since it equals `initialPosition - withdrawals`. Rename `retirementIncome` → `otherIncome` on `PoolYear.income` (and on `HouseholdYearly`). Keep `expenditure`, `shortfall`. |
| `lib/yearlyView.ts` (new) | `ASSET_TYPES_IN_ORDER`, `ASSET_LABELS`, `emptyAssetPool`, `sumPool`, `addPools`, `HouseholdYearly`, `householdYearly`, `householdYearlySeries`. |
| `lib/calculations.ts` | Drop `combineAssets`, `combinedAssets`, the four parallel withdrawal arrays. Bundle `balances`+`baseCosts` per pool but keep `state` as a length-2 tuple indexed by `AssetPoolType`. Rename `buildRetirementIncome` → `buildOtherIncome` (and its result field). Extract per-year steps into named helpers. Build `YearlyDatapoint` once at the end of the loop with `{ pools, expenditure, shortfall }`. |
| `lib/annual/*.ts` | Optionally accept the new `state` shape directly; mechanical change. |
| `lib/yearlyExport.ts` | Read `yd.pools[i]` (non-optional, numeric index) directly. Tag rows with `poolIndex: AssetPoolType`. Use selectors from `yearlyView.ts`. Move types to `yearlyExport.types.ts`. |
| `lib/yearlyExcelExport.ts` | Import `ASSET_LABELS` from `yearlyView.ts`. Tiny `currency(...)` factory. |
| `components/RetirementProjection.tsx` | Use `householdYearlySeries` for chart data. Drop local `assetDisplayOrder` / `assetLabels`. Use `ASSET_TYPES_IN_ORDER` / `ASSET_LABELS` from `yearlyView.ts`. Remove `as any` in tooltip. |
| `tests/calculations.test.ts` | Wrap assertions on flat fields with `householdYearly(...)` (or use `result.household[i]` if going with the wrapper). |
| `tests/bedAndISA.test.ts` | Same wrap; this file has the most flat-field assertions. |
| `tests/drawdown.test.ts` | Mostly unaffected — only one or two assertions read flat fields. |
| `tests/yearlyView.test.ts` (new) | Invariants of `householdYearly`. |

## 10. Migration order (low-risk, mergeable in slices)

Each step compiles and all tests pass before moving on.

1. **Introduce `lib/yearlyView.ts`** with `ASSET_TYPES_IN_ORDER`,
   `ASSET_LABELS`, `emptyAssetPool`, `sumPool`, and `householdYearly`
   that simply *reads* today's flat fields. No other file changes; new
   unit tests added.
2. **Switch `RetirementProjection.tsx`** to import labels/order from
   `yearlyView.ts` and use `householdYearlySeries` for the charts.
   Visual no-op.
3. **Switch `yearlyExport.ts`** to import labels/order from
   `yearlyView.ts`. Delete its local helpers. Visual no-op.
4. **Add `pools: [PoolYear, PoolYear]` to `YearlyDatapoint`** in
   parallel with the existing `byPool` (rename `byPool` → `pools`,
   reshape it to a length-2 tuple indexed by `AssetPoolType`, and make
   it non-optional in the same step; `withdrawalsByPool` is removed
   because nothing reads it after step 3). Rename
   `retirementIncome` → `otherIncome` on `PoolYear.income` and on
   `HouseholdYearly` as part of this step (single rename across
   `types.ts`, `calculations.ts`, `yearlyView.ts`,
   `yearlyExport.ts`/`yearlyExcelExport.ts`, `RetirementProjection.tsx`,
   and tests).
5. **Refactor `calculateProjection`'s loop** into named per-year steps
   and build `YearlyDatapoint` from `pools` only.
6. **Flip `householdYearly`** to read from `pools` instead of the flat
   fields, then **delete the flat fields** from `YearlyDatapoint`.
7. **Update tests** to use `householdYearly(...)`.
8. **Optional**: tighten `lib/annual/*.ts` signatures to accept the
   bundled `PoolState` (`{ balances, baseCosts }`) instead of separate
   `AssetPool[]` and `BaseCostPool[]` arrays. The array-tuple shape
   itself is kept — call sites still index by `AssetPoolType`.

Each step is independently revertable, and steps 1–3 are pure code
moves with no behaviour change.

## 11. Things explicitly out of scope

- The drawdown strategies in `lib/strategies/*.ts` — their interface
  (`execute(pools: AssetPool[], shortfall, taxPosition)`) is fine and
  is left alone. If step 8 above is taken, they get an object instead
  of an array, but the maths is unchanged.
- Tax / CGT calculation in `lib/tax.ts`. The refactor only changes
  *how* the simulator routes withdrawals into those functions, not
  what those functions do.
- The shape of `RetirementData` (input). Nothing in the input model
  needs to change.
