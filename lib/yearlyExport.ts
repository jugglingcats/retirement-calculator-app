import { AssetPoolType, AssetType, AuditEntry, ProjectionResult, RetirementData, YearlyDatapoint } from "@/lib/types"
import { ASSET_LABELS, ASSET_TYPES_IN_ORDER } from "@/lib/yearlyView"

// Re-export the shared display helpers so callers that already import from this
// file keep working. New code should import them directly from `lib/yearlyView`.
export { ASSET_LABELS, ASSET_TYPES_IN_ORDER }
/** @deprecated Import `ASSET_TYPES_IN_ORDER` from `@/lib/yearlyView` instead. */
export const ASSET_DISPLAY_ORDER = ASSET_TYPES_IN_ORDER

export type BreakdownGroup = "assets" | "income" | "withdrawals" | "expenses"

export interface BreakdownYearColumn {
    year: number
    /** Primary person's age in this year. */
    age: number
    /** Partner's age in this year, if a partner is configured. */
    spouseAge?: number
    /** Per-year drawdown strategy audit log, if any. */
    audit?: AuditEntry[]
}

export interface BreakdownRow {
    group: BreakdownGroup
    /** Row label, e.g. "State Pension", "Cash", "Income Tax". */
    label: string
    /** Person the row belongs to, when applicable. Omitted for household-level rows and totals. */
    person?: "me" | "partner"
    /** Marks a per-group subtotal row. */
    isGroupTotal?: boolean
    /** One value per column in {@link YearlyBreakdown.years}. */
    values: number[]
}

export interface YearlyBreakdown {
    years: BreakdownYearColumn[]
    rows: BreakdownRow[]
    /** Whether the partner pool is shown. */
    hasSpouse: boolean
    /** Asset types non-zero in any initial position — drives the per-asset Assets rows. */
    visibleInitialAssetTypes: AssetType[]
    /** Asset types that are non-zero in withdrawals somewhere — drives the per-asset Withdrawals rows. */
    visibleAssetTypes: AssetType[]
}

const PERSON_LABEL: Record<NonNullable<BreakdownRow["person"]>, string> = {
    me: "Me",
    partner: "Partner"
}

export function personLabel(p: NonNullable<BreakdownRow["person"]>): string {
    return PERSON_LABEL[p]
}

export const GROUP_LABELS: Record<BreakdownGroup, string> = {
    assets: "Starting Assets",
    income: "Income",
    withdrawals: "Withdrawals",
    expenses: "Expenses"
}

function poolFor(yd: YearlyDatapoint, pool: AssetPoolType) {
    return yd.pools[pool]
}

function hasAnySpouseActivity(years: YearlyDatapoint[]): boolean {
    return years.some(yd => {
        const s = yd.pools[AssetPoolType.SPOUSE]
        if (s.income.statePension || s.income.otherIncome) return true
        if (s.tax || s.cgtPayable) return true
        for (const t of ASSET_TYPES_IN_ORDER) {
            if ((s.initialPosition[t] || 0) !== 0) return true
            if ((s.withdrawals[t] || 0) !== 0) return true
        }
        return false
    })
}

/**
 * Build a transposed yearly breakdown: one column per year, rows grouped into
 * Income / Withdrawals / Expenses, with a totals row per group. Each asset class
 * contributes two rows (Me / Partner) within the Withdrawals group when a partner
 * is configured; income and tax/CGT are likewise split per person. Spending is
 * a single household row.
 */
