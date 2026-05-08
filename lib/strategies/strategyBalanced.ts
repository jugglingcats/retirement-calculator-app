import { BaseDrawdownStrategy } from "@/lib/strategies/base"
import { AssetPool, AssetDrawdownResult, AssetType, AuditEntry } from "@/lib/types"
import { isTaxable } from "@/lib/utils"
import { ASSET_LABELS } from "@/lib/yearlyView"

const fmt = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`

/**
 * Balanced strategy - draws proportionally from all asset types.
 */
export class BalancedStrategy extends BaseDrawdownStrategy {
    public readonly name = "Balanced"

    public withdrawFromAssets(assets: AssetPool, amount: number, _tax?: unknown, audit?: AuditEntry[]): AssetDrawdownResult {
        if (amount <= 0) {
            return {
                remaining: 0,
                taxableWithdrawn: 0
            }
        }

        const assetTypes = Object.values(AssetType)
        const totalAssets = assetTypes.reduce((sum, type) => sum + Math.max(0, assets[type]), 0)

        if (totalAssets <= 0) {
            audit?.push({
                stage: "withdrawal",
                message: `Balanced: pool is empty, cannot withdraw ${fmt(amount)}.`
            })
            return {
                remaining: amount,
                taxableWithdrawn: 0
            }
        }

        let remaining = amount
        let taxableWithdrawn = 0

        // Calculate proportional withdrawals
        const withdrawals: AssetPool = {
            [AssetType.Cash]: 0,
            [AssetType.Pension]: 0,
            [AssetType.PensionCrystallised]: 0,
            [AssetType.StocksAndShares]: 0,
            [AssetType.ISA]: 0,
            [AssetType.Bonds]: 0,
            [AssetType.Property]: 0
        }

        for (const type of assetTypes) {
            const balance = Math.max(0, assets[type])
            if (balance > 0) {
                const proportion = balance / totalAssets
                const targetWithdrawal = amount * proportion
                withdrawals[type] = Math.min(targetWithdrawal, balance)
            }
        }

        audit?.push({
            stage: "withdrawal",
            message:
                `Balanced: splitting ${fmt(amount)} proportionally across pool of ${fmt(totalAssets)} → ` +
                assetTypes
                    .filter(t => withdrawals[t] > 0)
                    .map(t => `${ASSET_LABELS[t]} ${fmt(withdrawals[t])} (${((withdrawals[t] / amount) * 100).toFixed(0)}%)`)
                    .join(", ") + "."
        })

        // Apply withdrawals
        for (const type of assetTypes) {
            const withdrawal = withdrawals[type]
            assets[type] -= withdrawal
            remaining -= withdrawal
            if (isTaxable(type)) {
                taxableWithdrawn += withdrawals[type]
            }
        }

        // If there's still remaining (due to rounding or insufficient proportional funds),
        // take from whatever is available
        if (remaining > 0.01) {
            audit?.push({
                stage: "withdrawal",
                message: `Balanced: top-up sweep needed for ${fmt(remaining)} (rounding / insufficient proportional funds).`
            })
            for (const type of assetTypes) {
                if (remaining <= 0) {
                    break
                }
                const available = Math.max(0, assets[type])
                if (available <= 0) continue
                const withdrawal = Math.min(remaining, available)
                assets[type] -= withdrawal
                remaining -= withdrawal
                if (isTaxable(type)) {
                    taxableWithdrawn += withdrawal
                }
                audit?.push({
                    stage: "withdrawal",
                    message: `Balanced: top-up took ${fmt(withdrawal)} from ${ASSET_LABELS[type]}.`
                })
            }
        }

        return {
            remaining: Math.max(0, remaining),
            taxableWithdrawn
        }
    }
}