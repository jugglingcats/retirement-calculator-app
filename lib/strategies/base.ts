import { AssetDrawdownResult, AssetPool, AssetType, AuditEntry, TaxPosition, TaxSettings } from "@/lib/types"
import { sumAssets, sumNumbers } from "@/lib/utils"
import { updateTaxPosition } from "@/lib/tax"

const fmt = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`

/** Proportion of a crystallised pension that can be taken as a tax-free lump sum. */
const TAX_FREE_LUMP_SUM_PERCENTAGE = 0.25

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

    /** Strategy name used as a prefix in audit messages. */
    public abstract readonly name: string

    /**
     * Withdraw from a single person's assets. Returns the remaining amount that couldn't be withdrawn.
     * `audit` is an optional sink for human-readable audit entries.
     */
    public abstract withdrawFromAssets(
        assets: AssetPool,
        amount: number,
        taxPosition: TaxPosition,
        audit?: AuditEntry[]
    ): AssetDrawdownResult

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
    execute(assetPools: AssetPool[], shortfall: number, taxPosition: TaxPosition[], audit: AuditEntry[] = []) {
        const initialTax = sumNumbers(taxPosition.map(t => t.tax))
        audit.push({
            stage: "setup",
            message: `${this.name}: starting drawdown for shortfall ${fmt(shortfall)} (existing income tax ${fmt(initialTax)}).`
        })

        let drawnSoFar = 0

        // Step 0: Before splitting the shortfall across pools, attempt to fund it
        // by crystallising uncrystallised pension assets in pool order. Each £X
        // crystallised yields £X * 25% as a tax-free lump sum (which counts toward
        // the shortfall) and moves the remaining 75% into the crystallised pension
        // pool (where it remains available as a taxable drawdown if still needed).
        const requiredForCrystallisation = shortfall + initialTax
        if (requiredForCrystallisation > 0.01) {
            for (let i = 0; i < assetPools.length; i++) {
                const remainingNeed = requiredForCrystallisation - drawnSoFar
                if (remainingNeed <= 0.01) break

                const pool = assetPools[i]
                const pensionAvail = Math.max(0, pool[AssetType.Pension])
                if (pensionAvail <= 0) continue

                // To raise £remainingNeed tax-free we must crystallise remainingNeed / 0.25.
                const targetCrystallisation = Math.min(
                    pensionAvail,
                    remainingNeed / TAX_FREE_LUMP_SUM_PERCENTAGE
                )
                const taxFreeLumpSum = targetCrystallisation * TAX_FREE_LUMP_SUM_PERCENTAGE
                const toCrystallised = targetCrystallisation - taxFreeLumpSum

                pool[AssetType.Pension] -= targetCrystallisation
                pool[AssetType.PensionCrystallised] += toCrystallised
                drawnSoFar += taxFreeLumpSum

                const personLabel = assetPools.length > 1 ? (i === 0 ? "Me" : "Partner") : "Pool"
                audit.push({
                    stage: "crystallisation",
                    message:
                        `${personLabel}: crystallised ${fmt(targetCrystallisation)} of pension → ` +
                        `${fmt(taxFreeLumpSum)} tax-free lump sum applied to shortfall, ` +
                        `${fmt(toCrystallised)} retained in crystallised pension pool.`
                })
            }

            if (drawnSoFar > 0) {
                audit.push({
                    stage: "crystallisation",
                    message:
                        `Pension crystallisation funded ${fmt(drawnSoFar)} tax-free toward required ` +
                        `${fmt(requiredForCrystallisation)} (shortfall + existing tax).`
                })
            }
        }

        let count = 0
        const MAX_ITER = 15
        while (count++ < MAX_ITER) {
            const eligible = assetPools.map((pool, i) => ({ pool, idx: i })).filter(item => sumAssets(item.pool) > 0)

            if (eligible.length === 0) {
                audit.push({
                    stage: "iteration",
                    message: `Iteration ${count}: no remaining assets to draw from — stopping.`
                })
                break
            }

            const currentTaxLiability = sumNumbers(taxPosition.map(t => t.tax))
            const required = shortfall + currentTaxLiability
            const needed = required - drawnSoFar
            if (needed <= 0.01) {
                audit.push({
                    stage: "iteration",
                    message: `Iteration ${count}: drawn ${fmt(drawnSoFar)} covers required ${fmt(required)} (shortfall + tax) — done.`
                })
                break
            }

            const neededFromEach = needed / eligible.length
            audit.push({
                stage: "iteration",
                message: `Iteration ${count}: need a further ${fmt(needed)} ` + `→ ${fmt(neededFromEach)} each.`
            })

            for (const item of eligible) {
                const personLabel = assetPools.length > 1 ? (item.idx === 0 ? "Me" : "Partner") : "Pool"
                audit.push({
                    stage: "withdrawal",
                    message: `${personLabel}: requesting ${fmt(neededFromEach)} via ${this.name}.`
                })
                const result = this.withdrawFromAssets(item.pool, neededFromEach, taxPosition[item.idx], audit)
                const withdrawn = neededFromEach - result.remaining
                drawnSoFar += withdrawn
                audit.push({
                    stage: "withdrawal",
                    message:
                        `${personLabel}: withdrew ${fmt(withdrawn)} ` +
                        `(taxable portion ${fmt(result.taxableWithdrawn)}, unfunded ${fmt(result.remaining)}).`
                })
                // Roll the taxable portion of this withdrawal into the running tax
                // position so the next iteration sees an up-to-date liability.
                if (result.taxableWithdrawn > 0) {
                    const before = taxPosition[item.idx].tax
                    taxPosition[item.idx] = updateTaxPosition(result.taxableWithdrawn, taxPosition[item.idx])
                    const after = taxPosition[item.idx].tax
                    audit.push({
                        stage: "tax-update",
                        message:
                            `${personLabel}: rolling ${fmt(result.taxableWithdrawn)} taxable income into tax position; ` +
                            `tax owed ${fmt(before)} → ${fmt(after)}.`
                    })
                }
            }
        }
        const finalTax = sumNumbers(taxPosition.map(t => t.tax))
        const remaining = shortfall + finalTax - drawnSoFar
        if (count >= MAX_ITER && remaining > 0.01) {
            const msg =
                `Could not fully fund shortfall ${fmt(shortfall)} + tax ${fmt(finalTax)} after ${count} attempts. ` +
                `Remaining: ${fmt(remaining)}.`
            console.log(msg)
            audit.push({ stage: "summary", message: msg })
        } else {
            audit.push({
                stage: "summary",
                message:
                    `Done after ${count} iteration${count === 1 ? "" : "s"}. ` +
                    `Total drawn ${fmt(drawnSoFar)}; final income tax ${fmt(finalTax)}.`
            })
        }
    }
}
