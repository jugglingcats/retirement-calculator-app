import { AssetType, DrawdownStrategy, RetirementData } from "@/types"
import { calculateIncomeTax, growthRateFor } from "@/lib/utils"
import { executeDrawdownStrategy } from "@/lib/strategies"
import { AssetBalances, DrawdownStrategyType, SplitShortfallResult } from "@/lib/types"

// Re-export for backwards compatibility
export { calculateIncomeTax }
export type { SplitShortfallResult }

/**
 * Returns an object with tax payable and total withdrawn from assets for both primary and spouse.
 * Uses strategy pattern for clean separation of drawdown logic.
 */
export function run_shortfall_calculation_split(
    data: RetirementData,
    primaryAssets: AssetBalances,
    spouseAssets: AssetBalances,
    shortfall: number,
    primaryStatePension: number,
    spouseStatePension: number,
    primaryRetirementIncome: number,
    spouseRetirementIncome: number,
    strategy: DrawdownStrategy
): SplitShortfallResult {
    const growthRates = Object.fromEntries(
        Object.values(AssetType).map(type => [type, growthRateFor(data.assumptions.categoryGrowthRates, type)])
    ) as Record<AssetType, number>

    const taxSettings = {
        personalAllowance: data.incomeTax.personalAllowance,
        higherRateThreshold: data.incomeTax.higherRateThreshold
    }

    const primaryIncome = {
        statePension: primaryStatePension,
        retirementIncome: primaryRetirementIncome
    }

    const spouseIncome = {
        statePension: spouseStatePension,
        retirementIncome: spouseRetirementIncome
    }

    return executeDrawdownStrategy(
        strategy as DrawdownStrategyType,
        taxSettings,
        growthRates,
        primaryAssets,
        spouseAssets,
        shortfall,
        primaryIncome,
        spouseIncome
    )
}
