import { describe, expect, it } from "vitest"
import { AssetType } from "@/types"
import { AssetPool, AssetDrawdownResult, TaxSettings } from "@/lib/types"
import { BalancedStrategy } from "@/lib/strategies/strategyBalanced"
import { LowestGrowthFirstStrategy } from "@/lib/strategies/strategyLowestGrowthFirst"
import { TaxOptimizedStrategy } from "@/lib/strategies/strategyTaxOptimized"

const DEFAULT_TAX_SETTINGS: TaxSettings = {
    personalAllowance: 0,
    higherRateThreshold: 0
}

/**
 * Performs drawdown from assets to meet a shortfall amount.
 * Modifies the assets object in place and returns the total amount withdrawn.
 */
export function performDrawdown(
    assets: AssetPool,
    expenditure: number,
    growthRates: Record<AssetType, number>,
    strategy: "lowest_growth_first" | "balanced"
): number {
    if (expenditure <= 0) {
        return 0
    }

    const result =
        strategy === "balanced"
            ? new BalancedStrategy(DEFAULT_TAX_SETTINGS, growthRates).withdrawFromAssets(assets, expenditure)
            : new LowestGrowthFirstStrategy(DEFAULT_TAX_SETTINGS, growthRates).withdrawFromAssets(assets, expenditure)

    return expenditure - result.remaining
}

/**
 * Tax-optimized drawdown for a single person's assets.
 * Modifies the assets object in place.
 */
export function performTaxOptimizedDrawdown(
    assets: AssetPool,
    amount: number,
    currentTaxableIncome: number,
    growthRates: Record<AssetType, number>,
    taxSettings: TaxSettings,
    includeSpouse: boolean
): AssetDrawdownResult {
    if (amount <= 0) {
        return { remaining: 0, taxableWithdrawn: 0 }
    }

    const { higherRateThreshold } = taxSettings
    const effectiveThreshold = includeSpouse ? higherRateThreshold * 2 : higherRateThreshold

    return new TaxOptimizedStrategy(
        {
            personalAllowance: 0,
            higherRateThreshold: effectiveThreshold
        },
        growthRates
    ).withdrawFromAssets(assets, amount, {
        personalAllowanceRemaining: 0,
        basicRateRemaining: 0,
        tax: 0
    })
}

function createAssets(overrides: Partial<AssetPool> = {}): AssetPool {
    return {
        [AssetType.Pension]: 0,
        [AssetType.Cash]: 0,
        [AssetType.StocksAndShares]: 0,
        [AssetType.ISA]: 0,
        [AssetType.Bonds]: 0,
        [AssetType.Property]: 0,
        ...overrides
    }
}

function createGrowthRates(overrides: Partial<Record<AssetType, number>> = {}): Record<AssetType, number> {
    return {
        [AssetType.Pension]: 0.05,
        [AssetType.Cash]: 0.01,
        [AssetType.StocksAndShares]: 0.07,
        [AssetType.ISA]: 0.06,
        [AssetType.Bonds]: 0.03,
        [AssetType.Property]: 0.04,
        ...overrides
    }
}

