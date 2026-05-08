import { AssetPool, AssetType, PoolYear, ProjectionResult, YearlyDatapoint } from "@/lib/types"

/**
 * Returns the multiplicative factor to apply to a nominal monetary value in `year`
 * to express it in the purchasing power of `baseYear`. For years at or before the
 * base year the factor is 1 (we never inflate values forward).
 */
export function deflationFactor(year: number, baseYear: number, inflationRatePercent: number): number {
    const years = year - baseYear
    if (years <= 0) return 1
    return 1 / Math.pow(1 + inflationRatePercent / 100, years)
}

const ASSET_KEYS = Object.values(AssetType) as AssetType[]

function deflatePool(pool: AssetPool, factor: number): AssetPool {
    const out = { ...pool }
    for (const key of ASSET_KEYS) {
        out[key] = (pool[key] || 0) * factor
    }
    return out
}

function deflatePoolYear(p: PoolYear, factor: number): PoolYear {
    return {
        initialPosition: deflatePool(p.initialPosition, factor),
        income: {
            statePension: p.income.statePension * factor,
            otherIncome: p.income.otherIncome * factor
        },
        withdrawals: deflatePool(p.withdrawals, factor),
        tax: p.tax * factor,
        cgtPayable: p.cgtPayable * factor
    }
}

function deflateYear(y: YearlyDatapoint, baseYear: number, inflationRatePercent: number): YearlyDatapoint {
    const factor = deflationFactor(y.year, baseYear, inflationRatePercent)
    return {
        year: y.year,
        age: y.age,
        pools: [deflatePoolYear(y.pools[0], factor), deflatePoolYear(y.pools[1], factor)],
        expenditure: y.expenditure * factor,
        shortfall: y.shortfall * factor,
        audit: y.audit
    }
}

/**
 * Returns a copy of the projection result with every monetary field deflated
 * to today's money. `runsOutAt` (a year) and `currentAssets` (already in
 * today's money) are left unchanged.
 */
export function deflateProjection(
    projection: ProjectionResult,
    inflationRatePercent: number,
    baseYear: number = new Date().getFullYear()
): ProjectionResult {
    return {
        ...projection,
        yearlyData: projection.yearlyData.map(y => deflateYear(y, baseYear, inflationRatePercent))
    }
}
