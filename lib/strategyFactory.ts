import { AssetPool, DrawdownStrategyType, TaxSettings } from "@/lib/types"
import { BaseDrawdownStrategy } from "@/lib/strategies/base"
import { BalancedStrategy } from "@/lib/strategies/strategyBalanced"
import { LowestGrowthFirstStrategy } from "@/lib/strategies/strategyLowestGrowthFirst"
import { TaxOptimizedStrategy } from "@/lib/strategies/strategyTaxOptimized"

/**
 * Factory function to create the appropriate strategy instance.
 */
export function createDrawdownStrategy(
    strategyType: DrawdownStrategyType,
    taxSettings: TaxSettings,
    growthRates: AssetPool
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
