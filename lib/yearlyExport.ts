import { AssetType, PoolYearBreakdown, ProjectionResult, RetirementData, YearlyDatapoint } from "@/lib/types"

export type PoolKey = "primary" | "spouse"

export interface YearlyExportRow {
    year: number
    age: number
    pool: PoolKey
    personLabel: string
    initial: Record<AssetType, number>
    initialTotal: number
    statePension: number
    retirementIncome: number
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

export const ASSET_DISPLAY_ORDER: AssetType[] = [
    AssetType.Cash,
    AssetType.ISA,
    AssetType.StocksAndShares,
    AssetType.Bonds,
    AssetType.PensionCrystallised,
    AssetType.Pension,
    AssetType.Property
]

export const ASSET_LABELS: Record<AssetType, string> = {
    [AssetType.Cash]: "Cash",
    [AssetType.ISA]: "ISAs",
    [AssetType.StocksAndShares]: "Stocks",
    [AssetType.Bonds]: "Bonds",
    [AssetType.PensionCrystallised]: "Pension (crystallised)",
    [AssetType.Pension]: "Pension",
    [AssetType.Property]: "Property"
}

function emptyAssetMap(): Record<AssetType, number> {
    return Object.fromEntries(Object.values(AssetType).map(t => [t, 0])) as Record<AssetType, number>
}

function sumAssetMap(m: Record<AssetType, number>): number {
    return Object.values(m).reduce((s, v) => s + (v || 0), 0)
}

function poolBreakdown(yd: YearlyDatapoint, pool: PoolKey): PoolYearBreakdown {
    const bp = yd.byPool?.[pool]
    if (bp) return bp
    return {
        initialPosition: emptyAssetMap(),
        income: { statePension: 0, retirementIncome: 0 },
        withdrawals: emptyAssetMap()
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
        for (const pool of ["primary", "spouse"] as PoolKey[]) {
            const bp = poolBreakdown(yd, pool)
            const initialTotal = sumAssetMap(bp.initialPosition)
            const withdrawalsTotal = sumAssetMap(bp.withdrawals)
            const incomeTotal = (bp.income.statePension || 0) + (bp.income.retirementIncome || 0)
            // Skip spouse rows entirely if the user has no partner configured and there's nothing to show.
            if (pool === "spouse" && !hasSpouse && initialTotal === 0 && withdrawalsTotal === 0 && incomeTotal === 0) {
                continue
            }
            const isPrimary = pool === "primary"
            const expenditure = isPrimary ? yd.expenditure || 0 : 0
            const tax = isPrimary ? yd.taxPayable || 0 : 0
            const cgt = isPrimary ? yd.cgtPayable || 0 : 0
            const expenditureTotal = expenditure + tax + cgt
            // Net income vs expenditure uses the household-level income total on the primary row
            // and 0 on the spouse row to avoid double-counting.
            const householdIncomeTotal = isPrimary
                ? (yd.byPool?.primary
                      ? (yd.byPool.primary.income.statePension || 0) + (yd.byPool.primary.income.retirementIncome || 0)
                      : 0) +
                  (yd.byPool?.spouse
                      ? (yd.byPool.spouse.income.statePension || 0) + (yd.byPool.spouse.income.retirementIncome || 0)
                      : 0)
                : 0
            const netIncomeExpenditure = isPrimary ? householdIncomeTotal - expenditureTotal : 0
            rows.push({
                year: yd.year,
                age: pool === "primary" ? yd.age : yd.age, // age column reflects the row's person
                pool,
                personLabel: pool === "primary" ? "Me" : "Partner",
                initial: bp.initialPosition,
                initialTotal,
                statePension: bp.income.statePension || 0,
                retirementIncome: bp.income.retirementIncome || 0,
                incomeTotal,
                expenditure,
                tax,
                cgt,
                expenditureTotal,
                netIncomeExpenditure,
                withdrawals: bp.withdrawals,
                withdrawalsTotal
            })
        }
    }

    // Determine which asset types ever carry a non-zero value in initial position or withdrawals.
    const visibleAssetTypes = ASSET_DISPLAY_ORDER.filter(type =>
        rows.some(r => (r.initial[type] || 0) !== 0 || (r.withdrawals[type] || 0) !== 0)
    )

    return { rows, visibleAssetTypes, hasSpouse }
}
