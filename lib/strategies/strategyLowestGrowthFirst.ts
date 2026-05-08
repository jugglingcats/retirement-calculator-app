import { BaseDrawdownStrategy } from "@/lib/strategies/base"
import { AssetPool, AssetDrawdownResult, AssetType, AuditEntry } from "@/lib/types"
import { isTaxable } from "@/lib/utils"
import { ASSET_LABELS } from "@/lib/yearlyView"

const fmt = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`

/**
 * Lowest growth first strategy - draws from lowest growth assets first.
 */
export class LowestGrowthFirstStrategy extends BaseDrawdownStrategy {
    public readonly name = "LowestGrowthFirst"

    public withdrawFromAssets(assets: AssetPool, amount: number, _tax?: unknown, audit?: AuditEntry[]): AssetDrawdownResult {
        if (amount <= 0) {
            return { remaining: 0, taxableWithdrawn: 0 }
        }

        const assetTypes = Object.values(AssetType)

        // Sort asset types by growth rate (ascending)
        const sortedTypes = assetTypes
            .filter(type => assets[type] > 0)
            .sort((a, b) => (this.growthRates[a] || 0) - (this.growthRates[b] || 0))

        if (sortedTypes.length === 0) {
            audit?.push({
                stage: "withdrawal",
                message: `LowestGrowthFirst: pool is empty, cannot withdraw ${fmt(amount)}.`
            })
            return { remaining: amount, taxableWithdrawn: 0 }
        }

        audit?.push({
            stage: "withdrawal",
            message:
                `LowestGrowthFirst: drawing ${fmt(amount)}; sorted assets by growth (asc) — ` +
                sortedTypes
                    .map(t => `${ASSET_LABELS[t]} ${(this.growthRates[t] * 100).toFixed(1)}% (bal ${fmt(assets[t])})`)
                    .join(", ") + "."
        })

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
            audit?.push({
                stage: "withdrawal",
                message:
                    `LowestGrowthFirst: took ${fmt(withdrawal)} from ${ASSET_LABELS[type]} ` +
                    `(${(this.growthRates[type] * 100).toFixed(1)}% growth)${isTaxable(type) ? " — taxable" : ""}.`
            })
        }

        return {
            remaining: Math.max(0, remaining),
            taxableWithdrawn
        }
    }
}