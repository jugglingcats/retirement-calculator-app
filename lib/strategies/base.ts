import { AssetDrawdownResult, AssetPool, TaxPosition, TaxSettings } from "@/lib/types"
import { sumAssets, sumNumbers } from "@/lib/utils"
import { updateTaxPosition } from "@/lib/tax"

/**
 * Base class for drawdown strategies. Handles common tax calculation logic
 * and defines the interface for strategy implementations.
 */
export abstract class BaseDrawdownStrategy {
    protected taxSettings: TaxSettings
    protected growthRates: AssetPool

    constructor(taxSettings: TaxSettings, growthRates: AssetPool) {
        this.taxSettings = taxSettings
        this.growthRates = growthRates
    }

    /**
     * Withdraw from a single person's assets. Returns the remaining amount that couldn't be withdrawn.
     */
    public abstract withdrawFromAssets(assets: AssetPool, amount: number, taxPosition: TaxPosition): AssetDrawdownResult

    /**
     * Main entry point - decides whether to use single or split execution.
     *
     * Iteratively draws enough from the asset pools to cover the spending
     * shortfall AND the resulting income tax liability. Each round we
     * recompute the tax owed based on taxable withdrawals taken so far, and
     * top up the drawdown to cover any newly-incurred tax. This is required
     * because drawing from taxable assets (e.g. pensions) creates additional
     * tax that must itself be funded from further drawdown.
     */
    execute(assetPools: AssetPool[], shortfall: number, taxPosition: TaxPosition[]) {
        let drawnSoFar = 0
        let count = 0
        const MAX_ITER = 15
        while (count++ < MAX_ITER) {
            const eligible = assetPools
                .map((pool, i) => ({ pool, idx: i }))
                .filter(item => sumAssets(item.pool) > 0)
            if (eligible.length === 0) break

            const currentTaxLiability = sumNumbers(taxPosition.map(t => t.tax))
            const required = shortfall + currentTaxLiability
            const needed = required - drawnSoFar
            if (needed <= 0.01) break

            const neededFromEach = needed / eligible.length
            for (const item of eligible) {
                const result = this.withdrawFromAssets(
                    item.pool,
                    neededFromEach,
                    taxPosition[item.idx]
                )
                const withdrawn = neededFromEach - result.remaining
                drawnSoFar += withdrawn
                // Roll the taxable portion of this withdrawal into the running tax
                // position so the next iteration sees an up-to-date liability.
                if (result.taxableWithdrawn > 0) {
                    taxPosition[item.idx] = updateTaxPosition(result.taxableWithdrawn, taxPosition[item.idx])
                }
            }
        }
        if (count >= MAX_ITER) {
            const finalTax = sumNumbers(taxPosition.map(t => t.tax))
            const remaining = shortfall + finalTax - drawnSoFar
            if (remaining > 0.01) {
                console.log(
                    `Could not fully fund shortfall ${shortfall} + tax ${finalTax} after ${count} attempts. ` +
                        `Remaining: ${remaining}.`
                )
            }
        }
    }
}