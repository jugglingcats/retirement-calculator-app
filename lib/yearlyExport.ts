import { AssetPoolType, AssetType, ProjectionResult, RetirementData, YearlyDatapoint } from "@/lib/types"
import { ASSET_LABELS, ASSET_TYPES_IN_ORDER, householdYearly, sumPool } from "@/lib/yearlyView"

// Re-export the shared display helpers so callers that already import from this
// file keep working. New code should import them directly from `lib/yearlyView`.
export { ASSET_LABELS, ASSET_TYPES_IN_ORDER }
/** @deprecated Import `ASSET_TYPES_IN_ORDER` from `@/lib/yearlyView` instead. */
export const ASSET_DISPLAY_ORDER = ASSET_TYPES_IN_ORDER

export interface YearlyExportRow {
    year: number
    age: number
    /** 0 = primary ("me"), 1 = spouse — matches `AssetPoolType` and `YearlyDatapoint.pools`. */
    poolIndex: AssetPoolType
    personLabel: string
    initial: Record<AssetType, number>
    initialTotal: number
    statePension: number
    otherIncome: number
    incomeTotal: number
    expenditure: number // household value, only filled on primary row
    tax: number // household income tax, only filled on primary row
    cgt: number // household CGT, only filled on primary row
    expenditureTotal: number // expenditure + tax + cgt, only filled on primary row
    netIncomeExpenditure: number // incomeTotal - expenditureTotal (primary row uses household totals)
    withdrawals: Record<AssetType, number>
    withdrawalsTotal: number
}

export interface YearlyExportTable {
    rows: YearlyExportRow[]
    /** Asset types that are non-zero somewhere in either an initial position or a withdrawal column. */
    visibleAssetTypes: AssetType[]
    /** Whether the spouse pool has any data worth showing. */
    hasSpouse: boolean
}

const POOL_INDICES: AssetPoolType[] = [AssetPoolType.PRIMARY, AssetPoolType.SPOUSE]

function buildRow(yd: YearlyDatapoint, poolIndex: AssetPoolType): YearlyExportRow {
    const p = yd.pools[poolIndex]
    const isPrimary = poolIndex === AssetPoolType.PRIMARY

    const initial = p.initialPosition
    const initialTotal = sumPool(initial)
    const withdrawals = p.withdrawals
    const withdrawalsTotal = sumPool(withdrawals)
    const incomeTotal = (p.income.statePension || 0) + (p.income.otherIncome || 0)

    const hh = householdYearly(yd)
    const expenditure = isPrimary ? hh.expenditure : 0
    const tax = isPrimary ? hh.taxPayable : 0
    const cgt = isPrimary ? hh.cgtPayable : 0
    const expenditureTotal = expenditure + tax + cgt
    const netIncomeExpenditure = isPrimary ? hh.income - expenditureTotal : 0

    return {
        year: yd.year,
        age: yd.age,
        poolIndex,
        personLabel: isPrimary ? "Me" : "Partner",
        initial,
        initialTotal,
        statePension: p.income.statePension || 0,
        otherIncome: p.income.otherIncome || 0,
        incomeTotal,
        expenditure,
        tax,
        cgt,
        expenditureTotal,
        netIncomeExpenditure,
        withdrawals,
        withdrawalsTotal
    }
}

/**
 * Build the per-year, per-person table used by both the on-screen table and the Excel export.
 * Each year produces two rows: one for the primary person and one for the partner/spouse.
 */
export function buildYearlyExportTable(data: RetirementData, projection: ProjectionResult): YearlyExportTable {
    const hasSpouse = !!data.personal.spouseDateOfBirth

    const rows: YearlyExportRow[] = []
    for (const yd of projection.yearlyData) {
        for (const poolIndex of POOL_INDICES) {
            const row = buildRow(yd, poolIndex)
            // Skip spouse rows entirely if the user has no partner configured and there's nothing to show.
            if (
                poolIndex === AssetPoolType.SPOUSE &&
                !hasSpouse &&
                row.initialTotal === 0 &&
                row.withdrawalsTotal === 0 &&
                row.incomeTotal === 0
            ) {
                continue
            }
            rows.push(row)
        }
    }

    // Determine which asset types ever carry a non-zero value in initial position or withdrawals.
    const visibleAssetTypes = ASSET_TYPES_IN_ORDER.filter(type =>
        rows.some(r => (r.initial[type] || 0) !== 0 || (r.withdrawals[type] || 0) !== 0)
    )

    return { rows, visibleAssetTypes, hasSpouse }
}
