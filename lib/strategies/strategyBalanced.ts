import { BaseDrawdownStrategy } from "@/lib/strategies/base"
import { AssetBalances, AssetDrawdownResult } from "@/lib/types"
import { AssetType } from "@/types"
import { isTaxable } from "@/lib/utils"

/**
 * Balanced strategy - draws proportionally from all asset types.
 */
export class BalancedStrategy extends BaseDrawdownStrategy {
    public withdrawFromAssets(assets: AssetBalances, amount: number): AssetDrawdownResult {
        if (amount <= 0) {
            return {
                remaining: 0,
                taxableWithdrawn: 0
            }
        }

        const assetTypes = Object.values(AssetType)
        const totalAssets = assetTypes.reduce((sum, type) => sum + Math.max(0, assets[type]), 0)

        if (totalAssets <= 0) {
            return {
                remaining: amount,
                taxableWithdrawn: 0
            }
        }

        let remaining = amount
        let taxableWithdrawn = 0

        // Calculate proportional withdrawals
        const withdrawals: Record<AssetType, number> = {
            [AssetType.Cash]: 0,
            [AssetType.Pension]: 0,
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
            for (const type of assetTypes) {
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
        }

        return {
            remaining: Math.max(0, remaining),
            taxableWithdrawn
        }
    }
}
