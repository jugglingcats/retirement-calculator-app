import { AssetDrawdownResult, AssetPool, AssetType, AuditEntry, TaxPosition } from "@/lib/types"
import { BaseDrawdownStrategy } from "@/lib/strategies/base"
import { ASSET_LABELS } from "@/lib/yearlyView"

const fmt = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`

/**
 * Tax optimized strategy - prioritizes tax-free withdrawals (ISA) before taxable ones,
 * and uses basic rate band for taxable withdrawals before higher rate.
 */
export class TaxOptimizedStrategy extends BaseDrawdownStrategy {
    public readonly name = "TaxOptimized"

    public withdrawFromAssets(
        assets: AssetPool,
        amount: number,
        taxPosition: TaxPosition,
        audit?: AuditEntry[]
    ): AssetDrawdownResult {
        if (amount <= 0) {
            return { remaining: 0, taxableWithdrawn: 0 }
        }

        const roomBeforeHigherRate = taxPosition.basicRateRemaining + taxPosition.personalAllowanceRemaining

        let remaining = amount
        let taxableWithdrawn = 0

        audit?.push({
            stage: "withdrawal",
            message:
                `TaxOptimized: drawing ${fmt(amount)}. Room below higher-rate threshold = ${fmt(roomBeforeHigherRate)} ` +
                `(personal allowance ${fmt(taxPosition.personalAllowanceRemaining)} + basic band ${fmt(taxPosition.basicRateRemaining)}).`
        })

        // Step 1: Draw from taxable assets up to the room before higher rate threshold
        // Order: Cash → Pension → Property (most to least liquid)
        const taxableAssetOrder: AssetType[] = [
            AssetType.Cash,
            AssetType.Bonds,
            AssetType.StocksAndShares,
            AssetType.PensionCrystallised,
            AssetType.Pension,
            AssetType.Property
        ]

        audit?.push({
            stage: "withdrawal",
            message: `TaxOptimized step 1: filling basic-rate band from taxable assets (Cash → Bonds → Stocks → Pension → Property).`
        })

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

            if (withdrawal > 0) {
                assets[type] -= withdrawal
                remaining -= withdrawal
                taxableWithdrawn += withdrawal
                audit?.push({
                    stage: "withdrawal",
                    message: `TaxOptimized step 1: took ${fmt(withdrawal)} from ${ASSET_LABELS[type]} within basic-rate band.`
                })
            }
        }

        // Step 2: Draw remaining shortfall from ISAs (tax-free)
        if (remaining > 0) {
            const isaAvailable = Math.max(0, assets[AssetType.ISA])
            const isaWithdrawal = Math.min(remaining, isaAvailable)
            if (isaWithdrawal > 0) {
                assets[AssetType.ISA] -= isaWithdrawal
                remaining -= isaWithdrawal
                audit?.push({
                    stage: "withdrawal",
                    message: `TaxOptimized step 2: took ${fmt(isaWithdrawal)} from ISA (tax-free).`
                })
            } else if (remaining > 0.01) {
                audit?.push({
                    stage: "withdrawal",
                    message: `TaxOptimized step 2: ISA empty, ${fmt(remaining)} still required.`
                })
            }
        }

        // Step 3: If still shortfall, draw from remaining taxable assets beyond threshold
        if (remaining > 0.01) {
            audit?.push({
                stage: "withdrawal",
                message: `TaxOptimized step 3: forced to draw ${fmt(remaining)} from taxable assets above higher-rate threshold.`
            })
        }
        for (const type of taxableAssetOrder) {
            if (remaining <= 0) {
                break
            }
            const available = Math.max(0, assets[type])
            const withdrawal = Math.min(remaining, available)
            if (withdrawal > 0) {
                assets[type] -= withdrawal
                remaining -= withdrawal
                taxableWithdrawn += withdrawal
                audit?.push({
                    stage: "withdrawal",
                    message: `TaxOptimized step 3: took ${fmt(withdrawal)} from ${ASSET_LABELS[type]} (above higher-rate threshold).`
                })
            }
        }

        return { remaining: Math.max(0, remaining), taxableWithdrawn }
    }
}