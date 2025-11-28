import { AssetType } from "@/types"
import { AssetBalances, DrawdownStrategyType, PersonIncomeData, SplitShortfallResult, TaxSettings } from "@/lib/types"
import { BaseDrawdownStrategy } from "@/lib/strategies/base"
import { BalancedStrategy } from "@/lib/strategies/strategyBalanced"
import { LowestGrowthFirstStrategy } from "@/lib/strategies/strategyLowestGrowthFirst"
import { TaxOptimizedStrategy } from "@/lib/strategies/strategyTaxOptimized"

/**
 * Factory function to create the appropriate strategy instance.
 */
function createDrawdownStrategy(
    strategyType: DrawdownStrategyType,
    taxSettings: TaxSettings,
    growthRates: Record<AssetType, number>
): BaseDrawdownStrategy {
    switch (strategyType) {
        case "balanced":
            return new BalancedStrategy(taxSettings, growthRates)
        case "lowest_growth_first":
            return new LowestGrowthFirstStrategy(taxSettings, growthRates)
        case "tax_optimized":
            return new TaxOptimizedStrategy(taxSettings, growthRates)
        default:
            throw new Error(`Unknown strategy type: ${strategyType}`)
    }
}

/**
 * Convenience function that creates and executes a strategy in one call.
 */
export function executeDrawdownStrategy(
    strategyType: DrawdownStrategyType,
    taxSettings: TaxSettings,
    growthRates: Record<AssetType, number>,
    primaryAssets: AssetBalances,
    spouseAssets: AssetBalances,
    shortfall: number,
    primaryIncome: PersonIncomeData,
    spouseIncome: PersonIncomeData
): SplitShortfallResult {
    const strategy = createDrawdownStrategy(strategyType, taxSettings, growthRates)
    return strategy.execute(primaryAssets, spouseAssets, shortfall, primaryIncome, spouseIncome)
}
