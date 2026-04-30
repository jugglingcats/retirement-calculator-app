import { AssetPool, AssetType, MarketShock } from "@/lib/types"
import { getGrowthCategory } from "@/lib/utils"

export function applyMarketShocks(assetPools: AssetPool[], shocks: MarketShock[]): void {
    if (!shocks || shocks.length === 0) {
        return
    }
    for (const assets of assetPools) {
        for (const shock of shocks) {
            for (const type of Object.values(AssetType)) {
                if (getGrowthCategory(type) === "stocks") {
                    assets[type] *= (100 + shock.impactPercent) / 100
                }
            }
        }
    }
}