describe("balanced strategy", () => {
    it("withdraws proportionally from multiple asset classes", () => {
        const assets = createAssets({
            [AssetType.Pension]: 50000,
            [AssetType.ISA]: 50000
        })
        const growthRates = createGrowthRates()

        const withdrawn = performDrawdown(assets, 10000, growthRates, "balanced")

        expect(withdrawn).toBe(10000)
        // 50/50 split means 5000 from each
        expect(assets[AssetType.Pension]).toBe(45000)
        expect(assets[AssetType.ISA]).toBe(45000)
    })

    it("withdraws proportionally based on relative sizes", () => {
        const assets = createAssets({
            [AssetType.Pension]: 75000,
            [AssetType.ISA]: 25000
        })
        const growthRates = createGrowthRates()

        const withdrawn = performDrawdown(assets, 10000, growthRates, "balanced")

        expect(withdrawn).toBe(10000)
        // 75/25 split means 7500 from pension, 2500 from ISA
        expect(assets[AssetType.Pension]).toBe(67500)
        expect(assets[AssetType.ISA]).toBe(22500)
    })

    it("handles withdrawal when one asset is insufficient", () => {
        const assets = createAssets({
            [AssetType.Pension]: 1000,
            [AssetType.ISA]: 99000
        })
        const growthRates = createGrowthRates()

        // Try to withdraw 10000 (1% from pension = 100, 99% from ISA = 9900)
        const withdrawn = performDrawdown(assets, 10000, growthRates, "balanced")

        expect(withdrawn).toBe(10000)
        expect(assets[AssetType.Pension]).toBe(900)
        expect(assets[AssetType.ISA]).toBe(89100)
    })

    it("withdraws everything when amount exceeds total assets", () => {
        const assets = createAssets({
            [AssetType.Cash]: 5000,
            [AssetType.ISA]: 5000
        })
        const growthRates = createGrowthRates()

        const withdrawn = performDrawdown(assets, 20000, growthRates, "balanced")

        expect(withdrawn).toBe(10000)
        expect(assets[AssetType.Cash]).toBe(0)
        expect(assets[AssetType.ISA]).toBe(0)
    })

    it("returns 0 when amount is zero", () => {
        const assets = createAssets({
            [AssetType.Pension]: 50000
        })
        const growthRates = createGrowthRates()

        const withdrawn = performDrawdown(assets, 0, growthRates, "balanced")

        expect(withdrawn).toBe(0)
        expect(assets[AssetType.Pension]).toBe(50000)
    })

    it("returns 0 when no assets available", () => {
        const assets = createAssets()
        const growthRates = createGrowthRates()

        const withdrawn = performDrawdown(assets, 10000, growthRates, "balanced")

        expect(withdrawn).toBe(0)
    })
})

describe("lowest_growth_first strategy", () => {
    it("withdraws from lowest growth rate asset first", () => {
        const assets = createAssets({
            [AssetType.Cash]: 50000, // 1% growth
            [AssetType.StocksAndShares]: 50000 // 7% growth
        })
        const growthRates = createGrowthRates()

        const withdrawn = performDrawdown(assets, 10000, growthRates, "lowest_growth_first")

        expect(withdrawn).toBe(10000)
        // Should take all from cash first (lowest growth)
        expect(assets[AssetType.Cash]).toBe(40000)
        expect(assets[AssetType.StocksAndShares]).toBe(50000)
    })

    it("moves to next asset when first is exhausted", () => {
        const assets = createAssets({
            [AssetType.Cash]: 5000, // 1% growth
            [AssetType.Bonds]: 50000, // 3% growth
            [AssetType.StocksAndShares]: 50000 // 7% growth
        })
        const growthRates = createGrowthRates()

        const withdrawn = performDrawdown(assets, 10000, growthRates, "lowest_growth_first")

        expect(withdrawn).toBe(10000)
        // Should exhaust cash (5000), then take 5000 from bonds
        expect(assets[AssetType.Cash]).toBe(0)
        expect(assets[AssetType.Bonds]).toBe(45000)
        expect(assets[AssetType.StocksAndShares]).toBe(50000)
    })

    it("respects custom growth rates", () => {
        const assets = createAssets({
            [AssetType.Pension]: 50000,
            [AssetType.ISA]: 50000
        })
        // Make pension have lower growth than ISA
        const growthRates = createGrowthRates({
            [AssetType.Pension]: 0.02,
            [AssetType.ISA]: 0.08
        })

        const withdrawn = performDrawdown(assets, 10000, growthRates, "lowest_growth_first")

        expect(withdrawn).toBe(10000)
        // Should take from pension first (lower growth)
        expect(assets[AssetType.Pension]).toBe(40000)
        expect(assets[AssetType.ISA]).toBe(50000)
    })

    it("handles equal growth rates", () => {
        const assets = createAssets({
            [AssetType.Pension]: 50000,
            [AssetType.ISA]: 50000
        })
        const growthRates = createGrowthRates({
            [AssetType.Pension]: 0.05,
            [AssetType.ISA]: 0.05
        })

        const withdrawn = performDrawdown(assets, 10000, growthRates, "lowest_growth_first")

        expect(withdrawn).toBe(10000)
        // With equal rates, order depends on enum order - just verify total withdrawn
        const totalRemaining = assets[AssetType.Pension] + assets[AssetType.ISA]
        expect(totalRemaining).toBe(90000)
    })

    it("withdraws everything when amount exceeds total assets", () => {
        const assets = createAssets({
            [AssetType.Cash]: 5000,
            [AssetType.ISA]: 5000
        })
        const growthRates = createGrowthRates()

        const withdrawn = performDrawdown(assets, 20000, growthRates, "lowest_growth_first")

        expect(withdrawn).toBe(10000)
        expect(assets[AssetType.Cash]).toBe(0)
        expect(assets[AssetType.ISA]).toBe(0)
    })

    it("returns 0 when amount is zero", () => {
        const assets = createAssets({
            [AssetType.Pension]: 50000
        })
        const growthRates = createGrowthRates()

        const withdrawn = performDrawdown(assets, 0, growthRates, "lowest_growth_first")

        expect(withdrawn).toBe(0)
        expect(assets[AssetType.Pension]).toBe(50000)
    })
})

