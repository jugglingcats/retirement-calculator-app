import { AssetDrawdownResult, AssetPool, AssetType, TaxPosition, TaxSettings } from "@/lib/types"
import { sumAssets, sumNumbers } from "@/lib/utils"

/**
 * Base class for drawdown strategies. Handles common tax calculation logic
 * and defines the interface for strategy implementations.
 */
export abstract class BaseDrawdownStrategy {
    protected taxSettings: TaxSettings
    protected growthRates: Record<AssetType, number>

    constructor(taxSettings: TaxSettings, growthRates: Record<AssetType, number>) {
        this.taxSettings = taxSettings
        this.growthRates = growthRates
    }

    /**
     * Withdraw from a single person's assets. Returns the remaining amount that couldn't be withdrawn.
     */
    public abstract withdrawFromAssets(assets: AssetPool, amount: number, taxPosition: TaxPosition): AssetDrawdownResult

    /**
     * Main entry point - decides whether to use single or split execution.
     */
    execute(assetPools: AssetPool[], shortfall: number, taxPosition: TaxPosition[]) {
        const initialTaxLiability = sumNumbers(taxPosition.map(t => t.tax))

        let needed = shortfall + initialTaxLiability
        let count = 0
        while (count++ < 10 && needed > 0 && assetPools.some(pool => sumAssets(pool) > 0)) {
            const eligible = assetPools
                .map((pool, i) => ({
                    pool,
                    taxPosition: taxPosition[i]
                }))
                .filter(item => sumAssets(item.pool) > 0)

            // naive approach: draw from each pool equally
            const neededFromEach = eligible.map(_ => needed / eligible.length)
            eligible.forEach((item, i) => {
                const { remaining } = this.withdrawFromAssets(item.pool, neededFromEach[i], item.taxPosition)
                const withdrawn = neededFromEach[i] - remaining
                needed -= withdrawn
            })
        }
        if (count === 10)
            console.log(
                `Could not split shortfall ${shortfall} between primary and spouse after ${count} attempts.` +
                    `Remaining shortfall: ${needed}.`
            )
    }
}
