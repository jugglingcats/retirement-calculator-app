import { AssetPool, AssetType, Assumptions } from "@/lib/types"
import { growthRateFor } from "@/lib/utils"

function clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val))
}

function equityPercentageForYear(
    age: number,
    retirementAge: number,
    initialEquity: number,
    targetEquity: number,
    yearsToTarget: number
): number {
    // Before retirement, keep initial equity
    if (age <= retirementAge) {
        return clamp(initialEquity, 0, 100)
    }
    const yearsAfterRetirement = age - retirementAge
    if (yearsToTarget <= 0) {
        return clamp(targetEquity, 0, 100)
    }
    const t = clamp(yearsAfterRetirement / yearsToTarget, 0, 1)
    const pct = initialEquity + (targetEquity - initialEquity) * t
    return clamp(pct, 0, 100)
}

// Applies annual growth to asset pools. If assumptions.investmentBalance is provided,
// ISA growth is blended between stocks and bonds growth rates according to the glide path.
// `ages` and `retirementAges` are per pool (index 0 = primary, 1 = spouse) so that each
// member of the household can have their own ISA glide path keyed off their own retirement.
export function applyGrowth(
    assetPools: AssetPool[],
    assumptions: Assumptions,
    ages: number[],
    retirementAges: number[]
): void {
    const categoryGrowthRates = assumptions.categoryGrowthRates

    // Pre-calc category rates as decimals
    const stockRate = growthRateFor(categoryGrowthRates, AssetType.StocksAndShares)
    const bondRate = growthRateFor(categoryGrowthRates, AssetType.Bonds)

    const ibEnabled = assumptions.investmentBalanceEnabled ?? true
    const ib = assumptions.investmentBalance

    assetPools.forEach((assets, idx) => {
        const age = ages[idx]
        const retirementAge = retirementAges[idx]
        // Determine ISA blended equity weight if glide path is configured and enabled.
        // When the per-pool age is missing/NaN (e.g. an absent partner), skip the glide
        // path for that pool — the pool is empty anyway.
        const isaEquityWeight =
            ib && ibEnabled && Number.isFinite(age) && Number.isFinite(retirementAge)
                ? equityPercentageForYear(
                      age,
                      retirementAge,
                      ib.initialEquityPercentage,
                      ib.targetEquityPercentage,
                      ib.yearsToTarget
                  ) / 100
                : null

        for (const type of Object.values(AssetType)) {
            let growthRate: number
            if (type === AssetType.ISA && isaEquityWeight !== null) {
                growthRate = isaEquityWeight * stockRate + (1 - isaEquityWeight) * bondRate
            } else {
                growthRate = growthRateFor(categoryGrowthRates, type)
            }
            assets[type] *= 1 + growthRate
        }
    })
}