describe.skip("tax optimised strategy", () => {
    const defaultCurrentTaxableIncome = 20000
    const defaultTaxSettings: TaxSettings = {
        personalAllowance: 12500,
        higherRateThreshold: 50270
    }

    const defaultGrowthRates = createGrowthRates()

    it("withdraws from taxable assets first up to threshold room", () => {
        const assets = createAssets({
            [AssetType.Cash]: 50000,
            [AssetType.Pension]: 50000,
            [AssetType.ISA]: 50000
        })
        // Room before higher rate = 50270 - 20000 = 30270
        const result = performTaxOptimizedDrawdown(
            assets,
            20000,
            defaultCurrentTaxableIncome,
            defaultGrowthRates,
            defaultTaxSettings,
            false
        )

        expect(result.remaining).toBe(0)
        expect(result.taxableWithdrawn).toBe(20000)
        // Should take all from taxable (cash first), ISA untouched
        expect(assets[AssetType.Cash]).toBe(30000)
        expect(assets[AssetType.Pension]).toBe(50000)
        expect(assets[AssetType.ISA]).toBe(50000)
    })

    it("withdraws from ISA after taxable threshold is reached", () => {
        const assets = createAssets({
            [AssetType.Cash]: 50000,
            [AssetType.Pension]: 50000,
            [AssetType.ISA]: 50000
        })
        // Room before higher rate = 50270 - 20000 = 30270
        // Need 40000, so 30270 from taxable, 9730 from ISA
        const result = performTaxOptimizedDrawdown(
            assets,
            40000,
            defaultCurrentTaxableIncome,
            defaultGrowthRates,
            defaultTaxSettings,
            false
        )

        expect(result.remaining).toBe(0)
        expect(result.taxableWithdrawn).toBe(30270) // Only taxable portion
        // Should take 30270 from cash (up to threshold), then 9730 from ISA
        expect(assets[AssetType.Cash]).toBe(19730)
        expect(assets[AssetType.Pension]).toBe(50000)
        expect(assets[AssetType.ISA]).toBe(40270)
    })

    it("doubles threshold when spouse is included", () => {
        const assets = createAssets({
            [AssetType.Cash]: 100000,
            [AssetType.ISA]: 50000
        })
        // Joint threshold = 50270 * 2 = 100540
        // Room before higher rate = 100540 - 20000 = 80540
        const result = performTaxOptimizedDrawdown(
            assets,
            50000,
            defaultCurrentTaxableIncome,
            defaultGrowthRates,
            defaultTaxSettings,
            true
        )

        expect(result.remaining).toBe(0)
        expect(result.taxableWithdrawn).toBe(50000) // All from taxable within threshold
        // All 50000 should come from cash (within joint threshold)
        expect(assets[AssetType.Cash]).toBe(50000)
        expect(assets[AssetType.ISA]).toBe(50000)
    })

    it("withdraws in order: Cash -> Pension -> Property for taxable", () => {
        const assets = createAssets({
            [AssetType.Cash]: 5000,
            [AssetType.Pension]: 5000,
            [AssetType.Property]: 5000,
            [AssetType.ISA]: 50000
        })
        const result = performTaxOptimizedDrawdown(
            assets,
            12000,
            defaultCurrentTaxableIncome,
            defaultGrowthRates,
            defaultTaxSettings,
            false
        )

        expect(result.remaining).toBe(0)
        expect(result.taxableWithdrawn).toBe(12000) // All from taxable assets
        // Should exhaust cash, then pension, then 2000 from property
        expect(assets[AssetType.Cash]).toBe(0)
        expect(assets[AssetType.Pension]).toBe(0)
        expect(assets[AssetType.Property]).toBe(3000)
        expect(assets[AssetType.ISA]).toBe(50000)
    })

    it("uses ISA when taxable assets insufficient within threshold", () => {
        const assets = createAssets({
            [AssetType.Cash]: 10000,
            [AssetType.ISA]: 50000
        })
        // Room = 30270, but only 10000 cash available
        const result = performTaxOptimizedDrawdown(
            assets,
            20000,
            defaultCurrentTaxableIncome,
            defaultGrowthRates,
            defaultTaxSettings,
            false
        )

        expect(result.remaining).toBe(0)
        expect(result.taxableWithdrawn).toBe(10000) // Only 10000 from taxable (cash)
        // 10000 from cash (all available), 10000 from ISA
        expect(assets[AssetType.Cash]).toBe(0)
        expect(assets[AssetType.ISA]).toBe(40000)
    })

    it("forces taxable withdrawal beyond threshold when ISA exhausted", () => {
        const assets = createAssets({
            [AssetType.Cash]: 50000,
            [AssetType.Pension]: 50000,
            [AssetType.ISA]: 5000
        })
        // Room = 30270, need 50000
        // 30270 from taxable, 5000 from ISA, still need 14730 -> forced from taxable
        const result = performTaxOptimizedDrawdown(
            assets,
            50000,
            defaultCurrentTaxableIncome,
            defaultGrowthRates,
            defaultTaxSettings,
            false
        )

        expect(result.remaining).toBe(0)
        expect(result.taxableWithdrawn).toBe(45000) // 30270 + 14730 forced beyond threshold
        // 30270 + 14730 = 45000 from cash, 5000 from ISA
        expect(assets[AssetType.Cash]).toBe(5000)
        expect(assets[AssetType.ISA]).toBe(0)
    })

    it("returns remaining shortfall when all assets exhausted", () => {
        const assets = createAssets({
            [AssetType.Cash]: 10000,
            [AssetType.ISA]: 5000
        })
        const result = performTaxOptimizedDrawdown(
            assets,
            20000,
            defaultCurrentTaxableIncome,
            defaultGrowthRates,
            defaultTaxSettings,
            false
        )

        expect(result.remaining).toBe(5000)
        expect(result.taxableWithdrawn).toBe(10000) // All taxable withdrawn
        expect(assets[AssetType.Cash]).toBe(0)
        expect(assets[AssetType.ISA]).toBe(0)
    })

    it("returns 0 when amount is zero", () => {
        const assets = createAssets({
            [AssetType.Cash]: 50000,
            [AssetType.ISA]: 50000
        })
        const result = performTaxOptimizedDrawdown(
            assets,
            0,
            defaultCurrentTaxableIncome,
            defaultGrowthRates,
            defaultTaxSettings,
            false
        )

        expect(result.remaining).toBe(0)
        expect(result.taxableWithdrawn).toBe(0)
        expect(assets[AssetType.Cash]).toBe(50000)
        expect(assets[AssetType.ISA]).toBe(50000)
    })

    it("handles case when already above threshold", () => {
        const assets = createAssets({
            [AssetType.Cash]: 50000,
            [AssetType.ISA]: 50000
        })
        // Current income already at threshold
        const result = performTaxOptimizedDrawdown(assets, 20000, 50270, defaultGrowthRates, defaultTaxSettings, false)

        expect(result.remaining).toBe(0)
        expect(result.taxableWithdrawn).toBe(0) // No room for taxable withdrawals
        // All should come from ISA since no room for taxable withdrawals
        expect(assets[AssetType.Cash]).toBe(50000)
        expect(assets[AssetType.ISA]).toBe(30000)
    })

    it("handles case when current income exceeds threshold", () => {
        const assets = createAssets({
            [AssetType.Cash]: 50000,
            [AssetType.ISA]: 50000
        })
        // Current income above threshold
        const result = performTaxOptimizedDrawdown(assets, 20000, 60000, defaultGrowthRates, defaultTaxSettings, false)

        expect(result.remaining).toBe(0)
        expect(result.taxableWithdrawn).toBe(0) // No room, already over threshold
        // All should come from ISA since already over threshold
        expect(assets[AssetType.Cash]).toBe(50000)
        expect(assets[AssetType.ISA]).toBe(30000)
    })
})
