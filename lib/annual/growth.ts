import { AssetPool } from "@/lib/types"
import { AssetType } from "@/types"
import { growthRateFor } from "@/lib/utils"

export function applyGrowth(assetPools: AssetPool[], categoryGrowthRates: Record<string, number>): void {
    for (const assets of assetPools) {
        for (const type of Object.values(AssetType)) {
            const growthRate = growthRateFor(categoryGrowthRates, type)
            assets[type] *= 1 + growthRate
        }
    }
}
