import { BaseDrawdownStrategy } from "@/lib/strategies/base"
import { AssetBalances, AssetDrawdownResult } from "@/lib/types"
import { AssetType } from "@/types"
import { isTaxable } from "@/lib/utils"

/**
 * Lowest growth first strategy - draws from lowest growth assets first.
 */
export class LowestGrowthFirstStrategy extends BaseDrawdownStrategy {
    public withdrawFromAssets(assets: AssetBalances, amount: number): AssetDrawdownResult {
        if (amount <= 0) {
            return { remaining: 0, taxableWithdrawn: 0 }
        }

        const assetTypes = Object.values(AssetType)

        // Sort asset types by growth rate (ascending)
        const sortedTypes = assetTypes
            .filter(type => assets[type] > 0)
            .sort((a, b) => (this.growthRates[a] || 0) - (this.growthRates[b] || 0))

        let remaining = amount
        let taxableWithdrawn = 0

        for (const type of sortedTypes) {
            if (remaining <= 0) {
                break
            }
            const available = Math.max(0, assets[type])
            const withdrawal = Math.min(remaining, available)
            assets[type] -= withdrawal
            remaining -= withdrawal
            if (isTaxable(type)) {
                taxableWithdrawn += withdrawal
            }
        }

        return {
            remaining: Math.max(0, remaining),
            taxableWithdrawn
        }
    }
}
