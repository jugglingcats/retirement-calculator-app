import { AssetPool, AssetPoolType, AssetType, PoolYear, YearlyDatapoint } from "@/lib/types"
import { createEmptyAssetPool } from "@/lib/utils"

/**
 * Display order of asset types in the breakdown table, Excel export and chart legend.
 * Single source of truth — do not duplicate this list elsewhere.
 */
export const ASSET_TYPES_IN_ORDER: AssetType[] = [
    AssetType.Cash,
    AssetType.ISA,
    AssetType.StocksAndShares,
    AssetType.Bonds,
    AssetType.PensionCrystallised,
    AssetType.Pension,
    AssetType.Property
]

/** Human-readable labels for asset types. Single source of truth. */
export const ASSET_LABELS: Record<AssetType, string> = {
    [AssetType.Cash]: "Cash",
    [AssetType.ISA]: "ISAs",
    [AssetType.StocksAndShares]: "Stocks",
    [AssetType.Bonds]: "Bonds",
    [AssetType.PensionCrystallised]: "Pension (crystallised)",
    [AssetType.Pension]: "Pension",
    [AssetType.Property]: "Property"
}

export function sumPool(p: AssetPool): number {
    return Object.values(AssetType).reduce((s, t) => s + (p[t] || 0), 0)
}

export function addPools(a: AssetPool, b: AssetPool): AssetPool {
    const out = createEmptyAssetPool()
    for (const t of Object.values(AssetType)) out[t] = (a[t] || 0) + (b[t] || 0)
    return out
}

/** An empty `PoolYear`, used as the spouse pool when no spouse is configured. */
export function emptyPoolYear(): PoolYear {
    return {
        initialPosition: createEmptyAssetPool(),
        income: { statePension: 0, otherIncome: 0 },
        withdrawals: createEmptyAssetPool(),
        tax: 0,
        cgtPayable: 0
    }
}

/**
 * End-of-year balances for one pool, derived from `initialPosition - withdrawals`.
 * `withdrawals.cash` already accounts for cash spent on income tax and CGT, so this
 * is a faithful end-of-year snapshot per asset type.
 */
export function endPosition(p: PoolYear): AssetPool {
    const out = createEmptyAssetPool()
    for (const t of Object.values(AssetType)) {
        out[t] = (p.initialPosition[t] || 0) - (p.withdrawals[t] || 0)
    }
    return out
}

/** "Flat" household snapshot for charts/tooltips/tests. */
export interface HouseholdYearly {
    year: number
    age: number
    // Combined end-of-year balances, clamped at 0:
    cash: number
    stocks: number
    isa: number
    bonds: number
    pension: number
    pensionCrystallised: number
    property: number
    // Total of the seven balance fields above.
    assets: number
    // Combined income:
    statePension: number
    otherIncome: number
    income: number
    // Combined outflows:
    assetWithdrawals: number
    /**
     * Asset withdrawals net of debt repayments. Useful for charts that show debt
     * repayments as a separate stack segment so the bar doesn't double-count
     * (the underlying drawdown already funds debt repayments). Clamped at 0.
     */
    assetWithdrawalsExDebt: number
    taxPayable: number
    cgtPayable: number
    // Carried through from `YearlyDatapoint`:
    expenditure: number
    shortfall: number
    /** Total outstanding debt at start of year (sum across all debts). */
    debtStartBalance: number
    /** Total outstanding debt at end of year. */
    debtEndBalance: number
    /** Debt repayments paid this year (capital + interest). */
    debtRepayments: number
    /** Interest accrued on debts this year. */
    debtInterest: number
}

/**
 * Build a household-level view of one simulated year by summing the per-pool
 * data. End-of-year balances are clamped at 0 to match the chart's expectations.
 */
export function householdYearly(yd: YearlyDatapoint): HouseholdYearly {
    const primary = yd.pools[AssetPoolType.PRIMARY]
    const spouse = yd.pools[AssetPoolType.SPOUSE]

    const ends = [endPosition(primary), endPosition(spouse)] as const
    const balanceOf = (t: AssetType) => Math.max(0, (ends[0][t] || 0) + (ends[1][t] || 0))

    const cash = balanceOf(AssetType.Cash)
    const stocks = balanceOf(AssetType.StocksAndShares)
    const isa = balanceOf(AssetType.ISA)
    const bonds = balanceOf(AssetType.Bonds)
    const pension = balanceOf(AssetType.Pension)
    const pensionCrystallised = balanceOf(AssetType.PensionCrystallised)
    const property = balanceOf(AssetType.Property)
    const assets = cash + stocks + isa + bonds + pension + pensionCrystallised + property

    const statePension = primary.income.statePension + spouse.income.statePension
    const otherIncome = primary.income.otherIncome + spouse.income.otherIncome
    const income = statePension + otherIncome

    const assetWithdrawals = sumPool(primary.withdrawals) + sumPool(spouse.withdrawals)
    const taxPayable = primary.tax + spouse.tax
    const cgtPayable = primary.cgtPayable + spouse.cgtPayable
    const debtRepayments = yd.debt?.repayments || 0
    const assetWithdrawalsExDebt = Math.max(0, assetWithdrawals - debtRepayments)

    return {
        year: yd.year,
        age: yd.age,
        cash,
        stocks,
        isa,
        bonds,
        pension,
        pensionCrystallised,
        property,
        assets,
        statePension,
        otherIncome,
        income,
        assetWithdrawals,
        assetWithdrawalsExDebt,
        taxPayable,
        cgtPayable,
        expenditure: yd.expenditure,
        shortfall: yd.shortfall,
        debtStartBalance: yd.debt?.startBalance || 0,
        debtEndBalance: yd.debt?.endBalance || 0,
        debtRepayments: yd.debt?.repayments || 0,
        debtInterest: yd.debt?.interest || 0
    }
}

export function householdYearlySeries(yds: YearlyDatapoint[]): HouseholdYearly[] {
    return yds.map(householdYearly)
}
