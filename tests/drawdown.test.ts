import { describe, it, expect } from "vitest"
import { performDrawdown, AssetBalances } from "@/lib/drawdown"
import { AssetType } from "@/types"

function createAssets(overrides: Partial<AssetBalances> = {}): AssetBalances {
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

describe("performDrawdown", () => {
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
})
