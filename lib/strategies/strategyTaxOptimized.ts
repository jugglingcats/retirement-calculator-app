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
        const taxableAssetOrder: AssetType[] = [AssetType.Cash, AssetType.Pension, AssetType.Property]

        for (const type of taxableAssetOrder) {
            if (remaining <= 0) break

            const maxTaxableWithdrawal = Math.max(0, roomBeforeHigherRate - taxableWithdrawn)
            if (maxTaxableWithdrawal <= 0) break

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
            if (remaining <= 0) break
            const available = Math.max(0, assets[type])
            const withdrawal = Math.min(remaining, available)
            assets[type] -= withdrawal
            remaining -= withdrawal
            taxableWithdrawn += withdrawal
        }

        return { remaining: Math.max(0, remaining), taxableWithdrawn }
    }

    // executeSplit(pools: AssetPool[], shortfall: number, taxableIncome: number[]): SplitShortfallResult {
    //     const taxPosition = taxableIncome.map(this.calcTax)
    //     const initialTaxLiability = sumNumbers(taxPosition.map(t => t.tax))
    //
    //     // Try to split equally between primary and spouse
    //     const halfAmount = shortfall / 2
    //
    //     // First pass: try to withdraw half from each
    //     const primaryResult = this.withdrawFromAssets(primaryAssets, halfAmount, primaryTaxable)
    //     const primaryWithdrawnFirst = halfAmount - primaryResult.remaining
    //
    //     const spouseResult = this.withdrawFromAssets(spouseAssets, halfAmount, spouseTaxable)
    //     const spouseWithdrawnFirst = halfAmount - spouseResult.remaining
    //
    //     let primaryWithdrawn = primaryWithdrawnFirst
    //     let spouseWithdrawn = spouseWithdrawnFirst
    //     let primaryTaxableWithdrawn = primaryResult.taxableWithdrawn
    //     let spouseTaxableWithdrawn = spouseResult.taxableWithdrawn
    //
    //     // Second pass: if one couldn't cover their half, take more from the other
    //     const totalRemaining = primaryResult.remaining + spouseResult.remaining
    //
    //     if (totalRemaining > 0) {
    //         const extraPrimaryResult = this.withdrawFromAssets(
    //             primaryAssets,
    //             totalRemaining,
    //             primaryTaxable + primaryTaxableWithdrawn
    //         )
    //         const extraFromPrimary = totalRemaining - extraPrimaryResult.remaining
    //         primaryWithdrawn += extraFromPrimary
    //         primaryTaxableWithdrawn += extraPrimaryResult.taxableWithdrawn
    //
    //         if (extraPrimaryResult.remaining > 0) {
    //             const extraSpouseResult = this.withdrawFromAssets(
    //                 spouseAssets,
    //                 extraPrimaryResult.remaining,
    //                 spouseTaxable + spouseTaxableWithdrawn
    //             )
    //             const extraFromSpouse = extraPrimaryResult.remaining - extraSpouseResult.remaining
    //             spouseWithdrawn += extraFromSpouse
    //             spouseTaxableWithdrawn += extraSpouseResult.taxableWithdrawn
    //         }
    //     }
    //
    //     const primaryTax = this.calcTax(primaryTaxable + primaryTaxableWithdrawn)
    //     const spouseTax = this.calcTax(spouseTaxable + spouseTaxableWithdrawn)
    //
    //     return {
    //         primaryTax,
    //         spouseTax,
    //         primaryWithdrawn,
    //         spouseWithdrawn
    //     }
    // }
}