export function buildYearlyBreakdown(data: RetirementData, projection: ProjectionResult): YearlyBreakdown {
    const yds = projection.yearlyData

    const includePartner = data.personal.includePartner ?? Boolean(data.personal.spouseDateOfBirth)
    const hasSpouse = includePartner && hasAnySpouseActivity(yds)

    const spouseBirthYear = data.personal.spouseDateOfBirth
        ? new Date(data.personal.spouseDateOfBirth).getFullYear()
        : null
    const years: BreakdownYearColumn[] = yds.map(yd => ({
        year: yd.year,
        age: yd.age,
        spouseAge: hasSpouse && spouseBirthYear !== null ? yd.year - spouseBirthYear : undefined,
        audit: yd.audit
    }))

    // Determine which asset types appear in initial positions vs withdrawals.
    const visibleInitialAssetTypes = ASSET_TYPES_IN_ORDER.filter(type =>
        yds.some(
            yd =>
                (yd.pools[AssetPoolType.PRIMARY].initialPosition[type] || 0) !== 0 ||
                (yd.pools[AssetPoolType.SPOUSE].initialPosition[type] || 0) !== 0
        )
    )
    const visibleAssetTypes = ASSET_TYPES_IN_ORDER.filter(type =>
        yds.some(
            yd =>
                (yd.pools[AssetPoolType.PRIMARY].withdrawals[type] || 0) !== 0 ||
                (yd.pools[AssetPoolType.SPOUSE].withdrawals[type] || 0) !== 0
        )
    )

    const rows: BreakdownRow[] = []
    const persons: Array<{ key: "me" | "partner"; pool: AssetPoolType }> = hasSpouse
        ? [
              { key: "me", pool: AssetPoolType.PRIMARY },
              { key: "partner", pool: AssetPoolType.SPOUSE }
          ]
        : [{ key: "me", pool: AssetPoolType.PRIMARY }]

    // ---- Assets (initial position at start of year) ----
    for (const type of visibleInitialAssetTypes) {
        for (const { key, pool } of persons) {
            rows.push({
                group: "assets",
                label: ASSET_LABELS[type],
                person: key,
                values: yds.map(yd => poolFor(yd, pool).initialPosition[type] || 0)
            })
        }
    }
    rows.push({
        group: "assets",
        label: "Assets Total",
        isGroupTotal: true,
        values: yds.map(yd => {
            let total = 0
            for (const type of visibleInitialAssetTypes) {
                for (const { pool } of persons) {
                    total += poolFor(yd, pool).initialPosition[type] || 0
                }
            }
            return total
        })
    })

    // ---- Debt (start-of-year balance, shown as a negative line under STARTING ASSETS) ----
    const hasAnyDebt = yds.some(yd => (yd.debt?.startBalance || 0) > 0 || (yd.debt?.repayments || 0) > 0)
    if (hasAnyDebt) {
        rows.push({
            group: "assets",
            label: "Debt",
            values: yds.map(yd => -(yd.debt?.startBalance || 0))
        })
    }

    // ---- Income ----
    for (const { key, pool } of persons) {
        rows.push({
            group: "income",
            label: "State Pension",
            person: key,
            values: yds.map(yd => poolFor(yd, pool).income.statePension || 0)
        })
    }
    for (const { key, pool } of persons) {
        rows.push({
            group: "income",
            label: "Other Income",
            person: key,
            values: yds.map(yd => poolFor(yd, pool).income.otherIncome || 0)
        })
    }
    rows.push({
        group: "income",
        label: "Income Total",
        isGroupTotal: true,
        values: yds.map(yd => {
            let total = 0
            for (const { pool } of persons) {
                const p = poolFor(yd, pool)
                total += (p.income.statePension || 0) + (p.income.otherIncome || 0)
            }
            return total
        })
    })

    // ---- Withdrawals ----
    for (const type of visibleAssetTypes) {
        for (const { key, pool } of persons) {
            rows.push({
                group: "withdrawals",
                label: ASSET_LABELS[type],
                person: key,
                values: yds.map(yd => poolFor(yd, pool).withdrawals[type] || 0)
            })
        }
    }
    rows.push({
        group: "withdrawals",
        label: "Withdrawals Total",
        isGroupTotal: true,
        values: yds.map(yd => {
            let total = 0
            for (const type of visibleAssetTypes) {
                for (const { pool } of persons) {
                    total += poolFor(yd, pool).withdrawals[type] || 0
                }
            }
            return total
        })
    })

    // ---- Expenses ----
    rows.push({
        group: "expenses",
        label: "Spending",
        values: yds.map(yd => yd.expenditure || 0)
    })
    if (hasAnyDebt) {
        rows.push({
            group: "expenses",
            label: "Debt Repayments",
            values: yds.map(yd => yd.debt?.repayments || 0)
        })
    }
    for (const { key, pool } of persons) {
        rows.push({
            group: "expenses",
            label: "Income Tax",
            person: key,
            values: yds.map(yd => poolFor(yd, pool).tax || 0)
        })
    }
    for (const { key, pool } of persons) {
        rows.push({
            group: "expenses",
            label: "CGT",
            person: key,
            values: yds.map(yd => poolFor(yd, pool).cgtPayable || 0)
        })
    }
    rows.push({
        group: "expenses",
        label: "Expenses Total",
        isGroupTotal: true,
        values: yds.map(yd => {
            let total = yd.expenditure || 0
            total += yd.debt?.repayments || 0
            for (const { pool } of persons) {
                const p = poolFor(yd, pool)
                total += (p.tax || 0) + (p.cgtPayable || 0)
            }
            return total
        })
    })

    return { years, rows, hasSpouse, visibleInitialAssetTypes, visibleAssetTypes }
}
