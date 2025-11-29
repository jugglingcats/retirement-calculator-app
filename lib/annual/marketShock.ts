import { AssetPool, AssetType, MarketShock } from "@/lib/types"
import { getGrowthCategory } from "@/lib/utils"

export function applyMarketShock(assetPools: AssetPool[], shock?: MarketShock): void {
    if (!shock) {
        return
    }
    for (const assets of assetPools) {
        for (const type of Object.values(AssetType)) {
            if (getGrowthCategory(type) === "stocks") {
                assets[type] *= (100 + shock.impactPercent) / 100
            }
        }
    }
}
