import { AssetBalances, AssetDrawdownResult, PersonIncomeData, SplitShortfallResult, TaxSettings } from "@/lib/types"
import { AssetType } from "@/types"
import { calculateIncomeTax } from "@/lib/utils"

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

    protected calcTax(taxableIncome: number): number {
        return calculateIncomeTax(
            taxableIncome,
            this.taxSettings.personalAllowance,
            this.taxSettings.higherRateThreshold
        )
    }

    protected getTaxableIncome(income: PersonIncomeData): number {
        return income.statePension + income.retirementIncome
    }

    protected sumAllAssets(assets: AssetBalances): number {
        return Object.values(AssetType).reduce((sum, type) => sum + Math.max(0, assets[type]), 0)
    }

    /**
     * Withdraw from a single person's assets. Returns the remaining amount that couldn't be withdrawn.
     */
    public abstract withdrawFromAssets(
        assets: AssetBalances,
        amount: number,
        currentTaxableIncome: number
    ): AssetDrawdownResult

    /**
     * Execute drawdown for a single person (no spouse assets).
     */
    executeSingle(
        assets: AssetBalances,
        requiredNetIncome: number,
        existingGrossIncome: PersonIncomeData
    ): SplitShortfallResult {
        const taxableIncome = this.getTaxableIncome(existingGrossIncome)
        const minimumTaxToPay = this.calcTax(taxableIncome)
        const totalNeeded = requiredNetIncome + minimumTaxToPay

        const result = this.withdrawFromAssets(assets, totalNeeded, taxableIncome)
        const finalTax = this.calcTax(taxableIncome + result.taxableWithdrawn)

        return {
            primaryTax: finalTax,
            spouseTax: 0,
            primaryWithdrawn: totalNeeded,
            spouseWithdrawn: 0
        }
    }

    /**
     * Execute drawdown split between primary and spouse.
     */
    executeSplit(
        primaryAssets: AssetBalances,
        spouseAssets: AssetBalances,
        shortfall: number,
        primaryIncome: PersonIncomeData,
        spouseIncome: PersonIncomeData
    ): SplitShortfallResult {
        const primaryTaxable = this.getTaxableIncome(primaryIncome)
        const spouseTaxable = this.getTaxableIncome(spouseIncome)

        // Estimate tax assuming proportional split based on asset ratios
        const primaryTotal = this.sumAllAssets(primaryAssets)
        const spouseTotal = this.sumAllAssets(spouseAssets)
        const totalAssets = primaryTotal + spouseTotal

        const primaryRatio = primaryTotal / totalAssets
        const spouseRatio = spouseTotal / totalAssets

        const primaryTaxEstimate = this.calcTax(primaryTaxable + shortfall * primaryRatio)
        const spouseTaxEstimate = this.calcTax(spouseTaxable + shortfall * spouseRatio)

        const totalNeeded = shortfall + primaryTaxEstimate + spouseTaxEstimate

        return this.executeSplitCommon(primaryAssets, spouseAssets, totalNeeded, primaryTaxable, spouseTaxable)
    }

    /**
     * Common split execution pattern: try half from each, then cover remainder.
     */
    protected executeSplitCommon(
        primaryAssets: AssetBalances,
        spouseAssets: AssetBalances,
        totalNeeded: number,
        primaryTaxable: number,
        spouseTaxable: number
    ): SplitShortfallResult {
        const halfAmount = totalNeeded / 2

        // First pass: try to withdraw half from each
        const { remaining: primaryRemaining } = this.withdrawFromAssets(primaryAssets, halfAmount, primaryTaxable)
        let primaryWithdrawn = halfAmount - primaryRemaining

        const { remaining: spouseRemaining } = this.withdrawFromAssets(spouseAssets, halfAmount, spouseTaxable)
        let spouseWithdrawn = halfAmount - spouseRemaining

        // Second pass: if one couldn't cover their half, take more from the other
        const totalRemaining = primaryRemaining + spouseRemaining

        if (totalRemaining > 0) {
            const { remaining: extraFromPrimary } = this.withdrawFromAssets(
                primaryAssets,
                totalRemaining,
                primaryTaxable
            )
            primaryWithdrawn += totalRemaining - extraFromPrimary

            if (extraFromPrimary > 0) {
                const { remaining: extraFromSpouse } = this.withdrawFromAssets(
                    spouseAssets,
                    extraFromPrimary,
                    spouseTaxable
                )
                spouseWithdrawn += extraFromPrimary - extraFromSpouse
            }
        }

        // Recalculate actual tax based on what was withdrawn
        const primaryActualTax = this.calcTax(primaryTaxable + primaryWithdrawn)
        const spouseActualTax = this.calcTax(spouseTaxable + spouseWithdrawn)

        return {
            primaryTax: primaryActualTax,
            spouseTax: spouseActualTax,
            primaryWithdrawn,
            spouseWithdrawn
        }
    }

    /**
     * Main entry point - decides whether to use single or split execution.
     */
    execute(
        primaryAssets: AssetBalances,
        spouseAssets: AssetBalances,
        shortfall: number,
        primaryIncome: PersonIncomeData,
        spouseIncome: PersonIncomeData
    ): SplitShortfallResult {
        // add any cash deficit to shortfall (need to find this cash to pay taxes!)
        let required = shortfall
        const primaryCashDeficit = primaryAssets[AssetType.Cash]
        if (primaryCashDeficit < 0) {
            required += primaryCashDeficit
            primaryAssets[AssetType.Cash] = 0
        }
        const spouseCashDeficit = spouseAssets[AssetType.Cash]
        if (spouseCashDeficit < 0) {
            required += spouseCashDeficit
            spouseAssets[AssetType.Cash] = 0
        }

        // TODO: doesn't take into account spouse's potential regular income
        const spouseTotalAssets = this.sumAllAssets(spouseAssets)
        if (spouseTotalAssets <= 0) {
            return this.executeSingle(primaryAssets, required, primaryIncome)
        }

        return this.executeSplit(primaryAssets, spouseAssets, required, primaryIncome, spouseIncome)
    }
}
