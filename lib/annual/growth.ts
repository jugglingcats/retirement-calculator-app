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
export function applyGrowth(
    assetPools: AssetPool[],
    assumptions: Assumptions,
    age: number,
    retirementAge: number
): void {
    const categoryGrowthRates = assumptions.categoryGrowthRates

    // Pre-calc category rates as decimals
    const stockRate = growthRateFor(categoryGrowthRates, AssetType.StocksAndShares)
    const bondRate = growthRateFor(categoryGrowthRates, AssetType.Bonds)

    // Determine ISA blended equity weight if glide path is configured and enabled
    const ibEnabled = assumptions.investmentBalanceEnabled ?? true
    const ib = assumptions.investmentBalance
    const isaEquityWeight =
        ib && ibEnabled
            ? equityPercentageForYear(
                  age,
                  retirementAge,
                  ib.initialEquityPercentage,
                  ib.targetEquityPercentage,
                  ib.yearsToTarget
              ) / 100
            : null

    for (const assets of assetPools) {
        for (const type of Object.values(AssetType)) {
            let growthRate: number
            if (type === AssetType.ISA && isaEquityWeight !== null) {
                // Blend ISA growth: equity portion grows at stocks rate, remainder at bonds rate
                growthRate = isaEquityWeight * stockRate + (1 - isaEquityWeight) * bondRate
            } else {
                growthRate = growthRateFor(categoryGrowthRates, type)
            }
            assets[type] *= 1 + growthRate
        }
    }
}
