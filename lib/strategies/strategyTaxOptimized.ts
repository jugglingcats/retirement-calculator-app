import { AssetDrawdownResult, AssetPool, TaxPosition } from "@/lib/types"
import { AssetType } from "@/types"
import { BaseDrawdownStrategy } from "@/lib/strategies/base"

/**
 * Tax optimized strategy - prioritizes tax-free withdrawals (ISA) before taxable ones,
 * and uses basic rate band for taxable withdrawals before higher rate.
 */
export class TaxOptimizedStrategy extends BaseDrawdownStrategy {
    public withdrawFromAssets(assets: AssetPool, amount: number, taxPosition: TaxPosition): AssetDrawdownResult {
        if (amount <= 0) {
            return { remaining: 0, taxableWithdrawn: 0 }
        }

        const roomBeforeHigherRate = taxPosition.basicRateRemaining + taxPosition.personalAllowanceRemaining

        let remaining = amount
        let taxableWithdrawn = 0

        // Step 1: Draw from taxable assets up to the room before higher rate threshold
        // Order: Cash → Pension → Property (most to least liquid)
        const taxableAssetOrder: AssetType[] = [
            AssetType.Cash,
            AssetType.Bonds,
            AssetType.StocksAndShares,
            AssetType.Pension,
            AssetType.PensionCrystallised,
            AssetType.Property
        ]

        for (const type of taxableAssetOrder) {
            if (remaining <= 0) {
                break
            }

            const maxTaxableWithdrawal = Math.max(0, roomBeforeHigherRate - taxableWithdrawn)
            if (maxTaxableWithdrawal <= 0) {
                break
            }

            const available = Math.max(0, assets[type])
            const withdrawal = Math.min(remaining, available, maxTaxableWithdrawal)

            assets[type] -= withdrawal
            remaining -= withdrawal
            taxableWithdrawn += withdrawal
        }

        // Step 2: Draw remaining shortfall from ISAs (tax-free)
        if (remaining > 0) {
            const isaAvailable = Math.max(0, assets[AssetType.ISA])
            const isaWithdrawal = Math.min(remaining, isaAvailable)
            assets[AssetType.ISA] -= isaWithdrawal
            remaining -= isaWithdrawal
        }

        // Step 3: If still shortfall, draw from remaining taxable assets beyond threshold
        for (const type of taxableAssetOrder) {
            if (remaining <= 0) {
                break
            }
            const available = Math.max(0, assets[type])
            const withdrawal = Math.min(remaining, available)
            assets[type] -= withdrawal
            remaining -= withdrawal
            taxableWithdrawn += withdrawal
        }

        return { remaining: Math.max(0, remaining), taxableWithdrawn }
    }
}
